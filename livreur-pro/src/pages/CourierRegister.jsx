import React, { useState } from "react";
import { UploadCloud } from "lucide-react";
import { loginJWT, createLivreur } from "../livreursapi.js";
import { useNavigate } from "react-router-dom";

export default function CourierRegister() {
  const navigate = useNavigate();

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
    disponible: true,
    password: "",
    services: "",
    photo: null,
  });

  async function handleSubmit(e) {
    e.preventDefault();

    if (loading) return;

    setLoading(true);
    setError("");
    setGpsError(false);

    if (!navigator.geolocation) {
      setGpsError(true);
      setError("خدمة تحديد الموقع غير مدعومة في هذا الجهاز");
      setLoading(false);
      return;
    }

    try {
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0,
        });
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
      if (err.code === 1) {
        setGpsError(true);
        setError("يجب تفعيل الموقع الجغرافي لإكمال التسجيل");
      } else if (err.code === 3) {
        setGpsError(true);
        setError("انتهت مهلة تحديد الموقع. تأكد من تفعيل GPS ثم أعد المحاولة.");
      } else {
        setError(err.message || "حدث خطأ أثناء إنشاء الحساب");
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
          <form className="auth-form" onSubmit={handleLogin}>
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
              {loading ? "⏳ جاري تسجيل الدخول..." : "تسجيل الدخول"}
            </button>
          </form>
        ) : (
          <form
            className="auth-form"
            onSubmit={handleSubmit}
            encType="multipart/form-data"
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
                placeholder="توصيل أكل، وثائق، طرود صغيرة، مشتريات، أدوية..."
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
                  : "يجب تفعيل خدمة تحديد الموقع (GPS) للسماح للعملاء برؤية موقعك وإرسال طلبات التوصيل القريبة منك."}
              </span>
            </div>

            {loading && (
              <div
                style={{
                  marginBottom: "12px",
                  padding: "12px",
                  borderRadius: "14px",
                  background: "rgba(249,115,22,0.10)",
                  color: "#c2410c",
                  textAlign: "center",
                  fontWeight: "700",
                }}
              >
                ⏳ الرجاء الانتظار، يتم إنشاء الحساب...
              </div>
            )}

            <button
              className="primary-btn full"
              type="submit"
              disabled={loading}
              style={{
                opacity: loading ? 0.7 : 1,
                cursor: loading ? "not-allowed" : "pointer",
              }}
            >
              {loading ? "جاري إنشاء الحساب..." : "إنشاء حساب السائق"}
            </button>
          </form>
        )}
      </div>
    </section>
  );
}