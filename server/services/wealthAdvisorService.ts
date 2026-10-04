// ======================================================================
// FAMILY WEALTH INTELLIGENCE — Family AI Wealth Advisor Engine
// Advisory-Only Portfolio Diagnostics, Liquidity & Rebalancing System
// ======================================================================

import Decimal from "decimal.js";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import { ensurePersonalFamilyContext } from "../familyAccess";
import { loadWealthHealthAggregations } from "../wealthHealthRouter";
import { getLiveGoldAndFxRates } from "./goldFxLiveFeedService";
import { calculateInflationDrag, type InflationDragReport } from "./quant/inflationDragEngine";
import { getCachedReadModel } from "../readModelCache";

export interface TargetAllocationBucket {
  key: "GOLD" | "EQUITIES" | "FIXED_INCOME" | "LIQUID_CASH" | "SPECIAL_ASSETS";
  labelAr: string;
  currentValueBase: number;
  currentWeightPct: number;
  targetWeightPct: number;
  gapWeightPct: number; // current - target (positive = overweight, negative = underweight)
  gapAmountBase: number;
  status: "BALANCED" | "UNDERWEIGHT" | "OVERWEIGHT";
  statusAr: string;
  recommendedActionAr: string;
}

export interface RebalancingRecommendation {
  id: string;
  priority: "CRITICAL" | "HIGH" | "MEDIUM" | "OPPORTUNITY";
  priorityLabelAr: string;
  category: "LIQUIDITY" | "INFLATION_SHIELD" | "ALLOCATION" | "CONCENTRATION";
  titleAr: string;
  actionSummaryAr: string;
  actionDetailsAr: string;
  suggestedAmountBase?: number;
  impactMetricsAr: string;
}

export interface StagnantLiquidityReport {
  totalLiquidCashBase: number;
  monthlyEssentialBurnBase: number;
  emergencyFundMonthsTarget: number;
  emergencyFundRequiredBase: number;
  stagnantSurplusCashBase: number;
  stagnantRatioPct: number;
  annualPurchasingPowerLossBase: number;
  liquidityHealthStatus: "OPTIMAL" | "SURPLUS_IDLE" | "DEFICIT_RISK";
  liquidityHealthStatusAr: string;
  summaryAr: string;
}

export interface WealthAdvisorPackage {
  asOf: number;
  workspaceName: string;
  baseCurrency: string;
  totalNetWorthBase: number;
  totalAssetsBase: number;
  totalLiabilitiesBase: number;

  // 1. Liquidity & Emergency Fund Structure
  liquidity: StagnantLiquidityReport;

  // 2. Inflation Shield & Real Wealth Preservation
  inflationShield: {
    headlineInflationPct: number;
    portfolioNominalYieldPct: number;
    portfolioRealYieldPct: number;
    shieldScore: number; // 0 - 100
    shieldStatus: "EXCELLENT" | "MODERATE" | "HIGH_RISK";
    shieldStatusAr: string;
    netAnnualDragBase: number;
    summaryAr: string;
  };

  // 3. Strategic Allocation Gap Matrix
  allocationGaps: {
    buckets: TargetAllocationBucket[];
    maxGapBucket: string;
    overallRebalanceNeeded: boolean;
  };

  // 4. Actionable Executive Rebalancing Recommendations
  recommendations: RebalancingRecommendation[];

  // 5. Executive AI Summary Briefing
  executiveBriefAr: {
    greeting: string;
    overallDiagnosisAr: string;
    keyOpportunityAr: string;
    primaryRiskAlertAr: string;
  };
}

/**
 * Standard strategic benchmark allocation weights for conservative family wealth preservation:
 * - Fixed Income (High Yield Bank Certificates): 35%
 * - Gold & Precious Metals: 25%
 * - Equities & Productive Assets: 20%
 * - Liquid Emergency & Buffer Cash: 15%
 * - Special / Alternatives: 5%
 */
const DEFAULT_STRATEGIC_TARGETS: Record<TargetAllocationBucket["key"], number> = {
  FIXED_INCOME: 35.0,
  GOLD: 25.0,
  EQUITIES: 20.0,
  LIQUID_CASH: 15.0,
  SPECIAL_ASSETS: 5.0,
};

const DEFAULT_HEADLINE_INFLATION = 26.5; // Official Egyptian headline baseline

/**
 * Computes complete AI Wealth Advisor diagnostic and opportunity package.
 */
