import React, { useState } from "react";

export default function DriverOfferActions({ course, busy, onAccept, onReject }) {
  const [price, setPrice] = useState(String(course.final_price ?? course.proposed_price ?? ""));
  const amount = Number(price);
  const valid = /^\d+(?:\.\d{1,2})?$/.test(price) && Number.isFinite(amount)
    && amount >= 100 && amount <= 99999999.99;

  return <div className="driver-offer-price-actions">
    <label className="driver-offer-price-label">
      <span>سعرك (دج)</span>
      <input type="number" min="100" max="99999999.99" step="0.01" inputMode="decimal"
        value={price} onChange={(event) => setPrice(event.target.value)} disabled={busy} />
    </label>
    {!valid && <span className="driver-offer-price-error">أدخل سعراً صحيحاً لا يقل عن 100 دج.</span>}
    <div className="driver-offer-actions" dir="rtl">
      <button type="button" onClick={() => onAccept?.(course.id, price)} disabled={busy || !valid}>
        {busy ? "جارٍ الإرسال…" : "قبول وإرسال السعر"}
      </button>
      <button type="button" onClick={() => onReject?.(course.id)} disabled={busy}>رفض</button>
    </div>
  </div>;
}
