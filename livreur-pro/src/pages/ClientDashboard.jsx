import React, { useEffect, useState } from "react";
import {
  deleteClient,
  getClientCourses,
  getCommentairesLivreur,
} from "../livreursapi.js";
import { useNavigate } from "react-router-dom";

export default function ClientDashboard() {
  const navigate = useNavigate();

  const clientStorage = localStorage.getItem("client");
  const client = clientStorage ? JSON.parse(clientStorage) : null;

  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [courses, setCourses] = useState([]);
  const [comments, setComments] = useState({});
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    if (showHistory) {
      loadHistory();
    }
  }, [showHistory]);

  async function loadHistory() {
    setLoadingHistory(true);
    setError("");

    try {
      const data = await getClientCourses();
      setCourses(data);

      const commentsByLivreur = {};

      for (const course of data) {
        const livreurId = course.livreur;

        if (livreurId && !commentsByLivreur[livreurId]) {
          const commentaires = await getCommentairesLivreur(livreurId);
          const list = Array.isArray(commentaires)
            ? commentaires
            : commentaires.results || [];

          commentsByLivreur[livreurId] = list.filter(
            (comment) =>
              comment.nom_client === client?.nom ||
              comment.nom_client === client?.telephone
          );
        }
      }

      setComments(commentsByLivreur);
    } catch (err) {
      setError(err.message || "حدث خطأ أثناء تحميل السجل");
    } finally {
      setLoadingHistory(false);
    }
  }

  async function handleDeleteClientAccount() {
    const confirmDelete = window.confirm(
      "هل أنت متأكد من حذف حسابك نهائياً؟ لا يمكن التراجع عن هذه العملية."
    );

    if (!confirmDelete) return;

    setError("");
    setMessage("");
    setDeleting(true);

    try {
      await deleteClient(client.id);

      localStorage.removeItem("access");
      localStorage.removeItem("refresh");
      localStorage.removeItem("role");
      localStorage.removeItem("livreur");
      localStorage.removeItem("client");
      localStorage.removeItem("redirectAfterLogin");

      window.dispatchEvent(new Event("authChanged"));

      navigate("/livreurs", { replace: true });
    } catch (err) {
      setError(err.message || "حدث خطأ أثناء حذف الحساب");
    } finally {
      setDeleting(false);
    }
  }

  if (!client) {
    return (
      <section className="page" dir="rtl">
        <div className="tracking-card">
          <h2>يجب تسجيل الدخول كزبون</h2>
          <button
            className="primary-btn full"
            onClick={() => navigate("/connexion-client")}
          >
            تسجيل الدخول
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="page" dir="rtl">
      <div className="page-title">
        <span className="eyebrow">فضاء الزبون</span>
        <h1>لوحة تحكم الزبون</h1>
        <p>مرحباً بك في حسابك، يمكنك متابعة السائقين والاطلاع على سجل رحلاتك.</p>
      </div>

      <div className="tracking-card">
        <h2>إجراءات الحساب</h2>

        <a className="primary-btn full" href="/livreurs">
          عرض السائقين المتاحين
        </a>

        <button
          className="primary-btn full"
          type="button"
          onClick={() => setShowHistory(!showHistory)}
        >
          {showHistory ? "إخفاء السجل" : "السجل"}
        </button>

        <button
          className="primary-btn full"
          style={{
            marginTop: "14px",
            background: "#991b1b",
            fontFamily: '"Cairo", sans-serif',
            fontWeight: "700",
            fontSize: "15px",
          }}
          onClick={handleDeleteClientAccount}
          disabled={deleting}
        >
          {deleting ? "جاري حذف الحساب..." : "حذف حسابي نهائياً"}
        </button>

        {message && (
          <p style={{ color: "green", marginTop: "14px" }}>{message}</p>
        )}

        {error && (
          <p style={{ color: "red", marginTop: "14px" }}>{error}</p>
        )}
      </div>

      {showHistory && (
        <div className="tracking-card">
          <h2>سجل الرحلات</h2>

          {loadingHistory && <p>جاري تحميل السجل...</p>}

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
                  <strong>رقم السائق:</strong> {course.livreur}
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

                <div style={{ marginTop: "12px" }}>
                  <strong>تعليقاتك على هذا السائق:</strong>

                  {comments[course.livreur]?.length > 0 ? (
                    comments[course.livreur].map((comment) => (
                      <div
                        key={comment.id}
                        style={{
                          background: "white",
                          borderRadius: "12px",
                          padding: "10px",
                          marginTop: "8px",
                          border: "1px solid #e5e7eb",
                        }}
                      >
                        <p style={{ margin: 0 }}>
                          ⭐ {comment.note || 5} / 5
                        </p>
                        <p>{comment.message}</p>
                        <small>
                          {comment.created_at
                            ? new Date(comment.created_at).toLocaleString(
                                "ar-DZ"
                              )
                            : ""}
                        </small>
                      </div>
                    ))
                  ) : (
                    <p>لا يوجد تعليق مسجل لهذه الرحلة.</p>
                  )}
                </div>
              </div>
            ))}
        </div>
      )}
    </section>
  );
}