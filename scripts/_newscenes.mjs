import { chromium } from "playwright";
const DIR = "/private/tmp/claude-501/-Users-mitchelltoney-Desktop-aetherforge/fa43a5d4-1462-4b77-993f-1ce29c780efb/scratchpad/3d";
const browser = await chromium.launch({ headless: false, args: ["--enable-gpu", "--use-angle=metal", "--window-position=50,50"] });
const page = await (await browser.newContext({ viewport: { width: 1200, height: 860 } })).newPage();
await page.goto("http://localhost:3000/log", { waitUntil: "networkidle" });
await page.waitForSelector("text=Log Set", { timeout: 30000 });
await page.waitForTimeout(5000);
const vp = page.locator("div.md\\:col-start-1 >> nth=0");

async function shot(lift, weight, name) {
  await page.locator(`[role=tablist] >> text=${lift}`).first().click();
  await page.waitForTimeout(1500);
  if (weight !== null) {
    await page.fill("#weight-input", String(weight));
    await page.waitForTimeout(1400);
  }
  await vp.screenshot({ path: `${DIR}/${name}.png` });
}

await shot("Bent-Over Row", 185, "new-row");
await shot("Pull-Ups", 45, "new-pullup-45");
await shot("Dumbbell Curl", 15, "new-db-15");
await shot("Dumbbell Curl", 35, "new-db-35");
await shot("Dumbbell Curl", 70, "new-db-70");
await shot("Lat Pulldown", 50, "new-lat-50");
await shot("Lat Pulldown", 150, "new-lat-150");
await browser.close();
console.log("done");
