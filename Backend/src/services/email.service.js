import "dotenv/config";
import nodemailer from "nodemailer";

let transporter = null;

function getTransporter() {
    if (!transporter) {
        const rawPass = process.env.EMAIL_PASS?.trim();
        const cleanPass = rawPass ? rawPass.replace(/\s+/g, "") : null;
        const isAppPassword = Boolean(cleanPass);

        transporter = nodemailer.createTransport({
            service: "gmail",
            auth: isAppPassword
                ? {
                    user: process.env.EMAIL_USER,
                    pass: cleanPass,
                }
                : {
                    type: "OAuth2",
                    user: process.env.EMAIL_USER,
                    clientId: process.env.GOOGLE_CLIENT_ID,
                    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
                    refreshToken: process.env.GOOGLE_REFRESH_TOKEN,
                },
        });
    }
    return transporter;
}

export function getAdminEmail() {
    return (
        process.env.CALLBACK_NOTIFICATION_EMAIL ||
        process.env.ADMIN_NOTIFICATION_EMAIL ||
        "anishnagpal37@gmail.com"
    );
}

export async function sendEmail({ to, subject, text, html }) {
    // In non-test mode, log email dispatch without exposing sensitive credentials or OTPs
    if (process.env.NODE_ENV !== "test") {
        console.log("\n" + "=".repeat(64));
        console.log(`[EMAIL DISPATCH] To: ${to}`);
        console.log(`[EMAIL DISPATCH] Subject: ${subject}`);
        if (text) {
            // Mask 6-digit OTP codes and passwords to protect sensitive medical and auth credentials
            const sanitizedText = text
                .replace(/\b\d{6}\b/g, "******")
                .replace(/(password|secret|token)\s*[:=]\s*\S+/gi, "$1: [PROTECTED]");
            console.log(`[EMAIL CONTENT]:\n${sanitizedText}`);
        }
        console.log("=".repeat(64) + "\n");
    }

    // During development and automated testing, use mocked email delivery by default and do not send real emails.
    // Real email dispatch only occurs in production or when explicitly enabled via ENABLE_LIVE_EMAIL=true.
    const isLiveEmailEnabled = process.env.NODE_ENV === "production" || process.env.ENABLE_LIVE_EMAIL === "true";

    if (!isLiveEmailEnabled) {
        return { messageId: "mock-" + Date.now(), response: "250 Mock email accepted (development/test mode)" };
    }

    try {
        const mailer = getTransporter();
        const result = await mailer.sendMail({
            from: process.env.EMAIL_USER || "noreply@publiclab.internal",
            to,
            subject,
            text,
            html,
        });
        return result;
    } catch (error) {
        if (process.env.NODE_ENV !== "production") {
            console.warn(`[EMAIL DELIVERY WARNING] Failed to deliver live email to ${to}: ${error.message}`);
            if (error.message && error.message.includes("550")) {
                console.warn("[GMAIL NOTICE] Gmail daily sending limit exceeded for your account. You can configure EMAIL_PASS with a Google App Password in .env.");
            }
            return {
                messageId: "dev-fallback-" + Date.now(),
                response: "Logged to terminal console in development",
            };
        }
        throw error;
    }
}

/**
 * Safe email dispatcher: catches errors so background notifications never break core transactions
 */
export async function safeSendEmail({ to, subject, text, html }) {
    if (!to || typeof to !== "string" || !to.includes("@")) {
        return null;
    }
    try {
        return await sendEmail({ to, subject, text, html });
    } catch (error) {
        console.warn(`[NOTIFICATION WARNING] Failed to dispatch email to ${to}: ${error.message}`);
        return null;
    }
}

/**
 * HTML Email Layout Wrapper
 */
