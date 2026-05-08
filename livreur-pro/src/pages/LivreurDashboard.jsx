import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import {
  updateLivreurPosition,
  setLivreurUnavailable,
  getLivreurById,
} from "../livreursapi.js";

export default function LivreurDashboard() {
  const { id } = useParams();

  const livreurStorage = localStorage.getItem("livreur");
  const livreur = livreurStorage ? JSON.parse(livreurStorage) : null;

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [trackingEnabled, setTrackingEnabled] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState(true);

  // تحميل حالة السائق
  useEffect(() => {
    async function loadLivreurStatus() {
      try {
        const data = await getLivreurById(id);

        setTrackingEnabled(data.disponible === true);
      } catch (err) {
        setError("تعذر تحميل حالة السائق");
      } finally {
        setLoadingStatus(false);
      }
    }

    loadLivreurStatus();
  }, [id]);

  // إرسال الموقع كل 10 ثواني
  useEffect(() => {
    if (loadingStatus) return;
    if (!livreur) return;
    if (!trackingEnabled) return;

    let stopped = false;

    function sendPosition() {
      if (stopped) return;

      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          if (stopped) return;

          try {
            const newPosition = {
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
            };

            await updateLivreurPosition(id, newPosition);

            if (stopped) return;

            console.log("تم تحديث الموقع بنجاح");
          } catch (err) {
            if (!stopped) {
              setError(err.message);
            }
          }
        },
        () => {
          if (!stopped) {
            setError("تم رفض صلاحية تحديد الموقع");
          }
        }
      );
    }

    sendPosition();

    const interval = setInterval(sendPosition, 10000);

    return () => {
      stopped = true;
      clearInterval(interval);
    };
  }, [trackingEnabled, id, loadingStatus, livreur]);

  // تشغيل / إيقاف التتبع
  async function handleToggleTracking() {
    setError("");
    setMessage("");

    try {
      if (trackingEnabled) {
        setTrackingEnabled(false);

        await setLivreurUnavailable(id);

        setMessage("تم إيقاف التتبع، حالتك الآن مشغول");
      } else {
        setTrackingEnabled(true);

        setMessage("تم تفعيل التتبع، حالتك الآن متاح");
      }
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <section
      className="page"
      dir="rtl"
      style={{
        fontFamily: '"Cairo", sans-serif',
      }}
    >
      <div className="page-title">
        <span
          className="eyebrow"
          style={{
            fontWeight: "700",
            fontSize: "14px",
          }}
        >
          مساحة السائق
        </span>

        <h1
          style={{
            fontWeight: "800",
            fontSize: "32px",
          }}
        >
          لوحة تحكم السائق
        </h1>


      </div>

      <div className="tracking-card">
        <h2
          style={{
            fontWeight: "700",
            marginBottom: "18px",
          }}
        >
          {livreur?.nom || "السائق"}
        </h2>

        <p>
          <strong>رقم الهاتف:</strong>{" "}
          {livreur?.telephone || "غير متوفر"}
        </p>

        <p>
          <strong>المدينة:</strong>{" "}
          {livreur?.ville || "غير متوفر"}
        </p>

        <button
          className="primary-btn full"
          style={{
            marginTop: "22px",
            background: trackingEnabled ? "#dc2626" : "#16a34a",
            fontFamily: '"Cairo", sans-serif',
            fontWeight: "700",
            fontSize: "15px",
          }}
          onClick={handleToggleTracking}
        >
          {trackingEnabled
            ? "إيقاف مشاركة الموقع"
            : "تفعيل مشاركة الموقع"}
        </button>

        {message && (
          <p
            style={{
              color: "#16a34a",
              marginTop: "16px",
              fontWeight: "600",
            }}
          >
            {message}
          </p>
        )}

        {error && (
          <p
            style={{
              color: "#dc2626",
              marginTop: "16px",
              fontWeight: "600",
            }}
          >
            {error}
          </p>
        )}
      </div>
    </section>
  );
}