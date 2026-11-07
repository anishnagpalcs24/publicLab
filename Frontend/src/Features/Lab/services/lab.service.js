// ============================================================================
// Lab Owner Portal API Service
// ============================================================================
import apiClient from "../../../Core/http/api.client";

export const labOwnerService = {
  // Lab profile & settings
  async getMyLab() {
    return await apiClient.get("/labs/me");
  },

  async updateMyLab(updates) {
    return await apiClient.patch("/labs/me", updates);
  },

  // Operational Dashboard
  async getDashboard() {
    return await apiClient.get("/labs/me/dashboard");
  },

  // Application status & resubmission
  async getApplicationStatus() {
    return await apiClient.get("/labs/application/status");
  },

  async resubmitApplication(updates) {
    return await apiClient.post("/labs/application/resubmit", updates);
  },

  // Patient Management
  async getPatients({ search = "", limit = 20, offset = 0 } = {}) {
    const params = new URLSearchParams();
    if (search) params.append("search", search);
    params.append("limit", limit);
    params.append("offset", offset);
    return await apiClient.get(`/patients?${params.toString()}`);
  },

  async createPatient(patientData) {
    return await apiClient.post("/patients", patientData);
  },

  async getPatientById(patientId) {
    return await apiClient.get(`/patients/${patientId}`);
  },

  // Order Management
  async getOrders({ status = "", limit = 20, offset = 0 } = {}) {
    const params = new URLSearchParams();
    if (status) params.append("status", status);
    params.append("limit", limit);
    params.append("offset", offset);
    return await apiClient.get(`/orders?${params.toString()}`);
  },

  async createOrder({ patientId, items }) {
    return await apiClient.post("/orders", { patientId, items });
  },

  async updateOrderStatus(orderId, status) {
    return await apiClient.patch(`/orders/${orderId}/status`, { status });
  },

  // Medical Reports Management
  async getReports({ status = "", limit = 20, offset = 0 } = {}) {
    const params = new URLSearchParams();
    if (status) params.append("status", status);
    params.append("limit", limit);
    params.append("offset", offset);
    return await apiClient.get(`/reports?${params.toString()}`);
  },

  async createReport({ orderId, patientId, fileData, filename, mimeType }) {
    return await apiClient.post("/reports", {
      orderId,
      patientId,
      fileData,
      filename,
      mimeType,
    });
  },

  async publishReport(reportId) {
    return await apiClient.patch(`/reports/${reportId}/publish`, {});
  },

  async correctReport(reportId, { fileData, filename, reason }) {
    return await apiClient.post(`/reports/${reportId}/correct`, {
      fileData,
      filename,
      reason,
    });
  },

  // Subscriptions & Plans
  async getSubscriptionPlans() {
    return await apiClient.get("/subscriptions/plans");
  },

  async getMySubscriptions() {
    return await apiClient.get("/subscriptions/me");
  },

  async createSubscription(planId) {
    return await apiClient.post("/subscriptions", { planId });
  },

  async cancelSubscription(subscriptionId) {
    return await apiClient.post(`/subscriptions/${subscriptionId}/cancel`, {});
  },

  // Clinical Calculator Module
  async calculateMetric({ metricType, inputs }) {
    return await apiClient.post("/labs/calculator/calculate", {
      metricType,
      inputs,
    });
  },

  async saveCalculation(data) {
    return await apiClient.post("/labs/calculations", data);
  },

  async getSavedCalculations({ limit = 20, offset = 0 } = {}) {
    return await apiClient.get(`/labs/calculations?limit=${limit}&offset=${offset}`);
  },
};
