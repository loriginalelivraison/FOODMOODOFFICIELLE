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
import AddressLabel from "../components/AddressLabel.jsx";
import CourseCancelledState from "../components/CourseCancelledState.jsx";
import { getDriverDashboardPath, readStoredAccount } from "../utils/navigation.js";
import { canRespondToDriverOffer, formatDriverNumber } from "../utils/driverOrders.js";
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
  const [offerExpired, setOfferExpired] = useState(false);
  const [refreshError, setRefreshError] = useState("");
  const actionInFlight = useRef(false);
  const revision = useRef(0);
  const locationError = useDriverCourseLocation(course);
  const busy = responding || updatingStatus || finishing;

  useEffect(() => {
    setOfferExpired(course?.my_offer_expires_in != null && Number(course.my_offer_expires_in) <= 0);
  }, [course?.id, course?.my_offer_expires_in]);

  useEffect(() => {
    if (!course) return;
    const driver = readStoredAccount("livreur");
    if (driver?.id && String(course.livreur) === String(driver.id) && course.active
      && !["completed", "cancelled"].includes(course.status)) {
      localStorage.setItem("activeDriverCourseId", String(course.id));
    } else if (localStorage.getItem("activeDriverCourseId") === String(course.id)) {
      localStorage.removeItem("activeDriverCourseId");
    }
  }, [course?.id, course?.livreur, course?.active, course?.status]);

  useEffect(() => {
    let cancelled = false;
    setCourse(null);
    setError("");
    setRefreshError("");

    async function refreshCourse() {
      if (actionInFlight.current) return;
      const currentRevision = revision.current;
      try {
        const data = await getCourse(id);
        if (!cancelled && !actionInFlight.current && currentRevision === revision.current) {
          setCourse(data);
          setRefreshError("");
        }
      } catch (err) {
        if (!cancelled && err.status === 401) {
          navigate("/inscription-livreur", { replace: true });
          return;
        }
        if (!cancelled && [403, 404, 410].includes(err.status)) {
          navigate(getDriverDashboardPath(), { replace: true });
          return;
        }
        if (!cancelled && !actionInFlight.current && currentRevision === revision.current) setRefreshError(err.message || "تعذر تحميل الرحلة.");
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
  }, [id, navigate]);

  async function startRoute(event) {
    if (!course || !getCourseTarget(course) || actionInFlight.current) {
      event.preventDefault();
      return;
    }
    if (course.status === "driver_selected") {
      actionInFlight.current = true;
      revision.current += 1;
      setUpdatingStatus(true);
      setError("");
      try {
        const updated = await markCourseEnroute(course.id);
        setCourse(updated);
      } catch (err) {
        setError(err.message || "تعذر تحديث حالة الرحلة.");
      } finally {
        actionInFlight.current = false;
        setUpdatingStatus(false);
      }
    }
  }

  async function handleStatusAction(action) {
    if (!course || actionInFlight.current) return;
    actionInFlight.current = true;
    revision.current += 1;
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
      actionInFlight.current = false;
      setUpdatingStatus(false);
    }
  }

  async function handleCancel(event) {
    event.preventDefault();
    if (!course || actionInFlight.current) return;
    if (reason === "other" && !comment.trim()) {
      setError("يرجى توضيح سبب الإلغاء.");
      return;
    }
    actionInFlight.current = true;
    revision.current += 1;
    setUpdatingStatus(true);
    setError("");
    try {
      const updated = await cancelCourse(course.id, reason, reason === "other" ? comment.trim() : "");
      setCourse(updated);
    } catch (err) {
      setError(err.message || (isDeliveryVehicle(course.vehicle_type) ? "تعذر إلغاء الطلب." : "تعذر إلغاء الرحلة."));
    } finally {
      actionInFlight.current = false;
      setUpdatingStatus(false);
    }
  }

  async function handleOfferResponse(response) {
    if (!canRespondToDriverOffer(course) || offerExpired || actionInFlight.current) return;
    actionInFlight.current = true;
    revision.current += 1;
    setResponding(true);
    setError("");
    try {
      await respondToCourseOffer(course.id, response);
      if (response === "rejected") {
        navigate(getDriverDashboardPath(course.livreur), { replace: true });
      } else {
        setCourse(await getCourse(course.id));
      }
    } catch (err) {
      setError(err.message || "هذه الرحلة لم تعد متاحة.");
      setCourse(await getCourse(course.id).catch(() => course));
    } finally {
      actionInFlight.current = false;
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
    if (!course || !canFinishCourse(course) || actionInFlight.current) return;

    actionInFlight.current = true;
    revision.current += 1;
    setFinishing(true);
    setError("");

    try {
      const updated = await finishCourse(course.id);
      setCourse(updated);
    } catch (err) {
      setError(err.message || "حدث خطأ أثناء إنهاء الرحلة.");
    } finally {
      actionInFlight.current = false;
      setFinishing(false);
    }
  }

  if ((error || refreshError) && !course) {
    return (
      <section className="page" dir="rtl">
        <p role="alert" style={{ color: "#b91c1c", textAlign: "center" }}>{error || refreshError}</p>
        <button className="primary-btn full" onClick={() => navigate(getDriverDashboardPath(), { replace: true })}>
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
    course.client_latitude != null && course.client_longitude != null
    && course.client_latitude !== "" && course.client_longitude !== ""
    && Number.isFinite(Number(course.client_latitude)) && Number.isFinite(Number(course.client_longitude));
  const isDelivery = isDeliveryVehicle(course.vehicle_type);
  if (course.status === "cancelled") {
    return <CourseCancelledState isDelivery={isDelivery} isDriver cancelledBy={course.cancelled_by_type} onContinue={() => navigate(getDriverDashboardPath(course.livreur), { replace: true })} />;
  }
  const routeIsDestination = isDropoffStage(course.status);
  const routeTarget = getCourseTarget(course);
  const isOffer = !course.livreur && ["searching", "driver_accepted"].includes(course.status);
  const canRespond = canRespondToDriverOffer(course) && !offerExpired;
  const unavailableOffer = isOffer && course.my_offer_response !== "accepted" && !canRespond;
  const offerLabel = unavailableOffer ? "الطلب غير متاح" : course.my_offer_response === "accepted" ? "بانتظار اختيار العميل" : "طلب جديد";
  const hasRouteTarget = Boolean(routeTarget);
  const courseStatusClass = isOffer && course.my_offer_response === "accepted"
    ? "driver_accepted"
    : course.status;
  const vehicleLabels = { moto: "دراجة نارية", scooter: "دراجة نارية", voiture: "سيارة", camion: "شاحنة" };

  return (
    <section className="page driver-course-page" dir="rtl">
      <header className="course-follow-header">
        <div>
          <span className="course-request-kicker">WinRak · الرحلة رقم {course.id}</span>
          <h1>{isDelivery ? "تفاصيل التوصيل" : "تفاصيل الرحلة"}</h1>
        </div>
        <strong className={`course-status-badge status-${courseStatusClass}`}>
          {isOffer ? offerLabel : getCourseStatusLabel(course)}
        </strong>
      </header>

      {isOffer && course.my_offer_response === "pending" && !offerExpired && (
        <div className="offer-countdown-banner">
          <OfferCountdown seconds={course.my_offer_expires_in} onExpire={() => setOfferExpired(true)} />
          <span>اقبل الطلب قبل انتهاء المهلة.</span>
        </div>
      )}

      {(isOffer || ["driver_selected", "driver_arriving", "driver_arrived", "picked_up", "in_progress"].includes(course.status)) && (
        <div className="course-stage-card" aria-live="polite" data-scroll-step={`${course.status}:${course.my_offer_response || ""}`}>
          <span className="course-stage-indicator" aria-hidden="true" />
          <div>
            <strong>{isOffer ? offerLabel : getCourseStatusLabel(course)}</strong>
            <p>{isOffer ? unavailableOffer ? "انتهت مهلة الطلب أو لم يعد متاحاً. ارجع إلى الطلبات للاطلاع على الفرص الجديدة." : course.my_offer_response === "accepted" ? "تم إرسال قبولك. سيظهر تحديث هنا بعد اختيارك." : "راجع معلومات الرحلة، ثم اختر قبول أو رفض." : getDriverCourseHint(course)}</p>
          </div>
        </div>
      )}
      {unavailableOffer && <button className="secondary-btn full" type="button" onClick={() => navigate(getDriverDashboardPath(), { replace: true })}>العودة إلى الطلبات</button>}
      {course.status === "completed" && (
        <div className="course-terminal-message course-terminal-completed" role="status" data-scroll-step="completed">
          <strong>{isDelivery ? "تم تسليم الطلب بنجاح" : "اكتملت الرحلة بنجاح"}</strong>
          <span>تم تحديث حالة الرحلة للعميل أيضاً. شكراً لك.</span>
          <button className="secondary-btn" type="button" onClick={() => navigate(getDriverDashboardPath(course.livreur), { replace: true })}>
            العودة إلى لوحة السائق
          </button>
        </div>
      )}
      <div className="course-details-banner" aria-label="معلومات إضافية عن الرحلة">
        <span><b>{isDelivery ? "نقطة الاستلام" : "نقطة الانطلاق"}</b><AddressLabel text={course.pickup_address || course.pickup_name || "موقع العميل"} /></span>
        {course.destination && <span><b>{isDelivery ? "نقطة التسليم" : "نقطة الوصول"}</b><AddressLabel text={course.destination} /></span>}
        <span><b>موقع العميل</b>{hasClientLocation ? "متوفر" : "غير متوفر"}</span>
        <span><b>المسافة</b>{course.estimated_distance_km == null ? "غير متوفرة" : `${course.estimated_distance_km} كم`}</span>
        <span><b>المركبة</b>{vehicleLabels[course.vehicle_type] || course.vehicle_type || "غير محددة"}</span>
        <span><b>السعر</b><bdi>{formatDriverNumber(course.final_price ?? course.proposed_price)}</bdi> دج</span>
      </div>

      {course.active && course.livreur && (course.client_phone || course.pickup_phone) && (
        <div className="driver-course-contacts" aria-label="جهات الاتصال">
          {course.client_phone && <a className="secondary-btn" href={`tel:${course.client_phone}`}>الاتصال بالعميل{course.client_name ? ` · ${course.client_name}` : ""}</a>}
          {isDelivery && course.pickup_phone && <a className="secondary-btn" href={`tel:${course.pickup_phone}`}>الاتصال بنقطة الاستلام</a>}
        </div>
      )}

      {canRespond && (
        <div className="driver-offer-actions" dir="rtl">
          <button type="button" onClick={() => handleOfferResponse("accepted")} disabled={busy}>{responding ? "جارٍ الإرسال…" : "قبول"}</button>
          <button type="button" onClick={() => handleOfferResponse("rejected")} disabled={busy}>رفض</button>
        </div>
      )}

      {course.livreur && hasRouteTarget && !["completed", "cancelled"].includes(course.status) && <a
        className="primary-btn full"
        href={getGoogleMapsUrl(routeTarget.latitude, routeTarget.longitude)}
        target="_blank"
        rel="noopener noreferrer"
        onClick={startRoute}
        aria-disabled={busy}
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

      {locationError && <p className="course-request-error" role="alert">{locationError}</p>}
      {error && <p className="course-request-error" role="alert">{error}</p>}
      {refreshError && <p className="course-request-error" role="alert">{refreshError} نعرض آخر تحديث متاح.</p>}

      {["driver_selected", "driver_arriving"].includes(course.status) && (
        <button className="primary-btn full" type="button" onClick={() => handleStatusAction("arrive")} disabled={busy} style={{ marginTop: "12px", background: "#176b53" }}>
          {updatingStatus ? "جارٍ تحديث الحالة…" : isDelivery ? "وصلت إلى نقطة الاستلام" : "وصلت إلى نقطة الانطلاق"}
        </button>
      )}

      {course.status === "driver_arrived" && (
        <button className="primary-btn full" type="button" onClick={() => handleStatusAction(isDelivery ? "pickup" : "start")} disabled={busy} style={{ marginTop: "12px", background: "#176b53" }}>
          {updatingStatus ? "جارٍ تحديث الحالة…" : isDelivery ? "تم استلام الطلب" : "بدء الرحلة"}
        </button>
      )}

      {course.status === "picked_up" && (
        <button className="primary-btn full" type="button" onClick={() => handleStatusAction("start")} disabled={busy} style={{ marginTop: "12px", background: "#176b53" }}>
          {updatingStatus ? "جارٍ تحديث الحالة…" : isDelivery ? "بدء التوصيل" : "بدء الرحلة"}
        </button>
      )}

      {canFinishCourse(course) && (
        <button
          className="primary-btn full"
          type="button"
          onClick={handleFinishCourse}
          disabled={busy}
          style={{ marginTop: "14px", background: "#176b53" }}
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
          {reason === "other" && <label data-scroll-step="cancel-reason">توضيح<textarea value={comment} onChange={(event) => setComment(event.target.value)} maxLength={500} required /></label>}
          <button type="submit" disabled={busy}>{updatingStatus ? "جارٍ الإلغاء…" : "تأكيد الإلغاء"}</button>
        </form>
      )}
    </section>
  );
}
