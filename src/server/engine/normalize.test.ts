import { test } from "node:test";
import assert from "node:assert/strict";
import { normalize, tokenize } from "./normalize";

test("normalize matches corpus text_norm rule", () => {
  assert.equal(normalize("إجازة  المصـرف شرعاً"), "اجازة المصرف شرعا");
  assert.equal(normalize("الإنماء/ق7"), "الانماء/ق7");
});

test("tokenize drops ال and و prefixes and short tokens", () => {
  assert.deepEqual(tokenize("والمصرف يبيع السلعة بالأجل"), ["مصرف", "يبيع", "سلعة", "اجل"]);
});
