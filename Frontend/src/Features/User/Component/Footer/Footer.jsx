import React from "react";
import { Link } from "react-router-dom";
import { Activity, ShieldCheck, Mail, MapPin, Lock, FileText } from "lucide-react";
import Badge from "../../../../Shared/Component/Badge/Badge";
import "./Footer.scss";

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="pl-footer">
      <div className="pl-footer__container">
        <div className="pl-footer__grid">
          {/* Brand Info */}
          <div className="pl-footer__brand">
            <div className="pl-footer__brand-logo">
              <Activity size={28} />
              <div>
                Public<span>Lab</span>
              </div>
            </div>
            <p className="pl-footer__brand-desc">
              Next-generation diagnostic laboratory network connecting patients with accredited
              pathology centers and providing seamless, passwordless report verification.
            </p>
            <div className="pl-footer__brand-badges">
              <Badge variant="neutral" icon={ShieldCheck}>
                NABL Accredited Labs
              </Badge>
              <Badge variant="neutral" icon={Lock}>
                End-to-End Encrypted
              </Badge>
            </div>
          </div>

          {/* Patient Quick Links */}
          <div className="pl-footer__col">
            <h4>For Patients</h4>
            <ul>
              <li>
                <Link to="/labs">Search Diagnostic Labs</Link>
              </li>
              <li>
                <Link to="/test-packages">Tests & Health Packages</Link>
              </li>
              <li>
                <Link to="/reports">Check Medical Reports</Link>
              </li>
              <li>
                <Link to="/callback">Request Lab Callback</Link>
              </li>
            </ul>
          </div>

          {/* Lab Owners */}
          <div className="pl-footer__col">
            <h4>For Diagnostic Labs</h4>
            <ul>
              <li>
                <Link to="/lab/login">Lab Owner Sign In</Link>
              </li>
              <li>
                <Link to="/labs#register">Register Your Laboratory</Link>
              </li>
              
            </ul>
          </div>

          {/* Privacy & Standards */}
          <div className="pl-footer__col">
            <h4>Security & Standards</h4>
            <div className="pl-footer__contact">
              <div className="pl-footer__contact-item">
                <Lock size={16} />
                <span>
                  Reports are locked behind cryptographic email OTP verification and never indexed publicly.
                </span>
              </div>
              <div className="pl-footer__contact-item">
                <ShieldCheck size={16} />
                <span>Compliant with Indian diagnostic healthcare guidelines and verified lab standards.</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pl-footer__bottom">
          <p>© {currentYear} PublicLab Technologies. All rights reserved.</p>
          <div className="pl-footer__bottom-links">
            <Link to="/reports">Privacy Policy</Link>
            <Link to="/labs">Terms & Conditions</Link>
            <Link to="/labs">Cookie Policy</Link>

          </div>
        </div>
      </div>
    </footer>
  );
}
