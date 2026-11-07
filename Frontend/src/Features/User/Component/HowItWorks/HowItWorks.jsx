import React from "react";
import { Search, ListChecks, PhoneForwarded, FileCheck2 } from "lucide-react";
import Badge from "../../../../Shared/Component/Badge/Badge";
import "./HowItWorks.scss";

export default function HowItWorks() {
  const steps = [
    {
      step: "01",
      icon: Search,
      title: "Discover a Laboratory",
      desc: "Find certified diagnostic labs near your city. Review accreditation, addresses, operating schedules, and verified clinical licensing.",
    },
    {
      step: "02",
      icon: ListChecks,
      title: "Explore Tests & Panels",
      desc: "Check available diagnostic packages, fasting prerequisites, specimen requirements, and turnaround intervals with transparent clarity.",
    },
    {
      step: "03",
      icon: PhoneForwarded,
      title: "Request Callback or Book",
      desc: "Submit a direct callback enquiry to the pathology laboratory for specimen collection, test pricing, or home collection scheduling.",
    },
    {
      step: "04",
      icon: FileCheck2,
      title: "Access Reports Securely",
      desc: "Verify your email with a single-use 6-digit OTP code to view, verify, and download your authentic PDF laboratory records anytime.",
    },
  ];

  return (
    <section className="section pl-how-it-works" aria-label="How PublicLab Works">
      <div className="pl-how-it-works__container">
        <div className="pl-how-it-works__header">
          <div className="badge">
            <Badge variant="primary">Streamlined Diagnostics</Badge>
          </div>
          <h2>How PublicLab Works</h2>
          <p>
            Experience a modern, transparent diagnostic healthcare journey designed for utmost
            patient privacy, accredited testing, and hassle-free report retrieval.
          </p>
        </div>

        <div className="pl-how-it-works__steps-grid">
          {steps.map((st) => {
            const Icon = st.icon;
            return (
              <div key={st.step} className="pl-how-it-works__step-card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div className="pl-how-it-works__step-card-number">{st.step}</div>
                  <div className="pl-how-it-works__step-card-icon">
                    <Icon size={22} />
                  </div>
                </div>
                <h3 className="pl-how-it-works__step-card-title">{st.title}</h3>
                <p className="pl-how-it-works__step-card-desc">{st.desc}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
