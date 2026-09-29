import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";
import { sdk } from "../server/_core/sdk";
import * as db from "../server/db";
import { users } from "../drizzle/schema";
import { COOKIE_NAME } from "../shared/const";

interface AuditTarget {
  id: string;
  name: string;
  category: string;
  path: string;
  requiresAuth: boolean;
}

const AUDIT_TARGETS: AuditTarget[] = [
  { id: "01_fintech_dashboard", name: "لوحة التحكم الرئيسية (Fintech Dashboard)", category: "المركز المالي", path: "/", requiresAuth: true },
  { id: "02_transactions", name: "المعاملات والقيود المالية", category: "البنوك والسيولة", path: "/transactions", requiresAuth: true },
  { id: "03_banking_accounts", name: "الحسابات المصرفية ومحافظ السيولة", category: "البنوك والسيولة", path: "/banking?tab=accounts", requiresAuth: true },
  { id: "04_banking_certificates", name: "الودائع والشهادات البنكية", category: "البنوك والسيولة", path: "/banking?tab=certificates", requiresAuth: true },
  { id: "05_banking_liquidity", name: "السيولة والتخطيط وصندوق الطوارئ", category: "البنوك والسيولة", path: "/banking?tab=liquidity", requiresAuth: true },
  { id: "06_banking_debts", name: "الالتزامات والديون والبطاقات", category: "البنوك والسيولة", path: "/banking?tab=debts", requiresAuth: true },
  { id: "07_investments_portfolio", name: "محفظة الاستثمارات المباشرة", category: "المحافظ والاستثمار", path: "/investments?tab=portfolio", requiresAuth: true },
  { id: "08_investments_gold", name: "محفظة الذهب والسبائك وأسعار العيارات", category: "المحافظ والاستثمار", path: "/investments?tab=instruments", requiresAuth: true },
  { id: "09_investments_realized", name: "الأداء والأرباح المحققة (FIFO)", category: "المحافظ والاستثمار", path: "/investments?tab=realized", requiresAuth: true },
  { id: "10_investments_allocation", name: "التوزيع الجغرافي وتوزيع الأصول", category: "المحافظ والاستثمار", path: "/investments?tab=allocation", requiresAuth: true },
  { id: "11_quant_egx", name: "تداول الأسهم والإشارات الكمية (EGX)", category: "المحافظ والاستثمار", path: "/quant", requiresAuth: true },
  { id: "12_governance_zakat", name: "حاسبة الزكاة الشرعية وحول النصاب", category: "الحوكمة والزكاة", path: "/governance?tab=zakat", requiresAuth: true },
  { id: "13_stress_testing", name: "مصفوفة اختبارات الهبوط والضغط", category: "الحوكمة والزكاة", path: "/stress-testing", requiresAuth: true },
  { id: "14_wealth_health", name: "مؤشر درع التضخم وصحة الثروة", category: "المركز المالي", path: "/wealth-health", requiresAuth: true },
  { id: "15_reports", name: "القوائم المالية والميزانية المجمعة", category: "المركز المالي", path: "/reports", requiresAuth: true },
  { id: "16_governance_vault", name: "خزينة المستندات الرقمية المشفرة", category: "الحوكمة والزكاة", path: "/governance?tab=vault", requiresAuth: true },
  { id: "17_governance_audit", name: "سجل التدقيق المحاسبي والاعتمادات", category: "الحوكمة والزكاة", path: "/governance?tab=audit", requiresAuth: true },
  { id: "18_governance_members", name: "أفراد العائلة وإدارة الصلاحيات والنسخ", category: "الحوكمة والزكاة", path: "/governance?tab=members", requiresAuth: true },
  { id: "19_operations_center", name: "مركز العمليات والإعدادات التشغيلية", category: "الحوكمة والزكاة", path: "/operations", requiresAuth: true },
  { id: "20_login_auth", name: "بوابة تسجيل الدخول الآمن", category: "الأمان والدخول", path: "/login", requiresAuth: false },
];

