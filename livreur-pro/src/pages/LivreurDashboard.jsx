import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  updateLivreurPosition,
  setLivreurUnavailable,
  getLivreurById,
  deleteLivreur,
} from "../livreursapi.js";

export default function LivreurDashboard() {
  const { id } = useParams();
  const navigate = useNavigate();

  const livreurStorage = localStorage.getItem("livreur");
  const livreur = livreurStorage ? JSON.parse(livreurStorage) : null;

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [trackingEnabled, setTrackingEnabled] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [deleting, setDeleting] = useState(false);

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
            await updateLivreurPosition(id, {
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
            });

            console.log("تم تحديث الموقع بنجاح");
          } catch (err) {
            if (!stopped) setError(err.message);
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

  async function handleDeleteAccount() {
    const confirmDelete = window.confirm(
      "هل أنت متأكد من حذف حسابك نهائياً؟ لا يمكن التراجع عن هذه العملية."
    );

    if (!confirmDelete) return;

    setError("");
    setMessage("");
    setDeleting(true);

    try {
      await deleteLivreur(id);

      localStorage.removeItem("access");
      localStorage.removeItem("refresh");
      localStorage.removeItem("role");
      localStorage.removeItem("livreur");
      localStorage.removeItem("client");
      localStorage.removeItem("redirectAfterLogin");

      window.dispatchEvent(new Event("authChanged"));

      navigate("/livreurs");
    } catch (err) {
      setError(err.message || "حدث خطأ أثناء حذف الحساب");
    } finally {
      setDeleting(false);
    }
  }


  //detecter si la geolocalisation est activé zinon le demander 
  const [locationDisabled, setLocationDisabled] = useState(false);
  const [locationEnabled, setLocationEnabled] = useState(false);
 useEffect(() => {
  navigator.geolocation.getCurrentPosition(
    () => {
      setLocationDisabled(false);
    },
    () => {
      setLocationDisabled(true);
    }
  );
}, []);

useEffect(() => {
  function checkLocation() {
    navigator.geolocation.getCurrentPosition(
      () => {
        setLocationDisabled(false);
        setLocationEnabled(true);
      },
      () => {
        setLocationDisabled(true);
        setLocationEnabled(false);
      }
    );
  }

  checkLocation();

  const interval = setInterval(checkLocation, 7000);

  return () => clearInterval(interval);
}, []);

  return (
    <section
      className="page"
      dir="rtl"
      style={{
        fontFamily: '"Cairo", sans-serif',
      }}
    >
      {locationDisabled && (
  <div
    style={{
      background: "#fef2f2",
      border: "1px solid #fecaca",
      color: "#b91c1c",
      padding: "14px",
      borderRadius: "12px",
      marginBottom: "18px",
      fontWeight: "600",
      textAlign: "center",
    }}
  >
    ⚠️ يرجى تفعيل الموقع الجغرافي (GPS) للحصول على أفضل تجربة داخل التطبيق.
  </div>
)}

{locationEnabled && (
  <div
    style={{
      background: "#f0fdf4",
      border: "1px solid #bbf7d0",
      color: "#15803d",
      padding: "14px",
      borderRadius: "12px",
      marginBottom: "18px",
      fontWeight: "600",
      textAlign: "center",
    }}
  >
    ✅ موقعك الجغرافي مفعل ويتم مشاركته بنجاح
  </div>
)}

      <div className="page-title">
        

        <h1
          style={{
            fontWeight: "800",
            fontSize: "32px",
          }}
        >
          لوحة تحكم السائق
        </h1>
      </div>
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
          {trackingEnabled ? "إيقاف مشاركة الموقع" : "تفعيل مشاركة الموقع"}
        </button>


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
          <strong>رقم الهاتف:</strong> {livreur?.telephone || "غير متوفر"}
        </p>

        <p>
          <strong>المدينة:</strong> {livreur?.ville || "غير متوفر"}
        </p>



        

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
      <button
          className="primary-btn full"
          style={{
            marginTop: "14px",
            background: "#d18989",
            fontFamily: '"Cairo", sans-serif',
            fontWeight: "700",
            fontSize: "15px",
          }}
          onClick={handleDeleteAccount}
          disabled={deleting}
        >
          {deleting ? "جاري حذف الحساب..." : "حذف حسابي نهائياً"}
        </button>
    </section>
  );
}