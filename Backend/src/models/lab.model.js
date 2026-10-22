
import { pool } from "../config/db.js";

/**
 * Create a new lab.
 * The service/controller should validate input and
 * ensure the submitting user is authorized.
 */
export async function createLab({
  name,
  registrationNumber = null,
  email = null,
  phone = null,
  description = null,
}) {
  const query = `
    INSERT INTO labs (
      name,
      registration_number,
      email,
      phone,
      description
    )
    VALUES ($1, $2, $3, $4, $5)
    RETURNING
      id,
      name,
      registration_number,
      email,
      phone,
      description,
      approval_status,
      created_at,
      updated_at;
  `;

  const values = [
    name,
    registrationNumber,
    email,
    phone,
    description,
  ];

  const result = await pool.query(query, values);

  return result.rows[0];
}

/**
 * Find a lab by its ID.
 */
export async function findLabById(id) {
  const query = `
    SELECT
      id,
      name,
      registration_number,
      email,
      phone,
      description,
      approval_status,
      created_at,
      updated_at
    FROM labs
    WHERE id = $1;
  `;

  const result = await pool.query(query, [id]);

  return result.rows[0] ?? null;
}

/**
 * Find a lab by its registered email.
 */
export async function findLabByEmail(email) {
  const query = `
    SELECT
      id,
      name,
      registration_number,
      email,
      phone,
      description,
      approval_status,
      created_at,
      updated_at
    FROM labs
    WHERE LOWER(email) = LOWER($1);
  `;

  const result = await pool.query(query, [email]);

  return result.rows[0] ?? null;
}

/**
 * List labs with pagination.
 * Admin services can use this to browse lab applications.
 */
export async function findLabs({
  limit = 20,
  offset = 0,
  approvalStatus = null,
} = {}) {
  const query = `
    SELECT
      id,
      name,
      registration_number,
      email,
      phone,
      description,
      approval_status,
      created_at,
      updated_at
    FROM labs
    WHERE ($1::VARCHAR IS NULL OR approval_status = $1)
    ORDER BY created_at DESC, id DESC
    LIMIT $2
    OFFSET $3;
  `;

  const result = await pool.query(query, [
    approvalStatus,
    limit,
    offset,
  ]);

  return result.rows;
}
