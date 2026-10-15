import Decimal from "decimal.js";
import type { FamilyContext } from "../familyAccess";
import { listDebtSummaries, getEmergencyFundSummary } from "../familyRead";

export interface DebtItemInput {
  id: number;
  name: string;
  balance: number;
  interestRatePct: number;
  minPayment: number;
  currency: string;
}

export interface StrategySimulationResult {
  strategyName: "baseline" | "snowball" | "avalanche";
  labelAr: string;
  totalMonths: number;
  totalInterestPaid: number;
  totalPrincipalPaid: number;
  totalCost: number;
  interestSavedVsBaseline: number;
  monthsSavedVsBaseline: number;
  debtFreeDateStr: string;
  monthlyScheduleSummary: Array<{
    month: number;
    remainingTotalBalance: number;
    interestPaidThisMonth: number;
    activeDebtsCount: number;
  }>;
}

export interface MultiDebtComparisonReport {
  debtsCount: number;
  totalDebtBalance: number;
  totalMonthlyMinimum: number;
  extraMonthlyPayment: number;
  currency: string;
  baseline: StrategySimulationResult;
  snowball: StrategySimulationResult;
  avalanche: StrategySimulationResult;
  recommendedStrategy: "avalanche" | "snowball";
  recommendationReason: string;
  cashRunwayMonths: number | null;
  liquidCashReserves: number | null;
  generatedAt: number;
}

/**
 * Pure mathematical multi-debt portfolio simulation comparing:
 * 1. Baseline: paying strictly the minimum payments.
 * 2. Debt Snowball: targeting smallest balance first, rolling freed payments forward.
 * 3. Debt Avalanche: targeting highest APR first, rolling freed payments forward.
 * Strictly maintains read-model purity: NEVER performs any database or ledger writes.
 */
export async function simulateDebtPayoffStrategies(
  context: FamilyContext,
  extraMonthlyPayment = 0
): Promise<MultiDebtComparisonReport> {
  const debtRows = await listDebtSummaries(context);
  const activeDebts: DebtItemInput[] = debtRows
    .filter((d) => d.status === "active" && Number(d.outstanding) > 0)
    .map((d) => ({
      id: d.id,
      name: d.name,
      balance: Number(d.outstanding),
      interestRatePct: Number(d.annualInterestRate),
      minPayment: Number(d.minimumPayment),
      currency: d.currency,
    }));

  const currency = context.workspace.baseCurrency || "EGP";
  const now = Date.now();
  const extraPaymentDec = new Decimal(Math.max(0, extraMonthlyPayment));

  const totalBalance = activeDebts.reduce((sum, d) => sum + d.balance, 0);
  const totalMinPayment = activeDebts.reduce((sum, d) => sum + d.minPayment, 0);

  // Emergency Fund / Runway check
  let cashRunwayMonths: number | null = null;
  let liquidCashReserves: number | null = null;
  try {
    const ef = await getEmergencyFundSummary(context, now);
    liquidCashReserves = Number(ef.liquidReserveBase);
    cashRunwayMonths = ef.coverageMonths ? Number(ef.coverageMonths) : null;
  } catch {
    // If not configured, safely leave null
  }

  if (activeDebts.length === 0) {
    const emptyResult = (name: any, label: string): StrategySimulationResult => ({
      strategyName: name,
      labelAr: label,
      totalMonths: 0,
      totalInterestPaid: 0,
      totalPrincipalPaid: 0,
      totalCost: 0,
      interestSavedVsBaseline: 0,
      monthsSavedVsBaseline: 0,
      debtFreeDateStr: new Date(now).toISOString().slice(0, 7),
      monthlyScheduleSummary: [],
    });

    return {
      debtsCount: 0,
      totalDebtBalance: 0,
      totalMonthlyMinimum: 0,
      extraMonthlyPayment: extraPaymentDec.toNumber(),
      currency,
      baseline: emptyResult("baseline", "الحد الأدنى التعاقدي"),
      snowball: emptyResult("snowball", "كرة الثلج (Snowball)"),
      avalanche: emptyResult("avalanche", "الانهيار الجليدي (Avalanche)"),
      recommendedStrategy: "avalanche",
      recommendationReason: "لا توجد التزامات نشطة حاليًا.",
      cashRunwayMonths,
      liquidCashReserves,
      generatedAt: now,
    };
  }

  // Run the 3 simulations
  const baseline = runSimulation(activeDebts, new Decimal(0), "baseline", "الحد الأدنى التعاقدي", now);
  const snowball = runSimulation(activeDebts, extraPaymentDec, "snowball", "كرة الثلج (Snowball)", now);
  const avalanche = runSimulation(activeDebts, extraPaymentDec, "avalanche", "الانهيار الجليدي (Avalanche)", now);

  // Compute savings relative to baseline
  snowball.interestSavedVsBaseline = Math.max(0, baseline.totalInterestPaid - snowball.totalInterestPaid);
  snowball.monthsSavedVsBaseline = Math.max(0, baseline.totalMonths - snowball.totalMonths);

  avalanche.interestSavedVsBaseline = Math.max(0, baseline.totalInterestPaid - avalanche.totalInterestPaid);
  avalanche.monthsSavedVsBaseline = Math.max(0, baseline.totalMonths - avalanche.totalMonths);

  // Determine recommendation
  let recommendedStrategy: "avalanche" | "snowball" = "avalanche";
  let recommendationReason = "";

  const interestDiff = avalanche.interestSavedVsBaseline - snowball.interestSavedVsBaseline;
  if (interestDiff > 500) {
    recommendedStrategy = "avalanche";
    recommendationReason = `استراتيجية الانهيار الجليدي (Avalanche) توفر ${interestDiff.toLocaleString()} ${currency} إضافية من الفوائد مقارنة بكرة الثلج من خلال استهداف الديون الأعلى فائدة أولاً.`;
  } else {
    recommendedStrategy = "snowball";
    recommendationReason = `الفارق في الفائدة بسيط (${Math.abs(interestDiff).toLocaleString()} ${currency})، لذلك ننصح بكرة الثلج (Snowball) لمنحك دفعة نفسية أسرع عند سداد أصغر الديون أولاً.`;
  }

  return {
    debtsCount: activeDebts.length,
    totalDebtBalance: Number(totalBalance.toFixed(2)),
    totalMonthlyMinimum: Number(totalMinPayment.toFixed(2)),
    extraMonthlyPayment: extraPaymentDec.toNumber(),
    currency,
    baseline,
    snowball,
    avalanche,
    recommendedStrategy,
    recommendationReason,
    cashRunwayMonths,
    liquidCashReserves,
    generatedAt: now,
  };
}

