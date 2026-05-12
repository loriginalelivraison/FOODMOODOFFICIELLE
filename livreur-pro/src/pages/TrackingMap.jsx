import React, { useEffect, useState } from "react";
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

// ICÔNE LIVREUR
const courierIcon = new L.Icon({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

// ICÔNE CLIENT
const clientIcon = new L.Icon({
  iconUrl:
    "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png",
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

// RECENTRER LA MAP SUR LE LIVREUR
function RecenterMap({ latitude, longitude }) {
  const map = useMap();

  useEffect(() => {
    if (latitude && longitude) {
      map.flyTo([latitude, longitude], map.getZoom(), {
        duration: 1.5,
      });
    }
  }, [latitude, longitude, map]);

  return null;
}

export default function TrackingMap({
  courier,
  clientPosition,
}) {
  const [currentCourier, setCurrentCourier] = useState(courier);

  // SYNCHRO SI LE PROP CHANGE
  useEffect(() => {
    setCurrentCourier(courier);
  }, [courier]);

  // ACTUALISATION TOUTES LES 10 SECONDES
  useEffect(() => {
    if (!courier?.id) return;

    async function refreshCourierPosition() {
      try {
        const response = await fetch(
          `http://127.0.0.1:8000/api/livreurs/${courier.id}/`
        );

        if (!response.ok) {
          throw new Error("Erreur API");
        }

        const data = await response.json();

        setCurrentCourier(data);
      } catch (error) {
        console.error(
          "Erreur actualisation position livreur :",
          error
        );
      }
    }

    refreshCourierPosition();

    const interval = setInterval(
      refreshCourierPosition,
      10000
    );

    return () => clearInterval(interval);
  }, [courier]);

  const latitude = Number(currentCourier?.latitude);
  const longitude = Number(currentCourier?.longitude);

  if (
    !latitude ||
    !longitude ||
    isNaN(latitude) ||
    isNaN(longitude)
  ) {
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
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        />

        <RecenterMap
          latitude={latitude}
          longitude={longitude}
        />

        {/* LIVREUR */}
        <Marker
           key={`${currentCourier.id}-${latitude}-${longitude}`}
          position={[latitude, longitude]}
          icon={courierIcon}
        >
          <Popup>
            <strong>
              {currentCourier.name ||
                currentCourier.nom}
            </strong>
            <br />
            {currentCourier.vehicle ||
              currentCourier.vehicule}
          </Popup>
        </Marker>

        {/* CLIENT */}
        {clientPosition && (
          <Marker
            position={[
              Number(clientPosition.latitude),
              Number(clientPosition.longitude),
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