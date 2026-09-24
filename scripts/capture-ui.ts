import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { chromium, type BrowserContext, type Page } from "@playwright/test";
import { sdk } from "../server/_core/sdk";
import * as db from "../server/db";
import { users } from "../drizzle/schema";
import { COOKIE_NAME } from "../shared/const";

const BASE_URL = process.env.AUDIT_BASE_URL || "http://localhost:3000";
const OUTPUT_DIR = path.resolve(process.cwd(), ".visual-audit", "full");

const ROUTES = [
  { path: "/", name: "01-overview", label: "Executive Overview Dashboard" },
  { path: "/investments", name: "02-investments", label: "Holdings, Lots & Portfolio Management" },
  { path: "/quant", name: "03-quant", label: "Quantitative Signals & Stock Search" },
  { path: "/debts", name: "04-debts", label: "Debts & Credit Cards Hub" },
  { path: "/certificates", name: "05-certificates", label: "Bank Certificates Hub" },
  { path: "/transactions", name: "06-transactions", label: "Cash Ledger & Activity History" },
  { path: "/cashflow", name: "07-cashflow", label: "Cashflow & Liquidity Forecast" },
  { path: "/emergency-fund", name: "08-emergency-fund", label: "Emergency Reserve Hub" },
  { path: "/budget", name: "09-budget", label: "Budgets & Expense Allocation" },
  { path: "/reports", name: "10-reports", label: "Financial Statements & Tax Reporting" },
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

async function applyTheme(page: Page, theme: "dark" | "light") {
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
  await page.waitForTimeout(600);
}

function attachErrorListeners(page: Page, contextName: string) {
  page.on("pageerror", (err) => {
    console.error(`  [PAGE ERROR] (${contextName}):`, err.message);
  });
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      // Suppress known benign external font/tracker warnings if any
      const text = msg.text();
      if (!text.includes("favicon") && !text.includes("DevTools")) {
        console.warn(`  [BROWSER CONSOLE ERROR] (${contextName}):`, text);
      }
    }
  });
}

