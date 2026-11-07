import React, { useState, useEffect } from "react";
import { CreditCard, Plus, ShieldCheck } from "lucide-react";
import Button from "../../../../Shared/Component/Button/Button";
import Badge from "../../../../Shared/Component/Badge/Badge";
import Loader from "../../../../Shared/Component/Loader/Loader";
import apiClient from "../../../../Core/http/api.client";

export default function Subscriptions() {
  const [plans, setPlans] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadPlans() {
      try {
        const res = await apiClient.get("/subscriptions/plans");
        setPlans(res?.data || []);
      } catch (_) {
        setPlans([]);
      } finally {
        setIsLoading(false);
      }
    }
    loadPlans();
  }, []);

  return (
    <div style={{ maxWidth: "1200px" }}>
      <div style={{ marginBottom: "2rem" }}>
        <h1 style={{ fontSize: "1.75rem", marginBottom: "0.25rem" }}>Platform Subscription Tiers</h1>
        <p style={{ color: "#64748B", fontSize: "0.875rem" }}>
          Subscription tiers governing laboratory portal feature limits and automated calculation access.
        </p>
      </div>

      {isLoading ? (
        <Loader text="Loading subscription tiers..." />
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: "1.5rem",
          }}
        >
          {plans.map((p) => (
            <div
              key={p.id}
              style={{
                backgroundColor: "#FFFFFF",
                border: "1px solid #E2E8F0",
                borderRadius: "16px",
                padding: "2rem",
                display: "flex",
                flexDirection: "column",
                gap: "1rem",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h3 style={{ fontSize: "1.25rem", fontWeight: 700 }}>{p.name}</h3>
                <Badge variant="success">Active Plan</Badge>
              </div>
              <p style={{ fontSize: "0.875rem", color: "#64748B" }}>{p.description}</p>
              <div style={{ fontSize: "2rem", fontWeight: 800, color: "#0F172A", marginTop: "auto" }}>
                ₹{p.price} <span style={{ fontSize: "0.875rem", color: "#64748B", fontWeight: 400 }}>/{p.billing_interval}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
