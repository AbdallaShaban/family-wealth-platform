import crypto from "node:crypto";
import Decimal from "decimal.js";

// Ensure Decimal precision is configured at 40 digits
Decimal.set({ precision: 40, rounding: Decimal.ROUND_HALF_UP });

export { Decimal };

export const MODEL_VERSION = "mc-v1.0.0";

// ============================================================================
// 1. EPISTEMIC & DOMAIN TYPES
// ============================================================================

export type DataConfidence = "HIGH" | "MEDIUM" | "LOW" | "UNAVAILABLE";

export type GovernanceClass = "SYSTEM_DEFAULT" | "USER_CUSTOM" | "EXTERNALLY_SOURCED";

export type AssetClassCategory =
  | "cash"
  | "equity"
  | "fixed_income"
  | "gold_alternatives"
  | "real_estate"
  | "other";

export interface AssetAllocationItem {
  assetClass: AssetClassCategory;
  nameAr: string;
  valueBase: string; // Decimal string
  weight: string; // Decimal string 0 to 1
  empiricalVolatility?: string | null; // Annualized Decimal string if N >= 30
  quoteCount: number;
  confidence: DataConfidence;
}

export interface StressedPortfolioInput {
  baseCurrency: string;
  totalWealthBase: string; // Decimal string
  allocations: AssetAllocationItem[];
  annualLivingExpenseBase?: string; // Non-discretionary baseline spending
  annualDebtServiceBase?: string;
  annualInsurancePremiumsBase?: string;
  asOf: number;
}

export interface InstitutionalPrior {
  parameter: string;
  assetClass: AssetClassCategory;
  expectedAnnualReturn: string; // Decimal string e.g. "0.0800" for 8%
  annualVolatility: string; // Decimal string e.g. "0.1800" for 18%
  provenance: string;
  effectiveDate: string;
  confidence: DataConfidence;
  governanceClass: GovernanceClass;
}

// ============================================================================
// 2. INSTITUTIONAL PRIORS & CORRELATION BASELINE (TIER C: MODEL ASSUMPTIONS)
// ============================================================================

export const DEFAULT_INSTITUTIONAL_PRIORS: Record<AssetClassCategory, InstitutionalPrior> = {
  equity: {
    parameter: "equity_prior",
    assetClass: "equity",
    expectedAnnualReturn: "0.0800",
    annualVolatility: "0.1800",
    provenance: "Long-Term Capital Market Assumptions (MSCI World / S&P 500 historical baseline)",
    effectiveDate: "2026-09-09",
    confidence: "MEDIUM",
    governanceClass: "SYSTEM_DEFAULT",
  },
  fixed_income: {
    parameter: "fixed_income_prior",
    assetClass: "fixed_income",
    expectedAnnualReturn: "0.0450",
    annualVolatility: "0.0650",
    provenance: "Bloomberg Global Aggregate / Sukuk index historical yield & duration baseline",
    effectiveDate: "2026-09-09",
    confidence: "MEDIUM",
    governanceClass: "SYSTEM_DEFAULT",
  },
  real_estate: {
    parameter: "real_estate_prior",
    assetClass: "real_estate",
    expectedAnnualReturn: "0.0600",
    annualVolatility: "0.1200",
    provenance: "Institutional transaction appraisal unlevered benchmark",
    effectiveDate: "2026-09-09",
    confidence: "MEDIUM",
    governanceClass: "SYSTEM_DEFAULT",
  },
  gold_alternatives: {
    parameter: "gold_alternatives_prior",
    assetClass: "gold_alternatives",
    expectedAnnualReturn: "0.0500",
    annualVolatility: "0.1600",
    provenance: "LBMA Gold London Bullion Market real purchasing power baseline",
    effectiveDate: "2026-09-09",
    confidence: "MEDIUM",
    governanceClass: "SYSTEM_DEFAULT",
  },
  cash: {
    parameter: "cash_prior",
    assetClass: "cash",
    expectedAnnualReturn: "0.0300",
    annualVolatility: "0.0100",
    provenance: "Short-term central bank money market rate baseline",
    effectiveDate: "2026-09-09",
    confidence: "HIGH",
    governanceClass: "SYSTEM_DEFAULT",
  },
  other: {
    parameter: "other_prior",
    assetClass: "other",
    expectedAnnualReturn: "0.0400",
    annualVolatility: "0.1500",
    provenance: "Diversified unclassified multi-asset conservative baseline",
    effectiveDate: "2026-09-09",
    confidence: "LOW",
    governanceClass: "SYSTEM_DEFAULT",
  },
};

/**
 * 5x5 Symmetric Positive Semi-Definite Correlation Prior Matrix (Tier C: Model Assumption)
 * Order: [equity, fixed_income, real_estate, gold_alternatives, cash]
 */
export const ASSET_CLASS_ORDER: AssetClassCategory[] = [
  "equity",
  "fixed_income",
  "real_estate",
  "gold_alternatives",
  "cash",
];

export const DEFAULT_CORRELATION_MATRIX: number[][] = [
  [1.0, 0.15, 0.4, 0.05, 0.0], // equity
  [0.15, 1.0, 0.2, 0.1, 0.05], // fixed_income
  [0.4, 0.2, 1.0, 0.0, 0.0], // real_estate
  [0.05, 0.1, 0.0, 1.0, 0.0], // gold_alternatives
  [0.0, 0.05, 0.0, 0.0, 1.0], // cash
];

// ============================================================================
// 3. DETERMINISTIC RANDOM NUMBER GENERATION (MULBERRY32 + BOX-MULLER)
// ============================================================================

/**
 * Pure 32-bit deterministic seeded pseudo-random number generator (Mulberry32).
 * Strictly avoids Math.random() to ensure bit-for-bit reproducibility.
 */
