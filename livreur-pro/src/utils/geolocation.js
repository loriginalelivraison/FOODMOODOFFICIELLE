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

export function getLocationSettingsUrl(userAgent = typeof navigator !== "undefined" ? navigator.userAgent : "") {
  if (isIOSDevice(userAgent)) {
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
  if (!error) return "تعذر تحديد موقعك.";

  switch (error.code) {
    case 1:
      return isIOS
        ? "من إعدادات Safari، اسمح بالوصول إلى الموقع ثم أعد المحاولة."
        : "تم رفض إذن تحديد الموقع. فعّل الموقع من إعدادات المتصفح ثم أعد المحاولة.";
    case 2:
      return "خدمة الموقع غير متاحة على هذا الجهاز حالياً.";
    case 3:
      return "استغرق تحديد الموقع وقتاً طويلاً. تحقق من الاتصال ثم أعد المحاولة.";
    default:
      return "تعذر تحديد الموقع. تحقق من الاتصال وأذونات المتصفح.";
  }
}

export function requestUserPosition(options = {}) {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    return Promise.reject(new Error("الموقع الجغرافي غير مدعوم في هذا المتصفح."));
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
