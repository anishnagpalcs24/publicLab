

import crypto from "crypto";
import bcrypt from "bcrypt";
import { pool } from "../config/db.js";
import { createEmailOtp } from "../models/session.model.js";
import {
    sendEmail,
    notifyLabApplicationSubmitted,
    notifyLabResubmitted,
    notifyLabApplicationDecision,
    notifyLabSuspension,
} from "./email.service.js";

function hashToken(token) {
    return crypto.createHash("sha256").update(token).digest("hex");
}

function generateOtp() {
    return crypto.randomInt(100000, 1000000).toString();
}

function createError(message, statusCode) {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
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

function requireAdmin(user) {
    if (user?.role !== "admin") {
        throw createError("Administrator access required", 403);
    }
}

function requireLabUser(user) {
    if (!user?.id || !user?.labId) {
        throw createError("Laboratory account required", 403);
    }
}

// Submit a laboratory application with combined lab and owner registration
export async function createLab(data, user = null) {
    // 1. Extract Laboratory Information
    const name = data.name?.trim();
    const registrationNumber = data.registrationNumber?.trim();
    const labEmail = data.email?.trim().toLowerCase() || null;
    const labPhone = data.phone?.trim() || null;
    const description = data.description?.trim() || null;
    const address = data.address?.trim() || null;
    const city = data.city?.trim() || null;
    const operatingHours = data.operatingHours || data.operating_hours || null;
    const services = Array.isArray(data.services) ? JSON.stringify(data.services) : "[]";
    const sampleCollectionAvailable = Boolean(data.sampleCollectionAvailable ?? data.sample_collection_available ?? false);

    // Optional Technical Contact
    const techName = data.technicalContactName || data.technicalContact?.name || null;
    const techEmail = data.technicalContactEmail || data.technicalContact?.email || null;
    const techPhone = data.technicalContactPhone || data.technicalContact?.phone || null;
    const technicalContact = {
        name: techName ? String(techName).trim() : null,
        email: techEmail ? String(techEmail).trim().toLowerCase() : null,
        phone: techPhone ? String(techPhone).trim() : null,
    };

    // 2. Validate Laboratory Basics
    if (!name || !registrationNumber || (!labEmail && !labPhone)) {
        throw createError(
            "Laboratory name, legal registration number, and contact email or phone are required",
            400
        );
    }

    // 3. Extract & Validate Owner Credentials (if unauthenticated caller)
    let ownerFullName = null;
    let ownerEmail = null;
    let ownerPhone = null;
    let password = null;

    if (!user) {
        ownerFullName = (data.ownerFullName || data.ownerName || data.fullName)?.trim();
        ownerEmail = (data.ownerEmail || data.ownerUsername || labEmail)?.trim().toLowerCase();
        ownerPhone = (data.ownerPhone || labPhone)?.trim() || null;
        password = data.password;

        if (!ownerFullName || !password) {
            throw createError(
                "Owner full name and account password are required to create the laboratory account",
                400
            );
        }

        if (!ownerEmail && !ownerPhone) {
            throw createError(
                "Owner email address is required for account authentication and verification",
                400
            );
        }

        if (password.length < 8) {
            throw createError("Password must contain at least 8 characters", 400);
        }
    }

    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        let ownerId = user?.id || null;

        // If caller is already authenticated
        if (ownerId) {
            const existingLab = await client.query(
                `SELECT id, name, approval_status
                 FROM labs
                 WHERE owner_id = $1 AND approval_status IN ('pending', 'approved')
                 LIMIT 1`,
                [ownerId]
            );

            if (existingLab.rows.length > 0) {
                throw createError(
                    `You already have an active or pending laboratory application (${existingLab.rows[0].name})`,
                    409
                );
            }
        } else {
            // Unauthenticated single-form submission: Create or resolve owner account
            const existingUser = await client.query(
                `SELECT id, email_verified, account_status
                 FROM users
                 WHERE LOWER(email) = $1
                 LIMIT 1`,
                [ownerEmail]
            );

            const passwordHash = await bcrypt.hash(password, 12);

            if (existingUser.rows.length > 0) {
                const existing = existingUser.rows[0];

                if (existing.email_verified) {
                    throw createError(
                        "An account with this owner email already exists. Please log in first to submit your lab application.",
                        409
                    );
                }

                // Existing unverified account: update credentials and allow re-verification
                ownerId = existing.id;
                await client.query(
                    `UPDATE users
                     SET full_name = $1,
                         password_hash = $2,
                         phone = COALESCE($3, phone),
                         role = 'lab',
                         updated_at = NOW()
                     WHERE id = $4`,
                    [ownerFullName, passwordHash, ownerPhone, ownerId]
                );
            } else {
                // Insert new owner user account with 'lab' role
                const userResult = await client.query(
                    `INSERT INTO users
                        (full_name, email, phone, password_hash, role, account_status, email_verified)
                     VALUES ($1, $2, $3, $4, 'lab', 'pending', FALSE)
                     RETURNING id`,
                    [ownerFullName, ownerEmail, ownerPhone, passwordHash]
                );
                ownerId = userResult.rows[0].id;
            }
        }

        // 4. Create the laboratory record
        const labResult = await client.query(
            `INSERT INTO labs
                (name, registration_number, email, phone,
                 description, address, city, operating_hours, services,
                 sample_collection_available, technical_contact, owner_id, approval_status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11::jsonb, $12, 'pending')
             RETURNING id, name, registration_number, email, phone,
                       description, address, city, operating_hours, services,
                       sample_collection_available, technical_contact, approval_status,
                       owner_id, created_at`,
            [
                name,
                registrationNumber,
                labEmail,
                labPhone,
                description,
                address,
                city,
                operatingHours ? JSON.stringify(operatingHours) : null,
                services,
                sampleCollectionAvailable,
                JSON.stringify(technicalContact),
                ownerId,
            ]
        );

        const lab = labResult.rows[0];

        // 5. Link user to the created lab
        await client.query(
            `UPDATE users
             SET lab_id = $1,
                 role = CASE WHEN role = 'admin' THEN role ELSE 'lab' END,
                 updated_at = NOW()
             WHERE id = $2`,
            [lab.id, ownerId]
        );

        // 6. Generate and store OTP if this was an unauthenticated registration
        let verificationOtp = null;
        if (!user && ownerEmail) {
            verificationOtp = generateOtp();
            const otpHash = hashToken(verificationOtp);
            const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

            await client.query(
                `INSERT INTO email_otps
                    (user_id, email, otp_hash, purpose, expires_at)
                 VALUES ($1, $2, $3, 'email_verification', $4)`,
                [ownerId, ownerEmail, otpHash, expiresAt]
            );

            // Safe dispatch of verification email
            try {
                await sendEmail({
                    to: ownerEmail,
                    subject: "PublicLab — Verify Your Laboratory Account",
                    text: `Hello ${ownerFullName},\n\nThank you for registering ${name} on PublicLab.\n\nYour 6-digit email verification code is: ${verificationOtp}\n\nThis code expires in 10 minutes.\nAdmin approval will proceed once your email is verified.`,
                    html: `
                        <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
                            <h2 style="color: #0284c7;">PublicLab Laboratory Registration</h2>
                            <p>Hello ${ownerFullName},</p>
                            <p>Thank you for submitting your application for <strong>${name}</strong>. Please use the verification code below to confirm your account:</p>
                            <div style="font-size: 24px; font-weight: bold; letter-spacing: 4px; padding: 12px; background: #f0f9ff; border: 1px solid #bae6fd; width: max-content; border-radius: 6px; color: #0369a1;">
                                ${verificationOtp}
                            </div>
                            <p style="color: #64748b; font-size: 13px; margin-top: 20px;">This code expires in 10 minutes. Laboratory services will be activated upon administrator review and approval.</p>
                        </div>
                    `,
                });
            } catch (emailError) {
                if (process.env.NODE_ENV !== "test") {
                    console.warn(`[Lab Registration Email Notice] Could not dispatch live email: ${emailError.message}`);
                }
            }
        }

        await client.query("COMMIT");

        // Safely dispatch admin notification of new lab application
        notifyLabApplicationSubmitted({
            lab,
            owner: {
                id: ownerId,
                fullName: ownerFullName || user?.fullName,
                email: ownerEmail || user?.email,
                phone: ownerPhone || user?.phone,
            },
        }).catch(() => {});

        const devOtp = process.env.NODE_ENV === "development" ? verificationOtp : undefined;

        return {
            lab: {
                ...lab,
                ...(devOtp ? { devOtp } : {}),
            },
            owner: {
                id: ownerId,
                fullName: ownerFullName || user?.fullName,
                email: ownerEmail || user?.email,
                role: "lab",
                requiresVerification: !user,
                ...(devOtp ? { devOtp } : {}),
            },
            ...(devOtp ? { devOtp } : {}),
            message: !user
                ? "Laboratory application submitted and owner account registered successfully. Please verify your email with the OTP sent."
                : "Laboratory application submitted successfully",
        };
    } catch (error) {
        await client.query("ROLLBACK");
        if (error.code === "23505") {
            throw createError(
                "A laboratory with this registration number or email already exists",
                409
            );
        }
        throw error;
    } finally {
        client.release();
    }
}

