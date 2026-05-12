import React from "react";
import { useNavigate } from "react-router-dom";
import defaultAvatar from "../assets/logo2.png";

export default function CourierCard({ courier }) {
  const navigate = useNavigate();

  const isAvailable = courier.available;

  function handleClick() {
    if (!isAvailable) return;
    navigate(`/tracking/${courier.id}`);
  }

  return (
    <div
      className="courier-card mini-courier-card"
      dir="rtl"
      onClick={handleClick}
      style={{
        cursor: isAvailable ? "pointer" : "not-allowed",
        opacity: isAvailable ? 1 : 0.65,
        fontFamily: "'Tajawal', sans-serif",
      }}
    >
      <div className="courier-avatar">
        <img
          src={courier.photo || defaultAvatar}
          alt={courier.name || "صورة السائق"}
        />
      </div>

      <div className="courier-top">
        <h3>{courier.name || "سائق توصيل"}</h3>

        <span className={isAvailable ? "status available" : "status busy"}>
          {isAvailable ? "متاح الآن" : "غير متاح"}
        </span>
      </div>

      <p>
        <strong>منطقة النشاط:</strong>{" "}
        {courier.city || "غير محددة"}
      </p>

      <p>
        <strong>وسيلة النقل:</strong>{" "}
        {courier.vehicle || "غير محددة"}
      </p>

      <div className="courier-footer">
        <span>⭐ {courier.rating || 5}</span>
        <span>{courier.deliveries || 0} عملية توصيل</span>
      </div>

      {!isAvailable && (
        <p
          style={{
            color: "#dc2626",
            fontSize: "13px",
            marginTop: "10px",
            fontWeight: "700",
            textAlign: "center",
          }}
        >
          هذا السائق غير متاح حالياً لاستقبال الطلبات
        </p>
      )}
    </div>
  );
}