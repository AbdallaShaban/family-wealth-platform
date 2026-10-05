import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";

const ARTIFACT_DIR = "C:\\Users\\abdal\\.gemini\\antigravity-ide\\brain\\5bd4cdcc-e17f-4f15-bc34-6a4e574b171d";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: "ar-EG",
  });
  const page = await context.newPage();

  console.log("Navigating to login page with invite code...");
  await page.goto("http://localhost:3000/login?invite=INV-UQ9L-8MVM", { waitUntil: "networkidle" });

  const shot1Path = path.join(ARTIFACT_DIR, "01_onboarding_registration_invite.png");
  await page.screenshot({ path: shot1Path, fullPage: false });
  console.log("Saved screenshot 1 to:", shot1Path);

  // Fill in registration form
  console.log("Filling in registration form...");
  await page.fill("#name", "د. هاني الشافعي");
  await page.fill("#email", "dr.hani.shafie@example.com");
  await page.fill("#password", "Password@2026!");

  // Submit
  console.log("Submitting registration form...");
  const submitBtn = page.locator('button[type="submit"]');
  await submitBtn.click();

  // Wait for navigation to /
  console.log("Waiting for navigation to dashboard...");
  await page.waitForURL("http://localhost:3000/", { timeout: 15000 });
  await page.waitForTimeout(3000);

  const shot2Path = path.join(ARTIFACT_DIR, "02_clean_workspace_onboarding_dashboard.png");
  await page.screenshot({ path: shot2Path, fullPage: false });
  console.log("Saved screenshot 2 to:", shot2Path);

  await browser.close();
  console.log("Done!");
  process.exit(0);
}

main().catch((err) => {
  console.error("Error in capture-onboarding-demo:", err);
  process.exit(1);
});
