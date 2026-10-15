import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";
import { sdk } from "../server/_core/sdk";
import * as db from "../server/db";
import { users } from "../drizzle/schema";
import { COOKIE_NAME } from "../shared/const";

const BASE_URL = process.env.AUDIT_BASE_URL || "http://localhost:3000";
const OUTPUT_DIR = path.resolve(process.cwd(), ".visual-audit", "live-audit-screenshots");

const TARGETS = [
  { slug: "01_home_dashboard", url: "/" },
  { slug: "02_banking_hub_default", url: "/banking" },
  { slug: "03_banking_actual_budget", url: "/banking?tab=liquidity" },
  { slug: "04_banking_debt_payoff", url: "/banking?tab=debts" },
  { slug: "05_investments_default", url: "/investments" },
  { slug: "06_investments_dividends", url: "/investments?tab=dividends" },
  { slug: "07_performance_kspme", url: "/performance" },
  { slug: "08_market_technical_chart", url: "/data-quality" },
  { slug: "09_governance_hub", url: "/governance" }
];

async function run() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const database = await db.getDb();
  if (!database) {
    console.error("Database connection failed");
    process.exit(1);
  }

  const [firstUser] = await database.select().from(users).limit(1);
  const sessionToken = await sdk.createSessionToken(firstUser.openId, { name: firstUser.name || "Auditor" });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    colorScheme: "dark"
  });

  await context.addCookies([
    {
      name: COOKIE_NAME,
      value: sessionToken,
      domain: "localhost",
      path: "/",
      httpOnly: true,
      secure: false,
      sameSite: "Lax"
    }
  ]);

  const page = await context.newPage();

  // Clear service workers to avoid stale cache during capture
  await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle" });
  await page.evaluate(async () => {
    if ("serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const reg of registrations) {
        await reg.unregister();
      }
    }
    if ("caches" in window) {
      const keys = await caches.keys();
      for (const k of keys) {
        await caches.delete(k);
      }
    }
  });

  console.log("Service workers and caches cleared.");

  for (const target of TARGETS) {
    console.log(`Capturing: ${target.slug} (${target.url})...`);
    await page.goto(`${BASE_URL}${target.url}`, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(2000);

    const shotPath = path.join(OUTPUT_DIR, `${target.slug}.png`);
    await page.screenshot({ path: shotPath, fullPage: false });
    console.log(`Saved: ${shotPath}`);
  }

  await browser.close();
  console.log("All screenshots captured successfully in:", OUTPUT_DIR);
}

run().catch((err) => {
  console.error("Audit capture error:", err);
  process.exit(1);
});
