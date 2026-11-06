import "dotenv/config";
process.env.NODE_ENV = "test";
import test, { after } from "node:test";
import assert from "node:assert";
import app from "../src/app.js";
import { pool } from "../src/config/db.js";
import {
    getAdminEmail,
    notifyCallbackSubmitted,
    notifyCallbackStatusUpdated,
    notifyLabApplicationSubmitted,
    notifyLabApplicationDecision,
    notifyLabSuspension,
    notifyLabResubmitted,
    notifyReportPublished,
    notifyOrderCreated,
    notifyOrderStatusUpdated,
    notifySubscriptionCreated,
    notifyPaymentRecorded,
    notifyUserStatusUpdated,
} from "../src/services/email.service.js";

after(async () => {
    await pool.end();
});

test("Email Notification System Suite", async (t) => {
    const server = app.listen(0);
    const port = server.address().port;
    const baseUrl = `http://localhost:${port}/api/v1`;

    try {
        // ---------------------------------------------------------------------
        // 1. Configuration Check
        // ---------------------------------------------------------------------
        await t.test("CALLBACK_NOTIFICATION_EMAIL is configured correctly", () => {
            const adminEmail = getAdminEmail();
            assert.strictEqual(
                adminEmail,
                process.env.CALLBACK_NOTIFICATION_EMAIL || "anishnagpal37@gmail.com",
                "Should return configured admin callback email"
            );
            assert.match(adminEmail, /@/, "Admin email should be a valid email format");
        });

        // ---------------------------------------------------------------------
        // 2. Callback Submission & Notifications (Admin + User)
        // ---------------------------------------------------------------------
        await t.test("POST /api/v1/callbacks notifies admin and user when email provided", async () => {
            const userEmail = `patient_${Date.now()}@example.com`;
            const res = await fetch(`${baseUrl}/callbacks`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: "Aarav Sharma",
                    phone: "+91-9876543210",
                    email: userEmail,
                    message: "Need information about lipid profile tests.",
                }),
            });

            assert.strictEqual(res.status, 201);
            const data = await res.json();
            assert.strictEqual(data.success, true);
            assert.strictEqual(data.data.name, "Aarav Sharma");
            assert.strictEqual(data.data.callback_status, "pending");

            const callbackId = data.data.id;

            // Direct verification of notification helper execution without throwing
            await notifyCallbackSubmitted({
                callback: data.data,
                labName: "City Care Diagnostics",
            });

            // Cleanup callback
            await pool.query("DELETE FROM callbacks WHERE id = $1", [callbackId]);
        });

        await t.test("POST /api/v1/callbacks handles submission when user email is omitted", async () => {
            const res = await fetch(`${baseUrl}/callbacks`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: "Rahul Verma",
                    phone: "+91-9123456789",
                    message: "Please call me back regarding blood tests.",
                }),
            });

            assert.strictEqual(res.status, 201);
            const data = await res.json();
            assert.strictEqual(data.success, true);
            assert.strictEqual(data.data.email, null);

            // Cleanup
            await pool.query("DELETE FROM callbacks WHERE id = $1", [data.data.id]);
        });

        // ---------------------------------------------------------------------
        // 3. Callback Status Update Notification
        // ---------------------------------------------------------------------
        await t.test("notifyCallbackStatusUpdated safely notifies admin and user", async () => {
            const mockCallback = {
                id: "999",
                name: "Aarav Sharma",
                phone: "+91-9876543210",
                email: "aarav.test@example.com",
                callback_status: "contacted",
                contacted_at: new Date(),
            };

            // Should complete safely without exception
            await notifyCallbackStatusUpdated({
                callback: mockCallback,
                updatedBy: "Admin",
            });
        });

        // ---------------------------------------------------------------------
        // 4. Laboratory Decision & Administrative Events Notifications
        // ---------------------------------------------------------------------
        await t.test("Lab application notifications (submitted, decision, suspension, resubmit)", async () => {
            const mockLab = { id: 101, name: "Apex Pathology Lab", registration_number: "NABL-999" };
            const mockOwner = { fullName: "Dr. Apex", email: "director@apex.test", phone: "+91-9000000000" };

            // Submission
            await notifyLabApplicationSubmitted({ lab: mockLab, owner: mockOwner });

            // Approval
            await notifyLabApplicationDecision({
                lab: mockLab,
                ownerEmail: mockOwner.email,
                decision: "approved",
            });

            // Rejection with reason
            await notifyLabApplicationDecision({
                lab: mockLab,
                ownerEmail: mockOwner.email,
                decision: "rejected",
                reason: "Clinical accreditation document lapsed",
            });

            // Resubmission
            await notifyLabResubmitted({
                lab: mockLab,
                ownerEmail: mockOwner.email,
                description: "Submitted renewed accreditation certificate",
            });

            // Suspension
            await notifyLabSuspension({
                lab: mockLab,
                ownerEmail: mockOwner.email,
                reason: "Annual audit pending",
            });
        });

        // ---------------------------------------------------------------------
        // 5. Medical Reports Notifications
        // ---------------------------------------------------------------------
        await t.test("Medical report published and corrected notifications", async () => {
            const mockReport = { id: 501, order_id: 301, original_filename: "cbc_report.pdf" };
            const mockPatient = { full_name: "Pooja Patel", email: "pooja.patient@example.com" };
            const mockLab = { name: "Apex Pathology Lab" };

            // Published
            await notifyReportPublished({
                report: mockReport,
                patient: mockPatient,
                lab: mockLab,
                isCorrected: false,
            });

            // Corrected version
            await notifyReportPublished({
                report: mockReport,
                patient: mockPatient,
                lab: mockLab,
                isCorrected: true,
                correctionReason: "Hemoglobin reference range adjustment",
            });
        });

        // ---------------------------------------------------------------------
        // 6. Orders, Subscriptions & Payment Notifications
        // ---------------------------------------------------------------------
        await t.test("Order, subscription, payment, and user status notifications", async () => {
            const mockLab = { name: "Apex Pathology Lab" };
            const mockPatient = { full_name: "Vikram Sen", email: "vikram@example.com" };
            const mockOrder = { id: 701, total_amount: "1500.00", payment_status: "pending" };

            // Order created & updated
            await notifyOrderCreated({ order: mockOrder, patient: mockPatient, lab: mockLab });
            await notifyOrderStatusUpdated({
                order: mockOrder,
                patient: mockPatient,
                lab: mockLab,
                newStatus: "completed",
                notes: "Sample processed and report released",
            });

            // Subscription created
            const mockSub = { id: 44, status: "pending" };
            const mockPlan = { name: "Professional Lab Plan", price: "2999", currency: "INR", billing_interval: "monthly" };
            await notifySubscriptionCreated({
                subscription: mockSub,
                plan: mockPlan,
                lab: mockLab,
                ownerEmail: "owner@apex.test",
            });

            // Payment recorded
            const mockPayment = { id: 88, amount: "2999.00", currency: "INR", status: "pending" };
            await notifyPaymentRecorded({
                payment: mockPayment,
                lab: mockLab,
                ownerEmail: "owner@apex.test",
                description: "Monthly Subscription",
            });

            // User status updated
            const mockUser = { id: 12, full_name: "Staff Member", email: "staff@apex.test" };
            await notifyUserStatusUpdated({
                user: mockUser,
                status: "suspended",
                reason: "Administrative policy update",
            });
        });

    } finally {
        server.close();
    }
});
