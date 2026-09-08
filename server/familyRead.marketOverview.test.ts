import { describe, expect, it } from "vitest";
import { classifyMarketOverviewOwnership, marketOverviewQuoteStatus } from "./familyRead";

describe("dashboard market overview helpers", () => {
  it("deduplicates a held instrument that is also explicitly watched into one ownership label", () => {
    expect(classifyMarketOverviewOwnership(true, true)).toBe("owned_and_watching");
    expect(classifyMarketOverviewOwnership(true, false)).toBe("owned");
    expect(classifyMarketOverviewOwnership(false, true)).toBe("watching");
  });

  it("keeps an unavailable quote explicit and converts expired snapshots to stale", () => {
    expect(marketOverviewQuoteStatus(undefined)).toBe("unavailable");
    expect(marketOverviewQuoteStatus({ quoteStatus: "delayed", asOf: Date.now() - 72 * 60 * 60 * 1000 })).toBe("stale");
    expect(marketOverviewQuoteStatus({ quoteStatus: "delayed", asOf: Date.now() })).toBe("delayed");
  });
});
