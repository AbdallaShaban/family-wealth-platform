/**
 * Portfolio Asset Allocation & Rebalancing Engine
 * Monitors asset classes (Cash, Mutual Funds, EGX Stocks, Physical Gold),
 * detects concentration risks and computes mathematical rebalancing steps.
 */

export interface AssetAllocationSlice {
  assetClass: "CASH" | "MUTUAL_FUNDS" | "EGX_STOCKS" | "PHYSICAL_GOLD" | "OTHER";
  assetClassAr: string;
  currentValueEGP: number;
  currentWeightPercent: number;
  targetWeightPercent: number;
  variancePercent: number; // current - target
  actionNeeded: "BUY_MORE" | "REDUCE" | "BALANCED";
  actionAmountEGP: number;
}

export interface ConcentrationRiskAlert {
  identifier: string; // Ticker or asset name
  nameAr: string;
  assetClass: string;
  valueEGP: number;
  portfolioWeightPercent: number;
  limitThresholdPercent: number;
  riskLevel: "CRITICAL" | "HIGH" | "MODERATE" | "SAFE";
  adviceAr: string;
}

export interface RebalanceRecommendation {
  fromAssetClass: string;
  toAssetClass: string;
  suggestedTransferEGP: number;
  rationaleAr: string;
}

export interface RebalancingReport {
  totalPortfolioValueEGP: number;
  slices: AssetAllocationSlice[];
  concentrationAlerts: ConcentrationRiskAlert[];
  recommendations: RebalanceRecommendation[];
  overallHealthScore: number; // 0 to 100
  generatedAt: string;
}

/**
 * Standard conservative-growth target allocation models for Egyptian Family Wealth
 */
export const DEFAULT_TARGET_ALLOCATIONS: Record<
  "BALANCED" | "CONSERVATIVE" | "GROWTH",
  Record<"CASH" | "MUTUAL_FUNDS" | "EGX_STOCKS" | "PHYSICAL_GOLD", number>
> = {
  BALANCED: {
    CASH: 15, // 15% emergency cash / liquid accounts
    MUTUAL_FUNDS: 30, // 30% Money market & balanced funds
    EGX_STOCKS: 25, // 25% EGX blue-chips
    PHYSICAL_GOLD: 30, // 30% Gold hedging against currency devaluation
  },
  CONSERVATIVE: {
    CASH: 25,
    MUTUAL_FUNDS: 40,
    EGX_STOCKS: 10,
    PHYSICAL_GOLD: 25,
  },
  GROWTH: {
    CASH: 10,
    MUTUAL_FUNDS: 20,
    EGX_STOCKS: 45,
    PHYSICAL_GOLD: 25,
  },
};

/**
 * Compute portfolio rebalancing plan and concentration risk assessment
 */
