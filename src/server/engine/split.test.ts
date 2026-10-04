import { test } from "node:test";
import assert from "node:assert/strict";
import { fallbackSplit, splitClauses } from "./split";
import { loadCorpus } from "./corpus";
import { candidateBlock } from "./judge";
import { ARTICLE_BODIES, REALISTIC_CONTRACT, SIGNATURE_LINES } from "./test-fixtures";
import { DEMO_CONTRACT } from "@/content/contract";

const DOC = "1- يلتزم العميل بالشراء.\n2- يبيع المصرف السلعة بعد تملكها.\n\nأحكام عامة لا تهم.";
const llmReturning = (clauses: string[]) => (async () => ({ ok: true, value: { clauses }, usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 } })) as never;

test("keeps only clauses that exist verbatim in the document", async () => {
  const r = await splitClauses(llmReturning(["يلتزم العميل بالشراء.", "بند مؤلف لا وجود له"]), DOC);
  // The fabricated second clause is rejected by the verbatim check.
  assert.equal(r.dropped, 1);
  // Final fix wave, item 2: 1 of 2 returned clauses dropped is more than 30% of what the model
  // returned, so the split is treated as a paraphrase and the rule-based split is used. (The
  // earlier 60%-length-coverage floor that used to force this is gone.)
  assert.equal(r.usedFallback, true);
  assert.equal(r.reason, "paraphrase");
  assert.deepEqual(r.clauses, fallbackSplit(DOC));
});

test("falls back to numbered lines when the model fails", async () => {
  const failing = (async () => ({ ok: false, reason: "api_error", detail: "x" })) as never;
  const r = await splitClauses(failing, DOC);
  assert.equal(r.usedFallback, true);
  assert.equal(r.reason, "model_failed");
  assert.deepEqual(r.clauses.slice(0, 2), ["يلتزم العميل بالشراء.", "يبيع المصرف السلعة بعد تملكها."]);
});

test("fallbackSplit without structure splits on single newlines and merges short headings into the next line", () => {
  // Final fix wave, item 2: was "split on blank lines" (["بند أول", "بند ثان"]); now single newlines,
  // and a line under 25 normalized characters is a heading that joins the following line.
  const doc = "التعريفات\nالسلعة: البضاعة الموصوفة في طلب الشراء المرفق.\n\nيلتزم العميل بسداد الأقساط في مواعيدها المحددة.\nيتعهد المصرف بتسليم السلعة للعميل في موعدها.";
  assert.deepEqual(fallbackSplit(doc), [
    "التعريفات السلعة: البضاعة الموصوفة في طلب الشراء المرفق.",
    "يلتزم العميل بسداد الأقساط في مواعيدها المحددة.",
    "يتعهد المصرف بتسليم السلعة للعميل في موعدها.",
  ]);
});

test("falls back and reports dropped clauses when the model only returns paraphrases", async () => {
  const r = await splitClauses(llmReturning(["يلتزم الزبون بعملية الشراء", "يقوم المصرف ببيع السلعة بعد أن يتملكها"]), DOC);
  assert.equal(r.usedFallback, true);
  assert.equal(r.reason, "paraphrase");
  assert.equal(r.dropped, 2);
});

test("final fix wave: a verbatim partial split is trusted (no length-coverage fallback)", async () => {
  // Was: "falls back when the kept clause covers less than 60% of the document". That floor made an
  // unfamiliar contract (long preamble, definitions, signatures) collapse into the fallback split
  // even when every clause the model returned was verbatim; it is removed.
  const doc =
    "يلتزم العميل بسداد الأقساط في مواعيدها المحددة.\n" +
    "تمهيد طويل لا يتضمن التزامًا ولا حكمًا وإنما يذكر خلفية الاتفاق وأسماء الأطراف وصفاتهم وعناوينهم.";
  const r = await splitClauses(llmReturning(["يلتزم العميل بسداد الأقساط في مواعيدها المحددة."]), doc);
  assert.equal(r.usedFallback, false);
  assert.equal(r.reason, null);
  assert.deepEqual(r.clauses, ["يلتزم العميل بسداد الأقساط في مواعيدها المحددة."]);
});

test("final fix wave: dropped <= 30% of returned keeps the split and reports the drop", async () => {
  const doc = "يلتزم العميل بسداد الأقساط في مواعيدها.\nيتعهد المصرف بتسليم السلعة للعميل.\nيلتزم الطرفان بتوثيق العقد رسميًا.\nيلتزم العميل بالتأمين على السلعة.";
  const real = doc.split("\n");
  const r = await splitClauses(llmReturning([...real, "بند مؤلف لا وجود له في الوثيقة"]), doc);
  assert.equal(r.usedFallback, false);
  assert.equal(r.reason, null);
  assert.equal(r.dropped, 1);
  assert.deepEqual(r.clauses, real);
});

