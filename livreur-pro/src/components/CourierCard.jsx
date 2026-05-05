import { Link } from 'react-router-dom'
import { Bike, Car, Clock, MapPin, ShieldCheck, Star } from 'lucide-react'
import React from "react";

export default function CourierCard({ courier }) {
  const VehicleIcon = courier.vehicle.toLowerCase().includes('voiture') ? Car : Bike
  return (
    <article className="courier-card">
      <div className="courier-head">
        <div className="avatar">{courier.avatar}</div>
        <div>
          <h3>{courier.name}</h3>
          <p><MapPin size={15} /> {courier.city} • {courier.zone}</p>
        </div>
        <span className={`status ${courier.available ? 'online' : 'offline'}`}>
          {courier.available ? 'Disponible' : 'Occupé'}
        </span>
      </div>

      <div className="meta-grid">
        <span><Star size={16} /> {courier.rating} ({courier.reviews})</span>
        <span><VehicleIcon size={16} /> {courier.vehicle}</span>
        <span><Clock size={16} /> {courier.eta}</span>
        <span><ShieldCheck size={16} /> {courier.verified ? 'Vérifié' : 'En cours'}</span>
      </div>

      <div className="chips">
        {courier.skills.map((skill) => <span key={skill}>{skill}</span>)}
      </div>

      <div className="card-bottom">
        <strong>{courier.price}</strong>
        <Link className={`primary-btn small ${!courier.available ? 'disabled' : ''}`} to={`/tracking/${courier.id}`} >
          تتبع
        </Link>
        <a className={`primary-btn small ${!courier.available ? 'disabled' : ''}`} href={`tel:${courier.phone}`}>
          📞 ​اتصال 
        </a>
         <a className={`primary-btn small ${!courier.available ? 'disabled' : ''}` } href={`https://wa.me/${courier.phone}`} target="_blank">
    WhatsApp
  </a>
        

        
      </div>

      
    </article>
  )
}
