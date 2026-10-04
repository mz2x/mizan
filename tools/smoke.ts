import { loadDevEnv } from "../src/server/env";
import { llmConfig, makeConfiguredLlm, type Usage } from "../src/server/engine/llm";
import { reviewDocument } from "../src/server/engine/pipeline";

loadDevEnv();
const doc = [
  "1- يشتري المصرف من العميل السلعة المملوكة له بثمن حال، ثم يبيعها عليه بالأجل بثمن أعلى.",
  "2- تسقط الآجال وتصبح جميع الأقساط مستحقة فورًا إذا تأخر العميل عن سداد أي قسط.",
  "3- يحق للعميل سداد الأقساط بالعملات الرقمية.",
].join("\n");
// Clause 3 has no unit that directly governs digital-currency installment payment, but
// ق154/ثالثاً/3 ("عند اختلاف عملة السداد عن عملة القرض...") is genuine related evidence —
// currency-exchange rules apply when the payment currency differs. Escalating to `review` with
// that related evidence is as honest as `abstain` with none: both send the clause to a human and
// neither asserts a verdict. Only `compliant`/`nonCompliant` there would be a real smoke failure.
const expected: string[][] = [["nonCompliant"], ["nonCompliant"], ["abstain", "review"]];
const total: Usage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
const t0 = Date.now();
// The model comes from MIZAN_LLM_* (Claude by default), so the same smoke runs against a local server.
console.log("model:", llmConfig());
const got: Record<number, string> = {};
for await (const e of reviewDocument({ text: doc, llm: makeConfiguredLlm(), onUsage: (u) => { for (const k in u) total[k as keyof Usage] += u[k as keyof Usage]; } })) {
  if (e.type === "result") { got[e.result.n] = e.result.verdict; console.log(e.result.n, e.result.verdict, e.result.citations, e.verbatim, e.result.flags ?? ""); }
  else if (e.type !== "clause") console.log(e);
}
const cost = (total.input * 2 + total.cacheWrite * 2.5 + total.cacheRead * 0.2 + total.output * 10) / 1e6;
console.log({ seconds: (Date.now() - t0) / 1000, usage: total, usd: cost.toFixed(4) });
const pass = expected.every((set, i) => set.includes(got[i + 1]));
console.log(pass ? "SMOKE PASS" : `SMOKE FAIL expected ${JSON.stringify(expected)} got ${JSON.stringify(got)}`);
process.exit(pass ? 0 : 1);
