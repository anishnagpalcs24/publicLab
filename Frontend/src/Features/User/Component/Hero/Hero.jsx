import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  MapPin,
  ShieldCheck,
  FileCheck,
  Clock,
  ArrowRight,
  Sparkles,
  Lock,
} from "lucide-react";
import Button from "../../../../Shared/Component/Button/Button";
import Badge from "../../../../Shared/Component/Badge/Badge";
import { useUser } from "../../state/user.context";
import "./Hero.scss";

export default function Hero() {
  const [cityInput, setCityInput] = useState("");
  const { setSelectedCity } = useUser();
  const navigate = useNavigate();

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (cityInput.trim()) {
      setSelectedCity(cityInput.trim());
      navigate(`/labs?city=${encodeURIComponent(cityInput.trim())}`);
    } else {
      navigate("/labs");
    }
  };

  return (
    <section className="pl-hero">
      <div className="pl-hero__container">
        {/* Left Column: Heading & Controls */}
        <div className="pl-hero__content">
          <div className="pl-hero__badge">
            <Sparkles size={14} />
            <span>NABL-Accredited Diagnostic Network</span>
          </div>

          <h1 className="pl-hero__title">
            Your Health Records. Your Trusted Labs. <span>All in One Place.</span>
          </h1>

          <p className="pl-hero__desc">
            Discover trusted diagnostic laboratories, explore tests, and securely access your medical
            reports through PublicLab — with single-use email verification and zero password friction.
          </p>

          {/* City / Location Search Bar */}
          <form className="pl-hero__search-bar" onSubmit={handleSearchSubmit}>
            <div className="pl-hero__search-bar-input">
              <MapPin size={20} />
              <input
                type="text"
                placeholder="Enter your city (e.g., Mumbai, Delhi, Bengaluru)..."
                value={cityInput}
                onChange={(e) => setCityInput(e.target.value)}
                aria-label="Search diagnostic laboratories by city"
              />
            </div>
            <Button type="submit" variant="primary" size="md" icon={Search}>
              Find Labs
            </Button>
          </form>

          {/* Primary CTA Group */}
          <div className="pl-hero__cta-group">
            <Button
              variant="primary"
              size="lg"
              icon={Search}
              onClick={() => navigate("/labs")}
            >
              Find Diagnostic Labs
            </Button>
            <Button
              variant="outline"
              size="lg"
              icon={FileCheck}
              onClick={() => navigate("/reports")}
            >
              Check My Reports
            </Button>
          </div>

          {/* Trust Guarantees */}
          <div className="pl-hero__features-row">
            <div className="pl-hero__features-row-item">
              <ShieldCheck size={16} />
              <span>Verified Clinical Licenses</span>
            </div>
            <div className="pl-hero__features-row-item">
              <Lock size={16} />
              <span>Passwordless OTP Security</span>
            </div>
            <div className="pl-hero__features-row-item">
              <Clock size={16} />
              <span>Prompt Callback Support</span>
            </div>
          </div>
        </div>

        {/* Right Column: Healthcare SaaS Visual Preview */}
        <div className="pl-hero__visual">
          <div className="pl-hero__card-stack">
            <div className="pl-hero__card-header">
              <h4>
                <ShieldCheck size={18} color="#0F766E" />
                Verified Diagnostic Gateway
              </h4>
              <Badge variant="success">Active Network</Badge>
            </div>

            <div className="pl-hero__card-row">
              <div className="pl-hero__card-row-left">
                <div className="icon">
                  <FileCheck size={18} />
                </div>
                <div className="text">
                  <div style={{ fontWeight: 600 }}>Biochemistry & Hematology</div>
                  <small style={{ color: "#64748B" }}>Ready for instant OTP access</small>
                </div>
              </div>
              <div className="pl-hero__card-row-status">Verified</div>
            </div>

            <div className="pl-hero__card-row">
              <div className="pl-hero__card-row-left">
                <div className="icon">
                  <Clock size={18} />
                </div>
                <div className="text">
                  <div style={{ fontWeight: 600 }}>Sample Home Collection</div>
                  <small style={{ color: "#64748B" }}>Available across tier 1 & 2 cities</small>
                </div>
              </div>
              <div className="pl-hero__card-row-status" style={{ color: "#2563EB" }}>
                Active
              </div>
            </div>

            <div className="pl-hero__card-row">
              <div className="pl-hero__card-row-left">
                <div className="icon">
                  <Lock size={18} />
                </div>
                <div className="text">
                  <div style={{ fontWeight: 600 }}>Direct Patient Delivery</div>
                  <small style={{ color: "#64748B" }}>Digitally signed PDF report</small>
                </div>
              </div>
              <div className="pl-hero__card-row-status">Encrypted</div>
            </div>

            <Button
              variant="outline"
              size="sm"
              fullWidth
              icon={ArrowRight}
              iconPosition="right"
              onClick={() => navigate("/reports")}
            >
              Access Previous Medical Reports
            </Button>
          </div>

          {/* Floating Pill */}
          <div className="pl-hero__badge-float">
            <div className="pl-hero__badge-float-icon">
              <ShieldCheck size={20} />
            </div>
            <div className="pl-hero__badge-float-info">
              <h5>Passwordless Access</h5>
              <p>Email + OTP report lookup</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
