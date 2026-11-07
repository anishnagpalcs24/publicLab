import React from "react";
import { useNavigate } from "react-router-dom";
import { Building2, MapPin, Phone, Mail, Clock, ShieldCheck, ArrowRight } from "lucide-react";
import Button from "../../../../Shared/Component/Button/Button";
import Badge from "../../../../Shared/Component/Badge/Badge";
import "./LabCard.scss";

export default function LabCard({ lab }) {
  const navigate = useNavigate();

  const {
    id,
    name = "Accredited Diagnostic Laboratory",
    city = "Location not listed",
    address = "",
    phone = "Contact on request",
    email = "",
    approval_status = "approved",
    description = "Quality testing pathology and diagnostic collection services.",
  } = lab || {};

  return (
    <div className="pl-lab-card">
      <div className="pl-lab__header">
        <div className="pl-lab-card__icon-title">
          <div className="pl-lab-card__icon-title-icon">
            <Building2 size={22} />
          </div>
          <div>
            <h3>{name}</h3>
            <span style={{ fontSize: "0.75rem", color: "#64748B" }}>
              {city}
            </span>
          </div>
        </div>

        <Badge variant={approval_status === "approved" ? "success" : "warning"} icon={ShieldCheck}>
          {approval_status === "approved" ? "Verified" : approval_status}
        </Badge>
      </div>

      <p className="pl-lab-card__desc">{description}</p>

      <div className="pl-lab-card__details">
        {address && (
          <div className="pl-lab-card__detail-row">
            <MapPin size={14} />
            <span>{address}</span>
          </div>
        )}
        <div className="pl-lab-card__detail-row">
          <Phone size={14} />
          <span>{phone}</span>
        </div>
        {email && (
          <div className="pl-lab-card__detail-row">
            <Mail size={14} />
            <span>{email}</span>
          </div>
        )}
      </div>

      <div className="pl-lab-card__actions">
        <Button
          variant="outline"
          size="sm"
          fullWidth
          onClick={() => navigate(`/labs/${id}`)}
        >
          View Details
        </Button>
        <Button
          variant="primary"
          size="sm"
          fullWidth
          onClick={() => navigate(`/callback?labId=${id}&labName=${encodeURIComponent(name)}`)}
        >
          Request Callback
        </Button>
      </div>
    </div>
  );
}
