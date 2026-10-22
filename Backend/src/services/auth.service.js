

import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { pool } from "../config/db.js";

function createError(message, statusCode) {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
}

function createAccessToken(user) {
    const secret = process.env.JWT_SECRET;

    if (!secret) {
        throw new Error("JWT_SECRET is not configured");
    }

    return jwt.sign(
        { sub: String(user.id) },
        secret,
        { expiresIn: process.env.JWT_EXPIRES_IN || "15m" }
    );
}

// Register a new user
export async function register({
    fullName,
    email = null,
    phone = null,
    password,
}) {
    const name = fullName?.trim();
    const normalizedEmail = email?.trim().toLowerCase() || null;
    const normalizedPhone = phone?.trim() || null;

    if (!name || !password) {
        throw createError("Full name and password are required", 400);
    }

    if (!normalizedEmail && !normalizedPhone) {
        throw createError("Email or phone number is required", 400);
    }

    if (password.length < 8) {
        throw createError(
            "Password must contain at least 8 characters",
            400
        );
    }

    const existingUser = await pool.query(
        `SELECT id
         FROM users
         WHERE ($1::text IS NOT NULL AND LOWER(email) = $1)
            OR ($2::text IS NOT NULL AND phone = $2)
         LIMIT 1`,
        [normalizedEmail, normalizedPhone]
    );

    if (existingUser.rows.length > 0) {
        throw createError(
            "An account with this email or phone number already exists",
            409
        );
    }

    const passwordHash = await bcrypt.hash(password, 12);

    try {
        const result = await pool.query(
            `INSERT INTO users
                (full_name, email, phone, password_hash)
             VALUES ($1, $2, $3, $4)
             RETURNING id, full_name, email, phone,
                       account_status, created_at`,
            [name, normalizedEmail, normalizedPhone, passwordHash]
        );

        const user = result.rows[0];

        return {
            user,
            accessToken: createAccessToken(user),
        };
    } catch (error) {
        // Handle duplicate email/phone conflicts safely,
        // including concurrent registration attempts.
        if (error.code === "23505") {
            throw createError(
                "An account with this email or phone number already exists",
                409
            );
        }

        throw error;
    }
}

// Log in using an email address or phone number
export async function login({ email, phone, identifier, password }) {
    if (!password) {
        throw createError("Email/phone and password are required", 400);
    }

    // If both email and phone are provided, email takes priority.
    const emailInput = email?.trim().toLowerCase();
    const phoneInput = phone?.trim();
    const loginIdentifier = identifier?.trim();

    let result;

    if (emailInput || (loginIdentifier && loginIdentifier.includes("@"))) {
        const emailToFind = emailInput || loginIdentifier.toLowerCase();

        result = await pool.query(
            `SELECT id, full_name, email, phone, password_hash,
                    account_status
             FROM users
             WHERE LOWER(email) = $1
             LIMIT 1`,
            [emailToFind]
        );
    } else {
        const phoneToFind = phoneInput || loginIdentifier;

        if (!phoneToFind) {
            throw createError("Email or phone number is required", 400);
        }

        result = await pool.query(
            `SELECT id, full_name, email, phone, password_hash,
                    account_status
             FROM users
             WHERE phone = $1
             LIMIT 1`,
            [phoneToFind]
        );
    }

    const user = result.rows[0];

    // Use the same message for an unknown account and wrong password.
    if (!user) {
        throw createError("Invalid credentials", 401);
    }

    const passwordMatches = await bcrypt.compare(
        password,
        user.password_hash
    );

    if (!passwordMatches) {
        throw createError("Invalid credentials", 401);
    }

    if (user.account_status !== "active") {
        throw createError("This account is not active", 403);
    }

    const safeUser = {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        phone: user.phone,
        account_status: user.account_status,
    };

    return {
        user: safeUser,
        accessToken: createAccessToken(safeUser),
    };
}
