import React from "react";
import { CircleX } from "lucide-react";

export default function CourseCancelledState({ isDelivery, isDriver = false, onContinue }) {
  return (
    <section className="page" dir="rtl">
      <div className="course-cancelled-state">
        <CircleX className="course-cancelled-icon" size={40} aria-hidden="true" />
        <h1>{isDelivery ? "تم إلغاء الطلب" : "تم إلغاء الرحلة"}</h1>
        <p>{isDriver ? "يمكنك العودة إلى طلباتك للمتابعة." : "يمكنك إنشاء طلب جديد متى أردت."}</p>
        <button className="course-request-submit" type="button" onClick={onContinue}>
          الرئيسية
        </button>
      </div>
    </section>
  );
}
