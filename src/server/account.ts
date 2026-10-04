// server-only: shared plumbing for the dashboard route handlers.
import "server-only";
import { cookieValue, readSession } from "./auth";
import { RateLimiter } from "./guard";
import { getStore } from "./store";
import type { SqlStore, User } from "./store/sql-store";

export const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store", ...headers } });

export const isSecure = (req: Request) => new URL(req.url).protocol === "https:";
export const clientIp = (req: Request) => req.headers.get("x-real-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";

/** Sign-in and sign-up attempts per IP (per instance, like the review limiter). */
export const authLimiter = new RateLimiter(10, 60_000);

export type Ctx = { store: SqlStore; user: User };

/** The signed-in user, or a ready-made error response. */
export async function requireUser(req: Request): Promise<Ctx | Response> {
  const store = await getStore();
  if (!store) return json({ error: "accounts_off" }, 503);
  const id = readSession(cookieValue(req.headers.get("cookie")), await store.secret());
  const user = id ? await store.user(id) : null;
  if (!user) return json({ error: "signin" }, 401);
  return { store, user };
}

export async function readJson(req: Request): Promise<Record<string, unknown>> {
  const text = await req.text();
  if (text.length > 2_000_000) return {};
  try {
    const v = JSON.parse(text);
    return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export const cleanFolderName = (v: unknown) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, 40) : "");
