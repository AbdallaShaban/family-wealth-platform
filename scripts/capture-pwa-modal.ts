import "dotenv/config";
import path from "node:path";
import { chromium } from "@playwright/test";
import { sdk } from "../server/_core/sdk";
import * as db from "../server/db";
import { users } from "../drizzle/schema";
import { COOKIE_NAME } from "../shared/const";

async function capturePwaModal() {
  const database = await db.getDb();
  const [firstUser] = await database.select().from(users).limit(1);
  const sessionToken = await sdk.createSessionToken(firstUser.openId, { name: firstUser.name || "Admin" });

  const brainDir = "C:\\Users\\abdal\\.gemini\\antigravity-ide\\brain\\5bd4cdcc-e17f-4f15-bc34-6a4e574b171d";

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
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
  await page.goto("http://localhost:3000/", { waitUntil: "networkidle", timeout: 25000 });
  await page.waitForTimeout(2000);

  // Open mobile drawer
  await page.locator(".fintech-mobile-menu").first().click();
  await page.waitForTimeout(600);

  // Click on PWA item inside drawer
  await page.locator("button:has-text('تثبيت المنصة على الهاتف')").first().click();
  await page.waitForTimeout(800);

  // 1. Screenshot Tab 1: Direct Web Shortcut
  const shortcutModalPath = path.join(brainDir, "mobile_pwa_shortcut_modal.png");
  await page.screenshot({ path: shortcutModalPath, fullPage: false });
  console.log("Captured:", shortcutModalPath);

  // 2. Click Tab 2: Android PWA & Play Protect guide
  await page.locator("button:has-text('تثبيت PWA')").first().click();
  await page.waitForTimeout(600);
  const playProtectModalPath = path.join(brainDir, "mobile_pwa_play_protect_tab.png");
  await page.screenshot({ path: playProtectModalPath, fullPage: false });
  console.log("Captured:", playProtectModalPath);

  // 3. Click Tab 3: iOS Safari guide
  await page.locator("button:has-text('آيفون (iOS)')").first().click();
  await page.waitForTimeout(600);
  const iosModalPath = path.join(brainDir, "mobile_pwa_ios_tab.png");
  await page.screenshot({ path: iosModalPath, fullPage: false });
  console.log("Captured:", iosModalPath);

  await browser.close();
  console.log("Done!");
}

capturePwaModal().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
