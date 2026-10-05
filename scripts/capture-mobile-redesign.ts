import "dotenv/config";
import path from "node:path";
import { chromium } from "@playwright/test";
import { sdk } from "../server/_core/sdk";
import * as db from "../server/db";
import { users } from "../drizzle/schema";
import { COOKIE_NAME } from "../shared/const";

async function captureMobileRedesign() {
  const database = await db.getDb();
  const [firstUser] = await database.select().from(users).limit(1);
  const sessionToken = await sdk.createSessionToken(firstUser.openId, { name: firstUser.name || "Admin" });

  const brainDir = "C:\\Users\\abdal\\.gemini\\antigravity-ide\\brain\\5bd4cdcc-e17f-4f15-bc34-6a4e574b171d";

  const browser = await chromium.launch({ headless: true });

  // 1. Mobile viewport 390x844 (iPhone 14 / Pixel 7 standard mobile viewport)
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
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

  // Load Dashboard on mobile
  console.log("Navigating to http://localhost:3000/ on mobile viewport (390x844)...");
  await page.goto("http://localhost:3000/", { waitUntil: "networkidle", timeout: 25000 });
  await page.waitForTimeout(3000);

  // Capture 1: Clean Mobile Topbar & Main Dashboard
  const mobileDashboardPath = path.join(brainDir, "mobile_clean_topbar_dashboard.png");
  await page.screenshot({ path: mobileDashboardPath, fullPage: false });
  console.log("Captured clean mobile dashboard:", mobileDashboardPath);

  // Capture 2: Open Mobile Drawer Menu (SheetContent)
  const menuBtn = page.locator(".fintech-mobile-menu").first();
  if (await menuBtn.isVisible()) {
    await menuBtn.click();
    await page.waitForTimeout(1000);
    const mobileDrawerPath = path.join(brainDir, "mobile_drawer_quick_tools.png");
    await page.screenshot({ path: mobileDrawerPath, fullPage: false });
    console.log("Captured mobile drawer with quick tools:", mobileDrawerPath);
  }

  // Capture 3: Open PWA Install Modal from Drawer
  const pwaInstallCard = page.locator("button:has-text('تثبيت المنصة على الهاتف')").first();
  if (await pwaInstallCard.isVisible()) {
    await pwaInstallCard.click();
    await page.waitForTimeout(1000);
    const pwaModalPath = path.join(brainDir, "mobile_pwa_install_modal.png");
    await page.screenshot({ path: pwaModalPath, fullPage: false });
    console.log("Captured mobile PWA install guide modal:", pwaModalPath);

    // Switch to Android WebAPK Tab
    const apkTab = page.locator("button:has-text('تثبيت PWA')").first();
    if (await apkTab.isVisible()) {
      await apkTab.click();
      await page.waitForTimeout(600);
      const pwaApkTabPath = path.join(brainDir, "mobile_pwa_play_protect_guide.png");
      await page.screenshot({ path: pwaApkTabPath, fullPage: false });
      console.log("Captured mobile PWA Play Protect guidance:", pwaApkTabPath);
    }

    // Close modal
    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);
  }

  // Capture 4: Compact Screen (360x740 - compact Android device)
  const compactPage = await ctx.newPage();
  await compactPage.setViewportSize({ width: 360, height: 740 });
  await compactPage.goto("http://localhost:3000/transactions", { waitUntil: "networkidle", timeout: 25000 });
  await compactPage.waitForTimeout(2500);
  const compactTransactionsPath = path.join(brainDir, "mobile_compact_360_transactions.png");
  await compactPage.screenshot({ path: compactTransactionsPath, fullPage: false });
  console.log("Captured compact 360px transactions view:", compactTransactionsPath);

  await browser.close();
  console.log("All mobile verification screenshots captured successfully!");
}

captureMobileRedesign().catch((err) => {
  console.error("Mobile capture failed:", err);
  process.exit(1);
});
