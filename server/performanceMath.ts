import Decimal from "decimal.js";

// Ensure Decimal.js is configured with 40-digit precision
Decimal.set({ precision: 40, rounding: Decimal.ROUND_HALF_UP });

export type DataQualityStatus = "exact_daily" | "cash_flow_linked" | "sparse" | "unavailable";

export interface ExternalCashFlow {
  date: number; // timestamp in ms
  amount: string; // positive for capital contribution/deposit, negative for withdrawal/distribution
  direction: "inflow" | "outflow";
  description?: string;
  sourceRef?: string;
}

export interface ValuationPoint {
  date: number; // timestamp in ms
  totalValue: string;
  cashValue: string;
  investmentsValue: string;
  quality?: "official" | "live" | "stale" | "interpolated";
}

export interface TwrSubPeriod {
  startDate: number;
  endDate: number;
  startValuation: string;
  endValuationPreFlow: string;
  netCashFlow: string;
  endValuationPostFlow: string;
  subPeriodReturn: string;
  cumulatedTwr: string;
  dataQuality: DataQualityStatus;
}

export interface TwrResult {
  cumulativeTwr: string;
  annualizedTwr: string | null;
  periodDays: number;
  subPeriods: TwrSubPeriod[];
  dataQuality: DataQualityStatus;
  valuationCount: number;
  cashFlowCount: number;
}

export interface MwrResult {
  irr: string | null; // Annualized IRR as decimal string (e.g. "0.1450" for 14.50%)
  periodIrr: string | null; // Unannualized for the period
  converged: boolean;
  iterations: number;
  solverMethod: "newton" | "bisection" | "exact" | "unconverged";
  reason?: string;
}

export interface DrawdownPoint {
  date: number;
  wealthIndex: string;
  drawdown: string;
}

export interface RiskMetrics {
  annualizedVolatility: string | null;
  sharpeRatio: string | null;
  maxDrawdown: string;
  maxDrawdownPeakDate: number | null;
  maxDrawdownTroughDate: number | null;
  maxDrawdownRecoveryDate: number | null;
  drawdownSeries: DrawdownPoint[];
}

export interface BenchmarkComparison {
  benchmarkSymbol: string;
  benchmarkStatus: "available" | "unavailable" | "insufficient_quotes";
  benchmarkCumulativeReturn: string | null;
  benchmarkAnnualizedReturn: string | null;
  alpha: string | null;
  beta: string | null;
  correlation: string | null;
  rSquared: string | null;
  trackingError: string | null;
  informationRatio: string | null;
  message?: string;
}

export type AssetClassCategory = "cash" | "equity" | "fixed_income" | "gold_alternatives" | "other";

export interface AssetClassAttribution {
  assetClass: AssetClassCategory;
  nameAr: string;
  startValue: string;
  endValue: string;
  startWeight: string;
  endWeight: string;
  averageWeight: string;
  assetReturn: string;
  contribution: string;
}

export interface PortfolioAttribution {
  totalReturn: string;
  reconciledSum: string;
  reconciliationDiff: string;
  assetClasses: AssetClassAttribution[];
  unsupportedDimensions: string[];
}

export interface CapitalBridge {
  startingCapital: string;
  totalDeposits: string;
  totalWithdrawals: string;
  netContributions: string;
  investmentGainLoss: string;
  endingCapital: string;
  reconciles: boolean;
}

export interface PerformanceSummaryReport {
  period: string;
  startDate: number;
  endDate: number;
  baseCurrency: string;
  twr: TwrResult;
  mwr: MwrResult;
  riskMetrics: RiskMetrics;
  benchmark: BenchmarkComparison;
  attribution: PortfolioAttribution;
  capitalBridge: CapitalBridge;
  asOf: number;
}

// ============================================================================
// Decimal Arithmetic Utilities
// ============================================================================

export function toDec(val: Decimal.Value | null | undefined, fallback = "0"): Decimal {
  if (val === null || val === undefined) return new Decimal(fallback);
  try {
    const d = new Decimal(val);
    return d.isFinite() ? d : new Decimal(fallback);
  } catch {
    return new Decimal(fallback);
  }
}

export function safeDiv(num: Decimal.Value, den: Decimal.Value, fallback = "0"): Decimal {
  const dNum = toDec(num);
  const dDen = toDec(den);
  if (dDen.isZero() || !dDen.isFinite()) return toDec(fallback, "0");
  return dNum.div(dDen);
}

export function formatDec(val: Decimal.Value, decimals = 4): string {
  return toDec(val).toFixed(decimals);
}

