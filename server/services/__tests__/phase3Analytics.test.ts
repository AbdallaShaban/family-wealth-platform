import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";
import {
  calculatePublicMarketEquivalent,
  calculatePortfolioConcentration,
  calculatePerformanceContributors,
} from "../../performanceMath";

describe("Phase 3: Advanced Investment Analytics Engine", () => {
  describe("Kaplan-Schoar Public Market Equivalent (KS-PME) & Direct Alpha", () => {
    it("correctly calculates KS-PME ratio > 1 and positive Direct Alpha when portfolio outperforms benchmark", () => {
      // Scenario:
      // Start of period: Investor has 100,000 at t0 (Benchmark = 1000)
      // Intermediate: Withdrawal/Distribution of 20,000 at t1 (Benchmark = 1100)
      // End of period: Portfolio ending value is 120,000 (Benchmark = 1200)
      //
      // Benchmark return: 1200 / 1000 = +20%
      // Start capital compounded: 100,000 * (1200 / 1000) = 120,000
      // Inflows compounded: 0
      // Total Contributions Compounded: 120,000
      // Outflows compounded: 20,000 * (1200 / 1100) = 21,818.18
      // Total Distributions Compounded: 120,000 + 21,818.18 = 141,818.18
      // KS-PME = 141,818.18 / 120,000 = 1.1818 (> 1.0 indicates outperformance)

      const benchmarkQuotes = [
        { date: 1_704_067_200_000, price: 1000 },
        { date: 1_719_792_000_000, price: 1100 },
        { date: 1_735_689_600_000, price: 1200 },
      ];

      const result = calculatePublicMarketEquivalent({
        benchmarkSymbol: "EGX30",
        startingValuation: 100_000,
        endingValuation: 120_000,
        cashFlows: [
          { date: 1_719_792_000_000, amount: -20_000 },
        ],
        benchmarkQuotes,
        periodDays: 365,
      });

      expect(result.status).toBe("available");
      expect(result.pmeRatio).not.toBeNull();
      const pmeNum = Number(result.pmeRatio);
      expect(pmeNum).toBeGreaterThan(1.0);
      expect(result.directAlphaAnnualized).not.toBeNull();
      expect(Number(result.directAlphaAnnualized)).toBeGreaterThan(0);
      expect(result.benchmarkSymbol).toBe("EGX30");
    });

    it("correctly identifies underperformance when KS-PME ratio < 1.0", () => {
      // Scenario: Portfolio ending value is lower than benchmark growth
      const benchmarkQuotes = [
        { date: 1_704_067_200_000, price: 1000 },
        { date: 1_735_689_600_000, price: 1500 }, // Benchmark +50% -> Benchmark value = 150,000
      ];

      // Portfolio started at 100,000 and ended at 110,000 (+10%)
      const result = calculatePublicMarketEquivalent({
        benchmarkSymbol: "SP500",
        startingValuation: 100_000,
        endingValuation: 110_000,
        cashFlows: [],
        benchmarkQuotes,
        periodDays: 365,
      });

      expect(result.status).toBe("available");
      expect(result.pmeRatio).not.toBeNull();
      const pmeNum = Number(result.pmeRatio);
      expect(pmeNum).toBeLessThan(1.0);
      expect(Number(result.directAlphaAnnualized)).toBeLessThan(0);
    });

    it("safely returns no_benchmark_quotes or insufficient_data when benchmark prices are missing or incomplete", () => {
      const resultMissingQuotes = calculatePublicMarketEquivalent({
        benchmarkSymbol: "EGX30",
        startingValuation: 50_000,
        endingValuation: 60_000,
        cashFlows: [],
        benchmarkQuotes: [], // No quotes
        periodDays: 365,
      });

      expect(resultMissingQuotes.status).toBe("no_benchmark_quotes");
      expect(resultMissingQuotes.pmeRatio).toBeNull();
      expect(resultMissingQuotes.directAlphaAnnualized).toBeNull();

      const resultZeroStart = calculatePublicMarketEquivalent({
        benchmarkSymbol: "EGX30",
        startingValuation: 50_000,
        endingValuation: 60_000,
        cashFlows: [],
        benchmarkQuotes: [
          { date: 1_704_067_200_000, price: 0 },
          { date: 1_735_689_600_000, price: 1200 },
        ],
        periodDays: 365,
      });

      expect(resultZeroStart.status).toBe("insufficient_data");
      expect(resultZeroStart.pmeRatio).toBeNull();
    });
  });

  describe("Portfolio Concentration Analysis (Herfindahl-Hirschman Index)", () => {
    it("reports low concentration for an evenly diversified multi-asset portfolio", () => {
      // 10 assets equally weighted at 10% each
      // HHI = 10 * (10^2) = 1000 (< 1500 = well_diversified)
      const holdings = Array.from({ length: 10 }, () => ({ marketValue: 10_000 }));

      const result = calculatePortfolioConcentration(holdings);

      expect(result.herfindahlIndex).toBe(1000);
      expect(result.diversificationStatus).toBe("well_diversified");
      expect(result.top3WeightPct).toBe("30.00");
      expect(result.top5WeightPct).toBe("50.00");
    });

    it("reports high concentration when portfolio is dominated by single stock", () => {
      // 1 dominant asset at 80,000, 2 small at 10,000 each (Total = 100,000)
      // Weights: 80%, 10%, 10%
      // HHI = 80^2 + 10^2 + 10^2 = 6400 + 100 + 100 = 6600 (> 2500 = highly_concentrated)
      const holdings = [
        { marketValue: 80_000 },
        { marketValue: 10_000 },
        { marketValue: 10_000 },
      ];

      const result = calculatePortfolioConcentration(holdings);

      expect(result.herfindahlIndex).toBe(6600);
      expect(result.diversificationStatus).toBe("highly_concentrated");
      expect(result.top3WeightPct).toBe("100.00");
    });

    it("safely handles empty portfolio with zero assets", () => {
      const result = calculatePortfolioConcentration([]);
      expect(result.herfindahlIndex).toBe(0);
      expect(result.diversificationStatus).toBe("well_diversified");
      expect(result.top3WeightPct).toBe("0.00");
    });
  });

  describe("Top Performance Contributors and Detractors", () => {
    it("correctly identifies top gainers and detractors by absolute contribution and percent", () => {
      const assets = [
        { symbol: "COMI.CA", name: "Commercial International Bank", startValue: 100_000, endValue: 140_000 }, // +40,000
        { symbol: "EKHO.CA", name: "Egypt Kuwait Holding", startValue: 50_000, endValue: 65_000 },           // +15,000
        { symbol: "EAST.CA", name: "Eastern Tobacco", startValue: 80_000, endValue: 70_000 },               // -10,000
        { symbol: "SWDY.CA", name: "Elsewedy Electric", startValue: 40_000, endValue: 30_000 },             // -10,000
        { symbol: "HRHO.CA", name: "EFG Holding", startValue: 30_000, endValue: 32_000 },                  // +2,000
      ];

      const result = calculatePerformanceContributors(assets);

      expect(result.topGainers.length).toBeGreaterThan(0);
      expect(result.topGainers[0].symbol).toBe("COMI.CA");
      expect(result.topGainers[0].contributionAmount).toBe("40000.00");

      expect(result.topDetractors.length).toBeGreaterThan(0);
      const detractorSymbols = result.topDetractors.map((d) => d.symbol);
      expect(detractorSymbols).toContain("EAST.CA");
      expect(detractorSymbols).toContain("SWDY.CA");
    });
  });
});
