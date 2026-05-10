import React from "react";
import { useMemo, useState, useEffect } from "react";
import { getLivreurs } from "../livreursapi.js";
import CourierCard from "../components/CourierCard.jsx";
import CouriersMap from "../components/CouriersMap.jsx";
import { Search } from "lucide-react";

export default function Couriers() {
  const [query, setQuery] = useState("");
  const [onlyAvailable, setOnlyAvailable] = useState(true);

  // filtres compacts
  const [selectedVehicle, setSelectedVehicle] = useState("");
  const [selectedCity, setSelectedCity] = useState("");

  // données
  const [couriers, setCouriers] = useState([]);

  // états
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // affichage
  const [viewMode, setViewMode] = useState("list");

  // localisation client
  const [clientPosition, setClientPosition] = useState(null);
  const [locationError, setLocationError] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  // chargement livreurs
  useEffect(() => {
    getLivreurs()
      .then((data) => {
        const livreurs = Array.isArray(data)
          ? data
          : data.results || [];

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

  // options filtres
  const vehicleOptions = useMemo(() => {
    return [...new Set(couriers.map((c) => c.vehicle).filter(Boolean))];
  }, [couriers]);

  const cityOptions = useMemo(() => {
    return [...new Set(couriers.map((c) => c.city).filter(Boolean))];
  }, [couriers]);

  // filtrage
  const filtered = useMemo(() => {
    return couriers.filter((c) => {
      const searchText =
        `${c.name} ${c.city} ${c.zone} ${c.vehicle} ${c.skills.join(" ")}`
          .toLowerCase();

      const matchSearch = searchText.includes(query.toLowerCase());

      const matchAvailable =
        !onlyAvailable || c.available === true;

      const matchVehicle =
        !selectedVehicle ||
        c.vehicle === selectedVehicle;

      const matchCity =
        !selectedCity ||
        c.city === selectedCity;

      return (
        matchSearch &&
        matchAvailable &&
        matchVehicle &&
        matchCity
      );
    });
  }, [
    query,
    onlyAvailable,
    selectedVehicle,
    selectedCity,
    couriers,
  ]);

  // géolocalisation
  function handleFindAroundMe() {
    setLocationError("");

    if (!navigator.geolocation) {
      setLocationError("المتصفح لا يدعم تحديد الموقع");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const position = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        };

        setClientPosition(position);
        setViewMode("map");
      },
      () => {
        setLocationError(
          "📍يجب تفعيل الموقع لرؤية السائقين القريبين منك"
        );
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  }

  return (
    <section className="page" dir="rtl">
      {/* titre */}
      <div className="page-title">
        <center>
                  <div className="around-me-top">
          <button
            type="button"
            className="primary-btn full"
            onClick={handleFindAroundMe}
          >
            📍 السائقون حولي
          </button>

          {locationError && (
            <p style={{ color: "red", marginTop: "8px" }}>
              {locationError}
            </p>
          )}
        </div>
                 
        </center>
      </div>

      {/* barre outils */}
      <div className="toolbar compact-toolbar">
        {/* recherche */}
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
        />
        
        </label>

        {/* véhicule */}
{showFilters && (
  <>
    <select
      className="filter-select"
      value={selectedVehicle}
      onChange={(e) => setSelectedVehicle(e.target.value)}
    >
      <option value="">كل المركبات</option>
      {vehicleOptions.map((vehicle) => (
        <option key={vehicle} value={vehicle}>
          {vehicle}
        </option>
      ))}
    </select>

    <select
      className="filter-select"
      value={selectedCity}
      onChange={(e) => setSelectedCity(e.target.value)}
    >
      <option value="">كل المناطق</option>
      {cityOptions.map((city) => (
        <option key={city} value={city}>
          {city}
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

      {/* bouton autour de moi */}
      <div
        style={{
          textAlign: "center",
          margin: "15px 0",
        }}
      >
        
        {locationError && (
          <p
            style={{
              color: "red",
              marginTop: "8px",
            }}
          >
            {locationError}
          </p>
        )}
      </div>


      {/* chargement */}
      {loading && (
        <p>Chargement des livreurs...</p>
      )}

      {/* erreur */}
      {error && (
        <p style={{ color: "red" }}>
          {error}
        </p>
      )}

      {/* aucun résultat */}
      {!loading &&
        !error &&
        filtered.length === 0 && (
          <p>
            Aucun livreur disponible pour le
            moment.
          </p>
        )}

      {/* compteur */}
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

      {/* affichage */}
      {viewMode === "list" ? (
        <div className="courier-grid">
          {filtered.map((courier) => (
            <CourierCard
              courier={courier}
              key={courier.id}
            />
          ))}
        </div>
      ) : (
        <CouriersMap
          couriers={filtered}
          clientPosition={clientPosition}
        />
      )}
    </section>
  );
}