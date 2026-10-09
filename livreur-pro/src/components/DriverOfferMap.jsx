import React, { useEffect } from "react";
import { MapPin } from "lucide-react";
import { MapContainer, Marker, Polyline, createMarkerIcon, useMap } from "./MapboxMap.jsx";

const pickupIcon = createMarkerIcon({ className: "driver-route-marker", html: '<span class="driver-route-pin is-pickup"></span>' });
const destinationIcon = createMarkerIcon({ className: "driver-route-marker", html: '<span class="driver-route-pin is-destination"></span>' });
const routePaint = { color: "#3478ec", weight: 5 };

function FitOfferRoute({ route }) {
  const map = useMap();
  const routeKey = JSON.stringify(route);
  useEffect(() => {
    if (!map.isDisposed()) map.fitBounds(route, { padding: [38, 38], maxZoom: 15, duration: 0 });
  }, [map, routeKey]);
  return null;
}

function DriverOfferMap({ route, pickup, destination }) {
  if (!route) {
    return <div className="driver-route-unavailable" role="status">
      <MapPin size={24} aria-hidden="true" />
      <span>المسار غير متوفر حالياً</span>
      <small>راجع نقطة الانطلاق والوصول أدناه.</small>
    </div>;
  }
  return <div className="driver-offer-map" role="region" aria-label="خريطة مسار الرحلة">
    <MapContainer center={route[0]} zoom={12} interactive={false} controls={false}
      loadingLabel="جارٍ تحميل الخريطة…" style={{ height: "100%", width: "100%" }}>
      <FitOfferRoute route={route} />
      <Polyline positions={route} pathOptions={routePaint} />
      {pickup && <Marker position={pickup} icon={pickupIcon} />}
      {destination && <Marker position={destination} icon={destinationIcon} />}
    </MapContainer>
  </div>;
}

// Polling creates new arrays; identical routes keep the existing map and camera.
export default React.memo(DriverOfferMap, (previous, next) =>
  JSON.stringify(previous) === JSON.stringify(next));
