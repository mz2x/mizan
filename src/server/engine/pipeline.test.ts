import { test } from "node:test";
import assert from "node:assert/strict";
import { reviewDocument } from "./pipeline";
import type { ReviewEvent } from "@/lib/review-types";

const U = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
// Fake LLM: split returns the lines; query returns no terms; judge cites ق7 for clause containing "نقدا", else abstains; "429" clause errors.
const llm = (async ({ user }: { user: string }) => {
  if (user.startsWith("<document>")) return { ok: true, value: { clauses: user.replace(/<\/?document>/g, "").trim().split("\n") }, usage: U };
  if (user.startsWith("<clause>")) return { ok: true, value: { terms: [], product: null }, usage: U };
  if (user.includes("429")) return { ok: false, reason: "api_error", detail: "429" };
  if (user.includes("نقدا")) return { ok: true, usage: U, value: { verdict: "nonCompliant", scope_applies: true, reason_ar: "س", reason_en: "r", suggestion_ar: null, suggestion_en: null,
    citations: [{ id: "الإنماء/ق7/ثالثاً/2", quote: "لأن ذلك من بيوع العينة", role: "governs" }] } };
  return { ok: true, usage: U, value: { verdict: "abstain", citations: [], scope_applies: false, reason_ar: "لا", reason_en: "no", suggestion_ar: null, suggestion_en: null } };
}) as never;

async function collect(text: string, maxClauses?: number) {
  const out: ReviewEvent[] = [];
  for await (const e of reviewDocument({ text, llm, k: 12, maxClauses })) out.push(e);
  return out;
}

test("streams clause events, then results, then done", async () => {
  const ev = await collect("يشتري المصرف السلعة من العميل نقدا ثم يبيعها عليه بالأجل\nيحق للعميل السداد بالعملات الرقمية");
  assert.equal(ev.filter((e) => e.type === "clause").length, 2);
  // Every clause event must precede the first result event.
  const lastClauseIdx = ev.map((e) => e.type).lastIndexOf("clause");
  const firstResultIdx = ev.findIndex((e) => e.type === "result");
  assert.ok(lastClauseIdx < firstResultIdx, "all clause events must come before the first result event");
  const results = ev.filter((e) => e.type === "result").map((e) => (e as Extract<ReviewEvent, { type: "result" }>).result);
  assert.equal(results.length, 2);
  // The real BM25 index surfaces ق7/ثالثاً/2 for this clause (confirmed directly), so the judge's
  // nonCompliant verdict with its governing citation must survive verification unchanged.
  const nonCompliant = results.find((r) => r.text.ar.includes("نقدا"))!;
  assert.equal(nonCompliant.verdict, "nonCompliant");
  assert.ok(nonCompliant.citations.includes("الإنماء/ق7/ثالثاً/2"));
  assert.equal(ev.at(-1)!.type, "done");
});

test("Review Focus 4: one failing clause becomes review+error, others finish", async () => {
  const ev = await collect("بند 429 عن سداد الأقساط\nبند آخر عن سداد الأقساط");
  const r = ev.filter((e) => e.type === "result").map((e) => (e as Extract<ReviewEvent, { type: "result" }>).result);
  const failed = r.find((x) => x.text.ar.includes("429"))!;
  assert.equal(failed.verdict, "review");
  assert.equal(failed.flags![0].kind, "error");
  assert.equal(r.length, 2);
});

test("Review Focus 3: empty document yields a single error event", async () => {
  const ev = await collect("   ");
  assert.deepEqual(ev.map((e) => e.type), ["error", "done"]);
});

test("empty document makes zero llm calls", async () => {
  let calls = 0;
  const countingLlm = (async () => {
    calls++;
    return { ok: true, value: {}, usage: U };
  }) as never;
  const out: ReviewEvent[] = [];
  for await (const e of reviewDocument({ text: "   ", llm: countingLlm, k: 12 })) out.push(e);
  assert.deepEqual(out.map((e) => e.type), ["error", "done"]);
  assert.equal(calls, 0);
});

