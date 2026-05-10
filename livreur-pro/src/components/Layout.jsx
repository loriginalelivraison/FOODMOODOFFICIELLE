import { Link, NavLink, Outlet } from "react-router-dom";
import { Menu } from "lucide-react";
import { useState, useEffect } from "react";
import React from "react";
import LogoutButton from "./LogoutButton";
import logo from "../assets/logo.png";

export default function Layout() {
  const [open, setOpen] = useState(false);
  const [auth, setAuth] = useState({
    token: null,
    role: null,
    user: null,
  });

  const linkClass = ({ isActive }) => `nav-link ${isActive ? "active" : ""}`;

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

  const dashboardLink =
    !auth.token
      ? "/connexion-client"
      : auth.role === "livreur"
      ? `/livreur-dashboard/${auth.user?.id}`
      : "/client-dashboard";

  return (
    <div className="app-shell">
      <header className="topbar">
        <Link to="/" className="brand" onClick={() => setOpen(false)}>
          <span className="brand-icon">
            <img
              src={logo}
              alt="الشعار"
              style={{
                width: "50px",
                height: "50px",
                objectFit: "cover",
                borderRadius: "40%",
              }}
            />
          </span>
          <span> FoodMood</span>
        </Link>

        <button
          className="menu-btn"
          onClick={() => setOpen(!open)}
          aria-label="فتح القائمة"
        >
          <Menu />
        </button>

        <nav className={`nav ${open ? "open" : ""}`}>
          {auth.token && auth.user && (
            <span className="eyebrow auth-status">
              <span className="online-dot"></span>
              مرحبًا {auth.user.nom}
            </span>
          )}

          <NavLink to="/" className={linkClass} onClick={() => setOpen(false)}>
            الرئيسية
          </NavLink>

          <NavLink to="/livreurs" className={linkClass} onClick={() => setOpen(false)}>
            السائقون
          </NavLink>

          {!auth.token && (
                <>
                  <NavLink
                    to="/inscription-livreur"
                    className={linkClass}
                    onClick={() => setOpen(false)}
                  >
                    أصبح سائق توصيل
                  </NavLink>

                  <NavLink
                    to="/connexion-client"
                    className={linkClass}
                    onClick={() => setOpen(false)}
                  >
                    تسجيل
                  </NavLink>
                </>
              )}
              
          {auth.token && auth.user && (
            <NavLink
              to={dashboardLink}
              className={linkClass}
              onClick={() => setOpen(false)}
            >
              حسابي
            </NavLink>
          )}

          <LogoutButton />
        </nav>
      </header>

      <main>
        <Outlet />
      </main>

      <footer className="footer">
        © 2026 LivreurPro — منصة لربط خدمات التوصيل المحلية.
      </footer>
    </div>
  );
}