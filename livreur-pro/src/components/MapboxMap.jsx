import React, { createContext, useContext, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import "mapbox-gl/dist/mapbox-gl.css";

const MapContext = createContext(null);
const MarkerContext = createContext(null);
const lngLat = ([lat, lng]) => [Number(lng), Number(lat)];
export const createMarkerIcon = (options) => options;
export const useMap = () => useContext(MapContext);

export function MapContainer({ center, zoom, style, children }) {
  const container = useRef(null);
  const initial = useRef({ center, zoom });
  const [adapter, setAdapter] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let disposed = false;
    let map;
    let resize;
    let started = false;
    const token = import.meta.env.VITE_MAPBOX_TOKEN?.trim();
    if (!token || !token.startsWith("pk.")) {
      setError("Configurez un token public Mapbox dans VITE_MAPBOX_TOKEN.");
      return;
    }
    async function initialize() {
      if (started || disposed) return;
      started = true;
      try {
        const { default: gl } = await import("mapbox-gl");
        if (disposed) return;
        map = new gl.Map({
          container: container.current, accessToken: token,
          style: "mapbox://styles/mapbox/streets-v12",
          center: lngLat(initial.current.center), zoom: initial.current.zoom,
        });
        map.addControl(new gl.NavigationControl({ showCompass: false }), "top-left");
        map.on("error", () => setError("La carte est indisponible. Vérifiez le réseau et les restrictions du token Mapbox."));
        map.on("load", () => setError(""));
        resize = new ResizeObserver(() => map.resize());
        resize.observe(container.current);
        setAdapter({
          raw: map, gl,
          flyTo: (point, level, options = {}) => map.flyTo({ center: lngLat(point), zoom: level, duration: (options.duration ?? 1.2) * 1000 }),
          fitBounds: (points, options) => {
            const bounds = new gl.LngLatBounds();
            points.forEach((point) => bounds.extend(lngLat(point)));
            map.fitBounds(bounds, { ...options, padding: options.padding?.[0] ?? 36 });
          },
          invalidateSize: () => map.resize(),
          whenReady: (callback) => callback(),
        });
      } catch {
        if (!disposed) setError("Impossible de charger la carte Mapbox.");
      }
    }
    const visibility = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        visibility.disconnect();
        initialize();
      }
    });
    visibility.observe(container.current);
    return () => {
      disposed = true;
      visibility.disconnect();
      resize?.disconnect();
      map?.remove();
    };
  }, []);
  return <div style={{ ...style, position: "relative" }}>
    <div ref={container} className="mapbox-map-container" style={{ height: "100%", width: "100%" }} />
    {adapter && <MapContext.Provider value={adapter}>{children}</MapContext.Provider>}
    {error && <div className="mapbox-error" role="alert">{error}</div>}
  </div>;
}

export function useMapEvents(events) {
  const map = useMap();
  const latest = useRef(events);
  latest.current = events;
  useEffect(() => {
    const click = (event) => latest.current.click?.({ latlng: event.lngLat });
    map.raw.on("click", click);
    return () => map.raw.off("click", click);
  }, [map]);
}

export function Marker({ position, icon, children }) {
  const map = useMap();
  const instance = useRef(null);
  const [marker, setMarker] = useState(null);
  const iconKey = JSON.stringify(icon);
  useEffect(() => {
    const element = icon ? document.createElement("div") : undefined;
    if (element) {
      element.className = icon.className || "";
      element.innerHTML = icon.html || "";
    }
    const next = new map.gl.Marker(element ? { element } : { color: "#f97316" })
      .setLngLat(lngLat(position)).addTo(map.raw);
    instance.current = next;
    setMarker(next);
    return () => { next.remove(); instance.current = null; };
  }, [map, iconKey]);
  useEffect(() => { instance.current?.setLngLat(lngLat(position)); }, [position[0], position[1]]);
  return marker && <MarkerContext.Provider value={marker}>{children}</MarkerContext.Provider>;
}

export function Popup({ children }) {
  const map = useMap();
  const marker = useContext(MarkerContext);
  const [container] = useState(() => document.createElement("div"));
  useEffect(() => {
    const popup = new map.gl.Popup({ offset: 20 }).setDOMContent(container);
    marker.setPopup(popup);
    return () => { popup.remove(); marker.setPopup(null); };
  }, [map, marker, container]);
  return createPortal(children, container);
}

export function Polyline({ positions, pathOptions }) {
  const map = useMap();
  const id = useId();
  const latest = useRef(null);
  const key = JSON.stringify([positions, pathOptions]);
  latest.current = { positions, pathOptions };
  useEffect(() => {
    const update = () => {
      const current = latest.current;
      const data = { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: current.positions.map(lngLat) } };
      const paint = { "line-color": current.pathOptions.color, "line-width": current.pathOptions.weight, "line-dasharray": current.pathOptions.dashArray ? [2, 2] : [1, 0] };
      if (!map.raw.getSource(id)) {
        map.raw.addSource(id, { type: "geojson", data });
        map.raw.addLayer({ id, type: "line", source: id, layout: { "line-cap": "round", "line-join": "round" }, paint });
      } else {
        map.raw.getSource(id).setData(data);
        Object.entries(paint).forEach(([name, value]) => map.raw.setPaintProperty(id, name, value));
      }
    };
    if (map.raw.isStyleLoaded()) update();
    else map.raw.once("load", update);
    return () => map.raw.off("load", update);
  }, [map, id, key]);
  useEffect(() => () => {
    if (map.raw.getLayer(id)) map.raw.removeLayer(id);
    if (map.raw.getSource(id)) map.raw.removeSource(id);
  }, [map, id]);
  return null;
}
