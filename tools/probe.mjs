// Dev-only: report horizontal overflow and the widest offenders at a viewport.
import { chromium } from "playwright";
const [url, w, h, shot] = process.argv.slice(2);
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: +w, height: +h }, reducedMotion: "reduce" });
await p.goto(url, { waitUntil: "networkidle" });
await p.evaluate(() => document.fonts.ready);
const r = await p.evaluate(() => {
  const vw = document.documentElement.clientWidth;
  const off = [...document.querySelectorAll("body *")]
    .map((el) => { const b = el.getBoundingClientRect(); return { el, l: b.left, r: b.right }; })
    .filter((x) => !x.el.closest("svg") && (x.r > vw + 1 || x.l < -1))
    .slice(0, 12)
    .map((x) => `${x.el.tagName.toLowerCase()}.${String(x.el.className).slice(0, 40)} l=${Math.round(x.l)} r=${Math.round(x.r)}`);
  return { vw, sw: document.documentElement.scrollWidth, off };
});
console.log(JSON.stringify(r, null, 1));
if (shot) await p.screenshot({ path: shot });
await b.close();
