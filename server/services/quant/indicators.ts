/**
 * Standalone Quantitative Indicator Algorithms
 * Extracted & tailored from open-source quantitative trading architectures.
 * Pure mathematical functions: deterministic, zero side-effects, safe against division-by-zero & small datasets.
 */

export interface CandleInput {
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
  timestamp?: number;
}

export interface MACDResult {
  macdLine: number[];
  signalLine: number[];
  histogram: number[];
}

export interface BollingerBandsResult {
  middle: number[];
  upper: number[];
  lower: number[];
  bandwidth: number[];
  percentB: number[];
}

export interface PivotLevels {
  supports: number[];
  resistances: number[];
}

/**
 * Calculates Simple Moving Average (SMA) over a given period.
 */
export function calculateSMA(prices: number[], period: number): number[] {
  if (!prices || prices.length === 0 || period <= 0) return [];
  const result: number[] = new Array(prices.length).fill(NaN);
  if (prices.length < period) return result;

  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += prices[i];
  }
  result[period - 1] = Number((sum / period).toFixed(4));

  for (let i = period; i < prices.length; i++) {
    sum += prices[i] - prices[i - period];
    result[i] = Number((sum / period).toFixed(4));
  }

  return result;
}

/**
 * Calculates Exponential Moving Average (EMA) with standard alpha = 2 / (period + 1).
 */
export function calculateEMA(prices: number[], period: number): number[] {
  if (!prices || prices.length === 0 || period <= 0) return [];
  const result: number[] = new Array(prices.length).fill(NaN);
  if (prices.length < period) return result;

  // First EMA value is seeded with SMA
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += prices[i];
  }
  result[period - 1] = Number((sum / period).toFixed(4));

  const alpha = 2 / (period + 1);
  for (let i = period; i < prices.length; i++) {
    const prev = result[i - 1];
    const current = prices[i] * alpha + prev * (1 - alpha);
    result[i] = Number(current.toFixed(4));
  }

  return result;
}

/**
 * Calculates Wilder's Smoothed Relative Strength Index (RSI).
 * Output bounded between 0 and 100.
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

  // Initial average gain and loss
  let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
  let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;

  if (avgLoss === 0) {
    result[period] = avgGain === 0 ? 50 : 100;
  } else {
    const rs = avgGain / avgLoss;
    result[period] = Number((100 - 100 / (1 + rs)).toFixed(2));
  }

  // Wilder's smoothing
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
 * Calculates Moving Average Convergence Divergence (MACD).
 * Default: 12-day fast EMA, 26-day slow EMA, 9-day signal EMA.
 */
export function calculateMACD(
  prices: number[],
  fastPeriod = 12,
  slowPeriod = 26,
  signalPeriod = 9
): MACDResult {
  const len = prices?.length ?? 0;
  if (len < slowPeriod) {
    return {
      macdLine: new Array(len).fill(NaN),
      signalLine: new Array(len).fill(NaN),
      histogram: new Array(len).fill(NaN),
    };
  }

  const fastEMA = calculateEMA(prices, fastPeriod);
  const slowEMA = calculateEMA(prices, slowPeriod);

  const macdLine: number[] = new Array(len).fill(NaN);
  for (let i = slowPeriod - 1; i < len; i++) {
    if (!isNaN(fastEMA[i]) && !isNaN(slowEMA[i])) {
      macdLine[i] = Number((fastEMA[i] - slowEMA[i]).toFixed(4));
    }
  }

  // Extract non-NaN portion of MACD line to calculate signal EMA
  const validMacdStart = slowPeriod - 1;
  const validMacdValues = macdLine.slice(validMacdStart);
  const rawSignalEMA = calculateEMA(validMacdValues, signalPeriod);

  const signalLine: number[] = new Array(len).fill(NaN);
  const histogram: number[] = new Array(len).fill(NaN);

  for (let j = 0; j < rawSignalEMA.length; j++) {
    const idx = validMacdStart + j;
    if (!isNaN(rawSignalEMA[j])) {
      signalLine[idx] = Number(rawSignalEMA[j].toFixed(4));
      histogram[idx] = Number((macdLine[idx] - signalLine[idx]).toFixed(4));
    }
  }

  return { macdLine, signalLine, histogram };
}

