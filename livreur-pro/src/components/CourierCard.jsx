import React from "react";
import { useNavigate } from "react-router-dom";
import { MapPin, Star } from "lucide-react";
import defaultAvatar from "../assets/pasdephoto.png";

export default function CourierCard({ courier }) {
  const navigate = useNavigate();
  const isAvailable = courier.available;

  function handleClick() {
    if (!isAvailable) return;
    navigate(`/tracking/${courier.id}`);
  }

  const vehicleIcons = {
    moto: "🛵",
    scooter: "🛵",
    velo: "🚴",
    voiture: "🚘",
    camion: "🚛",
  };

  const vehicleLabels = {
    moto: "دراجة نارية",
    scooter: "سكوتر",
    velo: "دراجة هوائية",
    voiture: "سيارة",
    camion: "شاحنة",
  };

  return (
    <div
      className="pro-courier-card"
      dir="rtl"
      onClick={handleClick}
      style={{
        cursor: isAvailable ? "pointer" : "not-allowed",
        opacity: isAvailable ? 1 : 0.65,
      }}
    >
      <span
        className={
          isAvailable ? "pro-status available" : "pro-status busy"
        }
      >
        {isAvailable ? "متاح الآن" : "غير متاح"}
      </span>

      <div className="pro-avatar-wrap">
        <img
          src={courier.photo || defaultAvatar}
          alt={courier.name || "صورة السائق"}
          className="pro-avatar-img"
        />

        {isAvailable && <span className="pro-online-dot"></span>}
      </div>

      <h3>{courier.name || "سائق توصيل"}</h3>

      <div className="pro-info-line">
        <MapPin size={15} />
        <span>{courier.city || "غير محددة"}</span>
      </div>

      <div className="pro-info-line">
        <span style={{ fontSize: "18px" }}>
          {vehicleIcons[courier.vehicle] || "🚚"}
        </span>

        <span>
          {vehicleLabels[courier.vehicle] ||
            courier.vehicle ||
            "غير محددة"}
        </span>
      </div>

      <div className="pro-card-footer">
        <span>
          <Star size={15} fill="#facc15" color="#facc15" />
          {courier.rating || 5}
        </span>

        <span>{courier.deliveries || 0} توصيل</span>
      </div>

      <button
        type="button"
        className="pro-details-btn"
        disabled={!isAvailable}
      >
        عرض التفاصيل ‹
      </button>
    </div>
  );
}