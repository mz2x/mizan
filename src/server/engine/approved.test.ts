import { test } from "node:test";
import assert from "node:assert/strict";
import { loadCorpus } from "./corpus";
import { approvedForms, matchApprovedForm } from "./approved";

const c = loadCorpus();

test("approved forms are read from the corpus: the unified home-finance murabaha contract, latest decision 1083", () => {
  const f = approvedForms(c).find((x) => x.name === "عقد تمويل عقاري بصيغة المرابحة");
  assert.ok(f);
  assert.equal(f.decision, 1083);
  assert.equal(f.unified, true);
});

test("a bank's own form is approved but not unified", () => {
  const f = approvedForms(c).find((x) => x.variants.includes("عقد بيع سيارة بالتقسيط"));
  assert.ok(f, "the «سيارة\\سيارات» name yields both variants");
  assert.equal(f.unified, false);
});

test("matchApprovedForm reads the document's title, with diacritics and punctuation ignored", () => {
  const m = matchApprovedForm(c, "عقدُ تمويلٍ عقاريٍّ بصيغة المرابحة — الصيغة النموذجية\n\nالمادة الأولى: ...");
  assert.equal(m?.decision, 1083);
  assert.equal(m?.unified, true);
});

test("the name must sit in the opening, not deep in the body", () => {
  const body = "عقد بين طرفين.\n" + "يلتزم العميل بالسداد في موعده المحدد. ".repeat(40) + "\nعقد تمويل عقاري بصيغة المرابحة";
  assert.equal(matchApprovedForm(c, body), null);
});

test("a document with no approved name in its title has no match", () => {
  assert.equal(matchApprovedForm(c, "١- يلتزم العميل بشراء السلعة.\n٢- يدفع العميل الثمن."), null);
});
