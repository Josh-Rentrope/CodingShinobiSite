import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// npm run record -- https://any-site.dev
// Records screenshots + a video of any URL into recordings/<timestamp>/.
const url = process.argv[2] ?? "http://localhost:4173";

const outDir = path.join(
  __dirname,
  "..",
  "recordings",
  new Date().toISOString().replace(/[:.]/g, "-")
);
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  recordVideo: { dir: outDir },
  deviceScaleFactor: 2,
});
const page = await context.newPage();

console.log(`Recording ${url} -> ${outDir}`);
await page.goto(url, { waitUntil: "networkidle" });
await page.screenshot({ path: path.join(outDir, "viewport.png") });
await page.screenshot({ path: path.join(outDir, "fullpage.png"), fullPage: true });

// Scroll the page top to bottom to give the video some motion.
await page.evaluate(async () => {
  const step = window.innerHeight;
  for (let y = 0; y <= document.documentElement.scrollHeight; y += step) {
    window.scrollTo({ top: y, behavior: "instant" });
    await new Promise((r) => setTimeout(r, 220));
  }
});

await page.close();
await browser.close();

console.log("Done. Artifacts:");
for (const name of fs.readdirSync(outDir)) console.log(`  - ${path.join(outDir, name)}`);