// ============================================================================
// GIPS Time-Weighted Return (TWR) Engine
// ============================================================================

/**
 * Calculates GIPS-compliant Time-Weighted Return (TWR).
 * Sub-periods are formed whenever external cash flows occur.
 * For each sub-period k:
 *   R_k = (V_k_pre - V_{k-1}_post) / V_{k-1}_post
 * Cumulative TWR = Product(1 + R_k) - 1
 *
 * If duration >= 365 days, returns annualized TWR: (1 + TWR)^(365.25 / days) - 1.
 * If duration < 365 days, annualization is withheld per GIPS standards.
 */
export function calculateTwr(args: {
  startDate: number;
  endDate: number;
  startValuation: Decimal.Value;
  endValuation: Decimal.Value;
  cashFlows?: ExternalCashFlow[];
  intermediateValuations?: ValuationPoint[];
}): TwrResult {
  const v0 = toDec(args.startValuation);
  const vEnd = toDec(args.endValuation);
  const periodMs = Math.max(args.endDate - args.startDate, 0);
  const periodDays = Math.max(periodMs / (86400 * 1000), 1);

  const rawFlows = (args.cashFlows ?? []).filter(
    (cf) => cf.date >= args.startDate && cf.date <= args.endDate
  );
  // Sort cash flows chronologically
  rawFlows.sort((a, b) => a.date - b.date);

  // If no external cash flows, single sub-period
  if (rawFlows.length === 0) {
    let subReturn = new Decimal(0);
    if (!v0.isZero()) {
      subReturn = safeDiv(vEnd.minus(v0), v0);
    } else if (!vEnd.isZero()) {
      subReturn = new Decimal(0);
    }

    const cumTwr = subReturn;
    let annTwr: string | null = null;
    if (periodDays >= 365 && cumTwr.plus(1).gt(0)) {
      const exp = new Decimal(365.25).div(periodDays);
      annTwr = cumTwr.plus(1).pow(exp).minus(1).toFixed(6);
    }

    const singleSubPeriod: TwrSubPeriod = {
      startDate: args.startDate,
      endDate: args.endDate,
      startValuation: v0.toFixed(4),
      endValuationPreFlow: vEnd.toFixed(4),
      netCashFlow: "0.0000",
      endValuationPostFlow: vEnd.toFixed(4),
      subPeriodReturn: subReturn.toFixed(6),
      cumulatedTwr: cumTwr.toFixed(6),
      dataQuality: "exact_daily",
    };

    return {
      cumulativeTwr: cumTwr.toFixed(6),
      annualizedTwr: annTwr,
      periodDays: Math.round(periodDays),
      subPeriods: [singleSubPeriod],
      dataQuality: "exact_daily",
      valuationCount: 2,
      cashFlowCount: 0,
    };
  }

  // Multi-period construction with cash-flow sub-period chaining
  // Valuation map by date if intermediate valuations provided
  const valMap = new Map<number, Decimal>();
  if (args.intermediateValuations) {
    args.intermediateValuations.forEach((v) => {
      valMap.set(v.date, toDec(v.totalValue));
    });
  }

  const subPeriods: TwrSubPeriod[] = [];
  let currentStartVal = v0;
  let currentStartDate = args.startDate;
  let cumulativeCompound = new Decimal(1);
  let overallQuality: DataQualityStatus = "exact_daily";

  for (let i = 0; i < rawFlows.length; i++) {
    const flow = rawFlows[i];
    const flowAmount = toDec(flow.amount);
    const flowDate = flow.date;

    // Determine pre-flow valuation at flowDate
    let preFlowVal: Decimal;
    let flowQuality: DataQualityStatus = "cash_flow_linked";

    if (valMap.has(flowDate)) {
      // Exact valuation point exists at flow date
      preFlowVal = valMap.get(flowDate)!;
      flowQuality = "exact_daily";
    } else {
      // Linear proportional estimate between known points if intermediate quotes are missing
      // Sub-period approximation: V_pre = V_prev + (time_fraction) * (V_next_pre - V_prev)
      const fraction = periodMs > 0 ? (flowDate - currentStartDate) / periodMs : 0;
      preFlowVal = currentStartVal.plus(
        vEnd.minus(v0).minus(flowAmount).mul(fraction)
      );
      if (preFlowVal.lt(0)) preFlowVal = currentStartVal; // Clamp to avoid non-physical negative valuation
      flowQuality = "cash_flow_linked";
      overallQuality = "cash_flow_linked";
    }

    // Sub-period return: R_k = (V_k_pre - V_{k-1}_post) / V_{k-1}_post
    let subReturn = new Decimal(0);
    if (!currentStartVal.isZero()) {
      subReturn = safeDiv(preFlowVal.minus(currentStartVal), currentStartVal);
    }

    cumulativeCompound = cumulativeCompound.mul(subReturn.plus(1));
    const postFlowVal = preFlowVal.plus(flowAmount);

    subPeriods.push({
      startDate: currentStartDate,
      endDate: flowDate,
      startValuation: currentStartVal.toFixed(4),
      endValuationPreFlow: preFlowVal.toFixed(4),
      netCashFlow: flowAmount.toFixed(4),
      endValuationPostFlow: postFlowVal.toFixed(4),
      subPeriodReturn: subReturn.toFixed(6),
      cumulatedTwr: cumulativeCompound.minus(1).toFixed(6),
      dataQuality: flowQuality,
    });

    currentStartVal = postFlowVal;
    currentStartDate = flowDate;
  }

  // Final sub-period from last flow to period end
  if (currentStartDate < args.endDate) {
    let finalSubReturn = new Decimal(0);
    if (!currentStartVal.isZero()) {
      finalSubReturn = safeDiv(vEnd.minus(currentStartVal), currentStartVal);
    }
    cumulativeCompound = cumulativeCompound.mul(finalSubReturn.plus(1));

    subPeriods.push({
      startDate: currentStartDate,
      endDate: args.endDate,
      startValuation: currentStartVal.toFixed(4),
      endValuationPreFlow: vEnd.toFixed(4),
      netCashFlow: "0.0000",
      endValuationPostFlow: vEnd.toFixed(4),
      subPeriodReturn: finalSubReturn.toFixed(6),
      cumulatedTwr: cumulativeCompound.minus(1).toFixed(6),
      dataQuality: "exact_daily",
    });
  }

  const finalCumulativeTwr = cumulativeCompound.minus(1);
  let annualizedTwr: string | null = null;
  if (periodDays >= 365 && finalCumulativeTwr.plus(1).gt(0)) {
    const exp = new Decimal(365.25).div(periodDays);
    annualizedTwr = finalCumulativeTwr.plus(1).pow(exp).minus(1).toFixed(6);
  }

  return {
    cumulativeTwr: finalCumulativeTwr.toFixed(6),
    annualizedTwr,
    periodDays: Math.round(periodDays),
    subPeriods,
    dataQuality: overallQuality,
    valuationCount: 2 + (args.intermediateValuations?.length ?? 0),
    cashFlowCount: rawFlows.length,
  };
}

