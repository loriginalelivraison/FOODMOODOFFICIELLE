import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Bike, CarFront, Minus, Plus, Star, Truck } from "lucide-react";
import {
  createCommentaireLivreur,
  createCourseRequest,
  cancelCourse,
  getCourse,
  getCourseAddress,
  getCourseQuote,
  selectCourseDriver,
} from "../livreursapi.js";
import CouriersMap from "../components/CouriersMap.jsx";
import { MY_LOCATION_LABEL } from "../components/DepartureField.jsx";
import DestinationField from "../components/DestinationField.jsx";
import { destinationCoordinates } from "../utils/destinationSearch.js";
import LoadingSpinner from "../components/LoadingSpinner.jsx";
import defaultAvatar from "../assets/pasdephoto.png";
import {
  getLocationErrorMessage,
  isIOSDevice,
  requestUserPosition,
} from "../utils/geolocation.js";
import {
  scrollToPageTopWhenReady,
  scrollToSection,
} from "../utils/scroll.js";

const MIN_COURSE_PRICE_DZD = 100;
const PRICE_ADJUSTMENT_DZD = 50;
const VEHICLE_TYPES = [
  { value: "moto", label: "دراجة نارية", description: "خدمة التوصيل", icon: Bike },
  { value: "voiture", label: "سيارة", description: "تنقل الأشخاص", icon: CarFront },
  { value: "camion", label: "شاحنة", icon: Truck },
];
const COURSE_STEPS = ["الطلب", "السائق", "في الطريق", "وصل", "انتهت"];
// Commande de livraison (livreur) : le trajet comporte deux jambes,
// retrait chez le commerçant puis livraison chez le client.
const DELIVERY_STEPS = ["الطلب", "السائق", "في الطريق", "تم الاستلام", "وصل"];
// Un taxi se déplace directement du client vers sa destination :
// le vocabulaire historique est conservé tel quel.
const DELIVERY_VEHICLE_TYPES = ["moto", "camion"];

function isDeliveryVehicle(vehicleType) {
  return DELIVERY_VEHICLE_TYPES.includes(vehicleType);
}
const VEHICLE_LABELS = {
  moto: "دراجة نارية",
  scooter: "دراجة نارية",
  voiture: "سيارة",
  camion: "شاحنة",
};

function hasCoordinates(latitude, longitude) {
  return latitude !== null && latitude !== undefined
    && longitude !== null && longitude !== undefined
    && Number.isFinite(Number(latitude)) && Number.isFinite(Number(longitude));
}

function getCourseStepIndex(status) {
  if (status === "searching") return 0;
  if (status === "driver_accepted") return 1;
  // Dès que le client confirme le chauffeur, l'étape passe à "في الطريق" (en route).
  if (["driver_selected", "driver_arriving"].includes(status)) return 2;
  // "picked_up" = commande récupérée chez le commerçant : on part vers le client.
  if (["driver_arrived", "picked_up", "in_progress"].includes(status)) return 3;
  if (status === "completed") return 4;
  return -1;
}

