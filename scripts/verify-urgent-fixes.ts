import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";
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

async function main() {
  console.log("================================================================================");
  console.log("STARTING URGENT FIXES VERIFICATION");
  console.log("================================================================================");

  const token = await getAuthSessionCookie();
  console.log("Auth session token:", token ? "MINTED ✓" : "FAILED ✗");

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: "ar-EG",
  });

  if (token) {
    await context.addCookies([
      {
        name: COOKIE_NAME,
        value: token,
        domain: "localhost",
        path: "/",
        httpOnly: true,
        secure: false,
        sameSite: "Lax",
      },
    ]);
  }

  const page = await context.newPage();

  // Test 1: Subscriptions Modal Decimal Input (209.99)
  console.log("\n>>> Test 1: Testing Decimal Input in Subscription Modal...");
  await page.goto(`${BASE_URL}/quant?tab=health`, { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(1000);

  // Click on "إضافة اشتراك" button
  const addSubBtn = page.locator('button:has-text("إضافة اشتراك")').first();
  await addSubBtn.waitFor({ state: "visible", timeout: 8000 });
  await addSubBtn.click();
  await page.waitForTimeout(500);

  // Locate the subscription modal
  const subModal = page.locator('[role="dialog"]:has-text("إضافة اشتراك دوري جديد")');
  await subModal.waitFor({ state: "visible", timeout: 5000 });

  // Locate the subscription amount input
  const amountInput = subModal.locator('input[type="number"][step="0.01"]');
  await amountInput.waitFor({ state: "visible", timeout: 5000 });

  // Type 209.99
  await amountInput.fill("");
  await amountInput.fill("209.99");
  await page.waitForTimeout(300);

  // Also fill subscription name to test form validity
  const nameInput = subModal.locator('input[placeholder*="Netflix"]').first();
  await nameInput.fill("Netflix Premium Ultra HD");

  // Check validity
  const inputValidity = await amountInput.evaluate((el: HTMLInputElement) => {
    return {
      value: el.value,
      valid: el.checkValidity(),
      validationMessage: el.validationMessage,
      step: el.step,
      min: el.min,
    };
  });
  console.log("  Input Validity State:", inputValidity);

  if (inputValidity.valid && inputValidity.value === "209.99") {
    console.log("  [TEST 1] Subscription Decimal Input (209.99): PASS ✓ (Zero validation errors)");
  } else {
    console.error("  [TEST 1] Subscription Decimal Input: FAIL ✗", inputValidity);
  }

  // Capture modal screenshot
  const subModalPath = path.join(OUTPUT_DIR, "subscription-decimal-modal.png");
  await page.screenshot({ path: subModalPath });
  console.log("  ✓ Saved modal screenshot:", subModalPath);

  // Close modal
  const cancelBtn = subModal.locator('button:has-text("إلغاء")').first();
  await cancelBtn.click();
  await page.waitForTimeout(400);

  // Test 2: Direct Governance Sub-Tab for Family Members (/governance?tab=members)
  console.log("\n>>> Test 2: Testing /governance?tab=members Sub-Tab...");
  await page.goto(`${BASE_URL}/governance?tab=members`, { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(1000);

  const membersHeader = page.locator('text=الأعضاء ومساحات العمل').first();
  const isMembersVisible = await membersHeader.isVisible();

  const activeWorkspacesCard = page.locator('text=مساحات العمل النشطة').first();
  const isWorkspaceCardVisible = await activeWorkspacesCard.isVisible();

  const inviteSection = page.locator('text=دعوة عضو جديد').first();
  const isInviteVisible = await inviteSection.isVisible();

  const membersPassed = isMembersVisible && isWorkspaceCardVisible && isInviteVisible;
  console.log(`  [TEST 2] Governance Members Tab Mounted: ${membersPassed ? "PASS ✓" : "FAIL ✗"}`);
  console.log(`    - Members Header: ${isMembersVisible}`);
  console.log(`    - Workspaces Card: ${isWorkspaceCardVisible}`);
  console.log(`    - Invite Form: ${isInviteVisible}`);

  const membersTabPath = path.join(OUTPUT_DIR, "governance-tab-members.png");
  await page.screenshot({ path: membersTabPath });
  console.log("  ✓ Saved members tab screenshot:", membersTabPath);

  // Test 3: Legacy Route Redirect (/members -> /governance?tab=members)
  console.log("\n>>> Test 3: Testing Legacy /members Redirect...");
  await page.goto(`${BASE_URL}/members`, { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(800);
  const redirectedUrl = page.url();
  const redirectPassed = redirectedUrl.includes("/governance?tab=members");
  console.log(`  [TEST 3] /members -> ${redirectedUrl}: ${redirectPassed ? "PASS ✓" : "FAIL ✗"}`);

  // Test 4: Approvals Sub-Tab (/governance?tab=approvals)
  console.log("\n>>> Test 4: Testing /governance?tab=approvals Sub-Tab...");
  await page.goto(`${BASE_URL}/governance?tab=approvals`, { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(1000);

  const approvalsHeader = page.locator('text=الموافقات وقرارات الاعتماد').first();
  const isApprovalsVisible = await approvalsHeader.isVisible();
  console.log(`  [TEST 4] Governance Approvals Tab Mounted: ${isApprovalsVisible ? "PASS ✓" : "FAIL ✗"}`);

  const approvalsTabPath = path.join(OUTPUT_DIR, "governance-tab-approvals.png");
  await page.screenshot({ path: approvalsTabPath });
  console.log("  ✓ Saved approvals tab screenshot:", approvalsTabPath);

  // Test 5: Backup Sub-Tab (/governance?tab=backup)
  console.log("\n>>> Test 5: Testing /governance?tab=backup Sub-Tab...");
  await page.goto(`${BASE_URL}/governance?tab=backup`, { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(1000);

  const backupHeader = page.locator('text=مركز الاستعادة والنسخ الاحتياطي').first();
  const isBackupVisible = await backupHeader.isVisible();
  console.log(`  [TEST 5] Governance Backup Tab Mounted: ${isBackupVisible ? "PASS ✓" : "FAIL ✗"}`);

  const backupTabPath = path.join(OUTPUT_DIR, "governance-tab-backup.png");
  await page.screenshot({ path: backupTabPath });
  console.log("  ✓ Saved backup tab screenshot:", backupTabPath);

  await browser.close();

  const allPassed = inputValidity.valid && membersPassed && redirectPassed && isApprovalsVisible && isBackupVisible;
  console.log("\n================================================================================");
  console.log(`ALL URGENT TESTS SUMMARY: ${allPassed ? "ALL PASSED ✓" : "SOME FAILED ✗"}`);
  console.log("================================================================================");
}

main().catch((err) => {
  console.error("FATAL ERROR:", err);
  process.exit(1);
});
