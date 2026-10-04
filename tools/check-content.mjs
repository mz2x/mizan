// Content integrity check: every unit quoted by the site must match the corpus verbatim,
// every highlighted decision span must be a literal substring of its unit, and every
// citation id used by the demo data must exist. Run: node tools/check-content.mjs
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(fileURLToPath(import.meta.url));
const corpusPath = path.resolve(root, "../data/corpus/units.jsonl");
const corpus = new Map(
  readFileSync(corpusPath, "utf8").trim().split("\n").map((l) => {
    const u = JSON.parse(l);
    return [u.id, u];
  }),
);

const src = (f) => readFileSync(path.resolve(root, "../src/content", f), "utf8");
const unitsSrc = src("units.ts");
const units = JSON.parse(unitsSrc.match(/export const UNITS: Record<string, CitationUnit> = (\{[\s\S]*?\n\});/)[1]);

let failures = 0;
const fail = (msg) => {
  failures++;
  console.log(`FAIL ${msg}`);
};

for (const [id, u] of Object.entries(units)) {
  const c = corpus.get(id);
  if (!c) fail(`${id}: not in corpus`);
  else if (c.text !== u.text) fail(`${id}: text differs from corpus`);
  else console.log(`ok   ${id}`);
}

// Preamble excerpts must appear verbatim in the decision's preamble.
const decisions = new Map(
  readFileSync(corpusPath.replace("units.jsonl", "decisions.jsonl"), "utf8").trim().split("\n").map((l) => {
    const d = JSON.parse(l);
    return [d.decision_no, d];
  }),
);
for (const m of unitsSrc.matchAll(/decisionNo: (\d+),\s*label: "[^"]*",\s*text: ("(?:[^"\\]|\\.)*")/g)) {
  const text = JSON.parse(m[2]);
  const ok = decisions.get(Number(m[1]))?.preamble.includes(text);
  ok ? console.log(`ok   preamble excerpt of decision ${m[1]}`) : fail(`preamble excerpt of decision ${m[1]} not found`);
}

// Term-gap spans.
const termgap = src("termgap.ts");
const unitId = termgap.match(/unitId: "([^"]+)"/)[1];
for (const m of termgap.matchAll(/decision: "([^"]+)"/g)) {
  corpus.get(unitId).text.includes(m[1]) ? console.log(`ok   span «${m[1]}»`) : fail(`span «${m[1]}» not in ${unitId}`);
}
const term = termgap.match(/term: "([^"]+)"/)[1];
if (!corpus.get(unitId).text.includes(term)) fail(`term «${term}» not in ${unitId}`);

// Citation ids used anywhere in the demo data exist in UNITS.
for (const f of ["demo.ts", "contract.ts"]) {
  for (const m of src(f).matchAll(/"(الإنماء\/[^"]+)"/g)) {
    if (!units[m[1]]) fail(`${f}: citation ${m[1]} missing from units.ts`);
  }
}

// Review-app highlight spans must be literal substrings of their units.
for (const m of src("contract.ts").matchAll(/marks: (\{.*\}),\n/g)) {
  for (const [id, spans] of Object.entries(JSON.parse(m[1]))) {
    for (const span of spans) {
      corpus.get(id)?.text.includes(span) ? console.log(`ok   mark «${span.slice(0, 30)}»`) : fail(`mark «${span}» not in ${id}`);
    }
  }
}

console.log(failures ? `\n${failures} failure(s)` : "\nall content checks passed");
process.exit(failures ? 1 : 0);
