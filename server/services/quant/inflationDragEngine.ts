/**
 * Module P4: Inflation Drag & Real Purchasing Power Engine
 * Evaluates real returns (Fisher equation: R_real = R_nominal - Inflation)
 * across portfolio asset buckets (Gold, Equities, Fixed Income CDs, and Cash).
 * Computes portfolio-level Real Wealth Preservation Index and monetary purchasing power erosion/gain.
 */

export interface AssetBucketInflationMetrics {
  bucketKey: "GOLD" | "EQUITIES" | "FIXED_INCOME" | "CASH" | "OTHER";
  labelAr: string;
  nominalValueEgp: number;
  weightPct: number; // e.g. 45.5 (%)
  nominalYieldPct: number; // e.g. 35.0 (%)
  realYieldPct: number; // e.g. 8.5 (%)
  status: "PROTECTED" | "ERODING"; // درع التضخم vs تآكل القوة الشرائية
  statusAr: string;
  annualMonetaryDragEgp: number; // positive = real purchasing gain, negative = real loss
  descriptionAr: string;
}

export interface InflationDragReport {
  baselineInflationPct: number; // e.g. 26.5% (CBE / CAPMAS baseline)
  inflationSourceAr: string;
  totalPortfolioValueEgp: number;
  weightedNominalYieldPct: number;
  weightedRealYieldPct: number;
  netAnnualRealDragEgp: number; // Total portfolio purchasing power gain/loss in EGP
  wealthPreservationScore: number; // 0 - 100
  preservationStatus: "EXCELLENT" | "MODERATE" | "HIGH_RISK";
  preservationStatusAr: string;
  buckets: AssetBucketInflationMetrics[];
  recommendationsAr: string[];
}

export interface InflationEngineInput {
  baselineInflationPct?: number; // defaults to 26.5% (current Egyptian baseline)
  goldValueEgp: number;
  equitiesValueEgp: number;
  fixedIncomeValueEgp: number;
  cashValueEgp: number;
  otherValueEgp?: number;
  customNominalYields?: {
    gold?: number;
    equities?: number;
    fixedIncome?: number;
    cash?: number;
  };
}

// Typical long-term nominal annualized yields in Egyptian market environment
const DEFAULT_NOMINAL_YIELDS = {
  gold: 38.0, // Historical annualized appreciation against local currency
  equities: 30.0, // EGX benchmark nominal capital appreciation + dividend yield
  fixedIncome: 24.5, // High-yield Egyptian bank certificates & treasury yields
  cash: 4.0, // Liquid current accounts / savings interest average
};

const DEFAULT_BASELINE_INFLATION = 26.5; // Official Egyptian headline annual inflation baseline

