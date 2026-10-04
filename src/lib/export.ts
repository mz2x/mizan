// Export a review file (Mazen, 2026-10-02): PDF (print of the HTML report), a standalone HTML
// report in the site's own design, Word, Excel, CSV and JSON. Everything is built in the browser
// from what the page already holds; nothing is sent anywhere.
import { UNITS } from "@/content/units";
import type { Decision } from "./runs";
import { PRIORITY, type CitationUnit, type ClauseResult, type OtherType, type SegmentKind, type Verdict } from "./review-types";
import type { Locale } from "./i18n";
import { formatDecisionDate } from "./format";

export type ExportRow = {
  n: number;
  text: string;
  kind?: SegmentKind;
  otherType?: OtherType | null;
  context?: number[];
  result?: ClauseResult;
  verbatim?: boolean;
};

export type ExportModel = {
  fileName: string;
  contractId: string | null;
  runId: string | null;
  createdAt: string;
  engine: "live" | "offline";
  demo: boolean;
  rows: ExportRow[];
  decisions?: Record<string, { d: Decision; at: string }>;
};

export type ExportFormat = "pdf" | "html" | "word" | "xlsx" | "csv" | "json";
export const EXPORT_FORMATS: ExportFormat[] = ["pdf", "html", "word", "xlsx", "csv", "json"];

type Labels = {
  verdicts: Record<Verdict, string>;
  decisions: Record<Decision, string>;
  roles: Record<"governs" | "supports" | "related", string>;
  otherTypes: Record<OtherType, string>;
  notClause: string;
  intro: string;
  title: string;
};

type Words = "file" | "contract" | "run" | "date" | "engine" | "live" | "offline" | "demo" | "clause" | "text" | "verdict" | "citations" | "reason" | "suggestion" | "related" | "committee" | "verbatim" | "summary" | "disclaimer" | "generated" | "kind" | "quote" | "decision";
const T: Record<Locale, Labels & Record<Words, string>> = {
  ar: {
    verdicts: { nonCompliant: "يُرجَّح عدم مطابقته", review: "يحتاج مراجعة بشرية", abstain: "لا يوجد سند كافٍ", compliant: "مطابق" },
    decisions: { approve: "اعتماد الملاحظة", reject: "رفضها", refer: "إحالة للدراسة" },
    roles: { governs: "يحكم البند", supports: "يدعم الحكم", related: "ذو صلة" },
    otherTypes: { title: "عنوان", source: "مصدر النص", separator: "فاصل", parties: "تعريف الأطراف", definition: "تعريف مصطلح", signature: "توقيع", fragment: "سطر مقطوع أو خلية جدول", note: "ملاحظة" },
    notClause: "ليس بندًا، لم يُفحص",
    intro: "تمهيد لبنود تالية",
    title: "ملف مراجعة مِيزان",
    file: "الملف",
    contract: "رقم العقد",
    run: "رقم العملية",
    date: "التاريخ",
    engine: "المحرك",
    live: "فحص حي",
    offline: "نتائج مسجلة",
    demo: "عقد توضيحي",
    clause: "البند",
    text: "نص البند",
    verdict: "الحكم",
    citations: "السند",
    reason: "السبب",
    suggestion: "صياغة تحقق الضابط (اقتراح، ليست بندًا معتمدًا)",
    related: "حُكم عليه مع البنود",
    committee: "قرار اللجنة",
    verbatim: "الاقتباس مطابق حرفيًا لنص الوحدة",
    summary: "الخلاصة",
    disclaimer: "مِيزان لا يُفتي ولا يعتمد. القرار للجنة الشرعية. السند: قرارات اللجنة الشرعية لمصرف الإنماء المنشورة علنًا.",
    generated: "صُدِّر من mizansharia.com",
    kind: "النوع",
    quote: "نص القرار",
    decision: "القرار",
  },
  en: {
    verdicts: { nonCompliant: "Likely non-compliant", review: "Needs human review", abstain: "No sufficient evidence", compliant: "Compliant" },
    decisions: { approve: "Approve finding", reject: "Reject", refer: "Refer for study" },
    roles: { governs: "Governs the clause", supports: "Supports the finding", related: "Related" },
    otherTypes: { title: "Title", source: "Source note", separator: "Separator", parties: "Party details", definition: "Definition", signature: "Signature", fragment: "Line fragment or table cell", note: "Note" },
    notClause: "Not a clause, not reviewed",
    intro: "Introduces the clauses below",
    title: "Mizan review file",
    file: "File",
    contract: "Contract ID",
    run: "Run ID",
    date: "Date",
    engine: "Engine",
    live: "Live review",
    offline: "Recorded results",
    demo: "Demonstration contract",
    clause: "Clause",
    text: "Clause text",
    verdict: "Verdict",
    citations: "Evidence",
    reason: "Reason",
    suggestion: "Wording that satisfies the rule (a suggestion, not an approved clause)",
    related: "Judged with clauses",
    committee: "Committee decision",
    verbatim: "Quote matches the unit text verbatim",
    summary: "Summary",
    disclaimer: "Mizan never issues a fatwa or an approval; the Sharia committee decides. Evidence: the publicly released decisions of the Alinma Bank Sharia committee.",
    generated: "Exported from mizansharia.com",
    kind: "Kind",
    quote: "Decision text",
    decision: "Decision",
  },
};

