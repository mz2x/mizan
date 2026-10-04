import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanUsername, cookieValue, hashPassword, makeSession, passwordOk, readSession, verifyPassword } from "./auth";

test("passwords: scrypt hash verifies, a wrong password does not", async () => {
  const h = await hashPassword("ميزان-2026-كلمة");
  assert.ok(h.startsWith("scrypt$"));
  assert.equal(await verifyPassword("ميزان-2026-كلمة", h), true);
  assert.equal(await verifyPassword("wrong-password", h), false);
  assert.equal(await verifyPassword("x", "plain"), false);
});

test("sessions: signed, expiring, and tamper-proof", () => {
  const t = makeSession("user-1", "secret", 1000);
  assert.equal(readSession(t, "secret", 2000), "user-1");
  assert.equal(readSession(t, "other-secret", 2000), null);
  assert.equal(readSession(t, "secret", 1000 + 31 * 86_400_000), null, "expired after 30 days");
  const [p, m] = t.split(".");
  const forged = Buffer.from(JSON.stringify({ u: "admin", e: 9e15 })).toString("base64url");
  assert.equal(readSession(`${forged}.${m}`, "secret", 2000), null);
  assert.equal(readSession(`${p}.`, "secret", 2000), null);
  assert.equal(readSession(undefined, "secret"), null);
});

test("usernames and passwords: shape rules; cookie parsing", () => {
  assert.equal(cleanUsername(" Mazen "), "mazen");
  assert.equal(cleanUsername("مدقق_1"), "مدقق_1");
  assert.equal(cleanUsername("a"), null);
  assert.equal(cleanUsername("bad name"), null);
  assert.equal(passwordOk("short"), false);
  assert.equal(passwordOk("long-enough"), true);
  assert.equal(cookieValue("a=1; mizan_session=abc.def; b=2"), "abc.def");
});
