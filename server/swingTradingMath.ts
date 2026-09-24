/**
 * Pure Mathematical Engine for Active Swing Trading & Advisory Co-Pilot.
 * Zero external dependencies. All functions are deterministic and safe against edge cases.
 */

export interface CandleInput {
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
  timestamp?: number;
}

export interface RiskRewardResult {
  riskAmount: number | null;
  rewardAmount: number | null;
  riskPercent: number | null;
  rewardPercent: number | null;
  riskRewardRatio: number | null; // e.g. 2.5 represents 1:2.5
  isFavorable: boolean;
}

export interface PositionSizeResult {
  recommendedQuantity: number;
  maxRiskAmount: number;
  totalCost: number;
  capitalAllocationPercent: number;
}

export interface ExitTimelineResult {
  deadline: Date;
  settlementDate: Date;
  calendarDays: number;
}

/**
 * Calculates Exponential Moving Average (EMA) for a series of numbers.
 * Uses initial SMA seed and smoothing factor multiplier alpha = 2 / (period + 1).
 * Returns an array with the same length as inputs; indices prior to seed are NaN.
 */
export function calculateEMA(prices: number[], period: number): number[] {
  if (!prices || prices.length === 0 || period <= 0) return [];
  const result: number[] = new Array(prices.length).fill(NaN);
  if (prices.length < period) return result;

  // Initial SMA as first EMA value
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += prices[i];
  }
  const initialSMA = sum / period;
  result[period - 1] = Number(initialSMA.toFixed(4));

  const alpha = 2 / (period + 1);
  for (let i = period; i < prices.length; i++) {
    const prevEMA = result[i - 1];
    const currentEMA = prices[i] * alpha + prevEMA * (1 - alpha);
    result[i] = Number(currentEMA.toFixed(4));
  }

  return result;
}

/**
 * Calculates Wilder's Smoothed Relative Strength Index (RSI 14).
 * Output is bounded between 0 and 100.
 */
export function calculateRSI(closingPrices: number[], period = 14): number[] {
  if (!closingPrices || closingPrices.length <= period || period <= 0) {
    return new Array(closingPrices?.length ?? 0).fill(NaN);
  }

  const result: number[] = new Array(closingPrices.length).fill(NaN);
  const gains: number[] = [];
  const losses: number[] = [];

  for (let i = 1; i < closingPrices.length; i++) {
    const diff = closingPrices[i] - closingPrices[i - 1];
    gains.push(diff > 0 ? diff : 0);
    losses.push(diff < 0 ? Math.abs(diff) : 0);
  }

  // First average gain and loss over period
  let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
  let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;

  if (avgLoss === 0) {
    result[period] = avgGain === 0 ? 50 : 100;
  } else {
    const rs = avgGain / avgLoss;
    result[period] = Number((100 - 100 / (1 + rs)).toFixed(2));
  }

  // Subsequent Wilder smoothing
  for (let i = period + 1; i < closingPrices.length; i++) {
    const currentGain = gains[i - 1];
    const currentLoss = losses[i - 1];

    avgGain = (avgGain * (period - 1) + currentGain) / period;
    avgLoss = (avgLoss * (period - 1) + currentLoss) / period;

    if (avgLoss === 0) {
      result[i] = avgGain === 0 ? 50 : 100;
    } else {
      const rs = avgGain / avgLoss;
      result[i] = Number((100 - 100 / (1 + rs)).toFixed(2));
    }
  }

  return result;
}

/**
 * Detects key support and resistance price pivot levels from candlestick data.
 * A pivot high is higher than `lookback` bars before and after.
 * A pivot low is lower than `lookback` bars before and after.
 */
