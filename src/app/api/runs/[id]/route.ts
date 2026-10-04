import { json, readJson, requireUser } from "@/server/account";
import { DECISIONS, type Decision } from "@/lib/runs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: RouteContext<"/api/runs/[id]">) {
  const c = await requireUser(req);
  if (c instanceof Response) return c;
  const run = await c.store.run(c.user.id, (await ctx.params).id);
  return run ? json({ run }) : json({ error: "missing" }, 404);
}

/** { folderId: string | null } moves the run; { decision: { n, d } } records the committee's
 *  decision on a finding (d null clears it). Both are logged in the run's audit trail. */
export async function PATCH(req: Request, ctx: RouteContext<"/api/runs/[id]">) {
  const c = await requireUser(req);
  if (c instanceof Response) return c;
  const run = await c.store.run(c.user.id, (await ctx.params).id);
  if (!run) return json({ error: "missing" }, 404);
  const body = await readJson(req);
  const at = new Date().toISOString();
  if ("folderId" in body) {
    run.folderId = typeof body.folderId === "string" && body.folderId ? body.folderId.slice(0, 40) : null;
    run.audit.push({ at, kind: "moved", detail: run.folderId ?? "" });
  }
  const d = body.decision as { n?: unknown; d?: unknown } | undefined;
  if (d && typeof d === "object") {
    const n = String(Math.trunc(Number(d.n)));
    if (!run.clauses.some((x) => String(x.n) === n)) return json({ error: "clause" }, 400);
    if (d.d === null) delete run.decisions[n];
    else if (DECISIONS.includes(d.d as Decision)) run.decisions[n] = { d: d.d as Decision, at };
    else return json({ error: "decision" }, 400);
    run.audit.push({ at, kind: "decision", detail: `${n}:${d.d ?? "clear"}` });
  }
  run.audit = run.audit.slice(-200);
  return (await c.store.updateRun(c.user.id, run)) ? json({ run }) : json({ error: "folder" }, 400);
}

export async function DELETE(req: Request, ctx: RouteContext<"/api/runs/[id]">) {
  const c = await requireUser(req);
  if (c instanceof Response) return c;
  return (await c.store.deleteRun(c.user.id, (await ctx.params).id)) ? json({ ok: true }) : json({ error: "missing" }, 404);
}