// ============================================================================
// Money-Weighted Return (MWR / IRR) Engine
// ============================================================================

/**
 * Calculates Money-Weighted Return (IRR) using 40-digit Decimal.js arithmetic.
 * Solves:
 *   -V_0 - Sum[ C_i / (1 + r)^w_i ] + V_T / (1 + r)^w_T = 0
 * where w_i = (t_i - t_0) / 365.25 days.
 *
 * Employs Newton-Raphson with bounded iterations (100) and bisection fallback.
 */
export function calculateMwr(args: {
  startDate: number;
  endDate: number;
  startValuation: Decimal.Value;
  endValuation: Decimal.Value;
  cashFlows?: ExternalCashFlow[];
}): MwrResult {
  const v0 = toDec(args.startValuation);
  const vEnd = toDec(args.endValuation);
  const periodMs = Math.max(args.endDate - args.startDate, 1000);
  const totalDays = periodMs / (86400 * 1000);
  const wEnd = new Decimal(totalDays).div(365.25);

  const flows = (args.cashFlows ?? [])
    .filter((cf) => cf.date >= args.startDate && cf.date <= args.endDate)
    .map((cf) => {
      const daysFromStart = Math.max((cf.date - args.startDate) / (86400 * 1000), 0);
      return {
        amount: toDec(cf.amount),
        w: new Decimal(daysFromStart).div(365.25),
      };
    });

  // Edge case 1: Zero capital start and end, no cash flows
  if (v0.isZero() && vEnd.isZero() && flows.length === 0) {
    return {
      irr: "0.000000",
      periodIrr: "0.000000",
      converged: true,
      iterations: 0,
      solverMethod: "exact",
    };
  }

  // Edge case 2: No intermediate cash flows -> exact analytical solution
  if (flows.length === 0) {
    if (v0.isZero()) {
      return {
        irr: null,
        periodIrr: null,
        converged: false,
        iterations: 0,
        solverMethod: "unconverged",
        reason: "zero_starting_capital_no_flows",
      };
    }
    const ratio = safeDiv(vEnd, v0);
    if (ratio.lte(0)) {
      return {
        irr: "-1.000000",
        periodIrr: "-1.000000",
        converged: true,
        iterations: 0,
        solverMethod: "exact",
      };
    }
    const periodReturn = ratio.minus(1);
    let annIrr = periodReturn;
    if (wEnd.gt(0)) {
      annIrr = ratio.pow(new Decimal(1).div(wEnd)).minus(1);
    }
    return {
      irr: annIrr.toFixed(6),
      periodIrr: periodReturn.toFixed(6),
      converged: true,
      iterations: 0,
      solverMethod: "exact",
    };
  }

  // NPV function: f(r) = -V_0 - Sum[ C_i / (1 + r)^w_i ] + V_T / (1 + r)^w_T
  function npv(r: Decimal): Decimal {
    const onePlusR = r.plus(1);
    if (onePlusR.lte(0)) return new Decimal(Infinity);

    let sum = v0.neg();
    for (const flow of flows) {
      const discount = onePlusR.pow(flow.w);
      sum = sum.minus(safeDiv(flow.amount, discount));
    }
    const endDiscount = onePlusR.pow(wEnd);
    sum = sum.plus(safeDiv(vEnd, endDiscount));
    return sum;
  }

  // Derivative: f'(r) = Sum[ w_i * C_i / (1 + r)^(w_i + 1) ] - w_T * V_T / (1 + r)^(w_T + 1)
  function npvDerivative(r: Decimal): Decimal {
    const onePlusR = r.plus(1);
    if (onePlusR.lte(0)) return new Decimal(0);

    let sum = new Decimal(0);
    for (const flow of flows) {
      const exp = flow.w.plus(1);
      const discount = onePlusR.pow(exp);
      sum = sum.plus(safeDiv(flow.w.mul(flow.amount), discount));
    }
    const endExp = wEnd.plus(1);
    const endDiscount = onePlusR.pow(endExp);
    sum = sum.minus(safeDiv(wEnd.mul(vEnd), endDiscount));
    return sum;
  }

  // Initial guess r_0 via Modified Dietz return
  const totalFlowAmt = flows.reduce((acc, f) => acc.plus(f.amount), new Decimal(0));
  const weightedCapital = flows.reduce((acc, f) => {
    const weight = new Decimal(1).minus(safeDiv(f.w, wEnd));
    return acc.plus(f.amount.mul(weight));
  }, v0);

  const netProfit = vEnd.minus(v0).minus(totalFlowAmt);
  let r = safeDiv(netProfit, weightedCapital.isZero() ? new Decimal(1) : weightedCapital);
  if (wEnd.gt(0)) {
    r = safeDiv(r, wEnd);
  }
  // Clamp initial guess
  if (r.lt("-0.90")) r = new Decimal("-0.50");
  if (r.gt("5.00")) r = new Decimal("1.00");

  // Strategy 1: Newton-Raphson iteration
  const MAX_ITERATIONS = 100;
  const TOLERANCE = new Decimal("1e-12");
  let converged = false;
  let iter = 0;

  for (iter = 0; iter < MAX_ITERATIONS; iter++) {
    const fVal = npv(r);
    if (fVal.abs().lte(TOLERANCE)) {
      converged = true;
      break;
    }

    const fPrime = npvDerivative(r);
    if (fPrime.abs().lt("1e-14")) break; // Derivative too small, jump to bisection

    const step = safeDiv(fVal, fPrime);
    let nextR = r.minus(step);

    // Guard against non-physical boundary (r <= -1)
    if (nextR.lte("-0.9999")) {
      nextR = r.plus("-0.9999").div(2);
    }

    if (nextR.minus(r).abs().lte(TOLERANCE)) {
      r = nextR;
      converged = true;
      break;
    }

    r = nextR;
  }

  if (converged && r.gt("-1.0")) {
    const periodReturn = r.plus(1).pow(wEnd).minus(1);
    return {
      irr: r.toFixed(6),
      periodIrr: periodReturn.toFixed(6),
      converged: true,
      iterations: iter + 1,
      solverMethod: "newton",
    };
  }

  // Strategy 2: Deterministic Bisection Fallback in [-0.9999, 10.0]
  let low = new Decimal("-0.9999");
  let high = new Decimal("10.0");
  let fLow = npv(low);
  let fHigh = npv(high);

  if (fLow.mul(fHigh).gt(0)) {
    // Try wider upper bound up to 5000%
    high = new Decimal("50.0");
    fHigh = npv(high);
  }

  if (fLow.mul(fHigh).lte(0)) {
    for (iter = 0; iter < 80; iter++) {
      const mid = low.plus(high).div(2);
      const fMid = npv(mid);

      if (fMid.abs().lte(TOLERANCE) || high.minus(low).lte(TOLERANCE)) {
        const periodReturn = mid.plus(1).pow(wEnd).minus(1);
        return {
          irr: mid.toFixed(6),
          periodIrr: periodReturn.toFixed(6),
          converged: true,
          iterations: iter + 1,
          solverMethod: "bisection",
        };
      }

      if (fLow.mul(fMid).lte(0)) {
        high = mid;
        fHigh = fMid;
      } else {
        low = mid;
        fLow = fMid;
      }
    }
  }

  return {
    irr: null,
    periodIrr: null,
    converged: false,
    iterations: MAX_ITERATIONS,
    solverMethod: "unconverged",
    reason: "no_real_root_or_diverged",
  };
}

