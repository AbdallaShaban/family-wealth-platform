import { describe, expect, it } from "vitest";
import Decimal from "decimal.js";
import {
  MODEL_VERSION,
  createMulberry32,
  boxMuller,
  choleskyDecomposition,
  multiplyMatrixVector,
  DEFAULT_CORRELATION_MATRIX,
  PREDEFINED_MACRO_SCENARIOS,
  ASSET_CLASS_ORDER,
  DEFAULT_INSTITUTIONAL_PRIORS,
  LIQUIDITY_HAIRCUT_RANGES,
  INDICATIVE_LIQUIDITY_HORIZONS,
  runParametricMacroStress,
  runMonteCarloSimulation,
  computeSimulationFingerprint,
  calculateMonteCarloVaR,
  calculateParametricVaR,
  calculatePortfolioParametricVaR,
  calculateLiquidityLadder,
  type StressedPortfolioInput,
  type LiquidAssetItem,
  type LiquidityObligationsInput,
} from "./stressTestingMath";

describe("PHASE 11 — Stress Testing & Monte Carlo Mathematical Engine", () => {
  // ==========================================================================
  // 1. DETERMINISTIC PRNG & BOX-MULLER TESTS
  // ==========================================================================
  describe("Deterministic PRNG (Mulberry32) & Box-Muller", () => {
    it("produces bit-for-bit identical pseudo-random numbers given identical seeds", () => {
      const prng1 = createMulberry32(421337);
      const prng2 = createMulberry32(421337);

      const seq1 = Array.from({ length: 100 }, () => prng1());
      const seq2 = Array.from({ length: 100 }, () => prng2());

      expect(seq1).toEqual(seq2);
      expect(seq1[0]).toBeGreaterThanOrEqual(0);
      expect(seq1[0]).toBeLessThan(1);
    });

    it("produces distinct sequences when initialized with different seeds", () => {
      const prngA = createMulberry32(11111);
      const prngB = createMulberry32(99999);

      const valA = prngA();
      const valB = prngB();

      expect(valA).not.toBe(valB);
    });

    it("generates standard normal distribution with mean approx 0 and std approx 1 via Box-Muller", () => {
      const prng = createMulberry32(777);
      const sampleSize = 10000;
      let sum = 0;
      let sumSq = 0;

      for (let i = 0; i < sampleSize / 2; i++) {
        const [z1, z2] = boxMuller(prng);
        sum += z1 + z2;
        sumSq += z1 * z1 + z2 * z2;
      }

      const mean = sum / sampleSize;
      const variance = sumSq / sampleSize - mean * mean;

      // Mean should be within [-0.05, 0.05], Variance should be within [0.90, 1.10]
      expect(mean).toBeGreaterThan(-0.05);
      expect(mean).toBeLessThan(0.05);
      expect(variance).toBeGreaterThan(0.9);
      expect(variance).toBeLessThan(1.1);
    });
  });

  // ==========================================================================
  // 2. CHOLESKY DECOMPOSITION & CORRELATION COUPLING
  // ==========================================================================
  describe("Cholesky Decomposition & Correlation Coupling", () => {
    it("decomposes symmetric positive-definite correlation matrix such that L * L^T = R", () => {
      const R = DEFAULT_CORRELATION_MATRIX;
      const n = R.length;
      const L = choleskyDecomposition(R);

      // Verify L is lower-triangular (L[i][j] === 0 for j > i)
      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          expect(L[i][j]).toBe(0);
        }
      }

      // Verify L * L^T approximately equals R
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          let reconstructed = 0;
          for (let k = 0; k < n; k++) {
            reconstructed += L[i][k] * L[j][k];
          }
          expect(Math.abs(reconstructed - R[i][j])).toBeLessThan(1e-4);
        }
      }
    });

    it("multiplies lower-triangular matrix by standard normal vector correctly", () => {
      const L = [
        [1.0, 0.0],
        [0.5, 0.866],
      ];
      const z = [2.0, 1.0];
      const eps = multiplyMatrixVector(L, z);

      expect(eps[0]).toBeCloseTo(2.0, 4);
      expect(eps[1]).toBeCloseTo(0.5 * 2.0 + 0.866 * 1.0, 4);
    });
  });

  // ==========================================================================
  // 3. PARAMETRIC MACRO STRESS TESTING TESTS
  // ==========================================================================
  describe("Parametric Macro Stress Testing", () => {
    const mockPortfolio: StressedPortfolioInput = {
      baseCurrency: "SAR",
      totalWealthBase: "10000000.00",
      asOf: Date.now(),
      allocations: [
        {
          assetClass: "equity",
          nameAr: "الأسهم العامة",
          valueBase: "4000000.00",
          weight: "0.40",
          quoteCount: 150,
          confidence: "HIGH",
        },
        {
          assetClass: "real_estate",
          nameAr: "العقارات",
          valueBase: "3000000.00",
          weight: "0.30",
          quoteCount: 2,
          confidence: "MEDIUM",
        },
        {
          assetClass: "fixed_income",
          nameAr: "الصكوك والسندات",
          valueBase: "1500000.00",
          weight: "0.15",
          quoteCount: 25,
          confidence: "MEDIUM",
        },
        {
          assetClass: "gold_alternatives",
          nameAr: "الذهب والمعادن",
          valueBase: "500000.00",
          weight: "0.05",
          quoteCount: 400,
          confidence: "HIGH",
        },
        {
          assetClass: "cash",
          nameAr: "النقد والودائع",
          valueBase: "1000000.00",
          weight: "0.10",
          quoteCount: 0,
          confidence: "HIGH",
        },
      ],
    };

    it("applies 2008-inspired macro shock accurately across asset allocations", () => {
      const scenario = PREDEFINED_MACRO_SCENARIOS.gfc_2008_inspired;
      const res = runParametricMacroStress(mockPortfolio, scenario);

      expect(res.scenarioType).toBe("gfc_2008_inspired");
      expect(res.preShockTotalWealthBase).toBe("10000000.0000");

      // Equity: 4M * (1 - 0.45) = 2.2M (Loss: 1.8M)
      // Real Estate: 3M * (1 - 0.25) = 2.25M (Loss: 0.75M)
      // Fixed Income: 1.5M * (1 - 0.05) = 1.425M (Loss: 0.075M)
      // Gold: 0.5M * (1 + 0.15) = 0.575M (Gain: 0.075M, Loss: -0.075M)
      // Cash: 1M * 1.0 = 1.0M (Loss: 0)
      // Expected Post Shock: 2.2 + 2.25 + 1.425 + 0.575 + 1.0 = 7.45M
      // Total Loss: 10M - 7.45M = 2.55M (25.5%)

      expect(res.postShockTotalWealthBase).toBe("7450000.0000");
      expect(res.totalLossBase).toBe("2550000.0000");
      expect(res.totalLossPct).toBe("0.2550");
      expect(res.epistemicDisclaimer).toContain("Tier C: Model Assumptions");
    });

    it("conserves value invariant: preShock = postShock + totalLoss", () => {
      const scenario = PREDEFINED_MACRO_SCENARIOS.stagflation_1970_inspired;
      const res = runParametricMacroStress(mockPortfolio, scenario);

      const pre = new Decimal(res.preShockTotalWealthBase);
      const post = new Decimal(res.postShockTotalWealthBase);
      const loss = new Decimal(res.totalLossBase);

      expect(pre.toFixed(4)).toBe(post.plus(loss).toFixed(4));
    });

    it("handles currency devaluation 30% scenario correctly", () => {
      const scenario = PREDEFINED_MACRO_SCENARIOS.devaluation_30pct;
      const res = runParametricMacroStress(mockPortfolio, scenario);

      expect(res.scenarioType).toBe("devaluation_30pct");
      expect(new Decimal(res.totalLossBase).toNumber()).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // 4. MULTI-ASSET MONTE CARLO DETERMINISTIC INVARIANT TESTS
  // ==========================================================================
  describe("Multi-Asset Monte Carlo Simulation", () => {
    const testPortfolio: StressedPortfolioInput = {
      baseCurrency: "SAR",
      totalWealthBase: "5000000.00",
      asOf: Date.now(),
      allocations: [
        { assetClass: "equity", nameAr: "أسهم", valueBase: "3000000.00", weight: "0.60", quoteCount: 100, confidence: "HIGH" },
        { assetClass: "fixed_income", nameAr: "سندات", valueBase: "1000000.00", weight: "0.20", quoteCount: 50, confidence: "HIGH" },
        { assetClass: "cash", nameAr: "نقد", valueBase: "1000000.00", weight: "0.20", quoteCount: 0, confidence: "HIGH" },
      ],
      annualLivingExpenseBase: "200000.00",
    };

    it("guarantees bit-for-bit exact reproducibility with identical seed, assumptions, and model version", () => {
      const run1 = runMonteCarloSimulation(testPortfolio, {
        horizonYears: 10,
        iterations: 500,
        seed: 888444,
        spendingAnnualBase: "200000.00",
      });

      const run2 = runMonteCarloSimulation(testPortfolio, {
        horizonYears: 10,
        iterations: 500,
        seed: 888444,
        spendingAnnualBase: "200000.00",
      });

      expect(MODEL_VERSION).toBe("mc-v1.0.0");
      expect(run1.modelVersion).toBe("mc-v1.0.0");
      expect(run1.seed).toBe(run2.seed);
      expect(run1.medianTerminalWealthBase).toBe(run2.medianTerminalWealthBase);
      expect(run1.ruinProbability).toBe(run2.ruinProbability);
      expect(run1.capitalPreservationProbability).toBe(run2.capitalPreservationProbability);
      expect(run1.percentileCone).toEqual(run2.percentileCone);
    });

    it("produces strictly monotonic percentiles: p10 <= p25 <= p50 <= p75 <= p90 at all time steps", () => {
      const res = runMonteCarloSimulation(testPortfolio, {
        horizonYears: 5,
        iterations: 300,
        seed: 12345,
      });

      for (const pt of res.percentileCone) {
        const p10 = parseFloat(pt.p10);
        const p25 = parseFloat(pt.p25);
        const p50 = parseFloat(pt.p50);
        const p75 = parseFloat(pt.p75);
        const p90 = parseFloat(pt.p90);

        expect(p10).toBeLessThanOrEqual(p25);
        expect(p25).toBeLessThanOrEqual(p50);
        expect(p50).toBeLessThanOrEqual(p75);
        expect(p75).toBeLessThanOrEqual(p90);
      }
    });

    it("calculates zero ruin probability under zero spending with positive expected returns", () => {
      const res = runMonteCarloSimulation(testPortfolio, {
        horizonYears: 10,
        iterations: 200,
        seed: 42,
        spendingAnnualBase: "0",
      });

      expect(parseFloat(res.ruinProbability)).toBe(0);
      expect(parseFloat(res.capitalPreservationProbability)).toBeGreaterThan(0.7);
    });

    it("calculates high ruin probability under extreme spending exceeding portfolio capacity", () => {
      const res = runMonteCarloSimulation(testPortfolio, {
        horizonYears: 10,
        iterations: 200,
        seed: 42,
        spendingAnnualBase: "2000000.00", // 40% annual spending rate!
      });

      expect(parseFloat(res.ruinProbability)).toBeGreaterThan(0.9);
    });

    it("handles zero or negative wealth boundary condition safely", () => {
      const zeroPortfolio: StressedPortfolioInput = {
        baseCurrency: "SAR",
        totalWealthBase: "0.00",
        asOf: Date.now(),
        allocations: [],
      };

      const res = runMonteCarloSimulation(zeroPortfolio, {
        horizonYears: 10,
        iterations: 100,
        seed: 1,
      });

      expect(res.initialWealthBase).toBe("0.0000");
      expect(res.ruinProbability).toBe("1.0000");
    });

    it("verifies deterministic reproducibility fingerprint contract across material inputs", () => {
      const run1 = runMonteCarloSimulation(testPortfolio, {
        horizonYears: 5,
        iterations: 200,
        seed: 777111,
        spendingAnnualBase: "150000.00",
      });

      const run2 = runMonteCarloSimulation(testPortfolio, {
        horizonYears: 5,
        iterations: 200,
        seed: 777111,
        spendingAnnualBase: "150000.00",
      });

      expect(run1.deterministicFingerprint).toBeDefined();
      expect(run1.deterministicFingerprint).toHaveLength(64); // SHA-256 hex string
      expect(run1.deterministicFingerprint).toBe(run2.deterministicFingerprint);

      // Mutating seed must change fingerprint
      const runDifferentSeed = runMonteCarloSimulation(testPortfolio, {
        horizonYears: 5,
        iterations: 200,
        seed: 999222,
        spendingAnnualBase: "150000.00",
      });
      expect(runDifferentSeed.deterministicFingerprint).not.toBe(run1.deterministicFingerprint);

      // Mutating spending must change fingerprint
      const runDifferentSpending = runMonteCarloSimulation(testPortfolio, {
        horizonYears: 5,
        iterations: 200,
        seed: 777111,
        spendingAnnualBase: "250000.00",
      });
      expect(runDifferentSpending.deterministicFingerprint).not.toBe(run1.deterministicFingerprint);

      // Mutating iterations must change fingerprint
      const runDifferentIter = runMonteCarloSimulation(testPortfolio, {
        horizonYears: 5,
        iterations: 300,
        seed: 777111,
        spendingAnnualBase: "150000.00",
      });
      expect(runDifferentIter.deterministicFingerprint).not.toBe(run1.deterministicFingerprint);
    });
  });

  // ==========================================================================
  // 5. VALUE AT RISK (VaR) & CONDITIONAL VaR (CVaR) TESTS
  // ==========================================================================
  describe("Value at Risk (VaR) and CVaR", () => {
    it("computes Monte Carlo VaR where VaR 99% >= VaR 95% and CVaR >= VaR", () => {
      // Create synthetic sample of 1000 simulated monthly returns with negative tail
      const returns: number[] = [];
      const prng = createMulberry32(555);
      for (let i = 0; i < 1000; i++) {
        const [z] = boxMuller(prng);
        returns.push(0.005 + 0.05 * z); // mean 0.5%, std 5%
      }

      const initialWealth = new Decimal("10000000.00");

      const var95 = calculateMonteCarloVaR(returns, 0.95, "1m", initialWealth);
      const var99 = calculateMonteCarloVaR(returns, 0.99, "1m", initialWealth);

      const v95 = parseFloat(var95.varPct);
      const v99 = parseFloat(var99.varPct);
      const cv95 = parseFloat(var95.cvarPct);
      const cv99 = parseFloat(var99.cvarPct);

      // Invariant 1: 99% VaR must be at least as severe as 95% VaR
      expect(v99).toBeGreaterThanOrEqual(v95);

      // Invariant 2: CVaR (Expected Shortfall) must be at least as severe as VaR
      expect(cv95).toBeGreaterThanOrEqual(v95);
      expect(cv99).toBeGreaterThanOrEqual(v99);

      // Invariant 3: Base currency loss must equal percentage loss * initial wealth
      expect(new Decimal(var95.varBase).toFixed(2)).toBe(initialWealth.times(v95).toFixed(2));
      expect(new Decimal(var99.varBase).toFixed(2)).toBe(initialWealth.times(v99).toFixed(2));
    });
    it("computes Monte Carlo VaR with explicit random variables (R_1m, R_1y) gross of spending and positive loss sign convention", () => {
      // Simulate returns with negative tail
      const returns: number[] = [];
      const prng = createMulberry32(555);
      for (let i = 0; i < 1000; i++) {
        const [z] = boxMuller(prng);
        returns.push(0.005 + 0.05 * z); // mean 0.5%, std 5%
      }

      const initialWealth = new Decimal("10000000.00");

      const var95 = calculateMonteCarloVaR(returns, 0.95, "1m", initialWealth);
      const var99 = calculateMonteCarloVaR(returns, 0.99, "1m", initialWealth);

      const v95 = parseFloat(var95.varPct);
      const v99 = parseFloat(var99.varPct);
      const cv95 = parseFloat(var95.cvarPct);
      const cv99 = parseFloat(var99.cvarPct);

      // Positive loss convention (L >= 0)
      expect(v95).toBeGreaterThanOrEqual(0);
      expect(v99).toBeGreaterThanOrEqual(0);

      // Invariant 1: 99% VaR must be at least as severe as 95% VaR
      expect(v99).toBeGreaterThanOrEqual(v95);

      // Invariant 2: CVaR (Expected Shortfall) must be at least as severe as VaR
      expect(cv95).toBeGreaterThanOrEqual(v95);
      expect(cv99).toBeGreaterThanOrEqual(v99);

      // Invariant 3: Base currency loss must equal percentage loss * initial wealth
      expect(new Decimal(var95.varBase).toFixed(2)).toBe(initialWealth.times(v95).toFixed(2));
      expect(new Decimal(var99.varBase).toFixed(2)).toBe(initialWealth.times(v99).toFixed(2));
    });

    it("evaluates analytical Gaussian Parametric VaR with explicit t=1/12 (monthly) and t=1.0 (annual), Z95 and Z99", () => {
      const initialWealth = new Decimal("5000000.00");
      const muAnnual = 0.08;
      const sigmaAnnual = 0.18;

      // 1-Month Parametric VaR (t = 1/12)
      const param1m95 = calculateParametricVaR(muAnnual, sigmaAnnual, initialWealth, "1m", 0.95);
      const param1m99 = calculateParametricVaR(muAnnual, sigmaAnnual, initialWealth, "1m", 0.99);

      expect(param1m95.t).toBeCloseTo(1.0 / 12.0, 5);
      expect(param1m95.zScore).toBeCloseTo(1.64485, 4);
      expect(param1m99.zScore).toBeCloseTo(2.32635, 4);

      // Strictly positive loss convention
      expect(parseFloat(param1m95.varPct)).toBeGreaterThan(0);
      expect(parseFloat(param1m99.varPct)).toBeGreaterThan(parseFloat(param1m95.varPct));
      expect(parseFloat(param1m95.varBase)).toBe(parseFloat(initialWealth.times(param1m95.varPct).toFixed(4)));

      // 1-Year Parametric VaR (t = 1.0)
      const param1y95 = calculateParametricVaR(muAnnual, sigmaAnnual, initialWealth, "1y", 0.95);
      const param1y99 = calculateParametricVaR(muAnnual, sigmaAnnual, initialWealth, "1y", 0.99);

      expect(param1y95.t).toBe(1.0);
      expect(parseFloat(param1y99.varPct)).toBeGreaterThan(parseFloat(param1y95.varPct));
      expect(parseFloat(param1y95.varBase)).toBe(parseFloat(initialWealth.times(param1y95.varPct).toFixed(4)));
    });

    it("evaluates portfolio-aggregated Parametric VaR cross-check correctly", () => {
      const weights = [0.6, 0.2, 0.0, 0.0, 0.2]; // equity, fixed_income, real_estate, gold, cash
      const mu = [0.08, 0.045, 0.06, 0.05, 0.03];
      const sigma = [0.18, 0.065, 0.12, 0.16, 0.01];
      const initialWealth = new Decimal("10000000.00");

      const report = calculatePortfolioParametricVaR(
        weights,
        mu,
        sigma,
        DEFAULT_CORRELATION_MATRIX,
        initialWealth
      );

      expect(parseFloat(report.portfolioMuAnnual)).toBeGreaterThan(0.04);
      expect(parseFloat(report.portfolioSigmaAnnual)).toBeGreaterThan(0.08);

      // Monotonicity checks
      expect(parseFloat(report.oneMonthVaR99.varPct)).toBeGreaterThan(parseFloat(report.oneMonthVaR95.varPct));
      expect(parseFloat(report.oneYearVaR99.varPct)).toBeGreaterThan(parseFloat(report.oneYearVaR95.varPct));
      expect(parseFloat(report.oneYearVaR95.varPct)).toBeGreaterThan(parseFloat(report.oneMonthVaR95.varPct));
    });
  });

  // ==========================================================================
  // 5B. LIQUIDITY ASSUMPTIONS & CRISIS SCENARIO LABELING AUDIT TESTS
  // ==========================================================================
  describe("Epistemic Liquidity Assumptions & Parametric Macro Crisis Labeling", () => {
    it("confirms liquidity haircut defaults conform strictly to approved ranges (Tier 2: 5%-15%, Tier 3: 25%-40%)", () => {
      const t2Default = parseFloat(LIQUIDITY_HAIRCUT_RANGES.tier2.default);
      const t2Min = parseFloat(LIQUIDITY_HAIRCUT_RANGES.tier2.min);
      const t2Max = parseFloat(LIQUIDITY_HAIRCUT_RANGES.tier2.max);

      expect(t2Default).toBeGreaterThanOrEqual(0.05);
      expect(t2Default).toBeLessThanOrEqual(0.15);
      expect(t2Min).toBe(0.05);
      expect(t2Max).toBe(0.15);

      const t3Default = parseFloat(LIQUIDITY_HAIRCUT_RANGES.tier3.default);
      const t3Min = parseFloat(LIQUIDITY_HAIRCUT_RANGES.tier3.min);
      const t3Max = parseFloat(LIQUIDITY_HAIRCUT_RANGES.tier3.max);

      expect(t3Default).toBeGreaterThanOrEqual(0.25);
      expect(t3Default).toBeLessThanOrEqual(0.40);
      expect(t3Min).toBe(0.25);
      expect(t3Max).toBe(0.40);
    });

    it("verifies all five predefined stress scenarios are explicitly labeled as Parametric Macro Stress Scenarios", () => {
      const scenarios = Object.values(PREDEFINED_MACRO_SCENARIOS);
      expect(scenarios).toHaveLength(5);

      for (const sc of scenarios) {
        expect(sc.nameAr).toContain("سيناريو ضغط ماكرو بارامتري");
        expect(sc.nameAr).toContain("Parametric Macro Stress Scenario");
        expect(sc.descriptionAr).toContain("افتراض نموذجي وليس إعادة تشغيل تاريخية");
        expect(sc.governanceClass).toBe("SYSTEM_DEFAULT");
      }
    });

    it("validates Indicative Stress Liquidity Horizon governance labels and explicit model assumption disclaimers", () => {
      expect(INDICATIVE_LIQUIDITY_HORIZONS.governanceLabel).toBe(
        "Indicative Stress Liquidity Horizon — Model Assumption"
      );
      expect(INDICATIVE_LIQUIDITY_HORIZONS.governanceDisclaimerAr).toContain(
        "افتراضات نموذجية استرشادية"
      );
      expect(INDICATIVE_LIQUIDITY_HORIZONS.governanceDisclaimerAr).toContain(
        "ليست رصداً سوقياً واقعياً، ولا تمثل وقتاً مضموناً للتسييل، ولا اتفاقية مستوى خدمة (SLA)"
      );
      expect(INDICATIVE_LIQUIDITY_HORIZONS.tier1.indicativeHorizonAr).toContain("فوري");
      expect(INDICATIVE_LIQUIDITY_HORIZONS.tier2.indicativeHorizonAr).toContain("1–5 أيام عمل");
      expect(INDICATIVE_LIQUIDITY_HORIZONS.tier3.indicativeHorizonAr).toContain("90–365 يوماً");
    });
  });

  // ==========================================================================
  // 6. LIQUIDITY STRESS LADDER TESTS
  // ==========================================================================
  describe("Liquidity Stress Ladder & Runway", () => {
    const assets: LiquidAssetItem[] = [
      {
        id: "acc-1",
        nameAr: "حساب جاري الراجحي",
        tier: "tier1_immediate",
        assetClass: "cash",
        bookValueBase: "600000.00",
        haircutPct: "0.00",
        stressedValueBase: "600000.00",
        epistemicStatus: "AUTHORITATIVE_FACT",
      },
      {
        id: "pos-1",
        nameAr: "أسهم أرامكو",
        tier: "tier2_marketable",
        assetClass: "equity",
        bookValueBase: "1000000.00",
        haircutPct: "0.10",
        stressedValueBase: "900000.00", // 10% haircut
        epistemicStatus: "MODEL_ASSUMPTION",
      },
      {
        id: "pos-2",
        nameAr: "سبائك ذهب",
        tier: "tier2_marketable",
        assetClass: "gold_alternatives",
        bookValueBase: "500000.00",
        haircutPct: "0.05",
        stressedValueBase: "475000.00", // 5% haircut
        epistemicStatus: "MODEL_ASSUMPTION",
      },
      {
        id: "prop-1",
        nameAr: "عمارة تجارية",
        tier: "tier3_illiquid",
        assetClass: "real_estate",
        bookValueBase: "4000000.00",
        haircutPct: "0.30",
        stressedValueBase: "2800000.00", // 30% distressed haircut
        epistemicStatus: "MODEL_ASSUMPTION",
      },
    ];

    const obligations: LiquidityObligationsInput = {
      monthlyDebtServiceBase: "30000.00",
      monthlyInsurancePremiumsBase: "10000.00",
      monthlyEssentialLivingExpenseBase: "60000.00",
    };

    it("evaluates liquidity tiers and runway accurately under 100% income loss", () => {
      // Total monthly outflow = 30k + 10k + 60k = 100k
      // Under 100% income loss, net monthly burn = 100k
      // Tier 1 cash = 600k => Runway T1 = 600k / 100k = 6 months
      // Tier 1 + Tier 2 = 600k + (900k + 475k) = 1,975,000 => Runway T2 = 1975k / 100k = 19 months
      // Total Stressed Liquidity = 1975k + 2800k = 4,775,000 => Runway Total = 47 months

      const res = calculateLiquidityLadder(assets, obligations, 100, "50000.00");

      expect(res.contractualMonthlyOutflowBase).toBe("100000.0000");
      expect(res.stressedMonthlyRevenueBase).toBe("0.0000");
      expect(res.netMonthlyBurnBase).toBe("100000.0000");
      expect(res.monthsOfRunwayTier1).toBe(6);
      expect(res.monthsOfRunwayTier2).toBe(19);
      expect(res.monthsOfRunwayTotal).toBe(47);
      expect(res.isDeficit).toBe(true); // Tier 1 runway < 12 months triggers deficit warning
      expect(res.haircutAssumptionsDisclaimer).toContain("Tier C: Model Assumptions");
    });

    it("handles sustainable scenario with zero net burn without error", () => {
      // If revenues of 150k exceed outflows of 100k even after 20% haircut:
      // Stressed revenue = 150k * 0.8 = 120k. Outflow = 100k. Net burn = -20k (surplus)
      const res = calculateLiquidityLadder(assets, obligations, 20, "150000.00");

      expect(parseFloat(res.netMonthlyBurnBase)).toBeLessThanOrEqual(0);
      expect(res.monthsOfRunwayTier1).toBeNull();
      expect(res.isDeficit).toBe(false);
    });

    it("evaluates liquidity with partial revenue haircut accurately", () => {
      // Outflows = 100k. Revenue = 80k with 50% haircut => Stressed revenue = 40k. Net burn = 60k
      // Tier 1 cash = 600k => Runway T1 = 600k / 60k = 10 months (< 12 => deficit true)
      const res = calculateLiquidityLadder(assets, obligations, 50, "80000.00");

      expect(res.contractualMonthlyOutflowBase).toBe("100000.0000");
      expect(res.stressedMonthlyRevenueBase).toBe("40000.0000");
      expect(res.netMonthlyBurnBase).toBe("60000.0000");
      expect(res.monthsOfRunwayTier1).toBe(10);
      expect(res.isDeficit).toBe(true);
    });

    it("handles zero cash accounts gracefully without dividing by zero", () => {
      const zeroCashAssets: LiquidAssetItem[] = [
        {
          id: "pos-1",
          nameAr: "أسهم",
          tier: "tier2_marketable",
          assetClass: "equity",
          bookValueBase: "100000.00",
          haircutPct: "0.10",
          stressedValueBase: "90000.00",
          epistemicStatus: "MODEL_ASSUMPTION",
        },
      ];
      const res = calculateLiquidityLadder(zeroCashAssets, obligations, 100, "0.00");

      expect(res.tier1ImmediateCashBase).toBe("0.0000");
      expect(res.monthsOfRunwayTier1).toBe(0);
      expect(res.isDeficit).toBe(true);
    });
  });

  // ==========================================================================
  // 7. EDGE CASES & BOUNDARY CONDITION TESTS
  // ==========================================================================
  describe("Edge Cases, Boundaries & Confidence Propagation", () => {
    it("handles 50-year long horizon simulation stably without NaN or Infinity", () => {
      const testPortfolio: StressedPortfolioInput = {
        baseCurrency: "SAR",
        totalWealthBase: "2000000.00",
        asOf: Date.now(),
        allocations: [
          { assetClass: "equity", nameAr: "أسهم", valueBase: "1000000.00", weight: "0.50", quoteCount: 100, confidence: "HIGH" },
          { assetClass: "cash", nameAr: "نقد", valueBase: "1000000.00", weight: "0.50", quoteCount: 0, confidence: "HIGH" },
        ],
      };

      const res = runMonteCarloSimulation(testPortfolio, {
        horizonYears: 50,
        iterations: 150,
        seed: 9999,
        spendingAnnualBase: "50000.00",
      });

      expect(res.horizonYears).toBe(50);
      expect(res.percentileCone.length).toBeGreaterThanOrEqual(50);
      const lastPoint = res.percentileCone[res.percentileCone.length - 1];
      expect(Number.isFinite(parseFloat(lastPoint.p50))).toBe(true);
      expect(Number.isFinite(parseFloat(lastPoint.p10))).toBe(true);
      expect(Number.isFinite(parseFloat(lastPoint.p90))).toBe(true);
    });

    it("triggers governance warning when portfolio has low-confidence or unquoted assets", () => {
      const lowConfidencePortfolio: StressedPortfolioInput = {
        baseCurrency: "SAR",
        totalWealthBase: "5000000.00",
        asOf: Date.now(),
        allocations: [
          { assetClass: "real_estate", nameAr: "عقار غير مقيم", valueBase: "4000000.00", weight: "0.80", quoteCount: 0, confidence: "LOW" },
          { assetClass: "cash", nameAr: "نقد", valueBase: "1000000.00", weight: "0.20", quoteCount: 0, confidence: "HIGH" },
        ],
      };

      const res = runMonteCarloSimulation(lowConfidencePortfolio, {
        horizonYears: 10,
        iterations: 100,
        seed: 42,
      });

      expect(res.confidenceWarning).toBeDefined();
      expect(res.confidenceWarning).toContain("تنبيه حوكمة");
    });

    it("handles zero volatility edge case in Parametric VaR correctly", () => {
      const initialWealth = new Decimal("1000000.00");
      // If volatility is 0 and return is positive, VaR is 0 (no loss)
      const paramVaR = calculateParametricVaR(0.05, 0.0, initialWealth, 30);
      expect(paramVaR.varPct).toBe("0.0000");
      expect(paramVaR.varBase).toBe("0.0000");
    });

    it("handles custom parametric macro shock overrides accurately", () => {
      const portfolio: StressedPortfolioInput = {
        baseCurrency: "USD",
        totalWealthBase: "1000000.00",
        asOf: Date.now(),
        allocations: [
          { assetClass: "equity", nameAr: "Equities", valueBase: "600000.00", weight: "0.60", quoteCount: 50, confidence: "HIGH" },
          { assetClass: "gold_alternatives", nameAr: "Gold", valueBase: "400000.00", weight: "0.40", quoteCount: 50, confidence: "HIGH" },
        ],
      };

      const customScenario = {
        type: "custom" as const,
        nameAr: "صدمة مخصصة",
        descriptionAr: "اختبار مخصص",
        governanceClass: "USER_CUSTOM" as const,
        provenanceBasis: "مدخل من المستخدم",
        shocks: {
          equityShockPct: "-0.5000", // 50% drop
          realEstateShockPct: "0.0000",
          fixedIncomeShockPct: "0.0000",
          goldShockPct: "0.2000", // 20% gain
          cashShockPct: "0.0000",
          inflationShockBps: 0,
          rateShockBps: 0,
        },
      };

      const res = runParametricMacroStress(portfolio, customScenario);

      // Equity: 600k * (1 - 0.5) = 300k
      // Gold: 400k * (1 + 0.2) = 480k
      // Total post shock: 780k. Total loss: 220k (22%)
      expect(res.postShockTotalWealthBase).toBe("780000.0000");
      expect(res.totalLossBase).toBe("220000.0000");
      expect(res.totalLossPct).toBe("0.2200");
      expect(res.governanceClass).toBe("USER_CUSTOM");
    });

    it("calculates independent 1-month (t=1/12) and 1-year (t=1) Parametric VaR directly with drift", () => {
      const initialWealth = new Decimal("1000000.00");
      const mu = 0.08;
      const sigma = 0.20;

      // Direct calculation using exact formula: max(0, Z * sigma * sqrt(t) - mu * t)
      const var1m = calculateParametricVaR(mu, sigma, initialWealth, "1m", 0.95);
      const var1y = calculateParametricVaR(mu, sigma, initialWealth, "1y", 0.95);

      const v1m = parseFloat(var1m.varPct);
      const v1y = parseFloat(var1y.varPct);

      // Verify horizons and t values are independent
      expect(var1m.t).toBeCloseTo(1 / 12, 5);
      expect(var1y.t).toBeCloseTo(1.0, 5);

      // Verify exact formula values:
      // t = 1/12 => vol = 0.20 * sqrt(1/12) = 0.057735, drift = 0.08 * (1/12) = 0.006667
      // varPct = 1.6448536 * 0.057735 - 0.006667 = 0.094966 - 0.006667 = 0.0883
      expect(v1m).toBeCloseTo(0.0883, 2);

      // t = 1.0 => vol = 0.20 * 1 = 0.20, drift = 0.08 * 1 = 0.08
      // varPct = 1.6448536 * 0.20 - 0.08 = 0.32897 - 0.08 = 0.2490
      expect(v1y).toBeCloseTo(0.2490, 2);

      // When drift is included (mu > 0), VaR_1y / VaR_1m does NOT equal sqrt(12) (approx 3.464)
      // Positive drift dampens annual loss proportionally more than monthly loss (ratio here is ~2.82)
      expect(v1y / v1m).not.toBeCloseTo(Math.sqrt(12), 1);
      expect(v1y / v1m).toBeLessThan(Math.sqrt(12));

      // Volatility-only square-root-of-time reference; not a universal VaR scaling identity when drift is included.
      const var1mZeroDrift = calculateParametricVaR(0.0, sigma, initialWealth, "1m", 0.95);
      const var1yZeroDrift = calculateParametricVaR(0.0, sigma, initialWealth, "1y", 0.95);
      const v1mZero = parseFloat(var1mZeroDrift.varPct);
      const v1yZero = parseFloat(var1yZeroDrift.varPct);
      expect(v1yZero / v1mZero).toBeCloseTo(Math.sqrt(12), 1);
    });

    it("handles negative total wealth boundary gracefully in macro stress", () => {
      const negativePortfolio: StressedPortfolioInput = {
        baseCurrency: "SAR",
        totalWealthBase: "-50000.00",
        asOf: Date.now(),
        allocations: [],
      };

      const res = runParametricMacroStress(negativePortfolio, PREDEFINED_MACRO_SCENARIOS.gfc_2008_inspired);
      expect(res.preShockTotalWealthBase).toBe("0.0000");
      expect(res.totalLossBase).toBe("0.0000");
    });

    it("handles non-positive-definite correlation matrix by regularizing diagonal with jitter", () => {
      // Ill-conditioned matrix with collinear rows
      const nonPdMatrix = [
        [1.0, 1.0],
        [1.0, 1.0],
      ];
      const L = choleskyDecomposition(nonPdMatrix);

      expect(L.length).toBe(2);
      expect(Number.isFinite(L[0][0])).toBe(true);
      expect(Number.isFinite(L[1][1])).toBe(true);
      expect(L[0][0]).toBeGreaterThan(0);
      expect(L[1][1]).toBeGreaterThan(0);
    });

    it("verifies that different seeds generate statistically distinct Monte Carlo trajectories", () => {
      const testPortfolio: StressedPortfolioInput = {
        baseCurrency: "SAR",
        totalWealthBase: "1000000.00",
        asOf: Date.now(),
        allocations: [
          { assetClass: "equity", nameAr: "أسهم", valueBase: "600000.00", weight: "0.60", quoteCount: 100, confidence: "HIGH" },
          { assetClass: "cash", nameAr: "نقد", valueBase: "400000.00", weight: "0.40", quoteCount: 0, confidence: "HIGH" },
        ],
      };

      const runSeedA = runMonteCarloSimulation(testPortfolio, { horizonYears: 5, iterations: 200, seed: 1234 });
      const runSeedB = runMonteCarloSimulation(testPortfolio, { horizonYears: 5, iterations: 200, seed: 9876 });

      expect(runSeedA.seed).not.toBe(runSeedB.seed);
      // Different seeds should not produce identical percentiles
      expect(runSeedA.percentileCone[runSeedA.percentileCone.length - 1].p50).not.toBe(
        runSeedB.percentileCone[runSeedB.percentileCone.length - 1].p50
      );
    });

    it("simulates negative return regime correctly with asset decay", () => {
      const testPortfolio: StressedPortfolioInput = {
        baseCurrency: "USD",
        totalWealthBase: "1000000.00",
        asOf: Date.now(),
        allocations: [
          { assetClass: "equity", nameAr: "Equity", valueBase: "1000000.00", weight: "1.00", quoteCount: 50, confidence: "HIGH" },
        ],
      };

      // Force negative expected return -10% per annum
      const res = runMonteCarloSimulation(testPortfolio, {
        horizonYears: 10,
        iterations: 200,
        seed: 555,
        priorsOverride: {
          equity: { expectedReturn: "-0.1000", volatility: "0.1500" },
        },
      });

      const terminalMedian = parseFloat(res.percentileCone[res.percentileCone.length - 1].p50);
      expect(terminalMedian).toBeLessThan(1000000.0);
    });
  });
});