function wrapHtml(title, bodyContent) {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b; margin: 0; padding: 20px; }
    .card { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
    .header { background: #0f172a; padding: 20px 24px; color: #ffffff; }
    .header h1 { margin: 0; font-size: 20px; font-weight: 700; letter-spacing: -0.5px; }
    .content { padding: 24px; line-height: 1.6; font-size: 15px; }
    .badge { display: inline-block; padding: 4px 10px; border-radius: 4px; font-weight: 600; font-size: 12px; text-transform: uppercase; margin-bottom: 12px; }
    .badge-info { background: #e0f2fe; color: #0369a1; }
    .badge-success { background: #dcfce7; color: #15803d; }
    .badge-warning { background: #fef3c7; color: #b45309; }
    .badge-danger { background: #fee2e2; color: #b91c1c; }
    .footer { padding: 16px 24px; background: #f8fafc; color: #64748b; font-size: 12px; text-align: center; border-top: 1px solid #e2e8f0; }
    .data-table { width: 100%; border-collapse: collapse; margin: 16px 0; }
    .data-table td { padding: 8px 10px; border-bottom: 1px solid #f1f5f9; font-size: 14px; }
    .data-table td.label { font-weight: 600; color: #475569; width: 35%; }
    .message-box { background: #f8fafc; border-left: 4px solid #3b82f6; padding: 12px 16px; margin: 16px 0; font-style: italic; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1>PublicLab</h1>
    </div>
    <div class="content">
      <h2 style="margin-top:0; color:#0f172a; font-size:18px;">${title}</h2>
      ${bodyContent}
    </div>
    <div class="footer">
      Automated notification from PublicLab Healthcare Platform.<br>
      Please do not reply directly to this email.
    </div>
  </div>
</body>
</html>`;
}

// -----------------------------------------------------------------------------
// 1. CALLBACK NOTIFICATIONS
// -----------------------------------------------------------------------------

export async function notifyCallbackSubmitted({ callback, labName = null }) {
    const adminEmail = getAdminEmail();
    const formattedDate = new Date(callback.requested_at || Date.now()).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });

    // 1a. Admin Notification
    const adminSubject = `[PublicLab Callback] New Request from ${callback.name}`;
    const adminText = `Hello Admin,

A new callback request has been submitted on PublicLab:

- Name: ${callback.name}
- Phone: ${callback.phone}
- Email: ${callback.email || "Not provided"}
- Laboratory: ${labName || "General Platform Inquiry"}
- Date: ${formattedDate}
- Message:
${callback.message || "No specific message provided."}

Please review and follow up in the Administrator Dashboard.`;

    const adminHtml = wrapHtml(
        `New Callback Request: ${callback.name}`,
        `<span class="badge badge-info">New Callback</span>
        <p>A new callback request has been submitted on the PublicLab platform:</p>
        <table class="data-table">
          <tr><td class="label">Patient Name:</td><td>${callback.name}</td></tr>
          <tr><td class="label">Phone:</td><td><a href="tel:${callback.phone}">${callback.phone}</a></td></tr>
          <tr><td class="label">Email:</td><td>${callback.email ? `<a href="mailto:${callback.email}">${callback.email}</a>` : "Not provided"}</td></tr>
          <tr><td class="label">Laboratory:</td><td>${labName || "General Platform Inquiry"}</td></tr>
          <tr><td class="label">Submitted At:</td><td>${formattedDate} (IST)</td></tr>
        </table>
        <div class="message-box">
          <strong>Message:</strong><br>
          ${callback.message ? callback.message.replace(/\n/g, "<br>") : "No specific message provided."}
        </div>`
    );

    await safeSendEmail({ to: adminEmail, subject: adminSubject, text: adminText, html: adminHtml });

    // 1b. User Confirmation (if email provided)
    if (callback.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(callback.email)) {
        const userSubject = "PublicLab — We Have Received Your Callback Request";
        const userText = `Dear ${callback.name},

Thank you for contacting PublicLab!

We have successfully received your callback request. Our healthcare representative will contact you shortly at ${callback.phone}.

Submitted Details:
- Name: ${callback.name}
- Phone: ${callback.phone}
${callback.message ? `- Your Inquiry: ${callback.message}` : ""}

If you did not request this callback, please ignore this email.

Warm regards,
PublicLab Support Team`;

        const userHtml = wrapHtml(
            "We Received Your Callback Request",
            `<p>Dear <strong>${callback.name}</strong>,</p>
            <p>Thank you for reaching out to PublicLab. We have received your request, and our support team will contact you shortly at <strong>${callback.phone}</strong>.</p>
            <table class="data-table">
              <tr><td class="label">Contact Phone:</td><td>${callback.phone}</td></tr>
              ${callback.message ? `<tr><td class="label">Your Note:</td><td>${callback.message}</td></tr>` : ""}
            </table>
            <p>If you have urgent inquiries, feel free to visit our diagnostic laboratories or reply to our representative during your call.</p>`
        );

        await safeSendEmail({ to: callback.email, subject: userSubject, text: userText, html: userHtml });
    }
}

export async function notifyCallbackStatusUpdated({ callback, userEmail = null, updatedBy = "Administrator" }) {
    const adminEmail = getAdminEmail();
    const status = callback.callback_status;

    // Admin Notification
    const adminSubject = `[PublicLab Callback Update] Request #${callback.id} is now ${status.toUpperCase()}`;
    const adminText = `Admin Notice:

Callback request #${callback.id} (${callback.name}) was updated to status: ${status.toUpperCase()} by ${updatedBy}.
Contact Phone: ${callback.phone}
${callback.contacted_at ? `Contacted At: ${new Date(callback.contacted_at).toLocaleString()}` : ""}`;

    const adminHtml = wrapHtml(
        `Callback #${callback.id} Status: ${status.toUpperCase()}`,
        `<span class="badge ${status === 'completed' ? 'badge-success' : status === 'contacted' ? 'badge-info' : 'badge-warning'}">${status}</span>
        <p>Callback request <strong>#${callback.id}</strong> for <strong>${callback.name}</strong> has been updated.</p>
        <table class="data-table">
          <tr><td class="label">Status:</td><td><strong>${status.toUpperCase()}</strong></td></tr>
          <tr><td class="label">Patient Name:</td><td>${callback.name}</td></tr>
          <tr><td class="label">Phone:</td><td>${callback.phone}</td></tr>
          ${callback.contacted_at ? `<tr><td class="label">Contacted At:</td><td>${new Date(callback.contacted_at).toLocaleString()}</td></tr>` : ""}
        </table>`
    );

    await safeSendEmail({ to: adminEmail, subject: adminSubject, text: adminText, html: adminHtml });

    // User Notification (if email is known)
    const recipient = userEmail || callback.email;
    if (recipient && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
        const userSubject = `PublicLab — Callback Request Update: ${status.toUpperCase()}`;
        const userText = `Dear ${callback.name},

Your callback request on PublicLab has been marked as ${status.toUpperCase()}.

If you have any further questions or require additional diagnostic assistance, please feel free to reach out to us at any time.

Best regards,
PublicLab Support Team`;

        const userHtml = wrapHtml(
            `Callback Request Update: ${status.toUpperCase()}`,
            `<p>Dear <strong>${callback.name}</strong>,</p>
            <p>Your recent callback request on PublicLab has been updated to: <span class="badge ${status === 'completed' ? 'badge-success' : 'badge-info'}">${status}</span>.</p>
            <p>Thank you for choosing PublicLab for your healthcare diagnostics.</p>`
        );

        await safeSendEmail({ to: recipient, subject: userSubject, text: userText, html: userHtml });
    }
}

// -----------------------------------------------------------------------------
// 2. LABORATORY REGISTRATION & APPLICATION NOTIFICATIONS
// -----------------------------------------------------------------------------

export async function notifyLabApplicationSubmitted({ lab, owner }) {
    const adminEmail = getAdminEmail();
    const adminSubject = `[Admin Alert] New Laboratory Application: ${lab.name}`;
    const adminText = `Hello Admin,

A new laboratory has submitted a registration application:

- Laboratory Name: ${lab.name}
- Registration Number: ${lab.registration_number || "Not provided"}
- City: ${lab.city || "Not provided"}
- Owner Name: ${owner.full_name || owner.fullName || "Lab Owner"}
- Owner Email: ${owner.email}
- Owner Phone: ${owner.phone || lab.phone || "Not provided"}

Please review the application in the Administrator Dashboard:
GET /api/v1/admin/labs/applications?status=pending`;

    const adminHtml = wrapHtml(
        `New Laboratory Application: ${lab.name}`,
        `<span class="badge badge-warning">Pending Review</span>
        <p>A new laboratory registration application has been submitted and is awaiting administrator review:</p>
        <table class="data-table">
          <tr><td class="label">Laboratory Name:</td><td><strong>${lab.name}</strong></td></tr>
          <tr><td class="label">Registration No:</td><td>${lab.registration_number || "N/A"}</td></tr>
          <tr><td class="label">City:</td><td>${lab.city || "N/A"}</td></tr>
          <tr><td class="label">Owner:</td><td>${owner.full_name || owner.fullName || "Lab Owner"}</td></tr>
          <tr><td class="label">Owner Email:</td><td>${owner.email}</td></tr>
          <tr><td class="label">Contact Phone:</td><td>${owner.phone || lab.phone || "N/A"}</td></tr>
        </table>`
    );

    await safeSendEmail({ to: adminEmail, subject: adminSubject, text: adminText, html: adminHtml });
}

export async function notifyLabApplicationDecision({ lab, ownerEmail, decision, reason = null, notes = null }) {
    const adminEmail = getAdminEmail();
    const isApproved = decision === "approved";

    // 2a. Notification to Lab Owner
    if (ownerEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ownerEmail)) {
        const ownerSubject = isApproved
            ? `🎉 Congratulations! Your Laboratory Application Has Been Approved — PublicLab`
            : `Update Regarding Your Laboratory Application — PublicLab`;

        const ownerText = isApproved
            ? `Dear Laboratory Director,

We are pleased to inform you that your laboratory application for "${lab.name}" has been APPROVED by the PublicLab Administration!

Your laboratory is now publicly discoverable on PublicLab. You can access the laboratory owner portal to:
- Manage diagnostic tests and clinical calculators
- Register and manage patient records
- Issue and publish medical diagnostic reports
- Manage laboratory subscriptions and operational dashboards

Access your portal at: http://localhost:5173/lab

Thank you for partnering with PublicLab!

Warm regards,
PublicLab Medical Board`
            : `Dear Laboratory Director,

Thank you for your interest in joining PublicLab. After careful review, your application for "${lab.name}" was not approved at this time.

Decision: REJECTED
Reason: ${reason || notes || "Credentials or verification documents could not be verified."}

You can update your credentials and resubmit your application through the lab dashboard:
POST /api/v1/labs/application/resubmit

If you have questions, please contact our support team.

Sincerely,
PublicLab Administration`;

        const ownerHtml = wrapHtml(
            isApproved ? `Laboratory Application Approved!` : `Laboratory Application Update`,
            isApproved
                ? `<span class="badge badge-success">Approved</span>
                   <p>Congratulations! Your laboratory application for <strong>${lab.name}</strong> has been officially approved.</p>
                   <p>Your laboratory profile is now live and active on PublicLab. You have full access to patient management, order processing, and verified report publishing.</p>`
                : `<span class="badge badge-danger">Application Not Approved</span>
                   <p>Thank you for your application for <strong>${lab.name}</strong>. At this time, the application was not approved.</p>
                   <table class="data-table">
                     <tr><td class="label">Reason:</td><td>${reason || notes || "Credentials could not be verified."}</td></tr>
                   </table>
                   <p>You may update your accreditation documentation and resubmit your application at any time.</p>`
        );

        await safeSendEmail({ to: ownerEmail, subject: ownerSubject, text: ownerText, html: ownerHtml });
    }

    // 2b. Admin Log
    const adminSubject = `[Admin Log] Laboratory Application ${decision.toUpperCase()}: ${lab.name}`;
    const adminText = `Admin Audit Log:
Laboratory "${lab.name}" application was ${decision.toUpperCase()}.
${reason ? `Reason: ${reason}` : ""}`;
    await safeSendEmail({ to: adminEmail, subject: adminSubject, text: adminText });
}

export async function notifyLabSuspension({ lab, ownerEmail, reason }) {
    const adminEmail = getAdminEmail();

    // Lab Owner Notice
    if (ownerEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ownerEmail)) {
        const ownerSubject = `⚠️ Important Notice: Laboratory Account Suspended — PublicLab`;
        const ownerText = `Dear Laboratory Director,

This is an official notice that your laboratory account for "${lab.name}" has been SUSPENDED by PublicLab Administration.

Reason for Suspension:
${reason || "Compliance inspection or regulatory review required."}

While suspended, your laboratory profile is hidden from public discovery, and new report publishing has been restricted.
Please contact PublicLab Administration at ${adminEmail} to resolve this matter.

Sincerely,
PublicLab Compliance Team`;

        const ownerHtml = wrapHtml(
            `Laboratory Account Suspended`,
            `<span class="badge badge-danger">Suspended</span>
            <p>Your laboratory account for <strong>${lab.name}</strong> has been suspended by PublicLab Administration.</p>
            <table class="data-table">
              <tr><td class="label">Reason:</td><td>${reason || "Compliance review required."}</td></tr>
            </table>
            <p>Please contact PublicLab Administration to provide updated credentials or address the suspension grounds.</p>`
        );

        await safeSendEmail({ to: ownerEmail, subject: ownerSubject, text: ownerText, html: ownerHtml });
    }

    // Admin Log
    await safeSendEmail({
        to: adminEmail,
        subject: `[Admin Log] Laboratory Suspended: ${lab.name}`,
        text: `Laboratory "${lab.name}" (ID: ${lab.id}) has been suspended.\nReason: ${reason}`,
    });
}

export async function notifyLabResubmitted({ lab, ownerEmail, description }) {
    const adminEmail = getAdminEmail();

    // Admin Alert
    await safeSendEmail({
        to: adminEmail,
        subject: `[Admin Alert] Laboratory Application Resubmitted: ${lab.name}`,
        text: `Laboratory "${lab.name}" (ID: ${lab.id}) has resubmitted its application with updated information:\n\n${description || "No specific notes provided."}\n\nPlease review in admin dashboard.`,
    });

    // Owner Confirmation
    if (ownerEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ownerEmail)) {
        await safeSendEmail({
            to: ownerEmail,
            subject: `PublicLab — Application Resubmission Received: ${lab.name}`,
            text: `Dear Laboratory Director,\n\nWe have received your resubmitted application for "${lab.name}". Our administration team will review your updated information shortly.\n\nBest regards,\nPublicLab Administration`,
        });
    }
}

// -----------------------------------------------------------------------------
// 3. MEDICAL REPORT NOTIFICATIONS
// -----------------------------------------------------------------------------

export async function notifyReportPublished({ report, patient, lab, isCorrected = false, correctionReason = null }) {
    const adminEmail = getAdminEmail();
    const actionLabel = isCorrected ? "Corrected Report Available" : "Medical Diagnostic Report Ready";

    // 3a. Patient Notification (if patient has valid email)
    if (patient?.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(patient.email)) {
        const patientSubject = `PublicLab — ${actionLabel} (${lab.name})`;
        const patientText = `Dear ${patient.full_name || "Patient"},

Your medical diagnostic report from "${lab.name}" is now ready and published.

Order Number: #${report.order_id}
Laboratory: ${lab.name}
Report File: ${report.original_filename || "medical_report.pdf"}
${isCorrected && correctionReason ? `Correction Reason: ${correctionReason}` : ""}

To view or download your authorized medical report:
1. Open the PublicLab patient portal
2. Request a secure email OTP with your registered email: ${patient.email}
3. Enter your OTP to access and download your authorized diagnostic report.

Thank you for choosing PublicLab!

Sincerely,
${lab.name} & PublicLab Diagnostics`;

        const patientHtml = wrapHtml(
            actionLabel,
            `<span class="badge ${isCorrected ? 'badge-warning' : 'badge-success'}">${isCorrected ? 'Corrected Version' : 'Published'}</span>
            <p>Dear <strong>${patient.full_name || "Patient"}</strong>,</p>
            <p>Your diagnostic laboratory report from <strong>${lab.name}</strong> has been finalized and published.</p>
            <table class="data-table">
              <tr><td class="label">Laboratory:</td><td>${lab.name}</td></tr>
              <tr><td class="label">Order ID:</td><td>#${report.order_id}</td></tr>
              <tr><td class="label">Document:</td><td>${report.original_filename || "medical_report.pdf"}</td></tr>
              ${isCorrected && correctionReason ? `<tr><td class="label">Change Note:</td><td>${correctionReason}</td></tr>` : ""}
            </table>
            <p>You can securely access and download your report at any time by requesting a short-lived verification code at the PublicLab patient portal.</p>`
        );

        await safeSendEmail({ to: patient.email, subject: patientSubject, text: patientText, html: patientHtml });
    }

    // 3b. Admin Log
    await safeSendEmail({
        to: adminEmail,
        subject: `[Admin Alert] Report ${isCorrected ? "Corrected" : "Published"}: Order #${report.order_id} (${lab.name})`,
        text: `A medical report has been ${isCorrected ? "corrected" : "published"}:\n- Lab: ${lab.name}\n- Patient: ${patient?.full_name || "Patient #" + report.patient_id}\n- Order: #${report.order_id}\n- Report ID: #${report.id}`,
    });
}

// -----------------------------------------------------------------------------
// 4. ORDER NOTIFICATIONS
// -----------------------------------------------------------------------------

export async function notifyOrderCreated({ order, patient, lab }) {
    const adminEmail = getAdminEmail();

    // Patient Notification
    if (patient?.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(patient.email)) {
        const subject = `PublicLab — Diagnostic Order #${order.id} Created (${lab.name})`;
        const text = `Dear ${patient.full_name || "Patient"},

A diagnostic order #${order.id} has been registered for you at "${lab.name}".

Total Amount: ₹${order.total_amount}
Payment Status: ${order.payment_status}
${order.sample_collected_at ? `Sample Collection: ${new Date(order.sample_collected_at).toLocaleDateString()}` : ""}

You will receive an email notification as soon as your diagnostic report is ready.

Best regards,
${lab.name}`;

        await safeSendEmail({ to: patient.email, subject, text });
    }

    // Admin Alert
    await safeSendEmail({
        to: adminEmail,
        subject: `[Admin Alert] New Order #${order.id} Placed at ${lab.name}`,
        text: `New Diagnostic Order #${order.id}:\n- Lab: ${lab.name}\n- Patient: ${patient?.full_name || "ID #" + order.patient_id}\n- Amount: ₹${order.total_amount}`,
    });
}

export async function notifyOrderStatusUpdated({ order, patient, lab, newStatus, notes }) {
    const adminEmail = getAdminEmail();

    // Patient Notification
    if (patient?.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(patient.email)) {
        const subject = `PublicLab — Order #${order.id} Status: ${newStatus.toUpperCase()}`;
        const text = `Dear ${patient.full_name || "Patient"},

Your diagnostic order #${order.id} at "${lab.name}" has been updated to: ${newStatus.toUpperCase()}.
${notes ? `Notes: ${notes}` : ""}

Thank you for choosing ${lab.name}.`;

        await safeSendEmail({ to: patient.email, subject, text });
    }

    // Admin Alert
    await safeSendEmail({
        to: adminEmail,
        subject: `[Admin Alert] Order #${order.id} Status Changed to ${newStatus.toUpperCase()} (${lab.name})`,
        text: `Order #${order.id} at ${lab.name} was updated to ${newStatus.toUpperCase()}.\nPatient: ${patient?.full_name || "ID #" + order.patient_id}`,
    });
}

// -----------------------------------------------------------------------------
// 5. SUBSCRIPTION & PAYMENT NOTIFICATIONS
// -----------------------------------------------------------------------------

export async function notifySubscriptionCreated({ subscription, plan, lab, ownerEmail }) {
    const adminEmail = getAdminEmail();

    // Lab Owner
    if (ownerEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ownerEmail)) {
        await safeSendEmail({
            to: ownerEmail,
            subject: `PublicLab — Subscription Initiated: ${plan.name}`,
            text: `Dear Laboratory Director,\n\nYou have initiated a subscription to the "${plan.name}" plan (${plan.billing_interval}) on PublicLab.\nAmount: ₹${plan.price} ${plan.currency}\nStatus: ${subscription.status.toUpperCase()}`,
        });
    }

    // Admin Alert
    await safeSendEmail({
        to: adminEmail,
        subject: `[Admin Alert] New Subscription: ${lab.name} (${plan.name})`,
        text: `Laboratory "${lab.name}" subscribed to plan: ${plan.name} (₹${plan.price}).\nSubscription ID: #${subscription.id}`,
    });
}

export async function notifyPaymentRecorded({ payment, lab, ownerEmail, description = "Order / Subscription Payment" }) {
    const adminEmail = getAdminEmail();

    if (ownerEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ownerEmail)) {
        await safeSendEmail({
            to: ownerEmail,
            subject: `PublicLab — Payment Record: ₹${payment.amount} (${payment.status.toUpperCase()})`,
            text: `Payment of ₹${payment.amount} ${payment.currency} for ${description} has been recorded.\nStatus: ${payment.status.toUpperCase()}`,
        });
    }

    await safeSendEmail({
        to: adminEmail,
        subject: `[Admin Alert] Payment Recorded: ₹${payment.amount} (${payment.status.toUpperCase()})`,
        text: `A payment record was generated:\nAmount: ₹${payment.amount} ${payment.currency}\nStatus: ${payment.status}\nLab: ${lab?.name || "N/A"}`,
    });
}

export async function notifySubscriptionActivated({ subscription, plan, lab, ownerEmail }) {
    const adminEmail = getAdminEmail();

    if (ownerEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ownerEmail)) {
        const periodStartStr = subscription.current_period_start
            ? new Date(subscription.current_period_start).toLocaleDateString()
            : "Today";
        const periodEndStr = subscription.current_period_end
            ? new Date(subscription.current_period_end).toLocaleDateString()
            : "Next billing date";

        await safeSendEmail({
            to: ownerEmail,
            subject: `PublicLab — Subscription Activated: ${plan?.name || "Plan"}`,
            text: `Dear Laboratory Director,

Your subscription to the "${plan?.name || "Laboratory"}" plan on PublicLab is now ACTIVE.

Billing Interval: ${plan?.billing_interval || "Monthly"}
Current Period: ${periodStartStr} to ${periodEndStr}
Status: ACTIVE

Your laboratory has full access to diagnostic reporting, clinical calculators, and dashboard features.

Thank you for choosing PublicLab!

Sincerely,
PublicLab Administration`,
        });
    }

    await safeSendEmail({
        to: adminEmail,
        subject: `[Admin Alert] Subscription Activated: ${lab?.name || "Laboratory"} (${plan?.name || "Plan"})`,
        text: `Subscription #${subscription.id} for "${lab?.name || "Laboratory"}" is now ACTIVE.\nPlan: ${plan?.name}\nPeriod End: ${subscription.current_period_end}`,
    });
}

export async function notifyPaymentFailed({ payment, lab, ownerEmail, reason }) {
    const adminEmail = getAdminEmail();

    if (ownerEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ownerEmail)) {
        await safeSendEmail({
            to: ownerEmail,
            subject: `PublicLab — Payment Failed: ₹${payment.amount}`,
            text: `Dear Laboratory Director,

A payment attempt of ₹${payment.amount} ${payment.currency} for your account at "${lab?.name || "PublicLab"}" was unsuccessful.
Reason: ${reason || "Transaction declined by provider"}

Please log in to your dashboard to retry payment and maintain active subscription benefits.

Sincerely,
PublicLab Billing Team`,
        });
    }

    await safeSendEmail({
        to: adminEmail,
        subject: `[Admin Alert] Payment FAILED: ₹${payment.amount} (${lab?.name || "N/A"})`,
        text: `Payment ID #${payment.id} failed.\nAmount: ₹${payment.amount}\nReason: ${reason || "N/A"}`,
    });
}

export async function notifySubscriptionCancelled({ subscription, plan, lab, ownerEmail }) {
    const adminEmail = getAdminEmail();

    if (ownerEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ownerEmail)) {
        await safeSendEmail({
            to: ownerEmail,
            subject: `PublicLab — Subscription Cancelled: ${plan?.name || "Laboratory Plan"}`,
            text: `Dear Laboratory Director,

Your subscription to the "${plan?.name || "Laboratory Plan"}" on PublicLab has reached the end of its billing period and has been cancelled as scheduled.

Laboratory: ${lab?.name || "Laboratory"}
Status: CANCELLED

Access to paid diagnostic publishing, clinical calculations, and advanced features has been paused.
You can reactivate your subscription at any time by selecting a plan in the laboratory portal:
POST /api/v1/subscriptions

Sincerely,
PublicLab Administration`,
        });
    }

    await safeSendEmail({
        to: adminEmail,
        subject: `[Admin Log] Subscription Cancelled at Period End: ${lab?.name || "Laboratory"}`,
        text: `Subscription #${subscription.id} for "${lab?.name || "Laboratory"}" reached current_period_end and was cancelled as requested.\nStatus: CANCELLED\nCancelled At: ${subscription.cancelled_at}`,
    });
}

export async function notifySubscriptionPastDue({ subscription, plan, lab, ownerEmail }) {
    const adminEmail = getAdminEmail();

    if (ownerEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ownerEmail)) {
        await safeSendEmail({
            to: ownerEmail,
            subject: `PublicLab — Action Required: Subscription Past Due (${plan?.name || "Plan"})`,
            text: `Dear Laboratory Director,

The billing period for your "${plan?.name || "Laboratory Plan"}" subscription has ended and is now past due.

Laboratory: ${lab?.name || "Laboratory"}
Status: PAST_DUE

To prevent interruption of your laboratory's diagnostic reporting and paid features, please renew your subscription payment:
POST /api/v1/payments/subscriptions/${subscription.id}

Sincerely,
PublicLab Billing Team`,
        });
    }

    await safeSendEmail({
        to: adminEmail,
        subject: `[Admin Alert] Subscription Past Due: ${lab?.name || "Laboratory"}`,
        text: `Subscription #${subscription.id} for "${lab?.name || "Laboratory"}" is past due.\nPeriod End: ${subscription.current_period_end}\nStatus: PAST_DUE`,
    });
}

// -----------------------------------------------------------------------------
// 6. USER ACCOUNT STATUS NOTIFICATIONS
// -----------------------------------------------------------------------------

export async function notifyUserStatusUpdated({ user, status, reason }) {
    const adminEmail = getAdminEmail();

    // User Notification
    if (user?.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user.email)) {
        const subject = `PublicLab — Important Notice Regarding Your Account Status: ${status.toUpperCase()}`;
        const text = `Dear ${user.full_name || "User"},

Your PublicLab account status has been updated to: ${status.toUpperCase()}.
${reason ? `Reason: ${reason}` : ""}

If you believe this is in error or require assistance, please contact PublicLab Support.

Sincerely,
PublicLab Security & Governance Team`;

        await safeSendEmail({ to: user.email, subject, text });
    }

    // Admin Log
    await safeSendEmail({
        to: adminEmail,
        subject: `[Admin Log] User Status Updated: ${user.email} -> ${status.toUpperCase()}`,
        text: `User ${user.email} (ID: ${user.id}) account status was updated to ${status.toUpperCase()}.\nReason: ${reason || "None specified"}`,
    });
}