/**
 * Calculates Bollinger Bands (Middle, Upper, Lower, Bandwidth, %B).
 * Standard: 20-day SMA, 2 standard deviations.
 */
export function calculateBollingerBands(
  prices: number[],
  period = 20,
  multiplier = 2
): BollingerBandsResult {
  const len = prices?.length ?? 0;
  const middle = calculateSMA(prices, period);
  const upper: number[] = new Array(len).fill(NaN);
  const lower: number[] = new Array(len).fill(NaN);
  const bandwidth: number[] = new Array(len).fill(NaN);
  const percentB: number[] = new Array(len).fill(NaN);

  for (let i = period - 1; i < len; i++) {
    const slice = prices.slice(i - period + 1, i + 1);
    const mean = middle[i];
    const variance = slice.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / period;
    const stdDev = Math.sqrt(variance);

    const up = mean + multiplier * stdDev;
    const low = mean - multiplier * stdDev;
    upper[i] = Number(up.toFixed(4));
    lower[i] = Number(low.toFixed(4));

    if (mean > 0) {
      bandwidth[i] = Number(((up - low) / mean).toFixed(4));
    }
    if (up - low > 0) {
      percentB[i] = Number(((prices[i] - low) / (up - low)).toFixed(4));
    }
  }

  return { middle, upper, lower, bandwidth, percentB };
}

/**
 * Calculates Average True Range (ATR) based on high, low, and close prices.
 * Default period: 14.
 */
export function calculateATR(candles: CandleInput[], period = 14): number[] {
  const len = candles?.length ?? 0;
  if (len === 0) return [];
  if (len < period + 1) return new Array(len).fill(NaN);

  const trueRanges: number[] = [candles[0].high - candles[0].low];

  for (let i = 1; i < len; i++) {
    const currentHigh = candles[i].high;
    const currentLow = candles[i].low;
    const prevClose = candles[i - 1].close;

    const tr = Math.max(
      currentHigh - currentLow,
      Math.abs(currentHigh - prevClose),
      Math.abs(currentLow - prevClose)
    );
    trueRanges.push(tr);
  }

  const result: number[] = new Array(len).fill(NaN);
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += trueRanges[i];
  }
  let currentATR = sum / period;
  result[period - 1] = Number(currentATR.toFixed(4));

  for (let i = period; i < len; i++) {
    currentATR = (currentATR * (period - 1) + trueRanges[i]) / period;
    result[i] = Number(currentATR.toFixed(4));
  }

  return result;
}

/**
 * Detects dynamic Support and Resistance price pivot clusters.
 */
export function detectDynamicPivots(candles: CandleInput[], lookback = 5): PivotLevels {
  if (!candles || candles.length === 0) {
    return { supports: [], resistances: [] };
  }

  if (candles.length < lookback * 2 + 1) {
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

  const clusterLevels = (levels: number[]): number[] => {
    if (levels.length === 0) return [];
    const sorted = Array.from(new Set(levels)).sort((a, b) => a - b);
    const clustered: number[] = [];
    let currentCluster: number[] = [sorted[0]];

    for (let i = 1; i < sorted.length; i++) {
      const prev = currentCluster[currentCluster.length - 1];
      const diffPct = Math.abs(sorted[i] - prev) / prev;
      if (diffPct <= 0.012) {
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

  if (supports.length === 0) {
    supports.push(Number(Math.min(...candles.map(c => c.low)).toFixed(2)));
  }
  if (resistances.length === 0) {
    resistances.push(Number(Math.max(...candles.map(c => c.high)).toFixed(2)));
  }

  return { supports, resistances };
}
