import YahooFinance from "yahoo-finance2";
import Decimal from "decimal.js";

type YahooQuoteClient = {
  quote(symbol: string): Promise<{
    regularMarketPrice?: number | null;
    currency?: string | null;
    regularMarketTime?: Date | number | null;
    marketState?: string | null;
  }>;
};

export type MarketQuote = {
  price: string;
  currency: string;
  asOf: number;
  source: "Yahoo Finance via yahoo-finance2";
  quoteStatus: "delayed";
};

const currencyCode = /^[A-Z]{3}$/;
export const MARKET_DATA_STALE_AFTER_MS = 48 * 60 * 60 * 1000;

export function isMarketDataStale(asOf: number | null | undefined, now = Date.now()) {
  return !asOf || now - asOf > MARKET_DATA_STALE_AFTER_MS;
}

function toTimestamp(value: Date | number | null | undefined) {
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return value > 10_000_000_000 ? value : value * 1_000;
  return Date.now();
}

/**
 * Resolves Egyptian Exchange (EGX) symbols to their standard Yahoo Finance .CA ticker format.
 * Examples: COMI -> COMI.CA, SWDY -> SWDY.CA, EAST -> EAST.CA, ORAS -> ORAS.CA
 */
export function resolveEgxSymbol(symbol: string): string {
  const clean = symbol.trim().toUpperCase();
  if (!clean) return clean;
  if (clean.endsWith(".CA")) return clean;
  // If the symbol has no dot and matches 2-6 alphanumeric characters, append .CA
  if (!clean.includes(".")) {
    return `${clean}.CA`;
  }
  return clean;
}

/**
 * Evaluates whether the Egyptian Exchange (EGX) is currently in active trading hours.
 * Session: Sunday through Thursday, 10:00 AM to 02:30 PM Cairo Time (Africa/Cairo).
 */
export function isEgxTradingHours(date: Date = new Date()): boolean {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: "Africa/Cairo",
      weekday: "short",
      hour: "numeric",
      minute: "numeric",
      hour12: false,
    });
    const parts = formatter.formatToParts(date);
    const weekday = parts.find((p) => p.type === "weekday")?.value;
    const hour = parseInt(parts.find((p) => p.type === "hour")?.value || "0", 10);
    const minute = parseInt(parts.find((p) => p.type === "minute")?.value || "0", 10);

    // Active days: Sunday, Monday, Tuesday, Wednesday, Thursday
    const isTradingDay = ["Sun", "Mon", "Tue", "Wed", "Thu"].includes(weekday || "");
    if (!isTradingDay) return false;

    const timeMinutes = hour * 60 + minute;
    // 10:00 AM (600 mins) to 02:30 PM (870 mins)
    return timeMinutes >= 600 && timeMinutes <= 870;
  } catch {
    // Fallback if timezone unavailable
    const day = date.getUTCDay();
    return day >= 0 && day <= 4;
  }
}

/**
 * Calculates spot 24K gold price per gram in EGP.
 * Formula: (Gold Ounce Spot [GC=F] in USD / 31.1035) * USD/EGP Exchange Rate.
 */
export function calculateGold24kGramEgp(args: {
  goldOunceUsd: number | string;
  usdEgpRate: number | string;
}) {
  const ouncePrice = new Decimal(args.goldOunceUsd);
  const fxRate = new Decimal(args.usdEgpRate);
  if (ouncePrice.lte(0) || fxRate.lte(0)) {
    throw new Error("مدخلات احتساب سعر الذهب غير صالحة.");
  }
  const troyOunceGrams = new Decimal("31.1034768");
  const gramPriceUsd = ouncePrice.div(troyOunceGrams);
  const gramPriceEgp = gramPriceUsd.mul(fxRate);

  return {
    pricePerGramEgp: gramPriceEgp.toFixed(2),
    pricePerGramUsd: gramPriceUsd.toFixed(2),
    goldOunceUsd: ouncePrice.toFixed(2),
    usdEgpRate: fxRate.toFixed(4),
    formula: "([GC=F] / 31.1035) * USD/EGP",
    asOf: Date.now(),
  };
}

export function normalizeYahooQuote(raw: Awaited<ReturnType<YahooQuoteClient["quote"]>>): MarketQuote {
  const price = raw.regularMarketPrice;
  const currency = raw.currency?.trim().toUpperCase();
  const asOf = toTimestamp(raw.regularMarketTime);
  if (!Number.isFinite(price) || (price ?? 0) <= 0) throw new Error("Yahoo Finance لم يعد سعراً سوقياً صالحاً.");
  if (!currency || !/^[A-Z]{3}$/.test(currency)) throw new Error("Yahoo Finance لم يعد رمز عملة صالحاً.");
  if (!Number.isFinite(asOf) || asOf <= 0) throw new Error("Yahoo Finance لم يعد طابعاً زمنياً صالحاً.");
  return { price: price!.toFixed(8), currency, asOf, source: "Yahoo Finance via yahoo-finance2", quoteStatus: "delayed" };
}

export async function fetchYahooQuote(symbol: string, client: YahooQuoteClient = new YahooFinance()) {
  const normalizedSymbol = symbol.trim().toUpperCase();
  if (!normalizedSymbol || normalizedSymbol.length > 48) throw new Error("رمز الأداة الاستثمارية غير صالح للتحديث.");
  return normalizeYahooQuote(await client.quote(normalizedSymbol));
}

export function yahooFxSymbol(fromCurrency: string, toCurrency: string) {
  const from = fromCurrency.trim().toUpperCase();
  const to = toCurrency.trim().toUpperCase();
  if (!currencyCode.test(from) || !currencyCode.test(to) || from === to) {
    throw new Error("زوج عملات Yahoo Finance غير صالح للتحديث.");
  }
  return `${from}${to}=X`;
}

export async function fetchYahooFxQuote(
  fromCurrency: string,
  toCurrency: string,
  client: YahooQuoteClient = new YahooFinance(),
) {
  const symbol = yahooFxSymbol(fromCurrency, toCurrency);
  const quote = await fetchYahooQuote(symbol, client);
  const expectedCurrency = toCurrency.trim().toUpperCase();
  if (quote.currency !== expectedCurrency) {
    throw new Error("عملة سعر Yahoo Finance لا تطابق عملة وجهة زوج الصرف.");
  }
  return { ...quote, fromCurrency: fromCurrency.trim().toUpperCase(), toCurrency: expectedCurrency, symbol };
}
