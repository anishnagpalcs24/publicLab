import React, { useState } from "react";
import { PackageSearch, Filter } from "lucide-react";
import TestCard from "../../Component/TestCard/TestCard";
import Badge from "../../../../Shared/Component/Badge/Badge";
import { SAMPLE_PACKAGES } from "../../services/test.service";

const CATEGORIES = [
  "All Packages",
  "Full Body Profile",
  "Cardiac Health",
  "Endocrinology",
  "Preventive Care",
  "Geriatric Care",
];

export default function TestPackages() {
  const [selectedCategory, setSelectedCategory] = useState("All Packages");

  const filtered =
    selectedCategory === "All Packages"
      ? SAMPLE_PACKAGES
      : SAMPLE_PACKAGES.filter((p) => p.category === selectedCategory);

  return (
    <div className="section" style={{ minHeight: "80vh" }}>
      <div className="container">
        {/* Header */}
        <div style={{ maxWidth: "680px", marginBottom: "2.5rem" }}>
          <div style={{ marginBottom: "0.5rem" }}>
            <Badge variant="primary" icon={PackageSearch}>
              Diagnostic Packages
            </Badge>
          </div>
          <h1>Health Tests & Preventative Profiles</h1>
          <p style={{ marginTop: "0.5rem" }}>
            Explore standardized diagnostic packages formulated by accredited pathologists with transparent parameter listings.
          </p>
        </div>

        {/* Category Filter Pills */}
        <div
          style={{
            display: "flex",
            gap: "0.5rem",
            flexWrap: "wrap",
            marginBottom: "2.5rem",
            backgroundColor: "#FFFFFF",
            padding: "1rem 1.5rem",
            borderRadius: "16px",
            border: "1px solid #E2E8F0",
          }}
        >
          {CATEGORIES.map((cat) => {
            const isSelected = selectedCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                style={{
                  padding: "6px 16px",
                  borderRadius: "9999px",
                  fontSize: "0.875rem",
                  fontWeight: 500,
                  border: "1px solid",
                  borderColor: isSelected ? "#0F766E" : "#E2E8F0",
                  backgroundColor: isSelected ? "#CCFBF1" : "#FFFFFF",
                  color: isSelected ? "#0F766E" : "#475569",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                {cat}
              </button>
            );
          })}
        </div>

        {/* Test Cards Grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
            gap: "1.5rem",
          }}
        >
          {filtered.map((pkg) => (
            <TestCard key={pkg.id} pkg={pkg} />
          ))}
        </div>
      </div>
    </div>
  );
}
