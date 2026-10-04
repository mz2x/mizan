import { json, readJson, requireUser } from "@/server/account";
import { toStoredRun } from "@/lib/runs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The signed-in user's runs (summaries) and folders. */
export async function GET(req: Request) {
  const ctx = await requireUser(req);
  if (ctx instanceof Response) return ctx;
  const [runs, folders] = await Promise.all([ctx.store.runs(ctx.user.id), ctx.store.folders(ctx.user.id)]);
  return json({ runs, folders });
}

/** Save a finished review. Only toStoredRun's output is stored: excerpts and results, never the file. */
export async function POST(req: Request) {
  const ctx = await requireUser(req);
  if (ctx instanceof Response) return ctx;
  let run;
  try {
    run = toStoredRun(await readJson(req));
  } catch {
    return json({ error: "run" }, 400);
  }
  if (run.audit.length === 0) run.audit = [{ at: run.createdAt, kind: "reviewed", detail: run.engine }];
  const saved = await ctx.store.saveRun(ctx.user.id, run);
  return saved ? json({ id: run.id }) : json({ error: "exists" }, 409);
}
