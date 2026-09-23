import React, { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useNavigate, useNavigation } from "react-router-dom";
import { Home, Users, User, LogIn, Bike, Lock, ArrowLeft } from "lucide-react";

import LogoutButton from "./LogoutButton";
import LoadingSpinner from "./LoadingSpinner";
import logo from "../assets/logo3.png";

export default function Layout() {
  const navigate = useNavigate();
  const navigation = useNavigation();

  const [auth, setAuth] = useState({
    token: null,
    role: null,
    user: null,
  });

  const linkClass = ({ isActive }) =>
    `nav-link ${isActive ? "active" : ""}`;

  const bottomLinkClass = ({ isActive }) =>
    `bottom-link ${isActive ? "active" : ""}`;

  function loadAuth() {
    const token = localStorage.getItem("access");
    const role = localStorage.getItem("role");

    const clientStorage = localStorage.getItem("client");
    const livreurStorage = localStorage.getItem("livreur");

    const client = clientStorage ? JSON.parse(clientStorage) : null;
    const livreur = livreurStorage ? JSON.parse(livreurStorage) : null;

    setAuth({
      token,
      role,
      user: role === "client" ? client : livreur,
    });
  }

  function handleGoBack() {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate("/");
    }
  }

  useEffect(() => {
    loadAuth();
    window.addEventListener("authChanged", loadAuth);

    return () => {
      window.removeEventListener("authChanged", loadAuth);
    };
  }, []);

  const dashboardLink = !auth.token
    ? "/connexion-client"
    : auth.role === "livreur"
    ? `/livreur-dashboard/${auth.user?.id}`
    : "/client-dashboard";

  return (
    <div className="app-shell">
      <header className="topbar pro-topbar">
        <Link to="/" className="pro-brand">
          <span className="pro-logo">
            <img src={logo} alt="WinRak" />
          </span>

          <span className="pro-brand-text">
            <strong>WinRak</strong>
            <small>Delivery Platform</small>
          </span>
        </Link>

        <div
          style={{
            marginLeft: "auto",
            display: "flex",
            alignItems: "center",
            gap: "14px",
          }}
        >
          {auth.token && auth.user && (
            <span className="pro-auth-status">
              <span className="online-dot"></span>
              {auth.user.nom}
            </span>
          )}

          <Link
            to="/privacy"
            title="سياسة الخصوصية"
            aria-label="سياسة الخصوصية"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "36px",
              height: "36px",
              borderRadius: "12px",
              background: "linear-gradient(135deg, #fbbf24, #f59e0b)",
              color: "#ffffff",
              boxShadow: "0 8px 18px rgba(245, 158, 11, 0.25)",
              textDecoration: "none",
            }}
          >
            <Lock size={18} color="#ffffff" />
          </Link>
        </div>

        <nav className="desktop-nav">
          <NavLink to="/" className={linkClass}>
            الرئيسية
          </NavLink>

          <NavLink to="/livreurs" className={linkClass}>
            السائقون
          </NavLink>

          {!auth.token ? (
            <>
              <NavLink to="/inscription-livreur" className={linkClass}>
                أصبح سائق
              </NavLink>

              <NavLink to="/connexion-client" className={linkClass}>
                تسجيل
              </NavLink>
            </>
          ) : (
            <NavLink to={dashboardLink} className={linkClass}>
              حسابي
            </NavLink>
          )}
        </nav>
      </header>

      <main className="main-content">
        {navigation.state === "loading" && (
          <LoadingSpinner label="جاري تحميل الصفحة..." fullPage />
        )}
        <Outlet />
      </main>

      <nav className="bottom-nav">
    

        <NavLink to="/" className={bottomLinkClass}>
          <Home size={20} />
          <span>الرئيسية</span>
        </NavLink>

        <NavLink to="/livreurs" className={bottomLinkClass}>
          <Users size={20} />
          <span>السائقون</span>
        </NavLink>

        {!auth.token ? (
          <>
            <NavLink to="/connexion-client" className={bottomLinkClass}>
              <LogIn size={20} />
              <span>تسجيل</span>
            </NavLink>

            <NavLink to="/inscription-livreur" className={bottomLinkClass}>
              <Bike size={20} />
              <span>سائق</span>
            </NavLink>
          </>
   ) : (
  <NavLink to={dashboardLink} className={bottomLinkClass}>
    <User size={20} />
    <span>حسابي</span>
  </NavLink>
)}
         <button
    type="button"
    onClick={handleGoBack}
    className="bottom-link"
    style={{
      border: "none",
      background: "transparent",
      cursor: "pointer",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      whiteSpace: "nowrap",
      minWidth: "58px",
    }}
  >
    <ArrowLeft size={20} />

    <span
      style={{
        fontSize: "11px",
        marginTop: "2px",
        whiteSpace: "nowrap",
      }}
    >
      رجوع
    </span>
  </button>
      </nav>
    </div>
  );
}