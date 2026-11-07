// ============================================================================
// Admin Portal API Service
// ============================================================================
import apiClient from "../../../Core/http/api.client";

export const adminService = {
  // Admin dashboard metrics
  async getDashboard() {
    return await apiClient.get("/admin/dashboard");
  },

  // Laboratory application review
  async getLabApplications({ status = "", search = "", limit = 20, offset = 0 } = {}) {
    const params = new URLSearchParams();
    if (status) params.append("status", status);
    if (search) params.append("search", search);
    params.append("limit", limit);
    params.append("offset", offset);
    return await apiClient.get(`/admin/labs/applications?${params.toString()}`);
  },

  async reviewLabApplication(labId, { status, reason }) {
    return await apiClient.patch(`/admin/labs/applications/${labId}/review`, {
      status,
      reason,
    });
  },

  async suspendLab(labId, reason) {
    return await apiClient.patch(`/admin/labs/${labId}/suspend`, { reason });
  },

  async deleteLab(labId) {
    return await apiClient.delete(`/admin/labs/${labId}`);
  },

  // User management
  async getUsers({ search = "", status = "", limit = 20, offset = 0 } = {}) {
    const params = new URLSearchParams();
    if (search) params.append("search", search);
    if (status) params.append("status", status);
    params.append("limit", limit);
    params.append("offset", offset);
    return await apiClient.get(`/admin/users?${params.toString()}`);
  },

  async updateUserStatus(userId, { status, reason }) {
    return await apiClient.patch(`/admin/users/${userId}/status`, {
      status,
      reason,
    });
  },

  async deleteUser(userId) {
    return await apiClient.delete(`/admin/users/${userId}`);
  },

  // Callbacks oversight
  async getCallbacks({ status = "", limit = 20, offset = 0 } = {}) {
    const params = new URLSearchParams();
    if (status) params.append("status", status);
    params.append("limit", limit);
    params.append("offset", offset);
    return await apiClient.get(`/admin/callbacks?${params.toString()}`);
  },

  async updateCallbackStatus(callbackId, status) {
    return await apiClient.patch(`/callbacks/${callbackId}/status`, { status });
  },

  async deleteCallback(callbackId) {
    return await apiClient.delete(`/callbacks/${callbackId}`);
  },

  // Audit Logs
  async getAuditLogs({ action = "", limit = 50, offset = 0 } = {}) {
    const params = new URLSearchParams();
    if (action) params.append("action", action);
    params.append("limit", limit);
    params.append("offset", offset);
    return await apiClient.get(`/admin/audit-logs?${params.toString()}`);
  },
};
