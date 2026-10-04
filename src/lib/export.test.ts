import { test } from "node:test";
import assert from "node:assert/strict";
import { flatRows, toCsv, toJson, type ExportModel } from "./export";

const model: ExportModel = {
  fileName: "عقد.txt",
  contractId: "C-7KQ4-M2XD",
  runId: "R-261002-7K3Q",
  createdAt: "2026-10-02T09:00:00Z",
  engine: "live",
  demo: false,
  rows: [
    { n: 2, text: "يشتري المصرف من العميل السلعة بثمن حال، ثم يبيعها عليه بالأجل", result: { n: 2, text: { ar: "", en: "" }, verdict: "nonCompliant", citations: ["الإنماء/ق7/ثالثاً/2", "الإنماء/ق32/رابعاً/4"], roles: { "الإنماء/ق7/ثالثاً/2": "governs", "الإنماء/ق32/رابعاً/4": "supports" }, reason: { ar: "سبب \"مقتبس\"", en: "r" } }, verbatim: true },
    { n: 1, text: "شروط وأحكام", kind: "other", otherType: "title" },
  ],
  decisions: { 2: { d: "approve", at: "2026-10-02T10:00:00Z" } },
};

test("export: one row per clause in document order, with verdict, roles, committee decision", () => {
  const rows = flatRows(model, "ar");
  assert.deepEqual(rows.map((r) => r["البند"]), [1, 2]);
  assert.equal(rows[0]["النوع"], "ليس بندًا، لم يُفحص (عنوان)");
  assert.equal(rows[1]["الحكم"], "يُرجَّح عدم مطابقته");
  assert.match(String(rows[1]["السند"]), /ق7\/ثالثاً\/2 \(يحكم البند\) \| .*ق32\/رابعاً\/4 \(يدعم الحكم\)/);
  assert.equal(rows[1]["قرار اللجنة"], "اعتماد الملاحظة");
});

test("export: CSV opens as UTF-8 in Excel and quotes cells with commas or quotes", () => {
  const csv = toCsv(model, "ar");
  assert.ok(csv.startsWith("﻿"));
  assert.match(csv, /"يشتري المصرف من العميل السلعة بثمن حال، ثم يبيعها عليه بالأجل"|يشتري المصرف/);
  assert.match(csv, /"سبب ""مقتبس"""/);
  assert.equal(csv.split("\r\n").length, 3);
});

test("export: JSON carries the ids and a format tag", () => {
  const j = JSON.parse(toJson(model));
  assert.equal(j.format, "mizan-review-file");
  assert.equal(j.runId, "R-261002-7K3Q");
  assert.equal(j.rows.length, 2);
});
