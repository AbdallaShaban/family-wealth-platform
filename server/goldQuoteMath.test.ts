import { describe, expect, it } from "vitest";
import { suggestGoldRevaluation } from "./goldQuoteMath";

describe("suggestGoldRevaluation", () => {
  it("converts a gram quantity from a Yahoo futures quote to a reviewed target value", () => {
    expect(suggestGoldRevaluation({ quantity: "31.1034768", unit: "gram", quotePerTroyOunce: "2000" })).toMatchObject({ suggestedTargetValue: "2000.000000", normalizedUnit: "gram" });
  });
});
