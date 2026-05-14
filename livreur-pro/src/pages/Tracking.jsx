import React, { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  getLivreurById,
  getCommentairesLivreur,
  createCommentaireLivreur,
  createCourse,
  finishCourse,
} from "../livreursapi.js";
import TrackingMap from "./TrackingMap.jsx";

export default function Tracking() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [courier, setCourier] = useState(null);
  const [comments, setComments] = useState([]);

  const [showCommentForm, setShowCommentForm] = useState(false);
  const [nomClient, setNomClient] = useState("");
  const [messageCommentaire, setMessageCommentaire] = useState("");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [commentError, setCommentError] = useState("");
  const [commentSuccess, setCommentSuccess] = useState("");

  const [showAcceptedQuestion, setShowAcceptedQuestion] = useState(false);
  const [clientPosition, setClientPosition] = useState(null);
  const [courseStarted, setCourseStarted] = useState(false);
  const [courseFinished, setCourseFinished] = useState(false);
  const [activeCourseId, setActiveCourseId] = useState(null);
  const [courseMessage, setCourseMessage] = useState("");

  const clientWatchRef = useRef(null);

  const [note, setNote] = useState(5);
  const [showCommentQuestion, setShowCommentQuestion] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(`activeTrackingCourse_${id}`);

    if (!saved) return;

    try {
      const data = JSON.parse(saved);

      setActiveCourseId(data.courseId);
      setCourseStarted(data.courseStarted);
      setCourseFinished(data.courseFinished);
      setClientPosition(data.clientPosition);
      setCourseMessage(data.courseMessage || "");
      setShowAcceptedQuestion(false);
    } catch (err) {
      console.error("Erreur restauration course :", err);
    }
  }, [id]);

  useEffect(() => {
    async function loadCourier() {
      try {
        const livreur = await getLivreurById(id);

        setCourier({
          id: livreur.id,
          name: livreur.nom,
          city: livreur.ville,
          vehicle: livreur.vehicule,
          available: Boolean(livreur.disponible),
          phone: livreur.telephone,
          photo: livreur.photo,
          whatsapp: livreur.telephone
            ?.replace(/\s/g, "")
            .replace("+", "")
            .replace(/^0/, "33"),
          latitude: livreur.latitude,
          longitude: livreur.longitude,
        });

        setLoading(false);
      } catch (err) {
        setError("حدث خطأ أثناء تحميل معلومات السائق.");
        setLoading(false);
      }
    }

    loadCourier();

    const interval = setInterval(loadCourier, 8000);

    return () => clearInterval(interval);
  }, [id]);

  useEffect(() => {
    loadComments();
  }, [id]);

  useEffect(() => {
    return () => {
      if (clientWatchRef.current !== null) {
        navigator.geolocation.clearWatch(clientWatchRef.current);
      }
    };
  }, []);

  async function loadComments() {
    try {
      const data = await getCommentairesLivreur(id);
      const list = Array.isArray(data) ? data : data.results || [];
      setComments(list);
    } catch (err) {
      console.log(err.message);
    }
  }

  function requireClientAuth() {
    const token = localStorage.getItem("access");
    const role = localStorage.getItem("role");

    if (!token || role !== "client") {
      localStorage.setItem("redirectAfterLogin", `/tracking/${id}`);
      navigate("/connexion-client");
      return false;
    }

    return true;
  }

  async function handleCourseAccepted() {
    const clientStorage = localStorage.getItem("client");
    const client = clientStorage ? JSON.parse(clientStorage) : null;

    if (!client?.id) {
      navigate("/connexion-client");
      return;
    }

    if (!navigator.geolocation) {
      setError("الموقع الجغرافي غير مدعوم في هذا المتصفح.");
      return;
    }

    if (clientWatchRef.current !== null) {
      navigator.geolocation.clearWatch(clientWatchRef.current);
    }

    let courseCreated = false;

    const watchId = navigator.geolocation.watchPosition(
      async (pos) => {
        const position = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        };

        setClientPosition(position);

        if (!courseCreated) {
          courseCreated = true;

          try {
            const payload = {
              client: client.id,
              livreur: courier.id,
              client_latitude: position.latitude,
              client_longitude: position.longitude,
            };

            const course = await createCourse(payload);

            setActiveCourseId(course.id);
            setCourseStarted(true);
            setCourseMessage("رائع! يمكنك الآن متابعة السائق على الخريطة.");
            setCourseFinished(false);
            setShowAcceptedQuestion(false);

            localStorage.setItem(
              `activeTrackingCourse_${id}`,
              JSON.stringify({
                courseId: course.id,
                courseStarted: true,
                courseFinished: false,
                clientPosition: position,
                courseMessage: "رائع! يمكنك الآن متابعة السائق على الخريطة.",
              })
            );
          } catch (err) {
            console.error("ERREUR CREATE COURSE :", err);
            setError(err.message || "حدث خطأ أثناء إنشاء الرحلة.");
          }
        } else {
          localStorage.setItem(
            `activeTrackingCourse_${id}`,
            JSON.stringify({
              courseId: activeCourseId,
              courseStarted: true,
              courseFinished: false,
              clientPosition: position,
              courseMessage: "رائع! يمكنك الآن متابعة السائق على الخريطة.",
            })
          );
        }
      },
      () => {
        setError("يجب تفعيل الموقع الجغرافي لمشاركة موقعك مع السائق.");
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );

    clientWatchRef.current = watchId;
  }

  async function handleFinishCourse() {
    try {
      if (activeCourseId) {
        await finishCourse(activeCourseId);
      }

      if (clientWatchRef.current !== null) {
        navigator.geolocation.clearWatch(clientWatchRef.current);
        clientWatchRef.current = null;
      }

setClientPosition(null);
setCourseStarted(false);
setCourseMessage("");
setCourseFinished(true);
setShowCommentQuestion(true);
setShowCommentForm(false);

localStorage.removeItem(`activeTrackingCourse_${id}`);
    } catch (err) {
      setError("حدث خطأ أثناء إنهاء الرحلة.");
    }
  }

  async function handleSubmitComment(e) {
    e.preventDefault();

    setCommentError("");
    setCommentSuccess("");

    if (!messageCommentaire.trim()) {
      setCommentError("التعليق إجباري.");
      return;
    }

    try {
      await createCommentaireLivreur({
        livreur: id,
        nom_client: nomClient,
        message: messageCommentaire,
        note: note,
      });

      setMessageCommentaire("");
      setNomClient("");
      setShowCommentForm(false);
      setCommentSuccess("تمت إضافة التعليق بنجاح.");
      loadComments();
      navigate("/livreurs");
    } catch (err) {
      setCommentError("حدث خطأ أثناء إضافة التعليق.");
    }
  }

  function getVehicleLabel(vehicle) {
    const labels = {
      moto: "🛵 دراجة نارية",
      scooter: "🛵 سكوتر",
      velo: "🚴 دراجة هوائية",
      voiture: "🚘 سيارة",
      camion: "🚛 شاحنة",
    };

    return labels[vehicle] || vehicle || "غير محدد";
  }

  if (loading) {
    return (
      <section className="page" dir="rtl">
        جاري تحميل معلومات التتبع...
      </section>
    );
  }

  if (error) {
    return (
      <section className="page" dir="rtl">
        {error}
      </section>
    );
  }

  const photoUrl = courier.photo || null;

  return (
    <section className="page" dir="rtl">
      <div
        style={{
          background: "#fff7ed",
          border: "1px solid #fed7aa",
          borderRadius: "26px",
          padding: "18px",
          marginBottom: "18px",
          boxShadow: "0 10px 25px rgba(249,115,22,0.12)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "16px",
          }}
        >
          <div
            style={{
              width: "88px",
              height: "88px",
              borderRadius: "50%",
              overflow: "hidden",
              background: "#ffedd5",
              border: "4px solid white",
              boxShadow: "0 6px 16px rgba(0,0,0,0.12)",
              flexShrink: 0,
            }}
          >
            {photoUrl ? (
              <img
                src={photoUrl}
                alt={courier.name}
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
                  fontSize: "34px",
                }}
              >
                🛵
              </div>
            )}
          </div>

          <div style={{ flex: 1 }}>
            <h2 style={{ margin: "0 0 6px", color: "#111827" }}>
              {courier.name}
            </h2>

            <p style={{ margin: "4px 0", color: "#6b7280", fontWeight: "600" }}>
              📍 {courier.city}
            </p>

            <p style={{ margin: "4px 0", color: "#374151", fontWeight: "700" }}>
              {getVehicleLabel(courier.vehicle)}
            </p>

            <p
              style={{
                marginTop: "8px",
                display: "inline-block",
                background: courier.available ? "#dcfce7" : "#fee2e2",
                color: courier.available ? "#15803d" : "#b91c1c",
                padding: "5px 10px",
                borderRadius: "999px",
                fontWeight: "700",
                fontSize: "13px",
              }}
            >
              {courier.available ? "متاح الآن" : "غير متاح"}
            </p>
          </div>
        </div>
      </div>

      <div className="card-bottom">
        <button
          className="primary-btn small"
          type="button"
          onClick={() => {
            if (!requireClientAuth()) return;
            setShowAcceptedQuestion(true);
            window.location.href = `tel:${courier.phone}`;
          }}
        >
          📞 اتصال
        </button>

        <button
          className="primary-btn small"
          type="button"
          onClick={() => {
            if (!requireClientAuth()) return;
            setShowAcceptedQuestion(true);
            window.open(`https://wa.me/${courier.whatsapp}`, "_blank");
          }}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            background: "#22c55e",
          }}
        >
          <span
            style={{
              width: "9px",
              height: "9px",
              background: "#dcfce7",
              borderRadius: "50%",
              display: "inline-block",
            }}
          ></span>
          واتساب
        </button>

        {courseFinished && (
          <button
            className="primary-btn small"
            type="button"
            onClick={() => setShowCommentForm(!showCommentForm)}
          >
            إضافة تعليق
          </button>
        )}
      </div>

      {showAcceptedQuestion && !courseStarted && (
        <div className="tracking-card">
          <h3>هل قبل السائق الرحلة؟</h3>

          <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
            <button
              className="primary-btn small"
              style={{ background: "#16a34a" }}
              onClick={handleCourseAccepted}
            >
              نعم
            </button>

            <button
              className="primary-btn small"
              style={{ background: "#dc2626" }}
              onClick={() => {
                setShowAcceptedQuestion(false);
                setCourseFinished(true);
                setShowCommentForm(true);
              }}
            >
              لا
            </button>
          </div>
        </div>
      )}

      {courseMessage && (
        <div
          style={{
            background: "#f0fdf4",
            border: "1px solid #bbf7d0",
            color: "#15803d",
            padding: "14px",
            borderRadius: "12px",
            marginBottom: "15px",
            fontWeight: "700",
            textAlign: "center",
          }}
        >
          ✅ {courseMessage}
        </div>
      )}

      {courseStarted && (
        <button
          className="primary-btn full"
          style={{
            background: "#dc2626",
            marginBottom: "15px",
          }}
          onClick={handleFinishCourse}
        >
          عند انتهاء الرحلة اضغط هنا
        </button>
      )}

    {showCommentQuestion && !showCommentForm && (
  <div
    className="tracking-card"
    style={{
      textAlign: "center",
      padding: "22px",
    }}
  >
    <h3
      style={{
        marginBottom: "18px",
        color: "#111827",
      }}
    >
      هل تريد ترك تعليق وتقييم للسائق؟
    </h3>

    <div
      style={{
        display: "flex",
        justifyContent: "center",
        gap: "14px",
      }}
    >
      <button
        className="primary-btn"
        type="button"
        style={{
          background: "#16a34a",
          minWidth: "120px",
          borderRadius: "14px",
        }}
        onClick={() => {
          setShowCommentForm(true);
          setShowCommentQuestion(false);
        }}
      >
        ⭐ نعم
      </button>

<button
  className="primary-btn small"
  style={{ background: "#dc2626" }}
  onClick={() => {
    setShowAcceptedQuestion(false);
    setCourseFinished(true);
    setShowCommentQuestion(true);
    setShowCommentForm(false);
  }}
>
  لا
</button>
    </div>
  </div>
)}
      {showCommentForm && (
        <form className="tracking-card" onSubmit={handleSubmitComment}>
          <h3>
            {courseFinished
              ? "هل تريد ترك تعليق حول السائق؟"
              : "إضافة تعليق"}
          </h3>

          <input
            type="text"
            placeholder="اسمك"
            value={nomClient}
            onChange={(e) => setNomClient(e.target.value)}
          />

          <div style={{ textAlign: "center", marginBottom: "14px" }}>
  <p style={{ fontWeight: "700", marginBottom: "8px" }}>
    تقييم السائق
  </p>

  {[1, 2, 3, 4, 5].map((star) => (
    <button
      key={star}
      type="button"
      onClick={() => setNote(star)}
      style={{
        fontSize: "30px",
        background: "transparent",
        border: "none",
        cursor: "pointer",
        color: star <= note ? "#f59e0b" : "#d1d5db",
      }}
    >
      ★
    </button>
  ))}
</div>

          <textarea
            placeholder="اكتب تعليقك هنا"
            value={messageCommentaire}
            onChange={(e) => setMessageCommentaire(e.target.value)}
            rows="4"
          />

          <button className="primary-btn small" type="submit">
            إرسال
          </button>

          {commentError && <p style={{ color: "red" }}>{commentError}</p>}
        </form>
      )}

      {commentSuccess && (
        <p style={{ color: "green", textAlign: "center", fontWeight: "600" }}>
          {commentSuccess}
        </p>
      )}

      <div
        className="tracking-card"
        style={{
          padding: "10px",
          borderRadius: "24px",
          overflow: "hidden",
          background: "#fff7ed",
          border: "2px solid #fed7aa",
        }}
      >
        <TrackingMap courier={courier} clientPosition={clientPosition} />
      </div>

      <div className="tracking-card">
        <h3>التعليقات</h3>

        {comments.length === 0 && <h5>لا توجد تعليقات بعد</h5>}

        {comments.map((comment) => (
          <div key={comment.id} className="comment-card">
            <strong>👤 {comment.nom_client || "زبون"}</strong>
            <p>{comment.message}</p>
            <small>{new Date(comment.created_at).toLocaleString("fr-FR")}</small>
          </div>
        ))}
      </div>
    </section>
  );
}