test("a clause whose llm call throws becomes review+error, the other clause still finishes, done is last", async () => {
  const doc = "بند THROW_MARKER_7f3 عن سداد الأقساط\nبند آخر عن سداد الأقساط";
  const llmThrowing = (async ({ user }: { user: string }) => {
    if (user.startsWith("<document>")) return { ok: true, value: { clauses: user.replace(/<\/?document>/g, "").trim().split("\n") }, usage: U };
    if (user.startsWith("<clause>")) return { ok: true, value: { terms: [], product: null }, usage: U };
    if (user.includes("THROW_MARKER_7f3")) throw new Error("boom");
    return { ok: true, usage: U, value: { verdict: "abstain", citations: [], scope_applies: false, reason_ar: "لا", reason_en: "no", suggestion_ar: null, suggestion_en: null } };
  }) as never;
  const out: ReviewEvent[] = [];
  for await (const e of reviewDocument({ text: doc, llm: llmThrowing, k: 12 })) out.push(e);
  const results = out.filter((e) => e.type === "result").map((e) => (e as Extract<ReviewEvent, { type: "result" }>).result);
  assert.equal(results.length, 2);
  const thrown = results.find((r) => r.text.ar.includes("THROW_MARKER_7f3"))!;
  assert.equal(thrown.verdict, "review");
  assert.equal(thrown.flags![0].kind, "error");
  assert.equal(out.at(-1)!.type, "done");
});

test("Review Focus 3: long document is capped with a notice", async () => {
  const ev = await collect(Array.from({ length: 50 }, (_, i) => `بند رقم ${i} عن السداد`).join("\n"), 40);
  assert.equal(ev.filter((e) => e.type === "clause").length, 40);
  assert.ok(ev.some((e) => e.type === "notice"));
});

test("final fix wave: a failed split call falls back with the model-failed notice", async () => {
  // Was "carried ruling: usedFallback notice …" expecting the paraphrase wording for every fallback;
  // the notice is now worded by its cause, and a failed call is not a paraphrase.
  const doc = "يلتزم العميل بسداد الأقساط في مواعيدها المحددة\nيتعهد المصرف بتسليم السلعة للعميل في موعدها";
  const failingSplit = (async ({ user }: { user: string }) => {
    if (user.startsWith("<document>")) return { ok: false, reason: "api_error", detail: "x" };
    if (user.startsWith("<clause>")) return { ok: true, value: { terms: [], product: null }, usage: U };
    return { ok: true, usage: U, value: { verdict: "abstain", citations: [], scope_applies: false, reason_ar: "لا", reason_en: "no", suggestion_ar: null, suggestion_en: null } };
  }) as never;
  const out: ReviewEvent[] = [];
  for await (const e of reviewDocument({ text: doc, llm: failingSplit, k: 12 })) out.push(e);
  const notice = out.find((e) => e.type === "notice") as Extract<ReviewEvent, { type: "notice" }> | undefined;
  assert.ok(notice, "expected a notice event");
  assert.equal(notice!.message.ar, "تعذّر التقطيع الآلي فاستُخدم التقطيع حسب الترقيم والعناوين.");
  assert.equal(notice!.message.en, "Automatic splitting failed, so the split by numbering and headings was used.");
  // The notice must precede the clause events.
  assert.equal(out[0].type, "notice");
  assert.equal(out.filter((e) => e.type === "clause").length, 2);
});

test("carried ruling: a paraphrased split falls back with the verbatim notice", async () => {
  const doc = "يلتزم العميل بسداد الأقساط في مواعيدها المحددة\nيتعهد المصرف بتسليم السلعة للعميل في موعدها";
  const paraphrasing = (async ({ user }: { user: string }) => {
    if (user.startsWith("<document>")) return { ok: true, value: { clauses: ["يدفع الزبون الأقساط في وقتها", "يسلّم البنك البضاعة"] }, usage: U };
    if (user.startsWith("<clause>")) return { ok: true, value: { terms: [], product: null }, usage: U };
    return { ok: true, usage: U, value: { verdict: "abstain", citations: [], scope_applies: false, reason_ar: "لا", reason_en: "no", suggestion_ar: null, suggestion_en: null } };
  }) as never;
  const out: ReviewEvent[] = [];
  for await (const e of reviewDocument({ text: doc, llm: paraphrasing, k: 12 })) out.push(e);
  const notice = out.find((e) => e.type === "notice") as Extract<ReviewEvent, { type: "notice" }> | undefined;
  assert.ok(notice, "expected a notice event");
  assert.equal(notice!.message.ar, "تعذّر نسخ بعض البنود حرفيًا من الوثيقة، فاستُخدم التقطيع الآلي حسب الترقيم والفقرات.");
  assert.equal(
    notice!.message.en,
    "Some clauses could not be copied verbatim from the document, so the rule-based split by numbering and paragraphs was used.",
  );
  assert.equal(out[0].type, "notice");
});

