import React, { useEffect, useState } from "react";
import { updateLivreurPosition } from "../livreursapi.js";

export default function LivreurDashboard() {
  const livreurStorage = localStorage.getItem("livreur");
  const livreur = livreurStorage ? JSON.parse(livreurStorage) : null;

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [position, setPosition] = useState(null);
  const [trackingEnabled, setTrackingEnabled] = useState(true);

  useEffect(() => {
    if (!livreur?.id) return;
    if (!trackingEnabled) return;

    const watchId = navigator.geolocation.watchPosition(
      async (pos) => {
        try {
          const newPosition = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          };

          console.log("GPS TELEPHONE :", newPosition);
          setPosition(newPosition);

          const result = await updateLivreurPosition(livreur.id, {
            latitude: newPosition.latitude,
            longitude: newPosition.longitude,
            disponible: true,
          });

          console.log("REPONSE API :", result);

          setMessage("Position actualisée en temps réel.");
          setError("");
        } catch (err) {
          console.error(err);
          setError("Erreur mise à jour position.");
        }
      },
      (geoError) => {
        console.error(geoError);
        setError("Impossible d'obtenir la position GPS.");
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 15000,
      }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [livreur?.id, trackingEnabled]);

  return (
    <div style={{ padding: "20px" }}>
      <h2>Dashboard Livreur</h2>

      <button
        onClick={() => setTrackingEnabled(!trackingEnabled)}
        style={{
          marginTop: "20px",
          padding: "12px 18px",
          borderRadius: "12px",
          border: "none",
          background: trackingEnabled ? "#dc2626" : "#16a34a",
          color: "white",
          cursor: "pointer",
          fontWeight: "bold",
        }}
      >
        {trackingEnabled
          ? "Arrêter le partage GPS"
          : "Activer le partage GPS"}
      </button>

      {position && (
        <div
          style={{
            marginTop: "20px",
            background: "#f5f5f5",
            padding: "15px",
            borderRadius: "12px",
          }}
        >
          <p>
            <strong>Latitude :</strong> {position.latitude}
          </p>
          <p>
            <strong>Longitude :</strong> {position.longitude}
          </p>
        </div>
      )}

      {message && <p style={{ color: "green" }}>{message}</p>}
      {error && <p style={{ color: "red" }}>{error}</p>}
    </div>
  );
}