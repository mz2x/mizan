import type { Dictionary, Locale } from "@/lib/i18n";
import { localDigits } from "@/lib/format";
import s from "./sections.module.css";

const PUBLISHED = 1220;
/** 479 is published by title only; 1186 and 1187 return empty from the source. */
const WITHOUT_TEXT = new Set([479, 1186, 1187]);
/** Decisions cited by the clauses on this page. */
const LIT = new Map([
  [7, "ق7"],
  [15, "ق15"],
  [209, "ق209"],
]);

export function Register({ t, lang }: { t: Dictionary; lang: Locale }) {
  return (
    <section id="register" className={s.section} data-section aria-labelledby="register-title">
      <div className={`${s.inner} ${s.split}`}>
        <div className={s.copy}>
          <h2 id="register-title" className={s.h2}>
            {t.register.title}
          </h2>
          {t.register.body.map((p) => (
            <p key={p} className={s.body}>
              {p}
            </p>
          ))}
        </div>

        <figure className={s.sheetFigure}>
          <div className={s.sheet} role="img" aria-label={t.register.sheetLabel}>
            {Array.from({ length: PUBLISHED }, (_, i) => {
              const n = i + 1;
              const lit = LIT.get(n);
              const cls = lit ? s.cellLit : WITHOUT_TEXT.has(n) ? s.cellMissing : s.cell;
              return (
                <span key={n} className={cls} title={lit ? localDigits(lit, lang) : undefined}>
                  {lit && <span className={s.cellTag}>{localDigits(lit, lang)}</span>}
                </span>
              );
            })}
          </div>
          <figcaption className={s.legend}>
            <span><i className={s.cell} aria-hidden /> {t.register.legendText}</span>
            <span><i className={s.cellMissing} aria-hidden /> {t.register.legendMissing}</span>
            <span><i className={s.cellLit} aria-hidden /> {t.register.legendLit}</span>
          </figcaption>
        </figure>
      </div>
    </section>
  );
}
