// server-only: imported by node tests
// Contracts and forms the committee approved by name, read from the corpus itself, so a decision
// added later is picked up with no code change.
//
// Two kinds, handled differently by the pipeline:
// - unified: a regulator-mandated standard contract (the approval says it was requested «بناءً على
//   متطلبات الجهات التنظيمية… العقود الموحدة»). Its text is the same at every bank, so a document
//   titled with its name is very likely that text. A «مخالف» resting on a decision older than the
//   approval is escalated to review: the committee approved the form after that rule.
// - the bank's own form (e.g. «عقد بيع سيارة بالتقسيط»): anyone can write a contract with that
//   title and different terms, so the reader only gets a notice; verdicts are untouched.
import type { Corpus } from "./corpus";
import { normalize } from "./normalize";

export type ApprovedForm = {
  name: string;
  /** Normalized spellings to look for: «سيارة\سيارات» yields one per side. */
  variants: string[];
  /** The latest decision that approved or amended a form with this name. */
  decision: number;
  year: number | null;
  unified: boolean;
};

/** «عقود التمويل العقاري الموحدة», «الاتفاقية الإطارية الموحدة»: a standard contract, not merely an
 *  amendment made «بناءً على متطلبات الجهات التنظيمية» (that wording also covers bank-own forms). */
const UNIFIED = /(?:عقود|عقد|العقود|الاتفاقية|اتفاقية)\s+(?:\S+\s+){0,4}الموحدة/;
const APPROVAL_TITLE = /^\s*(?:إجازة|تعديل)/;
/** Shorter names (e.g. «نموذج», «التسليم») are too generic to identify a document. */
const MIN_NAME = 14;
/** The title is looked for in the opening of the document only. */
const OPENING_CHARS = 300;

const squash = (s: string) => normalize(s).replace(/[^\p{L}\p{N}\\]+/gu, " ").trim();

function variants(name: string): string[] {
  const words = squash(name).split(" ");
  let out = [""];
  for (const w of words) {
    const alts = w.includes("\\") ? w.split("\\").filter(Boolean) : [w];
    out = out.flatMap((prefix) => alts.map((a) => (prefix ? `${prefix} ${a}` : a)));
  }
  // An ijara contract titled without its rent type («عقد تمويل عقاري بصيغة الإجارة», as the regulator
  // titles it) stands for both the fixed- and the variable-rent approvals.
  const bare = out.map((v) => v.replace(/ باجرة \S+$/, "")).filter((v) => v.length >= MIN_NAME);
  return [...new Set([...out, ...bare])];
}

const cache = new WeakMap<Corpus, ApprovedForm[]>();

export function approvedForms(corpus: Corpus): ApprovedForm[] {
  const hit = cache.get(corpus);
  if (hit) return hit;
  const byName = new Map<string, ApprovedForm>();
  for (const d of corpus.decisions.values()) {
    if (!APPROVAL_TITLE.test(d.title)) continue;
    const unified = UNIFIED.test(`${d.title} ${d.preamble ?? ""}`);
    const year = Number(d.date_gregorian?.match(/(\d{4})\s*$/)?.[1]) || null;
    for (const m of d.title.matchAll(/["«“]([^"»”]+)["»”]/g)) {
      const name = m[1].trim();
      if (squash(name).length < MIN_NAME) continue;
      const prev = byName.get(name);
      byName.set(name, {
        name,
        variants: variants(name),
        decision: prev && prev.decision > d.decision_no ? prev.decision : d.decision_no,
        year: prev && prev.decision > d.decision_no ? prev.year : year,
        // A name is unified once any decision approving or amending it says so.
        unified: (prev?.unified ?? false) || unified,
      });
    }
  }
  const forms = [...byName.values()];
  cache.set(corpus, forms);
  return forms;
}

/** The approved form whose name opens the document (the longest one when several match). */
export function matchApprovedForm(corpus: Corpus, doc: string): ApprovedForm | null {
  const opening = squash(doc.slice(0, OPENING_CHARS));
  let best: ApprovedForm | null = null;
  let bestLen = 0;
  for (const f of approvedForms(corpus))
    for (const v of f.variants)
      if (v.length > bestLen && opening.includes(v)) { best = f; bestLen = v.length; }
  return best;
}
