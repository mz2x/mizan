// The team test set (VentureX/tests): the four metrics against the team's answer key, in two modes.
//   clause: each synthetic labeled clause reviewed on its own (presplit), plus the BM25 baseline,
//           the no-enrichment ablation and a second run for stability. The real contracts' key
//           texts are search anchors (fragments), not whole clauses, so they are not scored here.
//   e2e:    each contract reviewed whole, exactly as the site does it (the engine splits it), then
//           each labeled clause is found inside the engine's clauses and its verdict scored. This
//           also measures the split: anchors found, cut across clauses, missing, or merged.
// Writes eval/results/team-<ts>.{json,md} and a review sheet for the team (disagreements first,
// plus a fixed random sample of agreements) to <tests>/نتائج_ميزان/.
//
// Usage:
//   npm run eval:team                                   both modes, all contracts
//   npm run eval:team -- --mode e2e --only S01,R04      a subset
//   npm run eval:team -- --adjudicate <sheet.csv> --from <team-…json>   re-score after the team's review
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { loadDevEnv } from "../../src/server/env";
import { buildIndex, search } from "../../src/server/engine/bm25";
import { loadCorpus } from "../../src/server/engine/corpus";
import { makeLlm, type Usage } from "../../src/server/engine/llm";
import { reviewDocument } from "../../src/server/engine/pipeline";
import { pct } from "./lib";
import {
  adjudicate, align, DECISIONS, isCorrect, labelOf, parseCsv, seededSample, teamMetrics, toCsv,
  type Key, type Pred, type Row, type TeamMetrics,
} from "./team-lib";

loadDevEnv();

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const keyPath = path.resolve(arg("key") ?? "../tests/answer_key.json");
const testsDir = path.dirname(keyPath);
const key: Key = JSON.parse(readFileSync(keyPath, "utf8"));
const corpus = loadCorpus();
for (const c of key.clauses)
  for (const id of c.units) if (!corpus.byId.has(id)) throw new Error(`answer key unit not in corpus: ${id}`);

type Scored = {
  id: string; contract: string; clause: string; kind: string; text: string;
  label: Row["label"]; units: string[]; termGap: boolean; keyReason: string;
  clauseMode?: { mizan: Pred & { reason: string; hit: boolean }; mizan2: Pred; ablation: Pred; baseline: Pred };
  e2e?: { pred: Pred | null; reason: string; index: number; exact: boolean; merged: boolean; engineText: string; hit: boolean | null };
};

const scored: Scored[] = key.clauses.flatMap((c, i) => {
  const label = labelOf(key, c.expected);
  if (label === "procedural") return [];
  return [{
    id: `${c.contract}#${i}`, contract: c.contract, clause: c.clause, kind: c.kind, text: c.text,
    label, units: c.units, termGap: c.term_gap, keyReason: c.reason,
  }];
});

const rowsOf = (pick: (s: Scored) => Pred | null | undefined, from: Scored[] = scored): Row[] =>
  from.filter((s) => pick(s) !== undefined).map((s) => ({ label: s.label, units: s.units, termGap: s.termGap, pred: pick(s) ?? null }));

function tableRow(name: string, m: TeamMetrics, extra: string[] = []) {
  return `| ${name} | ${m.n} | ${pct(m.recall)} | ${pct(m.precision)} | ${pct(m.withholding)} | ${pct(m.compliantRecall)} | ${pct(m.falseAlarm)} | ${pct(m.citation)} | ${pct(m.termGapRecall)} | ${pct(m.agreement)} | ${extra.join(" | ")} |`;
}
const HEADER = [
  "| system | n | recall «مخالف» | precision | withholding «مراجعة» | «مطابق» recall | false alarm on «مطابق» | citation | term-gap recall | agreement | retrieval | usd |",
  "|---|---|---|---|---|---|---|---|---|---|---|---|",
];

