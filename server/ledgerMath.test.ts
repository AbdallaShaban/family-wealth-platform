import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";
import { assertBalanced, convertThroughBase, nextBuyPosition, nextSellPosition, parseNonNegativeAmount, parsePositiveAmount } from "./ledgerMath";

describe("FAMILY ledger math", () => {
  it("requires a balanced double-entry journal", () => {
    expect(() => assertBalanced([
      { accountId: 1, direction: "debit", amount: new Decimal("100.00") },
      { accountId: 2, direction: "credit", amount: new Decimal("100.00") },
    ])).not.toThrow();
    expect(() => assertBalanced([
      { accountId: 1, direction: "debit", amount: new Decimal("100.00") },
      { accountId: 2, direction: "credit", amount: new Decimal("99.99") },
    ])).toThrow("القيد المالي غير متوازن");
  });

  it("balances a cross-currency journal by its base amounts", () => {
    expect(() => assertBalanced([
      { accountId: 1, direction: "debit", amount: new Decimal("100"), currency: "USD", fxRateToBase: new Decimal("50"), baseAmount: new Decimal("5000") },
      { accountId: 2, direction: "credit", amount: new Decimal("5000"), currency: "EGP", fxRateToBase: new Decimal("1"), baseAmount: new Decimal("5000") },
    ])).not.toThrow();
  });

  it("converts through the documented base-rate ratio without floating-point drift", () => {
    const egp = convertThroughBase(new Decimal("100"), new Decimal("50"), new Decimal("1"));
    const usd = convertThroughBase(new Decimal("5000"), new Decimal("1"), new Decimal("50"));
    expect(egp.toFixed(6)).toBe("5000.000000");
    expect(usd.toFixed(6)).toBe("100.000000");
  });

  it("calculates weighted average cost without floating-point arithmetic", () => {
    const first = nextBuyPosition(undefined, new Decimal("10"), new Decimal("250"));
    const second = nextBuyPosition(first, new Decimal("5"), new Decimal("175"));
    expect(second.quantity.toFixed(8)).toBe("15.00000000");
    expect(second.averageCost.toFixed(8)).toBe("28.33333333");
  });

  it("retains cost basis on partial sale and blocks overselling", () => {
    const current = { quantity: new Decimal("15"), averageCost: new Decimal("28.33333333") };
    const remaining = nextSellPosition(current, new Decimal("6"));
    expect(remaining.quantity.toFixed(8)).toBe("9.00000000");
    expect(remaining.averageCost.toFixed(8)).toBe("28.33333333");
    expect(() => nextSellPosition(current, new Decimal("15.00000001"))).toThrow("تتجاوز الحيازة");
  });

  it("rejects zero, negative, and non-numeric monetary amounts", () => {
    expect(() => parsePositiveAmount("0")).toThrow("رقمًا موجبًا");
    expect(() => parsePositiveAmount("-1")).toThrow("رقمًا موجبًا");
    expect(() => parsePositiveAmount("not-money")).toThrow("رقمًا موجبًا");
  });

  it("accepts zero for optional fees and taxes but rejects a negative value", () => {
    expect(parseNonNegativeAmount("0", "الرسوم").toFixed(2)).toBe("0.00");
    expect(() => parseNonNegativeAmount("-0.01", "الرسوم")).toThrow("غير سالب");
  });
});