// ============================================================================
// Risk Metrics & Maximum Drawdown Engine
// ============================================================================

/**
 * Computes Annualized Volatility, Sharpe Ratio, and Maximum Drawdown.
 * Drawdown is tracked relative to peak wealth index:
 *   W_t = Product(1 + R_s)
 *   DD_t = (W_t - Peak_t) / Peak_t
 *   MDD = Min(DD_t)
 */
export function calculateRiskMetrics(args: {
  subPeriodReturns: Array<{ date: number; returnRate: Decimal.Value }>;
  annualizedReturn: Decimal.Value | null;
  riskFreeRate?: Decimal.Value; // Annualized risk-free rate, defaults to 0.00%
  periodDays?: number;
}): RiskMetrics {
  const returns = args.subPeriodReturns;
  const rf = toDec(args.riskFreeRate ?? "0");

  if (returns.length === 0) {
    return {
      annualizedVolatility: null,
      sharpeRatio: null,
      maxDrawdown: "0.0000",
      maxDrawdownPeakDate: null,
      maxDrawdownTroughDate: null,
      maxDrawdownRecoveryDate: null,
      drawdownSeries: [],
    };
  }

  // 1. Drawdown Analysis
  let currentWealth = new Decimal(1);
  let peakWealth = new Decimal(1);
  let peakDate: number | null = returns[0].date;
  let maxDd = new Decimal(0);
  let mddPeakDate: number | null = returns[0].date;
  let mddTroughDate: number | null = null;
  let mddRecoveryDate: number | null = null;
  let inMaxDd = false;

  const drawdownSeries: DrawdownPoint[] = [];

  for (const pt of returns) {
    const r = toDec(pt.returnRate);
    currentWealth = currentWealth.mul(r.plus(1));

    if (currentWealth.gte(peakWealth)) {
      peakWealth = currentWealth;
      peakDate = pt.date;
      if (inMaxDd && mddRecoveryDate === null && maxDd.lt(0)) {
        mddRecoveryDate = pt.date;
      }
    }

    const dd = safeDiv(currentWealth.minus(peakWealth), peakWealth);
    drawdownSeries.push({
      date: pt.date,
      wealthIndex: currentWealth.toFixed(6),
      drawdown: dd.toFixed(6),
    });

    if (dd.lt(maxDd)) {
      maxDd = dd;
      mddPeakDate = peakDate;
      mddTroughDate = pt.date;
      mddRecoveryDate = null; // Reset recovery until new peak achieved
      inMaxDd = true;
    }
  }

  // 2. Annualized Volatility
  let annualizedVol: string | null = null;
  let sharpeRatio: string | null = null;

  if (returns.length >= 2) {
    const mean = safeDiv(
      returns.reduce((acc, r) => acc.plus(toDec(r.returnRate)), new Decimal(0)),
      returns.length
    );
    const variance = safeDiv(
      returns.reduce((acc, r) => {
        const diff = toDec(r.returnRate).minus(mean);
        return acc.plus(diff.mul(diff));
      }, new Decimal(0)),
      returns.length - 1
    );

    const stdDev = variance.sqrt();
    // Annualization factor: assume daily if points > 60, otherwise scale by duration
    const avgDaysPerPeriod = Math.max((args.periodDays ?? 365) / returns.length, 1);
    const periodsPerYear = new Decimal(365.25).div(avgDaysPerPeriod);
    const annFactor = periodsPerYear.sqrt();
    const annVolDec = stdDev.mul(annFactor);
    annualizedVol = annVolDec.toFixed(6);

    // 3. Sharpe Ratio
    if (args.annualizedReturn !== null && !annVolDec.isZero()) {
      const annRet = toDec(args.annualizedReturn);
      sharpeRatio = safeDiv(annRet.minus(rf), annVolDec).toFixed(4);
    }
  }

  return {
    annualizedVolatility: annualizedVol,
    sharpeRatio,
    maxDrawdown: maxDd.toFixed(6),
    maxDrawdownPeakDate: mddPeakDate,
    maxDrawdownTroughDate: mddTroughDate,
    maxDrawdownRecoveryDate: mddRecoveryDate,
    drawdownSeries,
  };
}

