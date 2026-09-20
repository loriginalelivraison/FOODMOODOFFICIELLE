const arabicPattern = /[\u0600-\u06FF]/;

const translations = [
  ["Given token not valid", "رمز الدخول غير صالح. يرجى تسجيل الدخول من جديد."],
  ["token_not_valid", "رمز الدخول غير صالح. يرجى تسجيل الدخول من جديد."],
  ["Token is invalid", "رمز الدخول غير صالح. يرجى تسجيل الدخول من جديد."],
  ["Token is expired", "انتهت صلاحية رمز الدخول. يرجى تسجيل الدخول من جديد."],
  ["Connexion impossible", "تعذر تسجيل الدخول."],
  ["Connexion client impossible", "تعذر تسجيل دخول العميل."],
  ["Livreur introuvable", "لم يتم العثور على السائق."],
  ["Erreur lors du chargement des livreurs", "حدث خطأ أثناء تحميل قائمة السائقين."],
  ["Erreur récupération livreur", "حدث خطأ أثناء جلب معلومات السائق."],
  ["Erreur mise à jour position", "حدث خطأ أثناء تحديث الموقع."],
  ["Erreur mise à jour position client", "حدث خطأ أثناء تحديث موقع العميل."],
  ["Erreur désactivation livreur", "حدث خطأ أثناء إيقاف توفر السائق."],
  ["Erreur chargement commentaires", "حدث خطأ أثناء تحميل التعليقات."],
  ["Erreur ajout commentaire", "حدث خطأ أثناء إضافة التعليق."],
  ["Erreur inscription client", "حدث خطأ أثناء إنشاء حساب العميل."],
  ["Erreur lors de l'inscription", "حدث خطأ أثناء إنشاء حساب السائق."],
  ["Erreur suppression compte livreur", "حدث خطأ أثناء حذف حساب السائق."],
  ["Impossible de supprimer le compte client", "تعذر حذف حساب العميل."],
  ["Erreur récupération client", "حدث خطأ أثناء جلب معلومات العميل."],
  ["Erreur création course", "حدث خطأ أثناء إنشاء الرحلة."],
  ["Erreur récupération course", "حدث خطأ أثناء جلب الرحلة."],
  ["Erreur fin course", "حدث خطأ أثناء إنهاء الرحلة."],
  ["Erreur modification photo", "حدث خطأ أثناء تعديل الصورة."],
  ["Erreur chargement course active", "حدث خطأ أثناء تحميل الرحلة النشطة."],
  ["Erreur chargement historique", "حدث خطأ أثناء تحميل السجل."],
  ["Le serveur a renvoyé une page HTML au lieu du JSON.", "أرسل الخادم استجابة غير صالحة."],
  ["Network Error", "تعذر الاتصال بالخادم."],
  ["Failed to fetch", "تعذر الاتصال بالخادم."],
];

function extractMessage(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(extractMessage).filter(Boolean).join("، ");
  if (typeof value === "object") {
    return Object.values(value).map(extractMessage).filter(Boolean).join("، ");
  }
  return String(value);
}

export function toArabicMessage(value, fallback = "حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى.") {
  const message = extractMessage(value).trim();

  if (!message) return fallback;
  if (arabicPattern.test(message)) return message;

  const translation = translations.find(([source]) => message.includes(source));
  return translation?.[1] || fallback;
}
