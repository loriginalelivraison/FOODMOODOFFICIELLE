import React, { useEffect, useRef, useState } from "react";
import {
  deleteLivreur,
  updateLivreurPosition,
  setLivreurOnline,
  setLivreurOffline,
  getLivreurCourses,
  finishCourse,
  getActiveCoursesForLivreur,
  getCourseOffers,
  respondToCourseOffer,
  clearCurrentDriverFcmToken,
  getLivreurById,
  getCommentairesLivreur,
  updateLivreurProfile,
} from "../livreursapi.js";
import LoadingSpinner from "../components/LoadingSpinner.jsx";
import MapActionButton from "../components/MapActionButton.jsx";
import LivreurOrders from "../components/LivreurOrders.jsx";
import { useNavigate } from "react-router-dom";

function formatDate(value) {
  if (!value) return "غير متوفر";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "غير متوفر" : date.toLocaleDateString("ar-DZ");
}
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
} from "react-leaflet";
import L from "leaflet";

import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

delete L.Icon.Default.prototype._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

const clientIcon = new L.DivIcon({
  className: "client-marker",
  html: `
    <div style="
      width:22px;
      height:22px;
      background:#16a34a;
      border:4px solid white;
      border-radius:50%;
      box-shadow:0 0 0 8px rgba(22,163,74,0.25);
    "></div>
  `,
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

function getVehicleMarkerIcon(vehicle) {
  const map = {
    moto: { emoji: "🛵", bg: "#f97316" },
    scooter: { emoji: "🛵", bg: "#f97316" },
    velo: { emoji: "🚴", bg: "#10b981" },
    voiture: { emoji: "🚘", bg: "#2563eb" },
    camion: { emoji: "🚚", bg: "#f59e0b" },
  };

  const config = map[vehicle] || map.moto;

  return new L.DivIcon({
    className: "vehicle-marker",
    html: `
      <div style="
        width:34px;
        height:34px;
        background:${config.bg};
        border:4px solid white;
        border-radius:50%;
        display:flex;
        align-items:center;
        justify-content:center;
        font-size:18px;
      ">${config.emoji}</div>
    `,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  });
}

function hasPosition(position) {
  return (
    position?.latitude !== null &&
    position?.latitude !== undefined &&
    position?.longitude !== null &&
    position?.longitude !== undefined &&
    !isNaN(Number(position.latitude)) &&
    !isNaN(Number(position.longitude))
  );
}

function RecenterMap({ position, clientPosition }) {
  const map = useMap();

  useEffect(() => {
    function zoomToPosition() {
      if (!hasPosition(position)) return;

      map.flyTo(
        [Number(position.latitude), Number(position.longitude)],
        16,
        { duration: 1.2 }
      );
    }

    function zoomToClient() {
      if (!hasPosition(clientPosition)) return;

      map.flyTo(
        [Number(clientPosition.latitude), Number(clientPosition.longitude)],
        16,
        { duration: 1.2 }
      );
    }

    window.addEventListener("zoomLivreurDashboardPosition", zoomToPosition);
    window.addEventListener("zoomLivreurDashboardClient", zoomToClient);

    return () => {
      window.removeEventListener("zoomLivreurDashboardPosition", zoomToPosition);
      window.removeEventListener("zoomLivreurDashboardClient", zoomToClient);
    };
  }, [position, clientPosition, map]);

  return null;
}

function CenterOnInitialPosition({ position }) {
  const map = useMap();
  const hasCentered = useRef(false);

  useEffect(() => {
    if (!hasPosition(position) || hasCentered.current) return;

    hasCentered.current = true;
    map.flyTo(
      [Number(position.latitude), Number(position.longitude)],
      16,
      { duration: 1.2 }
    );
  }, [position, map]);

  return null;
}

export default function LivreurDashboard() {
  const [livreur, setLivreur] = useState(() => {
    const stored = localStorage.getItem("livreur");
    return stored ? JSON.parse(stored) : null;
  });

  const [profile, setProfile] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [editingProfile, setEditingProfile] = useState(false);
  const [editNom, setEditNom] = useState(livreur?.nom || "");
  const [editVille, setEditVille] = useState(livreur?.ville || "");
  const [editVehicule, setEditVehicule] = useState(livreur?.vehicule || "moto");
  const [savingProfile, setSavingProfile] = useState(false);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [position, setPosition] = useState(null);
  // Bascule "en ligne / hors ligne" façon Uber : c'est le serveur qui fait foi.
  const [isOnline, setIsOnline] = useState(() => {
    const saved = localStorage.getItem("livreurOnline");
    return saved === null ? true : saved === "true";
  });
  const [togglingOnline, setTogglingOnline] = useState(false);

  useEffect(() => {
    localStorage.setItem("livreurOnline", String(isOnline));
  }, [isOnline]);

  const trackingEnabled = isOnline;

  const [activeCourse, setActiveCourse] = useState(null);
  const [courseOffers, setCourseOffers] = useState([]);
  const [respondingOfferId, setRespondingOfferId] = useState(null);
  const [courseNotification, setCourseNotification] = useState("");
  const [showHistory, setShowHistory] = useState(true);
  const [courses, setCourses] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [finishingCourse, setFinishingCourse] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    if (showHistory) {
      loadHistory();
    }
  }, [showHistory]);

  async function loadHistory(silent = false) {
    if (!silent) {
      setLoadingHistory(true);
      setError("");
    }

    try {
      const data = await getLivreurCourses();
      setCourses(data);
    } catch (err) {
      if (!silent) {
        setError(err.message || "حدث خطأ أثناء تحميل السجل");
      }
    } finally {
      if (!silent) {
        setLoadingHistory(false);
      }
    }
  }

  useEffect(() => {
    if (!livreur?.id) return undefined;

    const interval = setInterval(() => loadHistory(true), 8000);

    return () => clearInterval(interval);
  }, [livreur?.id]);

  async function handleOfferResponse(courseId, response) {
    if (respondingOfferId) return;
    setRespondingOfferId(courseId);
    setError("");
    try {
      await respondToCourseOffer(courseId, response);
      await Promise.all([loadHistory(true), loadActiveCourse()]);
      const updatedOffers = await getCourseOffers();
      setCourseOffers(updatedOffers);
    } catch (err) {
      setError(err.message || "تعذر تحديث طلب الرحلة.");
      getCourseOffers().then(setCourseOffers).catch(() => {});
      loadHistory(true).catch(() => {});
    } finally {
      setRespondingOfferId(null);
    }
  }

  useEffect(() => {
    if (!livreur?.id) return;
    if (!trackingEnabled) return;

    if (!navigator.geolocation) {
      setError("الموقع الجغرافي غير مدعوم في هذا المتصفح.");
      return;
    }

    let cancelled = false;

    const sendPosition = async (coords) => {
      try {
        const newPosition = {
          latitude: coords.latitude,
          longitude: coords.longitude,
        };

        if (!cancelled) {
          setPosition(newPosition);
        }

        const result = await updateLivreurPosition(livreur.id, {
          latitude: newPosition.latitude,
          longitude: newPosition.longitude,
          disponible: true,
        });

        console.log("REPONSE API :", result);
        setError("");
      } catch (err) {
        console.error("ERREUR CREATE COURSE :", err);
        setError(err.message || "حدث خطأ أثناء إنشاء الرحلة.");
      }
    };

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        sendPosition(pos.coords);
      },
      (geoError) => {
        console.error(geoError);
        setError("الرجاء تفعيل تعقب الموقع في هاتفك");
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 15000,
      }
    );

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        sendPosition(pos.coords);
      },
      (geoError) => {
        console.error(geoError);
        setError("الرجاء تفعيل تعقب الموقع في هاتفك");
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 15000,
      }
    );

    return () => {
      cancelled = true;
      navigator.geolocation.clearWatch(watchId);
    };
  }, [livreur?.id, trackingEnabled]);

  async function loadActiveCourse() {
    if (!livreur?.id) return;

    try {
      const data = await getActiveCoursesForLivreur(livreur.id);

      console.log("COURSE ACTIVE LIVREUR :", data);

      if (data.active && data.course) {
        setActiveCourse(data.course);
        setCourseNotification(
          "🚨 لديك طلب جديد: الزبون قبل الرحلة وشارك موقعه معك."
        );
      } else {
        setActiveCourse(null);
        setCourseNotification("");
      }
    } catch (err) {
      console.error("Erreur chargement course active :", err);
    }
  }

  useEffect(() => {
    if (!livreur?.id) return undefined;

    loadActiveCourse();

    const interval = setInterval(loadActiveCourse, 5000);

    return () => clearInterval(interval);
  }, [livreur?.id]);

  useEffect(() => {
    if (!livreur?.id) return;
    let cancelled = false;
    async function loadOffers() {
      try {
        const data = await getCourseOffers();
        if (!cancelled) setCourseOffers(data);
      } catch (err) {
        console.error("Erreur chargement des offres :", err);
      }
    }
    loadOffers();
    const interval = setInterval(loadOffers, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [livreur?.id]);

  useEffect(() => {
    if (!livreur?.id) return undefined;
    let cancelled = false;

    async function loadProfile() {
      try {
        const data = await getLivreurById(livreur.id);
        if (!cancelled) setProfile(data);
      } catch (err) {
        console.error("Erreur chargement profil :", err);
      }
    }

    async function loadReviews() {
      try {
        const data = await getCommentairesLivreur(livreur.id);
        if (!cancelled) {
          setReviews(Array.isArray(data) ? data : data.results || []);
        }
      } catch (err) {
        console.error("Erreur chargement avis :", err);
      }
    }

    loadProfile();
    loadReviews();

    return () => {
      cancelled = true;
    };
  }, [livreur?.id]);

  // La source de vérité est le serveur : on aligne la bascule locale dessus.
  useEffect(() => {
    if (!livreur?.id) return;

    let cancelled = false;

    async function syncOnlineStatus() {
      try {
        const data = await getLivreurById(livreur.id);
        if (!cancelled) setIsOnline(Boolean(data.est_en_ligne));
      } catch (syncError) {
        console.error("Erreur synchronisation du statut en ligne :", syncError);
      }
    }

    syncOnlineStatus();
    const interval = setInterval(syncOnlineStatus, 15000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [livreur?.id]);

  if (!livreur) {
    return (
      <div style={{ padding: "20px" }} dir="rtl">
        <p>يجب تسجيل الدخول كسائق.</p>
      </div>
    );
  }

  const photoUrl = profile?.photo || livreur.photo || livreur.image || null;
  const displayName = profile?.nom || livreur.nom;
  // « En ligne » = disponible ET pas déjà en course (comme un chauffeur Uber).
  const isAvailable = trackingEnabled && !activeCourse;
  const vehicleLabels = {
    moto: "دراجة نارية",
    scooter: "دراجة نارية",
    velo: "دراجة",
    voiture: "سيارة",
    camion: "شاحنة",
  };

  async function handleDeleteAccount() {
    const confirmDelete = window.confirm(
      "هل أنت متأكد أنك تريد حذف حسابك نهائيا؟"
    );

    if (!confirmDelete) return;

    try {
      await deleteLivreur(livreur.id);

      localStorage.removeItem("access");
      localStorage.removeItem("refresh");
      localStorage.removeItem("role");
      localStorage.removeItem("livreur");

      window.dispatchEvent(new Event("authChanged"));

      navigate("/livreurs");
    } catch (err) {
      console.error(err);
      setError(err.message || "حدث خطأ أثناء حذف الحساب.");
   
    }


  }

  async function handleTrackingToggle() {
    if (togglingOnline) return;

    setTogglingOnline(true);
    setError("");

    try {
      if (isOnline) {
        await setLivreurOffline(livreur.id);
        setIsOnline(false);
        localStorage.setItem("livreurOnline", "false");
        setMessage("أنت الآن غير متصل. لن تصلك أي طلب جديد.");
      } else {
        const result = await setLivreurOnline(livreur.id);
        setIsOnline(Boolean(result.est_en_ligne));
        localStorage.setItem("livreurOnline", String(Boolean(result.est_en_ligne)));
        setMessage("أنت الآن متصل. ستصلك الطلبات القريبة.");
      }
    } catch (err) {
      console.error("Erreur changement de statut en ligne :", err);
      setError(err.message || "تعذر تغيير حالة الاتصال.");
    } finally {
      setTogglingOnline(false);
    }
  }

  async function handleFinishCourse(courseId) {
    const targetCourse = activeCourse || courses.find((course) => course.id === courseId);

    if (!targetCourse || finishingCourse) return;

    setFinishingCourse(true);
    setError("");

    try {
      await finishCourse(targetCourse.id);
      setActiveCourse(null);
      setCourseNotification("");
      setMessage("تم إنهاء الرحلة وتسجيلها في السجل.");
      if (showHistory) loadHistory();
      try {
        setProfile(await getLivreurById(livreur.id));
      } catch (profileErr) {
        console.error("Erreur rafraîchissement profil :", profileErr);
      }
    } catch (err) {
      setError(err.message || "حدث خطأ أثناء إنهاء الرحلة.");
    } finally {
      setFinishingCourse(false);
    }
  }

  async function handleProfileSave(event) {
    event.preventDefault();
    if (!livreur || savingProfile) return;

    const nom = editNom.trim();
    const ville = editVille.trim();

    if (!nom) {
      setError("الاسم مطلوب.");
      return;
    }

    setSavingProfile(true);
    setError("");

    try {
      const updated = await updateLivreurProfile(livreur.id, {
        nom,
        ville,
        vehicule: editVehicule,
      });
      const nextLivreur = {
        ...livreur,
        nom: updated.nom ?? nom,
        ville: updated.ville ?? ville,
        vehicule: updated.vehicule ?? editVehicule,
      };
      setLivreur(nextLivreur);
      localStorage.setItem("livreur", JSON.stringify(nextLivreur));
      window.dispatchEvent(new Event("authChanged"));
      setEditingProfile(false);
    } catch (err) {
      setError(err.message || "تعذر تحديث المعلومات.");
    } finally {
      setSavingProfile(false);
    }
  }

  async function logout() {
  try {
    await clearCurrentDriverFcmToken();
  } catch (err) {
    setError(err.message || "تعذر إيقاف إشعارات السائق. أعد المحاولة.");
    return;
  }

  localStorage.removeItem("access");
  localStorage.removeItem("refresh");

  localStorage.removeItem("livreur");
  localStorage.removeItem("client");
  localStorage.removeItem("role");

  window.dispatchEvent(new Event("authChanged"));
  navigate("/");

}
  const isLoggedIn = localStorage.getItem("access");

  if (!isLoggedIn) return null;

  const hasClientPosition = hasPosition({
    latitude: activeCourse?.client_latitude,
    longitude: activeCourse?.client_longitude,
  });

  return (
    <section className="page account-page" dir="rtl">
      <header className="account-header">
        <div className="account-avatar">
          {photoUrl ? (
            <img src={photoUrl} alt={displayName} />
          ) : (
            <span>🛵</span>
          )}
        </div>
        <div className="account-identity">
          <h1>{displayName}</h1>
          <span className="account-meta">
            <span>📞 {livreur.telephone}</span>
            {profile?.note != null && <span>⭐ {profile.note}</span>}
            {profile?.nombre_livraisons != null && <span>🚚 {profile.nombre_livraisons} رحلة</span>}
          </span>
          <span className={`account-badge ${isAvailable ? "is-online" : "is-offline"}`}>
            {isAvailable ? "متاح" : "غير متاح"}
          </span>
        </div>
        <button
          type="button"
          className="account-edit-btn"
          onClick={() => {
            setEditNom(livreur.nom || "");
            setEditVille(livreur.ville || "");
            setEditVehicule(livreur.vehicule || "moto");
            setEditingProfile((value) => !value);
          }}
        >
          تعديل
        </button>
      </header>

      <LivreurOrders
        livreurId={livreur.id}
        courses={courses}
        loading={loadingHistory}
        respondingOfferId={respondingOfferId}
        finishingCourseId={finishingCourse ? activeCourse?.id ?? true : null}
        onAccept={(courseId) => handleOfferResponse(courseId, "accepted")}
        onReject={(courseId) => handleOfferResponse(courseId, "rejected")}
        onFinish={handleFinishCourse}
      />

      <section className="account-card">
        <h2>حالة حسابك</h2>
        <div className="account-points">
          <span className="account-points-icon" aria-hidden="true">🏅</span>
          <strong>{profile?.points ?? 0}</strong>
          <span className="account-points-label">نقطة</span>
        </div>
        <p className="account-points-hint">تُضاف نقاط مكافأة مع كل رحلة مكتملة.</p>
        <div className="account-stat-grid">
          <div className="account-stat">
            <span>رحلات مكتملة</span>
            <strong>{profile?.nombre_livraisons ?? 0}</strong>
          </div>
          <div className="account-stat">
            <span>التقييم</span>
            <strong>{profile?.note != null ? `⭐ ${profile.note}` : "—"}</strong>
          </div>
        </div>
      </section>

      <section className="account-card">
        <h2>حالة الاستقبال</h2>
        <div className={`account-badge ${isAvailable ? "is-online" : "is-offline"}`} style={{ justifySelf: "start" }}>
          {activeCourse
            ? "لديك رحلة جارية"
            : isOnline
              ? "متصل — تصلك الطلبات القريبة"
              : "غير متصل"}
        </div>
        <button
          className="primary-btn full"
          type="button"
          onClick={handleTrackingToggle}
          disabled={togglingOnline || Boolean(activeCourse)}
          style={{ background: isOnline ? "#dc2626" : "#16a34a" }}
        >
          {togglingOnline ? (
            <LoadingSpinner label="جاري التحديث..." size={20} />
          ) : isOnline ? (
            "إيقاف استقبال الطلبات"
          ) : (
            "بدء استقبال الطلبات"
          )}
        </button>
        {Boolean(activeCourse) && (
          <p className="account-points-hint">
            أنهِ الرحلة الجارية قبل العودة إلى وضع الاستقبال.
          </p>
        )}
      </section>

      {editingProfile && (
        <section className="account-card">
          <h2>تعديل المعلومات</h2>
          <form className="account-form" onSubmit={handleProfileSave}>
            <label>
              الاسم
              <input value={editNom} onChange={(event) => setEditNom(event.target.value)} maxLength={100} />
            </label>
            <label>
              رقم الهاتف
              <input value={livreur.telephone} disabled readOnly />
            </label>
            <label>
              المدينة
              <input value={editVille} onChange={(event) => setEditVille(event.target.value)} maxLength={100} />
            </label>
            <label>
              نوع المركبة
              <select value={editVehicule} onChange={(event) => setEditVehicule(event.target.value)}>
                <option value="moto">دراجة نارية</option>
                <option value="voiture">سيارة</option>
                <option value="camion">شاحنة</option>
                <option value="velo">دراجة</option>
              </select>
            </label>
            <div className="account-form-actions">
              <button type="submit" className="save" disabled={savingProfile}>
                {savingProfile ? "جارٍ الحفظ…" : "حفظ"}
              </button>
              <button type="button" className="cancel" onClick={() => setEditingProfile(false)}>
                إلغاء
              </button>
            </div>
          </form>
        </section>
      )}

      {message && (
        <p style={{ color: "green", textAlign: "center", fontWeight: "600" }}>
          {message}
        </p>
      )}

      {error && (
        <p style={{ color: "red", textAlign: "center", fontWeight: "600" }}>
          {error}
        </p>
      )}

      <div
        style={{
          height: "360px",
          borderRadius: "22px",
          overflow: "hidden",
          border: "2px solid #fed7aa",
          position: "relative",
        }}
      >
        <div className="map-action-buttons">
          {hasPosition(position) && (
            <MapActionButton
              onClick={() =>
                window.dispatchEvent(new Event("zoomLivreurDashboardPosition"))
              }
            >
              📍 موقعي
            </MapActionButton>
          )}

          {hasClientPosition && (
            <button
              type="button"
              className="map-action-button"
              onClick={() =>
                window.dispatchEvent(new Event("zoomLivreurDashboardClient"))
              }
            >
              📍 موقع الزبون
            </button>
          )}
        </div>

        <MapContainer
          center={
            position
              ? [Number(position.latitude), Number(position.longitude)]
              : [36.75, 3.06]
          }
          zoom={15}
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer
            attribution='Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ'
            url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}"
            maxZoom={19}
            maxNativeZoom={16}
          />
          <TileLayer
            url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}"
            maxZoom={19}
            maxNativeZoom={16}
          />

          <RecenterMap
            position={position}
            clientPosition={hasClientPosition ? {
              latitude: activeCourse.client_latitude,
              longitude: activeCourse.client_longitude,
            } : null}
          />

          <CenterOnInitialPosition position={position} />

          {position && (
            <>

              <Marker
                position={[
                  Number(position.latitude),
                  Number(position.longitude),
                ]}
                icon={getVehicleMarkerIcon(livreur.vehicule || "moto")}
              >
                <Popup>
                  <strong>موقعي الحالي</strong>
                  <br />
                  {livreur.nom}
                </Popup>
              </Marker>
            </>
          )}

          {hasClientPosition && (
    <Marker
      position={[
        Number(activeCourse.client_latitude),
        Number(activeCourse.client_longitude),
      ]}
      icon={clientIcon}
    >
      <Popup>
        <strong>موقع الزبون</strong>
        <br />
        الزبون ينتظر السائق هنا
        <br />
        رقم الرحلة: {activeCourse.id}
      </Popup>
    </Marker>
  )}
        
        </MapContainer>
      </div>
      <section className="account-card">
        <h2>المعلومات الشخصية</h2>
        <div className="account-row">
          <span className="account-row-label">الاسم</span>
          <span className="account-row-value">{displayName}</span>
        </div>
        <div className="account-row">
          <span className="account-row-label">رقم الهاتف</span>
          <span className="account-row-value">{livreur.telephone}</span>
        </div>
        {livreur.ville && (
          <div className="account-row">
            <span className="account-row-label">المدينة</span>
            <span className="account-row-value">{livreur.ville}</span>
          </div>
        )}
      </section>

      {livreur.vehicule && (
        <section className="account-card">
          <h2>المركبة</h2>
          <div className="account-row">
            <span className="account-row-label">النوع</span>
            <span className="account-row-value">{vehicleLabels[livreur.vehicule] || livreur.vehicule}</span>
          </div>
        </section>
      )}

      <section className="account-card">
        <h2>سجل الرحلات</h2>
        {loadingHistory && <LoadingSpinner label="جاري تحميل السجل..." />}
        {!loadingHistory && courses.length === 0 && (
          <p className="account-empty">لا توجد رحلات مسجلة حالياً.</p>
        )}
        {!loadingHistory && courses.map((course) => (
          <article className="account-item" key={course.id}>
            <div className="account-item-head">
              <strong>رحلة رقم {course.id}</strong>
              <span className={`account-status-pill ${course.status === "completed" ? "is-done" : course.status === "cancelled" ? "is-cancel" : course.active ? "is-active" : ""}`}>
                {course.active ? "نشطة" : "منتهية"}
              </span>
            </div>
            <div className="account-item-meta">
              <span>{formatDate(course.created_at)}</span>
              {course.destination && <span>{course.destination}</span>}
              {(course.final_price ?? course.proposed_price) != null && (
                <span className="account-item-price">{course.final_price ?? course.proposed_price} دج</span>
              )}
            </div>
          </article>
        ))}
      </section>

      {reviews.length > 0 && (
        <section className="account-card">
          <h2>تقييمات الزبائن</h2>
          {reviews.map((comment) => (
            <article className="account-item" key={comment.id}>
              <div className="account-item-head">
                <strong>⭐ {comment.note || 5} / 5</strong>
                <span className="account-item-meta">{formatDate(comment.created_at)}</span>
              </div>
              {comment.message && <p style={{ margin: 0 }}>{comment.message}</p>}
            </article>
          ))}
        </section>
      )}

      <section className="account-card">
        <h2>المساعدة والدعم</h2>
        <a className="account-link" href="https://www.winrak.fr" target="_blank" rel="noreferrer">
          موقع WinRak
        </a>
      </section>

      <section className="account-card">
        <h2>الخصوصية والأمان</h2>
        <button className="account-link" type="button" onClick={() => navigate("/privacy")}>
          سياسة الخصوصية
        </button>
      </section>

      <button className="account-logout" type="button" onClick={logout}>
        تسجيل الخروج
      </button>

      <button className="account-delete" type="button" onClick={handleDeleteAccount}>
        حذف الحساب نهائياً
      </button>
    </section>
  );
}