export function createMulberry32(seed: number): () => number {
  let a = (seed >>> 0) || 1;
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Box-Muller transform: converts pairs of uniform (0, 1) into standard normal Z ~ N(0, 1).
 */
export function boxMuller(prng: () => number): [number, number] {
  let u1 = prng();
  let u2 = prng();
  // Guard against log(0)
  while (u1 <= 1e-15) {
    u1 = prng();
  }
  const r = Math.sqrt(-2.0 * Math.log(u1));
  const theta = 2.0 * Math.PI * u2;
  return [r * Math.cos(theta), r * Math.sin(theta)];
}

// ============================================================================
// 4. MATRIX & CHOLESKY DECOMPOSITION UTILITIES
// ============================================================================

/**
 * Computes lower-triangular matrix L such that L * L^T = A for a symmetric positive-definite matrix A.
 * If matrix is non-positive-definite, regularizes diagonal with a small ridge (jitter).
 */
export function choleskyDecomposition(matrix: number[][]): number[][] {
  const n = matrix.length;
  const L: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
  const A = matrix.map(row => [...row]);

  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let sum = 0;
      for (let k = 0; k < j; k++) {
        sum += L[i][k] * L[j][k];
      }

      if (i === j) {
        const val = A[i][i] - sum;
        if (val <= 1e-12) {
          // Diagonal regularization jitter to ensure strict positive-definiteness
          L[i][j] = Math.sqrt(Math.max(1e-8, val + 1e-6));
        } else {
          L[i][j] = Math.sqrt(val);
        }
      } else {
        if (L[j][j] === 0) {
          L[i][j] = 0;
        } else {
          L[i][j] = (A[i][j] - sum) / L[j][j];
        }
      }
    }
  }

  return L;
}

/**
 * Multiplies lower-triangular matrix L by vector z: epsilon = L * z
 */
export function multiplyMatrixVector(L: number[][], z: number[]): number[] {
  const n = L.length;
  const res = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    let sum = 0;
    for (let j = 0; j <= i; j++) {
      sum += L[i][j] * (z[j] ?? 0);
    }
    res[i] = sum;
  }
  return res;
}

// ============================================================================
// 5. PARAMETRIC MACRO STRESS SCENARIO ENGINE
// ============================================================================

export type PredefinedStressScenarioType =
  | "gfc_2008_inspired"
  | "stagflation_1970_inspired"
  | "covid_2020_inspired"
  | "devaluation_30pct"
  | "rate_hike_300bps"
  | "custom";

export interface MacroStressScenarioConfig {
  type: PredefinedStressScenarioType;
  nameAr: string;
  descriptionAr: string;
  governanceClass: GovernanceClass;
  provenanceBasis: string;
  shocks: {
    equityShockPct: string; // e.g. "-0.45" for -45%
    realEstateShockPct: string; // e.g. "-0.25"
    fixedIncomeShockPct: string; // e.g. "-0.05"
    goldShockPct: string; // e.g. "+0.15"
    cashShockPct: string; // e.g. "0.00"
    inflationShockBps: number; // e.g. 600 for +6%
    rateShockBps: number; // e.g. 400 for +4%
  };
}

export const PREDEFINED_MACRO_SCENARIOS: Record<
  Exclude<PredefinedStressScenarioType, "custom">,
  MacroStressScenarioConfig
> = {
  gfc_2008_inspired: {
    type: "gfc_2008_inspired",
    nameAr: "سيناريو ضغط ماكرو بارامتري: مستوحى من أزمة 2008 (Parametric Macro Stress Scenario)",
    descriptionAr: "اختبار ضغط ماكرو بارامتري يحاكي هبوطاً حاداً متزامناً في أسواق الأسهم والعقارات مع اتساع هوامش الائتمان وصعود الذهب (افتراض نموذجي وليس إعادة تشغيل تاريخية).",
    governanceClass: "SYSTEM_DEFAULT",
    provenanceBasis: "صدمة ماكرو بارامترية افتراضية مستوحاة من صدمات 2008 السيولة والائتمان (افتراض نموذجي وليس إعادة تشغيل تاريخية)",
    shocks: {
      equityShockPct: "-0.4500",
      realEstateShockPct: "-0.2500",
      fixedIncomeShockPct: "-0.0500",
      goldShockPct: "0.1500",
      cashShockPct: "0.0000",
      inflationShockBps: -100,
      rateShockBps: -200,
    },
  },
  stagflation_1970_inspired: {
    type: "stagflation_1970_inspired",
    nameAr: "سيناريو ضغط ماكرو بارامتري: مستوحى من الركود التضخمي 1970 (Parametric Macro Stress Scenario)",
    descriptionAr: "اختبار ضغط ماكرو بارامتري يحاكي تضخماً مرتفعاً مع صدمة أسعار طاقة وارتفاع الذهب وضغط السندات (افتراض نموذجي وليس إعادة تشغيل تاريخية).",
    governanceClass: "SYSTEM_DEFAULT",
    provenanceBasis: "صدمة ماكرو بارامترية افتراضية مستوحاة من صدمات النفط والركود التضخمي في السبعينيات",
    shocks: {
      equityShockPct: "-0.2000",
      realEstateShockPct: "-0.0500",
      fixedIncomeShockPct: "-0.1500",
      goldShockPct: "0.4000",
      cashShockPct: "0.0000",
      inflationShockBps: 600,
      rateShockBps: 400,
    },
  },
  covid_2020_inspired: {
    type: "covid_2020_inspired",
    nameAr: "سيناريو ضغط ماكرو بارامتري: مستوحى من صدمة سيولة 2020 (Parametric Macro Stress Scenario)",
    descriptionAr: "اختبار ضغط ماكرو بارامتري لصدمة سيولة خاطفة وحادة في الأصول الخطرة وتجميد مؤقت للتدفقات النقدية (افتراض نموذجي وليس إعادة تشغيل تاريخية).",
    governanceClass: "SYSTEM_DEFAULT",
    provenanceBasis: "صدمة ماكرو بارامترية افتراضية مستوحاة من تراجعات مارس 2020 اللحظية",
    shocks: {
      equityShockPct: "-0.3500",
      realEstateShockPct: "-0.1000",
      fixedIncomeShockPct: "0.0000",
      goldShockPct: "-0.0500",
      cashShockPct: "0.0000",
      inflationShockBps: -150,
      rateShockBps: -150,
    },
  },
  devaluation_30pct: {
    type: "devaluation_30pct",
    nameAr: "سيناريو ضغط ماكرو بارامتري: خفض العملة المحلية 30% (Parametric Macro Stress Scenario)",
    descriptionAr: "اختبار ضغط ماكرو بارامتري لانخفاض حاد في القوة الشرائية وسعر صرف عملة الأساس مع تضخم مستورد (افتراض نموذجي وليس إعادة تشغيل تاريخية).",
    governanceClass: "SYSTEM_DEFAULT",
    provenanceBasis: "صدمة ماكرو بارامترية افتراضية لتعديل سعر الصرف وميزان المدفوعات",
    shocks: {
      equityShockPct: "-0.1500",
      realEstateShockPct: "0.1000",
      fixedIncomeShockPct: "-0.2000",
      goldShockPct: "0.3500",
      cashShockPct: "-0.3000",
      inflationShockBps: 800,
      rateShockBps: 500,
    },
  },
  rate_hike_300bps: {
    type: "rate_hike_300bps",
    nameAr: "سيناريو ضغط ماكرو بارامتري: رفع الفائدة +300 نقطة أساس (Parametric Macro Stress Scenario)",
    descriptionAr: "اختبار ضغط ماكرو بارامتري لتشديد نقدي عنيف يؤدي لتراجع أسعار السندات وارتفاع تكلفة خدمة الديون (افتراض نموذجي وليس إعادة تشغيل تاريخية).",
    governanceClass: "SYSTEM_DEFAULT",
    provenanceBasis: "صدمة ماكرو بارامترية افتراضية لدورة التشديد النقدي الحادة",
    shocks: {
      equityShockPct: "-0.1800",
      realEstateShockPct: "-0.1500",
      fixedIncomeShockPct: "-0.1200",
      goldShockPct: "-0.0800",
      cashShockPct: "0.0200",
      inflationShockBps: -50,
      rateShockBps: 300,
    },
  },
};

