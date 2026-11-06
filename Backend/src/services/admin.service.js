import crypto from "crypto";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { pool } from "../config/db.js";
import {
    createSession,
    rotateSessionToken,
} from "../models/session.model.js";
import {
    notifyLabApplicationDecision,
    notifyLabSuspension,
    notifyUserStatusUpdated,
} from "./email.service.js";

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

function getAccessSecret() {
    const secret = process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET;
    if (!secret) {
        throw new Error("JWT_ACCESS_SECRET is not configured");
    }
    return secret;
}

function getRefreshSecret() {
    return process.env.JWT_REFRESH_SECRET || (getAccessSecret() + "_refresh_secret");
}

function hashToken(token) {
    return crypto.createHash("sha256").update(token).digest("hex");
}

function createAdminAccessToken(user, sessionId) {
    return jwt.sign(
        {
            sub: String(user.id),
            sessionId: String(sessionId),
            role: "admin",
            labId: null,
        },
        getAccessSecret(),
        { expiresIn: process.env.JWT_EXPIRES_IN || "15m" }
    );
}

function createAdminRefreshToken(user, sessionId) {
    return jwt.sign(
        {
            sub: String(user.id),
            sessionId: String(sessionId),
            jti: crypto.randomUUID(),
        },
        getRefreshSecret(),
        { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d" }
    );
}

/**
 * Fixed Administrator Login
 * Authenticates against ADMIN_USERNAME and ADMIN_PASSWORD_HASH in environment.
 */
export async function adminLogin({ username, password, ipAddress, userAgent }) {
    if (!username || !password) {
        throw createError("Invalid credentials", 401);
    }

    const expectedUsername = process.env.ADMIN_USERNAME;
    const expectedHash = process.env.ADMIN_PASSWORD_HASH;
    const plaintextFallback = process.env.ADMIN_PASSWORD;

    if (!expectedUsername || (!expectedHash && !plaintextFallback)) {
        throw createError("Admin credentials are not configured on the server", 500);
    }

    const inputUser = username.trim().toLowerCase();
    const expectedUser = expectedUsername.trim().toLowerCase();

    // Constant-time username comparison
    const maxLen = Math.max(inputUser.length, expectedUser.length, 32);
    const isUsernameMatch = crypto.timingSafeEqual(
        Buffer.from(inputUser.padEnd(maxLen, " ")),
        Buffer.from(expectedUser.padEnd(maxLen, " "))
    );

    if (!isUsernameMatch) {
        throw createError("Invalid credentials", 401);
    }

    // Verify password securely using bcrypt against ADMIN_PASSWORD_HASH
    let isPasswordMatch = false;
    if (expectedHash) {
        isPasswordMatch = await bcrypt.compare(password, expectedHash);
    } else if (plaintextFallback) {
        const passMaxLen = Math.max(password.length, plaintextFallback.length, 32);
        isPasswordMatch = crypto.timingSafeEqual(
            Buffer.from(password.padEnd(passMaxLen, " ")),
            Buffer.from(plaintextFallback.padEnd(passMaxLen, " "))
        );
    }

    if (!isPasswordMatch) {
        throw createError("Invalid credentials", 401);
    }

    // Resolve or upsert fixed admin user record in PostgreSQL users table
    const adminEmail = expectedUser.includes("@") ? expectedUser : "admin@publiclab.internal";
    let adminUserResult = await pool.query(
        `SELECT id, full_name, email, role, account_status, email_verified
         FROM users
         WHERE role = 'admin' AND (LOWER(email) = $1 OR full_name = 'PublicLab Administrator')
         ORDER BY id ASC LIMIT 1`,
        [adminEmail]
    );

    let adminUser;
    if (adminUserResult.rows.length === 0) {
        const insertResult = await pool.query(
            `INSERT INTO users (full_name, email, password_hash, role, account_status, email_verified)
             VALUES ('PublicLab Administrator', $1, 'env_managed', 'admin', 'active', TRUE)
             RETURNING id, full_name, email, role, account_status, email_verified`,
            [adminEmail]
        );
        adminUser = insertResult.rows[0];
    } else {
        adminUser = adminUserResult.rows[0];
        if (adminUser.account_status !== "active" || !adminUser.email_verified) {
            await pool.query(
                `UPDATE users SET account_status = 'active', email_verified = TRUE WHERE id = $1`,
                [adminUser.id]
            );
            adminUser.account_status = "active";
            adminUser.email_verified = true;
        }
    }

    // Create session and issue tokens compatible with existing authentication architecture
    const sessionExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const tempHash = crypto.randomBytes(32).toString("hex");

    const session = await createSession({
        userId: adminUser.id,
        refreshTokenHash: tempHash,
        ipAddress,
        userAgent,
        expiresAt: sessionExpiresAt,
    });

    const accessToken = createAdminAccessToken(adminUser, session.id);
    const refreshToken = createAdminRefreshToken(adminUser, session.id);
    const finalHash = hashToken(refreshToken);

    await rotateSessionToken({
        sessionId: session.id,
        refreshTokenHash: finalHash,
        expiresAt: sessionExpiresAt,
        ipAddress,
        userAgent,
    });

    return {
        user: {
            id: adminUser.id,
            fullName: adminUser.full_name,
            email: adminUser.email,
            role: "admin",
            accountStatus: "active",
            emailVerified: true,
        },
        accessToken,
        refreshToken,
    };
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

    const updatedUser = result.rows[0];

    // Trigger notification to user and admin
    notifyUserStatusUpdated({ user: updatedUser, status, reason }).catch(() => {});

    return {
        ...updatedUser,
        reason: reason || null,
    };
}

// List laboratory applications with full owner details and contact information
export async function getLabApplications({
    user,
    status = null,
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

    const normalizedStatus =
        status && status !== "all" ? status.trim().toLowerCase() : null;

    if (normalizedStatus && !allowedStatuses.includes(normalizedStatus)) {
        throw createError("Invalid laboratory status filter", 400);
    }

    const searchTerm = search?.trim() || null;

    const result = await pool.query(
        `SELECT l.id, l.name, l.registration_number, l.email, l.phone,
                l.description, l.address, l.city, l.technical_contact,
                l.operating_hours, l.services, l.sample_collection_available,
                l.approval_status, l.rejection_reason, l.rejection_notes,
                l.suspension_reason, l.created_at, l.updated_at,
                u.id AS owner_id, u.full_name AS owner_name, u.email AS owner_email, u.phone AS owner_phone
         FROM labs l
         LEFT JOIN users u ON u.id = l.owner_id
         WHERE ($1::text IS NULL OR l.approval_status = $1)
           AND ($2::text IS NULL
                OR l.name ILIKE '%' || $2 || '%'
                OR l.registration_number ILIKE '%' || $2 || '%'
                OR l.email ILIKE '%' || $2 || '%'
                OR u.full_name ILIKE '%' || $2 || '%'
                OR u.email ILIKE '%' || $2 || '%')
         ORDER BY l.created_at DESC, l.id DESC
         LIMIT $3 OFFSET $4`,
        [normalizedStatus, searchTerm, pagination.limit, pagination.offset]
    );

    const countResult = await pool.query(
        `SELECT COUNT(*)
         FROM labs l
         LEFT JOIN users u ON u.id = l.owner_id
         WHERE ($1::text IS NULL OR l.approval_status = $1)
           AND ($2::text IS NULL
                OR l.name ILIKE '%' || $2 || '%'
                OR l.registration_number ILIKE '%' || $2 || '%'
                OR l.email ILIKE '%' || $2 || '%'
                OR u.full_name ILIKE '%' || $2 || '%'
                OR u.email ILIKE '%' || $2 || '%')`,
        [normalizedStatus, searchTerm]
    );

    return {
        labs: result.rows,
        pagination: {
            total: Number(countResult.rows[0].count),
            ...pagination,
        },
    };
}

// Review a pending lab application (approve or reject)
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

    if (status === "rejected" && !reason?.trim()) {
        throw createError("A rejection reason is required when rejecting an application", 400);
    }

    const trimmedReason = reason?.trim() || null;

    const result = await pool.query(
        `UPDATE labs
         SET approval_status = $1::varchar,
             rejection_reason = CASE WHEN $1::varchar = 'rejected' THEN $3::text ELSE NULL END,
             rejection_notes = CASE WHEN $1::varchar = 'rejected' THEN $3::text ELSE NULL END,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2 AND approval_status = 'pending'
         RETURNING id, name, registration_number, email, phone, address, city,
                   approval_status, rejection_reason, rejection_notes, created_at, updated_at`,
        [status, labId, trimmedReason]
    );

    if (result.rows.length === 0) {
        throw createError(
            "Pending laboratory application not found",
            404
        );
    }

    const reviewedLab = result.rows[0];

    // Safely trigger notifications to lab owner and admin
    (async () => {
        try {
            const ownerRes = await pool.query(
                `SELECT u.email AS owner_email, l.email AS lab_email
                 FROM labs l
                 LEFT JOIN users u ON u.id = l.owner_id
                 WHERE l.id = $1`,
                [reviewedLab.id]
            );
            const ownerEmail = ownerRes.rows[0]?.owner_email || ownerRes.rows[0]?.lab_email || reviewedLab.email;
            await notifyLabApplicationDecision({
                lab: reviewedLab,
                ownerEmail,
                decision: status,
                reason: trimmedReason,
            });
        } catch (_) {}
    })();

    return {
        ...reviewedLab,
        reviewReason: trimmedReason,
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

    const trimmedReason = reason.trim();

    const result = await pool.query(
        `UPDATE labs
         SET approval_status = 'suspended',
             suspension_reason = $1::text,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2 AND approval_status = 'approved'
         RETURNING id, name, registration_number, email, phone,
                   approval_status, suspension_reason, updated_at`,
        [trimmedReason, labId]
    );

    if (result.rows.length === 0) {
        throw createError("Approved laboratory not found", 404);
    }

    const suspendedLab = result.rows[0];

    // Safely trigger notifications to lab owner and admin
    (async () => {
        try {
            const ownerRes = await pool.query(
                `SELECT u.email AS owner_email, l.email AS lab_email
                 FROM labs l
                 LEFT JOIN users u ON u.id = l.owner_id
                 WHERE l.id = $1`,
                [suspendedLab.id]
            );
            const ownerEmail = ownerRes.rows[0]?.owner_email || ownerRes.rows[0]?.lab_email || suspendedLab.email;
            await notifyLabSuspension({
                lab: suspendedLab,
                ownerEmail,
                reason: trimmedReason,
            });
        } catch (_) {}
    })();

    return {
        ...suspendedLab,
        suspensionReason: trimmedReason,
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

// Audit logs
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
