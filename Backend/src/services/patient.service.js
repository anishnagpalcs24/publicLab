import { pool } from "../config/db.js";

function createError(message, statusCode) {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
}

function requireLabUser(user) {
    if (!user?.id || !user?.labId) {
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
    phone = null,
    email = null,
    address = null,
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
            `INSERT INTO patients (full_name, date_of_birth, sex, phone, email, address)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING id, full_name, date_of_birth, sex, phone, email, address, created_at`,
            [
                fullName.trim(),
                dateOfBirth,
                sex,
                phone?.trim() || null,
                email?.trim().toLowerCase() || null,
                address?.trim() || null,
            ]
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
        `SELECT p.id, p.full_name, p.date_of_birth, p.sex, p.phone, p.email, p.address,
                p.created_at, p.updated_at, r.local_patient_code
         FROM patients p
         JOIN lab_patient_refs r ON r.patient_id = p.id
         WHERE p.id = $1 AND r.lab_id = $2`,
        [patientId, user.labId]
    );

    if (result.rows.length === 0) {
        throw createError("Patient not found", 404);
    }

    const patient = result.rows[0];

    // Get order, report, and calculation counts
    const [ordersCount, reportsCount, calcCount] = await Promise.all([
        pool.query(
            `SELECT COUNT(*) FROM orders WHERE patient_id = $1 AND lab_id = $2`,
            [patientId, user.labId]
        ),
        pool.query(
            `SELECT COUNT(*) FROM reports WHERE patient_id = $1 AND lab_id = $2`,
            [patientId, user.labId]
        ),
        pool.query(
            `SELECT COUNT(*) FROM clinical_calculations WHERE patient_id = $1 AND lab_id = $2`,
            [patientId, user.labId]
        ),
    ]);

    return {
        ...patient,
        stats: {
            totalOrders: Number(ordersCount.rows[0].count),
            totalReports: Number(reportsCount.rows[0].count),
            totalCalculations: Number(calcCount.rows[0].count),
        },
    };
}

// List patients registered with the authenticated lab with search and pagination
export async function getPatients({ user, search, limit = 20, offset = 0 }) {
    requireLabUser(user);

    const pagination = parsePagination(limit, offset);
    const searchTerm = search?.trim() || null;

    const values = [user.labId, searchTerm, pagination.limit, pagination.offset];

    const [patientsResult, countResult] = await Promise.all([
        pool.query(
            `SELECT p.id, p.full_name, p.date_of_birth, p.sex, p.phone, p.email,
                    p.created_at, r.local_patient_code
             FROM patients p
             JOIN lab_patient_refs r ON r.patient_id = p.id
             WHERE r.lab_id = $1
               AND (
                 $2::text IS NULL
                 OR p.full_name ILIKE '%' || $2 || '%'
                 OR p.phone ILIKE '%' || $2 || '%'
                 OR r.local_patient_code ILIKE '%' || $2 || '%'
               )
             ORDER BY p.created_at DESC, p.id DESC
             LIMIT $3 OFFSET $4`,
            values
        ),
        pool.query(
            `SELECT COUNT(*)
             FROM patients p
             JOIN lab_patient_refs r ON r.patient_id = p.id
             WHERE r.lab_id = $1
               AND (
                 $2::text IS NULL
                 OR p.full_name ILIKE '%' || $2 || '%'
                 OR p.phone ILIKE '%' || $2 || '%'
                 OR r.local_patient_code ILIKE '%' || $2 || '%'
               )`,
            [user.labId, searchTerm]
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
        `SELECT p.id, p.full_name, p.date_of_birth, p.sex, p.phone, p.email, p.address,
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

// Update permitted patient details
export async function updatePatient({ patientId, user, updates = {} }) {
    requireLabUser(user);

    // Verify patient belongs to authenticated lab
    const check = await pool.query(
        `SELECT id FROM lab_patient_refs WHERE patient_id = $1 AND lab_id = $2`,
        [patientId, user.labId]
    );

    if (check.rows.length === 0) {
        throw createError("Patient not found", 404);
    }

    const allowedFields = {
        fullName: "full_name",
        dateOfBirth: "date_of_birth",
        sex: "sex",
        phone: "phone",
        email: "email",
        address: "address",
    };

    const setClauses = [];
    const values = [];
    let index = 1;

    for (const [key, column] of Object.entries(allowedFields)) {
        if (updates[key] !== undefined) {
            let val = updates[key];
            if (typeof val === "string") val = val.trim();

            if (key === "fullName" && !val) {
                throw createError("Patient name cannot be empty", 400);
            }
            if (key === "dateOfBirth" && val && !/^\d{4}-\d{2}-\d{2}$/.test(val)) {
                throw createError("Date of birth must use YYYY-MM-DD format", 400);
            }
            if (key === "sex" && val && !["male", "female", "other", "unknown"].includes(val)) {
                throw createError("Invalid sex value", 400);
            }
            if (key === "email" && val) {
                val = val.toLowerCase();
            }

            setClauses.push(`${column} = $${index++}`);
            values.push(val || null);
        }
    }

    if (setClauses.length === 0) {
        throw createError("No valid patient fields provided to update", 400);
    }

    setClauses.push("updated_at = NOW()");
    values.push(patientId);

    const result = await pool.query(
        `UPDATE patients
         SET ${setClauses.join(", ")}
         WHERE id = $${index}
         RETURNING id, full_name, date_of_birth, sex, phone, email, address, updated_at`,
        values
    );

    return result.rows[0];
}

// List saved clinical calculations for a specific patient within the authenticated lab
export async function getPatientCalculations({ patientId, user, limit = 20, offset = 0 }) {
    requireLabUser(user);

    const pagination = parsePagination(limit, offset);

    // Verify patient belongs to authenticated lab
    const check = await pool.query(
        `SELECT id FROM lab_patient_refs WHERE patient_id = $1 AND lab_id = $2`,
        [patientId, user.labId]
    );

    if (check.rows.length === 0) {
        throw createError("Patient not found", 404);
    }

    const [calculationsResult, countResult] = await Promise.all([
        pool.query(
            `SELECT id, lab_id, patient_id, created_by, calculator_type,
                    formula_name, input_parameters, result_value, result_unit,
                    interpretation, clinical_notes, created_at
             FROM clinical_calculations
             WHERE patient_id = $1 AND lab_id = $2
             ORDER BY created_at DESC, id DESC
             LIMIT $3 OFFSET $4`,
            [patientId, user.labId, pagination.limit, pagination.offset]
        ),
        pool.query(
            `SELECT COUNT(*)
             FROM clinical_calculations
             WHERE patient_id = $1 AND lab_id = $2`,
            [patientId, user.labId]
        ),
    ]);

    return {
        calculations: calculationsResult.rows,
        pagination: {
            total: Number(countResult.rows[0].count),
            ...pagination,
        },
    };
}

