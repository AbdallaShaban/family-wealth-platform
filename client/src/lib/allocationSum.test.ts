import { describe, expect, it } from "vitest";
import { calculateAllocationSum } from "./allocationSum";

describe("calculateAllocationSum", () => {
  it("computes exactly 100% when targets equal 100", () => {
    const result = calculateAllocationSum(["40", "30", "20", "10"]);
    expect(result.total).toBe(100);
    expect(result.remaining).toBe(0);
    expect(result.isExact100).toBe(true);
    expect(result.isValid).toBe(true);
  });

  it("identifies under-allocation (< 100%)", () => {
    const result = calculateAllocationSum(["50", "25"]);
    expect(result.total).toBe(75);
    expect(result.remaining).toBe(25);
    expect(result.isExact100).toBe(false);
    expect(result.isValid).toBe(false);
  });

  it("identifies over-allocation (> 100%)", () => {
    const result = calculateAllocationSum(["50", "30", "30"]);
    expect(result.total).toBe(110);
    expect(result.remaining).toBe(-10);
    expect(result.isExact100).toBe(false);
    expect(result.isValid).toBe(false);
  });

  it("handles decimal inputs and floating point precision", () => {
    const result = calculateAllocationSum(["33.3333", "33.3333", "33.3334"]);
    expect(result.total).toBe(100);
    expect(result.remaining).toBe(0);
    expect(result.isExact100).toBe(true);
  });

  it("safely ignores empty, null, or invalid strings", () => {
    const result = calculateAllocationSum(["40", "", null, undefined, "abc", "60"]);
    expect(result.total).toBe(100);
    expect(result.isExact100).toBe(true);
  });
});
