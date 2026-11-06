import test, { after } from "node:test";
import assert from "node:assert";
import app from "../src/app.js";
import { pool } from "../src/config/db.js";

after(async () => {
  await pool.end();
});

test("GET /api/v1/health returns 200 and operational status", async () => {
  const server = app.listen(0);
  const port = server.address().port;

  try {
    const res = await fetch(`http://localhost:${port}/api/v1/health`);
    const data = await res.json();

    assert.strictEqual(res.status, 200);
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.message, "PublicLab API is operational");
  } finally {
    server.close();
  }
});

test("GET /api/v1/subscriptions/plans returns active plans", async () => {
  const server = app.listen(0);
  const port = server.address().port;

  try {
    const res = await fetch(`http://localhost:${port}/api/v1/subscriptions/plans`);
    const data = await res.json();

    assert.strictEqual(res.status, 200);
    assert.strictEqual(data.success, true);
    assert.ok(Array.isArray(data.data));
    assert.ok(data.data.length >= 3);
  } finally {
    server.close();
  }
});

