import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

export default function ProfilePhotoViewer({ photo, name }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef(null);
  const closeRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    closeRef.current?.focus();
    const onKeyDown = (event) => {
      if (event.key === "Escape") setOpen(false);
      if (event.key === "Tab") {
        event.preventDefault();
        closeRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      triggerRef.current?.focus();
    };
  }, [open]);

  return <div className="account-photo-wrap">
    <button className="account-avatar account-photo-trigger" type="button" ref={triggerRef}
      onClick={() => setOpen(true)} aria-label="عرض صورتي الشخصية">
      <img src={photo} alt={name} />
    </button>
    <button className="account-photo-view" type="button" onClick={() => setOpen(true)}>عرض الصورة</button>
    {open && createPortal(
      <div className="profile-photo-overlay" onClick={(event) => {
        if (event.target === event.currentTarget) setOpen(false);
      }}>
        <div className="profile-photo-dialog" role="dialog" aria-modal="true" aria-label="صورة الحساب">
          <button className="profile-photo-close" type="button" ref={closeRef}
            onClick={() => setOpen(false)} aria-label="إغلاق الصورة">
            <X size={22} aria-hidden="true" />
          </button>
          <img src={photo} alt={name} />
        </div>
      </div>, document.body
    )}
  </div>;
}
