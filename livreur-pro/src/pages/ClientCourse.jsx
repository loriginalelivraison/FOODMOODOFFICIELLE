import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Star } from "lucide-react";
import {
  cancelCourse,
  createCommentaireLivreur,
  getCourse,
  finishCourse,
  selectCourseDriver,
} from "../livreursapi.js";
import CouriersMap from "../components/CouriersMap.jsx";
import LoadingSpinner from "../components/LoadingSpinner.jsx";
import AddressLabel from "../components/AddressLabel.jsx";
import CourseCancelledState from "../components/CourseCancelledState.jsx";
import CourseComplaint from "../components/CourseComplaint.jsx";
import { clearCurrentClientCourse } from "../utils/navigation.js";
import defaultAvatar from "../assets/pasdephoto.png";
import { canFinishCourse, getCourseSteps, getCourseStepIndex, getCourseStatusLabel, getPickupPosition, isDeliveryVehicle } from "../utils/courseTracking.js";
const VEHICLE_LABELS = {
  moto: "عامل توصيل",
  scooter: "عامل توصيل",
  voiture: "سيارة",
  camion: "شاحنة",
};

function positionIsValid(latitude, longitude) {
  return latitude !== null && latitude !== undefined
    && longitude !== null && longitude !== undefined
    && Number.isFinite(Number(latitude)) && Number.isFinite(Number(longitude));
}

const formatPrice = (price) => new Intl.NumberFormat("fr-DZ", {
  maximumFractionDigits: 2,
}).format(Number(price));

