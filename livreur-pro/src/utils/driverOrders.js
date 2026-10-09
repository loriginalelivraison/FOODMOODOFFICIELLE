import { getPickupPosition } from "./courseTracking.js";

export function canRespondToDriverOffer(course) {
  return Boolean(course && course.active !== false && !course.livreur
    && ["searching", "driver_accepted"].includes(course.status)
    && course.my_offer_response === "pending"
    && (course.my_offer_expires_in == null || Number(course.my_offer_expires_in) > 0));
}

export function groupDriverCourses(courses, livreurId) {
  const ongoing = [], toAccept = [], waiting = [];
  (Array.isArray(courses) ? courses : []).forEach((course) => {
    if (!course || course.active === false) return;
    if (course.livreur != null && Number(course.livreur) === Number(livreurId)
      && !["completed", "cancelled"].includes(course.status)) {
      ongoing.push(course);
    } else if (!course.livreur && ["searching", "driver_accepted"].includes(course.status)) {
      if (canRespondToDriverOffer(course)) toAccept.push(course);
      else if (course.my_offer_response === "accepted") waiting.push(course);
    }
  });
  return { ongoing, toAccept, waiting };
}

export function mergeDriverCourses(courses, offers, activeCourse) {
  const records = new Map((courses || []).map((course) => [String(course.id), course]));
  (offers || []).forEach((course) => {
    if (!records.has(String(course.id))) records.set(String(course.id), course);
  });
  if (activeCourse) records.set(String(activeCourse.id), activeCourse);
  return [...records.values()];
}

function numericValue(value) {
  if (value == null || value === "" || !Number.isFinite(Number(value)) || Number(value) < 0) return null;
  return Number(value);
}

function isCoordinate(point) {
  return Array.isArray(point) && point.length >= 2
    && point[0] != null && point[1] != null && point[0] !== "" && point[1] !== ""
    && Number.isFinite(Number(point[0])) && Number.isFinite(Number(point[1]))
    && Math.abs(Number(point[0])) <= 180 && Math.abs(Number(point[1])) <= 90;
}

export function getOfferPresentation(course) {
  // Only use the backend's stored road route; never invent a straight line.
  const geometry = [course.trip_route_geometry, course.route_geometry].find((candidate) =>
    Array.isArray(candidate) && candidate.length > 1 && candidate.every(isCoordinate));
  const route = geometry ? geometry.map(([longitude, latitude]) => [Number(latitude), Number(longitude)]) : null;
  const pickup = getPickupPosition(course);
  const destination = isCoordinate([course.destination_longitude, course.destination_latitude])
    ? [Number(course.destination_latitude), Number(course.destination_longitude)] : route?.at(-1);
  return {
    route,
    pickup: pickup && isCoordinate([pickup.longitude, pickup.latitude])
      ? [pickup.latitude, pickup.longitude] : route?.[0],
    destination,
    distance: numericValue(course.trip_distance_km ?? course.estimated_distance_km),
    minutes: numericValue(course.my_offer_dropoff_eta_minutes ?? course.dropoff_eta_minutes),
    price: numericValue(course.proposed_price ?? course.final_price),
  };
}

export function formatDriverNumber(value) {
  return value == null ? "—" : Number(value).toLocaleString("fr-DZ", { maximumFractionDigits: 2 });
}
