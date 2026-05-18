const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000/api";

function getCleanToken() {
  return localStorage.getItem("access")?.replaceAll('"', "").trim();
}

function handleInvalidToken(data) {
  const message = JSON.stringify(data || "");

  if (
    message.includes("Given token not valid") ||
    message.includes("token_not_valid") ||
    message.includes("Token is invalid") ||
    message.includes("Token is expired")
  ) {
    localStorage.clear();
    window.dispatchEvent(new Event("authChanged"));
    window.location.href = "/connexion-livreur";
  }
}

function authHeaders(extra = {}) {
  const token = getCleanToken();

  return {
    ...extra,
    Authorization: `Bearer ${token}`,
  };
}

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

  if (!livreur) {
    localStorage.clear();
    throw new Error("هذا الحساب ليس حساب سائق. يرجى تسجيل الدخول من فضاء العميل.");
  }

  const redirectAfterLogin = localStorage.getItem("redirectAfterLogin");

  localStorage.clear();

  if (redirectAfterLogin) {
    localStorage.setItem("redirectAfterLogin", redirectAfterLogin);
  }

  localStorage.setItem("access", data.access);
  localStorage.setItem("refresh", data.refresh);
  localStorage.setItem("role", "livreur");

  localStorage.setItem(
    "livreur",
    JSON.stringify({
      id: livreur.id,
      nom: livreur.nom || credentials.nom || "Livreur",
      telephone: credentials.telephone,
      ville: livreur.ville,
      vehicule: livreur.vehicule,
      photo: livreur.photo,
    })
  );

  window.dispatchEvent(new Event("authChanged"));
  return data;
}

export async function createLivreur(livreur) {
  const response = await fetch(`${API_BASE_URL}/livreurs/register/`, {
    method: "POST",
    body: livreur,
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
      data.error || data.telephone?.[0] || "Erreur lors de l'inscription"
    );
  }

  return data;
}

export async function updateLivreurPosition(id, position) {
  const response = await fetch(`${API_BASE_URL}/livreurs/${id}/update_position/`, {
    method: "PATCH",
    headers: authHeaders({
      "Content-Type": "application/json",
    }),
    body: JSON.stringify(position),
  });

  const data = await response.json();

  if (!response.ok) {
    handleInvalidToken(data);
    console.log("Erreur Django update_position :", data);
    throw new Error(data.detail || data.error || "Erreur mise à jour position");
  }

  return data;
}

export async function getLivreurBytelephone(telephone) {
  const response = await fetch(`${API_BASE_URL}/livreurs/?format=json`);

  if (!response.ok) {
    throw new Error("Erreur récupération livreur");
  }

  const data = await response.json();
  const livreurs = Array.isArray(data) ? data : data.results || [];

  const clean = (value) => String(value || "").replace(/\s/g, "");

  return livreurs.find((l) => clean(l.telephone) === clean(telephone));
}

