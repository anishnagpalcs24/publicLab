import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { labOwnerService } from "../services/lab.service";
import { useAuth } from "../../Auth/state/auth.context";

const LabContext = createContext(null);

export function LabProvider({ children }) {
  const { user } = useAuth();
  const [labProfile, setLabProfile] = useState(null);
  const [dashboardData, setDashboardData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchLabData = useCallback(async () => {
    if (user && user.role !== "lab" && user.role !== "admin") return null;
    setIsLoading(true);
    setError(null);
    try {
      const [profileRes, dashRes] = await Promise.allSettled([
        labOwnerService.getMyLab(),
        labOwnerService.getDashboard(),
      ]);

      let profile = null;
      if (profileRes.status === "fulfilled") {
        profile = profileRes.value?.data || null;
        setLabProfile(profile);
      }
      if (dashRes.status === "fulfilled") {
        setDashboardData(dashRes.value?.data || null);
      }
      return profile;
    } catch (err) {
      setError(err.message || "Failed to load laboratory data");
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchLabData();
  }, [fetchLabData]);

  const value = {
    labProfile,
    dashboardData,
    isLoading,
    error,
    refreshLab: fetchLabData,
  };

  return <LabContext.Provider value={value}>{children}</LabContext.Provider>;
}

export function useLab() {
  const context = useContext(LabContext);
  if (!context) {
    throw new Error("useLab must be used within a LabProvider");
  }
  return context;
}
