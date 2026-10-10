import React from "react";
import { useLocation } from "react-router-dom";
import { getHomePath } from "../utils/navigation.js";

export default function RouteRecovery() {
  const location = useLocation();
  const homePath = getHomePath();
  const destination = location.pathname === homePath && !location.search ? "/livreurs" : homePath;
  return (
    <section className="page centered-page" dir="rtl">
      <p role="alert">تعذر عرض هذه الصفحة. حاول مرة أخرى أو عد إلى الرئيسية.</p>
      <button className="secondary-btn" type="button" onClick={() => window.location.reload()}>إعادة المحاولة</button>
      <a className="primary-btn" href={destination}>العودة إلى الرئيسية</a>
    </section>
  );
}
