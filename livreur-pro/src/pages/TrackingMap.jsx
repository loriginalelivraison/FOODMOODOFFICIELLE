import React from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";

import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

delete L.Icon.Default.prototype._getIconUrl;

// icône livreur
const courierIcon = new L.Icon({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

// icône client verte
const clientIcon = new L.Icon({
  iconUrl:
    "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png",
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

export default function TrackingMap({
  courier,
  clientPosition,
}) {
  const latitude = Number(courier.latitude);
  const longitude = Number(courier.longitude);

  if (!latitude || !longitude) {
    return <p>Position GPS non disponible.</p>;
  }

  return (
    <div
      style={{
        height: "420px",
        width: "100%",
        borderRadius: "20px",
        overflow: "hidden",
      }}
    >
      <MapContainer
        center={[latitude, longitude]}
        zoom={14}
        style={{
          height: "100%",
          width: "100%",
        }}
      >
        <TileLayer
          attribution="&copy; OpenStreetMap"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* LIVREUR */}
        <Marker
          position={[latitude, longitude]}
          icon={courierIcon}
        >
          <Popup>
            {courier.name}
            <br />
            {courier.vehicle}
          </Popup>
        </Marker>

        {/* CLIENT */}
        {clientPosition && (
          <Marker
            position={[
              clientPosition.latitude,
              clientPosition.longitude,
            ]}
            icon={clientIcon}
          >
            <Popup>
              📍 موقع العميل
            </Popup>
          </Marker>
        )}
      </MapContainer>
    </div>
  );
}