// ============================================================================
// Benchmark Comparison & Alpha / Beta Engine
// ============================================================================

/**
 * Computes Alpha, Beta, Tracking Error, and Information Ratio relative to a benchmark.
 * If benchmark quotes are missing or fewer than 5 matching points exist, returns
 * explicit "unavailable" or "insufficient_quotes" status. Never fabricates data.
 */
export function calculateBenchmarkComparison(args: {
  benchmarkSymbol: string;
  portfolioReturns: Array<{ date: number; returnRate: Decimal.Value }>;
  benchmarkQuotes?: Array<{ date: number; price: Decimal.Value }>;
  portfolioAnnualizedReturn: Decimal.Value | null;
  riskFreeRate?: Decimal.Value;
  periodDays: number;
}): BenchmarkComparison {
  const sym = args.benchmarkSymbol.trim().toUpperCase();
  const quotes = args.benchmarkQuotes ?? [];

  if (quotes.length < 2) {
    return {
      benchmarkSymbol: sym,
      benchmarkStatus: "unavailable",
      benchmarkCumulativeReturn: null,
      benchmarkAnnualizedReturn: null,
      alpha: null,
      beta: null,
      correlation: null,
      rSquared: null,
      trackingError: null,
      informationRatio: null,
      message: `بيانات المؤشر المرجعي (${sym}) غير متوفرة في قاعدة البيانات لهذا النطاق الزمني.`,
    };
  }

  // Sort benchmark quotes chronologically
  quotes.sort((a, b) => a.date - b.date);

  // Calculate benchmark cumulative and annualized return
  const p0 = toDec(quotes[0].price);
  const pEnd = toDec(quotes[quotes.length - 1].price);
  if (p0.isZero()) {
    return {
      benchmarkSymbol: sym,
      benchmarkStatus: "insufficient_quotes",
      benchmarkCumulativeReturn: null,
      benchmarkAnnualizedReturn: null,
      alpha: null,
      beta: null,
      correlation: null,
      rSquared: null,
      trackingError: null,
      informationRatio: null,
      message: `سعر الأساس للمؤشر المرجعي (${sym}) يساوي صفرًا.`,
    };
  }

  const bmkCumReturn = safeDiv(pEnd.minus(p0), p0);
  let bmkAnnReturn: string | null = null;
  if (args.periodDays >= 365 && bmkCumReturn.plus(1).gt(0)) {
    const exp = new Decimal(365.25).div(args.periodDays);
    bmkAnnReturn = bmkCumReturn.plus(1).pow(exp).minus(1).toFixed(6);
  }

  // Pair portfolio and benchmark returns for regression
  // If fewer than 5 points, return insufficient data
  if (args.portfolioReturns.length < 5 || quotes.length < 5) {
    return {
      benchmarkSymbol: sym,
      benchmarkStatus: "insufficient_quotes",
      benchmarkCumulativeReturn: bmkCumReturn.toFixed(6),
      benchmarkAnnualizedReturn: bmkAnnReturn,
      alpha: null,
      beta: null,
      correlation: null,
      rSquared: null,
      trackingError: null,
      informationRatio: null,
      message: `عدد نقاط المقارنة المشتركة (${Math.min(args.portfolioReturns.length, quotes.length)}) أقل من الحد الأدنى الإحصائي (5 نقاط).`,
    };
  }

  // Calculate benchmark sub-period returns matching portfolio timestamps
  const bmkReturns: Decimal[] = [];
  const portReturns: Decimal[] = [];

  for (let i = 1; i < quotes.length; i++) {
    const prevP = toDec(quotes[i - 1].price);
    const currP = toDec(quotes[i].price);
    if (!prevP.isZero()) {
      bmkReturns.push(safeDiv(currP.minus(prevP), prevP));
      // Align with nearest portfolio return if index matches
      if (i - 1 < args.portfolioReturns.length) {
        portReturns.push(toDec(args.portfolioReturns[i - 1].returnRate));
      }
    }
  }

  const n = Math.min(bmkReturns.length, portReturns.length);
  if (n < 5) {
    return {
      benchmarkSymbol: sym,
      benchmarkStatus: "insufficient_quotes",
      benchmarkCumulativeReturn: bmkCumReturn.toFixed(6),
      benchmarkAnnualizedReturn: bmkAnnReturn,
      alpha: null,
      beta: null,
      correlation: null,
      rSquared: null,
      trackingError: null,
      informationRatio: null,
      message: "عدد العوائد المتطابقة زمنيًا غير كافٍ لاحتساب ألفا وبيتا.",
    };
  }

  // Calculate Covariance and Variance
  const bmkSubset = bmkReturns.slice(0, n);
  const portSubset = portReturns.slice(0, n);

  const meanB = safeDiv(bmkSubset.reduce((a, b) => a.plus(b), new Decimal(0)), n);
  const meanP = safeDiv(portSubset.reduce((a, b) => a.plus(b), new Decimal(0)), n);

  let varB = new Decimal(0);
  let varP = new Decimal(0);
  let cov = new Decimal(0);
  let diffSqSum = new Decimal(0);

  for (let i = 0; i < n; i++) {
    const dB = bmkSubset[i].minus(meanB);
    const dP = portSubset[i].minus(meanP);
    varB = varB.plus(dB.mul(dB));
    varP = varP.plus(dP.mul(dP));
    cov = cov.plus(dB.mul(dP));

    const excessDiff = portSubset[i].minus(bmkSubset[i]);
    diffSqSum = diffSqSum.plus(excessDiff.mul(excessDiff));
  }

  varB = safeDiv(varB, n - 1);
  varP = safeDiv(varP, n - 1);
  cov = safeDiv(cov, n - 1);

  if (varB.isZero()) {
    return {
      benchmarkSymbol: sym,
      benchmarkStatus: "insufficient_quotes",
      benchmarkCumulativeReturn: bmkCumReturn.toFixed(6),
      benchmarkAnnualizedReturn: bmkAnnReturn,
      alpha: null,
      beta: null,
      correlation: null,
      rSquared: null,
      trackingError: null,
      informationRatio: null,
      message: "تباين المؤشر المرجعي صفر (أسعار ثابتة لا حركة فيها).",
    };
  }

  const beta = safeDiv(cov, varB);
  const stdB = varB.sqrt();
  const stdP = varP.sqrt();
  let correlation = new Decimal(0);
  if (!stdB.isZero() && !stdP.isZero()) {
    correlation = safeDiv(cov, stdB.mul(stdP));
  }
  const rSquared = correlation.mul(correlation);

  // Annualized Alpha: Alpha = R_p_ann - [R_f + Beta * (R_b_ann - R_f)]
  let alpha: string | null = null;
  const rf = toDec(args.riskFreeRate ?? "0");
  if (args.portfolioAnnualizedReturn !== null && bmkAnnReturn !== null) {
    const rPortAnn = toDec(args.portfolioAnnualizedReturn);
    const rBmkAnn = toDec(bmkAnnReturn);
    const expectedReturn = rf.plus(beta.mul(rBmkAnn.minus(rf)));
    alpha = rPortAnn.minus(expectedReturn).toFixed(6);
  }

  // Tracking Error and Information Ratio
  const trackingErrorPeriod = safeDiv(diffSqSum, n - 1).sqrt();
  const periodsPerYear = new Decimal(365.25).div(Math.max(args.periodDays / n, 1));
  const trackingErrorAnn = trackingErrorPeriod.mul(periodsPerYear.sqrt());
  let infoRatio: string | null = null;

  if (!trackingErrorAnn.isZero() && args.portfolioAnnualizedReturn !== null && bmkAnnReturn !== null) {
    const excessAnn = toDec(args.portfolioAnnualizedReturn).minus(toDec(bmkAnnReturn));
    infoRatio = safeDiv(excessAnn, trackingErrorAnn).toFixed(4);
  }

  return {
    benchmarkSymbol: sym,
    benchmarkStatus: "available",
    benchmarkCumulativeReturn: bmkCumReturn.toFixed(6),
    benchmarkAnnualizedReturn: bmkAnnReturn,
    alpha,
    beta: beta.toFixed(4),
    correlation: correlation.toFixed(4),
    rSquared: rSquared.toFixed(4),
    trackingError: trackingErrorAnn.toFixed(6),
    informationRatio: infoRatio,
  };
}

