/**
 * Module P2: Multi-Currency 6-Month Forward Cash Flow & Runway Engine
 * Synthesizes:
 * - Recurring subscriptions across 5 cycles (Weekly, Monthly, Quarterly, Semi-Annual, Annual)
 * - Fixed Income maturity dates and scheduled bank certificate monthly/periodic payouts
 * - Credit card minimum dues, installment plans, and loan amortizations
 * - Multi-currency balances (EGP local vs USD, EUR, SAR foreign liquid reserves)
 */

export interface RunwayAccountInput {
  id: number;
  name: string;
  currency: string;
  currentBalance: number;
  accountType?: string;
}

export interface RunwayCertificateInput {
  id: number;
  certificateName: string;
  bankName: string;
  principalAmount: number;
  interestRate: number; // e.g. 23.5 or 0.235
  payoutFrequency: "monthly" | "quarterly" | "semi_annual" | "annual";
  issueDate: number;
  maturityDate: number;
  currency?: string;
}

export interface RunwaySubscriptionInput {
  id: number;
  memo: string;
  amount: number;
  currency: string;
  intervalUnit?: "day" | "week" | "month" | "quarter" | "semi_annual" | "year";
  cadence?: "weekly" | "monthly" | "quarterly" | "semi_annual" | "annually" | "daily";
  intervalCount?: number;
  nextRunAt: number;
  category?: string;
}

export interface RunwayDebtInput {
  id: number;
  name: string;
  debtType?: string;
  currency: string;
  currentBalance: number;
  minimumPayment: number;
  paymentDay?: number;
}

export interface ForwardRunwayInput {
  horizonMonths?: number;
  accounts: RunwayAccountInput[];
  certificates?: RunwayCertificateInput[];
  subscriptions?: RunwaySubscriptionInput[];
  debts?: RunwayDebtInput[];
  now?: number;
}

export interface MonthlyRunwayProjection {
  monthIndex: number;
  monthKey: string;
  monthNameAr: string;
  startingBalanceEgp: number;
  projectedInflowsEgp: number;
  certificateYieldEgp: number;
  maturingPrincipalEgp: number;
  projectedOutflowsEgp: number;
  subscriptionsBurnEgp: number;
  debtInstallmentsEgp: number;
  netMonthlyDeltaEgp: number;
  endingBalanceEgp: number;
}

export interface ForeignCurrencyBalance {
  currency: string;
  totalAmount: number;
  accountCount: number;
  estimatedMonthsCoverage: number;
}

export interface ForwardRunwayReport {
  horizonMonths: number;
  baseCurrency: string;
  startingLiquidEgp: number;
  projectedEndingBalanceEgp: number;
  monthlyBurnRateEgp: number;
  safeRunwayMonths: number;
  runwayStatus: "EXCELLENT" | "ADEQUATE" | "CAUTION" | "CRITICAL";
  runwayStatusAr: string;
  timeline: MonthlyRunwayProjection[];
  foreignCurrencyBalances: ForeignCurrencyBalance[];
  totalInflowsEgp: number;
  totalOutflowsEgp: number;
  net6MonthDeltaEgp: number;
}

const ARABIC_MONTHS = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"
];

