import { test } from "node:test";
import assert from "node:assert/strict";
import { classifySegments, obviousOther } from "./structure";
import { reviewDocument } from "./pipeline";
import type { ReviewEvent } from "@/lib/review-types";

const U = { input: 1, output: 0, cacheRead: 0, cacheWrite: 0 };

// The R04 shape that showed the problem (Mazen, 2026-10-02): a title, a source note, a separator,
// an intro («الضمانات التالية:») with its items, then ordinary clauses.
const SEGMENTS = [
  "شروط وأحكام التمويل الشخصي — البنك العربي الوطني (ديسمبر 2017)",
  "نُسخ في 2026-10-01 لأغراض الاختبار الداخلي فقط.",
  "========================================",
  "يقدم الطرف الثاني الضمانات التالية لضمان سداد الدين وفق الشروط والأحكام التالية:",
  "يلتزم الطرف الثاني بتحويل الراتب الخاص به إلى حسابه لدى الطرف الأول حتى السداد الكامل.",
  "سند لأمر بكامل مبلغ المديونية ووفق النماذج المعتمدة من قبل الطرف الأول.",
];
const labels = {
  items: [
    { i: 0, kind: "other", other_type: "title", context: [] },
    { i: 1, kind: "other", other_type: "source", context: [] },
    { i: 3, kind: "intro", other_type: null, context: [4, 5] },
    { i: 4, kind: "clause", other_type: null, context: [3] },
    { i: 5, kind: "clause", other_type: null, context: [3] },
  ],
};

test("structure: separators need no model; titles and source notes are not clauses; intros carry their items", async () => {
  assert.equal(obviousOther("========"), true);
  assert.equal(obviousOther("1 - 2"), true);
  const llm = (async () => ({ ok: true, value: labels, usage: U })) as never;
  const { segments, failed } = await classifySegments(llm, SEGMENTS);
  assert.equal(failed, false);
  assert.deepEqual(segments.map((x) => x.kind), ["other", "other", "other", "intro", "clause", "clause"]);
  assert.equal(segments[2].otherType, "separator");
  assert.deepEqual(segments[3].context, [4, 5]);
  assert.deepEqual(segments[5].context, [3]);
});

test("structure: a segment with an obligation is reviewed even if the model calls it «other»", async () => {
  const llm = (async () => ({ ok: true, value: { items: [{ i: 0, kind: "other", other_type: "note", context: [] }] }, usage: U })) as never;
  const { segments } = await classifySegments(llm, ["يلتزم العميل بسداد الأقساط في مواعيدها المحددة.", "عنوان المرجع التالي"]);
  assert.equal(segments[0].kind, "clause");
});

test("structure: plain numbered obligations skip the model; a failing or throwing model keeps every segment a clause", async () => {
  let calls = 0;
  const counting = (async () => { calls++; return { ok: true, value: labels, usage: U }; }) as never;
  await classifySegments(counting, ["يلتزم العميل بالسداد.", "يحق للمصرف المطالبة."]);
  assert.equal(calls, 0);
  const throwing = (async () => { throw new Error("down"); }) as never;
  const r = await classifySegments(throwing, SEGMENTS);
  assert.equal(r.failed, true);
  assert.deepEqual(r.segments.map((x) => x.kind), ["clause", "clause", "other", "clause", "clause", "clause"]);
});

test("pipeline: «other» segments are announced but never judged; an intro's items reach the judge as context", async () => {
  const judged: string[] = [];
  const llm = (async ({ user }: { user: string }) => {
    if (user.startsWith("<document>")) return { ok: true, value: { clauses: SEGMENTS }, usage: U };
    if (user.startsWith("<segments>")) return { ok: true, value: labels, usage: U };
    if (user.startsWith("<clause>")) return { ok: true, value: { terms: [], product: null }, usage: U };
    judged.push(user);
    return { ok: true, usage: U, value: { verdict: "abstain", citations: [], scope_applies: false, reason_ar: "لا", reason_en: "no", suggestion_ar: null, suggestion_en: null } };
  }) as never;
  const out: ReviewEvent[] = [];
  for await (const e of reviewDocument({ text: SEGMENTS.join("\n"), llm, k: 12, concurrency: 1 })) out.push(e);
  const clauses = out.filter((e) => e.type === "clause") as Extract<ReviewEvent, { type: "clause" }>[];
  assert.deepEqual(clauses.map((c) => c.kind), ["other", "other", "other", "intro", "clause", "clause"]);
  const results = out.filter((e) => e.type === "result") as Extract<ReviewEvent, { type: "result" }>[];
  assert.deepEqual(results.map((r) => r.result.n).sort(), [5, 6], "only the two items are judged; the intro carries no verdict");
  assert.deepEqual(clauses[3].context, [5, 6]);
  assert.ok(out.some((e) => e.type === "notice" && e.message.ar.includes("ليست بنودًا")));
  const itemCall = judged.find((u) => u.includes("<clause>سند لأمر"));
  assert.ok(itemCall && itemCall.includes("<context>") && itemCall.includes("الضمانات التالية"), "each item is judged with its intro as context");
  assert.equal(out.at(-1)?.type, "done");
});
