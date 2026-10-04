// What a saved review keeps (Mazen's decision, 2026-10-02: the file name and the clause results,
// never the file). `toStoredRun` is the only way into storage, browser or server: it whitelists
// fields and cuts each clause to a short masked excerpt, so the full contract text cannot be stored.
import { isContractId, isRunId } from "./ids";
import type { CitationUnit, ClauseResult, L, Verdict } from "./review-types";

/** At most this many characters of each (already masked) clause are kept, to recognise it later. */
export const EXCERPT_CHARS = 160;
/** Saved reviews are deleted after this many days (sooner, whenever the user deletes them). */
export const RETENTION_DAYS = 90;

/** Bumped whenever the engine's judging changes (prompts, gate rules, corpus, model). A saved
 *  result is only replayed for the same text under the same version. */
export const ENGINE_VERSION = "2026-10-02.2";

export type Decision = "approve" | "reject" | "refer";
export const DECISIONS: Decision[] = ["approve", "reject", "refer"];

export type StoredClause = {
  n: number;
  excerpt: string;
  verdict: Verdict;
  citations: string[];
  reason: L;
  suggestion?: L;
  flags?: { kind: string; detail: string }[];
  marks?: Record<string, string[]>;
  units?: Record<string, CitationUnit>;
  affirmedBy?: Record<string, number[]>;
  roles?: Record<string, "governs" | "supports" | "related">;
  related?: number[];
  verbatim: boolean;
};

export type AuditEvent = { at: string; kind: "reviewed" | "decision" | "moved"; detail: string };

/** Where each part of the contract sits in the (masked, whitespace-collapsed) text, and what it
 *  is. Offsets only, never text: with them a re-upload of the very same contract replays the same
 *  parts and results (mentor feedback 2026-10-02: the same contract must give the same answer). */
export type LayoutPart = { n: number; span: [number, number]; kind?: "clause" | "intro" | "other"; otherType?: string; context?: number[] };

export type StoredRun = {
  id: string;
  contractId: string;
  fileName: string;
  createdAt: string;
  engine: "live" | "offline";
  demo: boolean;
  folderId: string | null;
  clauses: StoredClause[];
  decisions: Record<string, { d: Decision; at: string }>;
  audit: AuditEvent[];
  /** SHA-256 of the masked, whitespace-collapsed text the engine reviewed (not the text itself). */
  textHash?: string;
  engineVersion?: string;
  layout?: LayoutPart[];
};

export type RunSummary = Pick<StoredRun, "id" | "contractId" | "fileName" | "createdAt" | "engine" | "demo" | "folderId"> & {
  tally: Record<Verdict, number>;
  decided: number;
};

export type Folder = { id: string; name: string };

const VERDICTS: Verdict[] = ["nonCompliant", "review", "abstain", "compliant"];
const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");
const lang = (v: unknown, max = 4000): L | undefined => {
  if (!v || typeof v !== "object") return undefined;
  const o = v as Record<string, unknown>;
  return { ar: str(o.ar, max), en: str(o.en, max) };
};

export const excerpt = (text: string) => {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length > EXCERPT_CHARS ? `${t.slice(0, EXCERPT_CHARS - 1)}…` : t;
};

/** The clause rows a review produced, as the UI holds them. */
export type ReviewedRow = { n: number; text: string; result?: ClauseResult; verbatim?: boolean };

export function storedClause(row: ReviewedRow): StoredClause | null {
  const r = row.result;
  if (!r || !VERDICTS.includes(r.verdict)) return null;
  const citations = Array.isArray(r.citations) ? r.citations.filter((c) => typeof c === "string").slice(0, 12) : [];
  const units: Record<string, CitationUnit> = {};
  for (const id of citations) {
    const u = r.units?.[id];
    if (u) units[id] = { ...u, text: str(u.text, 4000), context: u.context ? str(u.context, 2000) : null };
  }
  return {
    n: Math.trunc(Number(row.n)) || 0,
    excerpt: excerpt(String(row.text ?? "")),
    verdict: r.verdict,
    citations,
    reason: lang(r.reason) ?? { ar: "", en: "" },
    suggestion: lang(r.suggestion),
    flags: r.flags?.slice(0, 8).map((f) => ({ kind: str(f.kind, 40), detail: str(f.detail, 200) })),
    marks: r.marks
      ? Object.fromEntries(Object.entries(r.marks).filter(([id]) => citations.includes(id)).map(([id, m]) => [id, (m ?? []).slice(0, 8).map((x) => str(x, 600))]))
      : undefined,
    units: Object.keys(units).length ? units : undefined,
    affirmedBy: r.affirmedBy,
    roles: r.roles
      ? Object.fromEntries(Object.entries(r.roles).filter(([id, v]) => citations.includes(id) && ["governs", "supports", "related"].includes(v)))
      : undefined,
    related: Array.isArray(r.related) ? r.related.filter((x) => Number.isInteger(x)).slice(0, 12) : undefined,
    verbatim: Boolean(row.verbatim),
  };
}

