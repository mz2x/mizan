"use client";

import { Stamp } from "@/components/Stamp";
import { Provenance } from "@/components/sections/Provenance";
import { IconCheck } from "@/components/icons";
import { segment } from "@/content/termgap";
import { UNITS } from "@/content/units";
import { localDigits, isArabicText } from "@/lib/format";
import type { Dictionary, Locale } from "@/lib/i18n";
import type { ClauseResult, OtherType, SegmentKind } from "@/lib/review-types";
import { DECISIONS, type Decision } from "@/lib/runs";
import s from "./review.module.css";

/** `ar`: the clause text is the document's own Arabic (engine rows), whatever the page language. */
export type Row = { n: number; text: string; ar?: boolean; result?: ClauseResult; verbatim?: boolean; kind?: SegmentKind; otherType?: OtherType | null; context?: number[] };

const serial = (n: number) => String(n).padStart(4, "0");

/** The committee's decision on one finding: shown on saved reviews only. */
export type Committee = { value: Decision | null; onChange: (d: Decision | null) => void; busy?: boolean };

export function ClauseRow({ row, t, lang, offline, committee }: { row: Row; t: Dictionary; lang: Locale; offline: boolean; committee?: Committee }) {
  const r = t.review;
  const res = row.result;
  const escalated = res && (res.verdict === "review" || res.verdict === "abstain");
  const superseded = res?.flags?.filter((f) => f.kind === "superseded") ?? [];
  // Flag detail reads "<unit id> ← 1058,1200": the amending decisions follow the arrow.
  const amending = [...new Set(superseded.flatMap((f) => (f.detail.split("←")[1] ?? "").match(/\d+/g) ?? []))];
  const sep = lang === "ar" ? "، " : ", ";
  const failed = res?.flags?.some((f) => f.kind === "error");
  const approved = res?.flags?.find((f) => f.kind === "approved_form");

  const sepIntro = lang === "ar" ? "، " : ", ";
  if (row.kind === "intro")
    return (
      <li className={`${s.row} ${s.rowIntro}`} data-verdict="intro">
        <div className={s.rowMain}>
          <span className={s.rowSerial}>
            <bdi dir="ltr">{serial(row.n)}</bdi>
          </span>
          <p className={s.rowText} dir="auto">{row.text}</p>
          <div className={s.rowMark}>
            <span className={s.introMark}>
              {r.introMark}
              {row.context && row.context.length > 0 && <small>{r.introItems} {localDigits(row.context.join(sepIntro), lang)}</small>}
            </span>
          </div>
        </div>
      </li>
    );

  if (row.kind === "other")
    return (
      <li className={`${s.row} ${s.rowOther}`} data-verdict="other">
        <div className={s.rowMain}>
          <span className={s.rowSerial}>
            <bdi dir="ltr">{serial(row.n)}</bdi>
          </span>
          <p className={s.rowText} dir="auto">{row.text}</p>
          <div className={s.rowMark}>
            <span className={s.notClause}>
              {r.notClause}
              {row.otherType && <small>{r.otherTypes[row.otherType]}</small>}
            </span>
          </div>
        </div>
      </li>
    );

  // Governing evidence first, prominent; the rest (supporting, related) smaller underneath.
  const roleOf = (id: string) => res?.roles?.[id];
  const primary = res ? (res.roles ? res.citations.filter((id) => roleOf(id) === "governs") : res.citations.slice(0, 1)) : [];
  const lead = primary.length ? primary : (res?.citations.slice(0, 1) ?? []);
  const rest = res ? res.citations.filter((id) => !lead.includes(id)) : [];
  const quote = (id: string, small: boolean) => {
    const unit = res!.units?.[id] ?? UNITS[id];
    const affirmed = res!.affirmedBy?.[id] ?? [];
    const role = roleOf(id);
    return (
      <blockquote key={id} className={`${s.quote} ${small ? s.quoteSmall : ""}`} lang="ar" dir="rtl">
        {!unit && (
          <p className={s.detailNote}>
            <bdi dir="rtl">{id}</bdi>
          </p>
        )}
        {unit && (
          <p>
            «
            {segment(unit.text, (res!.marks?.[id] ?? []).map((text) => ({ text, pair: 0 }))).map((seg, i) =>
              seg.pair === null ? seg.text : <mark key={i} className={s.match}>{seg.text}</mark>,
            )}
            »
          </p>
        )}
        {unit && <Provenance unit={unit} lang={lang} />}
        {role && (
          <span className={s.roleTag} lang={lang} dir={lang === "ar" ? "rtl" : "ltr"}>
            {r.roles[role]}
          </span>
        )}
        {affirmed.length > 0 && (
          <span className={`${s.badge} ${s.affirmed}`} lang={lang} dir={lang === "ar" ? "rtl" : "ltr"}>
            {affirmed.length > 1 ? r.affirmedPlural : r.affirmed} ({localDigits(affirmed.join(sep), lang)})
          </span>
        )}
      </blockquote>
    );
  };

  return (
    <li className={s.row} data-verdict={res?.verdict ?? (offline ? "offline" : "pending")}>
      <div className={s.rowMain}>
        <span className={s.rowSerial}>
          <bdi dir="ltr">{serial(row.n)}</bdi>
        </span>
        {/* Engine rows hold the document's own text: dir="auto" lets the text pick its direction,
            and lang="ar" is set only when it really is Arabic. */}
        <p className={s.rowText} lang={row.ar ? (isArabicText(row.text) ? "ar" : undefined) : lang} dir={row.ar ? "auto" : undefined}>
          {row.text}
        </p>
        <div className={s.rowMark}>
          {res ? (
            <>
              <Stamp verdict={res.verdict} label={t.verdicts[res.verdict]} citation={res.citations[0]} lang={lang} className={s.pressed} />
              {(superseded.length > 0 || failed || approved) && (
                <span className={s.badges}>
                  {superseded.length > 0 && (
                    <span className={s.badge} title={superseded.map((f) => f.detail).join("؛ ")}>
                      {r.superseded}
                      {amending.length > 0 && ` (${localDigits(amending.join(sep), lang)})`}
                    </span>
                  )}
                  {approved && (
                    <span className={s.badge}>
                      {r.approvedForm} ({localDigits(approved.detail, lang)})
                    </span>
                  )}
                  {failed && <span className={`${s.badge} ${s.badgeAlert}`}>{r.clauseError}</span>}
                </span>
              )}
            </>
          ) : (
            <span className={offline ? s.notChecked : s.scanning}>{offline ? r.notChecked : r.scanning}</span>
          )}
        </div>
      </div>

      {res && (
        <details className={s.rowDetails}>
          <summary>{r.details}</summary>
          <div className={s.detailGrid}>
            <div>
              <h4 className={s.detailLabel}>{r.reason}</h4>
              <p className={s.detailText}>{res.reason[lang]}</p>
              {res.related && res.related.length > 0 && (
                <p className={s.relatedNote}>
                  {r.relatedNote} {localDigits(res.related.map((x) => String(x)).join(sep), lang)}
                </p>
              )}
              {res.suggestion && (
                <div className={s.suggest}>
                  <h4 className={s.detailLabel}>{r.suggestion}</h4>
                  <p className={s.suggestText}>{res.suggestion[lang]}</p>
                  <p className={s.detailNote}>{r.suggestionNote}</p>
                </div>
              )}
            </div>
            <div>
              <h4 className={s.detailLabel}>{escalated && res.citations.length ? r.related : r.evidence}</h4>
              {res.citations.length === 0 && <p className={s.detailText}>{r.noEvidence}</p>}
              {lead.map((id) => quote(id, false))}
              {rest.length > 0 && (
                <>
                  <h4 className={`${s.detailLabel} ${s.moreLabel}`}>
                    {r.moreEvidence} ({localDigits(String(rest.length), lang)})
                  </h4>
                  {rest.map((id) => quote(id, true))}
                </>
              )}
              {res.citations.length > 0 && row.verbatim && (
                <p className={s.verbatim}>
                  <IconCheck className={s.verbatimIcon} />
                  {r.verbatim}
                </p>
              )}
            </div>
          </div>
        </details>
      )}
      {committee && res && (
        <div className={s.committee} role="group" aria-label={r.committeeLabel}>
          <span className={s.committeeLabel}>{r.committeeLabel}</span>
          {DECISIONS.map((d) => (
            <button
              key={d}
              type="button"
              className={s.committeeBtn}
              aria-pressed={committee.value === d}
              disabled={committee.busy}
              onClick={() => committee.onChange(committee.value === d ? null : d)}
            >
              {r.decisions[d]}
            </button>
          ))}
        </div>
      )}
    </li>
  );
}
