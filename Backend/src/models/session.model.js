import { pool } from "../config/db.js";

/**
 * Create a new authentication session.
 */
export async function createSession({
  userId,
  refreshTokenHash,
  ipAddress = null,
  userAgent = null,
  expiresAt,
}) {
  const query = `
    INSERT INTO auth_sessions (
      user_id,
      refresh_token_hash,
      ip_address,
      user_agent,
      expires_at
    )
    VALUES ($1, $2, $3, $4, $5)
    RETURNING
      id,
      user_id,
      refresh_token_hash,
      ip_address,
      user_agent,
      expires_at,
      is_revoked,
      created_at,
      updated_at;
  `;

  const values = [
    userId,
    refreshTokenHash,
    ipAddress,
    userAgent,
    expiresAt,
  ];

  const result = await pool.query(query, values);
  return result.rows[0];
}

/**
 * Find session by primary key ID.
 */
export async function findSessionById(sessionId) {
  const query = `
    SELECT
      id,
      user_id,
      refresh_token_hash,
      ip_address,
      user_agent,
      expires_at,
      is_revoked,
      revoked_at,
      created_at,
      updated_at
    FROM auth_sessions
    WHERE id = $1;
  `;

  const result = await pool.query(query, [sessionId]);
  return result.rows[0] ?? null;
}

/**
 * Atomically rotate refresh token hash and update session activity.
 */
export async function rotateSessionToken({
  sessionId,
  refreshTokenHash,
  expiresAt,
  ipAddress = null,
  userAgent = null,
}) {
  const query = `
    UPDATE auth_sessions
    SET
      refresh_token_hash = $2,
      expires_at = $3,
      ip_address = COALESCE($4, ip_address),
      user_agent = COALESCE($5, user_agent),
      updated_at = NOW()
    WHERE id = $1 AND is_revoked = FALSE
    RETURNING
      id,
      user_id,
      refresh_token_hash,
      ip_address,
      user_agent,
      expires_at,
      is_revoked,
      updated_at;
  `;

  const values = [
    sessionId,
    refreshTokenHash,
    expiresAt,
    ipAddress,
    userAgent,
  ];

  const result = await pool.query(query, values);
  return result.rows[0] ?? null;
}

/**
 * Revoke a specific session (Logout).
 */
export async function revokeSession(sessionId) {
  const query = `
    UPDATE auth_sessions
    SET
      is_revoked = TRUE,
      revoked_at = NOW(),
      updated_at = NOW()
    WHERE id = $1 AND is_revoked = FALSE
    RETURNING id, user_id, is_revoked, revoked_at;
  `;

  const result = await pool.query(query, [sessionId]);
  return result.rows[0] ?? null;
}

/**
 * Revoke all active sessions for a user (Logout-all / Reuse detected).
 */
export async function revokeAllUserSessions(userId) {
  const query = `
    UPDATE auth_sessions
    SET
      is_revoked = TRUE,
      revoked_at = NOW(),
      updated_at = NOW()
    WHERE user_id = $1 AND is_revoked = FALSE
    RETURNING id;
  `;

  const result = await pool.query(query, [userId]);
  return result.rows;
}

/**
 * Create a new email OTP challenge.
 */
export async function createEmailOtp({
  userId = null,
  email,
  otpHash,
  purpose = "email_verification",
  expiresAt,
}) {
  const query = `
    INSERT INTO email_otps (
      user_id,
      email,
      otp_hash,
      purpose,
      expires_at
    )
    VALUES ($1, $2, $3, $4, $5)
    RETURNING
      id,
      user_id,
      email,
      purpose,
      expires_at,
      created_at;
  `;

  const values = [
    userId ?? null,
    email.toLowerCase().trim(),
    otpHash,
    purpose,
    expiresAt,
  ];

  const result = await pool.query(query, values);
  return result.rows[0];
}

/**
 * Invalidate previous unused OTPs for an email and purpose.
 */
export async function invalidatePreviousOtps({ email, userId = null, purpose }) {
  const query = `
    UPDATE email_otps
    SET is_used = TRUE
    WHERE (LOWER(email) = LOWER($1) OR ($2::bigint IS NOT NULL AND user_id = $2::bigint))
      AND purpose = $3
      AND is_used = FALSE;
  `;

  await pool.query(query, [email ? email.trim() : "", userId, purpose]);
}

/**
 * Find the latest active, unused OTP for an email and purpose.
 */
export async function findLatestEmailOtp({
  email,
  purpose = "email_verification",
}) {
  const query = `
    SELECT
      id,
      user_id,
      email,
      otp_hash,
      purpose,
      expires_at,
      attempts,
      is_used,
      created_at
    FROM email_otps
    WHERE LOWER(email) = LOWER($1)
      AND purpose = $2
      AND is_used = FALSE
    ORDER BY created_at DESC, id DESC
    LIMIT 1;
  `;

  const result = await pool.query(query, [email.trim(), purpose]);
  return result.rows[0] ?? null;
}

/**
 * Increment failed attempt count for an OTP.
 */
export async function incrementOtpAttempts(otpId) {
  const query = `
    UPDATE email_otps
    SET attempts = attempts + 1
    WHERE id = $1
    RETURNING id, attempts;
  `;

  const result = await pool.query(query, [otpId]);
  return result.rows[0] ?? null;
}

/**
 * Mark an OTP as successfully used.
 */
export async function markOtpUsed(otpId) {
  const query = `
    UPDATE email_otps
    SET is_used = TRUE
    WHERE id = $1
    RETURNING id, is_used;
  `;

  const result = await pool.query(query, [otpId]);
  return result.rows[0] ?? null;
}

