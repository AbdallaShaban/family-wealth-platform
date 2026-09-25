import { describe, it, expect } from "vitest";
import { calculateForwardRunway } from "../forwardRunway";
import { calculateShariaZakatDashboard, calculateNisabThreshold } from "../shariaZakatEngine";
import { calculateInflationDrag } from "../inflationDragEngine";

describe("Strategic Module P2: Forward Runway Engine", () => {
  it("projects 6 months of forward cashflows and calculates safe runway accurately", () => {
    const report = calculateForwardRunway({
      horizonMonths: 6,
      accounts: [
        { id: 1, name: "حساب جاري CIB", currency: "EGP", currentBalance: 500_000, accountType: "bank" },
        { id: 2, name: "حساب دولاري USD", currency: "USD", currentBalance: 10_000, accountType: "bank" },
        { id: 3, name: "حساب ريالي SAR", currency: "SAR", currentBalance: 25_000, accountType: "bank" },
      ],
      certificates: [
        {
          id: 10,
          certificateName: "شهادة البنك الأهلي 23.5%",
          bankName: "البنك الأهلي المصري",
          principalAmount: 1_000_000,
          interestRate: 23.5,
          payoutFrequency: "monthly",
          issueDate: Date.now() - 30 * 24 * 3600 * 1000,
          maturityDate: Date.now() + 180 * 24 * 3600 * 1000, // matures within 6 months
          currency: "EGP",
        },
      ],
      subscriptions: [
        {
          id: 101,
          memo: "اشتراك إنترنت فايبر",
          amount: 1_000,
          currency: "EGP",
          intervalUnit: "month",
          intervalCount: 1,
          nextRunAt: Date.now() + 86400000,
          category: "subscription",
        },
        {
          id: 102,
          memo: "تجديد سنوي لسيرفرات العائلة",
          amount: 24_000,
          currency: "EGP",
          intervalUnit: "year",
          intervalCount: 1,
          nextRunAt: Date.now() + 60 * 86400000,
          category: "subscription",
        },
      ],
      debts: [
        {
          id: 201,
          name: "بطاقة ائتمان CIB",
          debtType: "credit_card",
          currency: "EGP",
          currentBalance: 50_000,
          minimumPayment: 2_500,
          paymentDay: 25,
        },
      ],
    });

    expect(report.horizonMonths).toBe(6);
    expect(report.timeline.length).toBe(6);
    expect(report.safeRunwayMonths).toBeGreaterThan(0);
    expect(report.startingLiquidEgp).toBe(500_000);
    expect(report.foreignCurrencyBalances.some((f) => f.currency === "USD" && f.totalAmount === 10_000)).toBe(true);
    expect(report.foreignCurrencyBalances.some((f) => f.currency === "SAR" && f.totalAmount === 25_000)).toBe(true);

    // Each month should have certificate interest payout (~19,583.33 EGP)
    const month1 = report.timeline[0];
    expect(month1.projectedInflowsEgp).toBeGreaterThan(19_000);
    expect(month1.projectedOutflowsEgp).toBeGreaterThan(0);
  });

  it("handles empty or zero recurring liabilities gracefully", () => {
    const report = calculateForwardRunway({
      horizonMonths: 3,
      accounts: [{ id: 1, name: "حساب جاري", currency: "EGP", currentBalance: 100_000, accountType: "bank" }],
    });

    expect(report.timeline.length).toBe(3);
    expect(report.monthlyBurnRateEgp).toBe(0);
    expect(report.runwayStatus).toBe("EXCELLENT");
  });
});

