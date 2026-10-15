/**
 * Phase 6: Market Technical Analysis & Alert Evaluation Engine
 * Inspired by TradingView and Institutional Quantitative Standards.
 * 
 * Invariants:
 * 1. Pure analytical calculations without mock/synthetic data.
 * 2. Real OHLCV validation: candles must have legitimate Open, High, Low, Close (High >= Low).
 * 3. Technical indicators (RSI-14, SMA-20, SMA-50) require adequate historical observations.
 * 4. Stale price quotes (>48 hours for equity markets) are explicitly flagged.
 * 5. Multi-tenant workspace isolation for price & technical alert rules with anti-spam hysteresis.
 * 6. ZERO accounting mutations: purely informational read models.
 */

import fs from "node:fs";
import path from "node:path";
import Decimal from "decimal.js";
import { calculateRSI, calculateSMA, calculateEMA } from "./quant/indicators";
import { sendTelegramMessage } from "./telegramAlertService";

export interface RealCandle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface TechnicalAnalysisResult {
  symbol: string;
  timeframe: string;
  candleCount: number;
  latestPrice: number;
  latestTimestamp: number;
  isStale: boolean;
  status: "available" | "insufficient_data" | "invalid_candles";
  message?: string;
  indicators: {
    rsi14: number | null;
    rsiCondition: "oversold" | "overbought" | "neutral" | null;
    sma20: number | null;
    sma50: number | null;
    trend: "bullish_cross" | "bearish_cross" | "bullish_trend" | "bearish_trend" | "neutral" | null;
  };
  candles: RealCandle[];
}

export interface AlertRule {
  id: string;
  workspaceId: number;
  profileId: number;
  symbol: string;
  instrumentName: string;
  alertType: "price_above" | "price_below" | "rsi_oversold" | "rsi_overbought";
  threshold: number;
  status: "active" | "triggered" | "disabled";
  lastTriggeredAt?: number;
  triggeredPrice?: number;
  createdAt: number;
  notifyTelegram: boolean;
}

const ALERTS_STORE_DIR = path.resolve(process.cwd(), ".market_alert_rules");

function ensureAlertsStoreDir() {
  if (!fs.existsSync(ALERTS_STORE_DIR)) {
    fs.mkdirSync(ALERTS_STORE_DIR, { recursive: true });
  }
}

function getAlertRulesFilePath(workspaceId: number): string {
  if (!Number.isInteger(workspaceId) || workspaceId <= 0) {
    throw new Error(`معرف مساحة العمل غير صالح: ${workspaceId}`);
  }
  return path.join(ALERTS_STORE_DIR, `workspace_${workspaceId}_alerts.json`);
}

/**
 * Validates whether a candle array contains valid OHLCV numbers.
 * Rejects single-price fake candles where high < low or prices are zero/negative.
 */
export function validateRealCandles(candles: RealCandle[]): { valid: boolean; error?: string } {
  if (!candles || candles.length === 0) {
    return { valid: false, error: "لا توجد بيانات شموع متاحة." };
  }

  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    if (
      typeof c.open !== "number" ||
      typeof c.high !== "number" ||
      typeof c.low !== "number" ||
      typeof c.close !== "number" ||
      isNaN(c.open) ||
      isNaN(c.high) ||
      isNaN(c.low) ||
      isNaN(c.close)
    ) {
      return { valid: false, error: `الشمعة رقم ${i + 1} تحتوي على قيم غير رقمية.` };
    }

    if (c.open <= 0 || c.high <= 0 || c.low <= 0 || c.close <= 0) {
      return { valid: false, error: `الشمعة رقم ${i + 1} تحتوي على أسعار سالبة أو مساوية للصفر.` };
    }

    if (c.high < c.low) {
      return { valid: false, error: `الشمعة رقم ${i + 1} غير صالحة: السعر الأعلى أقل من السعر الأدنى.` };
    }

    if (c.open > c.high || c.close > c.high || c.open < c.low || c.close < c.low) {
      return { valid: false, error: `الشمعة رقم ${i + 1} غير منطقية حسابياً مقارنة بنطاق السعر.` };
    }
  }

  return { valid: true };
}

