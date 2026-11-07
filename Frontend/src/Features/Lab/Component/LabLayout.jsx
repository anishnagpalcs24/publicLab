import React, { useState } from "react";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  ClipboardList,
  FileText,
  CreditCard,
  Settings,
  LogOut,
  Activity,
  Menu,
  ShieldCheck,
  Clock,
  AlertCircle,
  AlertTriangle,
  Lock,
} from "lucide-react";
import Button from "../../../Shared/Component/Button/Button";
import Badge from "../../../Shared/Component/Badge/Badge";
import { useAuth } from "../../Auth/state/auth.context";
import { useLab } from "../state/lab.context";
import { useToast } from "../../../Shared/Context/ToastContext";
import "./LabLayout.scss";

export default function LabLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, logout } = useAuth();
  const { labProfile } = useLab();
  const navigate = useNavigate();
  const toast = useToast();

  const closeSidebar = () => setSidebarOpen(false);

  const approvalStatus = labProfile?.approval_status || "pending";
  const isApproved = approvalStatus === "approved";

  const links = [
    { to: "/lab/dashboard", icon: LayoutDashboard, label: "Dashboard", requiresApproval: false },
    { to: "/lab/patients", icon: Users, label: "Patients", requiresApproval: true },
    { to: "/lab/orders", icon: ClipboardList, label: "Test Orders", requiresApproval: true },
    { to: "/lab/reports", icon: FileText, label: "Medical Reports", requiresApproval: true },
    { to: "/lab/subscription", icon: CreditCard, label: "Subscriptions", requiresApproval: true },
    { to: "/lab/settings", icon: Settings, label: "Lab Profile", requiresApproval: false },
  ];

  const handleLockedNav = (e, item) => {
    if (!isApproved && item.requiresApproval) {
      e.preventDefault();
      closeSidebar();
      toast.warning(
        `"${item.label}" is locked while your application is under administrator review. Applications are reviewed within 24 hours.`,
        "Accreditation Required"
      );
      navigate("/lab/dashboard");
    } else {
      closeSidebar();
    }
  };

  return (
    <div className="pl-lab-layout">
      {/* Mobile Backdrop */}
      {sidebarOpen && <div className="pl-lab-layout__backdrop" onClick={closeSidebar} />}

      {/* Sidebar Navigation */}
      <aside
        className={`pl-lab-layout__sidebar ${
          sidebarOpen ? "pl-lab-layout__sidebar--open" : ""
        }`}
      >
        <div className="pl-lab-layout__sidebar-header">
          <div className="icon">
            <Activity size={20} />
          </div>
          <span>Lab Workspace</span>
        </div>

        <nav className="pl-lab-layout__sidebar-nav">
          {links.map((item) => {
            const Icon = item.icon;
            const isLocked = !isApproved && item.requiresApproval;

            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `pl-lab-layout__sidebar-link ${isActive ? "active" : ""} ${
                    isLocked ? "pl-lab-layout__sidebar-link--locked" : ""
                  }`
                }
                onClick={(e) => handleLockedNav(e, item)}
                end={item.to === "/lab/dashboard"}
              >
                <Icon size={18} />
                <span>{item.label}</span>
                {isLocked && (
                  <span className="lock-badge" title="Locked until admin approval">
                    <Lock size={11} /> Locked
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>

        <div className="pl-lab-layout__sidebar-footer">
          <Button
            variant="ghost"
            size="sm"
            fullWidth
            icon={LogOut}
            onClick={() => {
              logout();
              navigate("/lab/login");
            }}
          >
            Sign Out
          </Button>
        </div>
      </aside>

      {/* Main Container */}
      <div className="pl-lab-layout__main">
        {/* Topbar */}
        <header className="pl-lab-layout__topbar">
          <div className="pl-lab-layout__topbar-left">
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
            <div className="pl-lab-layout__topbar-lab-name">
              {labProfile?.name || "Diagnostic Laboratory"}
            </div>
          </div>

          <div className="pl-lab-layout__topbar-right">
            {isApproved ? (
              <Badge variant="success" icon={ShieldCheck}>
                Approved Facility
              </Badge>
            ) : approvalStatus === "rejected" ? (
              <Badge variant="danger" icon={AlertCircle}>
                Application Rejected
              </Badge>
            ) : approvalStatus === "unverified" ? (
              <Badge variant="warning" icon={AlertTriangle}>
                Unverified Email
              </Badge>
            ) : (
              <Badge variant="warning" icon={Clock}>
                Under 24h Review
              </Badge>
            )}
            <div style={{ fontSize: "0.75rem", color: "#64748B" }}>
              {user?.fullName || "Lab Manager"}
            </div>
          </div>
        </header>

        {/* Dynamic Portal Content */}
        <main className="pl-lab-layout__content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
