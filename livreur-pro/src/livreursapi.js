const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000/api";

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

  const livreur = await getLivreurBytelephone(credentials.telephone);

  localStorage.clear();

  localStorage.setItem("access", data.access);
  localStorage.setItem("refresh", data.refresh);
  localStorage.setItem("role", "livreur");

  localStorage.setItem(
    "livreur",
    JSON.stringify({
      id: livreur?.id,
      nom: livreur?.nom || credentials.nom || "Livreur",
      telephone: credentials.telephone,
    })
  );
  window.dispatchEvent(new Event("authChanged"));
  return data;
}

export async function createLivreur(livreur) {
  const url = `${API_BASE_URL}/livreurs/register/`;

  console.log("URL inscription livreur =", url);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(livreur),
  });

  const text = await response.text();

  let data;

  try {
    data = JSON.parse(text);
  } catch {
    console.error("Réponse non JSON reçue :", text);
    throw new Error("Le serveur a renvoyé une page HTML au lieu du JSON.");
  }

  if (!response.ok) {
    throw new Error(
      data.error ||
      data.telephone?.[0] ||
      "Erreur lors de l'inscription"
    );
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
//rendre le livreur occupé
export async function setLivreurUnavailable(id) {
  const token = localStorage.getItem("access");

  const response = await fetch(`${API_BASE_URL}/livreurs/${id}/set_unavailable/`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.detail || data.error || "Erreur désactivation livreur");
  }

  return data;
}

export async function getCommentairesLivreur(livreurId) {
  const response = await fetch(
    `${API_BASE_URL}/commentaires-livreurs/?livreur=${livreurId}`
  );

  if (!response.ok) {
    throw new Error("Erreur chargement commentaires");
  }

  return response.json();
}

export async function createCommentaireLivreur(commentaire) {
  const response = await fetch(`${API_BASE_URL}/commentaires-livreurs/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(commentaire),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.detail || data.message || "Erreur ajout commentaire");
  }

  return data;
}
//inscription client 
export async function createClient(client) {
  const response = await fetch(`${API_BASE_URL}/clients/register/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(client),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Erreur inscription client");
  }

  return data;
}

//login client
export async function loginClient(credentials) {
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
    throw new Error(data.detail || "Connexion client impossible");
  }

  const client = await getClientByTelephone(credentials.telephone);

  localStorage.clear();
  localStorage.setItem("access", data.access);
  localStorage.setItem("refresh", data.refresh);
  localStorage.setItem("role", "client");

  localStorage.setItem(
    "client",
    JSON.stringify({
      id: client?.id,
      nom: client?.nom || "Client",
      telephone: credentials.telephone,
    })
  );
   window.dispatchEvent(new Event("authChanged"));
  return data;
}

export async function getClientByTelephone(telephone) {
  const response = await fetch(`${API_BASE_URL}/clients/?format=json`);

  if (!response.ok) {
    throw new Error("Erreur récupération client");
  }

  const data = await response.json();
  const clients = Array.isArray(data) ? data : data.results || [];

  const clean = (value) => String(value || "").replace(/\s/g, "");

  return clients.find(
    (c) => clean(c.telephone) === clean(telephone)
  );
}
