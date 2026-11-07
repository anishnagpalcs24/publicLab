import React from "react";
import { ArrowRight, Sparkles, HeartHandshake } from "lucide-react";
import Badge from "../../../../Shared/Component/Badge/Badge";
import "./PatientStories.scss";

export default function PatientStories() {
  const stories = [
    {
      id: "story-1",
      tag: "Preventative Screening",
      scenario: "Elderly Parent Care",
      quote: "Direct OTP report downloads allow family members in other cities to promptly review tests without managing passwords.",
      gradient: "linear-gradient(135deg, #0F766E 0%, #042F2E 100%)",
      featured: true,
    },
    {
      id: "story-2",
      tag: "Chronic Condition Monitoring",
      scenario: "Diabetic Quarterly Tracking",
      quote: "Receiving verified biochemistry records directly from NABL laboratories creates a clear timeline for consulting physicians.",
      gradient: "linear-gradient(135deg, #1E40AF 0%, #172554 100%)",
      featured: false,
    },
    {
      id: "story-3",
      tag: "Emergency Access",
      scenario: "Travel Diagnostics",
      quote: "Quick callback assistance and digitized reports eliminate the risk of lost physical pathology copies while traveling.",
      gradient: "linear-gradient(135deg, #166534 0%, #052E16 100%)",
      featured: false,
    },
  ];

  return (
    <section className="section pl-patient-stories" aria-label="Patient Experience Scenarios">
      <div className="pl-patient-stories__container">
        <div className="pl-patient-stories__header">
          <div className="badge">
            <Badge variant="primary" icon={HeartHandshake}>
              Healthcare Experience
            </Badge>
          </div>
          <h2>Designed for Real Patient Needs</h2>
          <p>
            PublicLab transforms traditional diagnostic friction into a simple, secure, and dignified digital experience.
          </p>
        </div>

        <div className="pl-patient-stories__grid">
          {stories.map((item) => (
            <div
              key={item.id}
              className={`pl-patient-stories__card ${
                item.featured ? "pl-patient-stories__card--featured" : ""
              }`}
              style={{ background: item.gradient }}
            >
              <div className="pl-patient-stories__card-content">
                <span className="pl-patient-stories__card-tag">{item.tag}</span>
                <p className="pl-patient-stories__card-quote">"{item.quote}"</p>

                <div className="pl-patient-stories__card-footer">
                  <div className="info">Scenario: {item.scenario}</div>
                  <ArrowRight size={18} className="pl-patient-stories__card-arrow" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
