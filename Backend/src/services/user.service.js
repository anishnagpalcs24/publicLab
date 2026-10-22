
import { pool } from "../config/db.js";

function createError(message, statusCode) {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
}

// Get the authenticated user's profile
export async function getUserProfile(userId) {
    const result = await pool.query(
        `SELECT id, full_name, email, phone, account_status,
                created_at, updated_at
         FROM users
         WHERE id = $1`,
        [userId]
    );

    if (result.rows.length === 0) {
        throw createError("User not found", 404);
    }

    return result.rows[0];
}

// Update the authenticated user's profile
export async function updateUserProfile(userId, updates) {
    const allowedFields = {
        fullName: "full_name",
        email: "email",
        phone: "phone",
    };

    const setClauses = [];
    const values = [];
    let index = 1;

    for (const [key, column] of Object.entries(allowedFields)) {
        if (updates[key] !== undefined) {
            let value = updates[key];

            if (key === "fullName") {
                value = value.trim();

                if (!value) {
                    throw createError("Full name cannot be empty", 400);
                }
            }

            if (key === "email" && value !== null) {
                value = value.trim().toLowerCase();

                if (!value) value = null;
            }

            if (key === "phone" && value !== null) {
                value = value.trim();

                if (!value) value = null;
            }

            setClauses.push(`${column} = $${index++}`);
            values.push(value);
        }
    }

    if (setClauses.length === 0) {
        throw createError("No valid profile fields provided", 400);
    }

    setClauses.push("updated_at = CURRENT_TIMESTAMP");
    values.push(userId);

    try {
        const result = await pool.query(
            `UPDATE users
             SET ${setClauses.join(", ")}
             WHERE id = $${index}
             RETURNING id, full_name, email, phone,
                       account_status, created_at, updated_at`,
            values
        );

        if (result.rows.length === 0) {
            throw createError("User not found", 404);
        }

        const user = result.rows[0];

        if (!user.email && !user.phone) {
            throw createError(
                "At least one email or phone number is required",
                400
            );
        }

        return user;
    } catch (error) {
        if (error.code === "23505") {
            throw createError(
                "That email or phone number is already registered",
                409
            );
        }

        throw error;
    }
}

// Get a user by ID (for authorized administrative use)
export async function getUserById(userId) {
    const result = await pool.query(
        `SELECT id, full_name, email, phone, account_status,
                created_at, updated_at
         FROM users
         WHERE id = $1`,
        [userId]
    );

    if (result.rows.length === 0) {
        throw createError("User not found", 404);
    }

    return result.rows[0];
}

// List users with pagination (for authorized administrative use)
export async function getUsers({ limit = 20, offset = 0 } = {}) {
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

    const [usersResult, countResult] = await Promise.all([
        pool.query(
            `SELECT id, full_name, email, phone, account_status,
                    created_at, updated_at
             FROM users
             ORDER BY created_at DESC, id DESC
             LIMIT $1 OFFSET $2`,
            [parsedLimit, parsedOffset]
        ),
        pool.query("SELECT COUNT(*) FROM users"),
    ]);

    return {
        users: usersResult.rows,
        pagination: {
            total: Number(countResult.rows[0].count),
            limit: parsedLimit,
            offset: parsedOffset,
        },
    };
}
