import React from "react";
import { LoaderCircle } from "lucide-react";

export default function MapActionButton({
  children,
  onClick,
  type = "button",
  loading = false,
  disabled = false,
}) {
  return (
    <button
      type={type}
      className="map-action-button"
      onClick={onClick}
      disabled={disabled || loading}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "8px",
        opacity: loading ? 0.9 : 1,
      }}
    >
      {loading && <LoaderCircle className="loading-spinner" size={16} aria-hidden="true" />}
      {children}
    </button>
  );
}
