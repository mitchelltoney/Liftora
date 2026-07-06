#!/usr/bin/env node
/**
 * PWA offline verification: load the app once (SW installs + precaches),
 * kill the network, then reload and navigate — the shell must come from the
 * service worker and IndexedDB data must still render.
 *
 * Usage: node scripts/offline-test.mjs <baseURL>
 */
import { chromium } from "playwright";

const BASE = process.argv[2] ?? "http://localhost:3311";
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();
const out = {};

await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
// Wait for the service worker to take control.
out.swActivated = await page.evaluate(async () => {
  if (!("serviceWorker" in navigator)) return false;
  const reg = await navigator.serviceWorker.ready;
  return Boolean(reg.active);
});
await page.waitForTimeout(1500); // let precache finish

await ctx.setOffline(true);

await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForTimeout(3500);
out.offlineReloadShowsApp =
  (await page.locator("text=AETHERFORGE").count()) > 0;
out.offlineDataRenders =
  (await page.locator("text=INITIATE SESSION").count()) > 0 ||
  (await page.locator("text=RESUME SESSION").count()) > 0;

// Dock navigation offline (falls back to a full page load served by the SW).
await page
  .locator('nav[aria-label="Primary"] >> visible=true >> text=History')
  .first()
  .click();
await page.waitForTimeout(5000);
out.offlineNavigationWorks =
  page.url().endsWith("/history") &&
  (await page.locator("text=Training calendar").count()) > 0;

// Hard load of another route offline (must come from SW cache).
await page.goto(`${BASE}/analytics`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2500);
out.offlineHardNavigationWorks =
  (await page.locator("text=Analytics").count()) > 0;

await browser.close();
console.log(JSON.stringify(out, null, 2));
