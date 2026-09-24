import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { chromium, type BrowserContext } from "@playwright/test";
import { sdk } from "../server/_core/sdk";
import * as db from "../server/db";
import { users } from "../drizzle/schema";
import { COOKIE_NAME } from "../shared/const";

const BASE_URL = process.env.AUDIT_BASE_URL || "http://localhost:3000";
const OUTPUT_DIR = path.resolve(process.cwd(), ".visual-audit");

const ROUTES = [
  { path: "/", name: "overview" },
  { path: "/investments", name: "investments" },
  { path: "/quant", name: "quant" },
  { path: "/debts", name: "debts" },
  { path: "/certificates", name: "certificates" },
];

async function getAuthSessionCookie(): Promise<string | null> {
  try {
    const database = await db.getDb();
    if (!database) return null;
    const [firstUser] = await database.select().from(users).limit(1);
    if (!firstUser?.openId) return null;

    const token = await sdk.createSessionToken(firstUser.openId, {
      name: firstUser.name || "Auditor",
    });
    return token;
  } catch (err) {
    console.warn("[capture-ui] Could not mint session cookie from database:", err);
    return null;
  }
}

async function applyTheme(page: any, theme: "dark" | "light") {
  await page.evaluate((t: string) => {
    localStorage.setItem("theme", t);
    const root = document.documentElement;
    const body = document.body;
    if (t === "dark") {
      root.classList.add("dark");
      body.classList.add("dark");
    } else {
      root.classList.remove("dark");
      body.classList.remove("dark");
    }
  }, theme);
  // Allow transitions/charts to settle
  await page.waitForTimeout(800);
}

async function runVisualAudit() {
  console.log(`\n======================================================`);
  console.log(`  STARTING AUTOMATED VISUAL UI AUDIT (PLAYWRIGHT)`);
  console.log(`  Target: ${BASE_URL}`);
  console.log(`  Output: ${OUTPUT_DIR}`);
  console.log(`======================================================\n`);

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const sessionToken = await getAuthSessionCookie();
  if (sessionToken) {
    console.log(`✓ Active authenticated user session minted for UI audit`);
  } else {
    console.warn(`! No DB user found; proceeding without explicit session cookie`);
  }

  const browser = await chromium.launch({
    headless: true,
  });

  const setupContext = async (context: BrowserContext) => {
    if (sessionToken) {
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
    }
  };

  try {
    for (const route of ROUTES) {
      console.log(`\n--- Auditing Route: ${route.path} (${route.name}) ---`);

      // 1. Desktop Dark Mode (1440x900)
      {
        const context = await browser.newContext({
          viewport: { width: 1440, height: 900 },
          colorScheme: "dark",
        });
        await setupContext(context);
        const page = await context.newPage();

        const url = `${BASE_URL}${route.path}?theme=dark`;
        await page.goto(url, { waitUntil: "networkidle", timeout: 25000 }).catch(() => {});
        await applyTheme(page, "dark");
        await page.waitForTimeout(1000);

        const screenshotPath = path.join(OUTPUT_DIR, `${route.name}-dark.png`);
        await page.screenshot({ path: screenshotPath, fullPage: true });
        console.log(`  ✓ Saved Desktop Dark:  ${path.relative(process.cwd(), screenshotPath)}`);
        await context.close();
      }

      // 2. Desktop Light Mode (1440x900)
      {
        const context = await browser.newContext({
          viewport: { width: 1440, height: 900 },
          colorScheme: "light",
        });
        await setupContext(context);
        const page = await context.newPage();

        const url = `${BASE_URL}${route.path}?theme=light`;
        await page.goto(url, { waitUntil: "networkidle", timeout: 25000 }).catch(() => {});
        await applyTheme(page, "light");
        await page.waitForTimeout(1000);

        const screenshotPath = path.join(OUTPUT_DIR, `${route.name}-light.png`);
        await page.screenshot({ path: screenshotPath, fullPage: true });
        console.log(`  ✓ Saved Desktop Light: ${path.relative(process.cwd(), screenshotPath)}`);
        await context.close();
      }

      // 3. Mobile Viewport (390x844 e.g. iPhone / Android portrait)
      {
        const context = await browser.newContext({
          viewport: { width: 390, height: 844 },
          isMobile: true,
          hasTouch: true,
          colorScheme: "dark",
        });
        await setupContext(context);
        const page = await context.newPage();

        const url = `${BASE_URL}${route.path}?theme=dark`;
        await page.goto(url, { waitUntil: "networkidle", timeout: 25000 }).catch(() => {});
        await applyTheme(page, "dark");
        await page.waitForTimeout(1000);

        const screenshotPath = path.join(OUTPUT_DIR, `${route.name}-mobile.png`);
        await page.screenshot({ path: screenshotPath, fullPage: true });
        console.log(`  ✓ Saved Mobile View:   ${path.relative(process.cwd(), screenshotPath)}`);
        await context.close();
      }
    }

    console.log(`\n======================================================`);
    console.log(`  ALL 15 SCREENSHOTS GENERATED IN ${OUTPUT_DIR}`);
    console.log(`======================================================\n`);
  } finally {
    await browser.close();
    process.exit(0);
  }
}

runVisualAudit().catch((err) => {
  console.error("FATAL in runVisualAudit:", err);
  process.exit(1);
});
