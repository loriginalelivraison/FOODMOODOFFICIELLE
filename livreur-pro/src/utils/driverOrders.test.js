import test from "node:test";
import assert from "node:assert/strict";
import { getOfferPresentation, groupDriverCourses, mergeDriverCourses } from "./driverOrders.js";

const offer = { id: 42, livreur: null, status: "searching", my_offer_response: "pending",
  proposed_price: "380.50", final_price: "500", trip_distance_km: 6.2,
  estimated_distance_km: 9, my_offer_dropoff_eta_minutes: 12, dropoff_eta_minutes: 20,
  pickup_latitude: 36.75, pickup_longitude: 3.06,
  destination_latitude: 36.8, destination_longitude: 3.1,
  trip_route_geometry: [[3.06, 36.75], [3.07, 36.76], [3.1, 36.8]],
};

test("offer map uses the stored road route in latitude/longitude order and matching backend trip metrics", () => {
  assert.deepEqual(getOfferPresentation(offer), {
    route: [[36.75, 3.06], [36.76, 3.07], [36.8, 3.1]], pickup: [36.75, 3.06],
    destination: [36.8, 3.1], price: 380.5, distance: 6.2, minutes: 12,
  });
});

test("missing or corrupt routing never becomes an invented straight line", () => {
  for (const trip_route_geometry of [null, [], [[3.06, 36.75]], [[3.06, 36.75], [null, 36.8]], [[3.06, 36.75], [3.1, 100]]]) {
    assert.equal(getOfferPresentation({ ...offer, trip_route_geometry }).route, null);
  }
  assert.deepEqual(getOfferPresentation({ ...offer, trip_route_geometry: null, route_geometry: offer.trip_route_geometry }).route,
    [[36.75, 3.06], [36.76, 3.07], [36.8, 3.1]]);
});

test("missing estimates stay missing while legitimate zero values are preserved", () => {
  const absent = getOfferPresentation({ trip_distance_km: "", dropoff_eta_minutes: null });
  assert.equal(absent.distance, null);
  assert.equal(absent.minutes, null);
  assert.equal(absent.price, null);
  assert.equal(absent.route, null);
  const zero = getOfferPresentation({ trip_distance_km: 0, my_offer_dropoff_eta_minutes: 0, proposed_price: 0 });
  assert.equal(zero.distance, 0);
  assert.equal(zero.minutes, 0);
  assert.equal(zero.price, 0);
});

test("driver groups retain the real pending, accepted, assigned and closed states", () => {
  const accepted = { ...offer, id: 43, status: "driver_accepted", my_offer_response: "accepted" };
  const ongoing = { ...offer, id: 44, livreur: 7, status: "in_progress" };
  const courses = [offer, accepted, ongoing, { ...ongoing, id: 45, status: "completed" },
    { ...ongoing, id: 46, status: "cancelled" }, { ...ongoing, id: 47, livreur: 9 },
    { ...offer, id: 48, my_offer_response: "withdrawn" }];
  assert.deepEqual(groupDriverCourses(courses, 7), { toAccept: [offer], waiting: [accepted], ongoing: [ongoing] });
});

test("existing course state wins over a stale offer and active-course responses update assigned courses without duplicates", () => {
  const accepted = { ...offer, my_offer_response: "accepted" };
  const newOffer = { ...offer, id: 43 };
  const active = { ...accepted, livreur: 7, status: "driver_selected" };
  assert.deepEqual(mergeDriverCourses([accepted], [offer, newOffer], null), [accepted, newOffer]);
  assert.deepEqual(mergeDriverCourses([accepted], [offer, newOffer], active), [active, newOffer]);
});
