import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, CarFront, Clock, MapPin } from "lucide-react";
import LoadingSpinner from "./LoadingSpinner.jsx";
import { canFinishCourse, getCourseStatusLabel, getDriverCourseHint, getPickupPosition, isDeliveryVehicle } from "../utils/courseTracking.js";

const OFFER_STATUSES = ["searching", "driver_accepted"];
const CLOSED_STATUSES = ["completed", "cancelled"];

/**
 * Compte à rebours de l'offre (minuterie façon Uber) : propose au livreur
 * un nombre de secondes décroissant avant que l'offre ne soit retirée.
 */
export function OfferCountdown({ seconds }) {
  const [remaining, setRemaining] = useState(seconds);

  useEffect(() => {
    setRemaining(seconds);
  }, [seconds]);

  useEffect(() => {
    if (remaining == null) return undefined;
    if (remaining <= 0) return undefined;

    const interval = setInterval(() => {
      setRemaining((value) => (value == null ? value : Math.max(0, value - 1)));
    }, 1000);

    return () => clearInterval(interval);
  }, [remaining]);

  if (remaining == null) return null;

  return (
    <span
      className={`offer-countdown ${remaining <= 10 ? "is-urgent" : ""}`}
      aria-live="polite"
    >
      ⏱ {remaining} ثانية
    </span>
  );
}

export function coursePrice(course) {
  const price = course?.final_price ?? course?.proposed_price;
  return price == null ? null : `${price} دج`;
}

export function formatOrderTime(value) {
  if (!value) return "غير متوفر";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "غير متوفر";
  return date.toLocaleTimeString("ar-DZ", { hour: "2-digit", minute: "2-digit" });
}

export function groupDriverCourses(courses, livreurId) {
  const ongoing = [];
  const toAccept = [];
  const waiting = [];

  (Array.isArray(courses) ? courses : []).forEach((course) => {
    if (!course) return;

    const isMine =
      course.livreur != null && Number(course.livreur) === Number(livreurId);
    const isOpenOffer = !course.livreur && OFFER_STATUSES.includes(course.status);

    if (isMine && !CLOSED_STATUSES.includes(course.status)) {
      ongoing.push(course);
      return;
    }

    if (isOpenOffer) {
      if (course.my_offer_response === "pending") {
        toAccept.push(course);
      } else if (course.my_offer_response === "accepted") {
        waiting.push(course);
      }
    }
  });

  return { ongoing, toAccept, waiting };
}

function OrderSummary({ course }) {
  const price = coursePrice(course);
  const pickup = getPickupPosition(course);
  const delivery = isDeliveryVehicle(course.vehicle_type);

  return (
    <div className="order-card-summary">
      {price && <strong className="order-card-line order-card-price">{price}</strong>}
      <span className="order-card-line order-card-pickup">
        <MapPin size={20} aria-hidden="true" />
        {delivery ? "الاستلام" : "الانطلاق"}: {course.pickup_address || course.pickup_name
          || (pickup ? "موقع الانطلاق على الخريطة" : "الموقع غير متوفر")}
      </span>
      {course.destination && (
        <span className="order-card-line order-card-dropoff">
          <MapPin size={20} aria-hidden="true" /> {delivery ? "التسليم" : "الوصول"}: {course.destination}
        </span>
      )}
      {course.estimated_distance_km != null && (
        <span className="order-card-line">
          <span aria-hidden="true">📏</span> {course.estimated_distance_km} كم
        </span>
      )}
      <span className="order-card-line">
        <span aria-hidden="true">🕒</span> {formatOrderTime(course.created_at)}
      </span>
    </div>
  );
}


function OrderCard({ course, badge, hint, variant, busy = false, children }) {
  const navigate = useNavigate();

  return (
    <article className={`order-card order-card-${variant}`}>
      <div className="order-card-head">
        <strong>{isDeliveryVehicle(course.vehicle_type) ? "طلب توصيل رقم" : "رحلة رقم"} {course.id}</strong>
        <span className={`order-status order-status-${variant}`}>{badge}</span>
      </div>

      {variant === "offer" && (
        <OfferCountdown seconds={course.my_offer_expires_in} />
      )}

      <OrderSummary course={course} />

      {hint && <p className="order-card-hint">{hint}</p>}

      {children}

      <div className="order-card-actions">
        <button
          type="button"
          className="order-btn order-btn-main"
          onClick={() => navigate(`/livreur-course/${course.id}`)}
          disabled={busy}
        >
          فتح الرحلة
        </button>
      </div>
    </article>
  );
}

function OrdersGroup({ title, count, children }) {
  return (
    <div className="orders-group">
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
  respondingOfferId = null,
  finishingCourseId = null,
  onAccept,
  onReject,
  onFinish,
}) {
  const { ongoing, toAccept, waiting } = useMemo(
    () => groupDriverCourses(courses, livreurId),
    [courses, livreurId]
  );

  return (
    <section className="account-card orders-board" aria-live="polite">
      <h2>
        <span aria-hidden="true">🧭</span>
        رحلاتي وطلباتي
      </h2>

      <div className="orders-board-summary">
        <div className="orders-tile is-ongoing">
          <CarFront size={24} aria-hidden="true" />
          <strong>{ongoing.length}</strong>
          <small>رحلات جارية</small>
        </div>
        <div className="orders-tile is-offer">
          <Bell size={24} aria-hidden="true" />
          <strong>{toAccept.length}</strong>
          <small>طلبات يمكنني قبولها</small>
        </div>
        <div className="orders-tile is-waiting">
          <Clock size={24} aria-hidden="true" />
          <strong>{waiting.length}</strong>
          <small>في انتظار الزبون</small>
        </div>
      </div>

      {loading && <LoadingSpinner label="جاري تحميل الطلبات..." />}

      {!loading && toAccept.length === 0 && ongoing.length === 0 && waiting.length === 0 && (
        <div className="orders-empty">
          <span aria-hidden="true" className="orders-empty-car"><CarFront size={62} strokeWidth={1.5} /></span>
          <h3>لا توجد طلبات حالياً</h3>
          <p>ستظهر الطلبات الجديدة هنا.<br />فعّل استقبال الطلبات والإشعارات.</p>
        </div>
      )}

      {toAccept.length > 0 && (
        <p className="orders-board-alert">
          لديك {toAccept.length} طلب جديد بانتظار ردك. اقبل أو ارفض بسرعة.
        </p>
      )}

      {toAccept.length > 0 && (
        <OrdersGroup title="طلبات يمكنني قبولها" count={toAccept.length}>
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
                  {respondingOfferId === course.id ? "جارٍ الإرسال…" : "قبول"}
                </button>
                <button
                  type="button"
                  onClick={() => onReject?.(course.id)}
                  disabled={respondingOfferId !== null}
                >
                  رفض
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

      {ongoing.length + toAccept.length + waiting.length > 0 && (
        <p className="orders-board-footnote">
          يتم تحديث الطلبات تلقائياً. السجل الكامل متاح أسفل الصفحة.
        </p>
      )}
    </section>
  );
}

