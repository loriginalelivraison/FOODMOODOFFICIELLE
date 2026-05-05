import { Link } from 'react-router-dom'
import { ArrowRight, Clock, LocateFixed, ShieldCheck, Smartphone } from 'lucide-react'
import React from "react";

export default function Home() {
  return (
    <section className="page home">
      <div className="hero">
        <div className="hero-text">
          <span className="eyebrow">Livraison locale rapide et suivie</span>
          <h1>Choisis un livreur disponible, suis sa position, sans créer de compte.</h1>
          <p>
            LivreurPro connecte les clients avec des livreurs vérifiés autour d’eux : documents, repas,
            petits colis, courses urgentes et livraisons professionnelles.
          </p>
          <div className="hero-actions">
            <Link to="/livreurs" className="primary-btn">Voir les livreurs <ArrowRight size={18} /></Link>
            <Link to="/inscription-livreur" className="secondary-btn">Je suis livreur</Link>
          </div>
        </div>
        <div className="phone-preview">
          <div className="phone-top"></div>
          <div className="mini-map">
            <span className="pin client">Client</span>
            <span className="route-line"></span>
            <span className="pin courier">Livreur</span>
          </div>
          <div className="tracking-card">
            <strong>Yanis Express</strong>
            <p>Arrivée estimée : 8 min</p>
          </div>
        </div>
      </div>

      <div className="features">
        <div><ShieldCheck /><h3>Livreurs vérifiés</h3><p>Profil, véhicule, zone, statut et notation.</p></div>
        <div><LocateFixed /><h3>Tracking invité</h3><p>Suivi simple via lien, sans inscription client.</p></div>
        <div><Clock /><h3>Disponibilité temps réel</h3><p>Filtrage par ville, urgence et type de livraison.</p></div>
        <div><Smartphone /><h3>Mobile first</h3><p>Interface claire pour petits écrans.</p></div>
      </div>
    </section>
  )
}
