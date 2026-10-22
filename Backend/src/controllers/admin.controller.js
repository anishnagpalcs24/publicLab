
import * as adminService from "../services/admin.service.js";

// Get admin dashboard statistics
export async function getDashboard(req, res, next) {
    try {
        const dashboard = await adminService.getDashboard();

        return res.status(200).json({
            success: true,
            message: "Dashboard data retrieved successfully",
            data: dashboard,
        });
    } catch (error) {
        next(error);
    }
}

// List all users
export async function getUsers(req, res, next) {
    try {
        const result = await adminService.getUsers({
            search: req.query.search,
            status: req.query.status,
            limit: req.query.limit,
            offset: req.query.offset,
        });

        return res.status(200).json({
            success: true,
            message: "Users retrieved successfully",
            data: result.users,
            pagination: result.pagination,
        });
    } catch (error) {
        next(error);
    }
}

// Update a user's account status
export async function updateUserStatus(req, res, next) {
    try {
        const user = await adminService.updateUserStatus({
            userId: req.params.userId,
            status: req.body.status,
            adminId: req.user.id,
            reason: req.body.reason,
        });

        return res.status(200).json({
            success: true,
            message: "User status updated successfully",
            data: user,
        });
    } catch (error) {
        next(error);
    }
}

// List laboratory applications
export async function getLabApplications(req, res, next) {
    try {
        const result = await adminService.getLabApplications({
            status: req.query.status,
            search: req.query.search,
            limit: req.query.limit,
            offset: req.query.offset,
        });

        return res.status(200).json({
            success: true,
            message: "Laboratory applications retrieved successfully",
            data: result.labs,
            pagination: result.pagination,
        });
    } catch (error) {
        next(error);
    }
}

// Review a laboratory application
export async function reviewLabApplication(req, res, next) {
    try {
        const lab = await adminService.reviewLabApplication({
            labId: req.params.labId,
            status: req.body.status,
            reason: req.body.reason,
            adminId: req.user.id,
        });

        return res.status(200).json({
            success: true,
            message: "Laboratory application reviewed successfully",
            data: lab,
        });
    } catch (error) {
        next(error);
    }
}

// Suspend a laboratory
export async function suspendLab(req, res, next) {
    try {
        const lab = await adminService.suspendLab({
            labId: req.params.labId,
            reason: req.body.reason,
            adminId: req.user.id,
        });

        return res.status(200).json({
            success: true,
            message: "Laboratory suspended successfully",
            data: lab,
        });
    } catch (error) {
        next(error);
    }
}

// View callback requests
export async function getCallbacks(req, res, next) {
    try {
        const result = await adminService.getCallbacks({
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

// View audit logs
export async function getAuditLogs(req, res, next) {
    try {
        const result = await adminService.getAuditLogs({
            action: req.query.action,
            limit: req.query.limit,
            offset: req.query.offset,
        });

        return res.status(200).json({
            success: true,
            message: "Audit logs retrieved successfully",
            data: result.logs,
            pagination: result.pagination,
        });
    } catch (error) {
        next(error);
    }
}

