import React, { useMemo } from "react";
import { Bell, CarFront, Clock, WifiOff } from "lucide-react";
import LoadingSpinner from "./LoadingSpinner.jsx";
import OrderCard from "./DriverCourseCard.jsx";
import DriverOfferActions from "./DriverOfferActions.jsx";
import { groupDriverCourses } from "../utils/driverOrders.js";
export { groupDriverCourses } from "../utils/driverOrders.js";
export { default as OfferCountdown } from "./OfferCountdown.jsx";
import { canFinishCourse, getCourseStatusLabel, isDeliveryVehicle } from "../utils/courseTracking.js";



function OrdersGroup({ title, count, children, hideHeading = false }) {
  return (
    <section className="orders-group" aria-label={`${title} (${count})`}>
      {!hideHeading && <h3>
        {title} <span className="orders-count">{count}</span>
      </h3>}
      {children}
    </section>
  );
}

export default function LivreurOrders({
  livreurId,
  courses = [],
  loading = false,
  error = "",
  respondingOfferId = null,
  finishingCourseId = null,
  onAccept,
  onReject,
  onFinish,
  onRetry,
}) {
  const { ongoing, toAccept, waiting } = useMemo(
    () => groupDriverCourses(courses, livreurId),
    [courses, livreurId]
  );

  return (
    <section className="orders-board" aria-label="رحلاتي وطلباتي"
      data-scroll-step={loading ? undefined : [...toAccept, ...ongoing, ...waiting].map(course => `${course.id}:${course.status}:${course.my_offer_response || ""}`).sort().join("|")}>

      {toAccept.length === 0 && <h2 className="driver-section-title">طلباتي</h2>}

      {toAccept.length === 0 && <div className="orders-board-summary">
        <div className={'orders-tile is-offer' + (toAccept.length > 0 ? ' has-orders' : '')}>
          <Bell size={23} aria-hidden="true" />
          <strong>{loading ? "—" : toAccept.length}</strong>
          <small>جديدة</small>
        </div>
        <div className="orders-tile is-waiting">
          <Clock size={23} aria-hidden="true" />
          <strong>{loading ? "—" : waiting.length}</strong>
          <small>بانتظار الرد</small>
        </div>
        <div className="orders-tile is-ongoing">
          <CarFront size={23} aria-hidden="true" />
          <strong>{loading ? "—" : ongoing.length}</strong>
          <small>جارية</small>
        </div>
      </div>}

      {loading && <LoadingSpinner label="جاري تحميل الطلبات..." />}
      {error && <div className="driver-orders-error" role="alert"><WifiOff size={20} aria-hidden="true" />
        <span>{error}{toAccept.length + ongoing.length + waiting.length > 0 && " نعرض آخر تحديث متاح."}</span>
        {onRetry && <button className="secondary-btn small" type="button" onClick={onRetry} disabled={loading}>إعادة المحاولة</button>}
      </div>}

      {!loading && !error && toAccept.length === 0 && ongoing.length === 0 && waiting.length === 0 && (
        <div className="orders-empty">
          <span aria-hidden="true" className="orders-empty-car"><CarFront size={62} strokeWidth={1.5} /></span>
          <h3>لا توجد طلبات</h3>
        </div>
      )}

      {toAccept.length > 0 && (
        <OrdersGroup title="طلبات جديدة" count={toAccept.length} hideHeading>
          {toAccept.map((course) => (
            <OrderCard
              key={course.id}
              course={course}
              variant="offer"
              badge="طلب جديد"
              busy={respondingOfferId === course.id}
            >
              <DriverOfferActions course={course} busy={respondingOfferId !== null} requestLayout
                onAccept={onAccept} onReject={onReject} />
            </OrderCard>
          ))}
        </OrdersGroup>
      )}

      {ongoing.length > 0 && (
        <OrdersGroup title="رحلاتي الجارية" count={ongoing.length}>
          {ongoing.map((course) => (
            <OrderCard
              key={course.id}
              course={course}
              variant="ongoing"
              badge={getCourseStatusLabel(course)}
              busy={finishingCourseId === course.id}
            >
              {canFinishCourse(course) && <div className="driver-offer-actions">
                <button
                  type="button"
                  className="order-btn-finish"
                  onClick={() => onFinish?.(course.id)}
                  disabled={finishingCourseId !== null}
                >
                  {finishingCourseId === course.id ? "جارٍ الإنهاء…" : isDeliveryVehicle(course.vehicle_type) ? "تم تسليم الطلب" : "إنهاء الرحلة"}
                </button>
              </div>}
            </OrderCard>
          ))}
        </OrdersGroup>
      )}

      {waiting.length > 0 && (
        <OrdersGroup title="بانتظار الرد" count={waiting.length}>
          {waiting.map((course) => (
            <OrderCard
              key={course.id}
              course={course}
              variant="waiting"
              badge={Number(course.my_offer_price) !== Number(course.proposed_price ?? course.final_price)
                ? "تم إرسال عرضك" : "بانتظار اختيار العميل"}
              busy={respondingOfferId === course.id}
            />
          ))}
        </OrdersGroup>
      )}

    </section>
  );
}

