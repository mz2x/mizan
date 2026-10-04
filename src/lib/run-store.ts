// Where the dashboard keeps reviews, as one interface for the UI:
//   remote  the signed-in account (server database), when accounts are on;
//   local   this browser only (localStorage), when signed out or when the deployment has no database.
import { DECISIONS, expired, summarize, toStoredRun, type Decision, type Folder, type RunSummary, type StoredRun } from "./runs";

export type AccountState = { accounts: boolean; user: { username: string } | null; codeRequired?: boolean };

export interface RunStore {
  kind: "remote" | "local";
  list(): Promise<{ runs: RunSummary[]; folders: Folder[] }>;
  get(id: string): Promise<StoredRun | null>;
  save(run: StoredRun): Promise<void>;
  move(id: string, folderId: string | null): Promise<StoredRun | null>;
  decide(id: string, n: number, d: Decision | null): Promise<StoredRun | null>;
  remove(id: string): Promise<void>;
  createFolder(name: string): Promise<Folder>;
  renameFolder(id: string, name: string): Promise<void>;
  deleteFolder(id: string): Promise<void>;
}

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { "content-type": "application/json", ...(init?.headers ?? {}) }, cache: "no-store" });
  const body = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw Object.assign(new Error(body.error ?? `http ${res.status}`), { status: res.status, code: body.error });
  return body;
}

export async function accountState(): Promise<AccountState> {
  try {
    return await call<AccountState>("/api/account");
  } catch {
    return { accounts: false, user: null };
  }
}

export const account = {
  signup: (username: string, password: string) => call<{ user: { username: string } }>("/api/account", { method: "POST", body: JSON.stringify({ action: "signup", username, password }) }),
  login: (username: string, password: string) => call<{ user: { username: string } }>("/api/account", { method: "POST", body: JSON.stringify({ action: "login", username, password }) }),
  logout: () => call("/api/account", { method: "POST", body: JSON.stringify({ action: "logout" }) }),
  remove: () => call("/api/account", { method: "DELETE" }),
};

export const remoteStore: RunStore = {
  kind: "remote",
  list: () => call("/api/runs"),
  get: async (id) => (await call<{ run: StoredRun }>(`/api/runs/${encodeURIComponent(id)}`).catch(() => null))?.run ?? null,
  save: async (run) => {
    await call("/api/runs", { method: "POST", body: JSON.stringify(run) });
  },
  move: async (id, folderId) => (await call<{ run: StoredRun }>(`/api/runs/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify({ folderId }) })).run,
  decide: async (id, n, d) => (await call<{ run: StoredRun }>(`/api/runs/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify({ decision: { n, d } }) })).run,
  remove: async (id) => {
    await call(`/api/runs/${encodeURIComponent(id)}`, { method: "DELETE" });
  },
  createFolder: async (name) => (await call<{ folder: Folder }>("/api/folders", { method: "POST", body: JSON.stringify({ name }) })).folder,
  renameFolder: async (id, name) => {
    await call(`/api/folders/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify({ name }) });
  },
  deleteFolder: async (id) => {
    await call(`/api/folders/${encodeURIComponent(id)}`, { method: "DELETE" });
  },
};

// ── This browser ─────────────────────────────────────────────────────────
const KEY = "mizan-dashboard-v1";
type LocalData = { runs: StoredRun[]; folders: Folder[] };
let memory: LocalData = { runs: [], folders: [] };

function load(): LocalData {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) memory = JSON.parse(raw) as LocalData;
  } catch {
    // Storage blocked (private mode): the in-memory copy lasts for this page.
  }
  memory.runs = (memory.runs ?? []).filter((r) => !expired(r.createdAt));
  memory.folders = memory.folders ?? [];
  return memory;
}
function persist(d: LocalData) {
  memory = d;
  try {
    localStorage.setItem(KEY, JSON.stringify(d));
  } catch {
    // See load().
  }
}
const newId = () => crypto.randomUUID();

export const localStore: RunStore = {
  kind: "local",
  list: async () => {
    const d = load();
    return { runs: [...d.runs].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(summarize), folders: d.folders };
  },
  get: async (id) => load().runs.find((r) => r.id === id) ?? null,
  save: async (run) => {
    const d = load();
    const clean = toStoredRun(run);
    if (clean.audit.length === 0) clean.audit = [{ at: clean.createdAt, kind: "reviewed", detail: clean.engine }];
    persist({ ...d, runs: [clean, ...d.runs.filter((r) => r.id !== clean.id)].slice(0, 200) });
  },
  move: async (id, folderId) => {
    const d = load();
    const run = d.runs.find((r) => r.id === id);
    if (!run) return null;
    run.folderId = folderId && d.folders.some((f) => f.id === folderId) ? folderId : null;
    run.audit.push({ at: new Date().toISOString(), kind: "moved", detail: run.folderId ?? "" });
    persist(d);
    return run;
  },
  decide: async (id, n, dec) => {
    const d = load();
    const run = d.runs.find((r) => r.id === id);
    if (!run || (dec !== null && !DECISIONS.includes(dec))) return null;
    const at = new Date().toISOString();
    if (dec === null) delete run.decisions[String(n)];
    else run.decisions[String(n)] = { d: dec, at };
    run.audit.push({ at, kind: "decision", detail: `${n}:${dec ?? "clear"}` });
    persist(d);
    return run;
  },
  remove: async (id) => {
    const d = load();
    persist({ ...d, runs: d.runs.filter((r) => r.id !== id) });
  },
  createFolder: async (name) => {
    const d = load();
    const folder = { id: newId(), name };
    persist({ ...d, folders: [...d.folders, folder] });
    return folder;
  },
  renameFolder: async (id, name) => {
    const d = load();
    persist({ ...d, folders: d.folders.map((f) => (f.id === id ? { ...f, name } : f)) });
  },
  deleteFolder: async (id) => {
    const d = load();
    persist({ folders: d.folders.filter((f) => f.id !== id), runs: d.runs.map((r) => (r.folderId === id ? { ...r, folderId: null } : r)) });
  },
};

/** Signed in: the account. Otherwise: this browser. */
export async function pickStore(): Promise<{ store: RunStore; state: AccountState }> {
  const state = await accountState();
  return { store: state.accounts && state.user ? remoteStore : localStore, state };
}

/** After sign-in: move this browser's saved reviews and folders into the account, then clear them. */
export async function moveLocalToAccount(): Promise<number> {
  const d = load();
  const folderMap = new Map<string, string>();
  for (const f of d.folders) folderMap.set(f.id, (await remoteStore.createFolder(f.name)).id);
  let moved = 0;
  for (const run of d.runs) {
    try {
      await remoteStore.save({ ...run, folderId: run.folderId ? folderMap.get(run.folderId) ?? null : null });
      moved++;
    } catch {
      // Already there (same run id) or rejected: leave it.
    }
  }
  persist({ runs: [], folders: [] });
  return moved;
}

export const hasLocalRuns = () => load().runs.length > 0;
