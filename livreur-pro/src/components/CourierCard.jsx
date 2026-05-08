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
      onClick={handleClick}
      style={{
        cursor: isAvailable ? "pointer" : "not-allowed",
        opacity: isAvailable ? 1 : 0.7,
      }}
    >
      {/* PHOTO */}
      <div className="courier-avatar">
        <img
          src={courier.photo || defaultAvatar}
          alt={courier.name}
        />
      </div>

      <div className="courier-top">
        <h3>{courier.name}</h3>

        <span
          className={courier.available ? "status available" : "status busy"}
        >
          {courier.available ? "متاح" : "مشغول"}
        </span>
      </div>

      <p>{courier.city}</p>
      <p>{courier.vehicle}</p>

      <div className="courier-footer">
        <span>⭐ {courier.rating || 5}</span>
        <span>{courier.deliveries || 0} توصيل</span>
      </div>

      {!isAvailable && (
        <p
          style={{
            color: "#dc2626",
            fontSize: "12px",
            marginTop: "8px",
            fontWeight: "600",
          }}
        >
          {courier.name} مشغول حالياً
        </p>
      )}
    </div>
  );
}