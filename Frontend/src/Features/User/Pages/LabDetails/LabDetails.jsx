import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Building2,
  MapPin,
  Phone,
  Mail,
  Clock,
  ShieldCheck,
  PhoneCall,
  ArrowLeft,
  Calendar,
  AlertCircle,
} from "lucide-react";
import Button from "../../../../Shared/Component/Button/Button";
import Badge from "../../../../Shared/Component/Badge/Badge";
import Loader from "../../../../Shared/Component/Loader/Loader";
import CallbackForm from "../../Component/CallbackForm/CallbackForm";
import { labService } from "../../services/lab.service";

export default function LabDetails() {
  const { labId } = useParams();
  const navigate = useNavigate();

  const [lab, setLab] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCallbackModal, setShowCallbackModal] = useState(false);

  useEffect(() => {
    async function loadLab() {
      setIsLoading(true);
      setError(null);
      try {
        const res = await labService.getLabById(labId);
        setLab(res?.data || null);
      } catch (err) {
        setError(err.message || "Failed to load laboratory details");
      } finally {
        setIsLoading(false);
      }
    }
    if (labId) loadLab();
  }, [labId]);

  if (isLoading) {
    return (
      <div className="section">
        <Loader text="Loading clinical laboratory profile..." />
      </div>
    );
  }

  if (error || !lab) {
    return (
      <div className="section">
        <div className="container" style={{ maxWidth: "600px", textAlign: "center" }}>
          <AlertCircle size={48} color="#DC2626" style={{ margin: "0 auto 1rem" }} />
          <h2>Laboratory Not Found</h2>
          <p style={{ margin: "1rem 0 2rem" }}>
            The requested diagnostic laboratory could not be loaded or is not currently active on PublicLab.
          </p>
          <Button variant="primary" icon={ArrowLeft} onClick={() => navigate("/labs")}>
            Back to Laboratory Search
          </Button>
        </div>
      </div>
    );
  }

  const {
    id,
    name,
    city,
    address,
    phone,
    email,
    approval_status,
    description,
    operating_hours,
  } = lab;

  return (
    <div className="section" style={{ minHeight: "80vh" }}>
      <div className="container" style={{ maxWidth: "1024px" }}>
        {/* Back Link */}
        <button
          type="button"
          onClick={() => navigate("/labs")}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.5rem",
            color: "#64748B",
            fontSize: "0.875rem",
            marginBottom: "1.5rem",
            cursor: "pointer",
          }}
        >
          <ArrowLeft size={16} />
          <span>Back to All Laboratories</span>
        </button>

        {/* Profile Header Card */}
        <div
          style={{
            backgroundColor: "#FFFFFF",
            border: "1px solid #E2E8F0",
            borderRadius: "24px",
            padding: "2.5rem",
            boxShadow: "0 4px 6px -1px rgba(15, 23, 42, 0.05)",
            marginBottom: "2rem",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              flexWrap: "wrap",
              gap: "1.5rem",
              marginBottom: "1.5rem",
            }}
          >
            <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
              <div
                style={{
                  width: "64px",
                  height: "64px",
                  borderRadius: "16px",
                  backgroundColor: "#CCFBF1",
                  color: "#0F766E",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Building2 size={32} />
              </div>
              <div>
                <h1 style={{ fontSize: "1.75rem", marginBottom: "0.25rem" }}>{name}</h1>
                <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                  <MapPin size={16} color="#64748B" />
                  <span style={{ color: "#64748B", fontSize: "0.875rem" }}>{city || "Verified Facility"}</span>
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
              <Badge variant={approval_status === "approved" ? "success" : "warning"} icon={ShieldCheck}>
                {approval_status === "approved" ? "NABL Accredited" : approval_status}
              </Badge>

              <Button
                variant="primary"
                size="md"
                icon={PhoneCall}
                onClick={() => navigate(`/callback?labId=${id}&labName=${encodeURIComponent(name)}`)}
              >
                Request Callback
              </Button>
            </div>
          </div>

          <p style={{ color: "#475569", lineHeight: 1.6, fontSize: "1rem", marginBottom: "2rem" }}>
            {description || "Quality diagnostic pathology, biochemistry testing, and patient specimen collection."}
          </p>

          {/* Details Grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: "1.5rem",
              paddingTop: "1.5rem",
              borderTop: "1px solid #F1F5F9",
            }}
          >
            <div>
              <h4 style={{ fontSize: "0.75rem", textTransform: "uppercase", color: "#94A3B8", marginBottom: "0.5rem" }}>
                Physical Location
              </h4>
              <p style={{ color: "#0F172A", fontSize: "0.875rem", fontWeight: 500 }}>
                {address || "Facility address available upon appointment booking"}
              </p>
            </div>

            <div>
              <h4 style={{ fontSize: "0.75rem", textTransform: "uppercase", color: "#94A3B8", marginBottom: "0.5rem" }}>
                Phone Helpline
              </h4>
              <p style={{ color: "#0F172A", fontSize: "0.875rem", fontWeight: 500 }}>
                {phone || "Direct helpline dispatched on callback"}
              </p>
            </div>

            <div>
              <h4 style={{ fontSize: "0.75rem", textTransform: "uppercase", color: "#94A3B8", marginBottom: "0.5rem" }}>
                Electronic Contact
              </h4>
              <p style={{ color: "#0F172A", fontSize: "0.875rem", fontWeight: 500 }}>
                {email || "support@publiclab.internal"}
              </p>
            </div>
          </div>
        </div>

        {/* Inline Callback Card */}
        <div style={{ marginTop: "3rem" }}>
          <CallbackForm initialLabId={id} initialLabName={name} />
        </div>
      </div>
    </div>
  );
}
