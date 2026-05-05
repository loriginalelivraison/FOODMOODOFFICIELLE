import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { updateLivreurPosition } from "../livreursapi.js";



export default function LivreurDashboard() {
  const { id } = useParams();

  // UNE SEULE VERSION
  const livreurStorage = localStorage.getItem("livreur");
  const livreur = livreurStorage ? JSON.parse(livreurStorage) : null;

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [position, setPosition] = useState(null);
  const [loading, setLoading] = useState(false);
  const [trackingEnabled, setTrackingEnabled] = useState(true);
 


useEffect(() => {
  if (!livreur) return;

  if (!trackingEnabled) return;

  function sendPosition() {
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const newPosition = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          };

          await updateLivreurPosition(id, newPosition);

          setPosition(newPosition);

          console.log("Position envoyée");
        } catch (err) {
          setError(err.message);
        }
      },
      () => {
        setError("Permission GPS refusée.");
      }
    );
  }

  // envoi immédiat
  sendPosition();

  // toutes les 10 secondes
  const interval = setInterval(sendPosition, 10000);

  return () => clearInterval(interval);
}, [trackingEnabled]);



  return (
    <section className="page">
      <div className="page-title">
        <span className="eyebrow">Espace livreur</span>
        <h1>Dashboard livreur</h1>
        <p>
          Ici, le livreur peut partager sa position GPS pour être suivi par le client.
        </p>
      </div>

      <div className="tracking-card">
        <h2>{livreur?.nom || "Livreur"}</h2>

        <p>Email : {livreur?.email || "Non disponible"}</p>
        <p>Téléphone : {livreur?.telephone || "Non disponible"}</p>
        <p>Ville : {livreur?.ville || "Non disponible"}</p>

    
                <button
  className="primary-btn full"
  style={{
    marginTop: "15px",
    background: trackingEnabled ? "#dc2626" : "#16a34a",
  }}
  onClick={() => setTrackingEnabled(!trackingEnabled)}
>
  {trackingEnabled
    ? "Désactiver le suivi GPS"
    : "Activer le suivi GPS"}
</button>

        {message && <p style={{ color: "green" }}>{message}</p>}
        {error && <p style={{ color: "red" }}>{error}</p>}

        {position && (
          <div>
            <p>Latitude : {position.latitude}</p>
            <p>Longitude : {position.longitude}</p>
          </div>
        )}
      </div>
    </section>
  );
}