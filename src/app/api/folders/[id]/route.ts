import { cleanFolderName, json, readJson, requireUser } from "@/server/account";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(req: Request, ctx: RouteContext<"/api/folders/[id]">) {
  const c = await requireUser(req);
  if (c instanceof Response) return c;
  const name = cleanFolderName((await readJson(req)).name);
  if (!name) return json({ error: "name" }, 400);
  return (await c.store.renameFolder(c.user.id, (await ctx.params).id, name)) ? json({ ok: true }) : json({ error: "missing" }, 404);
}

/** The folder is removed; its runs return to the general list. */
export async function DELETE(req: Request, ctx: RouteContext<"/api/folders/[id]">) {
  const c = await requireUser(req);
  if (c instanceof Response) return c;
  return (await c.store.deleteFolder(c.user.id, (await ctx.params).id)) ? json({ ok: true }) : json({ error: "missing" }, 404);
}
