import React, { useState } from "react";
import { CheckCircle2, UploadCloud } from "lucide-react";
import { loginJWT, createLivreur, getLivreurBytelephone } from "../livreursapi.js";
import { useNavigate } from "react-router-dom";

export default function CourierRegister() {
  const navigate = useNavigate();

  const [mode, setMode] = useState("register");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  // AJOUT : formulaire connexion
 const [loginForm, setLoginForm] = useState({
  telephone: "",
  password: "",
});

  // AJOUT : formulaire inscription envoyé à Django
  const [registerForm, setRegisterForm] = useState({
    nom: "",
    telephone: "",
    email: "",
    ville: "",
    vehicule: "scooter",
    disponible: true,
    password: "",
  });

async function handleSubmit(e) {
  e.preventDefault();
  setError("");

  try {
    await createLivreur(registerForm);

    const tokens = await loginJWT({
      telephone: registerForm.telephone,
      password: registerForm.password,
    });

    localStorage.setItem("access", tokens.access);
    localStorage.setItem("refresh", tokens.refresh);

    const livreur = await getLivreurBytelephone(registerForm.telephone);

    if (!livreur) {
      throw new Error("Profil livreur introuvable après inscription");
    }

    localStorage.setItem("livreur", JSON.stringify(livreur));

    navigate(`/livreur-dashboard/${livreur.id}`);
  } catch (err) {
    setError(err.message);
  }
}

  async function handleLogin(e) {
  e.preventDefault();
  setError("");

  try {
    const tokens = await loginJWT(loginForm);

    localStorage.setItem("access", tokens.access);
    localStorage.setItem("refresh", tokens.refresh);

    const livreur = await getLivreurBytelephone(loginForm.telephone);

    if (!livreur) {
      throw new Error("Profil livreur introuvable");
    }

    localStorage.setItem("livreur", JSON.stringify(livreur));

    navigate(`/livreur-dashboard/${livreur.id}`);
  } catch (err) {
    setError(err.message);
  }
}

  if (submitted) {
    return (
      <section className="page centered-page">
        <div className="success-box">
          <CheckCircle2 size={54} />
          <h1>Demande envoyée</h1>
          <p>Votre profil livreur a été enregistré.</p>
          <p className="muted">
            Vous pouvez maintenant vous connecter avec votre email et téléphone.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="page form-page">
      <div className="page-title narrow">
        <span className="eyebrow">Espace livreur</span>
        <h1>{mode === "register" ? "Inscription livreur" : "Connexion livreur"}</h1>
        <p>
          {mode === "register"
            ? "Rejoignez la plateforme comme livreur."
            : "Connectez-vous si vous êtes déjà inscrit."}
        </p>
      </div>

      <div className="auth-switch">
        <button
          type="button"
          className={mode === "register" ? "primary-btn small" : "secondary-btn small"}
          onClick={() => setMode("register")}
        >
          Inscription
        </button>

        <button
          type="button"
          className={mode === "login" ? "primary-btn small" : "secondary-btn small"}
          onClick={() => setMode("login")}
        >
          Déjà inscrit ? Connexion
        </button>
      </div>

      {mode === "login" ? (
        <form className="pro-form" onSubmit={handleLogin}>
          {error && <p style={{ color: "red" }}>{error}</p>}

          <div className="form-grid">
                  <label>
          Téléphone
          <input
            required
            placeholder="0555555555"
            value={loginForm.telephone}
            onChange={(e) =>
              setLoginForm({
                ...loginForm,
                telephone: e.target.value,
              })
            }
          />
        </label>

            <label>
                Mot de passe
                <input
                  type="password"
                  required
                  value={loginForm.password}
                  onChange={(e) =>
                    setLoginForm({ ...loginForm, password: e.target.value })
                  }
                />
              </label>
          </div>

          <button className="primary-btn full" type="submit">
            Se connecter
          </button>
        </form>
      ) : (
        <form className="pro-form" onSubmit={handleSubmit}>
          {error && <p style={{ color: "red" }}>{error}</p>}

          <div className="form-grid">
            <label>
              Nom complet
              <input
                required
                placeholder="Ex: Ahmed Benali"
                value={registerForm.nom}
                onChange={(e) =>
                  setRegisterForm({ ...registerForm, nom: e.target.value })
                }
              />
            </label>

            <label>
              Téléphone
              <input
                required
                placeholder="+33 ..."
                value={registerForm.telephone}
                onChange={(e) =>
                  setRegisterForm({ ...registerForm, telephone: e.target.value })
                }
              />
            </label>

            <label>
              Email
              <input
                type="email"
                required
                placeholder="livreur@email.com"
                value={registerForm.email}
                onChange={(e) =>
                  setRegisterForm({ ...registerForm, email: e.target.value })
                }
              />
            </label>

            <label>
              Ville principale
              <input
                required
                placeholder="Paris, Lyon, Marseille..."
                value={registerForm.ville}
                onChange={(e) =>
                  setRegisterForm({ ...registerForm, ville: e.target.value })
                }
              />
            </label>

            <label>
              Type de véhicule
              <select
                required
                value={registerForm.vehicule}
                onChange={(e) =>
                  setRegisterForm({ ...registerForm, vehicule: e.target.value })
                }
              >
                <option value="scooter">Scooter</option>
                <option value="moto">Moto</option>
                <option value="velo">Vélo</option>
                <option value="voiture">Voiture</option>
              </select>
            </label>

            <label>
              Disponibilité
              <select
                required
                value={registerForm.disponible ? "true" : "false"}
                onChange={(e) =>
                  setRegisterForm({
                    ...registerForm,
                    disponible: e.target.value === "true",
                  })
                }
              >
                <option value="true">Disponible maintenant</option>
                <option value="false">Indisponible</option>
              </select>
            </label>
          </div>

          <label>
            Services proposés
            <textarea
              rows="4"
              placeholder="Documents, repas, petits colis, courses, pharmacie..."
            />
          </label>
                  <label>
          Mot de passe
          <input
            type="password"
            required
            placeholder="Mot de passe"
            value={registerForm.password}
            onChange={(e) =>
              setRegisterForm({
                ...registerForm,
                password: e.target.value,
              })
            }
          />
        </label>

          <div className="upload-box">
            <UploadCloud />
            <div>
              <strong>Documents justificatifs</strong>
              <p>Pièce d’identité, assurance, permis si nécessaire. Zone prévue pour upload.</p>
            </div>
          </div>

          <button className="primary-btn full" type="submit">
            Envoyer ma demande
          </button>
        </form>
      )}
    </section>
  );
}