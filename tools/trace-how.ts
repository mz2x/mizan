// Records one real pass of the production engine over one demonstration clause, stage by stage,
// for the /how walkthrough: npm run trace:how. It writes src/content/how-trace.json. Everything in
// that file comes from this run of the real code (no hand edits), except the masking example, which
// is redact() applied to an illustrative line. The gate demo applies verifyJudgement to the judge's
// own judgement with its quote swapped for words that are not in the decision.
import { writeFileSync } from "node:fs";
import { loadDevEnv } from "../src/server/env";
import { makeLlm, MODEL, type Usage } from "../src/server/engine/llm";
import { loadCorpus } from "../src/server/engine/corpus";
import { buildIndex, search } from "../src/server/engine/bm25";
import { buildQuery } from "../src/server/engine/query";
import { judgeClause } from "../src/server/engine/judge";
import { verifyJudgement } from "../src/server/engine/verify";
import { normalize } from "../src/server/engine/normalize";
import { redact } from "../src/lib/redact";
import { DEMO_CONTRACT } from "../src/content/contract";

loadDevEnv();
const CLAUSE_N = 5;
const GOVERNING = "الإنماء/ق7/ثالثاً/2";
const FAKE_QUOTE = "يجوز للمصرف أن يشتري السلعة من العميل ثم يبيعها عليه بالأجل";

const usage: Usage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
const base = makeLlm();
const llm: typeof base = async (a) => {
  const r = await base(a);
  if (r.ok) for (const k in r.usage) usage[k as keyof Usage] += r.usage[k as keyof Usage];
  return r;
};

const t0 = Date.now();
const corpus = loadCorpus();
const clause = DEMO_CONTRACT.clauses.find((c) => c.n === CLAUSE_N)!.text.ar;

// 1. Masking: an illustrative line, through the same redact() the pipeline runs first.
const sample = "يلتزم العميل حامل الهوية رقم 1023456789 وجواله 0551234567 بسداد الأقساط إلى الآيبان SA4420000001234567891234.";
const masked = redact(sample);

// 2. Retrieval, both halves of the hybrid, and the keyword baseline on the clause's own words.
const plain = buildIndex(corpus, { enriched: false, excludeApproval: true });
const enrichedIdx = buildIndex(corpus, { enriched: true });
const plainBaseline = buildIndex(corpus, { enriched: false });
const keywordHits = search(plainBaseline, clause, 12).map((h) => h.id);
const termInClause = normalize(clause).includes("عينه") || normalize(clause).includes("عينة");
const query = await buildQuery(llm, clause);
const added = query.slice(clause.length).trim();
const enrichedHits = search(enrichedIdx, query, 12).map((h) => h.id);
const plainHits = search(plain, query, 12).map((h) => h.id);
const candidates = [...new Set([...enrichedHits, ...plainHits])];

// 3. Judge.
const j = await judgeClause(llm, corpus, clause, candidates);
if (!j.ok) throw new Error(`judge failed: ${j.reason}`);
const judged = j.value;

// 4. Gate, on the real judgement, then on the same judgement with a quote that is not in the decision.
const real = verifyJudgement(corpus, CLAUSE_N, clause, candidates, judged);
const tamperedJudgement = {
  ...judged,
  citations: judged.citations.map((c) => (c.id === GOVERNING ? { ...c, quote: FAKE_QUOTE } : c)),
};
const tampered = verifyJudgement(corpus, CLAUSE_N, clause, candidates, tamperedJudgement);

const unitText = (id: string) => corpus.byId.get(id)?.text ?? "";
const kind = (id: string) => corpus.enrichment.get(id)?.kind ?? null;
const cost = (usage.input * 2 + usage.cacheWrite * 2.5 + usage.cacheRead * 0.2 + usage.output * 10) / 1e6;

const out = {
  recordedAt: new Date().toISOString(),
  model: MODEL,
  seconds: Math.round((Date.now() - t0) / 100) / 10,
  usd: Math.round(cost * 10000) / 10000,
  clauseN: CLAUSE_N,
  clause,
  contractClauses: DEMO_CONTRACT.clauses.length,
  mask: { before: sample, after: masked.text, counts: Object.fromEntries(Object.entries(masked.counts).filter(([, n]) => n > 0)) },
  keyword: { termInClause, top: keywordHits.slice(0, 5), governingRank: keywordHits.indexOf(GOVERNING) + 1 || null },
  query: { added },
  retrieval: {
    candidates: candidates.length,
    top: candidates.slice(0, 6),
    governingRank: candidates.indexOf(GOVERNING) + 1 || null,
    corpusUnits: corpus.units.length,
  },
  judge: {
    verdict: judged.verdict,
    scopeApplies: judged.scope_applies,
    citations: judged.citations.map((c) => ({ id: c.id, role: c.role, quote: c.quote })),
    reason: judged.reason_ar,
  },
  gate: {
    checks: judged.citations.map((c) => ({
      id: c.id,
      inCandidates: candidates.includes(c.id),
      literal: normalize(unitText(c.id)).includes(normalize(c.quote)),
      kind: kind(c.id),
    })),
    verdict: real.result.verdict,
    citations: real.result.citations,
    verbatim: real.verbatim,
    marks: real.result.marks ?? {},
  },
  /** The full inputs of the gate, so a test can re-run verifyJudgement and hold this file to the code. */
  replay: { candidates, judgement: judged },
  tamper: {
    fakeQuote: FAKE_QUOTE,
    governing: GOVERNING,
    verdict: tampered.result.verdict,
    citations: tampered.result.citations,
    verbatim: tampered.verbatim,
  },
};
writeFileSync("src/content/how-trace.json", JSON.stringify(out, null, 2) + "\n");
console.log(JSON.stringify({ ...out, judge: { ...out.judge, reason: out.judge.reason.slice(0, 80) } }, null, 2));
