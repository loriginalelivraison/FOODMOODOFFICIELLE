import { toArabicMessage } from "./utils/messagesAr.js";
import { clearStoredSession, readStoredAccount } from "./utils/navigation.js";

const API_BASE_URL =
  import.meta.env?.VITE_API_BASE_URL || "http://127.0.0.1:8000/api";

function getCleanToken() {
  return localStorage.getItem("access")?.replaceAll('"', "").trim();
}

let redirectingToLogin = false;
function handleInvalidToken(data) {
  const message = JSON.stringify(data || "");

  if (
    message.includes("Given token not valid") ||
    message.includes("token_not_valid") ||
    message.includes("Token is invalid") ||
    message.includes("Token is expired")
  ) {
    if (redirectingToLogin) return;
    redirectingToLogin = true;
    const loginPath = localStorage.getItem("role") === "livreur" ? "/inscription-livreur" : "/connexion-client";
    clearStoredSession();
    window.dispatchEvent(new Event("authChanged"));
    window.location.replace(loginPath);
  }
}

function authHeaders(extra = {}) {
  const token = getCleanToken();

  return {
    ...extra,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function requireClientRole() {
  if (localStorage.getItem("role") !== "client" || !getCleanToken()) {
    throw new Error("يلزم حساب عميل لطلب رحلة. سجّل الدخول بحساب عميل.");
  }
}

function registrationMessage(data, fallback) {
  if (data.password) return toArabicMessage(data.password, "اختر كلمة مرور من 8 أحرف على الأقل، غير شائعة ولا تتكوّن من أرقام فقط.");
  if (data.nom) return toArabicMessage(data.nom, "أدخل اسماً صحيحاً من 100 حرف كحد أقصى.");
  if (data.ville) return toArabicMessage(data.ville, "أدخل المدينة.");
  if (data.photo) return toArabicMessage(data.photo, "اختر صورة صالحة للحساب.");
  return toArabicMessage(data.error || data.detail || data.telephone || data, fallback);
}

export async function getDriverDocuments(id) {
  const response = await fetch(`${API_BASE_URL}/livreurs/${id}/documents/`, { headers: authHeaders() });
  const data = await response.json();
  if (!response.ok) throw new Error(toArabicMessage(data.detail, "تعذر تحميل الوثائق."));
  return data;
}

export async function uploadDriverDocument(id, kind, file) {
  const form = new FormData();
  form.append("kind", kind);
  form.append("file", file);
  const response = await fetch(`${API_BASE_URL}/livreurs/${id}/documents/`, {
    method: "POST", headers: authHeaders(), body: form,
  });
  const data = await response.json();
  if (!response.ok) throw new Error(toArabicMessage(data.detail, "تعذر إرسال الوثيقة."));
  return data;
}

export async function downloadDriverDocument(id, kind) {
  const response = await fetch(`${API_BASE_URL}/livreurs/${id}/documents/${kind}/download/`, { headers: authHeaders() });
  if (!response.ok) throw new Error("تعذر فتح الوثيقة.");
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = `${kind}.${response.headers.get("Content-Type")?.includes("png") ? "png" : "jpg"}`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

export async function getLivreurs() {
  const response = await fetch(`${API_BASE_URL}/livreurs/?format=json`);

  if (!response.ok) {
    throw new Error(toArabicMessage(null, "حدث خطأ أثناء تحميل قائمة السائقين."));
  }

  return response.json();
}

export async function getLivreurById(id) {
  const response = await fetch(`${API_BASE_URL}/livreurs/${id}/?format=json`, {
    headers: getCleanToken() ? authHeaders() : {},
  });

  if (!response.ok) {
    throw new Error(toArabicMessage(null, "لم يتم العثور على السائق."));
  }

  return response.json();
}

export async function loginJWT(credentials) {
  const response = await fetch(`${API_BASE_URL}/token/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      username: credentials.telephone,
      password: credentials.password,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(toArabicMessage(data.detail, "تعذر تسجيل الدخول."));
  }

  const profileResponse = await fetch(`${API_BASE_URL}/livreurs/me/`, {
    headers: { Authorization: `Bearer ${data.access}` },
  });
  const livreur = profileResponse.ok ? await profileResponse.json() : null;

  if (!livreur) {
    throw new Error("هذا الحساب ليس حساب سائق. يرجى تسجيل الدخول من فضاء العميل.");
  }

  const redirectAfterLogin = localStorage.getItem("redirectAfterLogin");

  await clearCurrentDriverFcmToken().catch(() => {});

  clearStoredSession();

  if (redirectAfterLogin) {
    localStorage.setItem("redirectAfterLogin", redirectAfterLogin);
  }

  localStorage.setItem("access", data.access);
  localStorage.setItem("refresh", data.refresh);
  localStorage.setItem("role", "livreur");

  localStorage.setItem(
    "livreur",
    JSON.stringify({
      id: livreur.id,
      nom: livreur.nom || credentials.nom || "سائق",
      telephone: credentials.telephone,
      ville: livreur.ville,
      vehicule: livreur.vehicule,
      modele_vehicule: livreur.modele_vehicule || "",
      photo: livreur.photo,
    })
  );

  window.dispatchEvent(new Event("authChanged"));
  return data;
}

export async function createLivreur(livreur) {
  const response = await fetch(`${API_BASE_URL}/livreurs/register/`, {
    method: "POST",
    body: livreur,
  });

  const text = await response.text();

  let data;

  try {
    data = JSON.parse(text);
  } catch {
    console.error("Réponse non JSON reçue :", text);
    throw new Error(toArabicMessage(null, "أرسل الخادم استجابة غير صالحة."));
  }

  if (!response.ok) {
    throw new Error(
      registrationMessage(
        data,
        "حدث خطأ أثناء إنشاء حساب السائق."
      )
    );
  }

  return data;
}

export async function updateLivreurPosition(id, position) {
  const response = await fetch(`${API_BASE_URL}/livreurs/${id}/update_position/`, {
    method: "PATCH",
    headers: authHeaders({
      "Content-Type": "application/json",
    }),
    body: JSON.stringify(position),
  });

  const data = await response.json();

  if (!response.ok) {
    handleInvalidToken(data);
    console.log("Erreur Django update_position :", data);
    throw new Error(
      toArabicMessage(data.detail || data.error, "حدث خطأ أثناء تحديث الموقع.")
    );
  }

  return data;
}

export async function clearLivreurFcmToken(id) {
  const response = await fetch(`${API_BASE_URL}/livreurs/${id}/clear_fcm_token/`, {
    method: "DELETE",
    headers: authHeaders(),
    signal: AbortSignal.timeout(5000),
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    handleInvalidToken(data);
    throw new Error(toArabicMessage(data.detail || data.error, "تعذر إيقاف إشعارات السائق."));
  }

  return data;
}

export async function clearCurrentDriverFcmToken() {
  if (localStorage.getItem("role") === "client") {
    const client = readStoredAccount("client");
    if (client?.id) {
      await fetch(`${API_BASE_URL}/clients/${client.id}/update_fcm_token/`, {
        method: "DELETE", headers: authHeaders(),
        signal: AbortSignal.timeout(5000),
      });
    }
    return;
  }
  if (localStorage.getItem("role") !== "livreur") return;

  let livreur;
  try {
    livreur = JSON.parse(localStorage.getItem("livreur") || "null");
  } catch {
    return;
  }

  if (livreur?.id) {
    // Leaving this account must also stop advertising it for new requests.
    return Promise.allSettled([
      clearLivreurFcmToken(livreur.id),
      fetch(`${API_BASE_URL}/livreurs/${livreur.id}/set_offline/`, {
        method: "PATCH", headers: authHeaders(), signal: AbortSignal.timeout(5000),
      }),
    ]);
  }
}

export async function logoutCurrentAccount() {
  try {
    await clearCurrentDriverFcmToken();
  } catch {
    // Local logout must remain available when the server cannot be reached.
  } finally {
    clearStoredSession();
    window.dispatchEvent(new Event("authChanged"));
  }
}

export async function getLivreurBytelephone(telephone) {
  const response = await fetch(`${API_BASE_URL}/livreurs/me/`, { headers: authHeaders() });

  if (!response.ok) {
    throw new Error(toArabicMessage(null, "حدث خطأ أثناء جلب معلومات السائق."));
  }

  const data = await response.json();

  const clean = (value) => String(value || "").replace(/\s/g, "");

  return clean(data.telephone) === clean(telephone) ? data : null;
}

export async function setLivreurUnavailable(id) {
  const response = await fetch(`${API_BASE_URL}/livreurs/${id}/set_unavailable/`, {
    method: "PATCH",
    headers: authHeaders(),
  });

  const data = await response.json();

  if (!response.ok) {
    handleInvalidToken(data);
    throw new Error(
      toArabicMessage(
        data.detail || data.error,
        "حدث خطأ أثناء إيقاف توفر السائق."
      )
    );
  }

  return data;
}

export async function setLivreurOnline(id) {
  const response = await fetch(`${API_BASE_URL}/livreurs/${id}/set_online/`, {
    method: "PATCH",
    headers: authHeaders(),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    handleInvalidToken(data);
    throw new Error(
      toArabicMessage(
        data.detail || data.error,
        "تعذر التبديل إلى وضع الاتصال."
      )
    );
  }

  return data;
}

export async function setLivreurOffline(id) {
  const response = await fetch(`${API_BASE_URL}/livreurs/${id}/set_offline/`, {
    method: "PATCH",
    headers: authHeaders(),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    handleInvalidToken(data);
    throw new Error(
      toArabicMessage(
        data.detail || data.error,
        "تعذر التبديل إلى وضع عدم الاتصال."
      )
    );
  }

  return data;
}

export async function getCommentairesLivreur(livreurId) {
  const response = await fetch(
    `${API_BASE_URL}/commentaires-livreurs/?livreur=${livreurId}`
  );

  if (!response.ok) {
    throw new Error(toArabicMessage(null, "حدث خطأ أثناء تحميل التعليقات."));
  }

  return response.json();
}

export async function createCommentaireLivreur(commentaire) {
  const response = await fetch(`${API_BASE_URL}/commentaires-livreurs/`, {
    method: "POST",
    headers: authHeaders({
      "Content-Type": "application/json",
    }),
    body: JSON.stringify(commentaire),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      toArabicMessage(
        data.detail || data.message,
        "حدث خطأ أثناء إضافة التعليق."
      )
    );
  }

  return data;
}

export async function createClient(client) {
  const response = await fetch(`${API_BASE_URL}/clients/register/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(client),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      registrationMessage(data, "حدث خطأ أثناء إنشاء حساب العميل.")
    );
  }

  return data;
}

export async function loginClient(credentials) {
  const response = await fetch(`${API_BASE_URL}/token/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      username: credentials.telephone,
      password: credentials.password,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(toArabicMessage(data.detail, "تعذر تسجيل دخول العميل."));
  }

  const profileResponse = await fetch(`${API_BASE_URL}/clients/`, {
    headers: { Authorization: `Bearer ${data.access}` },
  });
  if (!profileResponse.ok) throw new Error("تعذر تحميل حساب العميل. حاول مجدداً.");
  const profiles = await profileResponse.json();
  const clean = (value) => String(value || "").replace(/\s/g, "");
  const client = (Array.isArray(profiles) ? profiles : profiles.results || [])
    .find((profile) => clean(profile.telephone) === clean(credentials.telephone));
  if (!client) {
    throw new Error("هذا الحساب ليس حساب عميل. يرجى تسجيل الدخول من فضاء السائق.");
  }

  const redirectAfterLogin = localStorage.getItem("redirectAfterLogin");

  await clearCurrentDriverFcmToken().catch(() => {});

  clearStoredSession();

  if (redirectAfterLogin) {
    localStorage.setItem("redirectAfterLogin", redirectAfterLogin);
  }

  localStorage.setItem("access", data.access);
  localStorage.setItem("refresh", data.refresh);
  localStorage.setItem("role", "client");

  localStorage.setItem(
    "client",
    JSON.stringify({
      id: client.id,
      nom: client.nom || "عميل",
      telephone: client.telephone,
      photo: client.photo,
    })
  );

  window.dispatchEvent(new Event("authChanged"));

  return data;
}

export async function getClientByTelephone(telephone) {
  const response = await fetch(`${API_BASE_URL}/clients/`, {
    headers: authHeaders(),
  });

  const data = await response.json();

  if (!response.ok) {
    handleInvalidToken(data);
    console.error("Erreur récupération client :", data);
    throw new Error(
      toArabicMessage(data.detail, "حدث خطأ أثناء جلب معلومات العميل.")
    );
  }

  const clients = Array.isArray(data) ? data : data.results || [];
  const clean = (value) => String(value || "").replace(/\s/g, "");

  return clients.find((client) => clean(client.telephone) === clean(telephone));
}

export async function deleteLivreur(id) {
  const response = await fetch(`${API_BASE_URL}/livreurs/${id}/`, {
    method: "DELETE",
    headers: authHeaders(),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    handleInvalidToken(error);
    throw new Error(
      toArabicMessage(error.detail, "حدث خطأ أثناء حذف حساب السائق.")
    );
  }

  return true;
}

export async function deleteClient(id) {
  const response = await fetch(`${API_BASE_URL}/clients/${id}/`, {
    method: "DELETE",
    headers: authHeaders(),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    handleInvalidToken(error);
    throw new Error(toArabicMessage(error.detail, "تعذر حذف حساب العميل."));
  }

  return true;
}

export async function updateClientProfile(id, data) {
  const hasPhoto = data.photo instanceof File;
  const body = hasPhoto ? new FormData() : JSON.stringify(data);
  if (hasPhoto) {
    body.append("nom", data.nom);
    body.append("photo", data.photo);
  }
  const response = await fetch(`${API_BASE_URL}/clients/${id}/`, {
    method: "PATCH",
    headers: authHeaders(hasPhoto ? {} : { "Content-Type": "application/json" }),
    body,
  });

  const result = await response.json();

  if (!response.ok) {
    handleInvalidToken(result);
    throw new Error(
      toArabicMessage(
        result.photo || result.error || result.telephone || result.detail,
        "حدث خطأ أثناء تعديل المعلومات."
      )
    );
  }

  return result;
}

export async function updateLivreurProfile(id, data) {
  const response = await fetch(`${API_BASE_URL}/livreurs/${id}/`, {
    method: "PATCH",
    headers: authHeaders({
      "Content-Type": "application/json",
    }),
    body: JSON.stringify(data),
  });

  const result = await response.json();

  if (!response.ok) {
    handleInvalidToken(result);
    throw new Error(
      toArabicMessage(
        result.error || result.vehicule || result.detail,
        "حدث خطأ أثناء تعديل المعلومات."
      )
    );
  }

  return result;
}

export async function getClientProfile() {
  const response = await fetch(`${API_BASE_URL}/clients/`, {
    headers: authHeaders(),
  });

  const data = await response.json();

  if (!response.ok) {
    handleInvalidToken(data);
    throw new Error(toArabicMessage(data.detail, "تعذر تحميل بيانات الحساب."));
  }

  const list = Array.isArray(data) ? data : data.results || [];
  return list[0] || null;
}

export async function createCourse(data) {
  requireClientRole();
  const response = await fetch(`${API_BASE_URL}/courses/`, {
    method: "POST",
    headers: authHeaders({
      "Content-Type": "application/json",
    }),
    body: JSON.stringify(data),
  });

  const result = await response.json().catch(() => null);

  if (!response.ok) {
    handleInvalidToken(result);
    console.error("ERREUR BACKEND CREATE COURSE :", result);
    throw new Error(
      toArabicMessage(
        result?.error || result?.detail || result,
        "حدث خطأ أثناء إنشاء الرحلة."
      )
    );
  }

  return result;
}

async function courseAction(courseId, action, method = "POST", body = {}) {
  const response = await fetch(`${API_BASE_URL}/courses/${courseId}/${action}/`, {
    method,
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    handleInvalidToken(data);
    const message = response.status === 409
      ? "هذه الرحلة لم تعد متاحة أو تغيّرت حالتها. حدّث القائمة."
      : toArabicMessage(data.detail || data.error, "تعذر تحديث حالة الرحلة.");
    throw new Error(message);
  }
  return data;
}

export async function createCourseRequest(request) {
  requireClientRole();
  const response = await fetch(`${API_BASE_URL}/courses/request/`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(request),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    handleInvalidToken(data);
    const error = new Error(toArabicMessage(data.detail || data.error, "تعذر إنشاء طلب الرحلة."));
    error.status = response.status;
    error.courseId = data.course_id;
    throw error;
  }
  return data;
}

const mapRequestCache = new Map();
function cachedMapRequest(key, ttl, request) {
  const previous = mapRequestCache.get(key);
  if (previous && previous.expires > Date.now()) return previous.promise;
  if (mapRequestCache.size >= 100) mapRequestCache.delete(mapRequestCache.keys().next().value);
  const entry = { expires: Infinity, promise: null };
  entry.promise = request().then((result) => {
    entry.expires = Date.now() + ttl;
    return result;
  }).catch((error) => {
    if (mapRequestCache.get(key) === entry) mapRequestCache.delete(key);
    throw error;
  });
  mapRequestCache.set(key, entry);
  return entry.promise;
}

export function getCourseAddress(position) {
  return cachedMapRequest(`address:${JSON.stringify(position)}`, 5 * 60 * 1000, () => fetchCourseAddress(position));
}

export function getCourseQuote(request) {
  return cachedMapRequest(`quote:${JSON.stringify(request)}`, 30000, () => fetchCourseQuote(request));
}

async function fetchCourseAddress(position) {
  const params = new URLSearchParams(position);
  const response = await fetch(`${API_BASE_URL}/courses/address/?${params}`, {
    signal: AbortSignal.timeout(6000),
  });
  if (!response.ok) throw new Error("تعذر العثور على العنوان.");
  const data = await response.json();
  return data.address;
}

async function fetchCourseQuote(request) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  let response;
  try {
    response = await fetch(`${API_BASE_URL}/courses/quote/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
      signal: controller.signal,
    });
  } catch {
    throw new Error("تعذر الاتصال بالخادم. تحقق من الإنترنت ثم أعد المحاولة.");
  } finally {
    clearTimeout(timeout);
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    handleInvalidToken(data);
    throw new Error(toArabicMessage(data.detail || data.error, "تعذر حساب سعر الرحلة."));
  }
  return data;
}

