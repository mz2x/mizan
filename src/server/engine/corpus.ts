// server-only: imported by node tests
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export type Unit = {
  id: string; decision_no: number; section: string; item: number | null; kind: string;
  text: string; text_norm: string; context: string | null; title: string; year: number;
};
export type Decision = {
  decision_no: number; title: string; date_hijri: string; date_gregorian: string;
  refs: number[]; text: string; preamble: string;
  /** The committee session (e.g. «الأولى»); null on a few source records. */
  session?: string | null;
};
export type Enrichment = {
  id: string;
  kind: "prohibition" | "condition" | "permission" | "procedure" | "approval_only";
  scope: string[];
  contract_phrasings: string[];
  aaoifi_only: boolean;
};
export type Corpus = {
  units: Unit[];
  byId: Map<string, Unit>;
  decisions: Map<number, Decision>;
  enrichment: Map<string, Enrichment>;
  citedBy: Map<number, number[]>;
  /** True when decision `later` has an operative sentence with amend/supersede language that names decision `earlier`. */
  amends: (later: number, earlier: number) => boolean;
};

const AMEND = /يحل هذا القرار محل|إلغاء|الغاء|يلغى|يُلغى|نسخ|العدول عن|تعديل\s+(?:البند|الفقرة|الضابط|نص)/;
const jsonl = <T>(file: string): T[] =>
  readFileSync(file, "utf8").trim().split("\n").map((l) => JSON.parse(l) as T);

let cached: Corpus | null = null;

export function loadCorpus(dir = path.join(process.cwd(), "data")): Corpus {
  if (cached) return cached;
  const units = jsonl<Unit>(path.join(dir, "corpus", "units.jsonl"));
  const decisionsList = jsonl<Decision>(path.join(dir, "corpus", "decisions.jsonl"));
  const enrichFile = path.join(dir, "enrichment.jsonl");
  const enrichment = new Map<string, Enrichment>(
    existsSync(enrichFile) ? jsonl<Enrichment>(enrichFile).map((e) => [e.id, e]) : [],
  );
  const decisions = new Map(decisionsList.map((d) => [d.decision_no, d]));
  const citedBy = new Map<number, number[]>();
  for (const d of decisionsList)
    for (const r of d.refs) citedBy.set(r, [...(citedBy.get(r) ?? []), d.decision_no]);
  cached = {
    units,
    byId: new Map(units.map((u) => [u.id, u])),
    decisions,
    enrichment,
    citedBy,
    amends: (later, earlier) => {
      const d = decisions.get(later);
      if (!d) return false;
      const operative = `${d.title}. ${d.text.split("قررت").at(-1) ?? ""}`;
      const ref = new RegExp(`القرار\\s*\\(0*${earlier}\\)`);
      return operative.split(/[.؛\n]/).some((s) => AMEND.test(s) && ref.test(s));
    },
  };
  return cached;
}
