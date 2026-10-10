export function readStoredAccount(key, storage = globalThis.localStorage) {
  try {
    const account = JSON.parse(storage.getItem(key) || "null");
    return account && typeof account === "object" && !Array.isArray(account) ? account : null;
  } catch {
    return null;
  }
}

export function isValidId(id) {
  return /^[1-9]\d*$/.test(String(id));
}

export function getHomePath(storage = globalThis.localStorage) {
  if (storage.getItem("access") && storage.getItem("role") === "livreur") {
    const driver = readStoredAccount("livreur", storage);
    return isValidId(driver?.id) ? `/livreur-dashboard/${driver.id}` : "/inscription-livreur";
  }
  return "/livreurs";
}

export function getDriverDashboardPath(courseDriverId, storage = globalThis.localStorage) {
  if (!storage.getItem("access")) return "/inscription-livreur";
  if (storage.getItem("role") !== "livreur") return getHomePath(storage);
  const id = readStoredAccount("livreur", storage)?.id || courseDriverId;
  return isValidId(id) ? `/livreur-dashboard/${id}` : "/inscription-livreur";
}

export function clearCurrentClientCourse(courseId, storage = globalThis.localStorage) {
  if (String(storage.getItem("currentClientCourseId")) === String(courseId)) {
    storage.removeItem("currentClientCourseId");
  }
}

export function getClientReturnPath(path) {
  return typeof path === "string" && /^\/(livreurs|client-dashboard|course\/[1-9]\d*|tracking\/[1-9]\d*)$/.test(path)
    ? path : "/client-dashboard";
}

export function clearStoredSession(storage = globalThis.localStorage) {
  const keys = ["access", "refresh", "role", "client", "livreur", "redirectAfterLogin",
    "currentClientCourseId", "activeDriverCourseId", "livreurOnline"];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key?.startsWith("activeTrackingCourse_") || key?.startsWith("courseReviewSubmitted:")) keys.push(key);
  }
  keys.forEach((key) => storage.removeItem(key));
}
