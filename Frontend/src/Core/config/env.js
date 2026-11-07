// ============================================================================
// Core Environment Configuration
// ============================================================================

export const ENV = {
  API_BASE_URL: import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api/v1",
  APP_NAME: import.meta.env.VITE_APP_NAME || "PublicLab",
  IS_PROD: import.meta.env.PROD,
  IS_DEV: import.meta.env.DEV,
  ENABLE_MOCKS: import.meta.env.VITE_ENABLE_MOCKS === "true",
};
