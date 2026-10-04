import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import LoadingSpinner from "./LoadingSpinner.jsx";

const OFFER_STATUSES = ["searching", "driver_accepted"];
const CLOSED_STATUSES = ["completed", "cancelled"];

const STATUS_LABELS = {
  searching: "جارٍ البحث عن سائق",
  driver_accepted: "في انتظار اختيار الزبون",
  driver_selected: "تم تأكيد السائق",
  driver_arriving: "في الطريق إلى الزبون",
  driver_arrived: "وصلت إلى الزبون",
  in_progress: "الرحلة جارية",
  completed: "مكتملة",
  cancelled: "ملغاة",
};

const ONGOING_HINTS = {
  driver_selected: "الزبون في انتظارك، انطلق نحو موقعه.",
  driver_arriving: "الزبون في انتظارك، أكمل الطريق.",
  driver_arrived: "أبلغ الزبون بوصولك وانتظر بدء الرحلة.",
  in_progress: "الرحلة جارية، توجه إلى الوجهة.",
};

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

  return (
    <div className="order-card-summary">
      {course.destination && (
        <span className="order-card-line">
          <span aria-hidden="true">🎯</span> {course.destination}
        </span>
      )}
      <span className="order-card-line">
        <span aria-hidden="true">📍</span>{" "}
        {course.client_latitude != null && course.client_longitude != null
          ? `${course.client_latitude}, ${course.client_longitude}`
          : "موقع الزبون غير متوفر"}
      </span>
      {course.estimated_distance_km != null && (
        <span className="order-card-line">
          <span aria-hidden="true">📏</span> {course.estimated_distance_km} كم
        </span>
      )}
      <span className="order-card-line">
        <span aria-hidden="true">🕒</span> {formatOrderTime(course.created_at)}
      </span>
      {price && (
        <span className="order-card-line order-card-price">
          <span aria-hidden="true">💰</span> {price}
        </span>
      )}
    </div>
  );
}


function OrderCard({ course, badge, hint, variant, busy = false, children }) {
  const navigate = useNavigate();

  return (
    <article className={`order-card order-card-${variant}`}>
      <div className="order-card-head">
        <strong>رحلة رقم {course.id}</strong>
        <span className={`order-status order-status-${variant}`}>{badge}</span>
      </div>

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
          <span aria-hidden="true">🚗</span>
          <strong>{ongoing.length}</strong>
          <small>رحلات جارية</small>
        </div>
        <div className="orders-tile is-offer">
          <span aria-hidden="true">🔔</span>
          <strong>{toAccept.length}</strong>
          <small>طلبات يمكنني قبولها</small>
        </div>
        <div className="orders-tile is-waiting">
          <span aria-hidden="true">⏳</span>
          <strong>{waiting.length}</strong>
          <small>في انتظار الزبون</small>
        </div>
      </div>

      {loading && <LoadingSpinner label="جاري تحميل الطلبات..." />}

      {!loading && toAccept.length === 0 && ongoing.length === 0 && waiting.length === 0 && (
        <p className="account-empty">
          لا توجد طلبات حالياً. فعّل مشاركة الموقع لتصل إليك الرحلات الجديدة.
        </p>
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
              badge={STATUS_LABELS[course.status] || "الرحلة نشطة"}
              hint={ONGOING_HINTS[course.status] || "تابع الرحلة من صفحة الرحلة."}
              busy={finishingCourseId === course.id}
            >
              <div className="driver-offer-actions">
                <button
                  type="button"
                  className="order-btn-finish"
                  onClick={() => onFinish?.(course.id)}
                  disabled={finishingCourseId !== null}
                >
                  {finishingCourseId === course.id ? "جارٍ الإنهاء…" : "إنهاء الرحلة"}
                </button>
              </div>
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

