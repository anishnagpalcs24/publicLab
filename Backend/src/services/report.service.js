import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";
import jwt from "jsonwebtoken";
import { pool } from "../config/db.js";
import { notifyReportPublished, sendEmail } from "./email.service.js";
import {
    createEmailOtp,
    invalidatePreviousOtps,
    findLatestEmailOtp,
    incrementOtpAttempts,
    markOtpUsed,
} from "../models/session.model.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const STORAGE_DIR = path.resolve(__dirname, "../../storage/reports");

// Ensure storage directory exists
if (!fs.existsSync(STORAGE_DIR)) {
    fs.mkdirSync(STORAGE_DIR, { recursive: true });
}

function getAccessSecret() {
    const secret = process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET;
    if (!secret) {
        throw new Error("JWT_ACCESS_SECRET is not configured");
    }
    return secret;
}

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

// Helper to save file bytes safely to private disk
async function saveReportFileToDisk({ buffer, originalFilename }) {
    const ext = path.extname(originalFilename || ".pdf") || ".pdf";
    const storageKey = `${Date.now()}-${crypto.randomBytes(16).toString("hex")}${ext}`;
    const absolutePath = path.join(STORAGE_DIR, storageKey);

    await fs.promises.writeFile(absolutePath, buffer);
    return {
        storageKey,
        absolutePath,
        fileSizeBytes: buffer.length,
    };
}

// Create a report record for an existing order with private storage
export async function createReport({
    user,
    orderId,
    patientId,
    file,
    fileData,
    filename = "report.pdf",
    mimeType = "application/pdf",
}) {
    requireLabUser(user);

    if (!orderId || !patientId) {
        throw createError("Order and patient identifiers are required", 400);
    }

    // Verify lab is approved
    const labCheck = await pool.query(
        `SELECT approval_status FROM labs WHERE id = $1`,
        [user.labId]
    );
    if (labCheck.rows.length === 0 || labCheck.rows[0].approval_status !== "approved") {
        throw createError("Approved laboratory status is required to issue reports", 403);
    }

    // Verify order exists, belongs to lab, and matches patient
    const orderCheck = await pool.query(
        `SELECT id, patient_id, order_status
         FROM orders
         WHERE id = $1 AND lab_id = $2`,
        [orderId, user.labId]
    );

    if (orderCheck.rows.length === 0) {
        throw createError("Order not found for this laboratory", 404);
    }

    if (String(orderCheck.rows[0].patient_id) !== String(patientId)) {
        throw createError("Order patient does not match provided patient identifier", 400);
    }

    // Process file content (either buffer or base64 data)
    let buffer;
    let actualFilename = filename;
    let actualMimeType = mimeType;

    if (file && file.buffer) {
        buffer = file.buffer;
        actualFilename = file.originalname || filename;
        actualMimeType = file.mimetype || mimeType;
    } else if (fileData) {
        // Handle base64 encoded string
        const cleanBase64 = fileData.includes(",") ? fileData.split(",")[1] : fileData;
        buffer = Buffer.from(cleanBase64, "base64");
    } else {
        throw createError("Report file content is required (PDF or base64 document)", 400);
    }

    if (buffer.length === 0) {
        throw createError("Uploaded report file cannot be empty", 400);
    }

    // Max 15 MB
    if (buffer.length > 15 * 1024 * 1024) {
        throw createError("Report file size exceeds the 15 MB maximum limit", 400);
    }

    // Save to private disk
    const saved = await saveReportFileToDisk({
        buffer,
        originalFilename: actualFilename,
    });

    const result = await pool.query(
        `INSERT INTO reports
            (order_id, patient_id, lab_id, storage_provider, storage_key,
             filename, original_filename, mime_type, file_size, file_size_bytes,
             status, report_status, uploaded_by)
         VALUES ($1, $2, $3, 'local', $4, $5, $6, $7, $8, $9, 'draft', 'draft', $10)
         RETURNING id, order_id, patient_id, lab_id, storage_provider,
                   original_filename, mime_type, file_size_bytes, status,
                   report_status, uploaded_by, created_at, updated_at`,
        [
            orderId,
            patientId,
            user.labId,
            saved.storageKey,
            actualFilename,
            actualFilename,
            actualMimeType,
            saved.fileSizeBytes,
            saved.fileSizeBytes,
            user.id,
        ]
    );

    return result.rows[0];
}

