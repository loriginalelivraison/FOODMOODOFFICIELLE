import test from "node:test";
import assert from "node:assert/strict";
import { clearStoredSession, getClientReturnPath } from "./navigation.js";
import { canFinishCourse } from "./courseTracking.js";
import { loginClient, logoutCurrentAccount, createCommentaireLivreur } from "../livreursapi.js";

function storage(values = {}) {
  const data = new Map(Object.entries(values));
  return { get length() { return data.size; }, key: (i) => [...data.keys()][i],
    getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key) };
}

test("session cleanup removes identities and trip state while preserving preferences", () => {
  const state = storage({ access: "old", client: "{}", role: "client", activeDriverCourseId: "4",
    currentClientCourseId: "5", livreurOnline: "true", activeTrackingCourse_7: "{}",
    "courseReviewSubmitted:5": "true", language: "ar", mapConsent: "true" });
  clearStoredSession(state);
  assert.equal(state.length, 2);
  assert.equal(state.getItem("language"), "ar");
  assert.equal(state.getItem("mapConsent"), "true");
});

test("client login opens the account unless a valid booking return path is stored", () => {
  assert.equal(getClientReturnPath(null), "/client-dashboard");
  assert.equal(getClientReturnPath("/livreurs"), "/livreurs");
  assert.equal(getClientReturnPath("/course/42"), "/course/42");
  assert.equal(getClientReturnPath("https://example.com"), "/client-dashboard");
});

test("legacy courses also need an assigned driver and started trip before completion", () => {
  for (const status of ["searching", "driver_accepted", "driver_selected", "driver_arriving", "driver_arrived", "picked_up"]) {
    assert.equal(canFinishCourse({ active: true, livreur: 7, destination: "", status }), false);
  }
  assert.equal(canFinishCourse({ active: true, livreur: null, status: "in_progress" }), false);
  assert.equal(canFinishCourse({ active: true, livreur: 7, status: "in_progress" }), true);
});

test("wrong-role login preserves the existing account", async (t) => {
  const state = storage({ role: "livreur", access: "existing", livreur: '{"id":7}' });
  t.mock.method(globalThis, "fetch", async (url) => new Response(JSON.stringify(
    url.endsWith("/token/") ? { access: "new", refresh: "new-refresh" } : []
  ), { status: 200 }));
  const previous = globalThis.localStorage;
  globalThis.localStorage = state;
  try {
    await assert.rejects(loginClient({ telephone: "0555000000", password: "existing" }));
    assert.equal(state.getItem("access"), "existing");
    assert.equal(state.getItem("role"), "livreur");
  } finally { globalThis.localStorage = previous; }
});

test("logout clears local session even when notification cleanup fails", async (t) => {
  const previousStorage = globalThis.localStorage;
  const previousWindow = globalThis.window;
  globalThis.localStorage = storage({ role: "livreur", access: "old", livreur: '{"id":7}', activeDriverCourseId: "42" });
  let authChanged = false;
  globalThis.window = { dispatchEvent: (event) => { authChanged = event.type === "authChanged"; } };
  t.mock.method(globalThis, "fetch", async () => { throw new Error("Network unavailable"); });
  try {
    await logoutCurrentAccount();
    assert.equal(globalThis.localStorage.getItem("access"), null);
    assert.equal(globalThis.localStorage.getItem("activeDriverCourseId"), null);
    assert.equal(authChanged, true);
  } finally { globalThis.localStorage = previousStorage; globalThis.window = previousWindow; }
});

test("review submission authenticates the client", async (t) => {
  const previous = globalThis.localStorage;
  globalThis.localStorage = storage({ access: "client-token", role: "client" });
  t.mock.method(globalThis, "fetch", async (_url, options) => {
    assert.equal(options.headers.Authorization, "Bearer client-token");
    return new Response(JSON.stringify({ id: 1 }), { status: 201 });
  });
  try { assert.equal((await createCommentaireLivreur({ livreur: 7, note: 5, message: "Good" })).id, 1); }
  finally { globalThis.localStorage = previous; }
});
