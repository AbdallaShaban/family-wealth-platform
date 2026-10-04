import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";
import { sdk } from "../server/_core/sdk";
import * as db from "../server/db";
import { users } from "../drizzle/schema";
import { COOKIE_NAME } from "../shared/const";

async function main() {
  const database = await db.getDb();
  const [firstUser] = await database!.select().from(users).limit(1);
  const sessionToken = await sdk.createSessionToken(firstUser.openId, { name: firstUser.name || "Auditor" });

  const auditDir = path.resolve(process.cwd(), ".visual-audit");
  const brainDir = "C:\\Users\\abdal\\.gemini\\antigravity-ide\\brain\\5bd4cdcc-e17f-4f15-bc34-6a4e574b171d";

  fs.mkdirSync(auditDir, { recursive: true });
  fs.mkdirSync(brainDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });

  // 1. Capture Dark Mode
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
    await ctx.addCookies([{
      name: COOKIE_NAME,
      value: sessionToken,
      domain: "localhost",
      path: "/",
      httpOnly: true,
      secure: false,
      sameSite: "Lax",
    }]);

    const page = await ctx.newPage();
    await page.addInitScript(() => { localStorage.setItem("theme", "dark"); });
    await page.goto("http://localhost:3000/wealth-health?theme=dark", { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(3000);

    const outPathDark = path.join(auditDir, "wealth_advisor_hub_dark.png");
    const brainDark = path.join(brainDir, "wealth_advisor_hub_dark.png");
    await page.screenshot({ path: outPathDark, fullPage: false });
    fs.copyFileSync(outPathDark, brainDark);
    console.log("Dark mode captured:", outPathDark);

    // Click on rebalancing tab to capture recommendations
    const rebalanceTab = page.locator("button:has-text('توصيات إعادة التوازن')");
    if (await rebalanceTab.isVisible()) {
      await rebalanceTab.click();
      await page.waitForTimeout(1000);
      const outPathRebalance = path.join(auditDir, "wealth_advisor_rebalance_tab_dark.png");
      const brainRebalance = path.join(brainDir, "wealth_advisor_rebalance_tab_dark.png");
      await page.screenshot({ path: outPathRebalance, fullPage: false });
      fs.copyFileSync(outPathRebalance, brainRebalance);
      console.log("Rebalance tab captured:", outPathRebalance);
    }

    await ctx.close();
  }

  // 2. Capture Light Mode
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
    await ctx.addCookies([{
      name: COOKIE_NAME,
      value: sessionToken,
      domain: "localhost",
      path: "/",
      httpOnly: true,
      secure: false,
      sameSite: "Lax",
    }]);

    const page = await ctx.newPage();
    await page.addInitScript(() => { localStorage.setItem("theme", "light"); });
    await page.goto("http://localhost:3000/wealth-health?theme=light", { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(3000);

    const outPathLight = path.join(auditDir, "wealth_advisor_hub_light.png");
    const brainLight = path.join(brainDir, "wealth_advisor_hub_light.png");
    await page.screenshot({ path: outPathLight, fullPage: false });
    fs.copyFileSync(outPathLight, brainLight);
    console.log("Light mode captured:", outPathLight);
    await ctx.close();
  }

  await browser.close();
  console.log("Advisor visual audit complete!");
}

main().catch(err => {
  console.error("Visual capture error:", err);
  process.exit(1);
});
