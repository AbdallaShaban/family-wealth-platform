import { describe, expect, it } from "vitest";
import { calculateZakat } from "./zakatMath";

describe("calculateZakat", () => {
  it("calculates only after the configured haul is complete and the nisab is met", () => {
    const result = calculateZakat({ eligibleBase: "10000", goldPricePerGramBase: "100", haulCompleted: true });
    expect(result.nisabBase).toBe("8500.000000");
    expect(result.zakatDueBase).toBe("250.000000");
  });

  it("returns zero below nisab or before haul completion", () => {
    expect(calculateZakat({ eligibleBase: "8499", goldPricePerGramBase: "100", haulCompleted: true }).zakatDueBase).toBe("0.000000");
    expect(calculateZakat({ eligibleBase: "10000", goldPricePerGramBase: "100", haulCompleted: false }).zakatDueBase).toBe("0.000000");
  });
});
