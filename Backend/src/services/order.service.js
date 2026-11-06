import { pool } from "../config/db.js";
import { notifyOrderCreated, notifyOrderStatusUpdated } from "./email.service.js";

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

function normalizeOrderStatus(status) {
    if (!status) return null;
    const s = String(status).trim().toLowerCase();
    if (s === "pending") return "created";
    if (s === "in_progress") return "processing";
    return s;
}

// Create an order and its test items within an atomic transaction
export async function createOrder({
    user,
    patientId,
    items,
    notes = null,
    sampleCollectedAt = null,
}) {
    requireLabUser(user);

    if (!patientId || !Array.isArray(items) || items.length === 0) {
        throw createError("Patient and at least one test item are required", 400);
    }

    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        // 1. Verify lab is approved
        const labCheck = await client.query(
            `SELECT id, approval_status FROM labs WHERE id = $1`,
            [user.labId]
        );
        if (labCheck.rows.length === 0 || labCheck.rows[0].approval_status !== "approved") {
            throw createError("Laboratory must be approved to create orders", 403);
        }

        // 2. Verify patient belongs to this laboratory
        const patientRef = await client.query(
            `SELECT p.id, p.full_name, r.local_patient_code
             FROM patients p
             JOIN lab_patient_refs r ON r.patient_id = p.id
             WHERE p.id = $1 AND r.lab_id = $2`,
            [patientId, user.labId]
        );

        if (patientRef.rows.length === 0) {
            throw createError("Patient not found for this laboratory", 404);
        }

        // 3. Validate items
        let calculatedTotal = 0;
        const validatedItems = [];

        for (const item of items) {
            const testId = Number(item.testId ?? item.test_id);
            const quantity = Number(item.quantity ?? 1);
            const unitPrice = Number(item.unitPrice ?? item.unit_price ?? 0);

            if (!Number.isSafeInteger(testId) || testId <= 0) {
                throw createError("Invalid test identifier in order items", 400);
            }
            if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 100) {
                throw createError("Item quantity must be an integer between 1 and 100", 400);
            }
            if (Number.isNaN(unitPrice) || unitPrice < 0) {
                throw createError("Unit price must be a non-negative number", 400);
            }

            calculatedTotal += unitPrice * quantity;
            validatedItems.push({ testId, quantity, unitPrice });
        }

        const sampleDate = sampleCollectedAt ? new Date(sampleCollectedAt) : null;
        if (sampleDate && Number.isNaN(sampleDate.getTime())) {
            throw createError("Invalid sample collection date format", 400);
        }

        // 4. Create order record with initial 'created' status matching schema check constraint
        const orderResult = await client.query(
            `INSERT INTO orders
                (lab_id, patient_id, order_status, payment_status, total_amount,
                 sample_collected_at, notes, created_by)
             VALUES ($1, $2, 'created', 'pending', $3, $4, $5, $6)
             RETURNING id, lab_id, patient_id, order_status, payment_status,
                       total_amount, sample_collected_at, notes, created_by, created_at, updated_at`,
            [
                user.labId,
                patientId,
                calculatedTotal.toFixed(2),
                sampleDate,
                notes?.trim() || null,
                user.id,
            ]
        );

        const order = orderResult.rows[0];

        // 5. Insert order items
        const createdItems = [];
        for (const item of validatedItems) {
            const itemResult = await client.query(
                `INSERT INTO order_items
                    (order_id, test_id, quantity, unit_price)
                 VALUES ($1, $2, $3, $4)
                 RETURNING id, order_id, test_id, quantity, unit_price`,
                [order.id, item.testId, item.quantity, item.unitPrice]
            );
            createdItems.push(itemResult.rows[0]);
        }

        await client.query("COMMIT");

        // Safely trigger notifications to patient and admin
        (async () => {
            try {
                const labInfo = await pool.query(`SELECT name FROM labs WHERE id = $1`, [user.labId]);
                const patientInfo = await pool.query(`SELECT full_name, email FROM patients WHERE id = $1`, [patientId]);
                await notifyOrderCreated({
                    order,
                    patient: { full_name: patientInfo.rows[0]?.full_name, email: patientInfo.rows[0]?.email },
                    lab: { name: labInfo.rows[0]?.name || "Laboratory" },
                });
            } catch (_) {}
        })();

        return {
            ...order,
            patient: {
                id: patientRef.rows[0].id,
                fullName: patientRef.rows[0].full_name,
                localPatientCode: patientRef.rows[0].local_patient_code,
            },
            items: createdItems,
        };
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
}

