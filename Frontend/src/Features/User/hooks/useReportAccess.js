import { useState, useEffect } from "react";
import { patientReportService } from "../services/report.service";
import { useUser } from "../state/user.context";

export function useReportAccess() {
  const { verifiedPatientSession, setPatientReportsAccess, clearPatientReportsAccess } = useUser();

  const [step, setStep] = useState(verifiedPatientSession ? "reports" : "email"); // "email" | "otp" | "reports"
  const [email, setEmail] = useState(verifiedPatientSession?.email || "");
  const [otp, setOtp] = useState("");
  const [reports, setReports] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);

  // Resend countdown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const interval = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [resendCooldown]);

  // Request OTP
  const requestOtp = async (inputEmail) => {
    const targetEmail = inputEmail || email;
    if (!targetEmail) {
      setError("Please enter a valid email address");
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccessMessage("");

    try {
      const res = await patientReportService.requestReportOtp(targetEmail);
      setEmail(targetEmail);
      setStep("otp");
      setSuccessMessage(res.message || "A 6-digit verification code has been dispatched to your email.");
      setResendCooldown(60);
    } catch (err) {
      setError(err.message || "Failed to dispatch verification code. Please check your email.");
    } finally {
      setIsLoading(false);
    }
  };

  // Resend OTP
  const resendOtp = async () => {
    if (resendCooldown > 0) return;
    await requestOtp(email);
  };

  // Verify OTP
  const verifyOtp = async (inputOtp) => {
    const targetOtp = inputOtp || otp;
    if (!targetOtp || targetOtp.length < 6) {
      setError("Please enter the complete 6-digit verification code");
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccessMessage("");

    try {
      const result = await patientReportService.verifyReportOtp({
        email,
        otp: targetOtp,
      });

      setReports(result.reports || []);
      setPatientReportsAccess({
        email,
        patient: result.patient || result.user,
        reports: result.reports || [],
      });
      setStep("reports");
      setSuccessMessage("Identity verified successfully. Your medical reports are ready.");
    } catch (err) {
      setError(err.message || "Invalid or expired verification code. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Download a report
  const downloadReport = async (reportId, filename) => {
    setIsDownloading(true);
    setError(null);
    try {
      await patientReportService.downloadReport(reportId, filename);
    } catch (err) {
      setError(err.message || "Could not download report. Please try again.");
    } finally {
      setIsDownloading(false);
    }
  };

  // Reset to email step
  const resetFlow = () => {
    sessionStorage.removeItem("pl_patient_report_token");
    clearPatientReportsAccess();
    setStep("email");
    setOtp("");
    setError(null);
    setSuccessMessage("");
  };

  return {
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
  };
}
