// server-only: imported by node tests
import type { ClauseResult, Flag, Verdict } from "@/lib/review-types";
import type { Corpus } from "./corpus";
import { normalize } from "./normalize";
import type { Judgement } from "./schemas";

const MIN_QUOTE = 12;
const ROLE_RANK: Record<Judgement["citations"][number]["role"], number> = { governs: 0, supports: 1, related: 2 };
/** Binding-language markers that distinguish a real affirmation from a mere bibliographic mention. */
const AFFIRM_KEYWORD = /الضوابط|يلتزم|وفق|بموجب/;

/** A «…», "…" or “…” span in a reason. */
const QUOTED = /«([^«»]*)»|"([^"]*)"|“([^“”]*)”/g;

/** A reason may only put quotation marks around words that really are in a displayed unit's text.
 *  Any other quoted span keeps its words and loses its marks, so the reader never sees an
 *  invented "quotation" next to the verified ones. */
function scrubQuotes(reason: string, hays: string[]): string {
  return reason.replace(QUOTED, (whole: string, a?: string, b?: string, d?: string) => {
    const inner = a ?? b ?? d ?? "";
    const n = normalize(inner);
    return n && hays.some((h) => h.includes(n)) ? whole : inner;
  });
}

/** Map a normalized match back to the unit's verbatim text, so the UI never shows the model's copy. */
function verbatimSpan(text: string, quote: string): string | null {
  const nq = normalize(quote);
  if (nq.length < MIN_QUOTE) return null;
  // Build the normalized text with an index map back to the original.
  const map: number[] = [];
  let norm = "";
  let lastSpace = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === "ـ" || /[ً-ْ]/.test(ch)) continue;
    const out = /[إأآ]/.test(ch) ? "ا" : /\s/.test(ch) ? " " : ch;
    if (out === " " && lastSpace) continue;
    lastSpace = out === " ";
    norm += out;
    map.push(i);
  }
  const at = norm.indexOf(nq);
  if (at < 0) return null;
  let end = map[at + nq.length - 1] + 1;
  // A trailing diacritic (e.g. tanween) was stripped from the normalized match; restore it for display, but never a trailing tatweel.
  while (end < text.length && /[ً-ْ]/.test(text[end])) end++;
  return text.slice(map[at], end);
}

/** True when decision `later`'s operative text cites `earlier` alongside binding language, not merely a bibliographic mention. */
function affirms(corpus: Corpus, later: number, earlier: number): boolean {
  const d = corpus.decisions.get(later);
  if (!d) return false;
  const operative = `${d.title}. ${d.text.split("قررت").at(-1) ?? ""}`;
  const ref = new RegExp(`القرار\\s*\\(0*${earlier}\\)`);
  return operative.split(/[.؛\n]/).some((s) => ref.test(s) && AFFIRM_KEYWORD.test(s));
}

