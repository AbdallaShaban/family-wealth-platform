import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { chromium, type Page } from "@playwright/test";
import { sdk } from "../server/_core/sdk";
import * as db from "../server/db";
import { users } from "../drizzle/schema";
import { COOKIE_NAME } from "../shared/const";

const BASE_URL = process.env.AUDIT_BASE_URL || "http://localhost:3000";
const OUTPUT_DIR = path.resolve(process.cwd(), ".visual-audit", "sidebar-fix");

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

async function getAuthSessionCookie(): Promise<string | null> {
  try {
    const database = await db.getDb();
    if (!database) return null;
    const [firstUser] = await database.select().from(users).limit(1);
    if (!firstUser?.openId) return null;
    return await sdk.createSessionToken(firstUser.openId, { name: firstUser.name || "Auditor" });
  } catch (err) {
    console.warn("[audit] Could not mint session cookie:", err);
    return null;
  }
}

async function applyTheme(page: Page, theme: "dark" | "light") {
  await page.evaluate((t: string) => {
    localStorage.setItem("theme", t);
    if (t === "dark") {
      document.documentElement.classList.add("dark");
      document.body.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
      document.body.classList.remove("dark");
    }
  }, theme);
  await page.waitForTimeout(600);
}

interface AuditResult {
  target: string;
  expectedCondition: string;
  actualUrl: string;
  hasRenderedNodes: boolean;
  detectedTextSample: string;
  passed: boolean;
  notes?: string;
}

