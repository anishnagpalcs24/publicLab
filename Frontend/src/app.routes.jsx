// ============================================================================
// PUBLICLAB — CENTRAL APPLICATION ROUTES
// Single source of truth for all User, Lab, and Admin routes
// ============================================================================
import React, { Suspense, lazy } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Loader from "./Shared/Component/Loader/Loader";
import { useAuth } from "./Features/Auth/state/auth.context";
import { useLab } from "./Features/Lab/state/lab.context";

// Layouts
import UserLayout from "./Features/User/Component/UserLayout";
import LabLayout from "./Features/Lab/Component/LabLayout";
import AdminLayout from "./Features/Admin/Component/AdminLayout";

// Public User Pages
const Home = lazy(() => import("./Features/User/Pages/Home/Home"));
const LabSearch = lazy(() => import("./Features/User/Pages/LabSearch/LabSearch"));
const LabDetails = lazy(() => import("./Features/User/Pages/LabDetails/LabDetails"));
const TestPackages = lazy(() => import("./Features/User/Pages/TestPackages/TestPackages"));
const Reports = lazy(() => import("./Features/User/Pages/Reports/Reports"));
const Callback = lazy(() => import("./Features/User/Pages/Callback/Callback"));
const NotFound = lazy(() => import("./Features/User/Pages/NotFound/NotFound"));

// Auth Pages
const LabLogin = lazy(() => import("./Features/Auth/Pages/LabLogin/LabLogin"));
const AdminLogin = lazy(() => import("./Features/Auth/Pages/AdminLogin/AdminLogin"));

// Lab Owner Portal Pages
const LabDashboard = lazy(() => import("./Features/Lab/Pages/Dashboard/Dashboard"));
const LabPatients = lazy(() => import("./Features/Lab/Pages/Patients/Patients"));
const LabOrders = lazy(() => import("./Features/Lab/Pages/Orders/Orders"));
const LabReports = lazy(() => import("./Features/Lab/Pages/Reports/Reports"));
const LabSubscription = lazy(() => import("./Features/Lab/Pages/Subscription/Subscription"));
const LabSettings = lazy(() => import("./Features/Lab/Pages/Settings/Settings"));

// Admin Portal Pages
const AdminDashboard = lazy(() => import("./Features/Admin/Pages/Dashboard/Dashboard"));
const AdminLabApprovals = lazy(() => import("./Features/Admin/Pages/LabApprovals/LabApprovals"));
const AdminLaboratories = lazy(() => import("./Features/Admin/Pages/Laboratories/Laboratories"));
const AdminUsers = lazy(() => import("./Features/Admin/Pages/Users/Users"));
const AdminSubscriptions = lazy(() => import("./Features/Admin/Pages/Subscriptions/Subscriptions"));

// ============================================================================
// Route Guard: Protected for Laboratory Staff & Owners
// ============================================================================
function LabProtectedRoute({ children }) {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <Loader fullscreen text="Verifying laboratory credentials..." />;
  }

  if (!isAuthenticated || (user?.role !== "lab" && user?.role !== "admin")) {
    return <Navigate to="/lab/login" replace />;
  }

  return children;
}

// ============================================================================
// Route Guard: Protected for Approved Laboratories
// ============================================================================
function ApprovedLabRoute({ children }) {
  const { labProfile, isLoading } = useLab();

  if (isLoading) {
    return <Loader fullscreen text="Verifying accreditation status..." />;
  }

  if (labProfile && labProfile.approval_status !== "approved") {
    return <Navigate to="/lab/dashboard" replace />;
  }

  return children;
}

// ============================================================================
// Route Guard: Protected for Platform Administrators
// ============================================================================
function AdminProtectedRoute({ children }) {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <Loader fullscreen text="Verifying administrative access..." />;
  }

  if (!isAuthenticated || user?.role !== "admin") {
    return <Navigate to="/admin/login" replace />;
  }

  return children;
}

// ============================================================================
// Main Application Routes Component
// ============================================================================
export default function AppRoutes() {
  return (
    <Suspense fallback={<Loader fullscreen text="Loading PublicLab..." />}>
      <Routes>
        {/* ================================================================== */}
        {/* PUBLIC USER PORTAL ROUTES                                         */}
        {/* ================================================================== */}
        <Route element={<UserLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/labs" element={<LabSearch />} />
          <Route path="/labs/:labId" element={<LabDetails />} />
          <Route path="/test-packages" element={<TestPackages />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/callback" element={<Callback />} />
        </Route>

        {/* ================================================================== */}
        {/* AUTHENTICATION GATEWAYS                                            */}
        {/* ================================================================== */}
        <Route path="/lab/login" element={<LabLogin />} />
        <Route path="/admin/login" element={<AdminLogin />} />

        {/* ================================================================== */}
        {/* LAB OWNER PORTAL ROUTES                                            */}
        {/* ================================================================== */}
        <Route
          path="/lab"
          element={
            <LabProtectedRoute>
              <LabLayout />
            </LabProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/lab/dashboard" replace />} />
          <Route path="dashboard" element={<LabDashboard />} />
          <Route path="patients" element={<ApprovedLabRoute><LabPatients /></ApprovedLabRoute>} />
          <Route path="orders" element={<ApprovedLabRoute><LabOrders /></ApprovedLabRoute>} />
          <Route path="reports" element={<ApprovedLabRoute><LabReports /></ApprovedLabRoute>} />
          <Route path="subscription" element={<ApprovedLabRoute><LabSubscription /></ApprovedLabRoute>} />
          <Route path="payments" element={<Navigate to="/lab/subscription" replace />} />
          <Route path="settings" element={<LabSettings />} />
        </Route>

        {/* ================================================================== */}
        {/* ADMIN PORTAL ROUTES                                                */}
        {/* ================================================================== */}
        <Route
          path="/admin"
          element={
            <AdminProtectedRoute>
              <AdminLayout />
            </AdminProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="dashboard" element={<AdminDashboard />} />
          <Route path="lab-approvals" element={<AdminLabApprovals />} />
          <Route path="laboratories" element={<AdminLaboratories />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="subscriptions" element={<AdminSubscriptions />} />
          <Route path="payments" element={<Navigate to="/admin/subscriptions" replace />} />
          <Route path="settings" element={<Navigate to="/admin/dashboard" replace />} />
        </Route>

        {/* ================================================================== */}
        {/* 404 NOT FOUND ROUTE                                                */}
        {/* ================================================================== */}
        <Route element={<UserLayout />}>
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
