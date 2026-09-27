import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";
import { sdk } from "../server/_core/sdk";
import * as db from "../server/db";
import { users } from "../drizzle/schema";
import { COOKIE_NAME } from "../shared/const";

const BASE_URL = "http://localhost:3000";
const OUTPUT_DIR = path.resolve(process.cwd(), ".visual-audit", "fintech-check");

const TARGETS = [
  { slug: "01-dashboard-main", url: "/" },
  { slug: "02-banking-hub", url: "/banking" },
  { slug: "03-investments-hub", url: "/investments" },
  { slug: "04-quant-hub", url: "/quant" },
  { slug: "05-governance-hub", url: "/governance" },
  { slug: "06-transactions-hub", url: "/transactions" },
];

async function main() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const database = await db.getDb();
  const [firstUser] = await database!.select().from(users).limit(1);
  const sessionToken = await sdk.createSessionToken(firstUser.openId, { name: firstUser.name || "Auditor" });

  const browser = await chromium.launch({ headless: true });

  // 1. Dark Mode Desktop (1440x900)
  const darkCtx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    colorScheme: "dark",
  });
  await darkCtx.addCookies([{
    name: COOKIE_NAME,
    value: sessionToken,
    domain: "localhost",
    path: "/",
    httpOnly: true,
    secure: false,
    sameSite: "Lax",
  }]);

  const darkPage = await darkCtx.newPage();

  for (const t of TARGETS) {
    try {
      const sep = t.url.includes("?") ? "&" : "?";
      console.log(`Capturing Dark: ${t.slug} (${t.url})...`);
      await darkPage.goto(`${BASE_URL}${t.url}${sep}theme=dark`, { waitUntil: "networkidle", timeout: 20000 });
      await darkPage.waitForTimeout(800);
      const outPath = path.join(OUTPUT_DIR, `${t.slug}-dark.png`);
      const isFull = t.slug === "01-dashboard-main";
      await darkPage.screenshot({ path: outPath, fullPage: isFull });
      console.log(`Saved ${outPath}`);
    } catch (e: any) {
      console.error(`Failed ${t.slug}:`, e.message);
    }
  }

  // 2. Light Mode Desktop (1440x900)
  const lightCtx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    colorScheme: "light",
  });
  await lightCtx.addCookies([{
    name: COOKIE_NAME,
    value: sessionToken,
    domain: "localhost",
    path: "/",
    httpOnly: true,
    secure: false,
    sameSite: "Lax",
  }]);

  const lightPage = await lightCtx.newPage();

  for (const t of TARGETS) {
    try {
      const sep = t.url.includes("?") ? "&" : "?";
      console.log(`Capturing Light: ${t.slug} (${t.url})...`);
      await lightPage.goto(`${BASE_URL}${t.url}${sep}theme=light`, { waitUntil: "networkidle", timeout: 20000 });
      await lightPage.waitForTimeout(800);
      const outPath = path.join(OUTPUT_DIR, `${t.slug}-light.png`);
      const isFull = t.slug === "01-dashboard-main";
      await lightPage.screenshot({ path: outPath, fullPage: isFull });
      console.log(`Saved ${outPath}`);
    } catch (e: any) {
      console.error(`Failed ${t.slug}:`, e.message);
    }
  }

  await browser.close();
  console.log("ALL SCREENSHOTS CAPTURED SUCCESSFULLY!");
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
