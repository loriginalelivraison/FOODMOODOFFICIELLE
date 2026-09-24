import React, { useState, useRef } from "react";
import { UploadCloud } from "lucide-react";
import { loginJWT, createLivreur } from "../livreursapi.js";
import { useNavigate } from "react-router-dom";
import LoadingSpinner from "../components/LoadingSpinner.jsx";
import {
  getLocationErrorMessage,
  isIOSDevice,
  openLocationSettings,
  requestUserPosition,
} from "../utils/geolocation.js";

export default function CourierRegister() {
  const navigate = useNavigate();
  const formRef = useRef(null);

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
  const [locationSettingsMessage, setLocationSettingsMessage] = useState("");
  const [showLocationSettingsButton, setShowLocationSettingsButton] = useState(false);
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
    disponible: true,
    password: "",
    services: "",
    photo: null,
  });

  const [locationConsent, setLocationConsent] = useState(false);

  function focusErrorField(element) {
    if (!element) return;

    element.focus?.();
    element.scrollIntoView({ behavior: "smooth", block: "center" });
    window.scrollTo({
      top: window.scrollY - 80,
      behavior: "smooth",
    });
  }

  function handleInvalidField(e) {
    if (e.target.validity.valueMissing) {
      e.target.setCustomValidity("يرجى ملء هذه الخانة");
    }

    focusErrorField(e.target);
  }

  function clearInvalidMessage(e) {
    e.target.setCustomValidity("");
  }

