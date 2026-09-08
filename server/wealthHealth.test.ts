import { describe, it, expect } from "vitest";
import Decimal from "decimal.js";
import {
  toDec,
  formatDec,
  safeDiv,
  clampDec,
  decLn,
  calculateFisherRealRate,
  calculateMonthlyRealRate,
  computePortfolioAtMonth,
  calculateLiquidityScore,
  calculateDebtSustainabilityScore,
  calculateSavingsVelocityScore,
  calculatePortfolioDiversificationScore,
  calculateResilienceProtectionScore,
  calculateFiProgressScore,
  calculateWealthHealthScore,
  deriveDataConfidence,
  calculateFireHorizon,
  generateStandardFireScenarios,
} from "./wealthHealthMath";

describe("Phase 9B: Wealth Health Math & Deterministic FIRE Engine", () => {
  // ==========================================================================
  // 1. DECIMAL PRECISION & LOGARITHM ROUTINES
  // ==========================================================================
  describe("Decimal Arithmetic & Natural Logarithm Routine", () => {
    it("preserves 40 digits of precision without IEEE-754 drift", () => {
      const a = new Decimal("0.1");
      const b = new Decimal("0.2");
      const sum = a.plus(b);
      expect(sum.toString()).toBe("0.3");
      expect(Decimal.precision).toBe(40);
    });

    it("evaluates natural logarithm with high precision", () => {
      const z = new Decimal("2.7182818284590452353602874713526624977572");
      const lnZ = decLn(z);
      // ln(e) = 1
      expect(lnZ.toFixed(10)).toBe("1.0000000000");
    });

    it("throws error for non-positive inputs in decLn", () => {
      expect(() => decLn(new Decimal(0))).toThrow("Mathematical domain error");
      expect(() => decLn(new Decimal("-5"))).toThrow("Mathematical domain error");
    });

    it("calculates exact Fisher real rate", () => {
      // Nominal: 7%, Inflation: 3%
      // Fisher: (1 + 0.07) / (1 + 0.03) - 1 = 1.07 / 1.03 - 1 = 0.03883495145631067961165...
      const rNom = new Decimal("0.07");
      const iInf = new Decimal("0.03");
      const rReal = calculateFisherRealRate(rNom, iInf);
      const expected = new Decimal("1.07").div(new Decimal("1.03")).minus(1);
      expect(rReal.toString()).toBe(expected.toString());
      expect(rReal.toFixed(6)).toBe("0.038835");
    });

    it("calculates monthly real compounding rate accurately", () => {
      // r_real = 3.883495%, rm = (1 + r_real)^(1/12) - 1
      const rReal = new Decimal("0.0388349514563106796116504854368932038835");
      const rm = calculateMonthlyRealRate(rReal);
      // (1 + rm)^12 should equal 1 + rReal
      const check = new Decimal(1).plus(rm).pow(12);
      expect(check.toFixed(20)).toBe(new Decimal(1).plus(rReal).toFixed(20));
    });
  });

  // ==========================================================================
  // 2. DIMENSION 1: LIQUIDITY & EMERGENCY RESILIENCE
  // ==========================================================================
  describe("Dimension 1: Liquidity & Emergency Resilience", () => {
    it("awards 100 points for runway >= 12 months", () => {
      const res = calculateLiquidityScore(120_000, 10_000); // 12 months
      expect(res.score.toNumber()).toBe(100);
      expect(res.status).toBe("excellent");

      const resOver = calculateLiquidityScore(200_000, 10_000); // 20 months
      expect(resOver.score.toNumber()).toBe(100);
    });

    it("scores correctly in [85, 100) for 6 <= runway < 12 months", () => {
      const res6 = calculateLiquidityScore(60_000, 10_000); // 6 months -> 85
      expect(res6.score.toNumber()).toBe(85);

      const res9 = calculateLiquidityScore(90_000, 10_000); // 9 months -> 85 + (3/6)*15 = 92.5
      expect(res9.score.toNumber()).toBe(92.5);
    });

    it("scores correctly in [50, 85) for 3 <= runway < 6 months", () => {
      const res3 = calculateLiquidityScore(30_000, 10_000); // 3 months -> 50
      expect(res3.score.toNumber()).toBe(50);

      const res4_5 = calculateLiquidityScore(45_000, 10_000); // 4.5 months -> 50 + (1.5/3)*35 = 67.5
      expect(res4_5.score.toNumber()).toBe(67.5);
    });

    it("scores correctly in [20, 50) for 1 <= runway < 3 months", () => {
      const res1 = calculateLiquidityScore(10_000, 10_000); // 1 month -> 20
      expect(res1.score.toNumber()).toBe(20);

      const res2 = calculateLiquidityScore(20_000, 10_000); // 2 months -> 20 + (1/2)*30 = 35
      expect(res2.score.toNumber()).toBe(35);
    });

    it("scores correctly in [0, 20) for runway < 1 month", () => {
      const res0_5 = calculateLiquidityScore(5_000, 10_000); // 0.5 months -> 0.5 * 20 = 10
      expect(res0_5.score.toNumber()).toBe(10);

      const res0 = calculateLiquidityScore(0, 10_000); // 0 months -> 0
      expect(res0.score.toNumber()).toBe(0);
    });

    it("handles zero essential expenses gracefully (100 pts)", () => {
      const res = calculateLiquidityScore(50_000, 0);
      expect(res.score.toNumber()).toBe(100);
      expect(res.status).toBe("excellent");
    });
  });

  // ==========================================================================
  // 3. DIMENSION 2: DEBT SUSTAINABILITY & SOLVENCY
  // ==========================================================================
  describe("Dimension 2: Debt Sustainability & Solvency", () => {
    it("handles debt-free households with 100 pts across all intervals", () => {
      const res = calculateDebtSustainabilityScore(0, 1_000_000, 0, 50_000);
      expect(res.score.toNumber()).toBe(100);
      expect(res.leverageScore.toNumber()).toBe(100);
      expect(res.dscrScore.toNumber()).toBe(100);
      expect(res.status).toBe("excellent");
    });

    it("calculates continuous leverage score S2A without undefined intervals", () => {
      // Total Assets: 1,000,000
      // L = 10% (0.10) <= 0.15: 100 - (0.10/0.15)*10 = 100 - 6.6666... = 93.3333
      const res10 = calculateDebtSustainabilityScore(100_000, 1_000_000, 0, 0);
      expect(res10.leverageScore.toFixed(2)).toBe("93.33");

      // L = 15%: 90
      const res15 = calculateDebtSustainabilityScore(150_000, 1_000_000, 0, 0);
      expect(res15.leverageScore.toNumber()).toBe(90);

      // L = 25%: 90 - (0.10/0.15)*15 = 80
      const res25 = calculateDebtSustainabilityScore(250_000, 1_000_000, 0, 0);
      expect(res25.leverageScore.toNumber()).toBe(80);

      // L = 30%: 75
      const res30 = calculateDebtSustainabilityScore(300_000, 1_000_000, 0, 0);
      expect(res30.leverageScore.toNumber()).toBe(75);

      // L = 50%: 50
      const res50 = calculateDebtSustainabilityScore(500_000, 1_000_000, 0, 0);
      expect(res50.leverageScore.toNumber()).toBe(50);

      // L = 65%: 20
      const res65 = calculateDebtSustainabilityScore(650_000, 1_000_000, 0, 0);
      expect(res65.leverageScore.toNumber()).toBe(20);

      // L = 100%: 0
      const res100 = calculateDebtSustainabilityScore(1_000_000, 1_000_000, 0, 0);
      expect(res100.leverageScore.toNumber()).toBe(0);

      // L > 100%: 0
      const res120 = calculateDebtSustainabilityScore(1_200_000, 1_000_000, 0, 0);
      expect(res120.leverageScore.toNumber()).toBe(0);
    });

    it("calculates continuous DSCR score S2B across all intervals", () => {
      // DS = 20,000
      // DSCR >= 3.0 (OCF = 60,000) -> 100
      const res3 = calculateDebtSustainabilityScore(0, 1_000_000, 20_000, 60_000);
      expect(res3.dscrScore.toNumber()).toBe(100);

      // DSCR = 2.5 (OCF = 50,000) -> 80 + (0.5/1.0)*20 = 90
      const res2_5 = calculateDebtSustainabilityScore(0, 1_000_000, 20_000, 50_000);
      expect(res2_5.dscrScore.toNumber()).toBe(90);

      // DSCR = 1.6 (OCF = 32,000) -> 50 + (0.4/0.8)*30 = 65
      const res1_6 = calculateDebtSustainabilityScore(0, 1_000_000, 20_000, 32_000);
      expect(res1_6.dscrScore.toNumber()).toBe(65);

      // DSCR = 1.1 (OCF = 22,000) -> 25 + (0.1/0.2)*25 = 37.5
      const res1_1 = calculateDebtSustainabilityScore(0, 1_000_000, 20_000, 22_000);
      expect(res1_1.dscrScore.toNumber()).toBe(37.5);

      // DSCR = 0.5 (OCF = 10,000) -> 0.5 * 25 = 12.5
      const res0_5 = calculateDebtSustainabilityScore(0, 1_000_000, 20_000, 10_000);
      expect(res0_5.dscrScore.toNumber()).toBe(12.5);

      // OCF <= 0 -> 0
      const resNeg = calculateDebtSustainabilityScore(0, 1_000_000, 20_000, -5_000);
      expect(resNeg.dscrScore.toNumber()).toBe(0);
    });

    it("evaluates insolvent state (economic assets <= 0 with debt > 0) as 0 pts", () => {
      const res = calculateDebtSustainabilityScore(50_000, 0, 10_000, 10_000);
      expect(res.leverageScore.toNumber()).toBe(0);
    });
  });

  // ==========================================================================
  // 4. DIMENSION 3: SAVINGS VELOCITY & CAPITAL ACCUMULATION
  // ==========================================================================
  describe("Dimension 3: Savings Velocity & Capital Accumulation", () => {
    it("calculates operating savings rate and authoritative FI contribution", () => {
      // Inflows: 120,000
      // Expenses: 72,000 (includes interest, fees, taxes)
      // Debt principal paid: 12,000
      // Operating Savings Rate: (120,000 - 72,000) / 120,000 = 48,000 / 120,000 = 40%
      // Net wealth accumulation: 48,000
      // Monthly FI contribution C: (48,000 - 12,000) / 12 = 3,000
      const res = calculateSavingsVelocityScore(120_000, 72_000, 12_000);
      expect(res.operatingSavingsRate.toNumber()).toBe(0.40);
      expect(res.netWealthAccumulation.toNumber()).toBe(48_000);
      expect(res.monthlyFiContribution.toNumber()).toBe(3_000);
      expect(res.score.toNumber()).toBe(100);
      expect(res.status).toBe("exceptional");
    });

    it("confirms debt principal repayments do NOT decrease operating savings rate but DO reduce liquid contribution C", () => {
      const withPrincipal = calculateSavingsVelocityScore(100_000, 60_000, 20_000);
      const withoutPrincipal = calculateSavingsVelocityScore(100_000, 60_000, 0);

      // Both build equity from living 40% below means
      expect(withPrincipal.operatingSavingsRate.toString()).toBe(withoutPrincipal.operatingSavingsRate.toString());
      expect(withPrincipal.score.toString()).toBe(withoutPrincipal.score.toString());

      // But liquid cash available to contribute to investable assets differs:
      // With: (40,000 - 20,000)/12 = 1,666.6667
      // Without: 40,000/12 = 3,333.3333
      expect(withPrincipal.monthlyFiContribution.lt(withoutPrincipal.monthlyFiContribution)).toBe(true);
    });

    it("evaluates savings rate scoring tiers accurately", () => {
      // Rate = 30%: 80 + ((0.30 - 0.25)/0.15) * 20 = 80 + 6.6666 = 86.67
      const res30 = calculateSavingsVelocityScore(100_000, 70_000, 0);
      expect(res30.score.toFixed(2)).toBe("86.67");

      // Rate = 15%: 50 + ((0.15 - 0.10)/0.15) * 30 = 50 + 10 = 60
      const res15 = calculateSavingsVelocityScore(100_000, 85_000, 0);
      expect(res15.score.toNumber()).toBe(60);

      // Rate = 5%: 20 + (0.05 / 0.10) * 30 = 35
      const res5 = calculateSavingsVelocityScore(100_000, 95_000, 0);
      expect(res5.score.toNumber()).toBe(35);
    });

    it("penalizes deficit spending (rate < 0)", () => {
      // Inflow: 100,000, Outflow: 120,000 -> Rate = -20% (-0.20)
      // Score: max(0, 20 - 50 * 0.20) = 10
      const resDeficit = calculateSavingsVelocityScore(100_000, 120_000, 0);
      expect(resDeficit.score.toNumber()).toBe(10);
      expect(resDeficit.status).toBe("deficit");

      // Rate = -50%: max(0, 20 - 25) = 0
      const resDeepDeficit = calculateSavingsVelocityScore(100_000, 150_000, 0);
      expect(resDeepDeficit.score.toNumber()).toBe(0);
    });

    it("handles zero or non-positive operating inflows deterministically", () => {
      // Inflow = 0, Expenses = 0 -> Dormant (50 pts)
      const resDormant = calculateSavingsVelocityScore(0, 0, 0);
      expect(resDormant.score.toNumber()).toBe(50);

      // Inflow = 0, Expenses > 0 -> Unfunded consumption (0 pts)
      const resUnfunded = calculateSavingsVelocityScore(0, 30_000, 0);
      expect(resUnfunded.score.toNumber()).toBe(0);
    });
  });

  // ==========================================================================
  // 5. DIMENSION 4: PORTFOLIO DIVERSIFICATION & ASSET MAPPING
  // ==========================================================================
  describe("Dimension 4: Portfolio Diversification & Asset Mapping", () => {
    it("maps 5 asset classes, computes HHI and top holding concentration", () => {
      // Total Assets: 1,000,000
      // Cash: 200,000 (20%), Equity: 350,000 (35%), FI: 250,000 (25%), Alt (Gold): 150,000 (15%), Other: 50,000 (5%)
      // HHI = 0.20^2 + 0.35^2 + 0.25^2 + 0.15^2 + 0.05^2 = 0.04 + 0.1225 + 0.0625 + 0.0225 + 0.0025 = 0.25
      // Top holding: "Apple ETF" = 100,000 (10%) < 15%
      // HHI <= 0.30 AND h_max < 15% -> 100 pts
      const res = calculatePortfolioDiversificationScore(
        {
          cash: 200_000,
          equity: 350_000,
          fixed_income: 250_000,
          alternatives: 150_000,
          other: 50_000,
        },
        [
          { name: "Apple ETF", value: 100_000 },
          { name: "Treasury Sukuk", value: 90_000 },
          { name: "Gold Coins", value: 80_000 },
        ]
      );
      expect(res.hhi.toFixed(2)).toBe("0.25");
      expect(res.topHoldingWeight.toFixed(2)).toBe("0.10");
      expect(res.score.toNumber()).toBe(100);
      expect(res.status).toBe("well_diversified");
    });

    it("penalizes extreme single-instrument concentration (>= 75% -> 10 pts)", () => {
      const res = calculatePortfolioDiversificationScore(
        {
          cash: 100_000,
          equity: 900_000,
          fixed_income: 0,
          alternatives: 0,
          other: 0,
        },
        [{ name: "Single Tech Stock", value: 800_000 }] // 80%
      );
      expect(res.topHoldingWeight.toNumber()).toBe(0.80);
      expect(res.score.toNumber()).toBe(10);
      expect(res.status).toBe("highly_concentrated");
    });

    it("assigns 25 pts for HHI > 0.65 or top holding >= 40%", () => {
      const res = calculatePortfolioDiversificationScore(
        {
          cash: 500_000,
          equity: 500_000,
          fixed_income: 0,
          alternatives: 0,
          other: 0,
        },
        [{ name: "Cash Account", value: 450_000 }] // 45%
      );
      expect(res.score.toNumber()).toBe(25);
    });
  });

  // ==========================================================================
  // 6. DIMENSION 5: RESILIENCE & PROTECTION
  // ==========================================================================
  describe("Dimension 5: Resilience & Protection", () => {
    it("awards full 100 pts for fresh valuations and comprehensive insurance", () => {
      const res = calculateResilienceProtectionScore({
        totalEconomicAssets: 1_000_000,
        freshAssetValue: 980_000, // 98% >= 95% -> 100 pts
        hasActiveHealthPolicy: true, // 35 pts
        activeLifeCoverageAmount: 200_000, // covers debt 150_000 -> 35 pts
        totalDebtPrincipal: 150_000,
        hasPhysicalRealEstateOrMotor: true,
        hasActivePropertyOrMotorPolicy: true, // 30 pts
      });

      expect(res.subScore5A.toNumber()).toBe(100);
      expect(res.subScore5B.toNumber()).toBe(100);
      expect(res.score.toNumber()).toBe(100);
      expect(res.status).toBe("fully_protected");
    });

    it("automatically awards life insurance points to debt-free households", () => {
      const res = calculateResilienceProtectionScore({
        totalEconomicAssets: 500_000,
        freshAssetValue: 500_000,
        hasActiveHealthPolicy: false,
        activeLifeCoverageAmount: 0,
        totalDebtPrincipal: 0, // Debt-free!
        hasPhysicalRealEstateOrMotor: false, // No physical real estate or motor!
        hasActivePropertyOrMotorPolicy: false,
      });

      // Life points: 35 (automatic)
      // Property points: 30 (automatic)
      // Health points: 0
      expect(res.lifePoints.toNumber()).toBe(35);
      expect(res.propertyPoints.toNumber()).toBe(30);
      expect(res.subScore5B.toNumber()).toBe(65);
    });

    it("penalizes stale asset valuations according to asset-specific threshold policies", () => {
      // 50% fresh assets -> < 60% fresh -> (0.50 / 0.60) * 50 = 41.67
      const res = calculateResilienceProtectionScore({
        totalEconomicAssets: 1_000_000,
        freshAssetValue: 500_000,
        hasActiveHealthPolicy: true,
        activeLifeCoverageAmount: 0,
        totalDebtPrincipal: 0,
        hasPhysicalRealEstateOrMotor: false,
        hasActivePropertyOrMotorPolicy: false,
      });

      expect(res.subScore5A.toFixed(2)).toBe("41.67");
    });
  });

  // ==========================================================================
  // 7. DIMENSION 6: FI PROGRESS (ACTUAL BASELINE)
  // ==========================================================================
  describe("Dimension 6: FI Progress (Actual Baseline)", () => {
    it("calculates FI progress ratio against actual TTM living expenses at 4.0% SWR", () => {
      // S_actual: 100,000
      // K_FI = 100,000 / 0.04 = 2,500,000
      // Investable Assets: 2,500,000 -> Ratio = 1.0 -> 100 pts
      const resFull = calculateFiProgressScore(2_500_000, 100_000, "0.04");
      expect(resFull.kFiBaseline.toNumber()).toBe(2_500_000);
      expect(resFull.fiProgressRatio.toNumber()).toBe(1.0);
      expect(resFull.score.toNumber()).toBe(100);
      expect(resFull.status).toBe("achieved");

      // Investable Assets: 2,000,000 (80%) -> 85 + ((0.80 - 0.75)/0.25)*15 = 88
      const res80 = calculateFiProgressScore(2_000_000, 100_000, "0.04");
      expect(res80.fiProgressRatio.toNumber()).toBe(0.80);
      expect(res80.score.toNumber()).toBe(88);
      expect(res80.status).toBe("near_fi");

      // Investable Assets: 1,500,000 (60%) -> 70 + ((0.60 - 0.50)/0.25)*15 = 76
      const res60 = calculateFiProgressScore(1_500_000, 100_000, "0.04");
      expect(res60.score.toNumber()).toBe(76);

      // Investable Assets: 750,000 (30%) -> 45 + ((0.30 - 0.25)/0.25)*25 = 50
      const res30 = calculateFiProgressScore(750_000, 100_000, "0.04");
      expect(res30.score.toNumber()).toBe(50);

      // Investable Assets: 250,000 (10%) -> max(10, 180 * 0.10) = 18
      const res10 = calculateFiProgressScore(250_000, 100_000, "0.04");
      expect(res10.score.toNumber()).toBe(18);
    });

    it("verifies primary residence is excluded from investable FI capital", () => {
      // Total assets: 2,000,000 (including 1,000,000 primary residence)
      // Investable assets = 1,000,000 (liquid cash + securities)
      // Spending: 80,000 -> K_FI = 2,000,000
      // Progress ratio must be based strictly on 1,000,000 (50%), not 2,000,000 (100%)
      const res = calculateFiProgressScore(1_000_000, 80_000, "0.04");
      expect(res.fiProgressRatio.toNumber()).toBe(0.50);
      expect(res.status).toBe("halfway");
    });
  });

  // ==========================================================================
  // 8. OVERALL WEALTH HEALTH SCORE & DATA CONFIDENCE
  // ==========================================================================
  describe("Overall Wealth Health Score & Data Confidence", () => {
    it("calculates exact weighted total score across all 6 dimensions", () => {
      const d1 = calculateLiquidityScore(120_000, 10_000); // 100 (w: 0.20 -> 20)
      const d2 = calculateDebtSustainabilityScore(0, 1_000_000, 0, 50_000); // 100 (w: 0.20 -> 20)
      const d3 = calculateSavingsVelocityScore(120_000, 72_000, 0); // 100 (w: 0.20 -> 20)
      const d4 = calculatePortfolioDiversificationScore(
        { cash: 200_000, equity: 350_000, fixed_income: 250_000, alternatives: 150_000, other: 50_000 },
        [{ name: "ETF", value: 100_000 }]
      ); // 100 (w: 0.15 -> 15)
      const d5 = calculateResilienceProtectionScore({
        totalEconomicAssets: 1_000_000,
        freshAssetValue: 1_000_000,
        hasActiveHealthPolicy: true,
        activeLifeCoverageAmount: 100_000,
        totalDebtPrincipal: 0,
        hasPhysicalRealEstateOrMotor: false,
        hasActivePropertyOrMotorPolicy: false,
      }); // 100 (w: 0.10 -> 10)
      const d6 = calculateFiProgressScore(2_500_000, 100_000, "0.04"); // 100 (w: 0.15 -> 15)

      const confidence = deriveDataConfidence({
        historyMonths: 18,
        totalAccounts: 10,
        reconciledOrActiveAccounts: 10,
        totalExpenseVolume: 100_000,
        categorizedExpenseVolume: 95_000,
        freshAssetValue: 1_000_000,
        totalEconomicAssets: 1_000_000,
        unvaluedForeignCurrenciesCount: 0,
      });

      expect(confidence.level).toBe("high");

      const pkg = calculateWealthHealthScore(d1, d2, d3, d4, d5, d6, confidence);
      expect(pkg.totalScore.toNumber()).toBe(100);
      expect(pkg.ratingTier).toBe("excellent");
      expect(pkg.ratingTierLabelAr).toContain("ممتاز");
    });

    it("evaluates confidence decision tree: <6 months or missing data forces LOW", () => {
      const confShort = deriveDataConfidence({
        historyMonths: 4, // < 6 months
        totalAccounts: 10,
        reconciledOrActiveAccounts: 10,
        totalExpenseVolume: 100_000,
        categorizedExpenseVolume: 100_000,
        freshAssetValue: 1_000_000,
        totalEconomicAssets: 1_000_000,
        unvaluedForeignCurrenciesCount: 0,
      });
      expect(confShort.level).toBe("low");
      expect(confShort.warningsAr.length).toBeGreaterThan(0);

      const confUnvaluedFx = deriveDataConfidence({
        historyMonths: 24,
        totalAccounts: 10,
        reconciledOrActiveAccounts: 10,
        totalExpenseVolume: 100_000,
        categorizedExpenseVolume: 100_000,
        freshAssetValue: 1_000_000,
        totalEconomicAssets: 1_000_000,
        unvaluedForeignCurrenciesCount: 1, // Unvalued FX!
      });
      expect(confUnvaluedFx.level).toBe("low");
    });
  });

  // ==========================================================================
  // 9. COMPLETE FI/FIRE HORIZON STATE MATRIX & MATHEMATICAL DOMAIN
  // ==========================================================================
  describe("FI/FIRE Horizon Engine: Complete State Matrix", () => {
    // State 1: FI Already Achieved (A0 >= KFI)
    it("State 1: Achieved (A0 >= KFI) returns m* = 0 regardless of rates", () => {
      const res = calculateFireHorizon({
        investableAssets: 3_000_000,
        annualSpending: 100_000,
        swr: "0.04", // KFI = 2,500,000
        nominalReturn: "0.07",
        inflation: "0.03",
        monthlyContribution: "5000",
      });
      expect(res.status).toBe("achieved");
      expect(res.horizonMonths).toBe(0);
      expect(res.isReachable).toBe(true);
      expect(res.verifiedExact).toBe(true);
    });

    // State 2: Zero Real Growth (r_real == 0)
    it("State 2A: r_real = 0 and C > 0 returns exact linear integer months", () => {
      // A0 = 100,000, KFI = 250,000, Gap = 150,000
      // Nominal: 3%, Inflation: 3% -> r_real = 0
      // Monthly contribution C = 10,000 -> m = 150,000 / 10,000 = 15 months
      const res = calculateFireHorizon({
        investableAssets: 100_000,
        annualSpending: 10_000,
        swr: "0.04", // KFI = 250,000
        nominalReturn: "0.03",
        inflation: "0.03",
        monthlyContribution: 10_000,
      });
      expect(res.status).toBe("reachable_linear");
      expect(res.horizonMonths).toBe(15);
      expect(res.isReachable).toBe(true);
      expect(res.verifiedExact).toBe(true);
    });

    it("State 2B: r_real = 0 and C <= 0 is unreachable", () => {
      const res = calculateFireHorizon({
        investableAssets: 100_000,
        annualSpending: 10_000,
        swr: "0.04", // KFI = 250,000
        nominalReturn: "0.03",
        inflation: "0.03",
        monthlyContribution: 0,
      });
      expect(res.status).toBe("unreachable_zero_growth");
      expect(res.isReachable).toBe(false);
      expect(res.horizonMonths).toBeNull();
    });

    // State 3: Positive Real Growth (r_real > 0)
    it("State 3A: r_real > 0 and C > 0 returns exact compounding horizon verified with Decimal math", () => {
      // A0 = 500,000, Spending = 120,000, SWR = 0.04 -> KFI = 3,000,000
      // Nominal: 7%, Inflation: 3%
      // C = 10,000
      const res = calculateFireHorizon({
        investableAssets: 500_000,
        annualSpending: 120_000,
        swr: "0.04",
        nominalReturn: "0.07",
        inflation: "0.03",
        monthlyContribution: 10_000,
      });
      expect(res.status).toBe("reachable_compounding");
      expect(res.isReachable).toBe(true);
      expect(res.horizonMonths).toBeGreaterThan(0);
      expect(res.verifiedExact).toBe(true);

      // Verify A(m*) >= KFI and A(m* - 1) < KFI
      const m = res.horizonMonths!;
      const AtM = computePortfolioAtMonth(
        new Decimal(500_000),
        new Decimal(10_000),
        res.monthlyRealRate,
        m
      );
      const AtPrior = computePortfolioAtMonth(
        new Decimal(500_000),
        new Decimal(10_000),
        res.monthlyRealRate,
        m - 1
      );
      expect(AtM.gte(res.targetCorpus)).toBe(true);
      expect(AtPrior.lt(res.targetCorpus)).toBe(true);
    });

    it("State 3B: r_real > 0 and C = 0 returns pure compounding horizon", () => {
      // A0 = 1,000,000, KFI = 2,000,000
      // Nominal: 8%, Inflation: 2%
      // C = 0
      const res = calculateFireHorizon({
        investableAssets: 1_000_000,
        annualSpending: 80_000,
        swr: "0.04", // KFI = 2,000,000
        nominalReturn: "0.08",
        inflation: "0.02",
        monthlyContribution: 0,
      });
      expect(res.status).toBe("reachable_compounding");
      expect(res.isReachable).toBe(true);
      expect(res.horizonMonths).toBeGreaterThan(0);
      expect(res.verifiedExact).toBe(true);
    });

    it("State 3C.1: r_real > 0 and C < 0 with A0 <= A_inf is unreachable (depletion)", () => {
      // Nominal: 7%, Inflation: 3% -> rReal ~ 3.88%, rm ~ 0.318%
      // C = -5,000 -> A_inf = |-5000| / rm ~ 1,570,000
      // A0 = 500,000 <= A_inf -> Portfolio returns (500k * 0.318% = 1,590) < 5,000 withdrawals
      // Monotonically depleting!
      const res = calculateFireHorizon({
        investableAssets: 500_000,
        annualSpending: 100_000,
        swr: "0.04", // KFI = 2,500,000
        nominalReturn: "0.07",
        inflation: "0.03",
        monthlyContribution: -5_000,
      });
      expect(res.status).toBe("unreachable_positive_return_negative_contribution");
      expect(res.isReachable).toBe(false);
      expect(res.horizonMonths).toBeNull();
    });

    it("State 3C.2: r_real > 0 and C < 0 with A0 > A_inf is reachable (returns outpace withdrawals)", () => {
      // If A0 = 2,000,000 > A_inf ~ 1,570,000
      // Returns ~ 6,360 > 5,000 withdrawals -> Net growth!
      // KFI = 2,500,000 > A0 > A_inf
      const res = calculateFireHorizon({
        investableAssets: 2_000_000,
        annualSpending: 100_000,
        swr: "0.04", // KFI = 2,500,000
        nominalReturn: "0.07",
        inflation: "0.03",
        monthlyContribution: -5_000,
      });
      expect(res.status).toBe("reachable_compounding");
      expect(res.isReachable).toBe(true);
      expect(res.horizonMonths).toBeGreaterThan(0);
      expect(res.verifiedExact).toBe(true);

      const m = res.horizonMonths!;
      const AtM = computePortfolioAtMonth(
        new Decimal(2_000_000),
        new Decimal(-5_000),
        res.monthlyRealRate,
        m
      );
      const AtPrior = computePortfolioAtMonth(
        new Decimal(2_000_000),
        new Decimal(-5_000),
        res.monthlyRealRate,
        m - 1
      );
      expect(AtM.gte(res.targetCorpus)).toBe(true);
      expect(AtPrior.lt(res.targetCorpus)).toBe(true);
    });

    // State 4: Negative Real Growth (r_real < 0)
    it("State 4A: r_real < 0 and C <= 0 is unreachable deficit", () => {
      // Nominal: 2%, Inflation: 5% -> r_real < 0
      const res = calculateFireHorizon({
        investableAssets: 500_000,
        annualSpending: 100_000,
        swr: "0.04",
        nominalReturn: "0.02",
        inflation: "0.05",
        monthlyContribution: -1_000,
      });
      expect(res.status).toBe("unreachable_deficit");
      expect(res.isReachable).toBe(false);
    });

    it("State 4B: r_real < 0 and C > 0 with KFI >= C / |rm| is unreachable due to asymptotic bound", () => {
      // Inflation: 6%, Nominal: 2% -> rReal ~ -3.77%, rm ~ -0.319%
      // C = 5,000 -> Asymptotic ceiling A_inf = 5,000 / 0.00319 ~ 1,567,000
      // Target KFI = 2,500,000 > A_inf -> Mathematically impossible to reach!
      const res = calculateFireHorizon({
        investableAssets: 100_000,
        annualSpending: 100_000,
        swr: "0.04", // KFI = 2,500,000
        nominalReturn: "0.02",
        inflation: "0.06",
        monthlyContribution: 5_000,
      });
      expect(res.status).toBe("unreachable_negative_real_return");
      expect(res.isReachable).toBe(false);
      expect(res.horizonMonths).toBeNull();
    });

    it("State 4C: r_real < 0 and C > 0 with KFI < C / |rm| is reachable (surplus outpaces decay)", () => {
      // Large monthly savings surplus C = 50,000
      // A_inf = 50,000 / 0.00319 ~ 15,670,000
      // Target KFI = 1,000,000 < A_inf
      const res = calculateFireHorizon({
        investableAssets: 100_000,
        annualSpending: 40_000,
        swr: "0.04", // KFI = 1,000,000
        nominalReturn: "0.02",
        inflation: "0.06",
        monthlyContribution: 50_000,
      });
      expect(res.status).toBe("reachable_decay_overcome");
      expect(res.isReachable).toBe(true);
      expect(res.horizonMonths).toBeGreaterThan(0);
      expect(res.verifiedExact).toBe(true);
    });
  });

  // ==========================================================================
  // 10. THREE STANDARD SCENARIOS GENERATION
  // ==========================================================================
  describe("Three Standard Scenarios Generation", () => {
    it("generates conservative, base, and optimistic scenarios with distinct parameters", () => {
      const scenarios = generateStandardFireScenarios({
        investableAssets: 500_000,
        ttmActualLivingExpenses: 120_000,
        ttmEssentialLivingExpenses: 80_000,
        monthlyContribution: 8_000,
      });

      // 1. Conservative: Nom 4.5%, Inf 4.0%, SWR 3.25%, Spending +10%
      expect(scenarios.conservative.nominalReturn.toNumber()).toBe(0.045);
      expect(scenarios.conservative.inflation.toNumber()).toBe(0.040);
      expect(scenarios.conservative.swr.toNumber()).toBe(0.0325);
      expect(scenarios.conservative.annualSpending.toNumber()).toBe(132_000);

      // 2. Base Case: Nom 7.0%, Inf 3.0%, SWR 4.0%, Spending Actual
      expect(scenarios.base.nominalReturn.toNumber()).toBe(0.070);
      expect(scenarios.base.inflation.toNumber()).toBe(0.030);
      expect(scenarios.base.swr.toNumber()).toBe(0.040);
      expect(scenarios.base.annualSpending.toNumber()).toBe(120_000);

      // 3. Optimistic: Nom 9.5%, Inf 2.5%, SWR 4.5%, Spending Essential
      expect(scenarios.optimistic.nominalReturn.toNumber()).toBe(0.095);
      expect(scenarios.optimistic.inflation.toNumber()).toBe(0.025);
      expect(scenarios.optimistic.swr.toNumber()).toBe(0.045);
      expect(scenarios.optimistic.annualSpending.toNumber()).toBe(80_000);

      // Horizons should be ordered: Optimistic <= Base <= Conservative
      if (
        scenarios.optimistic.horizonResult.horizonMonths !== null &&
        scenarios.base.horizonResult.horizonMonths !== null &&
        scenarios.conservative.horizonResult.horizonMonths !== null
      ) {
        expect(scenarios.optimistic.horizonResult.horizonMonths).toBeLessThanOrEqual(
          scenarios.base.horizonResult.horizonMonths
        );
        expect(scenarios.base.horizonResult.horizonMonths).toBeLessThanOrEqual(
          scenarios.conservative.horizonResult.horizonMonths
        );
      }
    });
  });
});
