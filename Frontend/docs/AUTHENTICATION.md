# PublicLab Frontend — Authentication Architecture

PublicLab implements dual-token session authentication integrated with HttpOnly cookie rotation, role-based route boundaries, and passwordless OTP verification for patients.

---

## 1. Authentication Strategies

| Portal | Strategy | Mechanism |
|---|---|---|
| **Patient Portal** | **Passwordless Email OTP** | Single-use 6-digit numeric OTP sent to patient email. No password required. Session grants access exclusively to verified reports. |
| **Laboratory Portal** | **Dual-Token JWT + Session Cookie** | Email + Password credential verification. Issues 15-minute Access Token (in-memory) + 7-day HttpOnly Refresh Token cookie. |
| **Admin Portal** | **Fixed Administrator Credentials** | Fixed username (`admin`) validated against bcrypt hash stored securely in backend environment. Dual-token session tracking with audit trail. |

---

## 2. In-Memory Access Token Security

- **No LocalStorage for Tokens:** The 15-minute JWT Access Token is held purely in application memory (`src/Core/http/interceptors.js`). It is never stored in `localStorage` or `sessionStorage` to mitigate Cross-Site Scripting (XSS) token theft.
- **Silent Boot Refresh:** When a user refreshes or reopens the browser, `initAuth()` in `AuthProvider` calls `POST /auth/refresh`. If the user has a valid HttpOnly cookie, the backend issues a fresh access token seamlessly.
- **Graceful Logout:** `authService.logout()` revokes the session record in PostgreSQL and commands the browser to clear the `refreshToken` cookie with `Max-Age=0`.

---

## 3. Passwordless Patient Report Verification

To uphold patient dignity and accessibility, patients are never forced to complete account registration to view their medical results.

```text
Step 1: Patient enters registered email in Check Reports section.
   │
Step 2: Frontend calls `POST /auth/resend-otp` (Rate limit: 10 per 15 min).
   │
Step 3: Backend verifies email existence, hashes 6-digit code with SHA-256,
        sets 10-minute expiry, and dispatches email via Nodemailer.
   │
Step 4: Frontend initiates a 60-second resend countdown timer.
   │
Step 5: Patient enters code -> Frontend calls `POST /auth/verify-otp`.
   │
Step 6: Backend checks attempts (max 5), marks OTP as used, sets email_verified = true.
   │
Step 7: Session established -> Frontend loads patient reports via `GET /reports/patient/:id`.
   │
Step 8: Patient clicks "Download PDF" -> Streams raw PDF Blob into browser memory.
```

---

## 4. Route Protection & Authorization

Client-side route guards are defined in `src/app.routes.jsx`:
- **`LabProtectedRoute`**: Verifies `isAuthenticated && (user.role === 'lab' || user.role === 'admin')`. Redirects unauthorized visitors to `/lab/login`.
- **`AdminProtectedRoute`**: Verifies `isAuthenticated && user.role === 'admin'`. Redirects unauthorized visitors to `/admin/login`.
- **Security Precaution:** Frontend route guards provide smooth user experience; the actual security boundary is enforced on every request by backend middleware (`authenticate.js` and `authorize.js`).
