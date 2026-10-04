import "server-only";
import { loadDevEnv } from "@/server/env";
import { llmConfig, makeConfiguredLlm } from "@/server/engine/llm";
import { MAX_CHARS, reviewDocument } from "@/server/engine/pipeline";
import { codeOk, DailyBudget, RateLimiter, usageUsd } from "@/server/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Vercel's Hobby plan caps a function at 300 s, and a larger value can fail the deploy. That covers
// about 120 clauses at concurrency 4; the stage demo is far shorter.
export const maxDuration = 300;

// Per instance (see guard.ts); the Anthropic console's monthly limit is the hard backstop.
const limiter = new RateLimiter(Number(process.env.MIZAN_RATE_PER_HOUR) || 20, 3_600_000);
const budget = new DailyBudget(Number(process.env.MIZAN_DAILY_USD) || 20);

const refuse = (status: number, error: string) =>
  new Response(JSON.stringify({ error }), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

export async function POST(req: Request) {
  loadDevEnv();
  // Every request counts against the limit, wrong codes included, so the code cannot be guessed fast.
  const ip = req.headers.get("x-real-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (!limiter.take(ip)) return refuse(429, "rate");
  let given: string | null = null;
  try {
    given = decodeURIComponent(req.headers.get("x-mizan-code") ?? "");
  } catch {
    given = null;
  }
  if (!codeOk(process.env.MIZAN_ACCESS_CODE, given, Boolean(process.env.VERCEL))) return refuse(401, "code");
  if (!budget.open()) return refuse(503, "budget");
  const body = (await req.json().catch(() => null)) as { text?: unknown } | null;
  if (typeof body?.text === "string" && body.text.length > MAX_CHARS * 2) return refuse(413, "size");
  // The pipeline cuts anything past MAX_CHARS itself, with a notice to the reader.
  const text = typeof body?.text === "string" ? body.text : "";
  let config: ReturnType<typeof llmConfig>;
  try {
    config = llmConfig();
  } catch {
    return refuse(500, "config");
  }
  const llm = makeConfiguredLlm(config);
  // The daily spend cap prices Anthropic usage; a model the bank hosts has no per-token bill here.
  const priced = config.provider === "anthropic";
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Carried ruling: pass the request's AbortSignal through so a client disconnect stops
        // the pipeline from scheduling further clause reviews.
        // requireEnrichment: a deploy without data/enrichment.jsonl must fail loudly, not degrade.
        for await (const ev of reviewDocument({ text, llm, signal: req.signal, requireEnrichment: true, onUsage: (u) => priced && budget.add(usageUsd(u)) })) controller.enqueue(enc.encode(JSON.stringify(ev) + "\n"));
      } catch {
        // A reference only: the raw error can echo request text (privacy report, requirement 8).
        const ref = crypto.randomUUID().slice(0, 8);
        controller.enqueue(enc.encode(JSON.stringify({ type: "error", message: { ar: `حدث خطأ في المحرك (المرجع ${ref}).`, en: `Engine error (ref ${ref}).` } }) + "\n"));
        controller.enqueue(enc.encode(JSON.stringify({ type: "done" }) + "\n"));
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" } });
}
