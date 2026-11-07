import test from "node:test";
import assert from "node:assert";
import crypto from "crypto";
import app from "../src/app.js";
import { pool } from "../src/config/db.js";

test("Lab Owner Portal E2E: Registration -> Application -> Profile -> Patients -> Orders -> Reports -> Dashboard -> Calculators -> Calculations", async () => {
  const server = app.listen(0);
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}/api/v1`;

  const uniqueSuffix = Date.now();
  const ownerEmail = `lab_director_${uniqueSuffix}@publiclab.test`;
  const ownerPassword = "LabSecurePassword2026!";

  // 1. Register an admin user directly in DB for administrative reviews
  const adminRes = await pool.query(
    `INSERT INTO users (full_name, email, password_hash, role, account_status, email_verified)
     VALUES ('Super Admin', $1, 'placeholder', 'admin', 'active', TRUE)
     RETURNING id`,
    [`admin_${uniqueSuffix}@publiclab.test`]
  );
  const adminId = adminRes.rows[0].id;

  // Sign an admin token
  const { default: jwt } = await import("jsonwebtoken");
  const secret = process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET;
  const adminToken = jwt.sign(
    { sub: String(adminId), id: adminId, role: "admin" },
    secret,
    { expiresIn: "1h" }
  );

  let labId = null;
  let ownerUserId = null;
  let patientId = null;

  try {
    // -------------------------------------------------------------------------
    // 1. COMBINED LAB & OWNER REGISTRATION (Single POST /api/v1/labs Form)
    // -------------------------------------------------------------------------
    const combinedRegRes = await fetch(`${baseUrl}/labs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        // Lab Details
        name: `Curie Diagnostic Pathology ${uniqueSuffix}`,
        registrationNumber: `REG-LAB-${uniqueSuffix}`,
        email: `lab_${uniqueSuffix}@curielabs.com`,
        phone: `+91-9${String(uniqueSuffix).slice(-9)}`,
        description: "State-of-the-art diagnostic laboratory",
        address: "101 Science Park, Central Avenue",
        city: "Mumbai",
        operatingHours: {
          monday_friday: "07:00 - 21:00",
          saturday: "08:00 - 18:00",
          sunday: "09:00 - 14:00",
        },
        services: ["Biochemistry", "Hematology", "Endocrinology", "Renal Profiles"],
        sampleCollectionAvailable: true,

        // Owner Account Details
        ownerFullName: "Dr. Marie Curie",
        ownerEmail,
        ownerPhone: `+91-8${String(uniqueSuffix).slice(-9)}`,
        password: ownerPassword,

        // Optional Technical Contact Details
        technicalContactName: "Dr. Pierre Curie",
        technicalContactEmail: `tech_${uniqueSuffix}@curielabs.com`,
        technicalContactPhone: `+91-7${String(uniqueSuffix).slice(-9)}`,
      }),
    });
    const combinedData = await combinedRegRes.json();
    assert.strictEqual(combinedRegRes.status, 201, "Combined lab registration should succeed");
    assert.strictEqual(combinedData.success, true);
    assert.strictEqual(combinedData.data.approval_status, "unverified");
    assert.strictEqual(
      combinedData.message,
      "Registration details received. Please verify your email to submit your application for administrator review."
    );
    assert.strictEqual(combinedData.data.owner.requiresVerification, true);
    assert.strictEqual(combinedData.data.owner.role, "lab");
    labId = combinedData.data.id;
    ownerUserId = combinedData.data.owner.id;

    // Verify OTP record exists for owner
    const otpQuery = await pool.query(
      `SELECT otp_hash FROM email_otps WHERE LOWER(email) = LOWER($1) ORDER BY created_at DESC LIMIT 1`,
      [ownerEmail]
    );
    assert.ok(otpQuery.rows.length > 0, "Email verification OTP must be created for owner");

    // Verify OTP via API to activate owner and transition lab to pending
    const testOtp = "654321";
    const testHash = crypto.createHash("sha256").update(testOtp).digest("hex");
    await pool.query(
      `UPDATE email_otps SET otp_hash = $1 WHERE id = (SELECT id FROM email_otps WHERE LOWER(email) = LOWER($2) ORDER BY id DESC LIMIT 1)`,
      [testHash, ownerEmail]
    );

    const verifyOtpRes = await fetch(`${baseUrl}/auth/verify-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: ownerEmail, otp: testOtp }),
    });
    assert.strictEqual(verifyOtpRes.status, 200, "OTP verification should succeed");

    // -------------------------------------------------------------------------
    // 2. LOGIN (Using credentials created in combined form)
    // -------------------------------------------------------------------------
    const loginRes = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: ownerEmail,
        password: ownerPassword,
      }),
    });
    const loginData = await loginRes.json();
    assert.strictEqual(loginRes.status, 200, "Login should succeed with combined registration credentials");
    const accessToken = loginData.data.accessToken;
    assert.ok(accessToken, "Access token must be returned");

    // -------------------------------------------------------------------------
    // 3. CHECK APPLICATION STATUS
    // -------------------------------------------------------------------------
    const statusRes = await fetch(`${baseUrl}/labs/application/status`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const statusData = await statusRes.json();
    assert.strictEqual(statusRes.status, 200);
    assert.strictEqual(statusData.data.approvalStatus, "pending");
    assert.strictEqual(statusData.data.canResubmit, false);

    // -------------------------------------------------------------------------
    // 4. ADMIN APPROVES LAB
    // -------------------------------------------------------------------------
    const reviewRes = await fetch(`${baseUrl}/labs/admin/applications/${labId}/review`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        status: "approved",
        reason: "Compliance verified and documents authenticated",
      }),
    });
    const reviewData = await reviewRes.json();
    assert.strictEqual(reviewRes.status, 200, "Admin approval should succeed");
    assert.strictEqual(reviewData.data.approval_status, "approved");

    // Re-issue token with updated labId and role for owner
    const labToken = jwt.sign(
      { sub: String(ownerUserId), id: ownerUserId, role: "lab", labId: Number(labId) },
      secret,
      { expiresIn: "1h" }
    );

    // -------------------------------------------------------------------------
    // 6. GET & UPDATE LAB PROFILE
    // -------------------------------------------------------------------------
    const profileRes = await fetch(`${baseUrl}/labs/me`, {
      headers: { Authorization: `Bearer ${labToken}` },
    });
    const profileData = await profileRes.json();
    assert.strictEqual(profileRes.status, 200);
    assert.strictEqual(profileData.data.approval_status, "approved");

    const updateLabRes = await fetch(`${baseUrl}/labs/me`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${labToken}`,
      },
      body: JSON.stringify({
        description: "Updated premier pathology centre",
        sampleCollectionAvailable: true,
      }),
    });
    const updateLabData = await updateLabRes.json();
    assert.strictEqual(updateLabRes.status, 200);
    assert.strictEqual(updateLabData.data.description, "Updated premier pathology centre");

    // -------------------------------------------------------------------------
    // 7. PATIENT REGISTRATION, SEARCH & UPDATE
    // -------------------------------------------------------------------------
    const patientRes = await fetch(`${baseUrl}/patients`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${labToken}`,
      },
      body: JSON.stringify({
        fullName: "Rohan Sharma",
        dateOfBirth: "1985-05-15",
        sex: "male",
        phone: "+91-9988776655",
        email: "rohan.sharma@example.test",
        address: "Flat 4B, Green Meadows, Mumbai",
        localPatientCode: `P-CURIE-${uniqueSuffix}`,
      }),
    });
    const patientData = await patientRes.json();
    assert.strictEqual(patientRes.status, 201, "Patient should be registered");
    patientId = patientData.data.id;

    // Search patient
    const searchRes = await fetch(`${baseUrl}/patients?search=Rohan`, {
      headers: { Authorization: `Bearer ${labToken}` },
    });
    const searchData = await searchRes.json();
    assert.strictEqual(searchRes.status, 200);
    assert.ok(searchData.data.length > 0, "Patient search should find registered patient");

    // Update patient
    const updatePatientRes = await fetch(`${baseUrl}/patients/${patientId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${labToken}`,
      },
      body: JSON.stringify({
        phone: "+91-9988776600",
      }),
    });
    const updatePatientData = await updatePatientRes.json();
    assert.strictEqual(updatePatientRes.status, 200);
    assert.strictEqual(updatePatientData.data.phone, "+91-9988776600");

    // -------------------------------------------------------------------------
    // 8. ORDER CREATION WITH MULTIPLE ITEMS & STATUS MANAGEMENT
    // -------------------------------------------------------------------------
    const orderRes = await fetch(`${baseUrl}/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${labToken}`,
      },
      body: JSON.stringify({
        patientId,
        items: [
          { testId: 101, quantity: 1, unitPrice: 450.0 }, // Kidney Function Test
          { testId: 102, quantity: 1, unitPrice: 350.0 }, // Lipid Profile
        ],
        notes: "Routine fasting health checkup",
        sampleCollectedAt: new Date().toISOString(),
      }),
    });
    const orderData = await orderRes.json();
    assert.strictEqual(orderRes.status, 201, "Order should be created");
    const orderId = orderData.data.id;
    assert.strictEqual(Number(orderData.data.total_amount), 800.0);
    assert.strictEqual(orderData.data.items.length, 2);

    // Update order status to in_progress
    const updateOrderRes = await fetch(`${baseUrl}/orders/${orderId}/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${labToken}`,
      },
      body: JSON.stringify({
        status: "in_progress",
        notes: "Sample processing underway in biochemistry analyser",
      }),
    });
    const updateOrderData = await updateOrderRes.json();
    assert.strictEqual(updateOrderRes.status, 200);
    assert.strictEqual(updateOrderData.data.order_status, "processing");

    // -------------------------------------------------------------------------
    // 9. MEDICAL REPORT UPLOAD, PUBLISHING, CORRECTION & DOWNLOAD
    // -------------------------------------------------------------------------
    const samplePdfBase64 = Buffer.from(
      "%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF"
    ).toString("base64");

    const reportRes = await fetch(`${baseUrl}/reports`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${labToken}`,
      },
      body: JSON.stringify({
        orderId,
        patientId,
        fileData: samplePdfBase64,
        filename: "KFT_Lipid_Report.pdf",
        mimeType: "application/pdf",
      }),
    });
    const reportData = await reportRes.json();
    assert.strictEqual(reportRes.status, 201, "Report should be created in draft state");
    const reportId = reportData.data.id;
    assert.strictEqual(reportData.data.status, "draft");

    // Publish report
    const pubRes = await fetch(`${baseUrl}/reports/${reportId}/publish`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${labToken}` },
    });
    const pubData = await pubRes.json();
    assert.strictEqual(pubRes.status, 200);
    assert.strictEqual(pubData.data.status, "published");

    // Correct report with new version
    const correctRes = await fetch(`${baseUrl}/reports/${reportId}/correct`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${labToken}`,
      },
      body: JSON.stringify({
        fileData: samplePdfBase64,
        filename: "KFT_Lipid_Report_v2.pdf",
        reason: "Adjusted HDL calculation post-recalibration",
      }),
    });
    const correctData = await correctRes.json();
    assert.strictEqual(correctRes.status, 200);
    assert.strictEqual(correctData.data.status, "corrected");
    assert.strictEqual(correctData.data.versionNumber, 1);

    // Download report
    const downloadRes = await fetch(`${baseUrl}/reports/${reportId}/download`, {
      headers: { Authorization: `Bearer ${labToken}` },
    });
    assert.strictEqual(downloadRes.status, 200, "Report download should succeed");
    assert.strictEqual(downloadRes.headers.get("content-type"), "application/pdf");

    // -------------------------------------------------------------------------
    // 10. LAB DASHBOARD
    // -------------------------------------------------------------------------
    const dashRes = await fetch(`${baseUrl}/labs/me/dashboard`, {
      headers: { Authorization: `Bearer ${labToken}` },
    });
    const dashData = await dashRes.json();
    assert.strictEqual(dashRes.status, 200, "Dashboard retrieval should succeed");
    assert.strictEqual(dashData.data.patients.total, 1);
    assert.strictEqual(dashData.data.orders.total, 1);
    assert.strictEqual(dashData.data.reports.total, 1);

    // -------------------------------------------------------------------------
    // 11. CLINICAL CALCULATORS (Pure computation)
    // -------------------------------------------------------------------------
    // eGFR (CKD-EPI 2021)
    const egfrRes = await fetch(`${baseUrl}/labs/calculator/calculate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${labToken}`,
      },
      body: JSON.stringify({
        type: "egfr",
        inputs: {
          serumCreatinine: 1.1,
          age: 45,
          sex: "male",
        },
      }),
    });
    const egfrData = await egfrRes.json();
    assert.strictEqual(egfrRes.status, 200);
    assert.strictEqual(egfrData.data.calculatorType, "egfr");
    assert.ok(egfrData.data.resultValue > 70 && egfrData.data.resultValue < 95);
    assert.strictEqual(egfrData.data.resultUnit, "mL/min/1.73 m²");

    // LDL (Friedewald)
    const ldlRes = await fetch(`${baseUrl}/labs/calculator/calculate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${labToken}`,
      },
      body: JSON.stringify({
        type: "ldl",
        inputs: {
          totalCholesterol: 220,
          hdl: 50,
          triglycerides: 150,
        },
      }),
    });
    const ldlData = await ldlRes.json();
    assert.strictEqual(ldlRes.status, 200);
    // LDL = 220 - 50 - (150 / 5) = 140 mg/dL
    assert.strictEqual(ldlData.data.resultValue, 140);
    assert.strictEqual(ldlData.data.resultUnit, "mg/dL");

    // HOMA-IR
    const homaRes = await fetch(`${baseUrl}/labs/calculator/calculate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${labToken}`,
      },
      body: JSON.stringify({
        type: "homa_ir",
        inputs: {
          fastingInsulin: 12,
          fastingGlucose: 95,
        },
      }),
    });
    const homaData = await homaRes.json();
    assert.strictEqual(homaRes.status, 200);
    // HOMA-IR = (12 * 95) / 405 = 2.81
    assert.strictEqual(homaData.data.resultValue, 2.81);

    // FAI
    const faiRes = await fetch(`${baseUrl}/labs/calculator/calculate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${labToken}`,
      },
      body: JSON.stringify({
        type: "fai",
        inputs: {
          totalTestosterone: 4.2,
          shbg: 60,
        },
      }),
    });
    const faiData = await faiRes.json();
    assert.strictEqual(faiRes.status, 200);
    // FAI = (4.2 / 60) * 100 = 7.00
    assert.strictEqual(faiData.data.resultValue, 7.0);

    // -------------------------------------------------------------------------
    // 12. SAVE CLINICAL CALCULATION & PATIENT HISTORY
    // -------------------------------------------------------------------------
    const saveCalcRes = await fetch(`${baseUrl}/labs/calculations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${labToken}`,
      },
      body: JSON.stringify({
        type: "egfr",
        patientId,
        inputs: {
          serumCreatinine: 1.1,
          age: 45,
          sex: "male",
        },
        notes: "Baseline renal evaluation prior to starting medication",
      }),
    });
    const saveCalcData = await saveCalcRes.json();
    assert.strictEqual(saveCalcRes.status, 201, "Calculation should be saved");
    const calculationId = saveCalcData.data.id;

    // List calculations for lab
    const listCalcRes = await fetch(`${baseUrl}/labs/calculations`, {
      headers: { Authorization: `Bearer ${labToken}` },
    });
    const listCalcData = await listCalcRes.json();
    assert.strictEqual(listCalcRes.status, 200);
    assert.ok(listCalcData.data.length >= 1);

    // Get patient-specific calculation history
    const patientCalcRes = await fetch(`${baseUrl}/patients/${patientId}/calculations`, {
      headers: { Authorization: `Bearer ${labToken}` },
    });
    const patientCalcData = await patientCalcRes.json();
    assert.strictEqual(patientCalcRes.status, 200);
    assert.strictEqual(patientCalcData.data.length, 1);
    assert.strictEqual(patientCalcData.data[0].calculator_type, "egfr");

    // -------------------------------------------------------------------------
    // 13. FORGOT PASSWORD & RESET PASSWORD WORKFLOW
    // -------------------------------------------------------------------------
    const forgotRes = await fetch(`${baseUrl}/auth/forgot-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: ownerEmail }),
    });
    const forgotData = await forgotRes.json();
    assert.strictEqual(forgotRes.status, 200);

    // Get reset OTP from DB
    const resetOtpQuery = await pool.query(
      `SELECT otp_hash FROM email_otps WHERE LOWER(email) = LOWER($1) AND purpose = 'password_reset' ORDER BY created_at DESC LIMIT 1`,
      [ownerEmail]
    );
    assert.ok(resetOtpQuery.rows.length > 0, "Password reset OTP must be recorded");

    // Re-hash a known 6-digit code for testing the reset
    const testResetCode = "654321";
    const testResetHash = crypto.createHash("sha256").update(testResetCode).digest("hex");
    await pool.query(
      `UPDATE email_otps SET otp_hash = $1 WHERE id = (
         SELECT id FROM email_otps WHERE LOWER(email) = LOWER($2) AND purpose = 'password_reset' ORDER BY created_at DESC LIMIT 1
       )`,
      [testResetHash, ownerEmail]
    );

    const resetRes = await fetch(`${baseUrl}/auth/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: ownerEmail,
        otp: testResetCode,
        newPassword: "BrandNewPassword2026!",
      }),
    });
    const resetData = await resetRes.json();
    assert.strictEqual(resetRes.status, 200, "Password reset should succeed");

    // Confirm login with new password
    const newLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: ownerEmail,
        password: "BrandNewPassword2026!",
      }),
    });
    assert.strictEqual(newLoginRes.status, 200, "Login with new password must succeed");
  } finally {
    server.close();
    try {
      if (labId) {
        await pool.query("DELETE FROM report_versions WHERE report_id IN (SELECT id FROM reports WHERE lab_id = $1)", [labId]);
        await pool.query("DELETE FROM reports WHERE lab_id = $1", [labId]);
        await pool.query("DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE lab_id = $1)", [labId]);
        await pool.query("DELETE FROM orders WHERE lab_id = $1", [labId]);
        await pool.query("DELETE FROM clinical_calculations WHERE lab_id = $1", [labId]);
        await pool.query("DELETE FROM lab_patient_refs WHERE lab_id = $1", [labId]);
        if (patientId) {
          await pool.query("DELETE FROM patients WHERE id = $1", [patientId]);
        }
        await pool.query("UPDATE users SET lab_id = NULL WHERE lab_id = $1", [labId]);
        await pool.query("DELETE FROM labs WHERE id = $1", [labId]);
      }
      if (ownerUserId) {
        await pool.query("DELETE FROM auth_sessions WHERE user_id = $1", [ownerUserId]);
        await pool.query("DELETE FROM email_otps WHERE user_id = $1", [ownerUserId]);
        await pool.query("DELETE FROM users WHERE id = $1", [ownerUserId]);
      }
      if (adminId) {
        await pool.query("DELETE FROM auth_sessions WHERE user_id = $1", [adminId]);
        await pool.query("DELETE FROM users WHERE id = $1", [adminId]);
      }
    } catch (cleanupErr) {
      console.warn("Cleanup error in test:", cleanupErr.message);
    }
  }
});
