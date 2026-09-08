import Decimal from "decimal.js";

// Ensure Decimal precision is configured at 40 digits
Decimal.set({ precision: 40, rounding: Decimal.ROUND_HALF_UP });

export { Decimal };

// ============================================================================
// 1. DECIMAL CONVERSION & MATH UTILITIES
// ============================================================================

export function toDec(val: unknown, fallback = "0"): Decimal {
  if (val instanceof Decimal) return val;
  if (typeof val === "number") {
    if (!Number.isFinite(val)) return new Decimal(fallback);
    return new Decimal(val.toString());
  }
  if (typeof val === "string") {
    const trimmed = val.trim();
    if (!trimmed) return new Decimal(fallback);
    try {
      const d = new Decimal(trimmed);
      return d.isFinite() ? d : new Decimal(fallback);
    } catch {
      return new Decimal(fallback);
    }
  }
  return new Decimal(fallback);
}

export function formatDec(val: Decimal | string | number, decimals = 4): string {
  const d = toDec(val);
  return d.toFixed(decimals);
}

export function safeDiv(numerator: Decimal, denominator: Decimal, fallback = "0"): Decimal {
  if (denominator.isZero() || !denominator.isFinite()) return new Decimal(fallback);
  return numerator.div(denominator);
}

export function clampDec(val: Decimal, min: Decimal, max: Decimal): Decimal {
  if (val.lt(min)) return min;
  if (val.gt(max)) return max;
  return val;
}

/**
 * High-precision Decimal natural logarithm routine.
 * Evaluates ln(z) using Decimal.js precision 40.
 */
export function decLn(z: Decimal): Decimal {
  if (z.lte(0)) {
    throw new Error(`Mathematical domain error: ln(z) undefined for z <= 0 (received ${z.toString()})`);
  }
  return z.ln();
}

/**
 * Exact Fisher Real Return:
 * r_real = (1 + r_nom) / (1 + i_inf) - 1
 */
export function calculateFisherRealRate(nominalReturn: Decimal, inflationRate: Decimal): Decimal {
  const nomTerm = new Decimal(1).plus(nominalReturn);
  const infTerm = new Decimal(1).plus(inflationRate);
  if (infTerm.lte(0)) {
    throw new Error(`Inflation rate leads to non-positive denominator: 1 + inflation = ${infTerm.toString()}`);
  }
  return nomTerm.div(infTerm).minus(1);
}

/**
 * Monthly Real Compounding Rate:
 * r_m = (1 + r_real)^(1/12) - 1
 */
export function calculateMonthlyRealRate(rReal: Decimal): Decimal {
  const onePlusR = new Decimal(1).plus(rReal);
  if (onePlusR.lte(0)) {
    throw new Error(`Real return leads to non-positive base for monthly compounding: 1 + r_real = ${onePlusR.toString()}`);
  }
  const oneTwelfth = new Decimal(1).div(12);
  return onePlusR.pow(oneTwelfth).minus(1);
}

/**
 * Exact Closed-Form Portfolio Recurrence at month m:
 * A(m) = A_0 * (1 + r_m)^m + C * ((1 + r_m)^m - 1) / r_m
 * If r_m == 0: A(m) = A_0 + C * m
 */
export function computePortfolioAtMonth(
  A0: Decimal,
  C: Decimal,
  rm: Decimal,
  m: number | Decimal
): Decimal {
  const mDec = new Decimal(m);
  if (mDec.isZero()) return A0;
  if (rm.isZero()) {
    return A0.plus(C.times(mDec));
  }
  const factor = new Decimal(1).plus(rm).pow(mDec);
  return A0.times(factor).plus(C.times(factor.minus(1)).div(rm));
}

// ============================================================================
// 2. TYPES & DATA INTERFACES
// ============================================================================

export type AssetClassKey = "cash" | "equity" | "fixed_income" | "alternatives" | "other";

export interface AssetHoldingItem {
  id: string | number;
  name: string;
  assetClass: AssetClassKey;
  marketValue: Decimal;
  currency: string;
  isInvestable: boolean;
  isFresh: boolean;
  valuationAgeDays?: number;
}

export interface Dimension1LiquidityResult {
  score: Decimal;
  runwayMonths: Decimal;
  liquidReserves: Decimal;
  monthlyEssentialOutflows: Decimal;
  status: "excellent" | "adequate" | "concerning" | "critical";
  driverAr: string;
}

export interface Dimension2DebtResult {
  score: Decimal;
  leverageScore: Decimal;
  dscrScore: Decimal;
  leverageRatio: Decimal;
  dscr: Decimal;
  totalDebtPrincipal: Decimal;
  totalEconomicAssets: Decimal;
  annualDebtService: Decimal;
  ocfPreDebt: Decimal;
  status: "excellent" | "manageable" | "elevated" | "critical";
  driverAr: string;
}

export interface Dimension3SavingsResult {
  score: Decimal;
  operatingSavingsRate: Decimal;
  netWealthAccumulation: Decimal;
  monthlyFiContribution: Decimal;
  operatingInflows: Decimal;
  operatingExpenses: Decimal;
  debtPrincipalRepayments: Decimal;
  status: "exceptional" | "strong" | "moderate" | "concerning" | "deficit";
  driverAr: string;
}

export interface Dimension4DiversificationResult {
  score: Decimal;
  hhi: Decimal;
  topHoldingWeight: Decimal;
  topHoldingName: string;
  assetClassWeights: Record<AssetClassKey, Decimal>;
  status: "well_diversified" | "balanced" | "concentrated" | "highly_concentrated";
  driverAr: string;
}

export interface Dimension5ResilienceResult {
  score: Decimal;
  subScore5A: Decimal;
  subScore5B: Decimal;
  freshRatio: Decimal;
  totalEconomicAssets: Decimal;
  freshAssetValue: Decimal;
  staleAssetValue: Decimal;
  healthPoints: Decimal;
  lifePoints: Decimal;
  propertyPoints: Decimal;
  status: "fully_protected" | "adequately_protected" | "partially_protected" | "vulnerable";
  driverAr: string;
}

export interface Dimension6FiProgressResult {
  score: Decimal;
  fiProgressRatio: Decimal;
  investableAssets: Decimal;
  kFiBaseline: Decimal;
  actualAnnualSpending: Decimal;
  baselineSwr: Decimal;
  status: "achieved" | "near_fi" | "halfway" | "accumulating" | "early_stage";
  driverAr: string;
}