export async function setLivreurUnavailable(id) {
  const response = await fetch(`${API_BASE_URL}/livreurs/${id}/set_unavailable/`, {
    method: "PATCH",
    headers: authHeaders(),
  });

  const data = await response.json();

  if (!response.ok) {
    handleInvalidToken(data);
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

  const redirectAfterLogin = localStorage.getItem("redirectAfterLogin");

  localStorage.clear();

  if (redirectAfterLogin) {
    localStorage.setItem("redirectAfterLogin", redirectAfterLogin);
  }

  localStorage.setItem("access", data.access);
  localStorage.setItem("refresh", data.refresh);
  localStorage.setItem("role", "client");

  const client = await getClientByTelephone(credentials.telephone);

  if (!client) {
    localStorage.clear();
    throw new Error("هذا الحساب ليس حساب عميل. يرجى تسجيل الدخول من فضاء السائق.");
  }

  localStorage.setItem(
    "client",
    JSON.stringify({
      id: client.id,
      nom: client.nom || "Client",
      telephone: client.telephone,
    })
  );

  window.dispatchEvent(new Event("authChanged"));

  return data;
}

export async function getClientByTelephone(telephone) {
  const response = await fetch(`${API_BASE_URL}/clients/`, {
    headers: authHeaders(),
  });

  const data = await response.json();

  if (!response.ok) {
    handleInvalidToken(data);
    console.error("Erreur récupération client :", data);
    throw new Error(data.detail || "Erreur récupération client");
  }

  const clients = Array.isArray(data) ? data : data.results || [];
  const clean = (value) => String(value || "").replace(/\s/g, "");

  return clients.find((client) => clean(client.telephone) === clean(telephone));
}

export async function deleteLivreur(id) {
  const response = await fetch(`${API_BASE_URL}/livreurs/${id}/`, {
    method: "DELETE",
    headers: authHeaders(),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    handleInvalidToken(error);
    throw new Error(error.detail || "Erreur suppression compte livreur");
  }

  return true;
}

export async function deleteClient(id) {
  const response = await fetch(`${API_BASE_URL}/clients/${id}/`, {
    method: "DELETE",
    headers: authHeaders(),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    handleInvalidToken(error);
    throw new Error(error.detail || "Impossible de supprimer le compte client");
  }

  return true;
}

export async function createCourse(data) {
  const response = await fetch(`${API_BASE_URL}/courses/`, {
    method: "POST",
    headers: authHeaders({
      "Content-Type": "application/json",
    }),
    body: JSON.stringify(data),
  });

  const result = await response.json().catch(() => null);

  if (!response.ok) {
    handleInvalidToken(result);
    console.error("ERREUR BACKEND CREATE COURSE :", result);
    throw new Error(
      result?.error ||
        result?.detail ||
        JSON.stringify(result) ||
        "Erreur création course"
    );
  }

  return result;
}

export async function getActiveCourse(livreurId) {
  const response = await fetch(
    `${API_BASE_URL}/courses/active/?livreur_id=${livreurId}`,
    {
      headers: authHeaders(),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    handleInvalidToken(data);
    throw new Error(data.detail || "Erreur récupération course");
  }

  return data;
}

export async function finishCourse(courseId) {
  const response = await fetch(`${API_BASE_URL}/courses/${courseId}/finish/`, {
    method: "PATCH",
    headers: authHeaders(),
  });

  const data = await response.json();

  if (!response.ok) {
    handleInvalidToken(data);
    throw new Error(data.detail || "Erreur fin course");
  }

  return data;
}

export async function updateLivreurPhoto(id, photoFile) {
  const formData = new FormData();
  formData.append("photo", photoFile);

  const response = await fetch(`${API_BASE_URL}/livreurs/${id}/`, {
    method: "PATCH",
    headers: authHeaders(),
    body: formData,
  });

  const data = await response.json();

  if (!response.ok) {
    handleInvalidToken(data);
    throw new Error(data.photo?.[0] || data.detail || "Erreur modification photo");
  }

  return data;
}

export async function getActiveCoursesForLivreur(livreurId) {
  const response = await fetch(
    `${API_BASE_URL}/courses/active/?livreur_id=${livreurId}`,
    {
      headers: authHeaders(),
    }
  );

  const result = await response.json();

  if (!response.ok) {
    handleInvalidToken(result);
    throw new Error(result?.detail || "Erreur chargement course active");
  }

  return result;
}

export async function getClientCourses() {
  const response = await fetch(`${API_BASE_URL}/courses/`, {
    headers: authHeaders(),
  });

  const data = await response.json();

  if (!response.ok) {
    handleInvalidToken(data);
    throw new Error(data.detail || "Erreur chargement historique");
  }

  return Array.isArray(data) ? data : data.results || [];
}

export async function updateClientCoursePosition(courseId, position) {
  const response = await fetch(
    `${API_BASE_URL}/courses/${courseId}/update_client_position/`,
    {
      method: "PATCH",
      headers: authHeaders({
        "Content-Type": "application/json",
      }),
      body: JSON.stringify(position),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    handleInvalidToken(data);
    throw new Error(
      data.detail || data.error || "Erreur mise à jour position client"
    );
  }

  return data;
}