export function verifyJudgement(
  corpus: Corpus, n: number, clause: string, candidates: string[], j: Judgement,
): { result: ClauseResult; verbatim: boolean } {
  const allowed = new Set(candidates);
  const marks: Record<string, string[]> = {};
  const roleOf = new Map<string, Judgement["citations"][number]["role"]>();
  const order: string[] = [];
  let dropped = 0;
  for (const cit of j.citations) {
    const unit = allowed.has(cit.id) ? corpus.byId.get(cit.id) : undefined;
    const span = unit ? verbatimSpan(unit.text, cit.quote) : null;
    if (!unit || !span) { dropped++; continue; }
    const existing = marks[cit.id];
    if (!existing) marks[cit.id] = [span];
    else if (!existing.includes(span)) existing.push(span);
    if (!roleOf.has(cit.id)) { roleOf.set(cit.id, cit.role); order.push(cit.id); }
    else if (ROLE_RANK[cit.role] < ROLE_RANK[roleOf.get(cit.id)!]) roleOf.set(cit.id, cit.role);
  }
  // Fail safe: a unit with no enrichment row, or one that is AAOIFI-only, never grounds compliant/nonCompliant.
  const isRule = (id: string) => {
    const e = corpus.enrichment.get(id);
    return e !== undefined && (e.kind === "prohibition" || e.kind === "condition") && !e.aaoifi_only;
  };
  // Ruling (2026-10-01): a unit that explicitly permits what the clause does can ground «مطابق»,
  // never «مخالف». So for a compliant judgement a permission unit counts as rule-governing too.
  const grounds = (id: string) => {
    if (isRule(id)) return true;
    const e = corpus.enrichment.get(id);
    return j.verdict === "compliant" && e?.kind === "permission" && !e.aaoifi_only;
  };
  // Display order (the UI stamps citations[0]): rule-governing units first, then other governs,
  // then supports, then related. Array.prototype.sort is stable, so ties keep the judge's order.
  const rank = (k: { id: string; role: Judgement["citations"][number]["role"] }) =>
    k.role === "governs" ? (grounds(k.id) ? 0 : 1) : 1 + ROLE_RANK[k.role];
  const verified = order.map((id) => ({ id, role: roleOf.get(id)! })).sort((a, b) => rank(a) - rank(b));
  // Spec §5.3: an AAOIFI-only unit defers to an external standard without stating the rule, so it
  // is never displayed as evidence; when such units are the only rule-governing ones, abstain.
  const isAaoifi = (id: string) => corpus.enrichment.get(id)?.aaoifi_only === true;
  const aaoifiGoverning = verified.filter((k) => k.role === "governs" && isAaoifi(k.id));
  const kept = verified.filter((k) => !isAaoifi(k.id));

  const governing = kept.filter((k) => k.role === "governs");
  const ruleGoverning = governing.filter((k) => grounds(k.id));

  const flags: Flag[] = [];
  const affirmedBy: Record<string, number[]> = {};
  for (const g of governing) {
    const dno = corpus.byId.get(g.id)!.decision_no;
    const later = (corpus.citedBy.get(dno) ?? []).filter((x) => x > dno);
    const amending = later.filter((x) => corpus.amends(x, dno));
    if (amending.length) flags.push({ kind: "superseded", detail: `${g.id} ← ${amending.join(",")}` });
    const affirming = later.filter((x) => !corpus.amends(x, dno) && affirms(corpus, x, dno));
    if (affirming.length) affirmedBy[g.id] = affirming.sort((a, b) => b - a).slice(0, 3);
  }

  let verdict: Verdict = j.verdict;
  if (verdict === "nonCompliant" || verdict === "compliant") {
    if (ruleGoverning.length === 0) verdict = kept.length ? "review" : "abstain";
    else if (!j.scope_applies) verdict = "review";
  }
  if (verdict === "review" && kept.length === 0) verdict = "abstain";
  if (aaoifiGoverning.length > 0 && ruleGoverning.length === 0) verdict = "abstain";
  if (flags.some((f) => f.kind === "superseded") && (verdict === "nonCompliant" || verdict === "compliant")) verdict = "review";

  const abstain = verdict === "abstain";
  const shown = abstain ? [] : kept.map((k) => k.id);
  const hays = shown.map((id) => normalize(corpus.byId.get(id)!.text));
  const result: ClauseResult = {
    n,
    text: { ar: clause, en: clause },
    verdict,
    citations: shown,
    reason: { ar: scrubQuotes(j.reason_ar, hays), en: scrubQuotes(j.reason_en, hays) },
    marks: abstain ? {} : Object.fromEntries(kept.map((k) => [k.id, marks[k.id]])),
    suggestion: verdict === "nonCompliant" && j.suggestion_ar ? { ar: j.suggestion_ar, en: j.suggestion_en ?? j.suggestion_ar } : undefined,
    flags: abstain || !flags.length ? undefined : flags,
    affirmedBy: abstain || !Object.keys(affirmedBy).length ? undefined : affirmedBy,
    roles: abstain ? undefined : Object.fromEntries(kept.map((k) => [k.id, k.role])),
  };
  return { result, verbatim: dropped === 0 && kept.length > 0 };
}
