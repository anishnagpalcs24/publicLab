# PublicLab API Documentation

## 1. Overview

**Base URL:** `http://localhost:5000/api/v1`  
**Data Format:** JSON  
**Access Token:** Sent in the `Authorization: Bearer <accessToken>` header (expires in 15 minutes).  
**Refresh Token:** Stored in an `HttpOnly`, `SameSite`, `Path=/api/v1/auth` cookie (expires in 7 days).

---

## 2. Standard Response Format

### Success Response:
```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": {}
}
```

### Error Response:
```json
{
  "success": false,
  "message": "Error description"
}
```

---

## 3. Implemented Endpoints

### 3.1 Health
| Method | Endpoint | Auth | Purpose |
|---|---|---|---|
| GET | `/health` | None | API and database health status |

---

### 3.2 Authentication (`/auth`)

All authentication endpoints are located under `/api/v1/auth`.

| Method | Endpoint | Auth | Rate Limit | Purpose |
|---|---|---|---|---|
| POST | `/auth/register` | None | 20 / 15m | Register account (supports `role: 'lab'`) and dispatch 6-digit OTP |
| POST | `/auth/verify-otp` | None | 10 / 15m | Verify OTP, activate user, receive tokens |
| POST | `/auth/resend-otp` | None | 10 / 15m | Resend email verification code |
| POST | `/auth/login` | None | 10 / 15m | Login verified user, establish session |
| POST | `/auth/refresh` | Cookie | None | Rotate refresh token & issue new access token |
| POST | `/auth/forgot-password` | None | 10 / 15m | Request 6-digit password reset OTP |
| POST | `/auth/reset-password` | None | 10 / 15m | Reset password with OTP & revoke all active sessions |
| POST | `/auth/change-password` | Bearer | None | Change password for logged-in user |
| POST | `/auth/logout` | Optional | None | Revoke current session & clear cookie |
| POST | `/auth/logout-all` | Bearer | None | Revoke all active sessions for user |
| GET | `/auth/me` | Bearer | None | View current user & active session ID |

#### Sample Request & Response Bodies:

##### `POST /api/v1/auth/register`
**Request Body:**
```json
{
  "fullName": "Dr. Sarah Connor",
  "email": "sarah@example.com",
  "phone": "+919876543210",
  "password": "StrongPassword123!"
}
```
**Response (201 Created):**
```json
{
  "success": true,
  "message": "Registration successful. Please verify the OTP sent to your email.",
  "data": {
    "email": "sarah@example.com",
    "requiresVerification": true
  }
}
```

