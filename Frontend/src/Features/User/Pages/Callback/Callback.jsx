import React from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import CallbackForm from "../../Component/CallbackForm/CallbackForm";
import { PhoneCall, ArrowLeft, ShieldCheck, Clock, MapPin } from "lucide-react";
import Badge from "../../../../Shared/Component/Badge/Badge";

export default function Callback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const labId = searchParams.get("labId");
  const labName = searchParams.get("labName");
  const packageName = searchParams.get("package");

  return (
    <div className="section" style={{ minHeight: "80vh" }}>
      <div className="container" style={{ maxWidth: "800px" }}>
        {/* Back Link */}
        <button
          type="button"
          onClick={() => navigate(-1)}
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
          <span>Go Back</span>
        </button>

        <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
          <div style={{ display: "inline-flex", marginBottom: "0.5rem" }}>
            <Badge variant="primary" icon={PhoneCall}>
              Direct Clinical Coordination
            </Badge>
          </div>
          <h1>Request a Laboratory Callback</h1>
          <p style={{ marginTop: "0.5rem", color: "#64748B" }}>
            Submit your contact details and test requirements. An accredited laboratory coordinator
            will get in touch to assist with test preparation and appointment scheduling.
          </p>
        </div>

        {/* Callback Form Card */}
        <CallbackForm
          initialLabId={labId}
          initialLabName={labName}
          initialPackageName={packageName}
        />

        {/* Support Highlights */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: "2rem",
            flexWrap: "wrap",
            marginTop: "3rem",
            fontSize: "0.875rem",
            color: "#64748B",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Clock size={16} color="#0F766E" />
            <span>Response within 30 minutes</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <ShieldCheck size={16} color="#0F766E" />
            <span>No Obligation Consultation</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <MapPin size={16} color="#0F766E" />
            <span>Home Sample Collection Available</span>
          </div>
        </div>
      </div>
    </div>
  );
}