export interface WealthHealthScorePackage {
  totalScore: Decimal;
  ratingTier: "excellent" | "good" | "moderate" | "critical";
  ratingTierLabelAr: string;
  asOf: number;
  dimensions: {
    liquidity: Dimension1LiquidityResult;
    debtSustainability: Dimension2DebtResult;
    savingsVelocity: Dimension3SavingsResult;
    diversification: Dimension4DiversificationResult;
    resilienceProtection: Dimension5ResilienceResult;
    fiProgress: Dimension6FiProgressResult;
  };
  weights: {
    liquidity: Decimal;
    debtSustainability: Decimal;
    savingsVelocity: Decimal;
    diversification: Decimal;
    resilienceProtection: Decimal;
    fiProgress: Decimal;
  };
  confidence: {
    level: "high" | "medium" | "low";
    completenessPercent: Decimal;
    historyMonths: number;
    freshnessRatio: Decimal;
    warningsAr: string[];
  };
}

export type FireHorizonStatus =
  | "achieved"
  | "reachable_linear"
  | "reachable_compounding"
  | "reachable_decay_overcome"
  | "unreachable_zero_growth"
  | "unreachable_positive_return_negative_contribution"
  | "unreachable_negative_real_return"
  | "unreachable_deficit";

export interface FireHorizonResult {
  status: FireHorizonStatus;
  statusLabelAr: string;
  isReachable: boolean;
  horizonMonths: number | null;
  horizonYears: Decimal | null;
  projectedDate: string | null;
  targetCorpus: Decimal;
  investableAssets: Decimal;
  annualSpending: Decimal;
  swr: Decimal;
  nominalReturn: Decimal;
  inflation: Decimal;
  realReturn: Decimal;
  monthlyRealRate: Decimal;
  monthlyContribution: Decimal;
  gapCorpus: Decimal;
  verifiedExact: boolean;
}

export interface FireScenarioPlan {
  name: "conservative" | "base" | "optimistic";
  nameLabelAr: string;
  nominalReturn: Decimal;
  inflation: Decimal;
  realReturn: Decimal;
  swr: Decimal;
  annualSpending: Decimal;
  monthlyContribution: Decimal;
  horizonResult: FireHorizonResult;
}

// ============================================================================
// 3. DIMENSION 1 — LIQUIDITY & EMERGENCY RESILIENCE (WEIGHT: 20%)
// ============================================================================

export function calculateLiquidityScore(
  liquidReserves: Decimal | string | number,
  monthlyEssentialOutflows: Decimal | string | number
): Dimension1LiquidityResult {
  const Rliq = toDec(liquidReserves);
  const Eess = toDec(monthlyEssentialOutflows);

  // If no essential outflow burden, maximum resilience
  if (Eess.lte(0)) {
    return {
      score: new Decimal(100),
      runwayMonths: new Decimal(999),
      liquidReserves: Rliq,
      monthlyEssentialOutflows: Eess,
      status: "excellent",
      driverAr: "لا توجد أعباء نفقات أساسية إلزامية؛ احتياطي السيولة يوفر حماية كاملة.",
    };
  }

  // Runway = Liquid Reserves / Monthly Essential Outflows
  const runway = Rliq.div(Eess);
  let score: Decimal;
  let status: Dimension1LiquidityResult["status"];
  let driverAr: string;

  if (runway.gte(12)) {
    score = new Decimal(100);
    status = "excellent";
    driverAr = `احتياطي السيولة يغطي ${runway.toFixed(1)} شهرًا من النفقات الأساسية (الهدف المثالي >= 12 شهرًا).`;
  } else if (runway.gte(6)) {
    // 6 <= Runway < 12: 85 + ((Runway - 6) / 6) * 15
    const frac = runway.minus(6).div(6);
    score = new Decimal(85).plus(frac.times(15));
    status = "adequate";
    driverAr = `احتياطي السيولة يغطي ${runway.toFixed(1)} شهرًا؛ مرونة جيدة ضمن النطاق الآمن (6–12 شهرًا).`;
  } else if (runway.gte(3)) {
    // 3 <= Runway < 6: 50 + ((Runway - 3) / 3) * 35
    const frac = runway.minus(3).div(3);
    score = new Decimal(50).plus(frac.times(35));
    status = "concerning";
    driverAr = `احتياطي السيولة يغطي ${runway.toFixed(1)} شهرًا؛ يُوصى بزيادته لتغطية 6 أشهر على الأقل.`;
  } else if (runway.gte(1)) {
    // 1 <= Runway < 3: 20 + ((Runway - 1) / 2) * 30
    const frac = runway.minus(1).div(2);
    score = new Decimal(20).plus(frac.times(30));
    status = "critical";
    driverAr = `احتياطي السيولة منخفض جدًا (${runway.toFixed(1)} شهرًا)؛ خطر انكشاف مرتفع في حال انقطاع الدخل.`;
  } else {
    // 0 <= Runway < 1: Runway * 20
    const boundedRunway = runway.lt(0) ? new Decimal(0) : runway;
    score = boundedRunway.times(20);
    status = "critical";
    driverAr = `احتياطي السيولة حرج (${runway.toFixed(1)} شهرًا) ولا يغطي نفقات شهر واحد.`;
  }

  return {
    score: clampDec(score, new Decimal(0), new Decimal(100)),
    runwayMonths: runway,
    liquidReserves: Rliq,
    monthlyEssentialOutflows: Eess,
    status,
    driverAr,
  };
}

// ============================================================================
// 4. DIMENSION 2 — DEBT SUSTAINABILITY & SOLVENCY (WEIGHT: 20%)
// ============================================================================

