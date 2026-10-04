// Term-gap demonstration: a demonstration clause that never names بيع العينة, mapped passage
// by passage to the verbatim committee unit الإنماء/ق7/ثالثاً/2. Every `decision` span below is
// a literal substring of that unit's text (checked in tools/check-content.mjs).
export const TERM_GAP = {
  unitId: "الإنماء/ق7/ثالثاً/2",
  clause: {
    ar: "يشتري المصرف من العميل السلعة المملوكة له بثمن حال، ثم يبيعها عليه بالأجل بثمن أعلى",
    en: "The bank buys from the client goods the client owns, for cash, then sells them back to the same client on deferred terms at a higher price",
  },
  pairs: [
    { clause: { ar: "يشتري المصرف من العميل السلعة المملوكة له", en: "buys from the client goods the client owns" }, decision: "يشتري المصـرف من العميل سلعة يملكها" },
    { clause: { ar: "بثمن حال", en: "for cash" }, decision: "بثمن حال" },
    { clause: { ar: "ثم يبيعها عليه بالأجل", en: "then sells them back to the same client on deferred terms" }, decision: "ثم يبيعها على ذلك العميل إلى أجل" },
    { clause: { ar: "بثمن أعلى", en: "at a higher price" }, decision: "بثمن أكثر" },
  ],
  /** The fiqh term the clause never uses. */
  term: "بيوع العينة",
  /** English gloss of the unit, for reading only. It is not a citation. */
  glossEn:
    "That the bank does not buy from the client goods the client owns, or owns more than a third of, for cash, and then sell them to that same client on deferred terms at a higher price; because that is among the ʿīna sales, which are prohibited.",
};

export type Segment = { text: string; pair: number | null; term?: boolean };

/** Split `text` into plain runs and highlighted runs, in order of appearance. */
export function segment(text: string, marks: { text: string; pair: number | null; term?: boolean }[]): Segment[] {
  const hits = marks
    .map((m) => ({ ...m, at: text.indexOf(m.text) }))
    .filter((m) => m.at >= 0)
    .sort((a, b) => a.at - b.at);
  const out: Segment[] = [];
  let cursor = 0;
  for (const h of hits) {
    if (h.at < cursor) continue;
    if (h.at > cursor) out.push({ text: text.slice(cursor, h.at), pair: null });
    out.push({ text: h.text, pair: h.pair, term: h.term });
    cursor = h.at + h.text.length;
  }
  if (cursor < text.length) out.push({ text: text.slice(cursor), pair: null });
  return out;
}
