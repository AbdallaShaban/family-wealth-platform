import "dotenv/config";
import path from "node:path";
import { chromium } from "@playwright/test";
import { sdk } from "../server/_core/sdk";
import * as db from "../server/db";
import { users } from "../drizzle/schema";
import { COOKIE_NAME } from "../shared/const";

async function main() {
  const database = await db.getDb();
  const [firstUser] = await database!.select().from(users).limit(1);
  const sessionToken = await sdk.createSessionToken(firstUser.openId, { name: firstUser.name || "Auditor" });

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  await ctx.addCookies([{
    name: COOKIE_NAME,
    value: sessionToken,
    domain: "localhost",
    path: "/",
    httpOnly: true,
    secure: false,
    sameSite: "Lax",
  }]);

  const page = await ctx.newPage();
  await page.goto("http://localhost:3000/governance?tab=members", { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(1000);
  const outPath = path.resolve(process.cwd(), ".visual-audit", "comprehensive-audit", "14-governance-members-mobile.png");
  await page.screenshot({ path: outPath, fullPage: true });
  console.log("Captured 14-governance-members-mobile.png successfully!");
  await browser.close();
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
