import { describe, it, expect } from "vitest";
import Decimal from "decimal.js";
import {
  toDec,
  safeDiv,
  formatDec,
  calculateTwr,
  calculateMwr,
  calculateRiskMetrics,
  calculateBenchmarkComparison,
  calculateAssetClassAttribution,
  buildCapitalBridge,
} from "./performanceMath";
import {
  getCachedReadModel,
  invalidateReadModelCache,
  readModelCacheSize,
} from "./readModelCache";
import { appRouter } from "./routers";
import { resolvePeriodDates } from "./performanceRouter";

describe("Phase 10: Institutional Investment Performance & Attribution Math", () => {
  // ==========================================================================
  // 1. DECIMAL.JS PRECISION & ARITHMETIC (40-DIGIT GUARANTEE)
  // ==========================================================================
  describe("Decimal Arithmetic & Precision", () => {
    it("preserves 40 digits of precision without IEEE-754 drift", () => {
      expect(Decimal.precision).toBe(40);
      const a = new Decimal("0.1");
      const b = new Decimal("0.2");
      expect(a.plus(b).toString()).toBe("0.3");

      const preciseVal = new Decimal("12345678901234567890.12345678901234567890");
      expect(preciseVal.toFixed(20)).toBe("12345678901234567890.12345678901234567890");
    });

    it("safeDiv gracefully handles division by zero and non-finite denominators", () => {
      expect(safeDiv("100", "0").toString()).toBe("0");
      expect(safeDiv("100", "0", "fallback_val").toString()).toBe("0");
      expect(safeDiv("50", "2").toString()).toBe("25");
    });

    it("formatDec formats correctly to specified decimal places", () => {
      expect(formatDec("123.456789", 2)).toBe("123.46");
      expect(formatDec("123.456789", 4)).toBe("123.4568");
      expect(formatDec(null, 2)).toBe("0.00");
    });
  });

  // ==========================================================================
  // 2. GIPS TIME-WEIGHTED RETURN (TWR) & CASH-FLOW NEUTRALITY
  // ==========================================================================
  describe("GIPS Time-Weighted Return (TWR)", () => {
    const dayMs = 86400 * 1000;
    const t0 = 1704067200000; // 2024-01-01

    it("proves cash-flow neutrality for external deposits (capital additions)", () => {
      // Portfolio starts with 1,000,000
      // In sub-period 1 (10 days), portfolio grows 10% to 1,100,000 (R1 = 10%)
      // An external deposit of 1,000,000 is injected, bringing portfolio to 2,100,000
      // In sub-period 2 (10 days), portfolio grows 5% to 2,205,000 (R2 = 5%)
      // True TWR = (1 + 0.10) * (1 + 0.05) - 1 = 15.50%
      // A naive calculation would claim (2,205,000 - 1,000,000) / 1,000,000 = 120.5% (distorted by deposit)
      const t1 = t0 + 10 * dayMs;
      const t2 = t0 + 20 * dayMs;

      const result = calculateTwr({
        startDate: t0,
        endDate: t2,
        startValuation: "1000000.0000",
        endValuation: "2205000.0000",
        cashFlows: [
          {
            date: t1,
            amount: "1000000.0000",
            direction: "inflow",
            description: "Owner capital contribution",
          },
        ],
        intermediateValuations: [
          {
            date: t1,
            totalValue: "1100000.0000", // pre-flow valuation
            cashValue: "100000.0000",
            investmentsValue: "1000000.0000",
          },
        ],
      });

      expect(result.cumulativeTwr).toBe("0.155000"); // Exactly 15.5000%
      expect(result.subPeriods).toHaveLength(2);
      expect(result.subPeriods[0].subPeriodReturn).toBe("0.100000");
      expect(result.subPeriods[1].subPeriodReturn).toBe("0.050000");
    });

    it("proves cash-flow neutrality for external withdrawals (capital distributions)", () => {
      // Portfolio starts with 1,000,000
      // In sub-period 1, grows 10% to 1,100,000 (R1 = 10%)
      // Owner withdraws 500,000, leaving 600,000 invested
      // In sub-period 2, grows 5% to 630,000 (R2 = 5%)
      // True TWR = (1 + 0.10) * (1 + 0.05) - 1 = 15.50%
      const t1 = t0 + 10 * dayMs;
      const t2 = t0 + 20 * dayMs;

      const result = calculateTwr({
        startDate: t0,
        endDate: t2,
        startValuation: "1000000.0000",
        endValuation: "630000.0000",
        cashFlows: [
          {
            date: t1,
            amount: "-500000.0000",
            direction: "outflow",
            description: "Owner capital distribution",
          },
        ],
        intermediateValuations: [
          {
            date: t1,
            totalValue: "1100000.0000", // pre-flow valuation
            cashValue: "100000.0000",
            investmentsValue: "1000000.0000",
          },
        ],
      });

      expect(result.cumulativeTwr).toBe("0.155000"); // Exactly 15.5000%
      expect(result.subPeriods).toHaveLength(2);
      expect(result.subPeriods[0].subPeriodReturn).toBe("0.100000");
      expect(result.subPeriods[1].subPeriodReturn).toBe("0.050000");
    });

    it("chains multiple sub-periods correctly across irregular dates", () => {
      // 3 cash flows creating 4 sub-periods:
      // Sub 1: +8% (1.08)
      // Sub 2: -3% (0.97)
      // Sub 3: +12% (1.12)
      // Sub 4: +4% (1.04)
      // Expected compounded return: 1.08 * 0.97 * 1.12 * 1.04 - 1 = 1.22014848 - 1 = 22.0148%
      const t1 = t0 + 30 * dayMs;
      const t2 = t0 + 60 * dayMs;
      const t3 = t0 + 90 * dayMs;
      const tEnd = t0 + 120 * dayMs;

      // Starting with 100,000
      // Sub 1: 100,000 -> 108,000 (+8%). Then deposit 20,000 -> 128,000
      // Sub 2: 128,000 -> 124,160 (-3%). Then withdraw 14,160 -> 110,000
      // Sub 3: 110,000 -> 123,200 (+12%). Then deposit 10,000 -> 133,200
      // Sub 4: 133,200 -> 138,528 (+4%).
      const result = calculateTwr({
        startDate: t0,
        endDate: tEnd,
        startValuation: "100000.0000",
        endValuation: "138528.0000",
        cashFlows: [
          { date: t1, amount: "20000.0000", direction: "inflow" },
          { date: t2, amount: "-14160.0000", direction: "outflow" },
          { date: t3, amount: "10000.0000", direction: "inflow" },
        ],
        intermediateValuations: [
          { date: t1, totalValue: "108000.0000", cashValue: "0", investmentsValue: "108000" },
          { date: t2, totalValue: "124160.0000", cashValue: "0", investmentsValue: "124160" },
          { date: t3, totalValue: "123200.0000", cashValue: "0", investmentsValue: "123200" },
        ],
      });

      expect(result.subPeriods).toHaveLength(4);
      expect(result.subPeriods[0].subPeriodReturn).toBe("0.080000");
      expect(result.subPeriods[1].subPeriodReturn).toBe("-0.030000");
      expect(result.subPeriods[2].subPeriodReturn).toBe("0.120000");
      expect(result.subPeriods[3].subPeriodReturn).toBe("0.040000");
      expect(result.cumulativeTwr).toBe("0.220244");
    });

    it("withholds annualization for periods shorter than 365 days per GIPS standards", () => {
      const result = calculateTwr({
        startDate: t0,
        endDate: t0 + 180 * dayMs, // 180 days (< 1 year)
        startValuation: "100000.0000",
        endValuation: "110000.0000",
      });

      expect(result.periodDays).toBe(180);
      expect(result.cumulativeTwr).toBe("0.100000");
      expect(result.annualizedTwr).toBeNull(); // GIPS forbids annualizing < 1 year
    });

    it("annualizes return correctly for multi-year periods (>= 365 days)", () => {
      // 2 years (730.5 days), cumulative return = +44% (1.44)
      // Annualized = (1.44)^(1/2) - 1 = 1.20 - 1 = 20.0000%
      const result = calculateTwr({
        startDate: t0,
        endDate: t0 + Math.round(730.5 * dayMs),
        startValuation: "100000.0000",
        endValuation: "144000.0000",
      });

      expect(result.periodDays).toBe(731);
      expect(result.cumulativeTwr).toBe("0.440000");
      expect(result.annualizedTwr).toBe("0.200000"); // (1.44)^(365.25/730.5) - 1 = 20%
    });

    it("handles zero starting capital with initial funding mid-period", () => {
      const tFunding = t0 + 15 * dayMs;
      const tEnd = t0 + 60 * dayMs;

      const result = calculateTwr({
        startDate: t0,
        endDate: tEnd,
        startValuation: "0.0000",
        endValuation: "110000.0000",
        cashFlows: [
          { date: tFunding, amount: "100000.0000", direction: "inflow" },
        ],
        intermediateValuations: [
          { date: tFunding, totalValue: "0.0000", cashValue: "0", investmentsValue: "0" },
        ],
      });

      expect(result.subPeriods[0].subPeriodReturn).toBe("0.000000"); // Prior to funding
      expect(result.subPeriods[1].subPeriodReturn).toBe("0.100000"); // 100k -> 110k
      expect(result.cumulativeTwr).toBe("0.100000");
    });

    it("handles total 100% loss without crashing or returning invalid numbers", () => {
      const result = calculateTwr({
        startDate: t0,
        endDate: t0 + 90 * dayMs,
        startValuation: "50000.0000",
        endValuation: "0.0000",
      });

      expect(result.cumulativeTwr).toBe("-1.000000");
      expect(result.annualizedTwr).toBeNull();
    });

    it("reports cash_flow_linked quality when mid-period valuations are interpolated", () => {
      const t1 = t0 + 30 * dayMs;
      const result = calculateTwr({
        startDate: t0,
        endDate: t0 + 90 * dayMs,
        startValuation: "100000.0000",
        endValuation: "120000.0000",
        cashFlows: [{ date: t1, amount: "10000.0000", direction: "inflow" }],
        // Notice: NO intermediate valuations supplied!
      });

      expect(result.dataQuality).toBe("cash_flow_linked");
      expect(result.subPeriods[0].dataQuality).toBe("cash_flow_linked");
    });
  });

  // ==========================================================================
  // 3. MONEY-WEIGHTED RETURN (MWR / IRR) SOLVER
  // ==========================================================================
  describe("Money-Weighted Return (MWR / IRR)", () => {
    const dayMs = 86400 * 1000;
    const t0 = 1704067200000; // 2024-01-01

    it("solves standard 1-year IRR with exact analytical match (no cash flows)", () => {
      // 100k -> 115k over 1 year = exactly 15.0000%
      const result = calculateMwr({
        startDate: t0,
        endDate: t0 + Math.round(365.25 * dayMs),
        startValuation: "100000.0000",
        endValuation: "115000.0000",
      });

      expect(result.converged).toBe(true);
      expect(result.solverMethod).toBe("exact");
      expect(result.irr).toBe("0.150000");
      expect(result.periodIrr).toBe("0.150000");
    });

    it("solves negative return correctly (capital loss)", () => {
      // 100k -> 80k over 1 year = -20.0000%
      const result = calculateMwr({
        startDate: t0,
        endDate: t0 + Math.round(365.25 * dayMs),
        startValuation: "100000.0000",
        endValuation: "80000.0000",
      });

      expect(result.converged).toBe(true);
      expect(result.solverMethod).toBe("exact");
      expect(result.irr).toBe("-0.200000");
    });

    it("converges via Newton-Raphson for irregular mid-year cash flows", () => {
      // Start 100,000 at t0
      // Deposit 50,000 at day 182.625 (mid-year, w = 0.5)
      // End valuation: 165,000 at 1 year
      // At r = 10%: NPV = -100k - 50k/(1.1^0.5) + 165k/1.1 = -100k - 47.673k + 150k = +2.327k
      // Solver should find positive IRR around ~12%
      const result = calculateMwr({
        startDate: t0,
        endDate: t0 + Math.round(365.25 * dayMs),
        startValuation: "100000.0000",
        endValuation: "165000.0000",
        cashFlows: [
          {
            date: t0 + Math.round(182.625 * dayMs),
            amount: "50000.0000",
            direction: "inflow",
          },
        ],
      });

      expect(result.converged).toBe(true);
      expect(["newton", "bisection"]).toContain(result.solverMethod);
      expect(result.irr).not.toBeNull();
      const irrNum = parseFloat(result.irr!);
      expect(irrNum).toBeGreaterThan(0.10);
      expect(irrNum).toBeLessThan(0.15);
    });

    it("handles multiple irregular deposits and withdrawals", () => {
      // 1-year timeline with multiple deposits and withdrawals
      const tYear = t0 + Math.round(365.25 * dayMs);
      const result = calculateMwr({
        startDate: t0,
        endDate: tYear,
        startValuation: "500000.0000",
        endValuation: "620000.0000",
        cashFlows: [
          { date: t0 + 45 * dayMs, amount: "50000.0000", direction: "inflow" },
          { date: t0 + 120 * dayMs, amount: "-30000.0000", direction: "outflow" },
          { date: t0 + 250 * dayMs, amount: "40000.0000", direction: "inflow" },
        ],
      });

      expect(result.converged).toBe(true);
      expect(result.irr).not.toBeNull();
      const irrVal = parseFloat(result.irr!);
      expect(irrVal).toBeGreaterThan(0.05);
      expect(irrVal).toBeLessThan(0.20);
    });

    it("handles zero starting capital when initial capital arrives via deposit", () => {
      const tFund = t0 + 30 * dayMs;
      const tEnd = t0 + Math.round(365.25 * dayMs);

      const result = calculateMwr({
        startDate: t0,
        endDate: tEnd,
        startValuation: "0.0000",
        endValuation: "120000.0000",
        cashFlows: [
          { date: tFund, amount: "100000.0000", direction: "inflow" },
        ],
      });

      expect(result.converged).toBe(true);
      expect(result.irr).not.toBeNull();
      expect(parseFloat(result.irr!)).toBeGreaterThan(0.15);
    });

    it("returns zero IRR when both capital and cash flows are zero", () => {
      const result = calculateMwr({
        startDate: t0,
        endDate: t0 + 90 * dayMs,
        startValuation: "0.0000",
        endValuation: "0.0000",
        cashFlows: [],
      });

      expect(result.converged).toBe(true);
      expect(result.irr).toBe("0.000000");
    });

    it("gracefully reports non-convergence when no real root exists (e.g. impossible flows)", () => {
      // Starting with zero, withdrawing 100k with zero ending value (impossible in real accounting)
      const result = calculateMwr({
        startDate: t0,
        endDate: t0 + 90 * dayMs,
        startValuation: "0.0000",
        endValuation: "0.0000",
        cashFlows: [
          { date: t0 + 10 * dayMs, amount: "-100000.0000", direction: "outflow" },
        ],
      });

      expect(result.converged).toBe(false);
      expect(result.irr).toBeNull();
      expect(result.reason).toBeDefined();
    });
  });

  // ==========================================================================
  // 4. RISK METRICS: VOLATILITY, SHARPE RATIO, AND MAXIMUM DRAWDOWN
  // ==========================================================================
  describe("Risk Metrics Engine", () => {
    const dayMs = 86400 * 1000;
    const t0 = 1704067200000;

    it("calculates Maximum Drawdown, Peak Date, Trough Date, and Recovery correctly", () => {
      // Sequence of wealth movements:
      // Day 0: 1.00 (Peak established)
      // Day 1: 1.10 (+10%, new Peak = 1.10 at t1)
      // Day 2: 0.99 (-10% from 1.10 -> 0.99, DD = -10.00%)
      // Day 3: 0.88 (-11% -> 0.88, DD = (0.88 - 1.10)/1.10 = -20.00% -> Trough at t3)
      // Day 4: 1.05 (+19.3% -> 1.05, still below 1.10)
      // Day 5: 1.15 (+9.5% -> 1.15, exceeds previous peak 1.10 -> Recovery at t5)
      const t1 = t0 + 1 * dayMs;
      const t2 = t0 + 2 * dayMs;
      const t3 = t0 + 3 * dayMs;
      const t4 = t0 + 4 * dayMs;
      const t5 = t0 + 5 * dayMs;

      const subReturns = [
        { date: t1, returnRate: "0.1000" },
        { date: t2, returnRate: "-0.1000" },
        { date: t3, returnRate: "-0.111111" },
        { date: t4, returnRate: "0.193182" },
        { date: t5, returnRate: "0.095238" },
      ];

      const risk = calculateRiskMetrics({
        subPeriodReturns: subReturns,
        annualizedReturn: "0.1500",
        riskFreeRate: "0.0300",
        periodDays: 5,
      });

      expect(risk.maxDrawdown).toBe("-0.200000"); // -20.00%
      expect(risk.maxDrawdownPeakDate).toBe(t1);
      expect(risk.maxDrawdownTroughDate).toBe(t3);
      expect(risk.maxDrawdownRecoveryDate).toBe(t5);
    });

    it("returns zero drawdown for monotonically increasing returns", () => {
      const subReturns = [
        { date: t0 + 10 * dayMs, returnRate: "0.0200" },
        { date: t0 + 20 * dayMs, returnRate: "0.0300" },
        { date: t0 + 30 * dayMs, returnRate: "0.0150" },
      ];

      const risk = calculateRiskMetrics({
        subPeriodReturns: subReturns,
        annualizedReturn: "0.1000",
      });

      expect(risk.maxDrawdown).toBe("0.000000");
    });

    it("calculates Sharpe Ratio correctly with positive excess return", () => {
      const subReturns = [
        { date: t0 + 10 * dayMs, returnRate: "0.0150" },
        { date: t0 + 20 * dayMs, returnRate: "0.0120" },
        { date: t0 + 30 * dayMs, returnRate: "0.0180" },
        { date: t0 + 40 * dayMs, returnRate: "0.0140" },
      ];

      const risk = calculateRiskMetrics({
        subPeriodReturns: subReturns,
        annualizedReturn: "0.1400", // 14%
        riskFreeRate: "0.0400",    // 4%
        periodDays: 40,
      });

      expect(risk.annualizedVolatility).not.toBeNull();
      expect(risk.sharpeRatio).not.toBeNull();
      // Sharpe = (14% - 4%) / Vol > 0
      expect(parseFloat(risk.sharpeRatio!)).toBeGreaterThan(0);
    });

    it("calculates negative Sharpe Ratio when return underperforms risk-free rate", () => {
      const subReturns = [
        { date: t0 + 10 * dayMs, returnRate: "0.0020" },
        { date: t0 + 20 * dayMs, returnRate: "-0.0010" },
        { date: t0 + 30 * dayMs, returnRate: "0.0015" },
      ];

      const risk = calculateRiskMetrics({
        subPeriodReturns: subReturns,
        annualizedReturn: "0.0100", // 1%
        riskFreeRate: "0.0400",    // 4%
        periodDays: 30,
      });

      expect(parseFloat(risk.sharpeRatio!)).toBeLessThan(0);
    });

    it("returns null volatility and Sharpe when fewer than 2 return points exist", () => {
      const risk = calculateRiskMetrics({
        subPeriodReturns: [{ date: t0 + 10 * dayMs, returnRate: "0.0500" }],
        annualizedReturn: "0.0500",
      });

      expect(risk.annualizedVolatility).toBeNull();
      expect(risk.sharpeRatio).toBeNull();
    });
  });

  // ==========================================================================
  // 5. BENCHMARK COMPARISON, ALPHA, BETA & DATA-QUALITY STATES
  // ==========================================================================
  describe("Benchmark Comparison & Alpha/Beta Engine", () => {
    const dayMs = 86400 * 1000;
    const t0 = 1704067200000;

    it("returns explicit 'unavailable' state when benchmark has no quotes (never fabricates data)", () => {
      const result = calculateBenchmarkComparison({
        benchmarkSymbol: "SP500",
        portfolioReturns: [{ date: t0 + 10 * dayMs, returnRate: "0.02" }],
        benchmarkQuotes: [], // Zero quotes in database
        portfolioAnnualizedReturn: "0.1200",
        periodDays: 365,
      });

      expect(result.benchmarkStatus).toBe("unavailable");
      expect(result.benchmarkCumulativeReturn).toBeNull();
      expect(result.alpha).toBeNull();
      expect(result.beta).toBeNull();
      expect(result.message).toContain("غير متوفرة في قاعدة البيانات");
    });

    it("returns 'insufficient_quotes' when fewer than 5 statistical comparison points exist", () => {
      const quotes = [
        { date: t0, price: "100.00" },
        { date: t0 + 30 * dayMs, price: "102.00" },
        { date: t0 + 60 * dayMs, price: "105.00" },
      ];

      const result = calculateBenchmarkComparison({
        benchmarkSymbol: "TASI",
        portfolioReturns: [
          { date: t0 + 30 * dayMs, returnRate: "0.02" },
          { date: t0 + 60 * dayMs, returnRate: "0.03" },
        ],
        benchmarkQuotes: quotes,
        portfolioAnnualizedReturn: "0.1000",
        periodDays: 60,
      });

      expect(result.benchmarkStatus).toBe("insufficient_quotes");
      expect(result.alpha).toBeNull();
      expect(result.beta).toBeNull();
      expect(result.message).toContain("أقل من الحد الأدنى الإحصائي");
    });

    it("computes Alpha, Beta, Correlation, and Tracking Error when >= 5 points exist", () => {
      // 6 quote points (5 sub-periods)
      const quotes = [
        { date: t0, price: "1000.00" },
        { date: t0 + 30 * dayMs, price: "1020.00" }, // +2.0%
        { date: t0 + 60 * dayMs, price: "1040.40" }, // +2.0%
        { date: t0 + 90 * dayMs, price: "1019.59" }, // -2.0%
        { date: t0 + 120 * dayMs, price: "1050.18" }, // +3.0%
        { date: t0 + 150 * dayMs, price: "1071.18" }, // +2.0%
      ];

      // Portfolio moving with higher beta and positive alpha
      const portReturns = [
        { date: t0 + 30 * dayMs, returnRate: "0.0250" },
        { date: t0 + 60 * dayMs, returnRate: "0.0240" },
        { date: t0 + 90 * dayMs, returnRate: "-0.0180" },
        { date: t0 + 120 * dayMs, returnRate: "0.0380" },
        { date: t0 + 150 * dayMs, returnRate: "0.0260" },
      ];

      const result = calculateBenchmarkComparison({
        benchmarkSymbol: "MSCI_WORLD",
        portfolioReturns: portReturns,
        benchmarkQuotes: quotes,
        portfolioAnnualizedReturn: "0.1800", // 18%
        riskFreeRate: "0.0300",             // 3%
        periodDays: 365,
      });

      expect(result.benchmarkStatus).toBe("available");
      expect(result.beta).not.toBeNull();
      expect(result.alpha).not.toBeNull();
      expect(result.correlation).not.toBeNull();
      expect(result.rSquared).not.toBeNull();
      expect(result.trackingError).not.toBeNull();
      // Beta should be positive around ~1.2
      expect(parseFloat(result.beta!)).toBeGreaterThan(0.5);
    });

    it("gracefully handles zero-variance benchmark without NaN or division by zero", () => {
      // Flat prices: 100, 100, 100, 100, 100, 100
      const quotes = [0, 1, 2, 3, 4, 5].map((i) => ({
        date: t0 + i * 30 * dayMs,
        price: "100.00",
      }));
      const portReturns = [1, 2, 3, 4, 5].map((i) => ({
        date: t0 + i * 30 * dayMs,
        returnRate: "0.01",
      }));

      const result = calculateBenchmarkComparison({
        benchmarkSymbol: "FLAT_BMK",
        portfolioReturns: portReturns,
        benchmarkQuotes: quotes,
        portfolioAnnualizedReturn: "0.05",
        periodDays: 150,
      });

      expect(result.benchmarkStatus).toBe("insufficient_quotes");
      expect(result.beta).toBeNull();
      expect(result.alpha).toBeNull();
    });
  });

  // ==========================================================================
  // 6. ASSET-CLASS PERFORMANCE ATTRIBUTION & RECONCILIATION
  // ==========================================================================
  describe("Asset-Class Performance Attribution", () => {
    it("decomposes portfolio return into asset-class contributions and reconciles", () => {
      // Starting: Cash 200k, Equity 600k, Fixed Income 200k (Total 1,000,000)
      // Ending: Cash 204k (+2%), Equity 690k (+15%), Fixed Income 210k (+5%)
      // Total Ending: 1,104,000 (+10.40% total portfolio return)
      const holdings = [
        { assetClass: "cash" as const, startValue: "200000.00", endValue: "204000.00" },
        { assetClass: "equity" as const, startValue: "600000.00", endValue: "690000.00" },
        { assetClass: "fixed_income" as const, startValue: "200000.00", endValue: "210000.00" },
      ];

      const attr = calculateAssetClassAttribution({
        totalReturn: "0.104000",
        assetClassHoldings: holdings,
      });

      expect(attr.assetClasses).toHaveLength(3);
      expect(attr.assetClasses[0].assetClass).toBe("cash");
      expect(attr.assetClasses[0].nameAr).toBe("النقد وما يعادله");
      expect(attr.assetClasses[1].assetClass).toBe("equity");
      expect(attr.assetClasses[1].nameAr).toBe("الأسهم والصناديق الاستثمارية");

      // Sum of contributions should closely match total return
      const diff = parseFloat(attr.reconciliationDiff);
      expect(diff).toBeLessThan(0.005); // Less than 0.5% approximation variance
    });

    it("explicitly declares unsupported dimensions rather than claiming fake precision", () => {
      const attr = calculateAssetClassAttribution({
        totalReturn: "0.080000",
        assetClassHoldings: [
          { assetClass: "equity" as const, startValue: "100000", endValue: "108000" },
        ],
      });

      expect(attr.unsupportedDimensions).toContain("brinson_fachler_sector");
      expect(attr.unsupportedDimensions).toContain("currency_interaction");
      expect(attr.unsupportedDimensions).toContain("security_selection_residual");
    });
  });

  // ==========================================================================
  // 7. CAPITAL GROWTH BRIDGE ENGINE
  // ==========================================================================
  describe("Capital Growth Waterfall / Bridge", () => {
    it("exact cent-level reconciliation: Start + Deposits - Withdrawals + Gains = End", () => {
      const bridge = buildCapitalBridge({
        startingCapital: "1000000.00",
        endingCapital: "1250000.00",
        cashFlows: [
          { date: 1, amount: "200000.00", direction: "inflow" },
          { date: 2, amount: "-50000.00", direction: "outflow" },
        ],
      });

      expect(bridge.startingCapital).toBe("1000000.00");
      expect(bridge.totalDeposits).toBe("200000.00");
      expect(bridge.totalWithdrawals).toBe("50000.00");
      expect(bridge.netContributions).toBe("150000.00");
      // Gain = 1,250,000 - 1,000,000 - 150,000 = 100,000.00
      expect(bridge.investmentGainLoss).toBe("100000.00");
      expect(bridge.endingCapital).toBe("1250000.00");
      expect(bridge.reconciles).toBe(true);
    });
  });

  // ==========================================================================
  // 8. CACHE INVALIDATION & WORKSPACE ISOLATION VERIFICATION
  // ==========================================================================
  describe("ReadModelCache Performance Invalidation & Workspace Isolation", () => {
    it("isolates cache keys between workspace 1 and workspace 2", async () => {
      invalidateReadModelCache(); // clean slate

      let ws1Calls = 0;
      let ws2Calls = 0;

      const ws1Loader = async () => {
        ws1Calls++;
        return { ws: 1, twr: "0.10" };
      };
      const ws2Loader = async () => {
        ws2Calls++;
        return { ws: 2, twr: "0.20" };
      };

      // 1. Initial loads (cache miss)
      const res1 = await getCachedReadModel("performance:1:ytd:NONE", ws1Loader);
      const res2 = await getCachedReadModel("performance:2:ytd:NONE", ws2Loader);

      expect(res1.ws).toBe(1);
      expect(res2.ws).toBe(2);
      expect(ws1Calls).toBe(1);
      expect(ws2Calls).toBe(1);

      // 2. Subsequent loads (cache hit)
      await getCachedReadModel("performance:1:ytd:NONE", ws1Loader);
      await getCachedReadModel("performance:2:ytd:NONE", ws2Loader);
      expect(ws1Calls).toBe(1);
      expect(ws2Calls).toBe(1);

      // 3. Invalidate ONLY workspace 1
      invalidateReadModelCache("performance:1:");

      // Workspace 1 should reload, Workspace 2 should still hit cache
      await getCachedReadModel("performance:1:ytd:NONE", ws1Loader);
      await getCachedReadModel("performance:2:ytd:NONE", ws2Loader);

      expect(ws1Calls).toBe(2); // reloaded
      expect(ws2Calls).toBe(1); // untouched
    });
  });

  // ==========================================================================
  // 9. ROUTER TRPC INTEGRATION & SECURITY CONTROLS
  // ==========================================================================
  describe("Performance Router tRPC Procedures & Access Controls", () => {
    it("rejects unauthenticated callers with UNAUTHORIZED on getPerformanceSummary", async () => {
      const unauthCaller = appRouter.createCaller({
        req: {} as any,
        res: {} as any,
        user: undefined,
      });

      await expect(
        unauthCaller.performance.getPerformanceSummary({ period: "ytd" })
      ).rejects.toThrow();
    });

    it("rejects unauthenticated callers on listAvailableBenchmarks", async () => {
      const unauthCaller = appRouter.createCaller({
        req: {} as any,
        res: {} as any,
        user: undefined,
      });

      await expect(
        unauthCaller.performance.listAvailableBenchmarks()
      ).rejects.toThrow();
    });

    it("resolvePeriodDates correctly calculates timestamps for all preset horizons", () => {
      const fixedNow = 1718452800000; // 2024-06-15 12:00:00 UTC
      const mtd = resolvePeriodDates("mtd", undefined, undefined, fixedNow);
      expect(mtd.startDate).toBe(Date.UTC(2024, 5, 1));
      expect(mtd.endDate).toBe(fixedNow);

      const qtd = resolvePeriodDates("qtd", undefined, undefined, fixedNow);
      expect(qtd.startDate).toBe(Date.UTC(2024, 3, 1)); // Q2 starts April 1

      const ytd = resolvePeriodDates("ytd", undefined, undefined, fixedNow);
      expect(ytd.startDate).toBe(Date.UTC(2024, 0, 1)); // Jan 1

      const oneYear = resolvePeriodDates("1y", undefined, undefined, fixedNow);
      expect(oneYear.endDate - oneYear.startDate).toBeGreaterThan(365 * 86400 * 1000);

      const custom = resolvePeriodDates("custom", 1000, 5000, fixedNow);
      expect(custom.startDate).toBe(1000);
      expect(custom.endDate).toBe(5000);
    });
  });
});