// Get a report if the authenticated lab owns it (or if admin)
export async function getReportById({ reportId, user }) {
    if (!user?.id) {
        throw createError("Authentication required", 401);
    }

    let query;
    let values;

    if (user.role === "admin") {
        query = `
            SELECT r.id, r.order_id, r.patient_id, r.lab_id, r.storage_provider,
                   r.original_filename, r.mime_type, r.file_size_bytes,
                   COALESCE(r.status, r.report_status) AS status,
                   r.uploaded_by, r.published_at, r.created_at, r.updated_at,
                   p.full_name AS patient_name,
                   l.name AS lab_name
            FROM reports r
            JOIN patients p ON p.id = r.patient_id
            JOIN labs l ON l.id = r.lab_id
            WHERE r.id = $1`;
        values = [reportId];
    } else {
        requireLabUser(user);
        query = `
            SELECT r.id, r.order_id, r.patient_id, r.lab_id, r.storage_provider,
                   r.original_filename, r.mime_type, r.file_size_bytes,
                   COALESCE(r.status, r.report_status) AS status,
                   r.uploaded_by, r.published_at, r.created_at, r.updated_at,
                   p.full_name AS patient_name,
                   l.name AS lab_name
            FROM reports r
            JOIN patients p ON p.id = r.patient_id
            JOIN labs l ON l.id = r.lab_id
            WHERE r.id = $1 AND r.lab_id = $2`;
        values = [reportId, user.labId];
    }

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
        throw createError("Report not found", 404);
    }

    // Fetch report versions history
    const versions = await pool.query(
        `SELECT id, version_number, storage_provider, original_filename,
                mime_type, file_size_bytes, change_reason, created_at
         FROM report_versions
         WHERE report_id = $1
         ORDER BY version_number ASC`,
        [reportId]
    );

    return {
        ...result.rows[0],
        versions: versions.rows,
    };
}

// List reports for the authenticated laboratory
export async function getLabReports({
    user,
    status,
    limit = 20,
    offset = 0,
}) {
    requireLabUser(user);

    const pagination = parsePagination(limit, offset);
    const allowedStatuses = ["draft", "published", "corrected", "voided"];

    if (status && !allowedStatuses.includes(status)) {
        throw createError("Invalid report status filter", 400);
    }

    const result = await pool.query(
        `SELECT r.id, r.order_id, r.patient_id, r.lab_id,
                r.original_filename, r.mime_type, r.file_size_bytes,
                COALESCE(r.status, r.report_status) AS status,
                r.published_at, r.created_at, r.updated_at,
                p.full_name AS patient_name
         FROM reports r
         JOIN patients p ON p.id = r.patient_id
         WHERE r.lab_id = $1
           AND ($2::text IS NULL OR COALESCE(r.status, r.report_status) = $2)
         ORDER BY r.created_at DESC, r.id DESC
         LIMIT $3 OFFSET $4`,
        [user.labId, status || null, pagination.limit, pagination.offset]
    );

    const countResult = await pool.query(
        `SELECT COUNT(*) FROM reports
         WHERE lab_id = $1
           AND ($2::text IS NULL OR COALESCE(status, report_status) = $2)`,
        [user.labId, status || null]
    );

    return {
        reports: result.rows,
        pagination: {
            total: Number(countResult.rows[0].count),
            ...pagination,
        },
    };
}

// List reports for a patient associated with the authenticated lab
export async function getPatientReports({
    patientId,
    user,
    limit = 20,
    offset = 0,
}) {
    requireLabUser(user);

    const pagination = parsePagination(limit, offset);

    const patientResult = await pool.query(
        `SELECT id FROM lab_patient_refs
         WHERE patient_id = $1 AND lab_id = $2`,
        [patientId, user.labId]
    );

    if (patientResult.rows.length === 0) {
        throw createError("Patient not found", 404);
    }

    const result = await pool.query(
        `SELECT r.id, r.order_id, r.patient_id, r.lab_id,
                r.original_filename, r.mime_type, r.file_size_bytes,
                COALESCE(r.status, r.report_status) AS status,
                r.published_at, r.created_at
         FROM reports r
         WHERE r.patient_id = $1 AND r.lab_id = $2
         ORDER BY r.created_at DESC, r.id DESC
         LIMIT $3 OFFSET $4`,
        [patientId, user.labId, pagination.limit, pagination.offset]
    );

    const countResult = await pool.query(
        `SELECT COUNT(*) FROM reports
         WHERE patient_id = $1 AND lab_id = $2`,
        [patientId, user.labId]
    );

    return {
        reports: result.rows,
        pagination: {
            total: Number(countResult.rows[0].count),
            ...pagination,
        },
    };
}