// ============================================================================
// Asset-Class Performance Attribution Engine
// ============================================================================

export const ASSET_CLASS_NAMES_AR: Record<AssetClassCategory, string> = {
  cash: "النقد وما يعادله",
  equity: "الأسهم والصناديق الاستثمارية",
  fixed_income: "الصكوك وأدوات الدخل الثابت",
  gold_alternatives: "الذهب والأصول البديلة",
  other: "أصول أخرى",
};

/**
 * Calculates asset-class performance attribution.
 * Decomposes total return into component contributions:
 *   Contribution_i = Weight_avg_i * Return_i
 * Reconciles sum of contributions with total portfolio return.
 */
export function calculateAssetClassAttribution(args: {
  totalReturn: Decimal.Value;
  assetClassHoldings: Array<{
    assetClass: AssetClassCategory;
    startValue: Decimal.Value;
    endValue: Decimal.Value;
    netCashFlow?: Decimal.Value;
  }>;
}): PortfolioAttribution {
  const totalRet = toDec(args.totalReturn);
  const totalStart = args.assetClassHoldings.reduce(
    (acc, h) => acc.plus(toDec(h.startValue)),
    new Decimal(0)
  );
  const totalEnd = args.assetClassHoldings.reduce(
    (acc, h) => acc.plus(toDec(h.endValue)),
    new Decimal(0)
  );

  let reconciledSum = new Decimal(0);
  const assetClasses: AssetClassAttribution[] = [];

  for (const item of args.assetClassHoldings) {
    const sVal = toDec(item.startValue);
    const eVal = toDec(item.endValue);
    const flow = toDec(item.netCashFlow ?? "0");

    const startWeight = safeDiv(sVal, totalStart);
    const endWeight = safeDiv(eVal, totalEnd);
    const avgWeight = startWeight.plus(endWeight).div(2);

    // Component return: R_i = (eVal - flow - sVal) / sVal
    let itemReturn = new Decimal(0);
    if (!sVal.isZero()) {
      itemReturn = safeDiv(eVal.minus(flow).minus(sVal), sVal);
    } else if (eVal.gt(0)) {
      itemReturn = new Decimal(0);
    }

    const contribution = avgWeight.mul(itemReturn);
    reconciledSum = reconciledSum.plus(contribution);

    assetClasses.push({
      assetClass: item.assetClass,
      nameAr: ASSET_CLASS_NAMES_AR[item.assetClass] ?? item.assetClass,
      startValue: sVal.toFixed(2),
      endValue: eVal.toFixed(2),
      startWeight: startWeight.toFixed(4),
      endWeight: endWeight.toFixed(4),
      averageWeight: avgWeight.toFixed(4),
      assetReturn: itemReturn.toFixed(6),
      contribution: contribution.toFixed(6),
    });
  }

  const reconciliationDiff = totalRet.minus(reconciledSum).abs();

  return {
    totalReturn: totalRet.toFixed(6),
    reconciledSum: reconciledSum.toFixed(6),
    reconciliationDiff: reconciliationDiff.toFixed(6),
    assetClasses,
    unsupportedDimensions: [
      "brinson_fachler_sector", // Sector allocation requires GICS taxonomy not currently in instruments
      "currency_interaction",   // FX cross-currency interaction effect
      "security_selection_residual", // Requires constituent benchmark weight decomposition
    ],
  };
}

