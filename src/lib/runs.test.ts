import { test } from "node:test";
import assert from "node:assert/strict";
import { EXCERPT_CHARS, expired, summarize, toStoredRun } from "./runs";

const long = "يشتري المصرف من العميل السلعة المملوكة له بثمن حال، ثم يبيعها عليه بالأجل بثمن أعلى. ".repeat(10);
const base = {
  id: "R-261002-7K3Q",
  contractId: "C-7KQ4-M2XD",
  fileName: "murabaha.txt",
  createdAt: "2026-10-02T01:00:00.000Z",
  engine: "live",
  demo: false,
  folderId: null,
  clauses: [
    { n: 1, excerpt: long, verdict: "nonCompliant", citations: ["الإنماء/ق7/ثالثاً/2"], reason: { ar: "س", en: "r" }, verbatim: true, secret: "x" },
    { n: 2, excerpt: "بند", verdict: "bogus", citations: [], reason: { ar: "", en: "" } },
  ],
  decisions: { 1: { d: "approve", at: "2026-10-02T02:00:00Z" }, 2: { d: "delete-everything" } },
  fullText: long,
  file: "base64...",
};

test("toStoredRun keeps a short excerpt per clause, never the full text, the file or unknown fields", () => {
  const r = toStoredRun(base);
  const json = JSON.stringify(r);
  assert.ok(!json.includes("fullText") && !json.includes("base64") && !json.includes("secret"));
  assert.equal(r.clauses.length, 1, "a clause with an unknown verdict is dropped");
  assert.ok(r.clauses[0].excerpt.length <= EXCERPT_CHARS);
  assert.ok(r.clauses[0].excerpt.endsWith("…"));
  assert.deepEqual(Object.keys(r.decisions), ["1"]);
});

test("toStoredRun refuses malformed ids and empty runs", () => {
  assert.throws(() => toStoredRun({ ...base, id: "../../etc" }));
  assert.throws(() => toStoredRun({ ...base, contractId: "R-261002-7K3Q" }));
  assert.throws(() => toStoredRun({ ...base, clauses: [] }));
});

test("summarize tallies verdicts and counts committee decisions; retention is 90 days", () => {
  const s = summarize(toStoredRun(base));
  assert.equal(s.tally.nonCompliant, 1);
  assert.equal(s.decided, 1);
  assert.equal(expired("2026-01-01T00:00:00Z", Date.parse("2026-10-02T00:00:00Z")), true);
  assert.equal(expired("2026-09-01T00:00:00Z", Date.parse("2026-10-02T00:00:00Z")), false);
});

test("layout: offsets (never text) locate every part, survive toStoredRun, and replay the same parts", async () => {
  const { layoutOf, flatText, textHash, ENGINE_VERSION } = await import("./runs");
  const text = "اتفاقية مرابحة\n1- يلتزم العميل   بشراء السلعة.\n2- يبيع المصرف السلعة بعد قبضها.";
  const parts = [
    { n: 1, text: "اتفاقية مرابحة", kind: "other", otherType: "title" },
    { n: 2, text: "يلتزم العميل بشراء السلعة.", kind: "clause" },
    { n: 3, text: "يبيع المصرف السلعة بعد قبضها.", kind: "clause" },
  ];
  const layout = layoutOf(text, parts)!;
  assert.ok(layout);
  const flat = flatText(text);
  assert.deepEqual(layout.map((p) => flat.slice(p.span[0], p.span[1])), parts.map((p) => p.text));
  const stored = toStoredRun({ ...base, layout, textHash: await textHash(text), engineVersion: ENGINE_VERSION });
  assert.equal(JSON.stringify(stored.layout).includes("يلتزم"), false, "no text in the layout");
  assert.deepEqual(stored.layout!.map((p) => p.span), layout.map((p) => p.span));
  assert.equal(stored.textHash, await textHash(text.replace(/\n/g, "  ")), "whitespace does not change the hash");
  assert.equal(layoutOf(text, [{ n: 1, text: "نص غير موجود" }]), null);
});
