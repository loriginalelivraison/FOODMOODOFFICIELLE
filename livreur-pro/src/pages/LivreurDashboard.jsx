import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { updateLivreurPosition, setLivreurUnavailable, getLivreurById } from "../livreursapi.js";

export default function LivreurDashboard() {
  const { id } = useParams();

  const livreurStorage = localStorage.getItem("livreur");
  const livreur = livreurStorage ? JSON.parse(livreurStorage) : null;

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [position, setPosition] = useState(null);
  const [trackingEnabled, setTrackingEnabled] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState(true);
  
  //use effecte pour mettre le boutton de desactivation de localisation stable 
  useEffect(() => {
  async function loadLivreurStatus() {
    try {
      const data = await getLivreurById(id);

      setTrackingEnabled(data.disponible === true);
    } catch (err) {
      setError("Impossible de récupérer l'état du livreur.");
    } finally {
      setLoadingStatus(false);
    }
  }

  loadLivreurStatus();
}, [id]);


  useEffect(() => {
    if (loadingStatus) return;
    if (!livreur) return;
    if (!trackingEnabled) return;

    let stopped = false;

    function sendPosition() {
      if (stopped) return;

      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          if (stopped) return;

          try {
            const newPosition = {
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
            };

            await updateLivreurPosition(id, newPosition);

            if (stopped) return;

            setPosition(newPosition);
            console.log("Position envoyée");
          } catch (err) {
            if (!stopped) {
              setError(err.message);
            }
          }
        },
        () => {
          if (!stopped) {
            setError("Permission GPS refusée.");
          }
        }
      );
    }

    sendPosition();

    const interval = setInterval(sendPosition, 10000);

    return () => {
      stopped = true;
      clearInterval(interval);
    };
  }, [trackingEnabled, id]);

  async function handleToggleTracking() {
    setError("");
    setMessage("");

    try {
      if (trackingEnabled) {
        setTrackingEnabled(false);
        await setLivreurUnavailable(id);
        setMessage("Suivi GPS désactivé. Vous êtes maintenant occupé.");
      } else {
        setTrackingEnabled(true);
        setMessage("Suivi GPS activé. Vous êtes maintenant disponible.");
      }
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <section className="page">
      <div className="page-title">
        <span className="eyebrow">Espace livreur</span>
        <h1>Dashboard livreur</h1>
        <p>
          Ici, le livreur peut activer ou désactiver son suivi GPS.
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
          onClick={handleToggleTracking}
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