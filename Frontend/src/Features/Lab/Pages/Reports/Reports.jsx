import React, { useState, useEffect } from "react";
import { FileText, Plus, CheckCircle, RotateCcw, AlertCircle, Upload, Eye } from "lucide-react";
import Button from "../../../../Shared/Component/Button/Button";
import Input from "../../../../Shared/Component/Input/Input";
import Modal from "../../../../Shared/Component/Modal/Modal";
import Loader from "../../../../Shared/Component/Loader/Loader";
import Badge from "../../../../Shared/Component/Badge/Badge";
import { labOwnerService } from "../../services/lab.service";

export default function Reports() {
  const [reports, setReports] = useState([]);
  const [orders, setOrders] = useState([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [correctModalOpen, setCorrectModalOpen] = useState(false);
  const [selectedReportId, setSelectedReportId] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Upload Draft Form State
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [reportTitle, setReportTitle] = useState("");
  const [base64File, setBase64File] = useState("");
  const [filename, setFilename] = useState("");

  // Correction Form State
  const [correctionReason, setCorrectionReason] = useState("");

  const loadReports = async (status = "") => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await labOwnerService.getReports({ status });
      setReports(res?.data || []);
    } catch (err) {
      setError(err.message || "Failed to load reports");
      setReports([]);
    } finally {
      setIsLoading(false);
    }
  };

  const loadOrders = async () => {
    try {
      const res = await labOwnerService.getOrders();
      setOrders(res?.data || []);
      if (res?.data?.length > 0) {
        setSelectedOrderId(res.data[0].id);
      }
    } catch (_) {}
  };

  useEffect(() => {
    loadReports(statusFilter);
    loadOrders();
  }, [statusFilter]);

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setFilename(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      setBase64File(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleCreateReport = async (e) => {
    e.preventDefault();
    if (!selectedOrderId || !base64File) {
      setError("Please select an order and choose a PDF file to upload");
      return;
    }

    const order = orders.find((o) => String(o.id) === String(selectedOrderId));
    if (!order) return;

    setIsSubmitting(true);
    setError(null);

    try {
      await labOwnerService.createReport({
        orderId: Number(selectedOrderId),
        patientId: order.patient_id,
        fileData: base64File,
        filename: filename || "report.pdf",
        mimeType: "application/pdf",
      });

      setCreateModalOpen(false);
      setBase64File("");
      setFilename("");
      loadReports(statusFilter);
    } catch (err) {
      setError(err.message || "Failed to create draft report");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePublish = async (reportId) => {
    try {
      await labOwnerService.publishReport(reportId);
      loadReports(statusFilter);
    } catch (err) {
      setError(err.message || "Failed to publish report");
    }
  };

  const handleCorrectReport = async (e) => {
    e.preventDefault();
    if (!selectedReportId || !correctionReason || !base64File) return;

    setIsSubmitting(true);
    setError(null);

    try {
      await labOwnerService.correctReport(selectedReportId, {
        fileData: base64File,
        filename: filename || "corrected_report.pdf",
        reason: correctionReason,
      });

      setCorrectModalOpen(false);
      setCorrectionReason("");
      setBase64File("");
      setFilename("");
      loadReports(statusFilter);
    } catch (err) {
      setError(err.message || "Failed to submit report correction");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: "1200px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "2rem", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <h1 style={{ fontSize: "1.75rem", marginBottom: "0.25rem" }}>Medical Reports Management</h1>
          <p style={{ color: "#64748B", fontSize: "0.875rem" }}>
            Upload draft pathology findings, publish verified reports, and manage corrections.
          </p>
        </div>

        <Button
          variant="primary"
          size="md"
          icon={Plus}
          onClick={() => setCreateModalOpen(true)}
        >
          Upload Draft Report
        </Button>
      </div>

      {/* Filter Tabs */}
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem" }}>
        {["", "draft", "published", "corrected"].map((st) => (
          <button
            key={st}
            type="button"
            onClick={() => setStatusFilter(st)}
            style={{
              padding: "6px 14px",
              borderRadius: "8px",
              fontSize: "0.875rem",
              fontWeight: 500,
              border: "1px solid",
              borderColor: statusFilter === st ? "#0F766E" : "#E2E8F0",
              backgroundColor: statusFilter === st ? "#CCFBF1" : "#FFFFFF",
              color: statusFilter === st ? "#0F766E" : "#475569",
              cursor: "pointer",
            }}
          >
            {st ? st.charAt(0).toUpperCase() + st.slice(1) : "All Reports"}
          </button>
        ))}
      </div>

      {error && (
        <div style={{ padding: "1rem", backgroundColor: "#FEE2E2", color: "#DC2626", borderRadius: "8px", marginBottom: "1rem" }}>
          {error}
        </div>
      )}

      {/* Reports Table */}
      {isLoading ? (
        <Loader text="Loading reports..." />
      ) : reports.length === 0 ? (
        <div style={{ textAlign: "center", padding: "4rem 2rem", backgroundColor: "#FFFFFF", borderRadius: "16px", border: "1px solid #E2E8F0" }}>
          <FileText size={48} color="#94A3B8" style={{ margin: "0 auto 1rem" }} />
          <h3>No Reports Uploaded</h3>
          <p style={{ margin: "0.5rem auto 1.5rem", color: "#64748B", maxWidth: "380px" }}>
            Upload a PDF diagnostic finding for a completed test order.
          </p>
          <Button variant="primary" size="sm" icon={Plus} onClick={() => setCreateModalOpen(true)}>
            Upload Report
          </Button>
        </div>
      ) : (
        <div style={{ backgroundColor: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "16px", overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.875rem" }}>
            <thead>
              <tr style={{ backgroundColor: "#F8FAFC", borderBottom: "1px solid #E2E8F0", color: "#64748B" }}>
                <th style={{ padding: "1rem 1.5rem" }}>Report ID</th>
                <th style={{ padding: "1rem 1.5rem" }}>Patient</th>
                <th style={{ padding: "1rem 1.5rem" }}>Filename</th>
                <th style={{ padding: "1rem 1.5rem" }}>Status</th>
                <th style={{ padding: "1rem 1.5rem" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((r) => (
                <tr key={r.id} style={{ borderBottom: "1px solid #F1F5F9" }}>
                  <td style={{ padding: "1rem 1.5rem", fontWeight: 600, color: "#0F766E" }}>
                    #REP-{r.id}
                  </td>
                  <td style={{ padding: "1rem 1.5rem", fontWeight: 500, color: "#0F172A" }}>
                    {r.patient_name || `Patient #${r.patient_id}`}
                  </td>
                  <td style={{ padding: "1rem 1.5rem", color: "#64748B" }}>
                    {r.original_filename || "medical_report.pdf"}
                  </td>
                  <td style={{ padding: "1rem 1.5rem" }}>
                    <Badge variant={r.status === "published" ? "success" : r.status === "corrected" ? "secondary" : "warning"}>
                      {r.status}
                    </Badge>
                  </td>
                  <td style={{ padding: "1rem 1.5rem" }}>
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      {r.status === "draft" && (
                        <Button
                          variant="primary"
                          size="sm"
                          icon={CheckCircle}
                          onClick={() => handlePublish(r.id)}
                        >
                          Publish
                        </Button>
                      )}
                      {r.status === "published" && (
                        <Button
                          variant="outline"
                          size="sm"
                          icon={RotateCcw}
                          onClick={() => {
                            setSelectedReportId(r.id);
                            setCorrectModalOpen(true);
                          }}
                        >
                          Correct
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Upload Draft Report Modal */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Upload Draft Medical Report"
      >
        <form onSubmit={handleCreateReport} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <label style={{ fontSize: "0.875rem", fontWeight: 500 }}>Select Patient Order</label>
            <select
              value={selectedOrderId}
              onChange={(e) => setSelectedOrderId(e.target.value)}
              style={{
                height: "40px",
                borderRadius: "8px",
                border: "1px solid #E2E8F0",
                padding: "0 8px",
                fontSize: "0.875rem",
                backgroundColor: "#FFFFFF",
              }}
              required
            >
              {orders.map((o) => (
                <option key={o.id} value={o.id}>
                  #ORD-{o.id} — {o.patient_name || `Patient #${o.patient_id}`}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <label style={{ fontSize: "0.875rem", fontWeight: 500 }}>Upload PDF Document</label>
            <input
              type="file"
              accept=".pdf"
              required
              onChange={handleFileUpload}
              style={{
                padding: "8px",
                borderRadius: "8px",
                border: "1px solid #E2E8F0",
                fontSize: "0.875rem",
              }}
            />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "1rem" }}>
            <Button variant="outline" size="md" onClick={() => setCreateModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="md" type="submit" isLoading={isSubmitting}>
              Upload as Draft
            </Button>
          </div>
        </form>
      </Modal>

      {/* Correct Report Modal */}
      <Modal
        isOpen={correctModalOpen}
        onClose={() => setCorrectModalOpen(false)}
        title="Upload Corrected Report Version"
      >
        <form onSubmit={handleCorrectReport} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <Input
            label="Reason for Correction"
            placeholder="e.g., Physician updated reference calibration interval"
            required
            value={correctionReason}
            onChange={(e) => setCorrectionReason(e.target.value)}
          />

          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <label style={{ fontSize: "0.875rem", fontWeight: 500 }}>Upload Revised PDF Document</label>
            <input
              type="file"
              accept=".pdf"
              required
              onChange={handleFileUpload}
              style={{
                padding: "8px",
                borderRadius: "8px",
                border: "1px solid #E2E8F0",
                fontSize: "0.875rem",
              }}
            />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "1rem" }}>
            <Button variant="outline" size="md" onClick={() => setCorrectModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="md" type="submit" isLoading={isSubmitting}>
              Submit Correction
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
