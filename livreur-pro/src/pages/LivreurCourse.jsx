import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Star, User } from "lucide-react";
import {
  cancelCourse,
  finishCourse,
  getCourse,
  markCourseArrived,
  markCourseEnroute,
  pickupCourse,
  respondToCourseOffer,
  reviewClient,
  startCourse as startCourseAction,
} from "../livreursapi.js";
import LoadingSpinner from "../components/LoadingSpinner.jsx";
import DriverCourseCard from "../components/DriverCourseCard.jsx";
import DriverOfferActions from "../components/DriverOfferActions.jsx";
import CourseCancelledState from "../components/CourseCancelledState.jsx";
import CourseComplaint from "../components/CourseComplaint.jsx";
import { getDriverDashboardPath, readStoredAccount } from "../utils/navigation.js";
import { canRespondToDriverOffer, formatDriverNumber } from "../utils/driverOrders.js";
import useDriverCourseLocation from "../hooks/useDriverCourseLocation.js";
import { canFinishCourse, getCourseTarget, getCourseStatusLabel, isDeliveryVehicle, isDropoffStage } from "../utils/courseTracking.js";

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
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewMessage, setReviewMessage] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewError, setReviewError] = useState("");
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

  async function handleOfferResponse(response, offeredPrice) {
    if (!canRespondToDriverOffer(course) || offerExpired || actionInFlight.current) return;
    actionInFlight.current = true;
    revision.current += 1;
    setResponding(true);
    setError("");
    try {
      await respondToCourseOffer(course.id, response, offeredPrice);
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

  async function handleReviewSubmit(event) {
    event.preventDefault();
    if (!course || course.status !== "completed" || course.client_review_submitted || submittingReview) return;
    setSubmittingReview(true);
    setReviewError("");
    try {
      await reviewClient(course.id, { note: reviewRating, message: reviewMessage.trim() });
      setCourse((current) => current?.id === course.id ? { ...current, client_review_submitted: true } : current);
    } catch (err) {
      setReviewError(err.message || "تعذر إرسال تقييم العميل.");
    } finally {
      setSubmittingReview(false);
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
  const requestStatus = isOffer
    ? unavailableOffer ? "expired" : course.my_offer_response === "accepted" ? "waiting" : "new"
    : course.status;
  const shownPrice = course.my_offer_price ?? (isOffer ? course.proposed_price : course.final_price) ?? course.proposed_price;

  return (
    <section className="page driver-course-page" dir="rtl">
      <DriverCourseCard course={course} variant={isOffer ? "offer" : "ongoing"}
        badge={isOffer ? offerLabel : getCourseStatusLabel(course)} statusTone={requestStatus}
        detailView busy={busy} onExpire={() => setOfferExpired(true)}>
        {canRespond ? <DriverOfferActions course={course} busy={busy} requestLayout
          onAccept={(_, price) => handleOfferResponse("accepted", price)}
          onReject={() => handleOfferResponse("rejected")} />
          : <div className="driver-request-price-summary">
            <span>{isOffer ? course.my_offer_response === "accepted" ? "سعرك المرسل إلى الزبون" : "السعر المقترح من الزبون" : "سعر الرحلة"}</span>
            <strong><bdi>{formatDriverNumber(shownPrice)}</bdi> دج</strong>
            {isOffer && course.my_offer_response === "accepted" && <small>بانتظار اختيار الزبون للسائق</small>}
          </div>}
      </DriverCourseCard>
      {unavailableOffer && <button className="secondary-btn full" type="button" onClick={() => navigate(getDriverDashboardPath(), { replace: true })}>العودة إلى الطلبات</button>}
      {course.status === "completed" && (
        <div className="course-terminal-message course-terminal-completed" role="status" data-scroll-step="completed">
          <strong>{isDelivery ? "تم تسليم الطلب بنجاح" : "اكتملت الرحلة بنجاح"}</strong>
          <span>تم تحديث حالة الرحلة للعميل أيضاً. شكراً لك.</span>
        </div>
      )}
      {course.status === "completed" && course.client_confirmed && (
        <section className="course-review-card" aria-label="تقييم العميل">
          {course.client_review_submitted ? (
            <strong className="course-review-success" role="status">شكراً لك على تقييم العميل</strong>
          ) : (
            <form onSubmit={handleReviewSubmit}>
              <h2>كيف كان تعاملك مع العميل؟</h2>
              <div className="course-review-stars" role="group" aria-label="تقييم العميل من نجمة إلى خمس نجوم" dir="ltr">
                {[1, 2, 3, 4, 5].map((rating) => (
                  <button type="button" key={rating} aria-label={`${rating} نجوم`}
                    aria-pressed={reviewRating === rating} onClick={() => setReviewRating(rating)}>
                    <Star size={27} fill={rating <= reviewRating ? "currentColor" : "none"} aria-hidden="true" />
                  </button>
                ))}
              </div>
              <label><span className="visually-hidden">تعليق اختياري</span>
                <textarea value={reviewMessage} onChange={(event) => setReviewMessage(event.target.value)}
                  maxLength={1000} placeholder="تعليق اختياري" /></label>
              {reviewError && <p className="course-request-error" role="alert">{reviewError}</p>}
              <button type="submit" disabled={submittingReview}>
                {submittingReview ? "جارٍ الإرسال…" : "إرسال التقييم"}
              </button>
            </form>
          )}
        </section>
      )}
      {course.status === "completed" && <button className="secondary-btn full" type="button"
        onClick={() => navigate(getDriverDashboardPath(course.livreur), { replace: true })}>
        العودة إلى لوحة السائق
      </button>}
      {course.client_name && (
        <section className="driver-client-card" aria-label="معلومات العميل">
          <div className="driver-client-heading">
            <span className="driver-client-avatar">
              {course.client_photo ? <img src={course.client_photo} alt={course.client_name} /> : <User size={24} aria-hidden="true" />}
            </span>
            <div><h2>{course.client_name}</h2>
              <span>{course.client_rating == null ? "لا توجد تقييمات بعد" : `★ ${course.client_rating} / 5 · ${course.client_review_count} تقييم`}</span>
            </div>
          </div>
          {course.client_reviews?.length > 0 && <div className="driver-client-reviews">
            <h3>آراء السائقين عن العميل</h3>
            {course.client_reviews.map((review, index) => <article key={`${review.created_at}-${index}`}>
              <strong>★ {review.note} / 5</strong>
              {review.message && <p>{review.message}</p>}
            </article>)}
          </div>}
        </section>
      )}
      {course.active && course.livreur && (course.client_phone || course.pickup_phone) && (
        <div className="driver-course-contacts" aria-label="جهات الاتصال">
          {course.client_phone && <a className="secondary-btn" href={`tel:${course.client_phone}`}>الاتصال بالعميل{course.client_name ? ` · ${course.client_name}` : ""}</a>}
          {isDelivery && course.pickup_phone && <a className="secondary-btn" href={`tel:${course.pickup_phone}`}>الاتصال بنقطة الاستلام</a>}
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
      {course.livreur && <CourseComplaint key={course.id} courseId={course.id} role="livreur" />}
    </section>
  );
}
