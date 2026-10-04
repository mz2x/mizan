// Fails when site copy makes a claim the privacy report forbids (الوثائق/04_الخصوصية_والأمن.md §3)
// or names a non-Saudi competitor (Mazen's decision, 2026-10-01). Run after any content edit.
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const ROOTS = ["src/content", "src/components", "src/app"];
const FORBIDDEN = [
  [/متوافق مع (?:نظام|اللائحة|ضوابط)/, "claims compliance"],
  [/معتمد من|معتمدة من/, "claims certification"],
  [/لا تغادر|never leave/i, "claims data never leaves"],
  [/compliant with (?:the )?(?:PDPL|personal data|SAMA)/i, "claims compliance"],
  [/certified by|SAMA[- ]approved/i, "claims certification"],
  [/آمن بالكامل|محمية بالكامل|fully secure/i, "absolute security claim"],
  [/Burhan|برهان|ShariaTech|ShariahLab/i, "names a non-Saudi competitor"],
];

const files = [];
const walk = (d) => {
  for (const f of readdirSync(d)) {
    const p = path.join(d, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(tsx?|mdx?)$/.test(f) && !/\.test\./.test(f)) files.push(p);
  }
};
ROOTS.forEach(walk);

let bad = 0;
for (const f of files) {
  const lines = readFileSync(f, "utf8").split("\n");
  lines.forEach((line, i) => {
    for (const [re, why] of FORBIDDEN)
      if (re.test(line)) {
        bad++;
        console.log(`${f}:${i + 1}: ${why}: ${line.trim().slice(0, 120)}`);
      }
  });
}
if (bad) {
  console.log(`\n${bad} forbidden claim(s)`);
  process.exit(1);
}
console.log(`no forbidden claims in ${files.length} files`);
