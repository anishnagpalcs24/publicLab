import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { adminService } from "../services/admin.service";
import { useAuth } from "../../Auth/state/auth.context";

const AdminContext = createContext(null);

export function AdminProvider({ children }) {
  const { isAdmin, isAuthenticated } = useAuth();
  const [dashboardData, setDashboardData] = useState(null);
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchAdminData = useCallback(async () => {
    if (!isAuthenticated || !isAdmin) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await adminService.getDashboard();
      setDashboardData(res?.data || null);

      // Fetch pending count
      const appsRes = await adminService.getLabApplications({ status: "pending", limit: 1 });
      setPendingApprovalsCount(appsRes?.pagination?.total || 0);
    } catch (err) {
      setError(err.message || "Failed to load administrator data");
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, isAdmin]);

  useEffect(() => {
    fetchAdminData();
  }, [fetchAdminData]);

  const value = {
    dashboardData,
    pendingApprovalsCount,
    isLoading,
    error,
    refreshAdmin: fetchAdminData,
  };

  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>;
}

export function useAdmin() {
  const context = useContext(AdminContext);
  if (!context) {
    throw new Error("useAdmin must be used within an AdminProvider");
  }
  return context;
}
