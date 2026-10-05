import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";
import { sdk } from "../server/_core/sdk";
import * as db from "../server/db";
import { users } from "../drizzle/schema";
import { COOKIE_NAME } from "../shared/const";

const BASE_URL = "http://localhost:3000";
const OUTPUT_DIR = path.resolve(process.cwd(), ".visual-audit", "impeccable-overhaul");

async function main() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const database = await db.getDb();
  const [firstUser] = await database!.select().from(users).limit(1);
  const sessionToken = await sdk.createSessionToken(firstUser.openId, { name: firstUser.name || "Abdalla" });

  const browser = await chromium.launch({ headless: true });

  // 1. Desktop Dark Mode (1440x950)
  const desktopCtx = await browser.newContext({
    viewport: { width: 1440, height: 950 },
    colorScheme: "dark",
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
  console.log("Capturing Desktop Fintech Dashboard...");
  await desktopPage.goto(`${BASE_URL}/?theme=dark`, { waitUntil: "networkidle", timeout: 25000 });
  await desktopPage.waitForTimeout(1000);
  const desktopPath = path.join(OUTPUT_DIR, "01-desktop-dashboard-overhaul.png");
  await desktopPage.screenshot({ path: desktopPath, fullPage: true });
  console.log(`Saved: ${desktopPath}`);

  // 2. Mobile Viewport (390x844) - iPhone 14 / Pixel
  const mobileCtx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    colorScheme: "dark",
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
  console.log("Capturing Mobile Dashboard & Bottom Nav...");
  await mobilePage.goto(`${BASE_URL}/?theme=dark`, { waitUntil: "networkidle", timeout: 25000 });
  await mobilePage.waitForTimeout(1000);
  const mobilePath = path.join(OUTPUT_DIR, "02-mobile-dashboard-and-dock.png");
  await mobilePage.screenshot({ path: mobilePath });
  console.log(`Saved: ${mobilePath}`);

  // 3. Mobile Quick Transaction Modal (Bottom Sheet test)
  console.log("Triggering Quick Transaction Modal on Mobile...");
  const quickBtn = mobilePage.locator(".fintech-bottom-quick");
  if (await quickBtn.isVisible()) {
    await quickBtn.click();
    await mobilePage.waitForTimeout(600);
    const modalPath = path.join(OUTPUT_DIR, "03-mobile-quick-modal.png");
    await mobilePage.screenshot({ path: modalPath });
    console.log(`Saved: ${modalPath}`);
  }

  await browser.close();
  console.log("ALL VERIFICATION SCREENSHOTS CAPTURED!");
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
