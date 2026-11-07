
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";

import { authService } from "../services/auth.service";
import { getAuthToken, clearAuthToken } from "../../../Core/http/interceptors";

const AuthContext = createContext(null);

let inFlightAuthPromise = null;

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Initialize and restore authentication session without redundant refresh loops
  const initAuth = useCallback(async () => {
    if (inFlightAuthPromise) {
      return inFlightAuthPromise;
    }

    inFlightAuthPromise = (async () => {
      try {
        setIsLoading(true);
        setError(null);

        const existingToken = getAuthToken();
        let meRes = null;

        // 1. If an access token exists, verify it with getMe() first
        if (existingToken) {
          try {
            meRes = await authService.getMe();
          } catch (_) {
            meRes = null;
          }
        }

        // 2. If token was missing or expired, attempt cookie refresh
        if (!meRes?.data?.user) {
          try {
            await authService.refreshToken();
            meRes = await authService.getMe();
          } catch (_) {
            meRes = null;
          }
        }

        const userData = meRes?.data?.user;
        const sessionData = meRes?.data?.session;

        if (userData) {
          setUser(userData);
          setSession(sessionData || null);
          return userData;
        } else {
          clearAuthToken();
          setUser(null);
          setSession(null);
          return null;
        }
      } catch (_) {
        clearAuthToken();
        setUser(null);
        setSession(null);
        return null;
      } finally {
        setIsLoading(false);
        inFlightAuthPromise = null;
      }
    })();

    return inFlightAuthPromise;
  }, []);

  useEffect(() => {
    initAuth();
  }, [initAuth]);

  // Standard Login (Lab owner / General user)
  const login = async (credentials) => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await authService.login(credentials);

      const userData = res?.data?.user;
      const sessionData = res?.data?.session;

      if (!userData) {
        throw new Error("Invalid login response");
      }

      setUser(userData);
      setSession(sessionData || null);

      return userData;

    } catch (err) {
      setError(err.message || "Login failed");
      throw err;

    } finally {
      setIsLoading(false);
    }
  };

  // Register General User
  const registerUser = async (data) => {
    setIsLoading(true);
    setError(null);

    try {
      return await authService.register(data);

    } catch (err) {
      setError(err.message);
      throw err;

    } finally {
      setIsLoading(false);
    }
  };

  // Register Diagnostic Laboratory
  const registerLab = async (data) => {
    setIsLoading(true);
    setError(null);

    try {
      return await authService.registerLab(data);

    } catch (err) {
      setError(err.message);
      throw err;

    } finally {
      setIsLoading(false);
    }
  };

  // Dedicated Admin Login
  const adminLogin = async (credentials) => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await authService.adminLogin(credentials);

      const userData = res?.data?.user;
      const sessionData = res?.data?.session;

      if (!userData) {
        throw new Error("Invalid admin login response");
      }

      setUser(userData);
      setSession(sessionData || null);

      return userData;

    } catch (err) {
      setError(err.message || "Admin login failed");
      throw err;

    } finally {
      setIsLoading(false);
    }
  };

  // Complete OTP Verification
  const verifyOtp = async (data) => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await authService.verifyOtp(data);

      const userData = res?.data?.user;
      const sessionData = res?.data?.session;

      if (!userData) {
        throw new Error("Invalid OTP verification response");
      }

      setUser(userData);
      setSession(sessionData || null);

      return userData;

    } catch (err) {
      setError(err.message || "OTP verification failed");
      throw err;

    } finally {
      setIsLoading(false);
    }
  };

  // Request Password Reset OTP
  const forgotPassword = async (email) => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await authService.forgotPassword(email);
      return res?.data || res;

    } catch (err) {
      setError(err.message);
      throw err;

    } finally {
      setIsLoading(false);
    }
  };

  // Reset Password
  const resetPassword = async ({ email, otp, newPassword }) => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await authService.resetPassword({
        email,
        otp,
        newPassword,
      });

      return res?.data || res;

    } catch (err) {
      setError(err.message);
      throw err;

    } finally {
      setIsLoading(false);
    }
  };

  // Logout
  const logout = async () => {
    setIsLoading(true);
    setError(null);

    try {
      await authService.logout();

    } catch (err) {
      console.error("LOGOUT ERROR:", err);

    } finally {
      setUser(null);
      setSession(null);
      setIsLoading(false);
    }
  };

  const value = {
    user,
    session,
    isLoading,
    error,

    isAuthenticated: Boolean(user),

    isLabOwner: user?.role === "lab",
    isAdmin: user?.role === "admin",
    isPatient: user?.role === "patient",

    login,
    registerUser,
    registerLab,
    adminLogin,
    verifyOtp,
    forgotPassword,
    resetPassword,
    logout,

    refreshUser: initAuth,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error(
      "useAuth must be used within an AuthProvider"
    );
  }

  return context;
}