// Get the authenticated owner's laboratory profile
export async function getMyLab(user) {
    if (!user?.id) {
        throw createError("Authentication required", 401);
    }

    const result = await pool.query(
        `SELECT l.id, l.name, l.registration_number, l.email, l.phone,
                l.description, l.address, l.city, l.operating_hours, l.services,
                l.sample_collection_available, l.approval_status,
                l.rejection_reason, l.rejection_notes, l.suspension_reason,
                l.owner_id, l.created_at, l.updated_at
         FROM labs l
         WHERE l.id = $1 OR l.owner_id = $2
         ORDER BY (l.id = $1) DESC
         LIMIT 1`,
        [user.labId || null, user.id]
    );

    if (result.rows.length === 0) {
        throw createError("No laboratory registered for this account", 404);
    }

    return result.rows[0];
}

// Get application status for the authenticated lab owner
export async function getApplicationStatus(user) {
    if (!user?.id) {
        throw createError("Authentication required", 401);
    }

    const result = await pool.query(
        `SELECT id, name, registration_number, email, phone,
                approval_status, rejection_reason, rejection_notes,
                suspension_reason, created_at, updated_at
         FROM labs
         WHERE id = $1 OR owner_id = $2
         ORDER BY (id = $1) DESC
         LIMIT 1`,
        [user.labId || null, user.id]
    );

    if (result.rows.length === 0) {
        return {
            hasApplication: false,
            message: "No laboratory application submitted yet",
        };
    }

    const lab = result.rows[0];
    const canResubmit = lab.approval_status === "rejected";

    return {
        hasApplication: true,
        labId: lab.id,
        name: lab.name,
        registrationNumber: lab.registration_number,
        approvalStatus: lab.approval_status,
        rejectionReason: lab.rejection_reason || null,
        rejectionNotes: lab.rejection_notes || null,
        suspensionReason: lab.suspension_reason || null,
        canResubmit,
        missingRequirements: canResubmit
            ? lab.rejection_reason || "Please address reviewer comments and resubmit"
            : null,
        submittedAt: lab.created_at,
        updatedAt: lab.updated_at,
    };
}

