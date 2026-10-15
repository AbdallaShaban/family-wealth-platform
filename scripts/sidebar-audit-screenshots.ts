import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";
import { sdk } from "../server/_core/sdk";
import * as db from "../server/db";
import { users } from "../drizzle/schema";
import { COOKIE_NAME } from "../shared/const";

const BASE_URL = process.env.AUDIT_BASE_URL || "http://localhost:3000";
const ARTIFACT_DIR = path.resolve(
  "C:/Users/abdal/.gemini/antigravity-ide/brain/e471036e-4a17-4175-b7d7-082fd5d3fc98/sidebar_audit"
);
const LOCAL_DIR = path.resolve(process.cwd(), ".visual-audit", "sidebar-audit");

async function run() {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  fs.mkdirSync(LOCAL_DIR, { recursive: true });

  const database = await db.getDb();
  if (!database) {
    console.error("Database connection failed");
    process.exit(1);
  }

  const [firstUser] = await database.select().from(users).limit(1);
  const sessionToken = await sdk.createSessionToken(firstUser.openId, { name: firstUser.name || "Auditor" });

  const browser = await chromium.launch({ headless: true });

  // 1. Desktop Dark Mode (Sidebar Element & Full App Context)
  {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 950 },
      colorScheme: "dark",
    });
    await context.addCookies([
      {
        name: COOKIE_NAME,
        value: sessionToken,
        domain: "localhost",
        path: "/",
        httpOnly: true,
        secure: false,
        sameSite: "Lax",
      },
    ]);

    const page = await context.newPage();
    await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle" });
    await page.evaluate(() => {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    });
    await page.waitForTimeout(600);

    // Capture sidebar alone (high-res crop)
    const sidebar = page.locator('aside[data-sidebar="true"]');
    if (await sidebar.isVisible()) {
      const darkSidebarBuffer = await sidebar.screenshot();
      fs.writeFileSync(path.join(ARTIFACT_DIR, "sidebar_dark_isolated.png"), darkSidebarBuffer);
      fs.writeFileSync(path.join(LOCAL_DIR, "sidebar_dark_isolated.png"), darkSidebarBuffer);
    }

    // Capture desktop layout with sidebar open
    const darkFullBuffer = await page.screenshot();
    fs.writeFileSync(path.join(ARTIFACT_DIR, "sidebar_dark_context.png"), darkFullBuffer);
    fs.writeFileSync(path.join(LOCAL_DIR, "sidebar_dark_context.png"), darkFullBuffer);

    // Collapsed sidebar
    const collapseBtn = page.locator(".fintech-v2-collapse");
    if (await collapseBtn.isVisible()) {
      await collapseBtn.click();
      await page.waitForTimeout(400);
      const collapsedBuffer = await sidebar.screenshot();
      fs.writeFileSync(path.join(ARTIFACT_DIR, "sidebar_dark_collapsed.png"), collapsedBuffer);
      fs.writeFileSync(path.join(LOCAL_DIR, "sidebar_dark_collapsed.png"), collapsedBuffer);
    }

    await context.close();
  }

  // 2. Desktop Light Mode
  {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 950 },
      colorScheme: "light",
    });
    await context.addCookies([
      {
        name: COOKIE_NAME,
        value: sessionToken,
        domain: "localhost",
        path: "/",
        httpOnly: true,
        secure: false,
        sameSite: "Lax",
      },
    ]);

    const page = await context.newPage();
    await page.goto(`${BASE_URL}/?theme=light`, { waitUntil: "networkidle" });
    await page.evaluate(() => {
      document.documentElement.classList.remove("dark");
      document.body.classList.remove("dark");
      localStorage.setItem("theme", "light");
    });
    await page.waitForTimeout(600);

    const sidebar = page.locator('aside[data-sidebar="true"]');
    if (await sidebar.isVisible()) {
      const lightSidebarBuffer = await sidebar.screenshot();
      fs.writeFileSync(path.join(ARTIFACT_DIR, "sidebar_light_isolated.png"), lightSidebarBuffer);
      fs.writeFileSync(path.join(LOCAL_DIR, "sidebar_light_isolated.png"), lightSidebarBuffer);
    }

    const lightFullBuffer = await page.screenshot();
    fs.writeFileSync(path.join(ARTIFACT_DIR, "sidebar_light_context.png"), lightFullBuffer);
    fs.writeFileSync(path.join(LOCAL_DIR, "sidebar_light_context.png"), lightFullBuffer);

    await context.close();
  }

  // 3. Mobile View (iPhone 14 / 390x844)
  {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      colorScheme: "dark",
    });
    await context.addCookies([
      {
        name: COOKIE_NAME,
        value: sessionToken,
        domain: "localhost",
        path: "/",
        httpOnly: true,
        secure: false,
        sameSite: "Lax",
      },
    ]);

    const page = await context.newPage();
    await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle" });
    await page.evaluate(() => {
      document.documentElement.classList.add("dark");
    });
    await page.waitForTimeout(400);

    // Capture mobile screen with bottom nav dock
    const mobileBottomNavBuffer = await page.screenshot();
    fs.writeFileSync(path.join(ARTIFACT_DIR, "mobile_dock_view.png"), mobileBottomNavBuffer);
    fs.writeFileSync(path.join(LOCAL_DIR, "mobile_dock_view.png"), mobileBottomNavBuffer);

    // Open mobile more drawer / sheet
    const moreBtn = page.locator('nav.fintech-bottom-nav button:has-text("الخدمات")');
    if (await moreBtn.isVisible()) {
      await moreBtn.click();
      await page.waitForTimeout(500);
      const mobileDrawerBuffer = await page.screenshot();
      fs.writeFileSync(path.join(ARTIFACT_DIR, "mobile_drawer_open.png"), mobileDrawerBuffer);
      fs.writeFileSync(path.join(LOCAL_DIR, "mobile_drawer_open.png"), mobileDrawerBuffer);
    }

    await context.close();
  }

  await browser.close();
  console.log("All sidebar audit screenshots captured successfully!");
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
