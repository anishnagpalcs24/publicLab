

import { pool } from "../config/db.js";

function createError(message, statusCode) {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
}

function requireLabUser(user) {
    if (!user?.id || !user?.labId || user.role !== "lab") {
        throw createError("Laboratory access required", 403);
    }
}

function parsePagination(limit = 20, offset = 0) {
    const parsedLimit = Number(limit);
    const parsedOffset = Number(offset);

    if (
        !Number.isInteger(parsedLimit) ||
        parsedLimit < 1 ||
        parsedLimit > 100 ||
        !Number.isInteger(parsedOffset) ||
        parsedOffset < 0
    ) {
        throw createError("Invalid pagination parameters", 400);
    }

    return { limit: parsedLimit, offset: parsedOffset };
}

// Get active subscription plans
export async function getSubscriptionPlans() {
    const result = await pool.query(
        `SELECT id, name, plan_code, description, price,
                currency, billing_interval
         FROM subscription_plans
         WHERE is_active = TRUE
         ORDER BY price ASC, id ASC`
    );

    return result.rows;
}

// Get a specific active plan
export async function getSubscriptionPlanById({ planId }) {
    const result = await pool.query(
        `SELECT id, name, plan_code, description, price,
                currency, billing_interval
         FROM subscription_plans
         WHERE id = $1 AND is_active = TRUE`,
        [planId]
    );

    if (result.rows.length === 0) {
        throw createError("Subscription plan not found", 404);
    }

    return result.rows[0];
}

// Create a pending subscription for the authenticated lab
export async function createSubscription({ planId, user }) {
    requireLabUser(user);

    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const labResult = await client.query(
            `SELECT id FROM labs
             WHERE id = $1 AND approval_status = 'approved'
             FOR UPDATE`,
            [user.labId]
        );

        if (labResult.rows.length === 0) {
            throw createError("Approved laboratory not found", 404);
        }

        const planResult = await client.query(
            `SELECT id, price, currency
             FROM subscription_plans
             WHERE id = $1 AND is_active = TRUE`,
            [planId]
        );

        if (planResult.rows.length === 0) {
            throw createError("Active subscription plan not found", 404);
        }

        const existingResult = await client.query(
            `SELECT id FROM subscriptions
             WHERE lab_id = $1
               AND status IN ('pending', 'trialing', 'active', 'past_due')
             LIMIT 1`,
            [user.labId]
        );

        if (existingResult.rows.length > 0) {
            throw createError(
                "This laboratory already has a pending or active subscription",
                409
            );
        }

        const subscriptionResult = await client.query(
            `INSERT INTO subscriptions
                (lab_id, plan_id, status)
             VALUES ($1, $2, 'pending')
             RETURNING id, lab_id, plan_id, status,
                       current_period_start, current_period_end,
                       created_at`,
            [user.labId, planId]
        );

        await client.query("COMMIT");
        return subscriptionResult.rows[0];
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
}

// List subscriptions belonging to the authenticated lab
export async function getMySubscriptions({
    user,
    limit = 20,
    offset = 0,
}) {
    requireLabUser(user);

    const pagination = parsePagination(limit, offset);

    const [subscriptionsResult, countResult] = await Promise.all([
        pool.query(
            `SELECT s.id, s.lab_id, s.plan_id, s.status,
                    s.current_period_start, s.current_period_end,
                    s.cancel_at_period_end, s.cancelled_at,
                    s.created_at, p.name AS plan_name,
                    p.plan_code, p.price, p.currency,
                    p.billing_interval
             FROM subscriptions s
             JOIN subscription_plans p ON p.id = s.plan_id
             WHERE s.lab_id = $1
             ORDER BY s.created_at DESC, s.id DESC
             LIMIT $2 OFFSET $3`,
            [user.labId, pagination.limit, pagination.offset]
        ),
        pool.query(
            `SELECT COUNT(*) FROM subscriptions WHERE lab_id = $1`,
            [user.labId]
        ),
    ]);

    return {
        subscriptions: subscriptionsResult.rows,
        pagination: {
            total: Number(countResult.rows[0].count),
            ...pagination,
        },
    };
}

// Get one subscription belonging to the authenticated lab
export async function getSubscriptionById({ subscriptionId, user }) {
    requireLabUser(user);

    const result = await pool.query(
        `SELECT s.id, s.lab_id, s.plan_id, s.status,
                s.current_period_start, s.current_period_end,
                s.cancel_at_period_end, s.cancelled_at,
                s.created_at, p.name AS plan_name,
                p.plan_code, p.price, p.currency,
                p.billing_interval
         FROM subscriptions s
         JOIN subscription_plans p ON p.id = s.plan_id
         WHERE s.id = $1 AND s.lab_id = $2`,
        [subscriptionId, user.labId]
    );

    if (result.rows.length === 0) {
        throw createError("Subscription not found", 404);
    }

    return result.rows[0];
}

// Schedule cancellation at the end of the current billing period
export async function cancelSubscription({ subscriptionId, user }) {
    requireLabUser(user);

    const result = await pool.query(
        `UPDATE subscriptions
         SET cancel_at_period_end = TRUE,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1
           AND lab_id = $2
           AND status IN ('trialing', 'active', 'past_due')
         RETURNING id, lab_id, plan_id, status,
                   current_period_start, current_period_end,
                   cancel_at_period_end, cancelled_at, updated_at`,
        [subscriptionId, user.labId]
    );

    if (result.rows.length === 0) {
        throw createError(
            "Subscription not found or cannot be cancelled",
            404
        );
    }

    return result.rows[0];
}
