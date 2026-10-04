import { test } from "node:test";
import assert from "node:assert/strict";
import { adjudicate, align, isCorrect, labelOf, parseCsv, seededSample, teamMetrics, toCsv, type Key, type Row } from "./team-lib";

const key = {
  labels: { ok: "مطابق", bad: "يُرجَّح عدم مطابقته", review: "يحتاج مراجعة بشرية", procedural: "إجرائي (خارج القياس)" },
  contracts: [],
  clauses: [],
} as Key;

test("labelOf maps the key's Arabic labels and rejects unknown ones", () => {
  assert.equal(labelOf(key, "يحتاج مراجعة بشرية"), "review");
  assert.throws(() => labelOf(key, "غير ذلك"));
});

test("«يحتاج مراجعة» accepts both of Mizan's withholding verdicts, nothing else", () => {
  assert.equal(isCorrect("review", "review"), true);
  assert.equal(isCorrect("review", "abstain"), true);
  assert.equal(isCorrect("review", "nonCompliant"), false);
  assert.equal(isCorrect("ok", "compliant"), true);
  assert.equal(isCorrect("bad", null), false);
});

test("teamMetrics: recall, precision, withholding, false alarm, citation, term gap", () => {
  const rows: Row[] = [
    { label: "bad", units: ["A"], termGap: true, pred: { verdict: "nonCompliant", citations: ["A"] } },
    { label: "bad", units: ["B"], termGap: false, pred: { verdict: "review", citations: ["X"] } },
    { label: "ok", units: ["C"], termGap: false, pred: { verdict: "nonCompliant", citations: ["C"] } },
    { label: "ok", units: ["D"], termGap: false, pred: { verdict: "compliant", citations: ["D"] } },
    { label: "review", units: [], termGap: false, pred: { verdict: "abstain", citations: [] } },
    { label: "review", units: [], termGap: false, pred: null },
  ];
  const m = teamMetrics(rows);
  assert.equal(m.n, 6);
  assert.equal(m.recall, 0.5);
  assert.equal(m.precision, 0.5);
  assert.equal(m.withholding, 0.5);
  assert.equal(m.compliantRecall, 0.5);
  assert.equal(m.falseAlarm, 0.5);
  assert.equal(m.citation, 3 / 4);
  assert.equal(m.agreement, 3 / 6);
  assert.equal(m.termGapRecall, 1);
});

test("align: exact containment ignores diacritics, punctuation and line breaks", () => {
  const engine = ["يلتزم العميل بسداد الأقساط.", "إذا تأخَّر المستفيد سبعة (7) أيام عمل، يُشعره الممول ثم يتخذ الإجراءات."];
  assert.deepEqual(align(engine, ["2-17 في حال", "اذا تاخر المستفيد\nسبعة 7 ايام عمل"]), [
    { index: -1, exact: false },
    { index: 1, exact: true },
  ]);
});

test("align: an anchor cut across two clauses goes to the one holding most of its tokens", () => {
  const engine = ["يتحمل الممول قيمة التأمين التعاوني على الأصل", "الممول كما يتحمل قيمة التأمين على مخاطر الوفاة"];
  const [a] = align(engine, ["يتحمل الممول قيمة التأمين التعاوني على الأصل الممول"]);
  assert.equal(a.index, 0);
  assert.equal(a.exact, false);
});

test("seededSample is deterministic and without repeats", () => {
  const xs = [1, 2, 3, 4, 5, 6, 7, 8];
  assert.deepEqual(seededSample(xs, 3, 7), seededSample(xs, 3, 7));
  assert.equal(new Set(seededSample(xs, 8, 7)).size, 8);
});

test("toCsv round-trips through parseCsv, with commas, quotes and newlines in Arabic cells", () => {
  const rows = [["البند", "النص"], ["1", 'يلتزم، "العميل"\nبالسداد']];
  assert.deepEqual(parseCsv(toCsv(rows)), rows);
});

test("adjudicate: «ميزان صح» relabels, «محل نظر» drops, blank keeps", () => {
  const rows = [
    { id: "a", label: "review" as const, units: [], termGap: false, pred: { verdict: "nonCompliant" as const, citations: [] } },
    { id: "b", label: "bad" as const, units: [], termGap: false, pred: { verdict: "review" as const, citations: [] } },
    { id: "c", label: "ok" as const, units: [], termGap: false, pred: { verdict: "compliant" as const, citations: [] } },
  ];
  const out = adjudicate(rows, new Map([["a", "ميزان صح"], ["b", "محل نظر"]]));
  assert.deepEqual(out.map((r) => r.label), ["bad", "ok"]);
});
