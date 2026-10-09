import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { getClientReturnPath } from "../utils/navigation.js";
import { createClient, loginClient } from "../livreursapi.js";
import LoadingSpinner from "../components/LoadingSpinner.jsx";
import CourierRegister from "./CourierRegister.jsx";

export default function ClientAuth() {
  const navigate = useNavigate();

  const [mode, setMode] = useState("register");
  const [accountType, setAccountType] = useState("client");
  const [nom, setNom] = useState("");
  const [telephone, setTelephone] = useState("");
  const [password, setPassword] = useState("");

  const [error, setError] = useState("");
  const [errorField, setErrorField] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  function handleInvalidField(e) {
    if (e.target.validity.valueMissing) {
      e.target.setCustomValidity("يرجى ملء هذه الخانة");
    }
  }

  function clearInvalidMessage(e) {
    e.target.setCustomValidity("");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (loading) return;

    setError("");
    setErrorField("");
    setMessage("");

    if (mode === "register" && password.length < 8) {
      setErrorField("client-auth-password");
      setError("كلمة المرور يجب أن تحتوي على 8 أحرف على الأقل وألا تكون أرقاماً فقط.");
      return;
    }

    setLoading(true);

    let registered = false;
    try {
      if (mode === "register") {
        await createClient({
          nom: nom.trim(),
          telephone,
          password,
        });
        registered = true;
      }

      await loginClient({
        nom,
        telephone,
        password,
      });

      const redirect =
        getClientReturnPath(localStorage.getItem("redirectAfterLogin"));

      localStorage.removeItem("redirectAfterLogin");
      navigate(redirect, { replace: true });
    } catch (err) {
      if (registered) {
        setMode("login");
        setMessage("تم إنشاء حسابك. سجّل الدخول للمتابعة.");
      }
      setError(err?.message || "حدث خطأ أثناء تسجيل الدخول أو إنشاء الحساب");
    } finally {
      setLoading(false);
    }
  }

  if (accountType === "courier") {
    return (
      <CourierRegister
        onChooseClient={() => {
          setAccountType("client");
          setError("");
          setErrorField("");
          setMessage("");
        }}
      />
    );
  }

  return (
    <section className="page auth-page" data-scroll-page="client-auth" dir="rtl">
      <div className="auth-card">
        <center>
          <h2>هل أنت؟</h2>
        </center>

        <div className="auth-switch" aria-label="نوع الحساب">
          <button
            type="button"
            aria-pressed="true"
            className="primary-btn small"
          >
            زبون
          </button>
          <button
            type="button"
            aria-pressed="false"
            disabled={loading}
            className="secondary-btn small"
            onClick={() => setAccountType("courier")}
          >
            عامل توصيل / سائق
          </button>
        </div>

        <center>
          <h2>
            {mode === "register" ? "إنشاء حساب عميل" : "تسجيل الدخول"}
          </h2>

          {mode === "login" && (
            <h5>قم بتسجيل الدخول للوصول إلى حسابك.</h5>
          )}
        </center>

        <div className="auth-switch">
          <button
            type="button"
            disabled={loading}
            className={
              mode === "register" ? "primary-btn small" : "secondary-btn small"
            }
            onClick={() => {
              setMode("register");
              setError("");
              setErrorField("");
              setMessage("");
            }}
          >
            إنشاء حساب
          </button>

          <button
            type="button"
            disabled={loading}
            className={
              mode === "login" ? "primary-btn small" : "secondary-btn small"
            }
            onClick={() => {
              setMode("login");
              setError("");
              setErrorField("");
              setMessage("");
            }}
          >
            تسجيل الدخول
          </button>
        </div>

        <form
          data-scroll-step={mode}
          onSubmit={handleSubmit}
          className="auth-form"
          onInvalid={handleInvalidField}
          onInput={clearInvalidMessage}
        >
          {error && !errorField && (
            <p
              id="client-auth-error"
              role="alert"
              data-error-for={errorField || undefined}
              style={{ color: "red", textAlign: "center", fontWeight: "bold" }}
            >
              {error}
            </p>
          )}

          {message && (
            <p role="status" style={{ color: "green", textAlign: "center", fontWeight: "bold" }}>
              {message}
            </p>
          )}

          {mode === "register" && (
            <label>
              الاسم الكامل
              <input
                id="client-auth-name"
                type="text"
                value={nom}
                onChange={(e) => setNom(e.target.value)}
                placeholder="عبد القادر"
                maxLength={100}
                autoComplete="name"
                required
              />
            </label>
          )}

          <label>
  رقم الهاتف
  <input
    id="client-auth-phone"
    type="tel"
    inputMode="tel"
    autoComplete="tel"
    dir="ltr"
    value={telephone}
    onChange={(e) =>
      setTelephone(e.target.value.replace(/\D/g, ""))
    }
    maxLength={15}
    pattern="[0-9]{8,15}"
    title="أدخل رقم هاتف من 8 إلى 15 رقماً"
    required
  />
</label>

          <label>
            كلمة المرور
            <input
              id="client-auth-password"
              type="password"
              value={password}
              aria-invalid={errorField === "client-auth-password" || undefined}
              aria-describedby={errorField === "client-auth-password" ? "client-auth-error" : undefined}
              onChange={(e) => {
                setPassword(e.target.value);
                if (errorField === "client-auth-password") {
                  setError("");
                  setErrorField("");
                }
              }}
              placeholder="******"
              minLength={mode === "register" ? 8 : undefined}
              autoComplete={mode === "register" ? "new-password" : "current-password"}
              title={mode === "register" ? "8 أحرف على الأقل، وليست أرقاماً فقط" : undefined}
              required
            />
            {errorField === "client-auth-password" && error && (
              <span
                id="client-auth-error"
                role="alert"
                data-error-for="client-auth-password"
                style={{ color: "red", fontWeight: "bold" }}
              >
                {error}
              </span>
            )}
          </label>

          <button className="primary-btn full" type="submit" disabled={loading}>
            {loading
              ? <LoadingSpinner label="يرجى الانتظار..." size={20} />
              : mode === "register"
              ? "إنشاء الحساب"
              : "تسجيل الدخول"}
          </button>
        </form>
      </div>
    </section>
  );
}