// Resubmit application after rejection
export async function resubmitApplication({ user, updates = {} }) {
    if (!user?.id) {
        throw createError("Authentication required", 401);
    }

    const labResult = await pool.query(
        `SELECT id, approval_status
         FROM labs
         WHERE id = $1 OR owner_id = $2
         ORDER BY (id = $1) DESC
         LIMIT 1`,
        [user.labId || null, user.id]
    );

    if (labResult.rows.length === 0) {
        throw createError("No laboratory application found", 404);
    }

    const lab = labResult.rows[0];

    if (lab.approval_status !== "rejected") {
        throw createError(
            `Application cannot be resubmitted while in '${lab.approval_status}' status`,
            400
        );
    }

    const name = updates.name?.trim();
    const registrationNumber = updates.registrationNumber?.trim();
    const email = updates.email?.trim().toLowerCase();
    const phone = updates.phone?.trim();
    const description = updates.description?.trim();
    const address = updates.address?.trim();
    const city = updates.city?.trim();

    const result = await pool.query(
        `UPDATE labs
         SET approval_status = 'pending',
             name = COALESCE($1, name),
             registration_number = COALESCE($2, registration_number),
             email = COALESCE($3, email),
             phone = COALESCE($4, phone),
             description = COALESCE($5, description),
             address = COALESCE($6, address),
             city = COALESCE($7, city),
             rejection_reason = NULL,
             rejection_notes = NULL,
             updated_at = NOW()
         WHERE id = $8
         RETURNING id, name, registration_number, email, phone,
                   description, address, city, approval_status, updated_at`,
        [
            name || null,
            registrationNumber || null,
            email || null,
            phone || null,
            description || null,
            address || null,
            city || null,
            lab.id,
        ]
    );

    const resubmitted = result.rows[0];

    notifyLabResubmitted({
        lab: resubmitted,
        ownerEmail: user.email,
        description: description || "Updated application credentials submitted",
    }).catch(() => {});

    return resubmitted;
}

// List approved laboratories for public discovery
export async function getLabs({
    search,
    limit = 20,
    offset = 0,
} = {}) {
    const pagination = parsePagination(limit, offset);
    const searchTerm = search?.trim() || null;

    const values = [searchTerm, pagination.limit, pagination.offset];

    const result = await pool.query(
        `SELECT id, name, email, phone, description, approval_status
         FROM labs
         WHERE approval_status = 'approved'
           AND (
             $1::text IS NULL
             OR name ILIKE '%' || $1 || '%'
             OR description ILIKE '%' || $1 || '%'
           )
         ORDER BY name ASC
         LIMIT $2 OFFSET $3`,
        values
    );

    const countResult = await pool.query(
        `SELECT COUNT(*)
         FROM labs
         WHERE approval_status = 'approved'
           AND (
             $1::text IS NULL
             OR name ILIKE '%' || $1 || '%'
             OR description ILIKE '%' || $1 || '%'
           )`,
        [searchTerm]
    );

    return {
        labs: result.rows,
        pagination: {
            total: Number(countResult.rows[0].count),
            ...pagination,
        },
    };
}

// Get a public laboratory profile
export async function getLabById(labId) {
    const result = await pool.query(
        `SELECT id, name, email, phone, description, approval_status
         FROM labs
         WHERE id = $1 AND approval_status = 'approved'`,
        [labId]
    );

    if (result.rows.length === 0) {
        throw createError("Laboratory not found", 404);
    }

    return result.rows[0];
}