export function calculateRebalancingPlan(params: {
  cashEGP: number;
  mutualFundsEGP: number;
  egxStocksEGP: number;
  goldEGP: number;
  individualHoldings?: { identifier: string; nameAr: string; assetClass: string; valueEGP: number }[];
  targetProfile?: "BALANCED" | "CONSERVATIVE" | "GROWTH";
  customTargets?: Partial<Record<"CASH" | "MUTUAL_FUNDS" | "EGX_STOCKS" | "PHYSICAL_GOLD", number>>;
}): RebalancingReport {
  const { cashEGP = 0, mutualFundsEGP = 0, egxStocksEGP = 0, goldEGP = 0 } = params;
  const totalPortfolioValueEGP = Math.max(0, cashEGP + mutualFundsEGP + egxStocksEGP + goldEGP);

  const targets = {
    ...DEFAULT_TARGET_ALLOCATIONS[params.targetProfile || "BALANCED"],
    ...(params.customTargets || {}),
  };

  const assetClasses: Array<{
    key: "CASH" | "MUTUAL_FUNDS" | "EGX_STOCKS" | "PHYSICAL_GOLD";
    nameAr: string;
    currentVal: number;
  }> = [
    { key: "CASH", nameAr: "النقد والسيولة الجارية", currentVal: Math.max(0, cashEGP) },
    { key: "MUTUAL_FUNDS", nameAr: "صناديق الاستثمار وأدوات الدخل", currentVal: Math.max(0, mutualFundsEGP) },
    { key: "EGX_STOCKS", nameAr: "الأسهم المقيدة بالبورصة المصرية", currentVal: Math.max(0, egxStocksEGP) },
    { key: "PHYSICAL_GOLD", nameAr: "الذهب المادي والسبائك", currentVal: Math.max(0, goldEGP) },
  ];

  const slices: AssetAllocationSlice[] = assetClasses.map((item) => {
    const currentWeightPercent =
      totalPortfolioValueEGP > 0 ? Number(((item.currentVal / totalPortfolioValueEGP) * 100).toFixed(2)) : 0;
    const targetWeightPercent = targets[item.key] || 25;
    const variancePercent = Number((currentWeightPercent - targetWeightPercent).toFixed(2));
    const targetValueEGP = (totalPortfolioValueEGP * targetWeightPercent) / 100;
    const deltaEGP = Math.round(targetValueEGP - item.currentVal);

    let actionNeeded: "BUY_MORE" | "REDUCE" | "BALANCED" = "BALANCED";
    if (variancePercent < -3) actionNeeded = "BUY_MORE";
    else if (variancePercent > 3) actionNeeded = "REDUCE";

    return {
      assetClass: item.key,
      assetClassAr: item.nameAr,
      currentValueEGP: item.currentVal,
      currentWeightPercent,
      targetWeightPercent,
      variancePercent,
      actionNeeded,
      actionAmountEGP: Math.abs(deltaEGP),
    };
  });

  // Concentration Alerts
  const concentrationAlerts: ConcentrationRiskAlert[] = [];
  const maxStockConcentrationPercent = 20; // Max 20% in any single stock
  const maxSingleAssetPercent = 40; // Max 40% in any single instrument

  if (params.individualHoldings && totalPortfolioValueEGP > 0) {
    for (const h of params.individualHoldings) {
      const weight = (h.valueEGP / totalPortfolioValueEGP) * 100;
      const threshold = h.assetClass === "EGX_STOCKS" ? maxStockConcentrationPercent : maxSingleAssetPercent;

      if (weight > threshold) {
        const excess = weight - threshold;
        const riskLevel = excess > 15 ? "CRITICAL" : excess > 5 ? "HIGH" : "MODERATE";
        concentrationAlerts.push({
          identifier: h.identifier,
          nameAr: h.nameAr,
          assetClass: h.assetClass,
          valueEGP: h.valueEGP,
          portfolioWeightPercent: Number(weight.toFixed(1)),
          limitThresholdPercent: threshold,
          riskLevel,
          adviceAr: `تشكل هذه الحصة (${weight.toFixed(1)}%) من إجمالي الثروة متجاوزة الحد الآمن الموصى به (${threshold}%). يُنصح بإعادة التوزيع تدريجياً لتفادي مخاطر التركز.`,
        });
      }
    }
  }

  // Generate actionable rebalance transfers
  const recommendations: RebalanceRecommendation[] = [];
  const overweighted = slices.filter((s) => s.actionNeeded === "REDUCE").sort((a, b) => b.variancePercent - a.variancePercent);
  const underweighted = slices.filter((s) => s.actionNeeded === "BUY_MORE").sort((a, b) => a.variancePercent - b.variancePercent);

  for (const under of underweighted) {
    let needed = under.actionAmountEGP;
    for (const over of overweighted) {
      if (needed <= 0 || over.actionAmountEGP <= 0) continue;
      const transfer = Math.min(needed, over.actionAmountEGP);
      if (transfer > 1000) {
        recommendations.push({
          fromAssetClass: over.assetClassAr,
          toAssetClass: under.assetClassAr,
          suggestedTransferEGP: Math.round(transfer),
          rationaleAr: `نقل ${Math.round(transfer).toLocaleString("ar-EG")} جنيه من ${over.assetClassAr} (فائض ${over.variancePercent}%) إلى ${under.assetClassAr} (عجز ${Math.abs(under.variancePercent)}%) لإعادة التوازن للوزن المستهدف.`,
        });
        needed -= transfer;
        over.actionAmountEGP -= transfer;
      }
    }
  }

  // Calculate Overall Diversification & Health Score (0-100)
  const totalVarianceAbs = slices.reduce((acc, s) => acc + Math.abs(s.variancePercent), 0);
  let overallHealthScore = Math.max(20, Math.round(100 - totalVarianceAbs * 1.2 - concentrationAlerts.length * 10));

  return {
    totalPortfolioValueEGP,
    slices,
    concentrationAlerts,
    recommendations,
    overallHealthScore: Math.min(100, overallHealthScore),
    generatedAt: new Date().toISOString(),
  };
}
