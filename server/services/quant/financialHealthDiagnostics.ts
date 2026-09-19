/**
 * Financial Health Diagnostics, Credit Card Utilization & Budget Variance Engine
 * Evaluates core family liquidity, debt stress, savings rate, emergency runway,
 * credit card grace periods, and subscription renewals.
 */

export interface CreditCardHealth {
  debtId: number;
  cardName: string;
  lender?: string;
  creditLimitEGP: number;
  utilizedBalanceEGP: number;
  availableCreditEGP: number;
  utilizationRatePercent: number;
  statusLevel: "EXCELLENT" | "MODERATE" | "HIGH_RISK" | "CRITICAL";
  billingCycleDay?: number;
  gracePeriodDays?: number;
  interestFreeDueDate?: string; // ISO date
  daysUntilInterestFreeExpiry?: number;
  adviceAr: string;
}

export interface DiagnosticRatios {
  liquidityRatio: number; // Liquid assets / monthly expenses
  liquidityMonthsDescriptionAr: string;
  savingsRatePercent: number; // (Income - Expenses) / Income * 100
  debtToAssetPercent: number; // Total Debt / Total Assets * 100
  emergencyRunwayMonths: number;
  overallScore: number; // 0 to 100
  healthRatingAr: "ممتاز" | "جيد جداً" | "مقبول" | "يحتاج تدخلاً عاجلاً";
  strengthsAr: string[];
  vulnerabilitiesAr: string[];
}

export interface BudgetVarianceAlert {
  categoryId?: number;
  categoryNameAr: string;
  budgetLimitEGP: number;
  actualSpentEGP: number;
  usagePercent: number;
  alertLevel: "SAFE" | "APPROACHING_LIMIT" | "EXCEEDED"; // >=80% or >=100%
  remainingEGP: number;
  messageAr: string;
}

export interface RecurringSubscriptionCountdown {
  ruleId: number;
  memo: string;
  subscriptionTag?: string;
  amountEGP: number;
  cadence: string;
  nextRenewalDate: string;
  daysRemaining: number;
  annualCostEGP: number;
}

/**
 * Assess Credit Card Utilization & Grace Period Status
 */
export function assessCreditCard(card: {
  debtId: number;
  cardName: string;
  lender?: string;
  creditLimitEGP: number;
  utilizedBalanceEGP: number;
  billingCycleDay?: number;
  gracePeriodDays?: number;
  interestFreeDueDateMs?: number;
}): CreditCardHealth {
  const creditLimit = Math.max(1, card.creditLimitEGP);
  const utilized = Math.max(0, card.utilizedBalanceEGP);
  const available = Math.max(0, creditLimit - utilized);
  const utilizationRate = Number(((utilized / creditLimit) * 100).toFixed(1));

  let statusLevel: "EXCELLENT" | "MODERATE" | "HIGH_RISK" | "CRITICAL" = "EXCELLENT";
  let adviceAr = "نسبة استخدام ممتازة ضمن النطاق الآمن (أقل من 30%).";

  if (utilizationRate >= 85) {
    statusLevel = "CRITICAL";
    adviceAr = `تنبيه حرج: نسبة استخدام البطاقة بلغت (${utilizationRate}%)، مما يؤثر سلباً على التقييم الائتماني ويزيد عبء الفائدة في حال تعثر السداد.`;
  } else if (utilizationRate >= 50) {
    statusLevel = "HIGH_RISK";
    adviceAr = `نسبة استخدام مرتفعة (${utilizationRate}%). يُنصح بخفض الرصيد المستغل إلى أقل من 30% لتفادي فوائد التمويل الاستهلاكي.`;
  } else if (utilizationRate >= 30) {
    statusLevel = "MODERATE";
    adviceAr = `نسبة استخدام مقبولة (${utilizationRate}%)، يفضل سداد كامل المديونية قبل نهاية فترة السماح لتجنب الفوائد.`;
  }

  let daysRemaining: number | undefined;
  let interestFreeDateStr: string | undefined;

  if (card.interestFreeDueDateMs) {
    const due = new Date(card.interestFreeDueDateMs);
    interestFreeDateStr = due.toISOString().split("T")[0];
    const now = Date.now();
    const diffMs = card.interestFreeDueDateMs - now;
    daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  } else if (card.billingCycleDay && card.gracePeriodDays) {
    // Estimate next interest-free due date from cycle
    const today = new Date();
    let billDate = new Date(today.getFullYear(), today.getMonth(), card.billingCycleDay);
    if (billDate < today) {
      billDate = new Date(today.getFullYear(), today.getMonth() + 1, card.billingCycleDay);
    }
    const dueDate = new Date(billDate.getTime() + card.gracePeriodDays * 24 * 60 * 60 * 1000);
    interestFreeDateStr = dueDate.toISOString().split("T")[0];
    const diffMs = dueDate.getTime() - today.getTime();
    daysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
  }

  return {
    debtId: card.debtId,
    cardName: card.cardName,
    lender: card.lender,
    creditLimitEGP: creditLimit,
    utilizedBalanceEGP: utilized,
    availableCreditEGP: available,
    utilizationRatePercent: utilizationRate,
    statusLevel,
    billingCycleDay: card.billingCycleDay,
    gracePeriodDays: card.gracePeriodDays,
    interestFreeDueDate: interestFreeDateStr,
    daysUntilInterestFreeExpiry: daysRemaining,
    adviceAr,
  };
}

