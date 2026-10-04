import { test } from "node:test";
import assert from "node:assert/strict";
import { loadCorpus } from "./corpus";

const c = loadCorpus();

test("loads every unit and decision", () => {
  assert.equal(c.units.length, 2719);
  assert.equal(c.decisions.size, 1217);
  assert.ok(c.byId.get("الإنماء/ق7/ثالثاً/2")!.text.includes("بيوع العينة"));
});

test("reverse references: ق15 is cited later by 1058", () => {
  assert.ok(c.citedBy.get(15)!.includes(1058));
});

test("amend detection is pair-level: a later decision must name the earlier one in an amending sentence", () => {
  assert.equal(c.amends(940, 181), true); // ق940: «... بديلاً للنموذج المجاز بالقرار (181)» with «إلغاء»
  assert.equal(c.amends(1058, 15), false); // ق1058 re-affirms ق15's rules, it does not amend them
  assert.equal(c.amends(1192, 7), false);
  assert.equal(c.amends(905, 125), true); // ق905: «تعديل الضابط ثانياً من القرار (125)»
});
