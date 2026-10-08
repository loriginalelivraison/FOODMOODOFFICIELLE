import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  cancelCourse,
  finishCourse,
  getCourse,
  markCourseArrived,
  markCourseEnroute,
  pickupCourse,
  respondToCourseOffer,
  startCourse as startCourseAction,
} from "../livreursapi.js";
import LoadingSpinner from "../components/LoadingSpinner.jsx";
import CourseCancelledState from "../components/CourseCancelledState.jsx";
import { OfferCountdown } from "../components/LivreurOrders.jsx";
import useDriverCourseLocation from "../hooks/useDriverCourseLocation.js";
import { canFinishCourse, getCourseTarget, getCourseStatusLabel, getDriverCourseHint, isDeliveryVehicle, isDropoffStage } from "../utils/courseTracking.js";

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
  const locationError = useDriverCourseLocation(course);

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
    const handlePush = (event) => {
      if (String(event.detail?.course_id) === String(id)) refreshCourse();
    };
    window.addEventListener("winrakPush", handlePush);
    const interval = setInterval(refreshCourse, 5000);

    return () => {
      cancelled = true;
      clearInterval(interval);
      window.removeEventListener("winrakPush", handlePush);
    };
  }, [id]);

  async function startRoute(event) {
    if (!course || !getCourseTarget(course) || updatingStatus) {
      event.preventDefault();
      return;
    }
    if (course.status === "driver_selected") {
      setUpdatingStatus(true);
      setError("");
      try {
        const updated = await markCourseEnroute(course.id);
        setCourse(updated);
      } catch (err) {
        setError(err.message || "تعذر تحديث حالة الرحلة.");
      } finally {
        setUpdatingStatus(false);
      }
    }
  }

  async function handleStatusAction(action) {
    if (!course || updatingStatus) return;
    setUpdatingStatus(true);
    setError("");
    try {
      let updated;
      if (action === "arrive") {
        updated = await markCourseArrived(course.id);
      } else if (action === "pickup") {
        updated = await pickupCourse(course.id);
      } else {
        updated = await startCourseAction(course.id);
      }
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
      const updated = await cancelCourse(course.id, reason, comment);
      setCourse(updated);
    } catch (err) {
      setError(err.message || (isDeliveryVehicle(course.vehicle_type) ? "تعذر إلغاء الطلب." : "تعذر إلغاء الرحلة."));
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
    if (!course || !canFinishCourse(course) || finishing) return;

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

  if (error && !course) {
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
  const isDelivery = isDeliveryVehicle(course.vehicle_type);
  if (course.status === "cancelled") {
    return <CourseCancelledState isDelivery={isDelivery} isDriver cancelledBy={course.cancelled_by_type} onContinue={() => navigate(`/livreur-dashboard/${course.livreur || JSON.parse(localStorage.getItem("livreur") || "{}").id}`, { replace: true })} />;
  }
  const routeIsDestination = isDropoffStage(course.status);
  const routeTarget = getCourseTarget(course);
  const isOffer = !course.livreur && ["searching", "driver_accepted"].includes(course.status);
  const hasRouteTarget = Boolean(routeTarget);
  const courseStatusClass = isOffer && course.my_offer_response === "accepted"
    ? "driver_accepted"
    : course.status;
  const vehicleLabels = { moto: "دراجة نارية", scooter: "دراجة نارية", voiture: "سيارة", camion: "شاحنة" };

  return (
    <section className="page" dir="rtl">
      <header className="course-follow-header">
        <div>
          <span className="course-request-kicker">WinRak · الرحلة رقم {course.id}</span>
          <h1>{isDelivery ? "تفاصيل التوصيل" : "تفاصيل الرحلة"}</h1>
        </div>
        <strong className={`course-status-badge status-${courseStatusClass}`}>
          {isOffer ? course.my_offer_response === "accepted" ? "بانتظار اختيار العميل" : "طلب جديد" : getCourseStatusLabel(course)}
        </strong>
      </header>

      {isOffer && course.my_offer_response === "pending" && (
        <div className="offer-countdown-banner">
          <OfferCountdown seconds={course.my_offer_expires_in} />
          <span>اقبل الطلب قبل انتهاء المهلة.</span>
        </div>
      )}

      {(isOffer || ["driver_selected", "driver_arriving", "driver_arrived", "picked_up", "in_progress"].includes(course.status)) && (
        <div className="course-stage-card" aria-live="polite">
          <span className="course-stage-indicator" aria-hidden="true" />
          <div>
            <strong>{isOffer ? course.my_offer_response === "accepted" ? "بانتظار اختيار العميل" : "طلب جديد" : getCourseStatusLabel(course)}</strong>
            <p>{isOffer ? course.my_offer_response === "accepted" ? "تم إرسال قبولك. سيظهر تحديث هنا بعد اختيارك." : "راجع معلومات الرحلة، ثم اختر قبول أو رفض." : getDriverCourseHint(course)}</p>
          </div>
        </div>
      )}
      {course.status === "completed" && (
        <div className="course-terminal-message course-terminal-completed" role="status">
          <strong>{isDelivery ? "تم تسليم الطلب بنجاح" : "اكتملت الرحلة بنجاح"}</strong>
          <span>تم تحديث حالة الرحلة للعميل أيضاً. شكراً لك.</span>
          <button className="secondary-btn" type="button" onClick={() => navigate(`/livreur-dashboard/${course.livreur}`)}>
            العودة إلى لوحة السائق
          </button>
        </div>
      )}
      <div className="course-details-banner" aria-label="معلومات إضافية عن الرحلة">
        <span><b>{isDelivery ? "نقطة الاستلام" : "نقطة الانطلاق"}</b>{course.pickup_address || course.pickup_name || "موقع العميل"}</span>
        {course.destination && <span><b>{isDelivery ? "نقطة التسليم" : "نقطة الوصول"}</b>{course.destination}</span>}
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

      {course.livreur && hasRouteTarget && !["completed", "cancelled"].includes(course.status) && <a
        className="primary-btn full"
        href={getGoogleMapsUrl(routeTarget.latitude, routeTarget.longitude)}
        target="_blank"
        rel="noopener noreferrer"
        onClick={startRoute}
        aria-disabled={updatingStatus}
        style={{
          background: "#16a34a",
          display: "block",
          textAlign: "center",
        }}
      >
        {routeIsDestination
          ? isDelivery ? "التوجه إلى نقطة التسليم عبر Google Maps" : "التوجه إلى الوجهة عبر Google Maps"
          : isDelivery ? "التوجه إلى نقطة الاستلام عبر Google Maps" : "التوجه إلى نقطة الانطلاق عبر Google Maps"}
      </a>}

      {locationError && <p className="course-request-error" role="status">{locationError}</p>}
      {error && <p className="course-request-error" role="alert">{error}</p>}

      {["driver_selected", "driver_arriving"].includes(course.status) && (
        <button className="primary-btn full" type="button" onClick={() => handleStatusAction("arrive")} disabled={updatingStatus} style={{ marginTop: "12px", background: "#176b53" }}>
          {updatingStatus ? "جارٍ تحديث الحالة…" : isDelivery ? "وصلت إلى نقطة الاستلام" : "وصلت إلى نقطة الانطلاق"}
        </button>
      )}

      {course.status === "driver_arrived" && (
        <button className="primary-btn full" type="button" onClick={() => handleStatusAction(isDelivery ? "pickup" : "start")} disabled={updatingStatus} style={{ marginTop: "12px", background: "#176b53" }}>
          {updatingStatus ? "جارٍ تحديث الحالة…" : isDelivery ? "تم استلام الطلب" : "بدء الرحلة"}
        </button>
      )}

      {course.status === "picked_up" && (
        <button className="primary-btn full" type="button" onClick={() => handleStatusAction("start")} disabled={updatingStatus} style={{ marginTop: "12px", background: "#176b53" }}>
          {updatingStatus ? "جارٍ تحديث الحالة…" : isDelivery ? "بدء التوصيل" : "بدء الرحلة"}
        </button>
      )}

      {canFinishCourse(course) && (
        <button
          className="primary-btn full"
          type="button"
          onClick={handleFinishCourse}
          disabled={finishing}
          style={{ marginTop: "14px", background: "#dc2626" }}
        >
          {finishing ? <LoadingSpinner label="جارٍ التأكيد..." size={20} /> : isDelivery ? "تم تسليم الطلب" : "إنهاء الرحلة"}
        </button>
      )}

      {course.livreur && course.active && course.status !== "completed" && course.status !== "cancelled" && (
        <form className="course-cancel-form" onSubmit={handleCancel}>
          <h2>{isDelivery ? "إلغاء الطلب" : "إلغاء الرحلة"}</h2>
          <label>
            سبب الإلغاء
            <select value={reason} onChange={(event) => setReason(event.target.value)}>
              <option value="cannot_complete">{isDelivery ? "لم أعد أستطيع توصيل الطلب" : "لم أعد أستطيع إتمام الرحلة"}</option>
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
