import { test } from "node:test";
import assert from "node:assert/strict";
import trace from "../../content/how-trace.json";
import { loadCorpus } from "./corpus";
import { verifyJudgement } from "./verify";
import { normalize } from "./normalize";
import { redact } from "@/lib/redact";
import type { Judgement } from "./schemas";

// /how shows a recorded run. These tests hold every derived field of that record to today's code,
// so the walkthrough can never drift from what the engine really does.
const corpus = loadCorpus();
const judgement = trace.replay.judgement as Judgement;

test("how-trace: the gate's verdict and citations are what verifyJudgement returns", () => {
  const r = verifyJudgement(corpus, trace.clauseN, trace.clause, trace.replay.candidates, judgement);
  assert.equal(r.result.verdict, trace.gate.verdict);
  assert.deepEqual(r.result.citations, trace.gate.citations);
  assert.equal(r.verbatim, trace.gate.verbatim);
});

test("how-trace: a quote that is not in the decision is dropped, and the verdict falls back", () => {
  const tampered = {
    ...judgement,
    citations: judgement.citations.map((c) => (c.id === trace.tamper.governing ? { ...c, quote: trace.tamper.fakeQuote } : c)),
  };
  const r = verifyJudgement(corpus, trace.clauseN, trace.clause, trace.replay.candidates, tampered);
  assert.equal(r.result.verdict, trace.tamper.verdict);
  assert.deepEqual(r.result.citations, trace.tamper.citations);
  assert.equal(r.verbatim, trace.tamper.verbatim);
  assert.ok(!normalize(corpus.byId.get(trace.tamper.governing)!.text).includes(normalize(trace.tamper.fakeQuote)));
});

test("how-trace: every quoted span is literal in its unit, and the masking example is redact()'s output", () => {
  for (const c of trace.judge.citations) assert.ok(normalize(corpus.byId.get(c.id)!.text).includes(normalize(c.quote)), c.id);
  assert.equal(redact(trace.mask.before).text, trace.mask.after);
  assert.equal(corpus.units.length, trace.retrieval.corpusUnits);
});

test("how-sort: the recorded sorting run keeps every clause of the contract and sets aside only its header", async () => {
  const sorted = (await import("../../content/how-sort.json")).default;
  const { obviousOther } = await import("./structure");
  const { DEMO_CONTRACT } = await import("../../content/contract");
  const clauses = sorted.segments.slice(sorted.headerLines);
  assert.deepEqual(clauses.map((x) => x.text), DEMO_CONTRACT.clauses.map((c) => c.text.ar));
  assert.ok(clauses.every((x) => x.kind === "clause"));
  assert.ok(sorted.segments.slice(0, sorted.headerLines).every((x) => x.kind === "other"));
  assert.ok(obviousOther(sorted.segments[2].text), "the separator needs no model");
});
