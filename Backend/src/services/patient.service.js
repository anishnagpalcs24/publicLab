
import { pool } from "../config/db.js";

function createError(message, statusCode) {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
}

function requireLabUser(user) {
    if (!user?.id || !user?.labId || user.role !== "lab") {
        throw createError("Laboratory access required", 403);
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

// Register a patient for the authenticated laboratory
export async function createPatient({
    fullName,
    dateOfBirth = null,
    sex = null,
    labId,
    localPatientCode,
}) {
    if (!fullName?.trim() || !labId || !localPatientCode?.trim()) {
        throw createError(
            "Patient name and lab patient code are required",
            400
        );
    }

    if (dateOfBirth && !/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) {
        throw createError("Date of birth must use YYYY-MM-DD format", 400);
    }

    if (sex && !["male", "female", "other", "unknown"].includes(sex)) {
        throw createError("Invalid sex value", 400);
    }

    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const labResult = await client.query(
            `SELECT id
             FROM labs
             WHERE id = $1 AND approval_status = 'approved'`,
            [labId]
        );

        if (labResult.rows.length === 0) {
            throw createError("Approved laboratory not found", 404);
        }

        const patientResult = await client.query(
            `INSERT INTO patients (full_name, date_of_birth, sex)
             VALUES ($1, $2, $3)
             RETURNING id, full_name, date_of_birth, sex, created_at`,
            [fullName.trim(), dateOfBirth, sex]
        );

        const patient = patientResult.rows[0];

        await client.query(
            `INSERT INTO lab_patient_refs
                (lab_id, patient_id, local_patient_code)
             VALUES ($1, $2, $3)`,
            [labId, patient.id, localPatientCode.trim()]
        );

        await client.query("COMMIT");

        return { ...patient, localPatientCode: localPatientCode.trim() };
    } catch (error) {
        await client.query("ROLLBACK");

        if (error.code === "23505") {
            throw createError(
                "This patient code is already used by the laboratory",
                409
            );
        }

        throw error;
    } finally {
        client.release();
    }
}

// Get a patient only if the patient belongs to the authenticated lab
export async function getPatientById({ patientId, user }) {
    requireLabUser(user);

    const result = await pool.query(
        `SELECT p.id, p.full_name, p.date_of_birth, p.sex,
                p.created_at, r.local_patient_code
         FROM patients p
         JOIN lab_patient_refs r ON r.patient_id = p.id
         WHERE p.id = $1 AND r.lab_id = $2`,
        [patientId, user.labId]
    );

    if (result.rows.length === 0) {
        throw createError("Patient not found", 404);
    }

    return result.rows[0];
}

// List patients registered with the authenticated lab
export async function getPatients({ user, limit = 20, offset = 0 }) {
    requireLabUser(user);

    const pagination = parsePagination(limit, offset);

    const [patientsResult, countResult] = await Promise.all([
        pool.query(
            `SELECT p.id, p.full_name, p.date_of_birth, p.sex,
                    p.created_at, r.local_patient_code
             FROM patients p
             JOIN lab_patient_refs r ON r.patient_id = p.id
             WHERE r.lab_id = $1
             ORDER BY p.created_at DESC, p.id DESC
             LIMIT $2 OFFSET $3`,
            [user.labId, pagination.limit, pagination.offset]
        ),
        pool.query(
            `SELECT COUNT(*)
             FROM lab_patient_refs
             WHERE lab_id = $1`,
            [user.labId]
        ),
    ]);

    return {
        patients: patientsResult.rows,
        pagination: {
            total: Number(countResult.rows[0].count),
            ...pagination,
        },
    };
}

// Find a patient using the lab-specific patient code
export async function getPatientByLabReference({
    user,
    localPatientCode,
}) {
    requireLabUser(user);

    if (!localPatientCode?.trim()) {
        throw createError("Patient code is required", 400);
    }

    const result = await pool.query(
        `SELECT p.id, p.full_name, p.date_of_birth, p.sex,
                p.created_at, r.local_patient_code
         FROM patients p
         JOIN lab_patient_refs r ON r.patient_id = p.id
         WHERE r.lab_id = $1 AND r.local_patient_code = $2`,
        [user.labId, localPatientCode.trim()]
    );

    if (result.rows.length === 0) {
        throw createError("Patient not found", 404);
    }

    return result.rows[0];
}
