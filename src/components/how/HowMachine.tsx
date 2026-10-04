"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { HOW } from "@/content/how";
import trace from "@/content/how-trace.json";
import { DEMO_CONTRACT } from "@/content/contract";
import { PRIORITY, type Verdict } from "@/lib/review-types";
import { Stamp } from "@/components/Stamp";
import { IconCheck } from "@/components/icons";
import { displayId, localDigits } from "@/lib/format";
import type { Dictionary, Locale } from "@/lib/i18n";
import { FEATURES } from "@/lib/features";
import { SortStage } from "./SortStage";
import s from "./how.module.css";

const N = HOW.stations.length;
const fill = (tpl: string, vars: Record<string, string | number>) => tpl.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ""));

/** The walkthrough: one real clause through the six stations of the engine. A slip travels along
 *  the track; each station shows what that stage really produced in the recorded run. */
export function HowMachine({ t, lang }: { t: Dictionary; lang: Locale }) {
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [tampered, setTampered] = useState(false);
  const ref = useRef<HTMLElement>(null);
  const D = HOW.data;
  const L = (v: { ar: string; en: string }) => v[lang];
  const num = (v: string | number) => localDigits(String(v), lang);

  const go = useCallback((n: number) => setI(Math.max(0, Math.min(N - 1, n))), []);

  // Autoplay: one station every 6 s; reaching the last station ends it.
  const autoplay = playing && i < N - 1;
  useEffect(() => {
    if (!autoplay) return;
    const id = setTimeout(() => setI((v) => v + 1), 6000);
    return () => clearTimeout(id);
  }, [autoplay, i]);

  // Presenter keys: while this section fills the screen, arrows step stations first and only hand
  // over to the page-level presenter at either end (capture phase, so it runs before Presenter).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = ref.current;
      if (!el || e.metaKey || e.ctrlKey || e.altKey) return;
      if ((e.target as HTMLElement | null)?.closest("input, textarea, select, [contenteditable]")) return;
      const r = el.getBoundingClientRect();
      if (r.top > window.innerHeight * 0.35 || r.bottom < window.innerHeight * 0.65) return;
      const rtl = document.documentElement.dir === "rtl";
      const fwd = ["ArrowDown", "PageDown", rtl ? "ArrowLeft" : "ArrowRight"].includes(e.key);
      const back = ["ArrowUp", "PageUp", rtl ? "ArrowRight" : "ArrowLeft"].includes(e.key);
      if ((fwd && i < N - 1) || (back && i > 0)) {
        e.preventDefault();
        e.stopImmediatePropagation();
        setPlaying(false);
        go(i + (fwd ? 1 : -1));
      }
    };
    window.addEventListener("keydown", onKey, { capture: true });
    return () => window.removeEventListener("keydown", onKey, { capture: true });
  }, [i, go]);

  const station = HOW.stations[i];

  return (
    <section ref={ref} className={s.machine} data-section aria-labelledby="machine-title">
      <div className={s.inner}>
        <div className={s.machineHead}>
          <h2 id="machine-title" className={s.h2Light}>{L(HOW.title)}</h2>
          <p className={s.automated}>{L(HOW.automated)}</p>
        </div>
        <p className={s.leadLight}>{L(HOW.lead)}</p>

        <ol className={s.track} style={{ "--i": i, "--n": N } as React.CSSProperties} aria-label={L(HOW.controls.step)}>
          <span className={s.token} aria-hidden>
            <bdi dir="ltr">{num(String(trace.clauseN).padStart(4, "0"))}</bdi>
          </span>
          {HOW.stations.map((st, k) => (
            <li key={st.key}>
              <button
                type="button"
                className={s.station}
                aria-current={k === i ? "step" : undefined}
                data-done={k < i || undefined}
                onClick={() => {
                  setPlaying(false);
                  go(k);
                }}
              >
                <span className={s.stationNo}>{num(k + 1)}</span>
                <span className={s.stationName}>{L(st.name)}</span>
              </button>
            </li>
          ))}
        </ol>

        <div className={s.stage} key={station.key}>
          <div className={s.explain}>
            <p className={s.stepOf}>
              {L(HOW.controls.step)} {num(i + 1)} {L(HOW.controls.of)} {num(N)}
            </p>
            <h3 className={s.stationTitle}>{L(station.name)}</h3>
            <h4 className={s.label}>{L(HOW.whatLabel)}</h4>
            <p className={s.text}>{L(station.what)}</p>
            <h4 className={s.label}>{L(HOW.whyLabel)}</h4>
            <p className={s.text}>{L(station.why)}</p>
          </div>
          <div className={s.card}>{renderCard(station.key)}</div>
        </div>

        <div className={s.controls}>
          <button type="button" className="btn btn-ghost on-violet btn-sm" onClick={() => go(i - 1)} disabled={i === 0}>
            {L(HOW.controls.prev)}
          </button>
          <button type="button" className="btn btn-paper btn-sm" onClick={() => go(i + 1)} disabled={i === N - 1}>
            {L(HOW.controls.next)}
          </button>
          <button
            type="button"
            className="btn btn-ghost on-violet btn-sm"
            aria-pressed={autoplay}
            onClick={() => {
              if (!autoplay && i === N - 1) setI(0);
              setPlaying(!autoplay);
            }}
          >
            {autoplay ? L(HOW.controls.pause) : L(HOW.controls.play)}
          </button>
          <span className={s.keys}>{L(HOW.controls.keys)}</span>
        </div>
      </div>
    </section>
  );

  function renderCard(key: string) {
    switch (key) {
      case "mask":
        return (
          <div className={s.maskCard}>
            <p className={s.cardLabel}>{L(D.before)}</p>
            <p className={s.doc} dir="rtl" lang="ar">{trace.mask.before}</p>
            <p className={s.cardLabel}>{L(D.after)}</p>
            <p className={s.doc} dir="rtl" lang="ar">
              {trace.mask.after.split(/(\[[^\]]+\])/).map((part, k) =>
                /^\[/.test(part) ? <mark key={k} className={s.tag}>{part}</mark> : part,
              )}
            </p>
            <p className={s.cardNote}>{L(D.maskNote)}</p>
          </div>
        );
      case "split":
        return (
          <div>
            <p className={s.cardNote}>{fill(L(D.splitCount), { n: num(trace.contractClauses) })}</p>
            <ol className={s.slips}>
              {DEMO_CONTRACT.clauses.map((c) => (
                <li key={c.n} data-on={c.n === trace.clauseN || undefined}>
                  <bdi dir="ltr" className={s.slipNo}>{num(String(c.n).padStart(4, "0"))}</bdi>
                  <span lang={lang}>{c.text[lang]}</span>
                </li>
              ))}
            </ol>
          </div>
        );
      case "sort":
        return <SortStage lang={lang} />;
      case "retrieve":
        return (
          <div>
            <p className={s.cardLabel}>{L(D.thisClause)}</p>
            <p className={s.doc} dir="rtl" lang="ar">{trace.clause}</p>
            <p className={s.cardNote}>{L(D.noTerm)}</p>
            <p className={s.cardLabel}>{L(D.added)}</p>
            <p className={s.terms} dir="rtl" lang="ar">{trace.query.added}</p>
            <p className={s.stat}>
              {fill(L(D.candidates), { c: num(trace.retrieval.candidates), u: num(trace.retrieval.corpusUnits), r: num(trace.retrieval.governingRank ?? "—") })}
            </p>
            <ol className={s.ids}>
              {trace.retrieval.top.map((id, k) => (
                <li key={id} data-on={k + 1 === trace.retrieval.governingRank || undefined}>
                  <bdi dir="rtl">{displayId(id, lang)}</bdi>
                </li>
              ))}
            </ol>
            <p className={s.cardNote}>{L(D.keywordNote)}</p>
          </div>
        );
      case "judge":
        return (
          <div>
            <div className={s.verdictRow}>
              <span className={s.cardLabel}>{L(D.verdict)}</span>
              <Stamp verdict={trace.judge.verdict as Verdict} label={t.verdicts[trace.judge.verdict as Verdict]} citation={trace.judge.citations[0]?.id} lang={lang} className={s.stampSm} />
              <span className={s.scope}>
                {L(D.scope)}: {L(D.yes)}
              </span>
            </div>
            {trace.judge.citations.map((c) => (
              <blockquote key={c.id} className={s.cite}>
                <p className={s.citeHead}>
                  <bdi dir="rtl">{displayId(c.id, lang)}</bdi>
                  <span className={s.role}>{L(D.roles[c.role as keyof typeof D.roles])}</span>
                </p>
                <p className={s.doc} dir="rtl" lang="ar">«{c.quote}»</p>
              </blockquote>
            ))}
            <p className={s.cardLabel}>{L(D.reason)}</p>
            <p className={s.reason} dir="rtl" lang="ar">{trace.judge.reason}</p>
          </div>
        );
      case "gate":
        return (
          <div>
            {!tampered ? (
              <>
                {trace.gate.checks.map((c) => (
                  <div key={c.id} className={s.checkBlock}>
                    <p className={s.citeHead}>
                      <bdi dir="rtl">{displayId(c.id, lang)}</bdi>
                    </p>
                    <ul className={s.checks}>
                      <li data-ok={c.inCandidates}><IconCheck className={s.checkIcon} />{L(D.checkCandidate)}</li>
                      <li data-ok={c.literal}><IconCheck className={s.checkIcon} />{L(D.checkLiteral)}</li>
                      {trace.judge.citations.find((x) => x.id === c.id)?.role === "governs" ? (
                        <li data-ok={c.kind === "prohibition" || c.kind === "condition"}><IconCheck className={s.checkIcon} />{L(D.checkRule)}</li>
                      ) : (
                        <li data-ok="true"><IconCheck className={s.checkIcon} />{L(D.checkShown)}</li>
                      )}
                    </ul>
                  </div>
                ))}
                <div className={s.verdictRow}>
                  <Stamp verdict={trace.gate.verdict as Verdict} label={t.verdicts[trace.gate.verdict as Verdict]} citation={trace.gate.citations[0]} lang={lang} className={s.stampSm} />
                  <span className={s.passed}>{L(D.passed)}</span>
                </div>
              </>
            ) : (
              <>
                <p className={s.cardLabel}>{L(D.tamperQuote)}</p>
                <p className={`${s.doc} ${s.fake}`} dir="rtl" lang="ar">«{trace.tamper.fakeQuote}»</p>
                <ul className={s.checks}>
                  <li data-ok="true"><IconCheck className={s.checkIcon} />{L(D.checkCandidate)}</li>
                  <li data-ok="false"><span className={s.crossIcon} aria-hidden>✕</span>{L(D.checkLiteral)}</li>
                </ul>
                <div className={s.verdictRow}>
                  <Stamp verdict={trace.tamper.verdict as Verdict} label={t.verdicts[trace.tamper.verdict as Verdict]} lang={lang} className={s.stampSm} />
                </div>
                <p className={s.text}>{fill(L(D.tamperResult), { v: t.verdicts[trace.tamper.verdict as Verdict] })}</p>
                <p className={s.cardNote}>{L(D.tamperProof)}</p>
              </>
            )}
            <button type="button" className={`btn btn-sm ${tampered ? "btn-ghost" : ""} ${s.tamperBtn}`} aria-pressed={tampered} onClick={() => setTampered((v) => !v)}>
              {tampered ? L(D.tamperOff) : L(D.tamperOn)}
            </button>
          </div>
        );
      case "file": {
        const rows = [...DEMO_CONTRACT.clauses].sort((a, b) => PRIORITY.indexOf(a.verdict) - PRIORITY.indexOf(b.verdict) || a.n - b.n);
        return (
          <div>
            <p className={s.cardNote}>{L(D.fileNote)}</p>
            <ol className={s.file}>
              {rows.map((c) => (
                <li key={c.n} data-on={c.n === trace.clauseN || undefined}>
                  <bdi dir="ltr" className={s.slipNo}>{num(String(c.n).padStart(4, "0"))}</bdi>
                  <span className={s.fileText} lang={lang}>{c.text[lang]}</span>
                  <Stamp verdict={c.verdict} label={t.verdicts[c.verdict]} lang={lang} className={s.stampXs} />
                </li>
              ))}
            </ol>
            <div className={s.committee}>
              <span className={s.cardLabel}>{L(D.committee)}</span>
              <span className={s.committeeBtns} aria-hidden>
                <span>{L(D.approve)}</span>
                <span>{L(D.reject)}</span>
                <span>{L(D.refer)}</span>
              </span>
              {FEATURES.dashboard && <p className={s.cardNote}>{L(D.committeeNote)}</p>}
            </div>
          </div>
        );
      }
    }
    return null;
  }
}
