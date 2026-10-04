import type { Dictionary, Locale } from "@/lib/i18n";
import { localDigits } from "@/lib/format";
import s from "./sections.module.css";

/** The measured numbers from the team test set (npm run eval:team, 2026-10-01; HANDOFF §5), each
 *  against the keyword baseline, with the sample, the real-contract figure and the caveats beside
 *  them, never alone. */
export function Measures({ t, lang }: { t: Dictionary; lang: Locale }) {
  const pct = (v: number) => localDigits(`${v}%`, lang).replace("%", lang === "ar" ? "٪" : "%");
  return (
    <section className={s.section} data-section aria-labelledby="measures-title">
      <div className={s.inner}>
        <h2 id="measures-title" className={s.h2}>
          {t.measures.title}
        </h2>
        <p className={`${s.body} ${s.lead}`}>{t.measures.lead}</p>
        <p className={s.sample}>{t.measures.sample}</p>

        <table className={s.ledger}>
          <thead>
            <tr>
              <th scope="col">{t.measures.colMetric}</th>
              <th scope="col">{t.measures.colMizan}</th>
              <th scope="col">{t.measures.colBaseline}</th>
            </tr>
          </thead>
          <tbody>
            {t.measures.rows.map((row) => (
              <tr key={row.name}>
                <th scope="row">
                  <span className={s.metricName}>{row.name}</span>
                  <span className={s.metricWhy}>{row.why}</span>
                </th>
                <td className={s.figure}>{pct(row.mizan)}</td>
                <td className={`${s.figure} ${s.figureBase}`}>{pct(row.baseline)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className={s.realLine}>{t.measures.real}</p>
        <p className={s.note}>{t.measures.caveat}</p>
        <p className={s.note}>{t.measures.truth}</p>
      </div>
    </section>
  );
}
