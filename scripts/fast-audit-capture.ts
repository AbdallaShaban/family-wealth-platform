import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { chromium, Page } from "@playwright/test";
import { sdk } from "../server/_core/sdk";
import * as db from "../server/db";
import { users } from "../drizzle/schema";
import { COOKIE_NAME } from "../shared/const";

const BASE_URL = "http://localhost:3000";
const OUTPUT_DIR = path.resolve(process.cwd(), ".visual-audit", "theme-audit");

const PAGES = [
  { slug: "01-dashboard", path: "/" },
  { slug: "02-banking", path: "/banking" },
  { slug: "03-transactions", path: "/transactions" },
  { slug: "04-investments", path: "/investments" },
  { slug: "05-governance", path: "/governance" },
  { slug: "06-login", path: "/login" },
];

async function loadAndCapture(
  page: Page,
  slug: string,
  urlPath: string,
  theme: "light" | "dark",
  outputPath: string,
  fullPage = false
) {
  const sep = urlPath.includes("?") ? "&" : "?";
  await page.goto(`${BASE_URL}${urlPath}${sep}theme=${theme}`, {
    waitUntil: "domcontentloaded",
    timeout: 10000,
  });

  await page.evaluate((th: string) => {
    localStorage.setItem("theme", th);
    if (th === "dark") {
      document.documentElement.classList.add("dark");
      document.body.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
      document.body.classList.remove("dark");
    }
  }, theme);

  if (slug === "01-dashboard") {
    // Wait for tRPC summary data to finish loading
    await page.waitForSelector("[data-slot='card'], .fintech-dashboard-grid", { timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(2000);
  } else {
    await page.waitForTimeout(1000);
  }

  await page.screenshot({ path: outputPath, fullPage });
}

async function capture() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const database = await db.getDb();
  const [firstUser] = await database!.select().from(users).limit(1);
  const sessionToken = await sdk.createSessionToken(firstUser.openId, { name: firstUser.name || "Abdalla" });

  const browser = await chromium.launch({ headless: true });

  // 1. Desktop Light Mode
  console.log("=== CAPTURING DESKTOP LIGHT MODE ===");
  const dLightCtx = await browser.newContext({
    viewport: { width: 1440, height: 950 },
    colorScheme: "light",
  });
  await dLightCtx.addCookies([{
    name: COOKIE_NAME,
    value: sessionToken,
    domain: "localhost",
    path: "/",
    httpOnly: true,
    secure: false,
    sameSite: "Lax",
  }]);
  const dLightPage = await dLightCtx.newPage();

  for (const p of PAGES) {
    try {
      console.log(`Desktop Light: ${p.slug}...`);
      await loadAndCapture(
        dLightPage,
        p.slug,
        p.path,
        "light",
        path.join(OUTPUT_DIR, `${p.slug}-desktop-light.png`),
        p.slug === "01-dashboard"
      );
    } catch (e: any) {
      console.error(`Failed ${p.slug} light:`, e.message);
    }
  }

  // 2. Desktop Dark Mode
  console.log("=== CAPTURING DESKTOP DARK MODE ===");
  const dDarkCtx = await browser.newContext({
    viewport: { width: 1440, height: 950 },
    colorScheme: "dark",
  });
  await dDarkCtx.addCookies([{
    name: COOKIE_NAME,
    value: sessionToken,
    domain: "localhost",
    path: "/",
    httpOnly: true,
    secure: false,
    sameSite: "Lax",
  }]);
  const dDarkPage = await dDarkCtx.newPage();

  for (const p of PAGES) {
    try {
      console.log(`Desktop Dark: ${p.slug}...`);
      await loadAndCapture(
        dDarkPage,
        p.slug,
        p.path,
        "dark",
        path.join(OUTPUT_DIR, `${p.slug}-desktop-dark.png`),
        p.slug === "01-dashboard"
      );
    } catch (e: any) {
      console.error(`Failed ${p.slug} dark:`, e.message);
    }
  }

  // 3. Mobile Light Mode (390x844)
  console.log("=== CAPTURING MOBILE LIGHT MODE ===");
  const mLightCtx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    colorScheme: "light",
  });
  await mLightCtx.addCookies([{
    name: COOKIE_NAME,
    value: sessionToken,
    domain: "localhost",
    path: "/",
    httpOnly: true,
    secure: false,
    sameSite: "Lax",
  }]);
  const mLightPage = await mLightCtx.newPage();

  for (const p of [PAGES[0], PAGES[1], PAGES[2]]) {
    try {
      console.log(`Mobile Light: ${p.slug}...`);
      await loadAndCapture(
        mLightPage,
        p.slug,
        p.path,
        "light",
        path.join(OUTPUT_DIR, `${p.slug}-mobile-light.png`),
        false
      );
    } catch (e: any) {
      console.error(`Failed ${p.slug} mobile light:`, e.message);
    }
  }

  // 4. Mobile Dark Mode (390x844)
  console.log("=== CAPTURING MOBILE DARK MODE ===");
  const mDarkCtx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    colorScheme: "dark",
  });
  await mDarkCtx.addCookies([{
    name: COOKIE_NAME,
    value: sessionToken,
    domain: "localhost",
    path: "/",
    httpOnly: true,
    secure: false,
    sameSite: "Lax",
  }]);
  const mDarkPage = await mDarkCtx.newPage();

  for (const p of [PAGES[0], PAGES[1], PAGES[2]]) {
    try {
      console.log(`Mobile Dark: ${p.slug}...`);
      await loadAndCapture(
        mDarkPage,
        p.slug,
        p.path,
        "dark",
        path.join(OUTPUT_DIR, `${p.slug}-mobile-dark.png`),
        false
      );
    } catch (e: any) {
      console.error(`Failed ${p.slug} mobile dark:`, e.message);
    }
  }

  await browser.close();
  console.log("=== AUDIT CAPTURE COMPLETE ===");
  process.exit(0);
}

capture().catch((e) => {
  console.error("Capture failed:", e);
  process.exit(1);
});