// Update the authenticated laboratory's profile
export async function updateMyLab({ user, updates }) {
    if (!user?.id) {
        throw createError("Authentication required", 401);
    }

    // Resolve lab ID from user or owner_id
    let targetLabId = user.labId;
    if (!targetLabId) {
        const ownerCheck = await pool.query(
            `SELECT id FROM labs WHERE owner_id = $1 LIMIT 1`,
            [user.id]
        );
        if (ownerCheck.rows.length > 0) {
            targetLabId = ownerCheck.rows[0].id;
        } else {
            throw createError("No laboratory linked to this account", 404);
        }
    }

    const allowedFields = {
        name: "name",
        email: "email",
        phone: "phone",
        description: "description",
        address: "address",
        city: "city",
        operatingHours: "operating_hours",
        operating_hours: "operating_hours",
        services: "services",
        sampleCollectionAvailable: "sample_collection_available",
        sample_collection_available: "sample_collection_available",
    };

    const setClauses = [];
    const values = [];
    let index = 1;

    for (const [field, column] of Object.entries(allowedFields)) {
        if (updates[field] !== undefined) {
            let value = updates[field];

            if (typeof value === "string") {
                value = value.trim();
            }

            if (field === "name" && !value) {
                throw createError("Laboratory name cannot be empty", 400);
            }

            if (field === "email") {
                value = value ? value.toLowerCase() : null;
            }

            if (field === "phone" || field === "description" || field === "address" || field === "city") {
                value = value || null;
            }

            if (column === "operating_hours") {
                value = typeof value === "object" ? JSON.stringify(value) : value;
            }

            if (column === "services") {
                value = Array.isArray(value) ? JSON.stringify(value) : "[]";
            }

            if (column === "sample_collection_available") {
                value = Boolean(value);
            }

            // Avoid duplicate column in set clauses
            if (!setClauses.some(c => c.startsWith(`${column} =`))) {
                setClauses.push(`${column} = $${index++}`);
                values.push(value);
            }
        }
    }

    if (setClauses.length === 0) {
        throw createError("No valid profile fields provided", 400);
    }

    setClauses.push("updated_at = CURRENT_TIMESTAMP");
    values.push(targetLabId);

    try {
        const result = await pool.query(
            `UPDATE labs
             SET ${setClauses.join(", ")}
             WHERE id = $${index}
             RETURNING id, name, email, phone, description,
                       address, city, operating_hours, services,
                       sample_collection_available, approval_status, updated_at`,
            values
        );

        if (result.rows.length === 0) {
            throw createError("Laboratory not found", 404);
        }

        return result.rows[0];
    } catch (error) {
        if (error.code === "23505") {
            throw createError("That email is already registered", 409);
        }

        throw error;
    }
}

// List laboratory applications (admin only)
export async function getLabApplications({
    status = null,
    limit = 20,
    offset = 0,
} = {}) {
    const pagination = parsePagination(limit, offset);

    const allowedStatuses = [
        "pending",
        "approved",
        "rejected",
        "suspended",
    ];

    const normalizedStatus =
        status && status !== "all" ? status.trim().toLowerCase() : null;

    if (normalizedStatus && !allowedStatuses.includes(normalizedStatus)) {
        throw createError("Invalid laboratory status filter", 400);
    }

    const values = [normalizedStatus, pagination.limit, pagination.offset];

    const result = await pool.query(
        `SELECT id, name, registration_number, email, phone,
                description, approval_status, created_at
         FROM labs
         WHERE ($1::text IS NULL OR approval_status = $1)
         ORDER BY created_at DESC
         LIMIT $2 OFFSET $3`,
        values
    );

    const countResult = await pool.query(
        `SELECT COUNT(*) FROM labs
         WHERE ($1::text IS NULL OR approval_status = $1)`,
        [normalizedStatus]
    );

    return {
        labs: result.rows,
        pagination: {
            total: Number(countResult.rows[0].count),
            ...pagination,
        },
    };
}