export interface StressedAssetBreakdown {
  assetClass: AssetClassCategory;
  nameAr: string;
  preShockValueBase: string;
  postShockValueBase: string;
  lossBase: string;
  appliedShockPct: string;
}

export interface MacroStressResult {
  scenarioType: PredefinedStressScenarioType;
  nameAr: string;
  governanceClass: GovernanceClass;
  provenanceBasis: string;
  preShockTotalWealthBase: string;
  postShockTotalWealthBase: string;
  totalLossBase: string;
  totalLossPct: string;
  assetBreakdown: StressedAssetBreakdown[];
  epistemicDisclaimer: string;
}

/**
 * Runs a Parametric Macro Stress Scenario across live portfolio weights.
 * 100% pure function, strictly read-only, never mutates accounting facts.
 */
export function runParametricMacroStress(
  portfolio: StressedPortfolioInput,
  scenario: MacroStressScenarioConfig
): MacroStressResult {
  let preTotal = new Decimal(0);
  let postTotal = new Decimal(0);
  const breakdown: StressedAssetBreakdown[] = [];

  for (const item of portfolio.allocations) {
    const val = new Decimal(item.valueBase);
    preTotal = preTotal.plus(val);

    let shockPctStr = "0.0000";
    if (item.assetClass === "equity") shockPctStr = scenario.shocks.equityShockPct;
    else if (item.assetClass === "real_estate") shockPctStr = scenario.shocks.realEstateShockPct;
    else if (item.assetClass === "fixed_income") shockPctStr = scenario.shocks.fixedIncomeShockPct;
    else if (item.assetClass === "gold_alternatives") shockPctStr = scenario.shocks.goldShockPct;
    else if (item.assetClass === "cash") shockPctStr = scenario.shocks.cashShockPct;

    const shockDec = new Decimal(shockPctStr);
    const postVal = Decimal.max(0, val.times(new Decimal(1).plus(shockDec)));
    const loss = val.minus(postVal);
    postTotal = postTotal.plus(postVal);

    breakdown.push({
      assetClass: item.assetClass,
      nameAr: item.nameAr,
      preShockValueBase: val.toFixed(4),
      postShockValueBase: postVal.toFixed(4),
      lossBase: loss.toFixed(4),
      appliedShockPct: shockDec.toFixed(4),
    });
  }

  const totalLoss = preTotal.minus(postTotal);
  const totalLossPct = preTotal.gt(0) ? totalLoss.div(preTotal) : new Decimal(0);

  return {
    scenarioType: scenario.type,
    nameAr: scenario.nameAr,
    governanceClass: scenario.governanceClass,
    provenanceBasis: scenario.provenanceBasis,
    preShockTotalWealthBase: preTotal.toFixed(4),
    postShockTotalWealthBase: postTotal.toFixed(4),
    totalLossBase: totalLoss.toFixed(4),
    totalLossPct: totalLossPct.toFixed(4),
    assetBreakdown: breakdown,
    epistemicDisclaimer:
      "نتائج هذا السيناريو مستخلصة من صدمات عوامل بارامترية افتراضية (Tier C: Model Assumptions) مطبقة على أصول المحفظة الحالية؛ لا تعد إعادة تشغيل تاريخية أو حقائق محاسبية.",
  };
}

// ============================================================================
// 6. MULTI-ASSET MONTE CARLO SIMULATION ENGINE
// ============================================================================