export async function getCourseOffers() {
  const response = await fetch(`${API_BASE_URL}/courses/offers/`, {
    headers: authHeaders(),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    handleInvalidToken(data);
    throw new Error(toArabicMessage(data.detail, "تعذر تحميل طلبات الرحلات."));
  }
  return Array.isArray(data) ? data : data.results || [];
}

export function respondToCourseOffer(courseId, response, offeredPrice) {
  return courseAction(courseId, "respond", "POST", {
    response,
    ...(response === "accepted" && offeredPrice != null ? { offered_price: offeredPrice } : {}),
  });
}

export function selectCourseDriver(courseId, livreurId) {
  return courseAction(courseId, "select_driver", "POST", { livreur_id: livreurId });
}

export function cancelCourse(courseId, reason, comment = "") {
  return courseAction(courseId, "cancel", "POST", { reason, comment });
}

export function markCourseArrived(courseId) {
  return courseAction(courseId, "arrive");
}

export function pickupCourse(courseId) {
  return courseAction(courseId, "pickup");
}

export function markCourseEnroute(courseId) {
  return courseAction(courseId, "enroute");
}

export function startCourse(courseId) {
  return courseAction(courseId, "start");
}

export async function getActiveCourse(livreurId) {
  const response = await fetch(
    `${API_BASE_URL}/courses/active/?livreur_id=${livreurId}`,
    {
      headers: authHeaders(),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    handleInvalidToken(data);
    throw new Error(toArabicMessage(data.detail, "حدث خطأ أثناء جلب الرحلة."));
  }

  return data;
}

export async function getCourse(courseId) {
  const response = await fetch(`${API_BASE_URL}/courses/${courseId}/`, {
    headers: authHeaders(),
  });

  const data = await response.json();

  if (!response.ok) {
    handleInvalidToken(data);
    const error = new Error(toArabicMessage(data.detail, "حدث خطأ أثناء جلب الرحلة."));
    error.status = response.status;
    throw error;
  }

  return data;
}

export async function finishCourse(courseId) {
  const response = await fetch(`${API_BASE_URL}/courses/${courseId}/finish/`, {
    method: "PATCH",
    headers: authHeaders(),
  });

  const data = await response.json();

  if (!response.ok) {
    handleInvalidToken(data);
    throw new Error(toArabicMessage(data.detail, "حدث خطأ أثناء إنهاء الرحلة."));
  }

  return data;
}

export async function updateLivreurPhoto(id, photoFile) {
  const formData = new FormData();
  formData.append("photo", photoFile);

  const response = await fetch(`${API_BASE_URL}/livreurs/${id}/`, {
    method: "PATCH",
    headers: authHeaders(),
    body: formData,
  });

  const data = await response.json();

  if (!response.ok) {
    handleInvalidToken(data);
    throw new Error(
      toArabicMessage(
        data.photo || data.detail,
        "حدث خطأ أثناء تعديل الصورة."
      )
    );
  }

  return data;
}

export async function getActiveCoursesForLivreur(livreurId) {
  const response = await fetch(
    `${API_BASE_URL}/courses/active/?livreur_id=${livreurId}`,
    {
      headers: authHeaders(),
    }
  );

  const result = await response.json();

  if (!response.ok) {
    handleInvalidToken(result);
    throw new Error(
      toArabicMessage(result?.detail, "حدث خطأ أثناء تحميل الرحلة النشطة.")
    );
  }

  return result;
}

export async function getClientCourses() {
  const response = await fetch(`${API_BASE_URL}/courses/`, {
    headers: authHeaders(),
  });

  const data = await response.json();

  if (!response.ok) {
    handleInvalidToken(data);
    throw new Error(toArabicMessage(data.detail, "حدث خطأ أثناء تحميل السجل."));
  }

  return Array.isArray(data) ? data : data.results || [];
}

export async function getLivreurCourses() {
  const response = await fetch(`${API_BASE_URL}/courses/`, {
    headers: authHeaders(),
  });

  const data = await response.json();

  if (!response.ok) {
    handleInvalidToken(data);
    throw new Error(toArabicMessage(data.detail, "حدث خطأ أثناء تحميل السجل."));
  }

  return Array.isArray(data) ? data : data.results || [];
}

export async function updateClientCoursePosition(courseId, position) {
  const response = await fetch(
    `${API_BASE_URL}/courses/${courseId}/update_client_position/`,
    {
      method: "PATCH",
      headers: authHeaders({
        "Content-Type": "application/json",
      }),
      body: JSON.stringify(position),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    handleInvalidToken(data);
    throw new Error(
      toArabicMessage(
        data.detail || data.error,
        "حدث خطأ أثناء تحديث موقع العميل."
      )
    );
  }

  return data;
}
