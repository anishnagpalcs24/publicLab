import React from "react";
import { useNavigate } from "react-router-dom";
import {
  Building2,
  CheckSquare,
  Users,
  CreditCard,
  PhoneCall,
  Activity,
  ArrowRight,
} from "lucide-react";
import Button from "../../../../Shared/Component/Button/Button";
import Badge from "../../../../Shared/Component/Badge/Badge";
import Loader from "../../../../Shared/Component/Loader/Loader";
import { useAdmin } from "../../state/admin.context";

export default function Dashboard() {
  const { dashboardData, pendingApprovalsCount, isLoading } = useAdmin();
  const navigate = useNavigate();

  if (isLoading) {
    return <Loader text="Loading administrator metrics..." />;
  }

  const {
    totalLabs = 0,
    pendingLabs = pendingApprovalsCount,
    totalUsers = 0,
    totalOrders = 0,
  } = dashboardData || {};

  const metrics = [
    {
      label: "Pending Applications",
      value: pendingLabs,
      icon: CheckSquare,
      color: "#D97706",
      bg: "#FEF3C7",
      action: () => navigate("/admin/lab-approvals"),
    },
    {
      label: "Accredited Laboratories",
      value: totalLabs,
      icon: Building2,
      color: "#0F766E",
      bg: "#CCFBF1",
      action: () => navigate("/admin/laboratories"),
    },
    {
      label: "Platform Users",
      value: totalUsers,
      icon: Users,
      color: "#2563EB",
      bg: "#DBEAFE",
      action: () => navigate("/admin/users"),
    },
    {
      label: "Processed Test Orders",
      value: totalOrders,
      icon: Activity,
      color: "#16A34A",
      bg: "#DCFCE7",
      action: () => navigate("/admin/laboratories"),
    },
  ];

  return (
    <div style={{ maxWidth: "1200px" }}>
      {/* Header */}
      <div style={{ marginBottom: "2.5rem" }}>
        <h1 style={{ fontSize: "1.75rem", marginBottom: "0.25rem" }}>Administrator Oversight</h1>
        <p style={{ color: "#64748B", fontSize: "0.875rem" }}>
          Platform metrics, pending accreditation applications, and laboratory compliance.
        </p>
      </div>

      {/* Metrics Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "1.5rem",
          marginBottom: "2.5rem",
        }}
      >
        {metrics.map((m) => {
          const Icon = m.icon;
          return (
            <div
              key={m.label}
              onClick={m.action}
              style={{
                backgroundColor: "#FFFFFF",
                border: "1px solid #E2E8F0",
                borderRadius: "16px",
                padding: "1.5rem",
                display: "flex",
                flexDirection: "column",
                gap: "1rem",
                cursor: "pointer",
                boxShadow: "0 1px 3px rgba(15, 23, 42, 0.05)",
                transition: "all 0.15s ease",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "0.875rem", fontWeight: 500, color: "#64748B" }}>
                  {m.label}
                </span>
                <div
                  style={{
                    width: "40px",
                    height: "40px",
                    borderRadius: "10px",
                    backgroundColor: m.bg,
                    color: m.color,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Icon size={20} />
                </div>
              </div>

              <div style={{ fontSize: "2rem", fontWeight: 800, color: "#0F172A" }}>
                {m.value}
              </div>
            </div>
          );
        })}
      </div>

      {/* Action Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: "1.5rem",
        }}
      >
        <div
          style={{
            backgroundColor: "#FFFFFF",
            border: "1px solid #E2E8F0",
            borderRadius: "16px",
            padding: "1.5rem",
            display: "flex",
            flexDirection: "column",
            gap: "1rem",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ fontSize: "1.125rem", fontWeight: 600 }}>Lab Accreditation Review</h3>
            {pendingApprovalsCount > 0 && (
              <Badge variant="warning">{pendingApprovalsCount} Action Required</Badge>
            )}
          </div>
          <p style={{ fontSize: "0.875rem", color: "#64748B", lineHeight: 1.5 }}>
            Review pending clinical facility applications, verify registration certificates, and grant or reject platform access.
          </p>
          <Button
            variant="primary"
            size="sm"
            fullWidth
            icon={ArrowRight}
            iconPosition="right"
            onClick={() => navigate("/admin/lab-approvals")}
          >
            Go to Application Queue
          </Button>
        </div>

        <div
          style={{
            backgroundColor: "#FFFFFF",
            border: "1px solid #E2E8F0",
            borderRadius: "16px",
            padding: "1.5rem",
            display: "flex",
            flexDirection: "column",
            gap: "1rem",
          }}
        >
          <h3 style={{ fontSize: "1.125rem", fontWeight: 600 }}>Registered Laboratories</h3>
          <p style={{ fontSize: "0.875rem", color: "#64748B", lineHeight: 1.5 }}>
            Audit active pathology labs, inspect facility addresses, and manage temporary suspension where non-compliant.
          </p>
          <Button
            variant="outline"
            size="sm"
            fullWidth
            icon={ArrowRight}
            iconPosition="right"
            onClick={() => navigate("/admin/laboratories")}
          >
            View Registered Facilities
          </Button>
        </div>
      </div>
    </div>
  );
}
