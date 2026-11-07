import React, { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { Activity, Menu, X, PhoneCall, ShieldCheck, User } from "lucide-react";
import Button from "../../../../Shared/Component/Button/Button";
import { useAuth } from "../../../Auth/state/auth.context";
import "./Navbar.scss";

export default function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();

  const closeMobile = () => setMobileMenuOpen(false);

  return (
    <header className="pl-navbar">
      <div className="pl-navbar__container">
        {/* Brand Logo */}
        <Link to="/" className="pl-navbar__logo" onClick={closeMobile}>
          <div className="pl-navbar__logo-icon">
            <Activity size={24} />
          </div>
          <div className="pl-navbar__logo-text">
            Public<span>Lab</span>
          </div>
        </Link>

        {/* Desktop Navigation */}
        <nav className="pl-navbar__nav" aria-label="Main Navigation">
          <NavLink
            to="/"
            className={({ isActive }) =>
              `pl-navbar__link ${isActive ? "active" : ""}`
            }
            end
          >
            Home
          </NavLink>
          <NavLink
            to="/labs"
            className={({ isActive }) =>
              `pl-navbar__link ${isActive ? "active" : ""}`
            }
          >
            Find Labs
          </NavLink>
          <NavLink
            to="/test-packages"
            className={({ isActive }) =>
              `pl-navbar__link ${isActive ? "active" : ""}`
            }
          >
            Tests & Packages
          </NavLink>
          <NavLink
            to="/reports"
            className={({ isActive }) =>
              `pl-navbar__link ${isActive ? "active" : ""}`
            }
          >
            Check Reports
          </NavLink>
          <NavLink
            to="/callback"
            className={({ isActive }) =>
              `pl-navbar__link ${isActive ? "active" : ""}`
            }
          >
            Request Callback
          </NavLink>
        </nav>

        {/* Action Controls */}
        <div className="pl-navbar__actions">
          {isAuthenticated ? (
            <>
              {user?.role === "lab" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate("/lab/dashboard")}
                >
                  Lab Portal
                </Button>
              )}
              {user?.role === "admin" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate("/admin/dashboard")}
                >
                  Admin Portal
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={logout}>
                Sign Out
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="ghost"
                size="sm"
                icon={User}
                onClick={() => navigate("/lab/login")}
              >
                Lab Sign In
              </Button>
              <Button
                variant="primary"
                size="sm"
                icon={PhoneCall}
                onClick={() => navigate("/callback")}
              >
                Quick Callback
              </Button>
            </>
          )}
        </div>

        {/* Mobile Toggle Button */}
        <button
          type="button"
          className="pl-navbar__mobile-toggle"
          onClick={() => setMobileMenuOpen((prev) => !prev)}
          aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileMenuOpen}
        >
          {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="pl-navbar__mobile-menu">
          <NavLink
            to="/"
            className={({ isActive }) =>
              `pl-navbar__mobile-link ${isActive ? "active" : ""}`
            }
            onClick={closeMobile}
            end
          >
            Home
          </NavLink>
          <NavLink
            to="/labs"
            className={({ isActive }) =>
              `pl-navbar__mobile-link ${isActive ? "active" : ""}`
            }
            onClick={closeMobile}
          >
            Find Diagnostic Labs
          </NavLink>
          <NavLink
            to="/test-packages"
            className={({ isActive }) =>
              `pl-navbar__mobile-link ${isActive ? "active" : ""}`
            }
            onClick={closeMobile}
          >
            Tests & Packages
          </NavLink>
          <NavLink
            to="/reports"
            className={({ isActive }) =>
              `pl-navbar__mobile-link ${isActive ? "active" : ""}`
            }
            onClick={closeMobile}
          >
            Check Medical Reports
          </NavLink>
          <NavLink
            to="/callback"
            className={({ isActive }) =>
              `pl-navbar__mobile-link ${isActive ? "active" : ""}`
            }
            onClick={closeMobile}
          >
            Request a Callback
          </NavLink>

          <div className="pl-navbar__mobile-actions">
            {isAuthenticated ? (
              <>
                <Button
                  variant="primary"
                  fullWidth
                  onClick={() => {
                    closeMobile();
                    navigate(
                      user?.role === "lab"
                        ? "/lab/dashboard"
                        : user?.role === "admin"
                        ? "/admin/dashboard"
                        : "/reports"
                    );
                  }}
                >
                  My Portal
                </Button>
                <Button variant="outline" fullWidth onClick={logout}>
                  Sign Out
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="outline"
                  fullWidth
                  onClick={() => {
                    closeMobile();
                    navigate("/lab/login");
                  }}
                >
                  Lab Sign In
                </Button>
                <Button
                  variant="primary"
                  fullWidth
                  icon={PhoneCall}
                  onClick={() => {
                    closeMobile();
                    navigate("/callback");
                  }}
                >
                  Request a Callback
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
