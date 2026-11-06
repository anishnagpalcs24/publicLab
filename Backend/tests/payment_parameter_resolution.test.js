import test from "node:test";
import assert from "node:assert";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import app from "../src/app.js";
import { pool } from "../src/config/db.js";

test("Payment Controller Parameter Resolution Suite", async (t) => {
    const server = app.listen(0);
    const port = server.address().port;
    const baseUrl = `http://localhost:${port}/api/v1`;
    const secret = process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET || "default_jwt_secret_publiclab";

    const unique = Date.now();
    let ownerId;
    let labId;
    let patientUserId;
    let labToken;
    let patientToken;

    try {
        // Create active lab user
        const ownerRes = await pool.query(
            `INSERT INTO users (full_name, email, password_hash, role, account_status, email_verified)
             VALUES ('Payment Param Owner', $1, 'hash', 'lab', 'active', TRUE)
             RETURNING id`,
            [`param_owner_${unique}@paymenttest.test`]
        );
        ownerId = ownerRes.rows[0].id;

        const labRes = await pool.query(
            `INSERT INTO labs (name, registration_number, email, phone, address, city, owner_id, approval_status)
             VALUES ($1, $2, $3, '9999999999', '123 Health Ave', 'TestCity', $4, 'approved')
             RETURNING id`,
            [`Param Lab ${unique}`, `REG-PARAM-${unique}`, `param_lab_${unique}@paymenttest.test`, ownerId]
        );
        labId = labRes.rows[0].id;

        await pool.query(`UPDATE users SET lab_id = $1 WHERE id = $2`, [labId, ownerId]);

        // Create patient user
        const patientRes = await pool.query(
            `INSERT INTO users (full_name, email, password_hash, role, account_status, email_verified)
             VALUES ('Payment Param Patient', $1, 'hash', 'patient', 'active', TRUE)
             RETURNING id`,
            [`param_patient_${unique}@paymenttest.test`]
        );
        patientUserId = patientRes.rows[0].id;

        labToken = jwt.sign(
            { sub: String(ownerId), id: ownerId, role: "lab", labId },
            secret,
            { expiresIn: "1h" }
        );

        patientToken = jwt.sign(
            { sub: String(patientUserId), id: patientUserId, role: "patient" },
            secret,
            { expiresIn: "1h" }
        );

        await t.test("POST /orders/:orderId extracts orderId from URL param without request body", async () => {
            const nonExistentOrderId = 999999999;
            const res = await fetch(`${baseUrl}/payments/orders/${nonExistentOrderId}`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${labToken}`,
                    "Content-Type": "application/json",
                    "Idempotency-Key": `idemp-${crypto.randomUUID()}`,
                },
                body: JSON.stringify({}), // Empty body: orderId is exclusively in the URL route parameter
            });

            const data = await res.json();
            // If orderId was not resolved from params, service would throw 400 "Order ID and Idempotency-Key are required"
            // Because orderId is correctly resolved from req.params.orderId, the service progresses to query the DB and returns 404 "Order not found"
            assert.strictEqual(res.status, 404, `Expected 404 Order Not Found, got ${res.status}: ${JSON.stringify(data)}`);
            assert.strictEqual(data.success, false);
            assert.strictEqual(data.message, "Order not found");
        });

        await t.test("POST /orders/:orderId falls back to request body when param is not provided", async () => {
            // Test controller parameter fallback directly
            const nonExistentOrderId = 999999998;
            const res = await fetch(`${baseUrl}/payments/orders/${nonExistentOrderId}`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${labToken}`,
                    "Content-Type": "application/json",
                    "Idempotency-Key": `idemp-${crypto.randomUUID()}`,
                },
                body: JSON.stringify({ orderId: nonExistentOrderId }),
            });

            const data = await res.json();
            assert.strictEqual(res.status, 404);
            assert.strictEqual(data.message, "Order not found");
        });

        await t.test("POST /subscriptions/:subscriptionId extracts subscriptionId from URL param without request body", async () => {
            const nonExistentSubId = 888888888;
            const res = await fetch(`${baseUrl}/payments/subscriptions/${nonExistentSubId}`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${labToken}`,
                    "Content-Type": "application/json",
                    "Idempotency-Key": `idemp-${crypto.randomUUID()}`,
                },
                body: JSON.stringify({}), // Empty body: subscriptionId is exclusively in the URL route parameter
            });

            const data = await res.json();
            // If subscriptionId was not resolved from params, service would throw 400 "Subscription ID and Idempotency-Key are required"
            // Because subscriptionId is correctly resolved from req.params.subscriptionId, the service progresses to query the DB and returns 404 "Subscription not found"
            assert.strictEqual(res.status, 404, `Expected 404 Subscription Not Found, got ${res.status}: ${JSON.stringify(data)}`);
            assert.strictEqual(data.success, false);
            assert.strictEqual(data.message, "Subscription not found");
        });

        await t.test("POST /subscriptions/:subscriptionId falls back to request body when param is not provided", async () => {
            const nonExistentSubId = 888888887;
            const res = await fetch(`${baseUrl}/payments/subscriptions/${nonExistentSubId}`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${labToken}`,
                    "Content-Type": "application/json",
                    "Idempotency-Key": `idemp-${crypto.randomUUID()}`,
                },
                body: JSON.stringify({ subscriptionId: nonExistentSubId }),
            });

            const data = await res.json();
            assert.strictEqual(res.status, 404);
            assert.strictEqual(data.message, "Subscription not found");
        });

        await t.test("POST /orders/:orderId rejects requests missing Idempotency-Key header", async () => {
            const res = await fetch(`${baseUrl}/payments/orders/101`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${labToken}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({}),
            });

            const data = await res.json();
            assert.strictEqual(res.status, 400);
            assert.strictEqual(data.success, false);
            assert.strictEqual(data.message, "Order ID and Idempotency-Key are required");
        });

        await t.test("POST /subscriptions/:subscriptionId rejects requests missing Idempotency-Key header", async () => {
            const res = await fetch(`${baseUrl}/payments/subscriptions/201`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${labToken}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({}),
            });

            const data = await res.json();
            assert.strictEqual(res.status, 400);
            assert.strictEqual(data.success, false);
            assert.strictEqual(data.message, "Subscription ID and Idempotency-Key are required");
        });

        await t.test("POST /orders/:orderId enforces authorization (rejects non-lab role)", async () => {
            const res = await fetch(`${baseUrl}/payments/orders/101`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${patientToken}`,
                    "Content-Type": "application/json",
                    "Idempotency-Key": `idemp-${crypto.randomUUID()}`,
                },
                body: JSON.stringify({}),
            });

            const data = await res.json();
            assert.strictEqual(res.status, 403);
            assert.strictEqual(data.success, false);
        });

        await t.test("POST /orders/:orderId enforces authentication (rejects unauthenticated caller)", async () => {
            const res = await fetch(`${baseUrl}/payments/orders/101`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Idempotency-Key": `idemp-${crypto.randomUUID()}`,
                },
                body: JSON.stringify({}),
            });

            const data = await res.json();
            assert.strictEqual(res.status, 401);
            assert.strictEqual(data.success, false);
        });
    } finally {
        // Cleanup test data
        try {
            await pool.query(`DELETE FROM labs WHERE id = $1`, [labId]);
            await pool.query(`DELETE FROM users WHERE id IN ($1, $2)`, [ownerId, patientUserId]);
        } catch (_) {}

        server.close();
    }
});