// ── Adjudication: re-score a saved run with the team's rulings, no llm calls ──────────────────────
if (arg("adjudicate")) {
  const saved: { rows: Scored[] } = JSON.parse(readFileSync(path.resolve(arg("from")!), "utf8"));
  const sheet = parseCsv(readFileSync(path.resolve(arg("adjudicate")!), "utf8"));
  const [head, ...body] = sheet;
  const idCol = head.indexOf("id"), dCol = head.indexOf("قرار الفريق");
  if (idCol < 0 || dCol < 0) throw new Error("review sheet needs the «id» and «قرار الفريق» columns");
  const rulings = new Map(body.map((r) => [r[idCol], r[dCol]]));
  const lines = ["# بعد مراجعة الفريق", "", ...HEADER];
  for (const [name, pick] of [
    ["mizan e2e", (s: Scored) => s.e2e?.pred],
    ["mizan clause", (s: Scored) => s.clauseMode?.mizan],
    ["baseline clause", (s: Scored) => s.clauseMode?.baseline],
  ] as const) {
    const withId = saved.rows.filter((s) => pick(s) !== undefined).map((s) => ({ id: s.id, label: s.label, units: s.units, termGap: s.termGap, pred: pick(s) ?? null }));
    lines.push(tableRow(`${name} (before)`, teamMetrics(withId), ["", ""]));
    lines.push(tableRow(`${name} (after)`, teamMetrics(adjudicate(withId, rulings)), ["", ""]));
  }
  const counts = [...rulings.values()].reduce((m, v) => m.set(v || "(blank)", (m.get(v || "(blank)") ?? 0) + 1), new Map<string, number>());
  lines.push("", `rulings: ${[...counts].map(([k, v]) => `${k} ${v}`).join(", ")}`);
  console.log(lines.join("\n"));
  process.exit(0);
}

// ── Live runs ─────────────────────────────────────────────────────────────────────────────────────
const llm = makeLlm();
const mode = arg("mode") ?? "both";
/** --quick: one Mizan run in clause mode (no second run for stability, no ablation). */
const quick = process.argv.includes("--quick");
const only = arg("only")?.split(",").map((s) => s.trim());
const inScope = (contract: string) => !only || only.includes(contract);
const usd = (u: Usage) => (u.input * 2 + u.cacheWrite * 2.5 + u.cacheRead * 0.2 + u.output * 10) / 1e6;
const cost = { clause: 0, ablation: 0, e2e: 0 };
const track = (bucket: keyof typeof cost) => (u: Usage) => { cost[bucket] += usd(u); };
const K = 12;

async function pool<T>(xs: T[], n: number, fn: (x: T, i: number) => Promise<void>) {
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(n, xs.length) }, async () => {
    while (next < xs.length) { const i = next++; await fn(xs[i], i); }
  }));
}

async function reviewOne(text: string, enriched: boolean, bucket: keyof typeof cost) {
  let pred: Pred = { verdict: "review", citations: [] };
  let reason = "", cands: string[] = [];
  for await (const e of reviewDocument({
    text, llm, corpus, enriched, k: enriched ? K : 2 * K, concurrency: 1, presplit: [text],
    onUsage: track(bucket), onCandidates: (_n, ids) => { cands = ids; },
  }))
    if (e.type === "result") { pred = { verdict: e.result.verdict, citations: e.result.citations }; reason = e.result.reason.ar; }
  return { pred, reason, cands };
}