test("carried ruling: dropped notice when a split clause doesn't match the document verbatim", async () => {
  // Final fix wave: the document no longer starts its lines with «البند الأول…» (now a structure
  // marker, which would skip the model split), and has four real clauses so one invented clause
  // stays within the 30% drop tolerance instead of forcing the fallback.
  const doc = "يلتزم العميل بالسداد النقدي للأقساط\nيلتزم المصرف بتسليم السلعة في الأجل\nيلتزم الطرفان بتوثيق العقد رسميًا\nيلتزم العميل بالتأمين على السلعة";
  const llmInvented = (async ({ user }: { user: string }) => {
    if (user.startsWith("<document>"))
      return { ok: true, value: { clauses: [...doc.split("\n"), "بند غير موجود في الوثيقة أصلاً"] }, usage: U };
    if (user.startsWith("<clause>")) return { ok: true, value: { terms: [], product: null }, usage: U };
    return { ok: true, usage: U, value: { verdict: "abstain", citations: [], scope_applies: false, reason_ar: "لا", reason_en: "no", suggestion_ar: null, suggestion_en: null } };
  }) as never;
  const out: ReviewEvent[] = [];
  for await (const e of reviewDocument({ text: doc, llm: llmInvented, k: 12 })) out.push(e);
  const notice = out.find((e) => e.type === "notice") as Extract<ReviewEvent, { type: "notice" }> | undefined;
  assert.ok(notice, "expected a notice event");
  // Singular wording for exactly one dropped clause.
  assert.equal(notice!.message.ar, "استُبعد بند واحد لم يطابق نص الوثيقة حرفيًا.");
  assert.equal(notice!.message.en, "1 clause was excluded because it did not match the document text verbatim.");
  assert.equal(out.filter((e) => e.type === "clause").length, 4);
});

test("final fix wave: the realistic «المادة» contract with a verbatim model split gives 10 clauses and no split notice", async () => {
  const { ARTICLE_BODIES, REALISTIC_CONTRACT } = await import("./test-fixtures");
  const verbatim = (async ({ user }: { user: string }) => {
    if (user.startsWith("<document>")) return { ok: true, value: { clauses: ARTICLE_BODIES }, usage: U };
    if (user.startsWith("<clause>")) return { ok: true, value: { terms: [], product: null }, usage: U };
    return { ok: true, usage: U, value: { verdict: "abstain", citations: [], scope_applies: false, reason_ar: "لا", reason_en: "no", suggestion_ar: null, suggestion_en: null } };
  }) as never;
  const out: ReviewEvent[] = [];
  for await (const e of reviewDocument({ text: REALISTIC_CONTRACT, llm: verbatim, k: 12, structure: false })) out.push(e);
  // The only notice is the names warning: the fixture names «السيد عبدالله بن محمد» as a party.
  const notices = out.filter((e) => e.type === "notice").map((e) => (e.type === "notice" ? e.message.ar : ""));
  assert.deepEqual(notices.map((m) => m.includes("أسماء")), [true]);
  assert.equal(out.filter((e) => e.type === "clause").length, 10);
  assert.equal(out.at(-1)!.type, "done");
});

test("concurrency bound: at most `concurrency` clauses are judged at once", async () => {
  let active = 0;
  let maxActive = 0;
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const boundedLlm = (async ({ user }: { user: string }) => {
    if (user.startsWith("<document>")) return { ok: true, value: { clauses: user.replace(/<\/?document>/g, "").trim().split("\n") }, usage: U };
    if (user.startsWith("<clause>")) return { ok: true, value: { terms: [], product: null }, usage: U };
    // This is the judge call (<candidates>...<clause>...): track concurrency around it.
    active++;
    maxActive = Math.max(maxActive, active);
    await sleep(10);
    active--;
    return { ok: true, usage: U, value: { verdict: "abstain", citations: [], scope_applies: false, reason_ar: "لا", reason_en: "no", suggestion_ar: null, suggestion_en: null } };
  }) as never;
  const doc = Array.from({ length: 8 }, (_, i) => `بند رقم ${i} عن السداد`).join("\n");
  const out: ReviewEvent[] = [];
  for await (const e of reviewDocument({ text: doc, llm: boundedLlm, k: 12, concurrency: 2 })) out.push(e);
  assert.equal(out.filter((e) => e.type === "result").length, 8);
  assert.ok(maxActive <= 2, `expected at most 2 concurrent judge calls, saw ${maxActive}`);
});

