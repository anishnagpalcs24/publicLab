import crypto from "crypto";
import { pool } from "../config/db.js";
import { activateSubscription } from "./subscription.service.js";
import { notifyPaymentRecorded, notifyPaymentFailed } from "./email.service.js";

function createError(message, statusCode) {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
}

function requireAuthenticatedUser(user) {
    if (!user?.id) {
        throw createError("Authentication required", 401);
    }
}

function requireLabUser(user) {
    requireAuthenticatedUser(user);

    if (!user.labId || user.role !== "lab") {
        throw createError("Laboratory access required", 403);
    }
}

function verifyHmacSignature(payload, signature, secret) {
    if (!payload || !signature || !secret) return false;
    const expected = crypto.createHmac("sha256", secret).update(payload).digest("hex");
    const expBuf = Buffer.from(expected);
    const sigBuf = Buffer.from(signature);
    if (expBuf.length !== sigBuf.length) return false;
    return crypto.timingSafeEqual(expBuf, sigBuf);
}

// Create a pending payment for an order.
export async function createOrderPayment({
    orderId,
    user,
    idempotencyKey,
}) {
    requireLabUser(user);

    if (!orderId || !idempotencyKey?.trim()) {
        throw createError(
            "Order ID and Idempotency-Key are required",
            400
        );
    }

    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const orderResult = await client.query(
            `SELECT id, lab_id, total_amount, payment_status
             FROM orders
             WHERE id = $1 AND lab_id = $2
             FOR UPDATE`,
            [orderId, user.labId]
        );

        if (orderResult.rows.length === 0) {
            throw createError("Order not found", 404);
        }

        const order = orderResult.rows[0];

        if (order.payment_status === "paid") {
            throw createError("Order is already paid", 409);
        }

        const existingResult = await client.query(
            `SELECT id, order_id, subscription_id, amount, currency,
                    payment_status AS status, provider, provider_payment_id, created_at
             FROM payments
             WHERE idempotency_key = $1`,
            [idempotencyKey.trim()]
        );

        if (existingResult.rows.length > 0) {
            const existing = existingResult.rows[0];

            if (String(existing.order_id) !== String(orderId)) {
                throw createError(
                    "Idempotency key was already used for another payment",
                    409
                );
            }

            await client.query("COMMIT");
            return existing;
        }

        const paymentResult = await client.query(
            `INSERT INTO payments
                (order_id, amount, currency, payment_status, idempotency_key)
             VALUES ($1, $2, 'INR', 'pending', $3)
             RETURNING id, order_id, subscription_id, amount, currency,
                       payment_status AS status, provider, provider_payment_id, created_at`,
            [order.id, order.total_amount, idempotencyKey.trim()]
        );

        await client.query("COMMIT");

        const recordedPayment = paymentResult.rows[0];

        // Safely trigger notifications to lab owner and admin
        (async () => {
            try {
                const labInfo = await pool.query(
                    `SELECT l.name, u.email AS owner_email
                     FROM labs l
                     LEFT JOIN users u ON u.id = l.owner_id
                     WHERE l.id = $1`,
                    [user.labId]
                );
                await notifyPaymentRecorded({
                    payment: recordedPayment,
                    lab: { name: labInfo.rows[0]?.name || "Laboratory" },
                    ownerEmail: labInfo.rows[0]?.owner_email || user.email,
                    description: `Diagnostic Order #${order.id}`,
                });
            } catch (_) {}
        })();

        return {
            ...recordedPayment,
            checkoutAvailable: false,
            message: "Payment provider integration is not configured yet",
        };
    } catch (error) {
        await client.query("ROLLBACK");

        if (error.code === "23505") {
            throw createError(
                "This payment request already exists; retry with its original idempotency key",
                409
            );
        }

        throw error;
    } finally {
        client.release();
    }
}

