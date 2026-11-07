// ============================================================================
// Public Callback Request Service
// ============================================================================
import apiClient from "../../../Core/http/api.client";

export const callbackService = {
  // Submit a public callback request
  async requestCallback({ name, phone, email, labId, message }) {
    return await apiClient.post("/callbacks", {
      name,
      phone,
      email: email || undefined,
      labId: labId ? Number(labId) : undefined,
      message: message || undefined,
    });
  },
};
