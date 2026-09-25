import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { chromium, type BrowserContext, type Page } from "@playwright/test";
import { sdk } from "../server/_core/sdk";
import * as db from "../server/db";
import { users } from "../drizzle/schema";
import { COOKIE_NAME } from "../shared/const";

const BASE_URL = process.env.AUDIT_BASE_URL || "http://localhost:3000";
const OUTPUT_DIR = path.resolve(process.cwd(), ".visual-audit", "comprehensive-audit");
const LEGACY_OUTPUT_DIR = path.resolve(process.cwd(), ".visual-audit", "full");

interface CaptureTarget {
  slug: string;
  label: string;
  path: string;
  clickTab?: string;
}

const HUB_TARGETS: CaptureTarget[] = [
  { slug: "01-overview", label: "Executive Overview", path: "/" },
  { slug: "02-banking-accounts", label: "Banking Hub - Accounts", path: "/banking?tab=accounts", clickTab: "accounts" },
  { slug: "03-banking-certificates", label: "Banking Hub - Certificates", path: "/banking?tab=certificates", clickTab: "certificates" },
  { slug: "04-banking-liquidity", label: "Banking Hub - Liquidity & Cash Flow", path: "/banking?tab=liquidity", clickTab: "liquidity" },
  { slug: "05-banking-debts", label: "Banking Hub - Debts", path: "/banking?tab=debts", clickTab: "debts" },
  { slug: "06-investments-holdings", label: "Investments - Holdings", path: "/investments?tab=holdings", clickTab: "holdings" },
  { slug: "07-investments-performance", label: "Investments - Performance & Realized PnL", path: "/investments?tab=performance", clickTab: "performance" },
  { slug: "08-investments-allocation", label: "Investments - Allocation & Risk", path: "/investments?tab=allocation", clickTab: "allocation" },
  { slug: "09-quant-signals", label: "Quant Hub - Technical & Advisory Signals", path: "/quant?tab=signals", clickTab: "signals" },
  { slug: "10-quant-stress", label: "Quant Hub - Stress Testing", path: "/quant?tab=stress", clickTab: "stress" },
  { slug: "11-quant-diagnostics", label: "Quant Hub - Subscriptions & Health Diagnostics", path: "/quant?tab=diagnostics", clickTab: "diagnostics" },
  { slug: "12-governance-reports", label: "Governance - Financial Statements & Balance Sheet", path: "/governance?tab=reports", clickTab: "reports" },
  { slug: "13-governance-audit", label: "Governance - Accounting Audit Trail", path: "/governance?tab=audit", clickTab: "audit" },
  { slug: "14-governance-members", label: "Governance - Family Members & User Administration", path: "/governance?tab=members", clickTab: "members" },
  { slug: "15-governance-vault", label: "Governance - Vault & Secrets", path: "/governance?tab=vault", clickTab: "vault" },
  { slug: "16-governance-approvals", label: "Governance - Dual Approvals Center", path: "/governance?tab=approvals", clickTab: "approvals" },
  { slug: "17-governance-backup", label: "Governance - Database Backup & Export", path: "/governance?tab=backup", clickTab: "backup" },
];

const VIEWPORTS = [
  { key: "light", label: "Desktop Light", w: 1440, h: 900, scheme: "light" as const, mobile: false },
  { key: "mobile", label: "Mobile 390x844", w: 390, h: 844, scheme: "light" as const, mobile: true },
  { key: "dark", label: "Desktop Dark", w: 1440, h: 900, scheme: "dark" as const, mobile: false },
] as const;

async function getAuthSessionCookie(): Promise<string | null> {
  try {
    const database = await db.getDb();
    if (!database) return null;
    const [firstUser] = await database.select().from(users).limit(1);
    if (!firstUser?.openId) return null;
    return await sdk.createSessionToken(firstUser.openId, { name: firstUser.name || "Auditor" });
  } catch (err) {
    console.warn("[capture-ui] Could not mint session cookie:", err);
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

function attachErrorListeners(page: Page, ctx: string) {
  page.on("pageerror", (err) => console.error(`  [PAGE ERROR] (${ctx}):`, err.message));
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      const t = msg.text();
      if (!t.includes("favicon") && !t.includes("DevTools")) {
        console.warn(`  [CONSOLE ERROR] (${ctx}):`, t);
      }
    }
  });
}

