// server-only: imported by node tests
// The dashboard's storage, written once over a tiny SQL interface so the same code runs on Postgres
// in production (Neon via Vercel) and on PGlite in local development and tests.
import { randomBytes, randomUUID } from "node:crypto";
import { RETENTION_DAYS, summarize, type Folder, type RunSummary, type StoredRun } from "@/lib/runs";

export type Sql = <R = Record<string, unknown>>(text: string, params?: unknown[]) => Promise<R[]>;

const SCHEMA = [
  `create table if not exists mizan_meta (k text primary key, v text not null)`,
  `create table if not exists mizan_users (
     id text primary key,
     username text unique not null,
     pass_hash text not null,
     created_at timestamptz not null default now())`,
  `create table if not exists mizan_folders (
     id text primary key,
     user_id text not null references mizan_users(id) on delete cascade,
     name text not null,
     created_at timestamptz not null default now())`,
  `create table if not exists mizan_runs (
     id text primary key,
     user_id text not null references mizan_users(id) on delete cascade,
     folder_id text references mizan_folders(id) on delete set null,
     contract_id text not null,
     created_at timestamptz not null,
     data jsonb not null)`,
  `create index if not exists mizan_runs_user on mizan_runs (user_id, created_at desc)`,
];

export type User = { id: string; username: string };

export class SqlStore {
  private ready: Promise<void> | null = null;
  constructor(private readonly sql: Sql) {}

  private init(): Promise<void> {
    this.ready ??= (async () => {
      for (const s of SCHEMA) await this.sql(s);
    })().catch((e) => {
      // A failed start (database unreachable) is retried on the next request, not cached.
      this.ready = null;
      throw e;
    });
    return this.ready;
  }

  /** A random secret generated once and kept in the database, so signing sessions needs no env var. */
  async secret(): Promise<string> {
    await this.init();
    await this.sql(`insert into mizan_meta (k, v) values ('session_secret', $1) on conflict (k) do nothing`, [randomBytes(32).toString("base64url")]);
    const rows = await this.sql<{ v: string }>(`select v from mizan_meta where k = 'session_secret'`);
    return rows[0].v;
  }

  async createUser(username: string, passHash: string): Promise<User | null> {
    await this.init();
    const id = randomUUID();
    const rows = await this.sql<{ id: string }>(
      `insert into mizan_users (id, username, pass_hash) values ($1, $2, $3) on conflict (username) do nothing returning id`,
      [id, username, passHash],
    );
    return rows.length ? { id, username } : null;
  }

  async userByName(username: string): Promise<(User & { passHash: string }) | null> {
    await this.init();
    const rows = await this.sql<{ id: string; username: string; pass_hash: string }>(`select id, username, pass_hash from mizan_users where username = $1`, [username]);
    return rows[0] ? { id: rows[0].id, username: rows[0].username, passHash: rows[0].pass_hash } : null;
  }

  async user(id: string): Promise<User | null> {
    await this.init();
    const rows = await this.sql<User>(`select id, username from mizan_users where id = $1`, [id]);
    return rows[0] ?? null;
  }

  /** Deletes the account and, by cascade, every folder and run in it. */
  async deleteUser(id: string): Promise<void> {
    await this.init();
    await this.sql(`delete from mizan_users where id = $1`, [id]);
  }

  async folders(userId: string): Promise<Folder[]> {
    await this.init();
    return this.sql<Folder>(`select id, name from mizan_folders where user_id = $1 order by created_at`, [userId]);
  }

  async createFolder(userId: string, name: string): Promise<Folder> {
    await this.init();
    const folder = { id: randomUUID(), name };
    await this.sql(`insert into mizan_folders (id, user_id, name) values ($1, $2, $3)`, [folder.id, userId, name]);
    return folder;
  }

  async renameFolder(userId: string, id: string, name: string): Promise<boolean> {
    await this.init();
    const rows = await this.sql(`update mizan_folders set name = $3 where id = $1 and user_id = $2 returning id`, [id, userId, name]);
    return rows.length > 0;
  }

  /** The folder goes; its runs stay, back in the general list (on delete set null). */
  async deleteFolder(userId: string, id: string): Promise<boolean> {
    await this.init();
    await this.sql(`update mizan_runs set folder_id = null, data = jsonb_set(data, '{folderId}', 'null'::jsonb) where user_id = $1 and folder_id = $2`, [userId, id]);
    const rows = await this.sql(`delete from mizan_folders where id = $1 and user_id = $2 returning id`, [id, userId]);
    return rows.length > 0;
  }

  private async folderOwned(userId: string, folderId: string | null): Promise<boolean> {
    if (!folderId) return true;
    const rows = await this.sql(`select 1 from mizan_folders where id = $1 and user_id = $2`, [folderId, userId]);
    return rows.length > 0;
  }

  async saveRun(userId: string, run: StoredRun): Promise<boolean> {
    await this.init();
    if (!(await this.folderOwned(userId, run.folderId))) run = { ...run, folderId: null };
    await this.sql(`delete from mizan_runs where created_at < now() - ($1 || ' days')::interval`, [String(RETENTION_DAYS)]);
    const rows = await this.sql(
      `insert into mizan_runs (id, user_id, folder_id, contract_id, created_at, data) values ($1, $2, $3, $4, $5, $6::jsonb) on conflict (id) do nothing returning id`,
      [run.id, userId, run.folderId, run.contractId, run.createdAt, JSON.stringify(run)],
    );
    return rows.length > 0;
  }

  async runs(userId: string): Promise<RunSummary[]> {
    await this.init();
    const rows = await this.sql<{ data: StoredRun | string }>(
      `select data from mizan_runs where user_id = $1 and created_at >= now() - ($2 || ' days')::interval order by created_at desc limit 500`,
      [userId, String(RETENTION_DAYS)],
    );
    return rows.map((r) => summarize(typeof r.data === "string" ? (JSON.parse(r.data) as StoredRun) : r.data));
  }

  async run(userId: string, id: string): Promise<StoredRun | null> {
    await this.init();
    const rows = await this.sql<{ data: StoredRun | string }>(`select data from mizan_runs where id = $1 and user_id = $2`, [id, userId]);
    if (!rows[0]) return null;
    return typeof rows[0].data === "string" ? (JSON.parse(rows[0].data) as StoredRun) : rows[0].data;
  }

  /** Replace a run the user owns (moves and committee decisions go through here). */
  async updateRun(userId: string, run: StoredRun): Promise<boolean> {
    await this.init();
    if (!(await this.folderOwned(userId, run.folderId))) return false;
    const rows = await this.sql(`update mizan_runs set folder_id = $3, data = $4::jsonb where id = $1 and user_id = $2 returning id`, [
      run.id,
      userId,
      run.folderId,
      JSON.stringify(run),
    ]);
    return rows.length > 0;
  }

  async deleteRun(userId: string, id: string): Promise<boolean> {
    await this.init();
    const rows = await this.sql(`delete from mizan_runs where id = $1 and user_id = $2 returning id`, [id, userId]);
    return rows.length > 0;
  }
}
