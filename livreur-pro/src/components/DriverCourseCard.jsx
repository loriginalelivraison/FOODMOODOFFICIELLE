import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Bell, CarFront, Clock, MapPin, Route } from "lucide-react";
import { isDeliveryVehicle } from "../utils/courseTracking.js";
import { formatDriverNumber, getOfferPresentation } from "../utils/driverOrders.js";
import DriverOfferMap from "./DriverOfferMap.jsx";
import OfferCountdown from "./OfferCountdown.jsx";
import AddressLabel from "./AddressLabel.jsx";

export default function DriverCourseCard({ course, badge, variant, busy, children }) {
  const offer = variant === "offer";
  const delivery = isDeliveryVehicle(course.vehicle_type);
  const data = getOfferPresentation(course);
  const [expired, setExpired] = useState(course.my_offer_expires_in === 0);
  useEffect(() => setExpired(course.my_offer_expires_in != null && course.my_offer_expires_in <= 0), [course.my_offer_expires_in]);
  const price = offer ? course.final_price ?? data.price : course.my_offer_price ?? course.final_price ?? course.proposed_price;
  return <article className={`order-card order-card-${variant} driver-course-card`} aria-busy={busy || undefined}>
    {offer && <DriverOfferMap route={data.route} pickup={data.pickup} destination={data.destination} />}
    <div className="driver-course-body">
      <div className="driver-course-heading">
        <strong>{offer ? <Bell size={18} aria-hidden="true" /> : <CarFront size={18} aria-hidden="true" />}{badge}</strong>
        <span className="driver-vehicle-tag">{delivery ? "توصيل طلب" : "رحلة"} · <bdi>#{course.id}</bdi></span>
      </div>
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
        {data.minutes != null && <span><Clock size={17} aria-hidden="true" /><bdi>{formatDriverNumber(data.minutes)}</bdi> د</span>}
      </div>
      <fieldset className="driver-course-controls" disabled={Boolean(busy) || (offer && expired)}>{children}</fieldset>
      {offer && <OfferCountdown seconds={course.my_offer_expires_in} progress onExpire={() => setExpired(true)} />}
      <Link className={offer ? "driver-course-details" : "order-btn order-btn-main"} to={`/livreur-course/${course.id}`}>
        {offer ? "التفاصيل" : "متابعة"}
      </Link>
    </div>
  </article>;
}
