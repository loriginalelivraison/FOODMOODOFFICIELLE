import React, { useEffect, useState } from "react";
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

const livreurIcon = new L.DivIcon({
  className: "livreur-marker",
  html: `
    <div style="
      width:34px;
      height:34px;
      background:#f97316;
      border:4px solid white;
      border-radius:50%;
      display:flex;
      align-items:center;
      justify-content:center;
      font-size:18px;
      box-shadow:0 4px 12px rgba(0,0,0,0.25);
    ">🛵</div>
  `,
  iconSize: [34, 34],
  iconAnchor: [17, 17],
});

function RecenterMap({ courier, clientPosition }) {
  const map = useMap();

  useEffect(() => {
    const hasClient =
      clientPosition?.latitude &&
      clientPosition?.longitude;

    const hasLivreur =
      courier?.latitude &&
      courier?.longitude;

    if (hasClient) {
      map.panTo(
        [
          Number(clientPosition.latitude),
          Number(clientPosition.longitude),
        ],
        {
          animate: true,
          duration: 1,
        }
      );
      return;
    }

    if (hasLivreur) {
      map.panTo(
        [
          Number(courier.latitude),
          Number(courier.longitude),
        ],
        {
          animate: true,
          duration: 1,
        }
      );
    }
  }, [
    courier?.latitude,
    courier?.longitude,
    clientPosition?.latitude,
    clientPosition?.longitude,
    map,
  ]);

  useEffect(() => {
    function zoomToClient() {
      if (!clientPosition?.latitude || !clientPosition?.longitude) return;

      map.flyTo(
        [
          Number(clientPosition.latitude),
          Number(clientPosition.longitude),
        ],
        16,
        { duration: 1.2 }
      );
    }

    function zoomToLivreur() {
      if (!courier?.latitude || !courier?.longitude) return;

      map.flyTo(
        [
          Number(courier.latitude),
          Number(courier.longitude),
        ],
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
  }, [clientPosition, courier, map]);

  return null;
}
export default function TrackingMap({ courier, clientPosition }) {
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

  const hasLivreurPosition =
    currentCourier?.latitude !== null &&
    currentCourier?.latitude !== undefined &&
    currentCourier?.longitude !== null &&
    currentCourier?.longitude !== undefined &&
    !isNaN(Number(currentCourier.latitude)) &&
    !isNaN(Number(currentCourier.longitude));

  const hasClientPosition =
    clientPosition?.latitude &&
    clientPosition?.longitude;

  const center = hasClientPosition
    ? [
        Number(clientPosition.latitude),
        Number(clientPosition.longitude),
      ]
    : hasLivreurPosition
    ? [
        Number(currentCourier.latitude),
        Number(currentCourier.longitude),
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
      {hasClientPosition && (
        <button
          onClick={() =>
            window.dispatchEvent(new Event("zoomClientPosition"))
          }
          style={{
            position: "absolute",
            bottom: "14px",
            right: "14px",
            zIndex: 9999,
            background: "#ffffff",
            border: "1px solid #ddd",
            borderRadius: "12px",
            padding: "10px 14px",
            fontWeight: "bold",
            cursor: "pointer",
            boxShadow: "0 4px 12px rgba(0,0,0,0.25)",
          }}
        >
          📍 موقعي
        </button>
      )}

      {hasLivreurPosition && (
        <button
          onClick={() =>
            window.dispatchEvent(new Event("zoomLivreurPosition"))
          }
          style={{
            position: "absolute",
            bottom: "62px",
            right: "14px",
            zIndex: 9999,
            background: "#ffffff",
            border: "1px solid #ddd",
            borderRadius: "12px",
            padding: "10px 14px",
            fontWeight: "bold",
            cursor: "pointer",
            boxShadow: "0 4px 12px rgba(0,0,0,0.25)",
          }}
        >
          🛵 السائق
        </button>
      )}

      <MapContainer
        center={center}
        zoom={14}
        style={{
          height: "100%",
          width: "100%",
        }}
      >
        <TileLayer
         attribution='&copy; OpenStreetMap &copy; CARTO'
         url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
       />

        <RecenterMap
          courier={currentCourier}
          clientPosition={clientPosition}
        />

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
            icon={livreurIcon}
          >
            <Popup>
              <strong>{currentCourier.name}</strong>
              <br />
              {currentCourier.vehicle}
              <br />
              موقع السائق
            </Popup>
          </Marker>
        )}
      </MapContainer>
    </div>
  );
}