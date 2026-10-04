import { test } from "node:test";
import assert from "node:assert/strict";
import { codeOk, DailyBudget, RateLimiter, usageUsd } from "./guard";

test("codeOk: open when no code is configured off Vercel, closed on Vercel", () => {
  assert.equal(codeOk(undefined, null, false), true);
  assert.equal(codeOk(undefined, "x", true), false);
  assert.equal(codeOk("", "x", true), false);
});

test("codeOk: exact match only, surrounding spaces ignored", () => {
  assert.equal(codeOk("ميزان-2026", " ميزان-2026 ", true), true);
  assert.equal(codeOk("ميزان-2026", "ميزان-2025", true), false);
  assert.equal(codeOk("abc", null, true), false);
  assert.equal(codeOk("abc", "abcd", true), false);
});

test("RateLimiter: N requests per window per key, then blocked until the window slides", () => {
  let now = 0;
  const rl = new RateLimiter(2, 60_000, () => now);
  assert.equal(rl.take("a"), true);
  assert.equal(rl.take("a"), true);
  assert.equal(rl.take("a"), false);
  assert.equal(rl.take("b"), true, "keys are independent");
  now = 60_001;
  assert.equal(rl.take("a"), true);
});

test("DailyBudget: spending past the cap closes it until the next UTC day", () => {
  let now = Date.UTC(2026, 9, 1, 10);
  const b = new DailyBudget(1, () => now);
  assert.equal(b.open(), true);
  b.add(0.6);
  assert.equal(b.open(), true);
  b.add(0.5);
  assert.equal(b.open(), false);
  now = Date.UTC(2026, 9, 2, 0, 1);
  assert.equal(b.open(), true);
});

test("usageUsd prices Sonnet 5.5 tokens ($2 in, $10 out, cache write 1.25x, cache read 0.1x)", () => {
  assert.equal(usageUsd({ input: 1_000_000, output: 0, cacheRead: 0, cacheWrite: 0 }), 2);
  assert.equal(usageUsd({ input: 0, output: 100_000, cacheRead: 1_000_000, cacheWrite: 400_000 }), 1 + 0.2 + 1);
});

// Privacy report requirement 7: contract text is never stored or logged. Every file on the request
// path is checked for file writes, storage clients and console output; the offline enrichment
// script (enrich.ts) is the only engine file allowed to write, and it never sees user text.
test("the request path never writes, stores or logs contract text", async () => {
  const { readdirSync, readFileSync } = await import("node:fs");
  const files = [
    "src/app/api/review/route.ts",
    "src/server/guard.ts",
    "src/server/env.ts",
    ...readdirSync("src/server/engine")
      .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts") && f !== "enrich.ts" && f !== "test-fixtures.ts")
      .map((f) => `src/server/engine/${f}`),
  ];
  const banned = /writeFile|appendFile|createWriteStream|console\.(log|info|warn|error|debug)|localStorage|sessionStorage|@vercel\/(kv|blob|postgres)|supabase|indexedDB/;
  for (const f of files) {
    const hit = readFileSync(f, "utf8").split("\n").find((l) => banned.test(l) && !l.trim().startsWith("//"));
    assert.equal(hit, undefined, `${f}: ${hit}`);
  }
});

// Mazen's decision (2026-10-02): a saved review keeps the file name and the clause results, never the
// file. The review route itself still stores nothing; the only write path is POST /api/runs (or the
// browser store), and both pass every run through toStoredRun, which keeps a short masked excerpt
// per clause (src/lib/runs.test.ts proves the cut).
test("saving goes only through toStoredRun; the review route never touches the store", async () => {
  const { readFileSync } = await import("node:fs");
  const review = readFileSync("src/app/api/review/route.ts", "utf8");
  assert.ok(!/@\/server\/store|saveRun|run-store/.test(review), "the review route must not store anything");
  const runs = readFileSync("src/app/api/runs/route.ts", "utf8");
  assert.match(runs, /run = toStoredRun\(await readJson\(req\)\)/);
  assert.equal((runs.match(/saveRun\(/g) ?? []).length, 1);
  const local = readFileSync("src/lib/run-store.ts", "utf8");
  assert.match(local, /const clean = toStoredRun\(run\)/);
  const patch = readFileSync("src/app/api/runs/[id]/route.ts", "utf8");
  assert.ok(!/excerpt|clauses\s*=/.test(patch), "a PATCH can move a run or record a decision, never rewrite its clauses");
});
