// Records a backup video of a live review of the demonstration contract, for the stage in case the
// network fails. Runs against a local server (no access code needed off Vercel).
// Usage: node tools/record-demo.mjs [baseUrl] [outDir]   (defaults: http://localhost:3100, ./demo-video)
import { chromium } from "playwright";
import { mkdirSync, readdirSync, renameSync } from "node:fs";
import path from "node:path";

const base = process.argv[2] ?? "http://localhost:3100";
const out = path.resolve(process.argv[3] ?? "demo-video");
mkdirSync(out, { recursive: true });
const size = { width: 1440, height: 900 };

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: size, recordVideo: { dir: out, size }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
const pause = (ms) => page.waitForTimeout(ms);

// 1. Landing page: hero, then a slow scroll through the story.
await page.goto(base + "/", { waitUntil: "load" });
await pause(4000);
for (let y = 0; y < 6; y++) {
  await page.mouse.wheel(0, 700);
  await pause(1600);
}
// 2. How it works: step through the six stations with the arrow keys; at the gate, fake a quote.
await page.goto(base + "/how", { waitUntil: "load" });
// The animated diagram first, then one key down to the walkthrough.
await pause(7000);
await page.locator("section[aria-labelledby=machine-title]").evaluate((el) => el.scrollIntoView({ behavior: "smooth" }));
await pause(2500);
// Seven stations: six steps forward. The sorting station (i === 1) gets time for its drop; the
// gate (i === 4) gets the fake-quote demo.
for (let i = 0; i < 6; i++) {
  await page.keyboard.press("ArrowLeft");
  await pause(i === 1 ? 7000 : 3800);
  if (i === 4) {
    await page.getByRole("button", { name: /جرّب: نموذج يقتبس/ }).click();
    await pause(5000);
    await page.getByRole("button", { name: /أعد الاقتباس الحقيقي/ }).click();
    // The click scrolled the button into view; return to the top of the walkthrough.
    await page.locator("section[aria-labelledby=machine-title]").evaluate((el) => el.scrollIntoView());
    await pause(1500);
  }
}
await pause(2500);
// 3. The review: live engine, demonstration contract.
await page.goto(base + "/review", { waitUntil: "load" });
await pause(2500);
await page.getByRole("button", { name: "افحص العقد التوضيحي" }).click();
await page.waitForFunction(
  () => {
    const rows = [...document.querySelectorAll("li[data-verdict]")];
    return rows.length >= 10 && rows.every((r) => !["pending"].includes(r.getAttribute("data-verdict") ?? ""));
  },
  null,
  { timeout: 180_000 },
);
await pause(2500);
// 4. Open the first finding's evidence, then walk down the register.
const details = page.locator("li[data-verdict] summary").first();
if (await details.count()) {
  await details.click();
  await pause(4000);
}
for (let y = 0; y < 4; y++) {
  await page.mouse.wheel(0, 600);
  await pause(1400);
}
// 5. The saved review in the dashboard: the committee approves the first finding.
await page.mouse.wheel(0, -10000);
await pause(800);
const open = page.getByRole("link", { name: "افتحها في اللوحة" });
if (await open.count()) {
  await open.click();
  await page.getByText("سجل العملية").waitFor({ timeout: 15_000 });
  await pause(2500);
  await page.getByRole("button", { name: "اعتماد الملاحظة" }).first().click();
  await pause(2500);
  await page.mouse.wheel(0, 20000);
  await pause(3000);
}
await ctx.close();
await browser.close();

const webm = readdirSync(out).filter((f) => f.endsWith(".webm")).map((f) => path.join(out, f));
const target = path.join(out, "mizan-demo.webm");
if (webm.length) renameSync(webm.at(-1), target);
console.log(target);
