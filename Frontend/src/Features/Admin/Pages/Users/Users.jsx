import React, { useState, useEffect } from "react";
import { Users as UsersIcon, Search, AlertCircle, ShieldCheck, Trash2 } from "lucide-react";
import Button from "../../../../Shared/Component/Button/Button";
import Input from "../../../../Shared/Component/Input/Input";
import Modal from "../../../../Shared/Component/Modal/Modal";
import Loader from "../../../../Shared/Component/Loader/Loader";
import Badge from "../../../../Shared/Component/Badge/Badge";
import { useToast } from "../../../../Shared/Context/ToastContext";
import { adminService } from "../../services/admin.service";

export default function Users() {
  const [users, setUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedUserForDelete, setSelectedUserForDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const toast = useToast();

  const loadUsers = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await adminService.getUsers({ search: searchTerm });
      setUsers(res?.data || []);
    } catch (err) {
      setError(err.message || "Failed to load platform users");
      setUsers([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, [searchTerm]);

  const handleToggleStatus = async (userId, currentStatus) => {
    const nextStatus = currentStatus === "active" ? "suspended" : "active";
    try {
      await adminService.updateUserStatus(userId, {
        status: nextStatus,
        reason: "Administrative status update from console",
      });
      toast.success(`User status updated to ${nextStatus}.`);
      loadUsers();
    } catch (err) {
      toast.error(err.message || "Failed to update user status");
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUserForDelete) return;

    setIsDeleting(true);
    try {
      await adminService.deleteUser(selectedUserForDelete.id);
      toast.success(`User account "${selectedUserForDelete.email}" permanently deleted.`);
      setDeleteModalOpen(false);
      setSelectedUserForDelete(null);
      loadUsers();
    } catch (err) {
      toast.error(err.message || "Failed to delete user account");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div style={{ maxWidth: "1200px" }}>
      {/* Header */}
      <div style={{ marginBottom: "2rem" }}>
        <h1 style={{ fontSize: "1.75rem", marginBottom: "0.25rem" }}>Platform User Accounts</h1>
        <p style={{ color: "#64748B", fontSize: "0.875rem" }}>
          Manage user accounts, roles, and authorization status across the network.
        </p>
      </div>

      {/* Search */}
      <div style={{ maxWidth: "420px", marginBottom: "1.5rem" }}>
        <Input
          placeholder="Search by name, email, or phone..."
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
        <Loader text="Loading user accounts..." />
      ) : users.length === 0 ? (
        <div style={{ textAlign: "center", padding: "4rem 2rem", backgroundColor: "#FFFFFF", borderRadius: "16px", border: "1px solid #E2E8F0" }}>
          <UsersIcon size={48} color="#94A3B8" style={{ margin: "0 auto 1rem" }} />
          <h3>No Users Found</h3>
          <p style={{ margin: "0.5rem auto 1.5rem", color: "#64748B" }}>
            No accounts match your search query.
          </p>
        </div>
      ) : (
        <div style={{ backgroundColor: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "16px", overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.875rem" }}>
            <thead>
              <tr style={{ backgroundColor: "#F8FAFC", borderBottom: "1px solid #E2E8F0", color: "#64748B" }}>
                <th style={{ padding: "1rem 1.5rem" }}>User</th>
                <th style={{ padding: "1rem 1.5rem" }}>Role</th>
                <th style={{ padding: "1rem 1.5rem" }}>Phone</th>
                <th style={{ padding: "1rem 1.5rem" }}>Email Verified</th>
                <th style={{ padding: "1rem 1.5rem" }}>Status</th>
                <th style={{ padding: "1rem 1.5rem" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} style={{ borderBottom: "1px solid #F1F5F9" }}>
                  <td style={{ padding: "1rem 1.5rem" }}>
                    <div style={{ fontWeight: 600, color: "#0F172A" }}>{u.full_name}</div>
                    <div style={{ fontSize: "0.75rem", color: "#64748B" }}>{u.email}</div>
                  </td>
                  <td style={{ padding: "1rem 1.5rem" }}>
                    <Badge variant={u.role === "admin" ? "danger" : u.role === "lab" ? "primary" : "secondary"}>
                      {u.role}
                    </Badge>
                  </td>
                  <td style={{ padding: "1rem 1.5rem", color: "#475569" }}>
                    {u.phone || "—"}
                  </td>
                  <td style={{ padding: "1rem 1.5rem" }}>
                    <Badge variant={u.email_verified ? "success" : "neutral"}>
                      {u.email_verified ? "Verified" : "Unverified"}
                    </Badge>
                  </td>
                  <td style={{ padding: "1rem 1.5rem" }}>
                    <Badge variant={u.account_status === "active" ? "success" : "danger"}>
                      {u.account_status}
                    </Badge>
                  </td>
                  <td style={{ padding: "1rem 1.5rem" }}>
                    {u.role !== "admin" && (
                      <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                        <Button
                          variant={u.account_status === "active" ? "danger" : "primary"}
                          size="sm"
                          onClick={() => handleToggleStatus(u.id, u.account_status)}
                        >
                          {u.account_status === "active" ? "Suspend" : "Activate"}
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          icon={Trash2}
                          onClick={() => {
                            setSelectedUserForDelete(u);
                            setDeleteModalOpen(true);
                          }}
                        >
                          Delete
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Delete User Confirmation Modal */}
      <Modal
        isOpen={deleteModalOpen}
        onClose={() => !isDeleting && setDeleteModalOpen(false)}
        title="Delete Platform User Account"
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <p style={{ fontSize: "0.875rem", color: "#475569", lineHeight: "1.5" }}>
            Are you sure you want to permanently delete user account <strong>{selectedUserForDelete?.full_name}</strong> ({selectedUserForDelete?.email})?
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
            <strong>Warning:</strong> This will permanently delete the user's login credentials, active sessions, and verification records from the database. This action cannot be undone.
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
              onClick={handleDeleteUser}
            >
              Delete User
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
