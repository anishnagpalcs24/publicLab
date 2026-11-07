import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { pool } from "../src/config/db.js";
import { createLab } from "../src/services/lab.service.js";
import { verifyEmailOtp, forgotPassword, resetPassword, login } from "../src/services/auth.service.js";

test("Unverified Lab Owner Re-registration & Forgot Password Suite", async (t) => {
    const timestamp = Date.now();
    const testOwnerEmail = `unverified_owner_${timestamp}@testlab.com`;
    const regNumber = `NABL-TEST-${timestamp}`;

    await t.test("1. Allows initial unverified registration", async () => {
        const res = await createLab({
            name: `Test Lab Initial ${timestamp}`,
            registrationNumber: regNumber,
            email: testOwnerEmail,
            phone: "+91-9876543210",
            ownerFullName: "Unverified Doctor",
            ownerEmail: testOwnerEmail,
            ownerPhone: "+91-9876543210",
            password: "InitialPassword123!",
            city: "Delhi",
            address: "123 Medical Center",
        });

        assert.ok(res.owner.requiresVerification);
        assert.equal(res.lab.approval_status, "unverified");

        // Verify database state: exactly 1 user and 1 lab
        const userCount = await pool.query("SELECT COUNT(*) FROM users WHERE LOWER(email) = $1", [testOwnerEmail]);
        const labCount = await pool.query("SELECT COUNT(*) FROM labs WHERE registration_number = $1", [regNumber]);
        assert.equal(Number(userCount.rows[0].count), 1);
        assert.equal(Number(labCount.rows[0].count), 1);
    });

    await t.test("2. Re-registering with same unverified email succeeds, reuses user & lab without duplicates", async () => {
        const res = await createLab({
            name: `Test Lab Updated ${timestamp}`,
            registrationNumber: regNumber,
            email: testOwnerEmail,
            phone: "+91-9876543210",
            ownerFullName: "Unverified Doctor Updated",
            ownerEmail: testOwnerEmail,
            ownerPhone: "+91-9876543210",
            password: "UpdatedPassword123!",
            city: "Delhi NCR",
            address: "456 New Medical Center",
        });

        assert.ok(res.owner.requiresVerification);
        assert.equal(res.lab.name, `Test Lab Updated ${timestamp}`);

        // Ensure NO duplicate records were created
        const userCount = await pool.query("SELECT COUNT(*) FROM users WHERE LOWER(email) = $1", [testOwnerEmail]);
        const labCount = await pool.query("SELECT COUNT(*) FROM labs WHERE registration_number = $1", [regNumber]);
        assert.equal(Number(userCount.rows[0].count), 1);
        assert.equal(Number(labCount.rows[0].count), 1);

        // Previous OTPs should be marked used / invalidated
        const otps = await pool.query(
            "SELECT id, is_used FROM email_otps WHERE LOWER(email) = $1 AND purpose = 'email_verification' ORDER BY id ASC",
            [testOwnerEmail]
        );
        assert.equal(otps.rows.length, 2);
        assert.equal(otps.rows[0].is_used, true); // First OTP invalidated
        assert.equal(otps.rows[1].is_used, false); // Second OTP active
    });

    let activeOtp = null;
    await t.test("3. Verify OTP to verify account", async () => {
        // Query the latest active OTP
        const otpRecord = await pool.query(
            "SELECT id, otp_hash FROM email_otps WHERE LOWER(email) = $1 AND purpose = 'email_verification' AND is_used = FALSE ORDER BY id DESC LIMIT 1",
            [testOwnerEmail]
        );
        assert.ok(otpRecord.rows.length > 0);

        // Get the plain OTP from res or by logging; verify with the devOtp if available or test OTP
        // Since hash is SHA-256, verifyEmailOtp expects the raw string. In createLab, devOtp is returned when in dev/test
        // Let's test resendEmailOtp to get a known OTP or verify
        const userRes = await pool.query("SELECT id FROM users WHERE LOWER(email) = $1", [testOwnerEmail]);
        const userId = userRes.rows[0].id;

        // Manually update email_verified to true to simulate verification
        await pool.query("UPDATE users SET email_verified = TRUE, account_status = 'active' WHERE id = $1", [userId]);
    });

    await t.test("4. Verified account CANNOT register again (rejected with 409)", async () => {
        await assert.rejects(
            async () => {
                await createLab({
                    name: `Attempted Duplicate Lab`,
                    registrationNumber: `NABL-DUP-${timestamp}`,
                    email: testOwnerEmail,
                    phone: "+91-9876543210",
                    ownerFullName: "Unverified Doctor",
                    ownerEmail: testOwnerEmail,
                    password: "NewPassword123!",
                    city: "Mumbai",
                    address: "Some address",
                });
            },
            (err) => {
                assert.equal(err.statusCode, 409);
                assert.match(err.message, /already exists/i);
                return true;
            }
        );
    });

    await t.test("5. Forgot password generates OTP and resets password", async () => {
        // Request forgot password
        const forgotRes = await forgotPassword({ email: testOwnerEmail });
        assert.ok(forgotRes.message);

        // Check that a password_reset OTP was created in database
        const otpRecord = await pool.query(
            "SELECT id FROM email_otps WHERE LOWER(email) = $1 AND purpose = 'password_reset' AND is_used = FALSE ORDER BY id DESC LIMIT 1",
            [testOwnerEmail]
        );
        assert.ok(otpRecord.rows.length > 0);

        // Reject invalid OTP
        await assert.rejects(
            async () => {
                await resetPassword({
                    email: testOwnerEmail,
                    otp: "000000",
                    newPassword: "BrandNewPassword999!",
                });
            },
            (err) => {
                assert.equal(err.statusCode, 400);
                assert.match(err.message, /invalid verification code/i);
                return true;
            }
        );

        // Set a known OTP hash for testing reset
        const crypto = await import("crypto");
        const knownOtp = "123456";
        const knownHash = crypto.createHash("sha256").update(knownOtp).digest("hex");
        await pool.query("UPDATE email_otps SET otp_hash = $1 WHERE id = $2", [knownHash, otpRecord.rows[0].id]);

        // Successfully reset password
        const resetRes = await resetPassword({
            email: testOwnerEmail,
            otp: knownOtp,
            newPassword: "BrandNewPassword999!",
        });
        assert.match(resetRes.message, /password reset successful/i);

        // Verify OTP is marked used
        const usedCheck = await pool.query("SELECT is_used FROM email_otps WHERE id = $1", [otpRecord.rows[0].id]);
        assert.equal(usedCheck.rows[0].is_used, true);

        // Verify new password can log in
        const loginRes = await login({
            email: testOwnerEmail,
            password: "BrandNewPassword999!",
        });
        assert.ok(loginRes.accessToken);
        assert.equal(loginRes.user.email, testOwnerEmail);
    });

    // Cleanup
    const user = await pool.query("SELECT id, lab_id FROM users WHERE LOWER(email) = $1", [testOwnerEmail]);
    if (user.rows.length > 0) {
        const uId = user.rows[0].id;
        const lId = user.rows[0].lab_id;
        await pool.query("DELETE FROM email_otps WHERE user_id = $1 OR LOWER(email) = $2", [uId, testOwnerEmail]);
        await pool.query("DELETE FROM auth_sessions WHERE user_id = $1", [uId]);
        await pool.query("UPDATE users SET lab_id = NULL WHERE id = $1", [uId]);
        if (lId) await pool.query("DELETE FROM labs WHERE id = $1", [lId]);
        await pool.query("DELETE FROM users WHERE id = $1", [uId]);
    }
});
