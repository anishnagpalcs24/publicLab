import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { BrowserRouter } from "react-router-dom";
import LabLogin from "../Features/Auth/Pages/LabLogin/LabLogin";
import { ToastProvider, useToast } from "../Shared/Context/ToastContext";
import { AuthProvider } from "../Features/Auth/state/auth.context";
import { authService } from "../Features/Auth/services/auth.service";

// Helper component to test useToast
function ToastTester() {
  const toast = useToast();
  return (
    <div>
      <button onClick={() => toast.success("Success message", "Success Title")}>
        Trigger Success
      </button>
      <button onClick={() => toast.error("Error message", "Error Title")}>
        Trigger Error
      </button>
    </div>
  );
}

describe("Auth & Toast Notification Suite", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("ToastProvider displays toast notifications when triggered", async () => {
    render(
      <ToastProvider>
        <ToastTester />
      </ToastProvider>
    );

    fireEvent.click(screen.getByText("Trigger Success"));
    expect(await screen.findByText("Success Title")).toBeInTheDocument();
    expect(screen.getByText("Success message")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Trigger Error"));
    expect(await screen.findByText("Error Title")).toBeInTheDocument();
    expect(screen.getByText("Error message")).toBeInTheDocument();
  });

  it("LabLogin displays 'Forgot Password?' link and enters forgot password flow", async () => {
    render(
      <BrowserRouter>
        <ToastProvider>
          <AuthProvider>
            <LabLogin />
          </AuthProvider>
        </ToastProvider>
      </BrowserRouter>
    );

    const forgotLink = screen.getByText(/Forgot Password\?/i);
    expect(forgotLink).toBeInTheDocument();

    // Click Forgot Password
    fireEvent.click(forgotLink);

    // Verify mode switched to Forgot Password
    expect(await screen.findByText("Reset Laboratory Password")).toBeInTheDocument();
    expect(screen.getByLabelText(/Registered Account Email/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Send Reset Code/i })).toBeInTheDocument();
  });

  it("Executes complete forgot-password and reset-password flow", async () => {
    const forgotSpy = vi.spyOn(authService, "forgotPassword").mockResolvedValueOnce({
      data: { message: "Reset code dispatched" },
    });
    const resetSpy = vi.spyOn(authService, "resetPassword").mockResolvedValueOnce({
      data: { message: "Password updated successfully" },
    });

    render(
      <BrowserRouter>
        <ToastProvider>
          <AuthProvider>
            <LabLogin />
          </AuthProvider>
        </ToastProvider>
      </BrowserRouter>
    );

    // Navigate to forgot password mode
    fireEvent.click(screen.getByText(/Forgot Password\?/i));

    const emailInput = screen.getByLabelText(/Registered Account Email/i);
    fireEvent.change(emailInput, { target: { value: "doctor@curielab.com" } });
    fireEvent.click(screen.getByRole("button", { name: /Send Reset Code/i }));

    await waitFor(() => {
      expect(forgotSpy).toHaveBeenCalledWith("doctor@curielab.com");
    });

    // Should transition to reset password mode
    expect(await screen.findByText("Create New Password")).toBeInTheDocument();

    const otpInput = screen.getByLabelText(/6-Digit Reset Code/i);
    const newPassInput = screen.getByLabelText(/^New Password/i);
    const confirmPassInput = screen.getByLabelText(/Confirm New Password/i);

    fireEvent.change(otpInput, { target: { value: "123456" } });
    fireEvent.change(newPassInput, { target: { value: "NewSecurePassword123!" } });
    fireEvent.change(confirmPassInput, { target: { value: "NewSecurePassword123!" } });

    fireEvent.click(screen.getByRole("button", { name: /Reset & Update Password/i }));

    await waitFor(() => {
      expect(resetSpy).toHaveBeenCalledWith({
        email: "doctor@curielab.com",
        otp: "123456",
        newPassword: "NewSecurePassword123!",
      });
    });

    // Should transition back to login mode
    expect(await screen.findByText("Laboratory Owner Sign In")).toBeInTheDocument();
  });

  it("Validates fields and shows error messages on invalid input", async () => {
    render(
      <BrowserRouter>
        <ToastProvider>
          <AuthProvider>
            <LabLogin />
          </AuthProvider>
        </ToastProvider>
      </BrowserRouter>
    );

    // Submit empty login form
    const submitBtn = screen.getByRole("button", { name: /Sign In to Lab Workspace/i });
    fireEvent.click(submitBtn);

    expect(await screen.findByText("Email address is required")).toBeInTheDocument();
    expect(screen.getByText("Password is required")).toBeInTheDocument();
  });
});