export async function generateWealthAdvisorPackage(
  family: Awaited<ReturnType<typeof ensurePersonalFamilyContext>>,
  options?: {
    customInflationRate?: number;
    customTargetMonths?: number;
    customTargets?: Partial<typeof DEFAULT_STRATEGIC_TARGETS>;
  }
): Promise<WealthAdvisorPackage> {
  const asOf = Date.now();
  const baseCurrency = family.workspace.baseCurrency || "EGP";
  const inflationRate = options?.customInflationRate ?? DEFAULT_HEADLINE_INFLATION;
  const emergencyTargetMonths = options?.customTargetMonths ?? 6;

  // 1. Load authoritative financial aggregations from wealth health router
  const healthData = await loadWealthHealthAggregations(family, asOf);

  // 2. Load live market rates
  let liveGoldRates;
  try {
    liveGoldRates = await getLiveGoldAndFxRates();
  } catch {
    liveGoldRates = null;
  }

  // 3. Extract asset values
  const liquidCashVal = Math.max(0, healthData.liquidCashReserves.toNumber());
  const fixedIncomeVal = Math.max(0, healthData.classValues.fixed_income.toNumber());
  const equitiesVal = Math.max(0, healthData.classValues.equity.toNumber());
  const alternativesVal = Math.max(0, healthData.classValues.alternatives.toNumber());
  const otherVal = Math.max(0, healthData.classValues.other.toNumber());

  // Gold value: extracted from alternatives or direct positions
  const goldVal = alternativesVal; // Gold is classified under alternatives in asset classes
  const specialAssetsVal = otherVal;

  const totalAssetsVal = Math.max(
    0.01,
    healthData.totalEconomicAssets.toNumber() ||
      liquidCashVal + fixedIncomeVal + equitiesVal + goldVal + specialAssetsVal
  );
  const totalDebtVal = Math.max(0, healthData.totalDebtPrincipal.toNumber());
  const netWorthVal = Math.max(0, totalAssetsVal - totalDebtVal);

  // 4. Liquidity & Emergency Fund Analysis
  const monthlyEssentialBurn = Math.max(
    5000,
    healthData.monthlyEssentialOutflows.toNumber() ||
      healthData.operatingExpenses.div(12).toNumber() ||
      15000
  );
  const emergencyFundRequired = monthlyEssentialBurn * emergencyTargetMonths;
  const stagnantSurplusCash = Math.max(0, liquidCashVal - emergencyFundRequired);
  const stagnantRatioPct =
    liquidCashVal > 0 ? (stagnantSurplusCash / liquidCashVal) * 100 : 0;
  const annualPurchasingPowerLoss = stagnantSurplusCash * (inflationRate / 100);

  let liquidityStatus: StagnantLiquidityReport["liquidityHealthStatus"] = "OPTIMAL";
  let liquidityStatusAr = "متوازن ومثالي (احتياطي طوارئ مكتمل بدون ركود مفرط)";
  let liquiditySummaryAr = `السيولة الحالية (${liquidCashVal.toLocaleString("en-US")} ${baseCurrency}) تغطي ${(
    liquidCashVal / monthlyEssentialBurn
  ).toFixed(1)} شهراً من النفقات الأساسية.`;

  if (stagnantSurplusCash > 20000 && stagnantRatioPct >= 40) {
    liquidityStatus = "SURPLUS_IDLE";
    liquidityStatusAr = "سيولة راكدة مرتفعة (فرصة فورية لتحسين العائد)";
    liquiditySummaryAr = `يوجد فائض نقدي راكد قدره ${stagnantSurplusCash.toLocaleString("en-US")} ${baseCurrency} يفوق حاجة صندوق الطوارئ (${emergencyTargetMonths} أشهر)، ويتآكل سنوياً بقيمة ${annualPurchasingPowerLoss.toLocaleString("en-US")} ${baseCurrency} بفعل التضخم.`;
  } else if (liquidCashVal < emergencyFundRequired * 0.7) {
    liquidityStatus = "DEFICIT_RISK";
    liquidityStatusAr = "عجز في احتياطي الأمان والطوارئ";
    liquiditySummaryAr = `السيولة المتاحة تغطي أقل من ${(liquidCashVal / monthlyEssentialBurn).toFixed(1)} شهراً مقارنة بالمستهدف الآمن (${emergencyTargetMonths} أشهر).`;
  }

  const liquidityReport: StagnantLiquidityReport = {
    totalLiquidCashBase: Math.round(liquidCashVal * 100) / 100,
    monthlyEssentialBurnBase: Math.round(monthlyEssentialBurn * 100) / 100,
    emergencyFundMonthsTarget: emergencyTargetMonths,
    emergencyFundRequiredBase: Math.round(emergencyFundRequired * 100) / 100,
    stagnantSurplusCashBase: Math.round(stagnantSurplusCash * 100) / 100,
    stagnantRatioPct: Math.round(stagnantRatioPct * 10) / 10,
    annualPurchasingPowerLossBase: Math.round(annualPurchasingPowerLoss * 100) / 100,
    liquidityHealthStatus: liquidityStatus,
    liquidityHealthStatusAr: liquidityStatusAr,
    summaryAr: liquiditySummaryAr,
  };

  // 5. Inflation Shield Engine
  const inflationReport: InflationDragReport = calculateInflationDrag({
    baselineInflationPct: inflationRate,
    goldValueEgp: goldVal,
    equitiesValueEgp: equitiesVal,
    fixedIncomeValueEgp: fixedIncomeVal,
    cashValueEgp: liquidCashVal,
    otherValueEgp: specialAssetsVal,
  });

  // 6. Target Allocation Gap Analysis
  const targets: Record<TargetAllocationBucket["key"], number> = {
    ...DEFAULT_STRATEGIC_TARGETS,
    ...options?.customTargets,
  };
  const rawBucketsData = [
    { key: "FIXED_INCOME" as const, labelAr: "الشهادات والودائع (دخل ثابت)", val: fixedIncomeVal, target: targets.FIXED_INCOME },
    { key: "GOLD" as const, labelAr: "الذهب والسبائك النقدية", val: goldVal, target: targets.GOLD },
    { key: "EQUITIES" as const, labelAr: "الأسهم والأصول الإنتاجية", val: equitiesVal, target: targets.EQUITIES },
    { key: "LIQUID_CASH" as const, labelAr: "السيولة وصندوق الطوارئ", val: liquidCashVal, target: targets.LIQUID_CASH },
    { key: "SPECIAL_ASSETS" as const, labelAr: "الأصول العينية والعقارات", val: specialAssetsVal, target: targets.SPECIAL_ASSETS },
  ];

  let maxGapBucket = "";
  let maxAbsGap = 0;
  let rebalanceNeeded = false;

  const allocationBuckets: TargetAllocationBucket[] = rawBucketsData.map((b) => {
    const currentWeightPct = totalAssetsVal > 0 ? (b.val / totalAssetsVal) * 100 : 0;
    const targetWeightPct = b.target;
    const gapWeightPct = currentWeightPct - targetWeightPct;
    const gapAmountBase = (gapWeightPct / 100) * totalAssetsVal;

    let status: TargetAllocationBucket["status"] = "BALANCED";
    let statusAr = "متوازن مع النطاق المستهدف";
    let recommendedActionAr = "الحفاظ على المخصص الحالي ومراقبة العوائد.";

    if (gapWeightPct > 5.0) {
      status = "OVERWEIGHT";
      statusAr = `فائض مخصص (+${gapWeightPct.toFixed(1)}%)`;
      recommendedActionAr = `جني جزئي أو توجيه العوائد القادمة لتغطية الفئات ذات العجز.`;
    } else if (gapWeightPct < -5.0) {
      status = "UNDERWEIGHT";
      statusAr = `عجز مخصص (${gapWeightPct.toFixed(1)}%)`;
      recommendedActionAr = `تعزيز الحيازة بمقدار ${Math.abs(gapAmountBase).toLocaleString("en-US", { maximumFractionDigits: 0 })} ${baseCurrency}.`;
    }

    if (Math.abs(gapWeightPct) > maxAbsGap) {
      maxAbsGap = Math.abs(gapWeightPct);
      maxGapBucket = b.labelAr;
    }
    if (Math.abs(gapWeightPct) > 7.0) {
      rebalanceNeeded = true;
    }

    return {
      key: b.key,
      labelAr: b.labelAr,
      currentValueBase: Math.round(b.val * 100) / 100,
      currentWeightPct: Math.round(currentWeightPct * 10) / 10,
      targetWeightPct: Math.round(targetWeightPct * 10) / 10,
      gapWeightPct: Math.round(gapWeightPct * 10) / 10,
      gapAmountBase: Math.round(gapAmountBase * 100) / 100,
      status,
      statusAr,
      recommendedActionAr,
    };
  });

  // 7. Generate Actionable, Executive Rebalancing Recommendations
  const recommendations: RebalancingRecommendation[] = [];

  // Rec 1: Stagnant Liquidity Optimization
  if (stagnantSurplusCash >= 15000) {
    const deployAmount = Math.floor(stagnantSurplusCash / 5000) * 5000;
    const additionalYield = deployAmount * 0.245; // 24.5% certificate
    recommendations.push({
      id: "REC_IDLE_LIQUIDITY",
      priority: "HIGH",
      priorityLabelAr: "أولوية مرتفعة",
      category: "LIQUIDITY",
      titleAr: "استثمار فائض السيولة الراكدة في شهادات ادخار بعائد دوري",
      actionSummaryAr: `توجيه ${deployAmount.toLocaleString("en-US")} ${baseCurrency} من الحسابات الجارية إلى شهادات ادخارية أو أذون خزانة بعائد 24.5%.`,
      actionDetailsAr: `الحسابات الجارية تحتجز سيولة تفوق صندوق الطوارئ المطلوب (${emergencyTargetMonths} أشهر). توجيه الفائض يولد دخلاً سنوياً إضافياً يبلغ ${additionalYield.toLocaleString("en-US")} ${baseCurrency} ويحمي القوة الشرائية من التضخم.`,
      suggestedAmountBase: deployAmount,
      impactMetricsAr: `عائد سنوي إضافي: +${additionalYield.toLocaleString("en-US")} ${baseCurrency} · رفع درع التضخم بـ +${((deployAmount / totalAssetsVal) * 15).toFixed(1)} نقطة`,
    });
  }

  // Rec 2: Gold Allocation Underweight
  const goldBucket = allocationBuckets.find((b) => b.key === "GOLD");
  if (goldBucket && goldBucket.gapWeightPct < -5.0) {
    const targetAdd = Math.abs(goldBucket.gapAmountBase);
    recommendations.push({
      id: "REC_GOLD_HEDGE",
      priority: "HIGH",
      priorityLabelAr: "أولوية مرتفعة",
      category: "INFLATION_SHIELD",
      titleAr: "تعزيز حيازة الذهب والسبائك النقدية للوصول للمستهدف الاستراتيجي",
      actionSummaryAr: `زيادة مخصصات الذهب بمقدار ${targetAdd.toLocaleString("en-US", { maximumFractionDigits: 0 })} ${baseCurrency} لتغطية فجوة التخصيص (${goldBucket.currentWeightPct}% حالياً مقابل مستهدف 25%).`,
      actionDetailsAr: `الذهب يمثل درع التحوط التاريخي الأكثر فاعلية ضد انخفاض العملة المحلية ومعدلات التضخم التراكمية. بلوغ نسبة 25% يرفع مؤشر الحفاظ على الثروة إلى النطاق الممتاز.`,
      suggestedAmountBase: Math.round(targetAdd),
      impactMetricsAr: `الوصول لنسبة 25% تحوط كامل · حماية المحفظة من صدمات أسعار الصرف`,
    });
  }

  // Rec 3: Concentration Risk
  if (healthData.holdingsList && healthData.holdingsList.length > 0) {
    const topHolding = healthData.holdingsList[0];
    const topHoldingWeight = totalAssetsVal > 0 ? (topHolding.value.toNumber() / totalAssetsVal) * 100 : 0;
    if (topHoldingWeight > 35) {
      recommendations.push({
        id: "REC_CONCENTRATION_RISK",
        priority: "MEDIUM",
        priorityLabelAr: "تنبيه مخاطر",
        category: "CONCENTRATION",
        titleAr: `تخفيف تركز الأصل (${topHolding.name}) لتفادي مخاطر التذبذب الحاد`,
        actionSummaryAr: `الأصل يمثل ${topHoldingWeight.toFixed(1)}% من إجمالي الثروة، وهو ما يتجاوز السقف الآمن للتركز الفردي (30% - 35%).`,
        actionDetailsAr: `ينصح بعدم زيادة ضخ السيولة في هذا المركز، وتوجيه التوزيعات النقدية أو التخارج التدريجي الجزئي نحو أدوات مالية ذات ارتباط عكسي لتحسين معامل شارب وتنويع المحفظة.`,
        impactMetricsAr: `خفض معامل التركز HHI · حماية المحفظة من الهبوط المفاجئ للأصل الواحد`,
      });
    }
  }

  // Rec 4: Emergency Fund Deficit
  if (liquidityStatus === "DEFICIT_RISK") {
    const deficitAmount = emergencyFundRequired - liquidCashVal;
    recommendations.push({
      id: "REC_EMERGENCY_BUFFER",
      priority: "CRITICAL",
      priorityLabelAr: "إجراء عاجل",
      category: "LIQUIDITY",
      titleAr: "بناء واكتمال احتياطي الأمان والطوارئ العائلي",
      actionSummaryAr: `تخصيص ${deficitAmount.toLocaleString("en-US", { maximumFractionDigits: 0 })} ${baseCurrency} من التدفقات القادمة للوصول لاحتياطي 6 أشهر نفقات أساسية.`,
      actionDetailsAr: `انخفاض السيولة دون 3 أشهر يهدد بكسر شهادات ادخارية أو بيع أصول استثمارية بخسارة في حال حدوث التزامات طارئة غير متوقعة.`,
      suggestedAmountBase: Math.round(deficitAmount),
      impactMetricsAr: `تأمين شبكة أمان لـ 6 أشهر نفقات معيشية كاملة`,
    });
  }

  // Fallback recommendation if portfolio is already well-balanced
  if (recommendations.length === 0) {
    recommendations.push({
      id: "REC_MAINTAIN_BALANCE",
      priority: "OPPORTUNITY",
      priorityLabelAr: "فرصة تحسين",
      category: "ALLOCATION",
      titleAr: "المحفظة في حالة توازن استراتيجي ممتاز — استمر في إعادة الاستثمار التلقائي",
      actionSummaryAr: `توزيعات الأصول الحالية تقع ضمن النطاقات المستهدفة لدرع التضخم والسيولة.`,
      actionDetailsAr: `يوصى بالاستمرار في توجيه الفوائض الدورية وفق النسب المستهدفة (35% شهادات، 25% ذهب، 20% أسهم، 15% سيولة) للحفاظ على التوازن الديناميكي.`,
      impactMetricsAr: `درع تضخم مستقر بنسبة ${inflationReport.wealthPreservationScore}%`,
    });
  }

  // 8. Executive AI Briefing Prose
  let overallDiagnosisAr = "";
  if (inflationReport.wealthPreservationScore >= 70) {
    overallDiagnosisAr = `المركز المالي للأسرة يتمتع بمتانة ممتازة ودرع تضخم قوي (${inflationReport.wealthPreservationScore}/100) يحمي القوة الشرائية بمعدل عائد حقيقي يفوق التضخم.`;
  } else if (inflationReport.wealthPreservationScore >= 45) {
    overallDiagnosisAr = `المحفظة المالية متوازنة بشكل عام (${inflationReport.wealthPreservationScore}/100)، إلا أن هناك فرصاً واضحة لرفع العائد الحقيقي وتقليص ركود السيولة.`;
  } else {
    overallDiagnosisAr = `المحفظة بحاجة إلى إعادة هيكلة وتفعيل لدرع التضخم (${inflationReport.wealthPreservationScore}/100)، حيث تعاني نسبة من الأصول من تآكل سنوي بفعل ارتفاع التضخم مقارنة بالعائد الاسمي.`;
  }

  const keyOpportunity = recommendations[0] ? recommendations[0].actionSummaryAr : "مواصلة استثمار العوائد الدورية.";
  const primaryRiskAlert =
    stagnantSurplusCash > 25000
      ? `تآكل القوة الشرائية للسيولة الراكدة بمقدار ${annualPurchasingPowerLoss.toLocaleString("en-US", { maximumFractionDigits: 0 })} ${baseCurrency} سنوياً.`
      : `مخاطر استمرار معدلات التضخم فوق ${inflationRate}%.`;

  return {
    asOf,
    workspaceName: family.workspace.name,
    baseCurrency,
    totalNetWorthBase: Math.round(netWorthVal * 100) / 100,
    totalAssetsBase: Math.round(totalAssetsVal * 100) / 100,
    totalLiabilitiesBase: Math.round(totalDebtVal * 100) / 100,
    liquidity: liquidityReport,
    inflationShield: {
      headlineInflationPct: inflationRate,
      portfolioNominalYieldPct: inflationReport.weightedNominalYieldPct,
      portfolioRealYieldPct: inflationReport.weightedRealYieldPct,
      shieldScore: inflationReport.wealthPreservationScore,
      shieldStatus: inflationReport.preservationStatus,
      shieldStatusAr: inflationReport.preservationStatusAr,
      netAnnualDragBase: Math.round(inflationReport.netAnnualRealDragEgp * 100) / 100,
      summaryAr: `العائد الاسمي الموزون للمحفظة هو ${inflationReport.weightedNominalYieldPct}% مقارنة بمعدل تضخم أساسي ${inflationRate}%.`,
    },
    allocationGaps: {
      buckets: allocationBuckets,
      maxGapBucket,
      overallRebalanceNeeded: rebalanceNeeded,
    },
    recommendations,
    executiveBriefAr: {
      greeting: `مرحباً ${family.profile?.displayName || family.workspace?.name || "مالك المساحة"}، إليك التحليل المالي التنفيذي وتوصيات إعادة التوازن لثروة العائلة:`,
      overallDiagnosisAr,
      keyOpportunityAr: keyOpportunity,
      primaryRiskAlertAr: primaryRiskAlert,
    },
  };
}
