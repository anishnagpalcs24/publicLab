import React from "react";
import "./Loader.scss";

export default function Loader({
  size = "md",
  text = "Loading...",
  fullscreen = false,
  className = "",
}) {
  return (
    <div
      className={`pl-loader ${
        fullscreen ? "pl-loader--fullscreen" : ""
      } ${className}`}
      role="status"
      aria-live="polite"
    >
      <div className={`pl-loader__spinner pl-loader__spinner--${size}`} />
      {text && <span className="pl-loader__text">{text}</span>}
    </div>
  );
}
