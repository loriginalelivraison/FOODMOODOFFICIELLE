import React, { useMemo } from "react";
import { Bell, CarFront, Check, Clock, WifiOff, X } from "lucide-react";
import LoadingSpinner from "./LoadingSpinner.jsx";
import OrderCard from "./DriverCourseCard.jsx";
import { groupDriverCourses } from "../utils/driverOrders.js";
export { groupDriverCourses } from "../utils/driverOrders.js";
export { default as OfferCountdown } from "./OfferCountdown.jsx";
import { canFinishCourse, getCourseStatusLabel, getDriverCourseHint, isDeliveryVehicle } from "../utils/courseTracking.js";



function OrdersGroup({ title, count, children }) {
  return (
    <div className={"orders-group" + (count === 1 ? " has-single-course" : "")}>
      <h3>
        {title} <span className="orders-count">{count}</span>
      </h3>
      {children}
    </div>
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

      <div className="orders-board-summary">
        <div className={'orders-tile is-offer' + (toAccept.length > 0 ? ' has-orders' : '')}>
          <Bell size={23} aria-hidden="true" />
          <strong>{loading ? "—" : toAccept.length}</strong>
          <small>طلبات جديدة</small>
        </div>
        <div className="orders-tile is-waiting">
          <Clock size={23} aria-hidden="true" />
          <strong>{loading ? "—" : waiting.length}</strong>
          <small>في الانتظار</small>
        </div>
        <div className="orders-tile is-ongoing">
          <CarFront size={23} aria-hidden="true" />
          <strong>{loading ? "—" : ongoing.length}</strong>
          <small>رحلات جارية</small>
        </div>
      </div>

      {loading && <LoadingSpinner label="جاري تحميل الطلبات..." />}
      {error && <div className="driver-orders-error" role="alert"><WifiOff size={20} aria-hidden="true" />
        <span>{error}{toAccept.length + ongoing.length + waiting.length > 0 && " نعرض آخر تحديث متاح."}</span>
        {onRetry && <button className="secondary-btn small" type="button" onClick={onRetry} disabled={loading}>إعادة المحاولة</button>}
      </div>}

      {!loading && !error && toAccept.length === 0 && ongoing.length === 0 && waiting.length === 0 && (
        <div className="orders-empty">
          <span aria-hidden="true" className="orders-empty-car"><CarFront size={62} strokeWidth={1.5} /></span>
          <h3>لا توجد طلبات حالياً</h3>
          <p>ستظهر الطلبات الجديدة هنا.</p>
        </div>
      )}

      {toAccept.length > 0 && (
        <OrdersGroup title="طلبات جديدة" count={toAccept.length}>
          {toAccept.map((course) => (
            <OrderCard
              key={course.id}
              course={course}
              variant="offer"
              badge="طلب جديد"
              hint="راجع تفاصيل الرحلة ثم اقبل أو ارفض."
              busy={respondingOfferId === course.id}
            >
              <div className="driver-offer-actions">
                <button
                  type="button"
                  onClick={() => onAccept?.(course.id)}
                  disabled={respondingOfferId !== null}
                >
                  <Check size={21} aria-hidden="true" />{respondingOfferId === course.id ? "جارٍ الإرسال…" : "قبول"}
                </button>
                <button
                  type="button"
                  onClick={() => onReject?.(course.id)}
                  disabled={respondingOfferId !== null}
                >
                  <X size={21} aria-hidden="true" />رفض
                </button>
              </div>
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
              hint={getDriverCourseHint(course)}
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
        <OrdersGroup title="في انتظار اختيار الزبون" count={waiting.length}>
          {waiting.map((course) => (
            <OrderCard
              key={course.id}
              course={course}
              variant="waiting"
              badge="تم إرسال قبولك"
              hint="بانتظار أن يختارك الزبون. سنحدّث الرحلة هنا عند اختياره."
              busy={respondingOfferId === course.id}
            />
          ))}
        </OrdersGroup>
      )}

    </section>
  );
}

