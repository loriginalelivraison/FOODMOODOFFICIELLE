import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import logo from "../assets/logo.png";

export default function SplashScreen() {
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(() => {
      navigate("/livreurs");
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <section
      style={{
        height: "100vh",
        width: "100%",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        background: "#ffffff",
      }}
    >
      <img
        src={logo}
        alt="Logo"
        style={{
          width: "70%",
          maxWidth: "420px",
          objectFit: "contain",
        }}
      />
    </section>
  );
}