export function calculateDebtSustainabilityScore(
  totalDebtPrincipal: Decimal | string | number,
  totalEconomicAssets: Decimal | string | number,
  annualDebtService: Decimal | string | number,
  ocfPreDebt: Decimal | string | number
): Dimension2DebtResult {
  const D = toDec(totalDebtPrincipal);
  const Aecon = toDec(totalEconomicAssets);
  const DS = toDec(annualDebtService);
  const OCF = toDec(ocfPreDebt);

  // --- Sub-Score 2A: Leverage (Weight: 50% of Dim 2) ---
  let s2a: Decimal;
  let leverage: Decimal;

  if (Aecon.lte(0)) {
    if (D.isZero()) {
      s2a = new Decimal(100);
      leverage = new Decimal(0);
    } else {
      s2a = new Decimal(0);
      leverage = new Decimal(999);
    }
  } else {
    leverage = D.div(Aecon);
    if (leverage.isZero()) {
      s2a = new Decimal(100);
    } else if (leverage.lte(0.15)) {
      // 0 < L <= 0.15: 100 - (L / 0.15) * 10
      s2a = new Decimal(100).minus(leverage.div(0.15).times(10));
    } else if (leverage.lte(0.30)) {
      // 0.15 < L <= 0.30: 90 - ((L - 0.15) / 0.15) * 15
      s2a = new Decimal(90).minus(leverage.minus(0.15).div(0.15).times(15));
    } else if (leverage.lte(0.50)) {
      // 0.30 < L <= 0.50: 75 - ((L - 0.30) / 0.20) * 25
      s2a = new Decimal(75).minus(leverage.minus(0.30).div(0.20).times(25));
    } else if (leverage.lte(0.65)) {
      // 0.50 < L <= 0.65: 50 - ((L - 0.50) / 0.15) * 30
      s2a = new Decimal(50).minus(leverage.minus(0.50).div(0.15).times(30));
    } else if (leverage.lte(1.00)) {
      // 0.65 < L <= 1.00: 20 - ((L - 0.65) / 0.35) * 20
      s2a = new Decimal(20).minus(leverage.minus(0.65).div(0.35).times(20));
    } else {
      // L > 1.00: Insolvent
      s2a = new Decimal(0);
    }
  }
  s2a = clampDec(s2a, new Decimal(0), new Decimal(100));

  // --- Sub-Score 2B: DSCR (Weight: 50% of Dim 2) ---
  let s2b: Decimal;
  let dscr: Decimal;

  if (DS.isZero() || DS.lt(0)) {
    s2b = new Decimal(100);
    dscr = new Decimal(999);
  } else if (OCF.lte(0)) {
    s2b = new Decimal(0);
    dscr = safeDiv(OCF, DS, "0");
  } else {
    dscr = OCF.div(DS);
    if (dscr.gte(3.0)) {
      s2b = new Decimal(100);
    } else if (dscr.gte(2.0)) {
      // 2.0 <= DSCR < 3.0: 80 + ((DSCR - 2.0) / 1.0) * 20
      s2b = new Decimal(80).plus(dscr.minus(2.0).div(1.0).times(20));
    } else if (dscr.gte(1.2)) {
      // 1.2 <= DSCR < 2.0: 50 + ((DSCR - 1.2) / 0.8) * 30
      s2b = new Decimal(50).plus(dscr.minus(1.2).div(0.8).times(30));
    } else if (dscr.gte(1.0)) {
      // 1.0 <= DSCR < 1.2: 25 + ((DSCR - 1.0) / 0.2) * 25
      s2b = new Decimal(25).plus(dscr.minus(1.0).div(0.2).times(25));
    } else {
      // 0 < DSCR < 1.0: (DSCR / 1.0) * 25
      s2b = dscr.times(25);
    }
  }
  s2b = clampDec(s2b, new Decimal(0), new Decimal(100));

  // Total Dimension 2 Score
  const score = clampDec(
    s2a.times(0.5).plus(s2b.times(0.5)),
    new Decimal(0),
    new Decimal(100)
  );

  let status: Dimension2DebtResult["status"];
  let driverAr: string;

  if (score.gte(85)) {
    status = "excellent";
    driverAr = D.isZero()
      ? "الأسرة خالية تمامًا من الديون، وملاءة الميزانية ممتازة."
      : `المديونية منخفضة (${leverage.times(100).toFixed(1)}%) وتغطية خدمة الدين قوية (${dscr.toFixed(2)}x).`;
  } else if (score.gte(70)) {
    status = "manageable";
    driverAr = `نسبة الرافعة المالية ${leverage.times(100).toFixed(1)}% ومعدل تغطية خدمة الدين ${dscr.toFixed(2)}x في النطاق المستقر.`;
  } else if (score.gte(50)) {
    status = "elevated";
    driverAr = `عبء الديون مرتفع نسبيًا (${leverage.times(100).toFixed(1)}%)؛ يُوصى بضبط الاقتراض وتسريع السداد.`;
  } else {
    status = "critical";
    driverAr = `مخاطر مديونية حرجة (الرافعة: ${leverage.times(100).toFixed(1)}%، التغطية: ${dscr.toFixed(2)}x)؛ تهديد مباشر للملاءة المالية.`;
  }

  return {
    score,
    leverageScore: s2a,
    dscrScore: s2b,
    leverageRatio: leverage,
    dscr,
    totalDebtPrincipal: D,
    totalEconomicAssets: Aecon,
    annualDebtService: DS,
    ocfPreDebt: OCF,
    status,
    driverAr,
  };
}

// ============================================================================
// 5. DIMENSION 3 — SAVINGS VELOCITY & CAPITAL ACCUMULATION (WEIGHT: 20%)
// ============================================================================

export function calculateSavingsVelocityScore(
  operatingInflows: Decimal | string | number,
  operatingExpenses: Decimal | string | number,
  debtPrincipalRepayments: Decimal | string | number
): Dimension3SavingsResult {
  const Iop = toDec(operatingInflows);
  const Eop = toDec(operatingExpenses);
  const Pdebt = toDec(debtPrincipalRepayments);

  // Operating Savings Rate = (I_op - E_op) / I_op
  // Net Wealth Accumulation = I_op - E_op
  // Authoritative Monthly FI Contribution = (I_op - E_op - P_debt) / 12
  const netWealthAccumulation = Iop.minus(Eop);
  const monthlyFiContribution = netWealthAccumulation.minus(Pdebt).div(12);

  let score: Decimal;
  let savingsRate: Decimal;

  if (Iop.lte(0)) {
    if (Eop.lte(0)) {
      score = new Decimal(50);
      savingsRate = new Decimal(0);
    } else {
      score = new Decimal(0);
      savingsRate = new Decimal(-1);
    }
  } else {
    savingsRate = netWealthAccumulation.div(Iop);

    if (savingsRate.gte(0.40)) {
      score = new Decimal(100);
    } else if (savingsRate.gte(0.25)) {
      // 0.25 <= Rate < 0.40: 80 + ((Rate - 0.25) / 0.15) * 20
      const frac = savingsRate.minus(0.25).div(0.15);
      score = new Decimal(80).plus(frac.times(20));
    } else if (savingsRate.gte(0.10)) {
      // 0.10 <= Rate < 0.25: 50 + ((Rate - 0.10) / 0.15) * 30
      const frac = savingsRate.minus(0.10).div(0.15);
      score = new Decimal(50).plus(frac.times(30));
    } else if (savingsRate.gte(0.00)) {
      // 0.00 <= Rate < 0.10: 20 + (Rate / 0.10) * 30
      const frac = savingsRate.div(0.10);
      score = new Decimal(20).plus(frac.times(30));
    } else {
      // Rate < 0 (Deficit): max(0, 20 - 50 * |Rate|)
      const penalty = new Decimal(20).minus(new Decimal(50).times(savingsRate.abs()));
      score = penalty.lt(0) ? new Decimal(0) : penalty;
    }
  }

  score = clampDec(score, new Decimal(0), new Decimal(100));

  let status: Dimension3SavingsResult["status"];
  let driverAr: string;

  if (savingsRate.gte(0.40)) {
    status = "exceptional";
    driverAr = `معدل ادخار استثنائي (${savingsRate.times(100).toFixed(1)}%)؛ فائض تشغيلي مرتفع يسرّع نمو الثروة.`;
  } else if (savingsRate.gte(0.25)) {
    status = "strong";
    driverAr = `معدل ادخار قوي (${savingsRate.times(100).toFixed(1)}%) فوق معيار الاستقرار المالي (25%).`;
  } else if (savingsRate.gte(0.10)) {
    status = "moderate";
    driverAr = `معدل ادخار متوسط (${savingsRate.times(100).toFixed(1)}%)؛ هناك فرصة لترشيد المصروفات لزيادة الفائض.`;
  } else if (savingsRate.gte(0)) {
    status = "concerning";
    driverAr = `معدل ادخار ضعيف جدًا (${savingsRate.times(100).toFixed(1)}%) يقارب نقطة التعادل؛ هامش الأمان محدود.`;
  } else {
    status = "deficit";
    driverAr = `عجز تشغيلي (${savingsRate.times(100).toFixed(1)}%)؛ المصروفات تتجاوز الدخل التشغيلي مما يستنزف رأس المال.`;
  }

  return {
    score,
    operatingSavingsRate: savingsRate,
    netWealthAccumulation,
    monthlyFiContribution,
    operatingInflows: Iop,
    operatingExpenses: Eop,
    debtPrincipalRepayments: Pdebt,
    status,
    driverAr,
  };
}

