import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { finishCourse, getCourse } from "../livreursapi.js";

function getGoogleMapsUrl(latitude, longitude) {
  const destination = `${encodeURIComponent(latitude)},${encodeURIComponent(longitude)}`;
  return `https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=driving`;
}

export default function LivreurCourse() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [course, setCourse] = useState(null);
  const [error, setError] = useState("");
  const [finishing, setFinishing] = useState(false);

  useEffect(() => {
    let cancelled = false;

    getCourse(id)
      .then((data) => {
        if (!cancelled) setCourse(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || "تعذر تحميل الرحلة.");
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  function startRoute() {
    if (!course) return;

    const { client_latitude: latitude, client_longitude: longitude } = course;

    if (latitude === null || longitude === null) {
      setError("موقع الزبون غير متوفر حاليا.");
      return;
    }

    window.location.href = getGoogleMapsUrl(latitude, longitude);
  }

  async function handleFinishCourse() {
    if (!course || !course.active || finishing) return;

    setFinishing(true);
    setError("");

    try {
      await finishCourse(course.id);
      navigate(`/livreur-dashboard/${course.livreur}`);
    } catch (err) {
      setError(err.message || "حدث خطأ أثناء إنهاء الرحلة.");
      setFinishing(false);
    }
  }

  if (error) {
    return (
      <section className="page" dir="rtl">
        <p style={{ color: "#b91c1c", textAlign: "center" }}>{error}</p>
        <button className="primary-btn full" onClick={() => navigate(-1)}>
          رجوع
        </button>
      </section>
    );
  }

  if (!course) {
    return (
      <section className="page" dir="rtl">
        جاري تحميل معلومات الرحلة...
      </section>
    );
  }

  const hasClientLocation =
    course.client_latitude !== null && course.client_longitude !== null;

  return (
    <section className="page" dir="rtl">
      <div
        style={{
          background: "#fff7ed",
          border: "1px solid #fed7aa",
          borderRadius: "24px",
          padding: "22px",
          marginBottom: "18px",
        }}
      >
        <h2 style={{ marginTop: 0 }}>تفاصيل الرحلة</h2>
        <p style={{ fontWeight: "700" }}>رقم الرحلة: {course.id}</p>
        <p style={{ color: "#4b5563" }}>
          حالة الرحلة: {course.active ? "نشطة" : "منتهية"}
        </p>
        <p style={{ color: "#4b5563" }}>
          موقع الزبون: {hasClientLocation ? "متوفر" : "غير متوفر"}
        </p>
      </div>

      <button
        className="primary-btn full"
        type="button"
        onClick={startRoute}
        disabled={!hasClientLocation}
        style={{
          background: hasClientLocation ? "#16a34a" : "#9ca3af",
          cursor: hasClientLocation ? "pointer" : "not-allowed",
        }}
      >
        بدء الرحلة إلى الزبون عبر Google Maps
      </button>

      {course.active && (
        <button
          className="primary-btn full"
          type="button"
          onClick={handleFinishCourse}
          disabled={finishing}
          style={{ marginTop: "14px", background: "#dc2626" }}
        >
          {finishing ? "جاري إنهاء الرحلة..." : "إنهاء الرحلة"}
        </button>
      )}
    </section>
  );
}
