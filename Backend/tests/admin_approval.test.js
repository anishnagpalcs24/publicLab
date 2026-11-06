import "dotenv/config";
import test, { after } from "node:test";
import assert from "node:assert";
import crypto from "crypto";
import bcrypt from "bcrypt";
import app from "../src/app.js";
import { pool } from "../src/config/db.js";

after(async () => {
    await pool.end();
});

function extractCookie(res, cookieName) {
    const setCookie = res.headers.get("set-cookie");
    if (!setCookie) return null;
    const match = setCookie.match(new RegExp(`${cookieName}=([^;]+)`));
    return match ? match[1] : null;
}

test("Admin Authentication & Laboratory Approval Suite", async () => {
    const server = app.listen(0);
    const port = server.address().port;
    const baseUrl = `http://localhost:${port}/api/v1`;

    const originalAdminUser = process.env.ADMIN_USERNAME;
    const originalAdminHash = process.env.ADMIN_PASSWORD_HASH;

    const adminUsername = "test_admin";
    const adminPassword = "AdminTestPassword2026!";
    const adminHash = bcrypt.hashSync(adminPassword, 10);

    process.env.ADMIN_USERNAME = adminUsername;
    process.env.ADMIN_PASSWORD_HASH = adminHash;

    const uniqueSuffix = Date.now();

    try {
        // ---------------------------------------------------------------------
        // 1. Correct admin credentials allow login
        // ---------------------------------------------------------------------
        const loginRes = await fetch(`${baseUrl}/admin/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                username: adminUsername,
                password: adminPassword,
            }),
        });
        const loginData = await loginRes.json();
        assert.strictEqual(loginRes.status, 200, "Admin login should succeed with correct credentials");
        assert.strictEqual(loginData.success, true);
        assert.ok(loginData.data.accessToken, "Should return an access token");
        assert.strictEqual(loginData.data.user.role, "admin");

        const adminToken = loginData.data.accessToken;
        const refreshTokenCookie = extractCookie(loginRes, "refreshToken");
        assert.ok(refreshTokenCookie, "Should set HttpOnly refreshToken cookie");

        // ---------------------------------------------------------------------
        // 2. Incorrect credentials are rejected with generic 401 error
        // ---------------------------------------------------------------------
        const badUserRes = await fetch(`${baseUrl}/admin/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                username: "nonexistent_admin",
                password: adminPassword,
            }),
        });
        assert.strictEqual(badUserRes.status, 401);
        const badUserData = await badUserRes.json();
        assert.strictEqual(badUserData.success, false);
        assert.match(badUserData.message, /invalid credentials/i);

        const badPassRes = await fetch(`${baseUrl}/admin/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                username: adminUsername,
                password: "WrongPassword!",
            }),
        });
        assert.strictEqual(badPassRes.status, 401);
        const badPassData = await badPassRes.json();
        assert.strictEqual(badPassData.success, false);
        assert.match(badPassData.message, /invalid credentials/i);

        // ---------------------------------------------------------------------
        // 3. Register a lab & owner; verify lab owners cannot access admin APIs
        // ---------------------------------------------------------------------
        const labRegRes = await fetch(`${baseUrl}/labs`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                name: `Metropolis Labs ${uniqueSuffix}`,
                registrationNumber: `NABL-${uniqueSuffix}`,
                email: `lab_${uniqueSuffix}@metropolis.test`,
                phone: `+91-9${String(uniqueSuffix).slice(-9)}`,
                address: "77 Health Ave",
                city: "Pune",
                ownerFullName: "Dr. Metro",
                ownerEmail: `owner_${uniqueSuffix}@metropolis.test`,
                ownerPhone: `+91-8${String(uniqueSuffix).slice(-9)}`,
                password: "OwnerPassword123!",
            }),
        });
        assert.strictEqual(labRegRes.status, 201, "Lab registration should succeed");
        const labRegData = await labRegRes.json();
        const pendingLabId = labRegData.data.id;
        assert.strictEqual(labRegData.data.approval_status, "pending");

        // Retrieve OTP from DB to verify owner account
        const otpRow = await pool.query(
            `SELECT id, otp_hash FROM email_otps WHERE email = $1 ORDER BY id DESC LIMIT 1`,
            [`owner_${uniqueSuffix}@metropolis.test`]
        );
        assert.ok(otpRow.rows.length > 0);

        const testOtp = "654321";
        const testHash = crypto.createHash("sha256").update(testOtp).digest("hex");
        await pool.query(`UPDATE email_otps SET otp_hash = $1 WHERE id = $2`, [testHash, otpRow.rows[0].id]);

        const verifyRes = await fetch(`${baseUrl}/auth/verify-otp`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                email: `owner_${uniqueSuffix}@metropolis.test`,
                otp: testOtp,
            }),
        });
        assert.strictEqual(verifyRes.status, 200);
        const verifyData = await verifyRes.json();
        const labOwnerToken = verifyData.data.accessToken;

        // Unauthenticated access to admin endpoints must be rejected (401)
        const unauthRes = await fetch(`${baseUrl}/admin/labs/applications`);
        assert.strictEqual(unauthRes.status, 401, "Unauthenticated request should return 401");

        // Lab owner access to admin endpoints must be forbidden (403)
        const labOwnerAdminRes = await fetch(`${baseUrl}/admin/labs/applications`, {
            headers: { Authorization: `Bearer ${labOwnerToken}` },
        });
        assert.strictEqual(labOwnerAdminRes.status, 403, "Lab owner should be forbidden from admin APIs");

        // ---------------------------------------------------------------------
        // 4. Admin lists applications: ALL statuses without filter, and by status
        // ---------------------------------------------------------------------
        // 4a. Without status parameter: MUST return all laboratories across all statuses
        const allAppsRes = await fetch(`${baseUrl}/admin/labs/applications`, {
            headers: { Authorization: `Bearer ${adminToken}` },
        });
        assert.strictEqual(allAppsRes.status, 200);
        const allAppsData = await allAppsRes.json();
        assert.strictEqual(allAppsData.success, true);
        assert.ok(Array.isArray(allAppsData.data), "Should return array of labs");
        const foundInAll = allAppsData.data.find((l) => String(l.id) === String(pendingLabId));
        assert.ok(foundInAll, "Lab must appear in admin listing when status parameter is omitted");

        // 4b. With ?status=pending: returns pending labs
        const appsRes = await fetch(`${baseUrl}/admin/labs/applications?status=pending`, {
            headers: { Authorization: `Bearer ${adminToken}` },
        });
        assert.strictEqual(appsRes.status, 200);
        const appsData = await appsRes.json();
        assert.strictEqual(appsData.success, true);
        assert.ok(Array.isArray(appsData.data), "Should return array of labs");

        const foundApp = appsData.data.find((l) => String(l.id) === String(pendingLabId));
        assert.ok(foundApp, "Pending lab should appear in pending applications list");
        assert.strictEqual(foundApp.name, `Metropolis Labs ${uniqueSuffix}`);
        assert.strictEqual(foundApp.owner_name, "Dr. Metro");
        assert.strictEqual(foundApp.owner_email, `owner_${uniqueSuffix}@metropolis.test`);
        assert.strictEqual(foundApp.address, "77 Health Ave");
        assert.strictEqual(foundApp.city, "Pune");
        assert.ok(foundApp.created_at, "Should show application submission timestamp");

        // ---------------------------------------------------------------------
        // 5. Admin can reject application with reason
        // ---------------------------------------------------------------------
        const rejectRes = await fetch(`${baseUrl}/admin/labs/applications/${pendingLabId}/review`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${adminToken}`,
            },
            body: JSON.stringify({
                status: "rejected",
                reason: "License document unverified",
            }),
        });
        assert.strictEqual(rejectRes.status, 200, "Admin can reject lab application");
        const rejectData = await rejectRes.json();
        assert.strictEqual(rejectData.data.approval_status, "rejected");
        assert.strictEqual(rejectData.data.rejection_reason, "License document unverified");

        // Verify status filtering for rejected lab
        const rejectedAppsRes = await fetch(`${baseUrl}/admin/labs/applications?status=rejected`, {
            headers: { Authorization: `Bearer ${adminToken}` },
        });
        const rejectedAppsData = await rejectedAppsRes.json();
        assert.ok(rejectedAppsData.data.some((l) => String(l.id) === String(pendingLabId)), "Rejected lab should appear in ?status=rejected filter");

        const pendingAfterRejectRes = await fetch(`${baseUrl}/admin/labs/applications?status=pending`, {
            headers: { Authorization: `Bearer ${adminToken}` },
        });
        const pendingAfterRejectData = await pendingAfterRejectRes.json();
        assert.ok(!pendingAfterRejectData.data.some((l) => String(l.id) === String(pendingLabId)), "Rejected lab must not appear in ?status=pending filter");

        // ---------------------------------------------------------------------
        // 6. Persistence & Public visibility check (Rejected / Pending labs not public)
        // ---------------------------------------------------------------------
        const dbCheckRejected = await pool.query(`SELECT approval_status, rejection_reason FROM labs WHERE id = $1`, [pendingLabId]);
        assert.strictEqual(dbCheckRejected.rows[0].approval_status, "rejected");
        assert.strictEqual(dbCheckRejected.rows[0].rejection_reason, "License document unverified");

        const publicSearchRes = await fetch(`${baseUrl}/labs?search=${encodeURIComponent(`Metropolis Labs ${uniqueSuffix}`)}`);
        const publicSearchData = await publicSearchRes.json();
        const labsList = Array.isArray(publicSearchData.data) ? publicSearchData.data : (publicSearchData.data?.labs || []);
        const publicFound = labsList.find((l) => String(l.id) === String(pendingLabId));
        assert.strictEqual(publicFound, undefined, "Rejected lab must not appear in public discovery");

        const publicSingleRes = await fetch(`${baseUrl}/labs/${pendingLabId}`);
        assert.strictEqual(publicSingleRes.status, 404, "Rejected lab profile must return 404 for public access");

        // ---------------------------------------------------------------------
        // 7. Resubmission by owner & subsequent Admin Approval
        // ---------------------------------------------------------------------
        const resubmitRes = await fetch(`${baseUrl}/labs/application/resubmit`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${labOwnerToken}`,
            },
            body: JSON.stringify({
                description: "Updated credentials with accredited certificate",
            }),
        });
        assert.strictEqual(resubmitRes.status, 200, "Lab owner can resubmit rejected application");
        const resubmitData = await resubmitRes.json();
        assert.strictEqual(resubmitData.data.approval_status, "pending");

        // Admin approves application
        const approveRes = await fetch(`${baseUrl}/admin/labs/applications/${pendingLabId}/review`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${adminToken}`,
            },
            body: JSON.stringify({
                status: "approved",
            }),
        });
        assert.strictEqual(approveRes.status, 200, "Admin can approve lab application");
        const approveData = await approveRes.json();
        assert.strictEqual(approveData.data.approval_status, "approved");

        // Verify status filtering for approved lab
        const approvedAppsRes = await fetch(`${baseUrl}/admin/labs/applications?status=approved`, {
            headers: { Authorization: `Bearer ${adminToken}` },
        });
        const approvedAppsData = await approvedAppsRes.json();
        assert.ok(approvedAppsData.data.some((l) => String(l.id) === String(pendingLabId)), "Approved lab should appear in ?status=approved filter");

        const allAfterApproveRes = await fetch(`${baseUrl}/admin/labs/applications`, {
            headers: { Authorization: `Bearer ${adminToken}` },
        });
        const allAfterApproveData = await allAfterApproveRes.json();
        assert.ok(allAfterApproveData.data.some((l) => String(l.id) === String(pendingLabId)), "Approved lab must appear in admin listing without status filter");

        // Approved lab is now publicly accessible
        const publicApprovedRes = await fetch(`${baseUrl}/labs/${pendingLabId}`);
        assert.strictEqual(publicApprovedRes.status, 200, "Approved lab must be publicly visible");
        const publicApprovedData = await publicApprovedRes.json();
        assert.strictEqual(publicApprovedData.data.approval_status, "approved");

        // ---------------------------------------------------------------------
        // 8. Admin Suspends Laboratory & Public Discovery Check
        // ---------------------------------------------------------------------
        const suspendRes = await fetch(`${baseUrl}/admin/labs/${pendingLabId}/suspend`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${adminToken}`,
            },
            body: JSON.stringify({
                reason: "Annual accreditation inspection lapsed",
            }),
        });
        assert.strictEqual(suspendRes.status, 200, "Admin can suspend approved laboratory");
        const suspendData = await suspendRes.json();
        assert.strictEqual(suspendData.data.approval_status, "suspended");
        assert.strictEqual(suspendData.data.suspension_reason, "Annual accreditation inspection lapsed");

        // Verify status filtering for suspended lab
        const suspendedAppsRes = await fetch(`${baseUrl}/admin/labs/applications?status=suspended`, {
            headers: { Authorization: `Bearer ${adminToken}` },
        });
        const suspendedAppsData = await suspendedAppsRes.json();
        assert.ok(suspendedAppsData.data.some((l) => String(l.id) === String(pendingLabId)), "Suspended lab should appear in ?status=suspended filter");

        const approvedAfterSuspendRes = await fetch(`${baseUrl}/admin/labs/applications?status=approved`, {
            headers: { Authorization: `Bearer ${adminToken}` },
        });
        const approvedAfterSuspendData = await approvedAfterSuspendRes.json();
        assert.ok(!approvedAfterSuspendData.data.some((l) => String(l.id) === String(pendingLabId)), "Suspended lab must not appear in ?status=approved filter");

        const allAfterSuspendRes = await fetch(`${baseUrl}/admin/labs/applications`, {
            headers: { Authorization: `Bearer ${adminToken}` },
        });
        const allAfterSuspendData = await allAfterSuspendRes.json();
        assert.ok(allAfterSuspendData.data.some((l) => String(l.id) === String(pendingLabId)), "Suspended lab must appear in unfiltered admin listing");

        // Suspended lab must NOT be publicly visible
        const publicSuspendedRes = await fetch(`${baseUrl}/labs/${pendingLabId}`);
        assert.strictEqual(publicSuspendedRes.status, 404, "Suspended lab profile must return 404 for public access");

        const publicSearchSuspendedRes = await fetch(`${baseUrl}/labs?search=${encodeURIComponent(`Metropolis Labs ${uniqueSuffix}`)}`);
        const publicSearchSuspendedData = await publicSearchSuspendedRes.json();
        const suspendedList = Array.isArray(publicSearchSuspendedData.data) ? publicSearchSuspendedData.data : (publicSearchSuspendedData.data?.labs || []);
        const publicSuspendedFound = suspendedList.find((l) => String(l.id) === String(pendingLabId));
        assert.strictEqual(publicSuspendedFound, undefined, "Suspended lab must not appear in public discovery");

        // ---------------------------------------------------------------------
        // 9. Production response verification (Never expose devOtp in production)
        // ---------------------------------------------------------------------
        const originalEnv = process.env.NODE_ENV;
        try {
            process.env.NODE_ENV = "production";

            const prodLabSuffix = Date.now() + 1;
            const prodLabRes = await fetch(`${baseUrl}/labs`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: `Prod Lab ${prodLabSuffix}`,
                    registrationNumber: `PROD-${prodLabSuffix}`,
                    email: `prod_${prodLabSuffix}@lab.test`,
                    phone: `+91-9${String(prodLabSuffix).slice(-9)}`,
                    address: "100 Production Rd",
                    city: "Bangalore",
                    ownerFullName: "Dr. Prod",
                    ownerEmail: `owner_${prodLabSuffix}@lab.test`,
                    ownerPhone: `+91-8${String(prodLabSuffix).slice(-9)}`,
                    password: "Password123!",
                }),
            });
            const prodLabData = await prodLabRes.json();
            assert.strictEqual(prodLabRes.status, 201);
            assert.strictEqual(prodLabData.data.devOtp, undefined, "devOtp must not exist on root in production");
            assert.strictEqual(prodLabData.data.owner.devOtp, undefined, "devOtp must not exist in owner object in production");
        } finally {
            process.env.NODE_ENV = originalEnv;
        }
    } finally {
        server.close();
        process.env.ADMIN_USERNAME = originalAdminUser;
        process.env.ADMIN_PASSWORD_HASH = originalAdminHash;
        try {
            await pool.query("DELETE FROM email_otps WHERE email LIKE '%@metropolis.test' OR email LIKE '%@lab.test'");
            await pool.query("UPDATE users SET lab_id = NULL WHERE email LIKE '%@metropolis.test' OR email LIKE '%@lab.test'");
            await pool.query("DELETE FROM labs WHERE email LIKE '%@metropolis.test' OR email LIKE '%@lab.test'");
            await pool.query("DELETE FROM auth_sessions WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@metropolis.test' OR email LIKE '%@lab.test' OR email = 'test_admin@publiclab.internal')");
            await pool.query("DELETE FROM users WHERE email LIKE '%@metropolis.test' OR email LIKE '%@lab.test' OR email = 'test_admin@publiclab.internal'");
        } catch (cleanupErr) {
            console.warn("Cleanup error in admin test:", cleanupErr.message);
        }
    }
});