test("fallbackSplit keeps a numbered item whole when it has a blank line before its sub-items", () => {
  const DOC4 = "1- بند أول:\n\nأ- فرع أول\nب- فرع ثان\n2- بند ثان\n3- بند ثالث";
  const parts = fallbackSplit(DOC4);
  assert.deepEqual(parts, ["بند أول: أ- فرع أول ب- فرع ثان", "بند ثان", "بند ثالث"]);
});

test("a whitespace-only document makes no llm call and returns no clauses", async () => {
  const throwing = (() => {
    throw new Error("llm should not be called for a whitespace-only document");
  }) as never;
  const r = await splitClauses(throwing, "   \n\t  \n  ");
  assert.deepEqual(r.clauses, []);
  assert.equal(r.usedFallback, true);
  assert.equal(r.dropped, 0);
});

test("candidateBlock renders the id, decision number, hijri date and verbatim text", () => {
  const corpus = loadCorpus();
  const id = "الإنماء/ق7/ثالثاً/2";
  const unit = corpus.byId.get(id)!;
  const decision = corpus.decisions.get(unit.decision_no)!;
  const block = candidateBlock(corpus, [id]);
  assert.ok(block.includes(id));
  assert.ok(block.includes("القرار (7)"));
  assert.ok(block.includes(decision.date_hijri));
  assert.ok(block.includes(unit.text));
});

// Final fix wave, item 2: unfamiliar contracts must not collapse.
const counting = (impl: (a: { user: string }) => unknown) => {
  const fn = (async (a: { user: string }) => { fn.calls++; return impl(a); }) as unknown as { calls: number } & ((a: { user: string }) => Promise<unknown>);
  fn.calls = 0;
  return fn;
};

test("realistic «المادة»-style contract: a verbatim model split gives 10 clauses, no fallback", async () => {
  const llm = counting(() => ({ ok: true, value: { clauses: ARTICLE_BODIES }, usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 } }));
  const r = await splitClauses(llm as never, REALISTIC_CONTRACT);
  assert.equal(llm.calls, 1, "articles are well under 80% of this document, so the model split runs");
  assert.equal(r.usedFallback, false);
  assert.equal(r.reason, null);
  assert.equal(r.dropped, 0);
  assert.deepEqual(r.clauses, ARTICLE_BODIES);
});

test("realistic «المادة»-style contract with the model failing: >= 10 fallback clauses, signatures never glued to a clause", async () => {
  const failing = (async () => ({ ok: false, reason: "api_error", detail: "x" })) as never;
  const r = await splitClauses(failing, REALISTIC_CONTRACT);
  assert.equal(r.usedFallback, true);
  assert.equal(r.reason, "model_failed");
  assert.ok(r.clauses.length >= 10, `expected >= 10 clauses, got ${r.clauses.length}`);
  for (const body of ARTICLE_BODIES) assert.ok(r.clauses.includes(body), `article missing or merged: ${body}`);
  for (const c of r.clauses) {
    const hasSignature = SIGNATURE_LINES.slice(1).some((l) => c.includes("التوقيع:") && c.includes(l.split(" — ")[0]));
    const hasArticle = ARTICLE_BODIES.some((b) => c.includes(b));
    assert.ok(!(hasSignature && hasArticle), `signature glued to a clause: ${c}`);
  }
});

test("fallbackSplit recognises (n), (٠-٩), أولاً… and البند markers at line start", () => {
  assert.deepEqual(
    fallbackSplit("(1) يلتزم العميل بسداد الأقساط.\n(2) يتعهد المصرف بتسليم السلعة.\n(٣) يلتزم الطرفان بتوثيق العقد."),
    ["يلتزم العميل بسداد الأقساط.", "يتعهد المصرف بتسليم السلعة.", "يلتزم الطرفان بتوثيق العقد."],
  );
  assert.deepEqual(
    fallbackSplit("أولاً: يلتزم العميل بسداد الأقساط.\nثانياً: يتعهد المصرف بتسليم السلعة.\nثالثاً- يلتزم الطرفان بتوثيق العقد."),
    ["يلتزم العميل بسداد الأقساط.", "يتعهد المصرف بتسليم السلعة.", "يلتزم الطرفان بتوثيق العقد."],
  );
  assert.deepEqual(
    fallbackSplit("البند الأول: يلتزم العميل بسداد الأقساط.\nالبند (2): يتعهد المصرف بتسليم السلعة.\nالبند 3 - يلتزم الطرفان بتوثيق العقد."),
    ["يلتزم العميل بسداد الأقساط.", "يتعهد المصرف بتسليم السلعة.", "يلتزم الطرفان بتوثيق العقد."],
  );
});

test("a cleanly numbered document (the demo text) skips the llm split entirely", async () => {
  const demoText = DEMO_CONTRACT.clauses.map((c, i) => `${i + 1}- ${c.text.ar}`).join("\n");
  const llm = counting(() => { throw new Error("llm must not be called"); });
  const r = await splitClauses(llm as never, demoText);
  assert.equal(llm.calls, 0);
  assert.equal(r.usedFallback, false);
  assert.equal(r.reason, null);
  assert.equal(r.dropped, 0);
  assert.deepEqual(r.clauses, DEMO_CONTRACT.clauses.map((c) => c.text.ar));
});