function baseline(items: Scored[]): Pred[] {
  const index = buildIndex(corpus, { enriched: false });
  const top = items.map((s) => search(index, s.text, 1)[0]);
  const isRule = (id: string) => /لا يجوز|ألا|أن لا|ليس لل|يشترط|يجب|محرم|على أن|بشرط/.test(corpus.byId.get(id)!.text);
  // Threshold T maximizing the baseline's own F1 on «مخالف» (deliberately favors the baseline).
  let best = { t: 0, f1: -1 };
  for (const t of [...new Set(top.map((h) => h?.score ?? 0))]) {
    const p = top.map((h) => (h && h.score >= t && isRule(h.id) ? "bad" : "x"));
    const tp = p.filter((v, i) => v === "bad" && items[i].label === "bad").length;
    const fp = p.filter((v, i) => v === "bad" && items[i].label !== "bad").length;
    const fn = items.filter((s, i) => s.label === "bad" && p[i] !== "bad").length;
    const f1 = tp ? (2 * tp) / (2 * tp + fp + fn) : 0;
    if (f1 > best.f1) best = { t, f1 };
  }
  return top.map((h) => (h && h.score >= best.t && isRule(h.id) ? { verdict: "nonCompliant", citations: [h.id] } : { verdict: "abstain", citations: [] }));
}

const t0 = Date.now();
const log = (s: string) => console.log(`[${Math.round((Date.now() - t0) / 1000)}s] ${s}`);
let stability: number | null = null;
let retrieval = { mizan: null as number | null, ablation: null as number | null };

if (mode === "both" || mode === "clause") {
  const items = scored.filter((s) => s.kind === "اصطناعي" && inScope(s.contract));
  log(`clause mode: ${items.length} synthetic clauses × (mizan, mizan again, ablation)`);
  const m1: Awaited<ReturnType<typeof reviewOne>>[] = [], m2: Pred[] = [], ab: Awaited<ReturnType<typeof reviewOne>>[] = [];
  await pool(items, 4, async (s, i) => { m1[i] = await reviewOne(s.text, true, "clause"); });
  log("clause mode: first mizan run done");
  if (!quick) {
    await pool(items, 4, async (s, i) => { m2[i] = (await reviewOne(s.text, true, "clause")).pred; });
    log("clause mode: second mizan run done");
    await pool(items, 4, async (s, i) => { ab[i] = await reviewOne(s.text, false, "ablation"); });
    log("clause mode: ablation done");
  } else items.forEach((_, i) => { m2[i] = m1[i].pred; ab[i] = m1[i]; });
  const base = baseline(items);
  const hit = (cands: string[], units: string[]) => units.some((u) => cands.includes(u));
  items.forEach((s, i) => {
    s.clauseMode = {
      mizan: { ...m1[i].pred, reason: m1[i].reason, hit: hit(m1[i].cands, s.units) },
      mizan2: m2[i], ablation: ab[i].pred, baseline: base[i],
    };
  });
  const withGov = items.filter((s) => s.units.length);
  retrieval = {
    mizan: withGov.length ? withGov.filter((s) => s.clauseMode!.mizan.hit).length / withGov.length : null,
    ablation: withGov.length ? withGov.filter((s, ) => hit(ab[items.indexOf(s)].cands, s.units)).length / withGov.length : null,
  };
  stability = quick ? null : items.length ? items.filter((_, i) => m1[i].pred.verdict === m2[i].verdict).length / items.length : null;
}

