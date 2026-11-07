import React from "react";
import { useNavigate } from "react-router-dom";
import { Search, FileCheck } from "lucide-react";
import Button from "../../../../Shared/Component/Button/Button";
import "./CtaBanner.scss";

export default function CtaBanner() {
  const navigate = useNavigate();

  return (
    <section className="pl-cta-banner" aria-label="Call to Action">
      <div className="pl-cta-banner__container">
        <h2>Take Control of Your Healthcare Records.</h2>
        <p>
          Join thousands of patients and leading diagnostic centers relying on PublicLab's
          accredited, passwordless medical record infrastructure.
        </p>

        <div className="pl-cta-banner__actions">
          <Button
            variant="secondary"
            size="lg"
            icon={Search}
            onClick={() => navigate("/labs")}
          >
            Find a Laboratory
          </Button>
          <Button
            variant="outline"
            size="lg"
            icon={FileCheck}
            style={{ backgroundColor: "rgba(255, 255, 255, 0.15)", color: "#FFFFFF", borderColor: "rgba(255, 255, 255, 0.4)" }}
            onClick={() => navigate("/reports")}
          >
            Check Your Reports
          </Button>
        </div>
      </div>
    </section>
  );
}
