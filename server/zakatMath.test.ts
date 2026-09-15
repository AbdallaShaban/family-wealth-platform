import { describe, expect, it } from "vitest";
import { calculateZakat } from "./zakatMath";

describe("calculateZakat", () => {
  it("calculates only after the configured haul is complete and the nisab is met", () => {
    const result = calculateZakat({ eligibleBase: "10000", goldPricePerGramBase: "100", haulCompleted: true });
    expect(result.nisabBase).toBe("8500.000000");
    expect(result.zakatDueBase).toBe("250.000000");
    expect(result.calendarType).toBe("hijri");
    expect(result.annualRatePercent).toBe("2.5000");
  });

  it("calculates according to AAOIFI Standard No. 9 with Gregorian 2.577% rate", () => {
    const result = calculateZakat({
      eligibleBase: "100000",
      goldPricePerGramBase: "1000",
      haulCompleted: true,
      calendarType: "gregorian",
    });
    expect(result.calendarType).toBe("gregorian");
    expect(result.annualRatePercent).toBe("2.5770");
    expect(result.zakatDueBase).toBe("2577.000000");
  });

  it("returns zero below nisab or before haul completion", () => {
    expect(calculateZakat({ eligibleBase: "8499", goldPricePerGramBase: "100", haulCompleted: true }).zakatDueBase).toBe("0.000000");
    expect(calculateZakat({ eligibleBase: "10000", goldPricePerGramBase: "100", haulCompleted: false }).zakatDueBase).toBe("0.000000");
  });
});

