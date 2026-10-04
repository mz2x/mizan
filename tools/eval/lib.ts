// Pure helpers for the eval harness (tools/eval/run.ts): parsing and validating the eval set, the
// four metrics, and the markdown report. No llm calls and no file I/O here, so all of it is tested.

export const VERDICTS = ["nonCompliant", "review", "abstain", "compliant"] as const;
export type Verdict = (typeof VERDICTS)[number];
export type Item = { clause: string; expected: Verdict; governing_ids: string[] };
export type Pred = { verdict: Verdict; citations: string[] };

/** latest.json (read by the landing page) is written only from a real eval set of this size. */
export const MIN_PUBLISHED_N = 30;

/** Carried ruling: an item may give `governing_id` (string | null) or `governing_ids` (a list; the
 *  same rule can be stated in more than one decision), and `expected` or its alias
 *  `expected_verdict` (the spec's column name). Every item is validated; all problems are reported
 *  together, each with its 1-based line number, and the run stops. */
export function parseEvalSet(text: string, corpusIds: Set<string>): Item[] {
  const problems: string[] = [];
  const items: Item[] = [];
  text.split("\n").forEach((raw, i) => {
    const line = i + 1;
    if (!raw.trim()) return;
    let r: Record<string, unknown>;
    try {
      r = JSON.parse(raw);
    } catch (e) {
      problems.push(`line ${line}: not valid JSON (${(e as Error).message})`);
      return;
    }
    const before = problems.length;
    if (typeof r.clause !== "string" || !r.clause.trim()) problems.push(`line ${line}: missing clause text`);
    const expected = r.expected ?? r.expected_verdict;
    if (!VERDICTS.includes(expected as Verdict))
      problems.push(`line ${line}: expected verdict ${JSON.stringify(expected)} is not one of ${VERDICTS.join(", ")}`);
    const governing_ids: unknown[] = Array.isArray(r.governing_ids)
      ? r.governing_ids
      : r.governing_id == null ? [] : [r.governing_id];
    for (const id of governing_ids)
      if (typeof id !== "string" || !corpusIds.has(id)) problems.push(`line ${line}: governing id ${JSON.stringify(id)} is not in the corpus`);
    if (problems.length === before)
      items.push({ clause: r.clause as string, expected: expected as Verdict, governing_ids: governing_ids as string[] });
  });
  if (problems.length) throw new Error(`invalid eval set:\n${problems.join("\n")}`);
  return items;
}

/** A share with an empty denominator is undefined, not 0: it renders as «—». */
export const ratio = (a: number, b: number): number | null => (b ? a / b : null);
export const pct = (v: number | null) => (v === null ? "—" : `${Math.round(v * 100)}%`);

export type Metrics = { recall: number | null; precision: number | null; citation: number | null; abstention: number | null };

export const ABSTENTION_DEFINITION =
  "abstention = correct abstentions / all abstentions: of the clauses a system answered `abstain`, the share whose expected verdict is `abstain` (— when it never abstained).";

export function metrics(items: Item[], preds: Pred[]): Metrics {
  const nc = items.map((it, i) => ({ it, p: preds[i] }));
  const pos = nc.filter((x) => x.it.expected === "nonCompliant");
  const flagged = nc.filter((x) => x.p.verdict === "nonCompliant");
  const gov = nc.filter((x) => x.it.governing_ids.length && x.p.verdict !== "abstain");
  const abst = nc.filter((x) => x.p.verdict === "abstain");
  return {
    recall: ratio(pos.filter((x) => x.p.verdict === "nonCompliant").length, pos.length),
    precision: ratio(flagged.filter((x) => x.it.expected === "nonCompliant").length, flagged.length),
    citation: ratio(gov.filter((x) => x.it.governing_ids.includes(x.p.citations[0])).length, gov.length),
    abstention: ratio(abst.filter((x) => x.it.expected === "abstain").length, abst.length),
  };
}

export type SystemRow = Metrics & { retrievalAtCandidates: number | null; usd: number | null };
export type EvalOutput = {
  date: string;
  n: number;
  /** The candidate budget each system's retrieval was measured at. */
  candidates: { mizan: string; ablation: string };
  systems: Record<"mizan" | "baseline" | "ablation" | "enrichedOnly" | "plainOnly", SystemRow>;
  stability: number | null;
};

export function renderMarkdown(out: EvalOutput, setName: string): string {
  return [
    `# Eval ${out.date} (n=${out.n}, set=${setName})`,
    "",
    ABSTENTION_DEFINITION,
    `retrieval@candidates: a hit when any listed governing unit is among the candidates handed to the judge (mizan: ${out.candidates.mizan}; ablation: ${out.candidates.ablation}, the same budget). enrichedOnly and plainOnly are the two halves of Mizan's hybrid at @12, from the same query.`,
    "citation counts a hit if the first citation is any listed governing unit for that clause.",
    "",
    "| system | recall | precision | citation | abstention | retrieval@candidates | usd |",
    "|---|---|---|---|---|---|---|",
    ...Object.entries(out.systems).map(
      ([k, v]) =>
        `| ${k} | ${pct(v.recall)} | ${pct(v.precision)} | ${pct(v.citation)} | ${pct(v.abstention)} | ${pct(v.retrievalAtCandidates)} | ${v.usd === null ? "—" : v.usd.toFixed(3)} |`,
    ),
    "",
    `stability (two Mizan runs, same verdict): ${pct(out.stability)}`,
  ].join("\n");
}
