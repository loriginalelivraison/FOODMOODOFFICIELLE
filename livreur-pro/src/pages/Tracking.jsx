import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getLivreurById, getCommentairesLivreur } from "../livreursapi.js";
import LoadingSpinner from "../components/LoadingSpinner.jsx";
import AddressLabel from "../components/AddressLabel.jsx";
import defaultAvatar from "../assets/pasdephoto.png";

const VEHICLES = { voiture: "سائق سيارة", moto: "عامل توصيل", camion: "نقل بالشاحنة" };

export default function Tracking() {
  const { id } = useParams();
  const [courier, setCourier] = useState(null);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [commentsError, setCommentsError] = useState("");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    setCommentsError("");
    setComments([]);
    getLivreurById(id).then((data) => {
      if (!cancelled) setCourier(data);
    }).catch((err) => {
      if (!cancelled) setError(err.message || "تعذر تحميل الملف.");
    }).finally(() => { if (!cancelled) setLoading(false); });
    getCommentairesLivreur(id).then((data) => {
      if (!cancelled) setComments(Array.isArray(data) ? data : data.results || []);
    }).catch(() => { if (!cancelled) setCommentsError("تعذر تحميل التقييمات."); });
    return () => { cancelled = true; };
  }, [id, retry]);

  return (
    <section className="page account-page" dir="rtl">
      <Link className="account-link" to="/livreurs">العودة إلى طلب رحلة أو توصيل</Link>
      {loading ? <LoadingSpinner label="جارٍ تحميل الملف…" fullPage /> : error ? <div className="account-card" role="alert">
        <p>{error}</p><button className="secondary-btn" type="button" onClick={() => setRetry((value) => value + 1)}>إعادة المحاولة</button>
      </div> : courier && <>
        <header className="account-header">
          <img className="profile-driver-photo" src={courier.photo || defaultAvatar} alt="" />
          <div className="account-identity">
            <h1>{courier.nom}</h1>
            <span className="account-role">{VEHICLES[courier.vehicule] || "سائق"}</span>
            <span className="account-meta"><AddressLabel text={courier.ville} /></span>
            {courier.modele_vehicule && <span>{courier.modele_vehicule}</span>}
          </div>
        </header>
        <section className="account-card">
          <h2>طلب الخدمة</h2>
          <p>حدّد نقطة الانطلاق والوجهة، ثم اختر من يقبل طلبك. تظهر بيانات التواصل بعد تأكيد الاختيار.</p>
          <Link className="primary-btn full" to="/livreurs">طلب رحلة أو توصيل</Link>
        </section>
        <section className="account-card">
          <h2>تقييمات العملاء</h2>
          {commentsError && <p role="status">{commentsError}</p>}
          {!commentsError && comments.length === 0 && <p className="account-empty">لا توجد تقييمات حتى الآن.</p>}
          {comments.map((comment) => <article className="account-item" key={comment.id}>
            <div className="account-item-head"><strong>{comment.nom_client || "عميل"}</strong><span aria-label={`${comment.note} من 5`}>★ {comment.note} / 5</span></div>
            <p>{comment.message}</p>
          </article>)}
        </section>
      </>}
    </section>
  );
}