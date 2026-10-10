import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  createCourseRequest,
  getCourseAddress,
  getCourseQuote,
} from "../livreursapi.js";
import CouriersMap from "../components/CouriersMap.jsx";
import BookingSummary from "../components/BookingSummary.jsx";
import { MY_LOCATION_LABEL } from "../components/DepartureField.jsx";
import DestinationField from "../components/DestinationField.jsx";
import { destinationCoordinates, suggestedDeliveryPickups, suggestedDestinations } from "../utils/destinationSearch.js";
import LoadingSpinner from "../components/LoadingSpinner.jsx";
import { clearCurrentClientCourse, isValidId } from "../utils/navigation.js";
import { isDeliveryVehicle } from "../utils/courseTracking.js";
import { adjustCoursePrice, MIN_COURSE_PRICE_DZD, PRICE_ADJUSTMENT_DZD } from "../utils/priceAdjustment.js";
import {
  getLocationErrorMessage,
  isIOSDevice,
  requestUserPosition,
} from "../utils/geolocation.js";
import {
  scrollToPageTopWhenReady,
  scrollToSection,
} from "../utils/scroll.js";

const VEHICLE_TYPES = [
  { value: "moto", label: "موصّل" },
  { value: "voiture", label: "سيارة" },
];
function hasCoordinates(latitude, longitude) {
  return latitude !== null && latitude !== undefined
    && longitude !== null && longitude !== undefined
    && Number.isFinite(Number(latitude)) && Number.isFinite(Number(longitude));
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
      vehicle_type: selectedVehicle,
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
    setProposedPrice((currentValue) => adjustCoursePrice(currentValue, priceQuote?.proposed_price, amount));
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
    if (requestedCourseId && !isValidId(requestedCourseId)) {
      clearCurrentClientCourse(requestedCourseId);
      setRequestedCourseId(null);
    } else if (requestedCourseId) {
      navigate(`/course/${requestedCourseId}`, { replace: true });
    }
  }, [navigate, requestedCourseId]);

  async function handleRequestCourse(event) {
    event.preventDefault();
    if (bookingInFlightRef.current) return;
    setBookingError("");

    if (localStorage.getItem("access") && localStorage.getItem("role") !== "client") {
      setBookingError("يلزم حساب عميل لطلب رحلة. سجّل الدخول بحساب عميل.");
      return;
    }
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
      setRequestedCourseId(course.id);
      navigate(`/course/${course.id}`);
      setDestinationPosition(null);
      setDestination("");
      setSelectingDestination(false);
      setPickupPosition(null);
      setPickup("");
      setSelectingPickup(false);
    } catch (err) {
      if (err.status === 409 && isValidId(err.courseId)) {
        localStorage.setItem("currentClientCourseId", String(err.courseId));
        sessionStorage.removeItem("pendingCourseRequestKey");
        setRequestedCourseId(err.courseId);
        navigate(`/course/${err.courseId}`, { replace: true });
        return;
      }
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
    console.error("Erreur GPS client :", {
      code: error.code,
      message: error.message,
      origin: window.location.origin,
      secureContext: window.isSecureContext,
    });
    const isIOS = isIOSDevice();
    const message = getLocationErrorMessage(error, isIOS);

    setSearchingLocation(false);
    setLocationError(message);
  }

  async function handleFindAroundMe({ watch = true } = {}) {
    if (!navigator.geolocation) {
      setLocationError("الموقع الجغرافي غير مدعوم في هذا المتصفح.");
      return;
    }

    if (clientWatchRef.current !== null) {
      navigator.geolocation.clearWatch(clientWatchRef.current);
      clientWatchRef.current = null;
    }

    setSearchingLocation(true);
    setLocationError("");

    try {
      const initialPosition = await requestUserPosition({
        enableHighAccuracy: true,
        maximumAge: 10000,
        timeout: 20000,
        retryWithLowAccuracy: true,
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
      suggestedPlaces={isDelivery ? suggestedDeliveryPickups : []}
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
        suggestedPlaces={isDelivery ? [] : suggestedDestinations}
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
            {VEHICLE_TYPES.map(({ value, label }) => (
              <button
                className={`vehicle-type-option ${selectedVehicle === value ? "selected" : ""}`}
                type="button"
                key={value}
                aria-pressed={selectedVehicle === value}
                disabled={!clientPosition || bookingLoading}
                onClick={() => handleVehicleChange(value)}
              >
                <span className={`vehicle-choice-image is-${value}`} aria-hidden="true" />
                <span className="vehicle-choice-label">{label}</span>
                {selectedVehicle === value && <span className="vehicle-choice-check" aria-hidden="true">✓</span>}
              </button>
            ))}
          </div>
        </section>
      )}

      {!requestedCourseId && selectedVehicle && (isDelivery || showClientPoint) && pickupField}
      {!requestedCourseId && selectedVehicle && (!isDelivery || showClientPoint) && destinationField}

      {(requestedCourseId || priceCalculating || priceQuote || bookingError) && (
      <section className={`course-request-panel${!requestedCourseId && priceQuote && !priceCalculating ? " has-booking-summary" : ""}`} aria-label="تفاصيل الرحلة">
        {!requestedCourseId && selectedVehicle && hasDestination && priceCalculating && (
          <div className="course-price-loading" role="status" aria-live="polite">
            <LoadingSpinner label="" size={34} />
            <strong style={{ fontSize: "13px" ,textAlign: "center"}}>جارٍ حساب السعر</strong>
          </div>
        )}

        {!requestedCourseId && priceQuote && !priceCalculating && (
          <BookingSummary
            quote={priceQuote}
            pickup={pickup.trim() || MY_LOCATION_LABEL}
            destination={priceQuote.destination || destination}
            isDelivery={isDelivery}
            price={proposedPrice}
            onPriceChange={setProposedPrice}
            onAdjustPrice={adjustProposedPrice}
            minPrice={MIN_COURSE_PRICE_DZD}
            priceStep={PRICE_ADJUSTMENT_DZD}
            busy={bookingLoading}
          />
        )}

        {bookingError && <p className="course-request-error" role="alert"
          data-error-for={proposedPrice !== "" && Number(proposedPrice) < MIN_COURSE_PRICE_DZD ? "booking-price" : !destinationPosition ? "destination-input" : !pickupPosition ? "departure-input" : undefined}>{bookingError}</p>}

        {requestedCourseId && (
          <div className="course-progress-notice" role="status" aria-live="polite">
            <LoadingSpinner label="" size={28} />
            <strong>جارٍ استعادة حالة الرحلة</strong>
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
