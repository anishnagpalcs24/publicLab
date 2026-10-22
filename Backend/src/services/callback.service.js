
import { pool } from "../config/db.js";

function createError(message, statusCode) {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
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

function requireAdmin(user) {
    if (!user?.id || user.role !== "admin") {
        throw createError("Administrator access required", 403);
    }
}

// Submit a public callback request
export async function createCallback({
    name,
    phone,
    email = null,
    labId = null,
    message = null,
}) {
    if (!name?.trim() || !phone?.trim()) {
        throw createError("Name and phone number are required", 400);
    }

    const normalizedEmail = email?.trim().toLowerCase() || null;

    if (normalizedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
        throw createError("Please provide a valid email address", 400);
    }

    if (message && message.length > 2000) {
        throw createError("Message must not exceed 2000 characters", 400);
    }

    if (labId !== null) {
        const labResult = await pool.query(
            `SELECT id FROM labs
             WHERE id = $1 AND approval_status = 'approved'`,
            [labId]
        );

        if (labResult.rows.length === 0) {
            throw createError("Laboratory not found", 404);
        }
    }

    const result = await pool.query(
        `INSERT INTO callbacks
            (name, phone, email, lab_id, message, callback_status)
         VALUES ($1, $2, $3, $4, $5, 'pending')
         RETURNING id, name, phone, email, lab_id, message,
                   callback_status, requested_at, created_at`,
        [
            name.trim(),
            phone.trim(),
            normalizedEmail,
            labId,
            message?.trim() || null,
        ]
    );

    return result.rows[0];
}

// Get a callback request
export async function getCallbackById({ callbackId, user }) {
    if (!user?.id) {
        throw createError("Authentication required", 401);
    }

    if (user.role !== "admin") {
        throw createError("Administrator access required", 403);
    }

    const result = await pool.query(
        `SELECT id, name, phone, email, lab_id, message,
                callback_status, assigned_to, requested_at,
                contacted_at, created_at, updated_at
         FROM callbacks
         WHERE id = $1`,
        [callbackId]
    );

    if (result.rows.length === 0) {
        throw createError("Callback request not found", 404);
    }

    return result.rows[0];
}

// List callback requests (admin only)
export async function getCallbacks({
    user,
    status,
    limit = 20,
    offset = 0,
}) {
    requireAdmin(user);

    const pagination = parsePagination(limit, offset);

    const allowedStatuses = [
        "pending",
        "contacted",
        "completed",
        "cancelled",
    ];

    if (status && !allowedStatuses.includes(status)) {
        throw createError("Invalid callback status", 400);
    }

    const result = await pool.query(
        `SELECT id, name, phone, email, lab_id, message,
                callback_status, assigned_to, requested_at,
                contacted_at, created_at, updated_at
         FROM callbacks
         WHERE ($1::text IS NULL OR callback_status = $1)
         ORDER BY requested_at DESC, id DESC
         LIMIT $2 OFFSET $3`,
        [status || null, pagination.limit, pagination.offset]
    );

    const countResult = await pool.query(
        `SELECT COUNT(*) FROM callbacks
         WHERE ($1::text IS NULL OR callback_status = $1)`,
        [status || null]
    );

    return {
        callbacks: result.rows,
        pagination: {
            total: Number(countResult.rows[0].count),
            ...pagination,
        },
    };
}

// Update callback status (admin only)
export async function updateCallbackStatus({
    callbackId,
    status,
    assignedTo = null,
    user,
}) {
    requireAdmin(user);

    const allowedStatuses = [
        "pending",
        "contacted",
        "completed",
        "cancelled",
    ];

    if (!allowedStatuses.includes(status)) {
        throw createError("Invalid callback status", 400);
    }

    if (assignedTo !== null && !Number.isSafeInteger(Number(assignedTo))) {
        throw createError("Invalid assigned user ID", 400);
    }

    const result = await pool.query(
        `UPDATE callbacks
         SET callback_status = $1,
             assigned_to = $2,
             contacted_at = CASE
                 WHEN $1 = 'contacted'
                 THEN COALESCE(contacted_at, CURRENT_TIMESTAMP)
                 ELSE contacted_at
             END,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $3
         RETURNING id, name, phone, email, lab_id, message,
                   callback_status, assigned_to, requested_at,
                   contacted_at, updated_at`,
        [status, assignedTo, callbackId]
    );

    if (result.rows.length === 0) {
        throw createError("Callback request not found", 404);
    }

    return result.rows[0];
}

// Delete a callback request (admin only)
export async function deleteCallback({ callbackId, user }) {
    requireAdmin(user);

    const result = await pool.query(
        `DELETE FROM callbacks
         WHERE id = $1
         RETURNING id`,
        [callbackId]
    );

    if (result.rows.length === 0) {
        throw createError("Callback request not found", 404);
    }

    return { id: result.rows[0].id };
}
