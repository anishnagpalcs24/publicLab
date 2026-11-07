import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Users,
  ClipboardList,
  FileText,
  Clock,
  PlusCircle,
  ShieldCheck,
  RotateCcw,
  AlertCircle,
  Building2,
  MapPin,
  Phone,
  Mail,
  CheckCircle2,
  Lock,
  Hourglass,
  ShieldAlert,
} from "lucide-react";
import Button from "../../../../Shared/Component/Button/Button";
import Badge from "../../../../Shared/Component/Badge/Badge";
import Loader from "../../../../Shared/Component/Loader/Loader";
import { useLab } from "../../state/lab.context";
import { useToast } from "../../../../Shared/Context/ToastContext";

export default function Dashboard() {
  const { labProfile, dashboardData, isLoading, refreshLab } = useLab();
  const [isChecking, setIsChecking] = useState(false);
  const navigate = useNavigate();
  const toast = useToast();

  if (isLoading) {
    return <Loader text="Loading operational dashboard..." />;
  }

  const approvalStatus = labProfile?.approval_status || "pending";
  const isApproved = approvalStatus === "approved";

  // Check review status manually
  const handleCheckStatus = async () => {
    setIsChecking(true);
    try {
      const updated = await refreshLab();
      if (updated?.approval_status === "approved") {
        toast.success(
          "Congratulations! Your laboratory application has been approved by the administration.",
          "Facility Approved"
        );
      } else if (updated?.approval_status === "rejected") {
        toast.error(
          `Application not approved: ${updated?.rejection_reason || "Please review submitted credentials."}`,
          "Application Rejected"
        );
      } else {
        toast.info(
          "Your application is currently being verified by our compliance team. Review is typically completed within 24 hours.",
          "Review In Progress"
        );
      }
    } catch (_) {
      toast.error("Could not refresh status. Please check your internet connection.", "Network Error");
    } finally {
      setIsChecking(false);
    }
  };

  // =========================================================================
  // VIEW: APPLICATION PENDING / UNVERIFIED / REJECTED (LOCKED ACCESS)
  // =========================================================================
  if (!isApproved) {
    return (
      <div style={{ maxWidth: "1000px", margin: "0 auto", paddingBottom: "2rem" }}>
        {/* Main Status Header Card */}
        <div
          style={{
            backgroundColor: "#FFFFFF",
            border: "1px solid #E2E8F0",
            borderRadius: "20px",
            padding: "2.5rem 2rem",
            boxShadow: "0 10px 25px -5px rgba(15, 23, 42, 0.05)",
            marginBottom: "2rem",
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", gap: "1.25rem", flexWrap: "wrap" }}>
            <div
              style={{
                width: "56px",
                height: "56px",
                borderRadius: "16px",
                backgroundColor: approvalStatus === "rejected" ? "#FEE2E2" : "#FEF3C7",
                color: approvalStatus === "rejected" ? "#DC2626" : "#D97706",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              {approvalStatus === "rejected" ? <ShieldAlert size={30} /> : <Hourglass size={30} />}
            </div>

            <div style={{ flex: 1, minWidth: "280px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.5rem", flexWrap: "wrap" }}>
                {approvalStatus === "rejected" ? (
                  <Badge variant="danger" icon={AlertCircle}>Application Rejected</Badge>
                ) : (
                  <Badge variant="warning" icon={Clock}>Under 24-Hour Review</Badge>
                )}
                <span style={{ fontSize: "0.8125rem", color: "#64748B" }}>
                  Application ID: #{labProfile?.id || "N/A"}
                </span>
              </div>

              <h1 style={{ fontSize: "1.75rem", fontWeight: 700, color: "#0F172A", margin: "0 0 0.5rem" }}>
                {approvalStatus === "rejected"
                  ? "Laboratory Application Requires Attention"
                  : "Your Application Has Been Sent to Our Team"}
              </h1>

              <p style={{ fontSize: "1rem", color: "#475569", lineHeight: 1.6, margin: 0 }}>
                {approvalStatus === "rejected" ? (
                  <>
                    Your application for <strong>{labProfile?.name}</strong> was reviewed by our administrative team.
                    Reason: <em>"{labProfile?.rejection_reason || "Facility credentials need correction."}"</em>.
                    Please update your information or contact support.
                  </>
                ) : (
                  <>
                    Thank you for registering <strong>{labProfile?.name}</strong> with PublicLab.
                    Your facility credentials have been submitted to our administrative team and will be reviewed
                    and approved within <strong>24 hours</strong>.
                  </>
                )}
              </p>
            </div>
          </div>

          {/* Action Bar */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "1rem",
              marginTop: "1.75rem",
              paddingTop: "1.5rem",
              borderTop: "1px solid #F1F5F9",
              flexWrap: "wrap",
            }}
          >
            <Button
              variant="primary"
              size="md"
              icon={RotateCcw}
              isLoading={isChecking}
              onClick={handleCheckStatus}
            >
              Check Review Status
            </Button>

            <Button
              variant="outline"
              size="md"
              onClick={() => navigate("/lab/settings")}
            >
              View Submitted Profile
            </Button>

            <span style={{ fontSize: "0.8125rem", color: "#64748B", marginLeft: "auto" }}>
              Estimated review time: <strong>Within 24 hours</strong>
            </span>
          </div>
        </div>

        {/* 4-Step Verification Timeline */}
        <div
          style={{
            backgroundColor: "#FFFFFF",
            border: "1px solid #E2E8F0",
            borderRadius: "16px",
            padding: "2rem",
            marginBottom: "2rem",
          }}
        >
          <h3 style={{ fontSize: "1.125rem", fontWeight: 600, color: "#0F172A", marginBottom: "1.5rem" }}>
            Application & Accreditation Progress
          </h3>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "1.5rem",
              position: "relative",
            }}
          >
            {/* Step 1 */}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <div
                  style={{
                    width: "28px",
                    height: "28px",
                    borderRadius: "50%",
                    backgroundColor: "#DCFCE7",
                    color: "#16A34A",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <CheckCircle2 size={16} />
                </div>
                <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "#16A34A" }}>Step 1: Submitted</span>
              </div>
              <p style={{ fontSize: "0.8125rem", color: "#64748B", margin: 0 }}>
                Facility registration details and owner account received.
              </p>
            </div>

            {/* Step 2 */}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <div
                  style={{
                    width: "28px",
                    height: "28px",
                    borderRadius: "50%",
                    backgroundColor: "#DCFCE7",
                    color: "#16A34A",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <CheckCircle2 size={16} />
                </div>
                <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "#16A34A" }}>Step 2: Verified</span>
              </div>
              <p style={{ fontSize: "0.8125rem", color: "#64748B", margin: 0 }}>
                Owner email OTP successfully authenticated.
              </p>
            </div>

            {/* Step 3 */}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <div
                  style={{
                    width: "28px",
                    height: "28px",
                    borderRadius: "50%",
                    backgroundColor: "#FEF3C7",
                    color: "#D97706",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 700,
                    fontSize: "0.75rem",
                  }}
                >
                  3
                </div>
                <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "#D97706" }}>Step 3: In Review</span>
              </div>
              <p style={{ fontSize: "0.8125rem", color: "#475569", margin: 0, fontWeight: 500 }}>
                Administrator verification of legal registration & facility compliance.
              </p>
            </div>

            {/* Step 4 */}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <div
                  style={{
                    width: "28px",
                    height: "28px",
                    borderRadius: "50%",
                    backgroundColor: "#F1F5F9",
                    color: "#94A3B8",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Lock size={14} />
                </div>
                <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "#94A3B8" }}>Step 4: Activation</span>
              </div>
              <p style={{ fontSize: "0.8125rem", color: "#94A3B8", margin: 0 }}>
                Full access to patients, orders, and published report management.
              </p>
            </div>
          </div>
        </div>

        {/* Feature Lock Notice & Submitted Details Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "1.5rem" }}>
          {/* Why features are locked card */}
          <div
            style={{
              backgroundColor: "#F8FAFC",
              border: "1px solid #E2E8F0",
              borderRadius: "16px",
              padding: "1.5rem",
              display: "flex",
              flexDirection: "column",
              gap: "1rem",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "#0F766E" }}>
              <Lock size={18} />
              <h4 style={{ fontSize: "1rem", fontWeight: 600, margin: 0 }}>Why are workspace features locked?</h4>
            </div>

            <p style={{ fontSize: "0.875rem", color: "#475569", lineHeight: 1.6, margin: 0 }}>
              To maintain clinical accuracy and medical compliance on PublicLab, diagnostic features
              are reserved for accredited facilities:
            </p>

            <ul style={{ fontSize: "0.8125rem", color: "#64748B", lineHeight: 1.6, margin: 0, paddingLeft: "1.25rem" }}>
              <li><strong>Patient Management:</strong> Registering patient profiles and diagnostic histories</li>
              <li><strong>Diagnostic Orders:</strong> Booking test packages and processing walk-in orders</li>
              <li><strong>Medical Reports:</strong> Issuing signed digital PDF reports with OTP patient access</li>
              <li><strong>Public Discovery:</strong> Visibility on the PublicLab patient search portal</li>
            </ul>

            <div
              style={{
                marginTop: "auto",
                padding: "0.75rem 1rem",
                backgroundColor: "#F0FDF4",
                border: "1px solid #DCFCE7",
                borderRadius: "8px",
                fontSize: "0.8125rem",
                color: "#166534",
              }}
            >
              🎉 Once approved, all features will unlock automatically without requiring any extra setup.
            </div>
          </div>

          {/* Submitted Facility Details Summary */}
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
            <h4 style={{ fontSize: "1rem", fontWeight: 600, color: "#0F172A", margin: 0 }}>
              Submitted Facility Details
            </h4>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", fontSize: "0.875rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "#334155" }}>
                <Building2 size={16} color="#0F766E" />
                <span>Facility Name: <strong>{labProfile?.name || "N/A"}</strong></span>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "#334155" }}>
                <FileText size={16} color="#0F766E" />
                <span>Registration No: <strong>{labProfile?.registration_number || "Pending"}</strong></span>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "#334155" }}>
                <MapPin size={16} color="#0F766E" />
                <span>Location: {labProfile?.city || "Registered City"}, {labProfile?.address || "Registered Address"}</span>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "#334155" }}>
                <Phone size={16} color="#0F766E" />
                <span>Phone: {labProfile?.phone || "N/A"}</span>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "#334155" }}>
                <Mail size={16} color="#0F766E" />
                <span>Email: {labProfile?.email || "N/A"}</span>
              </div>
            </div>

            <div
              style={{
                marginTop: "auto",
                padding: "0.75rem",
                backgroundColor: "#F8FAFC",
                borderRadius: "8px",
                fontSize: "0.75rem",
                color: "#64748B",
              }}
            >
              Need priority accreditation or have questions? Contact PublicLab Support at{" "}
              <a href="mailto:support@publiclab.in" style={{ color: "#0F766E", fontWeight: 600 }}>
                support@publiclab.in
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // VIEW: APPROVED LABORATORY OPERATIONAL DASHBOARD
  // =========================================================================
  const {
    totalPatients = 0,
    totalOrders = 0,
    publishedReports = 0,
    draftReports = 0,
  } = dashboardData?.summary || dashboardData || {};

  const stats = [
    {
      label: "Registered Patients",
      value: totalPatients,
      icon: Users,
      color: "#0F766E",
      bg: "#CCFBF1",
    },
    {
      label: "Diagnostic Orders",
      value: totalOrders,
      icon: ClipboardList,
      color: "#2563EB",
      bg: "#DBEAFE",
    },
    {
      label: "Published Reports",
      value: publishedReports,
      icon: FileText,
      color: "#16A34A",
      bg: "#DCFCE7",
    },
    {
      label: "Draft Reports Pending",
      value: draftReports,
      icon: Clock,
      color: "#D97706",
      bg: "#FEF3C7",
    },
  ];

  return (
    <div style={{ maxWidth: "1200px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "2rem", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <h1 style={{ fontSize: "1.75rem", marginBottom: "0.25rem" }}>
            Welcome back, {labProfile?.name || "Laboratory Manager"}
          </h1>
          <p style={{ color: "#64748B", fontSize: "0.875rem" }}>
            Operational overview and laboratory performance metrics.
          </p>
        </div>

        <div style={{ display: "flex", gap: "0.75rem" }}>
          <Button
            variant="outline"
            size="sm"
            icon={PlusCircle}
            onClick={() => navigate("/lab/patients")}
          >
            Add Patient
          </Button>
          <Button
            variant="primary"
            size="sm"
            icon={ClipboardList}
            onClick={() => navigate("/lab/orders")}
          >
            New Test Order
          </Button>
        </div>
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
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <div
              key={s.label}
              style={{
                backgroundColor: "#FFFFFF",
                border: "1px solid #E2E8F0",
                borderRadius: "16px",
                padding: "1.5rem",
                display: "flex",
                flexDirection: "column",
                gap: "1rem",
                boxShadow: "0 1px 3px rgba(15, 23, 42, 0.05)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "0.875rem", fontWeight: 500, color: "#64748B" }}>
                  {s.label}
                </span>
                <div
                  style={{
                    width: "40px",
                    height: "40px",
                    borderRadius: "10px",
                    backgroundColor: s.bg,
                    color: s.color,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Icon size={20} />
                </div>
              </div>

              <div style={{ fontSize: "2rem", fontWeight: 800, color: "#0F172A" }}>
                {s.value}
              </div>
            </div>
          );
        })}
      </div>

      {/* Operational Highlights */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: "1.5rem",
        }}
      >
        {/* Lab Profile Status Card */}
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
            <h3 style={{ fontSize: "1.125rem", fontWeight: 600 }}>Accreditation & Profile</h3>
            <Badge variant="success" icon={ShieldCheck}>Active Facility</Badge>
          </div>
          <p style={{ fontSize: "0.875rem", color: "#64748B", lineHeight: 1.5 }}>
            Facility: <strong>{labProfile?.name}</strong>
            <br />
            Registration / License: {labProfile?.registration_number || "NABL Verified"}
            <br />
            Location: {labProfile?.city || "Registered"}
          </p>
          <Button
            variant="outline"
            size="sm"
            fullWidth
            onClick={() => navigate("/lab/settings")}
          >
            Manage Profile & Timings
          </Button>
        </div>

        {/* Quick Reports Card */}
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
          <h3 style={{ fontSize: "1.125rem", fontWeight: 600 }}>Medical Reports Processing</h3>
          <p style={{ fontSize: "0.875rem", color: "#64748B", lineHeight: 1.5 }}>
            Upload draft pathology reports, attach doctor signatures, and publish for instant patient OTP access.
          </p>
          <Button
            variant="primary"
            size="sm"
            fullWidth
            onClick={() => navigate("/lab/reports")}
          >
            Review & Publish Reports
          </Button>
        </div>
      </div>
    </div>
  );
}
