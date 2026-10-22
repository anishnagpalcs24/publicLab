

import * as orderService from "../services/order.service.js";

// Create an order
export async function createOrder(req, res, next) {
    try {
        const order = await orderService.createOrder({
            user: req.user,
            patientId: req.body.patientId,
            items: req.body.items,
        });

        return res.status(201).json({
            success: true,
            message: "Order created successfully",
            data: order,
        });
    } catch (error) {
        next(error);
    }
}

// Get an order by ID
export async function getOrderById(req, res, next) {
    try {
        const order = await orderService.getOrderById({
            orderId: req.params.orderId,
            user: req.user,
        });

        return res.status(200).json({
            success: true,
            message: "Order retrieved successfully",
            data: order,
        });
    } catch (error) {
        next(error);
    }
}

// List orders for the authenticated laboratory
export async function getLabOrders(req, res, next) {
    try {
        const result = await orderService.getLabOrders({
            user: req.user,
            status: req.query.status,
            paymentStatus: req.query.paymentStatus,
            limit: req.query.limit,
            offset: req.query.offset,
        });

        return res.status(200).json({
            success: true,
            message: "Orders retrieved successfully",
            data: result.orders,
            pagination: result.pagination,
        });
    } catch (error) {
        next(error);
    }
}

// List orders for a particular patient
export async function getPatientOrders(req, res, next) {
    try {
        const result = await orderService.getPatientOrders({
            patientId: req.params.patientId,
            user: req.user,
            limit: req.query.limit,
            offset: req.query.offset,
        });

        return res.status(200).json({
            success: true,
            message: "Patient orders retrieved successfully",
            data: result.orders,
            pagination: result.pagination,
        });
    } catch (error) {
        next(error);
    }
}

// Update an order's status
export async function updateOrderStatus(req, res, next) {
    try {
        const order = await orderService.updateOrderStatus({
            orderId: req.params.orderId,
            status: req.body.status,
            user: req.user,
        });

        return res.status(200).json({
            success: true,
            message: "Order status updated successfully",
            data: order,
        });
    } catch (error) {
        next(error);
    }
}
