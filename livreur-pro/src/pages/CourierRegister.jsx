import React, { useState } from "react";
import { UploadCloud } from "lucide-react";
import { loginJWT, createLivreur } from "../livreursapi.js";
import { useNavigate } from "react-router-dom";

export default function CourierRegister() {
  const navigate = useNavigate();

  const quartiers = [
    "كل المدينة",
    "وسط المدينة",
    "حي السلام",
    "حي النصر",
    "حي الحرية",
    "حي الأمير عبد القادر",
    "حي 5 جويلية",
    "حي 20 أوت",
    "حي المحطة",
    "حي الجامعة",
    "حي السوق",
    "حي الميناء",
  ];

  const [mode, setMode] = useState("register");
  const [error, setError] = useState("");

  const [loginForm, setLoginForm] = useState({
    telephone: "",
    password: "",
  });

  const [registerForm, setRegisterForm] = useState({
    nom: "",
    telephone: "",
    ville: "كل المدينة",
    vehicule: "scooter",
    disponible: true,
    password: "",
  });

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    try {
      await createLivreur(registerForm);

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
      setError(err.message);
    }
  }

  async function handleLogin(e) {
    e.preventDefault();
    setError("");

    try {
      await loginJWT(loginForm);

      const livreur = JSON.parse(localStorage.getItem("livreur"));

      if (!livreur?.id) {
        throw new Error("تعذر العثور على حساب السائق");
      }

      navigate(`/livreur-dashboard/${livreur.id}`);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <section className="page form-page" dir="rtl">
      <div className="page-title narrow">
        <span className="eyebrow">فضاء السائق</span>

        <h1>
          {mode === "register" ? "تسجيل سائق جديد" : "تسجيل دخول السائق"}
        </h1>

        <p>
          {mode === "register"
            ? "انضم إلى المنصة كسائق وابدأ في استقبال طلبات التوصيل."
            : "قم بتسجيل الدخول إذا كنت مسجلاً من قبل."}
        </p>
      </div>

      <div className="auth-switch">
        <button
          type="button"
          className={
            mode === "register" ? "primary-btn small" : "secondary-btn small"
          }
          onClick={() => setMode("register")}
        >
          تسجيل جديد
        </button>

        <button
          type="button"
          className={
            mode === "login" ? "primary-btn small" : "secondary-btn small"
          }
          onClick={() => setMode("login")}
        >
          لدي حساب بالفعل
        </button>
      </div>

      {mode === "login" ? (
        <form className="pro-form" onSubmit={handleLogin}>
          {error && <p style={{ color: "red" }}>{error}</p>}

          <div className="form-grid">
            <label>
              رقم الهاتف
              <input
                required
                placeholder="0555555555"
                value={loginForm.telephone}
                onChange={(e) =>
                  setLoginForm({
                    ...loginForm,
                    telephone: e.target.value,
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
                value={loginForm.password}
                onChange={(e) =>
                  setLoginForm({
                    ...loginForm,
                    password: e.target.value,
                  })
                }
              />
            </label>
          </div>

          <button className="primary-btn full" type="submit">
            تسجيل الدخول
          </button>
        </form>
      ) : (
        <form className="pro-form" onSubmit={handleSubmit}>
          {error && <p style={{ color: "red" }}>{error}</p>}

          <div className="form-grid">
            <label>
              الاسم الكامل
              <input
                required
                maxLength={20}
                placeholder="مثال: أحمد بن علي"
                value={registerForm.nom}
                onChange={(e) =>
                  setRegisterForm({
                    ...registerForm,
                    nom: e.target.value,
                  })
                }
              />
              <small style={{ color: "#666", fontSize: "12px" }}>
                الحد الأقصى هو 20 حرفًا
              </small>
            </label>

            <label>
              رقم الهاتف
              <input
                required
                placeholder="0555555555"
                value={registerForm.telephone}
                onChange={(e) =>
                  setRegisterForm({
                    ...registerForm,
                    telephone: e.target.value,
                  })
                }
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
                <option value="scooter">سكوتر</option>
                <option value="moto">دراجة نارية</option>
                <option value="velo">دراجة هوائية</option>
                <option value="voiture">سيارة</option>
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
          </div>

          <label>
            الخدمات المقترحة
            <textarea
              rows="4"
              placeholder="توصيل أكل، وثائق، طرود صغيرة، مشتريات، أدوية..."
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

          <div className="upload-box">
            <UploadCloud />
            <div>
              <strong>الوثائق المطلوبة</strong>
              <p>
                بطاقة الهوية، التأمين، ورخصة السياقة إذا كانت ضرورية. سيتم تفعيل
                رفع الملفات لاحقًا.
              </p>
            </div>
          </div>

          <button className="primary-btn full" type="submit">
            إنشاء حساب السائق
          </button>
        </form>
      )}
    </section>
  );
}