// ============================================================================
// Patient Report Access API Service (Passwordless OTP Verification)
// ============================================================================
import apiClient from "../../../Core/http/api.client";
import { setAuthToken, getAuthToken } from "../../../Core/http/interceptors";

export const patientReportService = {
  // Request verification OTP for registered patient email address
  async requestReportOtp(email) {
    const res = await apiClient.post("/reports/request-otp", {
      email: email.trim().toLowerCase(),
    });
    return res;
  },

  // Submit 6-digit OTP for verification and receive patient's published reports
  async verifyReportOtp({ email, otp }) {
    const res = await apiClient.post("/reports/verify-otp", {
      email: email.trim().toLowerCase(),
      otp: String(otp).trim(),
    });

    const data = res?.data || res;
    if (data?.accessToken) {
      setAuthToken(data.accessToken);
      sessionStorage.setItem("pl_patient_report_token", data.accessToken);
    }

    return {
      accessToken: data?.accessToken,
      patient: data?.patient,
      reports: data?.reports || [],
    };
  },

  // Download or securely access report file
  async downloadReport(reportId, filename = "medical_report.pdf") {
    const token = getAuthToken() || sessionStorage.getItem("pl_patient_report_token");
    const headers = {};
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const res = await apiClient.get(`/reports/${reportId}/download`, {
      responseType: "blob",
      headers,
    });

    const blob = res instanceof Blob ? res : new Blob([res], { type: "application/pdf" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", filename || `medical_report_${reportId}.pdf`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => window.URL.revokeObjectURL(url), 1000);
  },
};
