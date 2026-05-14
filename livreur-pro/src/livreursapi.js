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
  const url = `${API_BASE_URL}/livreurs/register/`;

  const response = await fetch(url, {
    method: "POST",
    body: livreur
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
  const token = localStorage.getItem("access");

  const response = await fetch(`${API_BASE_URL}/clients/`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    console.error("Erreur récupération client :", data);
    throw new Error(data.detail || "Erreur récupération client");
  }

  const clients = Array.isArray(data) ? data : data.results || [];

  const clean = (value) => String(value || "").replace(/\s/g, "");

  return clients.find(
    (client) => clean(client.telephone) === clean(telephone)
  );
}
//supprimer un compte livreur 
export async function deleteLivreur(id) {
  const token = localStorage.getItem("access");

  const response = await fetch(`${API_BASE_URL}/livreurs/${id}/`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || "Erreur suppression compte livreur");
  }

  return true;
}
//supprimer un compte client 
export async function deleteClient(id) {
  const token = localStorage.getItem("access");

  const response = await fetch(`${API_BASE_URL}/clients/${id}/`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error("Impossible de supprimer le compte client");
  }

  return true;
}

export async function createCourse(data) {
  const token = localStorage.getItem("access");

  const response = await fetch(`${API_BASE_URL}/courses/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  const result = await response.json().catch(() => null);

  if (!response.ok) {
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
// récupérer course active livreur
export async function getActiveCourse(livreurId) {
  const response = await fetch(
    `${API_BASE_URL}/courses/active/?livreur_id=${livreurId}`
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.detail || "Erreur récupération course");
  }

  return data;
}

// terminer course
export async function finishCourse(courseId) {
  const token = localStorage.getItem("access");

  const response = await fetch(
    `${API_BASE_URL}/courses/${courseId}/finish/`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.detail || "Erreur fin course");
  }

  return data;
}

export async function updateLivreurPhoto(id, photoFile) {
  const token = localStorage.getItem("access");

  const formData = new FormData();
  formData.append("photo", photoFile);

  const response = await fetch(`${API_BASE_URL}/livreurs/${id}/`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.photo?.[0] || data.detail || "Erreur modification photo");
  }

  return data;
}
export async function getActiveCoursesForLivreur(livreurId) {
  const token = localStorage.getItem("access");

  const response = await fetch(
    `${API_BASE_URL}/courses/active/?livreur_id=${livreurId}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result?.detail || "Erreur chargement course active");
  }

  return result;
}

export async function getClientCourses() {
  const token = localStorage.getItem("access");

  const response = await fetch(`${API_BASE_URL}/courses/`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.detail || "Erreur chargement historique");
  }

  return Array.isArray(data) ? data : data.results || [];
}