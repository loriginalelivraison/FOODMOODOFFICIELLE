import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createClient, loginClient } from "../livreursapi.js";

export default function ClientAuth() {
  const navigate = useNavigate();

  const [mode, setMode] = useState("register");
  const [nom, setNom] = useState("");
  const [telephone, setTelephone] = useState("");
  const [password, setPassword] = useState("");

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    try {
      if (mode === "register") {
        await createClient({
          nom,
          telephone,
          password,
        });

        await loginClient({
          nom,
          telephone,
          password,
        });

        const redirect = localStorage.getItem("redirectAfterLogin") || "/livreurs";
        localStorage.removeItem("redirectAfterLogin");
        navigate(redirect);
      } else {
        await loginClient({
          nom,
          telephone,
          password,
        });

        const redirect = localStorage.getItem("redirectAfterLogin") || "/livreurs";
        localStorage.removeItem("redirectAfterLogin");
        navigate(redirect);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="page auth-page" dir="rtl">
      <div className="auth-card">
        <h3>
          {mode === "login"
            ? "تسجيل الدخول"
            : "سجّل الآن للتواصل مع السائقين"}
        </h3>

        <div className="auth-tabs">
             <button
            className={mode === "register" ? "active" : ""}
            onClick={() => setMode("register")}
            type="button"
          >
            إنشاء حساب
          </button>
          <button
            className={mode === "login" ? "active" : ""}
            onClick={() => setMode("login")}
            type="button"
          >
            تسجيل الدخول
          </button>

       
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {mode === "register" && (
            <>
              <label>الاسم الكامل</label>
              <input
                type="text"
                value={nom}
                onChange={(e) => setNom(e.target.value)}
                placeholder="عبد القادر"
                maxLength={13}
                required
              />
            </>
          )}

          <label>رقم الهاتف</label>
          <input
            type="text"
            value={telephone}
            onChange={(e) => setTelephone(e.target.value)}
            placeholder="مثال: 0555555555"
            required
          />

          <label>كلمة المرور</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="أدخل كلمة المرور"
            required
          />

          <button className="primary-btn full" type="submit" disabled={loading}>
            {loading
              ? "يرجى الانتظار..."
              : mode === "login"
              ? "تسجيل الدخول"
              : "إنشاء الحساب"}
          </button>

          {message && <p style={{ color: "green" }}>{message}</p>}
          {error && <p style={{ color: "red" }}>{error}</p>}
        </form>
      </div>
    </section>
  );
}