// Publish a draft report
export async function publishReport({ reportId, user }) {
    requireLabUser(user);

    const result = await pool.query(
        `UPDATE reports
         SET status = 'published',
             report_status = 'published',
             published_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1
           AND lab_id = $2
           AND (status = 'draft' OR report_status = 'draft')
         RETURNING id, order_id, patient_id, lab_id, status,
                   report_status, published_at, updated_at`,
        [reportId, user.labId]
    );

    if (result.rows.length === 0) {
        throw createError(
            "Draft report not found or cannot be published",
            404
        );
    }

    const published = result.rows[0];

    // Safely trigger notifications to patient and admin
    (async () => {
        try {
            const info = await pool.query(
                `SELECT p.full_name AS patient_name, p.email AS patient_email,
                        l.name AS lab_name
                 FROM reports r
                 JOIN patients p ON p.id = r.patient_id
                 JOIN labs l ON l.id = r.lab_id
                 WHERE r.id = $1`,
                [published.id]
            );
            if (info.rows.length > 0) {
                const row = info.rows[0];
                await notifyReportPublished({
                    report: published,
                    patient: { full_name: row.patient_name, email: row.patient_email },
                    lab: { name: row.lab_name },
                    isCorrected: false,
                });
            }
        } catch (_) {}
    })();

    return published;
}

// Upload a corrected version of a report
export async function correctReport({
    reportId,
    user,
    file,
    fileData,
    filename = "corrected_report.pdf",
    mimeType = "application/pdf",
    reason,
}) {
    requireLabUser(user);

    if (!reason?.trim()) {
        throw createError("Correction reason is required", 400);
    }

    let buffer;
    let actualFilename = filename;
    let actualMimeType = mimeType;

    if (file && file.buffer) {
        buffer = file.buffer;
        actualFilename = file.originalname || filename;
        actualMimeType = file.mimetype || mimeType;
    } else if (fileData) {
        const cleanBase64 = fileData.includes(",") ? fileData.split(",")[1] : fileData;
        buffer = Buffer.from(cleanBase64, "base64");
    } else {
        throw createError("Corrected report file is required", 400);
    }

    if (buffer.length === 0) {
        throw createError("Corrected file cannot be empty", 400);
    }

    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        const reportResult = await client.query(
            `SELECT id, lab_id, storage_key, original_filename, status, report_status
             FROM reports
             WHERE id = $1 AND lab_id = $2
             FOR UPDATE`,
            [reportId, user.labId]
        );

        if (reportResult.rows.length === 0) {
            throw createError("Report not found", 404);
        }

        const report = reportResult.rows[0];

        // Count existing versions
        const versionCountResult = await client.query(
            `SELECT COUNT(*) FROM report_versions WHERE report_id = $1`,
            [reportId]
        );
        const versionNumber = Number(versionCountResult.rows[0].count) + 1;

        // Save new file to private disk
        const saved = await saveReportFileToDisk({
            buffer,
            originalFilename: actualFilename,
        });

        // Archive version record
        await client.query(
            `INSERT INTO report_versions
                (report_id, version_number, storage_provider, storage_key,
                 original_filename, mime_type, file_size_bytes, change_reason, uploaded_by)
             VALUES ($1, $2, 'local', $3, $4, $5, $6, $7, $8)`,
            [
                reportId,
                versionNumber,
                saved.storageKey,
                actualFilename,
                actualMimeType,
                saved.fileSizeBytes,
                reason.trim(),
                user.id,
            ]
        );

        // Update the primary report record to point to corrected version
        const updateResult = await client.query(
            `UPDATE reports
             SET storage_key = $1,
                 filename = $2,
                 original_filename = $2,
                 mime_type = $3,
                 file_size = $4,
                 file_size_bytes = $4,
                 status = 'corrected',
                 report_status = 'corrected',
                 updated_at = NOW()
             WHERE id = $5
             RETURNING id, order_id, patient_id, lab_id, status, report_status,
                       original_filename, file_size_bytes, updated_at`,
            [saved.storageKey, actualFilename, actualMimeType, saved.fileSizeBytes, reportId]
        );

        await client.query("COMMIT");

        const corrected = updateResult.rows[0];

        // Safely trigger notifications to patient and admin
        (async () => {
            try {
                const info = await pool.query(
                    `SELECT p.full_name AS patient_name, p.email AS patient_email,
                            l.name AS lab_name
                     FROM reports r
                     JOIN patients p ON p.id = r.patient_id
                     JOIN labs l ON l.id = r.lab_id
                     WHERE r.id = $1`,
                    [reportId]
                );
                if (info.rows.length > 0) {
                    const row = info.rows[0];
                    await notifyReportPublished({
                        report: corrected,
                        patient: { full_name: row.patient_name, email: row.patient_email },
                        lab: { name: row.lab_name },
                        isCorrected: true,
                        correctionReason: reason.trim(),
                    });
                }
            } catch (_) {}
        })();

        return {
            ...corrected,
            versionNumber,
            correctionReason: reason.trim(),
        };
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
}

