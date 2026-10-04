// Client-safe types shared by the UI, the demo engine and the server engine.
export type Verdict = "nonCompliant" | "review" | "abstain" | "compliant";
export type L = { ar: string; en: string };
export type Flag = { kind: "superseded" | "error" | "truncated" | "approved_form"; detail: string };

/** A cited unit with its decision's provenance: the quote block's source of truth on the client. */
export type CitationUnit = {
  id: string;
  decisionNo: number;
  section: string;
  item: number | null;
  text: string;
  context: string | null;
  title: string;
  dateHijri: string;
  dateGregorian: string;
  session: string;
  year: number;
};

export type ClauseResult = {
  n: number;
  text: L;
  verdict: Verdict;
  citations: string[];
  reason: L;
  /** Passages of each cited unit that match the clause (verified literal substrings). */
  marks?: Record<string, string[]>;
  suggestion?: L;
  flags?: Flag[];
  /** Later decisions that re-affirm a cited unit's decision. */
  affirmedBy?: Record<string, number[]>;
  /** The cited units themselves, attached by the server engine (keyed by unit id). */
  units?: Record<string, CitationUnit>;
  /** Each cited unit's role: governs the clause, supports the finding, or is related evidence. */
  roles?: Record<string, "governs" | "supports" | "related">;
  /** Clause numbers the clause was judged together with (its intro, its items, a clause it cites). */
  related?: number[];
};

/** What a split segment is: a clause, an intro to the clauses after it, or text that is not a clause. */
export type SegmentKind = "clause" | "intro" | "other";
export type OtherType = "title" | "source" | "separator" | "parties" | "definition" | "signature" | "fragment" | "note";

export type ReviewEvent =
  | { type: "clause"; n: number; text: L; kind?: SegmentKind; otherType?: OtherType | null; context?: number[] }
  | { type: "result"; result: ClauseResult; verbatim: boolean }
  | { type: "notice"; message: L }
  | { type: "error"; message: L }
  | { type: "done" };

export const PRIORITY: Verdict[] = ["nonCompliant", "review", "abstain", "compliant"];
