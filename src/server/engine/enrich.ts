// server-only: CLI script. Usage: npm run enrich  (submit + poll + write)
// Resume usage: npm run enrich -- --resume <batchId>  (skip submit; poll the existing
// batch and write outputs — authorized fallback if the script dies after submitting,
// e.g. a shell timeout. Never re-submits.)
import Anthropic from "@anthropic-ai/sdk";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { loadDevEnv } from "../env";
import { loadCorpus } from "./corpus";
import { MODEL } from "./llm";
import { EnrichmentSchema } from "./schemas";

loadDevEnv();
const client = new Anthropic();
const corpus = loadCorpus();

const SYSTEM = `أنت مساعد فهرسة لقرارات اللجنة الشرعية لمصرف الإنماء. لكل وحدة قرار تُعطى لك، صنّفها ولا تفتِ.
kind:
- prohibition: تمنع المصرف أو تحرم فعلًا.
- condition: تجيز بشرط أو تلزم بضابط.
- permission: تجيز بلا قيد جوهري.
- procedure: تنظيم إداري أو إجرائي.
- approval_only: إجازة نموذج أو وثيقة «بالصيغة المرفقة» بلا قاعدة يمكن فحص بند بها.
scope: أنواع المنتجات أو العقود التي تنطبق عليها (مثل مرابحة، إجارة، تورق، حسابات جارية، بطاقات، صكوك، عام).
contract_phrasings: من 2 إلى 3 جمل قصيرة بلغة العقود التجارية، تصف الصورة التي يحكمها الضابط كما قد تُكتب في عقد، دون المصطلح الفقهي. هذه للبحث فقط.
aaoifi_only: true إذا كانت الوحدة تحيل إلى معيار أيوفي دون أن تذكر نص القاعدة.`;

const params = (id: string) => {
  const u = corpus.byId.get(id)!;
  return {
    model: MODEL,
    max_tokens: 1500,
    system: [{ type: "text" as const, text: SYSTEM, cache_control: { type: "ephemeral" as const } }],
    output_config: {
      effort: "low" as const,
      format: { type: "json_schema" as const, schema: z.toJSONSchema(EnrichmentSchema) as Record<string, unknown> },
    },
    messages: [{ role: "user" as const, content: `[${u.id}] ${u.title}\n${u.context ?? ""}\n${u.text}` }],
  };
};

// Authorized fallback (task brief, Task 5): if `npm run enrich` already submitted a batch
// and then died (e.g. a 9-minute shell timeout) before polling finished, resume with the
// printed batch id instead of submitting a second batch.
const resumeFlagIdx = process.argv.indexOf("--resume");
const resumeRequested = resumeFlagIdx !== -1;
const resumeBatchId = resumeRequested ? process.argv[resumeFlagIdx + 1] : undefined;
if (resumeRequested && (!resumeBatchId || !resumeBatchId.startsWith("msgbatch_"))) {
  console.error(`--resume requires a batch id starting with "msgbatch_", got: ${resumeBatchId ?? "(none)"}`);
  process.exit(1);
}

const batch = resumeBatchId
  ? await client.messages.batches.retrieve(resumeBatchId)
  : await client.messages.batches.create({
      requests: corpus.units.map((u, i) => ({ custom_id: `u${i}`, params: params(u.id) })),
    });
console.log("batch", batch.id);
let status = batch;
while (status.processing_status !== "ended") {
  await new Promise((r) => setTimeout(r, 30_000));
  status = await client.messages.batches.retrieve(batch.id);
  console.log(status.processing_status, status.request_counts);
}

const out: string[] = [];
const failed: string[] = [];
for await (const r of await client.messages.batches.results(batch.id)) {
  const unit = corpus.units[Number(r.custom_id.slice(1))];
  if (r.result.type !== "succeeded") { failed.push(unit.id); continue; }
  const text = r.result.message.content.find((b) => b.type === "text");
  if (!text || !("text" in text)) { failed.push(unit.id); continue; }
  let json: unknown;
  try {
    json = JSON.parse(text.text);
  } catch {
    failed.push(unit.id);
    continue;
  }
  const parsed = EnrichmentSchema.safeParse(json);
  if (!parsed.success) { failed.push(unit.id); continue; }
  out.push(JSON.stringify({ id: unit.id, ...parsed.data }));
}
writeFileSync(path.join(process.cwd(), "data", "enrichment.jsonl"), out.join("\n") + "\n");
console.log(`wrote ${out.length}, failed ${failed.length}`, failed.slice(0, 10));

// Spot-check sample for the team: 50 random rows.
const sample = out.sort(() => Math.random() - 0.5).slice(0, 50).map((l) => JSON.parse(l));
const csv = ["id,kind,scope,phrasings,unit_text,team_ok"].concat(
  sample.map((e) => [e.id, e.kind, e.scope.join("|"), e.contract_phrasings.join(" | "), corpus.byId.get(e.id)!.text]
    .map((v) => `"${String(v).replaceAll('"', '""')}"`).join(",") + ","),
);
writeFileSync(path.join(process.cwd(), "data", "enrichment-sample.csv"), "﻿" + csv.join("\n"));
