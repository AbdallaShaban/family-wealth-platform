import Decimal from "decimal.js";

export type DebtScheduleRow = {
  period: number;
  openingBalance: string;
  interest: string;
  payment: string;
  principal: string;
  closingBalance: string;
};

export type DebtSchedule = {
  rows: DebtScheduleRow[];
  endingBalance: string;
  totalInterest: string;
  totalPaid: string;
  negativeAmortization: boolean;
};

function positive(value: string | Decimal, label: string) {
  const decimal = new Decimal(value);
  if (!decimal.isFinite() || decimal.lte(0)) throw new Error(`${label} يجب أن يكون أكبر من صفر.`);
  return decimal;
}

function nonNegative(value: string | Decimal, label: string) {
  const decimal = new Decimal(value);
  if (!decimal.isFinite() || decimal.lt(0)) throw new Error(`${label} لا يمكن أن يكون سالبًا.`);
  return decimal;
}

/** Projects actual contractual payments; no market-return or probability assumptions are introduced. */
export function projectDebtSchedule({ outstanding, annualInterestRatePercent, monthlyPayment, months }: { outstanding: string | Decimal; annualInterestRatePercent: string | Decimal; monthlyPayment: string | Decimal; months: number }): DebtSchedule {
  const startingBalance = positive(outstanding, "رصيد الدين");
  const annualRate = nonNegative(annualInterestRatePercent, "معدل الفائدة");
  const contractualPayment = positive(monthlyPayment, "القسط الشهري");
  if (!Number.isInteger(months) || months < 1 || months > 600) throw new Error("عدد أشهر العرض يجب أن يكون بين 1 و600.");
  const monthlyRate = annualRate.div(100).div(12);
  let balance = startingBalance;
  let totalInterest = new Decimal(0);
  let totalPaid = new Decimal(0);
  let negativeAmortization = false;
  const rows: DebtScheduleRow[] = [];

  for (let period = 1; period <= months && balance.gt(0); period += 1) {
    const openingBalance = balance;
    const interest = openingBalance.mul(monthlyRate);
    const payment = Decimal.min(contractualPayment, openingBalance.plus(interest));
    const principal = Decimal.max(payment.minus(interest), 0);
    const closingBalance = openingBalance.plus(interest).minus(payment);
    if (principal.eq(0) && interest.gt(0)) negativeAmortization = true;
    totalInterest = totalInterest.plus(interest);
    totalPaid = totalPaid.plus(payment);
    rows.push({ period, openingBalance: openingBalance.toFixed(6), interest: interest.toFixed(6), payment: payment.toFixed(6), principal: principal.toFixed(6), closingBalance: Decimal.max(closingBalance, 0).toFixed(6) });
    balance = Decimal.max(closingBalance, 0);
  }
  return { rows, endingBalance: balance.toFixed(6), totalInterest: totalInterest.toFixed(6), totalPaid: totalPaid.toFixed(6), negativeAmortization };
}

/** The counterfactual is only debt-cost arithmetic: minimum payment versus a chosen extra principal amount. */
export function compareExtraDebtPayment({ outstanding, annualInterestRatePercent, monthlyPayment, extraPrincipal }: { outstanding: string | Decimal; annualInterestRatePercent: string | Decimal; monthlyPayment: string | Decimal; extraPrincipal: string | Decimal }) {
  const base = projectDebtSchedule({ outstanding, annualInterestRatePercent, monthlyPayment, months: 600 });
  const extra = nonNegative(extraPrincipal, "السداد الإضافي");
  const accelerated = projectDebtSchedule({ outstanding, annualInterestRatePercent, monthlyPayment: positive(monthlyPayment, "القسط الشهري").plus(extra), months: 600 });
  return {
    baselineMonths: base.rows.length,
    acceleratedMonths: accelerated.rows.length,
    monthsSaved: Math.max(base.rows.length - accelerated.rows.length, 0),
    baselineInterest: base.totalInterest,
    acceleratedInterest: accelerated.totalInterest,
    interestSaved: new Decimal(base.totalInterest).minus(accelerated.totalInterest).toFixed(6),
    baselineNegativeAmortization: base.negativeAmortization,
    acceleratedNegativeAmortization: accelerated.negativeAmortization,
  };
}
