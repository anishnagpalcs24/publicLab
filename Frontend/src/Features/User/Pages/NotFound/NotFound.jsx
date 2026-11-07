import React from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, Home, ArrowLeft } from "lucide-react";
import Button from "../../../../Shared/Component/Button/Button";

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div
      style={{
        minHeight: "75vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem",
        textAlign: "center",
      }}
    >
      <div style={{ maxWidth: "480px" }}>
        <div
          style={{
            width: "64px",
            height: "64px",
            borderRadius: "50%",
            backgroundColor: "#FEF3C7",
            color: "#D97706",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 1.5rem",
          }}
        >
          <AlertTriangle size={32} />
        </div>
        <h1 style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>Page Not Found</h1>
        <p style={{ color: "#64748B", marginBottom: "2rem" }}>
          The page you are looking for does not exist or may have been relocated.
        </p>
        <div style={{ display: "flex", gap: "1rem", justifyContent: "center" }}>
          <Button variant="outline" size="md" icon={ArrowLeft} onClick={() => navigate(-1)}>
            Go Back
          </Button>
          <Button variant="primary" size="md" icon={Home} onClick={() => navigate("/")}>
            PublicLab Home
          </Button>
        </div>
      </div>
    </div>
  );
}
