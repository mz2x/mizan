import { clearCookie, cleanUsername, cookieValue, hashPassword, makeSession, passwordOk, readSession, sessionCookie, verifyPassword } from "@/server/auth";
import { authLimiter, clientIp, isSecure, json, readJson, requireUser } from "@/server/account";
import { getStore } from "@/server/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Whether accounts are on for this deployment, and who is signed in. */
export async function GET(req: Request) {
  // codeRequired tells the review page to ask for the access code before a live review (see guard.ts).
  const codeRequired = Boolean(process.env.MIZAN_ACCESS_CODE) || Boolean(process.env.VERCEL);
  const store = await getStore();
  if (!store) return json({ accounts: false, user: null, codeRequired });
  try {
    const id = readSession(cookieValue(req.headers.get("cookie")), await store.secret());
    const user = id ? await store.user(id) : null;
    return json({ accounts: true, user: user ? { username: user.username } : null, codeRequired });
  } catch {
    // Database unreachable: the dashboard falls back to this browser rather than failing.
    return json({ accounts: false, user: null, codeRequired, degraded: true });
  }
}

/** { action: "signup" | "login" | "logout", username, password } */
export async function POST(req: Request) {
  const store = await getStore();
  if (!store) return json({ error: "accounts_off" }, 503);
  const body = await readJson(req);
  const secure = isSecure(req);
  if (body.action === "logout") return json({ ok: true }, 200, { "set-cookie": clearCookie(secure) });
  if (!authLimiter.take(clientIp(req))) return json({ error: "rate" }, 429);
  const username = cleanUsername(body.username);
  if (!username) return json({ error: "username" }, 400);
  if (!passwordOk(body.password)) return json({ error: "password" }, 400);
  const secret = await store.secret();
  if (body.action === "signup") {
    const user = await store.createUser(username, await hashPassword(body.password));
    if (!user) return json({ error: "taken" }, 409);
    return json({ user: { username } }, 200, { "set-cookie": sessionCookie(makeSession(user.id, secret), secure) });
  }
  if (body.action === "login") {
    const user = await store.userByName(username);
    if (!user || !(await verifyPassword(body.password, user.passHash))) return json({ error: "wrong" }, 401);
    return json({ user: { username } }, 200, { "set-cookie": sessionCookie(makeSession(user.id, secret), secure) });
  }
  return json({ error: "action" }, 400);
}

/** Delete the account and everything saved in it. */
export async function DELETE(req: Request) {
  const ctx = await requireUser(req);
  if (ctx instanceof Response) return ctx;
  await ctx.store.deleteUser(ctx.user.id);
  return json({ ok: true }, 200, { "set-cookie": clearCookie(isSecure(req)) });
}