async function runAudit() {
  console.log("================================================================================");
  console.log("STARTING RESCUE TASK AUDIT & VISUAL VERIFICATION");
  console.log("Output Directory:", OUTPUT_DIR);
  console.log("================================================================================");

  const sessionToken = await getAuthSessionCookie();
  console.log("Session token minted:", sessionToken ? "YES" : "NO");

  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"],
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    colorScheme: "light",
  });

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

  const page = await context.newPage();
  const results: AuditResult[] = [];

  // =========================================================================
  // STEP 1 & 3: Sidebar Typography, Contrast & Close-up Visual Capture
  // =========================================================================
  console.log("\n>>> Step 1 & 3: Capturing Sidebar in Light & Dark Mode and Inspecting Contrast...");
  await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(1000);

  // 1A: Light Mode Sidebar
  await applyTheme(page, "light");
  const sidebarEl = page.locator('aside[data-sidebar="true"], aside.fintech-v2-sidebar').first();
  await sidebarEl.waitFor({ state: "visible", timeout: 10000 });

  // Measure Light Mode computed styles
  const lightStyles = await page.evaluate(() => {
    const sidebar = document.querySelector('aside.fintech-v2-sidebar');
    const brand = sidebar?.querySelector('.fintech-v2-brand strong');
    const trigger = sidebar?.querySelector('.fintech-v2-group-trigger');
    const navItem = sidebar?.querySelector('.fintech-v2-group-content button');
    const userCard = sidebar?.querySelector('.fintech-v2-user-card strong');
    return {
      sidebarBg: sidebar ? window.getComputedStyle(sidebar).backgroundColor : null,
      brandColor: brand ? window.getComputedStyle(brand).color : null,
      triggerColor: trigger ? window.getComputedStyle(trigger).color : null,
      navItemColor: navItem ? window.getComputedStyle(navItem).color : null,
      userCardColor: userCard ? window.getComputedStyle(userCard).color : null,
    };
  });
  console.log("Light Mode Computed Colors:", lightStyles);

  await sidebarEl.screenshot({
    path: path.join(OUTPUT_DIR, "sidebar-light-close.png"),
  });
  console.log("✓ Saved:", path.join(OUTPUT_DIR, "sidebar-light-close.png"));

  // 1B: Dark Mode Sidebar
  await applyTheme(page, "dark");
  await page.waitForTimeout(600);

  const darkStyles = await page.evaluate(() => {
    const sidebar = document.querySelector('aside.fintech-v2-sidebar');
    const brand = sidebar?.querySelector('.fintech-v2-brand strong');
    const trigger = sidebar?.querySelector('.fintech-v2-group-trigger');
    const navItem = sidebar?.querySelector('.fintech-v2-group-content button');
    const userCard = sidebar?.querySelector('.fintech-v2-user-card strong');
    return {
      sidebarBg: sidebar ? window.getComputedStyle(sidebar).backgroundColor : null,
      brandColor: brand ? window.getComputedStyle(brand).color : null,
      triggerColor: trigger ? window.getComputedStyle(trigger).color : null,
      navItemColor: navItem ? window.getComputedStyle(navItem).color : null,
      userCardColor: userCard ? window.getComputedStyle(userCard).color : null,
    };
  });
  console.log("Dark Mode Computed Colors:", darkStyles);

  await sidebarEl.screenshot({
    path: path.join(OUTPUT_DIR, "sidebar-dark-close.png"),
  });
  console.log("✓ Saved:", path.join(OUTPUT_DIR, "sidebar-dark-close.png"));

  // Reset to light mode for subsequent test captures
  await applyTheme(page, "light");

  // =========================================================================
  // STEP 2: Comprehensive Sub-Tab Functional Audit & Verification
  // =========================================================================
  console.log("\n>>> Step 2: Testing Sub-Tab Parameter Bindings...");

  const subTabTargets = [
    {
      route: "/banking?tab=accounts",
      expectedSnippet: "الحسابات",
      label: "Banking: Accounts & Wallets",
      screenshot: "banking-tab-accounts.png",
    },
    {
      route: "/banking?tab=certificates",
      expectedSnippet: "الشهادات",
      label: "Banking: Certificates",
      screenshot: "banking-tab-certificates.png",
    },
    {
      route: "/banking?tab=liquidity",
      expectedSnippet: "السيولة",
      label: "Banking: Liquidity & Cashflow",
      screenshot: "banking-tab-liquidity.png",
    },
    {
      route: "/banking?tab=debts",
      expectedSnippet: "الديون",
      label: "Banking: Debts & Cards",
      screenshot: "banking-tab-debts.png",
    },
    {
      route: "/investments?tab=holdings",
      expectedSnippet: "الأصول",
      label: "Investments: Live Holdings",
      screenshot: "investments-tab-holdings.png",
    },
    {
      route: "/investments?tab=performance",
      expectedSnippet: "الأداء",
      label: "Investments: Performance Summary",
      screenshot: "investments-tab-performance.png",
    },
    {
      route: "/investments?tab=allocation",
      expectedSnippet: "التوزيع",
      label: "Investments: Risk & Allocation",
      screenshot: "investments-tab-allocation.png",
    },
    {
      route: "/quant?tab=signals",
      expectedSnippet: "الإشارات",
      label: "Quant: Signals & Screener",
      screenshot: "quant-tab-signals.png",
    },
    {
      route: "/quant?tab=stress-testing",
      expectedSnippet: "الضغط",
      label: "Quant: Stress Testing",
      screenshot: "quant-tab-stress-testing.png",
    },
    {
      route: "/governance?tab=statements",
      expectedSnippet: "القوائم",
      label: "Governance: Financial Statements",
      screenshot: "governance-tab-statements.png",
    },
    {
      route: "/governance?tab=audit",
      expectedSnippet: "التدقيق",
      label: "Governance: Audit Trail",
      screenshot: "governance-tab-audit.png",
    },
    {
      route: "/governance?tab=vault",
      expectedSnippet: "الخزنة",
      label: "Governance: Vault & Permissions",
      screenshot: "governance-tab-vault.png",
    },
  ];

  for (const target of subTabTargets) {
    try {
      await page.goto(`${BASE_URL}${target.route}`, { waitUntil: "networkidle", timeout: 20000 });
      await page.waitForTimeout(800);

      const bodyText = await page.evaluate(() => document.body.innerText || "");
      const mainEl = page.locator("main").first();
      const mainCount = await mainEl.locator("*").count();
      const hasContent = mainCount > 10 && bodyText.length > 100;
      const snippetFound = bodyText.includes(target.expectedSnippet);

      const passed = hasContent && snippetFound;
      results.push({
        target: target.route,
        expectedCondition: `Rendered DOM nodes (>10) & text includes '${target.expectedSnippet}'`,
        actualUrl: page.url(),
        hasRenderedNodes: hasContent,
        detectedTextSample: bodyText.slice(0, 150).replace(/\s+/g, " "),
        passed,
      });

      console.log(`  [SUB-TAB] ${target.label} (${target.route}) -> ${passed ? "PASS ✓" : "FAIL ✗"}`);

      // Capture screenshot
      await page.screenshot({
        path: path.join(OUTPUT_DIR, target.screenshot),
        fullPage: false,
      });
    } catch (err: any) {
      console.error(`  [ERROR] Visiting ${target.route}:`, err.message);
      results.push({
        target: target.route,
        expectedCondition: "Mounted without error",
        actualUrl: page.url(),
        hasRenderedNodes: false,
        detectedTextSample: `ERROR: ${err.message}`,
        passed: false,
      });
    }
  }

  // =========================================================================
  // STEP 2B: Legacy Route Redirects
  // =========================================================================
  console.log("\n>>> Step 2B: Testing Legacy Route Redirects...");

  const legacyRedirectTargets = [
    { from: "/debts", expectedToSubstr: "/banking?tab=debts" },
    { from: "/certificates", expectedToSubstr: "/banking?tab=certificates" },
    { from: "/cashflow", expectedToSubstr: "/banking?tab=liquidity" },
    { from: "/budget", expectedToSubstr: "/banking?tab=liquidity" },
    { from: "/emergency-fund", expectedToSubstr: "/banking?tab=liquidity" },
    { from: "/transactions", expectedToSubstr: "/banking?tab=accounts" },
  ];

  for (const legacy of legacyRedirectTargets) {
    try {
      await page.goto(`${BASE_URL}${legacy.from}`, { waitUntil: "networkidle", timeout: 20000 });
      await page.waitForTimeout(600);

      const finalUrl = page.url();
      const passed = finalUrl.includes(legacy.expectedToSubstr);

      results.push({
        target: legacy.from,
        expectedCondition: `Redirects to URL containing '${legacy.expectedToSubstr}'`,
        actualUrl: finalUrl,
        hasRenderedNodes: true,
        detectedTextSample: `Redirected to ${finalUrl}`,
        passed,
      });

      console.log(`  [REDIRECT] ${legacy.from} -> ${finalUrl} : ${passed ? "PASS ✓" : "FAIL ✗"}`);
    } catch (err: any) {
      console.error(`  [ERROR] Redirecting ${legacy.from}:`, err.message);
      results.push({
        target: legacy.from,
        expectedCondition: `Redirects to ${legacy.expectedToSubstr}`,
        actualUrl: page.url(),
        hasRenderedNodes: false,
        detectedTextSample: `ERROR: ${err.message}`,
        passed: false,
      });
    }
  }

  await browser.close();

  // Print results table
  console.log("\n================================================================================");
  console.log("AUDIT RESULTS SUMMARY");
  console.log("================================================================================");
  let allPassed = true;
  for (const res of results) {
    const mark = res.passed ? "✓ PASS" : "✗ FAIL";
    if (!res.passed) allPassed = false;
    console.log(`${mark} | Target: ${res.target.padEnd(30)} | Actual: ${res.actualUrl}`);
  }

  console.log("================================================================================");
  console.log(`TOTAL CHECKS: ${results.length} | OVERALL: ${allPassed ? "ALL TESTS PASSED ✓" : "FAILURES DETECTED ✗"}`);
  console.log("================================================================================");

  if (!allPassed) {
    process.exit(1);
  }
}

runAudit().catch((err) => {
  console.error("Fatal audit execution failure:", err);
  process.exit(1);
});
