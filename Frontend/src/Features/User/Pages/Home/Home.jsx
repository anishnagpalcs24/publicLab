import React from "react";
import Hero from "../../Component/Hero/Hero";
import QuickActions from "../../Component/QuickActions/QuickActions";
import HowItWorks from "../../Component/HowItWorks/HowItWorks";
import ReportSection from "../../Component/ReportSection/ReportSection";
import PatientStories from "../../Component/PatientStories/PatientStories";
import CustomerReviews from "../../Component/CustomerReviews/CustomerReviews";
import ImpactSection from "../../Component/ImpactSection/ImpactSection";
import CtaBanner from "../../Component/CtaBanner/CtaBanner";
import LabCard from "../../Component/LabCard/LabCard";
import TestCard from "../../Component/TestCard/TestCard";
import Button from "../../../../Shared/Component/Button/Button";
import Badge from "../../../../Shared/Component/Badge/Badge";
import { useLabSearch } from "../../hooks/useLabSearch";
import { SAMPLE_PACKAGES } from "../../services/test.service";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Building2, PackageSearch } from "lucide-react";

export default function Home() {
  const { labs, isLoading } = useLabSearch("");
  const navigate = useNavigate();

  return (
    <div className="pl-home-page">
      {/* Section 2: Hero */}
      <Hero />

      {/* Section 3: Quick Actions */}
      <QuickActions />

      {/* Section 4: How PublicLab Works */}
      <HowItWorks />

      {/* Section 5: Find Laboratories Preview */}
      <section className="section" style={{ backgroundColor: "#FFFFFF", borderBottom: "1px solid #E2E8F0" }}>
        <div className="container">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "2rem", flexWrap: "wrap", gap: "1rem" }}>
            <div>
              <div style={{ marginBottom: "0.5rem" }}>
                <Badge variant="primary" icon={Building2}>Accredited Network</Badge>
              </div>
              <h2>Verified Diagnostic Centers</h2>
              <p>Certified clinical pathology laboratories ready for diagnostic sample collection.</p>
            </div>
            <Button
              variant="outline"
              size="md"
              icon={ArrowRight}
              iconPosition="right"
              onClick={() => navigate("/labs")}
            >
              View All Laboratories
            </Button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "1.5rem" }}>
            {labs.slice(0, 3).map((lab) => (
              <LabCard key={lab.id} lab={lab} />
            ))}
          </div>
        </div>
      </section>

      {/* Section 6: Test Packages Preview */}
      <section className="section" style={{ backgroundColor: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
        <div className="container">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "2rem", flexWrap: "wrap", gap: "1rem" }}>
            <div>
              <div style={{ marginBottom: "0.5rem" }}>
                <Badge variant="primary" icon={PackageSearch}>Preventive Profiles</Badge>
              </div>
              <h2>Comprehensive Health Panels</h2>
              <p>Transparent pathology testing batteries curated by certified diagnostic practitioners.</p>
            </div>
            <Button
              variant="outline"
              size="md"
              icon={ArrowRight}
              iconPosition="right"
              onClick={() => navigate("/test-packages")}
            >
              Explore All Packages
            </Button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "1.5rem" }}>
            {SAMPLE_PACKAGES.slice(0, 3).map((pkg) => (
              <TestCard key={pkg.id} pkg={pkg} />
            ))}
          </div>
        </div>
      </section>

      {/* Section 7: Check Medical Reports (OTP flow) */}
      <ReportSection />

      {/* Section 8: Patient Stories */}
      <PatientStories />

      {/* Section 9: Customer Reviews (Marquee) */}
      <CustomerReviews />

      {/* Section 10: Impact & Trust Section */}
      <ImpactSection />

      {/* Section 11: Final Call to Action */}
      <CtaBanner />
    </div>
  );
}
