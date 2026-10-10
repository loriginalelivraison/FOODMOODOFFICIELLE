import React, { useEffect, useRef, useState } from "react";
import { Link, Outlet, useNavigation, useLocation } from "react-router-dom";
import { Home, User, LogIn, ShieldCheck, ClipboardList, Menu, X, CarFront, History, Settings } from "lucide-react";
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
  const menuRef = useRef(null);
  const menuButtonRef = useRef(null);
  const [menuOpen, setMenuOpen] = useState(false);
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

  useEffect(() => {
    setMenuOpen(false);
  }, [location.key, auth.role, auth.user?.id]);

  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (event) => {
      if (!menuRef.current?.contains(event.target)) setMenuOpen(false);
    };
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setMenuOpen(false);
        menuButtonRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  const homeLink = driver ? `/livreur-dashboard/${auth.user.id}` : "/livreurs";
  const accountLink = driver ? `${homeLink}?section=account` : auth.token ? "/client-dashboard" : "/connexion-client";
  const homeActive = driver ? driverDashboard && !accountView : location.pathname === "/livreurs";
  const links = [
    { path: homeLink, label: driver ? "طلباتي" : "رحلة أو توصيل", icon: driver ? ClipboardList : Home, active: homeActive },
    { path: accountLink, label: auth.token ? "حسابي" : "تسجيل الدخول", icon: auth.token ? User : LogIn,
      active: accountView || (!auth.token && ["/connexion-client", "/inscription-livreur"].includes(location.pathname)) },
  ];
  const menuLinks = [
    links[0],
    { ...links[1], active: auth.token ? accountView && !location.hash : location.pathname === "/connexion-client" },
    ...(!auth.token ? [{ path: "/inscription-livreur", label: "فضاء السائق والتوصيل", icon: CarFront,
      active: location.pathname === "/inscription-livreur" }] : [
      { path: `${accountLink}${driver ? "#vehicle-info" : "#trip-history"}`,
        label: driver ? "المركبة والوثائق" : "رحلاتي وطلباتي", icon: driver ? CarFront : History,
        active: accountView && location.hash === (driver ? "#vehicle-info" : "#trip-history") },
      { path: `${accountLink}#account-settings`, label: "الإعدادات", icon: Settings,
        active: accountView && location.hash === "#account-settings" },
    ]),
    { path: "/privacy", label: "سياسة الخصوصية", icon: ShieldCheck, active: location.pathname === "/privacy" },
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
          <div className="pro-navigation-menu" ref={menuRef}
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget)) setMenuOpen(false);
            }}>
            <button ref={menuButtonRef} type="button" className="pro-menu-toggle"
              aria-label={menuOpen ? "إغلاق القائمة" : "فتح القائمة"}
              aria-expanded={menuOpen} aria-controls="main-navigation-menu"
              onClick={() => setMenuOpen((open) => !open)}>
              {menuOpen ? <X size={22} aria-hidden="true" /> : <Menu size={22} aria-hidden="true" />}
            </button>
            {menuOpen && <nav id="main-navigation-menu" className="pro-menu-panel" dir="rtl" aria-label="القائمة الرئيسية">
              <p className="pro-menu-heading">القائمة الرئيسية</p>
              <ul>
                {menuLinks.map(({ path, label, icon: Icon, active }) => <li key={path}>
                  <Link to={path} className={`pro-menu-link${active ? " active" : ""}`}
                    aria-current={active ? (path.includes("#") ? "location" : "page") : undefined}
                    onClick={() => {
                      setMenuOpen(false);
                      menuButtonRef.current?.focus();
                    }}>
                    <Icon size={20} aria-hidden="true" /><span>{label}</span>
                  </Link>
                </li>)}
              </ul>
            </nav>}
          </div>
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
