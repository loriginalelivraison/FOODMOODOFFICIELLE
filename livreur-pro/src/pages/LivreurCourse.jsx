import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  cancelCourse,
  finishCourse,
  getCourse,
  markCourseArrived,
  markCourseEnroute,
  respondToCourseOffer,
  startCourse as startCourseAction,
} from "../livreursapi.js";
import LoadingSpinner from "../components/LoadingSpinner.jsx";

function getGoogleMapsUrl(latitude, longitude) {
  const destination = `${encodeURIComponent(latitude)},${encodeURIComponent(longitude)}`;
  return `https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=driving`;
}

export default function LivreurCourse() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams(); 
  const notificationAction = searchParams.get("offer_action");
  const handledNotificationAction = useRef(null);
  const [course, setCourse] = useState(null);
  const [error, setError] = useState("");
  const [finishing, setFinishing] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [reason, setReason] = useState("cannot_complete");
  const [comment, setComment] = useState("");
  const [responding, setResponding] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function refreshCourse() {
      try {
        const data = await getCourse(id);
        if (!cancelled) setCourse(data);
      } catch (err) {
        if (!cancelled) setError(err.message || "تعذر تحميل الرحلة.");
      }
    }
    refreshCourse();
    const interval = setInterval(refreshCourse, 5000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [id]);

  async function startRoute() {
    if (!course) return;

    if (course.status === "driver_selected") {
      try {
        const updated = await markCourseEnroute(course.id);
        setCourse(updated);
      } catch (err) {
        setError(err.message || "تعذر تحديث حالة الرحلة.");
        return;
      }
    }

    const destinationIsTripEnd = course.status === "in_progress";
    const latitude = destinationIsTripEnd ? course.destination_latitude : course.client_latitude;
    const longitude = destinationIsTripEnd ? course.destination_longitude : course.client_longitude;

    if (latitude === null || longitude === null) {
      setError(destinationIsTripEnd ? "إحداثيات الوجهة غير متوفرة حاليا." : "موقع الزبون غير متوفر حاليا.");
      return;
    }

    window.location.href = getGoogleMapsUrl(latitude, longitude);
  }

  async function handleStatusAction(action) {
    if (!course || updatingStatus) return;
    setUpdatingStatus(true);
    setError("");
    try {
      const updated = action === "arrive"
        ? await markCourseArrived(course.id)
        : await startCourseAction(course.id);
      setCourse(updated);
    } catch (err) {
      setError(err.message || "تعذر تحديث حالة الرحلة.");
    } finally {
      setUpdatingStatus(false);
    }
  }

  async function handleCancel(event) {
    event.preventDefault();
    if (!course || updatingStatus) return;
    setUpdatingStatus(true);
    setError("");
    try {
      await cancelCourse(course.id, reason, comment);
      navigate(`/livreur-dashboard/${course.livreur}`);
    } catch (err) {
      setError(err.message || "تعذر إلغاء الرحلة.");
    } finally {
      setUpdatingStatus(false);
    }
  }

  async function handleOfferResponse(response) {
    if (!course || responding) return;
    setResponding(true);
    setError("");
    try {
      await respondToCourseOffer(course.id, response);
      if (response === "rejected") {
        navigate(`/livreur-dashboard/${course.livreur || JSON.parse(localStorage.getItem("livreur") || "{}").id}`);
      } else {
        setCourse(await getCourse(course.id));
      }
    } catch (err) {
      setError(err.message || "هذه الرحلة لم تعد متاحة.");
      setCourse(await getCourse(course.id).catch(() => course));
    } finally {
      setResponding(false);
    }
  }

  useEffect(() => {
    if (!course || !["accept", "reject"].includes(notificationAction)) return;
    const actionKey = `${course.id}:${notificationAction}`;
    if (handledNotificationAction.current === actionKey) return;
    handledNotificationAction.current = actionKey;
    navigate(`/livreur-course/${course.id}`, { replace: true });
    handleOfferResponse(notificationAction === "accept" ? "accepted" : "rejected");
  }, [course, navigate, notificationAction]);

  async function handleFinishCourse() {
    if (!course || !course.active || finishing) return;

    setFinishing(true);
    setError("");

    try {
      const updated = await finishCourse(course.id);
      setCourse(updated);
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
        <LoadingSpinner label="جاري تحميل معلومات الرحلة..." fullPage />
      </section>
    );
  }

  const hasClientLocation =
    course.client_latitude !== null && course.client_longitude !== null;
  const routeIsDestination = course.status === "in_progress";
  const isOffer = !course.livreur && ["searching", "driver_accepted"].includes(course.status);
  const hasRouteTarget = routeIsDestination
    ? course.destination_latitude !== null && course.destination_longitude !== null
    : hasClientLocation;
  const courseStatusClass = isOffer && course.my_offer_response === "accepted"
    ? "driver_accepted"
    : course.status;
  const vehicleLabels = { moto: "دراجة نارية", scooter: "دراجة نارية", voiture: "سيارة", camion: "شاحنة" };

  return (
    <section className="page" dir="rtl">
      <header className="course-follow-header">
        <div>
          <span className="course-request-kicker">WinRak · الرحلة رقم {course.id}</span>
          <h1>تفاصيل الرحلة</h1>
        </div>
        <strong className={`course-status-badge status-${courseStatusClass}`}>
          {course.status === "completed" ? "اكتملت الرحلة" : course.status === "cancelled" ? "أُلغيت الرحلة" : isOffer ? course.my_offer_response === "accepted" ? "بانتظار اختيار العميل" : "طلب جديد" : course.status === "driver_selected" ? "تم تأكيد السائق" : course.status === "driver_arrived" ? "وصل السائق" : course.status === "in_progress" ? "الرحلة جارية" : "الرحلة نشطة"}
        </strong>
      </header>

      {(isOffer || ["driver_selected", "driver_arriving", "driver_arrived", "in_progress"].includes(course.status)) && (
        <div className="course-stage-card" aria-live="polite">
          <span className="course-stage-indicator" aria-hidden="true" />
          <div>
            <strong>{isOffer ? course.my_offer_response === "accepted" ? "بانتظار اختيار العميل" : "طلب رحلة جديد" : course.status === "driver_selected" || course.status === "driver_arriving" ? "أنت في الطريق إلى العميل" : course.status === "driver_arrived" ? "بانتظار بدء الرحلة" : "الرحلة جارية الآن"}</strong>
            <p>{isOffer ? course.my_offer_response === "accepted" ? "تم إرسال قبولك. سيظهر تحديث هنا بعد اختيارك." : "راجع معلومات الرحلة، ثم اختر قبول أو رفض." : course.status === "driver_selected" || course.status === "driver_arriving" ? "توجه إلى موقع العميل، وسيتم تحديث الحالة عند وصولك." : course.status === "driver_arrived" ? "أبلغ العميل بوصولك وانتظر بدء الرحلة." : "توجه إلى الوجهة المحددة لإكمال الرحلة."}</p>
          </div>
        </div>
      )}
      {course.status === "completed" && (
        <div className="course-terminal-message course-terminal-completed" role="status">
          <strong>اكتملت الرحلة بنجاح</strong>
          <span>تم تحديث حالة الرحلة للعميل أيضاً. شكراً لك.</span>
          <button className="secondary-btn" type="button" onClick={() => navigate(`/livreur-dashboard/${course.livreur}`)}>
            العودة إلى لوحة السائق
          </button>
        </div>
      )}
      {course.status === "cancelled" && (
        <div className="course-terminal-message course-terminal-cancelled" role="status">
          <strong>أُلغيت الرحلة</strong>
          <span>تم تحديث حالة الرحلة للعميل أيضاً.</span>
        </div>
      )}
      <div className="course-details-banner" aria-label="معلومات إضافية عن الرحلة">
        <span><b>موقع العميل</b>{hasClientLocation ? "متوفر" : "غير متوفر"}</span>
        <span><b>المسافة</b>{course.estimated_distance_km == null ? "غير متوفرة" : `${course.estimated_distance_km} كم`}</span>
        <span><b>المركبة</b>{vehicleLabels[course.vehicle_type] || course.vehicle_type || "غير محددة"}</span>
        <span><b>السعر</b>{course.final_price ?? course.proposed_price} دج</span>
      </div>

      {isOffer && course.my_offer_response !== "accepted" && (
        <div className="driver-offer-actions" dir="rtl">
          <button type="button" onClick={() => handleOfferResponse("accepted")} disabled={responding}>قبول</button>
          <button type="button" onClick={() => handleOfferResponse("rejected")} disabled={responding}>رفض</button>
        </div>
      )}

      {course.livreur && !["completed", "cancelled"].includes(course.status) && <button
        className="primary-btn full"
        type="button"
        onClick={startRoute}
        disabled={!hasRouteTarget}
        style={{
          background: hasRouteTarget ? "#16a34a" : "#9ca3af",
          cursor: hasRouteTarget ? "pointer" : "not-allowed",
        }}
      >
        {routeIsDestination ? "التوجه إلى الوجهة عبر Google Maps" : "التوجه إلى الزبون عبر Google Maps"}
      </button>}

      {["driver_selected", "driver_arriving"].includes(course.status) && (
        <button className="primary-btn full" type="button" onClick={() => handleStatusAction("arrive")} disabled={updatingStatus} style={{ marginTop: "12px", background: "#176b53" }}>
          {updatingStatus ? "جارٍ تحديث الحالة…" : "وصلت إلى الزبون"}
        </button>
      )}

      {course.status === "driver_arrived" && (
        <button className="primary-btn full" type="button" onClick={() => handleStatusAction("start")} disabled={updatingStatus} style={{ marginTop: "12px", background: "#176b53" }}>
          {updatingStatus ? "جارٍ تحديث الحالة…" : "بدء الرحلة"}
        </button>
      )}

      {course.status !== "completed" && course.active && (course.status === "in_progress" || !course.destination) && (
        <button
          className="primary-btn full"
          type="button"
          onClick={handleFinishCourse}
          disabled={finishing}
          style={{ marginTop: "14px", background: "#dc2626" }}
        >
          {finishing ? <LoadingSpinner label="جاري إنهاء الرحلة..." size={20} /> : "إنهاء الرحلة"}
        </button>
      )}

      {course.livreur && course.active && course.status !== "completed" && course.status !== "cancelled" && (
        <form className="course-cancel-form" onSubmit={handleCancel}>
          <h2>إلغاء الرحلة</h2>
          <label>
            سبب الإلغاء
            <select value={reason} onChange={(event) => setReason(event.target.value)}>
              <option value="cannot_complete">لم أعد أستطيع إتمام الرحلة</option>
              <option value="vehicle_issue">مشكلة في المركبة</option>
              <option value="route_unsuitable">المسافة أو المسار غير مناسب</option>
              <option value="other">سبب آخر</option>
            </select>
          </label>
          {reason === "other" && <label>توضيح<textarea value={comment} onChange={(event) => setComment(event.target.value)} maxLength={500} required /></label>}
          <button type="submit" disabled={updatingStatus}>{updatingStatus ? "جارٍ الإلغاء…" : "تأكيد الإلغاء"}</button>
        </form>
      )}
    </section>
  );
}