const coverage = { anchors: 0, exact: 0, cut: 0, missing: 0, merged: 0 };
const notices: Record<string, string[]> = {};
if (mode === "both" || mode === "e2e") {
  for (const c of key.contracts.filter((c) => inScope(c.id))) {
    const text = readFileSync(path.join(testsDir, c.file), "utf8");
    const clauses = new Map<number, string>();
    const results = new Map<number, { pred: Pred; reason: string }>();
    const cands = new Map<number, string[]>();
    notices[c.id] = [];
    for await (const e of reviewDocument({ text, llm, corpus, requireEnrichment: true, onUsage: track("e2e"), onCandidates: (n, ids) => cands.set(n, ids) })) {
      if (e.type === "clause") clauses.set(e.n, e.text.ar);
      if (e.type === "result") results.set(e.result.n, { pred: { verdict: e.result.verdict, citations: e.result.citations }, reason: e.result.reason.ar });
      if (e.type === "notice" || e.type === "error") notices[c.id].push(e.message.ar);
    }
    const ns = [...clauses.keys()].sort((a, b) => a - b);
    const mine = scored.filter((s) => s.contract === c.id);
    const where = align(ns.map((n) => clauses.get(n)!), mine.map((s) => s.text));
    const used = new Map<number, number>();
    where.forEach((w) => { if (w.index >= 0) used.set(w.index, (used.get(w.index) ?? 0) + 1); });
    mine.forEach((s, i) => {
      const w = where[i];
      coverage.anchors++;
      if (w.index < 0) { coverage.missing++; s.e2e = { pred: null, reason: "", index: -1, exact: false, merged: false, engineText: "", hit: null }; return; }
      if (w.exact) coverage.exact++; else coverage.cut++;
      const merged = (used.get(w.index) ?? 0) > 1;
      if (merged) coverage.merged++;
      const n = ns[w.index];
      const r = results.get(n);
      s.e2e = {
        pred: r?.pred ?? null, reason: r?.reason ?? "", index: n, exact: w.exact, merged, engineText: clauses.get(n)!,
        hit: s.units.length ? s.units.some((u) => (cands.get(n) ?? []).includes(u)) : null,
      };
    });
    log(`e2e ${c.id}: ${clauses.size} clauses, ${mine.length} labeled, notices: ${notices[c.id].join(" / ") || "none"}`);
  }
}

// ── Report ────────────────────────────────────────────────────────────────────────────────────────
const cause = (s: Scored): string => {
  const e = s.e2e!;
  if (isCorrect(s.label, e.pred?.verdict ?? null)) return "";
  if (e.index < 0) return "التقطيع: البند غير موجود";
  if (!e.exact) return "التقطيع: البند مقطوع بين بندين";
  if (e.merged) return "التقطيع: مدموج مع بند معنون آخر";
  if (!s.units.length) return "لا قرار في المفتاح";
  if (e.hit === false) return "البحث: القرار الحاكم لم يصل للمرشحين";
  return "الحكم: القرار كان بين المرشحين";
};
const verdictAr: Record<string, string> = { nonCompliant: "يُرجَّح عدم مطابقته", review: "تحتاج مراجعة", abstain: "لا يوجد سند كافٍ", compliant: "مطابق" };
const labelAr = key.labels;

const date = new Date().toISOString();
const stamp = date.replace(/[:.]/g, "-");
const lines = [
  `# Team test set ${date}`,
  "",
  `key: ${keyPath}. scored clauses: ${scored.length} (procedural excluded). «يحتاج مراجعة» counts both «تحتاج مراجعة» and «لا يوجد سند كافٍ» as correct.`,
  "clause mode = synthetic clauses reviewed one by one; e2e = whole contracts through the site's pipeline (split included).",
  "",
  ...HEADER,
];
if (scored.some((s) => s.e2e)) lines.push(tableRow("mizan e2e (as on the site)", teamMetrics(rowsOf((s) => s.e2e?.pred)), ["", cost.e2e.toFixed(2)]));
if (scored.some((s) => s.e2e)) {
  const syn = scored.filter((s) => s.kind === "اصطناعي"), real = scored.filter((s) => s.kind !== "اصطناعي");
  lines.push(tableRow("  e2e, synthetic only", teamMetrics(rowsOf((s) => s.e2e?.pred, syn)), ["", ""]));
  lines.push(tableRow("  e2e, real contracts only", teamMetrics(rowsOf((s) => s.e2e?.pred, real)), ["", ""]));
}
if (scored.some((s) => s.clauseMode)) {
  lines.push(tableRow("mizan clause", teamMetrics(rowsOf((s) => s.clauseMode?.mizan)), [pct(retrieval.mizan), cost.clause.toFixed(2)]));
  if (!quick) lines.push(tableRow("ablation (no enrichment) clause", teamMetrics(rowsOf((s) => s.clauseMode?.ablation)), [pct(retrieval.ablation), cost.ablation.toFixed(2)]));
  lines.push(tableRow("baseline BM25 clause", teamMetrics(rowsOf((s) => s.clauseMode?.baseline)), ["", "0"]));
  lines.push("", `stability (two Mizan clause runs, same verdict): ${pct(stability)}`);
}
if (coverage.anchors) {
  lines.push("", `split (e2e): ${coverage.anchors} labeled clauses — found whole ${coverage.exact}, cut across clauses ${coverage.cut}, not found ${coverage.missing}, merged with another labeled clause ${coverage.merged}.`);
  const causes = scored.filter((s) => s.e2e).map(cause).filter(Boolean);
  const byCause = causes.reduce((m, c) => m.set(c, (m.get(c) ?? 0) + 1), new Map<string, number>());
  lines.push("", "e2e misses by cause:", ...[...byCause].sort((a, b) => b[1] - a[1]).map(([c, n]) => `- ${c}: ${n}`));
}
lines.push("", `cost: $${(cost.clause + cost.ablation + cost.e2e).toFixed(2)}. time: ${Math.round((Date.now() - t0) / 1000)} s.`);
const md = lines.join("\n");

