import React, { useEffect, useState } from "react";
import { updateLivreurPosition } from "../livreursapi.js";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
} from "react-leaflet";
import L from "leaflet";

import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

delete L.Icon.Default.prototype._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

function RecenterMap({ position }) {
  const map = useMap();

  useEffect(() => {
    if (position?.latitude && position?.longitude) {
      map.flyTo(
        [Number(position.latitude), Number(position.longitude)],
        16,
        { duration: 1.2 }
      );
    }
  }, [position, map]);

  return null;
}

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

    if (!navigator.geolocation) {
      setError("La géolocalisation n'est pas supportée.");
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      async (pos) => {
        try {
          const newPosition = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          };

          console.log("GPS LIVREUR :", newPosition);

          setPosition(newPosition);

          const result = await updateLivreurPosition(livreur.id, {
            latitude: newPosition.latitude,
            longitude: newPosition.longitude,
            disponible: true,
          });

          console.log("REPONSE API :", result);

          setMessage("Position livreur actualisée.");
          setError("");
        } catch (err) {
          console.error(err);
          setError("Erreur lors de la mise à jour de la position.");
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

  if (!livreur) {
    return (
      <div style={{ padding: "20px" }}>
        <p>Vous devez être connecté comme livreur.</p>
      </div>
    );
  }

  const photoUrl = livreur.photo || livreur.image || null;

  return (
    <section className="page" dir="rtl">
      <div
        style={{
          background: "#fff7ed",
          border: "1px solid #fed7aa",
          borderRadius: "24px",
          padding: "18px",
          marginBottom: "18px",
          boxShadow: "0 10px 25px rgba(249,115,22,0.12)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "14px",
          }}
        >
          <div
            style={{
              width: "76px",
              height: "76px",
              borderRadius: "50%",
              overflow: "hidden",
              background: "#ffedd5",
              border: "3px solid white",
              flexShrink: 0,
            }}
          >
            {photoUrl ? (
              <img
                src={photoUrl}
                alt={livreur.nom}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                }}
              />
            ) : (
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  display: "grid",
                  placeItems: "center",
                  fontSize: "30px",
                }}
              >
                🛵
              </div>
            )}
          </div>

          <div>
            <h2 style={{ margin: 0 }}>{livreur.nom}</h2>
            <p style={{ margin: "6px 0", color: "#6b7280" }}>
              {livreur.ville} — {livreur.vehicule}
            </p>
            <p style={{ margin: 0, fontWeight: "600" }}>
              📞 {livreur.telephone}
            </p>
          </div>
        </div>

        <button
          onClick={() => setTrackingEnabled(!trackingEnabled)}
          style={{
            marginTop: "18px",
            width: "100%",
            padding: "13px",
            borderRadius: "14px",
            border: "none",
            background: trackingEnabled ? "#dc2626" : "#16a34a",
            color: "white",
            fontWeight: "bold",
            cursor: "pointer",
          }}
        >
          {trackingEnabled
            ? "إيقاف مشاركة الموقع"
            : "تشغيل مشاركة الموقع"}
        </button>
      </div>

      {message && (
        <p style={{ color: "green", textAlign: "center", fontWeight: "600" }}>
          {message}
        </p>
      )}

      {error && (
        <p style={{ color: "red", textAlign: "center", fontWeight: "600" }}>
          {error}
        </p>
      )}

      {position && (
        <div
          style={{
            background: "#ffffff",
            borderRadius: "20px",
            padding: "12px",
            marginBottom: "16px",
            border: "1px solid #e5e7eb",
          }}
        >
          <p style={{ margin: "5px 0" }}>
            <strong>Latitude :</strong> {position.latitude}
          </p>
          <p style={{ margin: "5px 0" }}>
            <strong>Longitude :</strong> {position.longitude}
          </p>
        </div>
      )}

      <div
        style={{
          height: "360px",
          borderRadius: "22px",
          overflow: "hidden",
          border: "2px solid #fed7aa",
        }}
      >
        <MapContainer
          center={
            position
              ? [Number(position.latitude), Number(position.longitude)]
              : [36.75, 3.06]
          }
          zoom={15}
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer
            attribution="&copy; OpenStreetMap"
            url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          />

          {position && (
            <>
              <RecenterMap position={position} />

              <Marker
                key={`${position.latitude}-${position.longitude}`}
                position={[
                  Number(position.latitude),
                  Number(position.longitude),
                ]}
              >
                <Popup>
                  <strong>موقعي الحالي</strong>
                  <br />
                  {livreur.nom}
                </Popup>
              </Marker>
            </>
          )}
        </MapContainer>
      </div>
    </section>
  );
}