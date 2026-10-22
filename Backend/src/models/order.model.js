
import { pool } from "../config/db.js";

/**
 * Create an order with one or more test items.
 * Both operations run inside a single transaction.
 *
 * Expected items:
 * [{ testId: 1, price: 500, quantity: 1 }]
 *
 * IMPORTANT:
 * The service must calculate prices from trusted
 * lab-specific test prices, not frontend values.
 */
export async function createOrder({
  labId,
  patientId,
  items,
}) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const orderQuery = `
      INSERT INTO orders (
        lab_id,
        patient_id,
        order_status,
        payment_status
      )
      VALUES ($1, $2, 'pending', 'pending')
      RETURNING
        id,
        lab_id,
        patient_id,
        order_status,
        payment_status,
        total_amount,
        created_at;
    `;

    const orderResult = await client.query(orderQuery, [
      labId,
      patientId,
    ]);

    const order = orderResult.rows[0];
    let totalAmount = 0;

    const itemQuery = `
      INSERT INTO order_items (
        order_id,
        test_id,
        quantity,
        unit_price
      )
      VALUES ($1, $2, $3, $4)
      RETURNING
        id,
        order_id,
        test_id,
        quantity,
        unit_price;
    `;

    const createdItems = [];

    for (const item of items) {
      const result = await client.query(itemQuery, [
        order.id,
        item.testId,
        item.quantity,
        item.price,
      ]);

      createdItems.push(result.rows[0]);
      totalAmount += item.price * item.quantity;
    }

    await client.query(
      `UPDATE orders
       SET total_amount = $1,
           updated_at = NOW()
       WHERE id = $2`,
      [totalAmount, order.id]
    );

    await client.query("COMMIT");

    return {
      ...order,
      total_amount: totalAmount,
      items: createdItems,
    };
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      console.error("Order rollback failed:", rollbackError);
    }
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Find one order by ID, scoped to a lab.
 * The service must authorize access to that lab.
 */
export async function findOrderById({ orderId, labId }) {
  const query = `
    SELECT
      id,
      lab_id,
      patient_id,
      order_status,
      payment_status,
      total_amount,
      created_at,
      updated_at
    FROM orders
    WHERE id = $1
      AND lab_id = $2;
  `;

  const result = await pool.query(query, [orderId, labId]);

  return result.rows[0] ?? null;
}

/**
 * Get the tests belonging to an order.
 */
export async function findOrderItems({ orderId, labId }) {
  const query = `
    SELECT
      oi.id,
      oi.test_id,
      oi.quantity,
      oi.unit_price
    FROM order_items AS oi
    INNER JOIN orders AS o
      ON o.id = oi.order_id
    WHERE oi.order_id = $1
      AND o.lab_id = $2
    ORDER BY oi.id ASC;
  `;

  const result = await pool.query(query, [orderId, labId]);

  return result.rows;
}

/**
 * List orders belonging to a particular lab.
 */
export async function findOrdersByLab({
  labId,
  limit = 20,
  offset = 0,
}) {
  const query = `
    SELECT
      id,
      lab_id,
      patient_id,
      order_status,
      payment_status,
      total_amount,
      created_at,
      updated_at
    FROM orders
    WHERE lab_id = $1
    ORDER BY created_at DESC, id DESC
    LIMIT $2 OFFSET $3;
  `;

  const result = await pool.query(query, [
    labId,
    limit,
    offset,
  ]);

  return result.rows;
}

/**
 * Update an order's processing status.
 * Valid status transitions must be enforced
 * by the service layer.
 */
export async function updateOrderStatus({
  orderId,
  labId,
  status,
}) {
  const query = `
    UPDATE orders
    SET order_status = $1,
        updated_at = NOW()
    WHERE id = $2
      AND lab_id = $3
    RETURNING
      id,
      lab_id,
      patient_id,
      order_status,
      payment_status,
      total_amount,
      updated_at;
  `;

  const result = await pool.query(query, [
    status,
    orderId,
    labId,
  ]);

  return result.rows[0] ?? null;
}
