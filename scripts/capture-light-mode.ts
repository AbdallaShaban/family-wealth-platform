import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { chromium, type BrowserContext, type Page } from "@playwright/test";
import { sdk } from "../server/_core/sdk";
import * as db from "../server/db";
import { users } from "../drizzle/schema";
import { COOKIE_NAME } from "../shared/const";

const BASE_URL = process.env.AUDIT_BASE_URL || "http://localhost:3000";
const OUTPUT_DIR = path.resolve(process.cwd(), ".visual-audit", "light-mode");

const ROUTES = [
  { path: "/", name: "01-overview", label: "Overview & Executive Dashboard" },
  { path: "/investments", name: "02-investments", label: "Holdings, Lots, Asset Allocation & Portfolio" },
  { path: "/quant", name: "03-quant", label: "Quantitative Signals, Screener & Technical Engine" },
  { path: "/debts", name: "04-debts", label: "Debts, Liabilities & Credit Cards Hub" },
  { path: "/certificates", name: "05-certificates", label: "Fixed Income & Bank Certificates Hub" },
  { path: "/transactions", name: "06-transactions", label: "General Cash Ledger & Audit Activity" },
  { path: "/cashflow", name: "07-cashflow", label: "Cash Flow Forecasting & Inflow/Outflow Trajectory" },
  { path: "/emergency-fund", name: "08-emergency-fund", label: "Emergency Reserve Calculator & Runway" },
  { path: "/budget", name: "09-budget", label: "Expense Allocation & Zero-Based Budgeting" },
  { path: "/reports", name: "10-reports", label: "Consolidated Balance Sheet, P&L & Tax Position" },
];

async function getAuthSessionCookie(): Promise<string | null> {
  try {
    const database = await db.getDb();
    if (!database) return null;
    const [firstUser] = await database.select().from(users).limit(1);
    if (!firstUser?.openId) return null;

    const token = await sdk.createSessionToken(firstUser.openId, {
      name: firstUser.name || "Principal Architect",
    });
    return token;
  } catch (err) {
    console.warn("[capture-light] Could not mint session cookie from database:", err);
    return null;
  }
}

async function applyLightMode(page: Page) {
  await page.evaluate(() => {
    localStorage.setItem("theme", "light");
    const root = document.documentElement;
    const body = document.body;
    root.classList.remove("dark");
    body.classList.remove("dark");
    root.classList.add("light");
    body.classList.add("light");
  });
  await page.waitForTimeout(600);
}

function attachErrorListeners(page: Page, contextName: string) {
  page.on("pageerror", (err) => {
    console.error(`  [PAGE ERROR] (${contextName}):`, err.message);
  });
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      const text = msg.text();
      if (!text.includes("favicon") && !text.includes("DevTools")) {
        console.warn(`  [BROWSER CONSOLE ERROR] (${contextName}):`, text);
      }
    }
  });
}

async function runLightModeAudit() {
  console.log(`\n======================================================================`);
  console.log(`  EXECUTIVE LIGHT-MODE ARCHITECTURAL RE-CAPTURE (PLAYWRIGHT)`);
  console.log(`  Target: ${BASE_URL}`);
  console.log(`  Output: ${OUTPUT_DIR}`);
  console.log(`======================================================================\n`);

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const sessionToken = await getAuthSessionCookie();
  if (sessionToken) {
    console.log(`✓ Active authenticated user session minted for audit\n`);
  } else {
    console.warn(`! No DB user found; proceeding without explicit session cookie\n`);
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
      console.log(`\n▶ [ROUTE] ${route.name}: ${route.label} (${route.path})`);

      // 1. Desktop Light Mode (1440x900)
      {
        const context = await browser.newContext({
          viewport: { width: 1440, height: 900 },
          colorScheme: "light",
        });
        await setupContext(context);
        const page = await context.newPage();
        attachErrorListeners(page, `${route.name}-desktop-light`);

        const resp = await page.goto(`${BASE_URL}${route.path}?theme=light`, {
          waitUntil: "networkidle",
          timeout: 30000,
        }).catch((err) => {
          console.warn(`  ! Navigation timeout on ${route.path} desktop light:`, err.message);
          return null;
        });

        if (resp) {
          console.log(`  ✓ HTTP ${resp.status()} [Desktop Light 1440x900]`);
        }

        await applyLightMode(page);
        await page.waitForTimeout(800);

        const screenshotPath = path.join(OUTPUT_DIR, `${route.name}-desktop-light.png`);
        await page.screenshot({ path: screenshotPath, fullPage: true });
        console.log(`  ✓ Saved Desktop Light: ${path.basename(screenshotPath)}`);
        await context.close();
      }

      // 2. Mobile Light Mode (390x844 e.g. iPhone portrait)
      {
        const context = await browser.newContext({
          viewport: { width: 390, height: 844 },
          isMobile: true,
          hasTouch: true,
          colorScheme: "light",
        });
        await setupContext(context);
        const page = await context.newPage();
        attachErrorListeners(page, `${route.name}-mobile-light`);

        const resp = await page.goto(`${BASE_URL}${route.path}?theme=light`, {
          waitUntil: "networkidle",
          timeout: 30000,
        }).catch((err) => {
          console.warn(`  ! Navigation timeout on ${route.path} mobile light:`, err.message);
          return null;
        });

        if (resp) {
          console.log(`  ✓ HTTP ${resp.status()} [Mobile Light 390x844]`);
        }

        await applyLightMode(page);
        await page.waitForTimeout(800);

        const screenshotPath = path.join(OUTPUT_DIR, `${route.name}-mobile-light.png`);
        await page.screenshot({ path: screenshotPath, fullPage: true });
        console.log(`  ✓ Saved Mobile Light:  ${path.basename(screenshotPath)}`);
        await context.close();
      }
    }

    console.log(`\n======================================================================`);
    console.log(`  SUCCESS: ALL 20 LIGHT-MODE SCREENSHOTS GENERATED IN:`);
    console.log(`  ${OUTPUT_DIR}`);
    console.log(`======================================================================\n`);
  } finally {
    await browser.close();
    process.exit(0);
  }
}

runLightModeAudit().catch((err) => {
  console.error("FATAL in runLightModeAudit:", err);
  process.exit(1);
});
