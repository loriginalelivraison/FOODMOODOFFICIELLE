import React, { useMemo, useState, useEffect, useRef } from "react";
import { getLivreurs } from "../livreursapi.js";
import CourierCard from "../components/CourierCard.jsx";
import CouriersMap from "../components/CouriersMap.jsx";
import { Search } from "lucide-react";

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
  const [error, setError] = useState("");

  const [clientPosition, setClientPosition] = useState(null);
  const [locationDisabled, setLocationDisabled] = useState(false);
  const [locationEnabledMessage, setLocationEnabledMessage] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [searchingLocation, setSearchingLocation] = useState(false);

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
          rating: livreur.note,
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
  .filter((c) => c.distanceKm <= 30) // <-- Affiche uniquement les livreurs dans un rayon de 30 km
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
    setSearchingLocation(false);
    setLocationDisabled(true);
    setLocationEnabledMessage(false);
  }

  function handleFindAroundMe() {
    if (!navigator.geolocation) {
      setLocationDisabled(true);
      return;
    }

    setSearchingLocation(true);
    setLocationDisabled(false);
    setLocationEnabledMessage(false);

    navigator.geolocation.getCurrentPosition(
      handleLocationSuccess,
      handleLocationError,
      {
        enableHighAccuracy: true,
        maximumAge: 10000,
        timeout: 15000,
      }
    );
  }

  const vehicleLabels = {
    moto: "دراجة نارية",
    velo: "دراجة هوائية",
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

  return (
    <section className="page" dir="rtl">
      <div className="page-title">
        <center>
          <div className="around-me-top">
            <button
              type="button"
              className="primary-btn full"
              onClick={handleFindAroundMe}
              disabled={searchingLocation}
            >
              {searchingLocation
                ? "🔎 جاري البحث عن السائقين..."
                : "ابحث عن سائق بقربك"}
            </button>
          </div>
        </center>
      </div>

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

      {locationEnabledMessage && (
        <div
          style={{
            background: "#f0fdf4",
            border: "1px solid #bbf7d0",
            color: "#15803d",
            padding: "14px",
            borderRadius: "12px",
            marginBottom: "18px",
            fontWeight: "600",
            textAlign: "center",
          }}
        >
          ✅ موقعك الجغرافي مفعل وتم ترتيب السائقين حسب الأقرب إليك
        </div>
      )}

      <div className="toolbar compact-toolbar">
        <label className="search-box">
          <Search size={18} />

          <input
            value={query}
            onFocus={() => setShowFilters(true)}
            onChange={(e) => {
              setQuery(e.target.value);
              setShowFilters(true);
            }}
            placeholder="ابحث عن سائق"
            style={{
              width: "250px",
              background: "#fff7ed",
              border: "1px solid #f5bf99",
              color: "#1f2937",
            }}
          />
        </label>

        {showFilters && (
          <>
            <select
              className="filter-select"
              value={selectedVehicle}
              onChange={(e) => setSelectedVehicle(e.target.value)}
            >
              <option value="">كل وسائل النقل</option>
              {vehicleOptions.map((vehicle) => (
                <option key={vehicle} value={vehicle}>
                  {vehicleLabels[vehicle] || vehicle}
                </option>
              ))}
            </select>

            <select
              className="filter-select"
              value={selectedCity}
              onChange={(e) => setSelectedCity(e.target.value)}
            >
              <option value="">كل المناطق</option>
              {streets.map((street) => (
                <option key={street} value={street}>
                  {street}
                </option>
              ))}
            </select>

            <label className="toggle">
              <input
                type="checkbox"
                checked={onlyAvailable}
                onChange={(e) => setOnlyAvailable(e.target.checked)}
              />
              المتاحين فقط
            </label>
          </>
        )}
      </div>

      {loading && <p>Chargement des livreurs...</p>}
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
            height: "260px",
            borderRadius: "18px",
            overflow: "hidden",
          }}
        >
          <CouriersMap couriers={filtered} clientPosition={clientPosition} />
        </div>
      </div>

      {!loading && !error && (
        <p
          style={{
            textAlign: "center",
            margin: "15px 0",
            fontWeight: "600",
          }}
        >
          عدد السائقين : {filtered.length}
        </p>
      )}

      <div className="courier-grid">
        {filtered.map((courier) => (
          <CourierCard courier={courier} key={courier.id} />
        ))}
      </div>
    </section>
  );
}