import React from "react";
import { useNavigate } from "react-router-dom";
import defaultAvatar from "../assets/logo2.png";

export default function CourierCard({ courier }) {
  const navigate = useNavigate();

  return (
    <div
      className="courier-card mini-courier-card"
      onClick={() => navigate(`/tracking/${courier.id}`)}
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

        <span className={courier.available ? "status available" : "status busy"}>
          {courier.available ? "Disponible" : "Occupé"}
        </span>
      </div>

      <p>{courier.city}</p>
      <p>{courier.vehicle}</p>

      <div className="courier-footer">
        <span>⭐ {courier.rating || 5}</span>
        <span>{courier.deliveries || 0} courses</span>
      </div>
    </div>
  );
}