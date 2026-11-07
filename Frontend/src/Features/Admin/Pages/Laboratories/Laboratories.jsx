import React, { useState, useEffect } from "react";
import { Building2, Search, ShieldCheck, ShieldAlert, AlertCircle, Trash2 } from "lucide-react";
import Button from "../../../../Shared/Component/Button/Button";
import Input from "../../../../Shared/Component/Input/Input";
import Modal from "../../../../Shared/Component/Modal/Modal";
import Loader from "../../../../Shared/Component/Loader/Loader";
import Badge from "../../../../Shared/Component/Badge/Badge";
import { useToast } from "../../../../Shared/Context/ToastContext";
import { adminService } from "../../services/admin.service";

export default function Laboratories() {
  const [labs, setLabs] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [suspendModalOpen, setSuspendModalOpen] = useState(false);
  const [selectedLab, setSelectedLab] = useState(null);
  const [suspendReason, setSuspendReason] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  // Lab deletion state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedLabForDelete, setSelectedLabForDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const toast = useToast();

  const loadLabs = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await adminService.getLabApplications({ search: searchTerm });
      setLabs(res?.data || []);
    } catch (err) {
      setError(err.message || "Failed to load laboratories");
      setLabs([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadLabs();
  }, [searchTerm]);

  const handleSuspend = async (e) => {
    e.preventDefault();
    if (!selectedLab || !suspendReason.trim()) return;

    setIsProcessing(true);
    try {
      await adminService.suspendLab(selectedLab.id, suspendReason.trim());
      setSuspendModalOpen(false);
      setSuspendReason("");
      setSelectedLab(null);
      loadLabs();
    } catch (err) {
      setError(err.message || "Failed to suspend laboratory");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedLabForDelete) return;

    setIsDeleting(true);
    try {
      await adminService.deleteLab(selectedLabForDelete.id);
      toast.success(`Laboratory "${selectedLabForDelete.name}" permanently deleted.`);
      setDeleteModalOpen(false);
      setSelectedLabForDelete(null);
      loadLabs();
    } catch (err) {
      toast.error(err.message || "Failed to delete laboratory");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div style={{ maxWidth: "1200px" }}>
      {/* Header */}
      <div style={{ marginBottom: "2rem" }}>
        <h1 style={{ fontSize: "1.75rem", marginBottom: "0.25rem" }}>Registered Laboratories</h1>
        <p style={{ color: "#64748B", fontSize: "0.875rem" }}>
          Platform directory of registered pathology centers and compliance oversight.
        </p>
      </div>

      {/* Search */}
      <div style={{ maxWidth: "420px", marginBottom: "1.5rem" }}>
        <Input
          placeholder="Search by lab name, license, or city..."
          prefixIcon={Search}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {error && (
        <div style={{ padding: "1rem", backgroundColor: "#FEE2E2", color: "#DC2626", borderRadius: "8px", marginBottom: "1.5rem" }}>
          {error}
        </div>
      )}

      {isLoading ? (
        <Loader text="Loading laboratories..." />
      ) : labs.length === 0 ? (
        <div style={{ textAlign: "center", padding: "4rem 2rem", backgroundColor: "#FFFFFF", borderRadius: "16px", border: "1px solid #E2E8F0" }}>
          <Building2 size={48} color="#94A3B8" style={{ margin: "0 auto 1rem" }} />
          <h3>No Facilities Found</h3>
          <p style={{ margin: "0.5rem auto 1.5rem", color: "#64748B" }}>
            No registered laboratory matches your search query.
          </p>
        </div>
      ) : (
        <div style={{ backgroundColor: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "16px", overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.875rem" }}>
            <thead>
              <tr style={{ backgroundColor: "#F8FAFC", borderBottom: "1px solid #E2E8F0", color: "#64748B" }}>
                <th style={{ padding: "1rem 1.5rem" }}>Laboratory</th>
                <th style={{ padding: "1rem 1.5rem" }}>Location</th>
                <th style={{ padding: "1rem 1.5rem" }}>License Number</th>
                <th style={{ padding: "1rem 1.5rem" }}>Status</th>
                <th style={{ padding: "1rem 1.5rem" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {labs.map((l) => (
                <tr key={l.id} style={{ borderBottom: "1px solid #F1F5F9" }}>
                  <td style={{ padding: "1rem 1.5rem" }}>
                    <div style={{ fontWeight: 600, color: "#0F172A" }}>{l.name}</div>
                    <div style={{ fontSize: "0.75rem", color: "#64748B" }}>{l.email}</div>
                  </td>
                  <td style={{ padding: "1rem 1.5rem", color: "#475569" }}>
                    {l.city || "—"}
                  </td>
                  <td style={{ padding: "1rem 1.5rem", color: "#0F766E", fontWeight: 500 }}>
                    {l.license_number || l.licenseNumber || "NABL Verified"}
                  </td>
                  <td style={{ padding: "1rem 1.5rem" }}>
                    <Badge variant={l.approval_status === "approved" ? "success" : l.approval_status === "suspended" ? "danger" : "warning"}>
                      {l.approval_status}
                    </Badge>
                  </td>
                  <td style={{ padding: "1rem 1.5rem" }}>
                    <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                      {l.approval_status === "approved" && (
                        <Button
                          variant="outline"
                          size="sm"
                          icon={ShieldAlert}
                          onClick={() => {
                            setSelectedLab(l);
                            setSuspendModalOpen(true);
                          }}
                        >
                          Suspend
                        </Button>
                      )}
                      <Button
                        variant="danger"
                        size="sm"
                        icon={Trash2}
                        onClick={() => {
                          setSelectedLabForDelete(l);
                          setDeleteModalOpen(true);
                        }}
                      >
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Suspend Modal */}
      <Modal
        isOpen={suspendModalOpen}
        onClose={() => setSuspendModalOpen(false)}
        title="Suspend Diagnostic Laboratory"
      >
        <form onSubmit={handleSuspend} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <p style={{ fontSize: "0.875rem", color: "#64748B" }}>
            Suspending <strong>{selectedLab?.name}</strong> will hide the facility from public search
            and temporarily prevent publishing of new reports until compliance is restored.
          </p>

          <Input
            label="Suspension Reason"
            required
            placeholder="e.g., Clinical audit pending re-inspection"
            value={suspendReason}
            onChange={(e) => setSuspendReason(e.target.value)}
          />

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "1rem" }}>
            <Button variant="outline" size="md" onClick={() => setSuspendModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" size="md" type="submit" isLoading={isProcessing}>
              Confirm Suspension
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deleteModalOpen}
        onClose={() => !isDeleting && setDeleteModalOpen(false)}
        title="Delete Laboratory Permanently"
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <p style={{ fontSize: "0.875rem", color: "#475569", lineHeight: "1.5" }}>
            Are you sure you want to permanently delete <strong>{selectedLabForDelete?.name}</strong>?
          </p>
          <div
            style={{
              padding: "0.875rem 1rem",
              backgroundColor: "#FEF2F2",
              border: "1px solid #FEE2E2",
              borderRadius: "8px",
              color: "#991B1B",
              fontSize: "0.8125rem",
              lineHeight: "1.4",
            }}
          >
            <strong>Warning:</strong> This will permanently delete the laboratory, its user linkages, reports, orders, callbacks, and calculations from the database. This action cannot be undone.
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "1rem" }}>
            <Button
              variant="outline"
              size="md"
              disabled={isDeleting}
              onClick={() => setDeleteModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="md"
              icon={Trash2}
              isLoading={isDeleting}
              onClick={handleDelete}
            >
              Delete Laboratory
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