// Retrieve one order belonging to the authenticated laboratory
export async function getOrderById({ orderId, user }) {
    requireLabUser(user);

    const result = await pool.query(
        `SELECT o.id, o.lab_id, o.patient_id, o.order_status, o.payment_status,
                o.total_amount, o.sample_collected_at, o.notes, o.created_by,
                o.created_at, o.updated_at,
                p.full_name AS patient_name,
                r.local_patient_code
         FROM orders o
         JOIN patients p ON p.id = o.patient_id
         JOIN lab_patient_refs r ON r.patient_id = p.id AND r.lab_id = o.lab_id
         WHERE o.id = $1 AND o.lab_id = $2`,
        [orderId, user.labId]
    );

    if (result.rows.length === 0) {
        throw createError("Order not found", 404);
    }

    const itemsResult = await pool.query(
        `SELECT id, order_id, test_id, quantity, unit_price
         FROM order_items
         WHERE order_id = $1
         ORDER BY id`,
        [orderId]
    );

    return {
        ...result.rows[0],
        items: itemsResult.rows,
    };
}

// List orders belonging to the authenticated laboratory with filters
export async function getLabOrders({
    user,
    status,
    paymentStatus,
    startDate,
    endDate,
    limit = 20,
    offset = 0,
}) {
    requireLabUser(user);

    const pagination = parsePagination(limit, offset);

    const normalizedStatus = normalizeOrderStatus(status);

    const allowedOrderStatuses = [
        "created",
        "confirmed",
        "processing",
        "completed",
        "cancelled",
    ];

    const allowedPaymentStatuses = [
        "pending",
        "paid",
        "failed",
        "refunded",
        "partial",
    ];

    if (normalizedStatus && !allowedOrderStatuses.includes(normalizedStatus)) {
        throw createError("Invalid order status filter", 400);
    }

    if (paymentStatus && !allowedPaymentStatuses.includes(paymentStatus)) {
        throw createError("Invalid payment status filter", 400);
    }

    const values = [
        user.labId,
        normalizedStatus || null,
        paymentStatus || null,
        startDate ? new Date(startDate) : null,
        endDate ? new Date(endDate) : null,
        pagination.limit,
        pagination.offset,
    ];

    const result = await pool.query(
        `SELECT o.id, o.lab_id, o.patient_id, o.order_status, o.payment_status,
                o.total_amount, o.sample_collected_at, o.notes, o.created_at, o.updated_at,
                p.full_name AS patient_name,
                r.local_patient_code
         FROM orders o
         JOIN patients p ON p.id = o.patient_id
         JOIN lab_patient_refs r ON r.patient_id = p.id AND r.lab_id = o.lab_id
         WHERE o.lab_id = $1
           AND ($2::text IS NULL OR o.order_status = $2)
           AND ($3::text IS NULL OR o.payment_status = $3)
           AND ($4::timestamptz IS NULL OR o.created_at >= $4)
           AND ($5::timestamptz IS NULL OR o.created_at <= $5)
         ORDER BY o.created_at DESC, o.id DESC
         LIMIT $6 OFFSET $7`,
        values
    );

    const countResult = await pool.query(
        `SELECT COUNT(*)
         FROM orders o
         WHERE o.lab_id = $1
           AND ($2::text IS NULL OR o.order_status = $2)
           AND ($3::text IS NULL OR o.payment_status = $3)
           AND ($4::timestamptz IS NULL OR o.created_at >= $4)
           AND ($5::timestamptz IS NULL OR o.created_at <= $5)`,
        [
            user.labId,
            status || null,
            paymentStatus || null,
            startDate ? new Date(startDate) : null,
            endDate ? new Date(endDate) : null,
        ]
    );

    return {
        orders: result.rows,
        pagination: {
            total: Number(countResult.rows[0].count),
            ...pagination,
        },
    };
}

