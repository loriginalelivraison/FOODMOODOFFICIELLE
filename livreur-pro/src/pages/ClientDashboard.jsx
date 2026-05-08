import React from "react";

export default function ClientDashboard() {
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
      </div>
    </section>
  );
}