// ============================================================================
// Auth API Service
// ============================================================================
import apiClient from "../../../Core/http/api.client";
import { setAuthToken, clearAuthToken } from "../../../Core/http/interceptors";

export const authService = {
  // Register general user / patient
  async register(data) {
    return await apiClient.post("/auth/register", data);
  },

  // Unified Lab + Owner Registration (atomic backend transaction)
  async registerLab(data) {
    const payload = {
      name: data.name || data.labName,
      registrationNumber: data.registrationNumber || data.licenseNumber,
      email: data.email || data.labEmail,
      phone: data.phone || data.labPhone,
      city: data.city,
      address: data.address,
      ownerFullName: data.ownerFullName || data.ownerName || data.fullName,
      ownerEmail: data.ownerEmail || data.email,
      ownerPhone: data.ownerPhone || data.phone,
      password: data.password,
    };
    return await apiClient.post("/labs", payload);
  },

  // Verify email OTP
  async verifyOtp({ email, otp }) {
    const res = await apiClient.post("/auth/verify-otp", { email, otp });
    if (res?.data?.accessToken) {
      setAuthToken(res.data.accessToken);
    }
    return res;
  },

  // Resend verification OTP
  async resendOtp(email) {
    return await apiClient.post("/auth/resend-otp", { email });
  },

  // Standard user / lab owner login
  async login({ email, password }) {
    const res = await apiClient.post("/auth/login", { email, password });
    if (res?.data?.accessToken) {
      setAuthToken(res.data.accessToken);
    }
    return res;
  },

  // Admin dedicated login
  async adminLogin({ username, password }) {
    const res = await apiClient.post("/admin/login", { username, password });
    if (res?.data?.accessToken) {
      setAuthToken(res.data.accessToken);
    }
    return res;
  },

  // Refresh access token via HttpOnly cookie
  async refreshToken() {
    const res = await apiClient.post("/auth/refresh", {});
    if (res?.data?.accessToken) {
      setAuthToken(res.data.accessToken);
    }
    return res;
  },

  // Retrieve current user profile
  async getMe() {
    return await apiClient.get("/auth/me");
  },

  // Logout session
  async logout() {
    try {
      await apiClient.post("/auth/logout", {});
    } finally {
      clearAuthToken();
    }
  },

  // Password management
  async forgotPassword(email) {
    return await apiClient.post("/auth/forgot-password", { email });
  },

  async resetPassword({ email, otp, newPassword }) {
    return await apiClient.post("/auth/reset-password", { email, otp, newPassword });
  },
};
