import React, { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Bike, CarFront, Minus, Plus, Truck } from "lucide-react";
import {
  createCourseRequest,
  cancelCourse,
  getCourse,
  getCourseQuote,
  getLivreurs,
  selectCourseDriver,
} from "../livreursapi.js";
import CourierCard from "../components/CourierCard.jsx";
import CouriersMap from "../components/CouriersMap.jsx";
import LoadingSpinner from "../components/LoadingSpinner.jsx";
import {
  getLocationErrorMessage,
  isIOSDevice,
  requestUserPosition,
} from "../utils/geolocation.js";

const MIN_COURSE_PRICE_DZD = 100;
const PRICE_ADJUSTMENT_DZD = 50;
const DRIVER_RESPONSE_WINDOW_SECONDS = 50;
const VEHICLE_TYPES = [
  { value: "moto", label: "دراجة نارية", icon: Bike },
  { value: "voiture", label: "سيارة", icon: CarFront },
  { value: "camion", label: "شاحنة", icon: Truck },
];
const COURSE_STATUS_LABELS = {
  searching: "جارٍ البحث عن سائق",
  driver_accepted: "بانتظار اختيار السائق",
  driver_selected: "تم تأكيد السائق",
  driver_arriving: "السائق في الطريق إليك",
  driver_arrived: "وصل السائق",
  in_progress: "الرحلة جارية",
  completed: "انتهت الرحلة",
  cancelled: "أُلغيت الرحلة",
};
const VEHICLE_LABELS = Object.fromEntries(VEHICLE_TYPES.map(({ value, label }) => [value, label]));

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

