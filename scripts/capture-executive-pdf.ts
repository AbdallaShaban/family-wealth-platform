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

  // 1. Capture Reports Page & Modal (Dark Mode)
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
    await page.goto("http://localhost:3000/reports?theme=dark", { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(2500);

    const reportsDark = path.join(auditDir, "executive_pdf_reports_dark.png");
    const brainReportsDark = path.join(brainDir, "executive_pdf_reports_dark.png");
    await page.screenshot({ path: reportsDark, fullPage: false });
    fs.copyFileSync(reportsDark, brainReportsDark);
    console.log("Reports page dark mode captured:", reportsDark);

    // Open Modal
    const btn = page.locator('button:has-text("تقرير الثروة التنفيذي (PDF)")').first();
    if (await btn.isVisible()) {
      await btn.click();
      await page.waitForTimeout(2000);
      const modalDark = path.join(auditDir, "executive_pdf_modal_dark.png");
      const brainModalDark = path.join(brainDir, "executive_pdf_modal_dark.png");
      await page.screenshot({ path: modalDark, fullPage: false });
      fs.copyFileSync(modalDark, brainModalDark);
      console.log("Executive modal dark mode captured:", modalDark);
    }
    await ctx.close();
  }

  // 2. Capture Reports Page & Modal (Light Mode)
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
    await page.goto("http://localhost:3000/reports?theme=light", { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(2500);

    const btn = page.locator('button:has-text("تقرير الثروة التنفيذي (PDF)")').first();
    if (await btn.isVisible()) {
      await btn.click();
      await page.waitForTimeout(2000);
      const modalLight = path.join(auditDir, "executive_pdf_modal_light.png");
      const brainModalLight = path.join(brainDir, "executive_pdf_modal_light.png");
      await page.screenshot({ path: modalLight, fullPage: false });
      fs.copyFileSync(modalLight, brainModalLight);
      console.log("Executive modal light mode captured:", modalLight);
    }
    await ctx.close();
  }

  await browser.close();
  console.log("All visual captures completed!");
}

main().catch((err) => {
  console.error("Capture error:", err);
  process.exit(1);
});
