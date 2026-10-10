import React, { useState } from "react";
import { Check, Info, X } from "lucide-react";
import PriceAdjuster from "./PriceAdjuster.jsx";
import { formatDriverNumber } from "../utils/driverOrders.js";
import { adjustCoursePrice, MIN_COURSE_PRICE_DZD, PRICE_ADJUSTMENT_DZD } from "../utils/priceAdjustment.js";

export default function DriverOfferActions({ course, busy, onAccept, onReject, requestLayout = false }) {
  const initialPrice = course.proposed_price ?? course.final_price ?? "";
  const [price, setPrice] = useState(String(initialPrice));
  const amount = Number(price);
  const valid = /^\d+(?:\.\d{1,2})?$/.test(price) && Number.isFinite(amount)
    && amount >= MIN_COURSE_PRICE_DZD && amount <= 99999999.99;
  const changed = valid && amount !== Number(initialPrice);

  return <div className={`driver-offer-price-actions${requestLayout ? " is-request-layout" : ""}`} dir="rtl">
    <div className="driver-offer-price-panel">
      {requestLayout && <div className="driver-request-client-price">
        <span>السعر المقترح من الزبون</span>
        <strong><bdi>{formatDriverNumber(initialPrice)}</bdi> دج</strong>
      </div>}
      <PriceAdjuster price={price} onPriceChange={setPrice}
        onAdjustPrice={(step) => setPrice((current) => adjustCoursePrice(current, initialPrice, step))}
        minPrice={MIN_COURSE_PRICE_DZD} priceStep={PRICE_ADJUSTMENT_DZD}
        busy={busy} inputId={`driver-offer-price-${course.id}`} caption="سعرك المقترح" captionInside={requestLayout}
        error={!valid ? `أدخل سعراً صحيحاً لا يقل عن ${MIN_COURSE_PRICE_DZD} دج.` : ""} />
      {requestLayout && <p className="driver-request-price-hint"><Info size={16} aria-hidden="true" />يمكنك قبول سعر الزبون أو تعديله</p>}
    </div>
    <div className="driver-offer-actions" dir="rtl">
      <button type="button" onClick={() => onAccept?.(course.id, price)} disabled={busy || !valid}>
        {requestLayout && <Check size={22} aria-hidden="true" />}
        {busy ? "جارٍ الإرسال…" : changed ? "إرسال العرض" : "قبول الطلب"}
      </button>
      <button type="button" onClick={() => onReject?.(course.id)} disabled={busy}>
        {requestLayout && <X size={22} aria-hidden="true" />}رفض
      </button>
    </div>
  </div>;
}
