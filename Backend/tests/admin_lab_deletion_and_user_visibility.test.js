import "dotenv/config";
import test, { after } from "node:test";
import assert from "node:assert";
import bcrypt from "bcrypt";
import app from "../src/app.js";
import { pool } from "../src/config/db.js";

test("Admin Laboratory Deletion & Public User Portal Visibility Suite", async () => {
    const server = app.listen(0);
    const port = server.address().port;
    const baseUrl = `http://localhost:${port}/api/v1`;

    const originalAdminUser = process.env.ADMIN_USERNAME;
    const originalAdminHash = process.env.ADMIN_PASSWORD_HASH;

    const adminUsername = "test_admin_delete";
    const adminPassword = "AdminTestPassword2026!";
    const adminHash = bcrypt.hashSync(adminPassword, 10);

    process.env.ADMIN_USERNAME = adminUsername;
    process.env.ADMIN_PASSWORD_HASH = adminHash;

    const testTimestamp = Date.now();
    const testCity = `TestCity_${testTimestamp}`;
    const testLabName = `Accredited Lab ${testTimestamp}`;
    const testRegNumber = `NABL-${testTimestamp}`;
    const testOwnerEmail = `owner_${testTimestamp}@testlab.com`;
    const testPhone = `+91-9${String(testTimestamp).slice(-9)}`;
    const testPassword = "Password@12345";

    let adminToken;
    let testLabId;
    let testOwnerId;

    try {
        // 1. Admin login
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
        assert.ok(loginBody.data?.accessToken);
        adminToken = loginBody.data.accessToken;

        // 2. Register laboratory
        const regRes = await fetch(`${baseUrl}/labs`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                name: testLabName,
                registrationNumber: testRegNumber,
                labEmail: `contact_${testTimestamp}@testlab.com`,
                phone: testPhone,
                description: "State-of-the-art diagnostic center",
                address: `123 Medical Avenue, Suite ${testTimestamp % 100}`,
                city: testCity,
                ownerFullName: "Dr. Diagnostics",
                ownerEmail: testOwnerEmail,
                password: testPassword,
            }),
        });
        assert.equal(regRes.status, 201);
        const regBody = await regRes.json();
        testLabId = regBody.data?.id;
        testOwnerId = regBody.data?.owner?.id;
        assert.ok(testLabId, "Lab ID must be present");

        // Verify user and transition lab to pending
        await pool.query(
            `UPDATE users SET email_verified = TRUE WHERE id = $1`,
            [testOwnerId]
        );
        await pool.query(
            `UPDATE labs SET approval_status = 'pending' WHERE id = $1`,
            [testLabId]
        );

        // 3. Pending lab is NOT visible on public portal
        const pendingPublicRes = await fetch(`${baseUrl}/labs?search=${encodeURIComponent(testLabName)}`);
        assert.equal(pendingPublicRes.status, 200);
        const pendingPublicBody = await pendingPublicRes.json();
        const pendingFound = (pendingPublicBody.data || []).find((l) => l.id === testLabId);
        assert.equal(pendingFound, undefined, "Pending lab must not be publicly visible");

        // 4. Admin approves the laboratory
        const approveRes = await fetch(`${baseUrl}/admin/labs/applications/${testLabId}/review`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${adminToken}`,
            },
            body: JSON.stringify({ status: "approved" }),
        });
        assert.equal(approveRes.status, 200);
        const approveBody = await approveRes.json();
        assert.equal(approveBody.data?.approval_status, "approved");

        // 5. Approved laboratory is immediately visible on user portal with full details
        const searchRes = await fetch(`${baseUrl}/labs?search=${encodeURIComponent(testLabName)}`);
        assert.equal(searchRes.status, 200);
        const searchBody = await searchRes.json();
        const labInList = (searchBody.data || []).find((l) => l.id === testLabId);
        assert.ok(labInList, "Approved lab must appear in public search");
        assert.equal(labInList.name, testLabName);
        assert.equal(labInList.city, testCity);
        assert.equal(labInList.registration_number, testRegNumber);
        assert.ok(labInList.address);

        // Query by city filter
        const cityRes = await fetch(`${baseUrl}/labs?city=${encodeURIComponent(testCity)}`);
        assert.equal(cityRes.status, 200);
        const cityBody = await cityRes.json();
        const labInCity = (cityBody.data || []).find((l) => l.id === testLabId);
        assert.ok(labInCity, "Approved lab must appear in city search");

        // Query by single lab profile endpoint
        const singleRes = await fetch(`${baseUrl}/labs/${testLabId}`);
        assert.equal(singleRes.status, 200);
        const singleBody = await singleRes.json();
        assert.equal(singleBody.data?.id, testLabId);
        assert.equal(singleBody.data?.city, testCity);
        assert.equal(singleBody.data?.registration_number, testRegNumber);

        // 6. Non-admin cannot delete laboratory
        const unauthDeleteRes = await fetch(`${baseUrl}/admin/labs/${testLabId}`, {
            method: "DELETE",
        });
        assert.equal(unauthDeleteRes.status, 401, "Unauthenticated delete must be rejected");

        // 7. Insert dependent records to verify cascade deletion
        await pool.query(
            `INSERT INTO callbacks (name, phone, email, lab_id, message, callback_status)
             VALUES ('Callback Patient', '+91-9999999999', 'cb@test.com', $1, 'Please call back', 'pending')`,
            [testLabId]
        );

        await pool.query(
            `INSERT INTO clinical_calculations (lab_id, calculator_type, formula_name, input_parameters, result_value, result_unit)
             VALUES ($1, 'eGFR', 'CKD-EPI', '{"serum_creatinine": 1.1}'::jsonb, 85, 'mL/min/1.73m2')`,
            [testLabId]
        );

        // 8. Admin permanently deletes laboratory from database
        const deleteRes = await fetch(`${baseUrl}/admin/labs/${testLabId}`, {
            method: "DELETE",
            headers: {
                Authorization: `Bearer ${adminToken}`,
            },
        });
        assert.equal(deleteRes.status, 200);
        const deleteBody = await deleteRes.json();
        assert.ok(deleteBody.success);
        assert.ok(deleteBody.message.includes("permanently deleted"));

        // Verify laboratory is gone from database
        const checkLab = await pool.query(`SELECT id FROM labs WHERE id = $1`, [testLabId]);
        assert.equal(checkLab.rows.length, 0, "Laboratory record must be deleted from labs table");

        // Verify dependent callbacks and calculations are removed
        const checkCallbacks = await pool.query(`SELECT id FROM callbacks WHERE lab_id = $1`, [testLabId]);
        assert.equal(checkCallbacks.rows.length, 0, "Callbacks for deleted lab must be removed");

        const checkCalcs = await pool.query(`SELECT id FROM clinical_calculations WHERE lab_id = $1`, [testLabId]);
        assert.equal(checkCalcs.rows.length, 0, "Calculations for deleted lab must be removed");

        // Verify user lab_id is unlinked
        const checkUser = await pool.query(`SELECT id, lab_id FROM users WHERE id = $1`, [testOwnerId]);
        assert.equal(checkUser.rows[0].lab_id, null, "User lab_id must be cleared (null)");

        // Verify public API returns 404 for deleted lab
        const getDeletedRes = await fetch(`${baseUrl}/labs/${testLabId}`);
        assert.equal(getDeletedRes.status, 404);

        // 9. Deleting non-existent lab returns 404
        const notFoundRes = await fetch(`${baseUrl}/admin/labs/999999`, {
            method: "DELETE",
            headers: {
                Authorization: `Bearer ${adminToken}`,
            },
        });
        assert.equal(notFoundRes.status, 404);
    } finally {
        // Restore environment variables
        process.env.ADMIN_USERNAME = originalAdminUser;
        process.env.ADMIN_PASSWORD_HASH = originalAdminHash;

        // Cleanup test user
        if (testOwnerId) {
            await pool.query(`DELETE FROM users WHERE id = $1`, [testOwnerId]);
        }

        server.close();
    }
});
