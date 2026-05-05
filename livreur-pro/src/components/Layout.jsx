import { Link, NavLink, Outlet } from 'react-router-dom'
import { Menu, PackageCheck } from 'lucide-react'
import { useState } from 'react'
import React from "react";
import LogoutButton from './LogoutButton';
import logo from "../assets/logo.png";

export default function Layout() {
  const [open, setOpen] = useState(false)
  const linkClass = ({ isActive }) => `nav-link ${isActive ? 'active' : ''}`

  return (
    <div className="app-shell">
      <header className="topbar">
        <Link to="/" className="brand" onClick={() => setOpen(false)}>
          <span className="brand-icon"><img
    src={logo}
    alt="Logo"
    style={{
      width: "40px",
      height: "40px",
      objectFit: "contain",
    }} /></span>
          <span>FoodMood</span>
        </Link>
        <button className="menu-btn" onClick={() => setOpen(!open)} aria-label="Ouvrir le menu">
          <Menu />
        </button>
        <nav className={`nav ${open ? 'open' : ''}`}>
          <NavLink to="/" className={linkClass} onClick={() => setOpen(false)}>Accueil</NavLink>
          <NavLink to="/livreurs" className={linkClass} onClick={() => setOpen(false)}>Livreurs</NavLink>
          <NavLink to="/inscription-livreur" className={linkClass} onClick={() => setOpen(false)}>Devenir livreur</NavLink>
          <NavLink to="/admin" className={linkClass} onClick={() => setOpen(false)}>Admin</NavLink>
          <LogoutButton />
        </nav>
      </header>
      <main>
        <Outlet />
      </main>
      <footer className="footer">© 2026 LivreurPro — plateforme de mise en relation livraison locale.</footer>
    </div>
  )
}
