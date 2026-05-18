import React, { useEffect, useState } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { Home, Users, User, LogIn, Bike, Shield } from "lucide-react";

import LogoutButton from "./LogoutButton";
import logo from "../assets/logo3.png";

export default function Layout() {
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
  style={{
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    textDecoration: "none",
    color: "orange",
    minWidth: "55px",
  }}
>
  <Shield size={18} />

  <span
    style={{
      fontSize: "9px",
      marginTop: "2px",
      opacity: 0.9,
      lineHeight: "1",
      textAlign: "center",
    }}
  >
    سياسة الخصوصية
  </span>
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
            <>
              <NavLink to={dashboardLink} className={linkClass}>
                حسابي
              </NavLink>

              <LogoutButton />
            </>
          )}
        </nav>
      </header>

      <main className="main-content">
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
          <>
            <NavLink to={dashboardLink} className={bottomLinkClass}>
              <User size={20} />
              <span>حسابي</span>
            </NavLink>

            <div className="bottom-link bottom-logout">
              <LogoutButton />
            </div>
          </>
        )}
      </nav>
    </div>
  );
}