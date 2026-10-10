import React, { useEffect, useRef, useState } from "react";
import { Clock3 } from "lucide-react";

export default function OfferCountdown({ seconds, progress = false, chip = false, onExpire }) {
  const [remaining, setRemaining] = useState(seconds);
  const maximum = useRef(seconds);
  const expireRef = useRef(onExpire);
  expireRef.current = onExpire;
  useEffect(() => {
    setRemaining(seconds);
    maximum.current = Math.max(maximum.current || 0, seconds || 0);
  }, [seconds]);
  useEffect(() => {
    if (remaining == null) return undefined;
    if (remaining <= 0) { expireRef.current?.(); return undefined; }
    const interval = setInterval(() => {
      setRemaining((value) => value == null ? value : Math.max(0, value - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [remaining]);
  if (remaining == null) return null;
  if (chip) return <span className={`driver-request-timer ${remaining <= 10 ? "is-urgent" : ""}`} role="timer">
    <Clock3 size={18} aria-hidden="true" />
    {remaining <= 0 ? "انتهت المهلة" : <><bdi>{remaining}</bdi> ثانية</>}
  </span>;
  if (!progress) return <span className={`offer-countdown ${remaining <= 10 ? "is-urgent" : ""}`}>
    ⏱ {remaining} ثانية
  </span>;
  return <div className={`driver-offer-expiry ${remaining <= 10 ? "is-urgent" : ""}`} role="timer">
    <span>{remaining <= 0 ? "انتهت مهلة الطلب" : <>ينتهي الطلب خلال <bdi>{remaining}</bdi> ثانية</>}</span>
    <progress value={remaining} max={Math.max(1, maximum.current || 1)} aria-label="الوقت المتبقي للطلب" />
  </div>;
}
