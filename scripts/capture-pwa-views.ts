import "dotenv/config";
import path from "node:path";
import { chromium } from "@playwright/test";
import { sdk } from "../server/_core/sdk";
import * as db from "../server/db";
import { users } from "../drizzle/schema";
import { COOKIE_NAME } from "../shared/const";

async function capturePwaViews() {
  const database = await db.getDb();
  const [firstUser] = await database.select().from(users).limit(1);
  const sessionToken = await sdk.createSessionToken(firstUser.openId, { name: firstUser.name || "Admin" });

  const brainDir = "C:\\Users\\abdal\\.gemini\\antigravity-ide\\brain\\5bd4cdcc-e17f-4f15-bc34-6a4e574b171d";

  const browser = await chromium.launch({ headless: true });
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

  // 1. Capture Dashboard with Topbar Offline Badge & Quick Entry
  await page.goto("http://localhost:3000/", { waitUntil: "networkidle", timeout: 25000 });
  await page.waitForTimeout(2500);
  const mainViewPath = path.join(brainDir, "pwa_dashboard_topbar.png");
  await page.screenshot({ path: mainViewPath, fullPage: true });
  console.log("Captured:", mainViewPath);

  // 2. Open Quick Offline Transaction Modal
  const quickEntryBtn = page.locator('button[aria-label="تسجيل سريع"]').first();
  if (await quickEntryBtn.isVisible()) {
    await quickEntryBtn.click();
    await page.waitForTimeout(1000);
    const modalPath = path.join(brainDir, "pwa_quick_transaction_modal.png");
    await page.screenshot({ path: modalPath, fullPage: false });
    console.log("Captured:", modalPath);

    // Close modal
    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);
  }

  // 3. Open Offline Sync Center Modal
  const statusBadge = page.locator('button[aria-label="حالة الاتصال والمزامنة"]').first();
  if (await statusBadge.isVisible()) {
    await statusBadge.click();
    await page.waitForTimeout(1000);
    const queuePath = path.join(brainDir, "pwa_offline_queue_modal.png");
    await page.screenshot({ path: queuePath, fullPage: false });
    console.log("Captured:", queuePath);
  }

  await browser.close();
  console.log("PWA visual verification views captured successfully!");
}

capturePwaViews().catch((err) => {
  console.error("Capture failed:", err);
  process.exit(1);
});
