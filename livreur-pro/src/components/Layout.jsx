import React, { useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useNavigate, useNavigation, useLocation } from "react-router-dom";
import { Home, Users, User, LogIn, Lock, ArrowLeft } from "lucide-react";

import LogoutButton from "./LogoutButton";
import LoadingSpinner from "./LoadingSpinner";
import PageScrollManager from "./PageScrollManager.jsx";
import logo from "../assets/logo3.png";
import { getHomePath, isValidId, readStoredAccount } from "../utils/navigation.js";

export default function Layout() {
  const navigate = useNavigate();
  const navigation = useNavigation();
  const location = useLocation();
  const contentRef = useRef(null);
  const driverAccountView = new URLSearchParams(location.search).get("section") === "account";
  const driverDashboardView = location.pathname.startsWith("/livreur-dashboard/");

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

    const client = readStoredAccount("client");
    const livreur = readStoredAccount("livreur");

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
      navigate(getHomePath(), { replace: true });
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
    ? isValidId(auth.user?.id) ? `/livreur-dashboard/${auth.user.id}?section=account` : "/inscription-livreur"
    : "/client-dashboard";

  const homeLink =
    auth.token && auth.role === "livreur" && auth.user?.id
      ? `/livreur-dashboard/${auth.user.id}`
      : "/livreurs";


  return (
    <div className={"app-shell" + (driverDashboardView && auth.role === "livreur" ? " driver-shell" : "")}>
      <header className="topbar pro-topbar">
        <Link to="/" className="pro-brand">
          <span className="pro-logo">
            <img src={logo} alt="WinRak" />
          </span>

          <span className="pro-brand-text">
            <strong>WinRak</strong>
          </span>
        </Link>

        <div className="pro-topbar-actions">
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
              width: "30px",
              height: "30px",
              borderRadius: "10px",
              background: "linear-gradient(135deg, #fbbf24, #f59e0b)",
              color: "#ffffff",
              boxShadow: "0 8px 18px rgba(245, 158, 11, 0.25)",
              textDecoration: "none",
            }}
          >
            <Lock size={15} color="#ffffff" />
          </Link>
        </div>

        <nav className="desktop-nav">
          <NavLink to={homeLink} className={({ isActive }) => linkClass({ isActive: isActive && !(auth.role === "livreur" && driverAccountView) })}>
            الرئيسية
          </NavLink>

          <NavLink to="/livreurs" className={linkClass}>
            توصيلة
          </NavLink>

          {!auth.token ? (
            <>
              <NavLink to="/connexion-client" className={linkClass}>
                تسجيل
              </NavLink>
            </>
          ) : (
            <NavLink to={dashboardLink} className={({ isActive }) => linkClass({ isActive: isActive && (auth.role !== "livreur" || driverAccountView) })}>
              حسابي
            </NavLink>
          )}
        </nav>
      </header>

      <PageScrollManager contentRef={contentRef} />
      <main className="main-content" ref={contentRef}>
        {navigation.state === "loading" && (
          <LoadingSpinner label="جاري تحميل الصفحة..." fullPage />
        )}
        <Outlet />
      </main>

      <nav className="bottom-nav">
    

        <NavLink to={homeLink} className={({ isActive }) => bottomLinkClass({ isActive: isActive && !(auth.role === "livreur" && driverAccountView) })}>
          <Home size={20} />
          <span>الرئيسية</span>
        </NavLink>

        <NavLink to="/livreurs" className={bottomLinkClass}>
          <Users size={20} />
          <span>توصيلة</span>
        </NavLink>

        {!auth.token ? (
          <NavLink to="/connexion-client" className={bottomLinkClass}>
            <LogIn size={20} />
            <span>تسجيل</span>
          </NavLink>
   ) : (
  <NavLink to={dashboardLink} className={({ isActive }) => bottomLinkClass({ isActive: isActive && (auth.role !== "livreur" || driverAccountView) })}>
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
