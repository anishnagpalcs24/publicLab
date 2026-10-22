
import { pool } from "../config/db.js";

// Create a subscription plan
export async function createSubscriptionPlan({
    name,
    planCode,
    description = null,
    price,
    currency = "INR",
    billingInterval,
}) {
    const query = `
        INSERT INTO public.subscription_plans (
            name,
            plan_code,
            description,
            price,
            currency,
            billing_interval
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
    `;

    const values = [
        name,
        planCode,
        description,
        price,
        currency,
        billingInterval,
    ];

    const result = await pool.query(query, values);
    return result.rows[0];
}


// Find a plan by ID
export async function findSubscriptionPlanById(planId) {
    const query = `
        SELECT *
        FROM public.subscription_plans
        WHERE id = $1
    `;

    const result = await pool.query(query, [planId]);
    return result.rows[0] ?? null;
}


// List available plans
export async function findActiveSubscriptionPlans() {
    const query = `
        SELECT *
        FROM public.subscription_plans
        WHERE is_active = TRUE
        ORDER BY price ASC, id ASC
    `;

    const result = await pool.query(query);
    return result.rows;
}


// Create a subscription for a lab
export async function createSubscription({
    labId,
    planId,
    status = "pending",
    provider = null,
    providerSubscriptionId = null,
    currentPeriodStart = null,
    currentPeriodEnd = null,
}) {
    const query = `
        INSERT INTO public.subscriptions (
            lab_id,
            plan_id,
            status,
            provider,
            provider_subscription_id,
            current_period_start,
            current_period_end
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
    `;

    const values = [
        labId,
        planId,
        status,
        provider,
        providerSubscriptionId,
        currentPeriodStart,
        currentPeriodEnd,
    ];

    const result = await pool.query(query, values);
    return result.rows[0];
}


// Find subscription by ID
export async function findSubscriptionById(subscriptionId) {
    const query = `
        SELECT
            s.*,
            p.name AS plan_name,
            p.plan_code,
            p.price,
            p.currency,
            p.billing_interval
        FROM public.subscriptions AS s
        JOIN public.subscription_plans AS p
            ON p.id = s.plan_id
        WHERE s.id = $1
    `;

    const result = await pool.query(query, [subscriptionId]);
    return result.rows[0] ?? null;
}


// List subscriptions belonging to a lab
export async function findSubscriptionsByLab({
    labId,
    limit = 20,
    offset = 0,
}) {
    const query = `
        SELECT
            s.*,
            p.name AS plan_name,
            p.plan_code,
            p.price,
            p.currency,
            p.billing_interval
        FROM public.subscriptions AS s
        JOIN public.subscription_plans AS p
            ON p.id = s.plan_id
        WHERE s.lab_id = $1
        ORDER BY s.created_at DESC, s.id DESC
        LIMIT $2 OFFSET $3
    `;

    const result = await pool.query(query, [
        labId,
        limit,
        offset,
    ]);

    return result.rows;
}


// Update subscription status
export async function updateSubscriptionStatus({
    subscriptionId,
    status,
}) {
    const query = `
        UPDATE public.subscriptions
        SET status = $2,
            cancelled_at = CASE
                WHEN $2 = 'cancelled'
                THEN COALESCE(cancelled_at, NOW())
                ELSE cancelled_at
            END,
            updated_at = NOW()
        WHERE id = $1
        RETURNING *
    `;

    const result = await pool.query(query, [
        subscriptionId,
        status,
    ]);

    return result.rows[0] ?? null;
}


// Schedule cancellation at the end of the current period
export async function scheduleSubscriptionCancellation(
    subscriptionId
) {
    const query = `
        UPDATE public.subscriptions
        SET cancel_at_period_end = TRUE,
            updated_at = NOW()
        WHERE id = $1
          AND status IN ('trialing', 'active', 'past_due')
        RETURNING *
    `;

    const result = await pool.query(query, [subscriptionId]);
    return result.rows[0] ?? null;
}
