import React from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, Clock, Droplet, ArrowRight } from "lucide-react";
import Button from "../../../../Shared/Component/Button/Button";
import Badge from "../../../../Shared/Component/Badge/Badge";
import "./TestCard.scss";

export default function TestCard({ pkg }) {
  const navigate = useNavigate();

  const {
    id,
    name,
    category,
    testCount,
    description,
    price,
    originalPrice,
    fastingRequired,
    tatHours,
    popular,
    parameters = [],
  } = pkg;

  return (
    <div className={`pl-test-card ${popular ? "pl-test-card--popular" : ""}`}>
      <div className="pl-test-card__header">
        <span className="pl-test-card__category">{category}</span>
        <h3 className="pl-test-card__title">{name}</h3>
      </div>

      <p className="pl-test-card__desc">{description}</p>

      <div className="pl-test-card__tags">
        <Badge variant="neutral" icon={Droplet}>
          {testCount} Tests Included
        </Badge>
        <Badge variant={fastingRequired ? "warning" : "success"}>
          {fastingRequired ? "Fasting Required" : "Non-Fasting"}
        </Badge>
        <Badge variant="neutral" icon={Clock}>
          {tatHours}h Report TAT
        </Badge>
      </div>

      {parameters.length > 0 && (
        <div className="pl-test-card__parameters">
          <span className="pl-test-card__parameters-title">Key Parameters:</span>
          <ul>
            {parameters.slice(0, 4).map((param) => (
              <li key={param}>
                <CheckCircle2 size={12} />
                <span>{param}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="pl-test-card__pricing-action">
        <div className="pl-test-card__price">
          <span className="pl-test-card__price-current">₹{price}</span>
          {originalPrice && (
            <span className="pl-test-card__price-original">₹{originalPrice}</span>
          )}
        </div>

        <Button
          variant="primary"
          size="sm"
          icon={ArrowRight}
          iconPosition="right"
          onClick={() =>
            navigate(`/callback?package=${encodeURIComponent(name)}&price=${price}`)
          }
        >
          Enquire Now
        </Button>
      </div>
    </div>
  );
}
