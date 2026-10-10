import { destinations } from "../data/destinations.js";

export const HISTORY_KEY = "winrak:destination-history";
export function normalizeSearch(value) {
  return String(value).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f\u064b-\u065f\u0670\u0640]/g, "")
    .replace(/[أإآٱ]/g, "ا").replace(/ى/g, "ي").replace(/œ/g, "oe")
    .replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}
const index = destinations.map((place) => ({ place, text: normalizeSearch(`${place.search_name} ${place.search_aliases || ""} ${place.commune_secteur} ${place.category}`) }));
export const suggestedDestinations = [34, 33, 171].map((id) => destinations.find((place) => place.id === id));
export const suggestedDeliveryPickups = [116, 123, 172].map((id) => destinations.find((place) => place.id === id));
export function searchDestinations(query) {
  const words = normalizeSearch(query).split(" ").filter(Boolean);
  return index.filter(({ text }) => words.every((word) => text.includes(word))).map(({ place }) => place);
}
export function destinationCoordinates(place) {
  const { latitude, longitude } = place;
  return latitude != null && longitude != null && latitude !== "" && longitude !== ""
    && Number.isFinite(Number(latitude)) && Number.isFinite(Number(longitude))
    && Math.abs(Number(latitude)) <= 90 && Math.abs(Number(longitude)) <= 180
    ? { latitude: Number(latitude), longitude: Number(longitude) } : null;
}
export function readDestinationHistory(storage = globalThis.localStorage) {
  try {
    const saved = JSON.parse(storage.getItem(HISTORY_KEY) || "[]");
    if (!Array.isArray(saved)) return [];
    return [...new Set(saved)].map((id) => destinations.find((place) => place.id === id)).filter(Boolean).slice(0, 10);
  } catch { return []; }
}
export function rememberDestination(place, storage = globalThis.localStorage) {
  const next = [place, ...readDestinationHistory(storage).filter((item) => item.id !== place.id)].slice(0, 10);
  try { storage.setItem(HISTORY_KEY, JSON.stringify(next.map((item) => item.id))); } catch { /* Recherche disponible sans stockage. */ }
  return next;
}
