import { test } from "node:test";
import assert from "node:assert/strict";
import { formatMetric, hasValidShape } from "./eval-results";

const row = (over: Record<string, unknown> = {}) => ({ recall: 0.9, precision: 0.8, citation: 0.7, abstention: 0.6, ...over });
const results = (mizan = row(), baseline = row(), n = 30) => ({ date: "d", n, systems: { mizan, baseline }, stability: 1 });

test("a null metric is a valid shape (a system that never abstained), not a fallback", () => {
  assert.equal(hasValidShape(results(row({ abstention: null }))), true);
});

test("out-of-range, missing or non-numeric metrics, and n < 30, fall back to the pending pills", () => {
  assert.equal(hasValidShape(results(row({ recall: 1.2 }))), false);
  assert.equal(hasValidShape(results(row({ recall: undefined }))), false);
  assert.equal(hasValidShape(results(row({ recall: "90%" }))), false);
  assert.equal(hasValidShape(results(row(), row(), 29)), false);
  assert.equal(hasValidShape(null), false);
});

test("formatMetric renders «—» for null and a rounded percent otherwise", () => {
  assert.equal(formatMetric(null), "—");
  assert.equal(formatMetric(0.666), "67%");
});
