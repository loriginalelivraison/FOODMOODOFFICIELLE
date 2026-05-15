import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import logo from "../assets/logo4.png";

export default function SplashLogo() {
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(() => {
      navigate("/livreurs");
    }, 3000);

    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div
      style={{
        width: "100%",
        height: "100vh",
        background: "#f97316", // orange FoodMood
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        overflow: "hidden",
      }}
    >
      <img
        src={logo}
        alt="FoodMood"
        style={{
          width: "300px",
          height: "300px",
          objectFit: "contain",
          animation: "logoAnim 1.8s ease-in-out infinite alternate",
        }}
      />

      <style>
        {`
          @keyframes logoAnim {
            from {
              transform: scale(1);
              opacity: 0.92;
            }

            to {
              transform: scale(1.08);
              opacity: 1;
            }
          }
        `}
      </style>
    </div>
  );
}