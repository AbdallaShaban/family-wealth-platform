import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const manifestPath = new URL("../public/manifest.json", import.meta.url);
const workerPath = new URL("../public/service-worker.js", import.meta.url);

describe("PWA assets", () => {
  it("declares an Arabic RTL installable application", () => {
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    expect(manifest).toMatchObject({ lang: "ar", dir: "rtl", display: "standalone", start_url: "/" });
    expect(manifest.icons[0]).toMatchObject({ src: "/family-icon.svg", purpose: "any maskable" });
  });

  it("does not cache authenticated APIs or private document URLs", () => {
    const worker = readFileSync(workerPath, "utf8");
    expect(worker).toContain('url.pathname.startsWith("/api/")');
    expect(worker).toContain('url.pathname.startsWith("/manus-storage/")');
  });
});