// Create a pending payment for a subscription
export async function createSubscriptionPayment({
    subscriptionId,
    user,
    idempotencyKey,
}) {
    requireLabUser(user);

    if (!subscriptionId || !idempotencyKey?.trim()) {
        throw createError(
            "Subscription ID and Idempotency-Key are required",
            400
        );
    }

    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const subscriptionResult = await client.query(
            `SELECT s.id, s.lab_id, s.status, p.price, p.currency
             FROM subscriptions s
             JOIN subscription_plans p ON p.id = s.plan_id
             WHERE s.id = $1 AND s.lab_id = $2
             FOR UPDATE OF s`,
            [subscriptionId, user.labId]
        );

        if (subscriptionResult.rows.length === 0) {
            throw createError("Subscription not found", 404);
        }

        const subscription = subscriptionResult.rows[0];

        if (!["pending", "past_due"].includes(subscription.status)) {
            throw createError(
                "This subscription is not awaiting payment",
                409
            );
        }

        const existingResult = await client.query(
            `SELECT id, order_id, subscription_id, amount, currency,
                    payment_status AS status, provider, provider_payment_id, created_at
             FROM payments
             WHERE idempotency_key = $1`,
            [idempotencyKey.trim()]
        );

        if (existingResult.rows.length > 0) {
            const existing = existingResult.rows[0];

            if (
                String(existing.subscription_id) !== String(subscriptionId)
            ) {
                throw createError(
                    "Idempotency key was already used for another payment",
                    409
                );
            }

            await client.query("COMMIT");
            return existing;
        }

        const paymentResult = await client.query(
            `INSERT INTO payments
                (subscription_id, amount, currency, payment_status, idempotency_key)
             VALUES ($1, $2, $3, 'pending', $4)
             RETURNING id, order_id, subscription_id, amount, currency,
                       payment_status AS status, provider, provider_payment_id, created_at`,
            [
                subscription.id,
                subscription.price,
                subscription.currency,
                idempotencyKey.trim(),
            ]
        );

        await client.query("COMMIT");

        const recordedPayment = paymentResult.rows[0];

        // Safely trigger notifications to lab owner and admin
        (async () => {
            try {
                const labInfo = await pool.query(
                    `SELECT l.name, u.email AS owner_email
                     FROM labs l
                     LEFT JOIN users u ON u.id = l.owner_id
                     WHERE l.id = $1`,
                    [user.labId]
                );
                await notifyPaymentRecorded({
                    payment: recordedPayment,
                    lab: { name: labInfo.rows[0]?.name || "Laboratory" },
                    ownerEmail: labInfo.rows[0]?.owner_email || user.email,
                    description: `Subscription Plan #${subscription.id}`,
                });
            } catch (_) {}
        })();

        return {
            ...recordedPayment,
            checkoutAvailable: false,
            message: "Payment provider integration is not configured yet",
        };
    } catch (error) {
        await client.query("ROLLBACK");

        if (error.code === "23505") {
            throw createError(
                "This payment request already exists; retry with its original idempotency key",
                409
            );
        }

        throw error;
    } finally {
        client.release();
    }
}

// Retrieve one payment after checking ownership
export async function getPaymentById({ paymentId, user }) {
    requireAuthenticatedUser(user);

    let result;

    if (user.role === "admin") {
        result = await pool.query(
            `SELECT id, order_id, subscription_id, amount, currency,
                    payment_status AS status, provider, provider_payment_id,
                    payment_method, failure_reason, paid_at, created_at
             FROM payments
             WHERE id = $1`,
            [paymentId]
        );
    } else if (user.role === "lab" && user.labId) {
        result = await pool.query(
            `SELECT p.id, p.order_id, p.subscription_id, p.amount,
                    p.currency, p.payment_status AS status, p.provider,
                    p.provider_payment_id, p.payment_method,
                    p.failure_reason, p.paid_at, p.created_at
             FROM payments p
             LEFT JOIN orders o ON o.id = p.order_id
             LEFT JOIN subscriptions s ON s.id = p.subscription_id
             WHERE p.id = $1
               AND (o.lab_id = $2 OR s.lab_id = $2)`,
            [paymentId, user.labId]
        );
    } else {
        throw createError("Access denied", 403);
    }

    if (result.rows.length === 0) {
        throw createError("Payment not found", 404);
    }

    return result.rows[0];
}

