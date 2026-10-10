import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CarFront, CircleDot, Clock, MapPin, Route, User } from "lucide-react";
import { isDeliveryVehicle } from "../utils/courseTracking.js";
import { formatDriverNumber, getOfferPresentation } from "../utils/driverOrders.js";
import OfferCountdown from "./OfferCountdown.jsx";
import AddressLabel from "./AddressLabel.jsx";

export default function DriverCourseCard({ course, badge, variant, busy, children }) {
  const offer = variant === "offer";
  const delivery = isDeliveryVehicle(course.vehicle_type);
  const data = getOfferPresentation(course);
  const [expired, setExpired] = useState(course.my_offer_expires_in === 0);
  useEffect(() => setExpired(course.my_offer_expires_in != null && course.my_offer_expires_in <= 0), [course.my_offer_expires_in]);
  const price = course.my_offer_price ?? course.final_price ?? course.proposed_price;
  const vehicle = { voiture: "سيارة", moto: "دراجة نارية", scooter: "دراجة نارية", camion: "شاحنة" }[course.vehicle_type]
    || course.vehicle_type || "غير محددة";
  if (offer) return <article className="driver-request" aria-busy={busy || undefined} aria-label={`طلب رحلة رقم ${course.id}`}>
    <div className="driver-request-trip">
      <div className="driver-request-heading">
        <strong>{badge}</strong>
        <OfferCountdown seconds={course.my_offer_expires_in} chip onExpire={() => setExpired(true)} />
      </div>
      <Link className="driver-request-number" to={`/livreur-course/${course.id}`}>الرحلة رقم <bdi>{course.id}</bdi></Link>
      <div className="driver-request-stops">
        <div className="driver-request-stop is-pickup">
          <CircleDot size={26} aria-hidden="true" />
          <div><span>{delivery ? "نقطة الاستلام" : "نقطة الانطلاق"}</span>
            <strong><AddressLabel text={course.pickup_address || course.pickup_name || (data.pickup ? "على الخريطة" : "غير محدد")} /></strong></div>
        </div>
        <div className="driver-request-stop is-destination">
          <MapPin size={28} fill="currentColor" aria-hidden="true" />
          <div><span>{delivery ? "نقطة التسليم" : "نقطة الوصول"}</span>
            <strong><AddressLabel text={course.destination || "غير محدد"} /></strong></div>
        </div>
      </div>
      <div className="driver-request-metrics">
        <div><CarFront size={24} aria-hidden="true" /><strong>{vehicle}</strong><span>نوع المركبة</span></div>
        <div><Route size={24} aria-hidden="true" /><strong>{data.distance == null ? "—" : <><bdi>{formatDriverNumber(data.distance)}</bdi> <small>كم</small></>}</strong><span>المسافة التقريبية</span></div>
      </div>
    </div>
    <fieldset className="driver-course-controls" disabled={Boolean(busy) || expired}>{children}</fieldset>
  </article>;
  return <article className={`order-card order-card-${variant} driver-course-card`} aria-busy={busy || undefined}>
    <div className="driver-course-body">
      <div className="driver-course-heading">
        <strong><CarFront size={18} aria-hidden="true" />{badge}</strong>
        <span className="driver-vehicle-tag"><bdi>#{course.id}</bdi></span>
      </div>
      {course.client_name && <div className="driver-client-heading driver-client-summary">
        <span className="driver-client-avatar">
          {course.client_photo ? <img src={course.client_photo} alt={course.client_name} /> : <User size={20} aria-hidden="true" />}
        </span>
        <div><strong>{course.client_name}</strong>
          <span>{course.client_rating == null ? "لا توجد تقييمات بعد" : `★ ${course.client_rating} / 5 · ${course.client_review_count} تقييم`}</span>
        </div>
      </div>}
      <div className="driver-course-price">
        <strong><bdi>{formatDriverNumber(price)}</bdi> <small>دج</small></strong>
        <span>السعر</span>
      </div>
      <div className="driver-course-stops">
        <div className="driver-course-stop is-pickup">
          <MapPin size={22} aria-hidden="true" />
          <div><span>{delivery ? "الاستلام" : "الانطلاق"}</span>
            <p><AddressLabel text={course.pickup_address || course.pickup_name || (data.pickup ? "على الخريطة" : "غير محدد")} /></p></div>
        </div>
        <div className="driver-course-stop is-destination">
          <MapPin size={22} aria-hidden="true" />
          <div><span>{delivery ? "التسليم" : "الوصول"}</span><p><AddressLabel text={course.destination || "غير محدد"} /></p></div>
        </div>
      </div>
      <div className="driver-course-metrics">
        {data.distance != null && <span><Route size={17} aria-hidden="true" /><bdi>{formatDriverNumber(data.distance)}</bdi> كم</span>}
        <span><CarFront size={17} aria-hidden="true" />{vehicle}</span>
        {data.minutes != null && <span><Clock size={17} aria-hidden="true" /><bdi>{formatDriverNumber(data.minutes)}</bdi> د</span>}
      </div>
      <fieldset className="driver-course-controls" disabled={Boolean(busy)}>{children}</fieldset>
      <Link className="order-btn order-btn-main" to={`/livreur-course/${course.id}`}>متابعة</Link>
    </div>
  </article>;
}
