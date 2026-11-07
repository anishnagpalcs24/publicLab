import React, { useState, useEffect } from "react";
import { ClipboardList, Plus, Search, AlertCircle, CheckCircle2 } from "lucide-react";
import Button from "../../../../Shared/Component/Button/Button";
import Input from "../../../../Shared/Component/Input/Input";
import Modal from "../../../../Shared/Component/Modal/Modal";
import Loader from "../../../../Shared/Component/Loader/Loader";
import Badge from "../../../../Shared/Component/Badge/Badge";
import { labOwnerService } from "../../services/lab.service";

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [patients, setPatients] = useState([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // New Order Form State
  const [selectedPatientId, setSelectedPatientId] = useState("");
  const [testName, setTestName] = useState("");
  const [testPrice, setTestPrice] = useState("");

  const loadOrders = async (status = "") => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await labOwnerService.getOrders({ status });
      setOrders(res?.data || []);
    } catch (err) {
      setError(err.message || "Failed to load orders");
      setOrders([]);
    } finally {
      setIsLoading(false);
    }
  };

  const loadPatients = async () => {
    try {
      const res = await labOwnerService.getPatients();
      setPatients(res?.data || []);
      if (res?.data?.length > 0) {
        setSelectedPatientId(res.data[0].id);
      }
    } catch (_) {}
  };

  useEffect(() => {
    loadOrders(statusFilter);
    loadPatients();
  }, [statusFilter]);

  const handleCreateOrder = async (e) => {
    e.preventDefault();
    if (!selectedPatientId || !testName || !testPrice) return;

    setIsSubmitting(true);
    setError(null);

    try {
      await labOwnerService.createOrder({
        patientId: Number(selectedPatientId),
        items: [
          {
            testId: 1, // standard test line
            quantity: 1,
            unitPrice: Number(testPrice),
            description: testName,
          },
        ],
      });

      setModalOpen(false);
      setTestName("");
      setTestPrice("");
      loadOrders(statusFilter);
    } catch (err) {
      setError(err.message || "Failed to create order");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateStatus = async (orderId, newStatus) => {
    try {
      await labOwnerService.updateOrderStatus(orderId, newStatus);
      loadOrders(statusFilter);
    } catch (err) {
      setError(err.message || "Failed to update order status");
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case "completed":
        return <Badge variant="success">Completed</Badge>;
      case "processing":
        return <Badge variant="primary">Processing</Badge>;
      case "confirmed":
        return <Badge variant="secondary">Confirmed</Badge>;
      case "cancelled":
        return <Badge variant="danger">Cancelled</Badge>;
      default:
        return <Badge variant="neutral">{status}</Badge>;
    }
  };

  return (
    <div style={{ maxWidth: "1200px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "2rem", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <h1 style={{ fontSize: "1.75rem", marginBottom: "0.25rem" }}>Diagnostic Test Orders</h1>
          <p style={{ color: "#64748B", fontSize: "0.875rem" }}>
            Track sample collection, testing workflow, and order completion.
          </p>
        </div>

        <Button
          variant="primary"
          size="md"
          icon={Plus}
          onClick={() => setModalOpen(true)}
        >
          Create New Order
        </Button>
      </div>

      {/* Filter Tabs */}
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
        {["", "created", "confirmed", "processing", "completed"].map((st) => (
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
            {st ? st.charAt(0).toUpperCase() + st.slice(1) : "All Orders"}
          </button>
        ))}
      </div>

      {error && (
        <div style={{ padding: "1rem", backgroundColor: "#FEE2E2", color: "#DC2626", borderRadius: "8px", marginBottom: "1rem" }}>
          {error}
        </div>
      )}

      {/* Orders Table */}
      {isLoading ? (
        <Loader text="Loading orders..." />
      ) : orders.length === 0 ? (
        <div style={{ textAlign: "center", padding: "4rem 2rem", backgroundColor: "#FFFFFF", borderRadius: "16px", border: "1px solid #E2E8F0" }}>
          <ClipboardList size={48} color="#94A3B8" style={{ margin: "0 auto 1rem" }} />
          <h3>No Orders Found</h3>
          <p style={{ margin: "0.5rem auto 1.5rem", color: "#64748B", maxWidth: "380px" }}>
            Create a test order for a registered patient to initiate diagnostic processing.
          </p>
          <Button variant="primary" size="sm" icon={Plus} onClick={() => setModalOpen(true)}>
            Create First Order
          </Button>
        </div>
      ) : (
        <div style={{ backgroundColor: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "16px", overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.875rem" }}>
            <thead>
              <tr style={{ backgroundColor: "#F8FAFC", borderBottom: "1px solid #E2E8F0", color: "#64748B" }}>
                <th style={{ padding: "1rem 1.5rem" }}>Order ID</th>
                <th style={{ padding: "1rem 1.5rem" }}>Patient</th>
                <th style={{ padding: "1rem 1.5rem" }}>Amount</th>
                <th style={{ padding: "1rem 1.5rem" }}>Status</th>
                <th style={{ padding: "1rem 1.5rem" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} style={{ borderBottom: "1px solid #F1F5F9" }}>
                  <td style={{ padding: "1rem 1.5rem", fontWeight: 600, color: "#0F766E" }}>
                    #ORD-{o.id}
                  </td>
                  <td style={{ padding: "1rem 1.5rem", fontWeight: 500, color: "#0F172A" }}>
                    {o.patient_name || `Patient #${o.patient_id}`}
                  </td>
                  <td style={{ padding: "1rem 1.5rem", color: "#0F172A", fontWeight: 600 }}>
                    ₹{o.total_amount || 0}
                  </td>
                  <td style={{ padding: "1rem 1.5rem" }}>
                    {getStatusBadge(o.order_status || o.status)}
                  </td>
                  <td style={{ padding: "1rem 1.5rem" }}>
                    <select
                      value={o.order_status || o.status}
                      onChange={(e) => handleUpdateStatus(o.id, e.target.value)}
                      style={{
                        padding: "4px 8px",
                        fontSize: "0.75rem",
                        borderRadius: "6px",
                        border: "1px solid #E2E8F0",
                        backgroundColor: "#FFFFFF",
                      }}
                    >
                      <option value="created">Created</option>
                      <option value="confirmed">Confirmed</option>
                      <option value="processing">Processing</option>
                      <option value="completed">Completed</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Order Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Create Diagnostic Order"
      >
        <form onSubmit={handleCreateOrder} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <label style={{ fontSize: "0.875rem", fontWeight: 500 }}>Select Patient</label>
            <select
              value={selectedPatientId}
              onChange={(e) => setSelectedPatientId(e.target.value)}
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
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name} ({p.local_patient_code || `#PAT-${p.id}`})
                </option>
              ))}
            </select>
          </div>

          <Input
            label="Test Name or Package"
            placeholder="e.g., Complete Blood Count (CBC) with ESR"
            required
            value={testName}
            onChange={(e) => setTestName(e.target.value)}
          />

          <Input
            label="Total Test Fee (₹)"
            type="number"
            placeholder="e.g., 450"
            required
            value={testPrice}
            onChange={(e) => setTestPrice(e.target.value)}
          />

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "1rem" }}>
            <Button variant="outline" size="md" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="md" type="submit" isLoading={isSubmitting}>
              Create Order
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
