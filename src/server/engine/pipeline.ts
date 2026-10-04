// server-only: imported by node tests
import type { CitationUnit, ClauseResult, ReviewEvent } from "@/lib/review-types";
import { buildIndex, search, type Bm25Index } from "./bm25";
import { loadCorpus, type Corpus } from "./corpus";
import { judgeClause } from "./judge";
import type { LlmCall, Usage } from "./llm";
import { buildQuery } from "./query";
import { splitClauses } from "./split";
import { verifyJudgement } from "./verify";
import { matchApprovedForm } from "./approved";
import { redact } from "@/lib/redact";
import { classifySegments, type Segment } from "./structure";

// Keyed by corpus identity (not a string) so distinct Corpus instances (e.g. per-test fixtures)
// never collide and the cache never outlives the corpus object itself.
type IndexKind = "enriched" | "plain" | "plainNoApproval";
const indexes = new WeakMap<Corpus, Map<IndexKind, Bm25Index>>();
const indexFor = (corpus: Corpus, kind: IndexKind) => {
  let perCorpus = indexes.get(corpus);
  if (!perCorpus) {
    perCorpus = new Map();
    indexes.set(corpus, perCorpus);
  }
  let idx = perCorpus.get(kind);
  if (!idx) {
    idx = buildIndex(corpus, { enriched: kind === "enriched", excludeApproval: kind === "plainNoApproval" });
    perCorpus.set(kind, idx);
  }
  return idx;
};

/** Order-preserving de-dup for the hybrid candidate list: first occurrence wins, so concatenating
 *  the enriched hits before the plain hits keeps the enriched ranking for any id both lists find. */
