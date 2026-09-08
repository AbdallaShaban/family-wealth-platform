import Decimal from "decimal.js";

function finiteNonNegative(value: string | Decimal, name: string) {
  const decimal = new Decimal(value);
  if (!decimal.isFinite() || decimal.lt(0)) throw new Error(`${name} لا يمكن أن يكون سالبًا.`);
  return decimal;
}

function positivePercent(value: string | Decimal, name: string) {
  const decimal = finiteNonNegative(value, name);
  if (decimal.eq(0) || decimal.gt(100)) throw new Error(`${name} يجب أن يكون أكبر من صفر وألا يتجاوز 100%.`);
  return decimal;
}

function monthsToDate(now: number, targetDate?: number | null) {
  if (!targetDate || targetDate <= now) return null;
  const current = new Date(now);
  const target = new Date(targetDate);
  let months = (target.getUTCFullYear() - current.getUTCFullYear()) * 12 + target.getUTCMonth() - current.getUTCMonth();
  if (target.getUTCDate() > current.getUTCDate() || (target.getUTCDate() === current.getUTCDate() && target.getUTCHours() > current.getUTCHours())) months += 1;
  return Math.max(months, 1);
}

function futureValue(current: Decimal, monthlyContribution: Decimal, monthlyRate: Decimal, months: number) {
  if (monthlyRate.eq(0)) return current.plus(monthlyContribution.mul(months));
  const growth = monthlyRate.plus(1).pow(months);
  return current.mul(growth).plus(monthlyContribution.mul(growth.minus(1)).div(monthlyRate));
}

function contributionForTarget(current: Decimal, target: Decimal, monthlyRate: Decimal, months: number) {
  if (months < 1 || target.lte(0)) return null;
  const growth = monthlyRate.plus(1).pow(months);
  const residual = Decimal.max(target.minus(current.mul(growth)), 0);
  return monthlyRate.eq(0) ? residual.div(months) : residual.mul(monthlyRate).div(growth.minus(1));
}

/** Goal values remain nominal in the workspace base currency; inflation only escalates a future target. */
export function projectFinancialGoal({ currentAmount, targetAmount, monthlyContribution, annualReturnPercent, annualInflationPercent, targetDate, now }: { currentAmount: string | Decimal; targetAmount: string | Decimal; monthlyContribution: string | Decimal; annualReturnPercent: string | Decimal; annualInflationPercent: string | Decimal; targetDate?: number | null; now: number }) {
  const current = finiteNonNegative(currentAmount, "القيمة الحالية");
  const target = finiteNonNegative(targetAmount, "الهدف");
  const contribution = finiteNonNegative(monthlyContribution, "المساهمة الشهرية");
  const annualReturn = finiteNonNegative(annualReturnPercent, "العائد المفترض");
  const annualInflation = finiteNonNegative(annualInflationPercent, "التضخم المفترض");
  const months = monthsToDate(now, targetDate);
  const monthlyRate = annualReturn.div(100).div(12);
  const futureTarget = months ? target.mul(annualInflation.div(100).plus(1).pow(new Decimal(months).div(12))) : target;
  const projectedAmount = months ? futureValue(current, contribution, monthlyRate, months) : current;
  const requiredContribution = months ? contributionForTarget(current, futureTarget, monthlyRate, months) : null;
  return { monthsToTarget: months, currentAmount: current.toFixed(6), targetAmountToday: target.toFixed(6), inflationAdjustedTargetAmount: futureTarget.toFixed(6), projectedAmount: projectedAmount.toFixed(6), projectedGap: Decimal.max(futureTarget.minus(projectedAmount), 0).toFixed(6), requiredMonthlyContribution: requiredContribution?.toFixed(6) ?? null };
}

/** Deterministic retirement/FI scenario; no probability of success is claimed. */
export function projectRetirementPlan({ currentAge, retirementAge, currentAssets, monthlyContribution, annualSpending, safeWithdrawalRatePercent, annualReturnPercent, annualInflationPercent }: { currentAge: number; retirementAge: number; currentAssets: string | Decimal; monthlyContribution: string | Decimal; annualSpending: string | Decimal; safeWithdrawalRatePercent: string | Decimal; annualReturnPercent: string | Decimal; annualInflationPercent: string | Decimal }) {
  if (!Number.isInteger(currentAge) || !Number.isInteger(retirementAge) || currentAge < 0 || retirementAge <= currentAge || retirementAge > 100) throw new Error("يجب أن يكون عمر التقاعد أكبر من العمر الحالي وبحد أقصى 100.");
  const assets = finiteNonNegative(currentAssets, "أصول التقاعد الحالية");
  const contribution = finiteNonNegative(monthlyContribution, "المساهمة الشهرية");
  const spending = finiteNonNegative(annualSpending, "الإنفاق السنوي");
  const withdrawalRate = positivePercent(safeWithdrawalRatePercent, "معدل السحب");
  const annualReturn = finiteNonNegative(annualReturnPercent, "العائد المفترض");
  const annualInflation = finiteNonNegative(annualInflationPercent, "التضخم المفترض");
  const years = retirementAge - currentAge;
  const months = years * 12;
  const projectedAssets = futureValue(assets, contribution, annualReturn.div(100).div(12), months);
  const spendingAtRetirement = spending.mul(annualInflation.div(100).plus(1).pow(years));
  const fiTarget = spendingAtRetirement.div(withdrawalRate.div(100));
  return { yearsToRetirement: years, projectedAssetsAtRetirement: projectedAssets.toFixed(6), annualSpendingAtRetirement: spendingAtRetirement.toFixed(6), financialIndependenceTarget: fiTarget.toFixed(6), gapToFinancialIndependence: Decimal.max(fiTarget.minus(projectedAssets), 0).toFixed(6), nominalAnnualReturn: annualReturn.toFixed(6), annualInflation: annualInflation.toFixed(6), safeWithdrawalRate: withdrawalRate.toFixed(6) };
}