/**
 * Computes Technical Indicators (RSI-14, SMA-20, SMA-50) on real candle data.
 * Strictly adheres to non-hallucination rules: if data points < 14, returns insufficient_data.
 */
export function computeTechnicalAnalysis(
  symbol: string,
  candles: RealCandle[],
  options?: {
    timeframe?: string;
    nowMs?: number;
    staleThresholdHours?: number;
  }
): TechnicalAnalysisResult {
  const timeframe = options?.timeframe || "1d";
  const now = options?.nowMs || Date.now();
  const staleHours = options?.staleThresholdHours || 48;

  const validation = validateRealCandles(candles);
  if (!validation.valid) {
    return {
      symbol,
      timeframe,
      candleCount: candles?.length ?? 0,
      latestPrice: 0,
      latestTimestamp: 0,
      isStale: false,
      status: "invalid_candles",
      message: validation.error,
      indicators: {
        rsi14: null,
        rsiCondition: null,
        sma20: null,
        sma50: null,
        trend: null,
      },
      candles: [],
    };
  }

  // Sort chronologically
  const sorted = [...candles].sort((a, b) => a.timestamp - b.timestamp);
  const latest = sorted[sorted.length - 1];
  const ageHours = (now - latest.timestamp) / (1000 * 60 * 60);
  const isStale = ageHours > staleHours;

  if (sorted.length < 14) {
    return {
      symbol,
      timeframe,
      candleCount: sorted.length,
      latestPrice: latest.close,
      latestTimestamp: latest.timestamp,
      isStale,
      status: "insufficient_data",
      message: `بيانات الشموع التاريخية غير كافية لحساب المؤشرات الفنية الموثوقة (${sorted.length} / 14 شمعة مطلوبة على الأقل).`,
      indicators: {
        rsi14: null,
        rsiCondition: null,
        sma20: null,
        sma50: null,
        trend: null,
      },
      candles: sorted,
    };
  }

  const closePrices = sorted.map((c) => c.close);

  // RSI 14
  const rsiSeries = calculateRSI(closePrices, 14);
  const latestRsi = rsiSeries[rsiSeries.length - 1];
  const rsiVal = isNaN(latestRsi) ? null : latestRsi;

  let rsiCondition: "oversold" | "overbought" | "neutral" | null = null;
  if (rsiVal !== null) {
    if (rsiVal <= 30) rsiCondition = "oversold";
    else if (rsiVal >= 70) rsiCondition = "overbought";
    else rsiCondition = "neutral";
  }

  // SMA 20
  const sma20Series = calculateSMA(closePrices, 20);
  const latestSma20 = sma20Series[sma20Series.length - 1];
  const sma20Val = isNaN(latestSma20) ? null : latestSma20;

  // SMA 50
  const sma50Series = calculateSMA(closePrices, 50);
  const latestSma50 = sma50Series[sma50Series.length - 1];
  const sma50Val = isNaN(latestSma50) ? null : latestSma50;

  // Trend and Crossover determination
  let trend: "bullish_cross" | "bearish_cross" | "bullish_trend" | "bearish_trend" | "neutral" | null = null;
  if (sma20Val !== null && sma50Val !== null && sma20Series.length >= 2 && sma50Series.length >= 2) {
    const prevSma20 = sma20Series[sma20Series.length - 2];
    const prevSma50 = sma50Series[sma50Series.length - 2];

    if (!isNaN(prevSma20) && !isNaN(prevSma50)) {
      if (prevSma20 <= prevSma50 && sma20Val > sma50Val) {
        trend = "bullish_cross"; // Golden cross
      } else if (prevSma20 >= prevSma50 && sma20Val < sma50Val) {
        trend = "bearish_cross"; // Death cross
      } else if (sma20Val > sma50Val) {
        trend = "bullish_trend";
      } else if (sma20Val < sma50Val) {
        trend = "bearish_trend";
      } else {
        trend = "neutral";
      }
    }
  } else if (sma20Val !== null) {
    trend = latest.close > sma20Val ? "bullish_trend" : "bearish_trend";
  }

  return {
    symbol,
    timeframe,
    candleCount: sorted.length,
    latestPrice: latest.close,
    latestTimestamp: latest.timestamp,
    isStale,
    status: "available",
    indicators: {
      rsi14: rsiVal,
      rsiCondition,
      sma20: sma20Val,
      sma50: sma50Val,
      trend,
    },
    candles: sorted,
  };
}

