import React from "react";
import { LoaderCircle } from "lucide-react";

export default function LoadingSpinner({ label = "Chargement...", fullPage = false, size = 28 }) {
  return (
    <div className={`loading-state${fullPage ? " loading-state-full" : ""}`} role="status" aria-live="polite">
      <LoaderCircle className="loading-spinner" size={size} aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}
