import React from "react";
import { Minus, Plus } from "lucide-react";
import "./booking-summary.css";

export default function PriceAdjuster({ price, onPriceChange, onAdjustPrice, minPrice, priceStep, busy, caption, inputId, error }) {
  return <div className="booking-summary-price">
    <div className="booking-summary-stepper" dir="ltr">
      <button type="button" aria-label="خفض السعر" title="خفض السعر"
        disabled={busy || Number(price) <= minPrice} onClick={() => onAdjustPrice(-priceStep)}>
        <Minus size={22} aria-hidden="true" />
      </button>
      <label className="booking-summary-amount" dir="rtl">
        <input id={inputId} type="number" value={price} onChange={event => onPriceChange(event.target.value)}
          style={{ width: `${Math.max(3, String(price).length)}ch` }}
          min={minPrice} step="1" required disabled={busy} aria-label="السعر المقترح بالدينار الجزائري"
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={error ? `${inputId}-error` : undefined} />
        <span aria-hidden="true">دج</span>
      </label>
      <button type="button" aria-label="زيادة السعر" title="زيادة السعر"
        disabled={busy} onClick={() => onAdjustPrice(priceStep)}>
        <Plus size={22} aria-hidden="true" />
      </button>
    </div>
    <span className="booking-summary-price-caption">{caption}</span>
    {error && <small id={`${inputId}-error`} className="course-price-error">{error}</small>}
  </div>;
}