async function makeContext(
  browser: Awaited<ReturnType<typeof chromium.launch>>,
  sessionToken: string | null,
  opts: { w: number; h: number; scheme: "dark" | "light"; mobile: boolean }
): Promise<BrowserContext> {
  const ctx = await browser.newContext({
    viewport: { width: opts.w, height: opts.h },
    colorScheme: opts.scheme,
    ...(opts.mobile ? { isMobile: true, hasTouch: true } : {}),
  });
  if (sessionToken) {
    await ctx.addCookies([{
      name: COOKIE_NAME, value: sessionToken, domain: "localhost",
      path: "/", httpOnly: true, secure: false, sameSite: "Lax",
    }]);
  }
  return ctx;
}

async function activateTab(page: Page, tabValue: string) {
  const selectors = [
    `[role="tab"][value="${tabValue}"]`,
    `[role="tab"][data-value="${tabValue}"]`,
    `button[value="${tabValue}"]`,
    `button[data-value="${tabValue}"]`,
    `button[aria-controls*="${tabValue}"]`,
    `[role="tab"][id*="${tabValue}"]`,
  ];
  for (const sel of selectors) {
    const el = page.locator(sel).first();
    if (await el.isVisible({ timeout: 600 }).catch(() => false)) {
      const state = await el.getAttribute("data-state").catch(() => null);
      if (state === "active") return;
      await el.click({ force: true }).catch(() => {});
      await page.waitForTimeout(500);
      return;
    }
  }
}

async function captureTarget(
  browser: Awaited<ReturnType<typeof chromium.launch>>,
  sessionToken: string | null,
  target: CaptureTarget,
  vp: (typeof VIEWPORTS)[number],
  outputDir: string
): Promise<{ slug: string; viewport: string; status: string; error?: string }> {
  const theme: "dark" | "light" = vp.key === "light" ? "light" : "dark";
  const ctxLabel = `${target.slug}-${vp.key}`;
  let ctx: BrowserContext | undefined;
  try {
    ctx = await makeContext(browser, sessionToken, { w: vp.w, h: vp.h, scheme: vp.scheme, mobile: vp.mobile });
    const page = await ctx.newPage();
    attachErrorListeners(page, ctxLabel);

    const url = `${BASE_URL}${target.path}`;
    const resp = await page.goto(url, { waitUntil: "networkidle", timeout: 35000 }).catch((err) => {
      console.warn(`  ! Navigation timeout [${ctxLabel}]:`, err.message);
      return null;
    });
    if (resp) console.log(`    HTTP ${resp.status()} [${vp.label}]`);

    await applyTheme(page, theme);
    if (target.clickTab) await activateTab(page, target.clickTab);
    await page.waitForTimeout(900);

    const filename = `${target.slug}-${vp.key}.png`;
    const filepath = path.join(outputDir, filename);
    await page.screenshot({ path: filepath, fullPage: true });
    console.log(`    ok ${filename}`);
    await ctx.close();
    return { slug: target.slug, viewport: vp.key, status: "ok" };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`    FAIL [${ctxLabel}]:`, msg);
    await ctx?.close().catch(() => {});
    return { slug: target.slug, viewport: vp.key, status: "error", error: msg };
  }
}

