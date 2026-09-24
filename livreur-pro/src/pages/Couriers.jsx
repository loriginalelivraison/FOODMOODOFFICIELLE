import React, { useMemo, useState, useEffect, useRef } from "react";
import { getLivreurs } from "../livreursapi.js";
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

  const hasShownLocationMessageRef = useRef(
    sessionStorage.getItem("clientLocationMessageShown") === "true"
  );

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
  const nearbyTitle =
    filtered.length > 0
      ? `${filtered.length} سائقًا بالقرب منك`
      : "لا يوجد سائقون بالقرب منك";

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
        <p>Aucun livreur disponible pour le moment.</p>
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
          />
        </div>
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

      <div
        style={{
          display: "flex",
          justifyContent: "center",
          marginBottom: "12px",
          padding: "0 2px",
        }}
      >
        <div
          style={{
            background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
            border: "1px solid #e5e7eb",
            borderRadius: "999px",
            padding: "8px 18px",
            fontWeight: 700,
            color: "#111827",
            fontSize: "13px",
            letterSpacing: "0.2px",
            boxShadow: "0 4px 12px rgba(15, 23, 42, 0.06)",
            textAlign: "center",
          }}
        >
          {nearbyTitle}
        </div>
      </div>

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