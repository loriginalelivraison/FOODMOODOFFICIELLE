import test from "node:test";
import assert from "node:assert/strict";

import {
  isIOSDevice,
  isSafariBrowser,
  getLocationErrorMessage,
  getLocationSettingsUrl,
  requestUserPosition,
} from "./geolocation.js";

function mockGeolocation(t, getCurrentPosition) {
  const original = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: { geolocation: { getCurrentPosition } },
  });
  t.after(() => {
    if (original) Object.defineProperty(globalThis, "navigator", original);
    else delete globalThis.navigator;
  });
}

test("detects iPhone user agent", () => {
  const userAgent = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

  assert.equal(isIOSDevice(userAgent), true);
  assert.equal(isSafariBrowser(userAgent), true);
});

test("returns Arabic iOS guidance for denied permission", () => {
  const message = getLocationErrorMessage({ code: 1 }, true);

  assert.match(message, /Safari/i);
  assert.match(message, /الموقع/i);
});

test("returns iOS settings urls for Apple devices", () => {
  const urls = getLocationSettingsUrl("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)");

  assert.ok(urls.length > 0);
  assert.ok(urls.some((url) => url.includes("app-settings") || url.includes("LOCATION_SERVICES")));
});

test("returns Arabic timeout guidance", () => {
  const message = getLocationErrorMessage({ code: 3 }, false);

  assert.match(message, /الموقع|الاتصال/i);
});

test("retries a precise timeout or unavailable fix once with standard accuracy", async (t) => {
  for (const code of [2, 3]) {
    await t.test(`error code ${code}`, async (subtest) => {
      const calls = [];
      const position = { coords: { latitude: 48.9, longitude: 2.1 } };
      mockGeolocation(subtest, (resolve, reject, options) => {
        calls.push(options);
        if (calls.length === 1) reject({ code, message: "Precise location unavailable" });
        else resolve(position);
      });
      assert.equal(await requestUserPosition({
        retryWithLowAccuracy: true, timeout: 20000, maximumAge: 10000,
      }), position);
      assert.deepEqual(calls, [
        { enableHighAccuracy: true, timeout: 20000, maximumAge: 10000 },
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 10000 },
      ]);
    });
  }
});

test("a successful precise fix needs no fallback", async (t) => {
  let calls = 0;
  const position = { coords: { latitude: 48.9, longitude: 2.1 } };
  mockGeolocation(t, (resolve) => {
    calls += 1;
    resolve(position);
  });
  assert.equal(await requestUserPosition({ retryWithLowAccuracy: true }), position);
  assert.equal(calls, 1);
});

test("permission denial is returned without a retry", async (t) => {
  let calls = 0;
  const denied = { code: 1, message: "Permission denied" };
  mockGeolocation(t, (resolve, reject) => {
    calls += 1;
    reject(denied);
  });
  await assert.rejects(requestUserPosition({ retryWithLowAccuracy: true }), (error) => error === denied);
  assert.equal(calls, 1);
});

test("a failed standard fix is returned without further retries", async (t) => {
  let calls = 0;
  const preciseError = { code: 3, message: "Precise timeout" };
  const standardError = { code: 2, message: "No location provider" };
  mockGeolocation(t, (resolve, reject) => {
    calls += 1;
    reject(calls === 1 ? preciseError : standardError);
  });
  await assert.rejects(requestUserPosition({ retryWithLowAccuracy: true }), (error) => error === standardError);
  assert.equal(calls, 2);
});

test("existing callers keep their requested accuracy and do not retry automatically", async (t) => {
  const calls = [];
  const timeout = { code: 3, message: "Timeout" };
  mockGeolocation(t, (resolve, reject, options) => {
    calls.push(options);
    reject(timeout);
  });
  await assert.rejects(requestUserPosition(), (error) => error === timeout);
  assert.deepEqual(calls, [{ enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }]);
});

test("standard accuracy requests do not retry even when fallback is enabled", async (t) => {
  let calls = 0;
  const unavailable = { code: 2, message: "Unavailable" };
  mockGeolocation(t, (resolve, reject) => {
    calls += 1;
    reject(unavailable);
  });
  await assert.rejects(requestUserPosition({
    enableHighAccuracy: false, retryWithLowAccuracy: true,
  }), (error) => error === unavailable);
  assert.equal(calls, 1);
});
