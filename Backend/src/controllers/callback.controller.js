

import * as callbackService from "../services/callback.service.js";

// Submit a callback request (public endpoint)
export async function createCallback(req, res, next) {
    try {
        const callback = await callbackService.createCallback({
            name: req.body.name,
            phone: req.body.phone,
            email: req.body.email,
            labId: req.body.labId ?? null,
            message: req.body.message,
        });

        return res.status(201).json({
            success: true,
            message: "Callback request submitted successfully",
            data: callback,
        });
    } catch (error) {
        next(error);
    }
}

// Get a callback request by ID (authorized staff only)
export async function getCallbackById(req, res, next) {
    try {
        const callback = await callbackService.getCallbackById({
            callbackId: req.params.callbackId,
            user: req.user,
        });

        return res.status(200).json({
            success: true,
            message: "Callback request retrieved successfully",
            data: callback,
        });
    } catch (error) {
        next(error);
    }
}

// List callback requests (authorized staff only)
export async function getCallbacks(req, res, next) {
    try {
        const result = await callbackService.getCallbacks({
            user: req.user,
            status: req.query.status,
            limit: req.query.limit,
            offset: req.query.offset,
        });

        return res.status(200).json({
            success: true,
            message: "Callback requests retrieved successfully",
            data: result.callbacks,
            pagination: result.pagination,
        });
    } catch (error) {
        next(error);
    }
}

// Update a callback's status (authorized staff only)
export async function updateCallbackStatus(req, res, next) {
    try {
        const callback = await callbackService.updateCallbackStatus({
            callbackId: req.params.callbackId,
            status: req.body.status,
            assignedTo: req.body.assignedTo,
            user: req.user,
        });

        return res.status(200).json({
            success: true,
            message: "Callback status updated successfully",
            data: callback,
        });
    } catch (error) {
        next(error);
    }
}

// Delete a callback request (admin only)
export async function deleteCallback(req, res, next) {
    try {
        await callbackService.deleteCallback({
            callbackId: req.params.callbackId,
            user: req.user,
        });

        return res.status(200).json({
            success: true,
            message: "Callback request deleted successfully",
        });
    } catch (error) {
        next(error);
    }
}