// Get payment history for a lab order
export async function getOrderPayments({ orderId, user }) {
    requireLabUser(user);

    const result = await pool.query(
        `SELECT p.id, p.order_id, p.amount, p.currency,
                p.payment_status AS status,
                p.provider, p.provider_payment_id, p.paid_at, p.created_at
         FROM payments p
         JOIN orders o ON o.id = p.order_id
         WHERE p.order_id = $1 AND o.lab_id = $2
         ORDER BY p.created_at DESC`,
        [orderId, user.labId]
    );

    return result.rows;
}

// Get payment history for a lab subscription
export async function getSubscriptionPayments({
    subscriptionId,
    user,
}) {
    requireLabUser(user);

    const result = await pool.query(
        `SELECT p.id, p.subscription_id, p.amount, p.currency,
                p.payment_status AS status, p.provider, p.provider_payment_id,
                p.paid_at, p.created_at
         FROM payments p
         JOIN subscriptions s ON s.id = p.subscription_id
         WHERE p.subscription_id = $1 AND s.lab_id = $2
         ORDER BY p.created_at DESC`,
        [subscriptionId, user.labId]
    );

    return result.rows;
}

/**
 * Transactionally confirms a payment (succeeded or failed) and triggers the corresponding lifecycle.
 * Idempotent: If already succeeded, returns existing state without modifying dates or duplicate alerts.
 */
export async function confirmPayment({
    paymentId,
    providerPaymentId = null,
    provider = "razorpay",
    status = "succeeded",
    failureReason = null,
    client: externalClient = null,
}) {
    if (!paymentId) {
        throw createError("Payment ID is required", 400);
    }

    if (!["succeeded", "failed"].includes(status)) {
        throw createError("Invalid payment confirmation status", 400);
    }

    const client = externalClient || (await pool.connect());
    const shouldManageTransaction = !externalClient;

    try {
        if (shouldManageTransaction) {
            await client.query("BEGIN");
        }

        const paymentRes = await client.query(
            `SELECT p.id, p.order_id, p.subscription_id, p.amount, p.currency,
                    p.payment_status, p.provider, p.provider_payment_id,
                    p.idempotency_key, p.created_at,
                    l.name AS lab_name, u.email AS owner_email
             FROM payments p
             LEFT JOIN orders o ON o.id = p.order_id
             LEFT JOIN subscriptions s ON s.id = p.subscription_id
             LEFT JOIN labs l ON l.id = COALESCE(o.lab_id, s.lab_id)
             LEFT JOIN users u ON u.id = l.owner_id
             WHERE p.id = $1
             FOR UPDATE OF p`,
            [paymentId]
        );

        if (paymentRes.rows.length === 0) {
            throw createError("Payment record not found", 404);
        }

        const payment = paymentRes.rows[0];

        // Idempotency: if already succeeded
        if (payment.payment_status === "succeeded") {
            if (status === "succeeded") {
                if (shouldManageTransaction) {
                    await client.query("COMMIT");
                }
                return {
                    id: payment.id,
                    order_id: payment.order_id,
                    subscription_id: payment.subscription_id,
                    amount: payment.amount,
                    currency: payment.currency,
                    status: "succeeded",
                    provider: payment.provider,
                    provider_payment_id: payment.provider_payment_id,
                    isDuplicate: true,
                };
            } else {
                throw createError("Payment already succeeded and cannot be marked as failed", 409);
            }
        }

        if (status === "failed") {
            const failRes = await client.query(
                `UPDATE payments
                 SET payment_status = 'failed',
                     failure_reason = $2,
                     provider_payment_id = COALESCE($3, provider_payment_id),
                     updated_at = CURRENT_TIMESTAMP
                 WHERE id = $1
                 RETURNING id, order_id, subscription_id, amount, currency,
                           payment_status AS status, provider, provider_payment_id,
                           failure_reason, created_at, updated_at`,
                [paymentId, failureReason || "Payment failed at provider", providerPaymentId]
            );

            if (shouldManageTransaction) {
                await client.query("COMMIT");
            }

            const failedPayment = failRes.rows[0];

            // Notify failure
            (async () => {
                try {
                    await notifyPaymentFailed({
                        payment: failedPayment,
                        lab: { name: payment.lab_name },
                        ownerEmail: payment.owner_email,
                        reason: failureReason,
                    });
                } catch (_) {}
            })();

            return failedPayment;
        }

        // status === "succeeded"
        const updateRes = await client.query(
            `UPDATE payments
             SET payment_status = 'succeeded',
                 provider = COALESCE($2, provider),
                 provider_payment_id = COALESCE($3, provider_payment_id),
                 paid_at = CURRENT_TIMESTAMP,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $1
             RETURNING id, order_id, subscription_id, amount, currency,
                       payment_status AS status, provider, provider_payment_id,
                       paid_at, created_at, updated_at`,
            [paymentId, provider, providerPaymentId]
        );

        const updatedPayment = updateRes.rows[0];
        let activatedSubscription = null;

        if (payment.subscription_id) {
            // Activate subscription within the exact same transaction
            activatedSubscription = await activateSubscription({
                subscriptionId: payment.subscription_id,
                paymentId: payment.id,
                provider,
                client,
            });
        } else if (payment.order_id) {
            await client.query(
                `UPDATE orders
                 SET payment_status = 'paid',
                     updated_at = CURRENT_TIMESTAMP
                 WHERE id = $1`,
                [payment.order_id]
            );
        }

        if (shouldManageTransaction) {
            await client.query("COMMIT");
        }

        return {
            ...updatedPayment,
            subscription: activatedSubscription,
        };
    } catch (error) {
        if (shouldManageTransaction) {
            await client.query("ROLLBACK");
        }
        throw error;
    } finally {
        if (shouldManageTransaction) {
            client.release();
        }
    }
}

