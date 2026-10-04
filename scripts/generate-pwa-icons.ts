import path from "node:path";
import fs from "node:fs";
import { chromium } from "@playwright/test";

async function generateIcons() {
  const browser = await chromium.launch({ headless: true });
  const svgPath = path.resolve(process.cwd(), "client/public/family-icon.svg");
  const svgContent = fs.readFileSync(svgPath, "utf8");

  for (const size of [192, 512]) {
    const page = await browser.newPage();
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(`<!DOCTYPE html>
      <html>
        <head><style>body { margin: 0; padding: 0; background: transparent; overflow: hidden; display: flex; justify-content: center; align-items: center; } svg { width: ${size}px; height: ${size}px; }</style></head>
        <body>${svgContent}</body>
      </html>
    `);
    const dest = path.resolve(process.cwd(), `client/public/icon-${size}.png`);
    await page.screenshot({ path: dest, omitBackground: true });
    console.log(`Generated: ${dest} (${size}x${size})`);
    await page.close();
  }

  // Maskable icon with emerald green background
  const maskPage = await browser.newPage();
  await maskPage.setViewportSize({ width: 512, height: 512 });
  await maskPage.setContent(`<!DOCTYPE html>
    <html>
      <head><style>body { margin: 0; padding: 0; background: #064e3b; overflow: hidden; display: flex; justify-content: center; align-items: center; } svg { width: 440px; height: 440px; }</style></head>
      <body>${svgContent}</body>
    </html>
  `);
  const maskDest = path.resolve(process.cwd(), "client/public/icon-512-maskable.png");
  await maskPage.screenshot({ path: maskDest, omitBackground: false });
  console.log(`Generated: ${maskDest} (512x512 maskable)`);
  await maskPage.close();

  await browser.close();
  console.log("All PWA icons generated successfully!");
}

generateIcons().catch(err => {
  console.error("Failed to generate icons:", err);
  process.exit(1);
});
