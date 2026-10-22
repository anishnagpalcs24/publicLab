
import { pool } from "../config/db.js";

function createError(message, statusCode) {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
}

function requireAdmin(user) {
    if (!user?.id || user.role !== "admin") {
        throw createError("Administrator access required", 403);
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

// Get summary counts for the admin dashboard
export async function getDashboard({ user } = {}) {
    requireAdmin(user);

    const [
        users,
        labs,
        pendingLabs,
        patients,
        orders,
        callbacks,
        subscriptions,
    ] = await Promise.all([
        pool.query("SELECT COUNT(*) FROM users"),
        pool.query("SELECT COUNT(*) FROM labs"),
        pool.query(
            "SELECT COUNT(*) FROM labs WHERE approval_status = 'pending'"
        ),
        pool.query("SELECT COUNT(*) FROM patients"),
        pool.query("SELECT COUNT(*) FROM orders"),
        pool.query(
            "SELECT COUNT(*) FROM callbacks WHERE callback_status = 'pending'"
        ),
        pool.query(
            "SELECT COUNT(*) FROM subscriptions WHERE status = 'active'"
        ),
    ]);

    return {
        totalUsers: Number(users.rows[0].count),
        totalLabs: Number(labs.rows[0].count),
        pendingLabApplications: Number(pendingLabs.rows[0].count),
        totalPatients: Number(patients.rows[0].count),
        totalOrders: Number(orders.rows[0].count),
        pendingCallbacks: Number(callbacks.rows[0].count),
        activeSubscriptions: Number(subscriptions.rows[0].count),
    };
}

// List and search users
export async function getUsers({
    user,
    search,
    status,
    limit = 20,
    offset = 0,
}) {
    requireAdmin(user);

    const pagination = parsePagination(limit, offset);
    const allowedStatuses = ["active", "pending", "suspended", "disabled"];

    if (status && !allowedStatuses.includes(status)) {
        throw createError("Invalid account status", 400);
    }

    const searchTerm = search?.trim() || null;

    const result = await pool.query(
        `SELECT id, full_name, email, phone, account_status,
                created_at, updated_at
         FROM users
         WHERE ($1::text IS NULL
                OR full_name ILIKE '%' || $1 || '%'
                OR email ILIKE '%' || $1 || '%'
                OR phone ILIKE '%' || $1 || '%')
           AND ($2::text IS NULL OR account_status = $2)
         ORDER BY created_at DESC, id DESC
         LIMIT $3 OFFSET $4`,
        [searchTerm, status || null, pagination.limit, pagination.offset]
    );

    const countResult = await pool.query(
        `SELECT COUNT(*)
         FROM users
         WHERE ($1::text IS NULL
                OR full_name ILIKE '%' || $1 || '%'
                OR email ILIKE '%' || $1 || '%'
                OR phone ILIKE '%' || $1 || '%')
           AND ($2::text IS NULL OR account_status = $2)`,
        [searchTerm, status || null]
    );

    return {
        users: result.rows,
        pagination: {
            total: Number(countResult.rows[0].count),
            ...pagination,
        },
    };
}

// Update a user's account status
export async function updateUserStatus({
    userId,
    status,
    adminId,
    reason,
}) {
    if (!adminId) {
        throw createError("Administrator identity required", 403);
    }

    const allowedStatuses = ["active", "suspended", "disabled"];

    if (!allowedStatuses.includes(status)) {
        throw createError("Invalid account status", 400);
    }

    if (String(userId) === String(adminId)) {
        throw createError("You cannot change your own account status", 400);
    }

    const result = await pool.query(
        `UPDATE users
         SET account_status = $1,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2
         RETURNING id, full_name, email, phone,
                   account_status, updated_at`,
        [status, userId]
    );

    if (result.rows.length === 0) {
        throw createError("User not found", 404);
    }

    // Persist the reason and administrator in an audit log
    // when the audit-log table is implemented.
    return {
        ...result.rows[0],
        reason: reason || null,
    };
}

// List laboratory applications
export async function getLabApplications({
    user,
    status = "pending",
    search,
    limit = 20,
    offset = 0,
}) {
    requireAdmin(user);

    const pagination = parsePagination(limit, offset);
    const allowedStatuses = [
        "pending",
        "approved",
        "rejected",
        "suspended",
    ];

    if (status && !allowedStatuses.includes(status)) {
        throw createError("Invalid laboratory status", 400);
    }

    const searchTerm = search?.trim() || null;

    const result = await pool.query(
        `SELECT id, name, registration_number, email, phone,
                description, approval_status, created_at
         FROM labs
         WHERE ($1::text IS NULL OR approval_status = $1)
           AND ($2::text IS NULL
                OR name ILIKE '%' || $2 || '%'
                OR registration_number ILIKE '%' || $2 || '%')
         ORDER BY created_at DESC, id DESC
         LIMIT $3 OFFSET $4`,
        [status || null, searchTerm, pagination.limit, pagination.offset]
    );

    const countResult = await pool.query(
        `SELECT COUNT(*) FROM labs
         WHERE ($1::text IS NULL OR approval_status = $1)
           AND ($2::text IS NULL
                OR name ILIKE '%' || $2 || '%'
                OR registration_number ILIKE '%' || $2 || '%')`,
        [status || null, searchTerm]
    );

    return {
        labs: result.rows,
        pagination: {
            total: Number(countResult.rows[0].count),
            ...pagination,
        },
    };
}

// Review a pending lab application
export async function reviewLabApplication({
    labId,
    status,
    reason,
    adminId,
}) {
    if (!adminId) {
        throw createError("Administrator identity required", 403);
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

    return {
        ...result.rows[0],
        reviewReason: reason || null,
    };
}

// Suspend an approved laboratory
export async function suspendLab({ labId, reason, adminId }) {
    if (!adminId) {
        throw createError("Administrator identity required", 403);
    }

    if (!reason?.trim()) {
        throw createError("Suspension reason is required", 400);
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
        throw createError("Approved laboratory not found", 404);
    }

    return {
        ...result.rows[0],
        suspensionReason: reason.trim(),
    };
}

// List callback requests for administrators
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
                callback_status, assigned_to, requested_at, created_at
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

// Audit logs remain unavailable until the audit-log schema is created.
export async function getAuditLogs({
    user,
    action,
    limit = 20,
    offset = 0,
}) {
    requireAdmin(user);

    parsePagination(limit, offset);

    throw createError(
        "Audit-log retrieval is not available until the audit-log table is configured",
        501
    );
}
