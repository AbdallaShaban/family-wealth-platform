import "dotenv/config";
import { chromium } from "@playwright/test";
import * as db from "../server/db";
import { users } from "../drizzle/schema";
import { sdk } from "../server/_core/sdk";
import { COOKIE_NAME } from "../shared/const";

async function main() {
  const database = await db.getDb();
  const [firstUser] = await database!.select().from(users).limit(1);
  const token = await sdk.createSessionToken(firstUser.openId, { name: "Auditor" });

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext();
  await ctx.addCookies([{ name: COOKIE_NAME, value: token, domain: "localhost", path: "/" }]);

  const page = await ctx.newPage();
  page.on("console", (m) => console.log("PAGE CONSOLE:", m.type(), m.text()));
  page.on("pageerror", (e) => console.log("PAGE ERROR:", e.message));

  console.log("Navigating to /debts...");
  await page.goto("http://localhost:3000/debts", { waitUntil: "networkidle" });
  await page.waitForTimeout(3000);

  const debugInfo = await page.evaluate(() => {
    const mainEl = document.querySelector("main.fintech-v2-main");
    const shellEl = document.querySelector(".fintech-content-shell");
    return {
      url: window.location.href,
      pathname: window.location.pathname,
      search: window.location.search,
      dataRoute: shellEl?.getAttribute("data-route"),
      mainText: mainEl?.innerText?.slice(0, 300)?.replace(/\s+/g, " "),
    };
  });

  console.log("Debug Info:", debugInfo);

  await browser.close();
  process.exit(0);
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
