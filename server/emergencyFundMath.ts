import Decimal from "decimal.js";

function nonNegative(value: string | Decimal, name: string) {
  const amount = new Decimal(value);
  if (!amount.isFinite() || amount.lt(0)) throw new Error(`${name} لا يمكن أن يكون سالبًا.`);
  return amount;
}

function positive(value: string | Decimal, name: string) {
  const amount = nonNegative(value, name);
  if (amount.eq(0)) throw new Error(`${name} يجب أن يكون أكبر من صفر.`);
  return amount;
}

export function calendarMonthsUntil(now: number, target: number) {
  if (target <= now) return null;
  const from = new Date(now);
  const to = new Date(target);
  let months = (to.getUTCFullYear() - from.getUTCFullYear()) * 12 + to.getUTCMonth() - from.getUTCMonth();
  const fromDayTime = (((from.getUTCDate() * 24) + from.getUTCHours()) * 60 + from.getUTCMinutes()) * 60 + from.getUTCSeconds();
  const toDayTime = (((to.getUTCDate() * 24) + to.getUTCHours()) * 60 + to.getUTCMinutes()) * 60 + to.getUTCSeconds();
  if (toDayTime > fromDayTime) months += 1;
  return Math.max(months, 1);
}

export function calculateEmergencyFund({ liquidReserveBase, essentialExpenseMonthlyBase, debtMinimumPaymentBase, targetMonths, targetDate, now }: { liquidReserveBase: string | Decimal; essentialExpenseMonthlyBase: string | Decimal; debtMinimumPaymentBase: string | Decimal; targetMonths?: string | Decimal | null; targetDate?: number | null; now: number }) {
  const liquidReserve = nonNegative(liquidReserveBase, "السيولة");
  const essentialExpense = nonNegative(essentialExpenseMonthlyBase, "المصروف الأساسي");
  const debtMinimum = nonNegative(debtMinimumPaymentBase, "الالتزام الأدنى");
  const requiredMonthly = essentialExpense.plus(debtMinimum);
  const months = targetMonths === null || targetMonths === undefined ? null : positive(targetMonths, "هدف التغطية");
  const targetReserve = months ? requiredMonthly.mul(months) : null;
  const fundingGap = targetReserve ? Decimal.max(targetReserve.minus(liquidReserve), 0) : null;
  const targetMonthsAway = targetDate ? calendarMonthsUntil(now, targetDate) : null;
  const recommendation = !months
    ? { status: "plan_needed" as const, message: "حدد عدد أشهر التغطية المستهدفة لتتحول بيانات السيولة والالتزامات إلى هدف احتياطي قابل للقياس." }
    : requiredMonthly.eq(0)
      ? { status: "expense_data_needed" as const, message: "علّم المصروفات الضرورية وسجّل الإنفاق أو الالتزامات الفعلية حتى يمكن حساب تغطية واقعية." }
      : fundingGap?.gt(0)
        ? { status: "funding_gap" as const, message: targetMonthsAway ? "يوجد عجز عن الهدف؛ المساهمة الشهرية المعروضة أدناه تسد الفجوة خلال تاريخ الهدف المختار." : "يوجد عجز عن الهدف؛ حدد تاريخ هدف لإظهار مساهمة شهرية حسابية." }
        : { status: "funded" as const, message: "تغطي السيولة المقيمة هدف الاحتياطي الحالي وفق المصروفات الأساسية والأقساط الدنيا المسجلة." };
  return {
    liquidReserveBase: liquidReserve.toFixed(6),
    essentialExpenseMonthlyBase: essentialExpense.toFixed(6),
    debtMinimumPaymentBase: debtMinimum.toFixed(6),
    requiredMonthlyBase: requiredMonthly.toFixed(6),
    coverageMonths: (essentialExpense.gt(0) && requiredMonthly.gt(0)) ? liquidReserve.div(requiredMonthly).toFixed(2) : null,
    targetReserveBase: targetReserve?.toFixed(6) ?? null,
    fundingGapBase: fundingGap?.toFixed(6) ?? null,
    monthsToTarget: targetMonthsAway,
    monthlyContributionNeededBase: fundingGap && targetMonthsAway ? fundingGap.div(targetMonthsAway).toFixed(6) : null,
    recommendation,
  };
}