/**
 * Calculate Core Financial Health Diagnostic Ratios
 */
export function calculateFinancialHealthDiagnostics(params: {
  liquidAssetsEGP: number;
  totalAssetsEGP: number;
  totalLiabilitiesEGP: number;
  monthlyAverageIncomeEGP: number;
  monthlyAverageExpensesEGP: number;
}): DiagnosticRatios {
  const {
    liquidAssetsEGP = 0,
    totalAssetsEGP = 0,
    totalLiabilitiesEGP = 0,
    monthlyAverageIncomeEGP = 0,
    monthlyAverageExpensesEGP = 0,
  } = params;

  const monthlyExpSafe = Math.max(1, monthlyAverageExpensesEGP);
  const emergencyRunwayMonths = Number((liquidAssetsEGP / monthlyExpSafe).toFixed(1));
  const liquidityRatio = Number((liquidAssetsEGP / monthlyExpSafe).toFixed(2));

  let liquidityMonthsDescriptionAr = `${emergencyRunwayMonths} أشهر من المصروفات المعيشية مغطاة بسيولة فورية`;
  if (emergencyRunwayMonths >= 6) {
    liquidityMonthsDescriptionAr += " (احتياطي طوارئ قوي ومثالي).";
  } else if (emergencyRunwayMonths >= 3) {
    liquidityMonthsDescriptionAr += " (احتياطي طوارئ كافٍ ومستقر).";
  } else {
    liquidityMonthsDescriptionAr += " (احتياطي طوارئ منخفض؛ يوصى برفع السيولة لتغطية 3 إلى 6 أشهر).";
  }

  // Savings rate
  const monthlyIncSafe = Math.max(1, monthlyAverageIncomeEGP);
  const monthlySavings = monthlyAverageIncomeEGP - monthlyAverageExpensesEGP;
  const savingsRatePercent = Number(((monthlySavings / monthlyIncSafe) * 100).toFixed(1));

  // Debt to Asset
  const totalAssetsSafe = Math.max(1, totalAssetsEGP);
  const debtToAssetPercent = Number(((totalLiabilitiesEGP / totalAssetsSafe) * 100).toFixed(1));

  // Diagnostic Scoring (0 - 100)
  let score = 50;

  // Emergency runway contribution (up to +25 / -25)
  if (emergencyRunwayMonths >= 6) score += 25;
  else if (emergencyRunwayMonths >= 3) score += 15;
  else if (emergencyRunwayMonths >= 1) score += 5;
  else score -= 20;

  // Savings rate contribution (up to +20 / -20)
  if (savingsRatePercent >= 25) score += 20;
  else if (savingsRatePercent >= 15) score += 12;
  else if (savingsRatePercent > 0) score += 5;
  else score -= 15;

  // Debt to asset contribution (up to +15 / -20)
  if (debtToAssetPercent < 15) score += 15;
  else if (debtToAssetPercent < 35) score += 5;
  else if (debtToAssetPercent > 60) score -= 20;

  score = Math.min(100, Math.max(10, score));

  let healthRatingAr: "ممتاز" | "جيد جداً" | "مقبول" | "يحتاج تدخلاً عاجلاً" = "مقبول";
  if (score >= 85) healthRatingAr = "ممتاز";
  else if (score >= 70) healthRatingAr = "جيد جداً";
  else if (score >= 50) healthRatingAr = "مقبول";
  else healthRatingAr = "يحتاج تدخلاً عاجلاً";

  const strengthsAr: string[] = [];
  const vulnerabilitiesAr: string[] = [];

  if (emergencyRunwayMonths >= 6) {
    strengthsAr.push(`صندوق طوارئ عائلي متين يغطي ${emergencyRunwayMonths} أشهر من الإنفاق الأساسي.`);
  } else {
    vulnerabilitiesAr.push(`السيولة السريعة تغطي ${emergencyRunwayMonths} أشهر فقط، وهو أقل من الهدف الآمن (6 أشهر).`);
  }

  if (savingsRatePercent >= 20) {
    strengthsAr.push(`معدل ادخار صحي ممتاز يبلغ ${savingsRatePercent}% من الدخل الشهري.`);
  } else if (savingsRatePercent <= 0) {
    vulnerabilitiesAr.push(`المصروفات الشهرية تتجاوز الدخل (معدل ادخار سلبي ${savingsRatePercent}%)، مما يستنزف الأصول.`);
  }

  if (debtToAssetPercent < 20) {
    strengthsAr.push(`نسبة مديونية منخفضة للغاية (${debtToAssetPercent}%) مقارنة بحجم الأصول الكلية.`);
  } else if (debtToAssetPercent > 45) {
    vulnerabilitiesAr.push(`نسبة المديونية تمثل (${debtToAssetPercent}%) من إجمالي الأصول، مما يضغط على التدفقات.`);
  }

  return {
    liquidityRatio,
    liquidityMonthsDescriptionAr,
    savingsRatePercent,
    debtToAssetPercent,
    emergencyRunwayMonths,
    overallScore: score,
    healthRatingAr,
    strengthsAr,
    vulnerabilitiesAr,
  };
}

