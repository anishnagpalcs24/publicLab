
import { pool } from "../config/db.js";

// Create a payment record.
// Call this only after the service validates the amount and target.
export async function createPayment({
    orderId = null,
    subscriptionId = null,
    amount,
    currency = "INR",
    provider = null,
    idempotencyKey,
    paymentMethod = null,
}) {
    if ((orderId == null) === (subscriptionId == null)) {
        throw new Error(
            "Provide exactly one of orderId or subscriptionId"
        );
    }

    if (!idempotencyKey) {
        throw new Error("idempotencyKey is required");
    }

    const query = `
        INSERT INTO public.payments (
            order_id,
            subscription_id,
            amount,
            currency,
            provider,
            idempotency_key,
            payment_method
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (idempotency_key) DO NOTHING
        RETURNING *
    `;

    const values = [
        orderId,
        subscriptionId,
        amount,
        currency,
        provider,
        idempotencyKey,
        paymentMethod,
    ];

    const result = await pool.query(query, values);

    if (result.rows[0]) {
        return result.rows[0];
    }

    // An idempotent retry returns the existing record.
    const existing = await pool.query(
        `SELECT *
         FROM public.payments
         WHERE idempotency_key = $1`,
        [idempotencyKey]
    );

    return existing.rows[0] ?? null;
}


// Find payment by internal ID
export async function findPaymentById(paymentId) {
    const query = `
        SELECT *
        FROM public.payments
        WHERE id = $1
    `;

    const result = await pool.query(query, [paymentId]);
    return result.rows[0] ?? null;
}


// Find payment by provider reference
export async function findPaymentByProviderReference({
    provider,
    providerPaymentId,
}) {
    const query = `
        SELECT *
        FROM public.payments
        WHERE provider = $1
          AND provider_payment_id = $2
    `;

    const result = await pool.query(query, [
        provider,
        providerPaymentId,
    ]);

    return result.rows[0] ?? null;
}


// List payments associated with an order
export async function findPaymentsByOrder(orderId) {
    const query = `
        SELECT *
        FROM public.payments
        WHERE order_id = $1
        ORDER BY created_at DESC, id DESC
    `;

    const result = await pool.query(query, [orderId]);
    return result.rows;
}


// List payments associated with a subscription
export async function findPaymentsBySubscription(subscriptionId) {
    const query = `
        SELECT *
        FROM public.payments
        WHERE subscription_id = $1
        ORDER BY created_at DESC, id DESC
    `;

    const result = await pool.query(query, [subscriptionId]);
    return result.rows;
}


// Record a provider payment reference after provider-side creation
export async function setProviderPaymentReference({
    paymentId,
    provider,
    providerPaymentId,
}) {
    const query = `
        UPDATE public.payments
        SET provider = $2,
            provider_payment_id = $3,
            updated_at = NOW()
        WHERE id = $1
          AND payment_status = 'pending'
        RETURNING *
    `;

    const result = await pool.query(query, [
        paymentId,
        provider,
        providerPaymentId,
    ]);

    return result.rows[0] ?? null;
}


// Record a verified payment outcome.
// Call only from trusted service logic after verification.
export async function recordPaymentOutcome({
    paymentId,
    status,
    failureReason = null,
}) {
    const allowedStatuses = [
        "processing",
        "succeeded",
        "failed",
        "cancelled",
        "refunded",
    ];

    if (!allowedStatuses.includes(status)) {
        throw new Error("Invalid payment status");
    }

    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const currentResult = await client.query(
            `SELECT *
             FROM public.payments
             WHERE id = $1
             FOR UPDATE`,
            [paymentId]
        );

        const current = currentResult.rows[0];

        if (!current) {
            await client.query("ROLLBACK");
            return null;
        }

        // Do not allow a late event to undo a completed payment.
        if (
            current.payment_status === "succeeded" &&
            status !== "refunded"
        ) {
            await client.query("COMMIT");
            return current;
        }

        // Do not change a refunded payment back to another state.
        if (current.payment_status === "refunded") {
            await client.query("COMMIT");
            return current;
        }

        const result = await client.query(
            `UPDATE public.payments
             SET payment_status = $2,
                 failure_reason = CASE
                     WHEN $2 = 'failed' THEN $3
                     ELSE failure_reason
                 END,
                 paid_at = CASE
                     WHEN $2 = 'succeeded'
                     THEN COALESCE(paid_at, NOW())
                     ELSE paid_at
                 END,
                 updated_at = NOW()
             WHERE id = $1
             RETURNING *`,
            [paymentId, status, failureReason]
        );

        await client.query("COMMIT");
        return result.rows[0];
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
}


// Record a webhook event without duplicating provider events.
// Verify the webhook signature BEFORE calling this function.
export async function recordWebhookEvent({
    provider,
    providerEventId,
    eventType,
    paymentId = null,
}) {
    const query = `
        INSERT INTO public.payment_webhook_events (
            provider,
            provider_event_id,
            event_type,
            payment_id
        )
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (provider, provider_event_id) DO NOTHING
        RETURNING *
    `;

    const result = await pool.query(query, [
        provider,
        providerEventId,
        eventType,
        paymentId,
    ]);

    if (result.rows[0]) {
        return {
            isNew: true,
            event: result.rows[0],
        };
    }

    const existing = await pool.query(
        `SELECT *
         FROM public.payment_webhook_events
         WHERE provider = $1
           AND provider_event_id = $2`,
        [provider, providerEventId]
    );

    return {
        isNew: false,
        event: existing.rows[0] ?? null,
    };
}


// Update webhook processing status
export async function updateWebhookEventStatus({
    eventId,
    status,
    lastError = null,
}) {
    const allowedStatuses = [
        "pending",
        "processing",
        "processed",
        "failed",
    ];

    if (!allowedStatuses.includes(status)) {
        throw new Error("Invalid webhook processing status");
    }

    const query = `
        UPDATE public.payment_webhook_events
        SET processing_status = $2,
            processed_at = CASE
                WHEN $2 = 'processed' THEN NOW()
                ELSE processed_at
            END,
            last_error = CASE
                WHEN $2 = 'failed' THEN $3
                ELSE NULL
            END
        WHERE id = $1
        RETURNING *
    `;

    const result = await pool.query(query, [
        eventId,
        status,
        lastError,
    ]);

    return result.rows[0] ?? null;
}