export function detectSupportResistance(
  candles: CandleInput[],
  lookback = 5
): { supports: number[]; resistances: number[] } {
  if (!candles || candles.length === 0) {
    return { supports: [], resistances: [] };
  }

  if (candles.length < lookback * 2 + 1) {
    // Fallback to min low and max high if dataset is small
    const allLows = candles.map(c => c.low);
    const allHighs = candles.map(c => c.high);
    return {
      supports: [Number(Math.min(...allLows).toFixed(2))],
      resistances: [Number(Math.max(...allHighs).toFixed(2))],
    };
  }

  const rawSupports: number[] = [];
  const rawResistances: number[] = [];

  for (let i = lookback; i < candles.length - lookback; i++) {
    const currentHigh = candles[i].high;
    const currentLow = candles[i].low;

    let isResistance = true;
    let isSupport = true;

    for (let k = 1; k <= lookback; k++) {
      if (candles[i - k].high >= currentHigh || candles[i + k].high >= currentHigh) {
        isResistance = false;
      }
      if (candles[i - k].low <= currentLow || candles[i + k].low <= currentLow) {
        isSupport = false;
      }
    }

    if (isResistance) rawResistances.push(Number(currentHigh.toFixed(2)));
    if (isSupport) rawSupports.push(Number(currentLow.toFixed(2)));
  }

  // Filter nearby levels within 0.75% threshold to avoid noise
  const clusterLevels = (levels: number[]): number[] => {
    if (levels.length === 0) return [];
    const sorted = Array.from(new Set(levels)).sort((a, b) => a - b);
    const clustered: number[] = [];
    let currentCluster: number[] = [sorted[0]];

    for (let i = 1; i < sorted.length; i++) {
      const prev = currentCluster[currentCluster.length - 1];
      const diffPct = Math.abs(sorted[i] - prev) / prev;
      if (diffPct <= 0.01) {
        currentCluster.push(sorted[i]);
      } else {
        const avg = currentCluster.reduce((a, b) => a + b, 0) / currentCluster.length;
        clustered.push(Number(avg.toFixed(2)));
        currentCluster = [sorted[i]];
      }
    }
    if (currentCluster.length > 0) {
      const avg = currentCluster.reduce((a, b) => a + b, 0) / currentCluster.length;
      clustered.push(Number(avg.toFixed(2)));
    }
    return clustered;
  };

  const supports = clusterLevels(rawSupports);
  const resistances = clusterLevels(rawResistances);

  // If no pivots were detected, fallback to min/max
  if (supports.length === 0) {
    supports.push(Number(Math.min(...candles.map(c => c.low)).toFixed(2)));
  }
  if (resistances.length === 0) {
    resistances.push(Number(Math.max(...candles.map(c => c.high)).toFixed(2)));
  }

  return { supports, resistances };
}

/**
 * Calculates Risk / Reward metrics with safe defaults.
 * NEVER throws an error if stop-loss or take-profit is missing.
 */
export function calculateRiskReward(
  entryPrice: number,
  stopLoss?: number | null,
  takeProfit?: number | null,
  direction: "LONG" | "SHORT" = "LONG"
): RiskRewardResult {
  const safeEntry = Number(entryPrice) || 0;
  if (safeEntry <= 0) {
    return {
      riskAmount: null,
      rewardAmount: null,
      riskPercent: null,
      rewardPercent: null,
      riskRewardRatio: null,
      isFavorable: false,
    };
  }

  const hasSL = typeof stopLoss === "number" && !isNaN(stopLoss) && stopLoss > 0;
  const hasTP = typeof takeProfit === "number" && !isNaN(takeProfit) && takeProfit > 0;

  let riskAmount: number | null = null;
  let rewardAmount: number | null = null;

  if (direction === "LONG") {
    if (hasSL) riskAmount = Math.max(0, safeEntry - (stopLoss as number));
    if (hasTP) rewardAmount = Math.max(0, (takeProfit as number) - safeEntry);
  } else {
    // SHORT
    if (hasSL) riskAmount = Math.max(0, (stopLoss as number) - safeEntry);
    if (hasTP) rewardAmount = Math.max(0, safeEntry - (takeProfit as number));
  }

  const riskPercent = riskAmount !== null ? Number(((riskAmount / safeEntry) * 100).toFixed(2)) : null;
  const rewardPercent = rewardAmount !== null ? Number(((rewardAmount / safeEntry) * 100).toFixed(2)) : null;

  let riskRewardRatio: number | null = null;
  if (riskAmount !== null && rewardAmount !== null && riskAmount > 0) {
    riskRewardRatio = Number((rewardAmount / riskAmount).toFixed(2));
  }

  const isFavorable = riskRewardRatio !== null && riskRewardRatio >= 1.5;

  return {
    riskAmount: riskAmount !== null ? Number(riskAmount.toFixed(4)) : null,
    rewardAmount: rewardAmount !== null ? Number(rewardAmount.toFixed(4)) : null,
    riskPercent,
    rewardPercent,
    riskRewardRatio,
    isFavorable,
  };
}

