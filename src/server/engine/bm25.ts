// server-only: imported by node tests
import type { Corpus } from "./corpus";
import { tokenize } from "./normalize";

const STOP = new Set(["على", "الى", "هذا", "هذه", "ذلك", "التي", "الذي", "عن", "مع", "كان", "يكون", "وفق", "بين"]);
const K1 = 1.4;
const B = 0.75;

export type Bm25Index = {
  ids: string[];
  docs: Map<string, number>[];
  lengths: number[];
  avgLen: number;
  df: Map<string, number>;
};

export function docText(corpus: Corpus, id: string, enriched: boolean): string {
  const u = corpus.byId.get(id)!;
  const e = enriched ? corpus.enrichment.get(id) : undefined;
  return [u.title, u.context ?? "", u.text, e ? e.contract_phrasings.join(" ") : "", e ? e.scope.join(" ") : ""].join(" ");
}

/** `enriched` adds the enrichment phrasings/scope to each unit's text and drops approval_only units.
 *  `excludeApproval` drops approval_only units from a plain index too (the hybrid's plain half);
 *  the ablation leaves both off, so it stays the untouched plain index. */
export function buildIndex(corpus: Corpus, opts: { enriched: boolean; excludeApproval?: boolean }): Bm25Index {
  const dropApproval = opts.enriched || opts.excludeApproval === true;
  const ids = corpus.units
    .map((u) => u.id)
    .filter((id) => !dropApproval || corpus.enrichment.get(id)?.kind !== "approval_only");
  const docs: Map<string, number>[] = [];
  const lengths: number[] = [];
  const df = new Map<string, number>();
  for (const id of ids) {
    const tf = new Map<string, number>();
    const toks = tokenize(docText(corpus, id, opts.enriched)).filter((t) => !STOP.has(t));
    for (const t of toks) tf.set(t, (tf.get(t) ?? 0) + 1);
    for (const t of tf.keys()) df.set(t, (df.get(t) ?? 0) + 1);
    docs.push(tf);
    lengths.push(toks.length);
  }
  const avgLen = lengths.reduce((a, b) => a + b, 0) / Math.max(1, lengths.length);
  return { ids, docs, lengths, avgLen, df };
}

export function search(index: Bm25Index, query: string, k: number): { id: string; score: number }[] {
  const q = [...new Set(tokenize(query).filter((t) => !STOP.has(t)))];
  if (q.length === 0) return [];
  const N = index.ids.length;
  const scored: { id: string; score: number }[] = [];
  index.docs.forEach((tf, i) => {
    let s = 0;
    for (const t of q) {
      const f = tf.get(t);
      if (!f) continue;
      const n = index.df.get(t)!;
      const idf = Math.log(1 + (N - n + 0.5) / (n + 0.5));
      s += idf * ((f * (K1 + 1)) / (f + K1 * (1 - B + (B * index.lengths[i]) / index.avgLen)));
    }
    if (s > 0) scored.push({ id: index.ids[i], score: s });
  });
  return scored.sort((a, b) => b.score - a.score).slice(0, k);
}
