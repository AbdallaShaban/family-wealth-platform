import { describe, expect, it, vi } from "vitest";
import { deriveGoldAndSovereignPrices, getLiveGoldAndFxRates } from "../goldFxLiveFeedService";

describe("Gold & FX Live Feed Service & Math Derivations", () => {
  it("accurately derives 24k, 21k, 18k, Sovereign, and Nisab prices from 24k spot price", () => {
    const gold24k = 4800.0;
    const goldOunceUsd = 2700.0;
    const usdEgp = 49.50;
    const eurEgp = 53.40;
    const asOf = 1759160000000;

    const result = deriveGoldAndSovereignPrices(
      gold24k,
      goldOunceUsd,
      usdEgp,
      eurEgp,
      "Test Feed",
      asOf,
      true,
      false
    );

    expect(result.karat24).toBe(4800.0);
    // 21k = 4800 * 21 / 24 = 4200
    expect(result.karat21).toBe(4200.0);
    // 18k = 4800 * 18 / 24 = 3600
    expect(result.karat18).toBe(3600.0);
    // Sovereign = 8 * 4200 = 33600
    expect(result.sovereignEgp).toBe(33600.0);
    // Nisab = 85 * 4800 = 408000
    expect(result.nisab85gEgp).toBe(408000.0);
    expect(result.usdEgpRate).toBe(49.5);
    expect(result.eurEgpRate).toBe(53.4);
    expect(result.isLive).toBe(true);
    expect(result.isFallback).toBe(false);
    expect(result.lastUpdatedFormattedAr).toBeDefined();
  });

  it("handles graceful fallback when external network feed is unreachable", async () => {
    const mockFailingClient: any = {
      quote: vi.fn().mockRejectedValue(new Error("Network timeout")),
    };

    const result = await getLiveGoldAndFxRates(true, mockFailingClient);

    expect(result).toBeDefined();
    expect(result.karat24).toBeGreaterThan(1000);
    expect(result.karat21).toBeGreaterThan(1000);
    expect(result.karat18).toBeGreaterThan(1000);
    expect(result.sovereignEgp).toBeGreaterThan(10000);
    expect(result.nisab85gEgp).toBeGreaterThan(100000);
    expect(result.usdEgpRate).toBeGreaterThan(30);
    expect(result.eurEgpRate).toBeGreaterThan(30);
    expect(result.isFallback).toBe(true);
  });
});
