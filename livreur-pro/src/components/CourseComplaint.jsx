import { useId, useRef, useState } from "react";
import { getCourseComplaint, submitCourseComplaint } from "../livreursapi.js";

const reasons = {
  client: [
    ["driver_delay", "تأخر السائق"],
    ["driver_behavior", "تعامل السائق"],
    ["price", "سعر الرحلة أو الطلب"],
    ["payment", "مشكلة في الدفع"],
    ["other", "مشكلة أخرى"],
  ],
  livreur: [
    ["client_absent", "تعذر العثور على العميل"],
    ["client_behavior", "تعامل العميل"],
    ["payment", "مشكلة في الدفع"],
    ["route", "العنوان أو المسار"],
    ["other", "مشكلة أخرى"],
  ],
};

export default function CourseComplaint({ courseId, role, compact = false }) {
  const panelId = useId();
  const submitting = useRef(false);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [complaint, setComplaint] = useState(null);
  const [reason, setReason] = useState("");
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");

  async function toggle() {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    setLoading(true);
    setError("");
    try {
      setComplaint(await getCourseComplaint(courseId));
    } catch (err) {
      setError(err.message || "تعذر تحميل الشكوى. حاول مجدداً.");
    } finally {
      setLoading(false);
    }
  }

  async function submit(event) {
    event.preventDefault();
    if (submitting.current || complaint || !reason) return;
    submitting.current = true;
    setSaving(true);
    setError("");
    try {
      setComplaint(await submitCourseComplaint(courseId, reason, comment.trim()));
    } catch (err) {
      setError(err.message || "تعذر إرسال الشكوى. حاول مجدداً.");
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  }

  return (
    <div className={`course-complaint${compact ? " course-complaint-compact" : ""}`} dir="rtl">
      <button className="course-complaint-toggle" type="button" aria-expanded={open}
        aria-controls={panelId} onClick={toggle}>
        الإبلاغ عن مشكلة
      </button>
      {open && <div className="course-complaint-panel" id={panelId}>
        {loading ? <p role="status">جارٍ التحميل…</p> : complaint ? (
          <p className="course-complaint-success" role="status">تم إرسال الشكوى بنجاح. سنراجعها قريباً.</p>
        ) : (
          <form onSubmit={submit}>
            <h3>الإبلاغ عن مشكلة في {role === "client" ? "رحلتك" : "هذه الرحلة"} رقم <bdi>{courseId}</bdi></h3>
            <label>سبب الشكوى
              <select value={reason} onChange={(event) => setReason(event.target.value)} required disabled={saving}>
                <option value="">اختر السبب</option>
                {reasons[role].map(([value, label]) => <option value={value} key={value}>{label}</option>)}
              </select>
            </label>
            <label>تعليق إضافي (اختياري)
              <textarea value={comment} onChange={(event) => setComment(event.target.value)}
                maxLength={1000} rows={3} disabled={saving} placeholder="اكتب تفاصيل تساعدنا على فهم المشكلة" />
            </label>
            <button className="course-complaint-submit" type="submit" disabled={saving || !reason}>
              {saving ? "جارٍ الإرسال…" : "إرسال الشكوى"}
            </button>
          </form>
        )}
        {error && <p className="course-complaint-error" role="alert">{error}</p>}
      </div>}
    </div>
  );
}
