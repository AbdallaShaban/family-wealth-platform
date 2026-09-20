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
  source: string;
  quoteStatus: "delayed" | "live";
  changePercent?: number;
  arabicName?: string;
  resolvedSymbol?: string;
  deviationPercent?: number;
  isStaleDate?: boolean;
  isDeviationWarning?: boolean;
  sanityStatus?: "normal" | "deviation_warning" | "stale_warning";
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

export const BENCHMARK_SYMBOLS: Record<string, { yahooSymbol: string; name: string; currency: string }> = {
  EGX30: { yahooSymbol: "^CASE30", name: "مؤشر البورصة المصرية الرئيسي (EGX30)", currency: "EGP" },
  "^CASE30": { yahooSymbol: "^CASE30", name: "مؤشر البورصة المصرية الرئيسي (EGX30)", currency: "EGP" },
  EGX33: { yahooSymbol: "^SHARIAH.CA", name: "مؤشر الشريعة الإسلامي (EGX33 Shariah)", currency: "EGP" },
  "^SHARIAH.CA": { yahooSymbol: "^SHARIAH.CA", name: "مؤشر الشريعة الإسلامي (EGX33 Shariah)", currency: "EGP" },
  EGX70: { yahooSymbol: "^EGX70EWI.CA", name: "مؤشر الشركات المتوسطة والصغيرة (EGX70 EWI)", currency: "EGP" },
  "^EGX70EWI.CA": { yahooSymbol: "^EGX70EWI.CA", name: "مؤشر الشركات المتوسطة والصغيرة (EGX70 EWI)", currency: "EGP" },
  SP500: { yahooSymbol: "^GSPC", name: "مؤشر S&P 500 الأمريكي", currency: "USD" },
  "^GSPC": { yahooSymbol: "^GSPC", name: "مؤشر S&P 500 الأمريكي", currency: "USD" },
  MSCI_WORLD: { yahooSymbol: "URTH", name: "مؤشر مورغان ستانلي العالمي MSCI World", currency: "USD" },
  TASI: { yahooSymbol: "^TASI.SR", name: "مؤشر السوق السعودي تاسي TASI", currency: "SAR" },
  GOLD_USD: { yahooSymbol: "GC=F", name: "مؤشر الذهب العالمي (دولار/أونصة)", currency: "USD" },
};


export function normalizeYahooQuote(raw: Awaited<ReturnType<YahooQuoteClient["quote"]>>, fallbackCurrency?: string): MarketQuote {
  const price = raw.regularMarketPrice;
  const rawCurrency = raw.currency?.trim().toUpperCase();
  const currency = rawCurrency || (fallbackCurrency?.trim().toUpperCase() ?? "");
  const asOf = toTimestamp(raw.regularMarketTime) || Date.now();
  if (!Number.isFinite(price) || (price ?? 0) <= 0) throw new Error("Yahoo Finance لم يعد سعراً سوقياً صالحاً.");
  if (!currency || !/^[A-Z]{3}$/.test(currency)) throw new Error("Yahoo Finance لم يعد رمز عملة صالحاً.");
  if (!Number.isFinite(asOf) || asOf <= 0) throw new Error("Yahoo Finance لم يعد طابعاً زمنياً صالحاً.");
  return { price: price!.toFixed(8), currency, asOf, source: "Yahoo Finance via yahoo-finance2", quoteStatus: "delayed" };
}

export async function fetchYahooQuote(symbol: string, client: YahooQuoteClient = new YahooFinance(), fallbackCurrency?: string) {
  const normalizedSymbol = symbol.trim().toUpperCase();
  if (!normalizedSymbol || normalizedSymbol.length > 48) throw new Error("رمز الأداة الاستثمارية غير صالح للتحديث.");
  return normalizeYahooQuote(await client.quote(normalizedSymbol), fallbackCurrency);
}

// In-memory cache for Mubasher Egypt stock prices (60 seconds TTL)
let mubasherCache: Array<{
  code: string;
  name: string;
  value: string;
  change: string;
  changePercentage: string;
  updatedAt: string;
}> | null = null;
let mubasherCacheTime = 0;