/**
 * Calculates safe position size based on maximum account risk rule (default 1.5%).
 * Ensures that if stopped out, maximum loss does not exceed maxRiskPercent of liquid capital.
 */
export function calculateRecommendedPositionSize(
  liquidCapital: number,
  entryPrice: number,
  stopLoss: number,
  maxRiskPercent = 1.5
): PositionSizeResult {
  const capital = Math.max(0, Number(liquidCapital) || 0);
  const entry = Math.max(0, Number(entryPrice) || 0);
  const sl = Math.max(0, Number(stopLoss) || 0);

  if (capital <= 0 || entry <= 0 || sl <= 0) {
    return {
      recommendedQuantity: 0,
      maxRiskAmount: 0,
      totalCost: 0,
      capitalAllocationPercent: 0,
    };
  }

  const perUnitRisk = Math.abs(entry - sl);
  if (perUnitRisk <= 0) {
    return {
      recommendedQuantity: 0,
      maxRiskAmount: 0,
      totalCost: 0,
      capitalAllocationPercent: 0,
    };
  }

  const maxRiskAmount = Number((capital * (maxRiskPercent / 100)).toFixed(2));
  let recommendedQuantity = Math.floor(maxRiskAmount / perUnitRisk);

  // Maximum constraint: cannot exceed available liquid capital purchasing power
  const maxPossibleShares = Math.floor(capital / entry);
  if (recommendedQuantity > maxPossibleShares) {
    recommendedQuantity = maxPossibleShares;
  }

  const totalCost = Number((recommendedQuantity * entry).toFixed(2));
  const capitalAllocationPercent = capital > 0 ? Number(((totalCost / capital) * 100).toFixed(1)) : 0;

  return {
    recommendedQuantity,
    maxRiskAmount,
    totalCost,
    capitalAllocationPercent,
  };
}

// Determine if a day is an active EGX trading day (Sunday = 0, Mon = 1, Tue = 2, Wed = 3, Thu = 4)
// Non-trading days: Friday = 5, Saturday = 6
export const isEgxTradingDay = (d: Date): boolean => {
  const dayOfWeek = d.getDay();
  return dayOfWeek !== 5 && dayOfWeek !== 6;
};

/**
 * Calculates T+2 settlement date for an EGX trade, skipping Friday and Saturday.
 * e.g., Thursday trade -> Friday (skip), Saturday (skip) -> Sunday (+1), Monday (+2).
 */
export function calculateEgxT2SettlementDate(tradeDate: Date | number): Date {
  const cursor = new Date(tradeDate);
  let settlementTradingDays = 0;
  while (settlementTradingDays < 2) {
    cursor.setDate(cursor.getDate() + 1);
    if (isEgxTradingDay(cursor)) {
      settlementTradingDays++;
    }
  }
  return cursor;
}

/**
 * Determines whether an EGX trade has settled by the specified timestamp (now).
 */
export function isEgxTradeSettled(tradeDate: Date | number, now: Date | number = Date.now()): boolean {
  const settlementDate = calculateEgxT2SettlementDate(tradeDate);
  const nowMs = typeof now === "number" ? now : now.getTime();
  return nowMs >= settlementDate.getTime();
}

/**
 * Calculates the exit timeline and T+2 settlement timeline for Egyptian Stock Exchange (EGX).
 * EGX active trading days: Sunday through Thursday (skips Friday and Saturday).
 */
export function calculateExitTimeline(
  startDate: Date | number,
  holdingTradingDays: number
): ExitTimelineResult {
  const start = new Date(startDate);
  const days = Math.max(1, Math.floor(Number(holdingTradingDays) || 10));

  const cursor = new Date(start.getTime());
  let accumulatedTradingDays = 0;
  let calendarDaysCount = 0;

  while (accumulatedTradingDays < days) {
    cursor.setDate(cursor.getDate() + 1);
    calendarDaysCount++;
    if (isEgxTradingDay(cursor)) {
      accumulatedTradingDays++;
    }
  }

  const deadline = new Date(cursor.getTime());
  const settlementDate = calculateEgxT2SettlementDate(deadline);

  return {
    deadline,
    settlementDate,
    calendarDays: calendarDaysCount,
  };
}
