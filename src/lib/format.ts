import type { Locale } from "./i18n";

const ARABIC_INDIC = "٠١٢٣٤٥٦٧٨٩";

/** Arabic-Indic digits for Arabic display; data keeps Western digits. */
export const localDigits = (value: string, locale: Locale) =>
  locale === "ar" ? value.replace(/[0-9]/g, (d) => ARABIC_INDIC[Number(d)]) : value;

/** Unit ids are canonical Arabic strings; only their digits change per locale. */
export const displayId = (id: string, locale: Locale) => localDigits(id, locale);

const HIJRI = {
  ar: ["محرم", "صفر", "ربيع الأول", "ربيع الآخر", "جمادى الأولى", "جمادى الآخرة", "رجب", "شعبان", "رمضان", "شوال", "ذو القعدة", "ذو الحجة"],
  en: ["Muharram", "Safar", "Rabiʿ al-Awwal", "Rabiʿ al-Akhir", "Jumada al-Ula", "Jumada al-Akhira", "Rajab", "Shaʿban", "Ramadan", "Shawwal", "Dhu al-Qaʿda", "Dhu al-Hijja"],
};
const GREGORIAN = {
  ar: ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"],
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
};

/**
 * Decision dates are written in the source as "08و09\04\1430" (a two-day session) or
 * "10\07\1431". Render them as words so bidi reordering cannot scramble them.
 */
export function formatDecisionDate(raw: string, calendar: "hijri" | "gregorian", locale: Locale) {
  const m = raw.match(/^(\d{1,2})(?:و(\d{1,2}))?[\\/](\d{1,2})[\\/](\d{4})$/);
  if (!m) return localDigits(raw.replaceAll("\\", "/"), locale);
  const [, d1, d2, month, year] = m;
  // A malformed month in the source is shown as written rather than as «undefined».
  if (Number(month) < 1 || Number(month) > 12) return localDigits(raw.replaceAll("\\", "/"), locale);
  const days = d2 ? `${Number(d1)}–${Number(d2)}` : String(Number(d1));
  const name = (calendar === "hijri" ? HIJRI : GREGORIAN)[locale][Number(month) - 1];
  const suffix = calendar === "hijri" ? (locale === "ar" ? "هـ" : " AH") : locale === "ar" ? "م" : "";
  return localDigits(`${days} ${name} ${year}${suffix}`, locale);
}

/** True when the text is written in Arabic script (engine rows carry the document's own language). */
export const isArabicText = (text: string) => /[\u0600-\u06FF]/.test(text);
