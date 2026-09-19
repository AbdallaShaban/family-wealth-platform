import { describe, it, expect } from "vitest";
import {
  calculateSMA,
  calculateEMA,
  calculateRSI,
  calculateMACD,
  calculateBollingerBands,
  calculateATR,
  detectDynamicPivots,
  calculatePhysicalGoldQuotes,
  calculateProjectedDividends,
  EGX_TOP_INSTRUMENTS,
  generateAdvisorySignal,
  calculateRebalancingPlan,
  assessCreditCard,
  calculateFinancialHealthDiagnostics,
  checkBudgetVariances,
  calculateSubscriptionCountdowns,
  PaperTradingManager,
  PaperPortfolioState,
} from "../index";

describe("Quantitative Indicator Algorithms", () => {
  const samplePrices = [10, 11, 12, 11, 12, 13, 14, 13, 15, 16, 17, 18, 19, 20, 21, 22, 21, 20, 19, 18, 17];

  it("calculates SMA correctly", () => {
    const sma5 = calculateSMA(samplePrices, 5);
    expect(sma5.length).toBe(samplePrices.length);
    expect(isNaN(sma5[0])).toBe(true);
    expect(isNaN(sma5[3])).toBe(true);
    expect(sma5[4]).toBe((10 + 11 + 12 + 11 + 12) / 5);
  });

  it("calculates EMA correctly", () => {
    const ema5 = calculateEMA(samplePrices, 5);
    expect(ema5.length).toBe(samplePrices.length);
    expect(ema5[4]).toBeCloseTo((10 + 11 + 12 + 11 + 12) / 5, 2);
    expect(ema5[ema5.length - 1]).toBeGreaterThan(0);
  });

  it("calculates RSI and stays within [0, 100]", () => {
    const rsi = calculateRSI(samplePrices, 14);
    expect(rsi.length).toBe(samplePrices.length);
    const validRsi = rsi.filter((v) => !isNaN(v));
    expect(validRsi.length).toBeGreaterThan(0);
    for (const val of validRsi) {
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThanOrEqual(100);
    }
  });

  it("calculates MACD correctly with line, signal, and histogram", () => {
    const macd = calculateMACD(samplePrices, 5, 10, 3);
    expect(macd.macdLine.length).toBe(samplePrices.length);
    expect(macd.signalLine.length).toBe(samplePrices.length);
    expect(macd.histogram.length).toBe(samplePrices.length);
  });

  it("calculates Bollinger Bands with upper >= middle >= lower", () => {
    const bb = calculateBollingerBands(samplePrices, 10, 2);
    for (let i = 9; i < samplePrices.length; i++) {
      expect(bb.upper[i]).toBeGreaterThanOrEqual(bb.middle[i]);
      expect(bb.middle[i]).toBeGreaterThanOrEqual(bb.lower[i]);
    }
  });

  it("calculates ATR and handles zero/negative safely", () => {
    const candles = samplePrices.map((p, idx) => ({
      open: p - 0.5,
      high: p + 1,
      low: p - 1,
      close: p,
      volume: 1000 + idx * 10,
    }));
    const atr = calculateATR(candles, 14);
    const validAtr = atr.filter((v) => !isNaN(v));
    expect(validAtr.length).toBeGreaterThan(0);
    expect(validAtr[0]).toBeGreaterThan(0);
  });

  it("detects dynamic pivot supports and resistances", () => {
    const candles = samplePrices.map((p) => ({
      open: p - 0.2,
      high: p + 0.5,
      low: p - 0.5,
      close: p,
    }));
    const pivots = detectDynamicPivots(candles, 2);
    expect(Array.isArray(pivots.supports)).toBe(true);
    expect(Array.isArray(pivots.resistances)).toBe(true);
  });
});

describe("Egyptian Market & Gold Engine", () => {
  it("computes physical gold 24k, 21k, 18k and sovereign quotes", () => {
    const quotes = calculatePhysicalGoldQuotes(4800);
    expect(quotes.purities.length).toBe(3);
    const g24 = quotes.purities.find((p) => p.karat === 24);
    const g21 = quotes.purities.find((p) => p.karat === 21);
    const g18 = quotes.purities.find((p) => p.karat === 18);

    expect(g24?.gramPriceEGP).toBe(4800);
    expect(g21?.gramPriceEGP).toBe(Math.round((4800 * 21) / 24));
    expect(g18?.gramPriceEGP).toBe(Math.round((4800 * 18) / 24));
    expect(quotes.sovereign.priceEGP).toBe(quotes.sovereign.weightGrams * (g21?.gramPriceEGP || 0));
  });

  it("projects dividend cash flow schedule for user shares", () => {
    const holdings = [
      { ticker: "COMI.CA", sharesCount: 1000 },
      { ticker: "EAST.CA", sharesCount: 500 },
    ];
    const projected = calculateProjectedDividends(holdings);
    expect(projected.totalAnnualCashFlowEGP).toBeGreaterThan(0);
    expect(projected.schedule.length).toBe(2);
    expect(projected.monthlyBreakdown.length).toBeGreaterThan(0);
  });
});