async function handleSubmit(e) {
  e.preventDefault();

  if (loading) return;

  setError("");
  setGpsError(false);

  if (!locationConsent) {
    setGpsError(true);
    setError("يجب الموافقة على استخدام بيانات الموقع الجغرافي للمتابعة");
    setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 50);
    return;
  }

  setLoading(true);

  if (!navigator.geolocation) {
    setGpsError(true);
    setError("خدمة تحديد الموقع غير مدعومة في هذا الجهاز");
    setLoading(false);
    return;
  }

  try {
    const position = await requestUserPosition({
      enableHighAccuracy: true,
      timeout: 20000,
      maximumAge: 0,
    });

    const data = new FormData();

    data.append("nom", registerForm.nom);
    data.append("telephone", registerForm.telephone);
    data.append("ville", registerForm.ville);
    data.append("vehicule", registerForm.vehicule);
    data.append("disponible", registerForm.disponible);
    data.append("password", registerForm.password);
    data.append("services", registerForm.services);
    data.append("latitude", position.coords.latitude);
    data.append("longitude", position.coords.longitude);

    if (registerForm.photo) {
      data.append("photo", registerForm.photo);
    }

    await createLivreur(data);

    await loginJWT({
      telephone: registerForm.telephone,
      password: registerForm.password,
    });

    const livreur = JSON.parse(localStorage.getItem("livreur"));

    if (!livreur?.id) {
      throw new Error("تعذر العثور على حساب السائق بعد التسجيل");
    }

    navigate(`/livreur-dashboard/${livreur.id}`);
  } catch (err) {
    const isIOS = isIOSDevice();
    const message = getLocationErrorMessage(err, isIOS);

    setGpsError(true);
    setLocationSettingsMessage(message);
    setShowLocationSettingsButton(err.code === 1 && isIOS);
    setError(message);

    setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 50);
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

      navigate(`/livreur-dashboard/${livreur.id}`);
    } catch (err) {
      setError(err.message || "حدث خطأ أثناء تسجيل الدخول");
    } finally {
      setLoading(false);
    }
  }

  function handlePhotoChange(e) {
    const file = e.target.files[0] || null;

    setRegisterForm({
      ...registerForm,
      photo: file,
    });
  }

  return (
    <section className="page auth-page" dir="rtl">
      <div className="auth-card">
        <center>
          <h2>
            {mode === "register"
              ? "تسجيل سائق جديد"
              : "تسجيل دخول السائق"}
          </h2>

          <h5>
            {mode === "register"
              ? "انضم إلى المنصة كسائق وابدأ في استقبال طلبات التوصيل."
              : "قم بتسجيل الدخول إذا كنت مسجلاً من قبل."}
          </h5>
        </center>

        <div className="auth-switch">
          <button
            type="button"
            disabled={loading}
            className={
              mode === "register" ? "primary-btn small" : "secondary-btn small"
            }
            onClick={() => setMode("register")}
          >
            تسجيل جديد
          </button>

          <button
            type="button"
            disabled={loading}
            className={
              mode === "login" ? "primary-btn small" : "secondary-btn small"
            }
            onClick={() => setMode("login")}
          >
            لدي حساب بالفعل
          </button>
        </div>

        {mode === "login" ? (
          <form
            ref={formRef}
            className="auth-form"
            onSubmit={handleLogin}
            onInvalid={handleInvalidField}
            onInput={clearInvalidMessage}
          >
            {error && (
              <p style={{ color: "red", textAlign: "center", fontWeight: "bold" }}>
                {error}
              </p>
            )}

            <label>
              رقم الهاتف
                              <input
                  type="text"
                  required
                  value={loginForm.telephone}
                  onChange={(e) =>
                    setLoginForm({
                      ...loginForm,
                      telephone: e.target.value.replace(/\D/g, ""),
                    })
                  }
                  minLength={10}
                  maxLength={14}
                  pattern="[0-9]{10,14}"
                  title="يجب إدخال رقم هاتف صحيح مكون من 10 إلى 14 رقماً"
                  style={{ direction: "ltr", textAlign: "right" }}
                />
            </label>

            <label>
              كلمة المرور
              <input
                type="password"
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
            ref={formRef}
            className="auth-form"
            onSubmit={handleSubmit}
            encType="multipart/form-data"
            onInvalid={handleInvalidField}
            onInput={clearInvalidMessage}
          >
            {error && (
              <p style={{ color: "red", textAlign: "center", fontWeight: "bold" }}>
                {error}
              </p>
            )}

            <label>
              الاسم الكامل
              <input
                required
                maxLength={20}
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
  type="text"
  required
  value={registerForm.telephone}
  onChange={(e) =>
    setRegisterForm({
      ...registerForm,
      telephone: e.target.value.replace(/\D/g, ""),
    })
  }
  minLength={10}
  maxLength={14}
  pattern="[0-9]{10,14}"
  title="يجب إدخال رقم هاتف صحيح مكون من 10 إلى 14 رقماً"
  style={{ direction: "ltr", textAlign: "right" }}
/>
            </label>

            <label>
              منطقة العمل
              <select
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
                required
                value={registerForm.vehicule}
                onChange={(e) =>
                  setRegisterForm({
                    ...registerForm,
                    vehicule: e.target.value,
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

            <label>
              الحالة
              <select
                required
                value={registerForm.disponible ? "true" : "false"}
                onChange={(e) =>
                  setRegisterForm({
                    ...registerForm,
                    disponible: e.target.value === "true",
                  })
                }
              >
                <option value="true">متاح الآن</option>
                <option value="false">غير متاح</option>
              </select>
            </label>

            <label>
              الخدمات المقترحة
              <textarea
                rows="4"
                placeholder="توصيل أكل، وثائق، طرود صغيرة، مشتريات، ..."
                value={registerForm.services}
                onChange={(e) =>
                  setRegisterForm({
                    ...registerForm,
                    services: e.target.value,
                  })
                }
              />
            </label>

            <label>
              كلمة المرور
              <input
                type="password"
                required
                placeholder="أدخل كلمة المرور"
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
            صورة السائق
            <input
                type="file"
                accept="image/jpeg,image/png,image/jpg"
                onChange={handlePhotoChange}
              />
          </label>

          {registerForm.photo && (
            <p style={{ fontSize: "13px", color: "#15803d", fontWeight: "bold" }}>
              ✅ تم اختيار الصورة: {registerForm.photo.name}
            </p>
          )}
           
            <div
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
    type="button"
    role="switch"
    aria-checked={locationConsent}
    onClick={() => setLocationConsent(!locationConsent)}
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