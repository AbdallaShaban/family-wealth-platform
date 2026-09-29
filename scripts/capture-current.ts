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
    const ctx = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    });
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
    await page.addInitScript(() => {
      localStorage.setItem("theme", "light");
    });
    await page.goto("http://localhost:3000/?theme=light", { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(3000);

    const outPathLight = path.join(auditDir, "light-mode.png");
    const brainLight = path.join(brainDir, "light-mode.png");
    await page.screenshot({ path: outPathLight, fullPage: false });
    fs.copyFileSync(outPathLight, brainLight);
    
    // Also full page for complete layout audit
    const outFullLight = path.join(auditDir, "light-mode-full.png");
    const brainFullLight = path.join(brainDir, "light-mode-full.png");
    await page.screenshot({ path: outFullLight, fullPage: true });
    fs.copyFileSync(outFullLight, brainFullLight);
    console.log("Light mode captured successfully:", outPathLight);
    await ctx.close();
  }

  // 2. Capture Dark Mode
  {
    const ctx = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    });
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
    await page.addInitScript(() => {
      localStorage.setItem("theme", "dark");
    });
    await page.goto("http://localhost:3000/?theme=dark", { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(3000);

    const outPathDark = path.join(auditDir, "dark-mode.png");
    const brainDark = path.join(brainDir, "dark-mode.png");
    await page.screenshot({ path: outPathDark, fullPage: false });
    fs.copyFileSync(outPathDark, brainDark);

    const outFullDark = path.join(auditDir, "dark-mode-full.png");
    const brainFullDark = path.join(brainDir, "dark-mode-full.png");
    await page.screenshot({ path: outFullDark, fullPage: true });
    fs.copyFileSync(outFullDark, brainFullDark);
    console.log("Dark mode captured successfully:", outPathDark);
    await ctx.close();
  }

  await browser.close();
  console.log("Both light and dark mode captures finished!");
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
