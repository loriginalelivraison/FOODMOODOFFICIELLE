import React from "react";
import { Link } from "react-router-dom";
import { CarFront, ChevronDown, History, LogOut, Pencil, Phone, ShieldCheck, Star, Trophy, User } from "lucide-react";
import DriverDocuments from "./DriverDocuments.jsx";
import LoadingSpinner from "./LoadingSpinner.jsx";
import AddressLabel from "./AddressLabel.jsx";
import { formatDriverNumber } from "../utils/driverOrders.js";
import { getCourseStatusLabel } from "../utils/courseTracking.js";

const VEHICLES = { voiture: "سيارة", moto: "دراجة نارية", scooter: "دراجة نارية", camion: "شاحنة", velo: "دراجة" };
function formatDate(value) {
  const date = value && new Date(value);
  return date && !Number.isNaN(date.getTime()) ? date.toLocaleDateString("ar-DZ") : "—";
}

export default function DriverAccount({ livreur, profile, courses, reviews, loadingHistory,
  historyError, closingAccount, editingProfile, onEdit, form, onLogout, onDelete, onPrivacy }) {
  const name = profile?.nom || livreur.nom;
  const vehicle = profile?.vehicule || livreur.vehicule;
  const photo = profile?.photo || livreur.photo || livreur.image;
  const assignedCourses = courses.filter((course) => String(course.livreur) === String(livreur.id));
  return <>
    <header className="driver-account-title"><h1>حسابي</h1></header>
    <section className="account-card driver-profile-card" id="personal-info">
      <div className="driver-profile-heading">
        <div className="account-photo-wrap">
          {photo ? <><a className="account-avatar" href={photo} target="_blank" rel="noopener noreferrer" aria-label="عرض صورتي الشخصية"><img src={photo} alt={name} /></a>
            <a className="account-photo-view" href={photo} target="_blank" rel="noopener noreferrer">عرض الصورة</a></>
            : <div className="account-avatar"><User size={30} aria-hidden="true" /></div>}
        </div>
        <div className="account-identity"><h2>{name}</h2>
          <span className="driver-profile-phone"><Phone size={15} aria-hidden="true" /><bdi>{profile?.telephone || livreur.telephone}</bdi></span>
        </div>
        <button className="driver-edit-button" type="button" onClick={onEdit} aria-expanded={editingProfile} disabled={form.saving}>
          <Pencil size={16} aria-hidden="true" />تعديل
        </button>
      </div>
      {(profile?.ville || livreur.ville) && <div className="account-row"><span className="account-row-label">المدينة</span>
        <AddressLabel className="account-row-value" text={profile?.ville || livreur.ville} /></div>}
      {editingProfile && <form className="account-form driver-profile-form" data-scroll-step="edit-profile" onSubmit={form.onSave}>
        <label>الاسم<input value={form.name} onChange={(event) => form.setName(event.target.value)} maxLength={100} required /></label>
        <label>رقم الهاتف<input value={livreur.telephone || ""} disabled readOnly dir="ltr" /></label>
        <label>المدينة<input value={form.city} onChange={(event) => form.setCity(event.target.value)} maxLength={100} /></label>
        <label>صورة الحساب (اختيارية)<input type="file" accept="image/*" onChange={(event) => form.setPhoto(event.target.files?.[0] || null)} /></label>
        <label>نوع المركبة<select value={form.vehicle} onChange={(event) => form.setVehicle(event.target.value)}>
          <option value="moto">دراجة نارية</option><option value="voiture">سيارة</option>
          <option value="camion">شاحنة</option><option value="velo">دراجة</option>
        </select></label>
        {form.vehicle === "voiture" && <label>{"\u0637\u0631\u0627\u0632 \u0627\u0644\u0633\u064a\u0627\u0631\u0629"}<input
          value={form.vehicleModel}
          onChange={(event) => form.setVehicleModel(event.target.value)}
          maxLength={50}
          placeholder={"\u0645\u062b\u0627\u0644: Clio 2 \u0623\u0648 Peugeot 208"}
          required
        /></label>}
        <div className="account-form-actions">
          <button type="submit" className="save" disabled={form.saving}>{form.saving ? "جارٍ الحفظ…" : "حفظ"}</button>
          <button type="button" className="cancel" onClick={form.onCancel} disabled={form.saving}>إلغاء</button>
        </div>
      </form>}
    </section>
    <section className="account-card driver-vehicle-section" id="vehicle-info">
      <h2><CarFront size={20} aria-hidden="true" />المركبة والوثائق</h2>
      <div className="account-row"><span className="account-row-label">نوع المركبة</span>
        <span className="account-row-value">{VEHICLES[vehicle] || vehicle || "غير متوفر"}</span></div>
      {vehicle === "voiture" && (profile?.modele_vehicule || livreur.modele_vehicule) && <div className="account-row"><span className="account-row-label">طراز السيارة</span>
        <span className="account-row-value">{profile?.modele_vehicule || livreur.modele_vehicule}</span></div>}
    </section>
    <DriverDocuments driverId={livreur.id} />
    <section className="account-card driver-account-rewards">
      <h2><Trophy size={20} aria-hidden="true" />النشاط</h2>
      <div className="driver-account-stats">
        <div><strong>{formatDriverNumber(profile?.points ?? livreur.points)}</strong><span>النقاط</span></div>
        <div><strong>{formatDriverNumber(profile?.nombre_livraisons ?? livreur.nombre_livraisons)}</strong><span>الرحلات</span></div>
        <div><strong><Star size={17} aria-hidden="true" />{formatDriverNumber(profile?.note ?? livreur.note)}</strong><span>التقييم</span></div>
      </div>
    </section>
    <section className="account-card driver-account-history-card">
      <details className="driver-account-archive">
        <summary><History size={18} aria-hidden="true" />السجل والتقييمات<ChevronDown size={16} aria-hidden="true" /></summary>
        <div className="driver-account-history">
          <h3>سجل الرحلات</h3>
          {loadingHistory && <LoadingSpinner label="جارٍ تحميل السجل…" />}
          {historyError && <p role="alert">{historyError}</p>}
          {!loadingHistory && !historyError && assignedCourses.length === 0 && <p className="account-empty">لا توجد رحلات</p>}
          {!loadingHistory && assignedCourses.map((course) => <article className="account-item" key={course.id}>
            <div className="account-item-head"><strong>رحلة رقم <bdi>{course.id}</bdi></strong>
              <span className="account-status-pill">{getCourseStatusLabel(course)}</span></div>
            <div className="account-item-meta"><span>{formatDate(course.created_at)}</span>
              {course.destination && <AddressLabel text={course.destination} />}
              {(course.final_price ?? course.proposed_price) != null && <span className="account-item-price"><bdi>{formatDriverNumber(course.final_price ?? course.proposed_price)}</bdi> دج</span>}
            </div>
            {course.status === "completed" && course.client_confirmed && <Link className="account-history-action" to={`/livreur-course/${course.id}`}>
              {course.client_review_submitted ? "عرض الرحلة" : "تقييم العميل"}
            </Link>}
          </article>)}
          {reviews.length > 0 && <><h3>تقييمات الزبائن</h3>{reviews.map((review) => <article className="account-item" key={review.id}>
            <div className="account-item-head"><strong>★ {review.note ?? "—"} / 5</strong><span>{formatDate(review.created_at)}</span></div>
            {review.message && <p>{review.message}</p>}
          </article>)}</>}
        </div>
      </details>
    </section>
    <section className="account-card driver-account-settings" id="account-settings">
      <h2><ShieldCheck size={20} aria-hidden="true" />الإعدادات</h2>
      <button className="account-link" type="button" onClick={onPrivacy}>سياسة الخصوصية</button>
      <a className="account-link" href="https://www.winrak.fr" target="_blank" rel="noreferrer">موقع WinRak</a>
      <button className="account-logout" type="button" onClick={onLogout} disabled={closingAccount}><LogOut size={18} aria-hidden="true" />تسجيل الخروج</button>
      <button className="account-delete" type="button" onClick={onDelete} disabled={closingAccount}>حذف الحساب نهائياً</button>
    </section>
  </>;
}
