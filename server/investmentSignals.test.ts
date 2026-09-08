import { describe, expect, it } from "vitest";
import { buildMarketSignals } from "./investmentSignals";

const NOW = 1_800_000_000_000;

describe("investment signal reviews", () => {
  it("flags a material drawdown for review without describing an executable order", () => {
    const signals = buildMarketSignals([{ instrumentId: 4, instrumentName: "صندوق نمو", symbol: "GROW", currency: "USD", averageCost: "100", marketPrice: "88", quoteAsOf: NOW, quoteStatus: "delayed" }], NOW);
    expect(signals[0]).toMatchObject({ kind: "accumulate_review", percentFromCost: "-12.00", actionPath: "/trades" });
    expect(signals[0]?.detail).toContain("قبل أي قرار");
  });

  it("prioritizes stale data ahead of price-performance interpretation", () => {
    const signals = buildMarketSignals([{ instrumentId: 7, instrumentName: "ذهب", symbol: "GC=F", currency: "USD", averageCost: "100", marketPrice: "160", quoteAsOf: NOW - 49 * 60 * 60 * 1000, quoteStatus: "delayed" }], NOW);
    expect(signals).toHaveLength(1);
    expect(signals[0]).toMatchObject({ kind: "stale_quote", percentFromCost: null, actionPath: "/research/prices" });
  });
});