const unitOf = (r: ClauseResult, id: string): CitationUnit | undefined => r.units?.[id] ?? (UNITS[id] as CitationUnit | undefined);
const when = (iso: string, lang: Locale) =>
  new Date(iso).toLocaleString(lang === "ar" ? "ar-SA-u-ca-gregory" : "en-GB", { timeZone: "Asia/Riyadh", dateStyle: "long", timeStyle: "short" });
const ordered = (m: ExportModel) =>
  [...m.rows].sort((a, b) => {
    const rank = (x: ExportRow) => (x.kind === "other" ? 6 : x.kind === "intro" ? 5 : x.result ? PRIORITY.indexOf(x.result.verdict) : 4);
    return rank(a) - rank(b) || a.n - b.n;
  });
const stem = (m: ExportModel) => `mizan-${m.runId ?? "review"}`;
const kindLabel = (row: ExportRow, t: Labels) =>
  row.kind === "other" ? `${t.notClause}${row.otherType ? ` (${t.otherTypes[row.otherType]})` : ""}` : row.kind === "intro" ? t.intro : "";

/** One flat row per clause: the shape behind CSV and Excel. */
export function flatRows(m: ExportModel, lang: Locale): Record<string, string | number>[] {
  const t = T[lang];
  return [...m.rows]
    .sort((a, b) => a.n - b.n)
    .map((row) => {
      const r = row.result;
      const dec = m.decisions?.[String(row.n)];
      return {
        [t.clause]: row.n,
        [t.text]: row.text,
        [t.kind]: kindLabel(row, t),
        [t.verdict]: r ? t.verdicts[r.verdict] : "",
        [t.citations]: r ? r.citations.map((id) => `${id}${r.roles?.[id] ? ` (${t.roles[r.roles[id]]})` : ""}`).join(" | ") : "",
        [t.quote]: r ? r.citations.map((id) => unitOf(r, id)?.text ?? "").filter(Boolean).join(" | ") : "",
        [t.reason]: r ? r.reason[lang] : "",
        [t.suggestion]: r?.suggestion ? r.suggestion[lang] : "",
        [t.related]: (r?.related ?? row.context ?? []).join(", "),
        [t.committee]: dec ? t.decisions[dec.d] : "",
      };
    });
}

