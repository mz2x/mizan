import { test } from "node:test";
import assert from "node:assert/strict";
import { loadCorpus } from "./corpus";
import { buildIndex, search } from "./bm25";

const corpus = loadCorpus();
const plain = buildIndex(corpus, { enriched: false });

test("exact wording finds ق15/أولاً in top 3", () => {
  const ids = search(plain, "اشتراط حلول جميع الأقساط بتخلف العميل عن السداد", 3).map((h) => h.id);
  assert.ok(ids.includes("الإنماء/ق15/أولاً"), ids.join(","));
});

test("scores are sorted and k is respected", () => {
  const hits = search(plain, "المرابحة", 12);
  assert.equal(hits.length, 12);
  for (let i = 1; i < hits.length; i++) assert.ok(hits[i - 1].score >= hits[i].score);
});

test("empty or stopword-only query returns no hits", () => {
  assert.deepEqual(search(plain, "في من على", 12), []);
});

test("excludeApproval drops approval_only units from a plain index without adding enrichment text", () => {
  const approval = new Set([...corpus.enrichment.values()].filter((e) => e.kind === "approval_only").map((e) => e.id));
  const idx = buildIndex(corpus, { enriched: false, excludeApproval: true });
  assert.ok(approval.size > 0);
  assert.equal(idx.ids.filter((id) => approval.has(id)).length, 0);
  assert.equal(idx.ids.length, corpus.units.length - approval.size);
  // Same documents as the plain index for every unit it keeps (no phrasings/scope mixed in).
  const i = idx.ids.indexOf("الإنماء/ق15/أولاً");
  const j = plain.ids.indexOf("الإنماء/ق15/أولاً");
  assert.deepEqual([...idx.docs[i]], [...plain.docs[j]]);
});
