import test from "node:test";
import assert from "node:assert/strict";

import {
  isIOSDevice,
  isSafariBrowser,
  getLocationErrorMessage,
  getLocationSettingsUrl,
} from "./geolocation.js";

test("detects iPhone user agent", () => {
  const userAgent = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

  assert.equal(isIOSDevice(userAgent), true);
  assert.equal(isSafariBrowser(userAgent), true);
});

test("returns iOS-specific guidance for denied permission", () => {
  const message = getLocationErrorMessage({ code: 1 }, true);

  assert.match(message, /Réglages/i);
  assert.match(message, /Safari/i);
  assert.match(message, /Position/i);
});

test("returns iOS settings urls for Apple devices", () => {
  const urls = getLocationSettingsUrl();

  assert.ok(urls.length > 0);
  assert.ok(urls.some((url) => url.includes("app-settings") || url.includes("LOCATION_SERVICES")));
});

test("returns timeout guidance", () => {
  const message = getLocationErrorMessage({ code: 3 }, false);

  assert.match(message, /GPS|connexion|réessayez/i);
});
