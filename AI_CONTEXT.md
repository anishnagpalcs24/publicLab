# PublicLab — AI Project Context & Codebase Reference

> **Purpose:** This file acts as the persistent, single-source-of-truth index of the entire PublicLab codebase. Any future AI or developer can read this file instead of re-reading dozens of separate source files.

---

## 1. Project Overview & Architecture

PublicLab is a multi-laboratory diagnostic platform built with a centralized architecture:
`Route → Middleware → Controller → Service → Model → PostgreSQL`

### Portals
1. **User/Patient Portal:** Lab discovery, services catalog, callback requests, secure report access.
2. **Laboratory Portal:** Laboratory registration, profile/branches, staff, patient records (`local_patient_code`), test orders, report upload & publishing, subscription plans.
3. **Admin Portal:** Laboratory approvals/suspensions, user status management, callback reviews, subscription/payment monitoring, audit trail.

---

## 2. Technology Stack & Runtime

- **Runtime:** Node.js v24 (ES Modules, `"type": "module"`)
- **Web Framework:** Express.js 5.3 + `cookie-parser`
- **Database:** PostgreSQL 18 with `pg` connection pooling (`Backend/src/config/db.js`)
- **Authentication:** Dual-token JWT (15-min Access Token + 7-day HttpOnly Refresh Token) with database session tracking, cryptographic SHA-256 token hashing, refresh rotation, and token reuse detection.
- **Verification:** 6-digit numeric email OTP with SHA-256 hashing, 10-minute expiry, max 5 attempts.
- **Password Hashing:** `bcrypt` (12 rounds)
- **Email:** Nodemailer with Gmail OAuth 2.0 (`EMAIL_USER`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`)
- **Testing:** Node.js native test runner (`node:test`) via `npm test`
- **Port:** `5000` (API prefix: `/api/v1`)
- **Frontend Origin (CORS):** `http://localhost:5173`

---

## 3. Directory Map & File Index

```text
Backend/
├── src/
│   ├── config/
│   │   ├── config.js       -> Validates DATABASE_URL; exports PORT, NODE_ENV, DATABASE_URL.
│   │   ├── db.js           -> PostgreSQL connection pool (max: 10, timeout: 5000ms), connectDB().
│   │   ├── email.js        -> Exports emailConfig { user, clientId, clientSecret, refreshToken }.
│   │   └── env.js          -> Re-exports config.
│   │
│   ├── models/             -> Parameterized SQL queries against PostgreSQL.
│   │   ├── user.model.js
│   │   ├── session.model.js-> auth_sessions and email_otps queries (createSession, rotateSessionToken, revokeSession, revokeAllUserSessions, createEmailOtp, findLatestEmailOtp).
│   │   ├── lab.model.js
│   │   ├── patient.model.js
│   │   ├── order.model.js
│   │   ├── report.model.js
│   │   ├── callback.model.js
│   │   ├── subscription.model.js
│   │   └── payment.model.js
│   │
│   ├── controllers/        -> Express req/res handlers; calls services; returns { success, message, data }.
│   │   ├── auth.controller.js  -> register, verifyOtp, resendOtp, login, refresh, logout, logoutAll, getMe.
│   │   ├── user.controller.js
│   │   ├── lab.controller.js
│   │   ├── patient.controller.js
│   │   ├── order.controller.js
│   │   ├── report.controller.js
│   │   ├── callback.controller.js
│   │   ├── subscription.controller.js
│   │   ├── payment.controller.js
│   │   └── admin.controller.js
│   │
│   ├── services/           -> Business logic, validation, transactions, role/lab checks.
│   │   ├── auth.service.js -> Registration, OTP generation/verification, login, token rotation, reuse detection, session revocation.
│   │   ├── user.service.js
│   │   ├── lab.service.js
│   │   ├── patient.service.js
│   │   ├── order.service.js
│   │   ├── report.service.js
│   │   ├── callback.service.js
│   │   ├── subscription.service.js
│   │   ├── payment.service.js
│   │   ├── admin.service.js
│   │   └── email.service.js
│   │
│   ├── routes/             -> Express Router instances mounted under /api/v1/.
│   │   ├── auth.routes.js         -> /api/v1/auth (/register, /verify-otp, /resend-otp, /login, /refresh, /logout, /logout-all, /me)
│   │   ├── user.routes.js         -> /api/v1/users
│   │   ├── lab.routes.js          -> /api/v1/labs
│   │   ├── patient.routes.js      -> /api/v1/patients
│   │   ├── order.routes.js        -> /api/v1/orders
│   │   ├── report.routes.js       -> /api/v1/reports
│   │   ├── callback.routes.js     -> /api/v1/callbacks
│   │   ├── subscription.routes.js -> /api/v1/subscriptions
│   │   ├── payment.routes.js      -> /api/v1/payments
│   │   └── admin.routes.js        -> /api/v1/admin
│   │
│   ├── middleware/
│   │   ├── authenticate.js -> Verifies Bearer JWT, verifies session is not revoked in DB, checks user status, attaches req.user and req.session.
│   │   ├── authorize.js    -> Role enforcement: authorize('admin', 'lab', 'patient').
│   │   ├── rateLimiter.js  -> In-memory sliding window rate limiter for auth & callbacks.
│   │   ├── errorHandler.js -> Centralized Express error handler returning { success: false, message, stack? }.
│   │   ├── notFound.js     -> 404 handler for unmatched routes.
│   │   └── validate.js     -> Request schema validation wrapper.
│   │
│   ├── utils/
│   │   ├── AppError.js     -> Custom Error class with statusCode and isOperational.
│   │   └── asyncHandler.js -> (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next).
│   │
│   ├── migrations/
│   │   ├── 001_complete_schema.sql        -> Additive PostgreSQL core schema creation.
│   │   ├── 002_auth_sessions_and_otp.sql  -> Sessions table, email_otps table, and email_verified column.
│   │   └── runMigration.js                -> Migration runner for all *.sql files.
│   │
│   ├── app.js              -> Express initialization, CORS, cookie-parser, JSON parser, routes, error handlers.
│   └── server.js           -> Entry point: awaits connectDB(), listens on PORT.
│
├── tests/
│   ├── health.test.js      -> Tests GET /api/v1/health & GET /api/v1/subscriptions/plans.
│   └── auth.test.js        -> Full production auth suite: register -> OTP verification -> login -> /auth/me -> token refresh rotation -> reuse detection -> logout -> logout-all.
│
├── .env                    -> Secret local credentials (NEVER commit).
├── .env.example            -> Clean variable placeholders.
└── package.json            -> Dependencies & npm scripts (start, dev, test, migrate).
```

---

## 4. Complete Function Reference

### 4.1 Models (`src/models/`)
| Model | Exported Functions |
|---|---|
| `session.model.js` | `createSession({ userId, refreshTokenHash, ipAddress, userAgent, expiresAt })`<br>`findSessionById(sessionId)`<br>`rotateSessionToken({ sessionId, refreshTokenHash, expiresAt, ipAddress, userAgent })`<br>`revokeSession(sessionId)`<br>`revokeAllUserSessions(userId)`<br>`createEmailOtp({ userId, email, otpHash, purpose, expiresAt })`<br>`findLatestEmailOtp({ email, purpose })`<br>`incrementOtpAttempts(otpId)`<br>`markOtpUsed(otpId)` |
| `user.model.js` | `createUser({ fullName, email, phone, passwordHash })`<br>`findUserByEmail(email)`<br>`findUserByPhone(phone)`<br>`findUserById(id)` |
| `lab.model.js` | `createLab({ name, registrationNumber, email, phone, description })`<br>`findLabById(id)`<br>`findLabByEmail(email)`<br>`findLabs({ limit, offset, approvalStatus })` |
| `patient.model.js` | `createPatient({ fullName, dateOfBirth, sex, labId, localPatientCode })`<br>`findPatientById(patientId)`<br>`findPatientByLabReference({ labId, localPatientCode })`<br>`findPatientsByLab({ labId, limit, offset })` |
| `order.model.js` | `createOrder({ labId, patientId, items })`<br>`findOrderById({ orderId, labId })`<br>`findOrderItems({ orderId, labId })`<br>`findOrdersByLab({ labId, limit, offset })`<br>`updateOrderStatus({ orderId, labId, status })` |
| `report.model.js` | `createReport({ orderId, patientId, labId, storageProvider, storageKey, originalFilename, mimeType, fileSizeBytes, uploadedBy })`<br>`findReportById(reportId)`<br>`findReportsByLab({ labId, status, limit, offset })`<br>`findReportsByPatient({ patientId, labId, limit, offset })`<br>`updateReportStatus({ reportId, status })`<br>`createReportVersion({ reportId, versionNumber, storageKey, originalFilename, correctionReason, uploadedBy })`<br>`findReportVersions(reportId)` |
| `callback.model.js` | `createCallback({ name, phone, email, labId, message })`<br>`findCallbackById(callbackId)`<br>`findCallbacks({ status, labId, limit, offset })`<br>`updateCallbackStatus({ callbackId, status, assignedTo })`<br>`deleteCallback(callbackId)` |
| `subscription.model.js` | `createSubscriptionPlan({ name, planCode, description, price, currency, billingInterval })`<br>`findSubscriptionPlanById(planId)`<br>`findActiveSubscriptionPlans()`<br>`createSubscription({ labId, planId, status, provider, providerSubscriptionId, currentPeriodStart, currentPeriodEnd })`<br>`findSubscriptionsByLab(labId)`<br>`findSubscriptionById(subscriptionId)`<br>`updateSubscriptionStatus({ subscriptionId, status, canceledAt })` |
| `payment.model.js` | `createPayment({ orderId, subscriptionId, amount, currency, provider, idempotencyKey, paymentMethod })`<br>`findPaymentById(paymentId)`<br>`findPaymentByProviderReference({ provider, providerPaymentId })`<br>`findPaymentsByOrder(orderId)`<br>`findPaymentsBySubscription(subscriptionId)`<br>`setProviderPaymentReference({ paymentId, provider, providerPaymentId })`<br>`recordPaymentOutcome({ paymentId, status, failureReason })`<br>`recordWebhookEvent({ provider, providerEventId, eventType, paymentId })` |

### 4.2 Services (`src/services/`)
| Service | Exported Functions & Business Rules |
|---|---|
| `auth.service.js` | `register({ fullName, email, phone, password })` (bcrypt 12 rounds, generates 6-digit OTP, stores OTP hash, sends email)<br>`verifyEmailOtp({ email, otp, ipAddress, userAgent })` (verifies OTP hash, sets email_verified = true, creates session, returns accessToken & refreshToken)<br>`resendEmailOtp({ email })` (rate-limited, generates fresh OTP)<br>`login({ email, phone, identifier, password, ipAddress, userAgent })` (requires verified email & active status, creates session, returns accessToken & refreshToken)<br>`refreshTokens({ refreshToken, ipAddress, userAgent })` (verifies refresh token, detects reuse, rotates token in DB, returns new accessToken & refreshToken)<br>`logout({ sessionId, refreshToken })` (revokes session in DB)<br>`logoutAll(userId)` (revokes all active sessions for user) |
| `user.service.js` | `getUserProfile(userId)`<br>`updateUserProfile(userId, updates)`<br>`getUserById(userId)` |
| `lab.service.js` | `createLab(data)`<br>`getLabs({ search, limit, offset })`<br>`getLabById(labId)`<br>`updateMyLab({ user, updates })`<br>`getLabApplications({ status, limit, offset })`<br>`reviewLabApplication({ labId, status, reason, reviewedBy })`<br>`suspendLab({ labId, reason, reviewedBy })` |
| `patient.service.js` | `createPatient({ fullName, dateOfBirth, sex, labId, localPatientCode })`<br>`getPatients({ user, limit, offset })`<br>`getPatientById({ patientId, user })`<br>`getPatientByLabReference({ localPatientCode, user })` |
| `order.service.js` | `createOrder({ user, patientId, items })`<br>`getOrderById({ orderId, user })`<br>`getLabOrders({ user, status, paymentStatus, limit, offset })`<br>`getPatientOrders({ patientId, user, limit, offset })`<br>`updateOrderStatus({ orderId, status, user })` |
| `report.service.js` | `createReport({ user, orderId, patientId, file })`<br>`getReportById({ reportId, user })`<br>`getLabReports({ user, status, limit, offset })`<br>`getPatientReports({ patientId, user, limit, offset })`<br>`publishReport({ reportId, user })`<br>`correctReport({ reportId, file, reason, user })`<br>`getReportFile({ reportId, user })` |
| `callback.service.js` | `createCallback({ name, phone, email, labId, message })`<br>`getCallbacks({ user, status, limit, offset })`<br>`getCallbackById({ callbackId, user })`<br>`updateCallbackStatus({ callbackId, status, assignedTo, user })`<br>`deleteCallback({ callbackId, user })` |
| `subscription.service.js` | `getSubscriptionPlans()`<br>`getSubscriptionPlanById({ planId })`<br>`createSubscription({ user, planId })`<br>`getMySubscriptions({ user, limit, offset })`<br>`getSubscriptionById({ subscriptionId, user })`<br>`cancelSubscription({ subscriptionId, user })` |
| `payment.service.js` | `createOrderPayment({ orderId, user, idempotencyKey })`<br>`createSubscriptionPayment({ subscriptionId, user, idempotencyKey })`<br>`getOrderPayments({ orderId, user })`<br>`getSubscriptionPayments({ subscriptionId, user })`<br>`getPaymentById({ paymentId, user })`<br>`handlePaymentWebhook({ provider, signature, rawBody, payload })` |
| `admin.service.js` | `getDashboard({ user })`<br>`getUsers({ user, search, status, limit, offset })`<br>`updateUserStatus({ userId, status, adminId, reason })`<br>`getLabApplications({ user, status, search, limit, offset })`<br>`reviewLabApplication({ labId, status, reason, adminId })`<br>`suspendLab({ labId, reason, adminId })`<br>`getCallbacks({ user, status, limit, offset })`<br>`getAuditLogs({ user, action, limit, offset })` |
| `email.service.js` | `sendEmail({ to, subject, text, html })` |

---

## 5. PostgreSQL Verified Database Schema (`publiclab`)

| Table | Primary Key | Key Columns | Indexes / Constraints |
|---|---|---|---|
| `users` | `id` (BIGINT identity) | `full_name`, `email`, `phone`, `password_hash`, `account_status`, `email_verified`, `role`, `lab_id` | Unique email (lower), unique phone, role index, lab_id fk |
| `auth_sessions` | `id` (BIGINT identity) | `user_id` (FK), `refresh_token_hash`, `ip_address`, `user_agent`, `expires_at`, `is_revoked`, `revoked_at` | User index, hash index, is_revoked index |
| `email_otps` | `id` (BIGINT identity) | `user_id` (FK), `email`, `otp_hash`, `purpose`, `expires_at`, `attempts`, `is_used` | User + purpose index, email index |
| `labs` | `id` (BIGINT identity) | `name`, `registration_number`, `email`, `phone`, `description`, `approval_status` | Unique reg number, unique email (lower), approval check |
| `patients` | `id` (BIGINT identity) | `full_name`, `date_of_birth`, `sex` | Sex enum check (`male`, `female`, `intersex`, `unknown`, `not_recorded`) |
| `lab_patient_refs` | `id` (BIGINT identity) | `lab_id` (FK), `patient_id` (FK), `local_patient_code` | UNIQUE (`lab_id`, `local_patient_code`), UNIQUE (`lab_id`, `patient_id`) |
| `orders` | `id` (BIGINT identity) | `lab_id` (FK), `patient_id` (FK), `order_status`, `payment_status`, `total_amount` | Foreign keys to labs and patients |
| `order_items` | `id` (BIGINT identity) | `order_id` (FK on delete cascade), `test_id`, `quantity`, `unit_price` | Order items foreign key |
| `reports` | `id` (BIGINT identity) | `order_id` (FK), `patient_id` (FK), `lab_id` (FK), `storage_key`, `filename`, `status`, `uploaded_by` | Foreign keys to orders, labs, patients |
| `report_versions` | `id` (BIGINT identity) | `report_id` (FK on delete cascade), `version_number`, `storage_key`, `correction_reason` | Index on (`report_id`, `version_number`) |
| `callbacks` | `id` (BIGINT identity) | `name`, `phone`, `email`, `lab_id` (FK), `message`, `callback_status`, `assigned_to` (FK) | Status index, lab_id index |
| `subscription_plans` | `id` (BIGINT identity) | `name`, `plan_code` (UNIQUE), `price`, `currency`, `billing_interval`, `is_active` | Unique plan_code |
| `subscriptions` | `id` (BIGINT identity) | `lab_id` (FK), `plan_id` (FK), `status`, `provider`, `current_period_start`, `current_period_end` | Status index, lab_id index |
| `payments` | `id` (BIGINT identity) | `order_id` (FK), `subscription_id` (FK), `amount`, `currency`, `idempotency_key` (UNIQUE), `payment_status` | Check: either order_id or subscription_id |
| `payment_webhook_events`| `id` (BIGINT identity) | `provider`, `provider_event_id`, `event_type`, `payment_id` | UNIQUE (`provider`, `provider_event_id`) |

---

## 6. Commands Quick Reference

| Command | Working Directory | Purpose |
|---|---|---|
| `npm run migrate` | `Backend/` | Run all PostgreSQL migrations in sequence |
| `npm test` | `Backend/` | Run native automated test suite |
| `npm run dev` | `Backend/` | Start backend with nodemon |
| `npm start` | `Backend/` | Start backend in production mode |
