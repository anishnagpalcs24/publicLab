import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useEffect } from "react";
import {
  Activity,
  Mail,
  Lock,
  Building2,
  Phone,
  ShieldCheck,
  KeyRound,
  ArrowLeft,
  FileCheck2,
} from "lucide-react";
import Button from "../../../../Shared/Component/Button/Button";
import Input from "../../../../Shared/Component/Input/Input";
import { useAuth } from "../../state/auth.context";
import { useToast } from "../../../../Shared/Context/ToastContext";
import "./LabLogin.scss";


export default function LabLogin() {
  useEffect(() => {
    document.title = "Lab Owner Sign In | PublicLab";
  }, []);
  // Modes: "login" | "register" | "verify" | "forgot" | "reset"
  const [mode, setMode] = useState("login");

  // Login form state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Registration form state
  const [regData, setRegData] = useState({
    labName: "",
    email: "",
    phone: "",
    city: "",
    address: "",
    licenseNumber: "",
    ownerFullName: "",
    ownerEmail: "",
    ownerPhone: "",
    password: "",
  });

  // OTP & Password Reset state
  const [otp, setOtp] = useState("");
  const [forgotEmail, setForgotEmail] = useState("");
  const [resetOtp, setResetOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Validation & Loading state
  const [fieldErrors, setFieldErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);

  const { login, registerLab, verifyOtp, forgotPassword, resetPassword: resetPassService } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  // Clear errors when switching modes
  const switchMode = (newMode) => {
    setMode(newMode);
    setFieldErrors({});
  };

  // 1. Handle Login
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    const errors = {};
    if (!email.trim()) errors.email = "Email address is required";
    if (!password) errors.password = "Password is required";

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    setIsLoading(true);
    try {
      const user = await login({ email: email.trim(), password });
      toast.success("Welcome back! Signed in successfully.", "Authentication Successful");
      if (user?.role === "lab") {
        navigate("/lab/dashboard");
      } else if (user?.role === "admin") {
        navigate("/admin/dashboard");
      } else {
        navigate("/reports");
      }
    } catch (err) {
      const msg = err.message || "Invalid credentials. Please verify your email and password.";
      toast.error(msg, "Sign In Failed");
    } finally {
      setIsLoading(false);
    }
  };

  // 2. Handle Lab Registration
  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    const errors = {};
    if (!regData.labName.trim()) errors.labName = "Laboratory name is required";
    if (!regData.licenseNumber.trim()) errors.licenseNumber = "Legal registration/license number is required";
    if (!regData.city.trim()) errors.city = "City is required";
    if (!regData.address.trim()) errors.address = "Facility address is required";
    if (!regData.ownerFullName.trim()) errors.ownerFullName = "Owner full name is required";
    if (!regData.ownerEmail.trim()) errors.ownerEmail = "Owner email address is required";
    if (!regData.password) {
      errors.password = "Password is required";
    } else if (regData.password.length < 8) {
      errors.password = "Password must be at least 8 characters";
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      toast.warning("Please complete all required fields correctly.", "Form Validation");
      return;
    }

    setFieldErrors({});
    setIsLoading(true);
    try {
      const res = await registerLab(regData);
      const targetEmail = regData.ownerEmail.trim() || regData.email.trim();
      setEmail(targetEmail);
      toast.success(
        res.message || "Registration details received. Please verify your email to submit your application for administrator review.",
        "Registration Received"
      );
      switchMode("verify");
    } catch (err) {
      toast.error(
        err.message || "Could not register laboratory. Please verify your information and try again.",
        "Registration Failed"
      );
    } finally {
      setIsLoading(false);
    }
  };

  // 3. Handle Owner Email OTP Verification
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (!otp.trim()) {
      setFieldErrors({ otp: "Please enter the 6-digit verification code" });
      return;
    }

    if (otp.trim().length !== 6) {
      setFieldErrors({ otp: "Verification code must be exactly 6 digits" });
      return;
    }

    setFieldErrors({});
    setIsLoading(true);
    try {
      await verifyOtp({ email: email.trim(), otp: otp.trim() });
      toast.success("Email verified! Your laboratory application has been submitted for administrator review.", "Account Verified");
      navigate("/lab/dashboard");
    } catch (err) {
      toast.error(err.message || "Invalid or expired verification code", "Verification Failed");
    } finally {
      setIsLoading(false);
    }
  };

  // 4. Handle Forgot Password (request OTP)
  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    if (!forgotEmail.trim()) {
      setFieldErrors({ forgotEmail: "Please enter your registered email address" });
      return;
    }

    setFieldErrors({});
    setIsLoading(true);
    try {
      const res = await forgotPassword(forgotEmail.trim());
      toast.success(
        res.message || "A 6-digit password reset code has been dispatched to your email.",
        "Reset Code Dispatched"
      );
      switchMode("reset");
    } catch (err) {
      toast.error(err.message || "Could not dispatch reset code. Please try again.", "Request Failed");
    } finally {
      setIsLoading(false);
    }
  };

  // 5. Handle Reset Password (submit OTP + new password)
  const handleResetSubmit = async (e) => {
    e.preventDefault();
    const errors = {};
    if (!resetOtp.trim()) {
      errors.resetOtp = "Verification code is required";
    } else if (resetOtp.trim().length !== 6) {
      errors.resetOtp = "Verification code must be exactly 6 digits";
    }

    if (!newPassword) {
      errors.newPassword = "New password is required";
    } else if (newPassword.length < 8) {
      errors.newPassword = "Password must contain at least 8 characters";
    }

    if (newPassword !== confirmPassword) {
      errors.confirmPassword = "Passwords do not match";
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    setIsLoading(true);
    try {
      const res = await resetPassService({
        email: forgotEmail.trim(),
        otp: resetOtp.trim(),
        newPassword,
      });
      toast.success(
        res.message || "Password reset successful! You can now log in with your new password.",
        "Password Updated"
      );
      setEmail(forgotEmail.trim());
      setPassword("");
      switchMode("login");
    } catch (err) {
      toast.error(err.message || "Could not reset password. Please check your verification code.", "Reset Failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="pl-auth-page">
      <div className={`pl-auth-card ${mode === "register" ? "pl-auth-card--wide" : ""}`}>
        {/* Brand Header */}
        <div className="pl-auth-brand">
          <Link to="/" className="pl-auth-brand__logo">
            <div className="pl-auth-brand__logo-icon">
              <Activity size={24} />
            </div>
            <span>
              Public<span className="pl-auth-brand__logo-blue">Lab</span>
            </span>
          </Link>

          <h2 className="pl-auth-brand__title">
            {mode === "login" && "Laboratory Owner Sign In"}
            {mode === "register" && "Register Your Diagnostic Laboratory"}
            {mode === "verify" && "Verify Owner Email"}
            {mode === "forgot" && "Reset Laboratory Password"}
            {mode === "reset" && "Create New Password"}
          </h2>

          <p className="pl-auth-brand__subtitle">
            {mode === "login" && "Manage patients, orders, and published medical reports"}
            {mode === "register" && "Submit facility credentials for platform accreditation"}
            {mode === "verify" && `Enter the 6-digit verification code dispatched to ${email}`}
            {mode === "forgot" && "Enter your registered email address to receive a verification code"}
            {mode === "reset" && `Enter the 6-digit code dispatched to ${forgotEmail} and your new password`}
          </p>
        </div>

        {/* Tab switch for login / register */}
        {(mode === "login" || mode === "register") && (
          <div className="pl-auth-tabs">
            <button
              type="button"
              className={`pl-auth-tab ${mode === "login" ? "pl-auth-tab--active" : ""}`}
              onClick={() => switchMode("login")}
            >
              Sign In
            </button>
            <button
              type="button"
              className={`pl-auth-tab ${mode === "register" ? "pl-auth-tab--active" : ""}`}
              onClick={() => switchMode("register")}
            >
              Register Facility
            </button>
          </div>
        )}

        {/* 1. LOGIN MODE */}
        {mode === "login" && (
          <form onSubmit={handleLoginSubmit} className="pl-auth-form" noValidate>
            <Input
              label="Email Address"
              name="email"
              type="email"
              prefixIcon={Mail}
              required
              placeholder="owner@lab.com"
              value={email}
              error={fieldErrors.email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (fieldErrors.email) setFieldErrors({ ...fieldErrors, email: "" });
              }}
            />

            <div>
              <Input
                label="Password"
                name="password"
                type="password"
                prefixIcon={Lock}
                required
                placeholder="••••••••"
                value={password}
                error={fieldErrors.password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (fieldErrors.password) setFieldErrors({ ...fieldErrors, password: "" });
                }}
              />
              <div className="pl-auth-forgot-link">
                <button
                  type="button"
                  onClick={() => {
                    setForgotEmail(email);
                    switchMode("forgot");
                  }}
                >
                  Forgot Password?
                </button>
              </div>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              isLoading={isLoading}
              style={{ marginTop: "0.5rem" }}
            >
              Sign In to Lab Workspace
            </Button>
          </form>
        )}

        {/* 2. REGISTRATION MODE */}
        {mode === "register" && (
          <form onSubmit={handleRegisterSubmit} className="pl-auth-form" noValidate>
            <Input
              label="Diagnostic Laboratory Name"
              name="labName"
              prefixIcon={Building2}
              required
              placeholder="e.g., Apex Clinical Diagnostics"
              value={regData.labName}
              error={fieldErrors.labName}
              onChange={(e) => {
                setRegData({ ...regData, labName: e.target.value });
                if (fieldErrors.labName) setFieldErrors({ ...fieldErrors, labName: "" });
              }}
            />

            <div className="pl-auth-grid-2">
              <Input
                label="Facility Email"
                name="facilityEmail"
                type="email"
                prefixIcon={Mail}
                placeholder="contact@apexlabs.com"
                value={regData.email}
                error={fieldErrors.facilityEmail}
                onChange={(e) => setRegData({ ...regData, email: e.target.value })}
              />

              <Input
                label="Facility Phone"
                name="facilityPhone"
                type="tel"
                prefixIcon={Phone}
                placeholder="+91-9876543210"
                value={regData.phone}
                error={fieldErrors.facilityPhone}
                onChange={(e) => setRegData({ ...regData, phone: e.target.value })}
              />
            </div>

            <div className="pl-auth-grid-2">
              <Input
                label="City"
                name="city"
                required
                placeholder="e.g., Mumbai"
                value={regData.city}
                error={fieldErrors.city}
                onChange={(e) => {
                  setRegData({ ...regData, city: e.target.value });
                  if (fieldErrors.city) setFieldErrors({ ...fieldErrors, city: "" });
                }}
              />

              <Input
                label="Legal Registration / License No."
                name="licenseNumber"
                prefixIcon={FileCheck2}
                required
                placeholder="e.g., NABL-2026-APEX"
                value={regData.licenseNumber}
                error={fieldErrors.licenseNumber}
                onChange={(e) => {
                  setRegData({ ...regData, licenseNumber: e.target.value });
                  if (fieldErrors.licenseNumber) setFieldErrors({ ...fieldErrors, licenseNumber: "" });
                }}
              />
            </div>

            <Input
              label="Facility Physical Address"
              name="address"
              required
              placeholder="Full address of laboratory premises"
              value={regData.address}
              error={fieldErrors.address}
              onChange={(e) => {
                setRegData({ ...regData, address: e.target.value });
                if (fieldErrors.address) setFieldErrors({ ...fieldErrors, address: "" });
              }}
            />

            <div
              style={{
                borderTop: "1px solid #E2E8F0",
                paddingTop: "1rem",
                marginTop: "0.5rem",
              }}
            >
              <h4 style={{ fontSize: "0.9375rem", fontWeight: 600, color: "#0F172A", marginBottom: "0.75rem" }}>
                Primary Account Director / Owner Credentials
              </h4>
            </div>

            <Input
              label="Director / Owner Full Name"
              name="ownerFullName"
              required
              placeholder="Dr. John Doe"
              value={regData.ownerFullName}
              error={fieldErrors.ownerFullName}
              onChange={(e) => {
                setRegData({ ...regData, ownerFullName: e.target.value });
                if (fieldErrors.ownerFullName) setFieldErrors({ ...fieldErrors, ownerFullName: "" });
              }}
            />

            <div className="pl-auth-grid-2">
              <Input
                label="Owner Login Email"
                name="ownerEmail"
                type="email"
                prefixIcon={Mail}
                required
                placeholder="director@apexlabs.com"
                value={regData.ownerEmail}
                error={fieldErrors.ownerEmail}
                onChange={(e) => {
                  setRegData({ ...regData, ownerEmail: e.target.value });
                  if (fieldErrors.ownerEmail) setFieldErrors({ ...fieldErrors, ownerEmail: "" });
                }}
              />

              <Input
                label="Owner Direct Phone"
                name="ownerPhone"
                type="tel"
                prefixIcon={Phone}
                placeholder="9876543210"
                value={regData.ownerPhone}
                error={fieldErrors.ownerPhone}
                onChange={(e) => setRegData({ ...regData, ownerPhone: e.target.value })}
              />
            </div>

            <Input
              label="Create Secure Password"
              name="regPassword"
              type="password"
              prefixIcon={Lock}
              required
              placeholder="•••••••• (Min 8 characters)"
              value={regData.password}
              error={fieldErrors.password}
              onChange={(e) => {
                setRegData({ ...regData, password: e.target.value });
                if (fieldErrors.password) setFieldErrors({ ...fieldErrors, password: "" });
              }}
            />

            <Button
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              isLoading={isLoading}
              style={{ marginTop: "0.5rem" }}
            >
              Submit Application & Send Verification OTP
            </Button>
          </form>
        )}

        {/* 3. VERIFY OTP MODE */}
        {mode === "verify" && (
          <form onSubmit={handleVerifyOtp} className="pl-auth-form" noValidate>
            <Input
              label="6-Digit Verification Code"
              name="otp"
              type="text"
              prefixIcon={KeyRound}
              required
              maxLength={6}
              placeholder="123456"
              value={otp}
              error={fieldErrors.otp}
              style={{ letterSpacing: "4px", fontSize: "1.25rem", textAlign: "center" }}
              onChange={(e) => {
                setOtp(e.target.value.replace(/\D/g, ""));
                if (fieldErrors.otp) setFieldErrors({ ...fieldErrors, otp: "" });
              }}
            />

            <Button
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              isLoading={isLoading}
            >
              Verify Email & Proceed
            </Button>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "0.5rem" }}>
              <button
                type="button"
                className="pl-auth-action-link"
                onClick={() => switchMode("login")}
              >
                <ArrowLeft size={16} /> Back to Sign In
              </button>
            </div>
          </form>
        )}

        {/* 4. FORGOT PASSWORD MODE */}
        {mode === "forgot" && (
          <form onSubmit={handleForgotSubmit} className="pl-auth-form" noValidate>
            <Input
              label="Registered Account Email"
              name="forgotEmail"
              type="email"
              prefixIcon={Mail}
              required
              placeholder="owner@lab.com"
              value={forgotEmail}
              error={fieldErrors.forgotEmail}
              onChange={(e) => {
                setForgotEmail(e.target.value);
                if (fieldErrors.forgotEmail) setFieldErrors({ ...fieldErrors, forgotEmail: "" });
              }}
            />

            <Button
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              isLoading={isLoading}
            >
              Send Reset Code
            </Button>

            <div style={{ textAlign: "center", marginTop: "0.5rem" }}>
              <button
                type="button"
                className="pl-auth-action-link"
                onClick={() => switchMode("login")}
              >
                <ArrowLeft size={16} /> Back to Sign In
              </button>
            </div>
          </form>
        )}

        {/* 5. RESET PASSWORD MODE */}
        {mode === "reset" && (
          <form onSubmit={handleResetSubmit} className="pl-auth-form" noValidate>
            <Input
              label="6-Digit Reset Code"
              name="resetOtp"
              type="text"
              prefixIcon={KeyRound}
              required
              maxLength={6}
              placeholder="123456"
              value={resetOtp}
              error={fieldErrors.resetOtp}
              style={{ letterSpacing: "4px", fontSize: "1.25rem", textAlign: "center" }}
              onChange={(e) => {
                setResetOtp(e.target.value.replace(/\D/g, ""));
                if (fieldErrors.resetOtp) setFieldErrors({ ...fieldErrors, resetOtp: "" });
              }}
            />

            <Input
              label="New Password"
              name="newPassword"
              type="password"
              prefixIcon={Lock}
              required
              placeholder="•••••••• (Min 8 characters)"
              value={newPassword}
              error={fieldErrors.newPassword}
              onChange={(e) => {
                setNewPassword(e.target.value);
                if (fieldErrors.newPassword) setFieldErrors({ ...fieldErrors, newPassword: "" });
              }}
            />

            <Input
              label="Confirm New Password"
              name="confirmPassword"
              type="password"
              prefixIcon={Lock}
              required
              placeholder="••••••••"
              value={confirmPassword}
              error={fieldErrors.confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                if (fieldErrors.confirmPassword) setFieldErrors({ ...fieldErrors, confirmPassword: "" });
              }}
            />

            <Button
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              isLoading={isLoading}
            >
              Reset & Update Password
            </Button>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "0.5rem" }}>
              <button
                type="button"
                className="pl-auth-action-link"
                onClick={() => switchMode("login")}
              >
                <ArrowLeft size={16} /> Back to Sign In
              </button>

              <button
                type="button"
                className="pl-auth-action-link"
                onClick={handleForgotSubmit}
                disabled={isLoading}
              >
                Resend Code
              </button>
            </div>
          </form>
        )}

        {/* Footer Navigation */}
        <div className="pl-auth-footer">
          <Link to="/">← Back to PublicLab Home</Link>
        </div>
      </div>
    </div>
  );
}
