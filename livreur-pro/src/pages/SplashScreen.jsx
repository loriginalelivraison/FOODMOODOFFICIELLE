import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import logo from "../assets/logo1.png";

export default function SplashLogo() {
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(() => {
      navigate("/livreurs");
    }, 3000);

    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="splash">
      <img src={logo} className="scooter-logo" alt="Foodmood logo" />
    </div>
  );
}