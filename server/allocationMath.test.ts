import { describe, expect, it } from "vitest";
import { assetClassForInstrument, calculateAllocation, validateAllocationTargets } from "./allocationMath";

describe("FAMILY allocation mathematics", () => {
  const targets = [
    { assetClass: "cash" as const, targetPercent: "20", driftThresholdPercent: "5" },
    { assetClass: "equity" as const, targetPercent: "50", driftThresholdPercent: "5" },
    { assetClass: "fixed_income" as const, targetPercent: "20", driftThresholdPercent: "5" },
    { assetClass: "alternatives" as const, targetPercent: "5", driftThresholdPercent: "5" },
    { assetClass: "other" as const, targetPercent: "5", driftThresholdPercent: "5" },
  ];
  it("maps existing instrument types to an allocation class deterministically", () => {
    expect(assetClassForInstrument("fund")).toBe("equity");
    expect(assetClassForInstrument("bond")).toBe("fixed_income");
    expect(assetClassForInstrument("gold")).toBe("alternatives");
  });
  it("marks a valued allocation outside its saved drift band for review", () => {
    const output = calculateAllocation({ actualAmounts: { cash: "100", equity: "900" }, targets });
    expect(output.totalValuedBase).toBe("1000.000000");
    expect(output.classes.find(row => row.assetClass === "cash")).toMatchObject({ actualPercent: "10.00", driftPercent: "-10.00", targetAmount: "200.000000", adjustmentToTarget: "100.000000", status: "review" });
    expect(output.classes.find(row => row.assetClass === "equity")?.status).toBe("review");
  });
  it("rejects a target map that does not total exactly 100%", () => {
    expect(() => validateAllocationTargets([...targets.slice(0, 4), { assetClass: "other", targetPercent: "4", driftThresholdPercent: "5" }])).toThrow("100%");
  });
});