export function calculateInflationDrag(input: InflationEngineInput): InflationDragReport {
  const inflation = input.baselineInflationPct ?? DEFAULT_BASELINE_INFLATION;

  const goldVal = Math.max(0, input.goldValueEgp || 0);
  const eqVal = Math.max(0, input.equitiesValueEgp || 0);
  const fiVal = Math.max(0, input.fixedIncomeValueEgp || 0);
  const cashVal = Math.max(0, input.cashValueEgp || 0);
  const otherVal = Math.max(0, input.otherValueEgp || 0);

  const totalValue = goldVal + eqVal + fiVal + cashVal + otherVal;

  const yields = {
    gold: input.customNominalYields?.gold ?? DEFAULT_NOMINAL_YIELDS.gold,
    equities: input.customNominalYields?.equities ?? DEFAULT_NOMINAL_YIELDS.equities,
    fixedIncome: input.customNominalYields?.fixedIncome ?? DEFAULT_NOMINAL_YIELDS.fixedIncome,
    cash: input.customNominalYields?.cash ?? DEFAULT_NOMINAL_YIELDS.cash,
    other: 0,
  };

  const rawBuckets: {
    key: "GOLD" | "EQUITIES" | "FIXED_INCOME" | "CASH" | "OTHER";
    label: string;
    val: number;
    nomYield: number;
    desc: string;
  }[] = [
    {
      key: "GOLD",
      label: "الذهب والسبائك النقدية",
      val: goldVal,
      nomYield: yields.gold,
      desc: "تحوط نقدي مباشر ضد تراجع العملة ومعدلات التضخم التاريخية.",
    },
    {
      key: "EQUITIES",
      label: "الأسهم والأصول الإنتاجية",
      val: eqVal,
      nomYield: yields.equities,
      desc: "أصول عينية تواكب التضخم عبر نمو الأرباح وإعادة تسعير الأصول الرأسمالية.",
    },
    {
      key: "FIXED_INCOME",
      label: "الشهادات البنكية وأدوات الدخل الثابت",
      val: fiVal,
      nomYield: yields.fixedIncome,
      desc: "عوائد تعاقدية منتظمة؛ تواجه تآكلاً طفيفاً إذا كان العائد الاسمي دون التضخم الفعلي.",
    },
    {
      key: "CASH",
      label: "السيولة والحسابات الجارية والمحافظ",
      val: cashVal,
      nomYield: yields.cash,
      desc: "سيولة حرة فورية لكنها تعاني من تآكل متسارع في قوتها الشرائية دون استثمار.",
    },
  ];

  if (otherVal > 0) {
    rawBuckets.push({
      key: "OTHER",
      label: "أصول أخرى",
      val: otherVal,
      nomYield: 0,
      desc: "أصول متنوعة لا يُحتسب لها عائد تضخمي افتراضي.",
    });
  }

  let totalWeightedNominal = 0;
  let netAnnualDrag = 0;

  const buckets: AssetBucketInflationMetrics[] = rawBuckets.map((b) => {
    const weight = totalValue > 0 ? (b.val / totalValue) * 100 : 0;
    const realYield = b.nomYield - inflation;
    const isProtected = realYield >= 0;
    const monetaryDrag = b.val * (realYield / 100);

    totalWeightedNominal += (b.val / (totalValue || 1)) * b.nomYield;
    netAnnualDrag += monetaryDrag;

    return {
      bucketKey: b.key,
      labelAr: b.label,
      nominalValueEgp: Math.round(b.val * 100) / 100,
      weightPct: Math.round(weight * 10) / 10,
      nominalYieldPct: Math.round(b.nomYield * 10) / 10,
      realYieldPct: Math.round(realYield * 10) / 10,
      status: isProtected ? "PROTECTED" : "ERODING",
      statusAr: isProtected ? "درع التضخم (محمي)" : "تآكل القوة الشرائية (معرض للخطر)",
      annualMonetaryDragEgp: Math.round(monetaryDrag * 100) / 100,
      descriptionAr: b.desc,
    };
  });

  const weightedNominalYieldPct = Math.round(totalWeightedNominal * 10) / 10;
  const weightedRealYieldPct = Math.round((weightedNominalYieldPct - inflation) * 10) / 10;

  // Wealth Preservation Score (0-100):
  // 100 if weightedRealYield >= +5%
  // 50 if weightedRealYield == 0%
  // 0 if weightedRealYield <= -15%
  let wealthPreservationScore = Math.round(50 + (weightedRealYieldPct / 10) * 50);
  wealthPreservationScore = Math.max(0, Math.min(100, wealthPreservationScore));

  let preservationStatus: "EXCELLENT" | "MODERATE" | "HIGH_RISK" = "MODERATE";
  let preservationStatusAr = "متوسط الحماية — المحفظة تحافظ على قيمتها الأساسية مع تآكل محدود";

  if (wealthPreservationScore >= 70) {
    preservationStatus = "EXCELLENT";
    preservationStatusAr = "درع فائق — ثروة العائلة تنمو بمعدل يفوق التضخم الحقيقي";
  } else if (wealthPreservationScore < 40) {
    preservationStatus = "HIGH_RISK";
    preservationStatusAr = "خطر تآكل مرتفع — نسبة السيولة غير المستثمرة تفوق المعدل الآمن";
  }

  const recommendationsAr: string[] = [];
  if (cashVal > 0 && cashVal / (totalValue || 1) > 0.25) {
    recommendationsAr.push(
      "نسبة السيولة النقدية تتجاوز 25% من إجمالي الثروة، مما يسبب تآكلاً سنوياً متسارعاً. يُنصح بتحويل الفائض إلى ذهب استثماري أو شهادات ادخار قصيرة الأجل."
    );
  }
  if (goldVal / (totalValue || 1) < 0.15) {
    recommendationsAr.push(
      "حصة الذهب والسبائك أقل من 15%. يُنصح بزيادة التخصيص الدفاعي لضمان حماية السيادية للثروة ضد انخفاض القوة الشرائية للجنيه."
    );
  }
  if (weightedRealYieldPct >= 0) {
    recommendationsAr.push(
      "العائد الحقيقي للمحفظة إيجابي (+ " + weightedRealYieldPct + "%). التوزيع الاستثماري الحالي يحقق نمواً صافياً بعد خصم معدلات التضخم المعلنة."
    );
  } else {
    recommendationsAr.push(
      "العائد الحقيقي الإجمالي سالب بمقدار (" + weightedRealYieldPct + "%). يتطلب الأمر إعادة توازن الأصول لصالح أدوات ذات عائد يفوق " + inflation + "%."
    );
  }

  return {
    baselineInflationPct: inflation,
    inflationSourceAr: "مؤشر أسعار المستهلكين السنوي (البنك المركزي المصري / الجهاز المركزي للتعبئة العامة والإحصاء)",
    totalPortfolioValueEgp: Math.round(totalValue * 100) / 100,
    weightedNominalYieldPct,
    weightedRealYieldPct,
    netAnnualRealDragEgp: Math.round(netAnnualDrag * 100) / 100,
    wealthPreservationScore,
    preservationStatus,
    preservationStatusAr,
    buckets,
    recommendationsAr,
  };
}
