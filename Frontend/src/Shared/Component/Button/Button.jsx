import React from "react";
import "./Button.scss";

export default function Button({
  children,
  type = "button",
  variant = "primary",
  size = "md",
  fullWidth = false,
  isLoading = false,
  disabled = false,
  icon: Icon,
  iconPosition = "left",
  onClick,
  className = "",
  ...rest
}) {
  const classes = [
    "pl-btn",
    `pl-btn--${variant}`,
    `pl-btn--${size}`,
    fullWidth ? "pl-btn--full" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type={type}
      className={classes}
      disabled={disabled || isLoading}
      onClick={onClick}
      {...rest}
    >
      {isLoading ? (
        <span className="pl-btn__spinner" aria-label="Loading" />
      ) : (
        <>
          {Icon && iconPosition === "left" && (
            <span className="pl-btn__icon">
              <Icon size={size === "sm" ? 14 : size === "lg" ? 20 : 16} />
            </span>
          )}
          <span>{children}</span>
          {Icon && iconPosition === "right" && (
            <span className="pl-btn__icon">
              <Icon size={size === "sm" ? 14 : size === "lg" ? 20 : 16} />
            </span>
          )}
        </>
      )}
    </button>
  );
}
