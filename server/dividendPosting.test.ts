import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";
import { buildDividendJournalLines, calculateCashDividendDistribution } from "./dividendPosting";
import { assertBalanced } from "./ledgerMath";

describe("Cash Dividend Corporate Action", () => {
  it("calculates gross and net cash dividends accurately without floating-point error", () => {
    const totalEligibleShares = new Decimal("1000");
    const dividendPerShare = new Decimal("2.75");
    const taxAmount = new Decimal("0");

    const result = calculateCashDividendDistribution({
      totalEligibleShares,
      dividendPerShare,
      taxAmount,
    });

    expect(result.grossAmount.toFixed(6)).toBe("2750.000000");
    expect(result.taxAmount.toFixed(6)).toBe("0.000000");
    expect(result.netCashAmount.toFixed(6)).toBe("2750.000000");
  });

  it("deducts withholding tax and guarantees net cash balance", () => {
    const totalEligibleShares = new Decimal("500.5");
    const dividendPerShare = new Decimal("1.20");
    const taxAmount = new Decimal("60.06"); // 10% tax

    const result = calculateCashDividendDistribution({
      totalEligibleShares,
      dividendPerShare,
      taxAmount,
    });

    expect(result.grossAmount.toFixed(6)).toBe("600.600000");
    expect(result.taxAmount.toFixed(6)).toBe("60.060000");
    expect(result.netCashAmount.toFixed(6)).toBe("540.540000");
    expect(result.netCashAmount.plus(result.taxAmount).toFixed(6)).toBe(result.grossAmount.toFixed(6));
  });

  it("rejects distribution when eligible shares are zero or negative", () => {
    expect(() =>
      calculateCashDividendDistribution({
        totalEligibleShares: new Decimal("0"),
        dividendPerShare: new Decimal("1.5"),
        taxAmount: new Decimal("0"),
      })
    ).toThrow();

    expect(() =>
      calculateCashDividendDistribution({
        totalEligibleShares: new Decimal("-10"),
        dividendPerShare: new Decimal("1.5"),
        taxAmount: new Decimal("0"),
      })
    ).toThrow();
  });

  it("rejects tax amount exceeding or equaling gross dividend", () => {
    expect(() =>
      calculateCashDividendDistribution({
        totalEligibleShares: new Decimal("100"),
        dividendPerShare: new Decimal("2"),
        taxAmount: new Decimal("200"),
      })
    ).toThrow("لا يمكن أن تتجاوز أو تعادل");

    expect(() =>
      calculateCashDividendDistribution({
        totalEligibleShares: new Decimal("100"),
        dividendPerShare: new Decimal("2"),
        taxAmount: new Decimal("250"),
      })
    ).toThrow("لا يمكن أن تتجاوز أو تعادل");
  });

  it("generates balanced double-entry lines for gross distribution without tax", () => {
    const lines = buildDividendJournalLines({
      cashAccountId: 10,
      dividendIncomeAccountId: 99,
      grossAmount: new Decimal("500.00"),
      taxAmount: new Decimal("0.00"),
      netCashAmount: new Decimal("500.00"),
      currency: "SAR",
    });

    expect(lines).toHaveLength(2);
    expect(lines[0].accountId).toBe(10);
    expect(lines[0].direction).toBe("debit");
    expect(lines[0].amount.toFixed(2)).toBe("500.00");

    expect(lines[1].accountId).toBe(99);
    expect(lines[1].direction).toBe("credit");
    expect(lines[1].amount.toFixed(2)).toBe("500.00");

    expect(() => assertBalanced(lines)).not.toThrow();
  });

  it("generates balanced three-line journal when withholding tax is present", () => {
    const lines = buildDividendJournalLines({
      cashAccountId: 10,
      dividendIncomeAccountId: 99,
      withholdingTaxAccountId: 88,
      grossAmount: new Decimal("1000.00"),
      taxAmount: new Decimal("150.00"),
      netCashAmount: new Decimal("850.00"),
      currency: "USD",
    });

    expect(lines).toHaveLength(3);

    // Cash Debit: 850
    const cashLine = lines.find(l => l.accountId === 10);
    expect(cashLine?.direction).toBe("debit");
    expect(cashLine?.amount.toFixed(2)).toBe("850.00");

    // Tax Debit: 150
    const taxLine = lines.find(l => l.accountId === 88);
    expect(taxLine?.direction).toBe("debit");
    expect(taxLine?.amount.toFixed(2)).toBe("150.00");

    // Income Credit: 1000
    const incomeLine = lines.find(l => l.accountId === 99);
    expect(incomeLine?.direction).toBe("credit");
    expect(incomeLine?.amount.toFixed(2)).toBe("1000.00");

    // Strictly balanced
    expect(() => assertBalanced(lines)).not.toThrow();
  });
});