// Approve or reject an application (admin only)
export async function reviewLabApplication({
    labId,
    status,
    reason,
    reviewedBy,
}) {
    // reviewedBy is supplied by the controller from req.user.id.
    // The admin role must also be checked by authorization middleware.
    if (!reviewedBy) {
        throw createError("Administrator identity is required", 403);
    }

    if (!["approved", "rejected"].includes(status)) {
        throw createError(
            "Status must be approved or rejected",
            400
        );
    }

    const result = await pool.query(
        `UPDATE labs
         SET approval_status = $1::varchar,
             rejection_reason = CASE WHEN $1::varchar = 'rejected' THEN $3::text ELSE NULL END,
             rejection_notes = CASE WHEN $1::varchar = 'rejected' THEN $3::text ELSE NULL END,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2 AND approval_status = 'pending'
         RETURNING id, name, registration_number, email, phone,
                   approval_status, rejection_reason, updated_at`,
        [status, labId, reason || null]
    );

    if (result.rows.length === 0) {
        throw createError(
            "Pending laboratory application not found",
            404
        );
    }

    const reviewedLab = result.rows[0];

    (async () => {
        try {
            const ownerRes = await pool.query(
                `SELECT u.email AS owner_email, l.email AS lab_email
                 FROM labs l
                 LEFT JOIN users u ON u.id = l.owner_id
                 WHERE l.id = $1`,
                [reviewedLab.id]
            );
            const ownerEmail = ownerRes.rows[0]?.owner_email || ownerRes.rows[0]?.lab_email || reviewedLab.email;
            await notifyLabApplicationDecision({
                lab: reviewedLab,
                ownerEmail,
                decision: status,
                reason,
            });
        } catch (_) {}
    })();

    return {
        ...reviewedLab,
        reviewReason: reason || null,
    };
}

// Suspend an existing laboratory (admin only)
export async function suspendLab({
    labId,
    reason,
    suspendedBy,
}) {
    if (!suspendedBy) {
        throw createError("Administrator identity is required", 403);
    }

    if (!reason?.trim()) {
        throw createError("A suspension reason is required", 400);
    }

    const result = await pool.query(
        `UPDATE labs
         SET approval_status = 'suspended',
             suspension_reason = $2,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1 AND approval_status = 'approved'
         RETURNING id, name, registration_number, approval_status,
                   suspension_reason, updated_at`,
        [labId, reason.trim()]
    );

    if (result.rows.length === 0) {
        throw createError(
            "Approved laboratory not found",
            404
        );
    }

    const suspendedLab = result.rows[0];

    (async () => {
        try {
            const ownerRes = await pool.query(
                `SELECT u.email AS owner_email, l.email AS lab_email
                 FROM labs l
                 LEFT JOIN users u ON u.id = l.owner_id
                 WHERE l.id = $1`,
                [suspendedLab.id]
            );
            const ownerEmail = ownerRes.rows[0]?.owner_email || ownerRes.rows[0]?.lab_email || suspendedLab.email;
            await notifyLabSuspension({
                lab: suspendedLab,
                ownerEmail,
                reason: reason.trim(),
            });
        } catch (_) {}
    })();

    return {
        ...suspendedLab,
        suspensionReason: reason.trim(),
    };

    // Record the reason and administrator in the audit log
    // when that table and service are implemented.
    return {
        ...result.rows[0],
        suspensionReason: reason.trim(),
    };
}

// ============================================================================
// LAB OWNER DASHBOARD & CLINICAL CALCULATORS
// ============================================================================

// Get operational dashboard summary for the authenticated laboratory
export async function getLabDashboard(user) {
    if (!user?.id) {
        throw createError("Authentication required", 401);
    }

    let labId = user.labId;
    if (!labId) {
        const ownerCheck = await pool.query(
            `SELECT id FROM labs WHERE owner_id = $1 LIMIT 1`,
            [user.id]
        );
        if (ownerCheck.rows.length > 0) {
            labId = ownerCheck.rows[0].id;
        } else {
            throw createError("No laboratory linked to this account", 404);
        }
    }

    const [
        labInfo,
        totalPatients,
        ordersByStatus,
        reportsByStatus,
        recentOrders,
        recentReports,
        calculationsCount,
    ] = await Promise.all([
        pool.query(
            `SELECT id, name, registration_number, approval_status,
                    rejection_reason, created_at
             FROM labs WHERE id = $1`,
            [labId]
        ),
        pool.query(
            `SELECT COUNT(*) FROM lab_patient_refs WHERE lab_id = $1`,
            [labId]
        ),
        pool.query(
            `SELECT order_status, COUNT(*) as count
             FROM orders
             WHERE lab_id = $1
             GROUP BY order_status`,
            [labId]
        ),
        pool.query(
            `SELECT COALESCE(status, report_status) as report_status, COUNT(*) as count
             FROM reports
             WHERE lab_id = $1
             GROUP BY COALESCE(status, report_status)`,
            [labId]
        ),
        pool.query(
            `SELECT o.id, o.patient_id, o.order_status, o.total_amount, o.created_at,
                    p.full_name as patient_name
             FROM orders o
             JOIN patients p ON p.id = o.patient_id
             WHERE o.lab_id = $1
             ORDER BY o.created_at DESC
             LIMIT 5`,
            [labId]
        ),
        pool.query(
            `SELECT r.id, r.order_id, r.patient_id, r.original_filename,
                    COALESCE(r.status, r.report_status) as status,
                    r.created_at, p.full_name as patient_name
             FROM reports r
             JOIN patients p ON p.id = r.patient_id
             WHERE r.lab_id = $1
             ORDER BY r.created_at DESC
             LIMIT 5`,
            [labId]
        ),
        pool.query(
            `SELECT COUNT(*) FROM clinical_calculations WHERE lab_id = $1`,
            [labId]
        ),
    ]);

    if (labInfo.rows.length === 0) {
        throw createError("Laboratory not found", 404);
    }

    const orderStatusMap = {
        pending: 0,
        in_progress: 0,
        completed: 0,
        cancelled: 0,
    };
    let totalOrders = 0;
    for (const row of ordersByStatus.rows) {
        const count = Number(row.count);
        orderStatusMap[row.order_status] = count;
        totalOrders += count;
    }

    const reportStatusMap = {
        draft: 0,
        published: 0,
        corrected: 0,
        voided: 0,
    };
    let totalReports = 0;
    for (const row of reportsByStatus.rows) {
        const count = Number(row.count);
        reportStatusMap[row.report_status] = count;
        totalReports += count;
    }

    return {
        lab: labInfo.rows[0],
        patients: {
            total: Number(totalPatients.rows[0].count),
        },
        orders: {
            total: totalOrders,
            pending: orderStatusMap.pending,
            inProgress: orderStatusMap.in_progress,
            completed: orderStatusMap.completed,
            cancelled: orderStatusMap.cancelled,
            byStatus: orderStatusMap,
        },
        reports: {
            total: totalReports,
            draft: reportStatusMap.draft,
            published: reportStatusMap.published,
            corrected: reportStatusMap.corrected,
            byStatus: reportStatusMap,
        },
        calculations: {
            total: Number(calculationsCount.rows[0].count),
        },
        recentActivity: {
            orders: recentOrders.rows,
            reports: recentReports.rows,
        },
    };
}

