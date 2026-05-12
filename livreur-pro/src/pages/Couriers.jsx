import React, { useMemo, useState, useEffect, useRef } from "react";
import { getLivreurs } from "../livreursapi.js";
import CourierCard from "../components/CourierCard.jsx";
import CouriersMap from "../components/CouriersMap.jsx";
import { Search } from "lucide-react";

export default function Couriers() {
  const [query, setQuery] = useState("");
  const [onlyAvailable, setOnlyAvailable] = useState(true);

  const [selectedVehicle, setSelectedVehicle] = useState("");
  const [selectedCity, setSelectedCity] = useState("");

  const [couriers, setCouriers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [viewMode, setViewMode] = useState("list");
  const [clientPosition, setClientPosition] = useState(null);

  const [locationDisabled, setLocationDisabled] = useState(false);
  const [locationEnabledMessage, setLocationEnabledMessage] = useState(false);

  const [showFilters, setShowFilters] = useState(false);

  const locationIntervalRef = useRef(null);

  const [searchingLocation, setSearchingLocation] = useState(false);

  useEffect(() => {
    getLivreurs()
      .then((data) => {
        const livreurs = Array.isArray(data) ? data : data.results || [];

        const formattedCouriers = livreurs.map((livreur) => ({
          id: livreur.id,
          name: livreur.nom,
          city: livreur.ville,
          zone: livreur.ville,
          vehicle: livreur.vehicule,
          available: Boolean(livreur.disponible),
          rating: livreur.note,
          deliveries: livreur.nombre_livraisons,
          latitude: livreur.latitude,
          longitude: livreur.longitude,
          phone: livreur.telephone,
          photo: livreur.photo,
          skills: ["Livraison rapide"],
        }));

        setCouriers(formattedCouriers);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    return () => {
      if (locationIntervalRef.current) {
        clearInterval(locationIntervalRef.current);
      }
    };
  }, []);

 const allowedVehicles = ["moto", "velo", "voiture", "camion"];

const vehicleOptions = useMemo(() => {
  return [
    ...new Set(
      couriers
        .map((c) => c.vehicle === "scooter" ? "moto" : c.vehicle)
        .filter((vehicle) => allowedVehicles.includes(vehicle))
    ),
  ];
}, [couriers]);

  const cityOptions = useMemo(() => {
    return [...new Set(couriers.map((c) => c.city).filter(Boolean))];
  }, [couriers]);

  const filtered = useMemo(() => {
    return couriers.filter((c) => {
      const searchText =
        `${c.name} ${c.city} ${c.zone} ${c.vehicle} ${c.skills.join(" ")}`.toLowerCase();

      return (
        searchText.includes(query.toLowerCase()) &&
        (!onlyAvailable || c.available === true) &&
        (!selectedVehicle || c.vehicle === selectedVehicle) &&
        (!selectedCity || c.city === selectedCity)
      );
    });
  }, [query, onlyAvailable, selectedVehicle, selectedCity, couriers]);

  function handleLocationSuccess(pos) {
  const position = {
    latitude: pos.coords.latitude,
    longitude: pos.coords.longitude,
  };

  setClientPosition(position);
  

  setLocationDisabled(false);
  setLocationEnabledMessage(true);
  setSearchingLocation(false);

  if (locationIntervalRef.current) {
    clearInterval(locationIntervalRef.current);
    locationIntervalRef.current = null;
  }

  setTimeout(() => {
    setLocationEnabledMessage(false);
  }, 3000);
}

function handleLocationError() {
  setSearchingLocation(false);
  setLocationDisabled(true);
  setLocationEnabledMessage(false);

  if (locationIntervalRef.current) return;

  locationIntervalRef.current = setInterval(() => {
    navigator.geolocation.getCurrentPosition(
      handleLocationSuccess,
      () => {
        setLocationDisabled(true);
        setSearchingLocation(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  }, 7000);
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
      timeout: 10000,
      maximumAge: 0,
    }
  );
}
  
    const vehicleLabels = {
  moto: "دراجة نارية",
  velo: "دراجة هوائية",
  voiture: "سيارة",
  camion: "شاحنة",
}
    const streets = ["كل مدينة مستغانم",
    "وسط المدينة",
    "خروبة",
    "صلامندر",
    "مزغران",
    "صيادة",
    "بوسكي",
    "دبدابة",
    "عشعاشة",
    "ستيدية",
    "النويصي",
    "ماسري"]
    
;


  

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
            {searchingLocation ? "🔎 جاري البحث عن السائقين..." : "⮚ السائقون حولي"}
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
          ✅ موقعك الجغرافي مفعل وتمت مشاركته بنجاح
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
  width: "300px"
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
    <CouriersMap
      couriers={filtered}
      clientPosition={clientPosition}
    />
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
