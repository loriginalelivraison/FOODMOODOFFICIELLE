import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Star } from "lucide-react";
import {
  cancelCourse,
  createCommentaireLivreur,
  getCourse,
  selectCourseDriver,
} from "../livreursapi.js";
import CouriersMap from "../components/CouriersMap.jsx";
import LoadingSpinner from "../components/LoadingSpinner.jsx";
import AddressLabel from "../components/AddressLabel.jsx";
import CourseCancelledState from "../components/CourseCancelledState.jsx";
import { clearCurrentClientCourse } from "../utils/navigation.js";
import defaultAvatar from "../assets/pasdephoto.png";
import { getCourseSteps, getCourseStepIndex, getCourseStatusLabel, getPickupPosition, isDeliveryVehicle } from "../utils/courseTracking.js";
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

  useEffect(() => {
    let cancelled = false;

    async function refreshCourse() {
      try {
        const data = await getCourse(id);
        if (!cancelled) {
          setCourse(data);
          setError("");
          if (["completed", "cancelled"].includes(data.status)) {
            clearCurrentClientCourse(data.id);
          } else {
            localStorage.setItem("currentClientCourseId", String(data.id));
          }
        }
      } catch (err) {
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

  useEffect(() => {
    if (course?.status !== "completed") return undefined;
    const timeout = setTimeout(() => navigate("/", { replace: true }), 12000);
    return () => clearTimeout(timeout);
  }, [course?.status, navigate]);

  async function handleCancel() {
    if (!course || cancelling || ["completed", "cancelled"].includes(course.status)) return;
    setCancelling(true);
    setError("");
    try {
      const updated = await cancelCourse(course.id, "changed_mind");
      setCourse(updated);
      clearCurrentClientCourse(course.id);
    } catch (err) {
      setError(err.message || (isDeliveryVehicle(course.vehicle_type) ? "تعذر إلغاء الطلب." : "تعذر إلغاء الرحلة."));
    } finally {
      setCancelling(false);
    }
  }

  async function handleSelectDriver(driverId) {
    if (!course || selectingDriverId !== null) return;
    setSelectingDriverId(driverId);
    setError("");
    try {
      const updated = await selectCourseDriver(course.id, driverId);
      setCourse(updated);
    } catch (err) {
      setError(err.message || "تعذر تأكيد هذا السائق.");
      try {
        setCourse(await getCourse(course.id));
      } catch (refreshError) {
        setError(refreshError.message || "تعذر تحديث حالة الرحلة.");
      }
    } finally {
      setSelectingDriverId(null);
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
      navigate("/", { replace: true });
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
  ) || acceptedDrivers[0];
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
    <section className="page" dir="rtl">
      <header className="course-follow-header">
        <div>
          <span className="course-request-kicker">WinRak · الرحلة رقم {course.id}</span>
          <h1>{isDelivery ? "متابعة التوصيل" : "متابعة الرحلة"}</h1>
        </div>
      </header>

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

      {active && <div className="course-live-bar" aria-hidden="true" />}

      <div className="course-tracking-stage" aria-live="polite" data-scroll-step={course.status}>
        {course.status === "searching" && (
          <div className="course-searching-state">
            <span className="course-search-pulse" aria-hidden="true" />
            <strong>{isDelivery ? "جارٍ البحث عن عامل توصيل قريب" : "جارٍ البحث عن سائق قريب"}</strong>
          </div>
        )}

        {course.status === "driver_accepted" && (
          <h2 className="course-tracking-title">{isDelivery ? "اختر عامل التوصيل المناسب" : "اختر السائق المناسب"}</h2>
        )}

        {["searching", "driver_accepted"].includes(course.status) && acceptedDrivers.length > 0 && (
          <div className="accepted-driver-list">
            {acceptedDrivers.map((driver) => (
              <article className="accepted-driver-card" key={driver.id}>
                <img src={driver.photo || defaultAvatar} alt="" />
                <div className="accepted-driver-details">
                  <strong>{driver.nom}</strong>
                  <span>
                    {VEHICLE_LABELS[driver.vehicule] || driver.vehicule}{driver.vehicule === "voiture" && driver.modele_vehicule ? ` · ${driver.modele_vehicule}` : ""}
                    {driver.note != null && <> · ★ {driver.note}</>}
                    {driver.distance_km != null && <> · {driver.distance_km} كم</>}
                  </span>
                  {(course.final_price ?? course.proposed_price) != null && (
                    <span>{course.final_price ?? course.proposed_price} دج</span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => handleSelectDriver(driver.id)}
                  disabled={selectingDriverId !== null}
                >
                  {selectingDriverId === driver.id ? "جارٍ التأكيد…" : "اختيار"}
                </button>
              </article>
            ))}
          </div>
        )}

        {["driver_selected", "driver_arriving", "driver_arrived", "picked_up", "in_progress"].includes(course.status) && (
          <>
            {course.status === "driver_selected" && (
              <h2 className="course-tracking-title">{getCourseStatusLabel(course)}</h2>
            )}
            {course.status === "driver_arriving" && (
              <h2 className="course-tracking-title">{getCourseStatusLabel(course)}</h2>
            )}
            {course.status === "driver_arrived" && (
              <h2 className="course-arrived-title">{getCourseStatusLabel(course)}</h2>
            )}
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
                {selectedDriver.telephone && (
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
            <h2 className="course-tracking-title">{getCourseStatusLabel(course)}</h2>
            <p className="muted">{isDelivery ? "تم استلام الطلب، وسيبدأ عامل التوصيل التوجه إلى نقطة التسليم." : "السائق جاهز لبدء الرحلة."}</p>
          </>
        )}

        {course.status === "in_progress" && (
          <>
            <h2 className="course-tracking-title">
              {getCourseStatusLabel(course)}
            </h2>
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

        {active && (
          <button
            className="course-cancel-button"
            type="button"
            onClick={handleCancel}
            disabled={cancelling}
          >
            {cancelling ? "جارٍ الإلغاء…" : isDelivery ? "إلغاء الطلب" : "إلغاء الرحلة"}
          </button>
        )}
      </div>

      {error && <p className="course-request-error" role="alert">{error}</p>}
    </section>
  );
}
