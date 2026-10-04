"use client";

import { useEffect, useState } from "react";
import { HOW } from "@/content/how";
import sorted from "@/content/how-sort.json";
import type { Locale } from "@/lib/i18n";
import { localDigits } from "@/lib/format";
import type { OtherType } from "@/lib/review-types";
import s from "./sort.module.css";

const PARTS = sorted.segments;
const KEEP = PARTS.filter((p) => p.kind !== "other").length;
const OUT = PARTS.length - KEEP;

/** The sorting station: every part of the contract leaves the pile one by one and drops into
 *  «clauses to review» or «not a clause», exactly as the recorded run labelled it. */
export function SortStage({ lang }: { lang: Locale }) {
  const D = HOW.data;
  const L = (v: { ar: string; en: string }) => v[lang];
  const num = (v: string | number) => localDigits(String(v), lang);
  const [placed, setPlaced] = useState(PARTS.length);
  const [run, setRun] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // Restart the drop from a full pile on mount and on every «sort again».
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPlaced(0);
    const id = setInterval(() => setPlaced((v) => (v >= PARTS.length ? v : v + 1)), 420);
    return () => clearInterval(id);
  }, [run]);

  let k = 0;
  let o = 0;
  return (
    <div>
      <div className={s.stage}>
        <div className={`${s.tray} ${s.keep}`}>
          <span className={s.trayLabel}>{L(D.sortKeep)} ({num(KEEP)})</span>
        </div>
        <div className={`${s.tray} ${s.out}`}>
          <span className={s.trayLabel}>{L(D.sortOut)} ({num(OUT)})</span>
        </div>
        {PARTS.map((p, i) => {
          const isOut = p.kind === "other";
          const slot = isOut ? o++ : k++;
          const done = i < placed;
          const pos = !done
            ? { insetInlineStart: `${24 + (i % 3) * 2}%`, top: `${2 + Math.min(i, 6) * 1.2}%`, rotate: `${((i * 37) % 7) - 3}deg`, zIndex: PARTS.length - i }
            : isOut
              ? { insetInlineStart: "63%", top: `calc(37% + ${slot * 52}px)`, rotate: `${slot % 2 ? 4 : -5}deg`, zIndex: 50 + slot }
              : { insetInlineStart: "4%", top: `calc(34% + ${slot * 27}px)`, rotate: "0deg", zIndex: 20 + slot };
          return (
            <div key={i} className={`${s.slip} ${done ? (isOut ? s.isOut : s.isKeep) : ""}`} style={pos} aria-hidden>
              <span className={s.text} dir="rtl" lang="ar">{p.text}</span>
              {done && isOut && p.otherType && <span className={s.type}>{D.sortTypes[lang][p.otherType as OtherType]}</span>}
            </div>
          );
        })}
      </div>
      <ul className="sr-only">
        {PARTS.map((p, i) => (
          <li key={i}>
            {p.kind === "other" ? L(D.sortOut) : L(D.sortKeep)}: {p.text}
          </li>
        ))}
      </ul>
      <p className={s.note}>
        {L(D.sortNote).replace("{s}", num(sorted.seconds)).replace("{usd}", num(sorted.usd.toFixed(3)))}
      </p>
      <button type="button" className={`btn btn-ghost btn-sm ${s.replay}`} onClick={() => setRun((r) => r + 1)}>
        {L(D.sortReplay)}
      </button>
    </div>
  );
}
