import crypto from "crypto";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { pool } from "../config/db.js";
import {
  createSession,
  findSessionById,
  rotateSessionToken,
  revokeSession,
  revokeAllUserSessions,
  createEmailOtp,
  findLatestEmailOtp,
  incrementOtpAttempts,
  markOtpUsed,
} from "../models/session.model.js";
import { sendEmail } from "./email.service.js";

function createError(message, statusCode, extra = {}) {
  const error = new Error(message);
  error.statusCode = statusCode;
  Object.assign(error, extra);
  return error;
}

function getAccessSecret() {
  const secret = process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_ACCESS_SECRET is not configured");
  }
  return secret;
}

function getRefreshSecret() {
  const secret = process.env.JWT_REFRESH_SECRET || (getAccessSecret() + "_refresh_secret");
  return secret;
}

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function generateOtp() {
  return crypto.randomInt(100000, 1000000).toString();
}

function createAccessToken(user, sessionId) {
  return jwt.sign(
    {
      sub: String(user.id),
      sessionId: String(sessionId),
      role: user.role || "patient",
      labId: user.lab_id ? Number(user.lab_id) : null,
    },
    getAccessSecret(),
    { expiresIn: process.env.JWT_EXPIRES_IN || "15m" }
  );
}

function createRefreshToken(user, sessionId) {
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
 * Register a new user and generate a verification OTP.
 */
export async function register({
  fullName,
  email = null,
  phone = null,
  password,
  role = "patient",
}) {
  const name = fullName?.trim();
  const normalizedEmail = email?.trim().toLowerCase() || null;
  const normalizedPhone = phone?.trim() || null;

  if (role === "admin") {
    throw createError("Public registration cannot assign an administrator role", 403);
  }

  const assignedRole = role === "lab" ? "lab" : "patient";

  if (!name || !password) {
    throw createError("Full name and password are required", 400);
  }

  if (!normalizedEmail && !normalizedPhone) {
    throw createError("Email or phone number is required", 400);
  }

  if (password.length < 8) {
    throw createError("Password must contain at least 8 characters", 400);
  }

  // Check existing account
  const existingUser = await pool.query(
    `SELECT id, email, email_verified, account_status
     FROM users
     WHERE ($1::text IS NOT NULL AND LOWER(email) = $1)
        OR ($2::text IS NOT NULL AND phone = $2)
     LIMIT 1`,
    [normalizedEmail, normalizedPhone]
  );

  let userId;
  const passwordHash = await bcrypt.hash(password, 12);

  if (existingUser.rows.length > 0) {
    const existing = existingUser.rows[0];

    if (existing.email_verified) {
      throw createError(
        "An account with this email or phone number already exists",
        409
      );
    }

    // Unverified existing account: update credentials and allow re-verification
    userId = existing.id;
    await pool.query(
      `UPDATE users
       SET full_name = $1,
           password_hash = $2,
           phone = COALESCE($3, phone),
           role = $4,
           updated_at = NOW()
       WHERE id = $5`,
      [name, passwordHash, normalizedPhone, assignedRole, userId]
    );
  } else {
    // New user registration
    const result = await pool.query(
      `INSERT INTO users
          (full_name, email, phone, password_hash, role, account_status, email_verified)
       VALUES ($1, $2, $3, $4, $5, 'pending', FALSE)
       RETURNING id`,
      [name, normalizedEmail, normalizedPhone, passwordHash, assignedRole]
    );
    userId = result.rows[0].id;
  }

  // Generate and store OTP if email is provided
  if (normalizedEmail) {
    const otp = generateOtp();
    const otpHash = hashToken(otp);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await createEmailOtp({
      userId,
      email: normalizedEmail,
      otpHash,
      purpose: "email_verification",
      expiresAt,
    });

    // Send email notification safely
    try {
      await sendEmail({
        to: normalizedEmail,
        subject: "PublicLab — Verify Your Email Address",
        text: `Welcome to PublicLab!\n\nYour 6-digit email verification code is: ${otp}\n\nThis code will expire in 10 minutes.`,
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
            <h2 style="color: #0284c7;">PublicLab Account Verification</h2>
            <p>Welcome to PublicLab! Please use the following code to verify your email address:</p>
            <div style="font-size: 24px; font-weight: bold; letter-spacing: 4px; padding: 12px; background: #f0f9ff; border: 1px solid #bae6fd; width: max-content; border-radius: 6px;">
              ${otp}
            </div>
            <p style="color: #64748b; font-size: 13px; margin-top: 20px;">This code expires in 10 minutes. If you did not request this, please ignore this email.</p>
          </div>
        `,
      });
    } catch (emailError) {
      if (process.env.NODE_ENV !== "test") {
        console.warn(`[Email Notification Notice] Could not send live email: ${emailError.message}. Code generated: ${otp}`);
      }
    }
  }

  return {
    email: normalizedEmail,
    requiresVerification: true,
    message: "Registration successful. Please verify the OTP sent to your email.",
  };
}

/**
 * Verify email OTP and establish authenticated session.
 */
export async function verifyEmailOtp({ email, otp, ipAddress, userAgent }) {
  if (!email || !otp) {
    throw createError("Email and OTP are required", 400);
  }

  const normalizedEmail = email.trim().toLowerCase();
  const inputOtp = String(otp).trim();

  const userResult = await pool.query(
    `SELECT id, full_name, email, phone, role, lab_id, account_status, email_verified
     FROM users
     WHERE LOWER(email) = $1
     LIMIT 1`,
    [normalizedEmail]
  );

  const user = userResult.rows[0];
  if (!user) {
    throw createError("Account not found with this email", 404);
  }

  if (user.email_verified) {
    throw createError("Email is already verified. Please proceed to login.", 400);
  }

  const latestOtp = await findLatestEmailOtp({
    email: normalizedEmail,
    purpose: "email_verification",
  });

  if (!latestOtp) {
    throw createError("No pending verification request found. Please request a new OTP.", 400);
  }

  if (new Date(latestOtp.expires_at) < new Date()) {
    throw createError("The verification code has expired. Please request a new OTP.", 400);
  }

  if (latestOtp.attempts >= 5) {
    throw createError("Maximum verification attempts exceeded. Please request a new OTP.", 400);
  }

  const inputHash = hashToken(inputOtp);
  if (latestOtp.otp_hash !== inputHash) {
    await incrementOtpAttempts(latestOtp.id);
    throw createError("Invalid verification code. Please check and try again.", 400);
  }

  // Mark OTP as used and update user status
  await markOtpUsed(latestOtp.id);
  await pool.query(
    `UPDATE users
     SET email_verified = TRUE,
         account_status = 'active',
         updated_at = NOW()
     WHERE id = $1`,
    [user.id]
  );

  user.email_verified = true;
  user.account_status = "active";

  // Create session and issue tokens
  const sessionExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const tempHash = crypto.randomBytes(32).toString("hex");

  const session = await createSession({
    userId: user.id,
    refreshTokenHash: tempHash,
    ipAddress,
    userAgent,
    expiresAt: sessionExpiresAt,
  });

  const accessToken = createAccessToken(user, session.id);
  const refreshToken = createRefreshToken(user, session.id);
  const finalRefreshHash = hashToken(refreshToken);

  await rotateSessionToken({
    sessionId: session.id,
    refreshTokenHash: finalRefreshHash,
    expiresAt: sessionExpiresAt,
    ipAddress,
    userAgent,
  });

  const safeUser = {
    id: user.id,
    fullName: user.full_name,
    email: user.email,
    phone: user.phone,
    role: user.role || "patient",
    labId: user.lab_id ? Number(user.lab_id) : null,
    accountStatus: user.account_status,
    emailVerified: true,
  };

  return {
    user: safeUser,
    accessToken,
    refreshToken,
  };
}

/**
 * Resend email verification OTP.
 */
export async function resendEmailOtp({ email }) {
  if (!email) {
    throw createError("Email is required", 400);
  }

  const normalizedEmail = email.trim().toLowerCase();

  const userResult = await pool.query(
    `SELECT id, email_verified FROM users WHERE LOWER(email) = $1 LIMIT 1`,
    [normalizedEmail]
  );

  const user = userResult.rows[0];
  if (!user) {
    throw createError("Account not found with this email", 404);
  }

  if (user.email_verified) {
    throw createError("Email is already verified. You can log in directly.", 400);
  }

  const otp = generateOtp();
  const otpHash = hashToken(otp);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  await createEmailOtp({
    userId: user.id,
    email: normalizedEmail,
    otpHash,
    purpose: "email_verification",
    expiresAt,
  });

  try {
    await sendEmail({
      to: normalizedEmail,
      subject: "PublicLab — New Verification Code",
      text: `Your new 6-digit email verification code is: ${otp}\n\nThis code expires in 10 minutes.`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h3>PublicLab Verification Code</h3>
          <p>Your new verification code is:</p>
          <div style="font-size: 22px; font-weight: bold; letter-spacing: 3px; padding: 10px; background: #f0fdf4;">
            ${otp}
          </div>
          <p>Expires in 10 minutes.</p>
        </div>
      `,
    });
  } catch (emailError) {
    if (process.env.NODE_ENV !== "test") {
      console.warn(`[Email Resend Notice] Could not send live email: ${emailError.message}. Code generated: ${otp}`);
    }
  }

  return {
    message: "A new verification code has been sent to your email address.",
    ...(process.env.NODE_ENV === "development" ? { devOtp: otp } : {}),
  };
}

/**
 * Log in an existing user and create a new session.
 */
export async function login({ email, phone, identifier, password, ipAddress, userAgent }) {
  if (!password) {
    throw createError("Email/phone and password are required", 400);
  }

  const emailInput = email?.trim().toLowerCase();
  const phoneInput = phone?.trim();
  const loginIdentifier = identifier?.trim();

  let result;

  if (emailInput || (loginIdentifier && loginIdentifier.includes("@"))) {
    const emailToFind = emailInput || loginIdentifier.toLowerCase();

    result = await pool.query(
      `SELECT id, full_name, email, phone, password_hash,
              role, lab_id, account_status, email_verified
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
              role, lab_id, account_status, email_verified
       FROM users
       WHERE phone = $1
       LIMIT 1`,
      [phoneToFind]
    );
  }

  const user = result.rows[0];

  if (!user) {
    throw createError("Invalid credentials", 401);
  }

  const passwordMatches = await bcrypt.compare(password, user.password_hash);
  if (!passwordMatches) {
    throw createError("Invalid credentials", 401);
  }

  // Ensure email is verified
  if (user.email && !user.email_verified) {
    throw createError(
      "Please verify your email address before logging in.",
      403,
      { requiresVerification: true, email: user.email }
    );
  }

  if (user.account_status !== "active") {
    throw createError("This account is not active", 403);
  }

  // Create active session
  const sessionExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const tempHash = crypto.randomBytes(32).toString("hex");

  const session = await createSession({
    userId: user.id,
    refreshTokenHash: tempHash,
    ipAddress,
    userAgent,
    expiresAt: sessionExpiresAt,
  });

  const accessToken = createAccessToken(user, session.id);
  const refreshToken = createRefreshToken(user, session.id);
  const finalRefreshHash = hashToken(refreshToken);

  await rotateSessionToken({
    sessionId: session.id,
    refreshTokenHash: finalRefreshHash,
    expiresAt: sessionExpiresAt,
    ipAddress,
    userAgent,
  });

  const safeUser = {
    id: user.id,
    fullName: user.full_name,
    email: user.email,
    phone: user.phone,
    role: user.role || "patient",
    labId: user.lab_id ? Number(user.lab_id) : null,
    accountStatus: user.account_status,
    emailVerified: user.email_verified,
  };

  return {
    user: safeUser,
    accessToken,
    refreshToken,
  };
}

/**
 * Rotate refresh token and issue new access token.
 * Detects token reuse and revokes all sessions on violation.
 */
export async function refreshTokens({ refreshToken, ipAddress, userAgent }) {
  if (!refreshToken) {
    throw createError("Refresh token is required", 401);
  }

  let decoded;
  try {
    decoded = jwt.verify(refreshToken, getRefreshSecret());
  } catch (err) {
    throw createError("Invalid or expired refresh token", 401);
  }

  const sessionId = decoded.sessionId;
  const userId = decoded.sub;

  const session = await findSessionById(sessionId);

  // Reuse detection: session doesn't exist, is already revoked, or expired
  if (!session || session.is_revoked || new Date(session.expires_at) < new Date()) {
    // Revoke all sessions for this user due to potential stolen token
    await revokeAllUserSessions(userId);
    throw createError("Session has been revoked or expired. All active sessions invalidated for security.", 401);
  }

  const presentedTokenHash = hashToken(refreshToken);

  // Reuse detection: token hash does not match current session state
  if (session.refresh_token_hash !== presentedTokenHash) {
    await revokeAllUserSessions(userId);
    throw createError("Invalid refresh token. Token reuse detected. All sessions invalidated.", 401);
  }

  // Verify user is still active
  const userResult = await pool.query(
    `SELECT id, full_name, email, phone, role, lab_id, account_status, email_verified
     FROM users
     WHERE id = $1`,
    [userId]
  );

  const user = userResult.rows[0];
  if (!user || user.account_status !== "active") {
    await revokeSession(sessionId);
    throw createError("User account is inactive or disabled", 403);
  }

  // Rotate tokens
  const newSessionExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const newAccessToken = createAccessToken(user, session.id);
  const newRefreshToken = createRefreshToken(user, session.id);
  const newRefreshHash = hashToken(newRefreshToken);

  const updatedSession = await rotateSessionToken({
    sessionId: session.id,
    refreshTokenHash: newRefreshHash,
    expiresAt: newSessionExpiresAt,
    ipAddress,
    userAgent,
  });

  if (!updatedSession) {
    throw createError("Failed to rotate session. Please log in again.", 401);
  }

  return {
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
  };
}

/**
 * Log out current session.
 */
export async function logout({ sessionId, refreshToken }) {
  if (sessionId) {
    await revokeSession(sessionId);
  } else if (refreshToken) {
    try {
      const decoded = jwt.verify(refreshToken, getRefreshSecret());
      if (decoded.sessionId) {
        await revokeSession(decoded.sessionId);
      }
    } catch {
      // Invalid token, nothing to revoke
    }
  }

  return { message: "Logged out successfully" };
}

/**
 * Log out all active sessions for a user.
 */
export async function logoutAll(userId) {
  if (!userId) {
    throw createError("User ID is required to revoke all sessions", 400);
  }

  await revokeAllUserSessions(userId);
  return { message: "All sessions have been revoked successfully" };
}

/**
 * Initiate forgot password process by sending an OTP to user's email.
 */
export async function forgotPassword({ email }) {
  if (!email) {
    throw createError("Email is required", 400);
  }

  const normalizedEmail = email.trim().toLowerCase();

  const userResult = await pool.query(
    `SELECT id, email, full_name, account_status
     FROM users
     WHERE LOWER(email) = $1
     LIMIT 1`,
    [normalizedEmail]
  );

  const user = userResult.rows[0];

  // Prevent email enumeration: return consistent success message even if email not found
  if (!user || user.account_status !== "active") {
    return {
      message: "If an account with that email exists, a password reset code has been sent.",
    };
  }

  const otp = generateOtp();
  const otpHash = hashToken(otp);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  await createEmailOtp({
    userId: user.id,
    email: normalizedEmail,
    otpHash,
    purpose: "password_reset",
    expiresAt,
  });

  try {
    await sendEmail({
      to: normalizedEmail,
      subject: "PublicLab — Password Reset Request",
      text: `Hello ${user.full_name},\n\nYou requested a password reset. Your 6-digit reset code is: ${otp}\n\nThis code expires in 10 minutes.\nIf you did not request this, please ignore this email.`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
          <h2 style="color: #dc2626;">PublicLab Password Reset</h2>
          <p>Hello ${user.full_name},</p>
          <p>We received a request to reset your password. Use the code below to complete the reset:</p>
          <div style="font-size: 24px; font-weight: bold; letter-spacing: 4px; padding: 12px; background: #fef2f2; border: 1px solid #fecaca; width: max-content; border-radius: 6px; color: #b91c1c;">
            ${otp}
          </div>
          <p style="color: #64748b; font-size: 13px; margin-top: 20px;">This code expires in 10 minutes. If you did not request this, your account remains secure.</p>
        </div>
      `,
    });
  } catch (emailError) {
    if (process.env.NODE_ENV !== "test") {
      console.warn(`[Password Reset Notice] Could not send live email: ${emailError.message}. Code generated: ${otp}`);
    }
  }

  return {
    message: "If an account with that email exists, a password reset code has been sent.",
  };
}

/**
 * Reset password using email OTP verification.
 */
export async function resetPassword({ email, otp, newPassword }) {
  if (!email || !otp || !newPassword) {
    throw createError("Email, verification code, and new password are required", 400);
  }

  if (newPassword.length < 8) {
    throw createError("New password must contain at least 8 characters", 400);
  }

  const normalizedEmail = email.trim().toLowerCase();
  const inputOtp = String(otp).trim();

  const userResult = await pool.query(
    `SELECT id, account_status
     FROM users
     WHERE LOWER(email) = $1
     LIMIT 1`,
    [normalizedEmail]
  );

  const user = userResult.rows[0];
  if (!user) {
    throw createError("Invalid or expired reset code", 400);
  }

  const latestOtp = await findLatestEmailOtp({
    email: normalizedEmail,
    purpose: "password_reset",
  });

  if (!latestOtp) {
    throw createError("No pending password reset request found. Please request a new code.", 400);
  }

  if (new Date(latestOtp.expires_at) < new Date()) {
    throw createError("Password reset code has expired. Please request a new code.", 400);
  }

  if (latestOtp.attempts >= 5) {
    throw createError("Maximum verification attempts exceeded. Please request a new code.", 400);
  }

  const inputHash = hashToken(inputOtp);
  if (latestOtp.otp_hash !== inputHash) {
    await incrementOtpAttempts(latestOtp.id);
    throw createError("Invalid verification code. Please check and try again.", 400);
  }

  // Mark OTP used
  await markOtpUsed(latestOtp.id);

  // Hash new password and update
  const newPasswordHash = await bcrypt.hash(newPassword, 12);
  await pool.query(
    `UPDATE users
     SET password_hash = $1,
         updated_at = NOW()
     WHERE id = $2`,
    [newPasswordHash, user.id]
  );

  // Invalidate all existing sessions on password reset for security
  await revokeAllUserSessions(user.id);

  return {
    message: "Password reset successful. All active sessions have been signed out. Please log in with your new password.",
  };
}

/**
 * Change password for currently authenticated user.
 */
export async function changePassword({ userId, currentPassword, newPassword }) {
  if (!currentPassword || !newPassword) {
    throw createError("Current password and new password are required", 400);
  }

  if (newPassword.length < 8) {
    throw createError("New password must contain at least 8 characters", 400);
  }

  if (currentPassword === newPassword) {
    throw createError("New password must be different from your current password", 400);
  }

  const userResult = await pool.query(
    `SELECT id, password_hash
     FROM users
     WHERE id = $1
     LIMIT 1`,
    [userId]
  );

  const user = userResult.rows[0];
  if (!user) {
    throw createError("User account not found", 404);
  }

  const matches = await bcrypt.compare(currentPassword, user.password_hash);
  if (!matches) {
    throw createError("Current password is incorrect", 400);
  }

  const newHash = await bcrypt.hash(newPassword, 12);
  await pool.query(
    `UPDATE users
     SET password_hash = $1,
         updated_at = NOW()
     WHERE id = $2`,
    [newHash, userId]
  );

  return {
    message: "Password changed successfully.",
  };
}

