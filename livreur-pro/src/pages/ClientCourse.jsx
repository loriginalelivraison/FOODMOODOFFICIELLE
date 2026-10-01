import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { MapContainer, Marker, Polyline, Popup, TileLayer } from "react-leaflet";
import { cancelCourse, getCourse } from "../livreursapi.js";
import LoadingSpinner from "../components/LoadingSpinner.jsx";

const cancellationReasons = [
  ["changed_mind", "غيّرت رأيي"],
  ["driver_delay", "تأخر السائق"],
  ["request_error", "خطأ في الوجهة أو الطلب"],
  ["other", "سبب آخر"],
];

const statusLabels = {
  searching: "جارٍ البحث عن سائق",
  driver_accepted: "قبل بعض السائقين الرحلة",
  driver_selected: "تم تأكيد السائق",
  driver_arriving: "السائق في الطريق إليك",
  driver_arrived: "وصل السائق",
  in_progress: "الرحلة جارية",
  completed: "انتهت الرحلة",
  cancelled: "أُلغيت الرحلة",
};

function positionIsValid(latitude, longitude) {
  return latitude !== null && latitude !== undefined
    && longitude !== null && longitude !== undefined
    && Number.isFinite(Number(latitude)) && Number.isFinite(Number(longitude));
}

export default function ClientCourse() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [course, setCourse] = useState(null);
  const [error, setError] = useState("");
  const [reason, setReason] = useState(cancellationReasons[0][0]);
  const [comment, setComment] = useState("");
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function refresh() {
      try {
        const data = await getCourse(id);
        if (!cancelled) {
          setCourse(data);
          setError("");
          if (["completed", "cancelled"].includes(data.status)) {
            localStorage.removeItem("currentClientCourseId");
          }
        }
      } catch (err) {
        if (!cancelled) setError(err.message || "تعذر تحميل الرحلة.");
      }
    }
    refresh();
    const interval = setInterval(refresh, 4000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [id]);

  async function handleCancel(event) {
    event.preventDefault();
    if (!course || cancelling) return;
    setCancelling(true);
    setError("");
    try {
      const updated = await cancelCourse(course.id, reason, comment);
      setCourse(updated);
      localStorage.removeItem("currentClientCourseId");
    } catch (err) {
      setError(err.message || "تعذر إلغاء الرحلة.");
    } finally {
      setCancelling(false);
    }
  }

  if (!course) {
    return <section className="page" dir="rtl"><LoadingSpinner label="جارٍ تحميل الرحلة…" fullPage />{error && <p role="alert">{error}</p>}</section>;
  }

  const start = [course.client_latitude, course.client_longitude];
  const destination = [course.destination_latitude, course.destination_longitude];
  const driver = course.accepted_drivers?.find((candidate) => candidate.id === course.livreur)
    || course.accepted_drivers?.[0];
  const route = Array.isArray(course.route_geometry)
    ? course.route_geometry.map(([longitude, latitude]) => [latitude, longitude])
    : [];
  const center = positionIsValid(...start)
    ? [Number(start[0]), Number(start[1])]
    : [36.75, 3.06];
  const canCancel = !["completed", "cancelled"].includes(course.status);

  return (
    <section className="page" dir="rtl">
      <div className="course-follow-header">
        <div>
          <span className="course-request-kicker">WinRak · الرحلة رقم {course.id}</span>
          <h1>متابعة الرحلة</h1>
        </div>
        <strong>{statusLabels[course.status] || course.status}</strong>
      </div>

      {["searching", "driver_accepted", "driver_selected", "driver_arriving", "driver_arrived", "in_progress"].includes(course.status) && (
        <div className="course-progress-notice" aria-live="polite">
          <LoadingSpinner label="" size={28} />
          <div>
            <strong>{course.status === "searching" ? "البحث عن سائق جارٍ" : course.status === "driver_accepted" ? "بانتظار اختيارك للسائق" : course.status === "driver_selected" || course.status === "driver_arriving" ? "السائق في طريقه إليك" : course.status === "driver_arrived" ? "السائق وصل، بانتظار بدء الرحلة" : "الرحلة جارية الآن"}</strong>
            <p>{course.status === "searching" ? "نبحث عن سائق قريب لطلبك. يرجى الانتظار." : course.status === "driver_accepted" ? "راجع السائقين الذين ردوا واختر من يناسبك." : course.status === "driver_selected" || course.status === "driver_arriving" ? "يمكنك متابعة موقع السائق وتفاصيل الرحلة هنا." : course.status === "driver_arrived" ? "السائق ينتظر عند موقع الانطلاق." : "يتم تنفيذ الرحلة إلى وجهتك."}</p>
          </div>
        </div>
      )}

      <div className="course-follow-summary">
        <p><b>موقع الانطلاق</b><span>{positionIsValid(...start) ? `${Number(start[0]).toFixed(5)}, ${Number(start[1]).toFixed(5)}` : "غير متوفر"}</span></p>
        <p><b>الوجهة</b><span>{course.destination || "غير محددة"}</span></p>
        <p><b>المسافة التقديرية</b><span>{course.estimated_distance_km == null ? "غير متوفرة" : `${course.estimated_distance_km} كم`}</span></p>
        <p><b>السعر المقترح</b><span>{course.final_price ?? course.proposed_price} دج{Number(course.surcharge_percent) > 0 ? ` · زيادة ${course.surcharge_percent}٪` : ""}</span></p>
      </div>

      {positionIsValid(...start) && (
        <div className="course-follow-map">
          <MapContainer center={center} zoom={13} style={{ height: "100%", width: "100%" }}>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <Marker position={center}><Popup>موقع الانطلاق</Popup></Marker>
            {positionIsValid(...destination) && <Marker position={[Number(destination[0]), Number(destination[1])]}><Popup>{course.destination}</Popup></Marker>}
            {driver && positionIsValid(driver.latitude, driver.longitude) && <Marker position={[Number(driver.latitude), Number(driver.longitude)]}><Popup>{driver.nom}</Popup></Marker>}
            {route.length > 1 && <Polyline positions={route} pathOptions={{ color: "#176b53", weight: 5 }} />}
            {route.length < 2 && positionIsValid(...destination) && <Polyline positions={[center, [Number(destination[0]), Number(destination[1])]]} pathOptions={{ color: "#176b53", weight: 4, dashArray: "8 8" }} />}
          </MapContainer>
        </div>
      )}

      {driver && (
        <section className="course-follow-driver">
          <h2>السائق</h2>
          <p><b>{driver.nom}</b> · {driver.vehicule} · {driver.note == null ? "بدون تقييم" : `★ ${driver.note}`}</p>
          <p>{driver.distance_km == null ? "المسافة غير متوفرة" : `${driver.distance_km} كم من موقع الانطلاق`}</p>
          <a href={`tel:${driver.telephone}`}>{driver.telephone}</a>
        </section>
      )}

      {course.events?.length > 0 && (
        <section className="course-event-list">
          <h2>مراحل الرحلة</h2>
          {course.events.map((event, index) => (
            <p key={`${event.event_type}-${event.created_at}-${index}`}>
              <span>{statusLabels[event.new_status] || (event.event_type === "created" ? "تم إنشاء الطلب" : event.event_type === "drivers_notified" ? "تم إشعار السائقين" : event.event_type === "accepted" ? "قبِل السائق الطلب" : event.event_type === "rejected" ? "رفض السائق الطلب" : event.event_type.replaceAll("_", " "))}</span>
              <time>{new Date(event.created_at).toLocaleString("ar-DZ")}</time>
            </p>
          ))}
        </section>
      )}

      {canCancel && (
        <form className="course-cancel-form" onSubmit={handleCancel}>
          <h2>إلغاء الرحلة</h2>
          <label>
            سبب الإلغاء
            <select value={reason} onChange={(event) => setReason(event.target.value)}>
              {cancellationReasons.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          {reason === "other" && (
            <label>
              ملاحظة
              <textarea value={comment} onChange={(event) => setComment(event.target.value)} maxLength={500} required />
            </label>
          )}
          <button type="submit" disabled={cancelling}>{cancelling ? "جارٍ الإلغاء…" : "تأكيد الإلغاء"}</button>
        </form>
      )}

      {course.status === "cancelled" && <p className="course-request-error">أُلغيت الرحلة · السبب: {course.cancellation_reason}</p>}
      {course.status === "completed" && <p className="course-complete-message">انتهت الرحلة. شكراً لاختياركم WinRak.</p>}
      {error && <p className="course-request-error" role="alert">{error}</p>}
      <button className="secondary-btn" type="button" onClick={() => navigate("/livreurs")}>العودة إلى السائقين</button>
    </section>
  );
}