import test from "node:test";
import assert from "node:assert";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import app from "../src/app.js";
import { pool } from "../src/config/db.js";
import { activateSubscription } from "../src/services/subscription.service.js";
import { confirmPayment, verifyPayment, handleWebhook } from "../src/services/payment.service.js";

test("Subscription Activation Lifecycle Suite", async (t) => {
    const server = app.listen(0);
    const port = server.address().port;
    const baseUrl = `http://localhost:${port}/api/v1`;
    const jwtSecret = process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET || "default_jwt_secret_publiclab";
    const paymentSecret =
        process.env.PAYMENT_WEBHOOK_SECRET ||
        process.env.PAYMENT_SECRET ||
        process.env.JWT_SECRET ||
        "default_publiclab_payment_secret";

    const unique = Date.now();
    let ownerId;
    let labId;
    let patientUserId;
    let labToken;
    let patientToken;
    let monthlyPlanId;
    let yearlyPlanId;

    // 1. Fetch available plans
    const monthlyPlanRes = await pool.query(
        `SELECT id, name, billing_interval FROM subscription_plans WHERE billing_interval = 'monthly' AND is_active = TRUE LIMIT 1`
    );
    assert.ok(monthlyPlanRes.rows.length > 0, "Active monthly subscription plan must exist");
    monthlyPlanId = monthlyPlanRes.rows[0].id;

    const yearlyPlanRes = await pool.query(
        `SELECT id, name, billing_interval FROM subscription_plans WHERE billing_interval = 'yearly' AND is_active = TRUE LIMIT 1`
    );
    assert.ok(yearlyPlanRes.rows.length > 0, "Active yearly subscription plan must exist");
    yearlyPlanId = yearlyPlanRes.rows[0].id;

    // 2. Setup test lab owner & approved lab
    const ownerRes = await pool.query(
        `INSERT INTO users (full_name, email, password_hash, role, account_status, email_verified)
         VALUES ('Lifecycle Owner', $1, 'hash', 'lab', 'active', TRUE)
         RETURNING id`,
        [`owner_${unique}@lifecycle.test`]
    );
    ownerId = ownerRes.rows[0].id;

    const labRes = await pool.query(
        `INSERT INTO labs (name, registration_number, email, phone, address, city, owner_id, approval_status)
         VALUES ($1, $2, $3, '9888877777', '500 Diagnostic Way', 'Metropolis', $4, 'approved')
         RETURNING id`,
        [`Lifecycle Lab ${unique}`, `REG-LC-${unique}`, `lab_${unique}@lifecycle.test`, ownerId]
    );
    labId = labRes.rows[0].id;

    await pool.query(`UPDATE users SET lab_id = $1 WHERE id = $2`, [labId, ownerId]);

    // 3. Setup patient user for authorization checks
    const patientRes = await pool.query(
        `INSERT INTO users (full_name, email, password_hash, role, account_status, email_verified)
         VALUES ('Lifecycle Patient', $1, 'hash', 'patient', 'active', TRUE)
         RETURNING id`,
        [`patient_${unique}@lifecycle.test`]
    );
    patientUserId = patientRes.rows[0].id;

    labToken = jwt.sign(
        { sub: String(ownerId), id: ownerId, role: "lab", labId },
        jwtSecret,
        { expiresIn: "1h" }
    );

    patientToken = jwt.sign(
        { sub: String(patientUserId), id: patientUserId, role: "patient" },
        jwtSecret,
        { expiresIn: "1h" }
    );

    function computeHmac(payload, secret = paymentSecret) {
        return crypto.createHmac("sha256", secret).update(payload).digest("hex");
    }

    try {
        await t.test("1. Successful Subscription Activation upon Verified Payment (Monthly Plan)", async () => {
            // Create pending subscription
            const subRes = await pool.query(
                `INSERT INTO subscriptions (lab_id, plan_id, status)
                 VALUES ($1, $2, 'pending')
                 RETURNING id`,
                [labId, monthlyPlanId]
            );
            const subId = subRes.rows[0].id;

            // Create pending payment
            const idempKey = `idemp-test-success-${crypto.randomUUID()}`;
            const payRes = await pool.query(
                `INSERT INTO payments (subscription_id, amount, currency, payment_status, idempotency_key)
                 VALUES ($1, 999.00, 'INR', 'pending', $2)
                 RETURNING id`,
                [subId, idempKey]
            );
            const payId = payRes.rows[0].id;

            const providerPaymentId = `pay_rzp_${crypto.randomUUID().slice(0, 8)}`;
            const validSignature = computeHmac(`${payId}|${providerPaymentId}`);

            // Call server verification endpoint
            const verifyRes = await fetch(`${baseUrl}/payments/verify`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${labToken}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    paymentId: payId,
                    providerPaymentId,
                    signature: validSignature,
                }),
            });

            const verifyData = await verifyRes.json();
            assert.strictEqual(verifyRes.status, 200, `Expected 200, got ${verifyRes.status}: ${JSON.stringify(verifyData)}`);
            assert.strictEqual(verifyData.success, true);
            assert.strictEqual(verifyData.data.status, "succeeded");

            // Verify subscription row in DB
            const updatedSubRes = await pool.query(
                `SELECT status, current_period_start, current_period_end
                 FROM subscriptions
                 WHERE id = $1`,
                [subId]
            );
            const updatedSub = updatedSubRes.rows[0];
            assert.strictEqual(updatedSub.status, "active", "Subscription must be active");
            assert.ok(updatedSub.current_period_start, "current_period_start must be set");
            assert.ok(updatedSub.current_period_end, "current_period_end must be set");

            const startMs = new Date(updatedSub.current_period_start).getTime();
            const endMs = new Date(updatedSub.current_period_end).getTime();
            assert.ok(endMs > startMs, "current_period_end must be after current_period_start");

            // Difference for 1 month should be roughly 28-31 days
            const daysDiff = (endMs - startMs) / (1000 * 60 * 60 * 24);
            assert.ok(daysDiff >= 28 && daysDiff <= 31, `Expected ~30 days for monthly plan, got ${daysDiff}`);
        });

        await t.test("2. Successful Subscription Activation with Yearly Plan Interval", async () => {
            const subRes = await pool.query(
                `INSERT INTO subscriptions (lab_id, plan_id, status)
                 VALUES ($1, $2, 'pending')
                 RETURNING id`,
                [labId, yearlyPlanId]
            );
            const subId = subRes.rows[0].id;

            const activated = await activateSubscription({
                subscriptionId: subId,
                provider: "razorpay",
            });

            assert.strictEqual(activated.status, "active");
            assert.strictEqual(activated.billing_interval, "yearly");

            const startMs = new Date(activated.current_period_start).getTime();
            const endMs = new Date(activated.current_period_end).getTime();
            const daysDiff = (endMs - startMs) / (1000 * 60 * 60 * 24);
            assert.ok(daysDiff >= 365 && daysDiff <= 366, `Expected ~365 days for yearly plan, got ${daysDiff}`);
        });

        await t.test("3. Never Activate on Unverified / Forged Verification Claims", async () => {
            const subRes = await pool.query(
                `INSERT INTO subscriptions (lab_id, plan_id, status)
                 VALUES ($1, $2, 'pending')
                 RETURNING id`,
                [labId, monthlyPlanId]
            );
            const subId = subRes.rows[0].id;

            const payRes = await pool.query(
                `INSERT INTO payments (subscription_id, amount, currency, payment_status, idempotency_key)
                 VALUES ($1, 999.00, 'INR', 'pending', $2)
                 RETURNING id`,
                [subId, `idemp-forged-${crypto.randomUUID()}`]
            );
            const payId = payRes.rows[0].id;

            // Send forged signature
            const res = await fetch(`${baseUrl}/payments/verify`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${labToken}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    paymentId: payId,
                    providerPaymentId: "fake_payment_123",
                    signature: "forged_invalid_signature_hex_value_1234567890",
                }),
            });

            const data = await res.json();
            assert.strictEqual(res.status, 400);
            assert.strictEqual(data.success, false);
            assert.ok(data.message.includes("signature") || data.message.includes("failed"));

            // Verify subscription remains pending
            const checkSub = await pool.query(`SELECT status, current_period_start FROM subscriptions WHERE id = $1`, [subId]);
            assert.strictEqual(checkSub.rows[0].status, "pending");
            assert.strictEqual(checkSub.rows[0].current_period_start, null);
        });

        await t.test("4. Failed Payments: Update Payment but Do Not Activate Subscription", async () => {
            const subRes = await pool.query(
                `INSERT INTO subscriptions (lab_id, plan_id, status)
                 VALUES ($1, $2, 'pending')
                 RETURNING id`,
                [labId, monthlyPlanId]
            );
            const subId = subRes.rows[0].id;

            const payRes = await pool.query(
                `INSERT INTO payments (subscription_id, amount, currency, payment_status, idempotency_key)
                 VALUES ($1, 999.00, 'INR', 'pending', $2)
                 RETURNING id`,
                [subId, `idemp-fail-${crypto.randomUUID()}`]
            );
            const payId = payRes.rows[0].id;

            // Confirm payment failure
            const result = await confirmPayment({
                paymentId: payId,
                providerPaymentId: "pay_failed_123",
                status: "failed",
                failureReason: "Card was declined by bank due to insufficient funds",
            });

            assert.strictEqual(result.status, "failed");
            assert.strictEqual(result.failure_reason, "Card was declined by bank due to insufficient funds");

            // Check DB
            const checkPay = await pool.query(`SELECT payment_status, failure_reason FROM payments WHERE id = $1`, [payId]);
            assert.strictEqual(checkPay.rows[0].payment_status, "failed");

            const checkSub = await pool.query(`SELECT status, current_period_start FROM subscriptions WHERE id = $1`, [subId]);
            assert.strictEqual(checkSub.rows[0].status, "pending", "Subscription must remain pending when payment fails");
            assert.strictEqual(checkSub.rows[0].current_period_start, null);
        });

        await t.test("5. Idempotent Duplicate Events: Do Not Re-extend Dates or Re-activate", async () => {
            const subRes = await pool.query(
                `INSERT INTO subscriptions (lab_id, plan_id, status)
                 VALUES ($1, $2, 'pending')
                 RETURNING id`,
                [labId, monthlyPlanId]
            );
            const subId = subRes.rows[0].id;

            const payRes = await pool.query(
                `INSERT INTO payments (subscription_id, amount, currency, payment_status, idempotency_key)
                 VALUES ($1, 999.00, 'INR', 'pending', $2)
                 RETURNING id`,
                [subId, `idemp-dup-${crypto.randomUUID()}`]
            );
            const payId = payRes.rows[0].id;

            // First confirmation: activates
            const firstResult = await confirmPayment({
                paymentId: payId,
                providerPaymentId: "pay_dup_success",
                status: "succeeded",
            });
            assert.strictEqual(firstResult.status, "succeeded");
            assert.strictEqual(firstResult.subscription.status, "active");
            const originalPeriodEnd = new Date(firstResult.subscription.current_period_end).toISOString();

            // Duplicate confirmation: should be idempotent
            const duplicateResult = await confirmPayment({
                paymentId: payId,
                providerPaymentId: "pay_dup_success",
                status: "succeeded",
            });
            assert.strictEqual(duplicateResult.status, "succeeded");
            assert.strictEqual(duplicateResult.isDuplicate, true);

            // Re-check subscription dates have NOT been altered
            const subCheck = await pool.query(`SELECT current_period_end FROM subscriptions WHERE id = $1`, [subId]);
            const preservedPeriodEnd = new Date(subCheck.rows[0].current_period_end).toISOString();
            assert.strictEqual(preservedPeriodEnd, originalPeriodEnd, "Idempotent duplicate event must preserve exact period end date");
        });

        await t.test("6. Webhook Ingestion & Replay Protection via payment_webhook_events", async () => {
            const subRes = await pool.query(
                `INSERT INTO subscriptions (lab_id, plan_id, status)
                 VALUES ($1, $2, 'pending')
                 RETURNING id`,
                [labId, monthlyPlanId]
            );
            const subId = subRes.rows[0].id;

            const payRes = await pool.query(
                `INSERT INTO payments (subscription_id, amount, currency, payment_status, idempotency_key)
                 VALUES ($1, 999.00, 'INR', 'pending', $2)
                 RETURNING id`,
                [subId, `idemp-wh-${crypto.randomUUID()}`]
            );
            const payId = payRes.rows[0].id;

            const webhookEventId = `evt_${crypto.randomUUID().slice(0, 12)}`;
            const webhookPayload = {
                id: webhookEventId,
                event: "payment.captured",
                provider: "razorpay",
                paymentId: payId,
                payload: {
                    payment: {
                        entity: {
                            id: `pay_wh_${crypto.randomUUID().slice(0, 8)}`,
                        },
                    },
                },
            };

            const payloadStr = JSON.stringify(webhookPayload);
            const signature = computeHmac(payloadStr);

            // First webhook delivery
            const whRes1 = await fetch(`${baseUrl}/payments/webhook`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-razorpay-signature": signature,
                },
                body: payloadStr,
            });

            const whData1 = await whRes1.json();
            assert.strictEqual(whRes1.status, 200);
            assert.strictEqual(whData1.success, true);

            // Check payment_webhook_events recorded event
            const eventRow = await pool.query(
                `SELECT provider_event_id, processing_status
                 FROM payment_webhook_events
                 WHERE provider_event_id = $1`,
                [webhookEventId]
            );
            assert.strictEqual(eventRow.rows.length, 1);
            assert.strictEqual(eventRow.rows[0].processing_status, "processed");

            // Replay the exact same webhook
            const whRes2 = await fetch(`${baseUrl}/payments/webhook`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-razorpay-signature": signature,
                },
                body: payloadStr,
            });
            const whData2 = await whRes2.json();
            assert.strictEqual(whRes2.status, 200);
            assert.strictEqual(whData2.data.status, "already_processed", "Replayed webhook event must be recognized as already processed");
        });

        await t.test("7. Invalid Subscription States: Rejects Cancelled and Unapproved Labs", async () => {
            // Cancelled subscription
            const cancelledSubRes = await pool.query(
                `INSERT INTO subscriptions (lab_id, plan_id, status)
                 VALUES ($1, $2, 'cancelled')
                 RETURNING id`,
                [labId, monthlyPlanId]
            );
            const cancelledSubId = cancelledSubRes.rows[0].id;

            await assert.rejects(
                async () => {
                    await activateSubscription({ subscriptionId: cancelledSubId });
                },
                (err) => {
                    assert.strictEqual(err.statusCode, 409);
                    assert.ok(err.message.includes("cancelled"));
                    return true;
                }
            );

            // Non-existent subscription
            await assert.rejects(
                async () => {
                    await activateSubscription({ subscriptionId: 999999999 });
                },
                (err) => {
                    assert.strictEqual(err.statusCode, 404);
                    return true;
                }
            );

            // Unapproved laboratory
            const unapprovedLabRes = await pool.query(
                `INSERT INTO labs (name, registration_number, email, phone, address, city, owner_id, approval_status)
                 VALUES ($1, $2, $3, '9111122222', 'Pending Street', 'Pune', $4, 'pending')
                 RETURNING id`,
                [`Unapproved Lab ${unique}`, `REG-UNAPP-${unique}`, `unapp_${unique}@test.com`, ownerId]
            );
            const unappLabId = unapprovedLabRes.rows[0].id;

            const unappSubRes = await pool.query(
                `INSERT INTO subscriptions (lab_id, plan_id, status)
                 VALUES ($1, $2, 'pending')
                 RETURNING id`,
                [unappLabId, monthlyPlanId]
            );
            const unappSubId = unappSubRes.rows[0].id;

            await assert.rejects(
                async () => {
                    await activateSubscription({ subscriptionId: unappSubId });
                },
                (err) => {
                    assert.strictEqual(err.statusCode, 403);
                    assert.ok(err.message.includes("unapproved"));
                    return true;
                }
            );

            await pool.query(`DELETE FROM subscriptions WHERE id = $1`, [unappSubId]);
            await pool.query(`DELETE FROM labs WHERE id = $1`, [unappLabId]);
        });

        await t.test("8. Authorization & Access Control for Payment Verification Endpoint", async () => {
            // Patient user should be rejected 403
            const forbiddenRes = await fetch(`${baseUrl}/payments/verify`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${patientToken}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    paymentId: 100,
                    providerPaymentId: "pay_xyz",
                    signature: "sig_xyz",
                }),
            });
            assert.strictEqual(forbiddenRes.status, 403);

            // Unauthenticated request should be rejected 401
            const unauthRes = await fetch(`${baseUrl}/payments/verify`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    paymentId: 100,
                    providerPaymentId: "pay_xyz",
                    signature: "sig_xyz",
                }),
            });
            assert.strictEqual(unauthRes.status, 401);
        });
    } finally {
        // Teardown test records
        try {
            await pool.query(`DELETE FROM payment_webhook_events WHERE provider = 'razorpay' AND provider_event_id LIKE 'evt_%'`);
            await pool.query(`DELETE FROM payments WHERE subscription_id IN (SELECT id FROM subscriptions WHERE lab_id = $1)`, [labId]);
            await pool.query(`DELETE FROM subscriptions WHERE lab_id = $1`, [labId]);
            await pool.query(`DELETE FROM labs WHERE id = $1`, [labId]);
            await pool.query(`DELETE FROM users WHERE id IN ($1, $2)`, [ownerId, patientUserId]);
        } catch (_) {}

        server.close();
    }
});
