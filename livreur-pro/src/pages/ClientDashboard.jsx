import React, { useEffect, useState } from "react";
import {
  deleteClient,
  getClientCourses,
  getCommentairesLivreur,
  clearCurrentDriverFcmToken,
  updateClientProfile,
  getClientProfile,
  finishCourse,
} from "../livreursapi.js";
import { useNavigate } from "react-router-dom";
import LoadingSpinner from "../components/LoadingSpinner.jsx";

const STATUS_LABELS = {
  searching: "جارٍ البحث عن سائق",
  driver_accepted: "بانتظار اختيار السائق",
  driver_selected: "تم تأكيد السائق",
  driver_arriving: "السائق في الطريق",
  driver_arrived: "وصل السائق",
  in_progress: "الرحلة جارية",
  completed: "مكتملة",
  cancelled: "ملغاة",
};

const STATUS_CLASSES = {
  completed: "is-done",
  cancelled: "is-cancel",
};

function formatDate(value) {
  if (!value) return "غير متوفر";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "غير متوفر" : date.toLocaleDateString("ar-DZ");
}

export default function ClientDashboard() {
  const navigate = useNavigate();

  const [client, setClient] = useState(() => {
    const stored = localStorage.getItem("client");
    return stored ? JSON.parse(stored) : null;
  });

  const [editingProfile, setEditingProfile] = useState(false);
  const [editNom, setEditNom] = useState(client?.nom || "");
  const [savingProfile, setSavingProfile] = useState(false);

  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [showHistory, setShowHistory] = useState(true);
  const [courses, setCourses] = useState([]);
  const [comments, setComments] = useState({});
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [activeCourse, setActiveCourse] = useState(null);
  const [loadingActiveCourse, setLoadingActiveCourse] = useState(true);
  const [activeCourseError, setActiveCourseError] = useState("");
  const [clientPoints, setClientPoints] = useState(null);
  const [finishingActiveCourse, setFinishingActiveCourse] = useState(false);

  useEffect(() => {
    if (showHistory) {
      loadHistory();
    }
  }, [showHistory]);

  useEffect(() => {
    if (!localStorage.getItem("access") || localStorage.getItem("role") !== "client") return;
    loadClientProfile();
  }, []);

  useEffect(() => {
    if (!localStorage.getItem("access") || localStorage.getItem("role") !== "client") {
      setLoadingActiveCourse(false);
      return undefined;
    }

    let cancelled = false;

    async function refreshActiveCourse() {
      try {
        const clientCourses = await getClientCourses();
        const currentCourse = clientCourses.find(
          (course) => course.active && !["completed", "cancelled"].includes(course.status)
        ) || null;
        if (cancelled) return;

        setActiveCourse(currentCourse);
        setActiveCourseError("");
        if (currentCourse) {
          localStorage.setItem("currentClientCourseId", String(currentCourse.id));
        } else {
          localStorage.removeItem("currentClientCourseId");
        }
      } catch (err) {
        if (!cancelled) setActiveCourseError(err.message || "تعذر تحميل الرحلة الحالية.");
      } finally {
        if (!cancelled) setLoadingActiveCourse(false);
      }
    }

    refreshActiveCourse();
    const interval = setInterval(refreshActiveCourse, 15000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  async function loadClientProfile() {
    try {
      const data = await getClientProfile();
      if (data) setClientPoints(data.points ?? 0);
    } catch (err) {
      console.error("Erreur chargement profil client :", err);
    }
  }

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

         commentsByLivreur[livreurId] = list;
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

  async function handleProfileSave(event) {
    event.preventDefault();
    if (!client || savingProfile) return;

    const nom = editNom.trim();

    if (!nom) {
      setError("الاسم مطلوب.");
      return;
    }

    setSavingProfile(true);
    setError("");

    try {
      const updated = await updateClientProfile(client.id, { nom });
      const nextClient = { ...client, nom: updated.nom || nom };
      setClient(nextClient);
      localStorage.setItem("client", JSON.stringify(nextClient));
      window.dispatchEvent(new Event("authChanged"));
      setEditingProfile(false);
    } catch (err) {
      setError(err.message || "تعذر تحديث المعلومات.");
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleFinishActiveCourse() {
    if (!activeCourse || finishingActiveCourse) return;

    setFinishingActiveCourse(true);
    setError("");

    try {
      await finishCourse(activeCourse.id);
      setActiveCourse(null);
      localStorage.removeItem("currentClientCourseId");
      await loadClientProfile();
      await loadHistory();
    } catch (err) {
      setError(err.message || "تعذر إنهاء الرحلة.");
    } finally {
      setFinishingActiveCourse(false);
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


 async function logout() {
  await clearCurrentDriverFcmToken();
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

  const initial = (client.nom || "؟").trim().charAt(0) || "؟";
  const reviews = Object.values(comments).flat();
  const completedCourses = courses.filter((course) => course.status === "completed").length;

  return (
    <section className="page account-page" dir="rtl">
      <header className="account-header">
        <div className="account-avatar">{initial}</div>
        <div className="account-identity">
          <h1>{client.nom}</h1>
          <span className="account-meta">
            <span>📞 {client.telephone}</span>
          </span>
        </div>
        <button
          type="button"
          className="account-edit-btn"
          onClick={() => {
            setEditNom(client.nom || "");
            setEditingProfile((value) => !value);
          }}
        >
          تعديل
        </button>
      </header>

      <section className="account-card">
        <h2>رحلتي الحالية</h2>
        {loadingActiveCourse && <LoadingSpinner label="جارٍ البحث عن رحلة نشطة…" />}
        {!loadingActiveCourse && activeCourse && (
          <>
            <div className="account-row">
              <span className="account-row-label">الوجهة</span>
              <span className="account-row-value">{activeCourse.destination || "قيد التنفيذ"}</span>
            </div>
            <div className="account-row">
              <span className="account-row-label">الحالة</span>
              <span className="account-row-value">{STATUS_LABELS[activeCourse.status] || "نشطة"}</span>
            </div>
            <button
              className="primary-btn full"
              type="button"
              onClick={() => navigate(`/course/${activeCourse.id}`)}
            >
              متابعة الرحلة
            </button>
            <button
              className="primary-btn full"
              type="button"
              onClick={handleFinishActiveCourse}
              disabled={finishingActiveCourse}
              style={{ background: "#dc2626" }}
            >
              {finishingActiveCourse ? "جارٍ إنهاء الرحلة…" : "إنهاء الرحلة"}
            </button>
          </>
        )}
        {!loadingActiveCourse && !activeCourse && !activeCourseError && (
          <p className="account-empty">ليست لديك رحلة نشطة حالياً.</p>
        )}
        {activeCourseError && <p className="course-request-error" role="alert">{activeCourseError}</p>}
      </section>

      <section className="account-card">
        <h2>حالة حسابك</h2>
        <div className="account-points">
          <span className="account-points-icon" aria-hidden="true">🏅</span>
          <strong>{clientPoints ?? 0}</strong>
          <span className="account-points-label">نقطة</span>
        </div>
        <p className="account-points-hint">تُضاف نقاط مكافأة مع كل رحلة مكتملة.</p>
        <div className="account-stat-grid">
          <div className="account-stat">
            <span>رحلات مكتملة</span>
            <strong>{completedCourses}</strong>
          </div>
          <div className="account-stat">
            <span>إجمالي الرحلات</span>
            <strong>{courses.length}</strong>
          </div>
        </div>
      </section>

      {editingProfile && (
        <section className="account-card">
          <h2>تعديل المعلومات</h2>
          <form className="account-form" onSubmit={handleProfileSave}>
            <label>
              الاسم
              <input
                value={editNom}
                onChange={(event) => setEditNom(event.target.value)}
                maxLength={100}
              />
            </label>
            <label>
              رقم الهاتف
              <input value={client.telephone} disabled readOnly />
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

      <section className="account-card">
        <h2>المعلومات الشخصية</h2>
        <div className="account-row">
          <span className="account-row-label">الاسم</span>
          <span className="account-row-value">{client.nom}</span>
        </div>
        <div className="account-row">
          <span className="account-row-label">رقم الهاتف</span>
          <span className="account-row-value">{client.telephone}</span>
        </div>
      </section>

      <section className="account-card">
        <h2>رحلاتي</h2>
        {loadingHistory && <LoadingSpinner label="جاري تحميل السجل..." />}
        {!loadingHistory && courses.length === 0 && (
          <p className="account-empty">لا توجد رحلات مسجلة حالياً.</p>
        )}
        {!loadingHistory && courses.map((course) => (
          <article className="account-item" key={course.id}>
            <div className="account-item-head">
              <strong>رحلة رقم {course.id}</strong>
              <span className={`account-status-pill ${STATUS_CLASSES[course.status] || (course.active ? "is-active" : "")}`}>
                {STATUS_LABELS[course.status] || (course.active ? "نشطة" : "منتهية")}
              </span>
            </div>
            <div className="account-item-meta">
              <span>{formatDate(course.created_at)}</span>
              {course.livreur && <span>السائق: {course.livreur}</span>}
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
          <h2>تقييماتي</h2>
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
        <a className="account-link" href="/livreurs">
          عرض السائقين المتاحين
        </a>
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

      {error && <p className="course-request-error" role="alert">{error}</p>}

      <button className="account-logout" type="button" onClick={logout}>
        تسجيل الخروج
      </button>

      <button
        className="account-delete"
        type="button"
        onClick={handleDeleteClientAccount}
        disabled={deleting}
      >
        {deleting ? "جارٍ حذف الحساب…" : "حذف الحساب نهائياً"}
      </button>
    </section>
  );
}