export default function Couriers() {
  const navigate = useNavigate();

  const [couriers, setCouriers] = useState([]);
  const [couriersLoading, setCouriersLoading] = useState(true);
  const [couriersError, setCouriersError] = useState("");
  const [visibleCourierCount, setVisibleCourierCount] = useState(12);
  const clientWatchRef = useRef(null);
  const autoLocationRequestedRef = useRef(false);
  const [clientPosition, setClientPosition] = useState(null);
  const [locationError, setLocationError] = useState("");
  const [searchingLocation, setSearchingLocation] = useState(false);
  const [destinationPosition, setDestinationPosition] = useState(null);
  const [destination, setDestination] = useState("");
  const [destinationConfirmed, setDestinationConfirmed] = useState(false);
  const [selectingDestination, setSelectingDestination] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [proposedPrice, setProposedPrice] = useState("");
  const [priceQuote, setPriceQuote] = useState(null);
  const [priceCalculating, setPriceCalculating] = useState(false);
  const [quoteRequestActive, setQuoteRequestActive] = useState(false);
  const priceFormRef = useRef(null);
  const [quoteRevision, setQuoteRevision] = useState(0);
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
  const hasDestination = Boolean(destinationPosition || destination.trim());
  const mapDestinationPosition = priceQuote
    ? {
        latitude: priceQuote.destination_latitude,
        longitude: priceQuote.destination_longitude,
      }
    : destinationPosition;
  const shouldShowMap = !requestedCourseId;

  function adjustProposedPrice(amount) {
    setProposedPrice((currentValue) => {
      const currentPrice = Number(currentValue || priceQuote?.proposed_price || MIN_COURSE_PRICE_DZD);
      return String(Math.max(MIN_COURSE_PRICE_DZD, currentPrice + amount));
    });
  }

  useEffect(() => {
    if (!clientPosition || !selectedVehicle || !hasDestination || !destinationConfirmed || requestedCourseId) {
      setPriceQuote(null);
      setProposedPrice("");
      setPriceCalculating(false);
      setQuoteRequestActive(false);
      return undefined;
    }

    let cancelled = false;
    setPriceQuote(null);
    setProposedPrice("");
    setPriceCalculating(true);
    setQuoteRequestActive(false);
    setBookingError("");

    const timeout = setTimeout(async () => {
      if (cancelled) return;
      setQuoteRequestActive(true);
      try {
        const quote = await getCourseQuote({
          destination: destination.trim(),
          ...(destinationPosition && {
            destination_latitude: destinationPosition.latitude,
            destination_longitude: destinationPosition.longitude,
          }),
          client_latitude: clientPosition.latitude,
          client_longitude: clientPosition.longitude,
        });
        if (cancelled) return;
        setPriceQuote(quote);
        setProposedPrice(String(quote.proposed_price));
      } catch (error) {
        if (!cancelled) setBookingError(error.message || "تعذر حساب سعر الرحلة.");
      } finally {
        if (!cancelled) {
          setPriceCalculating(false);
          setQuoteRequestActive(false);
        }
      }
    }, destinationPosition ? 0 : 500);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [clientPosition, destination, destinationConfirmed, destinationPosition, hasDestination, quoteRevision, requestedCourseId, selectedVehicle]);

  useEffect(() => {
    if (!priceQuote) return undefined;

    const frame = requestAnimationFrame(() => {
      priceFormRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    return () => cancelAnimationFrame(frame);
  }, [priceQuote]);

  useEffect(() => {
    let cancelled = false;

    async function loadCouriers() {
      try {
        const data = await getLivreurs();
        const livreurList = Array.isArray(data) ? data : data.results || [];
        if (cancelled) return;

        setCouriers(livreurList.map((livreur) => ({
          id: livreur.id,
          name: livreur.nom,
          city: livreur.ville,
          vehicle: livreur.vehicule === "scooter" ? "moto" : livreur.vehicule,
          available: Boolean(livreur.disponible),
          rating: livreur.note ?? null,
          deliveries: livreur.nombre_livraisons,
          latitude: livreur.latitude == null ? null : Number(livreur.latitude),
          longitude: livreur.longitude == null ? null : Number(livreur.longitude),
          phone: livreur.telephone,
          photo: livreur.photo,
        })));
        setCouriersError("");
      } catch (err) {
        if (!cancelled) setCouriersError(err.message || "تعذر تحميل السائقين.");
      } finally {
        if (!cancelled) setCouriersLoading(false);
      }
    }

    loadCouriers();
    const interval = setInterval(loadCouriers, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const nearbyCouriers = useMemo(() => {
    let availableCouriers = couriers.filter((courier) => courier.available);
    if (!clientPosition) return availableCouriers;

    availableCouriers = availableCouriers
      .filter((courier) => courier.latitude != null && courier.longitude != null)
      .map((courier) => ({
        ...courier,
        distanceKm: getDistanceKm(
          clientPosition.latitude,
          clientPosition.longitude,
          courier.latitude,
          courier.longitude
        ),
      }))
      .filter((courier) => courier.distanceKm <= 40)
      .sort((first, second) => first.distanceKm - second.distanceKm);

    return availableCouriers;
  }, [couriers, clientPosition]);
  const matchingCouriers = selectedVehicle
    ? nearbyCouriers.filter((courier) => courier.vehicle === selectedVehicle)
    : nearbyCouriers;
  const visibleCouriers = matchingCouriers.slice(0, visibleCourierCount);

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
    if (!clientPosition || !selectedVehicle || !priceQuote || priceCalculating) {
      setBookingError("يرجى تفعيل موقعك وانتظار اكتمال حساب السعر.");
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
        destination: priceQuote.destination || destination.trim(),
        destination_latitude: priceQuote.destination_latitude,
        destination_longitude: priceQuote.destination_longitude,
        proposed_price: Number(proposedPrice),
        client_latitude: position.coords.latitude,
        client_longitude: position.coords.longitude,
        vehicle_type: selectedVehicle,
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

  function handleDestinationSelectionToggle() {
    const nextSelecting = !selectingDestination;
    setSelectingDestination(nextSelecting);
    if (nextSelecting && !clientPosition) handleFindAroundMe();
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

      {shouldShowMap && <div className="couriers-map-frame">
          <CouriersMap
            couriers={matchingCouriers}
            clientPosition={clientPosition}
            onRequestClientPosition={handleFindAroundMe}
            isLocating={searchingLocation}
            selectingDestination={selectingDestination}
            destinationPosition={mapDestinationPosition}
            routeGeometry={priceQuote?.route_geometry}
            onSelectDestination={(position) => {
              setDestinationPosition(position);
              setDestination("");
              setDestinationConfirmed(false);
              setSelectingDestination(false);
              setPriceQuote(null);
              setProposedPrice("");
              setPriceCalculating(false);
              setBookingError("");
            }}
          />
      </div>}

      {!requestedCourseId && !quoteRequestActive && (
        <section className="course-vehicle-section" aria-labelledby="course-vehicle-title">
          <h2 id="course-vehicle-title" style={{ fontSize: "13px" ,textAlign: "center"}} >اختر نوع المركبة</h2>
          <div className="vehicle-type-selector" role="group" aria-label="نوع المركبة">
            {VEHICLE_TYPES.map(({ value, label, icon: Icon }) => (
              <button
                className={`vehicle-type-option ${selectedVehicle === value ? "selected" : ""}`}
                type="button"
                key={value}
                aria-pressed={selectedVehicle === value}
                disabled={!clientPosition}
                onClick={() => setSelectedVehicle(value)}
              >
                <Icon size={23} aria-hidden="true" />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {!requestedCourseId && selectedVehicle && !quoteRequestActive && !destinationPosition && (
        
        <h2 style={{ fontSize: "13px" ,textAlign: "center"}}>
          أدخل وجهتك في الحقل أو اخترها من الخريطة
        </h2>
      )}

      {!requestedCourseId && selectedVehicle && !quoteRequestActive && <div className={`destination-picker-controls ${destinationPosition ? "destination-only" : ""}`} dir="rtl">
        {!destinationPosition && (
          <label className="destination-text-field">
            <input
              type="text"
              value={destination}
              onChange={(event) => {
                setDestination(event.target.value);
                setDestinationPosition(null);
                setDestinationConfirmed(false);
                setSelectingDestination(false);
                setPriceQuote(null);
                setProposedPrice("");
                setPriceCalculating(false);
              }}
              placeholder="الوجهة أو العنوان"
              aria-label=" الوجهة أو العنوان"
              maxLength={255}
              disabled={!clientPosition}
            />
          </label>
        )}
        <button
          type="button"
          className={selectingDestination ? "destination-picker-active" : ""}
          onClick={handleDestinationSelectionToggle}
          disabled={!clientPosition}
        >
          {selectingDestination
            ? "إنهاء التحديد"
            : destinationPosition
            ? "تغيير الوجهة على الخريطة"
            : "اختيار من الخريطة"}
        </button>
      </div>}

      {!requestedCourseId && selectedVehicle && !quoteRequestActive && hasDestination && !destinationConfirmed && (
        <button
          className="destination-confirm-button"
          type="button"
          disabled={!clientPosition}
          onClick={() => {
            setBookingError("");
            setDestinationConfirmed(true);
          }}
        >
          تأكيد الوجهة
        </button>
      )}

      {(requestedCourseId || priceCalculating || priceQuote || bookingError) && (
      <section className="course-request-panel" aria-labelledby="course-request-title">
        {!requestedCourseId && selectedVehicle && hasDestination && priceCalculating && (
          <div className="course-price-loading" role="status" aria-live="polite">
            <LoadingSpinner label="" size={34} />
            <strong style={{ fontSize: "13px" ,textAlign: "center"}}>جارٍ حساب السعر</strong>
          </div>
        )}

        {!requestedCourseId && priceQuote && !priceCalculating && (
          <form ref={priceFormRef} className="course-request-form" onSubmit={handleRequestCourse}>
            <label>
              السعر المقترح (دج)
              <span className="course-price-stepper" dir="ltr">
                <button
                  type="button"
                  aria-label="زيادة السعر"
                  title="زيادة السعر"
                  disabled={bookingLoading}
                  onClick={() => adjustProposedPrice(PRICE_ADJUSTMENT_DZD)}
                >
                  <Plus size={17} aria-hidden="true" />
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
                  <Minus size={17} aria-hidden="true" />
                </button>
              </span>
              <span className="course-quote-distance">المسافة التقديرية: {priceQuote.estimated_distance_km} كم</span>
              {proposedPrice !== "" && Number(proposedPrice) < MIN_COURSE_PRICE_DZD && (
                <small className="course-price-error">الحد الأدنى للسعر هو {MIN_COURSE_PRICE_DZD} دج.</small>
              )}
            </label>
            <button
              className="course-request-submit"
              type="submit"
              disabled={bookingLoading || !clientPosition || priceCalculating || Number(proposedPrice) < MIN_COURSE_PRICE_DZD}
            >
              {bookingLoading ? "جارٍ إرسال الطلب…" : "ابحث عن سائق"}
            </button>
          </form>
        )}
        {!requestedCourseId && !priceCalculating && hasDestination && !priceQuote && bookingError && (
          <button className="course-quote-retry" type="button" onClick={() => setQuoteRevision((revision) => revision + 1)}>
            إعادة حساب السعر
          </button>
        )}

        {bookingError && <p className="course-request-error" role="alert">{bookingError}</p>}

        {requestedCourseId && !requestedCourse && (
          <div className="course-progress-notice" role="status" aria-live="polite">
            <LoadingSpinner label="" size={28} />
            <strong>جارٍ استعادة حالة الرحلة</strong>
          </div>
        )}

        {requestedCourse && (
          <div className="course-request-status" aria-live="polite">
            <div className="course-status-heading">
              <h3>الطلب رقم {requestedCourse.id}</h3>
              <span className={`course-status-badge status-${requestedCourse.status}`}>
                {COURSE_STATUS_LABELS[requestedCourse.status] || requestedCourse.status}
              </span>
            </div>

            <div className={`course-stage-card status-${requestedCourse.status}`} aria-live="polite">
              <strong>{COURSE_STATUS_LABELS[requestedCourse.status] || "تحديث حالة الرحلة"}</strong>
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

      {!requestedCourseId && !hasDestination && <section className="nearby-couriers" aria-labelledby="nearby-couriers-title">
        <h2 id="nearby-couriers-title" style={{ textAlign: "center"}}>السائقون المتاحون حولك</h2>
        {couriersLoading && <LoadingSpinner label="جاري تحميل السائقين..." />}
        {couriersError && <p className="course-request-error" role="alert">{couriersError}</p>}
        {!couriersLoading && !couriersError && matchingCouriers.length === 0 && (
          <p className="nearby-couriers-empty">لا يوجد سائقون متاحون بالقرب منك حالياً.</p>
        )}
        <div className="courier-grid">
          {visibleCouriers.map((courier) => (
            <CourierCard courier={courier} key={courier.id} />
          ))}
        </div>
        {matchingCouriers.length > visibleCourierCount && (
          <button
            className="course-request-submit nearby-couriers-more"
            type="button"
            onClick={() => setVisibleCourierCount((count) => count + 12)}
          >
            المزيد
          </button>
        )}
      </section>}

    </section>
  );
}