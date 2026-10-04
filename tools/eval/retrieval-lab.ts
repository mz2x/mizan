// Retrieval comparison for the mentors' questions (2026-10-02): does adding semantic search
// (embeddings) or a reranker find the governing decision more often than today's BM25 hybrid?
// Local only: embeddings come from Ollama on this machine, so no corpus text leaves it. The query
// for each clause is the production one (buildQuery, Claude), cached after the first run.
//
//   npx tsx tools/eval/retrieval-lab.ts                 # all methods, writes .data/lab/*.json
// Measures, for the 90 scored clauses of the team test set: does a governing unit from the answer
// key appear among the candidates handed to the judge (recall@N), and at what rank (MRR).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { loadDevEnv } from "../../src/server/env";
import { makeLlm } from "../../src/server/engine/llm";
import { loadCorpus } from "../../src/server/engine/corpus";
import { buildIndex, docText, search } from "../../src/server/engine/bm25";
import { buildQuery } from "../../src/server/engine/query";

loadDevEnv();
const LAB = ".data/lab";
mkdirSync(LAB, { recursive: true });
const OLLAMA = "http://localhost:11434";
const corpus = loadCorpus();
const key = JSON.parse(readFileSync(path.resolve("../tests/answer_key.json"), "utf8")) as {
  clauses: { contract: string; kind: string; text: string; units: string[] }[];
};
const items = key.clauses.filter((c) => c.units.length > 0);
const N = 17; // production hands the judge about 17 candidates (12 + 12, de-duplicated)

// ── queries (production buildQuery), cached ──────────────────────────────────────────────
const qFile = `${LAB}/queries.json`;
const queries: string[] = existsSync(qFile) ? JSON.parse(readFileSync(qFile, "utf8")) : [];
if (queries.length !== items.length) {
  const llm = makeLlm();
  queries.length = 0;
  for (let i = 0; i < items.length; i += 6)
    queries.push(...(await Promise.all(items.slice(i, i + 6).map((c) => buildQuery(llm, c.text)))));
  writeFileSync(qFile, JSON.stringify(queries));
}

// ── embeddings via Ollama, cached per model ──────────────────────────────────────────────
async function embed(model: string, texts: string[]): Promise<Float32Array[]> {
  const out: Float32Array[] = [];
  for (let i = 0; i < texts.length; i += 32) {
    const r = await fetch(`${OLLAMA}/api/embed`, { method: "POST", body: JSON.stringify({ model, input: texts.slice(i, i + 32), truncate: true }) });
    const j = (await r.json()) as { embeddings: number[][] };
    for (const e of j.embeddings) {
      const v = Float32Array.from(e);
      let n = 0;
      for (const x of v) n += x * x;
      n = Math.sqrt(n) || 1;
      out.push(v.map((x) => x / n));
    }
  }
  return out;
}
async function unitVectors(model: string, enriched: boolean): Promise<Float32Array[]> {
  const f = `${LAB}/units-${model.replace(/[:/]/g, "_")}-${enriched ? "enr" : "plain"}.bin`;
  if (existsSync(f)) {
    const buf = readFileSync(f);
    const all = new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
    const dim = all.length / corpus.units.length;
    return corpus.units.map((_, i) => all.subarray(i * dim, (i + 1) * dim));
  }
  const texts = corpus.units.map((u) => docText(corpus, u.id, enriched).slice(0, 2000));
  const vecs = await embed(model, texts);
  const flat = new Float32Array(vecs.length * vecs[0].length);
  vecs.forEach((v, i) => flat.set(v, i * v.length));
  writeFileSync(f, Buffer.from(flat.buffer));
  return vecs;
}
const dot = (a: Float32Array, b: Float32Array) => {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
};
const ids = corpus.units.map((u) => u.id);
const approvalOnly = new Set(ids.filter((id) => corpus.enrichment.get(id)?.kind === "approval_only"));
function dense(q: Float32Array, units: Float32Array[], k: number): string[] {
  return units
    .map((v, i) => ({ id: ids[i], s: dot(q, v) }))
    .filter((x) => !approvalOnly.has(x.id))
    .sort((a, b) => b.s - a.s)
    .slice(0, k)
    .map((x) => x.id);
}

