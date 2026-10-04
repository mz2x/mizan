// Run the production pipeline on one text file and dump every event, for diagnosing a real run.
//   npx tsx tools/run-doc.ts path/to/contract.txt out.json
import { readFileSync, writeFileSync } from "node:fs";
import { loadDevEnv } from "../src/server/env";
import { makeLlm, type Usage } from "../src/server/engine/llm";
import { reviewDocument } from "../src/server/engine/pipeline";

loadDevEnv();
const [file, out] = process.argv.slice(2);
const usage: Usage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
const events: unknown[] = [];
const t0 = Date.now();
for await (const ev of reviewDocument({
  text: readFileSync(file, "utf8"), llm: makeLlm(), requireEnrichment: true,
  onUsage: (u) => { for (const k in u) usage[k as keyof Usage] += u[k as keyof Usage]; },
})) {
  events.push(ev);
  if ((ev as { type: string }).type === "notice") console.log("notice:", JSON.stringify((ev as { message: unknown }).message));
}
const usd = (usage.input * 2 + usage.cacheWrite * 2.5 + usage.cacheRead * 0.2 + usage.output * 10) / 1e6;
writeFileSync(out, JSON.stringify({ seconds: (Date.now() - t0) / 1000, usd, usage, events }, null, 1));
console.log("seconds", (Date.now() - t0) / 1000, "usd", usd.toFixed(2), "events", events.length);
