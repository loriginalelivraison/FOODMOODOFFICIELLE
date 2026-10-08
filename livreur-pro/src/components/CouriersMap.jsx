import { getVehicleMarkerIcon } from "../utils/vehicleMarkers.js";
import React, { useEffect, useRef } from "react";
import { LocateFixed } from "lucide-react";
import {
  MapContainer,
  Marker,
  Polyline,
  Popup,
  useMap,
  useMapEvents,
  createMarkerIcon,
} from "./MapboxMap.jsx";

import { useNavigate } from "react-router-dom";
import MapActionButton from "./MapActionButton.jsx";

const ALGERIA_CENTER = [36.0339, 3.6596];
const NORTHERN_ALGERIA_BOUNDS = [
  [34.5, -2.5],
  [37.3, 9.0],
];

const clientIcon = createMarkerIcon({
  className: "client-marker",
  html: `
    <div style="
      width:16px;
      height:16px;
      background:#22c55e;
      border:3px solid white;
      border-radius:50%;
      box-shadow:0 0 0 6px rgba(34,197,94,0.18);
    "></div>
  `,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});


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

function LocateButton({ clientPosition, onRequestClientPosition, isLocating = false }) {
  const map = useMap();

  function handleClick() {
    if (isLocating) return;

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
      <MapActionButton onClick={handleClick} loading={isLocating}>
        {!isLocating && <LocateFixed size={19} aria-hidden="true" />}
        <span>موقعي</span>
      </MapActionButton>
    </div>
  );
}

const originIcon = createMarkerIcon({
  className: "origin-marker",
  html: `
    <div style="
      width:18px;
      height:18px;
      background:#16a34a;
      border:3px solid white;
      border-radius:50%;
      box-shadow:0 0 0 6px rgba(22,163,74,0.18);
    "></div>
  `,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

function RecenterOnClient({ clientPosition }) {
  const map = useMap();
  const hasCenteredOnceRef = useRef(false);

  useEffect(() => {
    if (hasPosition(clientPosition)) {
      if (hasCenteredOnceRef.current) {
        return;
      }

      hasCenteredOnceRef.current = true;

      const clientPoint = [
        Number(clientPosition.latitude),
        Number(clientPosition.longitude),
      ];

      map.whenReady(() => {
        map.invalidateSize();
        map.flyTo(clientPoint, 10, { duration: 1.2 });
      });

      return;
    }

    hasCenteredOnceRef.current = false;

    map.whenReady(() => {
      map.invalidateSize();
      map.flyTo(ALGERIA_CENTER, 5, { duration: 1.2 });
    });
  }, [map, clientPosition]);

  return null;
}

function DestinationPicker({ active, clientPosition, onSelect }) {
  const map = useMap();
  const hasZoomedOnClientRef = useRef(false);

  useMapEvents({
    click(event) {
      if (active) {
        onSelect?.({
          latitude: event.latlng.lat,
          longitude: event.latlng.lng,
        });
      }
    },
  });

  useEffect(() => {
    if (!active) {
      hasZoomedOnClientRef.current = false;
      return;
    }
    if (!hasPosition(clientPosition) || hasZoomedOnClientRef.current) return;

    hasZoomedOnClientRef.current = true;
    map.flyTo(
      [Number(clientPosition.latitude), Number(clientPosition.longitude)],
      15,
      { duration: 0.8 }
    );
  }, [active, clientPosition, map]);

  return null;
}

function DestinationPickOverlay({ phase, label = "الوجهة" }) {
  if (!phase) return null;

  const isChoosing = phase === "choosing";

  return (
    <div className={`map-pick-overlay is-${phase}`}>
      {isChoosing && (
        <div className="map-pick-crosshair" aria-hidden="true">
          <span className="map-pick-halo" />
          <span className="map-pick-pin">📍</span>
        </div>
      )}

      <div className="map-pick-banner" role="status" aria-live="polite">
        <span className="map-pick-dot" aria-hidden="true" />
        <span>
          {isChoosing
            ? `جاري اختيار ${label} — انقر على الخريطة`
            : `تم اختيار ${label} — اضغط تأكيد ${label}`}
        </span>
      </div>
    </div>
  );
}

function RouteBounds({ positions, estimate }) {
  const map = useMap();
  const boundsPositions = estimate ? positions.slice(-1) : positions;
  const routeKey = boundsPositions.map(([latitude, longitude]) => `${latitude},${longitude}`).join("|");

  useEffect(() => {
    if (positions.length > 1) {
      map.fitBounds(positions, { padding: [36, 36], maxZoom: 14 });
    }
  }, [map, routeKey]);

  return null;
}

export default function CouriersMap({
  couriers = [],
  clientPosition,
  onRequestClientPosition,
  isLocating = false,
  selectingDestination = false,
  destinationPosition = null,
  originPosition = null,
  onSelectDestination,
  routeGeometry = null,
  allowRouteFallback = true,
  routeIsEstimate = false,
  pickingPhase = null,
  pickLabel = "الوجهة",
  onPickConfirm = null,
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
  const hasOriginPosition = hasPosition(originPosition);
  const hasDestinationPosition = hasPosition(destinationPosition);
  const route = Array.isArray(routeGeometry)
    ? routeGeometry.map(([longitude, latitude]) => [latitude, longitude])
    : [];
  // Trajet simple : uniquement départ → arrivée. Pas de chemin dessiné vers la
  // position GPS brute — le départ choisi (ou pré-rempli) est l'origine.
  const routePositions = route.length > 1
    ? route
    : allowRouteFallback && hasOriginPosition && hasDestinationPosition
      ? [
          [Number(originPosition.latitude), Number(originPosition.longitude)],
          [Number(destinationPosition.latitude), Number(destinationPosition.longitude)],
        ]
      : [];

  const center = hasClientPosition
    ? [
        Number(clientPosition.latitude),
        Number(clientPosition.longitude),
      ]
    : ALGERIA_CENTER;

  const zoom = hasClientPosition ? 10 : 5;

  return (
    <div
      className={selectingDestination ? "destination-map-picking" : ""}
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

        <LocateButton
          clientPosition={clientPosition}
          onRequestClientPosition={onRequestClientPosition}
          isLocating={isLocating}
        />

        <RecenterOnClient clientPosition={clientPosition} />

        <DestinationPicker
          active={selectingDestination}
          clientPosition={clientPosition}
          onSelect={onSelectDestination}
        />

        <RouteBounds positions={routePositions} estimate={routeIsEstimate} />

        {hasOriginPosition && (
          <Marker
            key="origin-position"
            position={[Number(originPosition.latitude), Number(originPosition.longitude)]}
            icon={originIcon}
          >
            <Popup>نقطة الانطلاق</Popup>
          </Marker>
        )}

        {hasClientPosition && !(hasOriginPosition
          && Number(clientPosition.latitude) === Number(originPosition.latitude)
          && Number(clientPosition.longitude) === Number(originPosition.longitude)) && (
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

        {hasDestinationPosition && (
          <Marker
            key="destination-position"
            position={[Number(destinationPosition.latitude), Number(destinationPosition.longitude)]}
          >
            <Popup>الوجهة المحددة</Popup>
          </Marker>
        )}

        {routePositions.length > 1 && (
          <Polyline
            positions={routePositions}
            pathOptions={{
              color: "#f97316",
              weight: 5,
              ...((routeIsEstimate || route.length < 2) && { dashArray: "8 8" }),
            }}
          />
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

      <DestinationPickOverlay phase={pickingPhase} label={pickLabel} />
    </div>
  );
}