/**
 * Server-side payment verification endpoint with HMAC signature checking.
 * Rejects any unverified frontend claim or missing cryptographic signature.
 */
export async function verifyPayment({
    paymentId,
    providerOrderId = null,
    providerPaymentId,
    signature,
    user,
}) {
    requireLabUser(user);

    if (!paymentId) {
        throw createError("Payment ID is required", 400);
    }
    if (!providerPaymentId || !signature?.trim()) {
        throw createError("Provider payment ID and cryptographic signature are required for server verification", 400);
    }

    // Verify ownership of the payment
    const paymentCheck = await pool.query(
        `SELECT p.id, p.subscription_id, p.order_id
         FROM payments p
         LEFT JOIN orders o ON o.id = p.order_id
         LEFT JOIN subscriptions s ON s.id = p.subscription_id
         WHERE p.id = $1 AND (o.lab_id = $2 OR s.lab_id = $2)`,
        [paymentId, user.labId]
    );

    if (paymentCheck.rows.length === 0) {
        throw createError("Payment record not found or access denied", 404);
    }

    const secret =
        process.env.PAYMENT_WEBHOOK_SECRET ||
        process.env.PAYMENT_SECRET ||
        process.env.JWT_SECRET ||
        "default_publiclab_payment_secret";

    const dataToVerify1 = providerOrderId ? `${providerOrderId}|${providerPaymentId}` : null;
    const dataToVerify2 = `${paymentId}|${providerPaymentId}`;

    const isValidSig1 = dataToVerify1
        ? verifyHmacSignature(dataToVerify1, signature.trim(), secret)
        : false;
    const isValidSig2 = verifyHmacSignature(dataToVerify2, signature.trim(), secret);

    if (!isValidSig1 && !isValidSig2) {
        throw createError("Server-side payment verification failed: invalid cryptographic signature", 400);
    }

    return await confirmPayment({
        paymentId,
        providerPaymentId,
        provider: "razorpay",
        status: "succeeded",
    });
}