// ============================================================================
// 6. DIMENSION 4 — PORTFOLIO DIVERSIFICATION (WEIGHT: 15%)
// ============================================================================

export function calculatePortfolioDiversificationScore(
  classValues: Record<AssetClassKey, Decimal | string | number>,
  holdings: Array<{ name: string; value: Decimal | string | number }>
): Dimension4DiversificationResult {
  const cashVal = toDec(classValues.cash);
  const equityVal = toDec(classValues.equity);
  const fixedIncomeVal = toDec(classValues.fixed_income);
  const altVal = toDec(classValues.alternatives);
  const otherVal = toDec(classValues.other);

  const totalAssets = cashVal.plus(equityVal).plus(fixedIncomeVal).plus(altVal).plus(otherVal);

  if (totalAssets.lte(0)) {
    return {
      score: new Decimal(0),
      hhi: new Decimal(1),
      topHoldingWeight: new Decimal(0),
      topHoldingName: "لا توجد أصول مسجلة",
      assetClassWeights: {
        cash: new Decimal(0),
        equity: new Decimal(0),
        fixed_income: new Decimal(0),
        alternatives: new Decimal(0),
        other: new Decimal(0),
      },
      status: "highly_concentrated",
      driverAr: "لا توجد أصول مسجلة في المحفظة لحساب التنوع.",
    };
  }

  const sCash = cashVal.div(totalAssets);
  const sEq = equityVal.div(totalAssets);
  const sFi = fixedIncomeVal.div(totalAssets);
  const sAlt = altVal.div(totalAssets);
  const sOth = otherVal.div(totalAssets);

  // HHI = sum(s_k^2)
  const hhi = sCash.pow(2)
    .plus(sEq.pow(2))
    .plus(sFi.pow(2))
    .plus(sAlt.pow(2))
    .plus(sOth.pow(2));

  // Determine top individual holding
  let maxHoldingVal = new Decimal(0);
  let topHoldingName = "غير محدد";

  for (const h of holdings) {
    const val = toDec(h.value);
    if (val.gt(maxHoldingVal)) {
      maxHoldingVal = val;
      topHoldingName = h.name;
    }
  }

  const topHoldingWeight = maxHoldingVal.div(totalAssets);

  // Complete, unambiguous score mapping
  let score: Decimal;
  if (topHoldingWeight.gte(0.75)) {
    score = new Decimal(10);
  } else if (hhi.gt(0.65) || topHoldingWeight.gte(0.40)) {
    score = new Decimal(25);
  } else if (hhi.lte(0.30) && topHoldingWeight.lt(0.15)) {
    score = new Decimal(100);
  } else if (hhi.lte(0.45) && topHoldingWeight.lt(0.25)) {
    score = new Decimal(75);
  } else {
    // Covers 0.30 < HHI <= 0.65 AND topHoldingWeight < 0.40
    score = new Decimal(50);
  }

  score = clampDec(score, new Decimal(0), new Decimal(100));

  let status: Dimension4DiversificationResult["status"];
  let driverAr: string;

  if (score.gte(85)) {
    status = "well_diversified";
    driverAr = `توزيع أصول ممتاز (HHI: ${hhi.toFixed(2)}) مع انخفاض تركيز الأصل الأكبر (${topHoldingWeight.times(100).toFixed(1)}%).`;
  } else if (score.gte(70)) {
    status = "balanced";
    driverAr = `تنوع متوازن عبر فئات الأصول (HHI: ${hhi.toFixed(2)}) مع تركيز مقبول لأكبر أصل (${topHoldingWeight.times(100).toFixed(1)}%).`;
  } else if (score.gte(40)) {
    status = "concentrated";
    driverAr = `تركيز متوسط في المحفظة (أكبر أصل '${topHoldingName}': ${topHoldingWeight.times(100).toFixed(1)}%، HHI: ${hhi.toFixed(2)}).`;
  } else {
    status = "highly_concentrated";
    driverAr = `مخاطر تركيز حرجة؛ الأصل '${topHoldingName}' يستحوذ على ${topHoldingWeight.times(100).toFixed(1)}% من إجمالي الثروة.`;
  }

  return {
    score,
    hhi,
    topHoldingWeight,
    topHoldingName,
    assetClassWeights: {
      cash: sCash,
      equity: sEq,
      fixed_income: sFi,
      alternatives: sAlt,
      other: sOth,
    },
    status,
    driverAr,
  };
}

// ============================================================================
// 7. DIMENSION 5 — RESILIENCE & PROTECTION (WEIGHT: 10%)
// ============================================================================

export interface ResilienceProtectionInputs {
  totalEconomicAssets: Decimal | string | number;
  freshAssetValue: Decimal | string | number;
  hasActiveHealthPolicy: boolean;
  activeLifeCoverageAmount: Decimal | string | number;
  totalDebtPrincipal: Decimal | string | number;
  hasPhysicalRealEstateOrMotor: boolean;
  hasActivePropertyOrMotorPolicy: boolean;
}

