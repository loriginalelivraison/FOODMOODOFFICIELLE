import React, { useEffect, useRef, useState } from "react";
import {
  deleteLivreur,
  updateLivreurPosition,
  setLivreurUnavailable,
  getLivreurCourses,
  finishCourse,
} from "../livreursapi.js";
import LogoutButton from "../components/LogoutButton.jsx";
import LoadingSpinner from "../components/LoadingSpinner.jsx";
import MapActionButton from "../components/MapActionButton.jsx";
import { useNavigate } from "react-router-dom";
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
  const livreurStorage = localStorage.getItem("livreur");
  const livreur = livreurStorage ? JSON.parse(livreurStorage) : null;

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [position, setPosition] = useState(null);
  const [trackingEnabled, setTrackingEnabled] = useState(() => {
    const saved = localStorage.getItem("livreurTrackingEnabled");
    return saved === null ? true : saved === "true";
  });

  useEffect(() => {
    localStorage.setItem("livreurTrackingEnabled", String(trackingEnabled));
  }, [trackingEnabled]);

  const [activeCourse, setActiveCourse] = useState(null);
  const [courseNotification, setCourseNotification] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [courses, setCourses] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [finishingCourse, setFinishingCourse] = useState(false);
  const [updatingTracking, setUpdatingTracking] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    if (showHistory) {
      loadHistory();
    }
  }, [showHistory]);

  async function loadHistory() {
    setLoadingHistory(true);
    setError("");

    try {
      const data = await getLivreurCourses();
      setCourses(data);
    } catch (err) {
      setError(err.message || "حدث خطأ أثناء تحميل السجل");
    } finally {
      setLoadingHistory(false);
    }
  }

  useEffect(() => {
    if (!livreur?.id) return;
    if (!trackingEnabled) return;

    if (!navigator.geolocation) {
      setError("الموقع الجغرافي غير مدعوم في هذا المتصفح.");
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      async (pos) => {
        try {
          const newPosition = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          };

          console.log("GPS LIVREUR :", newPosition);

          setPosition(newPosition);

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
      navigator.geolocation.clearWatch(watchId);
    };
  }, [livreur?.id, trackingEnabled]);

 useEffect(() => {
  if (!livreur?.id) return;

  async function loadActiveCourse() {
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

  loadActiveCourse();

  const interval = setInterval(loadActiveCourse, 5000);

  return () => clearInterval(interval);
}, [livreur?.id]);
  if (!livreur) {
    return (
      <div style={{ padding: "20px" }} dir="rtl">
        <p>يجب تسجيل الدخول كسائق.</p>
      </div>
    );
  }

  const photoUrl = livreur.photo || livreur.image || null;
  const vehicleLabels = {
    moto: "moto",
    scooter: "moto",
    velo: "vélo",
    voiture: "voiture",
    camion: "camion",
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
    if (updatingTracking) return;

    if (trackingEnabled) {
      setUpdatingTracking(true);
      setTrackingEnabled(false);
      localStorage.setItem("livreurTrackingEnabled", "false");

      try {
        await setLivreurUnavailable(livreur.id);
      } catch (err) {
        console.error("Erreur désactivation partage localisation :", err);
        setError("Impossible de modifier votre disponibilité.");
      } finally {
        setUpdatingTracking(false);
      }

      return;
    }

    setTrackingEnabled(true);
    localStorage.setItem("livreurTrackingEnabled", "true");
  }

  async function handleFinishCourse() {
    if (!activeCourse || finishingCourse) return;

    setFinishingCourse(true);
    setError("");

    try {
      await finishCourse(activeCourse.id);
      setActiveCourse(null);
      setCourseNotification("");
      setMessage("تم إنهاء الرحلة وتسجيلها في السجل.");
      if (showHistory) loadHistory();
    } catch (err) {
      setError(err.message || "حدث خطأ أثناء إنهاء الرحلة.");
    } finally {
      setFinishingCourse(false);
    }
  }

  function logout() {
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
    <section className="page" dir="rtl">
      <div
        style={{
          background: "#fff7ed",
          border: "1px solid #fed7aa",
          borderRadius: "24px",
          padding: "18px",
          marginBottom: "18px",
          boxShadow: "0 10px 25px rgba(249,115,22,0.12)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "14px",
          }}
        >
          <div
            style={{
              width: "76px",
              height: "76px",
              borderRadius: "50%",
              overflow: "hidden",
              background: "#ffedd5",
              border: "3px solid white",
              flexShrink: 0,
            }}
          >
            {photoUrl ? (
              <img
                src={photoUrl}
                alt={livreur.nom}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                }}
              />
            ) : (
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  display: "grid",
                  placeItems: "center",
                  fontSize: "30px",
                }}
              >
                🛵
              </div>
            )}
          </div>

          <div>
            <h2 style={{ margin: 0 }}>{livreur.nom}</h2>
            <p style={{ margin: "6px 0", color: "#6b7280" }}>
              {livreur.ville} — {vehicleLabels[livreur.vehicule] || livreur.vehicule}
            </p>
            <p style={{ margin: 0, fontWeight: "600" }}>
              📞 {livreur.telephone}
            </p>
          </div>
        </div>

        <button
          onClick={handleTrackingToggle}
          style={{
            marginTop: "18px",
            width: "100%",
            padding: "13px",
            borderRadius: "14px",
            border: "none",
            background: trackingEnabled ? "#dc2626" : "#16a34a",
            color: "white",
            fontWeight: "bold",
            cursor: "pointer",
          }}
        >
          {updatingTracking ? (
            <LoadingSpinner label="جاري تحديث الموقع..." size={20} />
          ) : trackingEnabled ? "إيقاف مشاركة الموقع" : "تشغيل مشاركة الموقع"}
        </button>
      </div>

      {courseNotification && activeCourse && (
        <div
          className="course-notification clickable"
          role="button"
          tabIndex={0}
          onClick={() => navigate(`/livreur-course/${activeCourse.id}`)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              navigate(`/livreur-course/${activeCourse.id}`);
            }
          }}
          style={{
            background: "#f0fdf4",
            border: "1px solid #bbf7d0",
            color: "#15803d",
            padding: "14px",
            borderRadius: "14px",
            marginBottom: "15px",
            fontWeight: "700",
            textAlign: "center",
          }}
        >
          {courseNotification}
          <br />
          <span style={{ color: "#374151", fontWeight: "600" }}>
            رقم الرحلة: {activeCourse.id}
          </span>
          <button
            className="primary-btn full"
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              handleFinishCourse();
            }}
            disabled={finishingCourse}
            style={{ marginTop: "12px", background: "#dc2626" }}
          >
            {finishingCourse ? <LoadingSpinner label="جاري إنهاء الرحلة..." size={20} /> : "إنهاء الرحلة"}
          </button>
        </div>
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
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
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
      <button
        className="primary-btn full"
        style={{ marginTop: "14px" }}
        type="button"
        onClick={() => setShowHistory(!showHistory)}
      >
        {showHistory ? "إخفاء السجل" : "السجل"}
      </button>

      {showHistory && (
        <div className="tracking-card" style={{ marginTop: "18px" }}>
          <h2>سجل الرحلات</h2>

          {loadingHistory && <LoadingSpinner label="جاري تحميل السجل..." />}

          {!loadingHistory && courses.length === 0 && (
            <p>لا توجد رحلات مسجلة حالياً.</p>
          )}

          {!loadingHistory &&
            courses.map((course) => (
              <div
                key={course.id}
                style={{
                  background: "#fff7ed",
                  border: "1px solid #fed7aa",
                  borderRadius: "18px",
                  padding: "14px",
                  marginBottom: "14px",
                }}
              >
                <h3 style={{ marginTop: 0 }}>رحلة رقم {course.id}</h3>

                <p>
                  <strong>رقم الزبون:</strong> {course.client}
                </p>

                <p>
                  <strong>موقع الزبون:</strong>{" "}
                  {course.client_latitude && course.client_longitude
                    ? `${course.client_latitude}, ${course.client_longitude}`
                    : "غير متوفر"}
                </p>

                <p>
                  <strong>الحالة:</strong>{" "}
                  {course.active ? "نشطة" : "منتهية"}
                </p>

                <p>
                  <strong>تاريخ البداية:</strong>{" "}
                  {course.created_at
                    ? new Date(course.created_at).toLocaleString("ar-DZ")
                    : "غير متوفر"}
                </p>

                <p>
                  <strong>تاريخ النهاية:</strong>{" "}
                  {course.finished_at
                    ? new Date(course.finished_at).toLocaleString("ar-DZ")
                    : "لم تنته بعد"}
                </p>

                <p>
                  <strong>أنهى الرحلة:</strong>{" "}
                  {course.finished_by_name
                    ? `${course.finished_by_name} (${course.finished_by_type === "client" ? "الزبون" : "السائق"})`
                    : "غير معروف"}
                </p>
              </div>
            ))}
        </div>
      )}
      <button className="primary-btn full"
          style={{
            marginTop: "14px",
            background: "#991b1b",
            fontFamily: '"Cairo", sans-serif',
            fontWeight: "700",
            fontSize: "15px",
          }} onClick={logout} > خروج</button>
      <button
        onClick={handleDeleteAccount}
        style={{
          marginTop: "12px",
          width: "100%",
          padding: "13px",
          borderRadius: "14px",
          border: "1px solid #fecaca",
          background: "#fef2f2",
          color: "#c07d7d",
          fontWeight: "bold",
          cursor: "pointer",
        }}
      >
        حذف الحساب نهائيا
      </button>
    </section>
  );
}