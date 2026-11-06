import test, { after } from "node:test";
import assert from "node:assert";
import crypto from "crypto";
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

test("Full Production Auth Flow: Register -> OTP Verify -> Login -> Refresh -> Reuse Detection -> Logout -> Logout-all", async () => {
  const server = app.listen(0);
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}/api/v1/auth`;

  const uniqueSuffix = Date.now();
  const testEmail = `doctor_${uniqueSuffix}@publiclab.test`;
  const testPassword = "SuperSecurePassword123!";

  try {
    // 1. REGISTER
    const regRes = await fetch(`${baseUrl}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName: "Dr. Alexander Fleming",
        email: testEmail,
        password: testPassword,
      }),
    });
    const regData = await regRes.json();
    assert.strictEqual(regRes.status, 201);
    assert.strictEqual(regData.success, true);
    assert.strictEqual(regData.data.requiresVerification, true);

    // 2. ATTEMPT LOGIN BEFORE OTP VERIFICATION (Must be forbidden with 403)
    const unverifiedLoginRes = await fetch(`${baseUrl}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: testEmail,
        password: testPassword,
      }),
    });
    const unverifiedData = await unverifiedLoginRes.json();
    assert.strictEqual(unverifiedLoginRes.status, 403);
    assert.strictEqual(unverifiedData.success, false);
    assert.match(unverifiedData.message, /verify your email/i);

    // 3. INVALID OTP VERIFICATION
    const badOtpRes = await fetch(`${baseUrl}/verify-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: testEmail,
        otp: "000000",
      }),
    });
    const badOtpData = await badOtpRes.json();
    assert.strictEqual(badOtpRes.status, 400);
    assert.strictEqual(badOtpData.success, false);

    // Retrieve active OTP from DB for testing
    const otpRow = await pool.query(
      `SELECT id, otp_hash FROM email_otps WHERE email = $1 AND is_used = FALSE ORDER BY id DESC LIMIT 1`,
      [testEmail]
    );
    assert.ok(otpRow.rows.length > 0);

    // Let's set a known OTP hash for testing verification: OTP = '123456'
    const knownOtp = "123456";
    const knownHash = crypto.createHash("sha256").update(knownOtp).digest("hex");
    await pool.query(
      `UPDATE email_otps SET otp_hash = $1 WHERE id = $2`,
      [knownHash, otpRow.rows[0].id]
    );

    // 4. VALID OTP VERIFICATION
    const verifyRes = await fetch(`${baseUrl}/verify-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: testEmail,
        otp: knownOtp,
      }),
    });
    const verifyData = await verifyRes.json();
    assert.strictEqual(verifyRes.status, 200);
    assert.strictEqual(verifyData.success, true);
    assert.ok(verifyData.data.accessToken);
    assert.strictEqual(verifyData.data.user.emailVerified, true);

    const initialRefreshToken = extractCookie(verifyRes, "refreshToken");
    assert.ok(initialRefreshToken, "HttpOnly refreshToken cookie should be set upon verification");

    // 5. LOGIN WITH VERIFIED ACCOUNT
    const loginRes = await fetch(`${baseUrl}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: testEmail,
        password: testPassword,
      }),
    });
    const loginData = await loginRes.json();
    assert.strictEqual(loginRes.status, 200);
    assert.strictEqual(loginData.success, true);
    assert.ok(loginData.data.accessToken);

    const loginAccessToken = loginData.data.accessToken;
    const loginRefreshToken = extractCookie(loginRes, "refreshToken");
    assert.ok(loginRefreshToken);

    // 6. ACCESS PROTECTED /auth/me
    const meRes = await fetch(`${baseUrl}/me`, {
      headers: { Authorization: `Bearer ${loginAccessToken}` },
    });
    const meData = await meRes.json();
    assert.strictEqual(meRes.status, 200);
    assert.strictEqual(meData.data.user.email, testEmail);

    // 7. REFRESH TOKEN ROTATION
    const refreshRes = await fetch(`${baseUrl}/refresh`, {
      method: "POST",
      headers: {
        Cookie: `refreshToken=${loginRefreshToken}`,
      },
    });
    const refreshData = await refreshRes.json();
    assert.strictEqual(refreshRes.status, 200);
    assert.strictEqual(refreshData.success, true);
    assert.ok(refreshData.data.accessToken);

    const rotatedRefreshToken = extractCookie(refreshRes, "refreshToken");
    assert.ok(rotatedRefreshToken);
    assert.notStrictEqual(rotatedRefreshToken, loginRefreshToken, "Refresh token must rotate on each refresh call");

    // 8. REUSE DETECTION (Attempt to reuse old rotated refresh token)
    // The old refresh token should be rejected, and trigger revocation of all sessions for this user!
    const reuseRes = await fetch(`${baseUrl}/refresh`, {
      method: "POST",
      headers: {
        Cookie: `refreshToken=${loginRefreshToken}`,
      },
    });
    const reuseData = await reuseRes.json();
    assert.strictEqual(reuseRes.status, 401);
    assert.strictEqual(reuseData.success, false);
    assert.match(reuseData.message, /reuse detected|revoked/i);

    // 9. VERIFY ALL SESSIONS ARE NOW REVOKED AFTER REUSE DETECTION
    const afterReuseRes = await fetch(`${baseUrl}/refresh`, {
      method: "POST",
      headers: {
        Cookie: `refreshToken=${rotatedRefreshToken}`,
      },
    });
    assert.strictEqual(afterReuseRes.status, 401);

    // 10. NEW LOGIN FOR LOGOUT TESTING
    const login2Res = await fetch(`${baseUrl}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: testEmail,
        password: testPassword,
      }),
    });
    const login2Data = await login2Res.json();
    assert.strictEqual(login2Res.status, 200);
    const token2 = login2Data.data.accessToken;
    const refresh2 = extractCookie(login2Res, "refreshToken");

    // 11. LOGOUT
    const logoutRes = await fetch(`${baseUrl}/logout`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token2}`,
        Cookie: `refreshToken=${refresh2}`,
      },
    });
    const logoutData = await logoutRes.json();
    assert.strictEqual(logoutRes.status, 200);
    assert.strictEqual(logoutData.success, true);

    // Refresh after logout must fail
    const postLogoutRefresh = await fetch(`${baseUrl}/refresh`, {
      method: "POST",
      headers: {
        Cookie: `refreshToken=${refresh2}`,
      },
    });
    assert.strictEqual(postLogoutRefresh.status, 401);

    // 12. LOGOUT-ALL TESTING
    const login3Res = await fetch(`${baseUrl}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: testEmail,
        password: testPassword,
      }),
    });
    const login3Data = await login3Res.json();
    assert.strictEqual(login3Res.status, 200);

    const logoutAllRes = await fetch(`${baseUrl}/logout-all`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${login3Data.data.accessToken}`,
      },
    });
    const logoutAllData = await logoutAllRes.json();
    assert.strictEqual(logoutAllRes.status, 200);
    assert.strictEqual(logoutAllData.success, true);
  } finally {
    server.close();
    try {
      await pool.query("DELETE FROM auth_sessions WHERE user_id IN (SELECT id FROM users WHERE email = $1)", [testEmail]);
      await pool.query("DELETE FROM email_otps WHERE email = $1", [testEmail]);
      await pool.query("DELETE FROM users WHERE email = $1", [testEmail]);
    } catch (cleanupErr) {
      console.warn("Cleanup error in auth test:", cleanupErr.message);
    }
  }
});
