import React from "react";
import { useNavigate } from "react-router-dom";
import { logoutCurrentAccount } from "../livreursapi.js";

export default function LogoutButton() {
  const navigate = useNavigate();

 async function logout() {
  await logoutCurrentAccount();
  navigate("/");

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
    خروج
    </button>
  );
}
