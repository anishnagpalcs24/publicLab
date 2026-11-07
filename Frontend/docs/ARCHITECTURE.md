# PublicLab Frontend — Four-Layer Architecture

PublicLab follows a strict **Four-Layer Architecture** guaranteeing clean separation of concerns, high testability, and maintainable boundaries across all three portals (Patient, Lab Owner, Admin).

```text
┌────────────────────────────────────────────────────────┐
│                      UI LAYER                          │
│   Components, Portal Pages, Layouts, Semantic JSX      │
└───────────────────────────▲────────────────────────────┘
                            │
┌───────────────────────────┴────────────────────────────┐
│                     HOOK LAYER                         │
│  useLabSearch, useReportAccess, useCallbackRequest, .. │
└───────────────────────────▲────────────────────────────┘
                            │
┌───────────────────────────┴────────────────────────────┐
│                    STATE LAYER                         │
│   AuthProvider, UserProvider, LabProvider, AdminProv   │
└───────────────────────────▲────────────────────────────┘
                            │
┌───────────────────────────┴────────────────────────────┐
│                     API LAYER                          │
│  Central Axios Client, Interceptors, Feature Services  │
└────────────────────────────────────────────────────────┘
```

---

## Layer 1: UI Layer
- **Location:** `src/Features/*/Component/`, `src/Features/*/Pages/`, `src/Shared/Component/`
- **Responsibilities:**
  - Render semantic, accessible JSX.
  - Present loading, empty, error, and verified success states.
  - Keep components modular without mixing direct network communication.
- **Rule:** UI components must **never** import `apiClient` or make direct `axios` calls. They interface strictly through custom hooks or state context.

---

## Layer 2: Hook Layer
- **Location:** `src/Features/*/hooks/`, `src/Shared/hooks/`
- **Responsibilities:**
  - Encapsulate feature-specific state machines (e.g., OTP countdown timers, step progression).
  - Orchestrate API calls and coordinate with the State Layer.
  - Examples:
    - `useLabSearch`: Search terms, city filtering, pagination, debouncing.
    - `useReportAccess`: 3-step passwordless OTP report access, 60-second cooldown timer, report downloads.
    - `useCallbackRequest`: Form submission state, rate limit handling.

---

## Layer 3: State Layer
- **Location:** `src/Features/*/state/`
- **Responsibilities:**
  - Provide cross-cutting domain state via React Context.
  - Prevent prop drilling across portal layouts.
  - Providers:
    - `AuthProvider`: Dual-token session, silent token refresh on boot, user roles.
    - `UserProvider`: Verified patient session, selected city filters.
    - `LabProvider`: Authenticated lab profile, operational summary metrics.
    - `AdminProvider`: Platform governance counts, pending application badges.

---

## Layer 4: API Layer
- **Location:** `src/Core/http/`, `src/Features/*/services/`
- **Responsibilities:**
  - `api.client.js`: Central Axios instance configured with `baseURL: VITE_API_BASE_URL` and `withCredentials: true`.
  - `interceptors.js`: Injects Bearer token, intercepts 401s for silent refresh via `/auth/refresh`, and normalizes error messages.
  - Service modules: `auth.service.js`, `lab.service.js`, `report.service.js`, `callback.service.js`, `admin.service.js`, `test.service.js`.
