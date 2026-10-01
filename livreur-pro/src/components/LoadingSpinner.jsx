import React from "react";

export default function LoadingSpinner({ label = "جاري التحميل...", fullPage = false, size = 28 }) {
  return (
    <div className={`loading-state${fullPage ? " loading-state-full" : ""}`} role="status" aria-live="polite">
      <span className="loading-spinner" style={{ width: size, height: size }} aria-hidden="true">
        <span />
        <span />
      </span>
      <span>{label}</span>
    </div>
  );
}
