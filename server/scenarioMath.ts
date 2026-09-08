export type ScenarioInput = {
  type: "debt" | "retirement" | "emergency" | "cash_flow";
  monthlyIncome: number;
  monthlyExpense: number;
  liquidReserve: number;
  debtBalance: number;
  annualReturnPercent: number;
  annualInflationPercent: number;
  months: number;
  annualDebtRatePercent?: number;
  extraDebtPayment?: number;
  retirementAssets?: number;
  monthlyRetirementContribution?: number;
  retirementAge?: number;
  currentAge?: number;
  retirementAnnualSpending?: number;
  emergencyTargetMonths?: number;
  historicalMonthlyExpenses?: number[];
};

export type ForecastConfidence = "low" | "medium" | "high";

function finiteNonNegative(value: number | undefined, fallback = 0) {
  return Number.isFinite(value) && (value ?? 0) >= 0 ? value! : fallback;
}

export function deriveHistoricalExpenseForecast(monthlyExpenses: number[]) {
  const usable = monthlyExpenses.filter(value => Number.isFinite(value) && value >= 0);
  if (usable.length === 0) return { sampleMonths: 0, averageMonthlyExpense: null, standardDeviation: null, lowerBound: null, upperBound: null, confidence: "low" as ForecastConfidence, basis: "لا تتوفر أشهر تاريخية كافية؛ لا ينشأ توقع مالي تلقائي." };
  const average = usable.reduce((sum, value) => sum + value, 0) / usable.length;
  const variance = usable.reduce((sum, value) => sum + Math.pow(value - average, 2), 0) / usable.length;
  const standardDeviation = Math.sqrt(variance);
  const coefficientOfVariation = average === 0 ? 0 : standardDeviation / average;
  const confidence: ForecastConfidence = usable.length >= 12 && coefficientOfVariation <= 0.25 ? "high" : usable.length >= 6 && coefficientOfVariation <= 0.5 ? "medium" : "low";
  return { sampleMonths: usable.length, averageMonthlyExpense: average, standardDeviation, lowerBound: Math.max(0, average - standardDeviation), upperBound: average + standardDeviation, confidence, basis: "النطاق يساوي المتوسط الشهري ± انحراف معياري واحد؛ وهو قراءة تاريخية لا توصية أو التزام." };
}

function commonProjection(input: ScenarioInput) {
  const months = Math.max(1, Math.min(120, Math.floor(input.months)));
  const monthlyIncome = finiteNonNegative(input.monthlyIncome);
  const monthlyExpense = finiteNonNegative(input.monthlyExpense);
  const liquidReserve = finiteNonNegative(input.liquidReserve);
  const netMonthly = monthlyIncome - monthlyExpense;
  const monthlyReturn = input.annualReturnPercent / 100 / 12;
  const monthlyInflation = input.annualInflationPercent / 100 / 12;
  const forecast = deriveHistoricalExpenseForecast(input.historicalMonthlyExpenses ?? []);
  return { months, monthlyIncome, monthlyExpense, liquidReserve, netMonthly, monthlyReturn, monthlyInflation, forecast };
}

export function projectScenario(input: ScenarioInput) {
  const common = commonProjection(input);
  const assumptions = ["النتائج حسابات افتراضية قابلة للتعديل ولا تمثل توصية أو التزاماً مالياً.", "لا يُكتب أي قيد أو رصيد أو حركة تداول من مساحة السيناريو."];
  if (input.type === "debt") {
    const balance = finiteNonNegative(input.debtBalance);
    const annualRate = finiteNonNegative(input.annualDebtRatePercent);
    const payment = Math.max(0, common.netMonthly) + finiteNonNegative(input.extraDebtPayment);
    const monthlyRate = annualRate / 100 / 12;
    let remaining = balance;
    let monthsToPayoff: number | null = null;
    for (let month = 1; month <= 120 && remaining > 0; month += 1) {
      const interest = remaining * monthlyRate;
      if (payment <= interest) break;
      remaining = Math.max(0, remaining + interest - payment);
      if (remaining === 0) monthsToPayoff = month;
    }
    assumptions.push("يُفترض ثبات سعر الدين والدفعة الإضافية وعدم وجود رسوم أو غرامات غير مدخلة.");
    return { ...common, model: "debt" as const, debtBalance: balance, monthlyDebtPayment: payment, monthlyDebtRate: monthlyRate, monthsToPayoff, remainingBalanceAfterHorizon: remaining, confidence: common.forecast.confidence, assumptions };
  }
  if (input.type === "retirement") {
    const assets = finiteNonNegative(input.retirementAssets, common.liquidReserve);
    const contribution = finiteNonNegative(input.monthlyRetirementContribution, Math.max(0, common.netMonthly));
    const currentAge = finiteNonNegative(input.currentAge);
    const retirementAge = finiteNonNegative(input.retirementAge);
    const yearsToRetirement = Math.max(0, retirementAge - currentAge);
    const periods = yearsToRetirement * 12;
    const futureAssets = assets * Math.pow(1 + common.monthlyReturn, periods) + contribution * (periods ? (Math.pow(1 + common.monthlyReturn, periods) - 1) / Math.max(common.monthlyReturn, Number.EPSILON) : 0);
    const annualSpending = finiteNonNegative(input.retirementAnnualSpending, common.monthlyExpense * 12);
    const withdrawalNeed = annualSpending * Math.pow(1 + input.annualInflationPercent / 100, yearsToRetirement) * 25;
    assumptions.push("فجوة التقاعد تستخدم غطاءً افتراضياً قدره 25 ضعف الإنفاق السنوي بالقيمة الاسمية عند سن التقاعد.");
    return { ...common, model: "retirement" as const, yearsToRetirement, projectedAssetsAtRetirement: futureAssets, projectedCapitalNeed: withdrawalNeed, retirementGap: Math.max(0, withdrawalNeed - futureAssets), confidence: common.forecast.confidence, assumptions };
  }
  if (input.type === "emergency") {
    const essentialMonthly = common.forecast.averageMonthlyExpense ?? common.monthlyExpense;
    const targetMonths = Math.max(1, Math.min(24, Math.floor(finiteNonNegative(input.emergencyTargetMonths, 6))));
    const targetReserve = essentialMonthly * targetMonths;
    assumptions.push("يُستخدم متوسط المصروف التاريخي عندما تتوفر عينة؛ وإلا يُستخدم المصروف الشهري المدخل.");
    return { ...common, model: "emergency" as const, essentialMonthlyExpense: essentialMonthly, targetMonths, targetReserve, reserveGap: Math.max(0, targetReserve - common.liquidReserve), runwayMonths: essentialMonthly > 0 ? common.liquidReserve / essentialMonthly : null, confidence: common.forecast.confidence, assumptions };
  }
  const projectedReserve = common.liquidReserve * Math.pow(1 + common.monthlyReturn, common.months) + common.netMonthly * common.months;
  const inflatedExpense = common.monthlyExpense * Math.pow(1 + common.monthlyInflation, common.months);
  assumptions.push("التدفق النقدي يفترض ثبات الدخل الاسمي وتطبيق التضخم والعائد فقط كما أُدخلا.");
  return { ...common, model: "cash_flow" as const, projectedReserve, inflatedExpense, runwayMonths: common.monthlyExpense > 0 ? common.liquidReserve / common.monthlyExpense : null, confidence: common.forecast.confidence, assumptions };
}
