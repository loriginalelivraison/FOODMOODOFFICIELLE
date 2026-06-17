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
    if (clientPosition?.latitude && clientPosition?.longitude) {
      map.flyTo(
        [
          Number(clientPosition.latitude),
          Number(clientPosition.longitude),
        ],
        10,
        {
          animate: true,
          duration: 1.2,
        }
      );
    } else {
      map.setView(ALGERIA_CENTER, 7);
    }
  }, [clientPosition, map]);

  return null;
}

function LocateButton({ clientPosition }) {
  const map = useMap();

  useEffect(() => {
    if (!clientPosition) return;

    const control = L.control({ position: "bottomright" });

    control.onAdd = function () {
      const button = L.DomUtil.create("button", "leaflet-bar");
      button.innerHTML = "📍 موقعي";
      button.style.padding = "8px 12px";
      button.style.background = "white";
      button.style.border = "none";
      button.style.cursor = "pointer";
      button.style.fontWeight = "bold";

      L.DomEvent.disableClickPropagation(button);

      button.onclick = () => {
        map.flyTo(
          [
            Number(clientPosition.latitude),
            Number(clientPosition.longitude),
          ],
          10,
          { duration: 1.2 }
        );
      };

      return button;
    };

    control.addTo(map);

    return () => {
      control.remove();
    };
  }, [map, clientPosition]);

  return null;
}

export default function CouriersMap({ couriers = [], clientPosition }) {
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

  const center = clientPosition
    ? [
        Number(clientPosition.latitude),
        Number(clientPosition.longitude),
      ]
    : ALGERIA_CENTER;

  const zoom = clientPosition ? 10 : 7;

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
  attribution='&copy; OpenStreetMap &copy; CARTO'
  url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
/>

        <RecenterMap clientPosition={clientPosition} />

        <LocateButton clientPosition={clientPosition} />

        {clientPosition && (
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