test("onUsage totals equal the count of successful llm calls", async () => {
  let totalInput = 0;
  const usage = { input: 1, output: 0, cacheRead: 0, cacheWrite: 0 };
  const doc = "بند رقم 0 عن السداد\nبند رقم 1 عن السداد";
  const fakeLlm = (async ({ user }: { user: string }) => {
    if (user.startsWith("<document>")) return { ok: true, value: { clauses: user.replace(/<\/?document>/g, "").trim().split("\n") }, usage };
    if (user.startsWith("<clause>")) return { ok: true, value: { terms: [], product: null }, usage };
    return { ok: true, usage, value: { verdict: "abstain", citations: [], scope_applies: false, reason_ar: "لا", reason_en: "no", suggestion_ar: null, suggestion_en: null } };
  }) as never;
  const out: ReviewEvent[] = [];
  for await (const e of reviewDocument({ text: doc, llm: fakeLlm, k: 12, structure: false, onUsage: (u) => { totalInput += u.input; } })) out.push(e);
  // 1 split call + 2 query calls (one per clause) + 2 judge calls (one per clause) = 5 successful
  // llm calls, each contributing usage.input === 1.
  assert.equal(totalInput, 5);
});

test("abort: no further result events arrive once the signal is aborted", async () => {
  const doc = "بند أول عن السداد\nبند ثان عن السداد";
  const controller = new AbortController();
  const out: ReviewEvent[] = [];
  for await (const e of reviewDocument({ text: doc, llm, k: 12, signal: controller.signal })) {
    out.push(e);
    if (e.type === "result") controller.abort();
  }
  assert.equal(out.filter((e) => e.type === "result").length, 1);
});

test("fix round 1: presplit skips splitClauses (never calls its llm) and yields one clause event per item", async () => {
  let splitCalls = 0;
  const countingLlm = (async ({ user }: { user: string }) => {
    if (user.startsWith("<document>")) { splitCalls++; return { ok: true, value: { clauses: ["should never be used"] }, usage: U }; }
    if (user.startsWith("<clause>")) return { ok: true, value: { terms: [], product: null }, usage: U };
    return { ok: true, usage: U, value: { verdict: "abstain", citations: [], scope_applies: false, reason_ar: "لا", reason_en: "no", suggestion_ar: null, suggestion_en: null } };
  }) as never;
  const presplit = ["بند أول عن السداد", "بند ثان عن السداد"];
  const out: ReviewEvent[] = [];
  for await (const e of reviewDocument({ text: "نص لن يُستخدم أصلاً", llm: countingLlm, k: 12, presplit })) out.push(e);
  assert.equal(splitCalls, 0, "splitClauses' llm call must never fire when presplit is given");
  const clauseEvents = out.filter((e) => e.type === "clause") as Extract<ReviewEvent, { type: "clause" }>[];
  assert.equal(clauseEvents.length, presplit.length, "one clause event per presplit item");
  assert.deepEqual(clauseEvents.map((e) => e.text.ar), presplit);
  assert.equal(out.filter((e) => e.type === "result").length, presplit.length);
  assert.equal(out.at(-1)!.type, "done");
});

