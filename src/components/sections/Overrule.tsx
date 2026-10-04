import { PREAMBLE_EXCERPTS, UNITS } from "@/content/units";
import type { Dictionary, Locale } from "@/lib/i18n";
import { displayId } from "@/lib/format";
import { Provenance } from "./Provenance";
import s from "./sections.module.css";

export function Overrule({ t, lang }: { t: Dictionary; lang: Locale }) {
  const ruling = UNITS["الإنماء/ق15/أولاً"];
  const { q15Proposal, q15Reason } = PREAMBLE_EXCERPTS;

  return (
    <section className={s.section} data-section aria-labelledby="overrule-title">
      <div className={s.inner}>
        <h2 id="overrule-title" className={`${s.h2} ${s.h2Wide}`}>
          {t.overrule.title}
        </h2>
        <p className={`${s.body} ${s.lead}`}>{t.overrule.lead}</p>

        <div className={s.overruleGrid}>
          <article className={`${s.instrument} ${s.struck}`}>
            <header className={s.instrumentHead}>
              <span>{t.overrule.proposalLabel}</span>
            </header>
            <blockquote className={s.quoteDoc} lang="ar" dir="rtl">
              «{q15Proposal.text}»
            </blockquote>
            <p className={s.excerptSource} lang="ar">{q15Proposal.label}</p>
            <div className={s.overStamp} data-stamp role="img" aria-label={`${t.verdicts.nonCompliant} — ${displayId(ruling.id, lang)}`}>
              <picture><source srcSet="/assets/plates/stamp-red.webp" type="image/webp" /><img src="/assets/plates/stamp-red.png" alt="" /></picture>
              <span className="ink-grain">{t.verdicts.nonCompliant}</span>
              <bdi dir="rtl" className="ink-grain">{displayId(ruling.id, lang)}</bdi>
            </div>
          </article>

          <article className={s.instrument}>
            <header className={s.instrumentHead}>
              <span>{t.overrule.rulingLabel}</span>
            </header>
            <blockquote className={s.quoteDoc} lang="ar" dir="rtl">
              «{ruling.text}»
            </blockquote>
            <Provenance unit={ruling} lang={lang} />
            <details className={s.reason}>
              <summary>{t.overrule.reasonLabel}</summary>
              <p lang="ar" dir="rtl">«{q15Reason.text}»</p>
              <p className={s.excerptSource} lang="ar">{q15Reason.label}</p>
            </details>
          </article>
        </div>

        <aside className={s.suggestion}>
          <h3 className={s.suggestionLabel}>{t.overrule.suggestionLabel}</h3>
          <p className={s.clauseLarge}>{t.overrule.suggestion}</p>
          <p className={s.note}>{t.overrule.suggestionNote}</p>
        </aside>
      </div>
    </section>
  );
}
