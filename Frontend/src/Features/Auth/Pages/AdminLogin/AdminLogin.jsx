import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ShieldAlert, User, Lock } from "lucide-react";
import Button from "../../../../Shared/Component/Button/Button";
import Input from "../../../../Shared/Component/Input/Input";
import { useAuth } from "../../state/auth.context";
import { useToast } from "../../../../Shared/Context/ToastContext";

export default function AdminLogin() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);

  const { adminLogin } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const handleAdminSubmit = async (e) => {
    e.preventDefault();
    const errors = {};
    if (!username.trim()) errors.username = "Administrator username is required";
    if (!password) errors.password = "Password is required";

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    setIsLoading(true);

    try {
      await adminLogin({ username: username.trim(), password });
      toast.success("Welcome, Administrator. Security Console Authenticated.", "Access Granted");
      navigate("/admin/dashboard");
    } catch (err) {
      toast.error(err.message || "Invalid administrative credentials.", "Authentication Failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem 1rem",
        backgroundColor: "#0F172A",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "440px",
          backgroundColor: "#1E293B",
          border: "1px solid #334155",
          borderRadius: "24px",
          padding: "2.5rem",
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.4)",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <div
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "12px",
              backgroundColor: "#0284C7",
              color: "#FFFFFF",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 1rem",
            }}
          >
            <ShieldAlert size={28} />
          </div>
          <h2 style={{ fontSize: "1.5rem", color: "#FFFFFF" }}>Admin Security Console</h2>
          <p style={{ fontSize: "0.875rem", color: "#94A3B8", marginTop: "0.25rem" }}>
            Authorized PublicLab platform governance and accreditation gateway
          </p>
        </div>

        <form onSubmit={handleAdminSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }} noValidate>
          <Input
            label="Admin Username"
            name="adminUsername"
            prefixIcon={User}
            required
            placeholder="admin"
            value={username}
            error={fieldErrors.username}
            onChange={(e) => {
              setUsername(e.target.value);
              if (fieldErrors.username) setFieldErrors({ ...fieldErrors, username: "" });
            }}
          />

          <Input
            label="Security Password"
            name="adminPassword"
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

          <Button
            type="submit"
            variant="primary"
            size="lg"
            fullWidth
            isLoading={isLoading}
            style={{ backgroundColor: "#0F766E", marginTop: "0.5rem" }}
          >
            Authenticate Console
          </Button>
        </form>

        <div style={{ textAlign: "center", marginTop: "2rem" }}>
          <Link to="/" style={{ fontSize: "0.875rem", color: "#94A3B8" }}>
            ← Return to PublicLab Home
          </Link>
        </div>
      </div>
    </div>
  );
}
