

import * as reportService from "../services/report.service.js";

// Create a report
export async function createReport(req, res, next) {
    try {
        const report = await reportService.createReport({
            user: req.user,
            orderId: req.body.orderId,
            patientId: req.body.patientId,
            file: req.file,
        });

        return res.status(201).json({
            success: true,
            message: "Report created successfully",
            data: report,
        });
    } catch (error) {
        next(error);
    }
}

// Get a report by ID
export async function getReportById(req, res, next) {
    try {
        const report = await reportService.getReportById({
            reportId: req.params.reportId,
            user: req.user,
        });

        return res.status(200).json({
            success: true,
            message: "Report retrieved successfully",
            data: report,
        });
    } catch (error) {
        next(error);
    }
}

// Get reports belonging to the authenticated laboratory
export async function getLabReports(req, res, next) {
    try {
        const result = await reportService.getLabReports({
            user: req.user,
            status: req.query.status,
            limit: req.query.limit,
            offset: req.query.offset,
        });

        return res.status(200).json({
            success: true,
            message: "Laboratory reports retrieved successfully",
            data: result.reports,
            pagination: result.pagination,
        });
    } catch (error) {
        next(error);
    }
}

// Get a patient's reports
export async function getPatientReports(req, res, next) {
    try {
        const result = await reportService.getPatientReports({
            patientId: req.params.patientId,
            user: req.user,
            limit: req.query.limit,
            offset: req.query.offset,
        });

        return res.status(200).json({
            success: true,
            message: "Patient reports retrieved successfully",
            data: result.reports,
            pagination: result.pagination,
        });
    } catch (error) {
        next(error);
    }
}

// Publish a draft report
export async function publishReport(req, res, next) {
    try {
        const report = await reportService.publishReport({
            reportId: req.params.reportId,
            user: req.user,
        });

        return res.status(200).json({
            success: true,
            message: "Report published successfully",
            data: report,
        });
    } catch (error) {
        next(error);
    }
}

// Upload a corrected version of a report
export async function correctReport(req, res, next) {
    try {
        const report = await reportService.correctReport({
            reportId: req.params.reportId,
            user: req.user,
            file: req.file,
            reason: req.body.reason,
        });

        return res.status(200).json({
            success: true,
            message: "Corrected report uploaded successfully",
            data: report,
        });
    } catch (error) {
        next(error);
    }
}

// Download or securely access a report file
export async function downloadReport(req, res, next) {
    try {
        const file = await reportService.getReportFile({
            reportId: req.params.reportId,
            user: req.user,
        });

        res.setHeader("Content-Type", file.mimeType);
        res.setHeader(
            "Content-Disposition",
            `attachment; filename="${file.filename}"`
        );

        return res.sendFile(file.absolutePath);
    } catch (error) {
        next(error);
    }
}
