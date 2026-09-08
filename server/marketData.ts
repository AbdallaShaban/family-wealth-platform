import YahooFinance from "yahoo-finance2";

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