// Compute clinical metric with mathematical validation
export function calculateClinicalMetric({ type, inputs = {} }) {
    if (!type) {
        throw createError("Calculator type is required (egfr, ldl, homa_ir, fai)", 400);
    }

    const normalizedType = type.trim().toLowerCase();

    switch (normalizedType) {
        case "egfr": {
            // 2021 CKD-EPI Creatinine equation (without race adjustment)
            const serumCreatinine = Number(inputs.serumCreatinine ?? inputs.serum_creatinine);
            const age = Number(inputs.age);
            const sex = String(inputs.sex || "").trim().toLowerCase();

            if (Number.isNaN(serumCreatinine) || serumCreatinine <= 0) {
                throw createError("Serum creatinine must be a positive number in mg/dL", 400);
            }
            if (!Number.isInteger(age) || age < 18 || age > 120) {
                throw createError("Age must be an integer between 18 and 120 years", 400);
            }
            if (!["female", "male"].includes(sex)) {
                throw createError("Sex must be 'female' or 'male' for CKD-EPI calculation", 400);
            }

            const kappa = sex === "female" ? 0.7 : 0.9;
            const alpha = sex === "female" ? -0.241 : -0.302;
            const sexFactor = sex === "female" ? 1.012 : 1.0;

            const scrRatio = serumCreatinine / kappa;
            const minPart = Math.pow(Math.min(scrRatio, 1.0), alpha);
            const maxPart = Math.pow(Math.max(scrRatio, 1.0), -1.200);
            const agePart = Math.pow(0.9938, age);

            const result = 142 * minPart * maxPart * agePart * sexFactor;
            const roundedResult = Number(result.toFixed(1));

            let interpretation = "G1: Normal or high kidney function";
            if (roundedResult < 15) interpretation = "G5: Kidney failure";
            else if (roundedResult < 30) interpretation = "G4: Severely decreased kidney function";
            else if (roundedResult < 45) interpretation = "G3b: Moderately to severely decreased kidney function";
            else if (roundedResult < 60) interpretation = "G3a: Mildly to moderately decreased kidney function";
            else if (roundedResult < 90) interpretation = "G2: Mildly decreased kidney function";

            return {
                calculatorType: "egfr",
                formulaName: "CKD-EPI 2021 (Refit Without Race)",
                equationVersion: "2021 NKF/KDIGO Guideline",
                inputs: { serumCreatinine, age, sex },
                resultValue: roundedResult,
                resultUnit: "mL/min/1.73 m²",
                interpretation,
                warning: "Equation validated for adults age 18 and older. Clinical interpretation should account for atypical muscle mass, diet, and acute kidney changes.",
            };
        }

        case "ldl": {
            // Friedewald equation: LDL = Total Cholesterol - HDL - (Triglycerides / 5)
            const totalCholesterol = Number(inputs.totalCholesterol ?? inputs.total_cholesterol);
            const hdl = Number(inputs.hdl);
            const triglycerides = Number(inputs.triglycerides);

            if (Number.isNaN(totalCholesterol) || totalCholesterol <= 0) {
                throw createError("Total Cholesterol must be a positive number in mg/dL", 400);
            }
            if (Number.isNaN(hdl) || hdl <= 0) {
                throw createError("HDL Cholesterol must be a positive number in mg/dL", 400);
            }
            if (Number.isNaN(triglycerides) || triglycerides <= 0) {
                throw createError("Triglycerides must be a positive number in mg/dL", 400);
            }
            if (totalCholesterol <= hdl) {
                throw createError("Total Cholesterol must be greater than HDL Cholesterol", 400);
            }

            const isUnreliable = triglycerides > 400;
            const ldl = totalCholesterol - hdl - triglycerides / 5.0;
            const roundedLdl = Number(ldl.toFixed(1));

            let interpretation = "Optimal (< 100 mg/dL)";
            if (roundedLdl >= 190) interpretation = "Very high (>= 190 mg/dL)";
            else if (roundedLdl >= 160) interpretation = "High (160 - 189 mg/dL)";
            else if (roundedLdl >= 130) interpretation = "Borderline high (130 - 159 mg/dL)";
            else if (roundedLdl >= 100) interpretation = "Near optimal (100 - 129 mg/dL)";

            let warning = "Calculated using the Friedewald formula. Valid in fasting state with triglycerides <= 400 mg/dL.";
            if (isUnreliable) {
                warning = "CAUTION: Triglycerides exceed 400 mg/dL. The Friedewald equation is clinically unreliable at this level. Direct LDL assay measurement is recommended.";
            }

            return {
                calculatorType: "ldl",
                formulaName: "Friedewald Equation",
                equationVersion: "Standard Lipid Panel Formulation",
                inputs: { totalCholesterol, hdl, triglycerides },
                resultValue: roundedLdl,
                resultUnit: "mg/dL",
                interpretation,
                warning,
                isUnreliable,
            };
        }

        case "homa_ir": {
            // HOMA-IR = (Insulin * Glucose) / 405 (mg/dL) or / 22.5 (mmol/L)
            const fastingInsulin = Number(inputs.fastingInsulin ?? inputs.fasting_insulin);
            const fastingGlucose = Number(inputs.fastingGlucose ?? inputs.fasting_glucose);
            const glucoseUnit = String(inputs.glucoseUnit || "mg/dL").trim().toLowerCase();

            if (Number.isNaN(fastingInsulin) || fastingInsulin <= 0) {
                throw createError("Fasting insulin must be a positive number in µIU/mL", 400);
            }
            if (Number.isNaN(fastingGlucose) || fastingGlucose <= 0) {
                throw createError("Fasting glucose must be a positive number", 400);
            }

            let divisor = 405.0;
            if (glucoseUnit === "mmol/l" || glucoseUnit === "mmol") {
                divisor = 22.5;
            }

            const homa = (fastingInsulin * fastingGlucose) / divisor;
            const roundedHoma = Number(homa.toFixed(2));

            let interpretation = "Optimal insulin sensitivity (< 1.0)";
            if (roundedHoma >= 3.0) interpretation = "Significant insulin resistance (>= 3.0)";
            else if (roundedHoma >= 2.0) interpretation = "Moderate insulin resistance (2.0 - 2.9)";
            else if (roundedHoma >= 1.0) interpretation = "Early/mild insulin resistance (1.0 - 1.9)";

            return {
                calculatorType: "homa_ir",
                formulaName: "Homeostatic Model Assessment of Insulin Resistance (HOMA-IR)",
                equationVersion: "Matthews et al. Formulation",
                inputs: { fastingInsulin, fastingGlucose, glucoseUnit },
                resultValue: roundedHoma,
                resultUnit: "score",
                interpretation,
                warning: "HOMA-IR is an assessment index and not a standalone diagnostic test. Clinical correlation with HbA1c, OGTT, and patient profile is recommended.",
            };
        }

        case "fai": {
            // FAI = (Total Testosterone / SHBG) * 100
            let totalTestosterone = Number(inputs.totalTestosterone ?? inputs.total_testosterone);
            const shbg = Number(inputs.shbg);
            const testosteroneUnit = String(inputs.testosteroneUnit || "nmol/L").trim().toLowerCase();

            if (Number.isNaN(totalTestosterone) || totalTestosterone <= 0) {
                throw createError("Total testosterone must be a positive number", 400);
            }
            if (Number.isNaN(shbg) || shbg <= 0) {
                throw createError("SHBG must be a positive non-zero number in nmol/L", 400);
            }

            // Convert ng/dL to nmol/L if needed (1 ng/dL = 0.0347 nmol/L)
            if (testosteroneUnit === "ng/dl" || testosteroneUnit === "ng/100ml") {
                totalTestosterone = totalTestosterone * 0.0347;
            }

            const fai = (totalTestosterone / shbg) * 100.0;
            const roundedFai = Number(fai.toFixed(2));

            let interpretation = "Normal range evaluation depends on sex and clinical presentation.";
            if (roundedFai > 6.5) {
                interpretation = "Elevated FAI for females (> 6.5). May suggest hyperandrogenism in appropriate clinical context.";
            }

            return {
                calculatorType: "fai",
                formulaName: "Free Androgen Index (FAI)",
                equationVersion: "Biochemical Ratio Formulation",
                inputs: {
                    totalTestosterone: Number(totalTestosterone.toFixed(3)),
                    shbg,
                    unit: "nmol/L",
                },
                resultValue: roundedFai,
                resultUnit: "%",
                interpretation,
                warning: "FAI is an indirect biochemical ratio reflecting active testosterone. It is not a direct measurement of free testosterone and has limited diagnostic utility in males.",
            };
        }

        default:
            throw createError(
                `Unsupported calculator type '${type}'. Supported types: egfr, ldl, homa_ir, fai`,
                400
            );
    }
}

