import test from "node:test";
import assert from "node:assert/strict";
import { canFinishCourse, getCourseSteps, getCourseStepIndex, getCourseTarget, getDriverCourseHint, getCourseStatusLabel } from "./courseTracking.js";

const base = {
  active: true, livreur: 7, client_latitude: 36.75, client_longitude: 3.05,
  pickup_latitude: 36.7, pickup_longitude: 3.1,
  destination: "Destination", destination_latitude: 36.8, destination_longitude: 3.2,
};

test("navigation approaches the selected pickup for both vehicles then targets dropoff", () => {
  for (const vehicle_type of ["voiture", "moto", "camion"]) {
    for (const status of ["driver_selected", "driver_arriving", "driver_arrived"]) {
      assert.deepEqual(getCourseTarget({ ...base, vehicle_type, status }), { latitude: 36.7, longitude: 3.1 });
    }
    for (const status of ["picked_up", "in_progress"]) {
      assert.deepEqual(getCourseTarget({ ...base, vehicle_type, status }), { latitude: 36.8, longitude: 3.2 });
    }
    assert.equal(getCourseTarget({ ...base, vehicle_type, status: "completed" }), null);
  }
});

test("new bookings cannot be finished before the trip starts", () => {
  for (const vehicle_type of ["voiture", "moto", "camion"]) {
    for (const status of ["driver_selected", "driver_arriving", "driver_arrived", "picked_up", "cancelled", "completed"]) {
      assert.equal(canFinishCourse({ ...base, vehicle_type, status }), false);
    }
    assert.equal(canFinishCourse({ ...base, vehicle_type, status: "in_progress" }), true);
  }
  assert.equal(canFinishCourse({ ...base, active: false, status: "in_progress" }), false);
});

test("driver arrival is the pickup phase and does not announce collected or delivered", () => {
  const status = "driver_arrived";
  assert.equal(getCourseSteps("moto")[getCourseStepIndex(status)], "الاستلام");
  assert.equal(getCourseSteps("voiture")[getCourseStepIndex("in_progress")], "الرحلة");
  assert.equal(getCourseStatusLabel({ vehicle_type: "moto", status }), "وصل إلى نقطة الاستلام");
  assert.match(getDriverCourseHint({ vehicle_type: "voiture", status }), /الراكب/);
  assert.doesNotMatch(getDriverCourseHint({ vehicle_type: "voiture", status }), /الطلب/);
});

test("legacy pickup falls back to client GPS but missing trip destinations stay unavailable", () => {
  assert.deepEqual(getCourseTarget({ ...base, pickup_latitude: null, pickup_longitude: null, status: "driver_selected" }),
    { latitude: 36.75, longitude: 3.05 });
  assert.equal(getCourseTarget({ ...base, destination_latitude: null, status: "in_progress" }), null);
});
