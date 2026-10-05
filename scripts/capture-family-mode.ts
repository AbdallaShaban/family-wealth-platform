import "dotenv/config";
import path from "node:path";
import { chromium } from "@playwright/test";
import { sdk } from "../server/_core/sdk";
import * as db from "../server/db";
import { users } from "../drizzle/schema";
import { COOKIE_NAME } from "../shared/const";

async function captureFamilyMode() {
  const database = await db.getDb();
  const [firstUser] = await database.select().from(users).limit(1);
  const sessionToken = await sdk.createSessionToken(firstUser.openId, { name: firstUser.name || "Abdalla" });

  const brainDir = "C:\\Users\\abdal\\.gemini\\antigravity-ide\\brain\\5bd4cdcc-e17f-4f15-bc34-6a4e574b171d";

  const browser = await chromium.launch({ headless: true });

  // 1. Desktop Context
  const desktopCtx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1.5,
  });
  await desktopCtx.addCookies([{
    name: COOKIE_NAME,
    value: sessionToken,
    domain: "localhost",
    path: "/",
    httpOnly: true,
    secure: false,
    sameSite: "Lax",
  }]);

  const desktopPage = await desktopCtx.newPage();
  await desktopPage.goto("http://localhost:3000/", { waitUntil: "networkidle", timeout: 25000 });
  await desktopPage.waitForTimeout(2000);

  // Screenshot 1: Desktop Family Mode
  const desktopFamilyPath = path.join(brainDir, "desktop_family_mode_dashboard.png");
  await desktopPage.screenshot({ path: desktopFamilyPath, fullPage: false });
  console.log("Captured:", desktopFamilyPath);

  // 2. Mobile Context (iPhone 14 / 390px)
  const mobileCtx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
  });
  await mobileCtx.addCookies([{
    name: COOKIE_NAME,
    value: sessionToken,
    domain: "localhost",
    path: "/",
    httpOnly: true,
    secure: false,
    sameSite: "Lax",
  }]);

  const mobilePage = await mobileCtx.newPage();
  await mobilePage.goto("http://localhost:3000/", { waitUntil: "networkidle", timeout: 25000 });
  await mobilePage.waitForTimeout(2000);

  // Screenshot 2: Mobile Family Mode
  const mobileFamilyPath = path.join(brainDir, "mobile_family_mode_pulse.png");
  await mobilePage.screenshot({ path: mobileFamilyPath, fullPage: false });
  console.log("Captured:", mobileFamilyPath);

  // Open Quick Offline Transaction Modal via center bottom button
  const quickButton = mobilePage.locator(".fintech-bottom-quick").first();
  await quickButton.click();
  await mobilePage.waitForTimeout(800);

  // Screenshot 3: Quick Capture with 1-click categories and amount pills
  const mobileQuickCapturePath = path.join(brainDir, "mobile_quick_capture_chips.png");
  await mobilePage.screenshot({ path: mobileQuickCapturePath, fullPage: false });
  console.log("Captured:", mobileQuickCapturePath);

  await browser.close();
  console.log("All screenshots captured successfully!");
}

captureFamilyMode().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
