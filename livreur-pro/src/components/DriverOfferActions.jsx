import React, { useState } from "react";
import PriceAdjuster from "./PriceAdjuster.jsx";
import { adjustCoursePrice, MIN_COURSE_PRICE_DZD, PRICE_ADJUSTMENT_DZD } from "../utils/priceAdjustment.js";

export default function DriverOfferActions({ course, busy, onAccept, onReject }) {
  const initialPrice = course.proposed_price ?? course.final_price ?? "";
  const [price, setPrice] = useState(String(initialPrice));
  const amount = Number(price);
  const valid = /^\d+(?:\.\d{1,2})?$/.test(price) && Number.isFinite(amount)
    && amount >= MIN_COURSE_PRICE_DZD && amount <= 99999999.99;
  const changed = valid && amount !== Number(initialPrice);

  return <div className="driver-offer-price-actions" dir="rtl">
    <PriceAdjuster price={price} onPriceChange={setPrice}
      onAdjustPrice={(step) => setPrice((current) => adjustCoursePrice(current, initialPrice, step))}
      minPrice={MIN_COURSE_PRICE_DZD} priceStep={PRICE_ADJUSTMENT_DZD}
      busy={busy} inputId={`driver-offer-price-${course.id}`} caption="سعرك المقترح"
      error={!valid ? `أدخل سعراً صحيحاً لا يقل عن ${MIN_COURSE_PRICE_DZD} دج.` : ""} />
    <div className="driver-offer-actions" dir="rtl">
      <button type="button" onClick={() => onAccept?.(course.id, price)} disabled={busy || !valid}>
        {busy ? "جارٍ الإرسال…" : changed ? "إرسال العرض" : "قبول الطلب"}
      </button>
      <button type="button" onClick={() => onReject?.(course.id)} disabled={busy}>رفض</button>
    </div>
  </div>;
}
