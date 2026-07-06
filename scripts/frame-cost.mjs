#!/usr/bin/env node
/**
 * Per-frame CPU cost measurement. The Playwright window on this host is
 * BeginFrame-capped (~15Hz even on about:blank), so rAF rate is meaningless;
 * what IS measurable is how much main-thread work one frame costs (React,
 * GSAP, useFrame logic, and WebGL command encoding). Frame budget at 60fps
 * is 16.7ms, at 30fps 33ms — median/p95 well under those means the scene
 * holds its FPS targets on real displays.
 *
 * Usage: node scripts/frame-cost.mjs <baseURL>
 */
import { chromium, devices } from "playwright";

const BASE = process.argv[2] ?? "http://localhost:3311";
const browser = await chromium.launch({
  headless: false,
  args: ["--enable-gpu", "--use-angle=metal", "--window-position=50,50"],
});

const INSTRUMENT = `
  window.__frameCost = [];
  const origRaf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (cb) =>
    origRaf((t) => {
      const start = performance.now();
      cb(t);
      const cost = performance.now() - start;
      if (window.__frameCost.length < 2000) window.__frameCost.push(cost);
    });
`;

async function measure(page, settleMs) {
  await page.waitForTimeout(settleMs);
  await page.evaluate(() => {
    window.__frameCost = [];
  });
  await page.waitForTimeout(4000);
  return page.evaluate(() => {
    const arr = [...window.__frameCost].sort((a, b) => a - b);
    if (arr.length === 0) return null;
    const at = (q) => arr[Math.min(arr.length - 1, Math.floor(arr.length * q))];
    return {
      frames: arr.length,
      medianMs: Math.round(at(0.5) * 100) / 100,
      p95Ms: Math.round(at(0.95) * 100) / 100,
      maxMs: Math.round(arr[arr.length - 1] * 100) / 100,
    };
  });
}

const out = {};

for (const [label, ctxOpts, route, throttle] of [
  ["nexusDesktop", { viewport: { width: 1440, height: 860 } }, "/", 1],
  ["loggerDesktop", { viewport: { width: 1440, height: 860 } }, "/log", 1],
  ["loggerMobileViewport", { ...devices["iPhone 13"] }, "/log", 1],
  ["loggerMobile4xCpu", { ...devices["iPhone 13"] }, "/log", 4],
]) {
  const ctx = await browser.newContext(ctxOpts);
  const page = await ctx.newPage();
  await page.addInitScript(INSTRUMENT);
  await page.goto(`${BASE}${route}`, { waitUntil: "networkidle" });
  if (route === "/log") {
    await page.waitForSelector("text=Log Set", { timeout: 20000 });
  }
  if (throttle > 1) {
    const cdp = await ctx.newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: throttle });
  }
  out[label] = await measure(page, 3500);
  await page.close();
  await ctx.close();
}

await browser.close();
console.log(JSON.stringify(out, null, 2));
