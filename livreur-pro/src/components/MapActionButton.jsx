import React from "react";

export default function MapActionButton({ children, onClick, type = "button" }) {
  return (
    <button type={type} className="map-action-button" onClick={onClick}>
      {children}
    </button>
  );
}