/**
 * Core multi-debt simulation loop
 */
function runSimulation(
  initialDebts: DebtItemInput[],
  extraMonthlyPayment: Decimal,
  strategy: "baseline" | "snowball" | "avalanche",
  labelAr: string,
  startTs: number
): StrategySimulationResult {
  // Clone debt items
  let debts = initialDebts.map((d) => ({
    id: d.id,
    name: d.name,
    balance: new Decimal(d.balance),
    monthlyRate: new Decimal(d.interestRatePct).div(100).div(12),
    minPayment: new Decimal(d.minPayment),
  }));

  const MAX_MONTHS = 360; // 30-year ceiling
  let month = 0;
  let totalInterest = new Decimal(0);
  let totalPrincipal = new Decimal(0);
  const monthlySummary: StrategySimulationResult["monthlyScheduleSummary"] = [];

  while (debts.some((d) => d.balance.gt(0)) && month < MAX_MONTHS) {
    month++;
    let monthInterest = new Decimal(0);

    // 1. Accrue interest for all active debts
    for (const d of debts) {
      if (d.balance.gt(0)) {
        const interest = d.balance.mul(d.monthlyRate);
        monthInterest = monthInterest.plus(interest);
        d.balance = d.balance.plus(interest);
      }
    }
    totalInterest = totalInterest.plus(monthInterest);

    // 2. Determine payment allocation
    let freedMinimum = new Decimal(0);
    // Pay contractual minimum on active debts
    for (const d of debts) {
      if (d.balance.gt(0)) {
        const pay = Decimal.min(d.balance, d.minPayment);
        d.balance = d.balance.minus(pay);
        totalPrincipal = totalPrincipal.plus(pay);
        if (d.balance.isZero()) {
          // Debt cleared this month
          freedMinimum = freedMinimum.plus(d.minPayment.minus(pay));
        }
      } else {
        // Debt was already cleared in previous months, its minimum is available
        freedMinimum = freedMinimum.plus(d.minPayment);
      }
    }

    // 3. Allocate extra payment + rolled-over freed minimums
    if (strategy !== "baseline") {
      let extraAvailable = extraMonthlyPayment.plus(freedMinimum);

      // Sort remaining active debts based on strategy
      const remainingDebts = debts.filter((d) => d.balance.gt(0));
      if (strategy === "snowball") {
        remainingDebts.sort((a, b) => a.balance.minus(b.balance).toNumber()); // Smallest balance first
      } else if (strategy === "avalanche") {
        remainingDebts.sort((a, b) => b.monthlyRate.minus(a.monthlyRate).toNumber()); // Highest APR first
      }

      for (const target of remainingDebts) {
        if (extraAvailable.lte(0)) break;
        const extraPay = Decimal.min(target.balance, extraAvailable);
        target.balance = target.balance.minus(extraPay);
        totalPrincipal = totalPrincipal.plus(extraPay);
        extraAvailable = extraAvailable.minus(extraPay);
      }
    }

    // Record monthly snapshot every 3 months or on final month
    const currentRemainingTotal = debts.reduce((sum, d) => sum.plus(d.balance), new Decimal(0));
    const activeCount = debts.filter((d) => d.balance.gt(0)).length;

    if (month % 3 === 0 || currentRemainingTotal.isZero() || month === 1) {
      monthlySummary.push({
        month,
        remainingTotalBalance: Number(currentRemainingTotal.toFixed(2)),
        interestPaidThisMonth: Number(monthInterest.toFixed(2)),
        activeDebtsCount: activeCount,
      });
    }

    if (currentRemainingTotal.isZero()) {
      break;
    }
  }

  const debtFreeDate = new Date(startTs);
  debtFreeDate.setMonth(debtFreeDate.getMonth() + month);

  return {
    strategyName: strategy,
    labelAr,
    totalMonths: month,
    totalInterestPaid: Number(totalInterest.toFixed(2)),
    totalPrincipalPaid: Number(totalPrincipal.toFixed(2)),
    totalCost: Number(totalPrincipal.plus(totalInterest).toFixed(2)),
    interestSavedVsBaseline: 0,
    monthsSavedVsBaseline: 0,
    debtFreeDateStr: debtFreeDate.toISOString().slice(0, 7),
    monthlyScheduleSummary: monthlySummary,
  };
}
