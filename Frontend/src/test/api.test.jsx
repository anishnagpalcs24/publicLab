import { describe, it, expect, vi } from "vitest";
import apiClient from "../Core/http/api.client";
import { authService } from "../Features/Auth/services/auth.service";

describe("PublicLab API Client & Services Suite", () => {
  it("apiClient has baseURL and credentials configured", () => {
    expect(apiClient.defaults.withCredentials).toBe(true);
    expect(apiClient.defaults.headers["Content-Type"]).toBe("application/json");
  });

  it("authService calls login endpoint with proper payload", async () => {
    const postSpy = vi.spyOn(apiClient, "post").mockResolvedValueOnce({
      success: true,
      data: {
        user: { id: "1", fullName: "Dr. Tester", role: "lab" },
        accessToken: "mock-token",
      },
    });

    const result = await authService.login({
      email: "test@lab.com",
      password: "password123",
    });

    expect(postSpy).toHaveBeenCalledWith("/auth/login", {
      email: "test@lab.com",
      password: "password123",
    });
    expect(result.data.user.role).toBe("lab");
  });

  it("authService maps unified lab registration payload correctly", async () => {
    const postSpy = vi.spyOn(apiClient, "post").mockResolvedValueOnce({
      success: true,
      message: "Application submitted",
    });

    await authService.registerLab({
      labName: "Apex Pathology",
      licenseNumber: "NABL-999",
      email: "contact@apex.com",
      phone: "9876543210",
      city: "Mumbai",
      ownerFullName: "Dr. Sarah",
      password: "Password123!",
    });

    expect(postSpy).toHaveBeenCalledWith(
      "/labs",
      expect.objectContaining({
        name: "Apex Pathology",
        registrationNumber: "NABL-999",
        city: "Mumbai",
        ownerFullName: "Dr. Sarah",
      })
    );
  });
});