describe("Rule-Based Advisory Signals Engine", () => {
  it("generates advisory signal with targets, stops and Arabic insight", () => {
    const candles = Array.from({ length: 30 }, (_, i) => ({
      open: 50 + i * 0.5,
      high: 51 + i * 0.5,
      low: 49.5 + i * 0.5,
      close: 50.8 + i * 0.5,
      volume: 10000,
    }));

    const signal = generateAdvisorySignal("COMI.CA", candles);
    expect(signal.ticker).toBe("COMI.CA");
    expect(["STRONG_ACCUMULATE", "ACCUMULATE", "HOLD", "TAKE_PROFIT_PARTIAL", "TAKE_PROFIT_FULL", "WAIT"]).toContain(
      signal.action
    );
    expect(signal.confidenceScore).toBeGreaterThanOrEqual(45);
    expect(signal.targets.t1).toBeGreaterThan(signal.entryZone.min);
    expect(signal.stopLoss).toBeLessThan(signal.currentPrice);
    expect(signal.arabicAnalysis.keyPoints.length).toBeGreaterThan(0);
  });
});

describe("Portfolio Rebalancing & Concentration Engine", () => {
  it("computes rebalancing slices and concentration alerts", () => {
    const result = calculateRebalancingPlan({
      cashEGP: 500000,
      mutualFundsEGP: 200000,
      egxStocksEGP: 200000,
      goldEGP: 100000,
      individualHoldings: [
        { identifier: "COMI.CA", nameAr: "البنك التجاري الدولي", assetClass: "EGX_STOCKS", valueEGP: 180000 },
      ],
      targetProfile: "BALANCED",
    });

    expect(result.totalPortfolioValueEGP).toBe(1000000);
    expect(result.slices.length).toBe(4);
    expect(result.slices.find((s) => s.assetClass === "CASH")?.currentWeightPercent).toBe(50);
    expect(result.recommendations.length).toBeGreaterThan(0);
  });
});

describe("Financial Health Diagnostics & Credit Card Engine", () => {
  it("evaluates credit card utilization and grace period safely", () => {
    const card = assessCreditCard({
      debtId: 1,
      cardName: "CIB Platinum",
      creditLimitEGP: 50000,
      utilizedBalanceEGP: 12000,
      billingCycleDay: 25,
      gracePeriodDays: 25,
    });

    expect(card.utilizationRatePercent).toBe(24);
    expect(card.statusLevel).toBe("EXCELLENT");
    expect(card.availableCreditEGP).toBe(38000);
  });

  it("calculates diagnostic ratios and emergency runway", () => {
    const diag = calculateFinancialHealthDiagnostics({
      liquidAssetsEGP: 150000,
      totalAssetsEGP: 2000000,
      totalLiabilitiesEGP: 300000,
      monthlyAverageIncomeEGP: 40000,
      monthlyAverageExpensesEGP: 25000,
    });

    expect(diag.emergencyRunwayMonths).toBe(6);
    expect(diag.savingsRatePercent).toBe(37.5);
    expect(diag.overallScore).toBeGreaterThanOrEqual(70);
  });

  it("alerts on budget variance over 80% and 100%", () => {
    const alerts = checkBudgetVariances([
      { categoryNameAr: "طعام وتسوق", budgetLimitEGP: 10000, actualSpentEGP: 8500 },
      { categoryNameAr: "سفر وترفيه", budgetLimitEGP: 5000, actualSpentEGP: 5500 },
      { categoryNameAr: "فواتير", budgetLimitEGP: 4000, actualSpentEGP: 1500 },
    ]);

    expect(alerts[0].alertLevel).toBe("APPROACHING_LIMIT");
    expect(alerts[1].alertLevel).toBe("EXCEEDED");
    expect(alerts[2].alertLevel).toBe("SAFE");
  });

  it("calculates subscription countdowns and annual drain", () => {
    const now = Date.now();
    const subs = calculateSubscriptionCountdowns([
      {
        ruleId: 101,
        memo: "Netflix Premium",
        amountEGP: 290,
        cadence: "monthly",
        nextRunAtMs: now + 5 * 24 * 60 * 60 * 1000,
      },
    ]);

    expect(subs.totalAnnualDrainEGP).toBe(290 * 12);
    expect(subs.subscriptions[0].daysRemaining).toBeLessThanOrEqual(6);
  });
});

describe("Paper Trading Simulation Engine", () => {
  it("executes simulated buy and sell orders with accurate portfolio accounting", () => {
    let state: PaperPortfolioState = {
      initialCapitalEGP: 1000000,
      virtualCashEGP: 1000000,
      positionsValueEGP: 0,
      totalEquityEGP: 1000000,
      totalRealizedPnLEGP: 0,
      totalUnrealizedPnLEGP: 0,
      totalReturnPercent: 0,
      positions: [],
      orderHistory: [],
    };

    // Buy 100 shares of COMI at 80 EGP = 8,000 EGP
    const buyResult = PaperTradingManager.executeSimulatedOrder(state, {
      ticker: "COMI.CA",
      nameAr: "البنك التجاري الدولي",
      action: "BUY",
      assetCategory: "EGX_STOCK",
      quantity: 100,
      marketPrice: 80,
    });

    expect(buyResult.success).toBe(true);
    state = buyResult.updatedState;
    expect(state.virtualCashEGP).toBe(992000);
    expect(state.positions.length).toBe(1);
    expect(state.positions[0].quantity).toBe(100);

    // Sell 50 shares of COMI at 90 EGP = 4,500 EGP (Cost 4,000, Realized PnL = +500 EGP)
    const sellResult = PaperTradingManager.executeSimulatedOrder(state, {
      ticker: "COMI.CA",
      nameAr: "البنك التجاري الدولي",
      action: "SELL",
      assetCategory: "EGX_STOCK",
      quantity: 50,
      marketPrice: 90,
    });

    expect(sellResult.success).toBe(true);
    state = sellResult.updatedState;
    expect(state.virtualCashEGP).toBe(992000 + 4500);
    expect(state.totalRealizedPnLEGP).toBe(500);
    expect(state.positions[0].quantity).toBe(50);
  });
});
