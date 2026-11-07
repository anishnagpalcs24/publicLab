# PublicLab Frontend — Routing Specification

All application routes are centralized in a single file:
**[`src/app.routes.jsx`](file:///C:/Users/anish/OneDrive/Desktop/WEBDEVELOPMENT/Projects/PublicLab/Frontend/src/app.routes.jsx)**

No sub-route files or scattered route definitions exist elsewhere in the codebase.

---

## 1. Route Map

### 1.1 Public User Portal (Wrapped in `UserLayout`)
| URL Path | Component | Description |
|---|---|---|
| `/` | `Home` | Complete 12-section landing page with interactive hero, marquee, and review sections. |
| `/labs` | `LabSearch` | Searchable directory of accredited labs with city filters. |
| `/labs/:labId` | `LabDetails` | Detailed facility profile, license verification, and inline callback request. |
| `/test-packages` | `TestPackages` | Curated diagnostic profiles categorized by specialty (Full Body, Cardiac, etc.). |
| `/reports` | `Reports` | Dedicated passwordless report portal with security guarantees and FAQs. |
| `/callback` | `Callback` | Public callback submission page supporting pre-filled laboratory or package query strings. |
| `*` | `NotFound` | Accessible 404 page with return actions. |

---

### 1.2 Authentication Gateways
| URL Path | Component | Description |
|---|---|---|
| `/lab/login` | `LabLogin` | Dual-mode gateway supporting laboratory owner sign in and unified facility registration. |
| `/admin/login` | `AdminLogin` | Fixed administrator credentials console login. |

---

### 1.3 Laboratory Owner Portal (Wrapped in `LabProtectedRoute` + `LabLayout`)
| URL Path | Component | Description |
|---|---|---|
| `/lab` | Redirect | Redirects to `/lab/dashboard`. |
| `/lab/dashboard` | `LabDashboard` | Operational overview: patients, active test orders, published and draft reports. |
| `/lab/patients` | `LabPatients` | Patient directory, search by internal code, and registration modal. |
| `/lab/orders` | `LabOrders` | Diagnostic order lifecycle tracking and new order creation. |
| `/lab/reports` | `LabReports` | Draft report upload, one-click publishing, and version-controlled correction modal. |
| `/lab/subscription`| `LabSubscription`| Active facility subscription tier and plan selection. |
| `/lab/payments` | Redirect | Directs to `/lab/subscription`. |
| `/lab/settings` | `LabSettings` | Update facility address, phone helpline, email, and public description. |

---

### 1.4 Platform Administrator Portal (Wrapped in `AdminProtectedRoute` + `AdminLayout`)
| URL Path | Component | Description |
|---|---|---|
| `/admin` | Redirect | Redirects to `/admin/dashboard`. |
| `/admin/dashboard` | `AdminDashboard` | National network metrics: total labs, pending approvals, users, and orders. |
| `/admin/lab-approvals`| `AdminLabApprovals`| Accreditation review queue with one-click approval and mandatory rejection dialog. |
| `/admin/laboratories`| `AdminLaboratories`| Registered facilities directory with facility suspension controls. |
| `/admin/users` | `AdminUsers` | Platform accounts management and account status toggles. |
| `/admin/subscriptions`| `AdminSubscriptions`| Platform subscription tiers oversight. |
| `/admin/payments` | Redirect | Directs to `/admin/subscriptions`. |
| `/admin/settings` | Redirect | Directs to `/admin/dashboard`. |

---

## 2. Code-Splitting & Lazy Loading

Every major portal page is dynamically imported via `React.lazy()` and encapsulated within a top-level `<Suspense>` boundary displaying the branded `<Loader fullscreen text="Loading PublicLab..." />`. This keeps the initial bundle lightweight and loads portal chunks on demand.