// Return secure file information after strict authorization
export async function getReportFile({ reportId, user }) {
    if (!user?.id) {
        throw createError("Authentication required", 401);
    }

    const result = await pool.query(
        `SELECT r.id, r.lab_id, r.patient_id, r.storage_provider, r.storage_key,
                r.original_filename, r.filename, r.mime_type, r.file_size_bytes,
                COALESCE(r.status, r.report_status) AS status,
                r.published_at
         FROM reports r
         WHERE r.id = $1`,
        [reportId]
    );

    if (result.rows.length === 0) {
        throw createError("Report not found", 404);
    }

    const report = result.rows[0];

    // Authorization checks:
    // 1. Admin can access any report
    // 2. Lab owner/staff can access their lab's reports
    // 3. Patient can access only if status is published/corrected and belongs to them
    const isOwnerLab = user.role === "lab" && String(user.labId) === String(report.lab_id);
    const isAdmin = user.role === "admin";
    let isAuthorizedPatient = false;

    if (user.role === "patient") {
        if (user.patientId && String(report.patient_id) === String(user.patientId)) {
            isAuthorizedPatient = true;
        } else if (user.email) {
            const patCheck = await pool.query(
                `SELECT id FROM patients WHERE id = $1 AND LOWER(email) = LOWER($2)`,
                [report.patient_id, user.email]
            );
            isAuthorizedPatient = patCheck.rows.length > 0;
        } else {
            // Check patient record association with this user (by email or phone)
            const patCheck = await pool.query(
                `SELECT p.id FROM patients p
                 JOIN users u ON (u.email = p.email OR u.phone = p.phone)
                 WHERE p.id = $1 AND u.id = $2`,
                [report.patient_id, user.id]
            );
            isAuthorizedPatient = patCheck.rows.length > 0;
        }
    }

    if (!isOwnerLab && !isAdmin && !isAuthorizedPatient) {
        throw createError("You are not authorized to download this medical report", 403);
    }

    // Only lab or admin can download unpublished draft reports
    if (!isOwnerLab && !isAdmin && (report.status === "draft" || report.status === "voided")) {
        throw createError("Report is still under preparation and has not been published yet", 403);
    }

    const absolutePath = path.join(STORAGE_DIR, report.storage_key);

    if (!fs.existsSync(absolutePath)) {
        throw createError("Report file is not available on storage server", 404);
    }

    return {
        absolutePath,
        filename: report.original_filename || report.filename || "medical_report.pdf",
        mimeType: report.mime_type || "application/pdf",
    };
}