function getDistanceKm(lat1, lon1, lat2, lon2) {
  const radians = (degrees) => (degrees * Math.PI) / 180;
  const latitudeDelta = radians(lat2 - lat1);
  const longitudeDelta = radians(lon2 - lon1);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(radians(lat1)) *
      Math.cos(radians(lat2)) *
      Math.sin(longitudeDelta / 2) ** 2;

  return 6371 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function CourseTrackingPanel({
  course,
  couriers = [],
  onChooseDriver,
  selectingDriverId,
  onCancel,
  cancelling,
  onReviewSubmit,
  reviewAlreadySubmitted,
  reviewRating,
  setReviewRating,
  reviewMessage,
  setReviewMessage,
  submittingReview,
  reviewError,
  onNewRequest,
  hasCalledDriver,
  onDriverCall,
  arrivalConfirmed,
  onConfirmArrival,
}) {
  const [mapWasShown, setMapWasShown] = useState(false);
  const acceptedDrivers = course.accepted_drivers || [];
  const selectedDriver = acceptedDrivers.find(
    (driver) => String(driver.id) === String(course.livreur)
  ) || acceptedDrivers[0];
  const selectedDriverProfile = couriers.find(
    (courier) => String(courier.id) === String(selectedDriver?.id)
  );
  const stepIndex = getCourseStepIndex(course.status);
  const isDelivery = isDeliveryVehicle(course.vehicle_type);
  const steps = isDelivery ? DELIVERY_STEPS : COURSE_STEPS;
  // En livraison, la jambe en cours part du magasin vers le client.
  const hasPickupPoint = hasCoordinates(course.pickup_latitude, course.pickup_longitude);
  const hasStart = hasCoordinates(course.client_latitude, course.client_longitude);
  const hasDestination = hasCoordinates(
    course.destination_latitude,
    course.destination_longitude
  );
  const hasDriverPosition = hasCoordinates(selectedDriver?.latitude, selectedDriver?.longitude);
  const trackingCouriers = selectedDriver && hasDriverPosition
    ? [{
        id: selectedDriver.id,
        name: selectedDriver.nom,
        vehicle: selectedDriver.vehicule,
        available: true,
        latitude: Number(selectedDriver.latitude),
        longitude: Number(selectedDriver.longitude),
      }]
    : [];
  const showMap = course.status === "driver_arriving"
    ? hasStart && hasDriverPosition
    : course.status === "driver_selected"
      ? arrivalConfirmed && hasStart
      : course.status === "in_progress"
      && hasStart && (hasDestination || course.route_geometry?.length > 1);
  useEffect(() => { if (showMap) setMapWasShown(true); }, [showMap]);
  // En livraison, le livreur rejoint d'abord le magasin : c'est la jambe affichée
// jusqu'a la prise en charge. En taxi, la cible reste le client.
  const legTarget = isDelivery && hasPickupPoint
    ? {
        latitude: Number(course.pickup_latitude),
        longitude: Number(course.pickup_longitude),
      }
    : hasStart
      ? {
          latitude: Number(course.client_latitude),
          longitude: Number(course.client_longitude),
        }
      : null;
  const driverToClientRoute = legTarget && hasDriverPosition
    ? [
        [Number(selectedDriver.longitude), Number(selectedDriver.latitude)],
        [legTarget.longitude, legTarget.latitude],
      ]
    : null;
  const vehicleLabels = {
    moto: "دراجة نارية",
    scooter: "دراجة نارية",
    voiture: "سيارة",
    camion: "شاحنة",
  };

  return (
    <div className="course-request-status course-tracking-status">
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

      {!["completed", "cancelled"].includes(course.status) && (
        <div className="course-live-bar" aria-hidden="true" />
      )}

      <div
        className={`course-tracking-stage status-${course.status}`}
        aria-live="polite"
      >
        {course.status === "searching" && (
          <div className="course-searching-state">
            <span className="course-search-pulse" aria-hidden="true" />
            <strong>جارٍ البحث عن سائق قريب</strong>
          </div>
        )}

        {isDelivery && hasPickupPoint && (
          <div className="course-details-banner" aria-label="معلومات المتجر">
            <span>
              <b>المتجر</b>
              {course.pickup_name || course.pickup_address || "موقع محدد على الخريطة"}
            </span>
            {course.pickup_phone && (
              <span>
                <b>الهاتف</b>
                {course.pickup_phone}
              </span>
            )}
          </div>
        )}

        {course.status === "driver_accepted" && (
          <h3 className="course-tracking-title">اختر السائق المناسب</h3>
        )}

        {["searching", "driver_accepted"].includes(course.status) && (
          <>
            {acceptedDrivers.length > 0 && (
              <div className="accepted-driver-list">
                {acceptedDrivers.map((driver) => {
                  const profile = couriers.find(
                    (courier) => String(courier.id) === String(driver.id)
                  );
                  const offerPrice = course.final_price ?? course.proposed_price;

                  return (
                    <article className="accepted-driver-card" key={driver.id}>
                      <img src={profile?.photo || defaultAvatar} alt="" />
                      <div className="accepted-driver-details">
                        <strong>{driver.nom}</strong>
                        <span>
                          {vehicleLabels[driver.vehicule] || driver.vehicule}
                          {driver.note != null && (
                            <> · <Star size={14} fill="currentColor" aria-hidden="true" /> {driver.note}</>
                          )}
                          {driver.distance_km != null && <> · {driver.distance_km} كم</>}
                        </span>
                        {offerPrice != null && <span>{offerPrice} دج</span>}
                      </div>
                      <button
                        type="button"
                        onClick={() => onChooseDriver(driver.id)}
                        disabled={selectingDriverId !== null}
                      >
                        {selectingDriverId === driver.id ? "جارٍ التأكيد…" : "اختيار"}
                      </button>
                    </article>
                  );
                })}
              </div>
            )}
            <button
              className="course-cancel-button"
              type="button"
              onClick={onCancel}
              disabled={cancelling}
            >
              {cancelling ? "جارٍ الإلغاء…" : "إلغاء الطلب"}
            </button>
          </>
        )}

        {["driver_selected", "driver_arriving", "driver_arrived"].includes(course.status) && (
          <>
            {course.status === "driver_selected" && (
              <h3 className="course-tracking-title">تم تأكيد السائق</h3>
            )}
            {course.status === "driver_arriving" && (
              <h3 className="course-tracking-title">
                {isDelivery ? "سائقك في الطريق إلى المتجر" : "سائقك في الطريق إليك"}
              </h3>
            )}
            {course.status === "driver_arrived" && (
              <h3 className="course-arrived-title">
                {isDelivery ? "وصل سائقك إلى المتجر" : "وصل سائقك"}
              </h3>
            )}
            {selectedDriver && (
              <article className="confirmed-driver-card">
                <img
                  src={selectedDriverProfile?.photo || defaultAvatar}
                  alt=""
                  className="confirmed-driver-photo"
                />
                <div className="confirmed-driver-details">
                  <strong>{selectedDriver.nom}</strong>
                  <span>{vehicleLabels[selectedDriver.vehicule] || selectedDriver.vehicule}</span>
                  {course.status !== "driver_arrived" && (
                    <span className="confirmed-driver-meta">
                      {selectedDriver.note != null && <>★ {selectedDriver.note}</>}
                      {selectedDriver.distance_km != null && (
                        <>{selectedDriver.note != null ? " · " : ""}{selectedDriver.distance_km} كم</>
                      )}
                    </span>
                  )}
                </div>
                {selectedDriver.telephone && !hasCalledDriver && (
                  <a
                    className="tracking-call-button"
                    href={`tel:${selectedDriver.telephone}`}
                    onClick={onDriverCall}
                    aria-label={`اتصل بـ ${selectedDriver.nom}`}
                  >
                    اتصال
                  </a>
                )}
              </article>
            )}
            {course.status === "driver_selected" && hasCalledDriver && !arrivalConfirmed && (
              <div className="driver-arrival-choice" role="group" aria-label="هل السائق في طريقه إليك؟">
                <button type="button" onClick={onConfirmArrival}>
                  نعم، السائق قادم
                </button>
                <button type="button" onClick={onCancel} disabled={cancelling}>
                  {cancelling ? "جارٍ الإلغاء…" : "إلغاء الرحلة"}
                </button>
              </div>
            )}


          </>
        )}

        {course.status === "in_progress" && (
          <>
            <h3 className="course-tracking-title">
              {isDelivery ? "الطلب في الطريق إليك" : "الرحلة جارية"}
            </h3>
            {isDelivery && (course.pickup_name || course.pickup_address) && (
              <div className="course-destination">
                <span>تم الاستلام من</span>
                <strong>{course.pickup_name || course.pickup_address}</strong>
              </div>
            )}
            {course.destination && (
              <div className="course-destination">
                <span>{isDelivery ? "التسليم" : "الوجهة"}</span>
                <strong>{course.destination}</strong>
              </div>
            )}

          </>
        )}

        {(showMap || mapWasShown) && (
          <div className="course-tracking-map" style={{ display: showMap ? undefined : "none" }}>
            <CouriersMap
              couriers={trackingCouriers}
              routeIsEstimate={course.status !== "in_progress"}
              clientPosition={{ latitude: Number(course.client_latitude), longitude: Number(course.client_longitude) }}
              destinationPosition={course.status === "in_progress" && hasDestination ? { latitude: Number(course.destination_latitude), longitude: Number(course.destination_longitude) } : null}
              routeGeometry={course.status === "in_progress" ? (isDelivery && course.trip_route_geometry?.length > 1 ? course.trip_route_geometry : course.route_geometry) : driverToClientRoute}
            />
          </div>
        )}

        {course.status === "completed" && (
          <section className="course-review-card" aria-label="تقييم الرحلة">
            {reviewAlreadySubmitted ? (
              <strong className="course-review-success" role="status">شكراً لك على تقييمك</strong>
            ) : course.livreur ? (
              <form onSubmit={onReviewSubmit}>
                <h3>كيف كانت رحلتك؟</h3>
                <div className="course-review-stars" role="group" aria-label="تقييم من نجمة إلى خمس نجوم" dir="ltr">
                  {[1, 2, 3, 4, 5].map((rating) => (
                    <button
                      type="button"
                      key={rating}
                      aria-label={`${rating} نجوم`}
                      aria-pressed={reviewRating === rating}
                      onClick={() => setReviewRating(rating)}
                    >
                      <Star
                        size={27}
                        fill={rating <= reviewRating ? "currentColor" : "none"}
                        aria-hidden="true"
                      />
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
              <p className="course-request-error" role="alert">تعذر تحديد السائق لإرسال التقييم.</p>
            )}
          </section>
        )}

        {course.status === "cancelled" && (
          <div className="course-cancelled-state">
            <h3>أُلغيت الرحلة</h3>
            <button className="course-request-submit" type="button" onClick={onNewRequest}>
              طلب رحلة جديدة
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Couriers() {
  const navigate = useNavigate();

  const clientWatchRef = useRef(null);
  const autoLocationRequestedRef = useRef(false);
  const pickupTouchedRef = useRef(false);
  const destinationTouchedRef = useRef(false);
  const pickupAddressRequestRef = useRef(0);
  const destinationAddressRequestRef = useRef(0);
  const pickupInputRef = useRef(null);
  const [clientPosition, setClientPosition] = useState(null);
  const [locationError, setLocationError] = useState("");
  const [searchingLocation, setSearchingLocation] = useState(false);
  const [destinationPosition, setDestinationPosition] = useState(null);
  const [destination, setDestination] = useState("");
  const [selectingDestination, setSelectingDestination] = useState(false);
  const [pickup, setPickup] = useState("");
  const [pickupPosition, setPickupPosition] = useState(null);
  const [selectingPickup, setSelectingPickup] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [showClientPoint, setShowClientPoint] = useState(false);
  const [proposedPrice, setProposedPrice] = useState("");
  const [priceQuote, setPriceQuote] = useState(null);
  const [priceCalculating, setPriceCalculating] = useState(false);
  const destinationSectionRef = useRef(null);
  const [bookingError, setBookingError] = useState("");
  const [bookingLoading, setBookingLoading] = useState(false);
  const bookingInFlightRef = useRef(false);
  const [requestedCourseId, setRequestedCourseId] = useState(() =>
    localStorage.getItem("currentClientCourseId")
  );
  const [requestedCourse, setRequestedCourse] = useState(null);
  const [selectingDriverId, setSelectingDriverId] = useState(null);
  const [calledDriverCourseId, setCalledDriverCourseId] = useState(null);
  const [arrivalConfirmedCourseId, setArrivalConfirmedCourseId] = useState(null);
  const cancellationReason = "changed_mind";
  const [cancellingCourse, setCancellingCourse] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewMessage, setReviewMessage] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewError, setReviewError] = useState("");
  const [reviewSubmitted, setReviewSubmitted] = useState(false);
  const hasDestination = Boolean(destinationPosition || destination.trim());
  // Le client est à l'arrivée en livraison, au départ en transport de personnes.
  const isDelivery = isDeliveryVehicle(selectedVehicle);
  const pickupLabel = isDelivery ? "نقطة الاستلام" : "نقطة الانطلاق";
  const destinationLabel = isDelivery ? "نقطة التسليم" : "نقطة الوصول";
  const hasPickup = Boolean(pickupPosition || pickup.trim());
  // Point de départ effectif : le point carte choisi prime, sinon le texte
  // saisi (géocodé côté backend), sinon la position GPS « Ma position ».
  const effectiveStart = pickupPosition || clientPosition;
  const mapOriginPosition = hasCoordinates(priceQuote?.pickup_latitude, priceQuote?.pickup_longitude)
    ? { latitude: priceQuote.pickup_latitude, longitude: priceQuote.pickup_longitude }
    : pickupPosition;
  const pickupPickingPhase = selectingPickup ? "choosing" : null;
  const mapDestinationPosition = priceQuote
    ? {
        latitude: priceQuote.destination_latitude,
        longitude: priceQuote.destination_longitude,
      }
    : destinationPosition;
  const shouldShowMap = !requestedCourseId;
  // L'indication de sélection disparaît dès que le point est choisi.
  const destinationPickingPhase = selectingDestination ? "choosing" : null;

  function fetchQuote() {
    return getCourseQuote({
      destination: destination.trim(),
      ...(destinationPosition && {
        destination_latitude: destinationPosition.latitude,
        destination_longitude: destinationPosition.longitude,
      }),
      client_latitude: effectiveStart.latitude,
      client_longitude: effectiveStart.longitude,
      pickup_name: pickup.trim() || MY_LOCATION_LABEL,
      pickup_address: pickup.trim() || MY_LOCATION_LABEL,
      ...(pickupPosition && {
        pickup_latitude: pickupPosition.latitude,
        pickup_longitude: pickupPosition.longitude,
      }),
    });
  }

  function adjustProposedPrice(amount) {
    setProposedPrice((currentValue) => {
      const currentPrice = Number(currentValue || priceQuote?.proposed_price || MIN_COURSE_PRICE_DZD);
      return String(Math.max(MIN_COURSE_PRICE_DZD, currentPrice + amount));
    });
  }

  useEffect(() => {
    if (!clientPosition || !selectedVehicle || !effectiveStart || !hasPickup
      || !hasDestination || !pickupPosition || !destinationPosition || requestedCourseId) {
      setPriceQuote(null);
      setProposedPrice("");
      setPriceCalculating(false);
      return undefined;
    }

    let cancelled = false;
    setPriceQuote(null);
    setProposedPrice("");
    setPriceCalculating(true);
    setBookingError("");

    const timeout = setTimeout(async () => {
      if (cancelled) return;
      try {
        const quote = await fetchQuote();
        if (cancelled) return;
        setPriceQuote(quote);
        setProposedPrice(String(quote.proposed_price));
        setShowClientPoint(true);
      } catch (error) {
        if (!cancelled) setBookingError(error.message || "تعذر حساب سعر الرحلة.");
      } finally {
        if (!cancelled) {
          setPriceCalculating(false);
        }
      }
    }, pickupPosition && destinationPosition ? 0 : 500);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [clientPosition?.latitude, clientPosition?.longitude, destination, destinationPosition?.latitude, destinationPosition?.longitude, effectiveStart?.latitude, effectiveStart?.longitude, hasDestination, hasPickup, pickup, pickupPosition?.latitude, pickupPosition?.longitude, requestedCourseId, selectedVehicle]);

  // 1. À l'ouverture de la demande, l'écran revient en haut
  useEffect(() => scrollToPageTopWhenReady(), []);

  // 2. Après le choix du véhicule, montrer le champ qui reste à renseigner.
  useEffect(() => {
    if (!selectedVehicle) return undefined;

    const frame = requestAnimationFrame(() => {
      scrollToSection(isDelivery ? pickupInputRef.current : destinationSectionRef.current);
    });
    return () => cancelAnimationFrame(frame);
  }, [selectedVehicle, isDelivery]);

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
    if (requestedCourseId) {
      navigate(`/course/${requestedCourseId}`, { replace: true });
    }
  }, [navigate, requestedCourseId]);

  useEffect(() => {
    if (requestedCourse?.status !== "completed") return undefined;

    const timeout = setTimeout(() => {
      localStorage.removeItem("currentClientCourseId");
      navigate("/", { replace: true });
    }, 5000);

    return () => clearTimeout(timeout);
  }, [navigate, requestedCourse?.status]);

  async function handleRequestCourse(event) {
    event.preventDefault();
    if (bookingInFlightRef.current) return;
    setBookingError("");

    if (proposedPrice !== "" && Number(proposedPrice) < MIN_COURSE_PRICE_DZD) {
      setBookingError(`الحد الأدنى للسعر هو ${MIN_COURSE_PRICE_DZD} دج.`);
      return;
    }
    if (!destinationPosition) {
      setBookingError(`اختر ${destinationLabel} من القائمة أو على الخريطة.`);
      return;
    }
    // Le lieu de retrait est obligatoire en livraison, comme le départ en taxi.
    if (!pickupPosition) {
      setBookingError(`اختر ${pickupLabel} من القائمة أو على الخريطة.`);
      return;
    }
    if (!clientPosition || !selectedVehicle || priceCalculating) {
      setBookingError("يرجى تفعيل موقعك وانتظار اكتمال حساب السعر.");
      return;
    }
    if (localStorage.getItem("role") !== "client" || !localStorage.getItem("access")) {
      localStorage.setItem("redirectAfterLogin", "/livreurs");
      navigate("/connexion-client");
      return;
    }

    bookingInFlightRef.current = true;
    setBookingLoading(true);
    try {
      const quote = priceQuote || await fetchQuote();
      const requestPrice = proposedPrice === "" ? quote.proposed_price : proposedPrice;
      const position = await requestUserPosition({
        enableHighAccuracy: true,
        maximumAge: 10000,
        timeout: 20000,
      });
      const positionDeltaKm = getDistanceKm(
        clientPosition.latitude,
        clientPosition.longitude,
        position.coords.latitude,
        position.coords.longitude
      );
      if (positionDeltaKm > 0.1) {
        handleLocationSuccess(position);
        setBookingError("تم تحديث موقعك. انتظر إعادة حساب السعر ثم أرسل الطلب.");
        return;
      }

      let requestKey = sessionStorage.getItem("pendingCourseRequestKey");
      if (!requestKey) {
        requestKey = crypto.randomUUID();
        sessionStorage.setItem("pendingCourseRequestKey", requestKey);
      }

      const course = await createCourseRequest({
        destination: quote.destination || destination.trim(),
        destination_latitude: quote.destination_latitude,
        destination_longitude: quote.destination_longitude,
        proposed_price: Number(requestPrice),
        client_latitude: position.coords.latitude,
        client_longitude: position.coords.longitude,
        vehicle_type: selectedVehicle,
        request_key: requestKey,
        // Trajet simple départ → arrivée (tous véhicules) : le point carte
        // prime, sinon le texte de départ (géocodé backend), sinon le GPS.
        ...(hasPickup && {
          pickup_name: pickup.trim() || MY_LOCATION_LABEL,
          pickup_address: pickup.trim() || MY_LOCATION_LABEL,
          ...(pickupPosition && {
            pickup_latitude: pickupPosition.latitude,
            pickup_longitude: pickupPosition.longitude,
          }),
        }),
      });
      sessionStorage.removeItem("pendingCourseRequestKey");
      localStorage.setItem("currentClientCourseId", String(course.id));
      setRequestedCourse(course);
      setRequestedCourseId(course.id);
      navigate(`/course/${course.id}`);
      setDestinationPosition(null);
      setDestination("");
      setSelectingDestination(false);
      setPickupPosition(null);
      setPickup("");
      setSelectingPickup(false);
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
      bookingInFlightRef.current = false;
      setBookingLoading(false);
    }
  }

  async function handleSelectDriver(driverId) {
    if (!requestedCourse || selectingDriverId) return;
    setSelectingDriverId(driverId);
    setBookingError("");
    try {
      const updatedCourse = await selectCourseDriver(requestedCourse.id, driverId);
      setRequestedCourse(updatedCourse);
      navigate(`/course/${requestedCourse.id}`);
    } catch (err) {
      setBookingError(err.message || "تعذر تأكيد هذا السائق.");
      const latest = await getCourse(requestedCourse.id).catch(() => null);
      if (latest) setRequestedCourse(latest);
    } finally {
      setSelectingDriverId(null);
    }
  }

  async function handleCancelRequest() {
    if (!requestedCourse || cancellingCourse) return;
    setCancellingCourse(true);
    setBookingError("");
    try {
      const updated = await cancelCourse(requestedCourse.id, cancellationReason);
      setRequestedCourse(updated);
    } catch (err) {
      setBookingError(err.message || "تعذر إلغاء الطلب.");
    } finally {
      setCancellingCourse(false);
    }
  }

  async function handleReviewSubmit(event) {
    event.preventDefault();
    if (!requestedCourse?.livreur || submittingReview || reviewSubmitted) return;
    setSubmittingReview(true);
    setReviewError("");
    try {
      await createCommentaireLivreur({
        livreur: requestedCourse.livreur,
        note: reviewRating,
        message: reviewMessage.trim() || "بدون تعليق",
      });
      localStorage.setItem(`courseReviewSubmitted:${requestedCourse.id}`, "true");
      localStorage.removeItem("currentClientCourseId");
      setReviewSubmitted(true);
      navigate("/", { replace: true });
    } catch (err) {
      setReviewError(err.message || "تعذر إرسال تقييمك. يرجى المحاولة مجدداً.");
    } finally {
      setSubmittingReview(false);
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
    setLocationError(`يرجى تفعيل موقعك ثم إعادة المحاولة. ${message}`);
  }

  async function handleFindAroundMe({ watch = true } = {}) {
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

      if (watch) {
        clientWatchRef.current = navigator.geolocation.watchPosition(
          handleLocationSuccess,
          handleLocationError,
          {
            enableHighAccuracy: true,
            maximumAge: 10000,
            timeout: 20000,
          }
        );
      }
    } catch (error) {
      handleLocationError(error);
    }
  }

  function handleDestinationInputChange(event) {
    const value = event.target.value;
    destinationTouchedRef.current = true;
    destinationAddressRequestRef.current += 1;
    setDestination(value);
    setDestinationPosition(null);
    setSelectingDestination(false);
    setPriceQuote(null);
    setProposedPrice("");
    setPriceCalculating(false);

  }

  function handleLocalPlaceSelection(place, isPickup) {
    const position = destinationCoordinates(place);
    const touched = isPickup ? pickupTouchedRef : destinationTouchedRef;
    const request = isPickup ? pickupAddressRequestRef : destinationAddressRequestRef;
    touched.current = true;
    request.current += 1;
    (isPickup ? setPickup : setDestination)(place.search_name);
    (isPickup ? setPickupPosition : setDestinationPosition)(position);
    setSelectingPickup(isPickup && !position);
    setSelectingDestination(!isPickup && !position);
    setPriceQuote(null);
    setProposedPrice("");
    setPriceCalculating(false);
    setBookingError("");
    if (!position) scrollToSection(document.querySelector(".couriers-map-frame"));
  }

  function handleDestinationSelectionToggle() {
    const nextSelecting = !selectingDestination;
    destinationTouchedRef.current = true;
    setSelectingDestination(nextSelecting);
    setSelectingPickup(false);
    if (nextSelecting) scrollToSection(document.querySelector(".couriers-map-frame"));
    if (nextSelecting && !clientPosition) handleFindAroundMe();
  }

  // Point de départ : pour TOUS les véhicules (livraison + taxi) — saisie
  // manuelle (texte) ou point carte. « Ma position » = position GPS.
  function handlePickupInputChange(event) {
    const value = event.target.value;

    pickupTouchedRef.current = true;
    pickupAddressRequestRef.current += 1;
    setPickup(value);
    setPickupPosition(null);
    setSelectingPickup(false);
    setPriceQuote(null);
    setProposedPrice("");
    setPriceCalculating(false);
  }

  function handlePickupSelectionToggle() {
    const nextSelecting = !selectingPickup;
    pickupTouchedRef.current = true;
    setSelectingPickup(nextSelecting);
    setSelectingDestination(false);
    if (nextSelecting) scrollToSection(document.querySelector(".couriers-map-frame"));
    if (nextSelecting && !clientPosition) handleFindAroundMe();
  }

  async function selectPoint(position, isPickup) {
    const requestRef = isPickup ? pickupAddressRequestRef : destinationAddressRequestRef;
    const setLabel = isPickup ? setPickup : setDestination;
    const requestId = ++requestRef.current;
    const fallback = `موقع محدد (${position.latitude.toFixed(4)}, ${position.longitude.toFixed(4)})`;
    if (isPickup) {
      setPickupPosition(position);
      setSelectingPickup(false);
    } else {
      setDestinationPosition(position);
      setSelectingDestination(false);
    }
    setLabel(fallback);
    setBookingError("");
    try {
      const address = await getCourseAddress(position);
      if (requestId === requestRef.current && address) setLabel(address);
    } catch {
      // Le point reste utilisable si le service d'adresse est indisponible.
    }
  }

  function handleVehicleChange(value) {
    if (value === selectedVehicle) return;
    setShowClientPoint(false);
    // Les rôles changent : retirer les anciens points et réponses en attente.
    pickupTouchedRef.current = false;
    destinationTouchedRef.current = false;
    pickupAddressRequestRef.current += 1;
    destinationAddressRequestRef.current += 1;
    setPickup("");
    setPickupPosition(null);
    setDestination("");
    setDestinationPosition(null);
    setSelectingPickup(false);
    setSelectingDestination(false);
    setPriceQuote(null);
    setProposedPrice("");
    setPriceCalculating(false);
    setBookingError("");
    setSelectedVehicle(value);
  }

  useEffect(() => {
    if (!autoLocationRequestedRef.current) {
      autoLocationRequestedRef.current = true;
      handleFindAroundMe({ watch: false });
    }
    return () => {
      if (clientWatchRef.current !== null) {
        navigator.geolocation.clearWatch(clientWatchRef.current);
      }
    };
  }, []);

  const reviewAlreadySubmitted = reviewSubmitted || Boolean(
    requestedCourse && localStorage.getItem(`courseReviewSubmitted:${requestedCourse.id}`) === "true"
  );

  // Préremplir le côté client avec « موقعي الحالي » et ses coordonnées GPS.
  useEffect(() => {
    if (!clientPosition || !selectedVehicle) return;
    if (isDelivery) {
      if (destinationTouchedRef.current) return;
      destinationAddressRequestRef.current += 1;
      setDestinationPosition(clientPosition);
      setDestination(MY_LOCATION_LABEL);
    } else {
      if (pickupTouchedRef.current) return;
      pickupAddressRequestRef.current += 1;
      setPickupPosition(clientPosition);
      setPickup(MY_LOCATION_LABEL);
    }
  }, [clientPosition, selectedVehicle, isDelivery]);

  const pickupField = (
    <DestinationField
      onSelectPlace={(place) => handleLocalPlaceSelection(place, true)}
      id="departure-input"
      label={pickupLabel}
      placeholder={isDelivery ? "عنوان المتجر أو المطعم" : "موقعي الحالي أو عنوان آخر"}
      value={pickup}
      onChange={handlePickupInputChange}
      onToggleMap={handlePickupSelectionToggle}
      selectingOnMap={selectingPickup}
      hasMapPoint={Boolean(pickupPosition)}
      disabled={bookingLoading}
      hint={searchingLocation ? "جارٍ تحديد موقعك…" : ""}
      mapPointHint=""
      tone="green"
      inputRef={pickupInputRef}
      maxLength={255}
    />
  );
  const destinationField = (
    <div ref={destinationSectionRef}>
      <DestinationField
        keepHistory
        onSelectPlace={(place) => handleLocalPlaceSelection(place, false)}
        id="destination-input"
        label={destinationLabel}
        placeholder={isDelivery ? "موقعي الحالي أو عنوان آخر" : "أدخل عنوان الوجهة"}
        value={destination}
        onChange={handleDestinationInputChange}
        onToggleMap={handleDestinationSelectionToggle}
        selectingOnMap={selectingDestination}
        hasMapPoint={Boolean(destinationPosition)}
        mapPointHint=""
        disabled={bookingLoading}
        tone="orange"
        maxLength={255}
      />
    </div>
  );

  return (
    <section className="page couriers-page" dir="rtl">
      {locationError && !clientPosition && !requestedCourseId && (
        <div className="couriers-location-error" role="alert">
          <p>{locationError}</p>
          <button type="button" onClick={handleFindAroundMe} disabled={searchingLocation}>
            {searchingLocation ? "جارٍ تحديد الموقع…" : "إعادة المحاولة"}
          </button>
        </div>
      )}

      <div className="couriers-map-frame" hidden={!shouldShowMap}>
          <CouriersMap
            clientPosition={clientPosition}
            onRequestClientPosition={handleFindAroundMe}
            isLocating={searchingLocation}
            selectingDestination={selectingPickup || selectingDestination}
            destinationPosition={mapDestinationPosition}
            originPosition={mapOriginPosition}
            routeGeometry={priceQuote?.route_geometry}
            pickingPhase={selectingPickup ? pickupPickingPhase : destinationPickingPhase}
            pickLabel={selectingPickup ? pickupLabel : destinationLabel}
            onSelectDestination={(position) => {
              // Le clic carte alimente le champ actuellement en cours de choix :
              // départ ou destination, quel que soit le type de véhicule.
              if (selectingPickup) {
                pickupTouchedRef.current = true;
              } else {
                destinationTouchedRef.current = true;
              }
              selectPoint(position, selectingPickup);
              setPriceQuote(null);
              setProposedPrice("");
              setPriceCalculating(false);
              setBookingError("");
            }}
          />
      </div>

      {!requestedCourseId && (
        <section className="course-vehicle-section" aria-labelledby="course-vehicle-title">
          <h2 id="course-vehicle-title" className="couriers-step-title">اختر نوع المركبة</h2>
          <div className="vehicle-type-selector" role="group" aria-label="نوع المركبة">
            {/* Camion masqué temporairement ; sa définition et sa logique restent disponibles. */}
            {VEHICLE_TYPES.filter(({ value }) => value !== "camion").map(({ value, label, description, icon: Icon }) => (
              <button
                className={`vehicle-type-option ${selectedVehicle === value ? "selected" : ""}`}
                type="button"
                key={value}
                aria-pressed={selectedVehicle === value}
                disabled={!clientPosition || bookingLoading}
                onClick={() => handleVehicleChange(value)}
              >
                {value === "voiture" || value === "moto" ? (
                  <span className={`vehicle-choice-image is-${value}`} aria-hidden="true" />
                ) : <Icon size={28} aria-hidden="true" />}
                <span className="vehicle-choice-label">{label}</span>
                {description && <span className="vehicle-choice-description">{description}</span>}
                {selectedVehicle === value && <span className="vehicle-choice-check" aria-hidden="true">✓</span>}
              </button>
            ))}
          </div>
        </section>
      )}

      {!requestedCourseId && selectedVehicle && (isDelivery || showClientPoint) && pickupField}
      {!requestedCourseId && selectedVehicle && (!isDelivery || showClientPoint) && destinationField}

      {(requestedCourseId || priceCalculating || priceQuote || bookingError) && (
      <section className="course-request-panel" aria-labelledby="course-request-title">
        {!requestedCourseId && selectedVehicle && hasDestination && priceCalculating && (
          <div className="course-price-loading" role="status" aria-live="polite">
            <LoadingSpinner label="" size={34} />
            <strong style={{ fontSize: "13px" ,textAlign: "center"}}>جارٍ حساب السعر</strong>
          </div>
        )}

        {!requestedCourseId && priceQuote && !priceCalculating && (
          <div className="course-request-form">
            <div className="course-price-block">
              <span className="course-price-label">السعر المقترح</span>

              <span className="course-price-stepper" dir="ltr">
                <button
                  type="button"
                  aria-label="زيادة السعر"
                  title="زيادة السعر"
                  disabled={bookingLoading}
                  onClick={() => adjustProposedPrice(PRICE_ADJUSTMENT_DZD)}
                >
                  <Plus size={24} aria-hidden="true" />
                </button>
                <span className="course-price-field" dir="rtl">
                  <input
                    type="number"
                    value={proposedPrice}
                    onChange={(event) => setProposedPrice(event.target.value)}
                    min={MIN_COURSE_PRICE_DZD}
                    step="1"
                    required
                    aria-label="السعر المقترح بالدينار الجزائري"
                  />
                  <span aria-hidden="true">دج</span>
                </span>
                <button
                  type="button"
                  aria-label="خفض السعر"
                  title="خفض السعر"
                  disabled={bookingLoading || Number(proposedPrice) <= MIN_COURSE_PRICE_DZD}
                  onClick={() => adjustProposedPrice(-PRICE_ADJUSTMENT_DZD)}
                >
                  <Minus size={24} aria-hidden="true" />
                </button>
              </span>

              <span className="course-quote-distance">المسافة التقديرية: {priceQuote.estimated_distance_km} كم</span>

              {proposedPrice !== "" && Number(proposedPrice) < MIN_COURSE_PRICE_DZD && (
                <small className="course-price-error">الحد الأدنى للسعر هو {MIN_COURSE_PRICE_DZD} دج.</small>
              )}
            </div>

          </div>
        )}

        {bookingError && <p className="course-request-error" role="alert">{bookingError}</p>}

        {requestedCourseId && !requestedCourse && (
          <div className="course-progress-notice" role="status" aria-live="polite">
            <LoadingSpinner label="" size={28} />
            <strong>جارٍ استعادة حالة الرحلة</strong>
          </div>
        )}

        {requestedCourse && (
          <CourseTrackingPanel
            course={requestedCourse}
            onChooseDriver={handleSelectDriver}
            selectingDriverId={selectingDriverId}
            onCancel={handleCancelRequest}
            cancelling={cancellingCourse}
            onReviewSubmit={handleReviewSubmit}
            reviewAlreadySubmitted={reviewAlreadySubmitted}
            reviewRating={reviewRating}
            setReviewRating={setReviewRating}
            reviewMessage={reviewMessage}
            setReviewMessage={setReviewMessage}
            submittingReview={submittingReview}
            reviewError={reviewError}
            hasCalledDriver={calledDriverCourseId === String(requestedCourse.id)}
            onDriverCall={() => setCalledDriverCourseId(String(requestedCourse.id))}
            arrivalConfirmed={arrivalConfirmedCourseId === String(requestedCourse.id)}
            onConfirmArrival={() => setArrivalConfirmedCourseId(String(requestedCourse.id))}
            onNewRequest={() => {
              localStorage.removeItem("currentClientCourseId");
              setRequestedCourse(null);
              setRequestedCourseId(null);
            }}
          />
        )}

        {false && requestedCourse && (
          <div className="course-request-status course-tracking-status" aria-live="polite">
            <div className="course-status-heading" hidden>
              <h3>الطلب رقم {requestedCourse.id}</h3>
              <span className={`course-status-badge status-${requestedCourse.status}`}>
                {requestedCourse.status}
              </span>
            </div>

            <div className={`course-stage-card status-${requestedCourse.status}`} aria-live="polite">
              <strong>{requestedCourse.status === "searching" ? "جارٍ البحث عن سائق قريب" : "متابعة الرحلة"}</strong>
              <p>
                {requestedCourse.status === "searching"
                  ? "يتم إرسال طلبك إلى السائقين القريبين. سنعرض لك ردودهم هنا."
                  : requestedCourse.status === "driver_accepted"
                  ? "اختر السائق المناسب من القائمة للانتقال إلى تأكيد الرحلة."
                  : requestedCourse.status === "driver_selected"
                  ? "تم تأكيد السائق. افتح متابعة الرحلة لمعرفة آخر المستجدات."
                  : requestedCourse.status === "driver_arriving"
                  ? "السائق في طريقه إليك. يمكنك متابعة موقعه من صفحة الرحلة."
                  : requestedCourse.status === "driver_arrived"
                  ? "وصل السائق إلى نقطة الانطلاق. استعد لبدء الرحلة."
                  : requestedCourse.status === "in_progress"
                  ? "انطلقت الرحلة، والسائق في طريقه إلى وجهتك."
                  : requestedCourse.status === "completed"
                  ? "اكتملت الرحلة بنجاح."
                  : requestedCourse.status === "cancelled"
                  ? "تم إلغاء هذا الطلب."
                  : "تابع حالة الرحلة من هذه الصفحة."}
              </p>
            </div>

            <div className="course-details-banner" aria-label="معلومات إضافية عن الرحلة">
              <span>
                <b>المسافة</b>
                {requestedCourse.estimated_distance_km == null ? "قيد التقدير" : `${requestedCourse.estimated_distance_km} كم`}
              </span>
              <span>
                <b>المركبة</b>
                {VEHICLE_LABELS[requestedCourse.vehicle_type] || requestedCourse.vehicle_type || "غير محددة"}
              </span>
              <span>
                <b>السعر</b>
                {requestedCourse.final_price ?? requestedCourse.proposed_price} دج
                {Number(requestedCourse.surcharge_percent) > 0 && ` · زيادة ${requestedCourse.surcharge_percent}٪`}
              </span>
            </div>

            {requestedCourse.status === "searching" && !requestedCourse.accepted_drivers?.length && (
              <div className={`driver-wait-state ${responseSecondsLeft === 0 ? "driver-wait-expired" : ""}`} aria-live="polite">
                <LoadingSpinner label="" size={28} />
                <div>
                  {responseSecondsLeft > 0 ? (
                    <>
                      <h3>جارٍ البحث عن سائقين قريبين</h3>
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
                )) : null}
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
            {["completed", "cancelled"].includes(requestedCourse.status) && (
              <button
                className="course-request-submit"
                type="button"
                onClick={() => {
                  localStorage.removeItem("currentClientCourseId");
                  setRequestedCourse(null);
                  setRequestedCourseId(null);
                }}
              >
                طلب رحلة جديدة
              </button>
            )}
          </div>
        )}
      </section>
      )}

      {!requestedCourseId && selectedVehicle && (
        <button
          className="course-request-submit course-search-button"
          type="button"
          onClick={handleRequestCourse}
          disabled={!clientPosition || !hasPickup || !hasDestination || selectingPickup || selectingDestination
            || bookingLoading || priceCalculating || (proposedPrice !== "" && Number(proposedPrice) < MIN_COURSE_PRICE_DZD)}
        >
          {bookingLoading ? "جارٍ البحث…" : "بحث"}
        </button>
      )}

      </section>
  );
}
