import React, { useEffect } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
} from "react-leaflet";

import { useNavigate } from "react-router-dom";
import L from "leaflet";
import MapActionButton from "./MapActionButton.jsx";

import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

delete L.Icon.Default.prototype._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

const ALGERIA_CENTER = [36.0339, 3.6596];
const NORTHERN_ALGERIA_BOUNDS = [
  [34.5, -2.5],
  [37.3, 9.0],
];

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

function getVehicleMarkerIcon(vehicle) {
  const map = {
    moto: { emoji: "🛵", bg: "#f97316" },
    scooter: { emoji: "🛵", bg: "#f97316" },
    velo: { emoji: "🚴", bg: "#10b981" },
    voiture: { emoji: "🚘", bg: "#2563eb" },
    camion: { emoji: "🚚", bg: "#f59e0b" },
  };

  const config = map[vehicle] || map.moto;

  return new L.DivIcon({
    className: "vehicle-marker",
    html: `
      <div style="
        width:32px;
        height:32px;
        background:${config.bg};
        border:4px solid white;
        border-radius:50%;
        display:flex;
        align-items:center;
        justify-content:center;
        font-size:16px;
      ">${config.emoji}</div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
}

function hasPosition(position) {
  return (
    position?.latitude !== null &&
    position?.latitude !== undefined &&
    position?.longitude !== null &&
    position?.longitude !== undefined &&
    !isNaN(Number(position.latitude)) &&
    !isNaN(Number(position.longitude))
  );
}

const vehicleLabels = {
  moto: "دراجة نارية",
  scooter: "دراجة نارية",
  velo: "دراجة",
  voiture: "سيارة",
  camion: "شاحنة",
};

function LocateButton({ clientPosition, onRequestClientPosition }) {
  const map = useMap();

  function handleClick() {
    if (!hasPosition(clientPosition)) {
      onRequestClientPosition?.();
      return;
    }

    map.flyTo(
      [Number(clientPosition.latitude), Number(clientPosition.longitude)],
      10,
      { duration: 1.2 }
    );
  }

  return (
    <div className="map-action-buttons">
      <MapActionButton onClick={handleClick}>📍 موقعي</MapActionButton>
    </div>
  );
}

function RecenterOnClient({ clientPosition }) {
  const map = useMap();

  useEffect(() => {
    if (!hasPosition(clientPosition)) return;

    map.flyTo(
      [Number(clientPosition.latitude), Number(clientPosition.longitude)],
      13,
      { duration: 1.2 }
    );
  }, [map, clientPosition]);

  return null;
}

export default function CouriersMap({
  couriers = [],
  clientPosition,
  onRequestClientPosition,
}) {
  const navigate = useNavigate();

  const availableCouriers = couriers.filter((c) => {
    const isAvailable = c.available === true || c.disponible === true;

    const hasPosition =
      c.latitude !== null &&
      c.latitude !== undefined &&
      c.longitude !== null &&
      c.longitude !== undefined &&
      !isNaN(Number(c.latitude)) &&
      !isNaN(Number(c.longitude));

    return isAvailable && hasPosition;
  });

  const hasClientPosition = hasPosition(clientPosition);

  const center = hasClientPosition
    ? [
        Number(clientPosition.latitude),
        Number(clientPosition.longitude),
      ]
    : ALGERIA_CENTER;

  const zoom = hasClientPosition ? 10 : 5;

  return (
    <div
      style={{
        height: "100%",
        width: "100%",
        borderRadius: "20px",
        overflow: "hidden",
        position: "relative",
      }}
    >
      <MapContainer
        center={center}
        zoom={zoom}
        style={{
          height: "100%",
          width: "100%",
        }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <LocateButton
          clientPosition={clientPosition}
          onRequestClientPosition={onRequestClientPosition}
        />

        <RecenterOnClient clientPosition={clientPosition} />

        {hasClientPosition && (
          <Marker
            key="client-position"
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
            key={courier.id}
            position={[
              Number(courier.latitude),
              Number(courier.longitude),
            ]}
            icon={getVehicleMarkerIcon(courier.vehicle || courier.vehicule || "moto")}
          >
            <Popup>
              <div style={{ textAlign: "center" }}>
                <strong>{courier.name || courier.nom}</strong>
                <br />
                {vehicleLabels[courier.vehicle || courier.vehicule] ||
                  courier.vehicle ||
                  courier.vehicule}
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