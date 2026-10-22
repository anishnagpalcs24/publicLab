# PublicLab API Documentation

## 1. Overview

PublicLab APIs will be implemented using Node.js and Express.js.

**Base URL (development):**

`http://localhost:5000/api/v1`

The versioned prefix is planned and must be configured in Express.

## 2. Authentication

Protected endpoints require an authenticated account and appropriate permissions.

Authentication requirements:
- Email verification
- Secure login and logout
- Password recovery
- OTP verification where required
- Role-based access control
- Rate limiting on authentication endpoints

The final session or token strategy will be documented after implementation.

## 3. Planned Endpoints

### Authentication

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/auth/register` | Register a user |
| POST | `/auth/login` | Authenticate a user |
| POST | `/auth/logout` | End the session |
| POST | `/auth/verify-email` | Verify an email address |
| POST | `/auth/forgot-password` | Request password recovery |
| POST | `/auth/reset-password` | Reset a password |

### Public Laboratory Discovery

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/labs` | Search approved laboratories |
| GET | `/labs/:labId` | View a public laboratory profile |
| GET | `/labs/:labId/tests` | View listed tests or services |
| POST | `/callbacks` | Submit a callback request |

Public listing endpoints must not expose private laboratory or patient information.

### Laboratory Management

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/labs/register` | Submit a laboratory application |
| GET | `/labs/me` | View the authenticated lab profile |
| PATCH | `/labs/me` | Update permitted laboratory details |
| GET | `/labs/me/orders` | View authorised lab orders |
| POST | `/labs/me/orders` | Create a test order |
| POST | `/labs/me/reports` | Initiate a report upload |

These are proposed routes. The final route design may change to maintain consistent resource ownership and permissions.

### Patient Reports

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/patients/me/reports` | View reports linked to the authenticated patient |
| GET | `/reports/:reportId` | View authorised report metadata |
| POST | `/reports/:reportId/download-link` | Request secure report access |

Report access must be authorised on the server. A report ID alone must never grant access.

### Administration

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/admin/labs/pending` | List pending laboratory applications |
| PATCH | `/admin/labs/:labId/decision` | Approve or reject an application |
| GET | `/admin/users` | Manage authorised user records |
| GET | `/admin/audit-logs` | Review permitted audit records |

All administrative endpoints require appropriate administrative permissions.

### Subscriptions and Payments

Subscription and payment endpoints will be specified after the payment provider and billing workflow have been selected.

## 4. Standard Response Format

Successful response example:

```json
{
  "success": true,
  "message": "Request completed successfully",
  "data": {}
}
```

Error response example:

```json
{
  "success": false,
  "message": "Request could not be completed",
  "code": "REQUEST_ERROR"
}
```

Actual responses may differ according to the implemented API contract.

## 5. HTTP Status Codes

- `200` — Successful request
- `201` — Resource created
- `400` — Invalid request
- `401` — Authentication required
- `403` — Insufficient permissions
- `404` — Resource not found
- `409` — Resource conflict
- `422` — Validation error, if adopted by the API
- `429` — Rate limit exceeded
- `500` — Internal server error

## 6. API Security

- Validate request parameters and request bodies.
- Authenticate protected requests.
- Enforce role and resource-level permissions.
- Rate-limit sensitive endpoints.
- Avoid returning secrets or sensitive patient information in errors.
- Verify payment webhooks before recording payment success.

## 7. Implementation Status

All endpoints in this document are planned until implemented and tested.

Update this document whenever routes, request schemas, response schemas, or permissions change.
