import React, { useEffect } from "react";
import { getHomePath } from "../utils/navigation.js";

export default function RouteRecovery() {
  const destination = getHomePath();
  useEffect(() => {
    // Reload the destination to reset the router's failed render.
    if (window.location.pathname !== destination) window.location.replace(destination);
  }, [destination]);
  return (
    <section className="page centered-page" dir="rtl">
      <p role="status">يمكنك العودة إلى الرئيسية ومتابعة استخدام التطبيق.</p>
      <a className="primary-btn" href={destination}>العودة إلى الرئيسية</a>
    </section>
  );
}
