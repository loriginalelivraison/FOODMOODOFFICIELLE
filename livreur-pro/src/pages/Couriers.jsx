import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  createCourseRequest,
  cancelCourse,
  getCourse,
  selectCourseDriver,
} from "../livreursapi.js";
import CouriersMap from "../components/CouriersMap.jsx";
import LoadingSpinner from "../components/LoadingSpinner.jsx";
import {
  getLocationErrorMessage,
  isIOSDevice,
  requestUserPosition,
} from "../utils/geolocation.js";

const MIN_COURSE_PRICE_DZD = 100;
const DRIVER_RESPONSE_WINDOW_SECONDS = 50;

export default function Couriers() {
  const navigate = useNavigate();

  const clientWatchRef = useRef(null);
  const [clientPosition, setClientPosition] = useState(null);
  const [locationError, setLocationError] = useState("");
  const [searchingLocation, setSearchingLocation] = useState(false);
  const [destinationPosition, setDestinationPosition] = useState(null);
  const [destination, setDestination] = useState("");
  const [selectingDestination, setSelectingDestination] = useState(false);
  const [proposedPrice, setProposedPrice] = useState("");
  const [bookingError, setBookingError] = useState("");
  const [bookingLoading, setBookingLoading] = useState(false);
  const [requestedCourseId, setRequestedCourseId] = useState(() =>
    localStorage.getItem("currentClientCourseId")
  );
  const [requestedCourse, setRequestedCourse] = useState(null);
  const [selectingDriverId, setSelectingDriverId] = useState(null);
  const [cancellationReason, setCancellationReason] = useState("changed_mind");
  const [cancellationComment, setCancellationComment] = useState("");
  const [cancellingCourse, setCancellingCourse] = useState(false);
  const [responseSecondsLeft, setResponseSecondsLeft] = useState(DRIVER_RESPONSE_WINDOW_SECONDS);

  useEffect(() => {
    if (!requestedCourseId) return;
    let cancelled = false;

    async function refreshRequest() {
      try {
        const course = await getCourse(requestedCourseId);
        if (!cancelled) setRequestedCourse(course);
      } catch (err) {
        if (!cancelled) setBookingError(err.message);
      }
    }

    refreshRequest();
    const interval = setInterval(refreshRequest, 4000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [requestedCourseId]);

  useEffect(() => {
    if (!requestedCourse || !["searching", "driver_accepted"].includes(requestedCourse.status)) return;
    if (requestedCourse.accepted_drivers?.length) {
      setResponseSecondsLeft(0);
      return;
    }

    const createdAt = new Date(requestedCourse.created_at).getTime();
    if (!Number.isFinite(createdAt)) return;
    const updateRemaining = () => {
      const elapsed = Math.floor((Date.now() - createdAt) / 1000);
      setResponseSecondsLeft(Math.max(0, DRIVER_RESPONSE_WINDOW_SECONDS - elapsed));
    };
    updateRemaining();
    const interval = setInterval(updateRemaining, 1000);
    return () => clearInterval(interval);
  }, [requestedCourse]);

  async function handleRequestCourse(event) {
    event.preventDefault();
    if (bookingLoading) return;
    setBookingError("");

    if (Number(proposedPrice) < MIN_COURSE_PRICE_DZD) {
      setBookingError(`الحد الأدنى للسعر هو ${MIN_COURSE_PRICE_DZD} دج.`);
      return;
    }
    if (!destinationPosition && !destination.trim()) {
      setBookingError("اختر الوجهة على الخريطة أو أدخلها كتابةً.");
      return;
    }
    if (localStorage.getItem("role") !== "client" || !localStorage.getItem("access")) {
      localStorage.setItem("redirectAfterLogin", "/livreurs");
      navigate("/connexion-client");
      return;
    }

    setBookingLoading(true);
    try {
      const position = await requestUserPosition({
        enableHighAccuracy: true,
        maximumAge: 10000,
        timeout: 20000,
      });
      handleLocationSuccess(position);

      let requestKey = sessionStorage.getItem("pendingCourseRequestKey");
      if (!requestKey) {
        requestKey = crypto.randomUUID();
        sessionStorage.setItem("pendingCourseRequestKey", requestKey);
      }

      const course = await createCourseRequest({
        destination: destination.trim(),
        ...(destinationPosition && {
          destination_latitude: destinationPosition.latitude,
          destination_longitude: destinationPosition.longitude,
        }),
        proposed_price: Number(proposedPrice),
        client_latitude: position.coords.latitude,
        client_longitude: position.coords.longitude,
        request_key: requestKey,
      });
      sessionStorage.removeItem("pendingCourseRequestKey");
      localStorage.setItem("currentClientCourseId", String(course.id));
      setRequestedCourse(course);
      setRequestedCourseId(course.id);
      setDestinationPosition(null);
      setDestination("");
      setSelectingDestination(false);
    } catch (err) {
      const gpsErrors = {
        1: "يرجى السماح بالوصول إلى موقعك الجغرافي ثم أعد المحاولة.",
        2: "تعذر تحديد موقعك حالياً. تحقق من إعدادات الموقع.",
        3: "استغرق تحديد الموقع وقتاً طويلاً. أعد المحاولة.",
      };
      setBookingError(typeof err.code === "number"
        ? gpsErrors[err.code] || "تعذر تحديد موقعك. أعد المحاولة."
        : err.message || "تعذر إنشاء الطلب. تحقق من اتصال الإنترنت وحاول مجدداً.");
    } finally {
      setBookingLoading(false);
    }
  }

  async function handleSelectDriver(driverId) {
    if (!requestedCourse || selectingDriverId) return;
    setSelectingDriverId(driverId);
    setBookingError("");
    try {
      await selectCourseDriver(requestedCourse.id, driverId);
      navigate(`/course/${requestedCourse.id}`);
    } catch (err) {
      setBookingError(err.message || "تعذر تأكيد هذا السائق.");
      const latest = await getCourse(requestedCourse.id).catch(() => null);
      if (latest) setRequestedCourse(latest);
    } finally {
      setSelectingDriverId(null);
    }
  }

  async function handleCancelRequest(event) {
    event.preventDefault();
    if (!requestedCourse || cancellingCourse) return;
    setCancellingCourse(true);
    setBookingError("");
    try {
      const updated = await cancelCourse(requestedCourse.id, cancellationReason, cancellationComment);
      setRequestedCourse(updated);
      localStorage.removeItem("currentClientCourseId");
      setRequestedCourseId(null);
    } catch (err) {
      setBookingError(err.message || "تعذر إلغاء الطلب.");
    } finally {
      setCancellingCourse(false);
    }
  }

  function handleLocationSuccess(pos) {
    const position = {
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
    };

    setClientPosition(position);
    setSearchingLocation(false);
    setLocationError("");
  }

  function handleLocationError(error) {
    console.error("Erreur GPS client :", error);
    const isIOS = isIOSDevice();
    const message = getLocationErrorMessage(error, isIOS);

    setSearchingLocation(false);
    setLocationError(message);
  }

  async function handleFindAroundMe() {
    if (!navigator.geolocation) {
      setLocationError("الموقع الجغرافي غير مدعوم في هذا المتصفح.");
      return;
    }

    if (clientWatchRef.current !== null) {
      navigator.geolocation.clearWatch(clientWatchRef.current);
    }

    setSearchingLocation(true);
    setLocationError("");

    try {
      const initialPosition = await requestUserPosition({
        enableHighAccuracy: true,
        maximumAge: 10000,
        timeout: 20000,
      });

      handleLocationSuccess(initialPosition);

      clientWatchRef.current = navigator.geolocation.watchPosition(
        handleLocationSuccess,
        handleLocationError,
        {
          enableHighAccuracy: true,
          maximumAge: 10000,
          timeout: 20000,
        }
      );
    } catch (error) {
      handleLocationError(error);
    }
  }

  function handleDestinationSelectionToggle() {
    const nextSelecting = !selectingDestination;
    setSelectingDestination(nextSelecting);
    if (nextSelecting && !clientPosition) handleFindAroundMe();
  }

  useEffect(() => {
    return () => {
      if (clientWatchRef.current !== null) {
        navigator.geolocation.clearWatch(clientWatchRef.current);
      }
    };
  }, []);

  return (
    <section className="page couriers-page" dir="rtl">
      {locationError && !clientPosition && (
        <p className="couriers-location-error" role="status">{locationError}</p>
      )}

      <div className="couriers-map-frame">
          <CouriersMap
            couriers={[]}
            clientPosition={clientPosition}
            onRequestClientPosition={handleFindAroundMe}
            isLocating={searchingLocation}
            selectingDestination={selectingDestination}
            destinationPosition={destinationPosition}
            onSelectDestination={(position) => {
              setDestinationPosition(position);
              setDestination("");
            }}
          />
      </div>

      <div className="destination-picker-controls" dir="rtl">
        <button
          type="button"
          className={selectingDestination ? "destination-picker-active" : ""}
          onClick={handleDestinationSelectionToggle}
        >
          {selectingDestination
            ? "إنهاء التحديد"
            : destinationPosition
            ? "تغيير الوجهة على الخريطة"
            : "تحديد الوجهة على الخريطة"}
        </button>
        <span className="destination-choice-divider">أو</span>
        <label className="destination-text-field">
          <span>أدخل الوجهة</span>
          <input
            type="text"
            value={destination}
            onChange={(event) => {
              setDestination(event.target.value);
              setDestinationPosition(null);
              setSelectingDestination(false);
            }}
            placeholder="اسم المكان أو العنوان"
            maxLength={255}
          />
        </label>
      </div>

      <section className="course-request-panel" aria-labelledby="course-request-title">
        <div className="course-request-heading">
          <h2 id="course-request-title">حدد السعر</h2>
        </div>

        <form className="course-request-form" onSubmit={handleRequestCourse}>
          <label>
            السعر المقترح (دج)
            <input
              type="number"
              value={proposedPrice}
              onChange={(event) => setProposedPrice(event.target.value)}
              placeholder={`${MIN_COURSE_PRICE_DZD}`}
              min={MIN_COURSE_PRICE_DZD}
              step="1"
              required
            />
            {proposedPrice !== "" && Number(proposedPrice) < MIN_COURSE_PRICE_DZD && (
              <small className="course-price-error">الحد الأدنى للسعر هو {MIN_COURSE_PRICE_DZD} دج.</small>
            )}
          </label>
          <button
            className="course-request-submit"
            type="submit"
            disabled={bookingLoading || (!destinationPosition && !destination.trim()) || Number(proposedPrice) < MIN_COURSE_PRICE_DZD}
          >
            {bookingLoading ? "جارٍ البحث…" : "ابحث عن سائق"}
          </button>
        </form>

        {bookingError && <p className="course-request-error" role="alert">{bookingError}</p>}

        {requestedCourse && (
          <div className="course-request-status" aria-live="polite">
            <div className="course-status-heading">
              <h3>الطلب رقم {requestedCourse.id}</h3>
              <span>{requestedCourse.status === "searching" ? "جارٍ البحث عن سائق" : requestedCourse.status === "driver_accepted" ? "وصلت ردود السائقين" : requestedCourse.status === "driver_selected" ? "تم تأكيد السائق" : requestedCourse.status === "cancelled" ? "تم إلغاء الطلب" : requestedCourse.status}</span>
            </div>
            <p>
              {requestedCourse.estimated_distance_km != null
                ? `المسافة التقديرية: ${requestedCourse.estimated_distance_km} كم · `
                : "جارٍ تقدير المسافة · "}
              السعر النهائي: {requestedCourse.final_price ?? requestedCourse.proposed_price} دج
              {Number(requestedCourse.surcharge_percent) > 0 && ` (زيادة ${requestedCourse.surcharge_percent}٪)`}
            </p>

            {requestedCourse.status === "searching" && !requestedCourse.accepted_drivers?.length && (
              <div className={`driver-wait-state ${responseSecondsLeft === 0 ? "driver-wait-expired" : ""}`} aria-live="polite">
                <LoadingSpinner label="" size={28} />
                <div>
                  {responseSecondsLeft > 0 ? (
                    <>
                      <strong>جارٍ البحث عن سائقين قريبين</strong>
                      <span>بانتظار الردود · {responseSecondsLeft.toLocaleString("ar-DZ")} ثانية</span>
                    </>
                  ) : (
                    <>
                      <strong>لم يقبل أي سائق الرحلة خلال ٥٠ ثانية</strong>
                      <span>لا يزال بإمكانك الانتظار، فقد يصل رد لاحقاً، أو إلغاء الطلب.</span>
                    </>
                  )}
                </div>
              </div>
            )}

            {requestedCourse.status === "driver_accepted" && (
              <div className="course-progress-notice" aria-live="polite">
                <LoadingSpinner label="" size={28} />
                <div>
                  <strong>بانتظار اختيارك للسائق</strong>
                  <p>اختر أحد السائقين الذين قبلوا الطلب للانتقال إلى تأكيد الرحلة.</p>
                </div>
              </div>
            )}

            {requestedCourse.status === "driver_selected" && (
              <div className="course-progress-notice" aria-live="polite">
                <LoadingSpinner label="" size={28} />
                <div>
                  <strong>السائق في طريقه إليك</strong>
                  <p>انتظر وصول السائق، ويمكنك فتح متابعة الرحلة للاطلاع على التفاصيل.</p>
                </div>
              </div>
            )}

            {(requestedCourse.status === "searching" || requestedCourse.status === "driver_accepted") && (
              <div className="accepted-driver-list">
                {requestedCourse.accepted_drivers?.length ? requestedCourse.accepted_drivers.map((driver) => (
                  <article className="accepted-driver" key={driver.id}>
                    <div>
                      <strong>{driver.nom}</strong>
                      <span>{driver.vehicule} · {driver.distance_km == null ? "المسافة غير متاحة" : `${driver.distance_km} كم`} · {driver.note == null ? "بدون تقييم" : `★ ${driver.note}`}</span>
                    </div>
                    <a href={`tel:${driver.telephone}`} aria-label={`اتصل بـ ${driver.nom}`}>{driver.telephone}</a>
                    <button
                      type="button"
                      onClick={() => handleSelectDriver(driver.id)}
                      disabled={selectingDriverId !== null}
                    >
                      {selectingDriverId === driver.id ? "جارٍ التأكيد…" : "اختيار"}
                    </button>
                  </article>
                )) : <p>بانتظار ردود السائقين القريبين…</p>}
              </div>
            )}

            {requestedCourse.status === "driver_selected" && (
              <button className="course-request-submit" type="button" onClick={() => navigate(`/course/${requestedCourse.id}`)}>
                متابعة الرحلة
              </button>
            )}

            {["searching", "driver_accepted"].includes(requestedCourse.status) && (
              <form className="course-inline-cancel" onSubmit={handleCancelRequest}>
                <label>
                  سبب الإلغاء
                  <select value={cancellationReason} onChange={(event) => setCancellationReason(event.target.value)}>
                    <option value="changed_mind">غيّرت رأيي</option>
                    <option value="driver_delay">تأخر السائق</option>
                    <option value="request_error">خطأ في الوجهة أو الطلب</option>
                    <option value="other">سبب آخر</option>
                  </select>
                </label>
                {cancellationReason === "other" && (
                  <label>
                    ملاحظة
                    <input value={cancellationComment} onChange={(event) => setCancellationComment(event.target.value)} maxLength={500} required />
                  </label>
                )}
                <button type="submit" disabled={cancellingCourse}>{cancellingCourse ? "جارٍ الإلغاء…" : "إلغاء الطلب"}</button>
              </form>
            )}
          </div>
        )}
      </section>

    </section>
  );
}