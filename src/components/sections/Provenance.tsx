import { SOURCE_URL, type CitationUnit } from "@/content/units";
import type { Locale } from "@/lib/i18n";
import { displayId, formatDecisionDate, localDigits } from "@/lib/format";
import s from "./sections.module.css";

const LABELS = {
  ar: { decision: "القرار", date: "التاريخ", session: "الدورة", source: "المصدر" },
  en: { decision: "Decision", date: "Date", session: "Session", source: "Source" },
};

/** The provenance ticket attached to every quote: which decision, when, and where it is published. */
export function Provenance({ unit: u, lang }: { unit: CitationUnit; lang: Locale }) {
  const l = LABELS[lang];
  return (
    <footer className={s.ticket}>
      <bdi dir="rtl" className={s.ticketId}>{displayId(u.id, lang)}</bdi>
      <span>
        {l.decision} ({localDigits(String(u.decisionNo), lang)}): <span lang="ar">{u.title}</span>
      </span>
      <span>
        {l.date}: {formatDecisionDate(u.dateHijri, "hijri", lang)} · {formatDecisionDate(u.dateGregorian, "gregorian", lang)}
      </span>
      <a href={SOURCE_URL} target="_blank" rel="noreferrer">
        {l.source}
      </a>
    </footer>
  );
}
