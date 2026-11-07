# PublicLab Frontend — API Integration Manual

This document details all API services, endpoint contracts, request/response formats, and token lifecycle mechanisms implemented in the frontend under **Layer 4 (API Layer)**.

---

## 1. Central HTTP Client (`src/Core/http/api.client.js`)

PublicLab operates through a central Axios instance:
- **Base URL:** Driven by `VITE_API_BASE_URL` (Defaults to `http://localhost:5000/api/v1` in production or `/api/v1` via Vite proxy in development).
- **Credentials:** `withCredentials: true` is strictly enabled so HttpOnly session cookies (`refreshToken`) are transmitted automatically.
- **Timeout:** 30,000ms.

---

## 2. Token Lifecycle & Interceptor Pipeline (`src/Core/http/interceptors.js`)

```text
Outgoing Request
   │
   ├─► Is Access Token in memory?
   │      ├─ YES: Injects `Authorization: Bearer <token>`
   │      └─ NO: Proceeds (Public endpoints)
   │
Backend API Response
   │
   ├─► Status 200/201: Unwraps `response.data`
   │
   └─► Status 401 Unauthorized:
          ├─ Is request /auth/login, /admin/login, or /auth/refresh?
          │      └─ YES: Rejects immediately (Invalid credentials)
          │
          └─ NO: Initiates silent token refresh:
                 1. Holds subsequent requests in `failedQueue`.
                 2. Calls `POST /auth/refresh` (cookie authenticated).
                 3. Receives new `accessToken` & updates memory.
                 4. Retries original request with new token.
                 5. Flushes `failedQueue`.
```

---

## 3. API Services Matrix

### 3.1 Authentication Service (`src/Features/Auth/services/auth.service.js`)

| Method | Endpoint | HTTP | Auth | Payload | Response Data |
|---|---|---|---|---|---|
| `register(data)` | `/auth/register` | `POST` | None | `{ fullName, email, phone, password }` | `{ email, requiresVerification }` |
| `registerLab(data)` | `/labs` | `POST` | None | `{ name, registrationNumber, email, phone, city, address, ownerFullName, ownerEmail, ownerPhone, password }` | Combined Lab & Owner record |
| `verifyOtp(data)` | `/auth/verify-otp` | `POST` | None | `{ email, otp }` | `{ user, accessToken }` |
| `resendOtp(email)` | `/auth/resend-otp` | `POST` | None | `{ email }` | `{ message }` |
| `login(creds)` | `/auth/login` | `POST` | None | `{ email, password }` | `{ user, accessToken }` |
| `adminLogin(creds)` | `/admin/login` | `POST` | None | `{ username, password }` | `{ user, accessToken }` |
| `refreshToken()` | `/auth/refresh` | `POST` | Cookie | `{}` | `{ accessToken }` |
| `getMe()` | `/auth/me` | `GET` | Bearer | None | `{ user, session }` |
| `logout()` | `/auth/logout` | `POST` | None | `{}` | Session revoked & cookie cleared |

---

### 3.2 Patient Reports Service (`src/Features/User/services/report.service.js`)

| Method | Endpoint | HTTP | Auth | Notes |
|---|---|---|---|---|
| `requestReportOtp(email)` | `/auth/resend-otp` | `POST` | None | Dispatches 6-digit verification code to patient email |
| `verifyReportOtp({ email, otp })` | `/auth/verify-otp` | `POST` | None | Authenticates session without password and fetches patient reports |
| `downloadReport(reportId)` | `/reports/:reportId/download` | `GET` | Bearer | Fetches raw PDF Blob and triggers browser file download |

---

### 3.3 Public Laboratory Service (`src/Features/User/services/lab.service.js`)

| Method | Endpoint | HTTP | Auth | Query Parameters |
|---|---|---|---|---|
| `getLabs(params)` | `/labs` | `GET` | None | `?search=...&city=...&limit=20&offset=0` |
| `getLabById(labId)` | `/labs/:labId` | `GET` | None | Facility ID |

---

### 3.4 Public Callback Service (`src/Features/User/services/callback.service.js`)

| Method | Endpoint | HTTP | Auth | Payload |
|---|---|---|---|---|
| `requestCallback(data)` | `/callbacks` | `POST` | None | `{ name, phone, email?, labId?, message? }` |

---

### 3.5 Laboratory Owner Service (`src/Features/Lab/services/lab.service.js`)

| Method | Endpoint | HTTP | Roles | Purpose |
|---|---|---|---|---|
| `getMyLab()` | `/labs/me` | `GET` | `lab`, `admin` | View facility profile & operating hours |
| `updateMyLab(updates)` | `/labs/me` | `PATCH` | `lab`, `admin` | Update address, phone, and services |
| `getDashboard()` | `/labs/me/dashboard` | `GET` | `lab`, `admin` | Operational summary counts |
| `getPatients(params)` | `/patients` | `GET` | `lab`, `admin` | Search patient directory |
| `createPatient(data)` | `/patients` | `POST` | `lab`, `admin` | Register patient under lab isolation |
| `getOrders(params)` | `/orders` | `GET` | `lab` | Order tracking |
| `createOrder(data)` | `/orders` | `POST` | `lab` | Create test order line items |
| `updateOrderStatus(id, status)`| `/orders/:id/status`| `PATCH` | `lab` | Transition status (`created`, `confirmed`, `processing`, `completed`) |
| `getReports(params)` | `/reports` | `GET` | `lab` | List lab reports by status |
| `createReport(data)` | `/reports` | `POST` | `lab` | Upload draft PDF document |
| `publishReport(reportId)` | `/reports/:id/publish`| `PATCH` | `lab` | Make report visible for patient OTP access |
| `correctReport(id, data)` | `/reports/:id/correct`| `POST` | `lab` | Upload revised version with mandatory reason |
| `getSubscriptionPlans()` | `/subscriptions/plans`| `GET` | None | List active tiers |
| `getMySubscriptions()` | `/subscriptions/me` | `GET` | `lab` | Current active subscription |
| `createSubscription(planId)` | `/subscriptions` | `POST` | `lab` | Activate plan tier |

---

### 3.6 Administrator Governance Service (`src/Features/Admin/services/admin.service.js`)

| Method | Endpoint | HTTP | Roles | Purpose |
|---|---|---|---|---|
| `getDashboard()` | `/admin/dashboard` | `GET` | `admin` | High-level national metrics |
| `getLabApplications(params)`| `/admin/labs/applications`| `GET` | `admin` | Pending & reviewed accreditation queue |
| `reviewLabApplication(id, data)`| `/admin/labs/applications/:id/review`| `PATCH` | `admin` | Approve or Reject with reason |
| `suspendLab(id, reason)` | `/admin/labs/:id/suspend`| `PATCH` | `admin` | Emergency facility suspension |
| `getUsers(params)` | `/admin/users` | `GET` | `admin` | Platform user directory |
| `updateUserStatus(id, data)`| `/admin/users/:id/status`| `PATCH` | `admin` | Activate or suspend user |
| `getCallbacks(params)` | `/admin/callbacks` | `GET` | `admin` | Public callback oversight |
| `getAuditLogs(params)` | `/admin/audit-logs` | `GET` | `admin` | Cryptographic audit trail |
