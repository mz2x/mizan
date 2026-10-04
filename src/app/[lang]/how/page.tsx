import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AppBar } from "@/components/app/AppBar";
import { HowMachine } from "@/components/how/HowMachine";
import { SystemDiagram } from "@/components/flow/SystemDiagram";
import { Presenter } from "@/components/Presenter";
import { IconArrow } from "@/components/icons";
import { HOW, LOCAL_MODELS } from "@/content/how";
import { getDictionary, hasLocale } from "@/lib/i18n";
import { localePath } from "@/lib/paths";
import { localDigits } from "@/lib/format";
import s from "@/components/how/how.module.css";

export async function generateMetadata({ params }: PageProps<"/[lang]/how">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  return { title: `${HOW.meta.title[lang]} — ${getDictionary(lang).hero.name}`, description: HOW.meta.description[lang] };
}

const Arrow = () => (
  <span className={s.arrow} aria-hidden>
    <svg viewBox="0 0 24 24">
      <path d="M19 12H5M11 6l-6 6 6 6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  </span>
);

export default async function HowPage({ params }: PageProps<"/[lang]/how">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const t = getDictionary(lang);
  const L = (v: { ar: string; en: string }) => v[lang];

  return (
    <>
      <Presenter />
      <AppBar t={t} lang={lang} title={L(HOW.diagramTitle)} here="how" />
      <main>
        <section className={s.paper} data-section aria-labelledby="diagram-title">
          <div className={s.inner}>
            <h1 id="diagram-title" className={s.h2}>{L(HOW.diagramTitle)}</h1>
            <p className={s.body}>{L(HOW.diagramLead)}</p>
            <SystemDiagram lang={lang} />
          </div>
        </section>
        <HowMachine t={t} lang={lang} />

        <section className={s.paper} data-section aria-labelledby="loop-title">
          <div className={s.inner}>
            <h2 id="loop-title" className={s.h2}>{L(HOW.loop.title)}</h2>
            <p className={s.body}>{L(HOW.loop.lead)}</p>
            <div className={s.loop}>
              <div className={`${s.zone} ${s.zoneMachine}`}>
                <p className={s.zoneTitle}>{L(HOW.loop.machine)}</p>
                <ol className={s.zoneSteps}>
                  {HOW.stations.slice(0, 5).map((st) => (
                    <li key={st.key}>{L(st.name)}</li>
                  ))}
                </ol>
              </div>
              <Arrow />
              <div className={`${s.zone} ${s.zoneFile}`}>
                <p className={s.zoneTitle}>{L(HOW.loop.handoff)}</p>
                <p className={s.zoneSub}>{L(HOW.loop.handoffSub)}</p>
              </div>
              <Arrow />
              <div className={`${s.zone} ${s.zoneHuman}`}>
                <p className={s.zoneTitle}>{L(HOW.loop.human)}</p>
                <ul className={s.zoneSteps}>
                  <li>{L(HOW.data.approve)}</li>
                  <li>{L(HOW.data.reject)}</li>
                  <li>{L(HOW.data.refer)}</li>
                </ul>
              </div>
            </div>
            <p className={s.never}>{L(HOW.loop.never)}</p>
          </div>
        </section>

        <section className={s.paper} data-section aria-labelledby="trust-title">
          <div className={s.inner}>
            <h2 id="trust-title" className={s.h2}>{L(HOW.trust.title)}</h2>
            <ul className={s.trustGrid}>
              {HOW.trust.items.map((it) => (
                <li key={it.h.en}>
                  <h3>{L(it.h)}</h3>
                  <p>{L(it.p)}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className={s.paper} data-section aria-labelledby="tech-title">
          <div className={s.inner}>
            <h2 id="tech-title" className={s.h2}>{L(HOW.tech.title)}</h2>
            <dl className={s.qa}>
              {HOW.tech.qa.map((x) => (
                <div key={x.q.en}>
                  <dt>{L(x.q)}</dt>
                  <dd>{L(x.a)}</dd>
                </div>
              ))}
            </dl>
            <h3 className={s.compareTitle}>{L(HOW.tech.compareTitle)}</h3>
            <ul className={s.bars}>
              {HOW.tech.rows.map((r) => (
                <li key={`${r.name.en}${r.model}`} data-now={r.now || undefined}>
                  <span className={s.barName}>
                    {L(r.name)}
                    {r.model && <> <bdi dir="ltr" className={s.barModel}>{r.model}</bdi></>}
                  </span>
                  <span className={s.barTrack} aria-hidden>
                    <span className={s.barFill} style={{ inlineSize: `${(r.missed / 20) * 100}%` }} />
                  </span>
                  <span className={s.barValue}>{localDigits(String(r.missed), lang)}</span>
                </li>
              ))}
            </ul>
            <p className={s.caveat}>{L(HOW.tech.compareLess)}. {L(HOW.tech.compareNote)}</p>
            <p className={s.diff}>{L(HOW.tech.verdict)}</p>
          </div>
        </section>

        <section className={s.paper} data-section aria-labelledby="general-title">
          <div className={s.inner}>
            <h2 id="general-title" className={s.h2}>{L(HOW.general.title)}</h2>
            <p className={s.body}>{L(HOW.general.lead)}</p>
            <div className={s.cases}>
              {HOW.general.cases.map((c) => (
                <div key={c.h.en} className={s.case}>
                  <h3>{L(c.h)}</h3>
                  <p>{L(c.p)}</p>
                </div>
              ))}
            </div>
            <p className={s.diff}>{L(HOW.general.diff)}</p>
            <p className={s.caveat}>{L(HOW.general.caveat)}</p>
          </div>
        </section>

        <section className={s.paper} data-section aria-labelledby="local-title">
          <div className={s.inner}>
            <h2 id="local-title" className={s.h2}>{L(HOW.local.title)}</h2>
            <p className={s.body}>{L(HOW.local.lead)}</p>
            <ol className={s.roadmap}>
              {HOW.local.steps.map((st, i) => (
                <li key={st.h.en} data-now={i === 0 || undefined}>
                  <span className={s.when}>{L(st.when)}</span>
                  <h3>{L(st.h)}</h3>
                  <p>{L(st.p)}</p>
                </li>
              ))}
            </ol>
            <p className={s.body} style={{ marginTop: 24 }}>{L(HOW.local.why)}</p>
            <p className={s.caveat}>{L(HOW.local.examples)}</p>
            <ul className={s.models}>
              {LOCAL_MODELS.map((m) => (
                <li key={m.id}>
                  <bdi dir="ltr">{m.id}</bdi>
                  {m.license && <small>{m.license}</small>}
                </li>
              ))}
            </ul>
            <p className={s.caveat} style={{ marginTop: 16 }}>{L(HOW.local.trial)}</p>
            <Link href={localePath(lang, "/review")} className={`btn ${s.finalCta}`}>
              {L(HOW.cta)}
              <IconArrow className="btn-arrow" />
            </Link>
          </div>
        </section>
      </main>
    </>
  );
}
