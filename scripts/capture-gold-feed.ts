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

  // 1. Capture Light Mode
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 950 } });
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
    await page.goto("http://localhost:3000/investments?theme=light", { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(2500);

    const outPathLight = path.join(auditDir, "investments_gold_live_light.png");
    const brainLight = path.join(brainDir, "investments_gold_live_light.png");
    await page.screenshot({ path: outPathLight, fullPage: false });
    fs.copyFileSync(outPathLight, brainLight);
    console.log("Light mode captured successfully:", outPathLight);
    await ctx.close();
  }

  // 2. Capture Dark Mode
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 950 } });
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
    await page.goto("http://localhost:3000/investments?theme=dark", { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(2500);

    const outPathDark = path.join(auditDir, "investments_gold_live_dark.png");
    const brainDark = path.join(brainDir, "investments_gold_live_dark.png");
    await page.screenshot({ path: outPathDark, fullPage: false });
    fs.copyFileSync(outPathDark, brainDark);
    console.log("Dark mode captured successfully:", outPathDark);
    await ctx.close();
  }

  await browser.close();
  console.log("Gold and FX feed visual capture completed!");
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
