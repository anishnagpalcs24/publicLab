import React, { useState } from "react";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  CheckSquare,
  Building2,
  Users,
  CreditCard,
  PhoneCall,
  ShieldAlert,
  LogOut,
  Menu,
  ShieldCheck,
} from "lucide-react";
import Button from "../../../Shared/Component/Button/Button";
import Badge from "../../../Shared/Component/Badge/Badge";
import { useAuth } from "../../Auth/state/auth.context";
import { useAdmin } from "../state/admin.context";
import "./AdminLayout.scss";

export default function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, logout } = useAuth();
  const { pendingApprovalsCount } = useAdmin();
  const navigate = useNavigate();

  const closeSidebar = () => setSidebarOpen(false);

  const links = [
    { to: "/admin/dashboard", icon: LayoutDashboard, label: "Dashboard" },
    {
      to: "/admin/lab-approvals",
      icon: CheckSquare,
      label: "Lab Approvals",
      badge: pendingApprovalsCount > 0 ? pendingApprovalsCount : null,
    },
    { to: "/admin/laboratories", icon: Building2, label: "Registered Labs" },
    { to: "/admin/users", icon: Users, label: "Platform Users" },
    { to: "/admin/subscriptions", icon: CreditCard, label: "Subscriptions" },
  ];

  return (
    <div className="pl-admin-layout">
      {sidebarOpen && <div className="pl-admin-layout__backdrop" onClick={closeSidebar} />}

      <aside
        className={`pl-admin-layout__sidebar ${
          sidebarOpen ? "pl-admin-layout__sidebar--open" : ""
        }`}
      >
        <div className="pl-admin-layout__sidebar-header">
          <div className="icon">
            <ShieldAlert size={20} />
          </div>
          <span>Admin Console</span>
        </div>

        <nav className="pl-admin-layout__sidebar-nav">
          {links.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `pl-admin-layout__sidebar-link ${isActive ? "active" : ""}`
                }
                onClick={closeSidebar}
                end={item.to === "/admin/dashboard"}
              >
                <Icon size={18} />
                <span style={{ flex: 1 }}>{item.label}</span>
                {item.badge && (
                  <span
                    style={{
                      backgroundColor: "#DC2626",
                      color: "#FFFFFF",
                      borderRadius: "9999px",
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      padding: "2px 8px",
                    }}
                  >
                    {item.badge}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>

        <div className="pl-admin-layout__sidebar-footer">
          <Button
            variant="ghost"
            size="sm"
            fullWidth
            icon={LogOut}
            style={{ color: "#94A3B8" }}
            onClick={() => {
              logout();
              navigate("/admin/login");
            }}
          >
            Sign Out
          </Button>
        </div>
      </aside>

      <div className="pl-admin-layout__main">
        <header className="pl-admin-layout__topbar">
          <div className="pl-admin-layout__topbar-left">
            <button
              type="button"
              style={{
                display: "flex",
                alignItems: "center",
                padding: "8px",
                border: "none",
                background: "none",
                cursor: "pointer",
              }}
              onClick={() => setSidebarOpen((prev) => !prev)}
              aria-label="Toggle navigation menu"
            >
              <Menu size={20} />
            </button>
            <span style={{ fontWeight: 600, fontSize: "0.875rem", color: "#0F172A" }}>
              PublicLab National Network Governance
            </span>
          </div>

          <div className="pl-admin-layout__topbar-right">
            <Badge variant="primary" icon={ShieldCheck}>
              Super Admin
            </Badge>
            <span style={{ fontSize: "0.75rem", color: "#64748B" }}>
              {user?.fullName || "Administrator"}
            </span>
          </div>
        </header>

        <main className="pl-admin-layout__content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
