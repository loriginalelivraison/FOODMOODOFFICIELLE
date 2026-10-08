import { useEffect, useState } from "react";
import { updateLivreurPosition } from "../livreursapi.js";

// Le tableau de bord a son propre suivi ; la page course prend le relais.
export default function useDriverCourseLocation(course) {
  const [locationError, setLocationError] = useState("");
  const driverId = course?.livreur;
  const active = Boolean(course?.active && !["completed", "cancelled"].includes(course.status));

  useEffect(() => {
    if (!driverId || !active || localStorage.getItem("role") !== "livreur") return;
    let driver;
    try { driver = JSON.parse(localStorage.getItem("livreur") || "{}"); } catch { return; }
    if (String(driver.id) !== String(driverId)) return;
    if (!navigator.geolocation) {
      setLocationError("الموقع الجغرافي غير مدعوم في هذا المتصفح.");
      return;
    }
    let cancelled = false;
    let sending = false;
    let lastSent = 0;
    const watchId = navigator.geolocation.watchPosition(async ({ coords }) => {
      if (cancelled || sending || Date.now() - lastSent < 5000) return;
      sending = true;
      lastSent = Date.now();
      try {
        await updateLivreurPosition(driverId, { latitude: coords.latitude, longitude: coords.longitude });
        if (!cancelled) setLocationError("");
      } catch {
        if (!cancelled) setLocationError("تعذر إرسال موقعك. تحقق من اتصال الإنترنت.");
      } finally {
        sending = false;
      }
    }, () => {
      if (!cancelled) setLocationError("فعّل مشاركة الموقع ليتمكن العميل من متابعة تقدمك.");
    }, { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 });

    return () => {
      cancelled = true;
      navigator.geolocation.clearWatch(watchId);
    };
  }, [driverId, active]);

  return active ? locationError : "";
}