export function calculateResilienceProtectionScore(
  inputs: ResilienceProtectionInputs
): Dimension5ResilienceResult {
  const Aecon = toDec(inputs.totalEconomicAssets);
  const freshVal = toDec(inputs.freshAssetValue);
  const lifeCov = toDec(inputs.activeLifeCoverageAmount);
  const debt = toDec(inputs.totalDebtPrincipal);

  // Sub-Score 5A: Valuation Quality & Freshness (50% of Dim 5)
  let s5a: Decimal;
  let freshRatio: Decimal;

  if (Aecon.lte(0)) {
    freshRatio = new Decimal(1);
    s5a = new Decimal(100);
  } else {
    freshRatio = clampDec(freshVal.div(Aecon), new Decimal(0), new Decimal(1));
    if (freshRatio.gte(0.95)) {
      s5a = new Decimal(100);
    } else if (freshRatio.gte(0.80)) {
      // 0.80 <= Ratio < 0.95: 75 + ((Ratio - 0.80) / 0.15) * 25
      const frac = freshRatio.minus(0.80).div(0.15);
      s5a = new Decimal(75).plus(frac.times(25));
    } else if (freshRatio.gte(0.60)) {
      // 0.60 <= Ratio < 0.80: 50 + ((Ratio - 0.60) / 0.20) * 25
      const frac = freshRatio.minus(0.60).div(0.20);
      s5a = new Decimal(50).plus(frac.times(25));
    } else {
      // Ratio < 0.60: (Ratio / 0.60) * 50
      s5a = freshRatio.div(0.60).times(50);
    }
  }
  s5a = clampDec(s5a, new Decimal(0), new Decimal(100));

  // Sub-Score 5B: Insurance Protection (50% of Dim 5)
  // Health: 35 pts
  const healthPts = inputs.hasActiveHealthPolicy ? new Decimal(35) : new Decimal(0);

  // Life: 35 pts
  let lifePts: Decimal;
  if (debt.lte(0)) {
    lifePts = new Decimal(35); // Automatically awarded if debt-free
  } else {
    if (lifeCov.gte(debt)) {
      lifePts = new Decimal(35);
    } else if (lifeCov.gt(0)) {
      lifePts = lifeCov.div(debt).times(35);
    } else {
      lifePts = new Decimal(0);
    }
  }
  lifePts = clampDec(lifePts, new Decimal(0), new Decimal(35));

  // Property / Asset: 30 pts
  let propertyPts: Decimal;
  if (!inputs.hasPhysicalRealEstateOrMotor) {
    propertyPts = new Decimal(30); // Automatically awarded if no tangible property exposure
  } else {
    propertyPts = inputs.hasActivePropertyOrMotorPolicy ? new Decimal(30) : new Decimal(0);
  }

  const s5b = clampDec(healthPts.plus(lifePts).plus(propertyPts), new Decimal(0), new Decimal(100));

  // Total Dimension 5 Score
  const totalScore = clampDec(
    s5a.times(0.5).plus(s5b.times(0.5)),
    new Decimal(0),
    new Decimal(100)
  );

  let status: Dimension5ResilienceResult["status"];
  let driverAr: string;

  if (totalScore.gte(85)) {
    status = "fully_protected";
    driverAr = `حماية استثنائية: تغطية تأمينية مكتملة وبيانات تقييم حديثة بنسبة ${freshRatio.times(100).toFixed(0)}%.`;
  } else if (totalScore.gte(70)) {
    status = "adequately_protected";
    driverAr = `حماية مقبولة: درجات التأمين ${s5b.toFixed(0)}/100 ونسبة تقييمات الأصول الحديثة ${freshRatio.times(100).toFixed(0)}%.`;
  } else if (totalScore.gte(50)) {
    status = "partially_protected";
    driverAr = `حماية جزئية؛ توجد فجوات تأمينية أو أصول تتطلب تحديث تقييماتها الدورية.`;
  } else {
    status = "vulnerable";
    driverAr = `انكشاف مخاطر مرتفع؛ نقص في وثائق التأمين الأساسية أو اعتماد كبير على تقييمات قديمة/غير موثقة.`;
  }

  const staleVal = Aecon.minus(freshVal).lt(0) ? new Decimal(0) : Aecon.minus(freshVal);

  return {
    score: totalScore,
    subScore5A: s5a,
    subScore5B: s5b,
    freshRatio,
    totalEconomicAssets: Aecon,
    freshAssetValue: freshVal,
    staleAssetValue: staleVal,
    healthPoints: healthPts,
    lifePoints: lifePts,
    propertyPoints: propertyPts,
    status,
    driverAr,
  };
}

// ============================================================================
// 8. DIMENSION 6 — FI PROGRESS (ACTUAL BASELINE) (WEIGHT: 15%)
// ============================================================================

export function calculateFiProgressScore(
  investableAssets: Decimal | string | number,
  actualAnnualSpending: Decimal | string | number,
  baselineSwr: Decimal | string | number = "0.04"
): Dimension6FiProgressResult {
  const Ainv = toDec(investableAssets);
  const Sactual = toDec(actualAnnualSpending);
  const swr = toDec(baselineSwr, "0.04");

  if (Sactual.lte(0)) {
    return {
      score: new Decimal(100),
      fiProgressRatio: new Decimal(999),
      investableAssets: Ainv,
      kFiBaseline: new Decimal(0),
      actualAnnualSpending: Sactual,
      baselineSwr: swr,
      status: "achieved",
      driverAr: "الإنفاق الفعلي صفر أو غير مسجل؛ الهدف النظري محقق بالكامل.",
    };
  }

  // K_FI,baseline = S_actual / SWR
  const kFiBaseline = Sactual.div(swr);
  const ratio = Ainv.div(kFiBaseline);

  let score: Decimal;
  let status: Dimension6FiProgressResult["status"];
  let driverAr: string;

  if (ratio.gte(1.0)) {
    score = new Decimal(100);
    status = "achieved";
    driverAr = `تم تحقيق الاستقلال المالي الفعلي بنسبة ${ratio.times(100).toFixed(1)}% بناءً على الإنفاق السنوي الفعلي.`;
  } else if (ratio.gte(0.75)) {
    // 0.75 <= Ratio < 1.0: 85 + ((Ratio - 0.75) / 0.25) * 15
    const frac = ratio.minus(0.75).div(0.25);
    score = new Decimal(85).plus(frac.times(15));
    status = "near_fi";
    driverAr = `اقتراب وثيق من الاستقلال المالي (${ratio.times(100).toFixed(1)}% من الهدف الفعلي).`;
  } else if (ratio.gte(0.50)) {
    // 0.50 <= Ratio < 0.75: 70 + ((Ratio - 0.50) / 0.25) * 15
    const frac = ratio.minus(0.50).div(0.25);
    score = new Decimal(70).plus(frac.times(15));
    status = "halfway";
    driverAr = `تجاوز نصف الطريق نحو الاستقلال المالي (${ratio.times(100).toFixed(1)}%).`;
  } else if (ratio.gte(0.25)) {
    // 0.25 <= Ratio < 0.50: 45 + ((Ratio - 0.25) / 0.25) * 25
    const frac = ratio.minus(0.25).div(0.25);
    score = new Decimal(45).plus(frac.times(25));
    status = "accumulating";
    driverAr = `مرحلة التراكم النشط (${ratio.times(100).toFixed(1)}% من المستهدف).`;
  } else {
    // 0 <= Ratio < 0.25: max(10, 180 * Ratio)
    const boundedRatio = ratio.lt(0) ? new Decimal(0) : ratio;
    score = Decimal.max(new Decimal(10), boundedRatio.times(180));
    status = "early_stage";
    driverAr = `المرحلة المبكرة من بناء قاعدة الأصول الاستثمارية (${ratio.times(100).toFixed(1)}%).`;
  }

  score = clampDec(score, new Decimal(0), new Decimal(100));

  return {
    score,
    fiProgressRatio: ratio,
    investableAssets: Ainv,
    kFiBaseline,
    actualAnnualSpending: Sactual,
    baselineSwr: swr,
    status,
    driverAr,
  };
}

