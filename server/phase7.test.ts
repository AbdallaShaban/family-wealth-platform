import { describe, expect, it } from "vitest";
import { isMarketDataStale, normalizeYahooQuote } from "./marketData";
import { suggestGoldRevaluation } from "./goldQuoteMath";

describe("Phase 7 gold and market valuation contracts", () => {
  it("converts grams into a troy-ounce market value with Decimal precision", () => {
    expect(suggestGoldRevaluation({ quantity: "62.2069536", unit: "جرام", quotePerTroyOunce: "2000" })).toMatchObject({
      suggestedTargetValue: "4000.000000",
      normalizedUnit: "gram",
    });
  });

  it("rejects unsupported commodity units instead of guessing a conversion", () => {
    expect(() => suggestGoldRevaluation({ quantity: "1", unit: "kilogram", quotePerTroyOunce: "2000" })).toThrow("وحدة الذهب");
  });

  it("normalizes a Yahoo quote into an auditable delayed market datum", () => {
    const quote = normalizeYahooQuote({ regularMarketPrice: 2365.125, currency: "usd", regularMarketTime: 1_700_000_000, marketState: "REGULAR" });
    expect(quote).toEqual({ price: "2365.12500000", currency: "USD", asOf: 1_700_000_000_000, source: "Yahoo Finance via yahoo-finance2", quoteStatus: "delayed" });
  });

  it("marks missing and old as-of timestamps stale", () => {
    const now = 1_800_000_000_000;
    expect(isMarketDataStale(null, now)).toBe(true);
    expect(isMarketDataStale(now - 48 * 60 * 60 * 1000 - 1, now)).toBe(true);
    expect(isMarketDataStale(now - 60 * 60 * 1000, now)).toBe(false);
  });
});
