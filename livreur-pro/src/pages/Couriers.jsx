import React from "react";
import { useMemo, useState, useEffect } from 'react'
import { getLivreurs } from "../livreursapi.js";
import CourierCard from '../components/CourierCard.jsx'
import { Search } from 'lucide-react'

export default function Couriers() {
  const [query, setQuery] = useState('')
  const [onlyAvailable, setOnlyAvailable] = useState(true)

   // AJOUT : état pour stocker les livreurs venant du backend Django
  const [couriers, setCouriers] = useState([]);

  // AJOUT : état de chargement
  const [loading, setLoading] = useState(true);

  // AJOUT : état pour afficher une erreur si l'API Django ne répond pas
  const [error, setError] = useState("");
  


   // AJOUT : appel API Django au chargement de la page
  useEffect(() => {
    getLivreurs()
      .then((data) => {
        // AJOUT : adaptation des noms Django vers les noms attendus par CourierCard
        const livreurs = Array.isArray(data) ? data : data.results || [];
        const formattedCouriers = livreurs.map((livreur) => ({
          id: livreur.id,
          name: livreur.nom,
          city: livreur.ville,
          zone: livreur.ville,
          vehicle: livreur.vehicule,
          available: Boolean(livreur.disponible),
          rating: livreur.note,
          deliveries: livreur.nombre_livraisons,
          latitude: livreur.latitude,
          longitude: livreur.longitude,
          phone: livreur.telephone,
          skills: ["Livraison rapide"],
          
        }));

        setCouriers(formattedCouriers);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);


//pour filtrer les livreurs
  const filtered = useMemo(() => couriers.filter((c) => {
    const match = `${c.name} ${c.city} ${c.zone} ${c.vehicle} ${c.skills.join(' ')}`.toLowerCase().includes(query.toLowerCase())
    return match && (!onlyAvailable || c.available === true)
  }), [query, onlyAvailable, couriers])

  const token = localStorage.getItem("access");
const role = localStorage.getItem("role");

const clientStorage = localStorage.getItem("client");

const client = clientStorage
  ? JSON.parse(clientStorage)
  : null;

  return (
    <section className="page">
      <div className="page-title">
        <span className="eyebrow auth-status">
  {token && role === "client" && client ? (
    <>
      <span className="online-dot"></span>
      Bonjour {client.nom}
    </>
  ) : (
    "Espace client"
  )}
</span>

        <h1>Livreurs disponibles autour de vous</h1>
        <p>Le client peut consulter, comparer, choisir un livreur et suivre la course via un lien public sécurisé.</p>
      </div>

      <div className="toolbar">
        <label className="search-box"><Search size={18} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Ville, nom, type de livraison..." /></label>
        <label className="toggle"><input type="checkbox" checked={onlyAvailable} onChange={(e) => setOnlyAvailable(e.target.checked)} /> Disponibles uniquement</label>
      </div>

      {/* AJOUT : message pendant le chargement */}
      {loading && <p>Chargement des livreurs...</p>}

      {/* AJOUT : message si erreur API */}
      {error && <p style={{ color: "red" }}>{error}</p>}

      {/* AJOUT : message si aucun livreur trouvé */}
      {!loading && !error && filtered.length === 0 && (
        <p>Aucun livreur disponible pour le moment.</p>
      )}

      <div className="courier-grid">
        {filtered.map((courier) => <CourierCard courier={courier} key={courier.id} />)}
      </div>
    </section>
  )
}
