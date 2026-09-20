import { describe, expect, it } from "vitest";
import {
  calculateGold24kGramEgp,
  fetchYahooFxQuote,
  fetchYahooQuote,
  isEgxTradingHours,
  isMarketDataStale,
  normalizeYahooQuote,
  resolveEgxSymbol,
  yahooFxSymbol,
  checkQuoteSanity,
} from "./marketData";

describe("market data adapter", () => {
  it("normalizes an upstream Yahoo quote conservatively as delayed", async () => {
    const quote = await fetchYahooQuote(" aapl ", {
      quote: async (symbol) => ({
        regularMarketPrice: 201.25,
        currency: "usd",
        regularMarketTime: 1_800_000_000,
      }),
    });
    expect(quote).toMatchObject({
      price: "201.25000000",
      currency: "USD",
      quoteStatus: "delayed",
      source: "Yahoo Finance via yahoo-finance2",
    });
    expect(quote.asOf).toBe(1_800_000_000_000);
  });

  it("rejects malformed upstream prices and currencies", () => {
    expect(() =>
      normalizeYahooQuote({ regularMarketPrice: 0, currency: "USD", regularMarketTime: new Date() })
    ).toThrow("سعراً سوقياً صالحاً");
    expect(() =>
      normalizeYahooQuote({ regularMarketPrice: 5, currency: "US", regularMarketTime: new Date() })
    ).toThrow("رمز عملة صالحاً");
  });

  it("builds and validates an FX symbol through Yahoo Finance", async () => {
    expect(yahooFxSymbol("eur", "usd")).toBe("EURUSD=X");
    await expect(
      fetchYahooFxQuote("EUR", "USD", {
        quote: async (symbol) => {
          expect(symbol).toBe("EURUSD=X");
          return { regularMarketPrice: 1.08, currency: "USD", regularMarketTime: 1_800_000_000 };
        },
      })
    ).resolves.toMatchObject({
      symbol: "EURUSD=X",
      price: "1.08000000",
      fromCurrency: "EUR",
      toCurrency: "USD",
    });
    expect(() => yahooFxSymbol("USD", "USD")).toThrow("زوج عملات Yahoo Finance غير صالح");
  });

  it("marks FX data older than the documented valuation window as stale", () => {
    expect(isMarketDataStale(1_800_000_000_000, 1_800_172_800_001)).toBe(true);
    expect(isMarketDataStale(1_800_000_000_000, 1_800_172_800_000)).toBe(false);
  });

  it("resolves Egyptian Exchange (EGX) symbols with .CA suffix", () => {
    expect(resolveEgxSymbol("comi")).toBe("COMI.CA");
    expect(resolveEgxSymbol("SWDY")).toBe("SWDY.CA");
    expect(resolveEgxSymbol("EAST.CA")).toBe("EAST.CA");
    expect(resolveEgxSymbol("oras.ca")).toBe("ORAS.CA");
    expect(resolveEgxSymbol("AAPL")).toBe("AAPL.CA"); // standard symbol resolution
  });

  it("evaluates Egyptian trading hours correctly (Sun-Thu 10:00 to 14:30 Cairo time)", () => {
    // A Friday in UTC (EGX closed on Friday & Saturday)
    const friday = new Date("2026-09-18T10:00:00.000Z");
    expect(isEgxTradingHours(friday)).toBe(false);

    // A Sunday at 08:30 UTC (which is 11:30 Cairo time, during active trading session)
    const sundayTrading = new Date("2026-09-20T08:30:00.000Z");
    expect(isEgxTradingHours(sundayTrading)).toBe(true);

    // A Sunday at 15:00 UTC (18:00 Cairo time, market closed)
    const sundayNight = new Date("2026-09-20T15:00:00.000Z");
    expect(isEgxTradingHours(sundayNight)).toBe(false);
  });

  it("derives spot 24K gold price per gram in EGP accurately", () => {
    // E.g., Gold ounce = $2,600, USD/EGP = 48.50
    // Price per gram USD = 2600 / 31.1034768 = ~83.5919
    // Price per gram EGP = 83.5919 * 48.50 = ~4054.21
    const result = calculateGold24kGramEgp({
      goldOunceUsd: "2600",
      usdEgpRate: "48.50",
    });
    expect(Number(result.pricePerGramEgp)).toBeGreaterThan(4000);
    expect(Number(result.pricePerGramEgp)).toBeLessThan(4100);
    expect(result.formula).toBe("([GC=F] / 31.1035) * USD/EGP");
  });

  it("checks quote sanity, detecting stale quotes (>7 days) and severe price deviation (>25%)", () => {
    const now = Date.now();
    // 1. Normal valid quote
    const normal = checkQuoteSanity(54.0, 52.0, now - 24 * 3600 * 1000);
    expect(normal.status).toBe("normal");
    expect(normal.isStaleDate).toBe(false);
    expect(normal.isDeviationWarning).toBe(false);

    // 2. Stale quote (> 7 days)
    const stale = checkQuoteSanity(54.0, 52.0, now - 10 * 24 * 3600 * 1000);
    expect(stale.status).toBe("stale_warning");
    expect(stale.isStaleDate).toBe(true);

    // 3. Severe deviation (> 25%) - e.g. 54 vs 37.89 (~42% deviation)
    const deviation = checkQuoteSanity(54.0, 37.89, now - 2 * 3600 * 1000);
    expect(deviation.status).toBe("deviation_warning");
    expect(deviation.isDeviationWarning).toBe(true);
    expect(deviation.deviationPercent).toBeGreaterThan(25);
  });
});

