// ============================================================================
// Core Central Axios API Client
// ============================================================================
import axios from "axios";
import { ENV } from "../config/env";
import {
  requestInterceptor,
  requestErrorInterceptor,
  responseSuccessInterceptor,
  createResponseErrorInterceptor,
} from "./interceptors";

const apiClient = axios.create({
  baseURL: ENV.API_BASE_URL,
  withCredentials: true, // Required for HttpOnly refresh token cookie
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

apiClient.interceptors.request.use(requestInterceptor, requestErrorInterceptor);
apiClient.interceptors.response.use(
  responseSuccessInterceptor,
  createResponseErrorInterceptor(apiClient)
);

export default apiClient;
