
import * as labService from "../services/lab.service.js";

// Submit a laboratory application
export async function createLab(req, res, next) {
    try {
        const lab = await labService.createLab(req.body);

        return res.status(201).json({
            success: true,
            message: "Laboratory application submitted successfully",
            data: lab,
        });
    } catch (error) {
        next(error);
    }
}

// Search approved laboratories
export async function getLabs(req, res, next) {
    try {
        const result = await labService.getLabs({
            search: req.query.search,
            limit: req.query.limit,
            offset: req.query.offset,
        });

        return res.status(200).json({
            success: true,
            message: "Laboratories retrieved successfully",
            data: result.labs,
            pagination: result.pagination,
        });
    } catch (error) {
        next(error);
    }
}

// Get one laboratory by ID
export async function getLabById(req, res, next) {
    try {
        const lab = await labService.getLabById(req.params.labId);

        return res.status(200).json({
            success: true,
            message: "Laboratory retrieved successfully",
            data: lab,
        });
    } catch (error) {
        next(error);
    }
}

// Update the authenticated laboratory's profile
export async function updateMyLab(req, res, next) {
    try {
        const lab = await labService.updateMyLab({
            user: req.user,
            updates: req.body,
        });

        return res.status(200).json({
            success: true,
            message: "Laboratory profile updated successfully",
            data: lab,
        });
    } catch (error) {
        next(error);
    }
}

// List laboratory applications (admin only)
export async function getLabApplications(req, res, next) {
    try {
        const result = await labService.getLabApplications({
            status: req.query.status,
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

// Approve or reject a laboratory application (admin only)
export async function reviewLabApplication(req, res, next) {
    try {
        const lab = await labService.reviewLabApplication({
            labId: req.params.labId,
            status: req.body.status,
            reason: req.body.reason,
            reviewedBy: req.user.id,
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

// Suspend a laboratory (admin only)
export async function suspendLab(req, res, next) {
    try {
        const lab = await labService.suspendLab({
            labId: req.params.labId,
            reason: req.body.reason,
            suspendedBy: req.user.id,
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