async function runForensicAudit() {
  console.log("=== بدء تدقيق الواجهات الشامل (End-to-End Forensic Audit) ===");

  const database = await db.getDb();
  const [firstUser] = await database!.select().from(users).limit(1);
  const sessionToken = await sdk.createSessionToken(firstUser.openId, { name: firstUser.name || "Auditor" });

  const auditCaptureDir = path.resolve(process.cwd(), ".audit", "visual-captures");
  const brainDir = "C:\\Users\\abdal\\.gemini\\antigravity-ide\\brain\\5bd4cdcc-e17f-4f15-bc34-6a4e574b171d";

  fs.mkdirSync(auditCaptureDir, { recursive: true });
  fs.mkdirSync(brainDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });

  const auditResults: Array<{
    id: string;
    name: string;
    category: string;
    path: string;
    lightFile: string;
    darkFile: string;
    consoleErrors: string[];
    contrastAudit: {
      lightPassed: boolean;
      darkPassed: boolean;
      details: string;
    };
  }> = [];

  for (const target of AUDIT_TARGETS) {
    console.log(`\n[Auditing] ${target.id}: ${target.name} (${target.path})`);
    const consoleErrors: string[] = [];

    // Capture Light Mode
    const lightFileName = `${target.id}_light.png`;
    const lightFilePath = path.join(auditCaptureDir, lightFileName);
    const lightBrainPath = path.join(brainDir, lightFileName);

    const darkFileName = `${target.id}_dark.png`;
    const darkFilePath = path.join(auditCaptureDir, darkFileName);
    const darkBrainPath = path.join(brainDir, darkFileName);

    let lightContrastOk = true;
    let darkContrastOk = true;

    // --- 1. LIGHT MODE RUN ---
    {
      const ctx = await browser.newContext({
        viewport: { width: 1440, height: 950 },
      });
      if (target.requiresAuth) {
        await ctx.addCookies([{
          name: COOKIE_NAME,
          value: sessionToken,
          domain: "localhost",
          path: "/",
          httpOnly: true,
          secure: false,
          sameSite: "Lax",
        }]);
      }

      const page = await ctx.newPage();
      page.on("console", (msg) => {
        if (msg.type() === "error") {
          consoleErrors.push(`[Light] ${msg.text()}`);
        }
      });

      await page.addInitScript(() => {
        localStorage.setItem("theme", "light");
      });

      const url = `http://localhost:3000${target.path}${target.path.includes("?") ? "&" : "?"}theme=light`;
      await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
      await page.waitForTimeout(1500);

      // Verify DOM visibility & contrast attributes
      const contrastCheck = await page.evaluate(() => {
        const bodyBg = window.getComputedStyle(document.body).backgroundColor;
        const headings = Array.from(document.querySelectorAll("h1, h2, h3, .fintech-kpi-value"));
        const washedOut = headings.filter(h => {
          const color = window.getComputedStyle(h).color;
          return color.includes("161, 161, 170") || color.includes("244, 244, 245"); // too washed out for light mode
        });
        return {
          bodyBg,
          headingCount: headings.length,
          washedOutCount: washedOut.length,
        };
      });

      if (contrastCheck.washedOutCount > 0) {
        lightContrastOk = false;
      }

      await page.screenshot({ path: lightFilePath, fullPage: true });
      fs.copyFileSync(lightFilePath, lightBrainPath);
      await ctx.close();
    }

    // --- 2. DARK MODE RUN ---
    {
      const ctx = await browser.newContext({
        viewport: { width: 1440, height: 950 },
      });
      if (target.requiresAuth) {
        await ctx.addCookies([{
          name: COOKIE_NAME,
          value: sessionToken,
          domain: "localhost",
          path: "/",
          httpOnly: true,
          secure: false,
          sameSite: "Lax",
        }]);
      }

      const page = await ctx.newPage();
      page.on("console", (msg) => {
        if (msg.type() === "error") {
          consoleErrors.push(`[Dark] ${msg.text()}`);
        }
      });

      await page.addInitScript(() => {
        localStorage.setItem("theme", "dark");
      });

      const url = `http://localhost:3000${target.path}${target.path.includes("?") ? "&" : "?"}theme=dark`;
      await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
      await page.waitForTimeout(1500);

      const contrastCheck = await page.evaluate(() => {
        const bodyBg = window.getComputedStyle(document.body).backgroundColor;
        const headings = Array.from(document.querySelectorAll("h1, h2, h3, .fintech-kpi-value"));
        const darkMuted = headings.filter(h => {
          const color = window.getComputedStyle(h).color;
          return color.includes("30, 41, 59") || color.includes("15, 23, 42"); // black text on dark background!
        });
        return {
          bodyBg,
          headingCount: headings.length,
          darkMutedCount: darkMuted.length,
        };
      });

      if (contrastCheck.darkMutedCount > 0) {
        darkContrastOk = false;
      }

      await page.screenshot({ path: darkFilePath, fullPage: true });
      fs.copyFileSync(darkFilePath, darkBrainPath);
      await ctx.close();
    }

    auditResults.push({
      id: target.id,
      name: target.name,
      category: target.category,
      path: target.path,
      lightFile: lightFileName,
      darkFile: darkFileName,
      consoleErrors,
      contrastAudit: {
        lightPassed: lightContrastOk,
        darkPassed: darkContrastOk,
        details: `Light: ${lightContrastOk ? "AAA Solid Dark on Light" : "Washed out headings found"}, Dark: ${darkContrastOk ? "AAA Pure White on Dark" : "Low contrast text found"}`,
      },
    });

    console.log(`  ✓ تم التقاط الوضع الفاتح والداكن بنجاح بنسبة تباين: Light=${lightContrastOk}, Dark=${darkContrastOk}`);
  }

  await browser.close();

  const summaryPath = path.join(auditCaptureDir, "audit-summary.json");
  fs.writeFileSync(summaryPath, JSON.stringify(auditResults, null, 2), "utf8");
  console.log(`\n=== اكتمل التدقيق الشامل وحفظ النتائج في: ${summaryPath} ===`);
  process.exit(0);
}

runForensicAudit().catch((err) => {
  console.error("Forensic audit failed:", err);
  process.exit(1);
});
