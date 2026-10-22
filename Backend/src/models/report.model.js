
import { pool } from "../config/db.js";

// Create a report record
export async function createReport({
    orderId,
    patientId,
    labId,
    storageProvider,
    storageKey,
    originalFilename,
    mimeType = "application/pdf",
    fileSizeBytes,
    uploadedBy,
}) {
    const query = `
        INSERT INTO public.reports (
            order_id,
            patient_id,
            lab_id,
            storage_provider,
            storage_key,
            original_filename,
            mime_type,
            file_size_bytes,
            uploaded_by
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
    `;

    const values = [
        orderId,
        patientId,
        labId,
        storageProvider,
        storageKey,
        originalFilename,
        mimeType,
        fileSizeBytes,
        uploadedBy ?? null,
    ];

    const result = await pool.query(query, values);
    return result.rows[0];
}


// Find report by ID
export async function findReportById(reportId) {
    const query = `
        SELECT *
        FROM public.reports
        WHERE id = $1
    `;

    const result = await pool.query(query, [reportId]);
    return result.rows[0] ?? null;
}


// Find reports belonging to a patient
export async function findReportsByPatient({
    patientId,
    limit = 20,
    offset = 0,
}) {
    const query = `
        SELECT *
        FROM public.reports
        WHERE patient_id = $1
          AND report_status IN ('published', 'corrected')
        ORDER BY created_at DESC, id DESC
        LIMIT $2 OFFSET $3
    `;

    const result = await pool.query(query, [
        patientId,
        limit,
        offset,
    ]);

    return result.rows;
}


// Find reports belonging to a laboratory
export async function findReportsByLab({
    labId,
    limit = 20,
    offset = 0,
}) {
    const query = `
        SELECT *
        FROM public.reports
        WHERE lab_id = $1
        ORDER BY created_at DESC, id DESC
        LIMIT $2 OFFSET $3
    `;

    const result = await pool.query(query, [
        labId,
        limit,
        offset,
    ]);

    return result.rows;
}


// Publish a draft report
export async function publishReport(reportId) {
    const query = `
        UPDATE public.reports
        SET report_status = 'published',
            published_at = NOW(),
            updated_at = NOW()
        WHERE id = $1
          AND report_status = 'draft'
        RETURNING *
    `;

    const result = await pool.query(query, [reportId]);
    return result.rows[0] ?? null;
}


// Add a new report version
export async function createReportVersion({
    reportId,
    versionNumber,
    storageProvider,
    storageKey,
    originalFilename,
    mimeType = "application/pdf",
    fileSizeBytes,
    changeReason,
    uploadedBy,
}) {
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        // Lock the report while creating its version.
        const reportResult = await client.query(
            `SELECT id, report_status
             FROM public.reports
             WHERE id = $1
             FOR UPDATE`,
            [reportId]
        );

        const report = reportResult.rows[0];

        if (!report) {
            const error = new Error("Report not found");
            error.statusCode = 404;
            throw error;
        }

        if (report.report_status === "voided") {
            const error = new Error(
                "Cannot add a version to a voided report"
            );
            error.statusCode = 409;
            throw error;
        }

        const versionResult = await client.query(
            `INSERT INTO public.report_versions (
                report_id,
                version_number,
                storage_provider,
                storage_key,
                original_filename,
                mime_type,
                file_size_bytes,
                change_reason,
                uploaded_by
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING *`,
            [
                reportId,
                versionNumber,
                storageProvider,
                storageKey,
                originalFilename,
                mimeType,
                fileSizeBytes,
                changeReason ?? null,
                uploadedBy ?? null,
            ]
        );

        await client.query(
            `UPDATE public.reports
             SET report_status = CASE
                    WHEN report_status = 'published'
                    THEN 'corrected'
                    ELSE report_status
                 END,
                 updated_at = NOW()
             WHERE id = $1`,
            [reportId]
        );

        await client.query("COMMIT");

        return versionResult.rows[0];
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
}