// ============================================================================
// 9. OVERALL WEALTH HEALTH SCORE PACKAGE
// ============================================================================

export function calculateWealthHealthScore(
  d1: Dimension1LiquidityResult,
  d2: Dimension2DebtResult,
  d3: Dimension3SavingsResult,
  d4: Dimension4DiversificationResult,
  d5: Dimension5ResilienceResult,
  d6: Dimension6FiProgressResult,
  confidence: WealthHealthScorePackage["confidence"],
  asOf: number = Date.now()
): WealthHealthScorePackage {
  const w1 = new Decimal("0.20");
  const w2 = new Decimal("0.20");
  const w3 = new Decimal("0.20");
  const w4 = new Decimal("0.15");
  const w5 = new Decimal("0.10");
  const w6 = new Decimal("0.15");

  const totalScore = clampDec(
    d1.score.times(w1)
      .plus(d2.score.times(w2))
      .plus(d3.score.times(w3))
      .plus(d4.score.times(w4))
      .plus(d5.score.times(w5))
      .plus(d6.score.times(w6)),
    new Decimal(0),
    new Decimal(100)
  );

  let ratingTier: WealthHealthScorePackage["ratingTier"];
  let ratingTierLabelAr: string;

  if (totalScore.gte(85)) {
    ratingTier = "excellent";
    ratingTierLabelAr = "ممتاز — مرونة مالية واستقرار استثنائي";
  } else if (totalScore.gte(70)) {
    ratingTier = "good";
    ratingTierLabelAr = "جيد — نمو متوازن ومخاطر مضبوطة";
  } else if (totalScore.gte(50)) {
    ratingTier = "moderate";
    ratingTierLabelAr = "متوسط — توجد جوانب تتطلب تدعيمًا وإعادة هيكلة";
  } else {
    ratingTier = "critical";
    ratingTierLabelAr = "حرج — مخاطر سيولة أو مديونية مرتفعة تتطلب تدخلاً فوريًا";
  }

  return {
    totalScore,
    ratingTier,
    ratingTierLabelAr,
    asOf,
    dimensions: {
      liquidity: d1,
      debtSustainability: d2,
      savingsVelocity: d3,
      diversification: d4,
      resilienceProtection: d5,
      fiProgress: d6,
    },
    weights: {
      liquidity: w1,
      debtSustainability: w2,
      savingsVelocity: w3,
      diversification: w4,
      resilienceProtection: w5,
      fiProgress: w6,
    },
    confidence,
  };
}

// ============================================================================
// 10. DETERMINISTIC DATA QUALITY & CONFIDENCE EVALUATOR
// ============================================================================

export interface ConfidenceEvaluatorInputs {
  historyMonths: number;
  totalAccounts: number;
  reconciledOrActiveAccounts: number;
  totalExpenseVolume: Decimal | string | number;
  categorizedExpenseVolume: Decimal | string | number;
  freshAssetValue: Decimal | string | number;
  totalEconomicAssets: Decimal | string | number;
  unvaluedForeignCurrenciesCount: number;
}

export function deriveDataConfidence(
  inputs: ConfidenceEvaluatorInputs
): WealthHealthScorePackage["confidence"] {
  const warningsAr: string[] = [];

  const totalAccts = inputs.totalAccounts <= 0 ? 1 : inputs.totalAccounts;
  const acctComp = toDec(inputs.reconciledOrActiveAccounts).div(totalAccts);

  const totalExp = toDec(inputs.totalExpenseVolume);
  const catExp = toDec(inputs.categorizedExpenseVolume);
  const expComp = totalExp.lte(0) ? new Decimal(1) : catExp.div(totalExp);

  // C_comp = 0.5 * (N_valid / N_total) + 0.5 * (V_cat / V_total)
  const completenessPercent = clampDec(
    acctComp.times(0.5).plus(expComp.times(0.5)),
    new Decimal(0),
    new Decimal(1)
  );

  const Aecon = toDec(inputs.totalEconomicAssets);
  const freshVal = toDec(inputs.freshAssetValue);
  const freshnessRatio = Aecon.lte(0)
    ? new Decimal(1)
    : clampDec(freshVal.div(Aecon), new Decimal(0), new Decimal(1));

  let level: "high" | "medium" | "low";

  if (inputs.unvaluedForeignCurrenciesCount > 0) {
    level = "low";
    warningsAr.push(`توجد عملات أجنبية (${inputs.unvaluedForeignCurrenciesCount}) بدون سعر صرف معتمد إلى عملة الأساس.`);
  } else if (
    inputs.historyMonths < 6 ||
    completenessPercent.lt(0.75) ||
    freshnessRatio.lt(0.65)
  ) {
    level = "low";
    if (inputs.historyMonths < 6) {
      warningsAr.push(`تاريخ الدفتر المحاسبي المسجل (${inputs.historyMonths} أشهر) أقل من الحد الأدنى للثقة العالية (6 أشهر).`);
    }
    if (completenessPercent.lt(0.75)) {
      warningsAr.push(`نسبة اكتمال تصنيف الحسابات والمصروفات (${completenessPercent.times(100).toFixed(0)}%) دون المعيار المستهدف (75%).`);
    }
    if (freshnessRatio.lt(0.65)) {
      warningsAr.push(`نسبة الأصول ذات التقييمات الحديثة (${freshnessRatio.times(100).toFixed(0)}%) أقل من 65%؛ يرجى تحديث تقييمات الأصول.`);
    }
  } else if (
    inputs.historyMonths >= 12 &&
    completenessPercent.gte(0.90) &&
    freshnessRatio.gte(0.85)
  ) {
    level = "high";
  } else {
    level = "medium";
    if (inputs.historyMonths < 12) {
      warningsAr.push(`تاريخ الدفتر (${inputs.historyMonths} أشهر) لم يكتمل سنة كاملة (12 شهرًا) بعد.`);
    }
    if (freshnessRatio.lt(0.85)) {
      warningsAr.push(`بعض الأصول تحتاج لتحديث تقييمها الموسمي للوصول إلى أعلى درجات الدقة.`);
    }
  }

  return {
    level,
    completenessPercent,
    historyMonths: inputs.historyMonths,
    freshnessRatio,
    warningsAr,
  };
}

