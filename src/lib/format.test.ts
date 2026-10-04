import { test } from "node:test";
import assert from "node:assert/strict";
import { formatDecisionDate, isArabicText } from "./format";

test("a valid date renders as words", () => {
  assert.equal(formatDecisionDate("10\\07\\1431", "hijri", "en"), "10 Rajab 1431 AH");
});

test("an invalid month (0 or > 12) falls back to the raw date, never «undefined»", () => {
  assert.equal(formatDecisionDate("10\\13\\1431", "hijri", "en"), "10/13/1431");
  assert.equal(formatDecisionDate("10\\00\\1431", "gregorian", "en"), "10/00/1431");
  assert.equal(formatDecisionDate("10\\13\\1431", "hijri", "ar"), "١٠/١٣/١٤٣١");
});

test("isArabicText detects Arabic script", () => {
  assert.equal(isArabicText("يلتزم العميل"), true);
  assert.equal(isArabicText("The client undertakes"), false);
});