export interface MonteCarloConfig {
  horizonYears: number; // e.g. 1 to 50, default 20
  iterations: number; // e.g. 1000 to 5000, default 1000
  seed: number; // Integer seed e.g. 421337
  spendingAnnualBase?: string; // Optional annual living expenditure
  spendingInflationIndexed?: boolean;
  annualInflationAssumption?: string; // e.g. "0.0300" for 3%
  priorsOverride?: Partial<Record<AssetClassCategory, { expectedReturn?: string; volatility?: string }>>;
  correlationMatrixOverride?: number[][];
}

export interface MonteCarloPercentilePoint {
  month: number;
  year: number;
  p10: string;
  p25: string;
  p50: string;
  p75: string;
  p90: string;
}

export interface MonteCarloResult {
  modelVersion: string;
  seed: number;
  deterministicFingerprint: string;
  horizonYears: number;
  iterations: number;
  initialWealthBase: string;
  medianTerminalWealthBase: string;
  ruinProbability: string; // Decimal string 0 to 1
  capitalPreservationProbability: string; // P(W_T >= W_0)
  percentileCone: MonteCarloPercentilePoint[];
  monthlyReturnsDistribution: number[]; // Aggregated return distribution for VaR
  annualReturnsDistribution: number[];
  confidenceWarning?: string;
}

export interface SimulationFingerprintInput {
  modelVersion: string;
  seed: number;
  horizonYears: number;
  iterations: number;
  baseCurrency: string;
  asOf: number;
  initialWealthBase: string;
  allocations: Array<{
    assetClass: string;
    weight: string;
    valueBase: string;
  }>;
  priors: {
    mu: number[];
    sigma: number[];
  };
  correlationMatrix: number[][];
  spending: {
    spendingAnnualBase: string;
    annualDebtServiceBase: string;
    annualInsurancePremiumsBase: string;
    inflationAssumption: string;
    spendingInflationIndexed: boolean;
  };
}

/**
 * Computes a deterministic SHA-256 fingerprint from all material simulation inputs.
 * Guaranteed: Identical model inputs + seed + priors => Identical Fingerprint.
 */
export function computeSimulationFingerprint(input: SimulationFingerprintInput): string {
  const canonicalString = JSON.stringify(input);
  return crypto.createHash("sha256").update(canonicalString).digest("hex");
}

/**
 * Runs a deterministic multi-asset Monte Carlo simulation with monthly Geometric Brownian Motion.
 * Guaranteed: Same facts + Same assumptions + Same seed + Same modelVersion => Bit-for-Bit Identical Results.
 */