async function captureSidebarStates(
  browser: Awaited<ReturnType<typeof chromium.launch>>,
  sessionToken: string | null,
  outputDir: string
) {
  console.log("\n=== PHASE 2: SIDEBAR STATES & COLLAPSE BEHAVIOR ===\n");
  const sidebarDir = path.join(outputDir, "sidebar");
  fs.mkdirSync(sidebarDir, { recursive: true });

  for (const theme of ["light", "dark"] as const) {
    const ctx = await makeContext(browser, sessionToken, { w: 1440, h: 900, scheme: theme, mobile: false });
    const page = await ctx.newPage();
    attachErrorListeners(page, `sidebar-expanded-${theme}`);
    await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle", timeout: 30000 }).catch(() => {});
    await applyTheme(page, theme);
    await page.waitForTimeout(700);
    const file = path.join(sidebarDir, `sidebar-expanded-${theme}.png`);
    await page.screenshot({ path: file, fullPage: false });
    console.log(`  ok ${path.basename(file)}`);
    await ctx.close();
  }

  for (const theme of ["light", "dark"] as const) {
    const ctx = await makeContext(browser, sessionToken, { w: 1440, h: 900, scheme: theme, mobile: false });
    const page = await ctx.newPage();
    attachErrorListeners(page, `sidebar-collapsed-${theme}`);
    await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle", timeout: 30000 }).catch(() => {});
    await applyTheme(page, theme);
    await page.waitForTimeout(700);
    const collapseBtn = page.locator("button[aria-label*='طي']").first();
    if (await collapseBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await collapseBtn.click();
      await page.waitForTimeout(400);
    }
    const file = path.join(sidebarDir, `sidebar-collapsed-${theme}.png`);
    await page.screenshot({ path: file, fullPage: false });
    console.log(`  ok ${path.basename(file)}`);
    await ctx.close();
  }

  {
    const ctx = await makeContext(browser, sessionToken, { w: 390, h: 844, scheme: "dark", mobile: true });
    const page = await ctx.newPage();
    await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle", timeout: 30000 }).catch(() => {});
    await applyTheme(page, "dark");
    await page.waitForTimeout(700);
    const file = path.join(sidebarDir, "sidebar-mobile-closed.png");
    await page.screenshot({ path: file });
    console.log(`  ok ${path.basename(file)}`);
    await ctx.close();
  }

  {
    const ctx = await makeContext(browser, sessionToken, { w: 390, h: 844, scheme: "dark", mobile: true });
    const page = await ctx.newPage();
    await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle", timeout: 30000 }).catch(() => {});
    await applyTheme(page, "dark");
    await page.waitForTimeout(700);
    const menuBtn = page.locator("button[aria-label='فتح التنقل']").first();
    if (await menuBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await menuBtn.click();
      await page.waitForTimeout(600);
    }
    const file = path.join(sidebarDir, "sidebar-mobile-open.png");
    await page.screenshot({ path: file });
    console.log(`  ok ${path.basename(file)}`);
    await ctx.close();
  }
}

async function captureModalStates(
  browser: Awaited<ReturnType<typeof chromium.launch>>,
  sessionToken: string | null,
  outputDir: string
) {
  console.log("\n=== PHASE 3: INTERACTIVE MODAL STATES ===\n");
  const modalDir = path.join(outputDir, "modals");
  fs.mkdirSync(modalDir, { recursive: true });

  for (const theme of ["dark", "light"] as const) {
    const ctx = await makeContext(browser, sessionToken, { w: 1440, h: 900, scheme: theme, mobile: false });
    const page = await ctx.newPage();
    attachErrorListeners(page, `omni-${theme}`);
    await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle" }).catch(() => {});
    await applyTheme(page, theme);
    const omniBtn = page.locator("button:has-text('Ctrl+K')").first();
    if (await omniBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
      await omniBtn.click();
    } else {
      await page.keyboard.press("Control+k");
    }
    await page.waitForTimeout(700);
    const omniInput = page.locator("input[placeholder*='اكتب']").first();
    if (await omniInput.isVisible({ timeout: 1500 }).catch(() => false)) {
      await omniInput.fill("شراء 100 COMI @ 88.5");
      await page.waitForTimeout(400);
    }
    const file = path.join(modalDir, `modal-omni-${theme}.png`);
    await page.screenshot({ path: file });
    console.log(`  ok ${path.basename(file)}`);
    await ctx.close();
  }

  for (const theme of ["dark", "light"] as const) {
    const ctx = await makeContext(browser, sessionToken, { w: 1440, h: 900, scheme: theme, mobile: false });
    const page = await ctx.newPage();
    attachErrorListeners(page, `record-trade-${theme}`);
    await page.goto(`${BASE_URL}/investments`, { waitUntil: "networkidle" }).catch(() => {});
    await applyTheme(page, theme);
    const addBtn = page.locator("button:has-text('إضافة أداة')").first();
    if (await addBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await addBtn.click();
      await page.waitForTimeout(700);
    }
    const file = path.join(modalDir, `modal-record-trade-${theme}.png`);
    await page.screenshot({ path: file });
    console.log(`  ok ${path.basename(file)}`);
    await ctx.close();
  }
}