/**
 * Check Budget Variance Alerts (Proactive 80% warning and 100% breach)
 */
export function checkBudgetVariances(
  budgets: {
    categoryId?: number;
    categoryNameAr: string;
    budgetLimitEGP: number;
    actualSpentEGP: number;
  }[]
): BudgetVarianceAlert[] {
  return budgets.map((b) => {
    const limit = Math.max(1, b.budgetLimitEGP);
    const spent = Math.max(0, b.actualSpentEGP);
    const usagePercent = Number(((spent / limit) * 100).toFixed(1));
    const remaining = Number((limit - spent).toFixed(2));

    let alertLevel: "SAFE" | "APPROACHING_LIMIT" | "EXCEEDED" = "SAFE";
    let messageAr = `ضمن حدود الميزانية المحددة (مستنفد ${usagePercent}%).`;

    if (usagePercent >= 100) {
      alertLevel = "EXCEEDED";
      messageAr = `تجاوز الميزانية! تم إنفاق (${spent.toLocaleString("ar-EG")} ج.م) بنسبة (${usagePercent}%) من الحد المسموح.`;
    } else if (usagePercent >= 80) {
      alertLevel = "APPROACHING_LIMIT";
      messageAr = `تنبيه مبكر: تم استهلاك (${usagePercent}%) من ميزانية ${b.categoryNameAr}. المتبقي فقط (${remaining.toLocaleString("ar-EG")} ج.م).`;
    }

    return {
      categoryId: b.categoryId,
      categoryNameAr: b.categoryNameAr,
      budgetLimitEGP: limit,
      actualSpentEGP: spent,
      usagePercent,
      alertLevel,
      remainingEGP: remaining,
      messageAr,
    };
  });
}

/**
 * Calculate Recurring Subscriptions Countdown and Annual Drain
 */
export function calculateSubscriptionCountdowns(
  rules: {
    ruleId: number;
    memo: string;
    subscriptionTag?: string;
    amountEGP: number;
    cadence: "weekly" | "monthly" | "quarterly" | "yearly";
    nextRunAtMs: number;
  }[]
): {
  subscriptions: RecurringSubscriptionCountdown[];
  totalAnnualDrainEGP: number;
} {
  const now = Date.now();
  let totalAnnualDrainEGP = 0;

  const subscriptions: RecurringSubscriptionCountdown[] = rules.map((r) => {
    let multiplier = 12;
    if (r.cadence === "weekly") multiplier = 52;
    else if (r.cadence === "monthly") multiplier = 12;
    else if (r.cadence === "quarterly") multiplier = 4;
    else if (r.cadence === "yearly") multiplier = 1;

    const annualCost = Number((r.amountEGP * multiplier).toFixed(2));
    totalAnnualDrainEGP += annualCost;

    const diffMs = r.nextRunAtMs - now;
    const daysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
    const nextRenewalDate = new Date(r.nextRunAtMs).toISOString().split("T")[0];

    return {
      ruleId: r.ruleId,
      memo: r.memo || "اشتراك دوري",
      subscriptionTag: r.subscriptionTag,
      amountEGP: r.amountEGP,
      cadence: r.cadence,
      nextRenewalDate,
      daysRemaining,
      annualCostEGP: annualCost,
    };
  });

  subscriptions.sort((a, b) => a.daysRemaining - b.daysRemaining);

  return {
    subscriptions,
    totalAnnualDrainEGP: Number(totalAnnualDrainEGP.toFixed(2)),
  };
}
