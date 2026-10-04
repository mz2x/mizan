// Pure helpers for the team test set (tools/eval/team.ts): reading the team's answer key, aligning
// its labeled clauses with the clauses the engine split a contract into, the team-set metrics, and
// the review sheet. No llm calls and no file I/O here, so all of it is tested.
import { normalize, tokenize } from "../../src/server/engine/normalize";
import type { Verdict } from "./lib";

/** The answer key's four labels, as `build_tests.py` writes them in `labels`. */
export type Label = "ok" | "bad" | "review" | "procedural";

export type KeyClause = {
  contract: string;
  kind: string;
  clause: string;
  text: string;
  expected: string;
  units: string[];
  reason: string;
  term_gap: boolean;
};
export type KeyContract = { id: string; file: string; kind: string; type: string };
export type Key = { labels: Record<Label, string>; contracts: KeyContract[]; clauses: KeyClause[] };

/** Map an Arabic label from the key back to its code. Throws on a label the key does not define. */
export function labelOf(key: Key, expected: string): Label {
  const hit = (Object.keys(key.labels) as Label[]).find((k) => key.labels[k] === expected);
  if (!hit) throw new Error(`unknown label in answer key: ${JSON.stringify(expected)}`);
  return hit;
}

/** «يحتاج مراجعة بشرية» means the engine must not issue a decisive verdict: both of Mizan's
 *  withholding outcomes («تحتاج مراجعة» and «لا يوجد سند كافٍ») count as correct. */
export function isCorrect(label: Label, verdict: Verdict | null): boolean {
  if (verdict === null) return false;
  if (label === "ok") return verdict === "compliant";
  if (label === "bad") return verdict === "nonCompliant";
  if (label === "review") return verdict === "review" || verdict === "abstain";
  return false;
}

/** The label a Mizan verdict corresponds to (used when the team rules «ميزان صح»). */
export function labelForVerdict(v: Verdict): Exclude<Label, "procedural"> {
  return v === "compliant" ? "ok" : v === "nonCompliant" ? "bad" : "review";
}

export type Pred = { verdict: Verdict; citations: string[] };
/** One scored clause: its label, the key's governing units, and Mizan's prediction (null when the
 *  end-to-end run never produced a clause containing it). */
export type Row = { label: Exclude<Label, "procedural">; units: string[]; termGap: boolean; pred: Pred | null };

export type TeamMetrics = {
  n: number;
  /** Of the clauses the key marks «مخالف», the share Mizan flagged «يُرجَّح عدم مطابقته». */
  recall: number | null;
  /** Of the clauses Mizan flagged, the share the key marks «مخالف». */
  precision: number | null;
  /** Of the clauses the key marks «يحتاج مراجعة», the share where Mizan withheld a decisive verdict. */
  withholding: number | null;
  /** Of the clauses the key marks «مطابق», the share Mizan judged «مطابق». */
  compliantRecall: number | null;
  /** Of the clauses the key marks «مطابق», the share Mizan flagged as non-compliant (false alarm). */
  falseAlarm: number | null;
  /** Of the clauses with a governing unit in the key that Mizan did not abstain on, the share whose
   *  first citation is one of the key's units. */
  citation: number | null;
  /** Share of all scored clauses where Mizan's verdict matches the key. */
  agreement: number | null;
  /** Recall on the «مخالف» clauses written without the decision's own term (term gap). */
  termGapRecall: number | null;
};

const share = (a: number, b: number): number | null => (b ? a / b : null);