export function runMonteCarloSimulation(
  portfolio: StressedPortfolioInput,
  config: MonteCarloConfig
): MonteCarloResult {
  const horizonYears = Math.max(1, Math.min(50, Math.floor(config.horizonYears)));
  const totalMonths = horizonYears * 12;
  const iterations = Math.max(100, Math.min(5000, Math.floor(config.iterations)));
  const seed = (config.seed >>> 0) || 421337;

  const prng = createMulberry32(seed);

  // 1. Resolve Asset Class Weights and Parameters
  const initialWealth = new Decimal(portfolio.totalWealthBase);
  if (initialWealth.lte(0)) {
    return {
      modelVersion: MODEL_VERSION,
      seed,
      deterministicFingerprint: "0000000000000000000000000000000000000000000000000000000000000000",
      horizonYears,
      iterations,
      initialWealthBase: "0.0000",
      medianTerminalWealthBase: "0.0000",
      ruinProbability: "1.0000",
      capitalPreservationProbability: "0.0000",
      percentileCone: [],
      monthlyReturnsDistribution: [],
      annualReturnsDistribution: [],
    };
  }

  const K = ASSET_CLASS_ORDER.length;
  const weights: number[] = new Array(K).fill(0);
  const mu: number[] = new Array(K).fill(0);
  const sigma: number[] = new Array(K).fill(0);

  let lowConfidenceCount = 0;

  for (let k = 0; k < K; k++) {
    const cat = ASSET_CLASS_ORDER[k];
    const alloc = portfolio.allocations.find(a => a.assetClass === cat);
    if (alloc) {
      weights[k] = parseFloat(alloc.weight) || 0;
      if (alloc.confidence === "LOW" || alloc.confidence === "UNAVAILABLE") {
        lowConfidenceCount++;
      }
    }

    const prior = DEFAULT_INSTITUTIONAL_PRIORS[cat];
    const override = config.priorsOverride?.[cat];

    const expRetStr = override?.expectedReturn ?? prior.expectedAnnualReturn;
    const volStr = alloc?.empiricalVolatility ?? override?.volatility ?? prior.annualVolatility;

    mu[k] = parseFloat(expRetStr) || 0.05;
    sigma[k] = Math.max(0.001, parseFloat(volStr) || 0.1);
  }

  // Normalize weights if needed
  const weightSum = weights.reduce((a, b) => a + b, 0);
  if (weightSum > 0) {
    for (let k = 0; k < K; k++) weights[k] /= weightSum;
  } else {
    weights[4] = 1.0; // 100% Cash fallback
  }

  // 2. Cholesky Factorization of Correlation Matrix
  const corr = config.correlationMatrixOverride ?? DEFAULT_CORRELATION_MATRIX;
  const L = choleskyDecomposition(corr);

  // 3. Spending parameters
  const isZeroSpendingSpecified = config.spendingAnnualBase !== undefined && new Decimal(config.spendingAnnualBase).isZero();
  const baseSpending = new Decimal(config.spendingAnnualBase ?? portfolio.annualLivingExpenseBase ?? "0");
  const baseDebtService = isZeroSpendingSpecified ? new Decimal(0) : new Decimal(portfolio.annualDebtServiceBase ?? "0");
  const baseInsurance = isZeroSpendingSpecified ? new Decimal(0) : new Decimal(portfolio.annualInsurancePremiumsBase ?? "0");
  const totalAnnualOutflow = isZeroSpendingSpecified ? new Decimal(0) : baseSpending.plus(baseDebtService).plus(baseInsurance);
  const monthlyOutflow = totalAnnualOutflow.div(12);

  const inflationRate = parseFloat(config.annualInflationAssumption ?? "0.03") || 0.03;
  const monthlyInflation = Math.pow(1 + inflationRate, 1 / 12) - 1;

  // 4. Run Iterations
  const deltaT = 1.0 / 12.0;
  const sqrtDeltaT = Math.sqrt(deltaT);

  // Drift adjustment per asset class: (mu_k - 0.5 * sigma_k^2) * deltaT
  const drift: number[] = new Array(K);
  const volStep: number[] = new Array(K);
  for (let k = 0; k < K; k++) {
    drift[k] = (mu[k] - 0.5 * sigma[k] * sigma[k]) * deltaT;
    volStep[k] = sigma[k] * sqrtDeltaT;
  }

  // Store terminal values and monthly trajectory snapshots
  // We record wealth at intervals (every 12 months, plus month 1)
  const recordedMonths: number[] = [0];
  for (let m = 1; m <= totalMonths; m++) {
    if (m === 1 || m % 12 === 0 || m === totalMonths) {
      recordedMonths.push(m);
    }
  }

  const trajectoryStore: number[][] = Array.from({ length: recordedMonths.length }, () => []);
  const monthlyOneStepReturns: number[] = [];
  const annualOneStepReturns: number[] = [];

  let ruinCount = 0;
  let capitalPreservedCount = 0;
  const initialWealthNum = initialWealth.toNumber();

  for (let iter = 0; iter < iterations; iter++) {
    let currentAssets = weights.map(w => w * initialWealthNum);
    let pureMarketAssets = weights.map(w => w * initialWealthNum);
    let currentWealth = initialWealthNum;
    let isRuined = false;

    // Record month 0
    trajectoryStore[0].push(currentWealth);

    let recordIdx = 1;
    let currentMonthlySpending = monthlyOutflow.toNumber();

    for (let m = 1; m <= totalMonths; m++) {
      if (isRuined) {
        if (recordIdx < recordedMonths.length && recordedMonths[recordIdx] === m) {
          trajectoryStore[recordIdx].push(0);
          recordIdx++;
        }
        continue;
      }

      // Generate K correlated standard normal variables
      // Since K = 5, we generate 6 normals and use first 5
      const z: number[] = [];
      for (let i = 0; i < 3; i++) {
        const [z1, z2] = boxMuller(prng);
        z.push(z1, z2);
      }
      const eps = multiplyMatrixVector(L, z.slice(0, K));

      // Advance asset values
      let newTotal = 0;
      let pureMarketTotal = 0;
      for (let k = 0; k < K; k++) {
        const factor = Math.exp(drift[k] + volStep[k] * eps[k]);
        currentAssets[k] *= factor;
        newTotal += currentAssets[k];
        if (m <= 12) {
          pureMarketAssets[k] *= factor;
          pureMarketTotal += pureMarketAssets[k];
        }
      }

      // Collect sample returns for VaR (gross of spending, strictly unconfounded by living withdrawals)
      // Random Variable: Relative market portfolio return over 1 month and 1 year
      if (m === 1) {
        const ret1m = (pureMarketTotal - initialWealthNum) / initialWealthNum;
        monthlyOneStepReturns.push(ret1m);
      }
      if (m === 12) {
        const ret1y = (pureMarketTotal - initialWealthNum) / initialWealthNum;
        annualOneStepReturns.push(ret1y);
      }

      // Deduct monthly outflow
      if (config.spendingInflationIndexed) {
        currentMonthlySpending *= 1 + monthlyInflation;
      }
      newTotal -= currentMonthlySpending;

      if (newTotal <= 0) {
        newTotal = 0;
        isRuined = true;
        currentAssets = new Array(K).fill(0);
      } else {
        // Re-scale assets to reflect spending deduction
        const scale = newTotal / (newTotal + currentMonthlySpending);
        for (let k = 0; k < K; k++) currentAssets[k] *= scale;
      }

      currentWealth = newTotal;

      if (recordIdx < recordedMonths.length && recordedMonths[recordIdx] === m) {
        trajectoryStore[recordIdx].push(currentWealth);
        recordIdx++;
      }
    }

    if (isRuined) ruinCount++;
    if (currentWealth >= initialWealthNum) capitalPreservedCount++;
  }

  // 5. Calculate Percentiles at each recorded month
  const percentileCone: MonteCarloPercentilePoint[] = [];

  for (let r = 0; r < recordedMonths.length; r++) {
    const m = recordedMonths[r];
    const vals = trajectoryStore[r].sort((a, b) => a - b);
    const n = vals.length;

    const p10 = vals[Math.floor(0.1 * n)] ?? 0;
    const p25 = vals[Math.floor(0.25 * n)] ?? 0;
    const p50 = vals[Math.floor(0.5 * n)] ?? 0;
    const p75 = vals[Math.floor(0.75 * n)] ?? 0;
    const p90 = vals[Math.floor(0.9 * n)] ?? 0;

    percentileCone.push({
      month: m,
      year: Math.floor(m / 12),
      p10: new Decimal(p10).toFixed(2),
      p25: new Decimal(p25).toFixed(2),
      p50: new Decimal(p50).toFixed(2),
      p75: new Decimal(p75).toFixed(2),
      p90: new Decimal(p90).toFixed(2),
    });
  }

  const finalConePoint = percentileCone[percentileCone.length - 1];
  const medianTerminalWealth = finalConePoint?.p50 ?? "0.00";
  const ruinProb = (ruinCount / iterations).toFixed(4);
  const capPreservedProb = (capitalPreservedCount / iterations).toFixed(4);

  let confidenceWarning: string | undefined;
  if (lowConfidenceCount > 0) {
    confidenceWarning =
      "تنبيه حوكمة: تعتمد نتائج المحاكاة جزئياً على افتراضات معيارية مسبقة نظراً لمحدودية السلاسل الزمنية التاريخية للأصول غير المسجلة؛ لا تمثل النتائج حقائق قطعية أو ضمانات مستقبلية.";
  }

  // Compute canonical deterministic fingerprint across all model inputs
  const deterministicFingerprint = computeSimulationFingerprint({
    modelVersion: MODEL_VERSION,
    seed,
    horizonYears,
    iterations,
    baseCurrency: portfolio.baseCurrency,
    asOf: portfolio.asOf,
    initialWealthBase: initialWealth.toFixed(4),
    allocations: portfolio.allocations.map(a => ({
      assetClass: a.assetClass,
      weight: a.weight,
      valueBase: a.valueBase,
    })),
    priors: { mu, sigma },
    correlationMatrix: corr,
    spending: {
      spendingAnnualBase: baseSpending.toFixed(4),
      annualDebtServiceBase: baseDebtService.toFixed(4),
      annualInsurancePremiumsBase: baseInsurance.toFixed(4),
      inflationAssumption: inflationRate.toFixed(4),
      spendingInflationIndexed: Boolean(config.spendingInflationIndexed),
    },
  });

  return {
    modelVersion: MODEL_VERSION,
    seed,
    deterministicFingerprint,
    horizonYears,
    iterations,
    initialWealthBase: initialWealth.toFixed(4),
    medianTerminalWealthBase: medianTerminalWealth,
    ruinProbability: ruinProb,
    capitalPreservationProbability: capPreservedProb,
    percentileCone,
    monthlyReturnsDistribution: monthlyOneStepReturns,
    annualReturnsDistribution: annualOneStepReturns,
    confidenceWarning,
  };
}

