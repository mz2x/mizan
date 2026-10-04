import Link from "next/link";
import { preload } from "react-dom";
import { HERO_CLAUSES, type Verdict } from "@/content/demo";
import type { Dictionary, Locale } from "@/lib/i18n";
import { displayId, localDigits } from "@/lib/format";
import { GuillocheField } from "./GuillocheField";
import { Wordmark } from "@/components/Wordmark";
import { IconArrow } from "@/components/icons";
import s from "./hero.module.css";
import { localePath } from "@/lib/paths";
import { FEATURES } from "@/lib/features";

const STAMP_PLATE: Record<Verdict, string | null> = {
  nonCompliant: "stamp-red",
  review: "stamp-bracket",
  abstain: "stamp-dashed",
  compliant: null,
};

/** The 2-minute explainer animation (Google Drive, shared by link). */
const ANIMATION_URL = "https://drive.google.com/file/d/1GNz0tQFj6LfB9eAdJ9dYXEPdi2Ca4jsS/view?usp=sharing";

export function Hero({ t, lang }: { t: Dictionary; lang: Locale }) {
  const other = lang === "ar" ? "en" : "ar";
  // The violet field is the largest paint; its texture lives in CSS, so announce it early.
  preload("/assets/plates/violet-ground.webp", { as: "image", type: "image/webp", fetchPriority: "high" });

  return (
    <section className={s.hero} data-section aria-labelledby="hero-title">
      <div className={s.band} aria-hidden>
        <GuillocheField microtext="ميزان" idPrefix="hero" />
      </div>
      <div className={s.chrome}>
        <div className={s.perforation} aria-hidden />
        <Link className={s.lang} href={localePath(other)} hrefLang={other} aria-label={t.nav.switchLangLabel}>
          {t.nav.switchLang}
        </Link>
        <nav className={s.nav} aria-label={t.nav.sections}>
          <Link href={localePath(lang, "/how")}>{t.nav.how}</Link>
          {FEATURES.dashboard && <Link href={localePath(lang, "/dashboard")}>{t.nav.dashboard}</Link>}
        </nav>
      </div>
      <div className={s.frame}>
        <div className={s.field}>
          <picture>
            <source media="(max-width: 820px)" srcSet="/assets/plates/rosette-sm.webp" type="image/webp" />
            <source srcSet="/assets/plates/rosette.webp" type="image/webp" />
            <img className={s.rosette} src="/assets/plates/rosette.png" alt="" decoding="async" />
          </picture>
          <div className={s.intro}>
            <h1 id="hero-title" className={s.wordmark}>
              <Wordmark label={t.hero.name} />
            </h1>
            <p className={s.tagline}>{t.hero.tagline}</p>
            <p className={s.lead}>{t.hero.lead}</p>
            <div className={s.actions}>
              <Link className="btn btn-paper" href={localePath(lang, "/review")}>
                {t.hero.ctaTry}
                <IconArrow className="btn-arrow" />
              </Link>
              {/* "How it works" is already in the masthead; this slot plays the 2-minute animation. */}
              <a className="btn btn-ghost on-violet" href={ANIMATION_URL} target="_blank" rel="noopener noreferrer" aria-label={t.hero.ctaVideoLabel}>
                <svg className={s.play} viewBox="0 0 24 24" aria-hidden>
                  <path d="M8 5.5v13l11-6.5z" fill="currentColor" />
                </svg>
                {t.hero.ctaVideo}
              </a>
            </div>
          </div>
        </div>

        <ol className={s.stubs} aria-label={t.hero.stubsLabel}>
          {HERO_CLAUSES.map((clause, i) => {
            const plate = STAMP_PLATE[clause.verdict];
            return (
              <li key={clause.serial} className={`${s.stub} ${s[`stub${i + 1}`]}`}>
                <span className={s.serial}>
                  <span className="sr-only">{t.hero.serialLabel} </span>
                  <bdi dir="ltr">{clause.serial}</bdi>
                </span>
                <div className={`${s.stamp} ${s[clause.verdict]}`}>
                  {plate && (
                    <picture>
                      <source srcSet={`/assets/plates/${plate}.webp`} type="image/webp" />
                      <img className={s.stampPlate} src={`/assets/plates/${plate}.png`} alt="" />
                    </picture>
                  )}
                  <span className={`${s.stampWord} ink-grain`}>{t.verdicts[clause.verdict]}</span>
                  {clause.citation && (
                    <bdi dir="rtl" className={`${s.stampId} ink-grain`}>{displayId(clause.citation, lang)}</bdi>
                  )}
                </div>
                <p className={s.clause} lang={lang}>
                  {localDigits(clause.text[lang], lang)}
                </p>
              </li>
            );
          })}
        </ol>
        <a className={s.scrollCue} href="#register">
          <span>{t.hero.scroll}</span>
          <svg viewBox="0 0 24 24" aria-hidden className={s.scrollChevron}>
            <path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </a>
      </div>
    </section>
  );
}
