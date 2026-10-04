// Dev-only capture helper for the review loop: node scripts-capture.mjs <url> <out> <w> <h> [full]
import { chromium } from "playwright";
const [url, out, w, h, full] = process.argv.slice(2);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1, reducedMotion: "reduce" });
await page.goto(url, { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);
if (full === "full") {
  // Scroll through once so lazy images and in-view stamps settle, then return to the top.
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 600) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 60));
    }
    window.scrollTo(0, 0);
  });
}
await page.waitForTimeout(400);
await page.screenshot({ path: out, fullPage: full === "full" });
await browser.close();
