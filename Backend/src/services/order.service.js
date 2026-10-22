
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

// Create an order and its test items
export async function createOrder({ user, patientId, items }) {
    requireLabUser(user);

    if (!patientId || !Array.isArray(items) || items.length === 0) {
        throw createError("Patient and at least one test item are required", 400);
    }

    if (
        items.some(
            (item) =>
                !Number.isSafeInteger(Number(item.testId)) ||
                Number(item.testId) <= 0 ||
                !Number.isSafeInteger(Number(item.quantity)) ||
                Number(item.quantity) < 1 ||
                Number(item.quantity) > 100
        )
    ) {
        throw createError("Invalid test item or quantity", 400);
    }

    // Until a test catalogue and trusted pricing table are implemented,
    // prices must not be accepted from the client.
    throw createError(
        "Order creation is not enabled until the test catalogue and pricing service are configured",
        501
    );
}

// Retrieve one order belonging to the authenticated laboratory
export async function getOrderById({ orderId, user }) {
    requireLabUser(user);

    const result = await pool.query(
        `SELECT id, lab_id, patient_id, order_status, payment_status,
                total_amount, created_at, updated_at
         FROM orders
         WHERE id = $1 AND lab_id = $2`,
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

// List orders belonging to the authenticated laboratory
export async function getLabOrders({
    user,
    status,
    paymentStatus,
    limit = 20,
    offset = 0,
}) {
    requireLabUser(user);

    const pagination = parsePagination(limit, offset);

    const allowedOrderStatuses = [
        "pending",
        "in_progress",
        "completed",
        "cancelled",
    ];

    const allowedPaymentStatuses = [
        "pending",
        "paid",
        "failed",
        "refunded",
    ];

    if (status && !allowedOrderStatuses.includes(status)) {
        throw createError("Invalid order status filter", 400);
    }

    if (paymentStatus && !allowedPaymentStatuses.includes(paymentStatus)) {
        throw createError("Invalid payment status filter", 400);
    }

    const values = [
        user.labId,
        status || null,
        paymentStatus || null,
        pagination.limit,
        pagination.offset,
    ];

    const result = await pool.query(
        `SELECT id, lab_id, patient_id, order_status, payment_status,
                total_amount, created_at, updated_at
         FROM orders
         WHERE lab_id = $1
           AND ($2::text IS NULL OR order_status = $2)
           AND ($3::text IS NULL OR payment_status = $3)
         ORDER BY created_at DESC, id DESC
         LIMIT $4 OFFSET $5`,
        values
    );

    const countResult = await pool.query(
        `SELECT COUNT(*)
         FROM orders
         WHERE lab_id = $1
           AND ($2::text IS NULL OR order_status = $2)
           AND ($3::text IS NULL OR payment_status = $3)`,
        [user.labId, status || null, paymentStatus || null]
    );

    return {
        orders: result.rows,
        pagination: {
            total: Number(countResult.rows[0].count),
            ...pagination,
        },
    };
}

// List a patient's orders, but only within the authenticated laboratory
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
                total_amount, created_at, updated_at
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

// Update an order's workflow status
export async function updateOrderStatus({ orderId, status, user }) {
    requireLabUser(user);

    const allowedStatuses = ["pending", "in_progress", "completed", "cancelled"];

    if (!allowedStatuses.includes(status)) {
        throw createError("Invalid order status", 400);
    }

    const result = await pool.query(
        `UPDATE orders
         SET order_status = $1,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2 AND lab_id = $3
         RETURNING id, lab_id, patient_id, order_status, payment_status,
                   total_amount, created_at, updated_at`,
        [status, orderId, user.labId]
    );

    if (result.rows.length === 0) {
        throw createError("Order not found", 404);
    }

    return result.rows[0];
}
