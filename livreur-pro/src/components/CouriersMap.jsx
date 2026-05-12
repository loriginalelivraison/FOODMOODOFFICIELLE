import React, { useEffect, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
} from "react-leaflet";

import { useNavigate } from "react-router-dom";
import L from "leaflet";

import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000/api";


delete L.Icon.Default.prototype._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

const clientIcon = new L.DivIcon({
  className: "client-marker",
  html: `
    <div style="
      width:20px;
      height:20px;
      background:#16a34a;
      border:4px solid white;
      border-radius:50%;
      box-shadow:0 0 0 8px rgba(22,163,74,0.25);
    "></div>
  `,
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

function RecenterMap({ clientPosition }) {
  const map = useMap();

  useEffect(() => {
    if (clientPosition) {
      map.flyTo(
        [
          Number(clientPosition.latitude),
          Number(clientPosition.longitude),
        ],
        15,
        { duration: 2 }
      );
    }
  }, [clientPosition, map]);

  return null;
}

export default function CouriersMap({ couriers = [], clientPosition }) {
  const navigate = useNavigate();
  const [liveCouriers, setLiveCouriers] = useState(couriers);

  useEffect(() => {
    setLiveCouriers(couriers);
  }, [couriers]);

 useEffect(() => {
  async function refreshCouriers() {
    try {
      console.log("Actualisation carte livreurs...");

      const response = await fetch(
        `${API_BASE_URL}/livreurs/?t=${Date.now()}`,
        {
          cache: "no-store",
        }
      );

      if (!response.ok) {
        throw new Error("Erreur API livreurs");
      }

      const data = await response.json();

      console.log("Livreurs reçus :", data);

      const livreurTest = data.find((l) => l.id === 5);
      console.log("Position livreur test :", livreurTest?.latitude, livreurTest?.longitude);

      if (Array.isArray(data)) {
        setLiveCouriers(data);
      } else if (Array.isArray(data.results)) {
        setLiveCouriers(data.results);
      }
    } catch (error) {
      console.error("Erreur actualisation livreurs :", error);
    }
  }

  refreshCouriers();

  const interval = setInterval(() => {
    refreshCouriers();
  }, 10000);

  return () => clearInterval(interval);
}, []);
  const availableCouriers = liveCouriers.filter((c) => {
    const isAvailable =
      c.available === true ||
      c.disponible === true;

    const hasPosition =
      c.latitude !== null &&
      c.latitude !== undefined &&
      c.longitude !== null &&
      c.longitude !== undefined &&
      !isNaN(Number(c.latitude)) &&
      !isNaN(Number(c.longitude));

    return isAvailable && hasPosition;
  });

  const center = clientPosition
    ? [
        Number(clientPosition.latitude),
        Number(clientPosition.longitude),
      ]
    : availableCouriers.length > 0
    ? [
        Number(availableCouriers[0].latitude),
        Number(availableCouriers[0].longitude),
      ]
    : [36.75, 3.06];

  return (
    <div
      style={{
        height: "430px",
        width: "100%",
        borderRadius: "20px",
        overflow: "hidden",
      }}
    >
      <MapContainer
        center={center}
        zoom={13}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution="&copy; OpenStreetMap"
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        />

        <RecenterMap clientPosition={clientPosition} />

        {clientPosition && (
          <Marker
           
            position={[
              Number(clientPosition.latitude),
              Number(clientPosition.longitude),
            ]}
            icon={clientIcon}
          >
            <Popup>
              <strong>أنت هنا</strong>
            </Popup>
          </Marker>
        )}

        {availableCouriers.map((courier) => (
          <Marker

            key={`${courier.id}-${courier.latitude}-${courier.longitude}`}
            position={[
              Number(courier.latitude),
              Number(courier.longitude),
            ]}
          >
            <Popup>
              <div style={{ textAlign: "center" }}>
                <strong>{courier.name || courier.nom}</strong>
                <br />
                {courier.vehicle || courier.vehicule}
                <br />
                {courier.city || courier.ville}
                <br />

                <button
                  onClick={() => navigate(`/tracking/${courier.id}`)}
                  style={{
                    marginTop: "8px",
                    padding: "6px 10px",
                    borderRadius: "8px",
                    border: "none",
                    background: "#16a34a",
                    color: "white",
                    cursor: "pointer",
                  }}
                >
                  تتبع السائق
                </button>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}