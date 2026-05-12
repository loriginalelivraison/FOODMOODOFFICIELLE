import React, { useEffect, useState } from "react";
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

  useEffect(() => {
    function loadCourier() {
      getLivreurById(id)
        .then((livreur) => {
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
        })
        .catch((err) => {
          setError(err.message);
          setLoading(false);
        });
    }

    loadCourier();

    const interval = setInterval(loadCourier, 5000);

    return () => clearInterval(interval);
  }, [id]);

  useEffect(() => {
    loadComments();
  }, [id]);

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

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const position = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        };

        setClientPosition(position);

        try {
          const course = await createCourse({
            client: client.id,
            livreur: courier.id,
            client_latitude: position.latitude,
            client_longitude: position.longitude,
          });

          setActiveCourseId(course.id);
          setCourseStarted(true);
          setCourseMessage("رائع! يمكنك الآن متابعة السائق على الخريطة.");
          setCourseFinished(false);
          setShowAcceptedQuestion(false);
        } catch (err) {
          setError(err.message || "Erreur création course");
        }
      },
      () => {
        setError("يجب تفعيل الموقع لمشاركة موقعك مع السائق.");
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  }

  async function handleFinishCourse() {
    try {
      if (activeCourseId) {
        await finishCourse(activeCourseId);
      }

      setClientPosition(null);
      setCourseStarted(false);
      setCourseMessage("");
      setCourseFinished(true);
      setShowCommentForm(true);
    } catch (err) {
      setError(err.message || "Erreur fin course");
    }
  }

  async function handleSubmitComment(e) {
    e.preventDefault();

    setCommentError("");
    setCommentSuccess("");

    if (!messageCommentaire.trim()) {
      setCommentError("Le commentaire est obligatoire.");
      return;
    }

    try {
      await createCommentaireLivreur({
        livreur: id,
        nom_client: nomClient,
        message: messageCommentaire,
      });

      setMessageCommentaire("");
      setNomClient("");
      setShowCommentForm(false);
      setCommentSuccess("Commentaire ajouté.");
      loadComments();
    } catch (err) {
      setCommentError(err.message);
    }
  }

  function getVehicleLabel(vehicle) {
    const labels = {
      moto: "🛵 دراجة نارية",
      velo: "🚴 دراجة هوائية",
      voiture: "🚘 سيارة",
      camion: "🚛 شاحنة",
    };

    return labels[vehicle] || vehicle || "غير محدد";
  }

  if (loading) {
    return <section className="page">Chargement du suivi...</section>;
  }

  if (error) {
    return <section className="page">{error}</section>;
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
          📞 Appeler
        </button>

        <button
          className="primary-btn small"
          type="button"
          onClick={() => {
            if (!requireClientAuth()) return;
            setShowAcceptedQuestion(true);
            window.open(`https://wa.me/${courier.whatsapp}`, "_blank");
          }}
        >
          WhatsApp
        </button>

        {courseFinished && (
          <button
            className="primary-btn small"
            type="button"
            onClick={() => setShowCommentForm(!showCommentForm)}
          >
            Commenter
          </button>
        )}
      </div>

      {showAcceptedQuestion && !courseStarted && (
        <div className="tracking-card">
          <h3>هل تم قبول الرحلة؟</h3>

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
              onClick={() => navigate("/livreurs")}
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

      {showCommentForm && (
        <form className="tracking-card" onSubmit={handleSubmitComment}>
          <h3>Ajouter un commentaire</h3>

          <input
            type="text"
            placeholder="Votre nom"
            value={nomClient}
            onChange={(e) => setNomClient(e.target.value)}
          />

          <textarea
            placeholder="Votre commentaire"
            value={messageCommentaire}
            onChange={(e) => setMessageCommentaire(e.target.value)}
            rows="4"
          />

          <button className="primary-btn small" type="submit">
            Envoyer
          </button>

          {commentError && <p style={{ color: "red" }}>{commentError}</p>}
        </form>
      )}

      {commentSuccess && <p style={{ color: "green" }}>{commentSuccess}</p>}

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

        {comments.length === 0 && <h5>لا يوجد بعد أي تعليق</h5>}

        {comments.map((comment) => (
          <div key={comment.id} className="comment-card">
            <strong>{comment.nom_client || "Client"}</strong>
            <p>{comment.message}</p>
            <small>{new Date(comment.created_at).toLocaleString("fr-FR")}</small>
          </div>
        ))}
      </div>
    </section>
  );
}