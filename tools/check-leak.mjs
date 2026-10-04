// Fails if corpus text that the site does not quote appears in client bundles.
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
const PROBES = ["دليل إجراءات عمل الهيئة الشـرعية", "units.jsonl", "decisions.jsonl", "contract_phrasings"];
const walk = (d) => readdirSync(d).flatMap((f) => { const p = path.join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
const hits = walk(".next/static").filter((f) => { const s = readFileSync(f, "utf8"); return PROBES.some((p) => s.includes(p)); });
if (hits.length) { console.error("LEAK:", hits); process.exit(1); }
console.log("no corpus in client bundles");
