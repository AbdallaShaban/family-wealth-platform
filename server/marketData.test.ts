import { describe, expect, it } from "vitest";
import { fetchYahooFxQuote, fetchYahooQuote, isMarketDataStale, normalizeYahooQuote, yahooFxSymbol } from "./marketData";

describe("market data adapter", () => {
  it("normalizes an upstream Yahoo quote conservatively as delayed", async () => {
    const quote = await fetchYahooQuote(" aapl ", { quote: async symbol => ({ regularMarketPrice: 201.25, currency: "usd", regularMarketTime: 1_800_000_000 }) });
    expect(quote).toMatchObject({ price: "201.25000000", currency: "USD", quoteStatus: "delayed", source: "Yahoo Finance via yahoo-finance2" });
    expect(quote.asOf).toBe(1_800_000_000_000);
  });

  it("rejects malformed upstream prices and currencies", () => {
    expect(() => normalizeYahooQuote({ regularMarketPrice: 0, currency: "USD", regularMarketTime: new Date() })).toThrow("سعراً سوقياً صالحاً");
    expect(() => normalizeYahooQuote({ regularMarketPrice: 5, currency: "US", regularMarketTime: new Date() })).toThrow("رمز عملة صالحاً");
  });

  it("builds and validates an FX symbol through Yahoo Finance", async () => {
    expect(yahooFxSymbol("eur", "usd")).toBe("EURUSD=X");
    await expect(fetchYahooFxQuote("EUR", "USD", { quote: async symbol => {
      expect(symbol).toBe("EURUSD=X");
      return { regularMarketPrice: 1.08, currency: "USD", regularMarketTime: 1_800_000_000 };
    } })).resolves.toMatchObject({ symbol: "EURUSD=X", price: "1.08000000", fromCurrency: "EUR", toCurrency: "USD" });
    expect(() => yahooFxSymbol("USD", "USD")).toThrow("زوج عملات Yahoo Finance غير صالح");
  });

  it("marks FX data older than the documented valuation window as stale", () => {
    expect(isMarketDataStale(1_800_000_000_000, 1_800_172_800_001)).toBe(true);
    expect(isMarketDataStale(1_800_000_000_000, 1_800_172_800_000)).toBe(false);
  });
});
