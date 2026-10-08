import test from "node:test";
import assert from "node:assert/strict";
import { destinations } from "../data/destinations.js";
import { searchDestinations, destinationCoordinates, rememberDestination, readDestinationHistory, HISTORY_KEY } from "./destinationSearch.js";

test("table complète avec identifiants et coordonnées fournis", () => {
  assert.equal(destinations.length, 51);
  assert.equal(new Set(destinations.map((place) => place.id)).size, 51);
  assert.deepEqual(destinationCoordinates(destinations.find((place) => place.id === 4)), { latitude: 35.8286516, longitude: -0.0143553 });
  assert.ok(destinations.every((place) => destinationCoordinates(place)));
});
test("recherche progressive arabe/français sans accents ni diacritiques", () => {
  assert.ok(searchDestinations("ain tedeles").some((place) => place.id === 5));
  assert.ok(searchDestinations("أَوْلَاد").some((place) => place.id === 15));
  assert.deepEqual(searchDestinations("cote ouest").map((place) => place.id), [168]);
  const broad = searchDestinations("sidi");
  assert.ok(searchDestinations("sidi lak").every((place) => broad.includes(place)));
  assert.deepEqual(searchDestinations("lieu inconnu"), []);
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
