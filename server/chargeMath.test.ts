import { describe, expect, it } from "vitest";
import { suggestTradeCharges } from "./chargeMath";

describe("suggestTradeCharges", () => {
  it("applies active-compatible percentage and flat charges by side and currency", () => {
    const result = suggestTradeCharges({ side: "buy", grossAmount: "1000", currency: "USD", rules: [
      { name: "الوسيط", chargeType: "fee", appliesTo: "both", calculationMethod: "percentage", value: "0.25", currency: null },
      { name: "رسم ثابت", chargeType: "fee", appliesTo: "buy", calculationMethod: "flat", value: "5", currency: "USD" },
      { name: "ضريبة بيع", chargeType: "tax", appliesTo: "sell", calculationMethod: "percentage", value: "10", currency: null },
    ] });
    expect(result).toMatchObject({ suggestedFeeAmount: "7.50000000", suggestedTaxAmount: "0.00000000", currency: "USD" });
    expect(result.rows).toHaveLength(2);
  });
});
