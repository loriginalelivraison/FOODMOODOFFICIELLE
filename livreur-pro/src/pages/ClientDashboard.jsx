import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { deleteClient, getClientCourses, getClientProfile, updateClientProfile,
  finishCourse, logoutCurrentAccount } from "../livreursapi.js";
import LoadingSpinner from "../components/LoadingSpinner.jsx";
import AddressLabel from "../components/AddressLabel.jsx";
import CourseComplaint from "../components/CourseComplaint.jsx";
import { clearStoredSession, readStoredAccount } from "../utils/navigation.js";
import { canFinishCourse, getCourseStatusLabel, isDeliveryVehicle } from "../utils/courseTracking.js";

function formatDate(value) {
  const date = new Date(value);
  return !value || Number.isNaN(date.getTime()) ? "غير متوفر" : date.toLocaleDateString("ar-DZ");
}

export default function ClientDashboard() {
  const navigate = useNavigate();
  const [client, setClient] = useState(() => readStoredAccount("client"));
  const [editingProfile, setEditingProfile] = useState(false);
  const [editNom, setEditNom] = useState(client?.nom || "");
  const [editPhoto, setEditPhoto] = useState(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [historyError, setHistoryError] = useState("");
  const [retry, setRetry] = useState(0);
  const [clientPoints, setClientPoints] = useState(null);

  useEffect(() => {
    let cancelled = false;
    let pending = false;
    async function refresh() {
      if (pending) return;
      pending = true;
      try {
        const data = await getClientCourses();
        if (cancelled) return;
        setCourses(data);
        setHistoryError("");
        const current = data.find((course) => course.active && !["completed", "cancelled"].includes(course.status));
        if (current) localStorage.setItem("currentClientCourseId", String(current.id));
        else localStorage.removeItem("currentClientCourseId");
      } catch (err) {
        if (!cancelled) setHistoryError(err.message || "تعذر تحميل الرحلات. حاول مجدداً.");
      } finally {
        pending = false;
        if (!cancelled) setLoading(false);
      }
    }
    refresh();
    const timer = setInterval(refresh, 15000);
    window.addEventListener("winrakPush", refresh);
    return () => {
      cancelled = true;
      clearInterval(timer);
      window.removeEventListener("winrakPush", refresh);
    };
  }, [retry]);

  useEffect(() => {
    let cancelled = false;
    getClientProfile().then((profile) => {
      if (cancelled || !profile) return;
      setClient(profile);
      setClientPoints(profile.points ?? 0);
      localStorage.setItem("client", JSON.stringify(profile));
      window.dispatchEvent(new Event("authChanged"));
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [retry]);

  const activeCourse = courses.find((course) => course.active && !["completed", "cancelled"].includes(course.status));
  const history = courses.filter((course) => !course.active || ["completed", "cancelled"].includes(course.status));
  const completedCount = courses.filter((course) => course.status === "completed").length;

  async function handleProfileSave(event) {
    event.preventDefault();
    if (!client || savingProfile) return;
    const nom = editNom.trim();
    if (!nom) { setError("الاسم مطلوب."); return; }
    if (editPhoto && editPhoto.size > 5 * 1024 * 1024) {
      setError("حجم الصورة يجب ألا يتجاوز 5 ميغابايت.");
      return;
    }
    setSavingProfile(true);
    setError("");
    setMessage("");
    try {
      const updated = await updateClientProfile(client.id, { nom, ...(editPhoto ? { photo: editPhoto } : {}) });
      const next = { ...client, ...updated };
      setClient(next);
      localStorage.setItem("client", JSON.stringify(next));
      window.dispatchEvent(new Event("authChanged"));
      setEditingProfile(false);
      setEditPhoto(null);
      setMessage("تم تحديث معلوماتك.");
    } catch (err) { setError(err.message || "تعذر تحديث المعلومات."); }
    finally { setSavingProfile(false); }
  }

  async function handleFinish() {
    if (!activeCourse || !canFinishCourse(activeCourse) || finishing) return;
    if (!window.confirm(isDeliveryVehicle(activeCourse.vehicle_type) ? "هل تم تسليم الطلب بالفعل؟" : "هل وصلت إلى وجهتك وانتهت الرحلة؟")) return;
    setFinishing(true);
    setError("");
    try {
      await finishCourse(activeCourse.id);
      localStorage.removeItem("currentClientCourseId");
      navigate(`/course/${activeCourse.id}`);
    } catch (err) { setError(err.message || "تعذر إنهاء الرحلة."); }
    finally { setFinishing(false); }
  }

  async function handleDelete() {
    if (!client || deleting || activeCourse || loading || historyError) return;
    if (!window.confirm("هل أنت متأكد من حذف حسابك نهائياً؟ لا يمكن التراجع عن هذه العملية.")) return;
    setDeleting(true);
    setError("");
    try {
      await deleteClient(client.id);
      clearStoredSession();
      window.dispatchEvent(new Event("authChanged"));
      navigate("/livreurs", { replace: true });
    } catch (err) { setError(err.message || "تعذر حذف الحساب."); }
    finally { setDeleting(false); }
  }

  async function logout() {
    if (loggingOut) return;
    setLoggingOut(true);
    await logoutCurrentAccount();
    navigate("/connexion-client", { replace: true });
  }

  if (!client) return null;
  return (
    <section className="page account-page" dir="rtl">
      <header className="account-header">
        <div className="account-photo-wrap">
          {client.photo ? <><a className="account-avatar" href={client.photo} target="_blank" rel="noopener noreferrer" aria-label="عرض صورتي الشخصية"><img src={client.photo} alt={client.nom} /></a>
            <a className="account-photo-view" href={client.photo} target="_blank" rel="noopener noreferrer">عرض الصورة</a></>
            : <div className="account-avatar" aria-hidden="true">{client.nom?.trim().charAt(0) || "؟"}</div>}
        </div>
        <div className="account-identity">
          <h1>{client.nom}</h1>
          <span className="account-role">حساب عميل</span>
          <span className="account-meta"><bdi>{client.telephone}</bdi></span>
        </div>
        <button type="button" className="account-edit-btn" aria-expanded={editingProfile}
          onClick={() => { setEditNom(client.nom || ""); setEditPhoto(null); setEditingProfile(!editingProfile); }}>تعديل</button>
      </header>
      <nav className="account-sections" aria-label="أقسام الحساب">
        <a href="#personal-info">المعلومات</a><a href="#trip-history">رحلاتي وطلباتي</a><a href="#account-settings">الإعدادات</a>
      </nav>
      {error && <p className="course-request-error" role="alert">{error}</p>}
      {message && <p className="account-feedback" role="status">{message}</p>}
      {historyError && <div className="course-request-error" role="alert">
        <p>{historyError}</p><button className="secondary-btn small" type="button" onClick={() => setRetry((value) => value + 1)}>إعادة المحاولة</button>
      </div>}
      <section className="account-card">
        <h2>رحلتي أو طلبي الحالي</h2>
        {loading ? <LoadingSpinner label="جارٍ تحميل الطلب الحالي…" /> : activeCourse ? <>
          <div className="account-row"><span className="account-row-label">الوجهة</span>
            <AddressLabel className="account-row-value" text={activeCourse.destination || "غير محددة"} /></div>
          <div className="account-row"><span className="account-row-label">الحالة</span>
            <span className="account-row-value">{getCourseStatusLabel(activeCourse)}</span></div>
          <Link className="primary-btn full" to={`/course/${activeCourse.id}`}>متابعة {isDeliveryVehicle(activeCourse.vehicle_type) ? "التوصيل" : "الرحلة"}</Link>
          {canFinishCourse(activeCourse) && <button className="secondary-btn full" type="button" onClick={handleFinish} disabled={finishing}>
            {finishing ? "جارٍ التأكيد…" : isDeliveryVehicle(activeCourse.vehicle_type) ? "تأكيد استلام الطلب" : "تأكيد الوصول"}
          </button>}
        </> : !historyError && <>
          <p className="account-empty">ليست لديك رحلة أو طلب نشط حالياً.</p>
          <Link className="primary-btn full" to="/livreurs">طلب رحلة أو توصيل</Link>
        </>}
      </section>
      <section className="account-card">
        <h2>نشاط حسابك</h2>
        <div className="account-points"><strong>{clientPoints ?? "—"}</strong><span className="account-points-label">نقطة</span></div>
        <p className="account-points-hint">تُضاف نقاط مكافأة مع كل رحلة أو توصيل مكتمل.</p>
        <div className="account-stat-grid">
          <div className="account-stat"><span>رحلات وطلبات مكتملة</span><strong>{loading || historyError ? "—" : completedCount}</strong></div>
          <div className="account-stat"><span>إجمالي الرحلات والطلبات</span><strong>{loading || historyError ? "—" : courses.length}</strong></div>
        </div>
      </section>
      {editingProfile && <section className="account-card" data-scroll-step="edit-profile">
        <h2>تعديل المعلومات</h2>
        <form className="account-form" onSubmit={handleProfileSave}>
          <label>الاسم<input value={editNom} onChange={(event) => setEditNom(event.target.value)} maxLength={100} autoComplete="name" required /></label>
          <label>صورة الحساب (اختيارية)<input type="file" accept="image/*" onChange={(event) => setEditPhoto(event.target.files?.[0] || null)} /></label>
          <label>رقم الهاتف<input value={client.telephone} dir="ltr" disabled readOnly /></label>
          <div className="account-form-actions">
            <button type="submit" className="save" disabled={savingProfile}>{savingProfile ? "جارٍ الحفظ…" : "حفظ"}</button>
            <button type="button" className="cancel" disabled={savingProfile} onClick={() => { setEditingProfile(false); setEditPhoto(null); }}>إلغاء</button>
          </div>
        </form>
      </section>}
      <section className="account-card" id="personal-info">
        <h2>المعلومات الشخصية</h2>
        <div className="account-row"><span className="account-row-label">الاسم</span><span className="account-row-value">{client.nom}</span></div>
        <div className="account-row"><span className="account-row-label">رقم الهاتف</span><bdi className="account-row-value">{client.telephone}</bdi></div>
      </section>
      <section className="account-card" id="trip-history">
        <h2>سجل الرحلات والطلبات</h2>
        {loading && <LoadingSpinner label="جارٍ تحميل السجل…" />}
        {!loading && !historyError && history.length === 0 && <p className="account-empty">ستظهر هنا رحلاتك وطلباتك السابقة.</p>}
        {history.map((course) => <article className="account-item" key={course.id}>
          <Link className="account-history-main" to={`/course/${course.id}`}>
          <div className="account-item-head">
            <strong>{isDeliveryVehicle(course.vehicle_type) ? "طلب" : "رحلة"} رقم {course.id}</strong>
            <span className={`account-status-pill ${course.status === "completed" ? "is-done" : "is-cancel"}`}>{getCourseStatusLabel(course)}</span>
          </div>
          <div className="account-item-meta">
            <span>{formatDate(course.created_at)}</span>
            {course.destination && <AddressLabel text={course.destination} />}
            {(course.final_price ?? course.proposed_price) != null && <span className="account-item-price">{course.final_price ?? course.proposed_price} دج</span>}
          </div>
          <span className="account-history-action">عرض التفاصيل</span>
          </Link>
          <CourseComplaint courseId={course.id} role="client" compact />
        </article>)}
      </section>
      <section className="account-card" id="account-settings">
        <h2>الإعدادات والخصوصية</h2>
        <Link className="account-link" to="/privacy">سياسة الخصوصية</Link>
        <button className="account-logout" type="button" onClick={logout} disabled={loggingOut}>{loggingOut ? "جارٍ تسجيل الخروج…" : "تسجيل الخروج"}</button>
        {activeCourse && <p className="account-empty">أكمل الطلب الحالي أو ألغِه قبل حذف حسابك.</p>}
        <button className="account-delete" type="button" onClick={handleDelete} disabled={deleting || loading || Boolean(activeCourse) || Boolean(historyError)}>
          {deleting ? "جارٍ حذف الحساب…" : "حذف الحساب نهائياً"}
        </button>
      </section>
    </section>
  );
}
