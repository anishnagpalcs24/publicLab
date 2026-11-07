import React, { useState, useEffect } from "react";
import { CreditCard, Check, ShieldCheck, AlertCircle } from "lucide-react";
import Button from "../../../../Shared/Component/Button/Button";
import Badge from "../../../../Shared/Component/Badge/Badge";
import Loader from "../../../../Shared/Component/Loader/Loader";
import { labOwnerService } from "../../services/lab.service";

export default function Subscription() {
  const [plans, setPlans] = useState([]);
  const [mySubscription, setMySubscription] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isSubscribing, setIsSubscribing] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [plansRes, mySubRes] = await Promise.allSettled([
        labOwnerService.getSubscriptionPlans(),
        labOwnerService.getMySubscriptions(),
      ]);

      if (plansRes.status === "fulfilled") {
        setPlans(plansRes.value?.data || []);
      }
      if (mySubRes.status === "fulfilled") {
        const subs = mySubRes.value?.data || [];
        setMySubscription(subs.length > 0 ? subs[0] : null);
      }
    } catch (err) {
      setError(err.message || "Failed to load subscription plans");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSubscribe = async (planId) => {
    setIsSubscribing(true);
    setError(null);
    try {
      await labOwnerService.createSubscription(planId);
      loadData();
    } catch (err) {
      setError(err.message || "Could not activate subscription");
    } finally {
      setIsSubscribing(false);
    }
  };

  if (isLoading) {
    return <Loader text="Loading subscription details..." />;
  }

  return (
    <div style={{ maxWidth: "1200px" }}>
      {/* Header */}
      <div style={{ marginBottom: "2.5rem" }}>
        <h1 style={{ fontSize: "1.75rem", marginBottom: "0.25rem" }}>Laboratory Subscription Plans</h1>
        <p style={{ color: "#64748B", fontSize: "0.875rem" }}>
          Manage your pathology laboratory operational tier, reporting volume, and digital features.
        </p>
      </div>

      {error && (
        <div style={{ padding: "1rem", backgroundColor: "#FEE2E2", color: "#DC2626", borderRadius: "8px", marginBottom: "1.5rem" }}>
          {error}
        </div>
      )}

      {/* Active Subscription Banner if exists */}
      {mySubscription && (
        <div
          style={{
            backgroundColor: "#CCFBF1",
            border: "1px solid #99F6E4",
            borderRadius: "16px",
            padding: "1.5rem",
            marginBottom: "2rem",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "1rem",
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <ShieldCheck size={20} color="#0F766E" />
              <h3 style={{ fontSize: "1.125rem", color: "#0F766E", fontWeight: 600 }}>Active Facility Subscription</h3>
            </div>
            <p style={{ fontSize: "0.875rem", color: "#115E59", marginTop: "0.25rem" }}>
              Status: <strong style={{ textTransform: "capitalize" }}>{mySubscription.status}</strong> | Billing Interval: {mySubscription.billing_interval || "Monthly"}
            </p>
          </div>
          <Badge variant="success">Active</Badge>
        </div>
      )}

      {/* Plans Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: "1.5rem",
        }}
      >
        {plans.length === 0 ? (
          <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: "3rem", backgroundColor: "#FFFFFF", borderRadius: "16px", border: "1px solid #E2E8F0" }}>
            <CreditCard size={40} color="#94A3B8" style={{ margin: "0 auto 1rem" }} />
            <h4>Subscription Plans Active on Backend</h4>
            <p style={{ color: "#64748B", fontSize: "0.875rem", marginTop: "0.25rem" }}>
              Standard diagnostic tier active. Unlimited report upload and OTP access included.
            </p>
          </div>
        ) : (
          plans.map((p) => (
            <div
              key={p.id}
              style={{
                backgroundColor: "#FFFFFF",
                border: "1px solid #E2E8F0",
                borderRadius: "16px",
                padding: "2rem",
                display: "flex",
                flexDirection: "column",
                gap: "1.5rem",
                boxShadow: "0 1px 3px rgba(15, 23, 42, 0.05)",
              }}
            >
              <div>
                <h3 style={{ fontSize: "1.25rem", fontWeight: 700 }}>{p.name}</h3>
                <p style={{ fontSize: "0.875rem", color: "#64748B", marginTop: "0.25rem" }}>{p.description}</p>
              </div>

              <div style={{ fontSize: "2rem", fontWeight: 800, color: "#0F172A" }}>
                ₹{p.price} <span style={{ fontSize: "0.875rem", color: "#64748B", fontWeight: 400 }}>/{p.billing_interval}</span>
              </div>

              <Button
                variant={mySubscription?.plan_id === p.id ? "outline" : "primary"}
                fullWidth
                isLoading={isSubscribing}
                onClick={() => handleSubscribe(p.id)}
                disabled={mySubscription?.plan_id === p.id}
              >
                {mySubscription?.plan_id === p.id ? "Current Plan" : "Select Plan"}
              </Button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
