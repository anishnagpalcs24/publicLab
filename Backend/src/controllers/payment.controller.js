

import * as paymentService from "../services/payment.service.js";

// Create a payment for an order
export async function createOrderPayment(req, res, next) {
    try {
        const payment = await paymentService.createOrderPayment({
            orderId: req.body.orderId,
            user: req.user,
            idempotencyKey: req.get("Idempotency-Key"),
        });

        return res.status(201).json({
            success: true,
            message: "Payment request created successfully",
            data: payment,
        });
    } catch (error) {
        next(error);
    }
}

// Create a payment for a lab subscription
export async function createSubscriptionPayment(req, res, next) {
    try {
        const payment = await paymentService.createSubscriptionPayment({
            subscriptionId: req.body.subscriptionId,
            user: req.user,
            idempotencyKey: req.get("Idempotency-Key"),
        });

        return res.status(201).json({
            success: true,
            message: "Subscription payment request created successfully",
            data: payment,
        });
    } catch (error) {
        next(error);
    }
}

// Get payment details
export async function getPaymentById(req, res, next) {
    try {
        const payment = await paymentService.getPaymentById({
            paymentId: req.params.paymentId,
            user: req.user,
        });

        return res.status(200).json({
            success: true,
            message: "Payment retrieved successfully",
            data: payment,
        });
    } catch (error) {
        next(error);
    }
}

// Get payment history for an order
export async function getOrderPayments(req, res, next) {
    try {
        const payments = await paymentService.getOrderPayments({
            orderId: req.params.orderId,
            user: req.user,
        });

        return res.status(200).json({
            success: true,
            message: "Order payment history retrieved successfully",
            data: payments,
        });
    } catch (error) {
        next(error);
    }
}

// Get payment history for a subscription
export async function getSubscriptionPayments(req, res, next) {
    try {
        const payments = await paymentService.getSubscriptionPayments({
            subscriptionId: req.params.subscriptionId,
            user: req.user,
        });

        return res.status(200).json({
            success: true,
            message: "Subscription payment history retrieved successfully",
            data: payments,
        });
    } catch (error) {
        next(error);
    }
}

// Handle payment provider webhooks
export async function handlePaymentWebhook(req, res, next) {
    try {
        const result = await paymentService.handleWebhook({
            headers: req.headers,
            body: req.body,
            rawBody: req.rawBody,
        });

        return res.status(200).json({
            success: true,
            message: "Webhook processed successfully",
            data: result,
        });
    } catch (error) {
        next(error);
    }
}
