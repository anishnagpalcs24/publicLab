

import * as subscriptionService from "../services/subscription.service.js";

// Get all active subscription plans
export async function getSubscriptionPlans(req, res, next) {
    try {
        const plans = await subscriptionService.getSubscriptionPlans();

        return res.status(200).json({
            success: true,
            message: "Subscription plans retrieved successfully",
            data: plans,
        });
    } catch (error) {
        next(error);
    }
}

// Get a subscription plan by ID
export async function getSubscriptionPlanById(req, res, next) {
    try {
        const plan = await subscriptionService.getSubscriptionPlanById({
            planId: req.params.planId,
        });

        return res.status(200).json({
            success: true,
            message: "Subscription plan retrieved successfully",
            data: plan,
        });
    } catch (error) {
        next(error);
    }
}

// Create a subscription for the authenticated laboratory
export async function createSubscription(req, res, next) {
    try {
        const subscription = await subscriptionService.createSubscription({
            planId: req.body.planId,
            user: req.user,
        });

        return res.status(201).json({
            success: true,
            message: "Subscription created successfully",
            data: subscription,
        });
    } catch (error) {
        next(error);
    }
}

// Get the authenticated laboratory's subscriptions
export async function getMySubscriptions(req, res, next) {
    try {
        const subscriptions =
            await subscriptionService.getMySubscriptions({
                user: req.user,
                limit: req.query.limit,
                offset: req.query.offset,
            });

        return res.status(200).json({
            success: true,
            message: "Subscriptions retrieved successfully",
            data: subscriptions.subscriptions,
            pagination: subscriptions.pagination,
        });
    } catch (error) {
        next(error);
    }
}

// Get one subscription
export async function getSubscriptionById(req, res, next) {
    try {
        const subscription =
            await subscriptionService.getSubscriptionById({
                subscriptionId: req.params.subscriptionId,
                user: req.user,
            });

        return res.status(200).json({
            success: true,
            message: "Subscription retrieved successfully",
            data: subscription,
        });
    } catch (error) {
        next(error);
    }
}

// Cancel a subscription at the end of its billing period
export async function cancelSubscription(req, res, next) {
    try {
        const subscription =
            await subscriptionService.cancelSubscription({
                subscriptionId: req.params.subscriptionId,
                user: req.user,
            });

        return res.status(200).json({
            success: true,
            message: "Subscription cancellation scheduled successfully",
            data: subscription,
        });
    } catch (error) {
        next(error);
    }
}
