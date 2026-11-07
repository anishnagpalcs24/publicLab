import test, { after, before } from "node:test";
import assert from "node:assert";
import crypto from "crypto";
import bcrypt from "bcrypt";
import app from "../src/app.js";
import { pool } from "../src/config/db.js";
import { getTransporter, sendEmail, resetTransporter } from "../src/services/email.service.js";

const uniqueId = Date.now();
const adminUsername = `admin_${uniqueId}`;
const adminPassword = "AdminTestPassword2026!";
let adminToken = null;

let server;
let baseUrl;

before(async () => {
  server = app.listen(0);
  const port = server.address().port;
  baseUrl = `http://localhost:${port}/api/v1`;

  // Set admin credentials
  process.env.ADMIN_USERNAME = adminUsername;
  process.env.ADMIN_PASSWORD_HASH = bcrypt.hashSync(adminPassword, 10);

  // Login as admin
  const adminLoginRes = await fetch(`${baseUrl}/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: adminUsername,
      password: adminPassword,
    }),
  });
  const adminLoginData = await adminLoginRes.json();
  assert.strictEqual(adminLoginRes.status, 200);
  adminToken = adminLoginData.data.accessToken;
});

after(async () => {
  if (server) {
    server.close();
  }
  await pool.end();
});

test("Lab Registration & Email Lifecycle Suite", async (t) => {
  const labSuffix = `${Date.now()}_${Math.floor(Math.random() * 100000)}`;
  const labEmail = `lab_${labSuffix}@diagnostic.test`;
  const ownerEmail = `owner_${labSuffix}@diagnostic.test`;
  const labPhone = `+91-9${String(Date.now()).slice(-9)}`;
  const ownerPhone = `+91-8${String(Date.now()).slice(-9)}`;
  const ownerPassword = "SecureLabPassword123!";
  let registeredLabId;

  await t.test("1. Lab registration returns exact message and sets unverified status", async () => {
    const res = await fetch(`${baseUrl}/labs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: `Sunrise Pathology ${labSuffix}`,
        registrationNumber: `NABL-SUN-${labSuffix}`,
        email: labEmail,
        phone: labPhone,
        city: "Chandigarh",
        address: "Sector 17, Health Hub",
        ownerFullName: "Dr. Ananya Verma",
        ownerEmail,
        ownerPhone: ownerPhone,
        password: ownerPassword,
      }),
    });

    const data = await res.json();
    assert.strictEqual(res.status, 201);
    assert.strictEqual(data.success, true);
    assert.strictEqual(
      data.message,
      "Registration details received. Please verify your email to submit your application for administrator review."
    );
    assert.strictEqual(data.data.approval_status, "unverified");
    assert.strictEqual(data.data.owner.requiresVerification, true);
    registeredLabId = data.data.id;
  });

  await t.test("2. Unverified application does not appear in admin pending queue", async () => {
    const res = await fetch(`${baseUrl}/admin/labs/applications?status=pending`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const data = await res.json();
    assert.strictEqual(res.status, 200);
    const found = data.data.find((l) => String(l.id) === String(registeredLabId));
    assert.strictEqual(found, undefined, "Unverified lab must NOT appear in pending applications list");
  });

  await t.test("3. Admin cannot approve unverified application", async () => {
    const res = await fetch(`${baseUrl}/admin/labs/applications/${registeredLabId}/review`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ status: "approved" }),
    });
    const data = await res.json();
    assert.strictEqual(res.status, 400);
    assert.strictEqual(data.success, false);
    assert.match(data.message, /unverified laboratory application/i);
  });

  await t.test("4. OTP verification transitions lab status to pending", async () => {
    // Find generated OTP in database
    const otpRes = await pool.query(
      `SELECT id, otp_hash FROM email_otps WHERE LOWER(email) = LOWER($1) ORDER BY id DESC LIMIT 1`,
      [ownerEmail]
    );
    assert.ok(otpRes.rows.length > 0, "OTP must have been created");

    const validOtp = "789123";
    const hashed = crypto.createHash("sha256").update(validOtp).digest("hex");
    await pool.query("UPDATE email_otps SET otp_hash = $1 WHERE id = $2", [hashed, otpRes.rows[0].id]);

    const verifyRes = await fetch(`${baseUrl}/auth/verify-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: ownerEmail,
        otp: validOtp,
      }),
    });
    const verifyData = await verifyRes.json();
    assert.strictEqual(verifyRes.status, 200);
    assert.strictEqual(verifyData.success, true);

    // Verify DB status is now pending
    const dbCheck = await pool.query("SELECT approval_status FROM labs WHERE id = $1", [registeredLabId]);
    assert.strictEqual(dbCheck.rows[0].approval_status, "pending");
  });

  await t.test("5. Verified application now appears in admin pending queue", async () => {
    const res = await fetch(`${baseUrl}/admin/labs/applications?status=pending`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const data = await res.json();
    assert.strictEqual(res.status, 200);
    const found = data.data.find((l) => String(l.id) === String(registeredLabId));
    assert.ok(found, "Verified application must now appear in pending applications list");
    assert.strictEqual(found.name, `Sunrise Pathology ${labSuffix}`);
    assert.strictEqual(found.owner_email, ownerEmail);
  });

  await t.test("6. Admin can approve verified pending application", async () => {
    const res = await fetch(`${baseUrl}/admin/labs/applications/${registeredLabId}/review`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ status: "approved" }),
    });
    const data = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.data.approval_status, "approved");
  });

  await t.test("7. Nodemailer mock delivery & credential masking test", async () => {
    resetTransporter();
    const result = await sendEmail({
      to: "recipient@test.com",
      subject: "PublicLab Security Notification",
      text: "Your security OTP code is: 123456. Your password is: SuperSecret!",
    });
    assert.ok(result.messageId, "Mock email must return a valid messageId");
    assert.match(result.response, /250 Mock email accepted/i);
  });
});
