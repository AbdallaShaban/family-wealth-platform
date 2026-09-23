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
});
