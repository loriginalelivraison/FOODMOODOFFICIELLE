import React, { useEffect, useState } from "react";
import {
  updateLivreurPosition,
  deleteLivreur,
  getActiveCoursesForLivreur,
} from "../livreursapi.js";
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

function RecenterMap({ position }) {
  const map = useMap();

  useEffect(() => {
    if (position?.latitude && position?.longitude) {
      map.panTo(
        [Number(position.latitude), Number(position.longitude)],
        {
          animate: true,
          duration: 1,
        }
      );
    }
  }, [position, map]);

  return null;
}

export default function LivreurDashboard() {
  const livreurStorage = localStorage.getItem("livreur");
  const livreur = livreurStorage ? JSON.parse(livreurStorage) : null;

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [position, setPosition] = useState(null);
  const [trackingEnabled, setTrackingEnabled] = useState(true);

  const [activeCourse, setActiveCourse] = useState(null);
  const [courseNotification, setCourseNotification] = useState("");

  const navigate = useNavigate();

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
  moto: "🛵 دراجة نارية",
  velo: "🚴 دراجة هوائية",
  voiture: "🚘 سيارة",
  camion: "🚛 شاحنة",
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

      navigate("/inscription-livreur");
    } catch (err) {
      console.error(err);
      setError("حدث خطأ أثناء حذف الحساب.");
   
    }


  }

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
          onClick={() => setTrackingEnabled(!trackingEnabled)}
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
          {trackingEnabled ? "إيقاف مشاركة الموقع" : "تشغيل مشاركة الموقع"}
        </button>
      </div>

      {courseNotification && activeCourse && (
        <div
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
        }}
      >
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
            attribution="&copy; OpenStreetMap"
            url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          />

          {position && (
            <>
              <RecenterMap position={position} />

              <Marker
                position={[
                  Number(position.latitude),
                  Number(position.longitude),
                ]}
              >
                <Popup>
                  <strong>موقعي الحالي</strong>
                  <br />
                  {livreur.nom}
                </Popup>
              </Marker>
            </>
          )}

         {activeCourse &&
  activeCourse.client_latitude !== null &&
  activeCourse.client_longitude !== null &&
  !isNaN(Number(activeCourse.client_latitude)) &&
  !isNaN(Number(activeCourse.client_longitude)) && (
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