// ============================================================================
// 7. VALUE AT RISK (VaR) & CONDITIONAL VaR (CVaR) ENGINE
// ============================================================================

export interface VaRMetrics {
  confidenceLevel: "95%" | "99%";
  horizon: "1m" | "1y";
  varPct: string; // e.g. "0.0850" for 8.5% loss
  varBase: string; // Absolute base currency loss
  cvarPct: string; // Expected Shortfall
  cvarBase: string;
  methodology: "Monte Carlo VaR (Empirical Percentile)";
}

export interface PortfolioVaRReport {
  initialWealthBase: string;
  oneMonthVaR95: VaRMetrics;
  oneMonthVaR99: VaRMetrics;
  oneYearVaR95: VaRMetrics;
  oneYearVaR99: VaRMetrics;
  parametricCrossCheck: {
    portfolioMuAnnual: string;
    portfolioSigmaAnnual: string;
    oneMonthVaR95Base: string;
    oneMonthVaR95Pct: string;
    oneMonthVaR99Base: string;
    oneMonthVaR99Pct: string;
    oneYearVaR95Base: string;
    oneYearVaR95Pct: string;
    oneYearVaR99Base: string;
    oneYearVaR99Pct: string;
    methodology: "Analytical Gaussian Parametric VaR (t=1/12 & t=1.0)";
  };
}

/**
 * Calculates Monte Carlo VaR and CVaR from simulated returns distribution.
 * Loss convention: strictly positive decimal representing loss magnitude (L >= 0).
 * Random Variable: Relative market portfolio return gross of living withdrawals.
 *  - 1-month horizon: R_1m = (W_1 - W_0) / W_0
 *  - 1-year horizon: R_1y = (W_12 - W_0) / W_0
 * Percentile convention: Cutoff index at alpha = 1 - confidence.
 * Expected Shortfall (CVaR): Average loss in the tail worse than or equal to VaR cutoff.
 * Historical VaR remains strictly UNAVAILABLE.
 */
export function calculateMonteCarloVaR(
  simulatedReturns: number[],
  confidence: 0.95 | 0.99,
  horizon: "1m" | "1y",
  initialWealth: Decimal
): VaRMetrics {
  if (!simulatedReturns.length || initialWealth.lte(0)) {
    return {
      confidenceLevel: confidence === 0.95 ? "95%" : "99%",
      horizon,
      varPct: "0.0000",
      varBase: "0.0000",
      cvarPct: "0.0000",
      cvarBase: "0.0000",
      methodology: "Monte Carlo VaR (Empirical Percentile)",
    };
  }

  // Sort returns in ascending order (worst returns first)
  const sorted = [...simulatedReturns].sort((a, b) => a - b);
  const n = sorted.length;
  const alpha = 1.0 - confidence; // e.g. 0.05 or 0.01
  const cutoffIdx = Math.max(0, Math.min(n - 1, Math.floor(alpha * n)));

  // VaR return is at cutoff. If return is negative, loss is positive: -return
  const varReturn = sorted[cutoffIdx] ?? 0;
  const varLossPct = Math.max(0, -varReturn);

  // CVaR is the average loss of the tail returns worse than VaR
  const tail = sorted.slice(0, cutoffIdx + 1);
  const avgTailReturn = tail.reduce((sum, r) => sum + r, 0) / Math.max(1, tail.length);
  const cvarLossPct = Math.max(varLossPct, -avgTailReturn);

  const varLossDec = new Decimal(new Decimal(varLossPct).toFixed(4));
  const cvarLossDec = new Decimal(new Decimal(cvarLossPct).toFixed(4));

  return {
    confidenceLevel: confidence === 0.95 ? "95%" : "99%",
    horizon,
    varPct: varLossDec.toFixed(4),
    varBase: initialWealth.times(varLossDec).toFixed(4),
    cvarPct: cvarLossDec.toFixed(4),
    cvarBase: initialWealth.times(cvarLossDec).toFixed(4),
    methodology: "Monte Carlo VaR (Empirical Percentile)",
  };
}

