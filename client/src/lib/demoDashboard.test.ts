import { describe, expect, it } from "vitest";
import { demoDashboard, getDashboardPreviewMode } from "./demoDashboard";

describe("dashboard demo mode", () => {
  it("uses the demo dataset only when the user explicitly enables it", () => {
    expect(getDashboardPreviewMode(true, false)).toBe("demo");
    expect(getDashboardPreviewMode(false, true)).toBe("live");
    expect(getDashboardPreviewMode(false, false)).toBe("empty");
  });

  it("keeps a coherent local dataset for visual preview", () => {
    expect(demoDashboard.accounts).toHaveLength(3);
    expect(demoDashboard.allocation.reduce((total, item) => total + item.value, 0)).toBeGreaterThan(0);
    expect(demoDashboard.cashFlow).toHaveLength(6);
  });
});
