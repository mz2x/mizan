// server-only: imported by the route handler and node tests
// Protection for the public /api/review: an access code, a per-client rate limit and a daily
// spend cap. The limiter and the budget live in the function's memory, so on a serverless host
// they hold per instance, not globally; the Anthropic console's monthly limit is the hard backstop.
import { timingSafeEqual } from "node:crypto";
import type { Usage } from "./engine/llm";

/** On Vercel a missing code fails closed; locally (no `VERCEL` env) the review stays open. */
export function codeOk(expected: string | undefined, given: string | null, onHost: boolean): boolean {
  if (!expected) return !onHost;
  const a = Buffer.from(expected.trim());
  const b = Buffer.from((given ?? "").trim());
  return a.length === b.length && timingSafeEqual(a, b);
}

export class RateLimiter {
  private hits = new Map<string, number[]>();
  constructor(private max: number, private windowMs: number, private now: () => number = Date.now) {}
  take(key: string): boolean {
    const t = this.now();
    const recent = (this.hits.get(key) ?? []).filter((x) => t - x < this.windowMs);
    if (recent.length >= this.max) {
      this.hits.set(key, recent);
      return false;
    }
    recent.push(t);
    this.hits.set(key, recent);
    return true;
  }
}

export class DailyBudget {
  private day = "";
  private spent = 0;
  constructor(private capUsd: number, private now: () => number = Date.now) {}
  private roll() {
    const d = new Date(this.now()).toISOString().slice(0, 10);
    if (d !== this.day) { this.day = d; this.spent = 0; }
  }
  add(usd: number) { this.roll(); this.spent += usd; }
  open(): boolean { this.roll(); return this.spent < this.capUsd; }
}

/** claude-sonnet-5-5 list prices: $2 / $10 per MTok; cache write 1.25×, cache read 0.1× input. */
export const usageUsd = (u: Usage) => (u.input * 2 + u.cacheWrite * 2.5 + u.cacheRead * 0.2 + u.output * 10) / 1e6;
