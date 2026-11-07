import React, { useState } from "react";
import {
  Mail,
  ShieldCheck,
  KeyRound,
  Download,
  AlertCircle,
  CheckCircle2,
  FileText,
  RotateCcw,
  Lock,
} from "lucide-react";
import Button from "../../../../Shared/Component/Button/Button";
import Input from "../../../../Shared/Component/Input/Input";
import Badge from "../../../../Shared/Component/Badge/Badge";
import { useReportAccess } from "../../hooks/useReportAccess";
import "./ReportSection.scss";

export default function ReportSection() {
  const {
    step,
    email,
    setEmail,
    otp,
    setOtp,
    reports,
    isLoading,
    isDownloading,
    error,
    successMessage,
    resendCooldown,
    requestOtp,
    resendOtp,
    verifyOtp,
    downloadReport,
    resetFlow,
  } = useReportAccess();

  const [inputEmail, setInputEmail] = useState("");
  const [inputOtp, setInputOtp] = useState("");

  const handleEmailSubmit = (e) => {
    e.preventDefault();
    if (!inputEmail.trim()) return;
    requestOtp(inputEmail.trim());
  };

  const handleOtpSubmit = (e) => {
    e.preventDefault();
    if (!inputOtp.trim()) return;
    verifyOtp(inputOtp.trim());
  };

  return (
    <section className="section pl-report-section" id="check-reports" aria-label="Check Medical Reports">
      <div className="pl-report-section__container">
        <div className="pl-report-section__header">
          <div className="badge">
            <Badge variant="primary" icon={Lock}>
              Passwordless Patient Portal
            </Badge>
          </div>
          <h2>Your Medical Reports, Just a Verification Away.</h2>
          <p>
            Access your previous diagnostic reports securely using your registered email address
            and OTP. No website registration or permanent password required.
          </p>
        </div>

        <div className="pl-report-section__box">
          {/* Step Indicator */}
          <div className="pl-report-section__step-tracker">
            <div
              className={`pl-report-section__step-tracker-item ${
                step === "email"
                  ? "pl-report-section__step-tracker-item--active"
                  : "pl-report-section__step-tracker-item--done"
              }`}
            >
              <div className="dot">1</div>
              <span className="label">Registered Email</span>
            </div>

            <div
              className={`pl-report-section__step-tracker-item ${
                step === "otp"
                  ? "pl-report-section__step-tracker-item--active"
                  : step === "reports"
                  ? "pl-report-section__step-tracker-item--done"
                  : ""
              }`}
            >
              <div className="dot">2</div>
              <span className="label">6-Digit OTP</span>
            </div>

            <div
              className={`pl-report-section__step-tracker-item ${
                step === "reports"
                  ? "pl-report-section__step-tracker-item--active"
                  : ""
              }`}
            >
              <div className="dot">3</div>
              <span className="label">Access Reports</span>
            </div>
          </div>

          {/* Feedback messages */}
          {error && (
            <div className="pl-report-section__feedback pl-report-section__feedback--error" style={{ marginBottom: "1.5rem" }}>
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {successMessage && (
            <div className="pl-report-section__feedback pl-report-section__feedback--success" style={{ marginBottom: "1.5rem" }}>
              <CheckCircle2 size={16} />
              <span>{successMessage}</span>
            </div>
          )}

          {/* STEP 1: Enter Email */}
          {step === "email" && (
            <form className="pl-report-section__form" onSubmit={handleEmailSubmit}>
              <Input
                label="Registered Patient Email Address"
                name="patientEmail"
                type="email"
                placeholder="name@example.com"
                required
                prefixIcon={Mail}
                value={inputEmail}
                onChange={(e) => setInputEmail(e.target.value)}
                helperText="Enter the email address provided to your laboratory during test booking."
              />

              <Button
                type="submit"
                variant="primary"
                size="lg"
                fullWidth
                isLoading={isLoading}
                disabled={!inputEmail.trim()}
              >
                Send Verification OTP
              </Button>
            </form>
          )}

          {/* STEP 2: Enter OTP */}
          {step === "otp" && (
            <form className="pl-report-section__form" onSubmit={handleOtpSubmit}>
              <div style={{ textAlign: "center", marginBottom: "0.5rem" }}>
                <p style={{ fontSize: "0.875rem", color: "#64748B" }}>
                  Verification code dispatched to: <strong>{email}</strong>
                </p>
              </div>

              <Input
                label="6-Digit Verification Code"
                name="reportOtp"
                type="text"
                placeholder="123456"
                maxLength={6}
                required
                prefixIcon={KeyRound}
                value={inputOtp}
                onChange={(e) => setInputOtp(e.target.value)}
                helperText="Code expires in 10 minutes. Check your inbox or spam folder."
              />

              <Button
                type="submit"
                variant="primary"
                size="lg"
                fullWidth
                isLoading={isLoading}
                disabled={inputOtp.length < 6}
              >
                Verify & View My Reports
              </Button>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={resetFlow}
                  disabled={isLoading}
                >
                  Change Email
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={resendOtp}
                  disabled={resendCooldown > 0 || isLoading}
                >
                  {resendCooldown > 0
                    ? `Resend OTP in ${resendCooldown}s`
                    : "Resend Code"}
                </Button>
              </div>
            </form>
          )}

          {/* STEP 3: View Reports */}
          {step === "reports" && (
            <div className="pl-report-section__reports-list">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                <div>
                  <h4 style={{ fontWeight: 600 }}>Verified Medical Records</h4>
                  <p style={{ fontSize: "0.75rem", color: "#64748B" }}>Authenticated for {email}</p>
                </div>
                <Button variant="outline" size="sm" icon={RotateCcw} onClick={resetFlow}>
                  Exit Session
                </Button>
              </div>

              {reports.length === 0 ? (
                <div className="pl-report-section__empty-reports">
                  <FileText size={48} color="#94A3B8" />
                  <h4>No Published Reports Found</h4>
                  <p>
                    There are no published diagnostic reports linked with this email address yet,
                    or your samples are currently in laboratory processing.
                  </p>
                  <Button variant="outline" size="sm" onClick={() => window.location.href = "/callback"}>
                    Inquire With Lab Support
                  </Button>
                </div>
              ) : (
                reports.map((report) => (
                  <div key={report.id} className="pl-report-section__report-card">
                    <div className="pl-report-section__report-card-info">
                      <div className="icon">
                        <FileText size={20} />
                      </div>
                      <div>
                        <h4>{report.original_filename || `Diagnostic Report #${report.id}`}</h4>
                        <p>
                          {report.lab_name ? `${report.lab_name} • ` : ""}
                          Published on: {new Date(report.published_at || report.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    <Button
                      variant="primary"
                      size="sm"
                      icon={Download}
                      isLoading={isDownloading}
                      onClick={() => downloadReport(report.id, report.original_filename)}
                    >
                      Download PDF
                    </Button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
