import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  updateLivreurPosition,
  setLivreurUnavailable,
  getLivreurById,
  deleteLivreur,getActiveCourse,updateLivreurPhoto,
} from "../livreursapi.js";
import TrackingMap from "./TrackingMap.jsx";
import logo2 from "../assets/logo2.png"

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
  const [activeCourse, setActiveCourse] = useState(null);
  const [clientPosition, setClientPosition] = useState(null);
  const [courseNotification, setCourseNotification] = useState(false);
  const [livreurData, setLivreurData] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [updatingPhoto, setUpdatingPhoto] = useState(false);
  
  useEffect(() => {
    async function loadLivreurStatus() {
      try {
        const data = await getLivreurById(id);
        setLivreurData(data);
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

useEffect(() => {
  if (!id) return;

  async function loadActiveCourse() {
    try {
      const data = await getActiveCourse(id);

      if (data.active && data.course) {
        setActiveCourse(data.course);

        setClientPosition({
          latitude: data.course.client_latitude,
          longitude: data.course.client_longitude,
        });

        setCourseNotification(true);
      } else {
        setActiveCourse(null);
        setClientPosition(null);
        setCourseNotification(false);
      }
    } catch (err) {
      console.log(err.message);
    }
  }

  loadActiveCourse();

  const interval = setInterval(loadActiveCourse, 5000);

  return () => clearInterval(interval);
}, [id]);

async function handlePhotoChange(e) {
  const file = e.target.files[0];

  if (!file) return;

  setPhotoPreview(URL.createObjectURL(file));
  setError("");
  setMessage("");
  setUpdatingPhoto(true);

  try {
    const updatedLivreur = await updateLivreurPhoto(id, file);

    setLivreurData(updatedLivreur);

    const oldLivreur = JSON.parse(localStorage.getItem("livreur")) || {};
    localStorage.setItem(
      "livreur",
      JSON.stringify({
        ...oldLivreur,
        photo: updatedLivreur.photo,
      })
    );

    setMessage("تم تغيير الصورة بنجاح");
  } catch (err) {
    setError(err.message || "تعذر تغيير الصورة");
  } finally {
    setUpdatingPhoto(false);
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
        {courseNotification && (
  <div
    style={{
      background: "#eff6ff",
      border: "1px solid #bfdbfe",
      color: "#1d4ed8",
      padding: "14px",
      borderRadius: "12px",
      marginBottom: "18px",
      fontWeight: "700",
      textAlign: "center",
    }}
  >
    📍 لديك طلب جديد: موقع العميل ظاهر على الخريطة
  </div>
)}
{clientPosition && (
  <div className="tracking-card">
    <h3>موقع العميل</h3>

    <TrackingMap
      courier={{
        name: livreur?.nom,
        vehicle: "سائق",
        latitude: clientPosition.latitude,
        longitude: clientPosition.longitude,
      }}
      clientPosition={clientPosition}
    />
  </div>
)}

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

        <div style={{ textAlign: "center", marginBottom: "20px" }}>
  <img
    src={photoPreview || livreurData?.photo || logo2 }
    alt="صورة السائق"
    style={{
      width: "110px",
      height: "110px",
      borderRadius: "50%",
      objectFit: "cover",
      border: "4px solid white",
      boxShadow: "0 8px 20px rgba(0,0,0,0.15)",
    }}
  />

  <label
    style={{
      display: "block",
      marginTop: "12px",
      fontWeight: "700",
      cursor: "pointer",
      color: "#ea580c",
    }}
  >
    <button
 type="button"
              className="primary-btn full"> {updatingPhoto ? "جاري تغيير الصورة..." : "تغيير الصورة"}</button>
    <input
      type="file"
      accept="image/*"
      onChange={handlePhotoChange}
      style={{ display: "none" }}
      disabled={updatingPhoto}
    />
  </label>
</div>
        <h2
          style={{
            fontWeight: "700",
            marginBottom: "18px",
          }}
        >
          {livreurData?.nom || "السائق"}
        </h2>

        <h3>
          <strong>رقم الهاتف :</strong> {livreurData?.telephone || "غير متوفر"}
        </h3>

        <h3>
          <strong>المنطقة :</strong> {livreurData?.ville || "غير متوفر"}
        </h3>



        

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