export function teamMetrics(rows: Row[]): TeamMetrics {
  const v = (r: Row) => r.pred?.verdict ?? null;
  const bad = rows.filter((r) => r.label === "bad");
  const ok = rows.filter((r) => r.label === "ok");
  const rev = rows.filter((r) => r.label === "review");
  const flagged = rows.filter((r) => v(r) === "nonCompliant");
  const cited = rows.filter((r) => r.units.length && r.pred && r.pred.verdict !== "abstain");
  const gap = bad.filter((r) => r.termGap);
  return {
    n: rows.length,
    recall: share(bad.filter((r) => v(r) === "nonCompliant").length, bad.length),
    precision: share(flagged.filter((r) => r.label === "bad").length, flagged.length),
    withholding: share(rev.filter((r) => isCorrect("review", v(r))).length, rev.length),
    compliantRecall: share(ok.filter((r) => v(r) === "compliant").length, ok.length),
    falseAlarm: share(ok.filter((r) => v(r) === "nonCompliant").length, ok.length),
    citation: share(cited.filter((r) => r.units.includes(r.pred!.citations[0])).length, cited.length),
    agreement: share(rows.filter((r) => isCorrect(r.label, v(r))).length, rows.length),
    termGapRecall: share(gap.filter((r) => v(r) === "nonCompliant").length, gap.length),
  };
}

const squash = (s: string) => normalize(s).replace(/[^\p{L}\p{N}]+/gu, " ").trim();

/** Where each key anchor landed among the engine's clauses. `exact`: the anchor's text is contained
 *  in that clause. Otherwise the clause sharing the most anchor tokens is taken when it covers at
 *  least 60% of them (`exact: false`, the anchor was cut across clauses); else not found (-1). */
export function align(engineClauses: string[], anchors: string[]): { index: number; exact: boolean }[] {
  const hay = engineClauses.map(squash);
  const toks = engineClauses.map((c) => new Set(tokenize(c)));
  return anchors.map((a) => {
    const needle = squash(a);
    const exact = needle ? hay.findIndex((h) => h.includes(needle)) : -1;
    if (exact >= 0) return { index: exact, exact: true };
    const at = tokenize(a);
    if (!at.length) return { index: -1, exact: false };
    let best = -1, bestShare = 0;
    toks.forEach((t, i) => {
      const s = at.filter((x) => t.has(x)).length / at.length;
      if (s > bestShare) { bestShare = s; best = i; }
    });
    return bestShare >= 0.6 ? { index: best, exact: false } : { index: -1, exact: false };
  });
}

/** Deterministic sample (mulberry32), so the review sheet is reproducible for the same run. */
export function seededSample<T>(arr: T[], k: number, seed: number): T[] {
  let a = seed >>> 0;
  const rnd = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, k);
}

/** CSV with a UTF-8 BOM so Excel opens Arabic text correctly. */
export function toCsv(rows: string[][]): string {
  const cell = (s: string) => (/[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  return "﻿" + rows.map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";
}

/** Parse the CSV `toCsv` writes (quoted cells, doubled quotes, CRLF), BOM tolerated. */
export function parseCsv(text: string): string[][] {
  const s = text.replace(/^﻿/, "");
  const rows: string[][] = [];
  let row: string[] = [], cur = "", q = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (q) {
      if (ch === '"' && s[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') q = false;
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") { row.push(cur); cur = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && s[i + 1] === "\n") i++;
      row.push(cur); rows.push(row); row = []; cur = "";
    } else cur += ch;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  return rows;
}

/** The three answers the team can give on the review sheet. */
export const DECISIONS = { key: "المفتاح صح", mizan: "ميزان صح", unclear: "محل نظر" } as const;

/** Apply the team's rulings to rows: «ميزان صح» relabels the row to Mizan's verdict, «محل نظر»
 *  drops it, «المفتاح صح» or a blank cell keeps the key's label. */
export function adjudicate(rows: (Row & { id: string })[], rulings: Map<string, string>): Row[] {
  return rows.flatMap((r) => {
    const d = rulings.get(r.id)?.trim();
    if (d === DECISIONS.unclear) return [];
    if (d === DECISIONS.mizan && r.pred) return [{ ...r, label: labelForVerdict(r.pred.verdict) }];
    return [r];
  });
}
