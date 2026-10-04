// Records one real pass of the sorting step (structure.ts) for the /how walkthrough:
// npm run trace:sort. The demonstration contract gets the header lines a contract published on the
// web usually carries (a title, a source note, a separator), and the production classifySegments
// labels every part. Writes src/content/how-sort.json; nothing in it is edited by hand.
import { writeFileSync } from "node:fs";
import { loadDevEnv } from "../src/server/env";
import { makeLlm, MODEL, type Usage } from "../src/server/engine/llm";
import { classifySegments } from "../src/server/engine/structure";
import { DEMO_CONTRACT } from "../src/content/contract";

loadDevEnv();
const usage: Usage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
const base = makeLlm();
const llm: typeof base = async (a) => {
  const r = await base(a);
  if (r.ok) for (const k in r.usage) usage[k as keyof Usage] += r.usage[k as keyof Usage];
  return r;
};
const header = ["اتفاقية بيع بالمرابحة — عقد توضيحي", "المصدر: نموذج كتبه فريق مِداد لأغراض العرض فقط.", "========================================"];
const segments = [...header, ...DEMO_CONTRACT.clauses.map((c) => c.text.ar)];
const t0 = Date.now();
const r = await classifySegments(llm, segments);
const cost = (usage.input * 2 + usage.cacheWrite * 2.5 + usage.cacheRead * 0.2 + usage.output * 10) / 1e6;
const out = {
  recordedAt: new Date().toISOString(),
  model: MODEL,
  seconds: Math.round((Date.now() - t0) / 100) / 10,
  usd: Math.round(cost * 10000) / 10000,
  failed: r.failed,
  headerLines: header.length,
  segments: segments.map((text, i) => ({ text, kind: r.segments[i].kind, otherType: r.segments[i].otherType })),
};
writeFileSync("src/content/how-sort.json", JSON.stringify(out, null, 2) + "\n");
console.log(JSON.stringify({ ...out, segments: out.segments.map((x) => `${x.kind}${x.otherType ? ":" + x.otherType : ""} ${x.text.slice(0, 30)}`) }, null, 2));
