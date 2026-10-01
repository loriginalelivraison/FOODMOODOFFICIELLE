import React, { useMemo, useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  createCourseRequest,
  cancelCourse,
  getCourse,
  getLivreurs,
  selectCourseDriver,
} from "../livreursapi.js";
import CourierCard from "../components/CourierCard.jsx";
import CouriersMap from "../components/CouriersMap.jsx";
import LoadingSpinner from "../components/LoadingSpinner.jsx";
import {
  getLocationErrorMessage,
  isIOSDevice,
  openLocationSettings,
  requestUserPosition,
} from "../utils/geolocation.js";

const LOCATION_CONSENT_KEY = "clientLocationConsent";
const MIN_COURSE_PRICE_DZD = 100;
const DRIVER_RESPONSE_WINDOW_SECONDS = 50;

function getDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

export default function Couriers() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [onlyAvailable, setOnlyAvailable] = useState(true);
  const [selectedVehicle, setSelectedVehicle] = useState("");
  const [selectedCity, setSelectedCity] = useState("");
  const [couriers, setCouriers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchLoading, setSearchLoading] = useState(false);
  const [error, setError] = useState("");
  const [visibleCount, setVisibleCount] = useState(12);

  const clientWatchRef = useRef(null);
  const [clientPosition, setClientPosition] = useState(null);
  const [locationDisabled, setLocationDisabled] = useState(false);
  const [locationEnabledMessage, setLocationEnabledMessage] = useState(false);
  const [locationSettingsMessage, setLocationSettingsMessage] = useState("");
  const [showLocationSettingsButton, setShowLocationSettingsButton] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [searchingLocation, setSearchingLocation] = useState(false);
  const [locationConsent, setLocationConsent] = useState(() => {
    const saved = localStorage.getItem(LOCATION_CONSENT_KEY);
    return saved === null ? true : saved === "true";
  });
  const [destination, setDestination] = useState("");
  const [destinationPosition, setDestinationPosition] = useState(null);
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

  const hasShownLocationMessageRef = useRef(
    sessionStorage.getItem("clientLocationMessageShown") === "true"
  );

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
    if (!destination.trim() && !destinationPosition) {
      setBookingError("يرجى إدخال الوجهة.");
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
        destination: destinationPosition ? "" : destination.trim(),
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

  useEffect(() => {
    async function loadLivreurs() {
      try {
        const data = await getLivreurs();
        const livreurs = Array.isArray(data) ? data : data.results || [];

        const formattedCouriers = livreurs.map((livreur) => ({
          id: livreur.id,
          name: livreur.nom,
          city: livreur.ville,
          zone: livreur.ville,
          vehicle: livreur.vehicule === "scooter" ? "moto" : livreur.vehicule,
          available: Boolean(livreur.disponible),
          rating: livreur.note ?? null,
          deliveries: livreur.nombre_livraisons,
          latitude: livreur.latitude ? Number(livreur.latitude) : null,
          longitude: livreur.longitude ? Number(livreur.longitude) : null,
          phone: livreur.telephone,
          photo: livreur.photo,
          skills: ["Livraison rapide"],
        }));

        setCouriers(formattedCouriers);
        setLoading(false);
      } catch (err) {
        setError(err.message);
        setLoading(false);
      }
    }

    loadLivreurs();
    const interval = setInterval(loadLivreurs, 5000);

    return () => clearInterval(interval);
  }, []);

  const allowedVehicles = ["moto", "velo", "voiture", "camion"];

  const vehicleOptions = useMemo(() => {
    return [
      ...new Set(
        couriers
          .map((c) => c.vehicle)
          .filter((vehicle) => allowedVehicles.includes(vehicle))
      ),
    ];
  }, [couriers]);

  useEffect(() => {
    if (!query && !onlyAvailable && !selectedVehicle && !selectedCity) {
      setSearchLoading(false);
      return;
    }

    setSearchLoading(true);
    const timer = setTimeout(() => setSearchLoading(false), 250);

    return () => clearTimeout(timer);
  }, [query, onlyAvailable, selectedVehicle, selectedCity]);

  const filtered = useMemo(() => {
    let list = couriers.filter((c) => {
      const searchText =
        `${c.name} ${c.city} ${c.zone} ${c.vehicle} ${c.skills.join(" ")}`.toLowerCase();

      return (
        searchText.includes(query.toLowerCase()) &&
        (!onlyAvailable || c.available === true) &&
        (!selectedVehicle || c.vehicle === selectedVehicle) &&
        (!selectedCity || c.city === selectedCity)
      );
    });

    if (clientPosition) {
      list = list
        .filter((c) => c.latitude !== null && c.longitude !== null)
        .map((c) => ({
          ...c,
          distanceKm: getDistanceKm(
            clientPosition.latitude,
            clientPosition.longitude,
            c.latitude,
            c.longitude
          ),
        }))
        .filter((c) => c.distanceKm <= 40)
        .sort((a, b) => a.distanceKm - b.distanceKm);
    }

    return list;
  }, [
    query,
    onlyAvailable,
    selectedVehicle,
    selectedCity,
    couriers,
    clientPosition,
  ]);

  function handleLocationSuccess(pos) {
    const position = {
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
    };

    setClientPosition(position);
    setLocationDisabled(false);
    setSearchingLocation(false);
    setLocationSettingsMessage("");
    setShowLocationSettingsButton(false);

    if (!hasShownLocationMessageRef.current) {
      hasShownLocationMessageRef.current = true;
      sessionStorage.setItem("clientLocationMessageShown", "true");

      setLocationEnabledMessage(true);

      setTimeout(() => {
        setLocationEnabledMessage(false);
      }, 3000);
    }
  }

  function handleLocationError(error) {
    console.error("Erreur GPS client :", error);
    const isIOS = isIOSDevice();
    const message = getLocationErrorMessage(error, isIOS);

    setSearchingLocation(false);
    setLocationDisabled(true);
    setLocationEnabledMessage(false);
    setLocationSettingsMessage(message);
    setShowLocationSettingsButton(error.code === 1 && isIOS);
  }

  async function handleFindAroundMe(forceConsent = null) {
    const consentEnabled = forceConsent ?? locationConsent;

    if (!consentEnabled) {
      setLocationDisabled(true);
      setLocationEnabledMessage(false);
      setSearchingLocation(false);
      return;
    }

    if (!navigator.geolocation) {
      setLocationDisabled(true);
      return;
    }

    if (clientWatchRef.current !== null) {
      navigator.geolocation.clearWatch(clientWatchRef.current);
    }

    setSearchingLocation(true);
    setLocationDisabled(false);
    setLocationEnabledMessage(false);
    setLocationSettingsMessage("");
    setShowLocationSettingsButton(false);

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

  function handleLocationConsentChange() {
    const nextConsent = !locationConsent;
    setLocationConsent(nextConsent);
    localStorage.setItem(LOCATION_CONSENT_KEY, String(nextConsent));

    if (clientWatchRef.current !== null) {
      navigator.geolocation.clearWatch(clientWatchRef.current);
      clientWatchRef.current = null;
    }

    if (!nextConsent) {
      setClientPosition(null);
      setLocationDisabled(false);
    }
  }

  useEffect(() => {
    localStorage.setItem(LOCATION_CONSENT_KEY, "true");
    setLocationConsent(true);
    handleFindAroundMe(true);
  }, []);

  useEffect(() => {
    return () => {
      if (clientWatchRef.current !== null) {
        navigator.geolocation.clearWatch(clientWatchRef.current);
      }
    };
  }, []);

  const vehicleLabels = {
    moto: "دراجة نارية",
    scooter: "دراجة نارية",
    velo: "دراجة",
    voiture: "سيارة",
    camion: "شاحنة",
  };

  const streets = [
    "الجزائر العاصمة",
  "وهران",
  "مستغانم",
  "قسنطينة",
  "عنابة",
  "البليدة",
  "سطيف",
  "تيزي وزو",
  "بجاية",
  "سكيكدة",
  "الشلف",
  "تلمسان",
  "تيبازة",
  "بومرداس",
  "باتنة",
  "الجلفة",
  "بسكرة",
  "ورقلة",
  "الأغواط",
  "غرداية",
  "الوادي",
  "معسكر",
  "سيدي بلعباس",
  "المدية",
  "عين الدفلى",
  "برج بوعريريج",
  "ميلة",
  "جيجل",
  "قالمة",
  "سوق أهراس",
  "الطارف",
  "خنشلة",
  "تبسة",
  "البيض",
  "النعامة",
  "عين تموشنت",
  "تيسمسيلت",
  "غليزان",
  "أدرار",
  "تمنراست",
  "إليزي",
  "تندوف",
  "بشار",
  "المنيعة",
  "عين صالح",
  "عين قزام",
  "تقرت",
  "المغير",
  "أولاد جلال",
  "برج باجي مختار",
  "بني عباس",
  "إن صالح",
  "إن قزام",
  "جانت",
  ];

  const hasNearbyResults = Boolean(clientPosition) && filtered.length > 0;
  const visibleCouriers = filtered.slice(0, visibleCount);
  const hasMoreCouriers = filtered.length > visibleCount;

  useEffect(() => {
    setVisibleCount(12);
  }, [query, onlyAvailable, selectedVehicle, selectedCity, clientPosition]);

  return (
    <section className="page" dir="rtl">
      {locationDisabled && !clientPosition && (
        <div
          style={{
            background: "#fef2f2",
            border: "1px solid #fecaca",
            color: "#b91c1c",
            padding: "14px",
            borderRadius: "12px",
            marginBottom: "18px",
            fontWeight: "600",
            textAlign: "center",
          }}
        >
          ⚠️ يرجى تفعيل الموقع الجغرافي لرؤية السائقين القريبين منك
        </div>
      )}

     
      <div style={{ display: "none" }} aria-hidden="true" />

     

      {(loading || searchLoading) && <LoadingSpinner label={loading ? "جاري تحميل قائمة السائقين..." : "جاري البحث..."} />}
      {error && <p style={{ color: "red" }}>{error}</p>}

      {!loading && !error && filtered.length === 0 && (
        <p>لا يوجد سائقون متاحون حالياً.</p>
      )}

      <div
        style={{
          background: "#fff7ed",
          border: "2px solid #f5bf99",
          borderRadius: "24px",
          padding: "10px",
          margin: "12px 0 20px",
          boxShadow: "0 8px 24px rgba(249,115,22,0.12)",
        }}
      >
        <div
          style={{
            height: "200px",
            borderRadius: "22px",
            overflow: "hidden",
            border: "1px solid rgba(245, 133, 50, 0.25)",
          }}
        >
          <CouriersMap
            couriers={filtered}
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
      </div>

      <div className="destination-picker-controls" dir="rtl">
        <p>
          {selectingDestination
            ? destinationPosition
              ? "تم تحديد الوجهة على الخريطة. اضغط لتغيير الموقع."
              : "اضغط على الخريطة لتحديد وجهتك."
            : destinationPosition
            ? "تم اختيار الوجهة من الخريطة."
            : "يمكنك كتابة الوجهة أو اختيارها من الخريطة."}
        </p>
        <button
          type="button"
          className={selectingDestination ? "destination-picker-active" : ""}
          onClick={() => setSelectingDestination((active) => !active)}
        >
          {selectingDestination ? "إنهاء تحديد الوجهة" : "تحديد الوجهة على الخريطة"}
        </button>
        {destinationPosition && (
          <button
            type="button"
            className="destination-picker-clear"
            onClick={() => setDestinationPosition(null)}
          >
            مسح الموقع
          </button>
        )}
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "12px",
          marginTop: "6px",
          marginBottom: "10px",
          padding: "0 2px",
          width: "100%",
        }}
      >
        <span
          style={{
            fontWeight: "600",
            fontSize: "11px",
            lineHeight: 1.4,
            color: "#374151",
            textAlign: "center",
          }}
        >
          أوافق على استخدام بيانات الموقع الجغرافي
        </span>

        <button
          type="button"
          role="switch"
          aria-checked={locationConsent}
          onClick={handleLocationConsentChange}
          style={{
            width: "50px",
            height: "28px",
            borderRadius: "30px",
            border: "none",
            padding: "3px",
            cursor: "pointer",
            backgroundColor: locationConsent ? "#8BCF35" : "#d1d5db",
            transition: "background-color 0.25s ease",
            position: "relative",
            flexShrink: 0,
            boxShadow: "0 4px 12px rgba(139, 207, 53, 0.18)",
          }}
        >
          <span
            style={{
              position: "absolute",
              top: "3px",
              left: locationConsent ? "25px" : "3px",
              width: "22px",
              height: "22px",
              borderRadius: "50%",
              backgroundColor: "#ffffff",
              boxShadow: "0 1px 4px rgba(0,0,0,0.25)",
              transition: "left 0.25s ease",
            }}
          />
        </button>
      </div>

      <section className="course-request-panel" aria-labelledby="course-request-title">
        <div className="course-request-heading">
          <div>
            <h2 id="course-request-title">اطلب رحلة</h2>
          </div>
          <span className={`gps-status ${clientPosition ? "gps-ready" : "gps-waiting"}`}>
            <span aria-hidden="true" />
            {searchingLocation
              ? "جارٍ تحديد الموقع…"
              : clientPosition
              ? "تم تحديد موقعك تلقائياً"
              : "بانتظار تحديد موقعك"}
          </span>
        </div>

        <form className="course-request-form" onSubmit={handleRequestCourse}>
          <label>
            الوجهة
            <input
              type="text"
              value={destination}
              onChange={(event) => setDestination(event.target.value)}
              placeholder="أدخل وجهتك"
              maxLength={255}
              required={!destinationPosition}
              disabled={Boolean(destinationPosition)}
            />
          </label>
          <label>
            السعر المقترح <span>(دج)</span>
            <input
              type="number"
              value={proposedPrice}
              onChange={(event) => setProposedPrice(event.target.value)}
              placeholder={`الحد الأدنى ${MIN_COURSE_PRICE_DZD}`}
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
            disabled={bookingLoading || Number(proposedPrice) < MIN_COURSE_PRICE_DZD}
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
                <span className="driver-wait-indicator" aria-hidden="true" />
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

      <div className="courier-grid" style={{ marginTop: "18px" }}>
        {visibleCouriers.map((courier) => (
          <CourierCard courier={courier} key={courier.id} />
        ))}
      </div>

      {hasMoreCouriers && (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            marginTop: "18px",
            marginBottom: "12px",
          }}
        >
          <button
            type="button"
            onClick={() => setVisibleCount((count) => count + 12)}
            style={{
              background: "linear-gradient(135deg, #f59e0b, #f97316)",
              color: "#fff",
              border: "none",
              borderRadius: "999px",
              padding: "10px 20px",
              fontWeight: 700,
              fontSize: "13px",
              cursor: "pointer",
              boxShadow: "0 8px 18px rgba(249, 115, 22, 0.25)",
            }}
          >
            المزيد
          </button>
        </div>
      )}
    </section>
  );
}