describe("Strategic Module P3: Sharia Zakat & Gold Hawl Engine", () => {
  it("calculates 85g 24k gold Nisab threshold dynamically", () => {
    const goldGramPrice = 4_000; // EGP per gram
    const nisab = calculateNisabThreshold(goldGramPrice);

    expect(nisab.goldNisabGrams).toBe(85);
    expect(nisab.nisabValueEgp).toBe(340_000);
  });

  it("correctly identifies zakat due status and applies AAOIFI asset class rules", () => {
    const dashboard = calculateShariaZakatDashboard({
      goldGramPrice24k: 4_500, // 85g * 4,500 = 382,500 EGP Nisab
      cashAndBankBalancesEgp: 500_000, // Subject 100% @ 2.5%
      monetaryGoldValueEgp: 200_000, // Subject 100% @ 2.5%
      tradingStocksMarketValueEgp: 100_000, // Subject 100% @ 2.5%
      longTermStocksMarketValueEgp: 300_000, // Subject 10% working capital @ 2.5% -> 30,000 * 2.5% = 750
      immediateDebtsDueEgp: 50_000, // Deductible
      hawlElapsedDays: 354, // Full lunar year elapsed
    });

    // Net Zakatable Wealth:
    // (500,000 + 200,000 + 100,000 + 30,000) - 50,000 = 780,000 EGP
    expect(dashboard.isAboveNisab).toBe(true);
    expect(dashboard.hawlCountdown.status).toBe("DUE_NOW");
    expect(dashboard.hawlCountdown.isDue).toBe(true);

    // 2.5% on 780,000 = 19,500 EGP
    expect(dashboard.netZakatableWealthEgp).toBe(780_000);
    expect(dashboard.totalZakatDueEgp).toBe(19_500);

    // Asset breakdowns check
    const cashBucket = dashboard.assetBreakdown.find((b) => b.categoryKey === "CASH");
    expect(cashBucket?.zakatableAmountEgp).toBe(500_000);
    expect(cashBucket?.zakatDueEgp).toBe(12_500);

    const ltBucket = dashboard.assetBreakdown.find((b) => b.categoryKey === "LONG_TERM_STOCKS");
    expect(ltBucket?.zakatableAmountEgp).toBe(30_000);
    expect(ltBucket?.zakatDueEgp).toBe(750);
  });

  it("handles wealth below Nisab threshold", () => {
    const dashboard = calculateShariaZakatDashboard({
      goldGramPrice24k: 4_000, // Nisab = 340,000 EGP
      cashAndBankBalancesEgp: 50_000,
      immediateDebtsDueEgp: 10_000,
    });

    expect(dashboard.isAboveNisab).toBe(false);
    expect(dashboard.totalZakatDueEgp).toBe(0);
    expect(dashboard.hawlCountdown.status).toBe("BELOW_NISAB");
  });
});

describe("Strategic Module P4: Purchasing Power & Inflation Drag Engine", () => {
  it("computes Fisher equation real yield and benchmarks asset buckets", () => {
    const report = calculateInflationDrag({
      baselineInflationPct: 26.5,
      goldValueEgp: 400_000, // Nominal yield ~38% -> Real yield ~+11.5% (PROTECTED)
      equitiesValueEgp: 300_000, // Nominal yield ~30% -> Real yield ~+3.5% (PROTECTED)
      fixedIncomeValueEgp: 200_000, // Nominal yield ~24.5% -> Real yield ~-2.0% (ERODING)
      cashValueEgp: 100_000, // Nominal yield ~4% -> Real yield ~-22.5% (ERODING)
    });

    expect(report.baselineInflationPct).toBe(26.5);
    expect(report.totalPortfolioValueEgp).toBe(1_000_000);

    const goldBucket = report.buckets.find((b) => b.bucketKey === "GOLD");
    expect(goldBucket?.status).toBe("PROTECTED");
    expect(goldBucket?.realYieldPct).toBeGreaterThan(0);

    const cashBucket = report.buckets.find((b) => b.bucketKey === "CASH");
    expect(cashBucket?.status).toBe("ERODING");
    expect(cashBucket?.realYieldPct).toBeLessThan(0);

    expect(report.wealthPreservationScore).toBeGreaterThanOrEqual(0);
    expect(report.wealthPreservationScore).toBeLessThanOrEqual(100);
    expect(report.recommendationsAr.length).toBeGreaterThan(0);
  });
});
