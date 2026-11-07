// ============================================================================
// Core Axios Interceptors & Token Handling
// ============================================================================
import axios from "axios";
import { ENV } from "../config/env";

const TOKEN_STORAGE_KEY = "publiclab_token";

let inMemoryAccessToken = null;

try {
  inMemoryAccessToken = localStorage.getItem(TOKEN_STORAGE_KEY) || null;
} catch (_) {}

export const setAuthToken = (token) => {
  inMemoryAccessToken = token || null;
  try {
    if (token) {
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  } catch (_) {}
};

export const getAuthToken = () => {
  if (!inMemoryAccessToken) {
    try {
      inMemoryAccessToken = localStorage.getItem(TOKEN_STORAGE_KEY) || null;
    } catch (_) {}
  }
  return inMemoryAccessToken;
};

export const clearAuthToken = () => {
  inMemoryAccessToken = null;
  try {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch (_) {}
};

// Flag to prevent multiple refresh loops
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

/**
 * Request Interceptor: Injects Authorization Bearer token if present.
 */
export const requestInterceptor = (config) => {
  if (inMemoryAccessToken && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${inMemoryAccessToken}`;
  }
  return config;
};

export const requestErrorInterceptor = (error) => {
  return Promise.reject(error);
};

/**
 * Response Interceptor: Handles standard response unwrapping, 401 token refresh rotation.
 */
export const responseSuccessInterceptor = (response) => {
  return response.data;
};

export const createResponseErrorInterceptor = (clientInstance) => {
  return async (error) => {
    const originalRequest = error.config;

    // Normalize error message from backend AppError structure
    let serverMessage =
      error.response?.data?.message ||
      error.response?.data?.error;

    if (!serverMessage) {
      if (
        error.code === "ERR_NETWORK" ||
        error.message?.includes("Network Error") ||
        error.message?.includes("Failed to fetch")
      ) {
        serverMessage =
          "Cannot connect to the PublicLab API server (http://localhost:5000). Please check that PostgreSQL and the Backend server ('npm run dev' inside Backend folder) are running.";
      } else {
        serverMessage = error.message || "An unexpected error occurred";
      }
    }

    const normalizedError = new Error(serverMessage);
    normalizedError.status = error.response?.status;
    normalizedError.data = error.response?.data;
    normalizedError.original = error;

    // If 401 and not already retried and not the refresh or login request itself
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url?.includes("/auth/login") &&
      !originalRequest.url?.includes("/auth/refresh") &&
      !originalRequest.url?.includes("/admin/login")
    ) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return clientInstance(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Request token refresh via backend HttpOnly cookie
        const refreshResponse = await axios.post(
          `${ENV.API_BASE_URL}/auth/refresh`,
          {},
          { withCredentials: true }
        );

        const newAccessToken = refreshResponse.data?.data?.accessToken;
        if (newAccessToken) {
          setAuthToken(newAccessToken);
          processQueue(null, newAccessToken);
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
          return clientInstance(originalRequest);
        } else {
          throw new Error("No token returned on refresh");
        }
      } catch (refreshErr) {
        processQueue(refreshErr, null);
        clearAuthToken();
        return Promise.reject(normalizedError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(normalizedError);
  };
};