// ── fusion ────────────────────────────────────────────────────────────────────────────────
/** Reciprocal rank fusion: each list votes 1/(60 + rank). */
function rrf(lists: string[][], k: number): string[] {
  const score = new Map<string, number>();
  for (const l of lists) l.forEach((id, r) => score.set(id, (score.get(id) ?? 0) + 1 / (60 + r)));
  return [...score.entries()].sort((a, b) => b[1] - a[1]).slice(0, k).map(([id]) => id);
}
const dedupe = (l: string[]) => [...new Set(l)];

// ── methods ───────────────────────────────────────────────────────────────────────────────
const enrIdx = buildIndex(corpus, { enriched: true });
const plainIdx = buildIndex(corpus, { enriched: false, excludeApproval: true });
const bm = (q: string, k: number) => ({ enr: search(enrIdx, q, k).map((h) => h.id), plain: search(plainIdx, q, k).map((h) => h.id) });

type Run = { name: string; lists: string[][] };
const runs: Run[] = [];
runs.push({ name: "production: BM25 enriched ∪ plain (12+12)", lists: queries.map((q) => { const b = bm(q, 12); return dedupe([...b.enr, ...b.plain]); }) });
runs.push({ name: "BM25 hybrid, RRF top 17", lists: queries.map((q) => { const b = bm(q, 50); return rrf([b.enr, b.plain], N); }) });

const MODELS = ["bge-m3", "qwen3-embedding:0.6b"];
const denseLists: Record<string, string[][]> = {};
for (const model of MODELS) {
  const units = await unitVectors(model, true);
  const qv = await embed(model, items.map((c) => c.text));
  const qv2 = await embed(model, queries);
  denseLists[model] = qv.map((v, i) => dense(v.map((x, d) => x + qv2[i][d]) as Float32Array, units, 50));
  runs.push({ name: `semantic only (${model}), top 17`, lists: denseLists[model].map((l) => l.slice(0, N)) });
  runs.push({
    name: `hybrid: BM25 ×2 + semantic (${model}), RRF top 17`,
    lists: queries.map((q, i) => { const b = bm(q, 50); return rrf([b.enr, b.plain, denseLists[model][i]], N); }),
  });
  runs.push({
    name: `production ∪ semantic top 5 (${model})`,
    lists: queries.map((q, i) => { const b = bm(q, 12); return dedupe([...b.enr, ...b.plain, ...denseLists[model][i].slice(0, 5)]); }),
  });
}
// Pools for the reranker (written for tools/eval/rerank.py): top 50 of the best hybrid.
const best = MODELS[0];
writeFileSync(`${LAB}/rerank-pool.json`, JSON.stringify(items.map((c, i) => {
  const b = bm(queries[i], 50);
  const pool = rrf([b.enr, b.plain, denseLists[best][i]], 50);
  return { clause: c.text, units: c.units, pool: pool.map((id) => ({ id, text: corpus.byId.get(id)!.text.slice(0, 1500) })) };
})));

// ── scoring ───────────────────────────────────────────────────────────────────────────────
const report = runs.map((r) => {
  let hit = 0, mrr = 0, size = 0;
  const missed: string[] = [];
  r.lists.forEach((l, i) => {
    size += l.length;
    const rank = l.findIndex((id) => items[i].units.includes(id));
    if (rank >= 0) { hit++; mrr += 1 / (rank + 1); } else missed.push(`${items[i].contract}`);
  });
  return { name: r.name, recall: hit / items.length, mrr: mrr / items.length, avgCandidates: size / items.length, missed };
});
writeFileSync(`${LAB}/report.json`, JSON.stringify({ n: items.length, at: new Date().toISOString(), report }, null, 2));
for (const r of report)
  console.log(`${(r.recall * 100).toFixed(1).padStart(5)}%  MRR ${r.mrr.toFixed(3)}  avg ${r.avgCandidates.toFixed(1)}  ${r.name}  missed: ${r.missed.join(",")}`);
