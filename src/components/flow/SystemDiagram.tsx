"use client";

import { useEffect, useState } from "react";
import { DOER, SYSTEM, SYSTEM_COPY, type Doer } from "@/content/flow";
import type { Locale } from "@/lib/i18n";
import s from "./system.module.css";

const LANE_Y: Record<Doer, number> = { code: 200, model: 350, human: 500 };
const W = 116;
const H = 72;

/** Three lanes (code, model, people) and the clause moving between them: the model never works
 *  alone, and code checks whatever it returns. Each station opens its input, output and guarantee. */
export function SystemDiagram({ lang }: { lang: Locale }) {
  const L = (v: { ar: string; en: string }) => v[lang];
  // The drawing itself is always in English, left to right, on both sites (mentors, 2026-10-03);
  // the details panel below it stays in the page language. Stations are authored right to left.
  const rtl = false;
  const E = (v: { ar: string; en: string }) => v.en;
  const X = (x: number) => (rtl ? x : 1100 - x);
  const dir = rtl ? 1 : -1;
  const pts = SYSTEM.map((n) => ({ x: X(n.x), y: n.y ?? LANE_Y[n.lane] }));

  const [at, setAt] = useState(6);
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // Start at the contract once the page is interactive.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAt(0);
    setPlaying(true);
  }, []);
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => setAt((v) => (v + 1) % SYSTEM.length), 2200);
    return () => clearInterval(id);
  }, [playing]);

  const pick = (i: number) => {
    setPlaying(false);
    setAt(i);
  };
  const edge = (i: number) => {
    const a = pts[i - 1];
    const b = pts[i];
    if (a.y === b.y) return `M${a.x - (dir * W) / 2} ${a.y}H${b.x + (dir * (W / 2 + 4))}`;
    if (a.x === b.x) return `M${a.x} ${a.y + H / 2}V${b.y - H / 2 - 4}`;
    const mid = (a.x + b.x) / 2;
    return `M${a.x - (dir * W) / 2} ${a.y}H${mid}V${b.y}H${b.x + dir * (W / 2 + 4)}`;
  };
  const node = SYSTEM[at];
  const find = pts[SYSTEM.findIndex((n) => n.k === "find")];
  const sort = pts[SYSTEM.findIndex((n) => n.k === "sort")];
  const gate = pts[SYSTEM.findIndex((n) => n.k === "gate")];
  const laneX = rtl ? 1090 : 10;

  return (
    <div className={s.panel}>
      <div className={s.sys}>
        <div className={s.svgbox}>
          <svg viewBox="0 0 1100 600" role="group" aria-label={L(SYSTEM_COPY.title)} direction="ltr" className={s.svg} data-lang="en">
            <defs>
              <marker id="sys-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <path d="M0 0L10 5L0 10z" fill="#3a2b8c" />
              </marker>
            </defs>
            <rect className={s.lane} x="0" y="126" width="1100" height="150" />
            <rect className={`${s.lane} ${s.alt}`} x="0" y="276" width="1100" height="150" />
            <rect className={s.lane} x="0" y="426" width="1100" height="150" />
            {(Object.keys(LANE_Y) as Doer[]).map((d) => (
              <text key={d} className={s.laneLabel} x={laneX} y={LANE_Y[d] - 52} textAnchor="start" direction={rtl ? "rtl" : "ltr"}>
                {E(DOER[d])}
              </text>
            ))}
            <g className={s.store} transform={`translate(${find.x - 90} 20)`}>
              <ellipse cx="90" cy="12" rx="90" ry="12" />
              <path d="M0 12v44a90 12 0 0 0 180 0V12" />
              <ellipse cx="90" cy="12" rx="90" ry="12" />
              <text x="90" y="46" textAnchor="middle" direction={rtl ? "rtl" : "ltr"}>{E(SYSTEM_COPY.store)}</text>
            </g>
            <path className={s.edge} d={`M${find.x} 70V${find.y - H / 2 - 4}`} markerEnd="url(#sys-arrow)" />
            {SYSTEM.slice(1).map((n, i) => (
              <path key={n.k} className={s.edge} d={edge(i + 1)} markerEnd="url(#sys-arrow)" />
            ))}
            <g className={s.exit} transform={`translate(${sort.x - 80} ${LANE_Y.human - 22})`}>
              <rect width="160" height="44" />
              <text x="80" y="27" textAnchor="middle" direction={rtl ? "rtl" : "ltr"}>{E(SYSTEM_COPY.notClause)}</text>
            </g>
            <path className={`${s.edge} ${s.dash}`} d={`M${sort.x} ${sort.y + H / 2}V${LANE_Y.human - 24}`} markerEnd="url(#sys-arrow)" />
            <g className={s.exit} transform={`translate(${gate.x - 110} 30)`}>
              <rect width="220" height="44" />
              <text x="110" y="27" textAnchor="middle" direction={rtl ? "rtl" : "ltr"}>{E(SYSTEM_COPY.gateFail)}</text>
            </g>
            <path className={`${s.edge} ${s.dash}`} d={`M${gate.x} ${gate.y - H / 2}V76`} markerEnd="url(#sys-arrow)" />
            {SYSTEM.map((n, i) => {
              const p = pts[i];
              return (
                <g
                  key={n.k}
                  className={s.node}
                  data-on={i === at || undefined}
                  tabIndex={0}
                  role="button"
                  aria-label={`${L(n.title)}: ${L(n.sub)}`}
                  aria-pressed={i === at}
                  onClick={() => pick(i)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      pick(i);
                    }
                  }}
                >
                  <rect x={p.x - W / 2} y={p.y - H / 2} width={W} height={H} data-shared={n.shared ? "" : undefined} />
                  <text className={s.t} x={p.x} y={p.y - 4} textAnchor="middle" direction={rtl ? "rtl" : "ltr"}>{E(n.title)}</text>
                  <text className={s.sub} x={p.x} y={p.y + 20} textAnchor="middle" direction={rtl ? "rtl" : "ltr"}>{E(n.sub)}</text>
                </g>
              );
            })}
            <circle className={s.packet} r="9" cx={pts[at].x + (dir * W) / 2 - dir * 4} cy={pts[at].y - H / 2 + 4} />
            <text className={s.small} x={rtl ? 1090 : 10} y="592" textAnchor="start" direction={rtl ? "rtl" : "ltr"}>
              {E(SYSTEM_COPY.privacy)}
            </text>
          </svg>
        </div>
        <div className={s.info} aria-live="polite">
          <span className={`${s.badge} ${s[node.lane]}`}>{L(node.shared ?? DOER[node.lane])}</span>
          <h3 className={s.infoTitle}>
            {L(node.title)}
            {lang === "ar" && <span className={s.infoEn}>{node.title.en}</span>}
          </h3>
          <dl className={s.dl}>
            <div>
              <dt>{L(SYSTEM_COPY.input)}</dt>
              <dd>{L(node.input)}</dd>
            </div>
            <div>
              <dt>{L(SYSTEM_COPY.output)}</dt>
              <dd>{L(node.output)}</dd>
            </div>
            <div>
              <dt>{L(SYSTEM_COPY.guarantee)}</dt>
              <dd>{L(node.guarantee)}</dd>
            </div>
          </dl>
        </div>
      </div>
      <div className={s.controls}>
        <button type="button" className="btn btn-sm" aria-pressed={playing} onClick={() => setPlaying((p) => !p)}>
          {playing ? L(SYSTEM_COPY.pause) : L(SYSTEM_COPY.play)}
        </button>
        <p className={s.hint}>{L(SYSTEM_COPY.hint)}</p>
        <p className={s.legend}>{L(SYSTEM_COPY.legend)}</p>
      </div>
    </div>
  );
}
