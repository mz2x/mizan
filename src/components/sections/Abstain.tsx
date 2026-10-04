import { HERO_CLAUSES } from "@/content/demo";
import type { Dictionary, Locale } from "@/lib/i18n";
import s from "./sections.module.css";

export function Abstain({ t, lang }: { t: Dictionary; lang: Locale }) {
  const clause = HERO_CLAUSES.find((c) => c.verdict === "abstain")!;
  return (
    <section className={s.section} data-section aria-labelledby="abstain-title">
      <div className={`${s.inner} ${s.split}`}>
        <div className={s.copy}>
          <h2 id="abstain-title" className={s.h2}>
            {t.abstain.title}
          </h2>
          <p className={s.body}>{t.abstain.lead}</p>
          <p className={s.principle}>{t.abstain.principle}</p>
        </div>

        <article className={`${s.instrument} ${s.abstainSlip}`}>
          <header className={s.instrumentHead}>
            <span>{t.hero.serialLabel}</span>
            <bdi dir="ltr" className={s.serialSmall}>{clause.serial}</bdi>
          </header>
          <p className={s.clauseLarge} lang={lang}>{clause.text[lang]}</p>
          <div className={s.bigSeal} data-stamp>
            <picture><source srcSet="/assets/plates/stamp-dashed.webp" type="image/webp" /><img src="/assets/plates/stamp-dashed.png" alt="" /></picture>
            <span className="ink-grain">{t.verdicts.abstain}</span>
          </div>
          <p className={s.note}>{t.abstain.searched}</p>
        </article>
      </div>
    </section>
  );
}
