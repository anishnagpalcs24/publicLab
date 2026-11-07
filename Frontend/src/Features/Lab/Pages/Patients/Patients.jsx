import React, { useState, useEffect } from "react";
import { Users, Plus, Search, AlertCircle, CheckCircle2 } from "lucide-react";
import Button from "../../../../Shared/Component/Button/Button";
import Input from "../../../../Shared/Component/Input/Input";
import Modal from "../../../../Shared/Component/Modal/Modal";
import Loader from "../../../../Shared/Component/Loader/Loader";
import Badge from "../../../../Shared/Component/Badge/Badge";
import { labOwnerService } from "../../services/lab.service";

export default function Patients() {
  const [patients, setPatients] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    fullName: "",
    dateOfBirth: "",
    sex: "male",
    phone: "",
    email: "",
    localPatientCode: "",
  });

  const loadPatients = async (query = "") => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await labOwnerService.getPatients({ search: query });
      setPatients(res?.data || []);
    } catch (err) {
      setError(err.message || "Failed to load patient records");
      setPatients([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPatients(searchTerm);
  }, [searchTerm]);

  const handleCreatePatient = async (e) => {
    e.preventDefault();
    if (!formData.fullName || !formData.dateOfBirth) return;

    setIsSubmitting(true);
    setError(null);

    try {
      await labOwnerService.createPatient({
        fullName: formData.fullName,
        dateOfBirth: formData.dateOfBirth,
        sex: formData.sex,
        phone: formData.phone || undefined,
        email: formData.email || undefined,
        localPatientCode: formData.localPatientCode || undefined,
      });

      setModalOpen(false);
      setFormData({
        fullName: "",
        dateOfBirth: "",
        sex: "male",
        phone: "",
        email: "",
        localPatientCode: "",
      });
      loadPatients();
    } catch (err) {
      setError(err.message || "Failed to register patient");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: "1200px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "2rem", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <h1 style={{ fontSize: "1.75rem", marginBottom: "0.25rem" }}>Patient Records</h1>
          <p style={{ color: "#64748B", fontSize: "0.875rem" }}>
            Register new patients and manage diagnostic history.
          </p>
        </div>

        <Button
          variant="primary"
          size="md"
          icon={Plus}
          onClick={() => setModalOpen(true)}
        >
          Register New Patient
        </Button>
      </div>

      {/* Search Bar */}
      <div style={{ maxWidth: "420px", marginBottom: "1.5rem" }}>
        <Input
          placeholder="Search by patient name, phone, or code..."
          prefixIcon={Search}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {error && (
        <div style={{ padding: "1rem", backgroundColor: "#FEE2E2", color: "#DC2626", borderRadius: "8px", marginBottom: "1rem" }}>
          {error}
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <Loader text="Loading patient directory..." />
      ) : patients.length === 0 ? (
        <div style={{ textAlign: "center", padding: "4rem 2rem", backgroundColor: "#FFFFFF", borderRadius: "16px", border: "1px solid #E2E8F0" }}>
          <Users size={48} color="#94A3B8" style={{ margin: "0 auto 1rem" }} />
          <h3>No Patients Registered</h3>
          <p style={{ margin: "0.5rem auto 1.5rem", color: "#64748B", maxWidth: "380px" }}>
            Add your first patient to begin logging diagnostic test orders and publishing medical reports.
          </p>
          <Button variant="primary" size="sm" icon={Plus} onClick={() => setModalOpen(true)}>
            Register Patient
          </Button>
        </div>
      ) : (
        <div style={{ backgroundColor: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "16px", overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.875rem" }}>
            <thead>
              <tr style={{ backgroundColor: "#F8FAFC", borderBottom: "1px solid #E2E8F0", color: "#64748B" }}>
                <th style={{ padding: "1rem 1.5rem" }}>Code / Ref</th>
                <th style={{ padding: "1rem 1.5rem" }}>Patient Name</th>
                <th style={{ padding: "1rem 1.5rem" }}>DOB / Age</th>
                <th style={{ padding: "1rem 1.5rem" }}>Sex</th>
                <th style={{ padding: "1rem 1.5rem" }}>Contact Phone</th>
                <th style={{ padding: "1rem 1.5rem" }}>Email</th>
              </tr>
            </thead>
            <tbody>
              {patients.map((p) => (
                <tr key={p.id} style={{ borderBottom: "1px solid #F1F5F9" }}>
                  <td style={{ padding: "1rem 1.5rem", fontWeight: 600, color: "#0F766E" }}>
                    {p.local_patient_code || `#PAT-${p.id}`}
                  </td>
                  <td style={{ padding: "1rem 1.5rem", fontWeight: 500, color: "#0F172A" }}>
                    {p.full_name}
                  </td>
                  <td style={{ padding: "1rem 1.5rem", color: "#64748B" }}>
                    {p.date_of_birth ? new Date(p.date_of_birth).toLocaleDateString() : "—"}
                  </td>
                  <td style={{ padding: "1rem 1.5rem", textTransform: "capitalize" }}>
                    <Badge variant="neutral">{p.sex || "unknown"}</Badge>
                  </td>
                  <td style={{ padding: "1rem 1.5rem", color: "#475569" }}>
                    {p.phone || "—"}
                  </td>
                  <td style={{ padding: "1rem 1.5rem", color: "#475569" }}>
                    {p.email || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Patient Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Register New Patient"
      >
        <form onSubmit={handleCreatePatient} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <Input
            label="Full Name"
            required
            value={formData.fullName}
            onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
            placeholder="e.g., Sunita Verma"
          />

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            <Input
              label="Date of Birth"
              type="date"
              required
              value={formData.dateOfBirth}
              onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
            />

            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <label style={{ fontSize: "0.875rem", fontWeight: 500 }}>Sex</label>
              <select
                value={formData.sex}
                onChange={(e) => setFormData({ ...formData, sex: e.target.value })}
                style={{
                  height: "40px",
                  borderRadius: "8px",
                  border: "1px solid #E2E8F0",
                  padding: "0 8px",
                  fontSize: "0.875rem",
                  backgroundColor: "#FFFFFF",
                }}
              >
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="intersex">Intersex</option>
                <option value="unknown">Unknown</option>
              </select>
            </div>
          </div>

          <Input
            label="Local Patient Identifier (Optional)"
            placeholder="e.g., LAB-2026-001"
            value={formData.localPatientCode}
            onChange={(e) => setFormData({ ...formData, localPatientCode: e.target.value })}
            helperText="Custom internal code used by your laboratory."
          />

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            <Input
              label="Contact Phone"
              type="tel"
              placeholder="9876543210"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            />

            <Input
              label="Patient Email (For Report Access)"
              type="email"
              placeholder="patient@example.com"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "1rem" }}>
            <Button variant="outline" size="md" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="md" type="submit" isLoading={isSubmitting}>
              Save Patient
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
