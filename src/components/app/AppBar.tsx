import Link from "next/link";
import { Wordmark } from "@/components/Wordmark";
import type { Dictionary, Locale } from "@/lib/i18n";
import { localePath } from "@/lib/paths";
import { FEATURES } from "@/lib/features";
import s from "./appbar.module.css";

type Here = "review" | "how" | "dashboard" | "privacy";

/** The violet header strip shared by every app page: wordmark home, the page title, and the same
 *  four destinations everywhere, the current one marked. */
export function AppBar({ t, lang, title, here }: { t: Dictionary; lang: Locale; title: string; here: Here }) {
  const other = lang === "ar" ? "en" : "ar";
  const all: { key: Here; href: string; label: string }[] = [
    { key: "how", href: "/how", label: t.nav.how },
    { key: "review", href: "/review", label: t.nav.cta },
    { key: "dashboard", href: "/dashboard", label: t.nav.dashboard },
  ];
  const links = all.filter((l) => l.key !== "dashboard" || FEATURES.dashboard);
  return (
    <header className={s.bar}>
      <Link href={localePath(lang)} className={s.brand} aria-label={`${t.hero.name}: ${t.review.back}`}>
        <Wordmark label="" />
      </Link>
      <p className={s.title}>{title}</p>
      <nav className={s.nav} aria-label={t.nav.sections}>
        {links.map((l) => (
          <Link key={l.key} href={localePath(lang, l.href)} className={s.link} aria-current={l.key === here ? "page" : undefined}>
            {l.label}
          </Link>
        ))}
        <Link href={localePath(other, here === "privacy" ? "/privacy" : `/${here}`)} hrefLang={other} className={s.link} aria-label={t.nav.switchLangLabel}>
          {t.nav.switchLang}
        </Link>
      </nav>
    </header>
  );
}
