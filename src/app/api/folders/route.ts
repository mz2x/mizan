import { cleanFolderName, json, readJson, requireUser } from "@/server/account";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const c = await requireUser(req);
  if (c instanceof Response) return c;
  const name = cleanFolderName((await readJson(req)).name);
  if (!name) return json({ error: "name" }, 400);
  if ((await c.store.folders(c.user.id)).length >= 50) return json({ error: "limit" }, 400);
  return json({ folder: await c.store.createFolder(c.user.id, name) });
}
