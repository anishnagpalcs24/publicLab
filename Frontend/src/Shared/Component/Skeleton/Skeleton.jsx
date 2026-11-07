import React from "react";
import "./Skeleton.scss";

export default function Skeleton({
  variant = "text",
  width,
  height,
  className = "",
  style = {},
}) {
  const inlineStyles = {
    ...(width ? { width } : {}),
    ...(height ? { height } : {}),
    ...style,
  };

  return (
    <div
      className={`pl-skeleton pl-skeleton--${variant} ${className}`}
      style={inlineStyles}
      aria-hidden="true"
    />
  );
}
