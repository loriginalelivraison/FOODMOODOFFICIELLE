import React, { useEffect, useRef } from "react";
import { CircleX } from "lucide-react";
import { cancellationMessage } from "../utils/cancellation.js";

export default function CourseCancelledState({ isDelivery, isDriver = false, cancelledBy, onContinue }) {
  const continueRef = useRef(onContinue);
  continueRef.current = onContinue;
  useEffect(() => {
    const timeout = setTimeout(() => continueRef.current(), 6000);
    return () => clearTimeout(timeout);
  }, []);
  return (
    <section className="page" dir="rtl">
      <div className="course-cancelled-state" data-scroll-step="cancelled">
        <CircleX className="course-cancelled-icon" size={40} aria-hidden="true" />
        <h1>{isDelivery ? "تم إلغاء الطلب" : "تم إلغاء الرحلة"}</h1>
        <p role="status">{cancellationMessage(cancelledBy, isDriver)}</p>
        <button className="course-request-submit" type="button" onClick={onContinue}>
          الرئيسية
        </button>
      </div>
    </section>
  );
}
