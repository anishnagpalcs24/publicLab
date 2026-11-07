import React, { createContext, useContext, useState } from "react";

const UserContext = createContext(null);

export function UserProvider({ children }) {
  const [selectedCity, setSelectedCity] = useState("");
  // Verified patient session holding report access without requiring password login
  const [verifiedPatientSession, setVerifiedPatientSession] = useState(null);
  const [activeReports, setActiveReports] = useState([]);

  const setPatientReportsAccess = ({ email, patient, reports }) => {
    setVerifiedPatientSession({ email, patient });
    setActiveReports(reports || []);
  };

  const clearPatientReportsAccess = () => {
    setVerifiedPatientSession(null);
    setActiveReports([]);
  };

  const value = {
    selectedCity,
    setSelectedCity,
    verifiedPatientSession,
    activeReports,
    setPatientReportsAccess,
    clearPatientReportsAccess,
  };

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser() {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error("useUser must be used within a UserProvider");
  }
  return context;
}