export function calculateForwardRunway(input: ForwardRunwayInput): ForwardRunwayReport {
  const horizon = Math.min(24, Math.max(1, input.horizonMonths ?? 6));
  const nowMs = input.now ?? Date.now();
  const baseCurrency = "EGP";

  // 1. Separate Local EGP vs Foreign Liquid Reserves
  let startingLiquidEgp = 0;
  const foreignMap: Record<string, { totalAmount: number; accountCount: number }> = {};

  for (const acc of input.accounts || []) {
    const bal = Math.max(0, acc.currentBalance || 0);
    const curr = (acc.currency || "EGP").toUpperCase();

    if (curr === "EGP") {
      startingLiquidEgp += bal;
    } else {
      if (!foreignMap[curr]) {
        foreignMap[curr] = { totalAmount: 0, accountCount: 0 };
      }
      foreignMap[curr].totalAmount += bal;
      foreignMap[curr].accountCount += 1;
    }
  }

  // 2. Normalize Subscriptions Monthly Equivalent Burn (5 Cycles)
  let totalMonthlySubscriptionBurn = 0;
  for (const sub of input.subscriptions || []) {
    const amt = Math.max(0, sub.amount || 0);
    const cadence = sub.cadence || (
      sub.intervalUnit === "week" ? "weekly" :
      sub.intervalUnit === "quarter" ? "quarterly" :
      sub.intervalUnit === "semi_annual" ? "semi_annual" :
      sub.intervalUnit === "year" ? "annually" :
      sub.intervalUnit === "day" ? "daily" : "monthly"
    );

    let monthlyNormalized = amt;
    switch (cadence) {
      case "daily":
        monthlyNormalized = amt * 30;
        break;
      case "weekly":
        monthlyNormalized = (amt * 52) / 12;
        break;
      case "monthly":
        monthlyNormalized = amt;
        break;
      case "quarterly":
        monthlyNormalized = amt / 3;
        break;
      case "semi_annual":
        monthlyNormalized = amt / 6;
        break;
      case "annually":
        monthlyNormalized = amt / 12;
        break;
    }
    totalMonthlySubscriptionBurn += monthlyNormalized;
  }

  // 3. Normalize Debt Monthly Installments & Minimum Dues
  let totalMonthlyDebtBurn = 0;
  for (const d of input.debts || []) {
    const minPay = Math.max(0, d.minimumPayment || 0);
    const principal = Math.max(0, d.currentBalance || 0);

    if (minPay > 0) {
      totalMonthlyDebtBurn += minPay;
    } else if (principal > 0) {
      // 5% minimum payment rule standard across Egyptian banks
      totalMonthlyDebtBurn += Math.max(250, principal * 0.05);
    }
  }

  const baselineMonthlyOutflow = totalMonthlySubscriptionBurn + totalMonthlyDebtBurn;

  // 4. Construct Forward Timeline (Month 1 to Month N)
  const timeline: MonthlyRunwayProjection[] = [];
  let currentBalance = startingLiquidEgp;
  let accumulatedInflows = 0;
  let accumulatedOutflows = 0;

  const startDate = new Date(nowMs);

  for (let m = 0; m < horizon; m++) {
    const futureDate = new Date(startDate.getFullYear(), startDate.getMonth() + m + 1, 1);
    const monthKey = `${futureDate.getFullYear()}-${String(futureDate.getMonth() + 1).padStart(2, "0")}`;
    const monthNameAr = ARABIC_MONTHS[futureDate.getMonth()];
    const monthStartMs = futureDate.getTime();
    const monthEndMs = new Date(futureDate.getFullYear(), futureDate.getMonth() + 1, 0, 23, 59, 59).getTime();

    // A. Certificates Payouts & Maturities
    let certificateYield = 0;
    let maturingPrincipal = 0;

    for (const cert of input.certificates || []) {
      const p = Math.max(0, cert.principalAmount || 0);
      const rawRate = cert.interestRate || 0;
      const ratePct = rawRate > 1 ? rawRate / 100 : rawRate;

      // Check if certificate matures this month
      if (cert.maturityDate >= monthStartMs && cert.maturityDate <= monthEndMs) {
        maturingPrincipal += p;
      }

      // Check if certificate is still active this month
      if (cert.maturityDate >= monthStartMs && cert.issueDate <= monthEndMs) {
        const annualYield = p * ratePct;
        const freq = cert.payoutFrequency || "monthly";

        if (freq === "monthly") {
          certificateYield += annualYield / 12;
        } else if (freq === "quarterly" && (m + 1) % 3 === 0) {
          certificateYield += annualYield / 4;
        } else if (freq === "semi_annual" && (m + 1) % 6 === 0) {
          certificateYield += annualYield / 2;
        } else if (freq === "annual" && (m + 1) % 12 === 0) {
          certificateYield += annualYield;
        }
      }
    }

    const projectedInflows = Math.round((certificateYield + maturingPrincipal) * 100) / 100;
    const projectedOutflows = Math.round(baselineMonthlyOutflow * 100) / 100;
    const netDelta = Math.round((projectedInflows - projectedOutflows) * 100) / 100;

    const startBal = currentBalance;
    const endBal = Math.round((startBal + netDelta) * 100) / 100;
    currentBalance = endBal;

    accumulatedInflows += projectedInflows;
    accumulatedOutflows += projectedOutflows;

    timeline.push({
      monthIndex: m + 1,
      monthKey,
      monthNameAr,
      startingBalanceEgp: Math.round(startBal * 100) / 100,
      projectedInflowsEgp: projectedInflows,
      certificateYieldEgp: Math.round(certificateYield * 100) / 100,
      maturingPrincipalEgp: Math.round(maturingPrincipal * 100) / 100,
      projectedOutflowsEgp: projectedOutflows,
      subscriptionsBurnEgp: Math.round(totalMonthlySubscriptionBurn * 100) / 100,
      debtInstallmentsEgp: Math.round(totalMonthlyDebtBurn * 100) / 100,
      netMonthlyDeltaEgp: netDelta,
      endingBalanceEgp: endBal,
    });
  }

  // 5. Safe Runway in Months
  const monthlyBurn = Math.round(baselineMonthlyOutflow * 100) / 100;
  let safeRunwayMonths = 999;
  if (monthlyBurn > 0) {
    safeRunwayMonths = Math.round((startingLiquidEgp / monthlyBurn) * 10) / 10;
  }

  let runwayStatus: "EXCELLENT" | "ADEQUATE" | "CAUTION" | "CRITICAL" = "EXCELLENT";
  let runwayStatusAr = "ممتاز — مدرج أمان نقدي يتجاوز 12 شهراً";

  if (safeRunwayMonths < 3) {
    runwayStatus = "CRITICAL";
    runwayStatusAr = "حرج جداً — رصيد السيولة يكفي لأقل من 3 أشهر فقط";
  } else if (safeRunwayMonths < 6) {
    runwayStatus = "CAUTION";
    runwayStatusAr = "تحذير — مدرج السيولة محدود (دون 6 أشهر)";
  } else if (safeRunwayMonths < 12) {
    runwayStatus = "ADEQUATE";
    runwayStatusAr = "كافٍ — مدرج السيولة يغطي الاحتياجات التشغيلية";
  }

  const foreignCurrencyBalances: ForeignCurrencyBalance[] = Object.entries(foreignMap).map(
    ([curr, data]) => ({
      currency: curr,
      totalAmount: Math.round(data.totalAmount * 100) / 100,
      accountCount: data.accountCount,
      estimatedMonthsCoverage: monthlyBurn > 0 ? Math.round((data.totalAmount * 48.5) / monthlyBurn) : 99,
    })
  );

  return {
    horizonMonths: horizon,
    baseCurrency,
    startingLiquidEgp: Math.round(startingLiquidEgp * 100) / 100,
    projectedEndingBalanceEgp: Math.round(currentBalance * 100) / 100,
    monthlyBurnRateEgp: monthlyBurn,
    safeRunwayMonths,
    runwayStatus,
    runwayStatusAr,
    timeline,
    foreignCurrencyBalances,
    totalInflowsEgp: Math.round(accumulatedInflows * 100) / 100,
    totalOutflowsEgp: Math.round(accumulatedOutflows * 100) / 100,
    net6MonthDeltaEgp: Math.round((accumulatedInflows - accumulatedOutflows) * 100) / 100,
  };
}
