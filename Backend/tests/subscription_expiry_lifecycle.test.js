import test from "node:test";
import assert from "node:assert";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import app from "../src/app.js";
import { pool } from "../src/config/db.js";
import {
    processExpiredSubscriptions,
    verifySubscriptionAccess,
} from "../src/services/subscription.service.js";
import { runSubscriptionExpiryJob } from "../src/workers/subscriptionExpiry.worker.js";

test("Subscription Expiry Lifecycle & Access Suite", async (t) => {
    const server = app.listen(0);
    const port = server.address().port;
    const baseUrl = `http://localhost:${port}/api/v1`;
    const jwtSecret = process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET || "default_jwt_secret_publiclab";

    const unique = Date.now();
    let ownerId;
    let labId;
    let labToken;
    let planId;

    // Fetch active plan
    const planRes = await pool.query(`SELECT id FROM subscription_plans WHERE is_active = TRUE LIMIT 1`);
    assert.ok(planRes.rows.length > 0, "Active subscription plan must exist");
    planId = planRes.rows[0].id;

    // Create test lab owner
    const ownerRes = await pool.query(
        `INSERT INTO users (full_name, email, password_hash, role, account_status, email_verified)
         VALUES ('Expiry Owner', $1, 'hash', 'lab', 'active', TRUE)
         RETURNING id`,
        [`owner_exp_${unique}@expiry.test`]
    );
    ownerId = ownerRes.rows[0].id;

    // Create approved lab
    const labRes = await pool.query(
        `INSERT INTO labs (name, registration_number, email, phone, address, city, owner_id, approval_status)
         VALUES ($1, $2, $3, '9888811111', '101 Expiry Rd', 'Metropolis', $4, 'approved')
         RETURNING id`,
        [`Expiry Lab ${unique}`, `REG-EXP-${unique}`, `lab_exp_${unique}@expiry.test`, ownerId]
    );
    labId = labRes.rows[0].id;

    await pool.query(`UPDATE users SET lab_id = $1 WHERE id = $2`, [labId, ownerId]);

    labToken = jwt.sign(
        { sub: String(ownerId), id: ownerId, role: "lab", labId },
        jwtSecret,
        { expiresIn: "1h" }
    );

    try {
        await t.test("1. Expire subscription whose current_period_end passed without cancel_at_period_end -> marks past_due", async () => {
            // Insert active subscription with past period end and cancel_at_period_end = FALSE
            const subRes = await pool.query(
                `INSERT INTO subscriptions (lab_id, plan_id, status, current_period_start, current_period_end, cancel_at_period_end)
                 VALUES ($1, $2, 'active', NOW() - INTERVAL '31 days', NOW() - INTERVAL '1 day', FALSE)
                 RETURNING id`,
                [labId, planId]
            );
            const subId = subRes.rows[0].id;

            const summary = await processExpiredSubscriptions();
            assert.ok(summary.checked >= 1, "Worker must find expired subscription");
            assert.ok(summary.pastDue >= 1, "Must transition to past_due");
            assert.ok(summary.processedIds.includes(subId), "Processed IDs must include test subscription");

            // Verify in database
            const check = await pool.query(`SELECT status, cancel_at_period_end FROM subscriptions WHERE id = $1`, [subId]);
            assert.strictEqual(check.rows[0].status, "past_due", "Subscription must be marked past_due");

            // Clean up subscription
            await pool.query(`DELETE FROM subscriptions WHERE id = $1`, [subId]);
        });

        await t.test("2. Expire subscription whose current_period_end passed with cancel_at_period_end = true -> marks cancelled", async () => {
            // Insert active subscription scheduled for cancellation at period end
            const subRes = await pool.query(
                `INSERT INTO subscriptions (lab_id, plan_id, status, current_period_start, current_period_end, cancel_at_period_end)
                 VALUES ($1, $2, 'active', NOW() - INTERVAL '31 days', NOW() - INTERVAL '2 hours', TRUE)
                 RETURNING id`,
                [labId, planId]
            );
            const subId = subRes.rows[0].id;

            const summary = await processExpiredSubscriptions();
            assert.ok(summary.checked >= 1, "Worker must check expired subscription");
            assert.ok(summary.cancelled >= 1, "Must transition to cancelled");
            assert.ok(summary.processedIds.includes(subId));

            // Verify in database
            const check = await pool.query(`SELECT status, cancelled_at FROM subscriptions WHERE id = $1`, [subId]);
            assert.strictEqual(check.rows[0].status, "cancelled", "Subscription must be marked cancelled");
            assert.ok(check.rows[0].cancelled_at, "cancelled_at must be populated");

            await pool.query(`DELETE FROM subscriptions WHERE id = $1`, [subId]);
        });

        await t.test("3. Repeated worker runs are idempotent and generate zero duplicate operations", async () => {
            // First run
            const run1 = await processExpiredSubscriptions();
            // Second run immediately after
            const run2 = await processExpiredSubscriptions();

            assert.strictEqual(run2.checked, 0, "Second worker run should find 0 expired active subscriptions");
            assert.strictEqual(run2.cancelled, 0);
            assert.strictEqual(run2.pastDue, 0);
            assert.strictEqual(run2.failed, 0);
            assert.strictEqual(run2.processedIds.length, 0);
        });

        await t.test("4. Active subscriptions with future period_end are never expired", async () => {
            // Insert active subscription expiring in 25 days
            const subRes = await pool.query(
                `INSERT INTO subscriptions (lab_id, plan_id, status, current_period_start, current_period_end, cancel_at_period_end)
                 VALUES ($1, $2, 'active', NOW(), NOW() + INTERVAL '25 days', FALSE)
                 RETURNING id`,
                [labId, planId]
            );
            const subId = subRes.rows[0].id;

            const summary = await processExpiredSubscriptions();
            assert.ok(!summary.processedIds.includes(subId), "Future subscription must not be processed");

            const check = await pool.query(`SELECT status FROM subscriptions WHERE id = $1`, [subId]);
            assert.strictEqual(check.rows[0].status, "active", "Future subscription must remain active");

            await pool.query(`DELETE FROM subscriptions WHERE id = $1`, [subId]);
        });

        await t.test("5. Paid feature access: Granted when active, Rejected when expired or cancelled", async () => {
            // Scenario A: Active subscription -> access granted (200)
            const activeSubRes = await pool.query(
                `INSERT INTO subscriptions (lab_id, plan_id, status, current_period_start, current_period_end)
                 VALUES ($1, $2, 'active', NOW(), NOW() + INTERVAL '30 days')
                 RETURNING id`,
                [labId, planId]
            );
            const activeSubId = activeSubRes.rows[0].id;

            const accessRes1 = await fetch(`${baseUrl}/subscriptions/access/check`, {
                headers: { "Authorization": `Bearer ${labToken}` },
            });
            const accessData1 = await accessRes1.json();
            assert.strictEqual(accessRes1.status, 200, `Expected 200 OK for active subscription, got ${accessRes1.status}`);
            assert.strictEqual(accessData1.success, true);
            assert.strictEqual(accessData1.data.status, "active");

            // Scenario B: Expire subscription -> access rejected (403 SUBSCRIPTION_REQUIRED)
            await pool.query(
                `UPDATE subscriptions
                 SET status = 'past_due',
                     current_period_start = NOW() - INTERVAL '30 days',
                     current_period_end = NOW() - INTERVAL '1 hour'
                 WHERE id = $1`,
                [activeSubId]
            );

            const accessRes2 = await fetch(`${baseUrl}/subscriptions/access/check`, {
                headers: { "Authorization": `Bearer ${labToken}` },
            });
            const accessData2 = await accessRes2.json();
            assert.strictEqual(accessRes2.status, 403, `Expected 403 Forbidden for past_due subscription, got ${accessRes2.status}`);
            assert.strictEqual(accessData2.success, false);
            assert.strictEqual(accessData2.code, "SUBSCRIPTION_REQUIRED");

            // Scenario C: Cancelled subscription -> access rejected (403 SUBSCRIPTION_REQUIRED)
            await pool.query(`UPDATE subscriptions SET status = 'cancelled' WHERE id = $1`, [activeSubId]);
            const accessRes3 = await fetch(`${baseUrl}/subscriptions/access/check`, {
                headers: { "Authorization": `Bearer ${labToken}` },
            });
            const accessData3 = await accessRes3.json();
            assert.strictEqual(accessRes3.status, 403);
            assert.strictEqual(accessData3.code, "SUBSCRIPTION_REQUIRED");

            await pool.query(`DELETE FROM subscriptions WHERE id = $1`, [activeSubId]);
        });

        await t.test("6. Worker runner module executes safely without throwing", async () => {
            const result = await runSubscriptionExpiryJob();
            assert.ok(result !== null);
            assert.strictEqual(typeof result.checked, "number");
            assert.strictEqual(typeof result.failed, "number");
        });
    } finally {
        // Teardown
        try {
            await pool.query(`DELETE FROM subscriptions WHERE lab_id = $1`, [labId]);
            await pool.query(`DELETE FROM labs WHERE id = $1`, [labId]);
            await pool.query(`DELETE FROM users WHERE id = $1`, [ownerId]);
        } catch (_) {}

        server.close();
    }
});
