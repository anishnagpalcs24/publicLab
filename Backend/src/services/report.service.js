

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

// Create a report record for an existing order
export async function createReport({ user, orderId, patientId, file }) {
    requireLabUser(user);

    if (!orderId || !patientId || !file) {
        throw createError("Order, patient, and report file are required", 400);
    }

    // File storage must be implemented before report creation is enabled.
    // Never store an arbitrary client-provided file path.
    throw createError(
        "Report uploads are not enabled until private file storage is configured",
        501
    );
}

// Get a report if the authenticated lab owns it
export async function getReportById({ reportId, user }) {
    requireLabUser(user);

    const result = await pool.query(
        `SELECT id, order_id, patient_id, lab_id, storage_provider,
                filename, mime_type, file_size, status,
                uploaded_by, published_at, created_at, updated_at
         FROM reports
         WHERE id = $1 AND lab_id = $2`,
        [reportId, user.labId]
    );

    if (result.rows.length === 0) {
        throw createError("Report not found", 404);
    }

    return result.rows[0];
}

// List reports for the authenticated laboratory
export async function getLabReports({
    user,
    status,
    limit = 20,
    offset = 0,
}) {
    requireLabUser(user);

    const pagination = parsePagination(limit, offset);
    const allowedStatuses = ["draft", "published", "corrected", "voided"];

    if (status && !allowedStatuses.includes(status)) {
        throw createError("Invalid report status filter", 400);
    }

    const result = await pool.query(
        `SELECT id, order_id, patient_id, lab_id, filename,
                mime_type, file_size, status, published_at, created_at
         FROM reports
         WHERE lab_id = $1
           AND ($2::text IS NULL OR status = $2)
         ORDER BY created_at DESC, id DESC
         LIMIT $3 OFFSET $4`,
        [user.labId, status || null, pagination.limit, pagination.offset]
    );

    const countResult = await pool.query(
        `SELECT COUNT(*) FROM reports
         WHERE lab_id = $1
           AND ($2::text IS NULL OR status = $2)`,
        [user.labId, status || null]
    );

    return {
        reports: result.rows,
        pagination: {
            total: Number(countResult.rows[0].count),
            ...pagination,
        },
    };
}

// List reports for a patient associated with the authenticated lab
export async function getPatientReports({
    patientId,
    user,
    limit = 20,
    offset = 0,
}) {
    requireLabUser(user);

    const pagination = parsePagination(limit, offset);

    const patientResult = await pool.query(
        `SELECT id FROM lab_patient_refs
         WHERE patient_id = $1 AND lab_id = $2`,
        [patientId, user.labId]
    );

    if (patientResult.rows.length === 0) {
        throw createError("Patient not found", 404);
    }

    const result = await pool.query(
        `SELECT id, order_id, patient_id, lab_id, filename,
                mime_type, file_size, status, published_at, created_at
         FROM reports
         WHERE patient_id = $1 AND lab_id = $2
         ORDER BY created_at DESC, id DESC
         LIMIT $3 OFFSET $4`,
        [patientId, user.labId, pagination.limit, pagination.offset]
    );

    const countResult = await pool.query(
        `SELECT COUNT(*) FROM reports
         WHERE patient_id = $1 AND lab_id = $2`,
        [patientId, user.labId]
    );

    return {
        reports: result.rows,
        pagination: {
            total: Number(countResult.rows[0].count),
            ...pagination,
        },
    };
}

// Publish a draft report
export async function publishReport({ reportId, user }) {
    requireLabUser(user);

    const result = await pool.query(
        `UPDATE reports
         SET status = 'published',
             published_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1
           AND lab_id = $2
           AND status = 'draft'
         RETURNING id, order_id, patient_id, lab_id, status,
                   published_at, updated_at`,
        [reportId, user.labId]
    );

    if (result.rows.length === 0) {
        throw createError(
            "Draft report not found or cannot be published",
            404
        );
    }

    return result.rows[0];
}

// Add a corrected version of a report
export async function correctReport({
    reportId,
    user,
    file,
    reason,
}) {
    requireLabUser(user);

    if (!file || !reason?.trim()) {
        throw createError(
            "Corrected report file and correction reason are required",
            400
        );
    }

    // Implement after private storage and report version transactions
    // are configured. Do not overwrite the original report.
    throw createError(
        "Report corrections are not enabled until versioned private storage is configured",
        501
    );
}

// Return secure file information after authorization
export async function getReportFile({ reportId, user }) {
    requireLabUser(user);

    const result = await pool.query(
        `SELECT storage_provider, storage_key, filename, mime_type, file_size
         FROM reports
         WHERE id = $1
           AND lab_id = $2
           AND status IN ('published', 'corrected')`,
        [reportId, user.labId]
    );

    if (result.rows.length === 0) {
        throw createError("Published report not found", 404);
    }

    // A storage adapter must resolve private storage keys safely.
    // Never convert a database storage key directly into an arbitrary path.
    throw createError(
        "Secure report download is not configured yet",
        501
    );
}