export interface ParametricVaRMetrics {
  varPct: string;
  varBase: string;
  horizon: "1m" | "1y";
  confidenceLevel: "95%" | "99%";
  t: number;
  zScore: number;
  methodology: "Analytical Gaussian Parametric VaR";
}

/**
 * Analytical Gaussian Parametric VaR.
 * Formula: VaR = max(0, Z * sigma * sqrt(t) - mu * t)
 * Where:
 *  - mu and sigma are annualized expected return and volatility.
 *  - t = 1/12 for monthly horizon, t = 1.0 for annual horizon.
 *  - Z95 = 1.6448536, Z99 = 2.3263479.
 *  - Strictly returns a positive loss magnitude (e.g. 0.0560 for 5.60% loss).
 *  - Base currency conversion: varBase = initialWealth * varPct.
 */
export function calculateParametricVaR(
  muAnnual: number,
  sigmaAnnual: number,
  initialWealth: Decimal,
  horizon: "1m" | "1y",
  confidence: 0.95 | 0.99
): ParametricVaRMetrics {
  const t = horizon === "1m" ? 1.0 / 12.0 : 1.0;
  const zScore = confidence === 0.95 ? 1.6448536 : 2.3263479;
  const expectedReturn = muAnnual * t;
  const volatility = sigmaAnnual * Math.sqrt(t);

  // Strictly positive loss convention: Loss = -(expectedReturn - z * volatility) = z * volatility - expectedReturn
  const varPctRaw = Math.max(0, zScore * volatility - expectedReturn);
  const varPctDec = new Decimal(new Decimal(varPctRaw).toFixed(4));
  const varBaseDec = initialWealth.times(varPctDec);

  return {
    varPct: varPctDec.toFixed(4),
    varBase: varBaseDec.toFixed(4),
    horizon,
    confidenceLevel: confidence === 0.95 ? "95%" : "99%",
    t,
    zScore: parseFloat(zScore.toFixed(5)),
    methodology: "Analytical Gaussian Parametric VaR",
  };
}

/**
 * Calculates portfolio-level analytical Gaussian Parametric VaR cross-checks.
 * Uses portfolio-weighted annualized expected return and volatility derived via the correlation matrix:
 *   mu_portfolio = sum(w_k * mu_k)
 *   sigma_portfolio = sqrt(w^T * Sigma * w)
 */
export function calculatePortfolioParametricVaR(
  weights: number[],
  mu: number[],
  sigma: number[],
  corrMatrix: number[][],
  initialWealth: Decimal
) {
  const K = weights.length;
  let portfolioMu = 0;
  for (let k = 0; k < K; k++) {
    portfolioMu += weights[k] * mu[k];
  }

  let portfolioVar = 0;
  for (let i = 0; i < K; i++) {
    for (let j = 0; j < K; j++) {
      const rho = corrMatrix[i]?.[j] ?? (i === j ? 1 : 0);
      portfolioVar += weights[i] * weights[j] * sigma[i] * sigma[j] * rho;
    }
  }
  const portfolioSigma = Math.sqrt(Math.max(0.000001, portfolioVar));

  const oneMonthVaR95 = calculateParametricVaR(portfolioMu, portfolioSigma, initialWealth, "1m", 0.95);
  const oneMonthVaR99 = calculateParametricVaR(portfolioMu, portfolioSigma, initialWealth, "1m", 0.99);
  const oneYearVaR95 = calculateParametricVaR(portfolioMu, portfolioSigma, initialWealth, "1y", 0.95);
  const oneYearVaR99 = calculateParametricVaR(portfolioMu, portfolioSigma, initialWealth, "1y", 0.99);

  return {
    portfolioMuAnnual: portfolioMu.toFixed(4),
    portfolioSigmaAnnual: portfolioSigma.toFixed(4),
    oneMonthVaR95,
    oneMonthVaR99,
    oneYearVaR95,
    oneYearVaR99,
    methodology: "Analytical Gaussian Parametric VaR (t=1/12 & t=1.0)" as const,
  };
}

// ============================================================================
// 8. LIQUIDITY STRESS LADDER & RUNWAY ENGINE
// ============================================================================

/**
 * Approved Liquidity Haircut Parameter Ranges (Tier C: Model Assumptions).
 * Tier 1: 0% (Immediate cash and equivalents)
 * Tier 2: 5% - 15% (Default: 10%, Marketable securities)
 * Tier 3: 25% - 40% (Default: 30%, Illiquid real estate and private holdings)
 * These haircuts are stress model assumptions, NOT guarantees or historical facts.
 */
export const LIQUIDITY_HAIRCUT_RANGES = {
  tier1: { default: "0.00", min: "0.00", max: "0.00", labelAr: "نقد فوري وما في حكمه (بدون خصم)" },
  tier2: { default: "0.10", min: "0.05", max: "0.15", labelAr: "أصول قابلة للتداول السريع (افتراض: 10%، النطاق المعتمد: 5%-15%)" },
  tier3: { default: "0.30", min: "0.25", max: "0.40", labelAr: "أصول غير سائلة وعقارات (افتراض: 30%، النطاق المعتمد: 25%-40%)" },
} as const;

/**
 * Indicative Stress Liquidity Horizon — Model Assumption.
 * Explicit governance constraints:
 *  - NOT a factual market observation
 *  - NOT a guaranteed liquidation time
 *  - NOT an SLA
 *  - NOT a promise of execution
 *  - Used ONLY as a stress-model assumption
 */
