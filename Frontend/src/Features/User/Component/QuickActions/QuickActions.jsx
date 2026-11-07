import React from "react";
import { useNavigate } from "react-router-dom";
import { Building2, FileText, PackageSearch, PhoneCall, ArrowRight } from "lucide-react";
import "./QuickActions.scss";

export default function QuickActions() {
  const navigate = useNavigate();

  const actions = [
    {
      title: "Find Diagnostic Labs",
      description: "Search NABL-certified laboratories by city, compare services, and check opening hours.",
      icon: Building2,
      variant: "teal",
      link: "/labs",
      cta: "Explore Labs",
    },
    {
      title: "Check Medical Reports",
      description: "Access your pathology reports securely using your registered email and a 6-digit OTP.",
      icon: FileText,
      variant: "blue",
      link: "/reports",
      cta: "View Reports",
    },
    {
      title: "Explore Test Packages",
      description: "Discover comprehensive vital health panels, cardiac risks, and annual preventative checkups.",
      icon: PackageSearch,
      variant: "green",
      link: "/test-packages",
      cta: "Browse Packages",
    },
    {
      title: "Request a Lab Callback",
      description: "Need test recommendations or home collection? Request an immediate lab callback.",
      icon: PhoneCall,
      variant: "amber",
      link: "/callback",
      cta: "Request Now",
    },
  ];

  return (
    <section className="pl-quick-actions" aria-label="Quick Action Cards">
      <div className="pl-quick-actions__container">
        <div className="pl-quick-actions__grid">
          {actions.map((act) => {
            const Icon = act.icon;
            return (
              <div
                key={act.title}
                className="pl-quick-actions__card"
                onClick={() => navigate(act.link)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    navigate(act.link);
                  }
                }}
              >
                <div
                  className={`pl-quick-actions__card-icon pl-quick-actions__card-icon--${act.variant}`}
                >
                  <Icon size={24} />
                </div>
                <h3 className="pl-quick-actions__card-title">{act.title}</h3>
                <p className="pl-quick-actions__card-desc">{act.description}</p>
                <div className="pl-quick-actions__card-action">
                  <span>{act.cta}</span>
                  <ArrowRight size={16} className="pl-quick-actions__card-arrow" />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