const csvCell = (v: string | number) => {
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function toCsv(m: ExportModel, lang: Locale): string {
  const rows = flatRows(m, lang);
  if (rows.length === 0) return "";
  const head = Object.keys(rows[0]);
  // A byte-order mark so Excel opens the Arabic as UTF-8.
  return "﻿" + [head, ...rows.map((r) => head.map((h) => r[h]))].map((line) => line.map(csvCell).join(",")).join("\r\n");
}

export function toJson(m: ExportModel): string {
  return JSON.stringify({ format: "mizan-review-file", version: 1, ...m }, null, 2);
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Stamp plates as data URIs, so the report keeps the site's look offline. */
async function plates(): Promise<Record<Verdict, string>> {
  const file: Record<Verdict, string> = { nonCompliant: "stamp-red", review: "stamp-bracket", abstain: "stamp-dashed", compliant: "stamp-round" };
  const out = {} as Record<Verdict, string>;
  await Promise.all(
    (Object.keys(file) as Verdict[]).map(async (v) => {
      try {
        const blob = await (await fetch(`/assets/plates/${file[v]}.webp`)).blob();
        out[v] = await new Promise<string>((res) => {
          const fr = new FileReader();
          fr.onload = () => res(String(fr.result));
          fr.readAsDataURL(blob);
        });
      } catch {
        out[v] = "";
      }
    }),
  );
  return out;
}

/** A standalone report in the Sealed Instrument look: paper, violet, stamps, Markazi for quotes. */
export async function toHtml(m: ExportModel, lang: Locale, opts: { print?: boolean } = {}): Promise<string> {
  const t = T[lang];
  const dir = lang === "ar" ? "rtl" : "ltr";
  const stamp = await plates();
  const tally: Record<Verdict, number> = { nonCompliant: 0, review: 0, abstain: 0, compliant: 0 };
  m.rows.forEach((r) => r.result && tally[r.result.verdict]++);
  const red = (v: Verdict) => (v === "nonCompliant" ? "#c4302b" : "#3a2b8c");
  const clause = (row: ExportRow) => {
    const r = row.result;
    const serial = String(row.n).padStart(4, "0");
    if (!r)
      return `<article class="row muted"><header><span class="serial">${serial}</span><p class="doc">${esc(row.text)}</p><span class="tag">${esc(kindLabel(row, t))}</span></header></article>`;
    const dec = m.decisions?.[String(row.n)];
    const governs = r.roles ? r.citations.filter((id) => r.roles?.[id] === "governs") : r.citations.slice(0, 1);
    const lead = governs.length ? governs : r.citations.slice(0, 1);
    const quote = (id: string, small: boolean) => {
      const u = unitOf(r, id);
      return `<blockquote class="${small ? "small" : ""}"><p class="doc">«${esc(u?.text ?? id)}»</p><p class="prov"><b>${esc(id)}</b>${u ? ` · ${esc(t.decision)} (${u.decisionNo}): ${esc(u.title)}${u.dateHijri ? ` · ${esc(formatDecisionDate(u.dateHijri, "hijri", lang))}` : ""}` : ""}${r.roles?.[id] ? ` · ${esc(t.roles[r.roles[id]])}` : ""}</p></blockquote>`;
    };
    return `<article class="row">
      <header>
        <span class="serial">${serial}</span>
        <p class="doc">${esc(row.text)}</p>
        <span class="stamp" style="color:${red(r.verdict)}">${stamp[r.verdict] ? `<img src="${stamp[r.verdict]}" alt="">` : ""}<span>${esc(t.verdicts[r.verdict])}</span></span>
      </header>
      <div class="body">
        <div>
          <h4>${esc(t.reason)}</h4><p>${esc(r.reason[lang])}</p>
          ${r.related?.length ? `<p class="note">${esc(t.related)}: ${r.related.join(lang === "ar" ? "، " : ", ")}</p>` : ""}
          ${r.suggestion ? `<h4>${esc(t.suggestion)}</h4><p class="suggest">${esc(r.suggestion[lang])}</p>` : ""}
          ${dec ? `<p class="decision">${esc(t.committee)}: <b>${esc(t.decisions[dec.d])}</b> · ${esc(when(dec.at, lang))}</p>` : ""}
        </div>
        <div>
          <h4>${esc(t.citations)}</h4>
          ${r.citations.length ? lead.map((id) => quote(id, false)).join("") + r.citations.filter((id) => !lead.includes(id)).map((id) => quote(id, true)).join("") : "<p>—</p>"}
          ${r.citations.length && row.verbatim ? `<p class="ok">✓ ${esc(t.verbatim)}</p>` : ""}
        </div>
      </div>
    </article>`;
  };
  const meta = [
    [t.file, m.fileName],
    [t.contract, m.contractId ?? "—"],
    [t.run, m.runId ?? "—"],
    [t.date, when(m.createdAt, lang)],
    [t.engine, `${m.engine === "live" ? t.live : t.offline}${m.demo ? ` · ${t.demo}` : ""}`],
  ]
    .map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`)
    .join("");
  return `<!doctype html>
<html lang="${lang}" dir="${dir}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(t.title)} — ${esc(m.fileName)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Markazi+Text:wght@400;600&family=Readex+Pro:wght@400;500;600&display=swap" rel="stylesheet">
<style>
:root{--paper:#ecebe8;--bright:#f4f4f0;--violet:#3a2b8c;--ink:#14194a;--soft:#3d4270;--seal:#c4302b}
*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font-family:"Readex Pro",system-ui,sans-serif;font-variant-numeric:tabular-nums;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.bar{background:var(--violet);color:var(--bright);padding:22px 40px 26px;position:relative}
.bar::after{content:"";position:absolute;inset-inline:40px;bottom:8px;height:5px;background:radial-gradient(circle,rgba(244,244,240,.8) 45%,transparent 50%) 0 0/12px 100% repeat-x}
.bar h1{margin:0;font-size:1.6rem;font-weight:500}.bar p{margin:4px 0 0;opacity:.85}
main{max-width:1100px;margin:0 auto;padding:28px 24px 48px}
dl.meta{display:flex;flex-wrap:wrap;gap:10px 28px;margin:0 0 18px;padding:18px 20px;background:var(--bright);box-shadow:inset 0 0 0 1px rgba(58,43,140,.28)}
dl.meta dt{font-size:.8rem;color:var(--soft)}dl.meta dd{margin:2px 0 0;font-weight:600;color:var(--violet)}
.tally{display:flex;flex-wrap:wrap;gap:10px;margin:0 0 22px}.tally span{padding:6px 12px;background:var(--bright);box-shadow:inset 0 0 0 1px rgba(58,43,140,.25);font-weight:500}
.row{background:var(--bright);box-shadow:inset 0 0 0 1px rgba(58,43,140,.18),0 10px 22px -18px rgba(20,25,74,.35);margin:0 0 12px;break-inside:avoid}
.row header{display:grid;grid-template-columns:56px 1fr 170px;gap:14px;align-items:center;padding:14px 18px}
.serial{font-size:.8rem;letter-spacing:.06em;color:var(--violet)}
.doc{margin:0;font-family:"Markazi Text",serif;font-size:1.25rem;line-height:1.6}
.stamp{position:relative;display:grid;place-items:center;width:160px;aspect-ratio:2/1;font-weight:600;font-size:.82rem;text-align:center}
.stamp img{position:absolute;inset:0;width:100%;height:100%;object-fit:contain}.stamp span{position:relative;rotate:-7deg}
.body{display:grid;grid-template-columns:1fr 1fr;gap:20px;padding:4px 18px 18px;border-top:1px dashed rgba(58,43,140,.35)}
.body h4{margin:12px 0 4px;font-size:.82rem;color:var(--violet)}.body p{margin:0;line-height:1.75}
blockquote{margin:6px 0 10px;padding:10px 14px;background:rgba(58,43,140,.06)}blockquote .doc{font-size:1.1rem}
blockquote.small{opacity:.85}blockquote.small .doc{font-size:.98rem}
.prov{font-size:.8rem;color:var(--soft);margin-top:6px!important}
.suggest{padding:8px 12px;box-shadow:inset 0 0 0 1.5px var(--violet)}.note,.decision{margin-top:8px!important;padding:6px 10px;background:rgba(58,43,140,.08);font-size:.9rem}
.ok{color:var(--violet);font-size:.85rem;margin-top:6px!important}
.muted{opacity:.7}.tag{font-size:.78rem;color:var(--soft);text-align:center}
footer{margin-top:28px;padding-top:14px;border-top:1px solid rgba(58,43,140,.25);font-size:.85rem;color:var(--soft)}
@media print{body{background:#fff}.bar{padding:14px 24px 20px}main{padding:16px 0}.row{box-shadow:inset 0 0 0 1px rgba(58,43,140,.3)}}
@media (max-width:760px){.row header{grid-template-columns:44px 1fr}.stamp{grid-column:2;width:130px}.body{grid-template-columns:1fr}}
</style></head><body>
<div class="bar"><h1>${esc(t.title)}</h1><p>${esc(m.fileName)}</p></div>
<main>
<dl class="meta">${meta}</dl>
<div class="tally">${PRIORITY.map((v) => `<span style="color:${red(v)}">${esc(t.verdicts[v])}: ${tally[v]}</span>`).join("")}</div>
${ordered(m).map(clause).join("\n")}
<footer><p>${esc(t.disclaimer)}</p><p>${esc(t.generated)} · ${esc(when(new Date().toISOString(), lang))}</p></footer>
</main>${opts.print ? `<script>document.fonts.ready.then(()=>setTimeout(()=>print(),300))</script>` : ""}
</body></html>`;
}

function download(name: string, data: BlobPart, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export async function exportReview(m: ExportModel, lang: Locale, format: ExportFormat): Promise<void> {
  const name = stem(m);
  if (format === "csv") return download(`${name}.csv`, toCsv(m, lang), "text/csv;charset=utf-8");
  if (format === "json") return download(`${name}.json`, toJson(m), "application/json");
  if (format === "html") return download(`${name}.html`, await toHtml(m, lang), "text/html;charset=utf-8");
  // Word opens an HTML document saved with a .doc name, keeping the layout and the Arabic shaping.
  if (format === "word") return download(`${name}.doc`, await toHtml(m, lang), "application/msword");
  if (format === "pdf") {
    // The browser's own print-to-PDF keeps Arabic shaping exactly; PDF libraries in the page do not.
    const html = await toHtml(m, lang, { print: true });
    const url = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));
    const w = window.open(url, "_blank");
    if (!w) download(`${name}.html`, html, "text/html;charset=utf-8");
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return;
  }
  const XLSX = await import("xlsx");
  const ws = XLSX.utils.json_to_sheet(flatRows(m, lang));
  ws["!cols"] = [{ wch: 6 }, { wch: 70 }, { wch: 18 }, { wch: 20 }, { wch: 40 }, { wch: 80 }, { wch: 60 }, { wch: 50 }, { wch: 14 }, { wch: 16 }];
  const wb = XLSX.utils.book_new();
  if (lang === "ar") wb.Workbook = { Views: [{ RTL: true }] };
  XLSX.utils.book_append_sheet(wb, ws, lang === "ar" ? "ملف المراجعة" : "Review file");
  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
  download(`${name}.xlsx`, out, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
}