// ============================================================================
// 11. DETERMINISTIC FI/FIRE HORIZON CALCULATION ENGINE
// ============================================================================

export interface FireHorizonInputs {
  investableAssets: Decimal | string | number;
  annualSpending: Decimal | string | number;
  swr: Decimal | string | number;
  nominalReturn: Decimal | string | number;
  inflation: Decimal | string | number;
  monthlyContribution: Decimal | string | number;
  asOfDate?: Date;
}

export function calculateFireHorizon(inputs: FireHorizonInputs): FireHorizonResult {
  const A0 = toDec(inputs.investableAssets);
  const S = toDec(inputs.annualSpending);
  const swr = toDec(inputs.swr);
  const rNom = toDec(inputs.nominalReturn);
  const iInf = toDec(inputs.inflation);
  const C = toDec(inputs.monthlyContribution);
  const asOf = inputs.asOfDate ?? new Date();

  // Validate basic economic invariants
  if (swr.lte(0)) {
    throw new Error(`Invalid safe withdrawal rate (SWR): ${swr.toString()}. Must be positive.`);
  }

  // K_FI = S / SWR
  const KFI = S.div(swr);
  const gapCorpus = KFI.minus(A0).lt(0) ? new Decimal(0) : KFI.minus(A0);

  // Exact Fisher real return
  const rReal = calculateFisherRealRate(rNom, iInf);
  const rm = calculateMonthlyRealRate(rReal);

  // ==========================================================================
  // STATE MATRIX IMPLEMENTATION
  // ==========================================================================

  // State 1: FI Already Achieved (A0 >= KFI)
  if (A0.gte(KFI)) {
    return {
      status: "achieved",
      statusLabelAr: "الاستقلال المالي محقق بالفعل",
      isReachable: true,
      horizonMonths: 0,
      horizonYears: new Decimal(0),
      projectedDate: asOf.toISOString().slice(0, 10),
      targetCorpus: KFI,
      investableAssets: A0,
      annualSpending: S,
      swr,
      nominalReturn: rNom,
      inflation: iInf,
      realReturn: rReal,
      monthlyRealRate: rm,
      monthlyContribution: C,
      gapCorpus: new Decimal(0),
      verifiedExact: true,
    };
  }

  // From here onward: A0 < KFI
  let status: FireHorizonStatus;
  let statusLabelAr: string;
  let isReachable: boolean;
  let mReal: Decimal | null = null;
  let mInt: number | null = null;

  // State 2: Zero Real Growth (r_real == 0 => rm == 0)
  if (rReal.isZero() || rm.isZero()) {
    if (C.gt(0)) {
      // Case 2A: Linear accumulation
      status = "reachable_linear";
      statusLabelAr = "قابل للتحقيق عبر التوفير المالي الخطي";
      isReachable = true;
      mReal = KFI.minus(A0).div(C);
      mInt = mReal.ceil().toNumber();
    } else {
      // Case 2B: Zero growth and no savings surplus
      status = "unreachable_zero_growth";
      statusLabelAr = "غير قابل للتحقيق (عائد حقيقي صفري مع انعدام الفائض الشهري)";
      isReachable = false;
    }
  }
  // State 3: Positive Real Growth (r_real > 0 => rm > 0)
  else if (rReal.gt(0)) {
    if (C.gt(0)) {
      // Case 3A: Reachable compounding with positive savings
      status = "reachable_compounding";
      statusLabelAr = "قابل للتحقيق عبر النمو المركب والادخار الشهري";
      isReachable = true;
      const num = KFI.plus(C.div(rm));
      const den = A0.plus(C.div(rm));
      mReal = decLn(num.div(den)).div(decLn(new Decimal(1).plus(rm)));
      mInt = mReal.ceil().toNumber();
    } else if (C.isZero()) {
      // Case 3B: Pure compounding on initial capital
      status = "reachable_compounding";
      statusLabelAr = "قابل للتحقيق عبر النمو المركب لرأس المال الحالي";
      isReachable = true;
      mReal = decLn(KFI.div(A0)).div(decLn(new Decimal(1).plus(rm)));
      mInt = mReal.ceil().toNumber();
    } else {
      // Case 3C: C < 0 (Monthly Deficit / Withdrawals)
      // A_inf = -C / rm = |C| / rm > 0 (critical steady-state)
      const Ainf = C.negated().div(rm);

      if (A0.lte(Ainf)) {
        // Sub-case 3C.1: Withdrawals overwhelm or balance portfolio returns
        // - If A0 < Ainf: trajectory strictly decreases below A0 (eventual depletion).
        // - If A0 == Ainf: stationary fixed equilibrium A(m) = Ainf for all m (returns exactly balance withdrawals).
        // In both cases, since A0 < KFI (and thus KFI > Ainf), the target KFI is mathematically unreachable.
        status = "unreachable_positive_return_negative_contribution";
        statusLabelAr = A0.eq(Ainf)
          ? "غير قابل للتحقيق (نقطة توازن مستقرة: العائد الحقيقي يعادل السحب تمامًا دون بلوغ المستهدف)"
          : "غير قابل للتحقيق (السحب الشهري يتجاوز العائد الحقيقي للمحفظة)";
        isReachable = false;
      } else {
        // Sub-case 3C.2: A0 > A_inf, returns outpace withdrawals, growing toward KFI
        status = "reachable_compounding";
        statusLabelAr = "قابل للتحقيق عبر نمو المحفظة الصافي فوق السحوبات";
        isReachable = true;
        const num = KFI.minus(Ainf);
        const den = A0.minus(Ainf);
        mReal = decLn(num.div(den)).div(decLn(new Decimal(1).plus(rm)));
        mInt = mReal.ceil().toNumber();
      }
    }
  }
  // State 4: Negative Real Growth (r_real < 0 => rm < 0)
  else {
    const rho = rm.abs(); // |r_m| in (0, 1)
    if (C.lte(0)) {
      // Case 4A: Deficit and negative return
      status = "unreachable_deficit";
      statusLabelAr = "غير قابل للتحقيق (عائد حقيقي سلبي مع عجز شهري)";
      isReachable = false;
    } else {
      // Asymptotic equilibrium ceiling: A_inf = C / |r_m|
      const Ainf = C.div(rho);
      if (KFI.gte(Ainf)) {
        // Case 4B: Target exceeds maximum asymptotic ceiling
        status = "unreachable_negative_real_return";
        statusLabelAr = "غير قابل للتحقيق (تآكل القوة الشرائية يضع سقفًا دون المستهدف)";
        isReachable = false;
      } else {
        // Case 4C: Savings surplus overcomes purchasing power decay to reach target
        status = "reachable_decay_overcome";
        statusLabelAr = "قابل للتحقيق بتفوق الفائض الشهري على تآكل القوة الشرائية";
        isReachable = true;
        const num = Ainf.minus(KFI);
        const den = Ainf.minus(A0);
        const oneMinusRho = new Decimal(1).minus(rho);
        mReal = decLn(num.div(den)).div(decLn(oneMinusRho));
        mInt = mReal.ceil().toNumber();
      }
    }
  }

  // ==========================================================================
  // INTEGER HORIZON VERIFICATION (DECIMAL ARITHMETIC)
  // ==========================================================================

  let verifiedExact = false;
  let horizonYears: Decimal | null = null;
  let projectedDate: string | null = null;

  if (isReachable && mInt !== null && mInt >= 0) {
    // Boundary check using 40-digit Decimal arithmetic:
    // Smallest integer m >= 0 such that A(m) >= KFI
    while (computePortfolioAtMonth(A0, C, rm, mInt).lt(KFI)) {
      mInt++;
    }
    while (mInt > 0 && computePortfolioAtMonth(A0, C, rm, mInt - 1).gte(KFI)) {
      mInt--;
    }

    const checkAtM = computePortfolioAtMonth(A0, C, rm, mInt);
    const checkPrior = mInt > 0 ? computePortfolioAtMonth(A0, C, rm, mInt - 1) : null;

    if (checkAtM.gte(KFI) && (checkPrior === null || checkPrior.lt(KFI))) {
      verifiedExact = true;
    }

    horizonYears = new Decimal(mInt).div(12);

    // Calculate projected date
    const targetDate = new Date(asOf.getTime());
    targetDate.setMonth(targetDate.getMonth() + mInt);
    projectedDate = targetDate.toISOString().slice(0, 10);
  }

  return {
    status,
    statusLabelAr,
    isReachable,
    horizonMonths: mInt,
    horizonYears,
    projectedDate,
    targetCorpus: KFI,
    investableAssets: A0,
    annualSpending: S,
    swr,
    nominalReturn: rNom,
    inflation: iInf,
    realReturn: rReal,
    monthlyRealRate: rm,
    monthlyContribution: C,
    gapCorpus,
    verifiedExact,
  };
}

