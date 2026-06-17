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
      } else {
        await loginClient({
          nom,
          telephone,
          password,
        });
      }

      const redirect =
        localStorage.getItem("redirectAfterLogin") || "/livreurs";

      localStorage.removeItem("redirectAfterLogin");

      navigate(redirect);
    } catch (err) {
      console.error(err);

      setError(
        err?.message || "حدث خطأ أثناء تسجيل الدخول أو إنشاء الحساب"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="page auth-page" dir="rtl">
      <div className="auth-card">

        <center>
          <h2>
            {mode === "register"
              ? "إنشاء حساب عميل"
              : "تسجيل الدخول"}
          </h2>

          <h5>
            {mode === "register"
              ? "أنشئ حسابك للتواصل مع السائقين وتتبع الطلبات بسهولة."
              : "قم بتسجيل الدخول للوصول إلى حسابك."}
          </h5>
        </center>

        {/* SWITCH */}
        <div className="auth-switch">
          <button
            type="button"
            className={
              mode === "register"
                ? "primary-btn small"
                : "secondary-btn small"
            }
            onClick={() => setMode("register")}
          >
            إنشاء حساب
          </button>

          <button
            type="button"
            className={
              mode === "login"
                ? "primary-btn small"
                : "secondary-btn small"
            }
            onClick={() => setMode("login")}
          >
            تسجيل الدخول
          </button>
        </div>

        {/* FORM */}
        <form onSubmit={handleSubmit} className="auth-form">
          {error && (
            <p
              style={{
                color: "red",
                textAlign: "center",
                fontWeight: "bold",
              }}
            >
              {error}
            </p>
          )}

          {message && (
            <p
              style={{
                color: "green",
                textAlign: "center",
                fontWeight: "bold",
              }}
            >
              {message}
            </p>
          )}

          {mode === "register" && (
            <label>
              الاسم الكامل
              <input
                type="text"
                value={nom}
                onChange={(e) => setNom(e.target.value)}
                placeholder="عبد القادر"
                maxLength={20}
                required
              />
            </label>
          )}

          <label>
            رقم الهاتف
            <input
              type="text"
              value={telephone}
              onChange={(e) => setTelephone(e.target.value)}
              maxLength={10}
              pattern="^\+213[5-7][0-9]{8}$"
              title="يجب إدخال رقم هاتف صحيح "
   
              required
            />
          </label>

          <label>
            كلمة المرور
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="أدخل كلمة المرور"
              required
            />
          </label>

          <button
            className="primary-btn full"
            type="submit"
            disabled={loading}
          >
            {loading
              ? "يرجى الانتظار..."
              : mode === "register"
              ? "إنشاء الحساب"
              : "تسجيل الدخول"}
          </button>
        </form>
      </div>
    </section>
  );
}