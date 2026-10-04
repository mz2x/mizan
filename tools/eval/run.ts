// Usage: npm run eval -- [path/to/set.jsonl]   (default tools/eval/sample.jsonl)
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { loadDevEnv } from "../../src/server/env";
import { buildIndex, search } from "../../src/server/engine/bm25";
import { loadCorpus } from "../../src/server/engine/corpus";
import { makeLlm, type Usage } from "../../src/server/engine/llm";
import { reviewDocument } from "../../src/server/engine/pipeline";
import { MIN_PUBLISHED_N, metrics, parseEvalSet, renderMarkdown, type EvalOutput, type Item, type Pred, type SystemRow } from "./lib";

loadDevEnv();

const file = process.argv[2] ?? "tools/eval/sample.jsonl";
const corpus = loadCorpus();
let items: Item[];
try {
  items = parseEvalSet(readFileSync(file, "utf8"), new Set(corpus.byId.keys()));
} catch (e) {
  console.error(`${file}: ${(e as Error).message}`);
  process.exit(1);
}
const llm = makeLlm();

const usd = (u: Usage) => (u.input * 2 + u.cacheWrite * 2.5 + u.cacheRead * 0.2 + u.output * 10) / 1e6;

// Mizan's candidates are the hybrid enriched@K ∪ plain@K (up to 2K ids); the ablation runs plain-only
// at the same 2K budget so retrieval@candidates compares like with like.
const K = 12;
// The two halves of the hybrid, scored separately at @K from the pipeline's own query.
const enrichedIndex = buildIndex(corpus, { enriched: true });
const plainHalfIndex = buildIndex(corpus, { enriched: false, excludeApproval: true });

type Run = { preds: Pred[]; usd: number; retrieval: number | null; enrichedOnly: number | null; plainOnly: number | null };

async function runEngine(enriched: boolean): Promise<Run> {
  const total: Usage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
  const onUsage = (u: Usage) => { for (const key in u) total[key as keyof Usage] += u[key as keyof Usage]; };
  const preds: Pred[] = [];
  let hit = 0, hitEnriched = 0, hitPlain = 0, withGov = 0;
  for (let idx = 0; idx < items.length; idx++) {
    const it = items[idx];
    if (it.governing_ids.length) withGov++;
    const has = (ids: string[]) => ids.some((id) => it.governing_ids.includes(id));
    // Retrieval comes from the pipeline's own candidates and query (no untracked llm call here).
    const onCandidates = (_n: number, ids: string[]) => { if (it.governing_ids.length && has(ids)) hit++; };
    const onQuery = (_n: number, q: string) => {
      if (!it.governing_ids.length) return;
      if (has(search(enrichedIndex, q, K).map((h) => h.id))) hitEnriched++;
      if (has(search(plainHalfIndex, q, K).map((h) => h.id))) hitPlain++;
    };
    // Clause-level review: `presplit` sends the clause as the one and only clause.
    let pred: Pred = { verdict: "abstain", citations: [] };
    let results = 0;
    for await (const e of reviewDocument({
      text: it.clause, llm, corpus, enriched, k: enriched ? K : 2 * K, onUsage, concurrency: 1,
      presplit: [it.clause], onCandidates, onQuery,
    }))
      if (e.type === "result") { pred = { verdict: e.result.verdict, citations: e.result.citations }; results++; }
    if (results !== 1) {
      console.error(`eval item ${idx}: expected exactly 1 result event, got ${results} — clause: "${it.clause}"`);
      pred = { verdict: "review", citations: [] };
    }
    preds.push(pred);
  }
  const share = (x: number) => (withGov ? x / withGov : null);
  return { preds, usd: usd(total), retrieval: share(hit), enrichedOnly: share(hitEnriched), plainOnly: share(hitPlain) };
}

function baseline(): Pred[] {
  const index = buildIndex(corpus, { enriched: false });
  const scores = items.map((it) => search(index, it.clause, 1)[0]);
  const isRule = (id: string) => /لا يجوز|ألا|أن لا|ليس لل|يشترط|يجب|محرم|على أن|بشرط/.test(corpus.byId.get(id)!.text);
  // Threshold T maximizing baseline F1 on this set (deliberately favors the baseline).
  let best = { t: 0, f1: -1 };
  for (const t of [...new Set(scores.map((s) => s?.score ?? 0))]) {
    const p = scores.map((s) => (s && s.score >= t && isRule(s.id) ? "nonCompliant" : "abstain"));
    const tp = p.filter((v, i) => v === "nonCompliant" && items[i].expected === "nonCompliant").length;
    const fp = p.filter((v, i) => v === "nonCompliant" && items[i].expected !== "nonCompliant").length;
    const fn = items.filter((it, i) => it.expected === "nonCompliant" && p[i] !== "nonCompliant").length;
    const f1 = tp ? (2 * tp) / (2 * tp + fp + fn) : 0;
    if (f1 > best.f1) best = { t, f1 };
  }
  return scores.map((s) => (s && s.score >= best.t && isRule(s.id) ? { verdict: "nonCompliant", citations: [s.id] } : { verdict: "abstain", citations: [] }));
}

const mizan = await runEngine(true);
const mizan2 = await runEngine(true);
const ablation = await runEngine(false);
const stability = items.length ? mizan.preds.filter((p, i) => p.verdict === mizan2.preds[i].verdict).length / items.length : null;
const retrievalOnly = (v: number | null): SystemRow => ({ recall: null, precision: null, citation: null, abstention: null, retrievalAtCandidates: v, usd: null });
const out: EvalOutput = {
  date: new Date().toISOString(),
  n: items.length,
  candidates: { mizan: `enriched@${K} ∪ plain@${K}`, ablation: `plain@${2 * K}` },
  systems: {
    mizan: { ...metrics(items, mizan.preds), retrievalAtCandidates: mizan.retrieval, usd: mizan.usd },
    baseline: { ...metrics(items, baseline()), retrievalAtCandidates: null, usd: 0 },
    ablation: { ...metrics(items, ablation.preds), retrievalAtCandidates: ablation.retrieval, usd: ablation.usd },
    enrichedOnly: retrievalOnly(mizan.enrichedOnly),
    plainOnly: retrievalOnly(mizan.plainOnly),
  },
  stability,
};
mkdirSync("eval/results", { recursive: true });
// The landing page reads latest.json; a seed or wiring run must never become its numbers.
if (out.n >= MIN_PUBLISHED_N) writeFileSync("eval/results/latest.json", JSON.stringify(out, null, 2));
else console.log(`n=${out.n} < ${MIN_PUBLISHED_N}: eval/results/latest.json not written`);
const md = renderMarkdown(out, path.basename(file));
writeFileSync(`eval/results/${out.date.replace(/[:.]/g, "-")}.md`, md);
console.log(md);