export const INDICATIVE_LIQUIDITY_HORIZONS = {
  governanceLabel: "Indicative Stress Liquidity Horizon — Model Assumption",
  governanceDisclaimerAr:
    "آفاق التسييل ونسب الخصم هي افتراضات نموذجية استرشادية (Tier C: Model Assumptions / Indicative Stress Liquidity Horizon — Model Assumption): ليست رصداً سوقياً واقعياً، ولا تمثل وقتاً مضموناً للتسييل، ولا اتفاقية مستوى خدمة (SLA)، ولا وعداً بالتنفيذ السعري، وتُستخدم فقط كافتراض لنمذجة الضغط المالي.",
  tier1: {
    tier: "tier1_immediate",
    labelAr: "المستوى 1: سيولة نقدية فورية",
    indicativeHorizonAr: "فوري (Immediate)",
    haircutDefault: "0.00",
    haircutRange: "0%",
  },
  tier2: {
    tier: "tier2_marketable",
    labelAr: "المستوى 2: أصول قابلة للتسويق السريع",
    indicativeHorizonAr: "1–5 أيام عمل استرشادية (Indicative 1–5 business days)",
    haircutDefault: "0.10",
    haircutRange: "5%–15%",
  },
  tier3: {
    tier: "tier3_illiquid",
    labelAr: "المستوى 3: أصول غير سائلة / خاصة",
    indicativeHorizonAr: "90–365 يوماً استرشادياً (Indicative 90–365 days)",
    haircutDefault: "0.30",
    haircutRange: "25%–40%",
  },
} as const;

export type LiquidityTier = "tier1_immediate" | "tier2_marketable" | "tier3_illiquid";

export interface LiquidAssetItem {
  id: string;
  nameAr: string;
  tier: LiquidityTier;
  assetClass: AssetClassCategory;
  bookValueBase: string; // Decimal string
  haircutPct: string; // Model assumption e.g. "0.10" for 10%
  stressedValueBase: string; // Decimal string
  epistemicStatus: "AUTHORITATIVE_FACT" | "MODEL_ASSUMPTION";
}

export interface LiquidityObligationsInput {
  monthlyDebtServiceBase: string;
  monthlyInsurancePremiumsBase: string;
  monthlyEssentialLivingExpenseBase: string;
}

export interface LiquidityLadderResult {
  tier1ImmediateCashBase: string;
  tier2MarketableAssetsStressedBase: string;
  tier3IlliquidAssetsStressedBase: string;
  totalStressedLiquidityBase: string;
  contractualMonthlyOutflowBase: string;
  stressedMonthlyRevenueBase: string;
  netMonthlyBurnBase: string;
  monthsOfRunwayTier1: number | null; // null if no burn
  monthsOfRunwayTier2: number | null;
  monthsOfRunwayTotal: number | null;
  isDeficit: boolean;
  haircutAssumptionsDisclaimer: string;
}

/**
 * Evaluates the Liquidity Stress Ladder and Cash Burn Runway under stressed revenues.
 * Strictly distinguishes facts (accounts, contractual debts) from assumptions (liquidation haircuts).
 */
export function calculateLiquidityLadder(
  assets: LiquidAssetItem[],
  obligations: LiquidityObligationsInput,
  stressedRevenueHaircutPct: number, // 0 to 100% loss of income
  estimatedMonthlyRevenueBase = "0"
): LiquidityLadderResult {
  let tier1 = new Decimal(0);
  let tier2 = new Decimal(0);
  let tier3 = new Decimal(0);

  for (const a of assets) {
    const val = new Decimal(a.stressedValueBase);
    if (a.tier === "tier1_immediate") tier1 = tier1.plus(val);
    else if (a.tier === "tier2_marketable") tier2 = tier2.plus(val);
    else if (a.tier === "tier3_illiquid") tier3 = tier3.plus(val);
  }

  const debtService = new Decimal(obligations.monthlyDebtServiceBase || "0");
  const insurance = new Decimal(obligations.monthlyInsurancePremiumsBase || "0");
  const living = new Decimal(obligations.monthlyEssentialLivingExpenseBase || "0");
  const totalOutflow = debtService.plus(insurance).plus(living);

  const rawRevenue = new Decimal(estimatedMonthlyRevenueBase);
  const haircutFactor = new Decimal(1).minus(new Decimal(stressedRevenueHaircutPct).div(100));
  const stressedRevenue = Decimal.max(0, rawRevenue.times(haircutFactor));

  const netMonthlyBurn = totalOutflow.minus(stressedRevenue);

  let monthsT1: number | null = null;
  let monthsT2: number | null = null;
  let monthsTotal: number | null = null;

  if (netMonthlyBurn.gt(0)) {
    monthsT1 = Math.floor(tier1.div(netMonthlyBurn).toNumber());
    const tier1Plus2 = tier1.plus(tier2);
    monthsT2 = Math.floor(tier1Plus2.div(netMonthlyBurn).toNumber());
    const totalLiq = tier1Plus2.plus(tier3);
    monthsTotal = Math.floor(totalLiq.div(netMonthlyBurn).toNumber());
  }

  return {
    tier1ImmediateCashBase: tier1.toFixed(4),
    tier2MarketableAssetsStressedBase: tier2.toFixed(4),
    tier3IlliquidAssetsStressedBase: tier3.toFixed(4),
    totalStressedLiquidityBase: tier1.plus(tier2).plus(tier3).toFixed(4),
    contractualMonthlyOutflowBase: totalOutflow.toFixed(4),
    stressedMonthlyRevenueBase: stressedRevenue.toFixed(4),
    netMonthlyBurnBase: netMonthlyBurn.toFixed(4),
    monthsOfRunwayTier1: monthsT1,
    monthsOfRunwayTier2: monthsT2,
    monthsOfRunwayTotal: monthsTotal,
    isDeficit: netMonthlyBurn.gt(0) && (monthsT1 ?? 999) < 12,
    haircutAssumptionsDisclaimer: INDICATIVE_LIQUIDITY_HORIZONS.governanceDisclaimerAr,
  };
}
