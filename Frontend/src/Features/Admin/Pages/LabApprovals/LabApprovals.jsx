import React, { useState, useEffect } from "react";
import { CheckSquare, CheckCircle, XCircle, AlertCircle, Eye, ShieldCheck } from "lucide-react";
import Button from "../../../../Shared/Component/Button/Button";
import Input from "../../../../Shared/Component/Input/Input";
import Modal from "../../../../Shared/Component/Modal/Modal";
import Loader from "../../../../Shared/Component/Loader/Loader";
import Badge from "../../../../Shared/Component/Badge/Badge";
import { adminService } from "../../services/admin.service";
import { useAdmin } from "../../state/admin.context";

export default function LabApprovals() {
  const [applications, setApplications] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [selectedLab, setSelectedLab] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const { refreshAdmin } = useAdmin();

  const loadApplications = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await adminService.getLabApplications({ status: "pending" });
      setApplications(res?.data || []);
    } catch (err) {
      setError(err.message || "Failed to load laboratory applications");
      setApplications([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadApplications();
  }, []);

  const handleApprove = async (labId) => {
    setIsProcessing(true);
    setError(null);
    try {
      await adminService.reviewLabApplication(labId, { status: "approved" });
      loadApplications();
      refreshAdmin();
    } catch (err) {
      setError(err.message || "Failed to approve laboratory");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async (e) => {
    e.preventDefault();
    if (!selectedLab || !rejectReason.trim()) return;

    setIsProcessing(true);
    setError(null);
    try {
      await adminService.reviewLabApplication(selectedLab.id, {
        status: "rejected",
        reason: rejectReason.trim(),
      });
      setRejectModalOpen(false);
      setRejectReason("");
      setSelectedLab(null);
      loadApplications();
      refreshAdmin();
    } catch (err) {
      setError(err.message || "Failed to reject laboratory");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div style={{ maxWidth: "1200px" }}>
      {/* Header */}
      <div style={{ marginBottom: "2rem" }}>
        <h1 style={{ fontSize: "1.75rem", marginBottom: "0.25rem" }}>Laboratory Accreditation Approvals</h1>
        <p style={{ color: "#64748B", fontSize: "0.875rem" }}>
          Review pending facility registrations, clinical license documentation, and authorized owner credentials.
        </p>
      </div>

      {error && (
        <div style={{ padding: "1rem", backgroundColor: "#FEE2E2", color: "#DC2626", borderRadius: "8px", marginBottom: "1.5rem" }}>
          {error}
        </div>
      )}

      {isLoading ? (
        <Loader text="Loading pending applications..." />
      ) : applications.length === 0 ? (
        <div style={{ textAlign: "center", padding: "4rem 2rem", backgroundColor: "#FFFFFF", borderRadius: "16px", border: "1px solid #E2E8F0" }}>
          <CheckCircle size={48} color="#16A34A" style={{ margin: "0 auto 1rem" }} />
          <h3>Application Queue Clear</h3>
          <p style={{ margin: "0.5rem auto 1.5rem", color: "#64748B", maxWidth: "380px" }}>
            There are currently no diagnostic laboratory applications pending administrative review.
          </p>
          <Button variant="outline" size="sm" onClick={loadApplications}>
            Refresh Queue
          </Button>
        </div>
      ) : (
        <div style={{ backgroundColor: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "16px", overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.875rem" }}>
            <thead>
              <tr style={{ backgroundColor: "#F8FAFC", borderBottom: "1px solid #E2E8F0", color: "#64748B" }}>
                <th style={{ padding: "1rem 1.5rem" }}>Laboratory Name</th>
                <th style={{ padding: "1rem 1.5rem" }}>Owner / Doctor</th>
                <th style={{ padding: "1rem 1.5rem" }}>Location & City</th>
                <th style={{ padding: "1rem 1.5rem" }}>License Number</th>
                <th style={{ padding: "1rem 1.5rem" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {applications.map((app) => (
                <tr key={app.id} style={{ borderBottom: "1px solid #F1F5F9" }}>
                  <td style={{ padding: "1rem 1.5rem" }}>
                    <div style={{ fontWeight: 600, color: "#0F172A" }}>{app.name}</div>
                    <div style={{ fontSize: "0.75rem", color: "#64748B" }}>{app.email}</div>
                  </td>
                  <td style={{ padding: "1rem 1.5rem" }}>
                    <div style={{ fontWeight: 500 }}>{app.owner_name || app.ownerFullName || "Dr. Applicant"}</div>
                    <div style={{ fontSize: "0.75rem", color: "#64748B" }}>{app.owner_email || app.ownerEmail || app.phone}</div>
                  </td>
                  <td style={{ padding: "1rem 1.5rem", color: "#475569" }}>
                    {app.city || "Not provided"}
                  </td>
                  <td style={{ padding: "1rem 1.5rem", fontWeight: 600, color: "#0F766E" }}>
                    {app.license_number || app.licenseNumber || "NABL Verification Pending"}
                  </td>
                  <td style={{ padding: "1rem 1.5rem" }}>
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <Button
                        variant="primary"
                        size="sm"
                        icon={CheckCircle}
                        disabled={isProcessing}
                        onClick={() => handleApprove(app.id)}
                      >
                        Approve
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        icon={XCircle}
                        disabled={isProcessing}
                        onClick={() => {
                          setSelectedLab(app);
                          setRejectModalOpen(true);
                        }}
                      >
                        Reject
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Reject Application Modal */}
      <Modal
        isOpen={rejectModalOpen}
        onClose={() => setRejectModalOpen(false)}
        title="Reject Laboratory Application"
      >
        <form onSubmit={handleReject} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <p style={{ fontSize: "0.875rem", color: "#64748B" }}>
            Please state the regulatory or documentation reason for rejecting{" "}
            <strong>{selectedLab?.name}</strong>. This explanation will be visible to the facility owner.
          </p>

          <Input
            label="Rejection Reason"
            required
            placeholder="e.g., Incomplete state clinical establishment license copy"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
          />

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "1rem" }}>
            <Button variant="outline" size="md" onClick={() => setRejectModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" size="md" type="submit" isLoading={isProcessing}>
              Confirm Rejection
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
