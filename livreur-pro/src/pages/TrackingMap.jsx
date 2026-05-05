import React from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";

export default function TrackingMap({ courier }) {
  const latitude = Number(courier.latitude);
  const longitude = Number(courier.longitude);

  if (!latitude || !longitude) {
    return <p>Position GPS non disponible.</p>;
  }

  return (
    <div style={{ height: "420px", width: "100%", borderRadius: "20px", overflow: "hidden" }}>
      <MapContainer
        center={[latitude, longitude]}
        zoom={14}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution="&copy; OpenStreetMap"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <Marker position={[latitude, longitude]}>
          <Popup>
            {courier.name} <br />
            {courier.vehicle}
          </Popup>
        </Marker>
      </MapContainer>
    </div>
  );
}