// Request passwordless OTP for patient report access (no user account required)
export async function requestPatientReportOtp({ email }) {
    if (!email || typeof email !== "string") {
        throw createError("Patient registered email address is required", 400);
    }

    const normalizedEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
        throw createError("Invalid email address format", 400);
    }

    // Verify patient exists in the patients table
    const patientCheck = await pool.query(
        `SELECT id, full_name, email FROM patients WHERE LOWER(email) = $1 LIMIT 1`,
        [normalizedEmail]
    );

    if (patientCheck.rows.length === 0) {
        throw createError(
            "No patient record found with this email address. Please make sure you are using the email provided to your diagnostic laboratory.",
            404
        );
    }

    // Generate cryptographically secure 6-digit OTP
    const otp = crypto.randomInt(100000, 1000000).toString();
    const otpHash = crypto.createHash("sha256").update(otp).digest("hex");
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Invalidate any previous unused OTPs for patient report access for this email
    await invalidatePreviousOtps({
        email: normalizedEmail,
        userId: null,
        purpose: "patient_report_access",
    });

    // Store in email_otps table with user_id = null and purpose = 'patient_report_access'
    await createEmailOtp({
        userId: null,
        email: normalizedEmail,
        otpHash,
        purpose: "patient_report_access",
        expiresAt,
    });

    if (process.env.NODE_ENV !== "production") {
        console.log(`\n🔑 [DEV ONLY OTP] Patient Report Access OTP for ${normalizedEmail}: >>> ${otp} <<<\n`);
    }

    // Send email to patient via existing sendEmail service
    await sendEmail({
        to: normalizedEmail,
        subject: "Your PublicLab Medical Report Access Code",
        text: `Hello,\n\nYour 6-digit verification code to access your medical reports is: ${otp}\n\nThis verification code will expire in 10 minutes.\n\nPublicLab Healthcare Team`,
        html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 540px; margin: 0 auto; padding: 24px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px;">
                <h2 style="color: #0f766e; margin-top: 0;">PublicLab Medical Reports</h2>
                <p style="color: #334155; font-size: 15px; line-height: 1.6;">Hello,</p>
                <p style="color: #334155; font-size: 15px; line-height: 1.6;">You requested access to your diagnostic medical reports. Use the 6-digit verification code below to securely view and download your reports:</p>
                <div style="background-color: #f0fdfa; border: 1px dashed #0d9488; padding: 20px; text-align: center; border-radius: 12px; margin: 24px 0;">
                    <span style="font-size: 36px; font-weight: 700; letter-spacing: 6px; color: #0f766e; font-family: monospace;">${otp}</span>
                </div>
                <p style="color: #64748b; font-size: 13px;">This single-use code expires in 10 minutes. For your medical privacy, do not share this code.</p>
                <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
                <p style="color: #94a3b8; font-size: 12px;">If you did not request this verification code, please disregard this message.</p>
            </div>
        `,
    });

    const isNonProd = process.env.NODE_ENV !== "production";
    return {
        success: true,
        message: "A 6-digit verification code has been dispatched to your email address.",
        ...(isNonProd ? { devOtp: otp } : {}),
    };
}

// Verify patient report OTP and retrieve reports
export async function verifyPatientReportOtp({ email, otp }) {
    if (!email || !otp) {
        throw createError("Email and verification code are required", 400);
    }

    const normalizedEmail = email.trim().toLowerCase();
    const inputOtp = String(otp).trim();

    if (!/^\d{6}$/.test(inputOtp)) {
        throw createError("Verification code must be 6 digits", 400);
    }

    const latestOtp = await findLatestEmailOtp({
        email: normalizedEmail,
        purpose: "patient_report_access",
    });

    if (!latestOtp) {
        throw createError("No pending verification request found. Please request a new code.", 400);
    }

    if (new Date(latestOtp.expires_at) < new Date()) {
        throw createError("The verification code has expired. Please request a new code.", 400);
    }

    if (latestOtp.attempts >= 5) {
        throw createError("Maximum verification attempts exceeded. Please request a new code.", 400);
    }

    const inputHash = crypto.createHash("sha256").update(inputOtp).digest("hex");
    if (latestOtp.otp_hash !== inputHash) {
        await incrementOtpAttempts(latestOtp.id);
        throw createError("Invalid verification code. Please check and try again.", 400);
    }

    // Mark OTP as used
    await markOtpUsed(latestOtp.id);

    // Fetch patient record
    const patientResult = await pool.query(
        `SELECT id, full_name, email, phone, date_of_birth, sex
         FROM patients
         WHERE LOWER(email) = $1
         ORDER BY id DESC
         LIMIT 1`,
        [normalizedEmail]
    );

    const patient = patientResult.rows[0];
    if (!patient) {
        throw createError("Patient record not found", 404);
    }

    // Fetch published/corrected reports for this patient's email
    const reportsResult = await pool.query(
        `SELECT r.id, r.order_id, r.patient_id, r.lab_id, r.storage_provider,
                r.original_filename, r.filename, r.mime_type, r.file_size_bytes,
                COALESCE(r.status, r.report_status) AS status,
                r.published_at, r.created_at,
                l.name AS lab_name,
                p.full_name AS patient_name
         FROM reports r
         JOIN patients p ON p.id = r.patient_id
         JOIN labs l ON l.id = r.lab_id
         WHERE LOWER(p.email) = $1
           AND (r.status IN ('published', 'corrected') OR r.report_status IN ('published', 'corrected'))
         ORDER BY r.created_at DESC, r.id DESC`,
        [normalizedEmail]
    );

    // Generate signed JWT for report download authorization (valid for 2 hours)
    const accessToken = jwt.sign(
        {
            sub: String(patient.id),
            patientId: patient.id,
            email: normalizedEmail,
            role: "patient",
            type: "patient_report_access",
        },
        getAccessSecret(),
        { expiresIn: "2h" }
    );

    return {
        accessToken,
        patient: {
            id: patient.id,
            fullName: patient.full_name,
            email: patient.email,
            phone: patient.phone,
        },
        reports: reportsResult.rows,
    };
}
