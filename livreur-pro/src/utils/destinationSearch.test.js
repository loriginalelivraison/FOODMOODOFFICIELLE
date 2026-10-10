import test from "node:test";
import assert from "node:assert/strict";
import { destinations } from "../data/destinations.js";
import osmDestinations from "../data/osmDestinations.js";
import { searchDestinations, destinationCoordinates, rememberDestination, readDestinationHistory, suggestedDeliveryPickups, suggestedDestinations, HISTORY_KEY } from "./destinationSearch.js";

test("table complète avec identifiants et coordonnées fournis", () => {
  assert.equal(osmDestinations.length, 3807);
  assert.equal(destinations.length, 53 + 33 + osmDestinations.length);
  assert.equal(new Set(destinations.map((place) => place.id)).size, destinations.length);
  assert.deepEqual(destinationCoordinates(destinations.find((place) => place.id === 4)), { latitude: 35.8286516, longitude: -0.0143553 });
  assert.equal(destinations.filter((place) => !destinationCoordinates(place)).length, 7);
});
test("les 33 lieux fournis sont conservés, y compris ceux sans coordonnées", () => {
  const supplied = destinations.filter((place) => String(place.id).startsWith("mostaganem:"));
  assert.equal(supplied.length, 33);
  assert.equal(supplied.filter((place) => destinationCoordinates(place)).length, 26);
  assert.deepEqual(destinationCoordinates(supplied.find((place) => place.id === "mostaganem:14")),
    { latitude: 35.93042, longitude: 0.14025 });
  assert.ok(searchDestinations("سيدي فلاق").some((place) => place.id === "mostaganem:14"));
  assert.ok(searchDestinations("montplaisir").some((place) => place.id === "mostaganem:29"));
  assert.equal(destinationCoordinates(supplied.find((place) => place.id === "mostaganem:29")), null);
});
test("les trois suggestions vides sont des lieux sélectionnables et recherchables", () => {
  assert.deepEqual(suggestedDestinations.map((place) => place.name_fr), [
    "Centre commercial Louisa", "Mostaland", "Kharrouba",
  ]);
  assert.ok(suggestedDestinations.every((place) => destinationCoordinates(place)));
  assert.ok(searchDestinations("kharrouba").some((place) => place.id === 171));
  assert.deepEqual(suggestedDeliveryPickups.map((place) => place.name_fr), [
    "Mouna Pâtisserie", "Pizzeria Le Five", "Karantika Kahla 1",
  ]);
  assert.ok(suggestedDeliveryPickups.every((place) => destinationCoordinates(place)));
  assert.ok(searchDestinations("karantika kahla").some((place) => place.id === 172));
});
test("recherche progressive arabe/français sans accents ni diacritiques", () => {
  assert.ok(searchDestinations("ain tedeles").some((place) => place.id === 5));
  assert.ok(searchDestinations("أَوْلَاد").some((place) => place.id === 15));
  assert.ok(searchDestinations("cote ouest").some((place) => place.id === 168));
  const broad = searchDestinations("sidi");
  assert.ok(searchDestinations("sidi lak").every((place) => broad.includes(place)));
  assert.deepEqual(searchDestinations("lieu inconnu"), []);
});

test("les points du GeoJSON sont recherchables avec leurs noms et coordonnées", () => {
  const oran = searchDestinations("Oran").find((place) => place.id === "osm:node/27565103");
  assert.ok(oran);
  assert.equal(oran.name_ar, "وهران");
  assert.deepEqual(destinationCoordinates(oran), { latitude: 35.7044415, longitude: -0.6502981 });
  assert.ok(searchDestinations("وهران").some((place) => place.id === oran.id));
  assert.ok(destinations.filter((place) => String(place.id).startsWith("osm:")).every((place) => destinationCoordinates(place)));
});
test("historique persistant limité à dix, sans doublons et récent en premier", () => {
  const data = new Map();
  const storage = { getItem: (key) => data.get(key), setItem: (key, value) => data.set(key, value) };
  destinations.slice(0, 12).forEach((place) => rememberDestination(place, storage));
  assert.deepEqual(readDestinationHistory(storage).map((place) => place.id), [12, 11, 10, 9, 8, 7, 6, 5, 4, 3]);
  rememberDestination(destinations[5], storage);
  assert.equal(readDestinationHistory(storage)[0].id, 6);
  assert.equal(readDestinationHistory(storage).length, 10);
  data.set(HISTORY_KEY, "invalid");
  assert.deepEqual(readDestinationHistory(storage), []);
});
test("coordonnées manquantes nécessitent un choix sur la carte", () => {
  assert.equal(destinationCoordinates({ latitude: null, longitude: 0 }), null);
  assert.equal(destinationCoordinates({ latitude: "", longitude: 0 }), null);
  assert.equal(destinationCoordinates({ latitude: 35, longitude: undefined }), null);
  assert.equal(destinationCoordinates({ latitude: 100, longitude: 0 }), null);
});