/**
 * Handle payment provider webhooks with cryptographic HMAC signature verification
 * and deduplication via payment_webhook_events.
 */
export async function handleWebhook({ headers = {}, body = {}, rawBody }) {
    const signature =
        headers["x-razorpay-signature"] ||
        headers["stripe-signature"] ||
        headers["x-webhook-signature"];

    const secret =
        process.env.PAYMENT_WEBHOOK_SECRET ||
        process.env.PAYMENT_SECRET ||
        process.env.JWT_SECRET ||
        "default_publiclab_payment_secret";

    const payload = rawBody || (typeof body === "string" ? body : JSON.stringify(body));

    if (!signature || !verifyHmacSignature(payload, signature, secret)) {
        throw createError("Webhook signature verification failed", 401);
    }

    const provider = body.provider || "razorpay";
    const providerEventId = body.id || body.event_id || body.eventId;
    const eventType = body.event || body.type;

    if (!providerEventId || !eventType) {
        throw createError("Malformed webhook event payload", 400);
    }

    // Check replay deduplication in payment_webhook_events
    const eventCheck = await pool.query(
        `SELECT id, processing_status FROM payment_webhook_events
         WHERE provider = $1 AND provider_event_id = $2`,
        [provider, String(providerEventId)]
    );

    if (eventCheck.rows.length > 0 && eventCheck.rows[0].processing_status === "processed") {
        return { status: "already_processed", eventId: providerEventId };
    }

    // Identify payment ID from webhook payload
    const paymentId =
        body.paymentId ||
        body.payload?.payment?.entity?.notes?.payment_id ||
        body.data?.object?.metadata?.payment_id;

    if (!paymentId) {
        await pool.query(
            `INSERT INTO payment_webhook_events
                (provider, provider_event_id, event_type, processing_status, processed_at)
             VALUES ($1, $2, $3, 'processed', CURRENT_TIMESTAMP)
             ON CONFLICT (provider, provider_event_id) DO NOTHING`,
            [provider, String(providerEventId), eventType]
        );
        return { status: "ignored_no_payment_id" };
    }

    let paymentStatus = "succeeded";
    let failureReason = null;

    if (
        eventType.includes("failed") ||
        eventType === "payment.failed" ||
        body.status === "failed"
    ) {
        paymentStatus = "failed";
        failureReason = body.error_description || body.failure_reason || "Webhook reported payment failure";
    }

    const providerPaymentId =
        body.payload?.payment?.entity?.id ||
        body.data?.object?.id ||
        body.providerPaymentId ||
        `evt_pay_${providerEventId}`;

    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        const result = await confirmPayment({
            paymentId,
            providerPaymentId,
            provider,
            status: paymentStatus,
            failureReason,
            client,
        });

        await client.query(
            `INSERT INTO payment_webhook_events
                (provider, provider_event_id, event_type, payment_id, processing_status, processed_at)
             VALUES ($1, $2, $3, $4, 'processed', CURRENT_TIMESTAMP)
             ON CONFLICT (provider, provider_event_id)
             DO UPDATE SET processing_status = 'processed', processed_at = CURRENT_TIMESTAMP`,
            [provider, String(providerEventId), eventType, paymentId]
        );

        await client.query("COMMIT");
        return result;
    } catch (err) {
        await client.query("ROLLBACK");
        await pool.query(
            `INSERT INTO payment_webhook_events
                (provider, provider_event_id, event_type, payment_id, processing_status, last_error)
             VALUES ($1, $2, $3, $4, 'failed', $5)
             ON CONFLICT (provider, provider_event_id)
             DO UPDATE SET processing_status = 'failed', last_error = $5`,
            [provider, String(providerEventId), eventType, paymentId, err.message]
        );
        throw err;
    } finally {
        client.release();
    }
}
