export function isIOSDevice(userAgent = typeof navigator !== "undefined" ? navigator.userAgent : "") {
  return /iPhone|iPad|iPod/i.test(userAgent) ||
    (typeof navigator !== "undefined" &&
      navigator.platform === "MacIntel" &&
      typeof navigator.maxTouchPoints === "number" &&
      navigator.maxTouchPoints > 1);
}

export function isSafariBrowser(userAgent = typeof navigator !== "undefined" ? navigator.userAgent : "") {
  return /^((?!chrome|android).)*safari/i.test(userAgent) ||
    /Version\/.*Safari/i.test(userAgent);
}

export function getLocationSettingsUrl() {
  if (isIOSDevice()) {
    return [
      "app-settings:",
      "prefs:root=LOCATION_SERVICES",
      "App-Prefs:root=Privacy&path=LOCATION",
    ];
  }

  return [];
}

export function openLocationSettings() {
  const urls = getLocationSettingsUrl();

  if (!urls.length) {
    return false;
  }

  for (const url of urls) {
    try {
      window.location.href = url;
      return true;
    } catch (error) {
      console.warn("Impossible d'ouvrir les réglages de localisation", error);
    }
  }

  return false;
}

export function getLocationErrorMessage(error, isIOS = false) {
  if (!error) return "Impossible de récupérer votre position.";

  switch (error.code) {
    case 1:
      return isIOS
        ? "Safari iOS a bloqué la géolocalisation. Ouvrez Réglages > Safari > Position, puis autorisez 'Position' et réessayez."
        : "L'accès à la localisation a été refusé. Activez la position dans les paramètres du navigateur puis réessayez.";
    case 2:
      return "La localisation est indisponible sur cet appareil pour le moment.";
    case 3:
      return "Le GPS a mis trop de temps à répondre. Vérifiez votre connexion et réessayez.";
    default:
      return "La localisation n'a pas pu être récupérée. Vérifiez votre réseau et les permissions du navigateur.";
  }
}

export function requestUserPosition(options = {}) {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    return Promise.reject(new Error("La géolocalisation n'est pas supportée par ce navigateur."));
  }

  const settings = {
    enableHighAccuracy: true,
    timeout: 15000,
    maximumAge: 0,
    ...options,
  };

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, settings);
  });
}
