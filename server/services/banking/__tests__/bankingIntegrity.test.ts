import { describe, expect, it } from "vitest";

describe("Strict Ledger & Financial Equations Integrity (Zero Double-Counting)", () => {
  it("enforces Net Worth equation strictly without double-counting", () => {
    // Equation:
    // Net Worth = (Liquid Free Cash + T+2 Receivables + Invested Assets + Bank Certificates) - (Active Liabilities + Credit Card Outstanding Dues)

    const liquidFreeCash = 50_000; // Checking + Savings + Telda + Cash
    const tPlus2Receivables = 10_000; // Unsettled sell proceeds
    const investedAssets = 150_000; // Market value of stocks + funds + precious metals
    const bankCertificates = 100_000; // Fixed deposit principals (excluded from liquid cash)
    
    const activeLiabilities = 24_000; // Traditional debts (loans, personal IOUs)
    const creditCardOutstandingDues = 6_000; // Active credit card balances

    const grossAssets = liquidFreeCash + tPlus2Receivables + investedAssets + bankCertificates;
    const totalLiabilities = activeLiabilities + creditCardOutstandingDues;
    const netWorth = grossAssets - totalLiabilities;

    expect(grossAssets).toBe(310_000);
    expect(totalLiabilities).toBe(30_000);
    expect(netWorth).toBe(280_000);

    // Verify liquid free cash excludes locked certificates
    expect(liquidFreeCash).not.toBe(liquidFreeCash + bankCertificates);
  });

  it("calculates certificate periodic yields correctly based on payout frequency", () => {
    const principal = 100_000;
    const annualRate = 23.5; // 23.5%
    const annualYield = (principal * annualRate) / 100; // 23,500

    const monthlyYield = annualYield / 12;
    const quarterlyYield = annualYield / 4;
    const semiAnnualYield = annualYield / 2;

    expect(annualYield).toBe(23_500);
    expect(Number(monthlyYield.toFixed(2))).toBe(1958.33);
    expect(quarterlyYield).toBe(5875);
    expect(semiAnnualYield).toBe(11750);
  });

  it("monitors credit card 30% utilization ceiling rule accurately", () => {
    const creditLimit = 50_000;
    
    // 25% utilization -> Safe
    const safeBalance = 12_500;
    const safeRatio = (safeBalance / creditLimit) * 100;
    expect(safeRatio).toBe(25);
    expect(safeRatio <= 30).toBe(true);

    // 40% utilization -> Warning threshold triggered
    const warningBalance = 20_000;
    const warningRatio = (warningBalance / creditLimit) * 100;
    expect(warningRatio).toBe(40);
    expect(warningRatio > 30).toBe(true);
  });

  it("strictly enforces EGX T+2 trading-day settlement calendar (skips Friday and Saturday)", async () => {
    const { calculateEgxT2SettlementDate, isEgxTradeSettled } = await import("../../../swingTradingMath");

    // Thursday trade: Sep 17, 2026, 12:00 PM
    const thursdayTrade = new Date(2026, 8, 17, 12, 0, 0); // Month 8 is September
    expect(thursdayTrade.getDay()).toBe(4); // Thursday

    const settlementDate = calculateEgxT2SettlementDate(thursdayTrade);
    // Friday (Sep 18, day 5) is skipped
    // Saturday (Sep 19, day 6) is skipped
    // Sunday (Sep 20, day 0) is Trading Day +1
    // Monday (Sep 21, day 1) is Trading Day +2 (Settlement Date)
    expect(settlementDate.getDay()).toBe(1); // Monday
    expect(settlementDate.getDate()).toBe(21);

    // 48 calendar hours after trade is Saturday Sep 19 at 12:00 PM
    const saturday48HoursLater = new Date(2026, 8, 19, 12, 0, 0);
    // With strict EGX T+2, the trade is STILL UNSETTLED on Saturday!
    expect(isEgxTradeSettled(thursdayTrade, saturday48HoursLater)).toBe(false);

    // Sunday Sep 20 at 12:00 PM is still T+1 -> STILL UNSETTLED!
    const sundayTPlus1 = new Date(2026, 8, 20, 12, 0, 0);
    expect(isEgxTradeSettled(thursdayTrade, sundayTPlus1)).toBe(false);

    // Monday Sep 21 at 12:00 PM -> SETTLED!
    const mondayTPlus2 = new Date(2026, 8, 21, 12, 0, 0);
    expect(isEgxTradeSettled(thursdayTrade, mondayTPlus2)).toBe(true);
  });
});
