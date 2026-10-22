
import { pool } from "../config/db.js";

/**
 * Create a patient and link them to a lab.
 *
 * A lab-specific reference is used instead of assuming
 * that patient records from different labs are identical.
 *
 * The service/controller must validate the input and
 * authorize the lab before calling this function.
 */
export async function createPatient({
  fullName,
  dateOfBirth = null,
  sex = null,
  labId,
  localPatientCode,
}) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const patientQuery = `
      INSERT INTO patients (
        full_name,
        date_of_birth,
        sex
      )
      VALUES ($1, $2, $3)
      RETURNING
        id,
        full_name,
        date_of_birth,
        sex,
        created_at,
        updated_at;
    `;

    const patientResult = await client.query(patientQuery, [
      fullName,
      dateOfBirth,
      sex,
    ]);

    const patient = patientResult.rows[0];

    const referenceQuery = `
      INSERT INTO lab_patient_refs (
        lab_id,
        patient_id,
        local_patient_code
      )
      VALUES ($1, $2, $3)
      RETURNING
        lab_id,
        patient_id,
        local_patient_code,
        created_at;
    `;

    const referenceResult = await client.query(referenceQuery, [
      labId,
      patient.id,
      localPatientCode,
    ]);

    await client.query("COMMIT");

    return {
      ...patient,
      labReference: referenceResult.rows[0],
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Find a patient by ID.
 *
 * Use only after the service has verified that the
 * requester is authorized to access this patient.
 */
export async function findPatientById(patientId) {
  const query = `
    SELECT
      id,
      full_name,
      date_of_birth,
      sex,
      created_at,
      updated_at
    FROM patients
    WHERE id = $1;
  `;

  const result = await pool.query(query, [patientId]);

  return result.rows[0] ?? null;
}

/**
 * Find a patient using a lab's own patient reference.
 * The lab ID is required to prevent cross-lab lookups.
 */
export async function findPatientByLabReference({
  labId,
  localPatientCode,
}) {
  const query = `
    SELECT
      p.id,
      p.full_name,
      p.date_of_birth,
      p.sex,
      r.lab_id,
      r.local_patient_code
    FROM patients AS p
    INNER JOIN lab_patient_refs AS r
      ON r.patient_id = p.id
    WHERE r.lab_id = $1
      AND r.local_patient_code = $2;
  `;

  const result = await pool.query(query, [
    labId,
    localPatientCode,
  ]);

  return result.rows[0] ?? null;
}

/**
 * List patients associated with a particular lab.
 * Pagination values must be validated by the service.
 */
export async function findPatientsByLab({
  labId,
  limit = 20,
  offset = 0,
}) {
  const query = `
    SELECT
      p.id,
      p.full_name,
      p.date_of_birth,
      p.sex,
      r.local_patient_code,
      r.created_at AS linked_at
    FROM patients AS p
    INNER JOIN lab_patient_refs AS r
      ON r.patient_id = p.id
    WHERE r.lab_id = $1
    ORDER BY r.created_at DESC, p.id DESC
    LIMIT $2
    OFFSET $3;
  `;

  const result = await pool.query(query, [
    labId,
    limit,
    offset,
  ]);

  return result.rows;
}