export async function fetchMubasherEgxPrices(): Promise<NonNullable<typeof mubasherCache>> {
  if (mubasherCache && Date.now() - mubasherCacheTime < 60_000) {
    return mubasherCache;
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch("https://www.mubasher.info/api/1/stocks/prices?country=eg&period=1D", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "application/json, text/plain, */*",
        "Accept-Language": "ar,en-US;q=0.9,en;q=0.8",
      },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`فشل استجابة مباشر مصر (HTTP ${res.status})`);
    const data = await res.json();
    const prices = data.prices || [];
    if (!Array.isArray(prices) || prices.length === 0) {
      throw new Error("لم يتم العثور على بيانات في قائمة أسعار مباشر مصر.");
    }
    mubasherCache = prices;
    mubasherCacheTime = Date.now();
    return prices;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Secondary Fallback: Fetch price from TradingView Egypt scanner API
 */
export async function fetchTradingViewEgxScan(symbol: string): Promise<{
  price: number;
  changePercent: number;
  description: string;
  ticker: string;
} | null> {
  const cleanCode = symbol.replace(/^EGX:/i, "").replace(/\.CA$/i, "").trim().toUpperCase();
  const ticker = `EGX:${cleanCode}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch("https://scanner.tradingview.com/egypt/scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        symbols: { tickers: [ticker] },
        columns: ["name", "close", "change", "description", "currency"],
      }),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const json = await res.json();
    const row = json.data?.[0];
    if (row && Array.isArray(row.d) && Number(row.d[1]) > 0) {
      return {
        price: Number(row.d[1]),
        changePercent: Number(row.d[2]) || 0,
        description: String(row.d[3] || cleanCode),
        ticker,
      };
    }
    return null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Sanity and Stale Checks for Market Quotes:
 * - Flags quotes older than 7 calendar days as STALE_DATE.
 * - Flags quotes deviating by >25% from current recorded price/cost basis as DEVIATION_WARNING.
 */
export function checkQuoteSanity(
  fetchedPrice: number,
  currentRecordedPrice: number | null | undefined,
  quoteAsOf: number
) {
  const MAX_ALLOWED_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days (accounts for weekend/holidays)
  const isStaleDate = !quoteAsOf || Date.now() - quoteAsOf > MAX_ALLOWED_AGE_MS;

  let isDeviationWarning = false;
  let deviationPercent = 0;
  if (currentRecordedPrice && currentRecordedPrice > 0) {
    deviationPercent = Math.round(
      (Math.abs(fetchedPrice - currentRecordedPrice) / currentRecordedPrice) * 10000
    ) / 100;
    if (deviationPercent > 25) {
      isDeviationWarning = true;
    }
  }

  const status: "normal" | "deviation_warning" | "stale_warning" = isStaleDate
    ? "stale_warning"
    : isDeviationWarning
    ? "deviation_warning"
    : "normal";

  return {
    isStaleDate,
    isDeviationWarning,
    deviationPercent,
    status,
    message: isStaleDate
      ? "تاريخ السعر قديم يتجاوز 7 أيام."
      : isDeviationWarning
      ? `انحراف سعري ملحوظ بنسبة ${deviationPercent}% عن السعر المسجل.`
      : "السعر محدث ومتحقق من سلامته.",
  };
}

/**
 * Primary Real-Time / Close Quote Fetcher for Egyptian Exchange (EGX) Equities:
 * Targets Mubasher Info Egypt as primary, and TradingView Egypt as secondary fallback.
 * Strictly avoids stale Yahoo Finance .CA feeds.
 */
export async function fetchEgxStockQuote(symbol: string): Promise<MarketQuote & { resolvedSymbol: string }> {
  const clean = symbol.replace(/^EGX:/i, "").replace(/\.CA$/i, "").trim().toUpperCase();
  if (!clean) throw new Error("رمز سهم البورصة المصرية غير صالح.");

  // 1. Primary: Mubasher Info Egypt
  try {
    const list = await fetchMubasherEgxPrices();
    const match = list.find((item) => item.code.trim().toUpperCase() === clean);
    if (match && Number(match.value) > 0) {
      const priceNum = Number(match.value);
      // Parse updatedAt (format: "2026-09-17 11:29:53")
      const parsedTime = match.updatedAt
        ? new Date(match.updatedAt.replace(" ", "T")).getTime()
        : Date.now();
      const asOf = Number.isFinite(parsedTime) && parsedTime > 0 ? parsedTime : Date.now();
      const changePercent = parseFloat(match.changePercentage?.replace("%", "") || "0") || 0;

      return {
        price: priceNum.toFixed(8),
        currency: "EGP",
        asOf,
        source: "مباشر مصر (Mubasher EGX)",
        quoteStatus: "delayed",
        resolvedSymbol: match.code,
        changePercent,
        arabicName: match.name,
      };
    }
  } catch (err) {
    // Continue to TradingView fallback
  }

  // 2. Secondary Fallback: TradingView Egypt Scanner
  try {
    const tv = await fetchTradingViewEgxScan(clean);
    if (tv && tv.price > 0) {
      return {
        price: tv.price.toFixed(8),
        currency: "EGP",
        asOf: Date.now(),
        source: "TradingView (EGX)",
        quoteStatus: "delayed",
        resolvedSymbol: clean,
        changePercent: tv.changePercent,
        arabicName: tv.description,
      };
    }
  } catch {}

  throw new Error(`تعذر العثور على أحدث سعر للسهم ${clean} من مزودي البورصة المصرية (مباشر مصر / TradingView).`);
}

/**
 * Enhanced live quote fetcher supporting Egyptian Exchange (EGX) tickers,
 * benchmark index symbols (EGX30, EGX33, EGX70), and global equities.
 */
export async function fetchEgxOrYahooQuote(
  symbol: string,
  instrumentCurrency = "EGP",
  client: YahooQuoteClient = new YahooFinance()
): Promise<MarketQuote & { resolvedSymbol: string }> {
  const normalizedSymbol = symbol.trim().toUpperCase();
  if (!normalizedSymbol) throw new Error("رمز الأداة الاستثمارية غير صالح.");

  // 1. Benchmark index matching
  if (BENCHMARK_SYMBOLS[normalizedSymbol]) {
    // For EGX30 & EGX70, try TradingView Egypt first
    if (normalizedSymbol === "EGX30" || normalizedSymbol === "^CASE30") {
      const tv = await fetchTradingViewEgxScan("EGX30");
      if (tv && tv.price > 0) {
        return {
          price: tv.price.toFixed(8),
          currency: "EGP",
          asOf: Date.now(),
          source: "TradingView (EGX30)",
          quoteStatus: "delayed",
          resolvedSymbol: "EGX:EGX30",
          changePercent: tv.changePercent,
        };
      }
    } else if (normalizedSymbol === "EGX70" || normalizedSymbol === "^EGX70EWI.CA") {
      const tv = await fetchTradingViewEgxScan("EGX70EWI");
      if (tv && tv.price > 0) {
        return {
          price: tv.price.toFixed(8),
          currency: "EGP",
          asOf: Date.now(),
          source: "TradingView (EGX70 EWI)",
          quoteStatus: "delayed",
          resolvedSymbol: "EGX:EGX70EWI",
          changePercent: tv.changePercent,
        };
      }
    }

    const bmk = BENCHMARK_SYMBOLS[normalizedSymbol];
    const raw = await client.quote(bmk.yahooSymbol);
    const norm = normalizeYahooQuote(raw, bmk.currency);
    return { ...norm, resolvedSymbol: bmk.yahooSymbol };
  }

  // 2. Egyptian Pound (EGP) instruments: ALWAYS use direct Egyptian Exchange feeds (Mubasher/TradingView)
  if (instrumentCurrency === "EGP") {
    return await fetchEgxStockQuote(normalizedSymbol);
  }

  // 3. Foreign currency equities / ETFs: Yahoo Finance
  const raw = await client.quote(normalizedSymbol);
  const norm = normalizeYahooQuote(raw, instrumentCurrency);
  return { ...norm, resolvedSymbol: normalizedSymbol };
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


