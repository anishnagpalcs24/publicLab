import { pool } from "../config/db.js";
import {
    notifySubscriptionCreated,
    notifySubscriptionActivated,
    notifySubscriptionCancelled,
    notifySubscriptionPastDue,
} from "./email.service.js";

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
            `SELECT id, name, price, currency, billing_interval
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

        const createdSub = subscriptionResult.rows[0];

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
                await notifySubscriptionCreated({
                    subscription: createdSub,
                    plan: planResult.rows[0],
                    lab: { name: labInfo.rows[0]?.name || "Laboratory" },
                    ownerEmail: labInfo.rows[0]?.owner_email || user.email,
                });
            } catch (_) {}
        })();

        return createdSub;
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

/**
 * Transactionally activate a subscription following trusted server-side payment confirmation.
 * Sets current_period_start and calculates current_period_end based on subscription plan's billing interval.
 * Idempotent: If the subscription is already active for this period, does not corrupt dates or double-activate.
 */
export async function activateSubscription({
    subscriptionId,
    paymentId = null,
    provider = null,
    client: externalClient = null,
}) {
    if (!subscriptionId) {
        throw createError("Subscription ID is required", 400);
    }

    const client = externalClient || (await pool.connect());
    const shouldManageTransaction = !externalClient;

    try {
        if (shouldManageTransaction) {
            await client.query("BEGIN");
        }

        const subResult = await client.query(
            `SELECT s.id, s.lab_id, s.plan_id, s.status,
                    s.current_period_start, s.current_period_end,
                    s.cancel_at_period_end, s.cancelled_at,
                    p.name AS plan_name, p.billing_interval, p.price, p.currency,
                    l.name AS lab_name, l.approval_status AS lab_approval_status,
                    u.email AS owner_email
             FROM subscriptions s
             JOIN subscription_plans p ON p.id = s.plan_id
             JOIN labs l ON l.id = s.lab_id
             LEFT JOIN users u ON u.id = l.owner_id
             WHERE s.id = $1
             FOR UPDATE OF s`,
            [subscriptionId]
        );

        if (subResult.rows.length === 0) {
            throw createError("Subscription not found", 404);
        }

        const sub = subResult.rows[0];

        if (sub.lab_approval_status !== "approved") {
            throw createError("Cannot activate subscription for an unapproved laboratory", 403);
        }

        if (sub.status === "cancelled") {
            throw createError("Cannot activate a cancelled subscription", 409);
        }

        // Idempotency check: if already active and current period end is in future
        if (sub.status === "active" && sub.current_period_end && new Date(sub.current_period_end) > new Date()) {
            if (shouldManageTransaction) {
                await client.query("COMMIT");
            }
            return {
                ...sub,
                isAlreadyActive: true,
            };
        }

        const interval = sub.billing_interval || "monthly";

        const updateResult = await client.query(
            `UPDATE subscriptions
             SET status = 'active',
                 provider = COALESCE($2, provider),
                 current_period_start = CURRENT_TIMESTAMP,
                 current_period_end = CASE 
                     WHEN $3 = 'yearly' THEN CURRENT_TIMESTAMP + INTERVAL '1 year'
                     WHEN $3 = 'quarterly' THEN CURRENT_TIMESTAMP + INTERVAL '3 months'
                     WHEN $3 = 'weekly' THEN CURRENT_TIMESTAMP + INTERVAL '1 week'
                     ELSE CURRENT_TIMESTAMP + INTERVAL '1 month'
                 END,
                 cancel_at_period_end = FALSE,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $1
             RETURNING id, lab_id, plan_id, status, provider,
                       current_period_start, current_period_end,
                       cancel_at_period_end, cancelled_at, updated_at`,
            [subscriptionId, provider, interval]
        );

        if (shouldManageTransaction) {
            await client.query("COMMIT");
        }

        const activatedSub = {
            ...updateResult.rows[0],
            plan_name: sub.plan_name,
            billing_interval: sub.billing_interval,
            price: sub.price,
            currency: sub.currency,
        };

        // Notify lab owner and admin (non-blocking, safe)
        (async () => {
            try {
                await notifySubscriptionActivated({
                    subscription: activatedSub,
                    plan: {
                        name: sub.plan_name,
                        billing_interval: sub.billing_interval,
                        price: sub.price,
                        currency: sub.currency,
                    },
                    lab: { name: sub.lab_name },
                    ownerEmail: sub.owner_email,
                });
            } catch (_) {}
        })();

        return activatedSub;
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
 * Safely processes all subscriptions whose current_period_end has passed.
 * - If cancel_at_period_end is true -> transitions to 'cancelled' with cancelled_at timestamp.
 * - Otherwise -> transitions to 'past_due' (business policy for renewal/grace period).
 * Transaction-safe, row-locking (FOR UPDATE), idempotent, handles errors per record so one failure does not abort all.
 */
export async function processExpiredSubscriptions() {
    const client = await pool.connect();
    const summary = {
        checked: 0,
        cancelled: 0,
        pastDue: 0,
        failed: 0,
        processedIds: [],
    };

    try {
        // Find subscriptions that are active or trialing where current_period_end has passed
        const expiredResult = await client.query(
            `SELECT s.id, s.lab_id, s.plan_id, s.status,
                    s.cancel_at_period_end, s.current_period_end,
                    p.name AS plan_name, p.billing_interval, p.price, p.currency,
                    l.name AS lab_name, u.email AS owner_email
             FROM subscriptions s
             JOIN subscription_plans p ON p.id = s.plan_id
             JOIN labs l ON l.id = s.lab_id
             LEFT JOIN users u ON u.id = l.owner_id
             WHERE s.status IN ('active', 'trialing')
               AND s.current_period_end IS NOT NULL
               AND s.current_period_end <= CURRENT_TIMESTAMP
             ORDER BY s.current_period_end ASC`
        );

        summary.checked = expiredResult.rows.length;

        for (const sub of expiredResult.rows) {
            const subClient = await pool.connect();
            try {
                await subClient.query("BEGIN");

                // Lock the specific subscription row
                const lockRes = await subClient.query(
                    `SELECT id, status, cancel_at_period_end, current_period_end
                     FROM subscriptions
                     WHERE id = $1 AND status IN ('active', 'trialing')
                     FOR UPDATE`,
                    [sub.id]
                );

                if (lockRes.rows.length === 0) {
                    // Already transitioned concurrently or no longer active
                    await subClient.query("ROLLBACK");
                    continue;
                }

                const shouldCancel = Boolean(sub.cancel_at_period_end);
                const newStatus = shouldCancel ? "cancelled" : "past_due";
                const cancelledAt = shouldCancel ? new Date() : null;

                const updateRes = await subClient.query(
                    `UPDATE subscriptions
                     SET status = $2,
                         cancelled_at = COALESCE($3, cancelled_at),
                         updated_at = CURRENT_TIMESTAMP
                     WHERE id = $1
                     RETURNING id, lab_id, plan_id, status,
                               current_period_start, current_period_end,
                               cancel_at_period_end, cancelled_at, updated_at`,
                    [sub.id, newStatus, cancelledAt]
                );

                await subClient.query("COMMIT");

                const updatedSub = updateRes.rows[0];
                summary.processedIds.push(sub.id);

                if (shouldCancel) {
                    summary.cancelled += 1;
                    (async () => {
                        try {
                            await notifySubscriptionCancelled({
                                subscription: updatedSub,
                                plan: { name: sub.plan_name },
                                lab: { name: sub.lab_name },
                                ownerEmail: sub.owner_email,
                            });
                        } catch (_) {}
                    })();
                } else {
                    summary.pastDue += 1;
                    (async () => {
                        try {
                            await notifySubscriptionPastDue({
                                subscription: updatedSub,
                                plan: { name: sub.plan_name },
                                lab: { name: sub.lab_name },
                                ownerEmail: sub.owner_email,
                            });
                        } catch (_) {}
                    })();
                }
            } catch (itemError) {
                await subClient.query("ROLLBACK");
                summary.failed += 1;
                console.error(`[SUBSCRIPTION WORKER ERROR] Failed to expire subscription #${sub.id}:`, itemError.message);
            } finally {
                subClient.release();
            }
        }

        return summary;
    } finally {
        client.release();
    }
}

/**
 * Verify whether a laboratory possesses an active, non-expired subscription for paid-feature access.
 */
export async function verifySubscriptionAccess({ labId }) {
    if (!labId) {
        return { hasAccess: false, status: "none", reason: "Laboratory ID is required" };
    }

    const result = await pool.query(
        `SELECT s.id, s.lab_id, s.plan_id, s.status,
                s.current_period_start, s.current_period_end,
                p.name AS plan_name, p.billing_interval
         FROM subscriptions s
         JOIN subscription_plans p ON p.id = s.plan_id
         WHERE s.lab_id = $1
         ORDER BY s.current_period_end DESC NULLS LAST, s.id DESC
         LIMIT 1`,
        [labId]
    );

    const sub = result.rows[0];

    if (!sub || sub.status !== "active") {
        return {
            hasAccess: false,
            status: sub?.status || "none",
            reason: "Laboratory does not have an active subscription",
        };
    }

    if (sub.current_period_end && new Date(sub.current_period_end) <= new Date()) {
        return {
            hasAccess: false,
            status: "expired",
            reason: "Subscription period has expired",
        };
    }

    return {
        hasAccess: true,
        status: "active",
        subscription: sub,
    };
}
