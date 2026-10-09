import React from "react";
import { CarFront, Clock, MapPin, Minus, Plus, Route } from "lucide-react";
import AddressLabel from "./AddressLabel.jsx";
import { formatDriverNumber } from "../utils/driverOrders.js";
import "./booking-summary.css";

export default function BookingSummary({ quote, pickup, destination, isDelivery, price, onPriceChange, onAdjustPrice, minPrice, priceStep, busy }) {
  const distance = quote.trip_distance_km ?? quote.estimated_distance_km;
  const minutes = quote.dropoff_eta_minutes;
  const belowMinimum = price !== "" && Number(price) < minPrice;

  return <article className="booking-summary" data-scroll-step="booking-summary" aria-labelledby="booking-summary-title" dir="rtl">
    <header className="booking-summary-heading">
      <h2 id="booking-summary-title"><CarFront size={18} aria-hidden="true" />{isDelivery ? "ملخص التوصيل" : "ملخص الرحلة"}</h2>
      <span>{isDelivery ? "توصيل طلب" : "رحلة"}</span>
    </header>

    <div className="booking-summary-price">
      <div className="booking-summary-stepper" dir="ltr">
        <button type="button" aria-label="خفض السعر" title="خفض السعر"
          disabled={busy || Number(price) <= minPrice} onClick={() => onAdjustPrice(-priceStep)}>
          <Minus size={22} aria-hidden="true" />
        </button>
        <label className="booking-summary-amount" dir="rtl">
          <input id="booking-price" type="number" value={price} onChange={event => onPriceChange(event.target.value)}
            style={{ width: `${Math.max(3, String(price).length)}ch` }}
            min={minPrice} step="1" required aria-label="السعر المقترح بالدينار الجزائري"
            aria-invalid={belowMinimum || undefined}
            aria-describedby={belowMinimum ? "booking-price-error" : undefined} />
          <span aria-hidden="true">دج</span>
        </label>
        <button type="button" aria-label="زيادة السعر" title="زيادة السعر"
          disabled={busy} onClick={() => onAdjustPrice(priceStep)}>
          <Plus size={22} aria-hidden="true" />
        </button>
      </div>
      <span className="booking-summary-price-caption">السعر المقترح</span>
      {belowMinimum && <small id="booking-price-error" className="course-price-error">الحد الأدنى للسعر هو {minPrice} دج.</small>}
    </div>

    <div className="booking-summary-stops">
      <div className="booking-summary-stop is-pickup">
        <MapPin size={22} aria-hidden="true" />
        <div><span>{isDelivery ? "الاستلام" : "الانطلاق"}</span><p><AddressLabel text={pickup} /></p></div>
      </div>
      <div className="booking-summary-stop is-destination">
        <MapPin size={22} aria-hidden="true" />
        <div><span>{isDelivery ? "التسليم" : "الوصول"}</span><p><AddressLabel text={destination} /></p></div>
      </div>
    </div>

    <div className="booking-summary-metrics">
      <span><Route size={17} aria-hidden="true" />{distance == null ? "المسافة غير متوفرة" : <><bdi>{formatDriverNumber(distance)}</bdi> كم</>}</span>
      <span><Clock size={17} aria-hidden="true" />{minutes == null ? "المدة غير متوفرة" : <><bdi>{formatDriverNumber(minutes)}</bdi> دقيقة تقريباً</>}</span>
    </div>
  </article>;
}
