import React from "react";
import { CarFront, Clock, MapPin, Route } from "lucide-react";
import AddressLabel from "./AddressLabel.jsx";
import PriceAdjuster from "./PriceAdjuster.jsx";
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

    <PriceAdjuster price={price} onPriceChange={onPriceChange} onAdjustPrice={onAdjustPrice}
      minPrice={minPrice} priceStep={priceStep} busy={busy} inputId="booking-price"
      caption="السعر المقترح" error={belowMinimum ? `الحد الأدنى للسعر هو ${minPrice} دج.` : ""} />

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
