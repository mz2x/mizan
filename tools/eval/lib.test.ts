import { test } from "node:test";
import assert from "node:assert/strict";
import { MIN_PUBLISHED_N, metrics, parseEvalSet, pct, ratio, renderMarkdown, type EvalOutput } from "./lib";

const ids = new Set(["الإنماء/ق7/ثالثاً/2", "الإنماء/ق15/أولاً"]);

test("expected_verdict is accepted as an alias of expected; governing_id and governing_ids both normalize", () => {
  const text = [
    JSON.stringify({ clause: "أ", expected_verdict: "nonCompliant", governing_id: "الإنماء/ق7/ثالثاً/2" }),
    JSON.stringify({ clause: "ب", expected: "abstain", governing_id: null }),
    JSON.stringify({ clause: "ج", expected: "compliant", governing_ids: ["الإنماء/ق15/أولاً"] }),
  ].join("\n");
  assert.deepEqual(parseEvalSet(text, ids), [
    { clause: "أ", expected: "nonCompliant", governing_ids: ["الإنماء/ق7/ثالثاً/2"] },
    { clause: "ب", expected: "abstain", governing_ids: [] },
    { clause: "ج", expected: "compliant", governing_ids: ["الإنماء/ق15/أولاً"] },
  ]);
});

test("validation fails loudly with line numbers: bad verdict, unknown governing id, bad JSON, missing clause", () => {
  const text = [
    JSON.stringify({ clause: "أ", expected: "nonCompliant", governing_id: "الإنماء/ق7/ثالثاً/2" }),
    JSON.stringify({ clause: "ب", expected: "violation", governing_id: null }),
    JSON.stringify({ clause: "ج", expected: "nonCompliant", governing_id: "الإنماء/ق999/أولاً" }),
    "{not json",
    JSON.stringify({ expected: "abstain" }),
  ].join("\n");
  assert.throws(
    () => parseEvalSet(text, ids),
    (e: Error) =>
      /line 2: .*verdict/.test(e.message) &&
      /line 3: .*الإنماء\/ق999\/أولاً/.test(e.message) &&
      /line 4: /.test(e.message) &&
      /line 5: .*clause/.test(e.message) &&
      !/line 1:/.test(e.message),
  );
});

test("ratio(x, 0) is null, and null renders as «—»", () => {
  assert.equal(ratio(0, 0), null);
  assert.equal(ratio(1, 4), 0.25);
  assert.equal(pct(null), "—");
  assert.equal(pct(0.25), "25%");
});

test("metrics: a system that never abstains has a null abstention, not 0", () => {
  const items = [
    { clause: "أ", expected: "nonCompliant" as const, governing_ids: ["الإنماء/ق7/ثالثاً/2"] },
    { clause: "ب", expected: "abstain" as const, governing_ids: [] },
  ];
  const m = metrics(items, [
    { verdict: "nonCompliant", citations: ["الإنماء/ق7/ثالثاً/2"] },
    { verdict: "review", citations: [] },
  ]);
  assert.deepEqual(m, { recall: 1, precision: 1, citation: 1, abstention: null });
});

test("markdown: retrieval@candidates column, enrichedOnly/plainOnly rows, «—» for nulls, abstention defined in the header", () => {
  const sys = (over: Partial<EvalOutput["systems"]["mizan"]>) => ({
    recall: null, precision: null, citation: null, abstention: null, retrievalAtCandidates: null, usd: null, ...over,
  });
  const out: EvalOutput = {
    date: "2026-10-01T00:00:00.000Z",
    n: 5,
    candidates: { mizan: "enriched@12 ∪ plain@12", ablation: "plain@24" },
    systems: {
      mizan: sys({ recall: 1, precision: 0.5, citation: 1, abstention: null, retrievalAtCandidates: 0.75, usd: 0.08 }),
      baseline: sys({ recall: 0.5, precision: 0.5, citation: 1, abstention: 0.5, usd: 0 }),
      ablation: sys({ recall: 1, precision: 1, citation: 1, abstention: 1, retrievalAtCandidates: 0.75, usd: 0.07 }),
      enrichedOnly: sys({ retrievalAtCandidates: 0.5 }),
      plainOnly: sys({ retrievalAtCandidates: 0.25 }),
    },
    stability: 0.8,
  };
  const md = renderMarkdown(out, "sample.jsonl");
  assert.ok(md.includes("| system | recall | precision | citation | abstention | retrieval@candidates | usd |"));
  assert.ok(!md.includes("retrieval@12 |"));
  assert.ok(md.includes("| mizan | 100% | 50% | 100% | — | 75% | 0.080 |"));
  assert.ok(md.includes("| enrichedOnly | — | — | — | — | 50% | — |"));
  assert.ok(md.includes("| plainOnly | — | — | — | — | 25% | — |"));
  assert.match(md, /abstention = .*abstain/i);
  assert.ok(md.indexOf("abstention =") < md.indexOf("| system |"), "the definition belongs in the header");
});

test("latest.json is published only from a real eval set (n >= 30)", () => {
  assert.equal(MIN_PUBLISHED_N, 30);
});
