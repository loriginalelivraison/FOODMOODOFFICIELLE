import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
  getLivreurById,
  getCommentairesLivreur,
  createCommentaireLivreur,
} from "../livreursapi.js";
import TrackingMap from "./TrackingMap.jsx";

export default function Tracking() {
  const { id } = useParams();

  const [courier, setCourier] = useState(null);
  const [comments, setComments] = useState([]);
  const [showCommentForm, setShowCommentForm] = useState(false);
  const [nomClient, setNomClient] = useState("");
  const [messageCommentaire, setMessageCommentaire] = useState("");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [commentError, setCommentError] = useState("");
  const [commentSuccess, setCommentSuccess] = useState("");

  useEffect(() => {
    function loadCourier() {
      getLivreurById(id)
        .then((livreur) => {
          setCourier({
            id: livreur.id,
            name: livreur.nom,
            city: livreur.ville,
            vehicle: livreur.vehicule,
            available: Boolean(livreur.disponible),
            phone: livreur.telephone,
            whatsapp: livreur.telephone
              ?.replace(/\s/g, "")
              .replace("+", "")
              .replace(/^0/, "33"),
            latitude: livreur.latitude,
            longitude: livreur.longitude,
          });

          setLoading(false);
        })
        .catch((err) => {
          setError(err.message);
          setLoading(false);
        });
    }

    loadCourier();

    const interval = setInterval(loadCourier, 5000);

    return () => clearInterval(interval);
  }, [id]);

  useEffect(() => {
    loadComments();
  }, [id]);

  async function loadComments() {
    try {
      const data = await getCommentairesLivreur(id);
      const list = Array.isArray(data) ? data : data.results || [];
      setComments(list);
    } catch (err) {
      console.log(err.message);
    }
  }

  async function handleSubmitComment(e) {
    e.preventDefault();

    setCommentError("");
    setCommentSuccess("");

    if (!messageCommentaire.trim()) {
      setCommentError("Le commentaire est obligatoire.");
      return;
    }

    try {
      await createCommentaireLivreur({
        livreur: id,
        nom_client: nomClient,
        message: messageCommentaire,
      });

      setMessageCommentaire("");
      setNomClient("");
      setShowCommentForm(false);
      setCommentSuccess("Commentaire ajouté.");
      loadComments();
    } catch (err) {
      setCommentError(err.message);
    }
  }

  if (loading) {
    return <section className="page">Chargement du suivi...</section>;
  }

  if (error) {
    return <section className="page">{error}</section>;
  }

  return (
    <section className="page">
      <div className="page-title">
        <p>
          {courier.name} : {courier.city} • {courier.vehicle} •{" "}
          {courier.available ? "Disponible" : "Occupé"}
        </p>
      </div>

      <div className="card-bottom">
        <a className="primary-btn small" href={`tel:${courier.phone}`}>
          📞 Appeler
        </a>

        <a
          className="primary-btn small"
          href={`https://wa.me/${courier.whatsapp}`}
          target="_blank"
          rel="noreferrer"
        >
          WhatsApp
        </a>

        <button
          className="primary-btn small"
          type="button"
          onClick={() => setShowCommentForm(!showCommentForm)}
        >
          Commenter
        </button>
      </div>

      {showCommentForm && (
        <form className="tracking-card" onSubmit={handleSubmitComment}>
          <h3>Ajouter un commentaire</h3>

          <input
            type="text"
            placeholder="Votre nom"
            value={nomClient}
            onChange={(e) => setNomClient(e.target.value)}
          />

          <textarea
            placeholder="Votre commentaire"
            value={messageCommentaire}
            onChange={(e) => setMessageCommentaire(e.target.value)}
            rows="4"
          />

          <button className="primary-btn small" type="submit">
            Envoyer
          </button>

          {commentError && <p style={{ color: "red" }}>{commentError}</p>}
        </form>
      )}

      {commentSuccess && <p style={{ color: "green" }}>{commentSuccess}</p>}

      <div className="tracking-card">
        <TrackingMap courier={courier} />
      </div>

      <div className="tracking-card">
        <h3>Commentaires</h3>

        {comments.length === 0 && <p>Aucun commentaire pour ce livreur.</p>}

        {comments.map((comment) => (
          <div key={comment.id} className="comment-card">
            <strong>{comment.nom_client || "Client"}</strong>
            <p>{comment.message}</p>
            <small>
              {new Date(comment.created_at).toLocaleString("fr-FR")}
            </small>
          </div>
        ))}
      </div>
    </section>
  );
}