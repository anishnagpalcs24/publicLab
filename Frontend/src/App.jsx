import React from "react";
import AppRoutes from "./app.routes";
import { ToastProvider } from "./Shared/Context/ToastContext";
import { AuthProvider } from "./Features/Auth/state/auth.context";
import { UserProvider } from "./Features/User/state/user.context";
import { LabProvider } from "./Features/Lab/state/lab.context";
import { AdminProvider } from "./Features/Admin/state/admin.context";

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <UserProvider>
          <LabProvider>
            <AdminProvider>
              <AppRoutes />
            </AdminProvider>
          </LabProvider>
        </UserProvider>
      </AuthProvider>
    </ToastProvider>
  );
}
