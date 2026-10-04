import type { Locale } from "./i18n";

/** Arabic is served at the root (mizansharia.com, /review); English under /en. The proxy maps the
 *  unprefixed paths onto the [lang] routes. */
export function localePath(lang: Locale, path = ""): string {
  return lang === "ar" ? path || "/" : `/en${path}`;
}