// Save a calculation result with optional patient association
export async function saveCalculation({
    user,
    calculatorType,
    inputs,
    patientId = null,
    clinicalNotes = null,
}) {
    requireLabUser(user);

    // Compute calculation
    const calculated = calculateClinicalMetric({
        type: calculatorType,
        inputs,
    });

    // If patientId provided, verify that patient belongs to this lab
    let validatedPatientId = null;
    if (patientId) {
        const patientCheck = await pool.query(
            `SELECT p.id, p.full_name
             FROM patients p
             JOIN lab_patient_refs r ON r.patient_id = p.id
             WHERE p.id = $1 AND r.lab_id = $2`,
            [patientId, user.labId]
        );

        if (patientCheck.rows.length === 0) {
            throw createError("Patient not found for this laboratory", 404);
        }
        validatedPatientId = patientCheck.rows[0].id;
    }

    const result = await pool.query(
        `INSERT INTO clinical_calculations
            (lab_id, patient_id, created_by, calculator_type, formula_name,
             input_parameters, result_value, result_unit, interpretation,
             clinical_notes)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, $10)
         RETURNING id, lab_id, patient_id, created_by, calculator_type, formula_name,
                   input_parameters, result_value, result_unit, interpretation,
                   clinical_notes, created_at`,
        [
            user.labId,
            validatedPatientId,
            user.id,
            calculated.calculatorType,
            calculated.formulaName,
            JSON.stringify(calculated.inputs),
            calculated.resultValue,
            calculated.resultUnit,
            calculated.interpretation,
            clinicalNotes?.trim() || null,
        ]
    );

    return {
        ...result.rows[0],
        warning: calculated.warning,
    };
}

