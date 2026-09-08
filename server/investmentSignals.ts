import Decimal from "decimal.js";

export type MarketSignalInput = {
  instrumentId: number;
  instrumentName: string;
  symbol: string | null;
  currency: string;
  averageCost: string;
  marketPrice: string | null;
  quoteAsOf: number | null;
  quoteStatus: string;
};

export type MarketSignal = {
  id: string;
  instrumentId: number;
  kind: "accumulate_review" | "profit_review" | "stale_quote";
  impact: number;
  title: string;
  detail: string;
  percentFromCost: string | null;
  currency: string;
  actionPath: "/research/prices" | "/trades";
};

const STALE_AFTER_MS = 48 * 60 * 60 * 1000;

/**
 * Creates explainable review signals only. The thresholds intentionally do not
 * submit, prefill, or recommend a transaction; a human must review data first.
 */
export function buildMarketSignals(inputs: MarketSignalInput[], now = Date.now()): MarketSignal[] {
  const signals: MarketSignal[] = [];
  for (const item of inputs) {
    const label = item.symbol ? `${item.symbol} — ${item.instrumentName}` : item.instrumentName;
    const stale = !item.quoteAsOf || now - item.quoteAsOf > STALE_AFTER_MS || item.quoteStatus === "unavailable";
    if (stale) {
      signals.push({ id: `stale-${item.instrumentId}`, instrumentId: item.instrumentId, kind: "stale_quote", impact: 75, title: "سعر يحتاج تحديثًا", detail: `راجع سعر ${label} ومصدره قبل الاعتماد على أي قراءة للأداء.`, percentFromCost: null, currency: item.currency, actionPath: "/research/prices" });
      continue;
    }
    if (!item.marketPrice) continue;
    const cost = new Decimal(item.averageCost);
    const price = new Decimal(item.marketPrice);
    if (cost.lte(0) || price.lte(0)) continue;
    const change = price.minus(cost).div(cost).mul(100);
    if (change.lte(-10)) {
      signals.push({ id: `dip-${item.instrumentId}`, instrumentId: item.instrumentId, kind: "accumulate_review", impact: Math.min(90, 60 + Math.abs(Number(change))), title: "هبوط عن متوسط التكلفة", detail: `${label} أدنى من متوسط التكلفة المسجل. راجع الفرضية والسيولة والمخاطر قبل أي قرار تجميع.`, percentFromCost: change.toFixed(2), currency: item.currency, actionPath: "/trades" });
    }
    if (change.gte(20)) {
      signals.push({ id: `profit-${item.instrumentId}`, instrumentId: item.instrumentId, kind: "profit_review", impact: Math.min(85, 55 + Number(change) / 2), title: "مكسب يحتاج مراجعة", detail: `${label} أعلى من متوسط التكلفة المسجل. راجع أهداف التخصيص وجني الأرباح قبل أي قرار.`, percentFromCost: change.toFixed(2), currency: item.currency, actionPath: "/trades" });
    }
  }
  return signals.sort((left, right) => right.impact - left.impact).slice(0, 8);
}

