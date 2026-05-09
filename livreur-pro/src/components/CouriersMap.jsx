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
        {
          duration: 2,
        }
      );
    }
  }, [clientPosition, map]);

  return null;
}

export default function CouriersMap({ couriers, clientPosition }) {
  const navigate = useNavigate();

  const availableCouriers = couriers.filter(
    (c) =>
      c.available === true &&
      c.latitude !== null &&
      c.latitude !== undefined &&
      c.longitude !== null &&
      c.longitude !== undefined
  );

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
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
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
            key={courier.id}
            position={[
              Number(courier.latitude),
              Number(courier.longitude),
            ]}
          >
            <Popup>
              <div style={{ textAlign: "center" }}>
                <strong>{courier.name}</strong>
                <br />
                {courier.vehicle}
                <br />
                {courier.city}
                <br />

                <button
                  onClick={() =>
                    navigate(`/tracking/${courier.id}`)
                  }
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