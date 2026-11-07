import React from "react";
import "./Badge.scss";

export default function Badge({
  children,
  variant = "primary",
  icon: Icon,
  className = "",
}) {
  return (
    <span className={`pl-badge pl-badge--${variant} ${className}`}>
      {Icon && <Icon size={12} />}
      <span>{children}</span>
    </span>
  );
}
