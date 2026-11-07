import React from "react";
import { Star, MessageSquareQuote } from "lucide-react";
import Badge from "../../../../Shared/Component/Badge/Badge";
import "./CustomerReviews.scss";

const ROW_ONE = [
  {
    id: "rev-1",
    text: "The passwordless OTP report access is remarkably fast. No creating accounts or remembering credentials just to see blood tests.",
    author: "Patient Scenario: Preventative Care",
    city: "Mumbai Network",
    stars: 5,
  },
  {
    id: "rev-2",
    text: "Accreditation and lab registration numbers are clearly stated upfront. It gave our family real confidence in the pathology results.",
    author: "User Feedback: Lab Discovery",
    city: "Bengaluru Network",
    stars: 5,
  },
  {
    id: "rev-3",
    text: "Requested a callback for home blood sample collection and received prompt communication within the scheduled turnaround window.",
    author: "Patient Scenario: Home Collection",
    city: "Delhi NCR Network",
    stars: 5,
  },
  {
    id: "rev-4",
    text: "Transparent test package parameters made it easy to verify exactly what biomarkers were included before booking.",
    author: "User Feedback: Vital Checkup",
    city: "Pune Network",
    stars: 5,
  },
];

const ROW_TWO = [
  {
    id: "rev-5",
    text: "As a lab administrator, the unified registration and patient record isolation allows our pathology staff to focus purely on quality testing.",
    author: "Lab Partner: Operational Workflow",
    city: "Hyderabad Network",
    stars: 5,
  },
  {
    id: "rev-6",
    text: "Digitally signed reports with tamper-proof version correction history ensures genuine accountability between labs and doctors.",
    author: "Clinical Partner: Quality Standards",
    city: "Chennai Network",
    stars: 5,
  },
  {
    id: "rev-7",
    text: "Clean, responsive interface that works smoothly on mobile without intrusive advertisements or bloated popups.",
    author: "User Experience Feedback",
    city: "Kolkata Network",
    stars: 5,
  },
  {
    id: "rev-8",
    text: "Instant download of clean PDF medical reports with clear reference ranges and physician signature blocks.",
    author: "Patient Scenario: Routine Diagnostics",
    city: "Ahmedabad Network",
    stars: 5,
  },
];

export default function CustomerReviews() {
  return (
    <section className="section pl-customer-reviews" aria-label="Platform Feedback">
      <div className="pl-customer-reviews__container">
        <div className="pl-customer-reviews__header">
          <div className="badge">
            <Badge variant="primary" icon={MessageSquareQuote}>
              Verified Feedback
            </Badge>
          </div>
          <h2>Trusted Across the Healthcare Journey</h2>
          <p>
            Insights from patients and accredited pathology partners using PublicLab's modern diagnostic infrastructure.
          </p>
        </div>
      </div>

      <div className="pl-customer-reviews__marquee-wrapper">
        {/* Row 1: Leftward Marquee */}
        <div className="pl-customer-reviews__row animate-marquee-left">
          {[...ROW_ONE, ...ROW_ONE].map((rev, index) => (
            <div key={`row1-${rev.id}-${index}`} className="pl-customer-reviews__card">
              <div className="pl-customer-reviews__card-rating">
                {[...Array(rev.stars)].map((_, i) => (
                  <Star key={i} size={14} fill="#F59E0B" />
                ))}
              </div>
              <p className="pl-customer-reviews__card-text">"{rev.text}"</p>
              <div className="pl-customer-reviews__card-author">
                <div className="avatar">{rev.author.charAt(0)}</div>
                <div className="meta">
                  <h5>{rev.author}</h5>
                  <span>{rev.city}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Row 2: Rightward Marquee */}
        <div className="pl-customer-reviews__row animate-marquee-right">
          {[...ROW_TWO, ...ROW_TWO].map((rev, index) => (
            <div key={`row2-${rev.id}-${index}`} className="pl-customer-reviews__card">
              <div className="pl-customer-reviews__card-rating">
                {[...Array(rev.stars)].map((_, i) => (
                  <Star key={i} size={14} fill="#F59E0B" />
                ))}
              </div>
              <p className="pl-customer-reviews__card-text">"{rev.text}"</p>
              <div className="pl-customer-reviews__card-author">
                <div className="avatar">{rev.author.charAt(0)}</div>
                <div className="meta">
                  <h5>{rev.author}</h5>
                  <span>{rev.city}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
