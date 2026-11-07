import test, { after, before } from "node:test";
import assert from "node:assert";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import app from "../src/app.js";
import { pool } from "../src/config/db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const STORAGE_DIR = path.resolve(__dirname, "../storage/reports");

let testPatientId;
let testReportId;
const testPatientEmail = `test.patient.${Date.now()}@example.com`;
let testReportStorageKey;

before(async () => {
  // Ensure storage dir exists
  if (!fs.existsSync(STORAGE_DIR)) {
    fs.mkdirSync(STORAGE_DIR, { recursive: true });
  }

  // 1. Get an existing approved lab or create one
  const labRes = await pool.query(
    "SELECT id FROM labs WHERE approval_status = 'approved' LIMIT 1"
  );
  let labId;
  if (labRes.rows.length > 0) {
    labId = labRes.rows[0].id;
  } else {
    const insertLab = await pool.query(
      `INSERT INTO labs (name, email, phone, city, approval_status)
       VALUES ('Test Diagnostic Centre', 'testlab@example.com', '9876543210', 'Mumbai', 'approved')
       RETURNING id`
    );
    labId = insertLab.rows[0].id;
  }

  // 2. Create patient WITHOUT creating any user in `users` table
  const patRes = await pool.query(
    `INSERT INTO patients (full_name, email, phone, date_of_birth, sex)
     VALUES ($1, $2, $3, '1995-05-15', 'male')
     RETURNING id`,
    ["Rajesh Sharma", testPatientEmail, "9876500001"]
  );
  testPatientId = patRes.rows[0].id;

  // 3. Create test order
  const orderRes = await pool.query(
    `INSERT INTO orders (patient_id, lab_id, order_status, payment_status, total_amount)
     VALUES ($1, $2, 'completed', 'paid', 500)
     RETURNING id`,
    [testPatientId, labId]
  );
  const orderId = orderRes.rows[0].id;

  // 4. Create sample report file on disk
  testReportStorageKey = `test-report-${Date.now()}.pdf`;
  const reportFilePath = path.join(STORAGE_DIR, testReportStorageKey);
  fs.writeFileSync(reportFilePath, "%PDF-1.4 Mock PublicLab Medical Report Data");

  // 5. Insert published report linked to patient
  const reportRes = await pool.query(
    `INSERT INTO reports (
       order_id, patient_id, lab_id, storage_provider, storage_key,
       filename, original_filename, mime_type, file_size_bytes, status, published_at
     )
     VALUES ($1, $2, $3, 'local', $4, $5, 'Complete_Blood_Count.pdf', 'application/pdf', 42, 'published', NOW())
     RETURNING id`,
    [orderId, testPatientId, labId, testReportStorageKey, testReportStorageKey]
  );
  testReportId = reportRes.rows[0].id;
});

after(async () => {
  // Clean up test records
  try {
    if (testReportId) {
      await pool.query("DELETE FROM reports WHERE id = $1", [testReportId]);
    }
    if (testPatientId) {
      await pool.query("DELETE FROM orders WHERE patient_id = $1", [testPatientId]);
      await pool.query("DELETE FROM email_otps WHERE LOWER(email) = LOWER($1)", [testPatientEmail]);
      await pool.query("DELETE FROM patients WHERE id = $1", [testPatientId]);
    }
    if (testReportStorageKey) {
      const filePath = path.join(STORAGE_DIR, testReportStorageKey);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
  } catch (err) {
    console.error("Cleanup error:", err);
  } finally {
    await pool.end();
  }
});

test("Patient Report Flow: 1. Rejects unknown email with 404", async () => {
  const server = app.listen(0);
  const port = server.address().port;

  try {
    const res = await fetch(`http://localhost:${port}/api/v1/reports/request-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "nonexistent.patient.404@example.com" }),
    });
    const data = await res.json();

    assert.strictEqual(res.status, 404);
    assert.strictEqual(data.success, false);
    assert.match(data.message, /No patient record found/i);
  } finally {
    server.close();
  }
});

test("Patient Report Flow: 2. Generates 6-digit OTP for non-user patient and verifies OTP", async () => {
  const server = app.listen(0);
  const port = server.address().port;

  try {
    // Request OTP
    const reqRes = await fetch(`http://localhost:${port}/api/v1/reports/request-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: testPatientEmail }),
    });
    const reqData = await reqRes.json();

    assert.strictEqual(reqRes.status, 200);
    assert.strictEqual(reqData.success, true);
    assert.ok(reqData.devOtp, "devOtp should be present in non-production mode");
    const otp = reqData.devOtp;
    assert.strictEqual(otp.length, 6);

    // Verify rejection with wrong OTP
    const wrongRes = await fetch(`http://localhost:${port}/api/v1/reports/verify-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: testPatientEmail, otp: "000000" }),
    });
    const wrongData = await wrongRes.json();
    assert.strictEqual(wrongRes.status, 400);
    assert.match(wrongData.message, /Invalid verification code/i);

    // Verify success with correct OTP
    const verifyRes = await fetch(`http://localhost:${port}/api/v1/reports/verify-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: testPatientEmail, otp }),
    });
    const verifyData = await verifyRes.json();

    assert.strictEqual(verifyRes.status, 200);
    assert.strictEqual(verifyData.success, true);
    assert.ok(verifyData.data.accessToken, "Should return JWT accessToken");
    assert.strictEqual(verifyData.data.patient.email, testPatientEmail);
    assert.ok(Array.isArray(verifyData.data.reports), "Should return reports array");
    assert.ok(verifyData.data.reports.length >= 1, "Should contain the published test report");
    assert.strictEqual(Number(verifyData.data.reports[0].id), Number(testReportId));

    // Test secure download with returned accessToken
    const downloadRes = await fetch(
      `http://localhost:${port}/api/v1/reports/${testReportId}/download`,
      {
        headers: {
          Authorization: `Bearer ${verifyData.data.accessToken}`,
        },
      }
    );
    assert.strictEqual(downloadRes.status, 200);
    const content = await downloadRes.text();
    assert.match(content, /Mock PublicLab Medical Report Data/);
  } finally {
    server.close();
  }
});
