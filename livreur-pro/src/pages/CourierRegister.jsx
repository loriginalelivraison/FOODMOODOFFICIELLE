import React, { useState } from "react";
import { UploadCloud } from "lucide-react";
import { loginJWT, createLivreur } from "../livreursapi.js";
import logo2 from "../assets/logo2.png"
import { useNavigate } from "react-router-dom";

export default function CourierRegister() {
  const navigate = useNavigate();

  const quartiers = [
    "كل مدينة مستغانم",
    "وسط المدينة",
    "خروبة",
    "صلامندر",
    "مزغران",
    "صيادة",
    "بوسكي",
    "دبدابة",
    "عشعاشة",
    "ستيدية",
    "النويصي",
    "ماسري",
  ];

  const [mode, setMode] = useState("register");
  const [error, setError] = useState("");
  const [photoPreview, setPhotoPreview] = useState(null);

  const [loginForm, setLoginForm] = useState({
    telephone: "",
    password: "",
  });

  const [registerForm, setRegisterForm] = useState({
    nom: "",
    telephone: "",
    ville: "كل مدينة مستغانم",
    vehicule: "moto",
    disponible: true,
    password: "",
    services: "",
    photo: null,
  });

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    try {
      const data = new FormData();

      data.append("nom", registerForm.nom);
      data.append("telephone", registerForm.telephone);
      data.append("ville", registerForm.ville);
      data.append("vehicule", registerForm.vehicule);
      data.append("disponible", registerForm.disponible);
      data.append("password", registerForm.password);
      data.append("services", registerForm.services);

      if (registerForm.photo) {
        data.append("photo", registerForm.photo);}
 
      
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
      setError(err.message || "حدث خطأ أثناء إنشاء الحساب");
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
      setError(err.message || "حدث خطأ أثناء تسجيل الدخول");
    }
  }

  function handlePhotoChange(e) {
    const file = e.target.files[0];

    setRegisterForm({
      ...registerForm,
      photo: file || null,
    });

    setPhotoPreview(file ? URL.createObjectURL(file) : null);
  }

  return (
    <section className="page auth-page" dir="rtl">
      <div className="auth-card">
        <center>
          <h2>
            {mode === "register" ? "تسجيل سائق جديد" : "تسجيل دخول السائق"}
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
            className={mode === "register" ? "primary-btn small" : "secondary-btn small"}
            onClick={() => setMode("register")}
          >
            تسجيل جديد
          </button>

          <button
            type="button"
            className={mode === "login" ? "primary-btn small" : "secondary-btn small"}
            onClick={() => setMode("login")}
          >
            لدي حساب بالفعل
          </button>
        </div>

        {mode === "login" ? (
          <form className="auth-form" onSubmit={handleLogin}>
            {error && <p style={{ color: "red", textAlign: "center", fontWeight: "bold" }}>{error}</p>}

            <label>
              رقم الهاتف
              <input
                required
                placeholder="0555555555"
                value={loginForm.telephone}
                onChange={(e) =>
                  setLoginForm({ ...loginForm, telephone: e.target.value })
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
                  setLoginForm({ ...loginForm, password: e.target.value })
                }
              />
            </label>

            <button className="primary-btn full" type="submit">
              تسجيل الدخول
            </button>
          </form>
        ) : (
          <form className="auth-form" onSubmit={handleSubmit} encType="multipart/form-data">
            {error && <p style={{ color: "red", textAlign: "center", fontWeight: "bold" }}>{error}</p>}

            <label>
              الاسم الكامل
              <input
                required
                maxLength={20}
                placeholder="مثال: أمين"
                value={registerForm.nom}
                onChange={(e) =>
                  setRegisterForm({ ...registerForm, nom: e.target.value })
                }
              />
            </label>

            <label>
              رقم الهاتف
              <input
                required
                placeholder=""
                value={registerForm.telephone}
                onChange={(e) =>
                  setRegisterForm({ ...registerForm, telephone: e.target.value })
                }
              />
            </label>

            <label>
              منطقة العمل
              <select
                required
                value={registerForm.ville}
                onChange={(e) =>
                  setRegisterForm({ ...registerForm, ville: e.target.value })
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
                  setRegisterForm({ ...registerForm, vehicule: e.target.value })
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
                  setRegisterForm({ ...registerForm, services: e.target.value })
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
                  setRegisterForm({ ...registerForm, password: e.target.value })
                }
              />
            </label>

         <div>
  <p style={{ marginBottom: "8px", fontWeight: "600" }}>
    إضافة صورة
  </p>

  <label htmlFor="driver-photo" className="upload-box">
    <UploadCloud />
    <span>
      {registerForm.photo
        ? "تم اختيار الصورة بنجاح"
        : "صورة اختيارية للسائق"}
    </span>
  </label>

  <input
    id="driver-photo"
    type="file"
    accept="image/*"
    onChange={handlePhotoChange}
    style={{ display: "none" }}
  />
  {registerForm.photo && (
  <p
    style={{
      marginTop: "8px",
      fontSize: "14px",
      color: "#16a34a",
      fontWeight: "600",
      textAlign: "center",
    }}
  >
    ✅ {registerForm.photo.name}
  </p>
)}
</div>

            <button className="primary-btn full" type="submit">
              إنشاء حساب السائق
            </button>
          </form>
        )}
      </div>
    </section>
  );
}