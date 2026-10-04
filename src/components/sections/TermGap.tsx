"use client";

import { motion, useMotionTemplate, useReducedMotion, useSpring } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { UNITS } from "@/content/units";
import { segment, TERM_GAP } from "@/content/termgap";
import type { Dictionary, Locale } from "@/lib/i18n";
import { Stamp } from "@/components/Stamp";
import { Provenance } from "./Provenance";
import s from "./sections.module.css";

const LENS_RADIUS = 92;
const MAGNIFY = 2.35;
// Critically damped: the loupe follows the hand without overshoot (apple-design default).
const FOLLOW = { stiffness: 260, damping: 32, mass: 0.9 };

export function TermGap({ t, lang }: { t: Dictionary; lang: Locale }) {
  const unit = UNITS[TERM_GAP.unitId];
  const context = UNITS["الإنماء/ق7/ثالثاً/1"].context ?? "";
  const items = [1, 2, 3, 4].map((n) => UNITS[`الإنماء/ق7/ثالثاً/${n}`]);

  const [active, setActive] = useState<number | null>(null);
  const reduce = useReducedMotion();
  const panel = useRef<HTMLDivElement>(null);
  const termRef = useRef<HTMLSpanElement>(null);
  const userMoved = useRef(false);

  const x = useSpring(0, reduce ? { duration: 0 } : FOLLOW);
  const y = useSpring(0, reduce ? { duration: 0 } : FOLLOW);
  const clip = useMotionTemplate`circle(${LENS_RADIUS}px at ${x}px ${y}px)`;
  const origin = useMotionTemplate`${x}px ${y}px`;

  const restOnTerm = useCallback(() => {
    const p = panel.current?.getBoundingClientRect();
    const term = termRef.current?.getBoundingClientRect();
    if (!p || !term) return;
    x.set(term.left - p.left + term.width / 2);
    y.set(term.top - p.top + term.height / 2);
  }, [x, y]);

  useEffect(() => {
    // Start the loupe off the text, then glide to the term so the reveal happens on its own.
    const p = panel.current?.getBoundingClientRect();
    if (p) {
      x.jump(lang === "ar" ? p.width * 0.85 : p.width * 0.15);
      y.jump(p.height * 0.2);
    }
    const id = window.setTimeout(restOnTerm, 500);
    window.addEventListener("resize", restOnTerm);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener("resize", restOnTerm);
    };
  }, [lang, restOnTerm, x, y]);

  const onMove = (e: React.PointerEvent) => {
    const p = panel.current?.getBoundingClientRect();
    if (!p) return;
    userMoved.current = true;
    x.set(e.clientX - p.left);
    y.set(e.clientY - p.top);
  };

  const decisionMarks = [
    ...TERM_GAP.pairs.map((p, i) => ({ text: p.decision, pair: i })),
    { text: TERM_GAP.term, pair: null, term: true },
  ];
  const clauseMarks = TERM_GAP.pairs.map((p, i) => ({ text: p.clause[lang], pair: i }));

  const engraving = (withRef: boolean) => (
    <div className={s.engraving}>
      <p className={s.engravingLead}>{context}</p>
      <ol className={s.engravingItems}>
        {items.map((u) => (
          <li key={u.id}>
            {u.id === unit.id
              ? segment(u.text, decisionMarks).map((seg, i) => (
                  <span
                    key={i}
                    ref={withRef && seg.term ? termRef : undefined}
                    className={seg.term ? s.markTerm : seg.pair !== null ? s.mark : undefined}
                    data-active={seg.pair !== null && seg.pair === active ? "" : undefined}
                  >
                    {seg.text}
                  </span>
                ))
              : u.text}
          </li>
        ))}
      </ol>
    </div>
  );

  return (
    <section className={s.section} data-section aria-labelledby="termgap-title">
      <div className={s.inner}>
        <h2 id="termgap-title" className={`${s.h2} ${s.h2Wide}`}>
          {t.termGap.title}
        </h2>
        <p className={`${s.body} ${s.lead}`}>{t.termGap.lead}</p>

        <div className={s.gapGrid}>
          {/* The clause, with its matched passages */}
          <article className={s.instrument}>
            <header className={s.instrumentHead}>
              <span>{t.termGap.clauseLabel}</span>
              <bdi dir="ltr" className={s.serialSmall}>0005</bdi>
            </header>
            <p className={s.clauseLarge} lang={lang}>
              {segment(TERM_GAP.clause[lang], clauseMarks).map((seg, i) => (
                <span
                  key={i}
                  className={seg.pair !== null ? s.mark : undefined}
                  data-active={seg.pair !== null && seg.pair === active ? "" : undefined}
                  onPointerEnter={() => seg.pair !== null && setActive(seg.pair)}
                  onPointerLeave={() => setActive(null)}
                >
                  {seg.text}
                </span>
              ))}
            </p>
            <div className={s.verdictRow}>
              <p className={s.verdictMiss}>
                <span className={s.verdictLabel}>{t.termGap.keywordLabel}</span>
                {t.termGap.keywordResult}
              </p>
              <div className={s.verdictHit} data-stamp>
                <span className={s.verdictLabel}>{t.termGap.mizanLabel}</span>
                <Stamp verdict="nonCompliant" label={t.verdicts.nonCompliant} citation={unit.id} lang={lang} className={s.gapStamp} />
              </div>
            </div>
          </article>

          {/* The decision as security engraving, read through the verification loupe */}
          <figure className={s.lensFigure}>
            <div
              ref={panel}
              className={s.lensPanel}
              onPointerMove={onMove}
              onPointerLeave={() => {
                userMoved.current = false;
                restOnTerm();
              }}
              lang="ar"
              dir="rtl"
            >
              {engraving(true)}
              <motion.div className={s.lensLayer} style={{ clipPath: clip }} aria-hidden>
                <motion.div className={s.lensMagnified} style={{ transformOrigin: origin, scale: MAGNIFY }}>
                  {engraving(false)}
                </motion.div>
              </motion.div>
              <motion.span
                className={s.lensRing}
                style={{ x, y, width: LENS_RADIUS * 2, height: LENS_RADIUS * 2, marginInlineStart: 0 }}
                aria-hidden
              />
            </div>
            <figcaption className={s.lensHint}>{t.termGap.lensHint}</figcaption>
          </figure>
        </div>

        <blockquote className={s.citation} lang="ar" dir="rtl">
          <p>
            {segment(unit.text, decisionMarks).map((seg, i) => (
              <span
                key={i}
                className={seg.term ? s.markTerm : seg.pair !== null ? s.mark : undefined}
                data-active={seg.pair !== null && seg.pair === active ? "" : undefined}
              >
                {seg.text}
              </span>
            ))}
          </p>
          {lang === "en" && <p className={s.gloss} lang="en" dir="ltr">{TERM_GAP.glossEn}</p>}
          <Provenance unit={unit} lang={lang} />
        </blockquote>
      </div>
    </section>
  );
}
