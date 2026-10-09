import React, { useState, useEffect } from "react";
import { loginJWT, createLivreur } from "../livreursapi.js";
import { useNavigate } from "react-router-dom";
import LoadingSpinner from "../components/LoadingSpinner.jsx";
import { scrollToPageTopWhenReady } from "../utils/scroll.js";
import {
  getLocationErrorMessage,
  isIOSDevice,
  requestUserPosition,
} from "../utils/geolocation.js";

export default function CourierRegister({ onChooseClient }) {
  const navigate = useNavigate();

  // L'écran revient en haut à l'ouverture du formulaire d'inscription
  useEffect(() => scrollToPageTopWhenReady(), []);

  const quartiers = [
    "الجزائر العاصمة",
  "وهران",
  "مستغانم",
  "قسنطينة",
  "عنابة",
  "البليدة",
  "سطيف",
  "تيزي وزو",
  "بجاية",
  "سكيكدة",
  "الشلف",
  "تلمسان",
  "تيبازة",
  "بومرداس",
  "باتنة",
  "الجلفة",
  "بسكرة",
  "ورقلة",
  "الأغواط",
  "غرداية",
  "الوادي",
  "معسكر",
  "سيدي بلعباس",
  "المدية",
  "عين الدفلى",
  "برج بوعريريج",
  "ميلة",
  "جيجل",
  "قالمة",
  "سوق أهراس",
  "الطارف",
  "خنشلة",
  "تبسة",
  "البيض",
  "النعامة",
  "عين تموشنت",
  "تيسمسيلت",
  "غليزان",
  "أدرار",
  "تمنراست",
  "إليزي",
  "تندوف",
  "بشار",
  "المنيعة",
  "عين صالح",
  "عين قزام",
  "تقرت",
  "المغير",
  "أولاد جلال",
  "برج باجي مختار",
  "بني عباس",
  "إن صالح",
  "إن قزام",
  "جانت",
];


  const [mode, setMode] = useState("register");
  const [error, setError] = useState("");
  const [gpsError, setGpsError] = useState(false);
  const [loading, setLoading] = useState(false);

  const [loginForm, setLoginForm] = useState({
    telephone: "",
    password: "",
  });

  const [registerForm, setRegisterForm] = useState({
    nom: "",
    telephone: "",
    ville: "",
    vehicule: "",
    modele_vehicule: "",
    password: "",
    photo: null,
  });

  const [locationConsent, setLocationConsent] = useState(false);

  function handleInvalidField(e) {
    if (e.target.validity.valueMissing) {
      e.target.setCustomValidity("يرجى ملء هذه الخانة");
    }
  }

  function clearInvalidMessage(e) {
    e.target.setCustomValidity("");
  }

  function changeMode(nextMode) {
    setMode(nextMode);
    setError("");
    setGpsError(false);
  }

async function handleSubmit(e) {
  e.preventDefault();

  if (loading) return;

  setError("");
  setGpsError(false);

  if (!locationConsent) {
    setGpsError(true);
    setError("يجب الموافقة على استخدام بيانات الموقع الجغرافي للمتابعة");
    return;
  }

  setLoading(true);

  if (!navigator.geolocation) {
    setGpsError(true);
    setError("خدمة تحديد الموقع غير مدعومة في هذا الجهاز");
    setLoading(false);
    return;
  }

  let position;
  try {
    position = await requestUserPosition({
      enableHighAccuracy: true,
      timeout: 20000,
      maximumAge: 0,
      retryWithLowAccuracy: true,
    });
  } catch (err) {
    setGpsError(true);
    setError(getLocationErrorMessage(err, isIOSDevice()));
    setLoading(false);
    return;
  }

  let accountCreated = false;
  try {
    const data = new FormData();

    data.append("nom", registerForm.nom.trim());
    data.append("telephone", registerForm.telephone);
    data.append("ville", registerForm.ville);
    data.append("vehicule", registerForm.vehicule);
    data.append("modele_vehicule", registerForm.vehicule === "voiture" ? registerForm.modele_vehicule.trim() : "");
    data.append("password", registerForm.password);
    data.append("latitude", position.coords.latitude);
    data.append("longitude", position.coords.longitude);

    if (registerForm.photo) {
      data.append("photo", registerForm.photo);
    }

    await createLivreur(data);
    accountCreated = true;

    await loginJWT({
      telephone: registerForm.telephone,
      password: registerForm.password,
    });

    const livreur = JSON.parse(localStorage.getItem("livreur"));

    if (!livreur?.id) {
      throw new Error("تعذر العثور على حساب السائق بعد التسجيل");
    }

    navigate(`/livreur-dashboard/${livreur.id}`, { replace: true });
  } catch (err) {
    if (accountCreated) {
      setLoginForm({ telephone: registerForm.telephone, password: "" });
      setMode("login");
      setError("تم إنشاء حسابك. تعذر تسجيل الدخول تلقائياً، سجّل الدخول للمتابعة.");
    } else {
      setError(err.message || "تعذر إنشاء الحساب. حاول مجدداً.");
    }
  } finally {
    setLoading(false);
  }
}

  async function handleLogin(e) {
    e.preventDefault();

    if (loading) return;

    setLoading(true);
    setError("");

    try {
      await loginJWT(loginForm);

      const livreur = JSON.parse(localStorage.getItem("livreur"));

      if (!livreur?.id) {
        throw new Error("تعذر العثور على حساب السائق");
      }

      navigate(`/livreur-dashboard/${livreur.id}`, { replace: true });
    } catch (err) {
      setError(err.message || "حدث خطأ أثناء تسجيل الدخول");
    } finally {
      setLoading(false);
    }
  }

  function handlePhotoChange(e) {
    const file = e.target.files[0] || null;
    if (file && (!["image/jpeg", "image/png"].includes(file.type) || file.size > 5 * 1024 * 1024)) {
      e.target.value = "";
      setRegisterForm((current) => ({ ...current, photo: null }));
      setGpsError(false);
      setError("اختر صورة JPEG أو PNG لا تتجاوز 5 ميغابايت.");
      return;
    }
    setError("");
    setRegisterForm((current) => ({ ...current, photo: file }));
  }

  return (
    <section className="page auth-page" data-scroll-page="courier-auth" dir="rtl">
      <div className="auth-card">
        {onChooseClient && (
          <div className="auth-switch" aria-label="نوع الحساب">
            <button
              type="button"
              aria-pressed="false"
              className="secondary-btn small"
              disabled={loading}
              onClick={onChooseClient}
            >
              زبون
            </button>
            <button
              type="button"
              aria-pressed="true"
              className="primary-btn small"
            >
              عامل توصيل / سائق
            </button>
          </div>
        )}

        <header className="driver-register-heading">
          <h2>
            {mode === "register"
              ? "تسجيل سائق جديد"
              : "تسجيل دخول السائق"}
          </h2>

          <p>
            {mode === "register"
              ? "انضم إلى المنصة كسائق وابدأ في استقبال طلبات التوصيل."
              : "قم بتسجيل الدخول إذا كنت مسجلاً من قبل."}
          </p>
        </header>

        <div className="auth-switch">
          <button
            type="button"
            disabled={loading}
            aria-pressed={mode === "register"}
            className={
              mode === "register" ? "primary-btn small" : "secondary-btn small"
            }
            onClick={() => changeMode("register")}
          >
            تسجيل جديد
          </button>

          <button
            type="button"
            disabled={loading}
            aria-pressed={mode === "login"}
            className={
              mode === "login" ? "primary-btn small" : "secondary-btn small"
            }
            onClick={() => changeMode("login")}
          >
            لدي حساب بالفعل
          </button>
        </div>

        {mode === "login" ? (
          <form
            data-scroll-step={mode}
            className="auth-form"
            onSubmit={handleLogin}
            onInvalid={handleInvalidField}
            onInput={clearInvalidMessage}
          >
            {error && (
              <p id="courier-login-error" role="alert" style={{ color: "red", textAlign: "center", fontWeight: "bold" }}>
                {error}
              </p>
            )}

            <label>
              رقم الهاتف
                              <input
                  id="courier-login-phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="username"
                  required
                  value={loginForm.telephone}
                  onChange={(e) =>
                    setLoginForm({
                      ...loginForm,
                      telephone: e.target.value.replace(/\D/g, ""),
                    })
                  }
                  minLength={8}
                  maxLength={15}
                  pattern="[0-9]{8,15}"
                  title="أدخل رقم هاتف من 8 إلى 15 رقماً"
                  style={{ direction: "ltr", textAlign: "right" }}
                />
            </label>

            <label>
              كلمة المرور
              <input
                id="courier-login-password"
                type="password"
                autoComplete="current-password"
                required
                placeholder="أدخل كلمة المرور"
                value={loginForm.password}
                onChange={(e) =>
                  setLoginForm({
                    ...loginForm,
                    password: e.target.value,
                  })
                }
              />
            </label>

            <button className="primary-btn full" type="submit" disabled={loading}>
              {loading ? <LoadingSpinner label="جاري تسجيل الدخول..." size={20} /> : "تسجيل الدخول"}
            </button>
          </form>
        ) : (
          <form
            data-scroll-step={mode}
            className="auth-form"
            onSubmit={handleSubmit}
            encType="multipart/form-data"
            onInvalid={handleInvalidField}
            onInput={clearInvalidMessage}
          >
            {error && !gpsError && (
              <p id="courier-register-error" role="alert" style={{ color: "red", textAlign: "center", fontWeight: "bold" }}>
                {error}
              </p>
            )}

            <label>
              الاسم الكامل
              <input
                id="courier-register-name"
                required
                maxLength={100}
                autoComplete="name"
                placeholder="مثال: أمين"
                value={registerForm.nom}
                onChange={(e) =>
                  setRegisterForm({
                    ...registerForm,
                    nom: e.target.value,
                  })
                }
              />
            </label>

            <label>
              رقم الهاتف
            <input
  id="courier-register-phone"
  type="tel"
  inputMode="tel"
  autoComplete="tel"
  required
  value={registerForm.telephone}
  onChange={(e) =>
    setRegisterForm({
      ...registerForm,
      telephone: e.target.value.replace(/\D/g, ""),
    })
  }
  minLength={8}
  maxLength={15}
  pattern="[0-9]{8,15}"
  title="أدخل رقم هاتف من 8 إلى 15 رقماً"
  style={{ direction: "ltr", textAlign: "right" }}
/>
            </label>

            <label>
              منطقة العمل
              <select
                id="courier-register-city"
                required
                value={registerForm.ville}
                onChange={(e) =>
                  setRegisterForm({
                    ...registerForm,
                    ville: e.target.value,
                  })
                }
              >
                <option value="" disabled>
                  اختر منطقة العمل
                </option>
                {quartiers.map((quartier) => (
                  <option key={quartier} value={quartier}>
                    {quartier}
                  </option>
                ))}
              </select>
            </label>

            <label>
              نوع المركبة
              <select
                id="courier-register-vehicle"
                required
                value={registerForm.vehicule}
                onChange={(e) =>
                  setRegisterForm({
                    ...registerForm,
                    vehicule: e.target.value,
                    modele_vehicule: e.target.value === "voiture" ? registerForm.modele_vehicule : "",
                  })
                }
              >
                <option value="" disabled>
                  اختر نوع المركبة
                </option>
                <option value="moto">دراجة نارية</option>
                <option value="velo">دراجة هوائية</option>
                <option value="voiture">سيارة</option>
                <option value="camion">شاحنة</option>
              </select>
            </label>

            {registerForm.vehicule === "voiture" && (
              <label>
                {"\u0627\u0633\u0645 \u0645\u0648\u062f\u064a\u0644 \u0627\u0644\u0633\u064a\u0627\u0631\u0629"}
                <input
                  id="courier-register-vehicle-model"
                  value={registerForm.modele_vehicule}
                  onChange={(e) => setRegisterForm({ ...registerForm, modele_vehicule: e.target.value })}
                  maxLength={50}
                  placeholder={"\u0645\u062b\u0627\u0644: Clio 2 \u0623\u0648 Peugeot 208"}
                  aria-label={"\u0627\u0633\u0645 \u0645\u0648\u062f\u064a\u0644 \u0627\u0644\u0633\u064a\u0627\u0631\u0629"}
                  required
                />
              </label>
            )}

            <label>
              كلمة المرور
              <input
                id="courier-register-password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
                placeholder="8 أحرف على الأقل"
                value={registerForm.password}
                onChange={(e) =>
                  setRegisterForm({
                    ...registerForm,
                    password: e.target.value,
                  })
                }
              />
            </label>

                      <label>
            صورة السائق (اختيارية)
            <input
                id="courier-register-photo"
                type="file"
                accept="image/jpeg,image/png,image/jpg"
                onChange={handlePhotoChange}
                disabled={loading}
              />
              <small>JPEG أو PNG · حتى 5 ميغابايت</small>
          </label>

          {registerForm.photo && (
            <p style={{ fontSize: "13px", color: "#15803d", fontWeight: "bold" }}>
              ✅ تم اختيار الصورة: {registerForm.photo.name}
            </p>
          )}
           
            <div
              id="courier-location-section"
              tabIndex={-1}
              aria-describedby={gpsError && error ? "courier-location-error" : undefined}
              style={{
                background: gpsError
                  ? "rgba(239,68,68,0.12)"
                  : "rgba(59,130,246,0.08)",
                border: gpsError
                  ? "1px solid rgba(239,68,68,0.35)"
                  : "1px solid rgba(59,130,246,0.25)",
                color: gpsError ? "#b91c1c" : "#1e3a8a",
                padding: "14px",
                borderRadius: "14px",
                marginTop: "18px",
                marginBottom: "14px",
                fontSize: "14px",
                lineHeight: "1.8",
                textAlign: "right",
                fontWeight: "500",
                animation: gpsError ? "shake 0.35s ease-in-out" : "none",
                transition: "all 0.25s ease",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  marginBottom: "6px",
                  fontWeight: "700",
                  color: gpsError ? "#dc2626" : "#1d4ed8",
                }}
              >
                📍 تفعيل الموقع الجغرافي
              </div>

              <span>
                {gpsError
                  ? "يجب السماح بالوصول إلى موقعك لإكمال إنشاء الحساب"
                  : "يجمع تطبيق WinRak بيانات الموقع الجغرافي للسائق لتتبع موقعه أثناء عملية التوصيل ومشاركة موقعه مع العميل، حتى عندما يعمل التطبيق في الخلفية أو يكون مغلقًا أو غير مستخدم."}
              </span>
              {gpsError && error && (
                <p
                  id="courier-location-error"
                  role="alert"
                  data-error-for={!locationConsent ? "courier-location-consent" : "courier-location-section"}
                  style={{ margin: "8px 0", color: "#b91c1c", fontWeight: "bold" }}
                >
                  {error}
                </p>
              )}
              <div
  style={{
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: "14px",
    gap: "12px",
  }}
>
  <span style={{ fontWeight: "700", fontSize: "14px" }}>
    أوافق على استخدام بيانات الموقع الجغرافي
  </span>

  <button
    id="courier-location-consent"
    type="button"
    role="switch"
    disabled={loading}
    aria-checked={locationConsent}
    aria-label="أوافق على استخدام بيانات الموقع الجغرافي"
    aria-invalid={(gpsError && !locationConsent) || undefined}
    aria-describedby={gpsError && error ? "courier-location-error" : undefined}
    onClick={() => {
      setLocationConsent(!locationConsent);
      if (!locationConsent && gpsError) {
        setGpsError(false);
        setError("");
      }
    }}
    style={{
      width: "54px",
      height: "30px",
      borderRadius: "30px",
      border: "none",
      padding: "3px",
      cursor: "pointer",
      backgroundColor: locationConsent ? "#8BCF35" : "#d1d5db",
      transition: "background-color 0.25s ease",
      position: "relative",
      flexShrink: 0,
    }}
  >
    <span
      style={{
        position: "absolute",
        top: "3px",
        left: locationConsent ? "27px" : "3px",
        width: "24px",
        height: "24px",
        borderRadius: "50%",
        backgroundColor: "#ffffff",
        boxShadow: "0 1px 4px rgba(0,0,0,0.25)",
        transition: "left 0.25s ease",
      }}
    />
  </button>
</div>
            </div>

            <button
              className="primary-btn full"
              type="submit"
              disabled={loading}
              style={{
                opacity: loading ? 0.7 : 1,
                cursor: loading ? "not-allowed" : "pointer",
              }}
            >
              {loading ? <LoadingSpinner label="جاري إنشاء الحساب..." size={20} /> : "إنشاء حساب السائق"}
            </button>
          </form>
        )}
      </div>
    </section>
  );
}