export default function ClientCourse() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [course, setCourse] = useState(null);
  const [error, setError] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [selectingDriverId, setSelectingDriverId] = useState(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewMessage, setReviewMessage] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewError, setReviewError] = useState("");
  const [reviewSubmitted, setReviewSubmitted] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [showCancellation, setShowCancellation] = useState(false);
  const [cancelReason, setCancelReason] = useState("changed_mind");
  const [cancelComment, setCancelComment] = useState("");
  const mutationVersion = useRef(0);
  const mutationPending = useRef(false);
  const callFirstRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    let pending = false;
    let terminal = false;
    setCourse(null);
    setError("");
    setReviewSubmitted(false);
    setReviewMessage("");
    setReviewRating(5);
    setReviewError("");
    setShowCancellation(false);

    async function refreshCourse() {
      if (pending || terminal || mutationPending.current) return;
      pending = true;
      const version = mutationVersion.current;
      try {
        const data = await getCourse(id);
        if (!cancelled && version === mutationVersion.current) {
          setCourse(data);
          setError("");
          if (["completed", "cancelled"].includes(data.status)) {
            terminal = true;
            clearCurrentClientCourse(data.id);
          } else {
            localStorage.setItem("currentClientCourseId", String(data.id));
          }
        }
      } catch (err) {
        if (cancelled || version !== mutationVersion.current) return;
        if (!cancelled && err.status === 401) {
          navigate("/connexion-client", { replace: true });
          return;
        }
        if (!cancelled && [403, 404, 410].includes(err.status)) {
          clearCurrentClientCourse(id);
          navigate("/livreurs", { replace: true });
          return;
        }
        if (!cancelled) setError(err.message || "تعذر تحميل الرحلة.");
      } finally {
        pending = false;
      }
    }

    refreshCourse();
    const handlePush = (event) => {
      if (String(event.detail?.course_id) === String(id)) refreshCourse();
    };
    window.addEventListener("winrakPush", handlePush);
    const interval = setInterval(refreshCourse, 4000);
    return () => {
      cancelled = true;
      clearInterval(interval);
      window.removeEventListener("winrakPush", handlePush);
    };
  }, [id, navigate]);

  async function handleCancel(event) {
    event.preventDefault();
    if (!course || mutationPending.current || ["completed", "cancelled"].includes(course.status)) return;
    mutationPending.current = true;
    mutationVersion.current += 1;
    setCancelling(true);
    setError("");
    try {
      const updated = await cancelCourse(course.id, cancelReason, cancelComment.trim());
      setCourse(updated);
      clearCurrentClientCourse(course.id);
    } catch (err) {
      setError(err.message || (isDeliveryVehicle(course.vehicle_type) ? "تعذر إلغاء الطلب." : "تعذر إلغاء الرحلة."));
    } finally {
      mutationPending.current = false;
      setCancelling(false);
    }
  }

  async function handleSelectDriver(driverId) {
    if (!course || mutationPending.current) return;
    mutationPending.current = true;
    mutationVersion.current += 1;
    setSelectingDriverId(driverId);
    setError("");
    try {
      const updated = await selectCourseDriver(course.id, driverId);
      setCourse(updated);
      if (isDeliveryVehicle(updated.vehicle_type)) {
        requestAnimationFrame(() => callFirstRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }));
      }
    } catch (err) {
      setError(err.message || "تعذر تأكيد هذا السائق.");
      try {
        setCourse(await getCourse(course.id));
      } catch (refreshError) {
        setError(refreshError.message || "تعذر تحديث حالة الرحلة.");
      }
    } finally {
      mutationPending.current = false;
      setSelectingDriverId(null);
    }
  }

  async function handleFinish() {
    if (!course || !canFinishCourse(course) || mutationPending.current) return;
    if (!window.confirm(isDeliveryVehicle(course.vehicle_type) ? "هل تم تسليم الطلب بالفعل؟" : "هل وصلت إلى وجهتك وانتهت الرحلة؟")) return;
    mutationPending.current = true;
    mutationVersion.current += 1;
    setFinishing(true);
    setError("");
    try {
      setCourse(await finishCourse(course.id));
      clearCurrentClientCourse(course.id);
    } catch (err) {
      setError(err.message || "تعذر تأكيد الوصول.");
    } finally {
      mutationPending.current = false;
      setFinishing(false);
    }
  }

  async function handleReviewSubmit(event) {
    event.preventDefault();
    if (!course?.livreur || submittingReview || reviewSubmitted) return;
    setSubmittingReview(true);
    setReviewError("");
    try {
      await createCommentaireLivreur({
        livreur: course.livreur,
        note: reviewRating,
        message: reviewMessage.trim() || "بدون تعليق",
      });
      localStorage.setItem(`courseReviewSubmitted:${course.id}`, "true");
      setReviewSubmitted(true);
    } catch (err) {
      setReviewError(err.message || "تعذر إرسال تقييمك. يرجى المحاولة مجدداً.");
    } finally {
      setSubmittingReview(false);
    }
  }

  if (!course) {
    return (
      <section className="page" dir="rtl">
        <LoadingSpinner label="جارٍ تحميل الرحلة…" fullPage />
        {error && <p role="alert">{error}</p>}
      </section>
    );
  }

  const acceptedDrivers = course.accepted_drivers || [];
  const selectedDriver = acceptedDrivers.find(
    (candidate) => String(candidate.id) === String(course.livreur)
  );
  const stepIndex = getCourseStepIndex(course.status);
  const isDelivery = isDeliveryVehicle(course.vehicle_type);
  if (course.status === "cancelled") {
    return <CourseCancelledState isDelivery={isDelivery} cancelledBy={course.cancelled_by_type} onContinue={() => navigate("/livreurs", { replace: true })} />;
  }
  const steps = getCourseSteps(course.vehicle_type);
  const pickupPosition = getPickupPosition(course);
  const hasStart = positionIsValid(course.client_latitude, course.client_longitude);
  const hasDestination = positionIsValid(
    course.destination_latitude,
    course.destination_longitude
  );
  const hasDriverPosition = positionIsValid(selectedDriver?.latitude, selectedDriver?.longitude);
  const active = !["completed", "cancelled"].includes(course.status);
  const reviewAlreadySubmitted = reviewSubmitted
    || localStorage.getItem(`courseReviewSubmitted:${course.id}`) === "true";
  const showMap = Boolean(pickupPosition) && [
    "driver_accepted",
    "driver_selected",
    "driver_arriving",
    "driver_arrived",
    "picked_up",
    "in_progress",
    "completed",
  ].includes(course.status);
  const hasSelectedDriver = Boolean(course.livreur);
  const approachingPickup = hasSelectedDriver && ["driver_selected", "driver_arriving", "driver_arrived"].includes(course.status);
  const driverRoute = approachingPickup && pickupPosition && hasDriverPosition
    ? [
        [Number(selectedDriver.longitude), Number(selectedDriver.latitude)],
        [pickupPosition.longitude, pickupPosition.latitude],
      ]
    : null;
  const mapDrivers = course.livreur
    ? [selectedDriver].filter(Boolean)
    : course.status === "driver_accepted"
      ? acceptedDrivers
      : [];
  const mapCouriers = mapDrivers
    .filter((driver) => positionIsValid(driver.latitude, driver.longitude))
    .map((driver) => ({
      id: driver.id,
      name: driver.nom,
      vehicle: driver.vehicule,
      vehicleModel: driver.modele_vehicule,
      available: true,
      latitude: Number(driver.latitude),
      longitude: Number(driver.longitude),
    }));
  const routeGeometry = approachingPickup
    ? driverRoute
    : course.trip_route_geometry?.length > 1
      ? course.trip_route_geometry
      : course.route_geometry?.length > 1
        ? course.route_geometry
        : null;

  return (
    <section className="page client-course-page" dir="rtl">
      <header className="course-follow-header">
        <div>
          <span className="course-request-kicker">WinRak · {isDelivery ? "الطلب" : "الرحلة"} رقم {course.id}</span>
          <h1>{isDelivery ? "متابعة التوصيل" : "متابعة الرحلة"}</h1>
        </div>
      </header>

      <div className="course-tracking-focus" data-scroll-step={course.status}>
        <div className="course-tracking-focus-heading">
          {stepIndex >= 0 && <span className="course-tracking-focus-count">المرحلة {stepIndex + 1} من {steps.length}</span>}
          {active && <span className="course-tracking-focus-live"><span aria-hidden="true" />متابعة مباشرة</span>}
        </div>
        <h2 className="course-tracking-focus-title" aria-live="polite" aria-atomic="true">
          <span key={course.status}>
            {course.status === "driver_accepted"
              ? isDelivery ? "اختر عامل التوصيل المناسب" : "اختر السائق المناسب"
              : getCourseStatusLabel(course)}
          </span>
        </h2>
        {["searching", "driver_accepted"].includes(course.status) && acceptedDrivers.length > 0 && (
          <p className="course-tracking-offers">العروض المتاحة: <strong>{acceptedDrivers.length}</strong></p>
        )}
        {stepIndex >= 0 && (
          <nav
            className="course-stepper"
            aria-label="مراحل الرحلة"
            style={{ "--course-progress": `${(stepIndex / (steps.length - 1)) * 84}%` }}
          >
            <ol>
              {steps.map((step, index) => (
                <li
                  className={[
                    index < stepIndex ? "step-complete" : "",
                    index === stepIndex ? "step-active" : "",
                  ].filter(Boolean).join(" ")}
                  key={step}
                  aria-current={index === stepIndex ? "step" : undefined}
                >
                  <span className="course-step-dot" aria-hidden="true">
                    {index < stepIndex ? "✓" : index + 1}
                  </span>
                  <span className="course-step-label">{step}</span>
                </li>
              ))}
            </ol>
          </nav>
        )}
        {stepIndex >= 0 && stepIndex < steps.length - 1 && (
          <p className="course-tracking-next">المرحلة التالية: <strong>{steps[stepIndex + 1]}</strong></p>
        )}
        {active && <div className="course-live-bar" aria-hidden="true" />}
      </div>

      <div className="course-tracking-stage">
        {isDelivery && active && hasSelectedDriver && selectedDriver?.telephone && (
          <div className="course-call-first" ref={callFirstRef}>
            <strong>أول خطوة: اتصل بعامل التوصيل لتأكيد المشتريات.</strong>
            <a className="tracking-call-button" href={`tel:${selectedDriver.telephone}`}>
              اتصال بعامل التوصيل
            </a>
          </div>
        )}
        {course.status === "searching" && (
          <div className="course-searching-state">
            <span className="course-search-pulse" aria-hidden="true" />
            <strong>{isDelivery ? "جارٍ البحث عن عامل توصيل قريب" : "جارٍ البحث عن سائق قريب"}</strong>
          </div>
        )}

        {["searching", "driver_accepted"].includes(course.status) && acceptedDrivers.length > 0 && (
          <div className="accepted-driver-list">
            {acceptedDrivers.map((driver) => {
              const offeredPrice = driver.offered_price ?? course.final_price ?? course.proposed_price;

              return <article className="accepted-driver-card" key={driver.id}>
                <img src={driver.photo || defaultAvatar} alt="" />
                <div className="accepted-driver-details">
                  <strong>{driver.nom}</strong>
                  <span>
                    {VEHICLE_LABELS[driver.vehicule] || driver.vehicule}{driver.vehicule === "voiture" && driver.modele_vehicule ? ` · ${driver.modele_vehicule}` : ""}
                    {driver.note != null && <> · ★ {driver.note}</>}
                    {driver.distance_km != null && <> · {driver.distance_km} كم</>}
                  </span>
                </div>
                {offeredPrice != null && (
                  <div className="accepted-driver-price">
                    <strong className="accepted-driver-price-amount">
                      <bdi>{formatPrice(offeredPrice)}</bdi> <small>دج</small>
                    </strong>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => handleSelectDriver(driver.id)}
                  disabled={selectingDriverId !== null || cancelling}
                >
                  {selectingDriverId === driver.id ? "جارٍ التأكيد…" : "اختيار"}
                </button>
              </article>;
            })}
          </div>
        )}

        {["driver_selected", "driver_arriving", "driver_arrived", "picked_up", "in_progress"].includes(course.status) && (
          <>
            {selectedDriver && (
              <article className="confirmed-driver-card">
                <img src={selectedDriver.photo || defaultAvatar} alt="" className="confirmed-driver-photo" />
                <div className="confirmed-driver-details">
                  <strong>{selectedDriver.nom}</strong>
                  <span>{VEHICLE_LABELS[selectedDriver.vehicule] || selectedDriver.vehicule}</span>
                  {course.status !== "driver_arrived" && (
                    <span className="confirmed-driver-meta">
                      {selectedDriver.note != null && <>★ {selectedDriver.note}</>}
                      {selectedDriver.distance_km != null && (
                        <>{selectedDriver.note != null ? " · " : ""}{selectedDriver.distance_km} كم</>
                      )}
                    </span>
                  )}
                </div>
                {selectedDriver.telephone && !isDelivery && (
                  <a
                    className="tracking-call-button"
                    href={`tel:${selectedDriver.telephone}`}
                  >
                    اتصال
                  </a>
                )}
              </article>
            )}

          </>
        )}

        {course.status === "picked_up" && (
          <>
            <p className="muted">{isDelivery ? "تم استلام الطلب، وسيبدأ عامل التوصيل التوجه إلى نقطة التسليم." : "السائق جاهز لبدء الرحلة."}</p>
          </>
        )}

        {course.status === "in_progress" && (
          <>
            {isDelivery && (course.pickup_name || course.pickup_address) && (
              <div className="course-destination">
                <span>تم الاستلام من</span>
                <strong><AddressLabel text={course.pickup_name || course.pickup_address} /></strong>
              </div>
            )}
            {course.destination && (
              <div className="course-destination">
                <span>{isDelivery ? "التسليم" : "الوجهة"}</span>
                <strong><AddressLabel text={course.destination} /></strong>
              </div>
            )}
          </>
        )}

        {showMap && (
          <div className="course-tracking-map">
            <CouriersMap
              couriers={mapCouriers}
              originPosition={pickupPosition}
              clientPosition={hasStart ? {
                latitude: Number(course.client_latitude),
                longitude: Number(course.client_longitude),
              } : null}
              destinationPosition={hasDestination ? {
                latitude: Number(course.destination_latitude),
                longitude: Number(course.destination_longitude),
              } : null}
              routeGeometry={routeGeometry}
              allowRouteFallback={!approachingPickup}
              routeIsEstimate={approachingPickup}
            />
          </div>
        )}

        {course.status === "completed" && (
          <section className="course-review-card" aria-label="تقييم الرحلة">
            {reviewAlreadySubmitted ? (
              <strong className="course-review-success" role="status">شكراً لك على تقييمك</strong>
            ) : course.livreur ? (
              <form onSubmit={handleReviewSubmit}>
                <h2>{isDelivery ? "كيف كانت خدمة التوصيل؟" : "كيف كانت رحلتك؟"}</h2>
                <div className="course-review-stars" role="group" aria-label="تقييم من نجمة إلى خمس نجوم" dir="ltr">
                  {[1, 2, 3, 4, 5].map((rating) => (
                    <button
                      type="button"
                      key={rating}
                      aria-label={`${rating} نجوم`}
                      aria-pressed={reviewRating === rating}
                      onClick={() => setReviewRating(rating)}
                    >
                      <Star size={27} fill={rating <= reviewRating ? "currentColor" : "none"} aria-hidden="true" />
                    </button>
                  ))}
                </div>
                <label>
                  <span className="visually-hidden">تعليق اختياري</span>
                  <textarea
                    value={reviewMessage}
                    onChange={(event) => setReviewMessage(event.target.value)}
                    maxLength={1000}
                    placeholder="تعليق اختياري"
                  />
                </label>
                {reviewError && <p className="course-request-error" role="alert">{reviewError}</p>}
                <button type="submit" disabled={submittingReview}>
                  {submittingReview ? "جارٍ الإرسال…" : "إرسال"}
                </button>
              </form>
            ) : (
              <strong className="course-review-success">{getCourseStatusLabel(course)}</strong>
            )}
          </section>
        )}

        {course.status === "completed" && <button className="secondary-btn full" type="button"
          disabled={submittingReview} onClick={() => navigate("/livreurs", { replace: true })}>
          {reviewAlreadySubmitted ? "طلب رحلة أو توصيل جديد" : "العودة للرئيسية"}
        </button>}

        {canFinishCourse(course) && <button className="primary-btn full" type="button" onClick={handleFinish} disabled={finishing || cancelling}>
          {finishing ? "جارٍ التأكيد…" : isDelivery ? "تأكيد استلام الطلب" : "تأكيد الوصول"}
        </button>}

        {active && !showCancellation && (
          <button
            className="course-cancel-button"
            type="button"
            onClick={() => setShowCancellation(true)}
            disabled={finishing || selectingDriverId !== null}
          >
            {cancelling ? "جارٍ الإلغاء…" : isDelivery ? "إلغاء الطلب" : "إلغاء الرحلة"}
          </button>
        )}

        {active && showCancellation && <form className="course-cancel-form account-form" onSubmit={handleCancel}>
          <h2>{isDelivery ? "تأكيد إلغاء الطلب" : "تأكيد إلغاء الرحلة"}</h2>
          <label>سبب الإلغاء
            <select value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} disabled={cancelling}>
              <option value="changed_mind">لم أعد بحاجة إلى الخدمة</option>
              <option value="driver_delay">تأخر السائق</option>
              <option value="request_error">خطأ في الطلب</option>
              <option value="other">سبب آخر</option>
            </select>
          </label>
          {cancelReason === "other" && <label>توضيح السبب
            <textarea value={cancelComment} onChange={(event) => setCancelComment(event.target.value)} maxLength={500} required />
          </label>}
          <div className="account-form-actions">
            <button className="cancel" type="button" onClick={() => setShowCancellation(false)} disabled={cancelling}>الاحتفاظ بالطلب</button>
            <button className="course-cancel-button" type="submit" disabled={cancelling || finishing || selectingDriverId !== null || (cancelReason === "other" && !cancelComment.trim())}>
              {cancelling ? "جارٍ الإلغاء…" : "تأكيد الإلغاء"}
            </button>
          </div>
        </form>}
      </div>

      <div className="course-summary" aria-label="ملخص الطلب">
        {isDelivery && course.purchase_details && <p><span>المشتريات</span><strong>{course.purchase_details}</strong></p>}
        {(course.pickup_address || course.pickup_name) && <p><span>{isDelivery ? "الاستلام" : "الانطلاق"}</span><AddressLabel text={course.pickup_address || course.pickup_name} /></p>}
        {course.destination && <p><span>{isDelivery ? "التسليم" : "الوجهة"}</span><AddressLabel text={course.destination} /></p>}
        {(course.final_price ?? course.proposed_price) != null && <p><span>السعر</span><strong>{course.final_price ?? course.proposed_price} دج</strong></p>}
      </div>

      <CourseComplaint key={course.id} courseId={course.id} role="client" />
      {error && <p className="course-request-error" role="alert">{error}</p>}
    </section>
  );
}
