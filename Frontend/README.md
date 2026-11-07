# PublicLab Frontend

PublicLab is a modern healthcare technology platform connecting patients with accredited diagnostic laboratories and enabling secure, passwordless medical report access.

## Architecture

This frontend is developed under a strict **Four-Layer Architecture**:
1. **Layer 1 — UI Layer:** Reusable components, portal pages, and responsive layouts.
2. **Layer 2 — Hook Layer:** Custom React hooks (`useLabSearch`, `useReportAccess`, `useCallbackRequest`, etc.) encapsulating application state logic.
3. **Layer 3 — State Layer:** Context providers (`AuthProvider`, `UserProvider`, `LabProvider`, `AdminProvider`) managing session and domain data without prop drilling.
4. **Layer 4 — API Layer:** Central Axios HTTP client with request/response interceptors, automatic dual-token refresh, and service modules.

## Tech Stack
- **Framework:** React 18, Vite 5 (Pure ES Modules & JSX)
- **Routing:** React Router DOM 6 (single routing definition in `src/app.routes.jsx`)
- **Styling:** SCSS (Dart Sass) with centralized design tokens & BEM conventions
- **Icons & Motion:** Lucide React & Motion for React
- **Validation:** React Hook Form + Zod

## Running Locally

```bash
cd Frontend
npm install
npm run dev
```

Build for production:
```bash
npm run build
```
