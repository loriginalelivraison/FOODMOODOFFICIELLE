import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getLivreurById } from "../livreursapi.js";
import TrackingMap from "./TrackingMap.jsx";

export default function Tracking() {
  const { id } = useParams();

  const [courier, setCourier] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
  function loadCourier() {
    getLivreurById(id)
      .then((livreur) => {
        setCourier({
          id: livreur.id,
          name: livreur.nom,
          city: livreur.ville,
          vehicle: livreur.vehicule,
          available: Boolean(livreur.disponible),
          phone: livreur.telephone,
          whatsapp: livreur.telephone?.replace(/\s/g, "").replace("+", "").replace(/^0/, "33"),
          latitude: livreur.latitude,
          longitude: livreur.longitude,
        });

        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }

  loadCourier();

  const interval = setInterval(loadCourier, 5000);

  return () => clearInterval(interval);
}, [id]);

  if (loading) {
    return <section className="page">Chargement du suivi...</section>;
  }

  if (error) {
    return <section className="page">{error}</section>;
  }

  return (
    <section className="page">
      <div className="page-title">
        <span className="eyebrow">Suivi livreur</span>
        <h1>{courier.name}</h1>
        <p>
          {courier.city} • {courier.vehicle} •{" "}
          {courier.available ? "Disponible" : "Occupé"}
        </p>
      </div>

      <div className="tracking-card">
        <h2>Position actuelle</h2>
        <TrackingMap courier={courier} />

        <p>
          Latitude : <strong>{courier.latitude || "Non renseignée"}</strong>
        </p>

        <p>
          Longitude : <strong>{courier.longitude || "Non renseignée"}</strong>
        </p>

        <div className="card-bottom">
          <a className="primary-btn small" href={`tel:${courier.phone}`}>
            📞 Appeler
          </a>

          <a
            className="primary-btn small"
            href={`https://wa.me/${courier.whatsapp}`}
            target="_blank"
            rel="noreferrer"
          >
            WhatsApp
          </a>
        </div>
      </div>
    </section>
  );
}