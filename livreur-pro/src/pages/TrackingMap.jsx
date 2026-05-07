import React from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
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