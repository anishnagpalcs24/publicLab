# PublicLab Development Progress

## Project Status

**Current stage:** Complete Lab Owner Portal Backend: Lab Application & Approval, Profile & Settings, Patient Management, Order Processing, Medical Report Upload/Publish/Correction/Download, Operational Dashboard, Clinical Calculators (eGFR, LDL, HOMA-IR, FAI), and Saved Calculation History.

**Backend stack:** Node.js, Express.js, PostgreSQL 18, `pg`, JWT, bcrypt, cookie-parser, and JavaScript (ES modules).

**Architecture:** Centralized MVC-style architecture:
`Route → Middleware → Controller → Service → Model → PostgreSQL`

---

## Completed

- [x] **Database Schema Migrations:**
  - `001_complete_schema.sql`: Core relational tables for users, labs, patients, orders, reports, callbacks, subscriptions, payments.
  - `002_auth_sessions_and_otp.sql`: Added `email_verified` to `users`, `auth_sessions` table with SHA-256 token hashing, and `email_otps` table for single-use time-limited OTPs.
  - `003_clinical_calculations_and_lab_enhancements.sql`: Extended `labs` (owner linkage, address, city, operating_hours, services, sample collection, rejection/suspension reasons), `patients` (phone, email, address), `orders` (collection timestamp, notes, creator), and created `clinical_calculations` table.
  - `runMigration.js`: Sequentially runs all `*.sql` files via `npm run migrate`.
- [x] **Authentication & Password Recovery:**
  - `auth.service.js`: Added lab owner role registration (with admin self-assignment protection), `forgotPassword` (sends 6-digit reset OTP), `resetPassword` (verifies OTP, hashes new password with bcrypt 12 rounds, revokes all sessions), and `changePassword`.
  - `auth.routes.js`: Rate-limited endpoints for `/forgot-password`, `/reset-password`, and authenticated `/change-password`.
- [x] **Lab Application & Unified Registration:**
  - `POST /api/v1/labs`: Supports unified single-form registration (creates lab record, creates lab owner account, generates email OTP, links records via `BEGIN ... COMMIT` database transaction).
  - Also supports authenticated submission if the owner is already logged in.
  - Supports optional `technical_contact` details (stored in PostgreSQL JSONB column).
  - Admin approval remains strictly mandatory (`approval_status: 'pending'`).
  - `GET /api/v1/labs/application/status`: Lab owner status oversight, rejection reasons, and resubmission requirements.
  - `POST /api/v1/labs/application/resubmit`: Allows resubmission after rejection.
  - Admin approval/rejection review and suspension with reasons recorded directly.
- [x] **Lab Profile & Operational Settings:**
  - `GET /api/v1/labs/me`: Fetches authenticated owner's full lab profile and operational information.
  - `PATCH /api/v1/labs/me`: Updates contact details, operating hours, service catalog, sample collection options, and address.
- [x] **Patient Management:**
  - Registration, search by name/phone/code (`GET /api/v1/patients?search=...`), details with activity counts, and updates (`PATCH /api/v1/patients/:id`). Multi-tenant isolation enforced via `lab_patient_refs`.
- [x] **Order & Test Management:**
  - `POST /api/v1/orders`: Fully transactional order creation inserting `orders` and `order_items`, calculating total amount from line items, and enforcing lab ownership.
  - Status updates (`PATCH /api/v1/orders/:id/status`) enforcing valid workflow transitions aligned with database check constraints (`created`, `confirmed`, `processing`, `completed`, `cancelled`).
- [x] **Medical Report Management & Versioning:**
  - Private filesystem storage (`storage/reports/`) with cryptographic randomized keys (preventing predictable URLs).
  - Draft report creation (`POST /api/v1/reports`), publishing (`PATCH /api/v1/reports/:id/publish`), and versioned correction (`POST /api/v1/reports/:id/correct`) tracking version history in `report_versions`.
  - Streaming report download (`GET /api/v1/reports/:id/download`) with authorization verification.
- [x] **Lab Owner Dashboard:**
  - `GET /api/v1/labs/me/dashboard`: Patient count, orders by status, pending vs completed counts, draft vs published reports, recent order/report activity, and approval status.
- [x] **Clinical Calculator Module:**
  - `POST /api/v1/labs/calculator/calculate`: Validated pure clinical calculations with equation versions, clinical warnings, and unit outputs:
    1. **eGFR:** 2021 CKD-EPI creatinine equation (without race adjustment, NKF/KDIGO) in mL/min/1.73 m².
    2. **LDL Cholesterol:** Friedewald equation with clinical unreliability detection if Triglycerides > 400 mg/dL.
    3. **HOMA-IR:** Insulin resistance assessment supporting both mg/dL and mmol/L glucose units.
    4. **Free Androgen Index (FAI):** Active testosterone ratio with SHBG validation.
- [x] **Saved Calculation History:**
  - `POST /api/v1/labs/calculations`: Save calculation with optional patient association.
  - `GET /api/v1/labs/calculations`: Paginated list of lab calculations.
  - `GET /api/v1/patients/:patientId/calculations`: Patient-specific calculation history.
- [x] **Fixed Admin Authentication & Laboratory Approval Portal:**
  - `POST /api/v1/admin/login`: Rate-limited fixed admin login validating against `ADMIN_USERNAME` and `ADMIN_PASSWORD_HASH` using bcrypt. Issues access and refresh tokens integrated with session architecture.
  - `GET /api/v1/admin/labs/applications`: Lists laboratory applications with full joined owner details (`owner_name`, `owner_email`, `owner_phone`), contact details, address, submission date, and approval status.
  - `PATCH /api/v1/admin/labs/applications/:labId/review`: Approves or rejects applications with reason/notes recorded.
  - `PATCH /api/v1/admin/labs/:labId/suspend`: Suspends active approved laboratories with reason recorded.
  - Public lab discovery (`GET /api/v1/labs` and `GET /api/v1/labs/:id`) strictly prevents viewing pending, rejected, or suspended labs.
  - Production suppression: `devOtp` is strictly restricted to development environments and omitted in production.
- [x] **Automated Testing Suite (`npm test`):**
  - `tests/auth.test.js`: Full Production Auth Flow (Register → OTP Verify → Login → Refresh → Reuse Detection → Logout → Logout-all).
  - `tests/health.test.js`: Health check endpoint.
  - `tests/lab_owner_portal.test.js`: End-to-end integration test across all Lab Owner Portal APIs.
  - `tests/admin_approval.test.js`: Admin Authentication, credential validation, RBAC enforcement, application listing with owner details, rejection with reason, public visibility prevention, and production OTP suppression.
  - **All test suites passing:** `5/5 suites (100% pass)`.

---

## Pending External Setup (To configure in `.env`)

- [ ] **Gmail OAuth2:** Connect real Google Cloud OAuth credentials (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`, `EMAIL_USER`) for production email dispatch.
- [ ] **Cloud Storage (Optional):** Attach S3/R2 storage adapter if migrating away from local private storage.
- [ ] **Payment Gateway:** Configure Razorpay API credentials and webhook secret (`PAYMENT_WEBHOOK_SECRET`).

---

## Known Issues

None. All syntax checks pass, migrations run cleanly, and automated tests pass.
