#!/usr/bin/env node
/**
 * Runtime audit harness (iteration protocol §7).
 * Drives the production build in Chromium: route smoke tests, console
 * errors, the full logging flow, GENUINE-PR-vs-non-PR verification,
 * session resume after reload, FPS sampling on 3D scenes (GPU-backed,
 * with renderer identification), and screenshots for visual review.
 *
 * Usage: node scripts/audit.mjs <baseURL> <shotDir> [--gpu]
 */
import { chromium, devices } from "playwright";
import { mkdir } from "node:fs/promises";

const BASE = process.argv[2] ?? "http://localhost:3311";
const SHOTS = process.argv[3] ?? "audit-shots";
const GPU = process.argv.includes("--gpu");
await mkdir(SHOTS, { recursive: true });

const results = { errors: [], flow: {}, fps: {}, renderer: null };

function watchConsole(page, label) {
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      results.errors.push(`[${label}] console.error: ${msg.text().slice(0, 300)}`);
    }
  });
  page.on("pageerror", (err) => {
    results.errors.push(`[${label}] pageerror: ${String(err).slice(0, 300)}`);
  });
}

async function measureFPS(page, seconds = 3) {
  return page.evaluate(
    (secs) =>
      new Promise((resolve) => {
        let frames = 0;
        const start = performance.now();
        function tick() {
          frames++;
          if (performance.now() - start < secs * 1000) {
            requestAnimationFrame(tick);
          } else {
            resolve(Math.round(frames / ((performance.now() - start) / 1000)));
          }
        }
        requestAnimationFrame(tick);
      }),
    seconds,
  );
}

async function webglRenderer(page) {
  return page.evaluate(() => {
    const canvas = document.createElement("canvas");
    const gl =
      canvas.getContext("webgl2") ?? canvas.getContext("webgl");
    if (!gl) return "no-webgl";
    const info = gl.getExtension("WEBGL_debug_renderer_info");
    return info
      ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL)
      : gl.getParameter(gl.RENDERER);
  });
}

const browser = await chromium.launch(
  GPU
    ? { headless: false, args: ["--enable-gpu", "--use-angle=metal", "--window-position=4000,4000"] }
    : {},
);

// ---------------------------------------------------------------- routes ----
{
  const ctx = await browser.newContext({ ...devices["iPhone 13"] });
  for (const route of ["/", "/log", "/history", "/analytics", "/settings"]) {
    const page = await ctx.newPage();
    watchConsole(page, `mobile ${route}`);
    await page.goto(`${BASE}${route}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(route === "/" || route === "/log" ? 4500 : 1800);
    await page.screenshot({
      path: `${SHOTS}/mobile${route === "/" ? "-nexus" : route.replaceAll("/", "-")}.png`,
      fullPage: route !== "/log" && route !== "/",
    });
    await page.close();
  }
  await ctx.close();
}

// ------------------------------------------------------------ logging flow ----
{
  const ctx = await browser.newContext({ ...devices["iPhone 13"] });
  const page = await ctx.newPage();
  watchConsole(page, "flow");

  await page.goto(`${BASE}/log`, { waitUntil: "networkidle" });
  await page.waitForSelector("text=Log Set", { timeout: 20000 });
  results.flow.loggerLoaded = true;
  results.renderer = await webglRenderer(page);
  await page.waitForTimeout(3500); // let the lazy 3D scene mount
  results.fps.loggerMobileViewport = await measureFPS(page, 3);

  // GENUINE PR: 315 lb bench beats the demo archive's 225 lb best.
  await page.fill("#weight-input", "315");
  await page.click("text=Log Set");
  await page.waitForTimeout(1400);
  results.flow.prToastOnGenuinePR =
    (await page.locator("text=Weight PR").count()) > 0;
  await page.screenshot({ path: `${SHOTS}/flow-pr-celebration.png` });

  // NON-PR: 135 lb must NOT celebrate (gate 4: PRs only on genuine PRs).
  await page.waitForTimeout(4200); // let PR toasts expire
  await page.fill("#weight-input", "135");
  await page.click("text=Log Set");
  await page.waitForTimeout(1500);
  results.flow.noToastOnOrdinarySet =
    (await page.locator("text=Weight PR").count()) === 0 &&
    (await page.locator("text=e1RM PR").count()) === 0;
  results.flow.restTimerVisible = (await page.locator("text=REST").count()) > 0;
  const rows = await page.locator("text=/Set \\d/").count();
  results.flow.setsCommitted = rows >= 2;

  // Repeat last set.
  await page.click("text=Repeat Last Set");
  await page.waitForTimeout(900);
  results.flow.repeatWorked = (await page.locator("text=/Set \\d/").count()) > rows;

  // Session resume after reload.
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForSelector("text=Log Set", { timeout: 20000 });
  results.flow.sessionResumedAfterReload =
    (await page.locator("text=Live").count()) > 0 &&
    (await page.locator("text=/Set \\d/").count()) >= 3;

  // End session → summary must show the gold PR banner.
  await page.click("text=End");
  await page.waitForSelector("text=End session?");
  await page.click("text=End & review");
  await page.waitForURL(/\/summary/, { timeout: 15000 });
  await page.waitForTimeout(4000);
  results.flow.summaryReached = true;
  results.flow.summaryShowsPRBanner =
    (await page.locator("text=/new record/i").count()) > 0;
  await page.screenshot({ path: `${SHOTS}/flow-summary.png`, fullPage: true });
  await page.close();
  await ctx.close();
}

// ---------------------------------------------------- desktop + reduced motion ----
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  watchConsole(page, "desktop");
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.waitForTimeout(4500);
  results.fps.nexusDesktop = await measureFPS(page, 3);
  await page.screenshot({ path: `${SHOTS}/desktop-nexus.png` });

  await page.goto(`${BASE}/log`, { waitUntil: "networkidle" });
  await page.waitForSelector("text=Log Set", { timeout: 20000 });
  await page.waitForTimeout(3500);
  results.fps.loggerDesktop = await measureFPS(page, 3);
  await page.screenshot({ path: `${SHOTS}/desktop-logger.png` });

  // CPU-throttled proxy for mid-tier phones (4x slowdown).
  const cdp = await ctx.newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await page.waitForTimeout(800);
  results.fps.loggerDesktopCpuThrottled4x = await measureFPS(page, 3);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
  await page.close();

  const rmCtx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    reducedMotion: "reduce",
  });
  const rmPage = await rmCtx.newPage();
  watchConsole(rmPage, "reduced-motion /log");
  await rmPage.goto(`${BASE}/log`, { waitUntil: "networkidle" });
  await rmPage.waitForSelector("text=Log Set", { timeout: 20000 });
  await rmPage.waitForTimeout(2500);
  results.flow.reducedMotionRenders = true;
  await rmPage.screenshot({ path: `${SHOTS}/reduced-motion-logger.png` });
  await rmPage.close();
  await rmCtx.close();
  await ctx.close();
}

await browser.close();
console.log(JSON.stringify(results, null, 2));