// List saved calculations for the authenticated laboratory
export async function getCalculations({
    user,
    type,
    patientId,
    limit = 20,
    offset = 0,
}) {
    requireLabUser(user);

    const pagination = parsePagination(limit, offset);

    const values = [
        user.labId,
        type?.trim().toLowerCase() || null,
        patientId ? Number(patientId) : null,
        pagination.limit,
        pagination.offset,
    ];

    const result = await pool.query(
        `SELECT c.id, c.lab_id, c.patient_id, c.created_by, c.calculator_type,
                c.formula_name, c.input_parameters, c.result_value, c.result_unit,
                c.interpretation, c.clinical_notes, c.created_at,
                p.full_name AS patient_name,
                r.local_patient_code
         FROM clinical_calculations c
         LEFT JOIN patients p ON p.id = c.patient_id
         LEFT JOIN lab_patient_refs r ON r.patient_id = p.id AND r.lab_id = c.lab_id
         WHERE c.lab_id = $1
           AND ($2::text IS NULL OR c.calculator_type = $2)
           AND ($3::bigint IS NULL OR c.patient_id = $3)
         ORDER BY c.created_at DESC, c.id DESC
         LIMIT $4 OFFSET $5`,
        values
    );

    const countResult = await pool.query(
        `SELECT COUNT(*)
         FROM clinical_calculations c
         WHERE c.lab_id = $1
           AND ($2::text IS NULL OR c.calculator_type = $2)
           AND ($3::bigint IS NULL OR c.patient_id = $3)`,
        [
            user.labId,
            type?.trim().toLowerCase() || null,
            patientId ? Number(patientId) : null,
        ]
    );

    return {
        calculations: result.rows,
        pagination: {
            total: Number(countResult.rows[0].count),
            ...pagination,
        },
    };
}

// Get single saved calculation details
export async function getCalculationById({ calculationId, user }) {
    requireLabUser(user);

    const result = await pool.query(
        `SELECT c.id, c.lab_id, c.patient_id, c.created_by, c.calculator_type,
                c.formula_name, c.input_parameters, c.result_value, c.result_unit,
                c.interpretation, c.clinical_notes, c.created_at,
                p.full_name AS patient_name,
                r.local_patient_code
         FROM clinical_calculations c
         LEFT JOIN patients p ON p.id = c.patient_id
         LEFT JOIN lab_patient_refs r ON r.patient_id = p.id AND r.lab_id = c.lab_id
         WHERE c.id = $1 AND c.lab_id = $2`,
        [calculationId, user.labId]
    );

    if (result.rows.length === 0) {
        throw createError("Calculation record not found", 404);
    }

    return result.rows[0];
}

