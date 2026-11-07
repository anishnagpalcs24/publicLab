import React, { useState, useEffect } from "react";
import { Settings as SettingsIcon, Save, AlertCircle, CheckCircle2 } from "lucide-react";
import Button from "../../../../Shared/Component/Button/Button";
import Input from "../../../../Shared/Component/Input/Input";
import Loader from "../../../../Shared/Component/Loader/Loader";
import { labOwnerService } from "../../services/lab.service";
import { useLab } from "../../state/lab.context";

export default function Settings() {
  const { labProfile, refreshLab } = useLab();
  const [formData, setFormData] = useState({
    name: "",
    city: "",
    address: "",
    phone: "",
    email: "",
    description: "",
  });

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (labProfile) {
      setFormData({
        name: labProfile.name || "",
        city: labProfile.city || "",
        address: labProfile.address || "",
        phone: labProfile.phone || "",
        email: labProfile.email || "",
        description: labProfile.description || "",
      });
    }
  }, [labProfile]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);
    setSuccess(false);

    try {
      await labOwnerService.updateMyLab(formData);
      setSuccess(true);
      refreshLab();
    } catch (err) {
      setError(err.message || "Failed to update laboratory settings");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div style={{ maxWidth: "800px" }}>
      {/* Header */}
      <div style={{ marginBottom: "2rem" }}>
        <h1 style={{ fontSize: "1.75rem", marginBottom: "0.25rem" }}>Laboratory Profile & Operations</h1>
        <p style={{ color: "#64748B", fontSize: "0.875rem" }}>
          Update facility location, public contact numbers, and patient guidance.
        </p>
      </div>

      {error && (
        <div style={{ padding: "1rem", backgroundColor: "#FEE2E2", color: "#DC2626", borderRadius: "8px", marginBottom: "1.5rem" }}>
          {error}
        </div>
      )}

      {success && (
        <div style={{ padding: "1rem", backgroundColor: "#DCFCE7", color: "#16A34A", borderRadius: "8px", marginBottom: "1.5rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <CheckCircle2 size={16} />
          <span>Laboratory profile updated successfully.</span>
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        style={{
          backgroundColor: "#FFFFFF",
          border: "1px solid #E2E8F0",
          borderRadius: "16px",
          padding: "2rem",
          display: "flex",
          flexDirection: "column",
          gap: "1.25rem",
          boxShadow: "0 1px 3px rgba(15, 23, 42, 0.05)",
        }}
      >
        <Input
          label="Laboratory Facility Name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          required
        />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
          <Input
            label="City"
            value={formData.city}
            onChange={(e) => setFormData({ ...formData, city: e.target.value })}
            required
          />

          <Input
            label="Helpline Phone"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            required
          />
        </div>

        <Input
          label="Official Email"
          type="email"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          required
        />

        <Input
          label="Full Street Address"
          value={formData.address}
          onChange={(e) => setFormData({ ...formData, address: e.target.value })}
        />

        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <label style={{ fontSize: "0.875rem", fontWeight: 500 }}>Public Description & Specialties</label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            rows={4}
            style={{
              padding: "8px 12px",
              borderRadius: "8px",
              border: "1px solid #E2E8F0",
              fontSize: "0.875rem",
              outline: "none",
              fontFamily: "inherit",
            }}
          />
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "1rem" }}>
          <Button
            type="submit"
            variant="primary"
            size="md"
            icon={Save}
            isLoading={isSaving}
          >
            Save Changes
          </Button>
        </div>
      </form>
    </div>
  );
}
