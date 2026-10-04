import { ar } from "@/content/dictionaries/ar";
import { en } from "@/content/dictionaries/en";

export const locales = ["ar", "en"] as const;
export type Locale = (typeof locales)[number];

export const hasLocale = (value: string): value is Locale =>
  (locales as readonly string[]).includes(value);

export const dir = (locale: Locale) => (locale === "ar" ? "rtl" : "ltr");

const dictionaries = { ar, en };
export type Dictionary = typeof ar;
export const getDictionary = (locale: Locale): Dictionary => dictionaries[locale];
