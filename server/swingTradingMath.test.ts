import { describe, expect, it } from "vitest";
import {
  calculateEMA,
  calculateRSI,
  detectSupportResistance,
  calculateRiskReward,
  calculateRecommendedPositionSize,
  calculateExitTimeline,
  type CandleInput,
} from "./swingTradingMath";

describe("calculateEMA", () => {
  it("returns empty array for invalid inputs or empty prices", () => {
    expect(calculateEMA([], 20)).toEqual([]);
    expect(calculateEMA([10, 20], 0)).toEqual([]);
    expect(calculateEMA([10, 20], -5)).toEqual([]);
  });

  it("returns array of NaNs if price series length is less than period", () => {
    const res = calculateEMA([10, 20, 30], 5);
    expect(res).toHaveLength(3);
    expect(Number.isNaN(res[0])).toBe(true);
    expect(Number.isNaN(res[1])).toBe(true);
    expect(Number.isNaN(res[2])).toBe(true);
  });

  it("calculates accurate initial SMA and subsequent exponential weighting", () => {
    // Period = 3, alpha = 2 / (3 + 1) = 0.5
    // Prices: [10, 20, 30, 40]
    // SMA seed at index 2: (10 + 20 + 30) / 3 = 20
    // Index 3: 40 * 0.5 + 20 * 0.5 = 30
    const prices = [10, 20, 30, 40];
    const res = calculateEMA(prices, 3);
    expect(Number.isNaN(res[0])).toBe(true);
    expect(Number.isNaN(res[1])).toBe(true);
    expect(res[2]).toBe(20);
    expect(res[3]).toBe(30);
  });
});

describe("calculateRSI", () => {
  it("returns array of NaNs if length is <= period", () => {
    const res = calculateRSI([10, 11, 12], 14);
    expect(res).toHaveLength(3);
    expect(Number.isNaN(res[0])).toBe(true);
  });

  it("returns 100 when prices only increase", () => {
    const prices = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25];
    const res = calculateRSI(prices, 14);
    expect(res[14]).toBe(100);
    expect(res[15]).toBe(100);
  });

  it("returns 0 when prices only decrease", () => {
    const prices = [25, 24, 23, 22, 21, 20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10];
    const res = calculateRSI(prices, 14);
    expect(res[14]).toBe(0);
    expect(res[15]).toBe(0);
  });

  it("returns 50 when prices remain completely flat", () => {
    const prices = new Array(20).fill(50);
    const res = calculateRSI(prices, 14);
    expect(res[14]).toBe(50);
  });
});

describe("detectSupportResistance", () => {
  it("returns empty arrays for empty candle input", () => {
    const res = detectSupportResistance([]);
    expect(res.supports).toEqual([]);
    expect(res.resistances).toEqual([]);
  });

  it("falls back to global min/max for short candle series", () => {
    const candles: CandleInput[] = [
      { open: 10, high: 15, low: 9, close: 14 },
      { open: 14, high: 18, low: 13, close: 16 },
    ];
    const res = detectSupportResistance(candles, 5);
    expect(res.supports).toEqual([9]);
    expect(res.resistances).toEqual([18]);
  });

  it("detects pivot highs and pivot lows and deduplicates nearby levels", () => {
    const candles: CandleInput[] = [];
    // Generate a series that peaks at i = 5 (price 100) and bottoms at i = 10 (price 50)
    for (let i = 0; i < 20; i++) {
      let high = 70;
      let low = 60;
      if (i === 5) {
        high = 100;
        low = 90;
      } else if (i === 10) {
        high = 55;
        low = 40;
      }
      candles.push({ open: 65, high, low, close: 65 });
    }

    const res = detectSupportResistance(candles, 3);
    expect(res.resistances).toContain(100);
    expect(res.supports).toContain(40);
  });
});

