// server-only: the route handlers' one way to the dashboard store.
// Postgres when DATABASE_URL (or POSTGRES_URL) is set; PGlite in .data/ for local development;
// nothing on Vercel without a database, in which case the dashboard keeps runs in the browser.
import "server-only";
import { SqlStore, type Sql } from "./sql-store";

let store: Promise<SqlStore | null> | null = null;

export function databaseUrl(env = process.env): string | undefined {
  return env.DATABASE_URL || env.POSTGRES_URL || undefined;
}

async function open(): Promise<SqlStore | null> {
  const url = databaseUrl();
  if (url) {
    const { default: postgres } = await import("postgres");
    // One connection per function instance; prepare off for poolers (Neon's pooled URL, PgBouncer).
    const client = postgres(url, { max: 1, prepare: false, idle_timeout: 20, connect_timeout: 10 });
    const sql: Sql = async (text, params = []) => (await client.unsafe(text, params as never[])) as never;
    return new SqlStore(sql);
  }
  if (process.env.VERCEL) return null;
  const { mkdirSync } = await import("node:fs");
  mkdirSync(".data", { recursive: true });
  const { PGlite } = await import("@electric-sql/pglite");
  const db = new PGlite(".data/pglite");
  const sql: Sql = async (text, params = []) => (await db.query(text, params)).rows as never;
  return new SqlStore(sql);
}

export function getStore(): Promise<SqlStore | null> {
  store ??= open().catch(() => null);
  return store;
}
