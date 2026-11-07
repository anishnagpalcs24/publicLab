# PublicLab Frontend — Design System & Visual Identity

The PublicLab design system communicates **trust, clinical precision, simplicity, and modern healthcare technology**.

---

## 1. Color Palette

All design tokens are defined in SCSS variables (`src/styles/abstracts/_variables.scss`) and CSS custom properties (`src/styles/themes/_tokens.scss`).

### Primary Brand
- **Deep Teal (`#0F766E`):** Represents clinical authority, diagnostic trust, and stability.
- **Deep Teal Hover (`#115E59`):** Interactive state for primary buttons and active navigation links.
- **Deep Teal Light (`#CCFBF1`):** Subtle card headers, badge backgrounds, and active pill highlights.
- **Deep Teal Dark (`#042F2E`):** Premium footer surface and brand badges.

### Supporting Accents
- **Medical Blue (`#2563EB`):** Secondary CTA buttons, patient portals, and processing indicators.
- **Medical Blue Light (`#DBEAFE`):** Information tags and category pills.
- **Fresh Green (`#16A34A`):** Success states, published report badges, and verified license indicators.
- **Fresh Green Light (`#DCFCE7`):** Verified facility background tint.

### Neutrals & Surfaces
- **Background (`#F8FAFC`):** Slate-tinted ultra-clean background avoiding stark clinical white.
- **Surface (`#FFFFFF`):** High-elevation cards, modals, and input controls.
- **Surface Hover (`#F1F5F9`):** Secondary interactive hover states.
- **Borders (`#E2E8F0`):** Crisp, subtle 1px dividers.

### Feedback
- **Warning Amber (`#D97706`, Light: `#FEF3C7`):** Pending approvals and fasting prerequisites.
- **Danger Red (`#DC2626`, Light: `#FEE2E2`):** Form errors, rejections, and suspensions.

---

## 2. Typography

- **Font Family:** `Inter`, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif.
- **Scale:**
  - `Display / H1`: `2.25rem` (Mobile) / `3rem` to `3.5rem` (Desktop), Weight: 800 (Extrabold).
  - `H2`: `1.875rem` / `2.25rem`, Weight: 700 (Bold).
  - `H3`: `1.5rem` / `1.875rem`, Weight: 700 (Bold).
  - `H4`: `1.25rem` / `1.5rem`, Weight: 600 (Semibold).
  - `Body / Base`: `1rem` (16px), Line Height: 1.6, Color: `#64748B`.
  - `Small / Meta`: `0.75rem` (12px) to `0.875rem` (14px).

---

## 3. Shadows & Radii

- **Border Radii:**
  - Small elements (pills, badges): `9999px` (Full radius).
  - Inputs, buttons: `8px` (`$radius-md`).
  - Cards, modal containers: `16px` to `24px` (`$radius-xl` / `$radius-2xl`).
- **Elevation:**
  - Card resting: `0 1px 3px rgba(15, 23, 42, 0.05)`.
  - Card hover: `0 10px 15px -3px rgba(15, 23, 42, 0.08)`.
  - Modals & overlays: `0 20px 25px -5px rgba(15, 23, 42, 0.1)`.
