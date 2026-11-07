import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { AuthProvider, useAuth } from "../Features/Auth/state/auth.context";
import { setAuthToken, getAuthToken, clearAuthToken } from "../Core/http/interceptors";
import { authService } from "../Features/Auth/services/auth.service";

// Dummy consumer to observe auth state
function TestAuthConsumer() {
  const { user, isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <div data-testid="loading">Loading...</div>;
  if (!isAuthenticated) return <div data-testid="unauthenticated">Unauthenticated</div>;
  return (
    <div data-testid="authenticated">
      <span data-testid="email">{user?.email}</span>
      <span data-testid="role">{user?.role}</span>
    </div>
  );
}

describe("Auth Session Refresh & Persistence Suite", () => {
  beforeEach(() => {
    clearAuthToken();
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("persists access token in localStorage and restores it via getAuthToken", () => {
    expect(getAuthToken()).toBeNull();
    setAuthToken("test_access_token_123");
    expect(getAuthToken()).toBe("test_access_token_123");
    expect(localStorage.getItem("publiclab_token")).toBe("test_access_token_123");

    clearAuthToken();
    expect(getAuthToken()).toBeNull();
    expect(localStorage.getItem("publiclab_token")).toBeNull();
  });

  it("restores user session on page reload using stored access token without redundant refresh", async () => {
    setAuthToken("valid_token_xyz");

    // Mock getMe returning the authenticated lab owner
    vi.spyOn(authService, "getMe").mockResolvedValue({
      data: {
        user: {
          id: 101,
          email: "labowner@example.com",
          role: "lab",
          fullName: "Dr. Lab Owner",
        },
        session: { id: "session_abc" },
      },
    });

    const refreshSpy = vi.spyOn(authService, "refreshToken");

    render(
      <AuthProvider>
        <TestAuthConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("authenticated")).toBeInTheDocument();
    });

    expect(screen.getByTestId("email").textContent).toBe("labowner@example.com");
    expect(screen.getByTestId("role").textContent).toBe("lab");

    // Because token was valid, refreshToken was not unnecessarily called
    expect(refreshSpy).not.toHaveBeenCalled();
  });

  it("restores admin user session on page reload", async () => {
    setAuthToken("admin_token_456");

    vi.spyOn(authService, "getMe").mockResolvedValue({
      data: {
        user: {
          id: 1,
          email: "admin@publiclab.internal",
          role: "admin",
          fullName: "PublicLab Administrator",
        },
        session: { id: "session_admin_123" },
      },
    });

    render(
      <AuthProvider>
        <TestAuthConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("authenticated")).toBeInTheDocument();
    });

    expect(screen.getByTestId("email").textContent).toBe("admin@publiclab.internal");
    expect(screen.getByTestId("role").textContent).toBe("admin");
  });

  it("refreshes token via cookie if stored access token is expired, then restores user", async () => {
    setAuthToken("expired_token");

    // First getMe fails with 401
    const getMeSpy = vi.spyOn(authService, "getMe")
      .mockRejectedValueOnce(new Error("Token expired"))
      .mockResolvedValueOnce({
        data: {
          user: {
            id: 101,
            email: "labowner@example.com",
            role: "lab",
          },
        },
      });

    vi.spyOn(authService, "refreshToken").mockImplementation(async () => {
      setAuthToken("fresh_token_after_refresh");
      return { data: { accessToken: "fresh_token_after_refresh" } };
    });

    render(
      <AuthProvider>
        <TestAuthConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("authenticated")).toBeInTheDocument();
    });

    expect(screen.getByTestId("email").textContent).toBe("labowner@example.com");
    expect(getAuthToken()).toBe("fresh_token_after_refresh");
  });
});
