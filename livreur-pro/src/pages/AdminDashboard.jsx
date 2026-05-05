import React from "react";
import { useState, useEffect, useMemo } from "react";
import { getLivreurs } from "../livreursApi";
import { ClipboardList, ShieldCheck, Users, WalletCards } from 'lucide-react'

export default function AdminDashboard() {
  // AJOUT : état pour stocker les livreurs venant du backend Django
  const [couriers, setCouriers] = useState([]);

  // AJOUT : état de chargement
  const [loading, setLoading] = useState(true);

  // AJOUT : état d'erreur API
  const [error, setError] = useState("");

  // AJOUT : appel API Django au chargement du dashboard
  useEffect(() => {
    getLivreurs()
      .then((data) => {
        const formattedCouriers = data.map((livreur) => ({
          id: livreur.id,
          name: livreur.nom,
          city: livreur.ville,
          vehicle: livreur.vehicule,
          available: livreur.disponible,
          rating: livreur.note || 5,
          deliveries: livreur.nombre_livraisons || 0,
        }));

        setCouriers(formattedCouriers);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  // AJOUT : statistiques calculées depuis les données Django
  const stats = useMemo(() => {
    return {
      total: couriers.length,
      available: couriers.filter((c) => c.available).length,
      unavailable: couriers.filter((c) => !c.available).length,
      deliveries: couriers.reduce((sum, c) => sum + c.deliveries, 0),
    };
  }, [couriers]);

  if (loading) {
    return (
      <section className="page">
        <p>Chargement du dashboard...</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="page">
        <p style={{ color: "red" }}>{error}</p>
      </section>
    );
  }

  return (
    <section className="page">
      <div className="page-title">
        <span className="eyebrow">Administration</span>
        <h1>Dashboard plateforme</h1>
        <p>Vue globale des livreurs inscrits sur la plateforme.</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <span>Total livreurs</span>
          <strong>{stats.total}</strong>
        </div>

        <div className="stat-card">
          <span>Disponibles</span>
          <strong>{stats.available}</strong>
        </div>

        <div className="stat-card">
          <span>Indisponibles</span>
          <strong>{stats.unavailable}</strong>
        </div>

        <div className="stat-card">
          <span>Livraisons réalisées</span>
          <strong>{stats.deliveries}</strong>
        </div>
      </div>

      <div className="panel">
        <h2>Liste des livreurs</h2>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Nom</th>
                <th>Ville</th>
                <th>Véhicule</th>
                <th>Disponibilité</th>
                <th>Note</th>
                <th>Livraisons</th>
              </tr>
            </thead>

            <tbody>
              {couriers.map((courier) => (
                <tr key={courier.id}>
                  <td>{courier.name}</td>
                  <td>{courier.city}</td>
                  <td>{courier.vehicle}</td>
                  <td>
                    {courier.available ? "Disponible" : "Indisponible"}
                  </td>
                  <td>{courier.rating}</td>
                  <td>{courier.deliveries}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}