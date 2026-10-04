// A wiring trial of the engine on a local model (any OpenAI-compatible server, e.g. Ollama):
// the same production steps for one or more demonstration clauses, with timeouts long enough for a
// laptop. It checks that the pipeline and the code gate run on a model the bank could host; it is
// not a quality measurement.
// Usage: MIZAN_LLM_BASE_URL=http://localhost:11434/v1 MIZAN_LLM_MODEL=qwen3.8:27b npx tsx tools/local-model-trial.ts 5 1 10
import { makeOpenAiCompatibleLlm } from "../src/server/engine/llm-openai";
import type { LlmCall } from "../src/server/engine/llm";
import { loadCorpus } from "../src/server/engine/corpus";
import { buildIndex, search } from "../src/server/engine/bm25";
import { buildQuery } from "../src/server/engine/query";
import { judgeClause } from "../src/server/engine/judge";
import { verifyJudgement } from "../src/server/engine/verify";
import { DEMO_CONTRACT } from "../src/content/contract";

const base = makeOpenAiCompatibleLlm({ baseUrl: process.env.MIZAN_LLM_BASE_URL ?? "http://localhost:11434/v1", model: process.env.MIZAN_LLM_MODEL ?? "qwen3.8:27b" });
const llm: LlmCall = (a) => base({ ...a, timeoutMs: 900_000 });
const corpus = loadCorpus();
const enriched = buildIndex(corpus, { enriched: true });
const plain = buildIndex(corpus, { enriched: false, excludeApproval: true });
const ns = process.argv.slice(2).map(Number).filter(Boolean);
for (const n of ns.length ? ns : [5]) {
  const c = DEMO_CONTRACT.clauses.find((x) => x.n === n)!;
  const t0 = Date.now();
  const query = await buildQuery(llm, c.text.ar);
  const candidates = [...new Set([...search(enriched, query, 12), ...search(plain, query, 12)].map((h) => h.id))];
  const j = await judgeClause(llm, corpus, c.text.ar, candidates);
  const secs = Math.round((Date.now() - t0) / 1000);
  if (!j.ok) {
    console.log(JSON.stringify({ n, expected: c.verdict, ok: false, reason: j.reason, detail: j.detail.slice(0, 200), secs }));
    continue;
  }
  const v = verifyJudgement(corpus, n, c.text.ar, candidates, j.value);
  const dropped = j.value.citations.filter((x) => !v.result.citations.includes(x.id)).map((x) => x.id);
  console.log(JSON.stringify({ n, expected: c.verdict, model: j.value.verdict, afterGate: v.result.verdict, citations: v.result.citations, droppedByGate: dropped, verbatim: v.verbatim, secs }));
}
