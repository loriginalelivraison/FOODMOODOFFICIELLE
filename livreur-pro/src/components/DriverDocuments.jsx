import React, { useEffect, useState } from "react";
import { FileCheck, Car } from "lucide-react";
import { getDriverDocuments, uploadDriverDocument, downloadDriverDocument } from "../livreursapi.js";

const LABELS = { missing: "غير مرفق", pending: "قيد المراجعة", verified: "تم التحقق", rejected: "مرفوض" };
const KINDS = [
  { kind: "license", title: "رخصة السياقة", Icon: FileCheck },
  { kind: "vehicle", title: "صورة المركبة", Icon: Car },
];

export default function DriverDocuments({ driverId }) {
  const [documents, setDocuments] = useState(null);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => {
    let disposed = false;
    getDriverDocuments(driverId).then((data) => {
      if (!Array.isArray(data) || data.some((document) => !document || typeof document !== "object")) {
        throw new Error("تعذر قراءة الوثائق. حاول مجدداً.");
      }
      if (!disposed) setDocuments(data);
    })
      .catch((err) => { if (!disposed) setError(err.message); });
    return () => { disposed = true; };
  }, [driverId]);

  async function upload(kind, event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || busy) return;
    setError(""); setMessage("");
    if (!["image/jpeg", "image/png"].includes(file.type) || file.size > 5 * 1024 * 1024) {
      setError("أرفق صورة JPEG أو PNG لا تتجاوز 5 ميغابايت."); return;
    }
    setBusy(kind);
    try {
      setDocuments(await uploadDriverDocument(driverId, kind, file));
      setMessage("تم إرسال الوثيقة للمراجعة.");
    } catch (err) { setError(err.message); }
    finally { setBusy(null); }
  }

  return <section className="account-card driver-documents" id="driver-documents">
    <h2>الوثائق</h2>
    {!documents && !error && <p role="status">جارٍ تحميل الوثائق…</p>}
    {documents && KINDS.map(({ kind, title, Icon }) => {
      const status = documents.find((item) => item.kind === kind)?.status || "missing";
      return <article className="document-card" key={kind}>
        <Icon size={24} aria-hidden="true" />
        <div><strong>{title}</strong><span className={`document-status is-${status}`}>{LABELS[status]}</span></div>
        <label className="document-upload">
          {busy === kind ? "جارٍ الإرسال…" : status === "missing" ? "إرفاق" : "استبدال"}
          <input type="file" accept="image/jpeg,image/png" disabled={Boolean(busy)}
            aria-label={`${status === "missing" ? "إرفاق" : "استبدال"} ${title}`} onChange={(event) => upload(kind, event)} />
        </label>
        {status !== "missing" && <button className="document-open" type="button" onClick={() =>
          downloadDriverDocument(driverId, kind).catch((err) => setError(err.message))}>عرض</button>}
      </article>;
    })}
    <small>JPEG / PNG · 5 MB</small>
    {message && <p role="status" data-scroll-step="document-uploaded" className="document-success">{message}</p>}
    {error && <p role="alert" className="course-request-error">{error}</p>}
  </section>;
}
