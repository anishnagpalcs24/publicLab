import "dotenv/config";
import test, { after } from "node:test";
import assert from "node:assert";
import bcrypt from "bcrypt";
import app from "../src/app.js";
import { pool } from "../src/config/db.js";

test("User Deletion and Re-Registration Without Conflict Suite", async () => {
    const server = app.listen(0);
    const port = server.address().port;
    const baseUrl = `http://localhost:${port}/api/v1`;

    const originalAdminUser = process.env.ADMIN_USERNAME;
    const originalAdminHash = process.env.ADMIN_PASSWORD_HASH;

    const adminUsername = "test_admin_user_mgr";
    const adminPassword = "AdminTestPassword2026!";
    const adminHash = bcrypt.hashSync(adminPassword, 10);

    process.env.ADMIN_USERNAME = adminUsername;
    process.env.ADMIN_PASSWORD_HASH = adminHash;

    const testTimestamp = Date.now();
    const testEmail = `rereg_${testTimestamp}@example.com`;
    const testPhone = `+91-8${String(testTimestamp).slice(-9)}`;
    const testPassword = "Password@12345";

    let adminToken;
    let registeredUserId;
    let firstLabId;

    try {
        // 1. Admin logs in
        const loginRes = await fetch(`${baseUrl}/admin/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                username: adminUsername,
                password: adminPassword,
            }),
        });
        assert.equal(loginRes.status, 200);
        const loginBody = await loginRes.json();
        adminToken = loginBody.data.accessToken;

        // 2. User registers a laboratory
        const reg1 = await fetch(`${baseUrl}/labs`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                name: `Initial Lab ${testTimestamp}`,
                registrationNumber: `REG-1-${testTimestamp}`,
                labEmail: testEmail,
                phone: testPhone,
                description: "Pathology Center",
                address: "456 Test Street",
                city: "Mumbai",
                ownerFullName: "Test Owner",
                ownerEmail: testEmail,
                password: testPassword,
            }),
        });
        assert.equal(reg1.status, 201);
        const body1 = await reg1.json();
        firstLabId = body1.data.id;
        registeredUserId = body1.data.owner.id;

        // Simulate user verifying their email previously
        await pool.query(
            `UPDATE users SET email_verified = TRUE, account_status = 'active' WHERE id = $1`,
            [registeredUserId]
        );

        // 3. Admin deletes the laboratory from the database
        const delLabRes = await fetch(`${baseUrl}/admin/labs/${firstLabId}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${adminToken}` },
        });
        assert.equal(delLabRes.status, 200);

        // 4. User registers a NEW lab with the SAME email (which was previously blocked by 409)
        const reg2 = await fetch(`${baseUrl}/labs`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                name: `New Lab Re-registered ${testTimestamp}`,
                registrationNumber: `REG-2-${testTimestamp}`,
                labEmail: `facility_${testTimestamp}@example.com`,
                phone: testPhone,
                description: "Re-registered Pathology Center",
                address: "789 New Road",
                city: "Delhi",
                ownerFullName: "Test Owner Updated",
                ownerEmail: testEmail,
                password: testPassword,
            }),
        });
        // MUST NOT return 409 "An account with this owner email already exists"
        assert.equal(reg2.status, 201, "Re-registration must succeed with 201");
        const body2 = await reg2.json();
        assert.ok(body2.data.id, "New lab must be created");
        const secondLabId = body2.data.id;

        // Verify fresh OTP was created
        const otpCheck = await pool.query(
            `SELECT id, is_used FROM email_otps WHERE LOWER(email) = LOWER($1) AND is_used = FALSE`,
            [testEmail]
        );
        assert.ok(otpCheck.rows.length > 0, "Fresh OTP must be issued");

        // 5. Admin can delete a platform user account from /admin/users
        // Clean up second lab first
        await fetch(`${baseUrl}/admin/labs/${secondLabId}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${adminToken}` },
        });

        // Create a standalone patient user to test admin user deletion
        const standAloneEmail = `user_to_delete_${testTimestamp}@example.com`;
        const newUserRes = await pool.query(
            `INSERT INTO users (full_name, email, password_hash, role, account_status, email_verified)
             VALUES ('User To Delete', $1, 'hashed', 'patient', 'active', TRUE)
             RETURNING id`,
            [standAloneEmail]
        );
        const userToDeleteId = newUserRes.rows[0].id;

        const deleteUserRes = await fetch(`${baseUrl}/admin/users/${userToDeleteId}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${adminToken}` },
        });
        assert.equal(deleteUserRes.status, 200);
        const delUserBody = await deleteUserRes.json();
        assert.ok(delUserBody.success);

        // Confirm user was removed from database
        const checkUser = await pool.query(`SELECT id FROM users WHERE id = $1`, [userToDeleteId]);
        assert.equal(checkUser.rows.length, 0, "User must be removed from users table");

        // Admin cannot delete non-existent user (404)
        const notFoundUserRes = await fetch(`${baseUrl}/admin/users/999999`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${adminToken}` },
        });
        assert.equal(notFoundUserRes.status, 404);
    } finally {
        process.env.ADMIN_USERNAME = originalAdminUser;
        process.env.ADMIN_PASSWORD_HASH = originalAdminHash;

        if (registeredUserId) {
            await pool.query(`DELETE FROM users WHERE id = $1`, [registeredUserId]);
        }

        server.close();
    }
});