// Residual fix: the skip path must never drop text silently. Text after the last numbered item
// (a hard-wrapped last clause, or an unnumbered trailing clause) sends the document to the model.
const NUMBERED = [
  "1- يلتزم العميل بشراء السلعة من المصرف بعد تملك المصرف لها وقبضها قبضًا حقيقيًا أو حكميًا.",
  "2- يدفع العميل الثمن على أقساط شهرية متساوية وفق الجدول الملحق بهذا العقد دون أي زيادة.",
  "3- يلتزم المصرف بتسليم السلعة للعميل في الموعد المتفق عليه وبالمواصفات المذكورة في الطلب.",
];
const verbatim = (clauses: string[]) =>
  counting(() => ({ ok: true, value: { clauses }, usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 } }));

test("skip path: a hard-wrapped last clause is not cut; the model split runs", async () => {
  const doc = [...NUMBERED, "ويحق للمصرف فسخ العقد."].join("\n");
  const llm = verbatim([NUMBERED[0].slice(3), NUMBERED[1].slice(3), `${NUMBERED[2].slice(3)} ويحق للمصرف فسخ العقد.`]);
  const r = await splitClauses(llm as never, doc);
  assert.equal(llm.calls, 1);
  assert.ok(r.clauses.some((c) => c.includes("ويحق للمصرف فسخ العقد")));
});

test("skip path: an unnumbered trailing clause is not dropped, even when the model fails", async () => {
  const doc = [...NUMBERED, "", "يلتزم العميل بسداد غرامة تأخير قدرها اثنان بالمئة عن كل شهر تأخير."].join("\n");
  const failing = counting(() => ({ ok: false, reason: "api_error", detail: "x" }));
  const r = await splitClauses(failing as never, doc);
  assert.equal(failing.calls, 1);
  assert.equal(r.reason, "model_failed");
  assert.ok(r.clauses.some((c) => c.includes("غرامة تأخير")));
});

test("skip path: a short title before the numbering still skips the model", async () => {
  const llm = counting(() => { throw new Error("llm must not be called"); });
  const r = await splitClauses(llm as never, ["عقد مرابحة", ...NUMBERED].join("\n"));
  assert.equal(llm.calls, 0);
  assert.equal(r.clauses.length, 3);
});

// A long document cannot be copied back by the model inside SPLIT_TIMEOUT_MS, so the model call is
// skipped and the rule-based split (everything, nothing dropped) is used with reason "long".
test("a long unnumbered document skips the model and keeps every line", async () => {
  const { SPLIT_MODEL_MAX_CHARS } = await import("./split");
  const line = "يلتزم العميل بسداد الأقساط الشهرية في مواعيدها المحددة في جدول السداد الملحق بالعقد.";
  const lines = Array.from({ length: Math.ceil(SPLIT_MODEL_MAX_CHARS / line.length) + 5 }, (_, i) => `${line} (${i})`);
  const llm = counting(() => { throw new Error("llm must not be called"); });
  const r = await splitClauses(llm as never, lines.join("\n"));
  assert.equal(llm.calls, 0);
  assert.equal(r.usedFallback, true);
  assert.equal(r.reason, "long");
  assert.equal(r.clauses.length, lines.length);
});

// No silent loss on the model path (2026-10-01): a substantive line the model left out of every
// clause is added back as its own clause, in document order; a line the model split in two is not
// duplicated.
test("model split: substantive lines the model omitted are added back in document order", async () => {
  const lines = [
    "يلتزم العميل بسداد الأقساط الشهرية في مواعيدها المحددة في جدول السداد.",
    "يحق للمصرف احتساب أرباح الثلاثة أشهر التالية لتاريخ السداد المبكر.",
    "يلتزم المصرف بتسليم السلعة في الموعد المتفق عليه بالمواصفات المطلوبة.",
  ];
  const r = await splitClauses(llmReturning([lines[0], lines[2]]), lines.join("\n"));
  assert.equal(r.usedFallback, false);
  assert.deepEqual(r.clauses, lines);
});

test("model split: a line the model split into two clauses is not added again", async () => {
  const line = "يلتزم العميل بسداد الأقساط الشهرية في مواعيدها، ويحق للمصرف المطالبة بالمتأخر منها لدى الجهات القضائية.";
  const parts = ["يلتزم العميل بسداد الأقساط الشهرية في مواعيدها،", "ويحق للمصرف المطالبة بالمتأخر منها لدى الجهات القضائية."];
  const r = await splitClauses(llmReturning(parts), `${line}\nالتوقيع: ............`);
  assert.deepEqual(r.clauses, parts);
});
