

import { pool } from "../config/db.js";

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

// Create a pending payment for an order.
// Real provider checkout is not enabled yet.
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
                    status, provider, provider_payment_id, created_at
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
                (order_id, amount, currency, status, idempotency_key)
             VALUES ($1, $2, 'INR', 'pending', $3)
             RETURNING id, order_id, subscription_id, amount, currency,
                       status, provider, provider_payment_id, created_at`,
            [order.id, order.total_amount, idempotencyKey.trim()]
        );

        await client.query("COMMIT");

        return {
            ...paymentResult.rows[0],
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
                    status, provider, provider_payment_id, created_at
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
                (subscription_id, amount, currency, status, idempotency_key)
             VALUES ($1, $2, $3, 'pending', $4)
             RETURNING id, order_id, subscription_id, amount, currency,
                       status, provider, provider_payment_id, created_at`,
            [
                subscription.id,
                subscription.price,
                subscription.currency,
                idempotencyKey.trim(),
            ]
        );

        await client.query("COMMIT");

        return {
            ...paymentResult.rows[0],
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
                    status, provider, provider_payment_id,
                    payment_method, failure_reason, paid_at, created_at
             FROM payments
             WHERE id = $1`,
            [paymentId]
        );
    } else if (user.role === "lab" && user.labId) {
        result = await pool.query(
            `SELECT p.id, p.order_id, p.subscription_id, p.amount,
                    p.currency, p.status, p.provider,
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
        `SELECT p.id, p.order_id, p.amount, p.currency, p.status,
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
                p.status, p.provider, p.provider_payment_id,
                p.paid_at, p.created_at
         FROM payments p
         JOIN subscriptions s ON s.id = p.subscription_id
         WHERE p.subscription_id = $1 AND s.lab_id = $2
         ORDER BY p.created_at DESC`,
        [subscriptionId, user.labId]
    );

    return result.rows;
}

// Webhook processing remains disabled until a payment provider
// is selected and signature verification is implemented.
export async function handleWebhook() {
    throw createError(
        "Payment webhooks are disabled until provider signature verification is configured",
        501
    );
}
