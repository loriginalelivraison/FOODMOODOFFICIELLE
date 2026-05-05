import React from "react";
import { useNavigate } from "react-router-dom";

export default function LogoutButton() {
  const navigate = useNavigate();

  function logout() {
    localStorage.removeItem("access");
    localStorage.removeItem("refresh");
    localStorage.removeItem("livreur");

    navigate("/inscription-livreur");
  }

  const isLoggedIn = localStorage.getItem("access");

  if (!isLoggedIn) return null;

  return (
    <button
      onClick={logout}
      style={{
        background: "#dc2626",
        color: "white",
        border: "none",
        padding: "10px 16px",
        borderRadius: "12px",
        cursor: "pointer",
        fontWeight: "600",
      }}
    >
      Déconnexion
    </button>
  );
}