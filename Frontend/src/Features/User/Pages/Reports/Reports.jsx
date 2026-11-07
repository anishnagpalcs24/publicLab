import React from "react";
import ReportSection from "../../Component/ReportSection/ReportSection";
import { ShieldCheck, Lock, Mail, Clock, FileCheck } from "lucide-react";
import Badge from "../../../../Shared/Component/Badge/Badge";

export default function Reports() {
  return (
    <div className="section" style={{ minHeight: "80vh" }}>
      <div className="container">
        {/* Main interactive OTP flow */}
        <ReportSection />

        {/* Security & Verification Guarantees */}
        <div
          style={{
            marginTop: "4rem",
            backgroundColor: "#FFFFFF",
            border: "1px solid #E2E8F0",
            borderRadius: "24px",
            padding: "2.5rem",
            maxWidth: "860px",
            marginLeft: "auto",
            marginRight: "auto",
          }}
        >
          <div style={{ textAlign: "center", marginBottom: "2rem" }}>
            <Badge variant="primary" icon={ShieldCheck}>
              Privacy Architecture
            </Badge>
            <h3 style={{ fontSize: "1.5rem", marginTop: "0.5rem" }}>
              How Does Passwordless Report Access Work?
            </h3>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: "2rem",
            }}
          >
            <div>
              <div
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "10px",
                  backgroundColor: "#CCFBF1",
                  color: "#0F766E",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: "1rem",
                }}
              >
                <Mail size={20} />
              </div>
              <h4 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "0.25rem" }}>
                1. Single-Use OTP
              </h4>
              <p style={{ fontSize: "0.875rem", color: "#64748B", lineHeight: 1.5 }}>
                Each time you request reports, a cryptographically hashed 6-digit code is dispatched to your registered email address.
              </p>
            </div>

            <div>
              <div
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "10px",
                  backgroundColor: "#DBEAFE",
                  color: "#2563EB",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: "1rem",
                }}
              >
                <Clock size={20} />
              </div>
              <h4 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "0.25rem" }}>
                2. 10-Minute Expiry
              </h4>
              <p style={{ fontSize: "0.875rem", color: "#64748B", lineHeight: 1.5 }}>
                Verification codes automatically expire after 10 minutes and support a maximum of 5 attempts to protect against brute-force inspection.
              </p>
            </div>

            <div>
              <div
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "10px",
                  backgroundColor: "#DCFCE7",
                  color: "#16A34A",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: "1rem",
                }}
              >
                <FileCheck size={20} />
              </div>
              <h4 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "0.25rem" }}>
                3. Direct PDF Download
              </h4>
              <p style={{ fontSize: "0.875rem", color: "#64748B", lineHeight: 1.5 }}>
                Once verified, access and download original, doctor-signed PDF laboratory reports issued directly by accredited facilities.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
