import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";
import { sdk } from "../server/_core/sdk";
import * as db from "../server/db";
import { users } from "../drizzle/schema";
import { COOKIE_NAME } from "../shared/const";

async function run() {
  const database = await db.getDb();
  const [firstUser] = await database!.select().from(users).limit(1);
  const sessionToken = await sdk.createSessionToken(firstUser.openId, { name: firstUser.name || "Auditor" });

  const brainDir = "C:\\Users\\abdal\\.gemini\\antigravity-ide\\brain\\5bd4cdcc-e17f-4f15-bc34-6a4e574b171d";
  fs.mkdirSync(brainDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 950 },
    locale: "ar-EG",
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
  await page.addInitScript(() => {
    localStorage.setItem("theme", "dark");
  });

  console.log("Navigating to http://localhost:3000/transactions...");
  await page.goto("http://localhost:3000/transactions", { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(2000);

  // Click on "مطابقة إيصال فوري (OCR)" button
  console.log("Opening Smart Receipt OCR Modal...");
  const ocrBtn = page.locator("button:has-text('مطابقة إيصال فوري (OCR)'), button:has-text('مسح إيصال (OCR)')").first();
  await ocrBtn.waitFor({ state: "visible", timeout: 10000 });
  await ocrBtn.click();
  await page.waitForTimeout(1000);

  // Click on "لصق نص الإيصال يدوياً"
  const pasteTextBtn = page.locator("button:has-text('لصق نص الإيصال يدوياً')").first();
  if (await pasteTextBtn.isVisible()) {
    await pasteTextBtn.click();
    await page.waitForTimeout(500);

    const textarea = page.locator("textarea").first();
    const sampleReceipt = `
      شبكة المدفوعات اللحظية IPN
      معاملة إنستاباي ناجحة
      مبلغ المعاملة: 3,500.00 EGP
      المستفيد: كريم عادل الشريف
      الرقم المرجعي: 405891238472
      التاريخ: 15/05/2025 14:30
      تم التحويل بنجاح
    `;
    await textarea.fill(sampleReceipt);
    await page.waitForTimeout(500);

    const analyzeBtn = page.locator("button:has-text('تحليل النص واستخراج الحقول')").first();
    await analyzeBtn.click();
    await page.waitForSelector("text=المبلغ المستخرج", { timeout: 15000 });
    await page.waitForTimeout(1000);
  }

  const outputPath = path.join(brainDir, "smart_receipt_ocr_verification.png");
  console.log("Capturing verification screenshot to:", outputPath);
  await page.screenshot({ path: outputPath, fullPage: false });

  await browser.close();
  console.log("Screenshot successfully saved!");
}

run().catch((err) => {
  console.error("Error during verification:", err);
  process.exit(1);
});