/**
 * Loads alert rules for a specific workspace.
 */
export function loadWorkspaceAlertRules(workspaceId: number): AlertRule[] {
  ensureAlertsStoreDir();
  const filePath = getAlertRulesFilePath(workspaceId);
  if (!fs.existsSync(filePath)) {
    return [];
  }
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw);
  } catch (err) {
    console.warn(`[AlertsService] Failed to read alert rules for ws ${workspaceId}:`, err);
    return [];
  }
}

/**
 * Saves alert rules for a specific workspace.
 */
export function saveWorkspaceAlertRules(workspaceId: number, rules: AlertRule[]): void {
  ensureAlertsStoreDir();
  const filePath = getAlertRulesFilePath(workspaceId);
  fs.writeFileSync(filePath, JSON.stringify(rules, null, 2), "utf-8");
}

/**
 * Adds or updates an alert rule for a workspace.
 */
export function addWorkspaceAlertRule(
  workspaceId: number,
  profileId: number,
  ruleInput: Omit<AlertRule, "id" | "workspaceId" | "profileId" | "createdAt" | "status">
): AlertRule {
  const rules = loadWorkspaceAlertRules(workspaceId);
  const newRule: AlertRule = {
    id: `alt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    workspaceId,
    profileId,
    symbol: ruleInput.symbol.toUpperCase().trim(),
    instrumentName: ruleInput.instrumentName.trim(),
    alertType: ruleInput.alertType,
    threshold: Number(ruleInput.threshold),
    status: "active",
    createdAt: Date.now(),
    notifyTelegram: ruleInput.notifyTelegram ?? true,
  };

  rules.push(newRule);
  saveWorkspaceAlertRules(workspaceId, rules);
  return newRule;
}

/**
 * Deletes an alert rule from a workspace.
 */
export function deleteWorkspaceAlertRule(workspaceId: number, alertId: string): boolean {
  const rules = loadWorkspaceAlertRules(workspaceId);
  const initialLength = rules.length;
  const filtered = rules.filter((r) => r.id !== alertId);
  if (filtered.length !== initialLength) {
    saveWorkspaceAlertRules(workspaceId, filtered);
    return true;
  }
  return false;
}

export interface AlertEvaluationEvent {
  ruleId: string;
  symbol: string;
  alertType: string;
  threshold: number;
  currentValue: number;
  triggered: boolean;
  message: string;
  telegramDispatched: boolean;
}

/**
 * Evaluates pending alert rules for a workspace against latest quotes and indicators.
 * Implements anti-spam hysteresis:
 * - A rule triggers once when condition is met.
 * - Status becomes "triggered".
 * - It will NOT spam again until the price reverses across the threshold or user resets it.
 */
export async function evaluateAlertRules(
  workspaceId: number,
  quotes: Array<{ symbol: string; price: number; rsi?: number | null }>
): Promise<{
  evaluatedCount: number;
  triggeredEvents: AlertEvaluationEvent[];
}> {
  const rules = loadWorkspaceAlertRules(workspaceId);
  const quoteMap = new Map(quotes.map((q) => [q.symbol.toUpperCase().trim(), q]));
  const triggeredEvents: AlertEvaluationEvent[] = [];
  let stateModified = false;

  for (const rule of rules) {
    const quote = quoteMap.get(rule.symbol.toUpperCase().trim());
    if (!quote) continue;

    let conditionMet = false;
    let evalVal = quote.price;

    switch (rule.alertType) {
      case "price_above":
        evalVal = quote.price;
        conditionMet = quote.price >= rule.threshold;
        break;
      case "price_below":
        evalVal = quote.price;
        conditionMet = quote.price <= rule.threshold;
        break;
      case "rsi_overbought":
        if (quote.rsi != null && !isNaN(quote.rsi)) {
          evalVal = quote.rsi;
          conditionMet = quote.rsi >= rule.threshold;
        }
        break;
      case "rsi_oversold":
        if (quote.rsi != null && !isNaN(quote.rsi)) {
          evalVal = quote.rsi;
          conditionMet = quote.rsi <= rule.threshold;
        }
        break;
    }

    // State machine with anti-spam hysteresis:
    if (conditionMet) {
      if (rule.status === "active") {
        rule.status = "triggered";
        rule.lastTriggeredAt = Date.now();
        rule.triggeredPrice = quote.price;
        stateModified = true;

        let alertMsg = "";
        if (rule.alertType === "price_above") {
          alertMsg = `🚨 <b>تنبيه سعري (تجاوز الحد الأعلى)</b>: تجاوز سهم <b>${rule.instrumentName} (${rule.symbol})</b> حاجز <b>${rule.threshold}</b> ووصل إلى <b>${quote.price}</b>.`;
        } else if (rule.alertType === "price_below") {
          alertMsg = `🚨 <b>تنبيه سعري (كسر الحد الأدنى)</b>: هبط سهم <b>${rule.instrumentName} (${rule.symbol})</b> دون حاجز <b>${rule.threshold}</b> ووصل إلى <b>${quote.price}</b>.`;
        } else if (rule.alertType === "rsi_overbought") {
          alertMsg = `⚠️ <b>تنبيه تشبع شرائي (RSI Overbought)</b>: وصل مؤشر القوة النسبية لسهم <b>${rule.symbol}</b> إلى <b>${evalVal.toFixed(1)}</b> (أعلى من ${rule.threshold}).`;
        } else if (rule.alertType === "rsi_oversold") {
          alertMsg = `💡 <b>تنبيه تشبع بيعي (RSI Oversold)</b>: انخفض مؤشر القوة النسبية لسهم <b>${rule.symbol}</b> إلى <b>${evalVal.toFixed(1)}</b> (أدنى من ${rule.threshold}).`;
        }

        let telegramDispatched = false;
        if (rule.notifyTelegram) {
          try {
            const sendRes = await sendTelegramMessage(alertMsg, { workspaceId });
            telegramDispatched = sendRes.success;
          } catch (err) {
            console.warn(`[AlertsService] Telegram send failed for rule ${rule.id}:`, err);
          }
        }

        triggeredEvents.push({
          ruleId: rule.id,
          symbol: rule.symbol,
          alertType: rule.alertType,
          threshold: rule.threshold,
          currentValue: evalVal,
          triggered: true,
          message: alertMsg,
          telegramDispatched,
        });
      }
    } else {
      // Automatic re-arm if price crossed safely back beyond a 1% hysteresis margin
      if (rule.status === "triggered") {
        const hysteresisMargin = rule.threshold * 0.01;
        let resetHysteresis = false;
        if (rule.alertType === "price_above" && quote.price < rule.threshold - hysteresisMargin) {
          resetHysteresis = true;
        } else if (rule.alertType === "price_below" && quote.price > rule.threshold + hysteresisMargin) {
          resetHysteresis = true;
        } else if (rule.alertType === "rsi_overbought" && (quote.rsi ?? 50) < rule.threshold - 2) {
          resetHysteresis = true;
        } else if (rule.alertType === "rsi_oversold" && (quote.rsi ?? 50) > rule.threshold + 2) {
          resetHysteresis = true;
        }

        if (resetHysteresis) {
          rule.status = "active";
          stateModified = true;
        }
      }
    }
  }

  if (stateModified) {
    saveWorkspaceAlertRules(workspaceId, rules);
  }

  return {
    evaluatedCount: rules.length,
    triggeredEvents,
  };
}