mkdirSync("eval/results", { recursive: true });
const jsonPath = `eval/results/team-${stamp}.json`;
writeFileSync(jsonPath, JSON.stringify({ date, keyPath, cost, stability, retrieval, coverage, notices, rows: scored }, null, 2));
writeFileSync(`eval/results/team-${stamp}.md`, md);

// Review sheet: every e2e disagreement, then 15 random agreements (so fixing only Mizan's misses
// cannot bias the numbers in Mizan's favour). Clause-mode verdicts ride along for the synthetic rows.
const unitText = (ids: string[]) => ids.map((id) => `${id}: ${corpus.byId.get(id)?.text ?? ""}`).join("\n");
const judged = scored.filter((s) => s.e2e || s.clauseMode);
const mizanPred = (s: Scored) => s.e2e?.pred ?? s.clauseMode?.mizan ?? null;
const wrong = judged.filter((s) => !isCorrect(s.label, mizanPred(s)?.verdict ?? null));
const right = seededSample(judged.filter((s) => isCorrect(s.label, mizanPred(s)?.verdict ?? null)), 15, 20261001);
const sheet = [
  ["id", "النوع", "العقد", "البند", "نص البند في المفتاح", "حكم المفتاح", "حكم ميزان", "سبب الخطأ", "قرار المفتاح ونصه", "سبب المفتاح", "استشهاد ميزان ونصه", "سبب ميزان", "حكم ميزان (بند منفرد)", "قرار الفريق", "ملاحظة"],
  ...[...wrong.map((s) => ["خلاف", s] as const), ...right.map((s) => ["اتفاق (عينة)", s] as const)].map(([kind, s]) => {
    const p = mizanPred(s);
    return [
      s.id, kind, s.contract, s.clause, s.text, labelAr[s.label], p ? verdictAr[p.verdict] : "لم يُعثر على البند",
      s.e2e ? cause(s) : "", unitText(s.units), s.keyReason, p ? unitText(p.citations.slice(0, 2)) : "",
      s.e2e?.reason ?? s.clauseMode?.mizan.reason ?? "", s.clauseMode ? verdictAr[s.clauseMode.mizan.verdict] : "", "", "",
    ];
  }),
];
const outDir = path.join(testsDir, "نتائج_ميزان");
mkdirSync(outDir, { recursive: true });
const sheetPath = path.join(outDir, `مراجعة_الفريق_${stamp}.csv`);
writeFileSync(sheetPath, toCsv(sheet));
writeFileSync(path.join(outDir, `النتائج_${stamp}.md`), md);
console.log(md);
console.log(`\njson: ${jsonPath}\nreview sheet: ${sheetPath} (${wrong.length} disagreements + ${right.length} sampled agreements)`);
console.log(`team answers in «قرار الفريق»: ${Object.values(DECISIONS).join(" / ")}`);