test("fix round 1: onCandidates fires once per clause with the exact ids the judge received", async () => {
  const calls: { n: number; ids: string[] }[] = [];
  const judgeIdsByCall: string[][] = [];
  const fakeLlm = (async ({ user }: { user: string }) => {
    if (user.startsWith("<document>")) return { ok: true, value: { clauses: user.replace(/<\/?document>/g, "").trim().split("\n") }, usage: U };
    if (user.startsWith("<clause>")) return { ok: true, value: { terms: [], product: null }, usage: U };
    // Judge call: pull the candidate ids straight out of the <candidates> block it was given.
    judgeIdsByCall.push([...user.matchAll(/<unit id="([^"]+)"/g)].map((m) => m[1]));
    return { ok: true, usage: U, value: { verdict: "abstain", citations: [], scope_applies: false, reason_ar: "لا", reason_en: "no", suggestion_ar: null, suggestion_en: null } };
  }) as never;
  const doc = "يشتري المصرف السلعة من العميل نقدا ثم يبيعها عليه بالأجل\nبند آخر عن سداد الأقساط";
  const out: ReviewEvent[] = [];
  // concurrency: 1 so clauses are judged strictly in order, making onCandidates calls and judge
  // calls line up 1:1 by position for this assertion.
  for await (const e of reviewDocument({ text: doc, llm: fakeLlm, k: 12, structure: false, concurrency: 1, onCandidates: (n, ids) => calls.push({ n, ids }) })) out.push(e);
  assert.equal(calls.length, 2, "onCandidates must fire exactly once per clause");
  assert.deepEqual(calls.map((c) => c.n), [1, 2]);
  assert.equal(judgeIdsByCall.length, 2);
  for (const c of calls) {
    assert.deepEqual(c.ids, judgeIdsByCall[c.n - 1], `clause ${c.n}: onCandidates ids must equal the ids the judge received`);
  }
});

test("a result citing ق7 carries the cited unit's corpus text and provenance", async () => {
  const { loadCorpus } = await import("./corpus");
  const corpus = loadCorpus();
  const id = "الإنماء/ق7/ثالثاً/2";
  const ev = await collect("يشتري المصرف السلعة من العميل نقدا ثم يبيعها عليه بالأجل");
  const r = ev.filter((e) => e.type === "result").map((e) => (e as Extract<ReviewEvent, { type: "result" }>).result)[0];
  assert.ok(r.citations.includes(id));
  const unit = r.units?.[id];
  assert.ok(unit, "every cited id must have its unit attached");
  assert.equal(unit.text, corpus.byId.get(id)!.text);
  assert.equal(unit.decisionNo, 7);
  assert.equal(unit.dateHijri, corpus.decisions.get(7)!.date_hijri);
  assert.equal(unit.session, "الأولى");
  for (const c of r.citations) assert.ok(r.units![c], `missing unit for ${c}`);
});

// Task 12: hybrid retrieval (enriched BM25 top-k ∪ plain BM25 top-k). Query terms are empty for
// every call below (the fake llm's <clause> branch), so buildQuery falls back to the clause text
// itself as the query — matching the controller's probe methodology.
const abstainLlm = (async ({ user }: { user: string }) => {
  if (user.startsWith("<clause>")) return { ok: true, value: { terms: [], product: null }, usage: U };
  return { ok: true, usage: U, value: { verdict: "abstain", citations: [], scope_applies: false, reason_ar: "لا", reason_en: "no", suggestion_ar: null, suggestion_en: null } };
}) as never;

async function candidatesFor(corpus: unknown, clause: string, enriched?: boolean): Promise<string[]> {
  let ids: string[] = [];
  const events: ReviewEvent[] = [];
  for await (const e of reviewDocument({
    text: "unused: presplit skips it",
    llm: abstainLlm,
    corpus: corpus as Parameters<typeof reviewDocument>[0]["corpus"],
    k: 12,
    enriched,
    presplit: [clause],
    onCandidates: (_n, candidateIds) => { ids = candidateIds; },
  })) events.push(e);
  assert.equal(events.at(-1)!.type, "done", "the generator must still run to completion");
  return ids;
}

test("hybrid retrieval (a): union recall — plain finds a target id enriched@12 alone misses", async () => {
  const { loadCorpus } = await import("./corpus");
  const corpus = loadCorpus();
  const clause = "يبيع المصرف السلعة على العميل فور توقيع طلب الشراء، ويتولى المورد تسليمها للعميل لاحقًا.";
  const targets = ["الإنماء/ق7/ثالثاً/4", "الإنماء/ق32/رابعاً/2"];
  const ids = await candidatesFor(corpus, clause);
  assert.ok(
    targets.some((t) => ids.includes(t)),
    `expected the merged candidates to include one of ${targets.join(" or ")}, got ${JSON.stringify(ids)}`,
  );
});

test("hybrid retrieval (b): merged candidates have no duplicates and length <= 2k", async () => {
  const { loadCorpus } = await import("./corpus");
  const corpus = loadCorpus();
  const clause = "يبيع المصرف السلعة على العميل فور توقيع طلب الشراء، ويتولى المورد تسليمها للعميل لاحقًا.";
  const ids = await candidatesFor(corpus, clause);
  assert.equal(new Set(ids).size, ids.length, "merged candidates must not contain duplicates");
  assert.ok(ids.length <= 24, `expected at most 2k=24 candidates, got ${ids.length}`);
});

test("hybrid retrieval (c): enriched:false yields exactly the plain top-k, unchanged", async () => {
  const { loadCorpus } = await import("./corpus");
  const { buildIndex, search } = await import("./bm25");
  const corpus = loadCorpus();
  const clause = "يشتري المصرف السلعة من العميل نقدا ثم يبيعها عليه بالأجل";
  const plainIndex = buildIndex(corpus, { enriched: false });
  const expected = search(plainIndex, clause, 12).map((h) => h.id);
  const ids = await candidatesFor(corpus, clause, false);
  assert.deepEqual(ids, expected);
  assert.ok(ids.length <= 12);
});

// Final fix wave, item 1: every clause is bounded by a deadline, and every llm call carries a
// signal and (for the judge) its own longer timeout.
const judgeAbstain = { verdict: "abstain", citations: [], scope_applies: false, reason_ar: "لا", reason_en: "no", suggestion_ar: null, suggestion_en: null };

test("a clause whose judge call never resolves is escalated by the clause deadline; the others finish", async () => {
  const hanging = (async ({ user }: { user: string }) => {
    if (user.startsWith("<clause>")) return { ok: true, value: { terms: [], product: null }, usage: U };
    if (user.includes("HANG_MARKER")) return new Promise(() => {}); // never settles
    return { ok: true, usage: U, value: judgeAbstain };
  }) as never;
  const out: ReviewEvent[] = [];
  const t0 = Date.now();
  for await (const e of reviewDocument({
    text: "unused", llm: hanging, k: 12, clauseTimeoutMs: 60,
    presplit: ["بند HANG_MARKER عن سداد الأقساط", "بند آخر عن سداد الأقساط"],
  })) out.push(e);
  assert.ok(Date.now() - t0 < 2000, "the deadline must end the run, not the hung call");
  const results = out.filter((e) => e.type === "result").map((e) => (e as Extract<ReviewEvent, { type: "result" }>).result);
  assert.equal(results.length, 2);
  const hung = results.find((r) => r.text.ar.includes("HANG_MARKER"))!;
  assert.equal(hung.verdict, "review");
  assert.deepEqual(hung.flags, [{ kind: "error", detail: "timeout" }]);
  assert.equal(out.at(-1)!.type, "done");
});

test("the judge call gets a 90 s timeout, split gets 45 s, query uses the default; every call carries a signal", async () => {
  const seen: { kind: string; timeoutMs?: number; signal?: AbortSignal }[] = [];
  const recording = (async ({ user, timeoutMs, signal }: { user: string; timeoutMs?: number; signal?: AbortSignal }) => {
    const kind = user.startsWith("<document>") ? "split" : user.startsWith("<clause>") ? "query" : "judge";
    seen.push({ kind, timeoutMs, signal });
    if (kind === "split") return { ok: true, value: { clauses: user.replace(/<\/?document>/g, "").trim().split("\n") }, usage: U };
    if (kind === "query") return { ok: true, value: { terms: [], product: null }, usage: U };
    return { ok: true, usage: U, value: judgeAbstain };
  }) as never;
  const controller = new AbortController();
  for await (const _ of reviewDocument({ text: "يلتزم العميل بسداد الأقساط في مواعيدها", llm: recording, k: 12, signal: controller.signal })) void _;
  assert.deepEqual(seen.map((s) => s.kind), ["split", "query", "judge"]);
  assert.equal(seen.find((s) => s.kind === "split")!.timeoutMs, 45_000);
  assert.equal(seen.find((s) => s.kind === "query")!.timeoutMs, undefined);
  assert.equal(seen.find((s) => s.kind === "judge")!.timeoutMs, 90_000);
  for (const s of seen) assert.ok(s.signal instanceof AbortSignal, `${s.kind} call has no signal`);
  // The pipeline's signal reaches every call: aborting it aborts each call's signal.
  controller.abort();
  for (const s of seen) assert.equal(s.signal!.aborted, true, `${s.kind} call's signal is not tied to the pipeline signal`);
});

test("final fix wave, item 4: no approval_only id appears in the hybrid candidates for the 10 demo clauses", async () => {
  const { loadCorpus } = await import("./corpus");
  const { DEMO_CONTRACT } = await import("@/content/contract");
  const corpus = loadCorpus();
  const approval = new Set([...corpus.enrichment.values()].filter((e) => e.kind === "approval_only").map((e) => e.id));
  assert.ok(approval.size > 0, "fixture sanity: the enrichment has approval_only units");
  for (const c of DEMO_CONTRACT.clauses) {
    const ids = await candidatesFor(corpus, c.text.ar);
    const leaked = ids.filter((id) => approval.has(id));
    assert.deepEqual(leaked, [], `clause ${c.n}: approval_only ids in the hybrid candidates`);
  }
});

test("final fix wave, item 5: onQuery fires once per clause with the exact query the candidates came from", async () => {
  const { loadCorpus } = await import("./corpus");
  const { buildIndex, search } = await import("./bm25");
  const corpus = loadCorpus();
  const termsLlm = (async ({ user }: { user: string }) => {
    if (user.startsWith("<clause>")) return { ok: true, value: { terms: ["بيع العينة", "التورق"], product: "مرابحة" }, usage: U };
    return { ok: true, usage: U, value: { verdict: "abstain", citations: [], scope_applies: false, reason_ar: "لا", reason_en: "no", suggestion_ar: null, suggestion_en: null } };
  }) as never;
  const queries: { n: number; q: string }[] = [];
  const cands: string[][] = [];
  const clause = "يشتري المصرف السلعة من العميل نقدا ثم يبيعها عليه بالأجل";
  for await (const _ of reviewDocument({
    text: "unused", llm: termsLlm, corpus, k: 12, enriched: false, presplit: [clause],
    onQuery: (n, q) => queries.push({ n, q }), onCandidates: (_n, ids) => cands.push(ids),
  })) void _;
  assert.equal(queries.length, 1);
  assert.equal(queries[0].n, 1);
  assert.ok(queries[0].q.includes("بيع العينة") && queries[0].q.includes(clause));
  assert.deepEqual(cands[0], search(buildIndex(corpus, { enriched: false }), queries[0].q, 12).map((h) => h.id));
});

test("final fix wave, item 8: requireEnrichment with no enrichment loaded is a loud error, with no llm call", async () => {
  const { loadCorpus } = await import("./corpus");
  const bare = { ...loadCorpus(), enrichment: new Map() };
  let calls = 0;
  const countingLlm = (async () => { calls++; return { ok: false, reason: "api_error", detail: "x" }; }) as never;
  const out: ReviewEvent[] = [];
  for await (const e of reviewDocument({ text: "يلتزم العميل بسداد الأقساط في مواعيدها", llm: countingLlm, corpus: bare, requireEnrichment: true })) out.push(e);
  assert.deepEqual(out, [
    { type: "error", message: { ar: "فهرس الإثراء غير موجود على الخادم.", en: "The enrichment index is missing on the server." } },
    { type: "done" },
  ]);
  assert.equal(calls, 0);
});

test("final fix wave: input over MAX_CHARS is truncated with a notice before anything else", async () => {
  let splitInput = "";
  const recording = (async ({ user }: { user: string }) => {
    if (user.startsWith("<document>")) {
      splitInput = user.replace(/<\/?document>/g, "").trim();
      return { ok: true, value: { clauses: [splitInput] }, usage: U };
    }
    if (user.startsWith("<clause>")) return { ok: true, value: { terms: [], product: null }, usage: U };
    return { ok: true, usage: U, value: { verdict: "abstain", citations: [], scope_applies: false, reason_ar: "لا", reason_en: "no", suggestion_ar: null, suggestion_en: null } };
  }) as never;
  const { MAX_CHARS } = await import("./pipeline");
  assert.equal(MAX_CHARS, 150_000);
  const text = "يلتزم العميل بسداد الأقساط في مواعيدها " + "ك".repeat(MAX_CHARS);
  const out: ReviewEvent[] = [];
  for await (const e of reviewDocument({ text, llm: recording, k: 12 })) out.push(e);
  assert.deepEqual(out[0], {
    type: "notice",
    message: { ar: "الوثيقة طويلة: فُحص أول ١٥٠ ألف حرف.", en: "Long document: the first 150,000 characters were reviewed." },
  });
  // Too long for the model split: the rule-based split reads only the kept part.
  assert.equal(splitInput, "");
  const clauseChars = out.filter((e) => e.type === "clause").reduce((n, e) => n + (e.type === "clause" ? e.text.ar.length : 0), 0);
  assert.ok(clauseChars <= MAX_CHARS);
  // A document within the limit gets no such notice.
  const short: ReviewEvent[] = [];
  for await (const e of reviewDocument({ text: "يلتزم العميل بسداد الأقساط في مواعيدها", llm: recording, k: 12 })) short.push(e);
  assert.equal(short.filter((e) => e.type === "notice").length, 0);
});

// Approved forms (2026-10-01): a regulator-unified contract the committee approved escalates an
// older-rule «مخالف» to review with a flag; a bank's own form only gets a notice.
const resultsOf = (ev: ReviewEvent[]) => ev.filter((e) => e.type === "result").map((e) => (e as Extract<ReviewEvent, { type: "result" }>).result);
const CLAUSE_7 = "يشتري المصرف السلعة من العميل نقدا ثم يبيعها عليه بالأجل";

test("a unified contract approved by 1083 escalates a «مخالف» resting on an older decision, with a notice and a flag", async () => {
  const ev = await collect(`عقد تمويل عقاري بصيغة المرابحة\n${CLAUSE_7}`);
  const notice = ev.find((e) => e.type === "notice");
  assert.ok(notice && notice.type === "notice" && notice.message.ar.includes("١٠٨٣") && notice.message.en.includes("1083"));
  const r = resultsOf(ev).find((x) => x.text.ar.includes("نقدا"))!;
  assert.equal(r.verdict, "review");
  assert.ok(r.citations.includes("الإنماء/ق7/ثالثاً/2"), "the evidence stays shown");
  assert.deepEqual(r.flags?.find((f) => f.kind === "approved_form"), { kind: "approved_form", detail: "1083" });
});

test("a bank's own approved form gets a notice only; the verdict stands", async () => {
  const ev = await collect(`عقد بيع سيارة بالتقسيط\n${CLAUSE_7}`);
  assert.ok(ev.some((e) => e.type === "notice" && e.message.ar.includes("٦١٢")));
  const r = resultsOf(ev).find((x) => x.text.ar.includes("نقدا"))!;
  assert.equal(r.verdict, "nonCompliant");
  assert.equal(r.flags?.some((f) => f.kind === "approved_form") ?? false, false);
});

// Privacy (2026-10-01): personal data is masked before any llm call, and the reader is told.
test("no llm call ever receives a national ID, IBAN or mobile number from the contract", async () => {
  const seen: string[] = [];
  const spy = (async (a: { user: string }) => { seen.push(a.user); return (llm as unknown as (x: { user: string }) => Promise<unknown>)(a); }) as never;
  const text = "يلتزم العميل صاحب الهوية 1023456789 بالسداد من حسابه SA0380000000608010167519\nيتواصل المصرف مع العميل على الجوال 0551234567";
  const out: ReviewEvent[] = [];
  for await (const e of reviewDocument({ text, llm: spy, k: 12 })) out.push(e);
  assert.ok(seen.length > 0);
  for (const u of seen) for (const raw of ["1023456789", "SA0380000000608010167519", "0551234567"]) assert.ok(!u.includes(raw), `llm saw ${raw}`);
  const n = out.find((e) => e.type === "notice" && e.message.ar.includes("أُخفيت"));
  assert.ok(n, "the reader is told that personal data was masked");
  const clauseTexts = out.filter((e) => e.type === "clause").map((e) => (e.type === "clause" ? e.text.ar : ""));
  assert.ok(clauseTexts.some((t) => t.includes("[هوية]")));
});

test("presplit clauses are masked too", async () => {
  const seen: string[] = [];
  const spy = (async (a: { user: string }) => { seen.push(a.user); return (llm as unknown as (x: { user: string }) => Promise<unknown>)(a); }) as never;
  for await (const _ of reviewDocument({ text: "", llm: spy, k: 12, presplit: ["يلتزم صاحب الهوية 1023456789 بالسداد"] })) void _;
  assert.ok(seen.every((u) => !u.includes("1023456789")));
});

// Privacy report requirement 8: a failure reaches the client as a category, never the provider's
// raw error text or the clause text.
test("a failed clause carries only an error category, not the provider's message", async () => {
  const leaky = (async ({ user }: { user: string }) => {
    if (user.startsWith("<document>")) return { ok: true, value: { clauses: user.replace(/<\/?document>/g, "").trim().split("\n") }, usage: U };
    if (user.startsWith("<clause>")) return { ok: true, value: { terms: [], product: null }, usage: U };
    return { ok: false, reason: "api_error", detail: "400 invalid_request: prompt contained «يلتزم العميل السري»" };
  }) as never;
  const out: ReviewEvent[] = [];
  for await (const e of reviewDocument({ text: "يلتزم العميل السري بسداد الأقساط في مواعيدها", llm: leaky, k: 12 })) out.push(e);
  const r = out.find((e) => e.type === "result");
  assert.ok(r && r.type === "result");
  assert.deepEqual(r.result.flags, [{ kind: "error", detail: "api_error" }]);
});

test("likely person names raise a notice, and nothing is masked for them", async () => {
  const out: ReviewEvent[] = [];
  for await (const e of reviewDocument({ text: "يلتزم العميل محمد بن عبدالله بسداد الأقساط في مواعيدها", llm, k: 12 })) out.push(e);
  assert.ok(out.some((e) => e.type === "notice" && e.message.ar.includes("أسماء")));
});
