import React from "react";
import { Link } from 'react-router-dom'
export default function NotFound() {
  return <section className="page centered-page"><h1>Page introuvable</h1><Link className="primary-btn" to="/">Retour accueil</Link></section>
}