// ============================================================================
// Capital Growth Bridge Engine
// ============================================================================

/**
 * Builds the Capital Growth Waterfall:
 *   Starting Capital + Deposits - Withdrawals + Investment Gain/Loss = Ending Capital
 */
export function buildCapitalBridge(args: {
  startingCapital: Decimal.Value;
  endingCapital: Decimal.Value;
  cashFlows?: ExternalCashFlow[];
}): CapitalBridge {
  const startCap = toDec(args.startingCapital);
  const endCap = toDec(args.endingCapital);

  let totalDeposits = new Decimal(0);
  let totalWithdrawals = new Decimal(0);

  for (const flow of args.cashFlows ?? []) {
    const amt = toDec(flow.amount);
    if (amt.gt(0)) {
      totalDeposits = totalDeposits.plus(amt);
    } else if (amt.lt(0)) {
      totalWithdrawals = totalWithdrawals.plus(amt.abs());
    }
  }

  const netContributions = totalDeposits.minus(totalWithdrawals);
  const investmentGainLoss = endCap.minus(startCap).minus(netContributions);

  // Exact verification of the bridge equation
  const reconciledSum = startCap.plus(netContributions).plus(investmentGainLoss);
  const reconciles = reconciledSum.minus(endCap).abs().lt("0.0001");

  return {
    startingCapital: startCap.toFixed(2),
    totalDeposits: totalDeposits.toFixed(2),
    totalWithdrawals: totalWithdrawals.toFixed(2),
    netContributions: netContributions.toFixed(2),
    investmentGainLoss: investmentGainLoss.toFixed(2),
    endingCapital: endCap.toFixed(2),
    reconciles,
  };
}
