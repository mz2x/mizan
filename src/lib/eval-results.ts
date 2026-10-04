// The shape of eval/results/latest.json as the landing page reads it (written by tools/eval/run.ts).

export const METRIC_KEYS = ["recall", "precision", "citation", "abstention"] as const;
type Metric = number | null;

export type EvalResults = {
  date: string;
  n: number;
  systems: Record<"mizan" | "baseline", Record<(typeof METRIC_KEYS)[number], Metric>>;
};

const inUnitRange = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 1;

/** The landing page renders only `recall/precision/citation/abstention` for `mizan` and `baseline`,
 *  so that is exactly the shape validated: each of those eight values is a finite number in [0,1]
 *  or null (an empty denominator, e.g. a system that never abstained; rendered «—»), and `n` is an
 *  integer >= 30. Anything else falls back to the pending pills rather than rendering a garbage
 *  or out-of-range number. */
export function hasValidShape(v: unknown): v is EvalResults {
  if (!v || typeof v !== "object") return false;
  const r = v as Record<string, unknown>;
  if (!Number.isInteger(r.n) || (r.n as number) < 30) return false;
  if (!r.systems || typeof r.systems !== "object") return false;
  const systems = r.systems as Record<string, unknown>;
  for (const system of ["mizan", "baseline"] as const) {
    const m = systems[system];
    if (!m || typeof m !== "object") return false;
    const metrics = m as Record<string, unknown>;
    for (const key of METRIC_KEYS) if (metrics[key] !== null && !inUnitRange(metrics[key])) return false;
  }
  return true;
}

export const formatMetric = (v: Metric) => (v === null ? "—" : `${Math.round(v * 100)}%`);
