import React, { forwardRef } from "react";
import "./Input.scss";

const Input = forwardRef(function Input(
  {
    label,
    name,
    type = "text",
    error,
    helperText,
    required = false,
    prefixIcon: PrefixIcon,
    suffixIcon: SuffixIcon,
    onSuffixClick,
    className = "",
    ...rest
  },
  ref
) {
  const fieldClasses = [
    "pl-input-group__field",
    error ? "pl-input-group__field--error" : "",
    PrefixIcon ? "pl-input-group__field--has-prefix" : "",
    SuffixIcon ? "pl-input-group__field--has-suffix" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={`pl-input-group ${className}`}>
      {label && (
        <label
          htmlFor={name}
          className={`pl-input-group__label ${
            required ? "pl-input-group__label--required" : ""
          }`}
        >
          {label}
        </label>
      )}

      <div className="pl-input-group__wrapper">
        {PrefixIcon && (
          <span className="pl-input-group__icon pl-input-group__icon--prefix">
            <PrefixIcon size={16} />
          </span>
        )}

        <input
          ref={ref}
          id={name}
          name={name}
          type={type}
          className={fieldClasses}
          aria-invalid={Boolean(error)}
          {...rest}
        />

        {SuffixIcon && (
          <span
            className="pl-input-group__icon pl-input-group__icon--suffix"
            onClick={onSuffixClick}
            role={onSuffixClick ? "button" : undefined}
            tabIndex={onSuffixClick ? 0 : undefined}
          >
            <SuffixIcon size={16} />
          </span>
        )}
      </div>

      {error && <span className="pl-input-group__error-text">{error}</span>}
      {!error && helperText && (
        <span className="pl-input-group__helper-text">{helperText}</span>
      )}
    </div>
  );
});

export default Input;
