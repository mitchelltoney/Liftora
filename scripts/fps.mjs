#!/usr/bin/env node
/**
 * Focused FPS measurement with occlusion throttling disabled (a hidden or
 * off-screen window otherwise caps rAF at ~15fps and lies about performance).
 * Usage: node scripts/fps.mjs <baseURL>
 */
import { chromium, devices } from "playwright";

const BASE = process.argv[2] ?? "http://localhost:3311";

const browser = await chromium.launch({
  headless: false,
  args: [
    "--enable-gpu",
    "--use-angle=metal",
    "--disable-backgrounding-occluded-windows",
    "--disable-renderer-backgrounding",
    "--disable-background-timer-throttling",
    "--window-position=50,50",
    "--window-size=1440,900",
  ],
});

async function fps(page, seconds = 4) {
  return page.evaluate(
    (secs) =>
      new Promise((resolve) => {
        let frames = 0;
        const start = performance.now();
        function tick() {
          frames++;
          if (performance.now() - start < secs * 1000) requestAnimationFrame(tick);
          else resolve(Math.round(frames / ((performance.now() - start) / 1000)));
        }
        requestAnimationFrame(tick);
      }),
    seconds,
  );
}

const out = {};

const ctx = await browser.newContext({ viewport: { width: 1440, height: 860 } });
const page = await ctx.newPage();

await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
await page.waitForTimeout(4000);
out.nexusDesktop = await fps(page);

await page.goto(`${BASE}/log`, { waitUntil: "networkidle" });
await page.waitForSelector("text=Log Set", { timeout: 20000 });
await page.waitForTimeout(3500);
out.loggerDesktop = await fps(page);

// Mid-tier phone proxy: 4x CPU throttle on the logger scene.
const cdp = await ctx.newCDPSession(page);
await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
await page.waitForTimeout(800);
out.loggerCpuThrottled4x = await fps(page);
await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
await page.close();

// Mobile viewport (DPR 3, small canvas) — closer to phone raster load.
const mctx = await browser.newContext({ ...devices["iPhone 13"] });
const mpage = await mctx.newPage();
await mpage.goto(`${BASE}/log`, { waitUntil: "networkidle" });
await mpage.waitForSelector("text=Log Set", { timeout: 20000 });
await mpage.waitForTimeout(3500);
out.loggerMobileViewport = await fps(mpage);
const mcdp = await mctx.newCDPSession(mpage);
await mcdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
await mpage.waitForTimeout(800);
out.loggerMobileCpuThrottled4x = await fps(mpage);
await mpage.close();
await mctx.close();
await ctx.close();
await browser.close();
console.log(JSON.stringify(out, null, 2));
