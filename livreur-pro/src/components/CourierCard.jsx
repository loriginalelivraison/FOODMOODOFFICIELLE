import React from "react";
import { useNavigate } from "react-router-dom";
import { MapPin, Star, Package } from "lucide-react";
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
    moto: "سيارة",
    scooter: "سيارة",
    velo: "دراجة",
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
        opacity: isAvailable ? 1 : 0.78,
      }}
    >
      <div className="pro-card-header">
        <span className={isAvailable ? "pro-status available" : "pro-status busy"}>
          {isAvailable ? "متاح الآن" : "غير متاح"}
        </span>
      </div>

      <div className="pro-card-main">
        <div className="pro-avatar-wrap">
          <img
            src={courier.photo || defaultAvatar}
            alt={courier.name || "صورة السائق"}
            className="pro-avatar-img"
          />
          {isAvailable && <span className="pro-online-dot" />}
        </div>

        <div className="pro-card-copy">
          <h3>{courier.name || "سائق توصيل"}</h3>

          <div className="pro-info-line pro-city-line">
            <span className="pro-loc-dot" />
            <span>{courier.city || "غير محددة"}</span>
          </div>

          <div className="pro-info-line pro-vehicle-line">
            <span className="pro-vehicle-icon">
              {vehicleIcons[courier.vehicle] || "🚚"}
            </span>
            <span>{vehicleLabels[courier.vehicle] || courier.vehicle || "غير محددة"}</span>
          </div>
        </div>
      </div>

      <div className="pro-card-footer">
        <div className="pro-metric">
          <span className="pro-metric-icon">
            <Package size={18} />
          </span>
          <span className="pro-metric-value">{courier.deliveries || 0}</span>
          <span className="pro-metric-label">توصيل</span>
        </div>

        <div className="pro-metric">
          <span className="pro-metric-icon star-icon">
            <Star size={18} fill="#f7b731" color="#f7b731" />
          </span>
          <span className="pro-metric-value">{courier.rating ?? "5.0"}</span>
          <span className="pro-metric-label">تقييم</span>
        </div>
      </div>

      <button type="button" className="pro-details-btn" disabled={!isAvailable}>
        عرض التفاصيل
      </button>
    </div>
  );
}