// List a patient's orders within the authenticated laboratory
export async function getPatientOrders({
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
        `SELECT id, lab_id, patient_id, order_status, payment_status,
                total_amount, sample_collected_at, notes, created_at, updated_at
         FROM orders
         WHERE patient_id = $1 AND lab_id = $2
         ORDER BY created_at DESC, id DESC
         LIMIT $3 OFFSET $4`,
        [patientId, user.labId, pagination.limit, pagination.offset]
    );

    const countResult = await pool.query(
        `SELECT COUNT(*)
         FROM orders
         WHERE patient_id = $1 AND lab_id = $2`,
        [patientId, user.labId]
    );

    return {
        orders: result.rows,
        pagination: {
            total: Number(countResult.rows[0].count),
            ...pagination,
        },
    };
}

// Update an order's workflow status with state transition validation
export async function updateOrderStatus({
    orderId,
    status,
    notes,
    sampleCollectedAt,
    user,
}) {
    requireLabUser(user);

    const normalizedStatus = normalizeOrderStatus(status);

    const allowedStatuses = [
        "created",
        "confirmed",
        "processing",
        "completed",
        "cancelled",
    ];

    if (!allowedStatuses.includes(normalizedStatus)) {
        throw createError("Invalid order status", 400);
    }

    // Retrieve current order state to enforce valid transitions
    const currentOrder = await pool.query(
        `SELECT id, order_status FROM orders WHERE id = $1 AND lab_id = $2`,
        [orderId, user.labId]
    );

    if (currentOrder.rows.length === 0) {
        throw createError("Order not found", 404);
    }

    const currentStatus = currentOrder.rows[0].order_status;

    // Disallow transitions from terminal states
    if (currentStatus === "cancelled") {
        throw createError("A cancelled order cannot be changed", 400);
    }
    if (currentStatus === "completed" && normalizedStatus !== "completed") {
        throw createError("A completed order status cannot be reverted", 400);
    }

    const setClauses = ["order_status = $1", "updated_at = NOW()"];
    const values = [normalizedStatus, orderId, user.labId];
    let idx = 4;

    if (notes !== undefined) {
        setClauses.push(`notes = $${idx++}`);
        values.push(notes ? notes.trim() : null);
    }

    if (sampleCollectedAt !== undefined) {
        setClauses.push(`sample_collected_at = $${idx++}`);
        values.push(sampleCollectedAt ? new Date(sampleCollectedAt) : null);
    }

    const result = await pool.query(
        `UPDATE orders
         SET ${setClauses.join(", ")}
         WHERE id = $2 AND lab_id = $3
         RETURNING id, lab_id, patient_id, order_status, payment_status,
                   total_amount, sample_collected_at, notes, updated_at`,
        values
    );

    const updatedOrder = result.rows[0];

    // Safely trigger notifications to patient and admin
    (async () => {
        try {
            const labInfo = await pool.query(`SELECT name FROM labs WHERE id = $1`, [user.labId]);
            const patientInfo = await pool.query(`SELECT full_name, email FROM patients WHERE id = $1`, [updatedOrder.patient_id]);
            await notifyOrderStatusUpdated({
                order: updatedOrder,
                patient: { full_name: patientInfo.rows[0]?.full_name, email: patientInfo.rows[0]?.email },
                lab: { name: labInfo.rows[0]?.name || "Laboratory" },
                newStatus: normalizedStatus,
                notes,
            });
        } catch (_) {}
    })();

    return updatedOrder;
}
