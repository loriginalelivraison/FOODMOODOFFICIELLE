import React, { useEffect, useRef, useState } from "react";
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
  logoutCurrentAccount,
  getLivreurById,
  getCommentairesLivreur,
  updateLivreurProfile,
} from "../livreursapi.js";
import LoadingSpinner from "../components/LoadingSpinner.jsx";
import { readStoredAccount } from "../utils/navigation.js";
import LivreurOrders from "../components/LivreurOrders.jsx";
import DriverAccount from "../components/DriverAccount.jsx";
import { formatDriverNumber, mergeDriverCourses } from "../utils/driverOrders.js";
import { canFinishCourse } from "../utils/courseTracking.js";
import { getLocationErrorMessage, isIOSDevice, requestUserPosition } from "../utils/geolocation.js";
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
  const [editPhoto, setEditPhoto] = useState(null);
  const [savingProfile, setSavingProfile] = useState(false);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [locationError, setLocationError] = useState("");
  const [statusError, setStatusError] = useState("");
  const [isOnline, setIsOnline] = useState(false);
  const [statusLoaded, setStatusLoaded] = useState(false);
  const [togglingOnline, setTogglingOnline] = useState(false);
  const onlineMutation = useRef(false);
  const profileRevision = useRef(0);

  useEffect(() => {
    if (!statusLoaded || localStorage.getItem("role") !== "livreur") return;
    localStorage.setItem("livreurOnline", String(isOnline));
  }, [isOnline, statusLoaded]);

  const [activeCourse, setActiveCourse] = useState(null);
  const trackingEnabled = isOnline || Boolean(activeCourse);
  const [courseOffers, setCourseOffers] = useState([]);
  const [respondingOfferId, setRespondingOfferId] = useState(null);
  const [courses, setCourses] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [ordersError, setOrdersError] = useState("");
  const [finishingCourseId, setFinishingCourseId] = useState(null);
  const [closingAccount, setClosingAccount] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    if (livreur?.id) loadHistory();
  }, [livreur?.id]);

  async function loadHistory(silent = false) {
    if (!silent) {
      setLoadingHistory(true);
    }

    try {
      const data = await getLivreurCourses();
      const records = Array.isArray(data) ? data : data?.results;
      if (!Array.isArray(records) || records.some((course) => !course || typeof course !== "object")) {
        throw new Error("تعذر قراءة سجل الطلبات. حاول مجدداً.");
      }
      setCourses(records);
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

  async function handleOfferResponse(courseId, response, offeredPrice) {
    if (respondingOfferId) return;
    setRespondingOfferId(courseId);
    setError("");
    try {
      await respondToCourseOffer(courseId, response, offeredPrice);
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
      setLocationError("الموقع الجغرافي غير مدعوم في هذا المتصفح.");
      return;
    }

    let cancelled = false;

    const sendPosition = async (coords) => {
      if (cancelled) return;
      try {
        const newPosition = {
          latitude: coords.latitude,
          longitude: coords.longitude,
        };

        await updateLivreurPosition(livreur.id, {
          latitude: newPosition.latitude,
          longitude: newPosition.longitude,
        });

        if (!cancelled) setLocationError("");
      } catch (err) {
        if (!cancelled) setLocationError(err.message || "تعذر تحديث موقعك. تحقق من الاتصال.");
      }
    };

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        sendPosition(pos.coords);
      },
      (geoError) => {
        if (!cancelled) setLocationError(getLocationErrorMessage(geoError, isIOSDevice()));
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
        if (!cancelled) setLocationError(getLocationErrorMessage(geoError, isIOSDevice()));
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
      if (localStorage.getItem("role") !== "livreur"
        || String(readStoredAccount("livreur")?.id) !== String(livreur.id)) return;

      if (data.active && data.course) {
        setActiveCourse(data.course);
        localStorage.setItem("activeDriverCourseId", String(data.course.id));
      } else {
        setActiveCourse(null);
        localStorage.removeItem("activeDriverCourseId");
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
        const records = Array.isArray(data) ? data : data?.results;
        if (!Array.isArray(records) || records.some((review) => !review || typeof review !== "object")) {
          throw new Error("تعذر قراءة التقييمات.");
        }
        if (!cancelled) {
          setReviews(records);
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
      if (onlineMutation.current) return;
      const revision = profileRevision.current;
      try {
        const data = await getLivreurById(livreur.id);
        if (!cancelled && !onlineMutation.current && revision === profileRevision.current
          && localStorage.getItem("role") === "livreur") {
          setProfile(data);
          setIsOnline(Boolean(data.est_en_ligne));
          setStatusLoaded(true);
          setStatusError("");
        }
      } catch (syncError) {
        if (!cancelled) setStatusError(syncError.message || "تعذر تحديث حالة الاتصال. أعد المحاولة.");
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
  const isAvailable = isOnline && !activeCourse;

  async function handleDeleteAccount() {
    if (closingAccount) return;
    const confirmDelete = window.confirm(
      "هل أنت متأكد أنك تريد حذف حسابك نهائيا؟"
    );

    if (!confirmDelete) return;

    setClosingAccount(true);
    try {
      await deleteLivreur(livreur.id);
      await logoutCurrentAccount();
      navigate("/", { replace: true });
    } catch (err) {
      console.error(err);
      setError(err.message || "حدث خطأ أثناء حذف الحساب.");
    } finally {
      setClosingAccount(false);
    }


  }

  async function handleTrackingToggle() {
    if (onlineMutation.current) return;

    onlineMutation.current = true;
    profileRevision.current += 1;
    setTogglingOnline(true);
    setError("");
    setMessage("");

    try {
      if (isOnline) {
        await setLivreurOffline(livreur.id);
        setIsOnline(false);
        localStorage.setItem("livreurOnline", "false");
        setMessage("أنت الآن غير متصل. لن تصلك أي طلب جديد.");
      } else {
        // A fresh position is required before advertising the driver as available.
        const position = await requestUserPosition({ enableHighAccuracy: true, timeout: 15000, retryWithLowAccuracy: true });
        await updateLivreurPosition(livreur.id, {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        const result = await setLivreurOnline(livreur.id);
        setIsOnline(Boolean(result.est_en_ligne));
        localStorage.setItem("livreurOnline", String(Boolean(result.est_en_ligne)));
        setMessage("أنت الآن متصل. ستصلك الطلبات القريبة.");
        setLocationError("");
      }
      setStatusLoaded(true);
      setStatusError("");
    } catch (err) {
      setError(typeof err.code === "number" ? getLocationErrorMessage(err, isIOSDevice()) : err.message || "تعذر تغيير حالة الاتصال.");
    } finally {
      onlineMutation.current = false;
      setTogglingOnline(false);
    }
  }

  async function handleFinishCourse(courseId) {
    const targetCourse = String(activeCourse?.id) === String(courseId)
      ? activeCourse : courses.find((course) => String(course.id) === String(courseId));

    if (!targetCourse || !canFinishCourse(targetCourse) || finishingCourseId !== null) return;

    setFinishingCourseId(targetCourse.id);
    setError("");

    try {
      await finishCourse(targetCourse.id);
      setActiveCourse(null);
      localStorage.removeItem("activeDriverCourseId");
      setCourses((current) => current.map((course) => String(course.id) === String(targetCourse.id)
        ? { ...course, active: false, status: "completed" } : course));
      setMessage("تم إنهاء الرحلة وتسجيلها في السجل.");
      await loadHistory(true);
      try {
        setProfile(await getLivreurById(livreur.id));
      } catch (profileErr) {
        console.error("Erreur rafraîchissement profil :", profileErr);
      }
      navigate(`/livreur-course/${targetCourse.id}`);
    } catch (err) {
      setError(err.message || "حدث خطأ أثناء إنهاء الرحلة.");
    } finally {
      setFinishingCourseId(null);
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
    if (editPhoto && editPhoto.size > 5 * 1024 * 1024) {
      setError("حجم الصورة يجب ألا يتجاوز 5 ميغابايت.");
      return;
    }

    setSavingProfile(true);
    profileRevision.current += 1;
    setError("");

    try {
      const updated = await updateLivreurProfile(livreur.id, {
        nom,
        ville,
        vehicule: editVehicule,
        modele_vehicule: editVehicule === "voiture" ? editModeleVehicule.trim() : "",
        ...(editPhoto ? { photo: editPhoto } : {}),
      });
      const nextLivreur = {
        ...livreur,
        nom: updated.nom ?? nom,
        ville: updated.ville ?? ville,
        vehicule: updated.vehicule ?? editVehicule,
        modele_vehicule: updated.modele_vehicule ?? (editVehicule === "voiture" ? editModeleVehicule.trim() : ""),
        photo: updated.photo ?? livreur.photo,
      };
      setLivreur(nextLivreur);
      setProfile((current) => ({ ...current, ...updated }));
      profileRevision.current += 1;
      localStorage.setItem("livreur", JSON.stringify(nextLivreur));
      window.dispatchEvent(new Event("authChanged"));
      setEditingProfile(false);
      setEditPhoto(null);
      setMessage("تم حفظ معلوماتك.");
    } catch (err) {
      setError(err.message || "تعذر تحديث المعلومات.");
    } finally {
      setSavingProfile(false);
    }
  }

  async function logout() {
    if (closingAccount) return;
    setClosingAccount(true);
    try {
      await logoutCurrentAccount();
      navigate("/", { replace: true });
    } finally {
      setClosingAccount(false);
    }
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
    setEditPhoto(null);
    setEditingProfile((value) => !value);
  };

  return (
    <section className={"page account-page driver-dashboard-page " + (accountView ? "is-account" : "is-home")} dir="rtl">
      {accountView ? <DriverAccount
        livreur={livreur} profile={profile} courses={courses} reviews={reviews} loadingHistory={loadingHistory}
        historyError={ordersError} closingAccount={closingAccount}
        editingProfile={editingProfile} onEdit={openAccountEditor}
        form={{ name: editNom, setName: setEditNom, city: editVille, setCity: setEditVille,
          vehicle: editVehicule, setVehicle: setEditVehicule,
          vehicleModel: editModeleVehicule, setVehicleModel: setEditModeleVehicule, saving: savingProfile,
          photo: editPhoto, setPhoto: setEditPhoto,
          onSave: handleProfileSave, onCancel: () => { setEditingProfile(false); setEditPhoto(null); } }}
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
            onClick={handleTrackingToggle} disabled={togglingOnline}
            role="switch" aria-checked={isOnline}
            aria-label={isOnline ? "إيقاف استقبال الطلبات" : "بدء استقبال الطلبات"}>
            {togglingOnline ? <LoadingSpinner size={16} label="جارٍ التحديث…" /> : <><span className="driver-status-dot" aria-hidden="true" />
              {!statusLoaded ? "تحديث الحالة" : activeCourse ? "في رحلة" : isOnline ? "متاح" : "غير متاح"}</>}
          </button>
        </header>
        <LivreurOrders livreurId={livreur.id} courses={visibleCourses} loading={loadingHistory} error={ordersError}
          respondingOfferId={respondingOfferId} finishingCourseId={finishingCourseId} onRetry={() => loadHistory()}
          onAccept={(courseId, offeredPrice) => handleOfferResponse(courseId, "accepted", offeredPrice)}
          onReject={(courseId) => handleOfferResponse(courseId, "rejected")} onFinish={handleFinishCourse} />
        <button className="driver-rewards-card" type="button"
          onClick={() => navigate("/livreur-dashboard/" + livreur.id + "?section=account")}>
          <span className="driver-reward-icon"><Trophy size={22} aria-hidden="true" /></span>
          <span className="driver-reward-copy"><strong>{formatDriverNumber(points)} نقطة</strong><span>مكافآتك</span></span>
          <ChevronLeft size={20} aria-hidden="true" />
        </button>
      </>}
      {message && <p className="driver-feedback is-success" role="status">{message}</p>}
      {statusError && <p className="driver-feedback is-error" role="alert">{statusError}</p>}
      {trackingEnabled && locationError && <p className="driver-feedback is-error" role="alert">{locationError}</p>}
      {error && <p className="driver-feedback is-error" role="alert">{error}</p>}
    </section>
  );
}
