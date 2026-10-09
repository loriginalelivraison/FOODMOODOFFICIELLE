import React, { useEffect, useState } from "react";
import { ChevronLeft, Trophy, User } from "lucide-react";
import {
  deleteLivreur,
  updateLivreurPosition,
  setLivreurOnline,
  setLivreurOffline,
  getLivreurCourses,
  finishCourse,
  getActiveCoursesForLivreur,
  getCourseOffers,
  respondToCourseOffer,
  clearCurrentDriverFcmToken,
  getLivreurById,
  getCommentairesLivreur,
  updateLivreurProfile,
} from "../livreursapi.js";
import LoadingSpinner from "../components/LoadingSpinner.jsx";
import { readStoredAccount } from "../utils/navigation.js";
import LivreurOrders from "../components/LivreurOrders.jsx";
import DriverAccount from "../components/DriverAccount.jsx";
import { formatDriverNumber, mergeDriverCourses } from "../utils/driverOrders.js";
import { useNavigate, useSearchParams } from "react-router-dom";



export default function LivreurDashboard() {
  const [searchParams] = useSearchParams();
  const accountView = searchParams.get("section") === "account";
  const [livreur, setLivreur] = useState(() => {
    return readStoredAccount("livreur");
  });

  const [profile, setProfile] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [editingProfile, setEditingProfile] = useState(false);
  const [editNom, setEditNom] = useState(livreur?.nom || "");
  const [editVille, setEditVille] = useState(livreur?.ville || "");
  const [editVehicule, setEditVehicule] = useState(livreur?.vehicule || "moto");
  const [editModeleVehicule, setEditModeleVehicule] = useState(livreur?.modele_vehicule || "");
  const [savingProfile, setSavingProfile] = useState(false);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [position, setPosition] = useState(null);
  // Bascule "en ligne / hors ligne" façon Uber : c'est le serveur qui fait foi.
  const [isOnline, setIsOnline] = useState(() => {
    const saved = localStorage.getItem("livreurOnline");
    return saved === null ? true : saved === "true";
  });
  const [togglingOnline, setTogglingOnline] = useState(false);

  useEffect(() => {
    localStorage.setItem("livreurOnline", String(isOnline));
  }, [isOnline]);

  const trackingEnabled = isOnline;

  const [activeCourse, setActiveCourse] = useState(null);
  const [courseOffers, setCourseOffers] = useState([]);
  const [respondingOfferId, setRespondingOfferId] = useState(null);
  const [courseNotification, setCourseNotification] = useState("");
  const [showHistory, setShowHistory] = useState(true);
  const [courses, setCourses] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [ordersError, setOrdersError] = useState("");
  const [finishingCourse, setFinishingCourse] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    if (showHistory) {
      loadHistory();
    }
  }, [showHistory]);

  async function loadHistory(silent = false) {
    if (!silent) {
      setLoadingHistory(true);
      setError("");
    }

    try {
      const data = await getLivreurCourses();
      setCourses(data);
      setOrdersError("");
    } catch (err) {
      setOrdersError(err.message || "تعذر تحديث الطلبات.");
    } finally {
      if (!silent) {
        setLoadingHistory(false);
      }
    }
  }

  useEffect(() => {
    if (!livreur?.id) return undefined;

    const interval = setInterval(() => loadHistory(true), 8000);
    const handlePush = () => { loadHistory(true); loadActiveCourse(); };
    window.addEventListener("winrakPush", handlePush);

    return () => { clearInterval(interval); window.removeEventListener("winrakPush", handlePush); };
  }, [livreur?.id]);

  async function handleOfferResponse(courseId, response) {
    if (respondingOfferId) return;
    setRespondingOfferId(courseId);
    setError("");
    try {
      await respondToCourseOffer(courseId, response);
      await Promise.all([loadHistory(true), loadActiveCourse()]);
      const updatedOffers = await getCourseOffers();
      setCourseOffers(updatedOffers);
    } catch (err) {
      setError(err.message || "تعذر تحديث طلب الرحلة.");
      getCourseOffers().then(setCourseOffers).catch(() => {});
      loadHistory(true).catch(() => {});
    } finally {
      setRespondingOfferId(null);
    }
  }

  useEffect(() => {
    if (!livreur?.id) return;
    if (!trackingEnabled) return;

    if (!navigator.geolocation) {
      setError("الموقع الجغرافي غير مدعوم في هذا المتصفح.");
      return;
    }

    let cancelled = false;

    const sendPosition = async (coords) => {
      try {
        const newPosition = {
          latitude: coords.latitude,
          longitude: coords.longitude,
        };

        if (!cancelled) {
          setPosition(newPosition);
        }

        const result = await updateLivreurPosition(livreur.id, {
          latitude: newPosition.latitude,
          longitude: newPosition.longitude,
          disponible: true,
        });

        console.log("REPONSE API :", result);
        setError("");
      } catch (err) {
        console.error("ERREUR CREATE COURSE :", err);
        setError(err.message || "حدث خطأ أثناء إنشاء الرحلة.");
      }
    };

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        sendPosition(pos.coords);
      },
      (geoError) => {
        console.error(geoError);
        setError("الرجاء تفعيل تعقب الموقع في هاتفك");
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 15000,
      }
    );

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        sendPosition(pos.coords);
      },
      (geoError) => {
        console.error(geoError);
        setError("الرجاء تفعيل تعقب الموقع في هاتفك");
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 15000,
      }
    );

    return () => {
      cancelled = true;
      navigator.geolocation.clearWatch(watchId);
    };
  }, [livreur?.id, trackingEnabled]);

  async function loadActiveCourse() {
    if (!livreur?.id) return;

    try {
      const data = await getActiveCoursesForLivreur(livreur.id);

      console.log("COURSE ACTIVE LIVREUR :", data);

      if (data.active && data.course) {
        setActiveCourse(data.course);
        setCourseNotification(
          "🚨 لديك طلب جديد: الزبون قبل الرحلة وشارك موقعه معك."
        );
      } else {
        setActiveCourse(null);
        setCourseNotification("");
      }
    } catch (err) {
      console.error("Erreur chargement course active :", err);
    }
  }

  useEffect(() => {
    if (!livreur?.id) return undefined;

    loadActiveCourse();

    const interval = setInterval(loadActiveCourse, 5000);

    return () => clearInterval(interval);
  }, [livreur?.id]);

  useEffect(() => {
    if (!livreur?.id) return;
    let cancelled = false;
    async function loadOffers() {
      try {
        const data = await getCourseOffers();
        if (!cancelled) setCourseOffers(data);
      } catch (err) {
        console.error("Erreur chargement des offres :", err);
      }
    }
    loadOffers();
    const interval = setInterval(loadOffers, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [livreur?.id]);

  useEffect(() => {
    if (!livreur?.id) return undefined;
    let cancelled = false;

    async function loadReviews() {
      try {
        const data = await getCommentairesLivreur(livreur.id);
        if (!cancelled) {
          setReviews(Array.isArray(data) ? data : data.results || []);
        }
      } catch (err) {
        console.error("Erreur chargement avis :", err);
      }
    }

    if (accountView) loadReviews();

    return () => {
      cancelled = true;
    };
  }, [livreur?.id, accountView]);

  // La source de vérité est le serveur : on aligne la bascule locale dessus.
  useEffect(() => {
    if (!livreur?.id) return;

    let cancelled = false;

    async function syncOnlineStatus() {
      try {
        const data = await getLivreurById(livreur.id);
        if (!cancelled) {
          setProfile(data);
          setIsOnline(Boolean(data.est_en_ligne));
        }
      } catch (syncError) {
        console.error("Erreur synchronisation du statut en ligne :", syncError);
      }
    }

    syncOnlineStatus();
    const interval = setInterval(syncOnlineStatus, 15000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [livreur?.id]);

  if (!livreur) {
    return (
      <div style={{ padding: "20px" }} dir="rtl">
        <p>يجب تسجيل الدخول كسائق.</p>
      </div>
    );
  }

  const photoUrl = profile?.photo || livreur.photo || livreur.image || null;
  const displayName = profile?.nom || livreur.nom;
  // « En ligne » = disponible ET pas déjà en course (comme un chauffeur Uber).
  const isAvailable = trackingEnabled && !activeCourse;
  const vehicleLabels = {
    moto: "دراجة نارية",
    scooter: "دراجة نارية",
    velo: "دراجة",
    voiture: "سيارة",
    camion: "شاحنة",
  };

  async function handleDeleteAccount() {
    const confirmDelete = window.confirm(
      "هل أنت متأكد أنك تريد حذف حسابك نهائيا؟"
    );

    if (!confirmDelete) return;

    try {
      await deleteLivreur(livreur.id);

      localStorage.removeItem("access");
      localStorage.removeItem("refresh");
      localStorage.removeItem("role");
      localStorage.removeItem("livreur");

      window.dispatchEvent(new Event("authChanged"));

      navigate("/livreurs");
    } catch (err) {
      console.error(err);
      setError(err.message || "حدث خطأ أثناء حذف الحساب.");
   
    }


  }

  async function handleTrackingToggle() {
    if (togglingOnline) return;

    setTogglingOnline(true);
    setError("");

    try {
      if (isOnline) {
        await setLivreurOffline(livreur.id);
        setIsOnline(false);
        localStorage.setItem("livreurOnline", "false");
        setMessage("أنت الآن غير متصل. لن تصلك أي طلب جديد.");
      } else {
        const result = await setLivreurOnline(livreur.id);
        setIsOnline(Boolean(result.est_en_ligne));
        localStorage.setItem("livreurOnline", String(Boolean(result.est_en_ligne)));
        setMessage("أنت الآن متصل. ستصلك الطلبات القريبة.");
      }
    } catch (err) {
      console.error("Erreur changement de statut en ligne :", err);
      setError(err.message || "تعذر تغيير حالة الاتصال.");
    } finally {
      setTogglingOnline(false);
    }
  }

  async function handleFinishCourse(courseId) {
    const targetCourse = activeCourse || courses.find((course) => course.id === courseId);

    if (!targetCourse || finishingCourse) return;

    setFinishingCourse(true);
    setError("");

    try {
      await finishCourse(targetCourse.id);
      setActiveCourse(null);
      setCourseNotification("");
      setMessage("تم إنهاء الرحلة وتسجيلها في السجل.");
      if (showHistory) loadHistory();
      try {
        setProfile(await getLivreurById(livreur.id));
      } catch (profileErr) {
        console.error("Erreur rafraîchissement profil :", profileErr);
      }
    } catch (err) {
      setError(err.message || "حدث خطأ أثناء إنهاء الرحلة.");
    } finally {
      setFinishingCourse(false);
    }
  }

  async function handleProfileSave(event) {
    event.preventDefault();
    if (!livreur || savingProfile) return;

    const nom = editNom.trim();
    const ville = editVille.trim();

    if (!nom) {
      setError("الاسم مطلوب.");
      return;
    }

    setSavingProfile(true);
    setError("");

    try {
      const updated = await updateLivreurProfile(livreur.id, {
        nom,
        ville,
        vehicule: editVehicule,
        modele_vehicule: editVehicule === "voiture" ? editModeleVehicule.trim() : "",
      });
      const nextLivreur = {
        ...livreur,
        nom: updated.nom ?? nom,
        ville: updated.ville ?? ville,
        vehicule: updated.vehicule ?? editVehicule,
        modele_vehicule: updated.modele_vehicule ?? (editVehicule === "voiture" ? editModeleVehicule.trim() : ""),
      };
      setLivreur(nextLivreur);
      localStorage.setItem("livreur", JSON.stringify(nextLivreur));
      window.dispatchEvent(new Event("authChanged"));
      setEditingProfile(false);
    } catch (err) {
      setError(err.message || "تعذر تحديث المعلومات.");
    } finally {
      setSavingProfile(false);
    }
  }

  async function logout() {
  try {
    await clearCurrentDriverFcmToken();
  } catch (err) {
    setError(err.message || "تعذر إيقاف إشعارات السائق. أعد المحاولة.");
    return;
  }

  localStorage.removeItem("access");
  localStorage.removeItem("refresh");

  localStorage.removeItem("livreur");
  localStorage.removeItem("client");
  localStorage.removeItem("role");

  window.dispatchEvent(new Event("authChanged"));
  navigate("/");

}
  const isLoggedIn = localStorage.getItem("access");

  if (!isLoggedIn) return null;

  const visibleCourses = mergeDriverCourses(courses, courseOffers, activeCourse);
  const points = profile?.points ?? livreur.points;
  const openAccountEditor = () => {
    setEditNom(profile?.nom || livreur.nom || "");
    setEditVille(profile?.ville || livreur.ville || "");
    setEditVehicule(profile?.vehicule || livreur.vehicule || "moto");
    setEditModeleVehicule(profile?.modele_vehicule || livreur.modele_vehicule || "");
    setEditingProfile((value) => !value);
  };

  return (
    <section className={"page account-page driver-dashboard-page " + (accountView ? "is-account" : "is-home")} dir="rtl">
      {accountView ? <DriverAccount
        livreur={livreur} profile={profile} courses={courses} reviews={reviews} loadingHistory={loadingHistory}
        editingProfile={editingProfile} onEdit={openAccountEditor}
        form={{ name: editNom, setName: setEditNom, city: editVille, setCity: setEditVille,
          vehicle: editVehicule, setVehicle: setEditVehicule,
          vehicleModel: editModeleVehicule, setVehicleModel: setEditModeleVehicule, saving: savingProfile,
          onSave: handleProfileSave, onCancel: () => setEditingProfile(false) }}
        onLogout={logout} onDelete={handleDeleteAccount} onPrivacy={() => navigate("/privacy")}
      /> : <>
        <header className="account-header driver-home-header">
          <button className="driver-home-identity" type="button" aria-label="حسابي"
            onClick={() => navigate("/livreur-dashboard/" + livreur.id + "?section=account")}>
            <div className="account-avatar">{photoUrl ? <img src={photoUrl} alt={displayName} /> : <User size={25} aria-hidden="true" />}</div>
            <div className="account-identity"><h1>{displayName}</h1>
              <span className="account-role">{(profile?.vehicule || livreur.vehicule) === "voiture" ? "حساب سائق" : "حساب عامل توصيل"}</span>
            </div>
          </button>
          <button type="button" className={"driver-availability " + (isAvailable ? "is-online" : "is-offline")}
            onClick={handleTrackingToggle} disabled={togglingOnline || Boolean(activeCourse)}
            role="switch" aria-checked={isOnline}
            aria-label={isOnline ? "إيقاف استقبال الطلبات" : "بدء استقبال الطلبات"}>
            {togglingOnline ? <LoadingSpinner size={16} label="جارٍ التحديث…" /> : <><span className="driver-status-dot" aria-hidden="true" />
              {activeCourse ? "في رحلة" : isOnline ? "متاح" : "غير متاح"}</>}
          </button>
        </header>
        {!isOnline && <p className="driver-status-hint">فعّل استقبال الطلبات عندما تكون جاهزاً.</p>}
        <LivreurOrders livreurId={livreur.id} courses={visibleCourses} loading={loadingHistory} error={ordersError}
          respondingOfferId={respondingOfferId} finishingCourseId={finishingCourse ? activeCourse?.id ?? true : null}
          onAccept={(courseId) => handleOfferResponse(courseId, "accepted")}
          onReject={(courseId) => handleOfferResponse(courseId, "rejected")} onFinish={handleFinishCourse} />
        <button className="driver-rewards-card" type="button"
          onClick={() => navigate("/livreur-dashboard/" + livreur.id + "?section=account")}>
          <span className="driver-reward-icon"><Trophy size={22} aria-hidden="true" /></span>
          <span className="driver-reward-copy"><strong>{formatDriverNumber(points)} نقطة</strong><span>مكافآتك</span></span>
          <ChevronLeft size={20} aria-hidden="true" />
        </button>
      </>}
      {message && <p className="driver-feedback is-success" role="status">{message}</p>}
      {error && <p className="driver-feedback is-error" role="alert">{error}</p>}
    </section>
  );
}