async function auditLayoutMetrics(
  browser: Awaited<ReturnType<typeof chromium.launch>>,
  sessionToken: string | null
): Promise<Record<string, unknown>> {
  console.log("\n=== PHASE 4: LAYOUT & CONTAINER HEIGHT AUDIT ===\n");
  const results: Record<string, unknown> = {};

  for (const route of ["/", "/banking", "/investments", "/quant", "/governance"]) {
    const ctx = await makeContext(browser, sessionToken, { w: 1440, h: 900, scheme: "dark", mobile: false });
    const page = await ctx.newPage();
    await page.goto(`${BASE_URL}${route}`, { waitUntil: "networkidle", timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(800);

    const metrics = await page.evaluate(() => {
      const sidebar = document.querySelector("aside[data-sidebar]");
      const main = document.querySelector("main.fintech-v2-main");
      const contentShell = document.querySelector(".fintech-content-shell");
      const scrollers = Array.from(document.querySelectorAll("*")).filter((el) => {
        const s = window.getComputedStyle(el);
        return (s.overflowY === "auto" || s.overflowY === "scroll") && el.scrollHeight > el.clientHeight + 2;
      });
      return {
        sidebarWidth: sidebar?.getBoundingClientRect().width ?? null,
        mainMarginRight: main ? window.getComputedStyle(main).marginRight : null,
        mainWidth: main?.getBoundingClientRect().width ?? null,
        contentShellHeight: contentShell?.getBoundingClientRect().height ?? null,
        documentScrollHeight: document.body.scrollHeight,
        documentClientHeight: document.documentElement.clientHeight,
        scrollContainersCount: scrollers.length,
        sidebarZIndex: sidebar ? window.getComputedStyle(sidebar).zIndex : null,
      };
    });

    results[route] = metrics;
    console.log(`  [${route}]:`, JSON.stringify(metrics));
    await ctx.close();
  }
  return results;
}

function auditSidebarCode(): { issues: string[]; notes: string[] } {
  const issues: string[] = [];
  const notes: string[] = [];
  const src = fs.readFileSync(path.resolve(process.cwd(), "client/src/components/DashboardLayout.tsx"), "utf-8");

  src.includes("#F8FAFC")
    ? notes.push("ok Light sidebar palette (#F8FAFC) enforced via inline style override.")
    : issues.push("FAIL Inline sidebar bg override for light mode (#F8FAFC) missing.");

  src.includes("#0B0F17")
    ? notes.push("ok Dark sidebar palette (#0B0F17) enforced via inline style override.")
    : issues.push("FAIL Inline sidebar bg override for dark mode (#0B0F17) missing.");

  src.includes('dir="rtl"')
    ? notes.push("ok RTL dir='rtl' present on app shell.")
    : issues.push("FAIL dir='rtl' not found on fintech-app-shell.");

  if (src.includes("z-index") || src.includes("z-[")) {
    notes.push("WARN Explicit z-index detected — verify no collision with modals.");
  }

  ["/accounts", "/certificates", "/debts", "/performance", "/stress-testing", "/reports", "/vault"].forEach((r) => {
    src.includes(`"${r}"`)
      ? notes.push(`ok Legacy route '${r}' mapped in routeToHubMap.`)
      : issues.push(`FAIL Legacy route '${r}' NOT in routeToHubMap — sidebar highlighting broken.`);
  });

  src.includes("bg-emerald-600") && src.includes("shadow-[0_0_6px")
    ? notes.push("ok Active item indicator (emerald dot) found.")
    : issues.push("FAIL Active item indicator missing from sidebar nav items.");

  src.includes('side="right"')
    ? notes.push("ok Mobile Sheet uses side='right' (correct for RTL).")
    : issues.push("FAIL Mobile Sheet may not use side='right'.");

  src.includes('type="multiple"')
    ? notes.push("ok Accordion type='multiple' — multiple hubs can stay open.")
    : issues.push("FAIL Accordion type='single' — only one hub section open at a time.");

  return { issues, notes };
}

async function runVisualAudit() {
  console.log("\n======================================================================");
  console.log("  EXHAUSTIVE MULTI-HUB & SUB-TAB VISUAL CAPTURE & AUDIT");
  console.log(`  Target : ${BASE_URL}`);
  console.log(`  Output : ${OUTPUT_DIR}`);
  console.log(`  Targets: ${HUB_TARGETS.length} capture targets x ${VIEWPORTS.length} viewports`);
  console.log("======================================================================\n");

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.mkdirSync(LEGACY_OUTPUT_DIR, { recursive: true });

  console.log("\n=== PHASE 0: STATIC CODE AUDIT (DashboardLayout.tsx) ===\n");
  const codeAudit = auditSidebarCode();
  codeAudit.notes.forEach((n) => console.log(" ", n));
  if (codeAudit.issues.length > 0) {
    console.warn("\n  ISSUES DETECTED:");
    codeAudit.issues.forEach((i) => console.warn(" ", i));
  } else {
    console.log("\n  No static code issues found.\n");
  }

  const sessionToken = await getAuthSessionCookie();
  console.log(sessionToken ? "\nAuth session minted.\n" : "\nNo DB user found; proceeding unauthenticated.\n");

  const browser = await chromium.launch({ headless: true });
  const captureResults: Array<{ slug: string; viewport: string; status: string; error?: string }> = [];

  try {
    console.log("\n=== PHASE 1: HUB & SUB-TAB VISUAL CAPTURES ===\n");
    for (const target of HUB_TARGETS) {
      console.log(`\n[TARGET] ${target.slug}: ${target.label}`);
      for (const vp of VIEWPORTS) {
        const result = await captureTarget(browser, sessionToken, target, vp, OUTPUT_DIR);
        captureResults.push(result);
      }
    }

    await captureSidebarStates(browser, sessionToken, OUTPUT_DIR);
    await captureModalStates(browser, sessionToken, OUTPUT_DIR);
    const layoutMetrics = await auditLayoutMetrics(browser, sessionToken);

    const reportPath = path.join(OUTPUT_DIR, "_audit-report.json");
    const errors = captureResults.filter((r) => r.status === "error");
    fs.writeFileSync(reportPath, JSON.stringify({
      generatedAt: new Date().toISOString(),
      baseUrl: BASE_URL,
      outputDir: OUTPUT_DIR,
      totalCaptures: captureResults.length,
      successCount: captureResults.filter((r) => r.status === "ok").length,
      errorCount: errors.length,
      codeAuditIssues: codeAudit.issues,
      codeAuditNotes: codeAudit.notes,
      errors,
      layoutMetrics,
      allResults: captureResults,
    }, null, 2), "utf-8");

    const okCount = captureResults.filter((r) => r.status === "ok").length;
    const errCount = captureResults.filter((r) => r.status === "error").length;
    console.log("\n======================================================================");
    console.log("  AUDIT COMPLETE");
    console.log(`  Screenshots : ${okCount} ok  |  ${errCount} failed`);
    console.log(`  Output dir  : ${OUTPUT_DIR}`);
    console.log(`  Report      : ${reportPath}`);
    if (codeAudit.issues.length > 0) console.warn(`  Code issues : ${codeAudit.issues.length}`);
    console.log("======================================================================\n");
  } finally {
    await browser.close();
    process.exit(0);
  }
}

runVisualAudit().catch((err) => {
  console.error("FATAL in runVisualAudit:", err);
  process.exit(1);
});