async function runVisualAudit() {
  console.log(`\n======================================================================`);
  console.log(`  EXHAUSTIVE MULTI-ROUTE VISUAL UI AUDIT (PLAYWRIGHT)`);
  console.log(`  Target: ${BASE_URL}`);
  console.log(`  Output: ${OUTPUT_DIR}`);
  console.log(`======================================================================\n`);

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const sessionToken = await getAuthSessionCookie();
  if (sessionToken) {
    console.log(`✓ Active authenticated user session minted for UI audit\n`);
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
    // -------------------------------------------------------------------------
    // PART 1: Capture 10 Core Functional Routes across 3 Views
    // -------------------------------------------------------------------------
    for (const route of ROUTES) {
      console.log(`\n▶ [ROUTE] ${route.name}: ${route.label} (${route.path})`);

      // 1. Desktop Dark Mode (1440x900)
      {
        const context = await browser.newContext({
          viewport: { width: 1440, height: 900 },
          colorScheme: "dark",
        });
        await setupContext(context);
        const page = await context.newPage();
        attachErrorListeners(page, `${route.name}-dark`);

        const resp = await page.goto(`${BASE_URL}${route.path}?theme=dark`, {
          waitUntil: "networkidle",
          timeout: 30000,
        }).catch((err) => {
          console.warn(`  ! Navigation timeout on ${route.path} dark:`, err.message);
          return null;
        });

        if (resp) {
          console.log(`  ✓ HTTP ${resp.status()} [Dark Desktop]`);
        }

        await applyTheme(page, "dark");
        await page.waitForTimeout(800);

        const screenshotPath = path.join(OUTPUT_DIR, `${route.name}-dark.png`);
        await page.screenshot({ path: screenshotPath, fullPage: true });
        console.log(`  ✓ Saved Desktop Dark:  ${path.basename(screenshotPath)}`);
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
        attachErrorListeners(page, `${route.name}-light`);

        const resp = await page.goto(`${BASE_URL}${route.path}?theme=light`, {
          waitUntil: "networkidle",
          timeout: 30000,
        }).catch((err) => {
          console.warn(`  ! Navigation timeout on ${route.path} light:`, err.message);
          return null;
        });

        if (resp) {
          console.log(`  ✓ HTTP ${resp.status()} [Light Desktop]`);
        }

        await applyTheme(page, "light");
        await page.waitForTimeout(800);

        const screenshotPath = path.join(OUTPUT_DIR, `${route.name}-light.png`);
        await page.screenshot({ path: screenshotPath, fullPage: true });
        console.log(`  ✓ Saved Desktop Light: ${path.basename(screenshotPath)}`);
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
        attachErrorListeners(page, `${route.name}-mobile`);

        await page.goto(`${BASE_URL}${route.path}?theme=dark`, {
          waitUntil: "networkidle",
          timeout: 30000,
        }).catch(() => {});

        await applyTheme(page, "dark");
        await page.waitForTimeout(800);

        const screenshotPath = path.join(OUTPUT_DIR, `${route.name}-mobile.png`);
        await page.screenshot({ path: screenshotPath, fullPage: true });
        console.log(`  ✓ Saved Mobile View:   ${path.basename(screenshotPath)}`);
        await context.close();
      }
    }

    // -------------------------------------------------------------------------
    // PART 2: Interactive Modal States
    // -------------------------------------------------------------------------
    console.log(`\n======================================================================`);
    console.log(`  CAPTURING INTERACTIVE MODAL STATES`);
    console.log(`======================================================================\n`);

    // A. Omni-Input Command Bar (Ctrl + K)
    for (const theme of ["dark", "light"] as const) {
      console.log(`▶ [MODAL] Omni-Input Command Bar (${theme})`);
      const context = await browser.newContext({
        viewport: { width: 1440, height: 900 },
        colorScheme: theme,
      });
      await setupContext(context);
      const page = await context.newPage();
      attachErrorListeners(page, `omni-command-${theme}`);

      await page.goto(`${BASE_URL}/?theme=${theme}`, { waitUntil: "networkidle" }).catch(() => {});
      await applyTheme(page, theme);

      // Trigger via Ctrl+k or button click
      const omniBtn = page.locator("button:has-text('ctrl+k'), button:has-text('⌘k')").first();
      if (await omniBtn.isVisible()) {
        await omniBtn.click();
      } else {
        await page.keyboard.press("Control+k");
      }
      await page.waitForTimeout(600);

      // Type sample query into omni palette input
      const omniInput = page.locator("input[placeholder*='اكتب']").first();
      if (await omniInput.isVisible()) {
        await omniInput.fill("شراء 100 COMI @ 88.5 حساب CIB");
        await page.waitForTimeout(400);
      }

      const screenshotPath = path.join(OUTPUT_DIR, `modal-omni-command-${theme}.png`);
      await page.screenshot({ path: screenshotPath });
      console.log(`  ✓ Saved Modal Screenshot: ${path.basename(screenshotPath)}`);
      await context.close();
    }

    // B. Quick Balance Reconciliation Modal (🔄)
    for (const theme of ["dark", "light"] as const) {
      console.log(`▶ [MODAL] Quick Balance Reconciliation (${theme})`);
      const context = await browser.newContext({
        viewport: { width: 1440, height: 900 },
        colorScheme: theme,
      });
      await setupContext(context);
      const page = await context.newPage();
      attachErrorListeners(page, `reconciliation-${theme}`);

      await page.goto(`${BASE_URL}/?theme=${theme}`, { waitUntil: "networkidle" }).catch(() => {});
      await applyTheme(page, theme);

      // Scroll to account cards at the bottom
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(600);

      // Locate first reconcile trigger on financial position card
      const reconcileBtn = page.locator("text='تسوية 🔄'").first();
      if (await reconcileBtn.isVisible()) {
        await reconcileBtn.click();
        await page.waitForTimeout(700);
      }

      const screenshotPath = path.join(OUTPUT_DIR, `modal-reconciliation-${theme}.png`);
      await page.screenshot({ path: screenshotPath });
      console.log(`  ✓ Saved Modal Screenshot: ${path.basename(screenshotPath)}`);
      await context.close();
    }

    // C. Add Instrument / Record Trade Modal
    for (const theme of ["dark", "light"] as const) {
      console.log(`▶ [MODAL] Add Instrument / Record Trade Modal (${theme})`);
      const context = await browser.newContext({
        viewport: { width: 1440, height: 900 },
        colorScheme: theme,
      });
      await setupContext(context);
      const page = await context.newPage();
      attachErrorListeners(page, `record-trade-${theme}`);

      await page.goto(`${BASE_URL}/investments?theme=${theme}`, { waitUntil: "networkidle" }).catch(() => {});
      await applyTheme(page, theme);

      // Click "الأدوات" tab to access "+ إضافة أداة استثمارية" modal
      const toolsTab = page.locator("button:has-text('الأدوات')").first();
      if (await toolsTab.isVisible()) {
        await toolsTab.click();
        await page.waitForTimeout(500);
      }
      const addBtn = page.locator("button:has-text('إضافة أداة')").first();
      if (await addBtn.isVisible()) {
        await addBtn.click();
        await page.waitForTimeout(700);
      }

      const screenshotPath = path.join(OUTPUT_DIR, `modal-record-trade-${theme}.png`);
      await page.screenshot({ path: screenshotPath });
      console.log(`  ✓ Saved Modal Screenshot: ${path.basename(screenshotPath)}`);
      await context.close();
    }

    console.log(`\n======================================================================`);
    console.log(`  SUCCESS: ALL ROUTE & MODAL SCREENSHOTS GENERATED IN:`);
    console.log(`  ${OUTPUT_DIR}`);
    console.log(`======================================================================\n`);
  } finally {
    await browser.close();
    process.exit(0);
  }
}

runVisualAudit().catch((err) => {
  console.error("FATAL in runVisualAudit:", err);
  process.exit(1);
});