##### `POST /api/v1/auth/verify-otp`
**Request Body:**
```json
{
  "email": "sarah@example.com",
  "otp": "481920"
}
```
**Response (200 OK) + `Set-Cookie: refreshToken=...; HttpOnly; Path=/api/v1/auth; Max-Age=604800`:**
```json
{
  "success": true,
  "message": "Email verified successfully",
  "data": {
    "user": {
      "id": "1",
      "fullName": "Dr. Sarah Connor",
      "email": "sarah@example.com",
      "phone": "+919876543210",
      "role": "patient",
      "labId": null,
      "accountStatus": "active",
      "emailVerified": true
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

##### `POST /api/v1/auth/resend-otp`
**Request Body:**
```json
{
  "email": "sarah@example.com"
}
```
**Response (200 OK):**
```json
{
  "success": true,
  "message": "A new verification code has been sent to your email address."
}
```

##### `POST /api/v1/auth/login`
**Request Body:**
```json
{
  "email": "sarah@example.com",
  "password": "StrongPassword123!"
}
```
**Response (200 OK) + `Set-Cookie: refreshToken=...; HttpOnly; Path=/api/v1/auth; Max-Age=604800`:**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": "1",
      "fullName": "Dr. Sarah Connor",
      "email": "sarah@example.com",
      "phone": "+919876543210",
      "role": "patient",
      "labId": null,
      "accountStatus": "active",
      "emailVerified": true
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

##### `POST /api/v1/auth/refresh`
**Request:** Sends the `refreshToken` HttpOnly cookie automatically.
**Response (200 OK) + Rotated `Set-Cookie: refreshToken=...`:**
```json
{
  "success": true,
  "message": "Token refreshed successfully",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

##### `POST /api/v1/auth/logout`
**Request:** Optional Bearer token or HttpOnly cookie.
**Response (200 OK) + `Set-Cookie: refreshToken=; Path=/api/v1/auth; Max-Age=0`:**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

##### `POST /api/v1/auth/logout-all`
**Headers:** `Authorization: Bearer <accessToken>`
**Response (200 OK):**
```json
{
  "success": true,
  "message": "All active sessions have been revoked successfully"
}
```

##### `GET /api/v1/auth/me`
**Headers:** `Authorization: Bearer <accessToken>`
**Response (200 OK):**
```json
{
  "success": true,
  "message": "Current profile retrieved successfully",
  "data": {
    "user": {
      "id": "1",
      "fullName": "Dr. Sarah Connor",
      "email": "sarah@example.com",
      "phone": "+919876543210",
      "role": "patient",
      "labId": null,
      "accountStatus": "active",
      "emailVerified": true,
      "sessionId": "4"
    },
    "session": {
      "id": "4"
    }
  }
}
```

---

### 3.3 Users (`/users`)
| Method | Endpoint | Auth | Roles | Purpose |
|---|---|---|---|---|
| GET | `/users/me` | Bearer | Any | View authenticated user profile |
| PATCH | `/users/me` | Bearer | Any | Update profile (full_name, email, phone) |
| GET | `/users` | Bearer | `admin` | Search and list platform users (paginated) |
| GET | `/users/:userId` | Bearer | `admin` | View specific user profile |

### 3.4 Laboratories (`/labs`)
| Method | Endpoint | Auth | Roles | Purpose |
|---|---|---|---|---|
| POST | `/labs` | Optional Bearer | Public / Lab | Unified single-form registration (creates owner account + lab + sends OTP) OR authenticated lab submission |
| GET | `/labs` | None | Public | Search approved laboratories |
| GET | `/labs/:labId` | None | Public | View public laboratory profile |
| GET | `/labs/me` | Bearer | `lab`, `admin` | View authenticated owner's laboratory profile |
| PATCH | `/labs/me` | Bearer | `lab`, `admin` | Update laboratory profile & operational settings |
| GET | `/labs/me/dashboard` | Bearer | `lab`, `admin` | Lab operational dashboard & summary metrics |
| GET | `/labs/application/status` | Bearer | Any | Check application approval status & review reasons |
| POST | `/labs/application/resubmit` | Bearer | `lab`, `admin` | Resubmit a rejected laboratory application |
| POST | `/labs/calculator/calculate` | Bearer | `lab`, `admin` | Calculate clinical metrics (eGFR, LDL, HOMA-IR, FAI) |
| POST | `/labs/calculations` | Bearer | `lab`, `admin` | Save calculation with optional patient association |
| GET | `/labs/calculations` | Bearer | `lab`, `admin` | List saved calculations for laboratory |
| GET | `/labs/calculations/:id` | Bearer | `lab`, `admin` | Retrieve specific calculation details |
| GET | `/labs/admin/applications` | Bearer | `admin` | List pending/reviewed lab applications |
| PATCH | `/labs/admin/applications/:labId/review` | Bearer | `admin` | Approve or reject a lab application |
| PATCH | `/labs/admin/:labId/suspend` | Bearer | `admin` | Suspend an approved laboratory |

##### `POST /api/v1/labs` (Unified Registration)
Submits a laboratory application and simultaneously creates the owner user account in an atomic database transaction.
Generates an email OTP verification code and sets the lab application status to `pending` (admin approval mandatory).

**Request Body (Unauthenticated Combined Form):**
```json
{
  "labName": "Apex Clinical Diagnostics",
  "email": "contact@apexlabs.com",
  "phone": "+919876543210",
  "address": "45 Diagnostic Park, Andheri East",
  "city": "Mumbai",
  "state": "Maharashtra",
  "pincode": "400069",
  "licenseNumber": "NABL-MUM-2026-99",
  "operatingHours": { "mon-sat": "07:00-21:00", "sun": "08:00-14:00" },
  "homeCollectionAvailable": true,
  "technicalContact": {
    "name": "Jane Doe",
    "email": "tech@apexlabs.com",
    "phone": "+919876543299"
  },
  "ownerFullName": "Dr. Sarah Connor",
  "ownerEmail": "sarah.connor@apexlabs.com",
  "ownerPhone": "+919876543210",
  "password": "SecurePassword123!"
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "message": "Laboratory application and owner account created successfully. Verification OTP has been sent to your email.",
  "data": {
    "id": 1,
    "name": "Apex Clinical Diagnostics",
    "approval_status": "pending",
    "technical_contact": {
      "name": "Jane Doe",
      "email": "tech@apexlabs.com",
      "phone": "+919876543299"
    },
    "owner": {
      "id": "1",
      "fullName": "Dr. Sarah Connor",
      "email": "sarah.connor@apexlabs.com",
      "phone": "+919876543210",
      "role": "lab",
      "accountStatus": "active",
      "emailVerified": false
    }
  }
}
```

### 3.5 Patients (`/patients`)
| Method | Endpoint | Auth | Roles | Purpose |
|---|---|---|---|---|
| POST | `/patients` | Bearer | `lab`, `admin` | Register a patient under laboratory |
| GET | `/patients` | Bearer | `lab`, `admin` | List and search patients (`?search=...`) |
| GET | `/patients/reference/:code` | Bearer | `lab`, `admin` | Lookup patient by local patient code |
| GET | `/patients/:patientId` | Bearer | `lab`, `admin` | View patient details and activity counts |
| PATCH | `/patients/:patientId` | Bearer | `lab`, `admin` | Update patient details |
| GET | `/patients/:patientId/calculations` | Bearer | `lab`, `admin` | View patient's saved clinical calculations |

### 3.6 Orders (`/orders`)
| Method | Endpoint | Auth | Roles | Purpose |
|---|---|---|---|---|
| POST | `/orders` | Bearer | `lab` | Create an order with test items |
| GET | `/orders` | Bearer | `lab` | List orders for the authenticated lab |
| GET | `/orders/patient/:patientId` | Bearer | Any | List orders for a specific patient |
| GET | `/orders/:orderId` | Bearer | Any | Get order details |
| PATCH | `/orders/:orderId/status` | Bearer | `lab` | Update order processing status |

### 3.7 Medical Reports (`/reports`)
| Method | Endpoint | Auth | Roles | Purpose |
|---|---|---|---|---|
| POST | `/reports` | Bearer | `lab` | Create/upload a report record |
| GET | `/reports` | Bearer | `lab` | List reports for the authenticated lab |
| GET | `/reports/patient/:patientId` | Bearer | Any | List reports for a patient |
| GET | `/reports/:reportId` | Bearer | Any | View report metadata |
| PATCH | `/reports/:reportId/publish` | Bearer | `lab` | Publish a report to make visible |
| POST | `/reports/:reportId/correct` | Bearer | `lab` | Upload corrected version with reason |
| GET | `/reports/:reportId/download` | Bearer | Any | Authorized report download |

### 3.8 Callbacks (`/callbacks`)
| Method | Endpoint | Auth | Roles | Purpose |
|---|---|---|---|---|
| POST | `/callbacks` | None | Public | Submit callback request |
| GET | `/callbacks` | Bearer | `admin` | List callback requests |
| GET | `/callbacks/:callbackId` | Bearer | `admin` | View specific callback request |
| PATCH | `/callbacks/:callbackId/status` | Bearer | `admin` | Update status (pending, contacted, completed) |
| DELETE | `/callbacks/:callbackId` | Bearer | `admin` | Delete or dismiss a callback |

### 3.9 Subscriptions (`/subscriptions`)
| Method | Endpoint | Auth | Roles | Purpose |
|---|---|---|---|---|
| GET | `/subscriptions/plans` | None | Public | List active subscription plans |
| GET | `/subscriptions/plans/:planId` | None | Public | View specific subscription plan |
| POST | `/subscriptions` | Bearer | `lab` | Subscribe lab to a plan |
| GET | `/subscriptions/me` | Bearer | `lab` | View authenticated lab's subscriptions |
| GET | `/subscriptions/:subscriptionId` | Bearer | `lab`, `admin` | Get specific subscription details |
| POST | `/subscriptions/:subscriptionId/cancel` | Bearer | `lab` | Cancel an active subscription |

### 3.10 Payments (`/payments`)
| Method | Endpoint | Auth | Roles | Purpose |
|---|---|---|---|---|
| POST | `/payments/orders/:orderId` | Bearer | `lab` | Create pending payment for order |
| POST | `/payments/subscriptions/:subscriptionId` | Bearer | `lab` | Create pending payment for subscription |
| GET | `/payments/orders/:orderId` | Bearer | Any | List payments for an order |
| GET | `/payments/subscriptions/:subscriptionId` | Bearer | Any | List payments for a subscription |
| GET | `/payments/:paymentId` | Bearer | Any | Get payment details by ID |
| POST | `/payments/webhook` | None | Public (verified) | Provider webhook notification |

### 3.11 Admin Portal (`/admin`)
| Method | Endpoint | Auth | Roles | Purpose |
|---|---|---|---|---|
| POST | `/admin/login` | None (Rate-limited) | Public / Admin | Fixed administrator login using `ADMIN_USERNAME` & `ADMIN_PASSWORD_HASH` |
| GET | `/admin/dashboard` | Bearer | `admin` | Platform metrics & counts summary |
| GET | `/admin/users` | Bearer | `admin` | List & search platform users |
| PATCH | `/admin/users/:userId/status` | Bearer | `admin` | Change user account status |
| GET | `/admin/labs/applications` | Bearer | `admin` | List lab applications with full owner details & contact information |
| PATCH | `/admin/labs/applications/:labId/review` | Bearer | `admin` | Approve or reject a lab application |
| PATCH | `/admin/labs/:labId/suspend` | Bearer | `admin` | Suspend an approved laboratory |
| GET | `/admin/callbacks` | Bearer | `admin` | Oversee all callback requests |
| GET | `/admin/audit-logs` | Bearer | `admin` | Inspect platform audit trail |

##### `POST /api/v1/admin/login`
Authenticates the fixed platform administrator against `ADMIN_USERNAME` and `ADMIN_PASSWORD_HASH` stored in the environment.
Issues a short-lived access token and a 7-day HttpOnly refresh token cookie.

**Request Body:**
```json
{
  "username": "admin",
  "password": "YourAdminPasswordHere"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Administrator logged in successfully",
  "data": {
    "user": {
      "id": "50",
      "fullName": "PublicLab Administrator",
      "email": "admin@publiclab.internal",
      "role": "admin",
      "accountStatus": "active",
      "emailVerified": true
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

##### `GET /api/v1/admin/labs/applications?status=pending`
Returns a paginated list of laboratory applications with complete laboratory details, contact details, address, and joined owner information (`owner_name`, `owner_email`, `owner_phone`).

##### `PATCH /api/v1/admin/labs/applications/:labId/review`
Approves or rejects a pending laboratory application.

**Request Body (Approve):**
```json
{
  "status": "approved"
}
```

**Request Body (Reject):**
```json
{
  "status": "rejected",
  "reason": "Missing state clinical license accreditation certificate"
}
```
