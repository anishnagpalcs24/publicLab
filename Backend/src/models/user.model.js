
import { pool } from "../config/db.js";

/**
 * Create a user record.
 * The controller must validate the input and hash the password first.
 */
export async function createUser({
  fullName,
  email = null,
  phone = null,
  passwordHash,
}) {
  const query = `
    INSERT INTO users (
      full_name,
      email,
      phone,
      password_hash
    )
    VALUES ($1, $2, $3, $4)
    RETURNING
      id,
      full_name,
      email,
      phone,
      account_status,
      created_at,
      updated_at;
  `;

  const values = [
    fullName,
    email,
    phone,
    passwordHash,
  ];

  const result = await pool.query(query, values);
  return result.rows[0];
}

/**
 * Find a user by email.
 * Includes password_hash for login verification.
 * Never return this full result directly to the frontend.
 */
export async function findUserByEmail(email) {
  const query = `
    SELECT
      id,
      full_name,
      email,
      phone,
      password_hash,
      account_status,
      created_at,
      updated_at
    FROM users
    WHERE email = $1;
  `;

  const result = await pool.query(query, [email]);
  return result.rows[0] ?? null;
}

/**
 * Find a user by phone.
 * Includes password_hash for login verification.
 */
export async function findUserByPhone(phone) {
  const query = `
    SELECT
      id,
      full_name,
      email,
      phone,
      password_hash,
      account_status,
      created_at,
      updated_at
    FROM users
    WHERE phone = $1;
  `;

  const result = await pool.query(query, [phone]);
  return result.rows[0] ?? null;
}

/**
 * Find a user by ID without exposing password_hash.
 */
export async function findUserById(id) {
  const query = `
    SELECT
      id,
      full_name,
      email,
      phone,
      account_status,
      created_at,
      updated_at
    FROM users
    WHERE id = $1;
  `;

  const result = await pool.query(query, [id]);
  return result.rows[0] ?? null;
}
