import { test } from "node:test";
import assert from "node:assert/strict";
import { clauseRef, contractId, isContractId, isRunId, normalizeForId, runId } from "./ids";

test("contractId: same text, same id, whatever the spacing, harakat or digit script", async () => {
  const a = await contractId("١- يشتري المصـرف السلعةَ\n\n٢- يبيعها بالأجل");
  const b = await contractId("1- يشتري المصرف   السلعة 2- يبيعها بالأجل");
  assert.equal(a, b);
  assert.ok(isContractId(a), a);
});

test("contractId: a changed word is a different contract", async () => {
  assert.notEqual(await contractId("يبيع المصرف السلعة بثمن حال"), await contractId("يبيع المصرف السلعة بثمن مؤجل"));
});

test("runId: Riyadh date plus four random characters; distinct per run", () => {
  const at = new Date(Date.UTC(2026, 9, 2, 22, 30)); // 01:30 on 3 Oct in Riyadh
  assert.equal(runId(at, new Uint8Array([0, 0, 0])), "R-261003-0000");
  assert.ok(isRunId(runId()));
  const many = new Set(Array.from({ length: 200 }, () => runId()));
  assert.ok(many.size > 195);
});

test("the two shapes never pass for each other", async () => {
  const c = await contractId("x");
  const r = runId();
  assert.ok(!isRunId(c) && !isContractId(r));
  assert.equal(clauseRef(c, 5), `${c}/05`);
  assert.equal(normalizeForId("  أَ  ب "), "أ ب");
});