/** Whitelist and bound a run before it is stored anywhere. Throws on anything malformed. */
export function toStoredRun(input: unknown): StoredRun {
  if (!input || typeof input !== "object") throw new Error("run: not an object");
  const o = input as Record<string, unknown>;
  const id = str(o.id, 20);
  const contract = str(o.contractId, 20);
  if (!isRunId(id) || !isContractId(contract)) throw new Error("run: bad ids");
  const clauses = Array.isArray(o.clauses) ? (o.clauses as unknown[]).slice(0, 200) : [];
  const kept: StoredClause[] = [];
  for (const c of clauses) {
    const cc = c as StoredClause;
    // Re-run the clause through storedClause so that even a hand-made request gets the same cuts.
    const s = storedClause({ n: cc.n, text: cc.excerpt, verbatim: cc.verbatim, result: { ...(cc as unknown as ClauseResult), text: { ar: "", en: "" } } });
    if (s) kept.push(s);
  }
  if (kept.length === 0) throw new Error("run: no clauses");
  const decisions: StoredRun["decisions"] = {};
  if (o.decisions && typeof o.decisions === "object")
    for (const [n, v] of Object.entries(o.decisions as Record<string, { d?: unknown; at?: unknown }>))
      if (DECISIONS.includes(v?.d as Decision)) decisions[String(Math.trunc(Number(n)))] = { d: v.d as Decision, at: str(v.at, 40) };
  const audit = Array.isArray(o.audit)
    ? (o.audit as AuditEvent[]).slice(-200).filter((e) => ["reviewed", "decision", "moved"].includes(e?.kind)).map((e) => ({ at: str(e.at, 40), kind: e.kind, detail: str(e.detail, 200) }))
    : [];
  return {
    id,
    contractId: contract,
    fileName: str(o.fileName, 200) || "—",
    createdAt: str(o.createdAt, 40) || new Date().toISOString(),
    engine: o.engine === "live" ? "live" : "offline",
    demo: Boolean(o.demo),
    folderId: typeof o.folderId === "string" && o.folderId ? str(o.folderId, 40) : null,
    clauses: kept,
    decisions,
    audit,
    textHash: typeof o.textHash === "string" && /^[0-9a-f]{64}$/.test(o.textHash) ? o.textHash : undefined,
    engineVersion: typeof o.engineVersion === "string" ? str(o.engineVersion, 40) : undefined,
    layout: Array.isArray(o.layout)
      ? (o.layout as LayoutPart[]).slice(0, 400).flatMap((x) => {
          const n = Math.trunc(Number(x?.n));
          const a = Math.trunc(Number(x?.span?.[0]));
          const b = Math.trunc(Number(x?.span?.[1]));
          if (!(n > 0) || !(a >= 0) || !(b > a)) return [];
          const kind = x.kind === "intro" || x.kind === "other" ? x.kind : "clause";
          return [{ n, span: [a, b] as [number, number], kind, otherType: x.otherType ? str(x.otherType, 20) : undefined, context: Array.isArray(x.context) ? x.context.map(Number).filter((v) => v > 0).slice(0, 8) : undefined }];
        })
      : undefined,
  };
}

/** The text the engine sees, whitespace collapsed: spans in `layout` index into this. */
export const flatText = (t: string) => t.replace(/\s+/g, " ").trim();

export async function textHash(text: string): Promise<string> {
  const d = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(flatText(text))));
  return [...d].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Spans of each part inside the flattened text, in order; null when any part cannot be located
 *  (then the run is saved without a layout and is never replayed). */
export function layoutOf(text: string, parts: { n: number; text: string; kind?: string; otherType?: string | null; context?: number[] }[]): LayoutPart[] | null {
  const hay = flatText(text);
  const out: LayoutPart[] = [];
  let from = 0;
  for (const p of parts) {
    const needle = flatText(p.text);
    if (!needle) return null;
    let at = hay.indexOf(needle, from);
    if (at < 0) at = hay.indexOf(needle);
    if (at < 0) return null;
    out.push({ n: p.n, span: [at, at + needle.length], kind: p.kind === "intro" || p.kind === "other" ? p.kind : "clause", otherType: p.otherType ?? undefined, context: p.context });
    from = at + needle.length;
  }
  return out;
}

/** A stored clause back into the shape the review UI renders. */
export function toClauseResult(c: StoredClause, text: string): ClauseResult {
  return { n: c.n, text: { ar: text, en: text }, verdict: c.verdict, citations: c.citations, reason: c.reason, suggestion: c.suggestion, flags: c.flags as ClauseResult["flags"], marks: c.marks, units: c.units, affirmedBy: c.affirmedBy, roles: c.roles, related: c.related };
}

export function summarize(run: StoredRun): RunSummary {
  const tally: Record<Verdict, number> = { nonCompliant: 0, review: 0, abstain: 0, compliant: 0 };
  run.clauses.forEach((c) => tally[c.verdict]++);
  return {
    id: run.id,
    contractId: run.contractId,
    fileName: run.fileName,
    createdAt: run.createdAt,
    engine: run.engine,
    demo: run.demo,
    folderId: run.folderId,
    tally,
    decided: Object.keys(run.decisions).length,
  };
}

export const expired = (createdAt: string, now = Date.now()) => now - Date.parse(createdAt) > RETENTION_DAYS * 86_400_000;
