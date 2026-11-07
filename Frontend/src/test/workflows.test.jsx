import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { BrowserRouter, MemoryRouter } from "react-router-dom";
import QuickActions from "../Features/User/Component/QuickActions/QuickActions";
import CallbackForm from "../Features/User/Component/CallbackForm/CallbackForm";
import ReportSection from "../Features/User/Component/ReportSection/ReportSection";
import { UserProvider } from "../Features/User/state/user.context";
import { AuthProvider } from "../Features/Auth/state/auth.context";
import { callbackService } from "../Features/User/services/callback.service";
import { patientReportService } from "../Features/User/services/report.service";

describe("Frontend Workflow Tests Suite", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // Workflow 1: User Quick Actions render and navigate
  it("renders quick action cards properly", () => {
    render(
      <BrowserRouter>
        <QuickActions />
      </BrowserRouter>
    );

    expect(screen.getByText("Find Diagnostic Labs")).toBeInTheDocument();
    expect(screen.getByText("Check Medical Reports")).toBeInTheDocument();
    expect(screen.getByText("Explore Test Packages")).toBeInTheDocument();
    expect(screen.getByText("Request a Lab Callback")).toBeInTheDocument();
  });

  // Workflow 2: Callback form validation and submission
  it("validates callback form and calls callbackService.requestCallback", async () => {
    const callbackSpy = vi.spyOn(callbackService, "requestCallback").mockResolvedValueOnce({
      success: true,
      message: "Callback created",
    });

    render(
      <BrowserRouter>
        <CallbackForm />
      </BrowserRouter>
    );

    const nameInput = screen.getByLabelText(/Your Full Name/i);
    const phoneInput = screen.getByLabelText(/Mobile Phone Number/i);
    const submitBtn = screen.getByRole("button", { name: /Submit Callback Request/i });

    fireEvent.change(nameInput, { target: { value: "Rajesh Kumar" } });
    fireEvent.change(phoneInput, { target: { value: "9876543210" } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(callbackSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Rajesh Kumar",
          phone: "9876543210",
        })
      );
    });
  });

  // Workflow 3: Reports are NEVER exposed before OTP verification
  it("keeps reports hidden before OTP verification is complete", () => {
    render(
      <BrowserRouter>
        <UserProvider>
          <ReportSection />
        </UserProvider>
      </BrowserRouter>
    );

    // Initial state: Step 1 (Enter registered email)
    expect(screen.getByLabelText(/Registered Patient Email Address/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Send Verification OTP/i })).toBeInTheDocument();

    // Verify reports list is NOT displayed anywhere
    expect(screen.queryByText(/Verified Medical Records/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Download PDF/i)).not.toBeInTheDocument();
  });

  // Workflow 4: Email OTP request workflow transitions to Step 2
  it("advances from email input to OTP verification step on successful request", async () => {
    vi.spyOn(patientReportService, "requestReportOtp").mockResolvedValueOnce({
      success: true,
      message: "OTP sent to email",
    });

    render(
      <BrowserRouter>
        <UserProvider>
          <ReportSection />
        </UserProvider>
      </BrowserRouter>
    );

    const emailInput = screen.getByLabelText(/Registered Patient Email Address/i);
    const submitBtn = screen.getByRole("button", { name: /Send Verification OTP/i });

    fireEvent.change(emailInput, { target: { value: "patient@example.com" } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByLabelText(/6-Digit Verification Code/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Verify & View My Reports/i })).toBeInTheDocument();
    });
  });

  // Workflow 5: Reports display after successful OTP verification
  it("displays verified reports upon valid 6-digit OTP verification", async () => {
    vi.spyOn(patientReportService, "requestReportOtp").mockResolvedValueOnce({
      success: true,
      message: "OTP sent",
    });

    vi.spyOn(patientReportService, "verifyReportOtp").mockResolvedValueOnce({
      user: { id: "10", email: "patient@example.com", fullName: "Amit Patel" },
      reports: [
        {
          id: 101,
          original_filename: "lipid_panel_oct2026.pdf",
          created_at: new Date().toISOString(),
          status: "published",
        },
      ],
    });

    render(
      <BrowserRouter>
        <UserProvider>
          <ReportSection />
        </UserProvider>
      </BrowserRouter>
    );

    // Step 1: Send OTP
    const emailInput = screen.getByLabelText(/Registered Patient Email Address/i);
    fireEvent.change(emailInput, { target: { value: "patient@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: /Send Verification OTP/i }));

    // Step 2: Verify OTP
    await waitFor(() => {
      expect(screen.getByLabelText(/6-Digit Verification Code/i)).toBeInTheDocument();
    });

    const otpInput = screen.getByLabelText(/6-Digit Verification Code/i);
    fireEvent.change(otpInput, { target: { value: "654321" } });
    fireEvent.click(screen.getByRole("button", { name: /Verify & View My Reports/i }));

    // Step 3: View Reports
    await waitFor(() => {
      expect(screen.getByText("Verified Medical Records")).toBeInTheDocument();
      expect(screen.getByText("lipid_panel_oct2026.pdf")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Download PDF/i })).toBeInTheDocument();
    });
  });
});