describe("calculateRiskReward", () => {
  it("calculates favorable R:R ratio for long position with SL and TP", () => {
    // Entry: 100, SL: 95 (Risk: 5), TP: 110 (Reward: 10) -> R:R is 2.0 (1:2)
    const res = calculateRiskReward(100, 95, 110, "LONG");
    expect(res.riskAmount).toBe(5);
    expect(res.rewardAmount).toBe(10);
    expect(res.riskPercent).toBe(5);
    expect(res.rewardPercent).toBe(10);
    expect(res.riskRewardRatio).toBe(2);
    expect(res.isFavorable).toBe(true);
  });

  it("marks R:R as unfavorable when ratio is below 1.5", () => {
    // Entry: 100, SL: 90 (Risk: 10), TP: 110 (Reward: 10) -> R:R is 1.0 < 1.5
    const res = calculateRiskReward(100, 90, 110, "LONG");
    expect(res.riskRewardRatio).toBe(1);
    expect(res.isFavorable).toBe(false);
  });

  it("calculates R:R for short position", () => {
    // Short Entry: 100, SL: 105 (Risk: 5), TP: 85 (Reward: 15) -> R:R is 3.0
    const res = calculateRiskReward(100, 105, 85, "SHORT");
    expect(res.riskAmount).toBe(5);
    expect(res.rewardAmount).toBe(15);
    expect(res.riskRewardRatio).toBe(3);
    expect(res.isFavorable).toBe(true);
  });

  it("never throws when Stop Loss or Take Profit is omitted (advisory co-pilot)", () => {
    const noSL = calculateRiskReward(100, null, 120, "LONG");
    expect(noSL.riskAmount).toBeNull();
    expect(noSL.riskRewardRatio).toBeNull();
    expect(noSL.isFavorable).toBe(false);

    const noTP = calculateRiskReward(100, 90, undefined, "LONG");
    expect(noTP.rewardAmount).toBeNull();
    expect(noTP.riskRewardRatio).toBeNull();
    expect(noTP.isFavorable).toBe(false);

    const noBoth = calculateRiskReward(100, null, null, "LONG");
    expect(noBoth.riskRewardRatio).toBeNull();
    expect(noBoth.isFavorable).toBe(false);
  });

  it("handles invalid or inverted stop loss gracefully", () => {
    // Long with SL above entry
    const inverted = calculateRiskReward(100, 110, 120, "LONG");
    expect(inverted.riskRewardRatio).toBeNull();
    expect(inverted.isFavorable).toBe(false);
  });
});

describe("calculateRecommendedPositionSize", () => {
  it("caps risk at 1.5% of liquid capital", () => {
    // Liquid Capital: 100,000 EGP. Max risk (1.5%) = 1,500 EGP.
    // Entry: 50 EGP, SL: 47 EGP -> Risk per share: 3 EGP.
    // Recommended Quantity = 1,500 / 3 = 500 shares.
    // Total Cost = 500 * 50 = 25,000 EGP (25% of capital).
    const res = calculateRecommendedPositionSize(100000, 50, 47, 1.5);
    expect(res.maxRiskAmount).toBe(1500);
    expect(res.recommendedQuantity).toBe(500);
    expect(res.totalCost).toBe(25000);
    expect(res.capitalAllocationPercent).toBe(25);
  });

  it("caps quantity by liquid capital purchasing power", () => {
    // Liquid Capital: 10,000 EGP. Max risk (1.5%) = 150 EGP.
    // Entry: 10 EGP, SL: 9.99 EGP -> Risk per share: 0.01 EGP.
    // Uncapped quantity = 15,000 shares (150,000 EGP > 10,000 EGP).
    // Purchasing power cap: 10,000 / 10 = 1,000 shares.
    const res = calculateRecommendedPositionSize(10000, 10, 9.99, 1.5);
    expect(res.recommendedQuantity).toBe(1000);
    expect(res.totalCost).toBe(10000);
    expect(res.capitalAllocationPercent).toBe(100);
  });

  it("returns zero quantity when risk per share is 0 or negative", () => {
    const res = calculateRecommendedPositionSize(100000, 50, 50, 1.5);
    expect(res.recommendedQuantity).toBe(0);
  });
});

describe("calculateExitTimeline", () => {
  it("skips EGX non-trading days (Fridays and Saturdays)", () => {
    // Sunday 2026-09-13 (Day 0)
    // +1 trading day: Mon Sep 14
    // +2 trading day: Tue Sep 15
    // +3 trading day: Wed Sep 16
    // +4 trading day: Thu Sep 17
    // +5 trading day: Sun Sep 20 (skipping Fri Sep 18 and Sat Sep 19)
    const startDate = new Date(2026, 8, 13); // September 13, 2026 (Sunday)
    const res = calculateExitTimeline(startDate, 5);

    expect(res.deadline.getDay()).toBe(0); // Sunday
    expect(res.deadline.getDate()).toBe(20);
    // T+2 settlement date from Sunday Sep 20:
    // +1 day: Mon Sep 21
    // +2 day: Tue Sep 22
    expect(res.settlementDate.getDay()).toBe(2); // Tuesday
    expect(res.settlementDate.getDate()).toBe(22);
  });

  it("handles timeline calculation starting on Thursday", () => {
    // Thursday Sep 17, 2026
    // +1 trading day: Sun Sep 20
    const startThursday = new Date(2026, 8, 17);
    const res = calculateExitTimeline(startThursday, 1);
    expect(res.deadline.getDay()).toBe(0); // Sunday
    expect(res.deadline.getDate()).toBe(20);
  });
});
