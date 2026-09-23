import React, { useEffect, useRef, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import { getLivreurById } from "../livreursapi.js";

import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

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
        width:34px;
        height:34px;
        background:${config.bg};
        border:4px solid white;
        border-radius:50%;
        display:flex;
        align-items:center;
        justify-content:center;
        font-size:18px;
      ">${config.emoji}</div>
    `,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
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
  moto: "moto",
  scooter: "moto",
  velo: "vélo",
  voiture: "voiture",
  camion: "camion",
};

function MapZoomButtons({ courier, clientPosition }) {
  const map = useMap();
  const hasClient = hasPosition(clientPosition);
  const hasLivreur = hasPosition(courier);

  useEffect(() => {
    function zoomToClient() {
      if (!hasClient) return;
      map.flyTo(
        [Number(clientPosition.latitude), Number(clientPosition.longitude)],
        16,
        { duration: 1.2 }
      );
    }

    function zoomToLivreur() {
      if (!hasLivreur) return;
      map.flyTo(
        [Number(courier.latitude), Number(courier.longitude)],
        16,
        { duration: 1.2 }
      );
    }

    window.addEventListener("zoomClientPosition", zoomToClient);
    window.addEventListener("zoomLivreurPosition", zoomToLivreur);

    return () => {
      window.removeEventListener("zoomClientPosition", zoomToClient);
      window.removeEventListener("zoomLivreurPosition", zoomToLivreur);
    };
  }, [clientPosition, courier, hasClient, hasLivreur, map]);

  return null;
}

function CenterOnCourier({ courier }) {
  const map = useMap();
  const centeredCourierId = useRef(null);

  useEffect(() => {
    if (!hasPosition(courier) || centeredCourierId.current === courier.id) {
      return;
    }

    centeredCourierId.current = courier.id;

    map.flyTo(
      [Number(courier.latitude), Number(courier.longitude)],
      16,
      { duration: 1.2 }
    );
  }, [courier, map]);

  return null;
}

export default function TrackingMap({
  courier,
  clientPosition,
  onRequestClientPosition,
}) {
  const [currentCourier, setCurrentCourier] = useState(courier);

  useEffect(() => {
    setCurrentCourier(courier);
  }, [courier]);

  useEffect(() => {
    if (!courier?.id) return;

    async function refreshCourier() {
      try {
        const data = await getLivreurById(courier.id);

        setCurrentCourier({
          id: data.id,
          name: data.nom,
          city: data.ville,
          vehicle: data.vehicule,
          phone: data.telephone,
          latitude: data.latitude,
          longitude: data.longitude,
          available: Boolean(data.disponible),
        });
      } catch (err) {
        console.error("Erreur refresh livreur tracking :", err);
      }
    }

    refreshCourier();

    const interval = setInterval(refreshCourier, 8000);

    return () => clearInterval(interval);
  }, [courier?.id]);

  const hasLivreurPosition = hasPosition(currentCourier);
  const hasClientPosition = hasPosition(clientPosition);
  const center = hasLivreurPosition
    ? [
        Number(currentCourier.latitude),
        Number(currentCourier.longitude),
      ]
    : hasClientPosition
    ? [
        Number(clientPosition.latitude),
        Number(clientPosition.longitude),
      ]
    : [36.75, 3.06];

  return (
    <div
      style={{
        height: "360px",
        width: "100%",
        borderRadius: "20px",
        overflow: "hidden",
        position: "relative",
      }}
    >
      <div className="map-action-buttons">
        {hasClientPosition && (
          <button
            className="map-action-button"
            onClick={() =>
              window.dispatchEvent(new Event("zoomClientPosition"))
            }
          >
            📍 موقعي
          </button>
        )}

        {!hasClientPosition && onRequestClientPosition && (
          <button className="map-action-button" onClick={onRequestClientPosition}>
            📍 إظهار موقعي
          </button>
        )}

        {hasLivreurPosition && (
          <button
            className="map-action-button"
            onClick={() =>
              window.dispatchEvent(new Event("zoomLivreurPosition"))
            }
          >
            {(() => {
              const v = currentCourier?.vehicle || currentCourier?.vehicule || "moto";
              const label = vehicleLabels[v] || "moto";
              const emoji =
                label === "moto"
                  ? "🛵"
                  : label === "vélo"
                  ? "🚴"
                  : label === "voiture"
                  ? "🚘"
                  : label === "camion"
                  ? "🚚"
                  : "🚗";
              return `${emoji} السائق`;
            })()}
          </button>
        )}
      </div>

      <MapContainer
        center={center}
        zoom={14}
        style={{
          height: "100%",
          width: "100%",
        }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapZoomButtons
          courier={currentCourier}
          clientPosition={clientPosition}
        />

        <CenterOnCourier courier={currentCourier} />

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

        {hasLivreurPosition && (
          <Marker
            key="livreur-position"
            position={[
              Number(currentCourier.latitude),
              Number(currentCourier.longitude),
            ]}
            icon={getVehicleMarkerIcon(
              currentCourier.vehicle || currentCourier.vehicule || "moto"
            )}
          >
            <Popup>
              <strong>{currentCourier.name}</strong>
              <br />
              {vehicleLabels[currentCourier.vehicle] || currentCourier.vehicle}
              <br />
              موقع السائق
            </Popup>
          </Marker>
        )}
      </MapContainer>
    </div>
  );
}