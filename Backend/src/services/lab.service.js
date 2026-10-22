

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
    if (user?.role !== "admin") {
        throw createError("Administrator access required", 403);
    }
}

function requireLabUser(user) {
    if (!user?.id || !user?.labId) {
        throw createError("Laboratory account required", 403);
    }
}

// Submit a laboratory application
export async function createLab(data) {
    const name = data.name?.trim();
    const registrationNumber = data.registrationNumber?.trim();
    const email = data.email?.trim().toLowerCase() || null;
    const phone = data.phone?.trim() || null;
    const description = data.description?.trim() || null;

    if (!name || !registrationNumber || (!email && !phone)) {
        throw createError(
            "Lab name, registration number, and email or phone are required",
            400
        );
    }

    try {
        const result = await pool.query(
            `INSERT INTO labs
                (name, registration_number, email, phone,
                 description, approval_status)
             VALUES ($1, $2, $3, $4, $5, 'pending')
             RETURNING id, name, registration_number, email, phone,
                       description, approval_status, created_at`,
            [name, registrationNumber, email, phone, description]
        );

        return result.rows[0];
    } catch (error) {
        if (error.code === "23505") {
            throw createError(
                "A laboratory with this registration number or email already exists",
                409
            );
        }

        throw error;
    }
}

// List approved laboratories for public discovery
export async function getLabs({
    search,
    limit = 20,
    offset = 0,
} = {}) {
    const pagination = parsePagination(limit, offset);
    const searchTerm = search?.trim() || null;

    const values = [searchTerm, pagination.limit, pagination.offset];

    const result = await pool.query(
        `SELECT id, name, email, phone, description, approval_status
         FROM labs
         WHERE approval_status = 'approved'
           AND (
             $1::text IS NULL
             OR name ILIKE '%' || $1 || '%'
             OR description ILIKE '%' || $1 || '%'
           )
         ORDER BY name ASC
         LIMIT $2 OFFSET $3`,
        values
    );

    const countResult = await pool.query(
        `SELECT COUNT(*)
         FROM labs
         WHERE approval_status = 'approved'
           AND (
             $1::text IS NULL
             OR name ILIKE '%' || $1 || '%'
             OR description ILIKE '%' || $1 || '%'
           )`,
        [searchTerm]
    );

    return {
        labs: result.rows,
        pagination: {
            total: Number(countResult.rows[0].count),
            ...pagination,
        },
    };
}

// Get a public laboratory profile
export async function getLabById(labId) {
    const result = await pool.query(
        `SELECT id, name, email, phone, description, approval_status
         FROM labs
         WHERE id = $1 AND approval_status = 'approved'`,
        [labId]
    );

    if (result.rows.length === 0) {
        throw createError("Laboratory not found", 404);
    }

    return result.rows[0];
}

// Update the authenticated laboratory's profile
export async function updateMyLab({ user, updates }) {
    requireLabUser(user);

    const allowedFields = {
        name: "name",
        email: "email",
        phone: "phone",
        description: "description",
    };

    const setClauses = [];
    const values = [];
    let index = 1;

    for (const [field, column] of Object.entries(allowedFields)) {
        if (updates[field] !== undefined) {
            let value = updates[field];

            if (typeof value === "string") {
                value = value.trim();
            }

            if (field === "name" && !value) {
                throw createError("Laboratory name cannot be empty", 400);
            }

            if (field === "email") {
                value = value ? value.toLowerCase() : null;
            }

            if (field === "phone" || field === "description") {
                value = value || null;
            }

            setClauses.push(`${column} = $${index++}`);
            values.push(value);
        }
    }

    if (setClauses.length === 0) {
        throw createError("No valid profile fields provided", 400);
    }

    setClauses.push("updated_at = CURRENT_TIMESTAMP");
    values.push(user.labId);

    try {
        const result = await pool.query(
            `UPDATE labs
             SET ${setClauses.join(", ")}
             WHERE id = $${index}
             RETURNING id, name, email, phone, description,
                       approval_status, updated_at`,
            values
        );

        if (result.rows.length === 0) {
            throw createError("Laboratory not found", 404);
        }

        return result.rows[0];
    } catch (error) {
        if (error.code === "23505") {
            throw createError("That email is already registered", 409);
        }

        throw error;
    }
}

// List laboratory applications (admin only)
export async function getLabApplications({
    status = "pending",
    limit = 20,
    offset = 0,
} = {}) {
    const pagination = parsePagination(limit, offset);

    const allowedStatuses = [
        "pending",
        "approved",
        "rejected",
        "suspended",
    ];

    if (status && !allowedStatuses.includes(status)) {
        throw createError("Invalid laboratory status filter", 400);
    }

    const values = [status || null, pagination.limit, pagination.offset];

    const result = await pool.query(
        `SELECT id, name, registration_number, email, phone,
                description, approval_status, created_at
         FROM labs
         WHERE ($1::text IS NULL OR approval_status = $1)
         ORDER BY created_at DESC
         LIMIT $2 OFFSET $3`,
        values
    );

    const countResult = await pool.query(
        `SELECT COUNT(*) FROM labs
         WHERE ($1::text IS NULL OR approval_status = $1)`,
        [status || null]
    );

    return {
        labs: result.rows,
        pagination: {
            total: Number(countResult.rows[0].count),
            ...pagination,
        },
    };
}

// Approve or reject an application (admin only)
export async function reviewLabApplication({
    labId,
    status,
    reason,
    reviewedBy,
}) {
    // reviewedBy is supplied by the controller from req.user.id.
    // The admin role must also be checked by authorization middleware.
    if (!reviewedBy) {
        throw createError("Administrator identity is required", 403);
    }

    if (!["approved", "rejected"].includes(status)) {
        throw createError(
            "Status must be approved or rejected",
            400
        );
    }

    const result = await pool.query(
        `UPDATE labs
         SET approval_status = $1,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2 AND approval_status = 'pending'
         RETURNING id, name, registration_number, email, phone,
                   approval_status, updated_at`,
        [status, labId]
    );

    if (result.rows.length === 0) {
        throw createError(
            "Pending laboratory application not found",
            404
        );
    }

    // Persist review reason and reviewer in an audit table once
    // the audit-log schema is implemented.
    return {
        ...result.rows[0],
        reviewReason: reason || null,
    };
}

// Suspend an existing laboratory (admin only)
export async function suspendLab({
    labId,
    reason,
    suspendedBy,
}) {
    if (!suspendedBy) {
        throw createError("Administrator identity is required", 403);
    }

    if (!reason?.trim()) {
        throw createError("A suspension reason is required", 400);
    }

    const result = await pool.query(
        `UPDATE labs
         SET approval_status = 'suspended',
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1 AND approval_status = 'approved'
         RETURNING id, name, registration_number, approval_status,
                   updated_at`,
        [labId]
    );

    if (result.rows.length === 0) {
        throw createError(
            "Approved laboratory not found",
            404
        );
    }

    // Record the reason and administrator in the audit log
    // when that table and service are implemented.
    return {
        ...result.rows[0],
        suspensionReason: reason.trim(),
    };
}
