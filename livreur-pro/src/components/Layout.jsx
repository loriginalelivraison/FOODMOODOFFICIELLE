import React, { useEffect, useRef, useState } from "react";
import { Link, Outlet, useNavigation, useLocation } from "react-router-dom";
import { Home, User, LogIn, Lock, ClipboardList } from "lucide-react";
import LoadingSpinner from "./LoadingSpinner";
import PageScrollManager from "./PageScrollManager.jsx";
import logo from "../assets/logo3.png";
import { isValidId, readStoredAccount } from "../utils/navigation.js";

function readAuth() {
  const role = localStorage.getItem("role");
  const user = readStoredAccount(role);
  const token = localStorage.getItem("access");
  return token && ["client", "livreur"].includes(role) && isValidId(user?.id)
    ? { role, user, token } : { role: null, user: null, token: null };
}

export default function Layout() {
  const navigation = useNavigation();
  const location = useLocation();
  const contentRef = useRef(null);
  const [auth, setAuth] = useState(readAuth);
  const driver = auth.role === "livreur";
  const driverDashboard = location.pathname.startsWith("/livreur-dashboard/");
  const accountView = driver
    ? driverDashboard && new URLSearchParams(location.search).get("section") === "account"
    : location.pathname === "/client-dashboard";

  useEffect(() => {
    const update = () => setAuth(readAuth());
    window.addEventListener("authChanged", update);
    window.addEventListener("storage", update);
    return () => {
      window.removeEventListener("authChanged", update);
      window.removeEventListener("storage", update);
    };
  }, []);

  const homeLink = driver ? `/livreur-dashboard/${auth.user.id}` : "/livreurs";
  const accountLink = driver ? `${homeLink}?section=account` : auth.token ? "/client-dashboard" : "/connexion-client";
  const homeActive = driver ? driverDashboard && !accountView : location.pathname === "/livreurs";
  const links = [
    { path: homeLink, label: driver ? "طلباتي" : "رحلة أو توصيل", icon: driver ? ClipboardList : Home, active: homeActive },
    { path: accountLink, label: auth.token ? "حسابي" : "تسجيل الدخول", icon: auth.token ? User : LogIn,
      active: accountView || (!auth.token && ["/connexion-client", "/inscription-livreur"].includes(location.pathname)) },
  ];
  const renderLinks = (className) => links.map(({ path, label, icon: Icon, active }) => (
    <Link key={path} to={path} className={`${className}${active ? " active" : ""}`} aria-current={active ? "page" : undefined}>
      <Icon size={20} aria-hidden="true" /><span>{label}</span>
    </Link>
  ));

  return (
    <div className={`app-shell${driverDashboard && driver ? " driver-shell" : ""}`}>
      <a className="skip-link" href="#main-content">الانتقال إلى المحتوى</a>
      <header className="topbar pro-topbar">
        <Link to={homeLink} className="pro-brand" aria-label="WinRak — الرئيسية">
          <span className="pro-logo"><img src={logo} alt="WinRak" /></span>
          <span className="pro-brand-text"><strong>WinRak</strong></span>
        </Link>
        <div className="pro-topbar-actions">
          {auth.user && <span className="pro-auth-status">{auth.user.nom}</span>}
          <Link to="/privacy" className="privacy-link" title="سياسة الخصوصية" aria-label="سياسة الخصوصية"><Lock size={18} /></Link>
        </div>
        <nav className="desktop-nav" aria-label="التنقل الرئيسي">{renderLinks("nav-link")}</nav>
      </header>
      <PageScrollManager contentRef={contentRef} />
      <main id="main-content" className="main-content" ref={contentRef} tabIndex={-1}>
        {navigation.state === "loading" && <LoadingSpinner label="جارٍ تحميل الصفحة…" fullPage />}
        <Outlet />
      </main>
      <nav className="bottom-nav" aria-label="التنقل الرئيسي">{renderLinks("bottom-link")}</nav>
    </div>
  );
}