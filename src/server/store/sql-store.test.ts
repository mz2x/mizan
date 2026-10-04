import { test } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { SqlStore, type Sql } from "./sql-store";
import { toStoredRun } from "@/lib/runs";

const fresh = () => {
  const db = new PGlite();
  const sql: Sql = async (text, params = []) => (await db.query(text, params)).rows as never;
  return new SqlStore(sql);
};
const run = (id: string, extra: Record<string, unknown> = {}) =>
  toStoredRun({
    id,
    contractId: "C-7KQ4-M2XD",
    fileName: "a.txt",
    createdAt: new Date().toISOString(),
    engine: "live",
    clauses: [{ n: 1, excerpt: "بند", verdict: "review", citations: [], reason: { ar: "س", en: "r" }, verbatim: false }],
    ...extra,
  });

test("store: users are unique by name; the session secret is stable", async () => {
  const s = fresh();
  const u = await s.createUser("mazen", "h");
  assert.ok(u);
  assert.equal(await s.createUser("mazen", "h2"), null);
  assert.equal((await s.userByName("mazen"))?.passHash, "h");
  assert.equal(await s.secret(), await s.secret());
});

test("store: runs belong to their user; folders move and delete without losing runs", async () => {
  const s = fresh();
  const a = (await s.createUser("a", "h"))!;
  const b = (await s.createUser("b", "h"))!;
  const f = await s.createFolder(a.id, "مرابحة");
  assert.equal(await s.saveRun(a.id, run("R-261002-AAAA", { folderId: f.id })), true);
  assert.equal(await s.saveRun(a.id, run("R-261002-BBBB")), true);
  assert.equal((await s.runs(a.id)).length, 2);
  assert.equal((await s.runs(b.id)).length, 0, "another user's runs are invisible");
  assert.equal(await s.run(b.id, "R-261002-AAAA"), null);
  assert.equal(await s.deleteRun(b.id, "R-261002-AAAA"), false);
  // b cannot file a run into a's folder
  assert.equal(await s.saveRun(b.id, run("R-261002-CCCC", { folderId: f.id })), true);
  assert.equal((await s.run(b.id, "R-261002-CCCC"))?.folderId, null);
  await s.deleteFolder(a.id, f.id);
  const moved = await s.run(a.id, "R-261002-AAAA");
  assert.equal(moved?.folderId, null);
  assert.equal((await s.folders(a.id)).length, 0);
});

test("store: deleting the account deletes its folders and runs", async () => {
  const s = fresh();
  const a = (await s.createUser("a", "h"))!;
  await s.createFolder(a.id, "x");
  await s.saveRun(a.id, run("R-261002-DDDD"));
  await s.deleteUser(a.id);
  assert.equal(await s.user(a.id), null);
  assert.equal((await s.runs(a.id)).length, 0);
});

test("store: runs past the retention window are not listed", async () => {
  const s = fresh();
  const a = (await s.createUser("a", "h"))!;
  await s.saveRun(a.id, run("R-260101-EEEE", { createdAt: "2026-01-01T00:00:00Z" }));
  assert.equal((await s.runs(a.id)).length, 0);
});
