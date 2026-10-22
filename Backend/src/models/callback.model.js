
import { pool } from "../config/db.js";

// Create a callback request
export async function createCallback({
    name,
    phone,
    email = null,
    labId = null,
    message = null,
}) {
    const query = `
        INSERT INTO public.callbacks (
            name,
            phone,
            email,
            lab_id,
            message
        )
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
    `;

    const values = [
        name.trim(),
        phone.trim(),
        email?.trim() || null,
        labId,
        message?.trim() || null,
    ];

    const result = await pool.query(query, values);

    return result.rows[0];
}


// Find a callback by ID
export async function findCallbackById(callbackId) {
    const query = `
        SELECT *
        FROM public.callbacks
        WHERE id = $1
    `;

    const result = await pool.query(query, [callbackId]);

    return result.rows[0] ?? null;
}


// List callback requests with pagination
export async function findCallbacks({
    status = null,
    labId = null,
    limit = 20,
    offset = 0,
}) {
    const query = `
        SELECT *
        FROM public.callbacks
        WHERE ($1::VARCHAR IS NULL OR callback_status = $1)
          AND ($2::BIGINT IS NULL OR lab_id = $2)
        ORDER BY requested_at DESC, id DESC
        LIMIT $3 OFFSET $4
    `;

    const values = [status, labId, limit, offset];

    const result = await pool.query(query, values);

    return result.rows;
}


// Update callback status
export async function updateCallbackStatus({
    callbackId,
    status,
    assignedTo = null,
}) {
    const query = `
        UPDATE public.callbacks
        SET callback_status = $2,
            assigned_to = COALESCE($3, assigned_to),
            contacted_at = CASE
                WHEN $2 IN ('contacted', 'completed')
                THEN COALESCE(contacted_at, NOW())
                ELSE contacted_at
            END,
            updated_at = NOW()
        WHERE id = $1
        RETURNING *
    `;

    const values = [callbackId, status, assignedTo];

    const result = await pool.query(query, values);

    return result.rows[0] ?? null;
}


// Delete a callback only when explicitly permitted
export async function deleteCallback(callbackId) {
    const query = `
        DELETE FROM public.callbacks
        WHERE id = $1
        RETURNING id
    `;

    const result = await pool.query(query, [callbackId]);

    return result.rows[0] ?? null;
}