// ============================================================================
// 12. THREE STANDARD SCENARIOS GENERATOR
// ============================================================================

export interface ScenarioGeneratorInputs {
  investableAssets: Decimal | string | number;
  ttmActualLivingExpenses: Decimal | string | number;
  ttmEssentialLivingExpenses: Decimal | string | number;
  monthlyContribution: Decimal | string | number;
  asOfDate?: Date;
}

export function generateStandardFireScenarios(
  inputs: ScenarioGeneratorInputs
): {
  conservative: FireScenarioPlan;
  base: FireScenarioPlan;
  optimistic: FireScenarioPlan;
} {
  const Sactual = toDec(inputs.ttmActualLivingExpenses);
  const Sess = toDec(inputs.ttmEssentialLivingExpenses);
  const A0 = toDec(inputs.investableAssets);
  const C = toDec(inputs.monthlyContribution);

  // 1. Conservative Scenario:
  // Nominal: 4.5%, Inflation: 4.0%, SWR: 3.25%, Spending: TTM Actual * 1.10
  const conservativeSpending = Sactual.times("1.10");
  const conservativeNominal = new Decimal("0.045");
  const conservativeInflation = new Decimal("0.040");
  const conservativeSwr = new Decimal("0.0325");
  const conservativeResult = calculateFireHorizon({
    investableAssets: A0,
    annualSpending: conservativeSpending,
    swr: conservativeSwr,
    nominalReturn: conservativeNominal,
    inflation: conservativeInflation,
    monthlyContribution: C,
    asOfDate: inputs.asOfDate,
  });

  const conservativePlan: FireScenarioPlan = {
    name: "conservative",
    nameLabelAr: "السيناريو المتحفظ",
    nominalReturn: conservativeNominal,
    inflation: conservativeInflation,
    realReturn: conservativeResult.realReturn,
    swr: conservativeSwr,
    annualSpending: conservativeSpending,
    monthlyContribution: C,
    horizonResult: conservativeResult,
  };

  // 2. Base Case Scenario:
  // Nominal: 7.0%, Inflation: 3.0%, SWR: 4.0%, Spending: TTM Actual
  const baseSpending = Sactual;
  const baseNominal = new Decimal("0.070");
  const baseInflation = new Decimal("0.030");
  const baseSwr = new Decimal("0.040");
  const baseResult = calculateFireHorizon({
    investableAssets: A0,
    annualSpending: baseSpending,
    swr: baseSwr,
    nominalReturn: baseNominal,
    inflation: baseInflation,
    monthlyContribution: C,
    asOfDate: inputs.asOfDate,
  });

  const basePlan: FireScenarioPlan = {
    name: "base",
    nameLabelAr: "سيناريو الأساس (الواقعي)",
    nominalReturn: baseNominal,
    inflation: baseInflation,
    realReturn: baseResult.realReturn,
    swr: baseSwr,
    annualSpending: baseSpending,
    monthlyContribution: C,
    horizonResult: baseResult,
  };

  // 3. Optimistic Scenario:
  // Nominal: 9.5%, Inflation: 2.5%, SWR: 4.5%, Spending: TTM Essential
  const optimisticSpending = Sess.gt(0) ? Sess : Sactual.times("0.80");
  const optimisticNominal = new Decimal("0.095");
  const optimisticInflation = new Decimal("0.025");
  const optimisticSwr = new Decimal("0.045");
  const optimisticResult = calculateFireHorizon({
    investableAssets: A0,
    annualSpending: optimisticSpending,
    swr: optimisticSwr,
    nominalReturn: optimisticNominal,
    inflation: optimisticInflation,
    monthlyContribution: C,
    asOfDate: inputs.asOfDate,
  });

  const optimisticPlan: FireScenarioPlan = {
    name: "optimistic",
    nameLabelAr: "السيناريو المتفائل (Lean FIRE)",
    nominalReturn: optimisticNominal,
    inflation: optimisticInflation,
    realReturn: optimisticResult.realReturn,
    swr: optimisticSwr,
    annualSpending: optimisticSpending,
    monthlyContribution: C,
    horizonResult: optimisticResult,
  };

  return {
    conservative: conservativePlan,
    base: basePlan,
    optimistic: optimisticPlan,
  };
}
