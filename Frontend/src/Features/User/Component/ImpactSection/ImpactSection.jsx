import React from "react";
import { Network, Microscope, ShieldCheck, HeartPulse, Laptop2 } from "lucide-react";
import Badge from "../../../../Shared/Component/Badge/Badge";
import "./ImpactSection.scss";

export default function ImpactSection() {
  return (
    <section className="section pl-impact" aria-label="Platform Architecture and Impact">
      <div className="pl-impact__container">
        <div className="pl-impact__header">
          <div className="badge">
            <Badge variant="primary" icon={Network}>
              Clinical Infrastructure
            </Badge>
          </div>
          <h2>Building a More Connected Healthcare Experience.</h2>
          <p>
            PublicLab bridges the communication divide between high-precision pathology laboratories,
            treating physicians, and discerning patients.
          </p>
        </div>

        <div className="pl-impact__grid">
          {/* Card 1: Wide */}
          <div className="pl-impact__card pl-impact__card--wide">
            <div className="pl-impact__card-icon">
              <Microscope size={24} />
            </div>
            <h3 className="pl-impact__card-title">Accredited Laboratory Infrastructure</h3>
            <p className="pl-impact__card-desc">
              Every diagnostic center on the PublicLab platform undergoes administrative validation,
              ensuring certified pathologists, calibrated automated analyzers, and verifiable clinical registration.
            </p>
            <div className="pl-impact__card-tags">
              <Badge variant="neutral">Automated Hematology</Badge>
              <Badge variant="neutral">Clinical Biochemistry</Badge>
              <Badge variant="neutral">Immunoassay Analysis</Badge>
            </div>
          </div>

          {/* Card 2 */}
          <div className="pl-impact__card">
            <div className="pl-impact__card-icon" style={{ backgroundColor: "#DBEAFE", color: "#2563EB" }}>
              <ShieldCheck size={24} />
            </div>
            <h3 className="pl-impact__card-title">Patient Privacy Integrity</h3>
            <p className="pl-impact__card-desc">
              Medical reports are isolated using single-tenant laboratory partition keys and accessible
              only via dual-authenticated one-time codes without public exposure.
            </p>
            <div className="pl-impact__card-tags">
              <Badge variant="success">Zero Third-Party Tracking</Badge>
            </div>
          </div>

          {/* Card 3 */}
          <div className="pl-impact__card">
            <div className="pl-impact__card-icon" style={{ backgroundColor: "#DCFCE7", color: "#16A34A" }}>
              <HeartPulse size={24} />
            </div>
            <h3 className="pl-impact__card-title">Physician Trust</h3>
            <p className="pl-impact__card-desc">
              Standardized formatting, reference intervals, and cryptographic report version logs ensure
              doctors receive dependable pathology data for accurate diagnosis.
            </p>
            <div className="pl-impact__card-tags">
              <Badge variant="neutral">Version Tracking</Badge>
            </div>
          </div>

          {/* Card 4: Wide */}
          <div className="pl-impact__card pl-impact__card--wide">
            <div className="pl-impact__card-icon" style={{ backgroundColor: "#FEF3C7", color: "#D97706" }}>
              <Laptop2 size={24} />
            </div>
            <h3 className="pl-impact__card-title">Clinical Calculators & Decision Tools</h3>
            <p className="pl-impact__card-desc">
              Equipped with validated clinical calculation modules (2021 CKD-EPI eGFR, Friedewald LDL, HOMA-IR, and Free Androgen Index)
              enabling pathology labs to attach deeper diagnostic insights to standard patient orders.
            </p>
            <div className="pl-impact__card-tags">
              <Badge variant="neutral">CKD-EPI eGFR</Badge>
              <Badge variant="neutral">Friedewald LDL</Badge>
              <Badge variant="neutral">HOMA-IR Insulin</Badge>
              <Badge variant="neutral">Free Androgen Index</Badge>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
