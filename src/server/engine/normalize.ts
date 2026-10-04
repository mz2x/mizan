// server-only: imported by node tests
/** Same rule as the corpus text_norm: search copy only, never for display. */
export function normalize(s: string): string {
  return s
    .replace(/ـ/g, "")
    .replace(/[ً-ْ]/g, "")
    .replace(/[إأآ]/g, "ا")
    .replace(/\s+/g, " ")
    .trim();
}

const PREFIXES = ["وال", "بال", "كال", "فال", "لل", "ال", "و"];

export function tokenize(s: string): string[] {
  return normalize(s)
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(" ")
    .map((w) => {
      for (const p of PREFIXES) if (w.startsWith(p) && w.length - p.length >= 3) return w.slice(p.length);
      return w;
    })
    .filter((w) => w.length >= 3);
}