function dedupe(ids: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids) {
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

/** The client cannot read the corpus, so every cited unit travels with its result: the quote
 *  text (unit `text` only, never enrichment) and its decision's provenance. */
export function citedUnits(corpus: Corpus, ids: string[]): Record<string, CitationUnit> {
  const out: Record<string, CitationUnit> = {};
  for (const id of ids) {
    const u = corpus.byId.get(id);
    if (!u) continue;
    const d = corpus.decisions.get(u.decision_no);
    out[id] = {
      id: u.id,
      decisionNo: u.decision_no,
      section: u.section,
      item: u.item,
      text: u.text,
      context: u.context,
      title: u.title,
      dateHijri: d?.date_hijri ?? "",
      dateGregorian: d?.date_gregorian ?? "",
      session: d?.session ?? "",
      year: u.year,
    };
  }
  return out;
}

/** Escalation result used both when the judge call fails cleanly (`ok: false`) and when the
 *  clause's review throws (e.g. a thrown network error) — same verdict, same reason, same flag
 *  shape, so a crash and a typed failure are indistinguishable to the stream's consumer. */
function escalate(n: number, clause: string, detail: string): { result: ClauseResult; verbatim: boolean } {
  return {
    verbatim: false,
    result: {
      n,
      text: { ar: clause, en: clause },
      verdict: "review",
      citations: [],
      reason: {
        ar: "تعذّر الفحص الآلي لهذا البند، ويُرفع للمراجعة البشرية.",
        en: "Automatic review failed for this clause; escalated to human review.",
      },
      flags: [{ kind: "error", detail }],
    },
  };
}

/** The review reads at most this many characters of a document; the rest is cut with a notice. */
export const MAX_CHARS = 150_000;

/** Hard ceiling for one clause: above the judge's 90 s request timeout plus the query call, so a
 *  normal slow clause finishes, but a hung one can never hold the stream open. */
export const CLAUSE_TIMEOUT_MS = 120_000;

export async function* reviewDocument(opts: {
  text: string; llm: LlmCall; corpus?: Corpus; enriched?: boolean; k?: number;
  concurrency?: number; maxClauses?: number; onUsage?: (u: Usage) => void; signal?: AbortSignal;
  /** Fires once per reviewed clause with the exact candidate ids handed to the judge (`[]` when
   *  there were none), so a caller (e.g. the eval harness) can measure retrieval without a
   *  separate, untracked query+search call of its own. */
  onCandidates?: (n: number, ids: string[]) => void;
  /** Fires once per reviewed clause with the retrieval query the candidates came from, so the eval
   *  can score each half of the hybrid from the very same query without another llm call. */
  onQuery?: (n: number, query: string) => void;
  /** When given, used as the clause list verbatim — `splitClauses` (and its notices) are skipped
   *  entirely. `maxClauses` still applies. For callers (e.g. the eval harness) that already know
   *  the exact clause boundaries and want exactly one result per item, with no split LLM call. */
  presplit?: string[];
  /** Per-clause deadline (query + search + judge + verify). A clause that has not finished by then
   *  is escalated to human review with an `error: timeout` flag, and its in-flight calls are aborted.
   *  Injectable for tests; defaults to `CLAUSE_TIMEOUT_MS`. */
  clauseTimeoutMs?: number;
  /** The live route sets this: with no enrichment index loaded the hybrid silently degrades, so the
   *  review stops with an error instead. Off for tests and the eval ablation. */
  requireEnrichment?: boolean;
  /** Label segments (clause / intro / not a clause) before review; on by default. */
  structure?: boolean;
}): AsyncGenerator<ReviewEvent> {
  const {
    text, llm, k = 12, concurrency = 4, maxClauses = 150, signal, onCandidates, onQuery, presplit,
    clauseTimeoutMs = CLAUSE_TIMEOUT_MS,
  } = opts;
  // Clamp against zero, negative, non-integer or otherwise falsy caller input; defaults to 4.
  const conc = Math.max(1, Math.floor(concurrency || 1));
  const corpus = opts.corpus ?? loadCorpus();
  if (opts.requireEnrichment && corpus.enrichment.size === 0) {
    if (signal?.aborted) return;
    yield { type: "error", message: { ar: "فهرس الإثراء غير موجود على الخادم.", en: "The enrichment index is missing on the server." } };
    if (signal?.aborted) return;
    yield { type: "done" };
    return;
  }
  const enriched = opts.enriched ?? corpus.enrichment.size > 0;
  const tracked: LlmCall = async (a) => {
    const r = await llm(a);
    if (r.ok) opts.onUsage?.(r.usage);
    return r;
  };

  let clauses: string[];
  // Privacy: every text the model will see is masked first (redact.ts). The reader is told below.
  let masked = 0;
  let nameHints = 0;
  if (presplit) {
    clauses = presplit.map((c) => {
      const r = redact(c);
      masked += r.total;
      nameHints += r.nameHints;
      return r.text;
    });
    if (clauses.length === 0) {
      if (signal?.aborted) return;
      yield { type: "error", message: { ar: "لم نتمكن من استخراج بنود من الوثيقة.", en: "No clauses could be extracted." } };
      if (signal?.aborted) return;
      yield { type: "done" };
      return;
    }
  } else {
    if (!text.trim()) {
      if (signal?.aborted) return;
      yield { type: "error", message: { ar: "لم نجد نصًا في الوثيقة.", en: "The document has no text." } };
      if (signal?.aborted) return;
      yield { type: "done" };
      return;
    }

    const r = redact(text);
    masked = r.total;
    nameHints = r.nameHints;
    let doc = r.text;
    if (doc.length > MAX_CHARS) {
      if (signal?.aborted) return;
      yield {
        type: "notice",
        message: {
          ar: `الوثيقة طويلة: فُحص أول ${(MAX_CHARS / 1000).toLocaleString("ar-SA")} ألف حرف.`,
          en: `Long document: the first ${MAX_CHARS.toLocaleString("en-US")} characters were reviewed.`,
        },
      };
      doc = doc.slice(0, MAX_CHARS);
    }
    const split = await splitClauses(tracked, doc, signal);
    clauses = split.clauses;
    if (clauses.length === 0) {
      if (signal?.aborted) return;
      yield { type: "error", message: { ar: "لم نتمكن من استخراج بنود من الوثيقة.", en: "No clauses could be extracted." } };
      if (signal?.aborted) return;
      yield { type: "done" };
      return;
    }

    // Carried ruling: tell the reader when the verbatim split could not be trusted outright, before
    // any clause events go out. `usedFallback` always wins when both conditions hold, since the
    // fallback split can itself still drop some already-kept clauses in its own accounting.
    // The notice is worded by its cause: a failed (or timed-out) split call is not a paraphrase.
    if (split.usedFallback) {
      if (signal?.aborted) return;
      yield {
        type: "notice",
        message: split.reason === "long"
          ? {
              ar: "الوثيقة طويلة، فقُطّعت حسب الترقيم والعناوين.",
              en: "Long document, so it was split by numbering and headings.",
            }
          : split.reason === "model_failed"
          ? {
              ar: "تعذّر التقطيع الآلي فاستُخدم التقطيع حسب الترقيم والعناوين.",
              en: "Automatic splitting failed, so the split by numbering and headings was used.",
            }
          : {
              ar: "تعذّر نسخ بعض البنود حرفيًا من الوثيقة، فاستُخدم التقطيع الآلي حسب الترقيم والفقرات.",
              en: "Some clauses could not be copied verbatim from the document, so the rule-based split by numbering and paragraphs was used.",
            },
      };
    } else if (split.dropped > 0) {
      if (signal?.aborted) return;
      const ar = split.dropped === 1
        ? "استُبعد بند واحد لم يطابق نص الوثيقة حرفيًا."
        : `استُبعد ${split.dropped} بندًا لم يطابق نص الوثيقة حرفيًا.`;
      const en = split.dropped === 1
        ? "1 clause was excluded because it did not match the document text verbatim."
        : `${split.dropped} clause(s) were excluded because they did not match the document text verbatim.`;
      yield { type: "notice", message: { ar, en } };
    }
  }

  if (clauses.length > maxClauses) {
    if (signal?.aborted) return;
    yield {
      type: "notice",
      message: {
        ar: `الوثيقة طويلة: فُحص أول ${maxClauses} بندًا من ${clauses.length}.`,
        en: `Long document: reviewed the first ${maxClauses} of ${clauses.length} clauses.`,
      },
    };
    clauses = clauses.slice(0, maxClauses);
  }
  if (masked > 0) {
    if (signal?.aborted) return;
    const n = masked.toLocaleString("ar-SA");
    yield {
      type: "notice",
      message: {
        ar: `أُخفيت ${n} من البيانات الشخصية (هوية، آيبان، حساب، بطاقة، جوال، بريد، جواز، صك، تاريخ ميلاد، عنوان) قبل إرسال النص للنموذج.`,
        en: `${masked} item(s) of personal data (ID, IBAN, account, card, mobile, email, passport, deed, birth date, address) were masked before the text was sent to the model.`,
      },
    };
  }
  if (nameHints > 0) {
    if (signal?.aborted) return;
    yield {
      type: "notice",
      message: {
        ar: "قد تحتوي الوثيقة أسماء أشخاص، والأسماء لا تُخفى آليًا. لا ترفع عقودًا فيها بيانات أفراد حقيقيين.",
        en: "The document may contain person names, which are not masked automatically. Do not upload contracts with real individuals' data.",
      },
    };
  }

  // A contract whose title names a form the committee approved (approved.ts). Not for presplit
  // callers: a lone clause has no title.
  const form = presplit ? null : matchApprovedForm(corpus, text);
  if (form) {
    if (signal?.aborted) return;
    const ar = (x: number) => x.toLocaleString("ar-SA", { useGrouping: false });
    const year = form.year ? ` (${form.year})` : "";
    const yearAr = form.year ? ` (${ar(form.year)})` : "";
    yield {
      type: "notice",
      message: form.unified
        ? {
            ar: `عنوان الوثيقة «${form.name}»، وهو من العقود الموحدة التي أجازت اللجنة صيغتها بالقرار (${ar(form.decision)})${yearAr}. نص الصيغة المجازة غير منشور، فأي حكم بعدم المطابقة يستند إلى قرار أقدم منها يُرفع للمراجعة.`,
            en: `The document is titled «${form.name}», a unified contract whose form the committee approved in decision ${form.decision}${year}. The approved text is not published, so any non-compliance finding that rests on an older decision is escalated for review.`,
          }
        : {
            ar: `أجازت اللجنة نموذجًا باسم «${form.name}» بالقرار (${ar(form.decision)})${yearAr}. إن كانت هذه الوثيقة هي النموذج المجاز نفسه فالمرجع ذلك القرار؛ والأحكام أدناه تقارن كل بند بالضوابط.`,
            en: `The committee approved a form named «${form.name}» in decision ${form.decision}${year}. If this document is that approved form, that decision is the reference; the findings below compare each clause with the rules.`,
          },
    };
  }

  // What each segment is (structure.ts): only clauses and intros are reviewed, and each is judged
  // with the segments it depends on. Presplit callers (the eval) already hold exact clauses.
  let segments: Segment[] = clauses.map(() => ({ kind: "clause", otherType: null, context: [] }));
  if (!presplit && opts.structure !== false) {
    const st = await classifySegments(tracked, clauses, signal);
    segments = st.segments;
    const others = segments.filter((x) => x.kind === "other").length;
    if (signal?.aborted) return;
    if (st.failed)
      yield {
        type: "notice",
        message: {
          ar: "تعذّر فرز البنود عن النص العادي، ففُحص كل جزء من الوثيقة على أنه بند.",
          en: "Clauses could not be told apart from other text, so every part of the document was reviewed as a clause.",
        },
      };
    else if (others > 0)
      yield {
        type: "notice",
        message: {
          ar: `${others.toLocaleString("ar-SA")} من أجزاء الوثيقة ليست بنودًا (عناوين، أو مصدر النص، أو فواصل، أو تعريف الأطراف، أو توقيعات)، فلم تُفحص.`,
          en: `${others} part(s) of the document are not clauses (titles, the source note, separators, party details or signatures), so they were not reviewed.`,
        },
      };
  }

  for (let i = 0; i < clauses.length; i++) {
    if (signal?.aborted) return;
    const ctx = segments[i].context.map((j) => j + 1);
    yield { type: "clause", n: i + 1, text: { ar: clauses[i], en: clauses[i] }, kind: segments[i].kind, otherType: segments[i].otherType, ...(ctx.length ? { context: ctx } : {}) };
  }

  // Hybrid retrieval (controller ruling, Task 12): the enriched and plain BM25 indexes each miss
  // the governing unit for some clauses that the other finds, so when enrichment is in play the
  // candidates are the union of both top-k lists (enriched order first, then the plain ids not
  // already present) rather than the enriched list alone. The ablation (`enriched: false`) stays
  // plain-only, unchanged. Both indexes come from the shared per-corpus WeakMap cache, so neither
  // is rebuilt per call.
  // With enrichment loaded, the plain half also excludes approval_only units (they can never govern),
  // so the hybrid never hands the judge a unit the enriched half was built to keep out.
  const plainIndex = indexFor(corpus, enriched ? "plainNoApproval" : "plain");
  const enrichedIndex = enriched ? indexFor(corpus, "enriched") : null;
  const reviewOne = async (clause: string, n: number, clauseSignal: AbortSignal): Promise<{ result: ClauseResult; verbatim: boolean }> => {
    const ctxIdx = segments[n - 1]?.context ?? [];
    const context = ctxIdx.map((j) => clauses[j]);
    // Failure isolation: any throw from the query/search/judge/verify chain (not just a typed
    // `{ ok: false }` judge failure) becomes the same "escalate to human review" result, so one
    // clause's crash never rejects the generator or drops the rest of the stream.
    try {
      const query = await buildQuery(tracked, clause, clauseSignal);
      onQuery?.(n, query);
      const hits = enrichedIndex
        ? [...search(enrichedIndex, query, k), ...search(plainIndex, query, k)]
        : search(plainIndex, query, k);
      const candidates = dedupe(hits.map((h) => h.id));
      onCandidates?.(n, candidates);
      if (candidates.length === 0)
        return {
          verbatim: false,
          result: {
            n, text: { ar: clause, en: clause }, verdict: "abstain", citations: [],
            reason: { ar: "لا توجد وحدة قريبة في المدونة.", en: "No related unit in the corpus." },
          },
        };
      const j = await judgeClause(tracked, corpus, clause, candidates, clauseSignal, context);
      // Only the category reaches the client: the provider's message can echo prompt text.
      if (!j.ok) return escalate(n, clause, j.reason);
      const v = verifyJudgement(corpus, n, clause, candidates, j.value);
      return ctxIdx.length ? { ...v, result: { ...v.result, related: ctxIdx.map((x) => x + 1) } } : v;
    } catch {
      return escalate(n, clause, "exception");
    }
  };
  // Per-clause deadline: race the clause against a timer. On timeout the clause's own controller is
  // aborted (so its in-flight requests stop billing) and the clause escalates with `timeout`. The
  // pipeline's signal is folded in, so an aborted review also aborts every in-flight call.
  const review = (clause: string, n: number): Promise<{ result: ClauseResult; verbatim: boolean }> => {
    const deadline = new AbortController();
    const clauseSignal = signal ? AbortSignal.any([signal, deadline.signal]) : deadline.signal;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timedOut = new Promise<{ result: ClauseResult; verbatim: boolean }>((resolve) => {
      timer = setTimeout(() => {
        deadline.abort(new Error("clause deadline"));
        resolve(escalate(n, clause, "timeout"));
      }, clauseTimeoutMs);
    });
    return Promise.race([reviewOne(clause, n, clauseSignal), timedOut]).finally(() => clearTimeout(timer));
  };

  // Bounded concurrency; results stream as each clause finishes.
  // Text that is not a clause is never judged; an intro is judged through its items (each one gets
  // the intro's text as context), so it carries no verdict of its own.
  const queue = clauses.map((c, i) => ({ c, n: i + 1 })).filter((q) => segments[q.n - 1].kind === "clause");
  const inflight = new Map<number, Promise<{ n: number; out: { result: ClauseResult; verbatim: boolean } }>>();
  const start = () => {
    // Once aborted, stop handing out new work; clauses already in flight are left to settle (their
    // results are discarded below, never scheduled further).
    if (signal?.aborted) return;
    const next = queue.shift();
    if (next) inflight.set(next.n, review(next.c, next.n).then((out) => ({ n: next.n, out })));
  };
  try {
    for (let i = 0; i < conc; i++) start();
    while (inflight.size) {
      const { n, out } = await Promise.race(inflight.values());
      inflight.delete(n);
      if (signal?.aborted) return;
      let result: ClauseResult = { ...out.result, units: citedUnits(corpus, out.result.citations) };
      // Unified approved form: the committee approved this text after the rule the finding rests on.
      const ground = result.citations[0] ? corpus.byId.get(result.citations[0])?.decision_no : undefined;
      if (form?.unified && result.verdict === "nonCompliant" && ground !== undefined && ground < form.decision)
        result = {
          ...result,
          verdict: "review",
          suggestion: undefined,
          flags: [...(result.flags ?? []), { kind: "approved_form", detail: String(form.decision) }],
        };
      yield { type: "result", result, verbatim: out.verbatim };
      start();
    }
  } finally {
    // If the consumer stops pulling (generator .return(), e.g. a `break` out of a for-await loop),
    // this runs before the forced return completes, so no further clause ever gets scheduled.
    queue.length = 0;
  }
  if (signal?.aborted) return;
  yield { type: "done" };
}
