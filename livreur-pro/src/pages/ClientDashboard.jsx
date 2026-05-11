import React, { useState } from "react";
import { deleteClient } from "../livreursapi.js";
import { useNavigate } from "react-router-dom";

export default function ClientDashboard() {
  const navigate = useNavigate();

  const clientStorage = localStorage.getItem("client");
  const client = clientStorage ? JSON.parse(clientStorage) : null;

  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function handleDeleteClientAccount() {
    const confirmDelete = window.confirm(
      "هل أنت متأكد من حذف حسابك نهائياً؟ لا يمكن التراجع عن هذه العملية."
    );

    if (!confirmDelete) return;

    setError("");
    setMessage("");
    setDeleting(true);

    try {
      await deleteClient(client.id);

      localStorage.removeItem("access");
      localStorage.removeItem("refresh");
      localStorage.removeItem("role");
      localStorage.removeItem("livreur");
      localStorage.removeItem("client");
      localStorage.removeItem("redirectAfterLogin");

      window.dispatchEvent(new Event("authChanged"));

      navigate("/livreurs", { replace: true });
    } catch (err) {
      setError(err.message || "حدث خطأ أثناء حذف الحساب");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <section className="page">
      <div className="page-title">
        <span className="eyebrow">Espace client</span>
        <h1>Dashboard client</h1>
        <p>Bienvenue dans votre espace client.</p>
      </div>

      <div className="tracking-card">
        <h2>Mes actions</h2>

        <a className="primary-btn full" href="/livreurs">
          Voir les livreurs disponibles
        </a>

        <a className="primary-btn full" href="/connexion-client">
          Modifier mon compte
        </a>

        <button
          className="primary-btn full"
          style={{
            marginTop: "14px",
            background: "#991b1b",
            fontFamily: '"Cairo", sans-serif',
            fontWeight: "700",
            fontSize: "15px",
          }}
          onClick={handleDeleteClientAccount}
          disabled={deleting}
        >
          {deleting
            ? "جاري حذف الحساب..."
            : "حذف حسابي نهائياً"}
        </button>

        {message && (
          <p style={{ color: "green", marginTop: "14px" }}>
            {message}
          </p>
        )}

        {error && (
          <p style={{ color: "red", marginTop: "14px" }}>
            {error}
          </p>
        )}
      </div>
    </section>
  );
}