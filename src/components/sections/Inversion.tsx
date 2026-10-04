import { GuillocheField } from "@/components/hero/GuillocheField";
import type { Dictionary, Locale } from "@/lib/i18n";
import Link from "next/link";
import { TeamFlow } from "@/components/flow/TeamFlow";
import { TEAM_COPY } from "@/content/flow";
import { IconArrow } from "@/components/icons";
import { localePath } from "@/lib/paths";
import s from "./sections.module.css";

export function Inversion({ t, lang }: { t: Dictionary; lang: Locale }) {
  return (
    <section className={`${s.section} ${s.violet}`} data-section aria-labelledby="inversion-title">
      <GuillocheField microtext="ميزان" idPrefix="inversion" />
      <div className={s.inner}>
        <h2 id="inversion-title" className={`${s.h2} ${s.h2Wide}`}>
          {TEAM_COPY.title[lang]}
        </h2>
        <p className={s.teamLead}>{TEAM_COPY.lead[lang]}</p>
        {/* The pipeline as a team: seven robots (code or model) and the document as each leaves it,
            then the human committee (TeamFlow; approved by Mazen, 2026-10-02). */}
        <div className={s.diagramWrap}>
          <TeamFlow lang={lang} />
        </div>
        <Link href={localePath(lang, "/how")} className={`btn btn-paper ${s.howLink}`}>
          {t.inversion.howLink}
          <IconArrow className="btn-arrow" />
        </Link>
      </div>
    </section>
  );
}
