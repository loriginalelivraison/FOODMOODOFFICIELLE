import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createClient, loginClient } from "../livreursapi.js";

export default function ClientAuth() {
  const navigate = useNavigate();

  const [mode, setMode] = useState("login");
  const [nom, setNom] = useState("");
  const [telephone, setTelephone] = useState("");
  const [password, setPassword] = useState("");


  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  

  async function handleSubmit(e) {
  e.preventDefault();
  setError("");
  setMessage("");
  setLoading(true);

  try {
    if (mode === "register") {
      await createClient({
        nom,
        telephone,
        password,
      });

      await loginClient({
        nom,
        telephone,
        password,
      });

      navigate("/livreurs");
    } else {
      await loginClient({
        nom,
        telephone,
        password,
      });

      navigate("/livreurs");
    }
  } catch (err) {
    setError(err.message);
  } finally {
    setLoading(false);
  }
}

  return (
    <section className="page auth-page">
      <div className="auth-card">
        <span className="eyebrow">Espace client</span>

        <h1>{mode === "login" ? "Connexion client" : "Inscription client"}</h1>

        <div className="auth-tabs">
          <button
            className={mode === "login" ? "active" : ""}
            onClick={() => setMode("login")}
            type="button"
          >
            Connexion
          </button>

          <button
            className={mode === "register" ? "active" : ""}
            onClick={() => setMode("register")}
            type="button"
          >
            Inscription
          </button>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {mode === "register" && (
            <>
              <label>Nom complet</label>
              <input
                type="text"
                value={nom}
                onChange={(e) => setNom(e.target.value)}
                placeholder="Ex: Mohamed Ali"
                required
              />

             
            </>
          )}

          <label>Téléphone</label>
          <input
            type="text"
            value={telephone}
            onChange={(e) => setTelephone(e.target.value)}
            placeholder="Ex: 0555555555"
            required
          />

          <label>Mot de passe</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Votre mot de passe"
            required
          />

          <button className="primary-btn full" type="submit" disabled={loading}>
            {loading
              ? "Veuillez patienter..."
              : mode === "login"
              ? "Se connecter"
              : "Créer mon compte"}
          </button>

          {message && <p style={{ color: "green" }}>{message}</p>}
          {error && <p style={{ color: "red" }}>{error}</p>}
        </form>
      </div>
    </section>
  );
}