const API_BASE_URL = "import.meta.env.VITE_API_BASE_URL";

export async function getLivreurs() {
  const response = await fetch(`${API_BASE_URL}/livreurs/?format=json`);

  if (!response.ok) {
    throw new Error("Erreur lors du chargement des livreurs");
  }

  return response.json();
}

export async function getLivreurById(id) {
  const response = await fetch(`${API_BASE_URL}/livreurs/${id}/?format=json`);

  if (!response.ok) {
    throw new Error("Livreur introuvable");
  }

  return response.json();
}

export async function loginJWT(credentials) {
  const response = await fetch(`${API_BASE_URL}/token/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      username: credentials.telephone,
      password: credentials.password,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.detail || "Connexion impossible");
  }

  return data;
}

export async function createLivreur(livreur) {
  const response = await fetch(`${API_BASE_URL}/livreurs/register/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(livreur),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || data.email?.[0] || "Erreur lors de l'inscription");
  }

  return data;
}

export async function updateLivreurPosition(id, position) {
  const token = localStorage.getItem("access");

  const response = await fetch(`${API_BASE_URL}/livreurs/${id}/update_position/`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(position),
  });

  const data = await response.json();

  if (!response.ok) {
    console.log("Erreur Django update_position :", data);
    throw new Error(data.detail || data.error || "Erreur mise à jour position");
  }

  return data;
}

//recuperer l'id de livreur par phone 
export async function getLivreurBytelephone(telephone) {
  const response = await fetch(`${API_BASE_URL}/livreurs/?format=json`);

  if (!response.ok) {
    throw new Error("Erreur récupération livreur");
  }

  const data = await response.json();

  const livreurs = Array.isArray(data)
    ? data
    : data.results || [];

  const clean = (value) =>
    String(value || "").replace(/\s/g, "");

  return livreurs.find(
    (l) => clean(l.telephone) === clean(telephone)
  );
}