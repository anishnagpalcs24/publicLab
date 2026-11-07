import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import Dashboard from "../Features/Lab/Pages/Dashboard/Dashboard";
import LabLayout from "../Features/Lab/Component/LabLayout";
import { ToastProvider } from "../Shared/Context/ToastContext";
import { AuthProvider } from "../Features/Auth/state/auth.context";
import { LabProvider } from "../Features/Lab/state/lab.context";
import { labOwnerService } from "../Features/Lab/services/lab.service";

describe("Lab Approval Status & Feature Locking Suite", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("Pending lab displays 24-hour review screen and locks features", async () => {
    vi.spyOn(labOwnerService, "getMyLab").mockResolvedValue({
      data: {
        id: 99,
        name: "Sunrise Diagnostics",
        registration_number: "NABL-9999",
        city: "Chandigarh",
        address: "Sector 17, Main Market",
        phone: "+91-9876543210",
        email: "sunrise@test.com",
        approval_status: "pending",
      },
    });

    vi.spyOn(labOwnerService, "getDashboard").mockResolvedValue({
      data: { summary: { totalPatients: 0, totalOrders: 0, publishedReports: 0, draftReports: 0 } },
    });

    render(
      <MemoryRouter initialEntries={["/lab/dashboard"]}>
        <ToastProvider>
          <AuthProvider>
            <LabProvider>
              <Dashboard />
            </LabProvider>
          </AuthProvider>
        </ToastProvider>
      </MemoryRouter>
    );

    // Verify 24-hour review banner and heading
    expect(await screen.findByText(/Your Application Has Been Sent to Our Team/i)).toBeInTheDocument();
    expect(screen.getByText(/Under 24-Hour Review/i)).toBeInTheDocument();
    expect(screen.getByText(/Within 24 hours/i)).toBeInTheDocument();

    // Verify submitted details are visible
    expect(screen.getAllByText("Sunrise Diagnostics").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("NABL-9999")).toBeInTheDocument();

    // Verify locked notice is displayed
    expect(screen.getByText(/Why are workspace features locked\?/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Check Review Status/i })).toBeInTheDocument();
  });

  it("Approved lab displays full operational metrics and action buttons", async () => {
    vi.spyOn(labOwnerService, "getMyLab").mockResolvedValue({
      data: {
        id: 100,
        name: "Apex Pathology",
        registration_number: "NABL-1000",
        city: "Mumbai",
        approval_status: "approved",
      },
    });

    vi.spyOn(labOwnerService, "getDashboard").mockResolvedValue({
      data: { summary: { totalPatients: 42, totalOrders: 15, publishedReports: 12, draftReports: 3 } },
    });

    render(
      <MemoryRouter initialEntries={["/lab/dashboard"]}>
        <ToastProvider>
          <AuthProvider>
            <LabProvider>
              <Dashboard />
            </LabProvider>
          </AuthProvider>
        </ToastProvider>
      </MemoryRouter>
    );

    // Verify full operational dashboard unlocks
    expect(await screen.findByText(/Welcome back, Apex Pathology/i)).toBeInTheDocument();
    expect(screen.getByText("Registered Patients")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText("Diagnostic Orders")).toBeInTheDocument();
    expect(screen.getByText("15")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /New Test Order/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Add Patient/i })).toBeInTheDocument();
  });

  it("LabLayout displays 'Under 24h Review' and 'Locked' badges for pending lab", async () => {
    vi.spyOn(labOwnerService, "getMyLab").mockResolvedValue({
      data: {
        id: 101,
        name: "Pending Metro Lab",
        approval_status: "pending",
      },
    });

    render(
      <MemoryRouter initialEntries={["/lab/dashboard"]}>
        <ToastProvider>
          <AuthProvider>
            <LabProvider>
              <LabLayout />
            </LabProvider>
          </AuthProvider>
        </ToastProvider>
      </MemoryRouter>
    );

    expect(await screen.findByText("Under 24h Review")).toBeInTheDocument();
    const lockedBadges = await screen.findAllByText("Locked");
    expect(lockedBadges.length).toBeGreaterThanOrEqual(4); // Patients, Orders, Reports, Subscriptions
  });
});
