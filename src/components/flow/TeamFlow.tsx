"use client";

import { useEffect, useState } from "react";
import { DOER, TEAM, TEAM_COPY, type Token } from "@/content/flow";
import type { Locale } from "@/lib/i18n";
import s from "./team.module.css";

/** What the document looks like as each robot leaves it: the belt item changes with the work done. */
function DocToken({ token, lang }: { token: Token; lang: Locale }) {
  switch (token) {
    case "doc":
      return <span className={`${s.tk} ${s.doc}`}><i /><i className={s.redact} /><i /><i className={`${s.redact} ${s.short}`} /></span>;
    case "slips":
      return <span className={`${s.tk} ${s.slips}`}><i /><i /><i /></span>;
    case "sorted":
      return <span className={`${s.tk} ${s.sorted}`}><i className={s.keep} /><i className={s.drop} /></span>;
    case "card":
      return <span className={`${s.tk} ${s.pair}`}><i className={s.sl} /><i className={s.idx}><bdi dir="rtl">ق٧/ثالثاً/٢</bdi></i></span>;
    case "draft":
      return <span className={`${s.tk} ${s.pair}`}><i className={s.sl} /><i className={s.note}>{lang === "ar" ? "مقترح" : "draft"}</i></span>;
    case "stamped":
      return <span className={`${s.tk} ${s.pair}`}><i className={s.sl} /><i className={s.seal}>{TEAM_COPY.stamp[lang]}</i></span>;
    case "folder":
      return <span className={`${s.tk} ${s.folder}`}><i /></span>;
  }
}

/** Seven robots, one per automated step, then the human committee. Plays on its own; a tap on a
 *  robot pauses it there. Without motion it rests on the inspector, the stamped verdict. */
export function TeamFlow({ lang }: { lang: Locale }) {
  const [at, setAt] = useState(5);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // Start the loop from the first robot once the page is interactive.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAt(0);
    setPlaying(true);
  }, []);
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => setAt((v) => (v + 1) % TEAM.length), 2600);
    return () => clearInterval(id);
  }, [playing]);

  const L = (v: { ar: string; en: string }) => v[lang];
  const cur = TEAM[at];

  return (
    <div className={s.panel}>
      <div className={s.scroller}>
        <div className={s.team}>
          {TEAM.map((m, i) => (
            <button
              key={m.img}
              type="button"
              className={s.who}
              data-act={i === at || undefined}
              aria-pressed={i === at}
              onClick={() => {
                setPlaying(false);
                setAt(i);
              }}
            >
              <span className={s.bubble}>{L(m.says)}</span>
              <picture>
                <img src={`/assets/team/${m.img}.webp`} alt="" width={140} height={154} loading="lazy" decoding="async" />
              </picture>
              <span className={s.name}>{L(m.name)}</span>
              <span className={s.role}>{L(m.role)}</span>
              <span className={`${s.badge} ${m.doer === "model" ? s.model : ""}`}>{L(m.shared ?? DOER[m.doer])}</span>
            </button>
          ))}
          <div className={s.belt} aria-hidden>
            <span className={s.item} style={{ insetInlineStart: `calc(${((at + 0.5) * 100) / TEAM.length}% - 65px)` }}>
              <span className={s.tkbox} key={cur.token}>
                <DocToken token={cur.token} lang={lang} />
              </span>
              <span className={s.tklbl}>{L(cur.tokenLabel)}</span>
            </span>
          </div>
        </div>
      </div>
      <div className={s.handover}>
        <picture className={s.committee}>
          <img src="/assets/team/committee.webp" alt={L(TEAM_COPY.committeeAlt)} width={360} height={260} loading="lazy" decoding="async" />
        </picture>
        <div>
          <span className={`${s.badge} ${s.human}`}>{L(DOER.human)}</span>
          <h3 className={s.humanTitle}>{L(TEAM_COPY.humanTitle)}</h3>
          <p className={s.humanBody}>{L(TEAM_COPY.humanBody)}</p>
          <div className={s.acts}>
            {TEAM_COPY.humanActs.map((a) => (
              <span key={a.en}>{L(a)}</span>
            ))}
          </div>
        </div>
      </div>
      <div className={s.controls}>
        <button type="button" className="btn btn-sm" aria-pressed={playing} onClick={() => setPlaying((p) => !p)}>
          {playing ? L(TEAM_COPY.pause) : L(TEAM_COPY.play)}
        </button>
        <p className={s.now} aria-live="polite">
          <b>{L(cur.name)}:</b> {L(cur.says)}
        </p>
      </div>
    </div>
  );
}
