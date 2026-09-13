import React, { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import PageHeader from "@/components/PageHeader";
import FinancialTooltip from "@/components/FinancialTooltip";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import SensitiveValue from "@/components/SensitiveValue";
import { formatMoney } from "@/lib/financialDisplay";
import {
  HeartPulse,
  ShieldCheck,
  Activity,
  AlertTriangle,
  CheckCircle2,
  Coins,
  RefreshCw,
  Sparkles,
  Calculator,
  Save,
} from "lucide-react";

export default function WealthHealthPage() {
  const utils = trpc.useUtils();

  // FIRE Simulator Interactive State
  const [spendingMode, setSpendingMode] = useState<"actual_ttm" | "essential_ttm" | "custom">("actual_ttm");
  const [customSpending, setCustomSpending] = useState<string>("120000");
  const [customNominalReturn, setCustomNominalReturn] = useState<string>("7.0");
  const [customInflation, setCustomInflation] = useState<string>("3.0");
  const [customSwr, setCustomSwr] = useState<string>("4.0");

  // Save Assumptions State
  const [targetRetirementAge, setTargetRetirementAge] = useState<number>(60);
  const [isSavingAssumptions, setIsSavingAssumptions] = useState<boolean>(false);

  // Queries
  const scoreQuery = trpc.family.wealthHealth.getScoreCard.useQuery(
    {},
    {
      staleTime: 30_000,
      retry: 1,
    }
  );

  const fireQueryInput = {
    spendingMode,
    ...(spendingMode === "custom" && customSpending ? { customSpending } : {}),
    ...(customNominalReturn ? { customNominalReturn } : {}),
    ...(customInflation ? { customInflation } : {}),
    ...(customSwr ? { customSwr } : {}),
  };

  const fireQuery = trpc.family.wealthHealth.getFireStatus.useQuery(fireQueryInput, {
    staleTime: 15_000,
    retry: 1,
    placeholderData: prev => prev,
  });

  const saveAssumptionsMutation = trpc.family.wealthHealth.saveAssumptions.useMutation({
    onSuccess: data => {
      toast.success(data.message || "تم حفظ الافتراضات بنجاح.");
      setIsSavingAssumptions(false);
      void utils.family.wealthHealth.getFireStatus.invalidate();
      void utils.family.wealthHealth.getScoreCard.invalidate();
    },
    onError: err => {
      toast.error(`فشل حفظ الافتراضات: ${err.message}`);
      setIsSavingAssumptions(false);
    },
  });

  const handleSaveAssumptions = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingAssumptions(true);
    saveAssumptionsMutation.mutate({
      retirementAge: targetRetirementAge,
      safeWithdrawalRate: customSwr || "4.0",
      assumedAnnualReturn: customNominalReturn || "7.0",
      assumedAnnualInflation: customInflation || "3.0",
    });
  };

  const scoreData = scoreQuery.data;
  const fireData = fireQuery.data;
  const baseCurrency = scoreData?.baseCurrency || fireData?.baseCurrency || "EGP";

  const weakestDimensionKey = React.useMemo(() => {
    if (!scoreData?.dimensions) return null;
    const dims = [
      { key: "liquidity", score: parseFloat(scoreData.dimensions.liquidity.score) },
      { key: "debtSustainability", score: parseFloat(scoreData.dimensions.debtSustainability.score) },
      { key: "savingsVelocity", score: parseFloat(scoreData.dimensions.savingsVelocity.score) },
      { key: "diversification", score: parseFloat(scoreData.dimensions.diversification.score) },
      { key: "resilienceProtection", score: parseFloat(scoreData.dimensions.resilienceProtection.score) },
      { key: "fiProgress", score: parseFloat(scoreData.dimensions.fiProgress.score) },
    ];
    dims.sort((a, b) => a.score - b.score);
    return dims[0]?.key || null;
  }, [scoreData?.dimensions]);

  // Executive scoring tints helper
  const getDimensionScoreStyles = (scoreNum: number) => {
    if (scoreNum >= 80) {
      return {
        text: "text-emerald-600 dark:text-emerald-400 font-extrabold font-mono text-3xl tabular-nums",
        fill: "bg-emerald-500",
        badge: "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800 font-bold text-[10px] px-2 py-0.5 rounded-md",
        tier: "ممتاز",
      };
    }
    if (scoreNum >= 50) {
      return {
        text: "text-amber-600 dark:text-amber-400 font-extrabold font-mono text-3xl tabular-nums",
        fill: "bg-amber-500",
        badge: "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800 font-bold text-[10px] px-2 py-0.5 rounded-md",
        tier: "متوسط",
      };
    }
    return {
      text: "text-rose-600 dark:text-rose-400 font-extrabold font-mono text-3xl tabular-nums",
      fill: "bg-rose-500",
      badge: "bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800 font-bold text-[10px] px-2 py-0.5 rounded-md",
      tier: "منخفض",
    };
  };

  const isNegativeReal = fireData ? parseFloat(fireData.assumptions.realReturnPercent) < 0 : false;

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-7xl mx-auto" dir="rtl">
        {/* ==================================================================== */}
        {/* 1. HEADER & ACTIONS */}
        {/* ==================================================================== */}
        <PageHeader
          title="الصحة المالية ومحاكي الاستقلال المالي"
          description="مؤشر حتمي شامل متعدد الأبعاد (0–100) ومحاكي أفق الاستقلال المالي والتقاعد (FIRE)"
          icon={HeartPulse}
          breadcrumbs={[
            { label: "الرئيسية", href: "/" },
            { label: "البصيرة المالية والتقييم", href: "/valuation" },
            { label: "الصحة المالية والاستقلال المالي" },
          ]}
          badge={{ text: "مؤشر حتمي 0–100", variant: "institutional" }}
          actions={
            <button
              onClick={() => {
                void utils.family.wealthHealth.getScoreCard.invalidate();
                void utils.family.wealthHealth.getFireStatus.invalidate();
                toast.info("تم تحديث بيانات الصحة المالية.");
              }}
              disabled={scoreQuery.isRefetching || fireQuery.isRefetching}
              className="bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:hover:bg-slate-100 dark:text-slate-950 font-bold text-xs px-4 py-2 rounded-xl shadow-sm transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              <RefreshCw className={`size-3.5 ${scoreQuery.isRefetching ? "animate-spin" : ""}`} />
              <span>تحديث الفحص</span>
            </button>
          }
        />

        {/* ==================================================================== */}
        {/* 2. OVERALL SCORE HERO GAUGE & RELIABILITY BOX */}
        {/* ==================================================================== */}
        {scoreQuery.isLoading ? (
          <div className="grid gap-6 md:grid-cols-3">
            <Skeleton className="h-48 rounded-2xl" />
            <Skeleton className="h-48 rounded-2xl md:col-span-2" />
          </div>
        ) : scoreData ? (
          <div className="bg-white dark:bg-[#0B0F17] border border-slate-200/90 dark:border-slate-800/80 rounded-2xl p-6 shadow-xs mb-6 flex flex-col md:flex-row items-center justify-between gap-6">
            {/* Left: Overall Health Score */}
            <div className="w-full md:w-5/12 flex flex-col justify-between border-b md:border-b-0 md:border-l border-slate-100 dark:border-slate-800/80 pb-5 md:pb-0 md:pl-6">
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <FinancialTooltip term="FIRE_SCORE">
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400 cursor-help border-b border-dashed border-slate-400/60">
                      مؤشر الصحة المالية الشامل
                    </span>
                  </FinancialTooltip>
                  <span className="bg-sky-50 text-sky-700 border border-sky-200/80 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800/60 font-bold text-xs px-3 py-1 rounded-lg">
                    {scoreData.ratingTier === "excellent"
                      ? "مرونة استثنائية"
                      : scoreData.ratingTier === "good"
                      ? "نمو متوازن"
                      : scoreData.ratingTier === "moderate"
                      ? "تحت المراقبة"
                      : "حرج"}
                  </span>
                </div>

                <div className="flex items-baseline gap-2 justify-start my-2">
                  <span className="text-slate-900 dark:text-white font-extrabold font-mono text-5xl tabular-nums">
                    {scoreData.totalScore}
                  </span>
                  <span className="text-slate-400 dark:text-slate-500 font-semibold text-lg">/ 100</span>
                </div>

                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mt-1">
                  {scoreData.ratingTierLabelAr}
                </p>
              </div>

              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/60 font-mono text-[11px]">
                <ShieldCheck className="size-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>تقييم حتمي استناداً إلى الدفتر المحاسبي</span>
              </div>
            </div>

            {/* Right: Data Reliability & Quality (3 Distinct Institutional Stat Pills) */}
            <div className="w-full md:w-7/12 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2">
                    <div className="size-7 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center">
                      <Activity className="size-4 text-sky-600 dark:text-sky-400" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white">موثوقية وجودة البيانات المحاسبية</h3>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        يُحسب مؤشر الثقة وفق مدة تاريخ الدفتر، واكتمال تصنيف المصروفات، وحداثة تقييمات الأصول.
                      </p>
                    </div>
                  </div>
                  <span
                    className={
                      scoreData.confidence.level === "high"
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200/80 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800/70 font-bold text-[11px] px-2.5 py-1 rounded-lg shrink-0"
                        : scoreData.confidence.level === "medium"
                        ? "bg-sky-50 text-sky-700 border border-sky-200/80 dark:bg-sky-950/50 dark:text-sky-300 dark:border-sky-800/70 font-bold text-[11px] px-2.5 py-1 rounded-lg shrink-0"
                        : "bg-amber-50 text-amber-700 border border-amber-200/80 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800/70 font-bold text-[11px] px-2.5 py-1 rounded-lg shrink-0"
                    }
                  >
                    {scoreData.confidence.level === "high"
                      ? "ثقة عالية"
                      : scoreData.confidence.level === "medium"
                      ? "ثقة متوسطة"
                      : "ثقة منخفضة"}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-3 text-center my-3">
                  <div className="bg-slate-50 dark:bg-[#0E1420] border border-slate-200/70 dark:border-slate-800 rounded-xl p-3 text-center">
                    <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">تاريخ الدفتر</p>
                    <p className="text-base font-bold font-mono mt-0.5 text-slate-900 dark:text-white tabular-nums">
                      {scoreData.confidence.historyMonths} شهرًا
                    </p>
                  </div>
                  <div className="bg-slate-50 dark:bg-[#0E1420] border border-slate-200/70 dark:border-slate-800 rounded-xl p-3 text-center">
                    <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">اكتمال التصنيف</p>
                    <p className="text-base font-bold font-mono mt-0.5 text-slate-900 dark:text-white tabular-nums">
                      {scoreData.confidence.completenessPercent}%
                    </p>
                  </div>
                  <div className="bg-slate-50 dark:bg-[#0E1420] border border-slate-200/70 dark:border-slate-800 rounded-xl p-3 text-center">
                    <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">تقييمات حديثة</p>
                    <p className="text-base font-bold font-mono mt-0.5 text-slate-900 dark:text-white tabular-nums">
                      {scoreData.confidence.freshnessRatio}%
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800/60">
                  <span className="flex items-center gap-1.5 font-medium">
                    <ShieldCheck className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                    موثوقية مثبتة بالدفتر المالي
                  </span>
                  <span className="bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-mono font-bold text-[11px] px-2.5 py-0.5 rounded-lg border border-slate-200/60 dark:border-slate-700/60">
                    آخر تدقيق: {new Date(scoreData.asOf).toLocaleDateString("ar-EG")}
                  </span>
                </div>

                {scoreData.confidence.warningsAr.length > 0 && (
                  <div className="bg-amber-50/70 border border-amber-200/80 text-amber-900 dark:bg-amber-950/30 dark:border-amber-800/60 dark:text-amber-200 text-xs rounded-xl p-3 mt-3 flex items-start gap-2">
                    <AlertTriangle className="size-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                    <div className="space-y-1">
                      {scoreData.confidence.warningsAr.map((w, i) => (
                        <p key={i}>{w}</p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : null}

        {/* ==================================================================== */}
        {/* 3. SIX DIMENSION BREAKDOWN CARDS */}
        {/* ==================================================================== */}
        {scoreData && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">أبعاد الصحة المالية الستة</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">أوزان معيارية غير متداخلة تغطي كافة جوانب السلامة المالية</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
              {/* Dim 1: Liquidity */}
              {(() => {
                const num = parseFloat(scoreData.dimensions.liquidity.score);
                const styles = getDimensionScoreStyles(num);
                return (
                  <div
                    className={`bg-white dark:bg-[#0B0F17] border rounded-2xl p-5 shadow-xs flex flex-col justify-between transition-all ${
                      weakestDimensionKey === "liquidity"
                        ? "border-amber-400/70 dark:border-amber-600/70"
                        : "border-slate-200/90 dark:border-slate-800/80"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="size-7 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs flex items-center justify-center">
                            1
                          </span>
                          <h3 className="text-sm font-bold text-slate-900 dark:text-white">السيولة والمرونة في الطوارئ</h3>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {weakestDimensionKey === "liquidity" && (
                            <span className="bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 text-[10px] font-bold px-2 py-0.5 rounded-md border border-amber-200 dark:border-amber-800">
                              أولوية تحسين
                            </span>
                          )}
                          <span className="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 font-mono text-[10px] font-bold px-2 py-0.5 rounded-md">
                            وزن 20%
                          </span>
                        </div>
                      </div>

                      <div className="flex items-baseline justify-between mt-3 mb-1">
                        <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">الدرجة المحققة:</span>
                        <div className="flex items-baseline gap-1.5">
                          <span className={styles.text}>{scoreData.dimensions.liquidity.score}</span>
                          <span className="text-xs text-slate-400 dark:text-slate-500 font-normal">/ 100</span>
                        </div>
                      </div>

                      {/* Micro Progress Bar */}
                      <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden my-3">
                        <div
                          className={`h-full ${styles.fill} rounded-full transition-all duration-500`}
                          style={{ width: `${Math.min(100, Math.max(0, num))}%` }}
                        />
                      </div>

                      <div className="space-y-1.5 text-xs">
                        <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800/60">
                          <span className="text-slate-500 dark:text-slate-400">أشهر التغطية الاحتياطية:</span>
                          <span className="font-mono tabular-nums text-slate-800 dark:text-slate-200 font-semibold">
                            {scoreData.dimensions.liquidity.runwayMonths} شهرًا
                          </span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800/60">
                          <span className="text-slate-500 dark:text-slate-400">الاحتياطي النقدي المؤهل:</span>
                          <span className="font-mono tabular-nums text-slate-800 dark:text-slate-200 font-semibold">
                            <SensitiveValue>{formatMoney(scoreData.dimensions.liquidity.liquidReservesBase, baseCurrency, 0)}</SensitiveValue>
                          </span>
                        </div>
                        <div className="flex justify-between py-1">
                          <span className="text-slate-500 dark:text-slate-400">النفقات الأساسية الشهرية:</span>
                          <span className="font-mono tabular-nums text-slate-800 dark:text-slate-200 font-semibold">
                            <SensitiveValue>{formatMoney(scoreData.dimensions.liquidity.monthlyEssentialOutflowsBase, baseCurrency, 0)}</SensitiveValue>
                          </span>
                        </div>
                      </div>
                    </div>

                    <p className="text-xs text-slate-600 dark:text-slate-300 bg-slate-50/80 dark:bg-[#0E1420]/80 p-2.5 rounded-xl mt-3 leading-relaxed border border-slate-200/60 dark:border-slate-800/60">
                      {scoreData.dimensions.liquidity.driverAr}
                    </p>
                  </div>
                );
              })()}

              {/* Dim 2: Debt Sustainability */}
              {(() => {
                const num = parseFloat(scoreData.dimensions.debtSustainability.score);
                const styles = getDimensionScoreStyles(num);
                return (
                  <div
                    className={`bg-white dark:bg-[#0B0F17] border rounded-2xl p-5 shadow-xs flex flex-col justify-between transition-all ${
                      weakestDimensionKey === "debtSustainability"
                        ? "border-amber-400/70 dark:border-amber-600/70"
                        : "border-slate-200/90 dark:border-slate-800/80"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="size-7 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs flex items-center justify-center">
                            2
                          </span>
                          <h3 className="text-sm font-bold text-slate-900 dark:text-white">استدامة الديون والملاءة</h3>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {weakestDimensionKey === "debtSustainability" && (
                            <span className="bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 text-[10px] font-bold px-2 py-0.5 rounded-md border border-amber-200 dark:border-amber-800">
                              أولوية تحسين
                            </span>
                          )}
                          <span className="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 font-mono text-[10px] font-bold px-2 py-0.5 rounded-md">
                            وزن 20%
                          </span>
                        </div>
                      </div>

                      <div className="flex items-baseline justify-between mt-3 mb-1">
                        <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">الدرجة المحققة:</span>
                        <div className="flex items-baseline gap-1.5">
                          <span className={styles.text}>{scoreData.dimensions.debtSustainability.score}</span>
                          <span className="text-xs text-slate-400 dark:text-slate-500 font-normal">/ 100</span>
                        </div>
                      </div>

                      {/* Micro Progress Bar */}
                      <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden my-3">
                        <div
                          className={`h-full ${styles.fill} rounded-full transition-all duration-500`}
                          style={{ width: `${Math.min(100, Math.max(0, num))}%` }}
                        />
                      </div>

                      <div className="space-y-1.5 text-xs">
                        <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800/60">
                          <span className="text-slate-500 dark:text-slate-400">نسبة الرافعة (الدين/الأصول):</span>
                          <span className="font-mono tabular-nums text-slate-800 dark:text-slate-200 font-semibold">
                            {scoreData.dimensions.debtSustainability.leverageRatio}%
                          </span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800/60">
                          <span className="text-slate-500 dark:text-slate-400">معدل تغطية خدمة الدين (DSCR):</span>
                          <span className="font-mono tabular-nums text-slate-800 dark:text-slate-200 font-semibold">
                            {scoreData.dimensions.debtSustainability.dscr}x
                          </span>
                        </div>
                        <div className="flex justify-between py-1">
                          <span className="text-slate-500 dark:text-slate-400">أصل الديون القائمة:</span>
                          <span className="font-mono tabular-nums text-slate-800 dark:text-slate-200 font-semibold">
                            <SensitiveValue>{formatMoney(scoreData.dimensions.debtSustainability.totalDebtBase, baseCurrency, 0)}</SensitiveValue>
                          </span>
                        </div>
                      </div>
                    </div>

                    <p className="text-xs text-slate-600 dark:text-slate-300 bg-slate-50/80 dark:bg-[#0E1420]/80 p-2.5 rounded-xl mt-3 leading-relaxed border border-slate-200/60 dark:border-slate-800/60">
                      {scoreData.dimensions.debtSustainability.driverAr}
                    </p>
                  </div>
                );
              })()}

              {/* Dim 3: Savings Velocity */}
              {(() => {
                const num = parseFloat(scoreData.dimensions.savingsVelocity.score);
                const styles = getDimensionScoreStyles(num);
                return (
                  <div
                    className={`bg-white dark:bg-[#0B0F17] border rounded-2xl p-5 shadow-xs flex flex-col justify-between transition-all ${
                      weakestDimensionKey === "savingsVelocity"
                        ? "border-amber-400/70 dark:border-amber-600/70"
                        : "border-slate-200/90 dark:border-slate-800/80"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="size-7 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs flex items-center justify-center">
                            3
                          </span>
                          <h3 className="text-sm font-bold text-slate-900 dark:text-white">سرعة الادخار وتراكم الثروة</h3>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {weakestDimensionKey === "savingsVelocity" && (
                            <span className="bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 text-[10px] font-bold px-2 py-0.5 rounded-md border border-amber-200 dark:border-amber-800">
                              أولوية تحسين
                            </span>
                          )}
                          <span className="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 font-mono text-[10px] font-bold px-2 py-0.5 rounded-md">
                            وزن 20%
                          </span>
                        </div>
                      </div>

                      <div className="flex items-baseline justify-between mt-3 mb-1">
                        <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">الدرجة المحققة:</span>
                        <div className="flex items-baseline gap-1.5">
                          <span className={styles.text}>{scoreData.dimensions.savingsVelocity.score}</span>
                          <span className="text-xs text-slate-400 dark:text-slate-500 font-normal">/ 100</span>
                        </div>
                      </div>

                      {/* Micro Progress Bar */}
                      <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden my-3">
                        <div
                          className={`h-full ${styles.fill} rounded-full transition-all duration-500`}
                          style={{ width: `${Math.min(100, Math.max(0, num))}%` }}
                        />
                      </div>

                      <div className="space-y-1.5 text-xs">
                        <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800/60">
                          <span className="text-slate-500 dark:text-slate-400">معدل الادخار التشغيلي:</span>
                          <span className="font-mono tabular-nums text-slate-800 dark:text-slate-200 font-semibold">
                            {scoreData.dimensions.savingsVelocity.operatingSavingsRate}%
                          </span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800/60">
                          <span className="text-slate-500 dark:text-slate-400">تراكم الثروة السنوي الصافي:</span>
                          <span className="font-mono tabular-nums text-slate-800 dark:text-slate-200 font-semibold">
                            <SensitiveValue>{formatMoney(scoreData.dimensions.savingsVelocity.netWealthAccumulationBase, baseCurrency, 0)}</SensitiveValue>
                          </span>
                        </div>
                        <div className="flex justify-between py-1">
                          <span className="text-slate-500 dark:text-slate-400">المساهمة الاستثمارية الشهرية:</span>
                          <span className="font-mono tabular-nums text-slate-800 dark:text-slate-200 font-semibold">
                            <SensitiveValue>{formatMoney(scoreData.dimensions.savingsVelocity.monthlyFiContributionBase, baseCurrency, 0)}</SensitiveValue>
                          </span>
                        </div>
                      </div>
                    </div>

                    <p className="text-xs text-slate-600 dark:text-slate-300 bg-slate-50/80 dark:bg-[#0E1420]/80 p-2.5 rounded-xl mt-3 leading-relaxed border border-slate-200/60 dark:border-slate-800/60">
                      {scoreData.dimensions.savingsVelocity.driverAr}
                    </p>
                  </div>
                );
              })()}

              {/* Dim 4: Portfolio Diversification */}
              {(() => {
                const num = parseFloat(scoreData.dimensions.diversification.score);
                const styles = getDimensionScoreStyles(num);
                return (
                  <div
                    className={`bg-white dark:bg-[#0B0F17] border rounded-2xl p-5 shadow-xs flex flex-col justify-between transition-all ${
                      weakestDimensionKey === "diversification"
                        ? "border-amber-400/70 dark:border-amber-600/70"
                        : "border-slate-200/90 dark:border-slate-800/80"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="size-7 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs flex items-center justify-center">
                            4
                          </span>
                          <h3 className="text-sm font-bold text-slate-900 dark:text-white">تنوع المحفظة ومخاطر التركيز</h3>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {weakestDimensionKey === "diversification" && (
                            <span className="bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 text-[10px] font-bold px-2 py-0.5 rounded-md border border-amber-200 dark:border-amber-800">
                              أولوية تحسين
                            </span>
                          )}
                          <span className="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 font-mono text-[10px] font-bold px-2 py-0.5 rounded-md">
                            وزن 15%
                          </span>
                        </div>
                      </div>

                      <div className="flex items-baseline justify-between mt-3 mb-1">
                        <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">الدرجة المحققة:</span>
                        <div className="flex items-baseline gap-1.5">
                          <span className={styles.text}>{scoreData.dimensions.diversification.score}</span>
                          <span className="text-xs text-slate-400 dark:text-slate-500 font-normal">/ 100</span>
                        </div>
                      </div>

                      {/* Micro Progress Bar */}
                      <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden my-3">
                        <div
                          className={`h-full ${styles.fill} rounded-full transition-all duration-500`}
                          style={{ width: `${Math.min(100, Math.max(0, num))}%` }}
                        />
                      </div>

                      <div className="space-y-1.5 text-xs">
                        <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800/60">
                          <span className="text-slate-500 dark:text-slate-400">مؤشر هيرفندال (HHI):</span>
                          <span className="font-mono tabular-nums text-slate-800 dark:text-slate-200 font-semibold">
                            {scoreData.dimensions.diversification.hhi}
                          </span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800/60">
                          <span className="text-slate-500 dark:text-slate-400">تركيز أكبر أصل منفرد:</span>
                          <span className="font-mono tabular-nums text-slate-800 dark:text-slate-200 font-semibold">
                            {scoreData.dimensions.diversification.topHoldingWeight}%
                          </span>
                        </div>
                        <div className="flex justify-between py-1">
                          <span className="text-slate-500 dark:text-slate-400">اسم الأصل الأكبر:</span>
                          <span className="truncate max-w-[150px] text-slate-800 dark:text-slate-200 font-medium">
                            {scoreData.dimensions.diversification.topHoldingName}
                          </span>
                        </div>
                      </div>
                    </div>

                    <p className="text-xs text-slate-600 dark:text-slate-300 bg-slate-50/80 dark:bg-[#0E1420]/80 p-2.5 rounded-xl mt-3 leading-relaxed border border-slate-200/60 dark:border-slate-800/60">
                      {scoreData.dimensions.diversification.driverAr}
                    </p>
                  </div>
                );
              })()}

              {/* Dim 5: Resilience & Protection */}
              {(() => {
                const num = parseFloat(scoreData.dimensions.resilienceProtection.score);
                const styles = getDimensionScoreStyles(num);
                return (
                  <div
                    className={`bg-white dark:bg-[#0B0F17] border rounded-2xl p-5 shadow-xs flex flex-col justify-between transition-all ${
                      weakestDimensionKey === "resilienceProtection"
                        ? "border-amber-400/70 dark:border-amber-600/70"
                        : "border-slate-200/90 dark:border-slate-800/80"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="size-7 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs flex items-center justify-center">
                            5
                          </span>
                          <h3 className="text-sm font-bold text-slate-900 dark:text-white">جودة التقييمات والحماية</h3>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {weakestDimensionKey === "resilienceProtection" && (
                            <span className="bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 text-[10px] font-bold px-2 py-0.5 rounded-md border border-amber-200 dark:border-amber-800">
                              أولوية تحسين
                            </span>
                          )}
                          <span className="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 font-mono text-[10px] font-bold px-2 py-0.5 rounded-md">
                            وزن 10%
                          </span>
                        </div>
                      </div>

                      <div className="flex items-baseline justify-between mt-3 mb-1">
                        <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">الدرجة المحققة:</span>
                        <div className="flex items-baseline gap-1.5">
                          <span className={styles.text}>{scoreData.dimensions.resilienceProtection.score}</span>
                          <span className="text-xs text-slate-400 dark:text-slate-500 font-normal">/ 100</span>
                        </div>
                      </div>

                      {/* Micro Progress Bar */}
                      <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden my-3">
                        <div
                          className={`h-full ${styles.fill} rounded-full transition-all duration-500`}
                          style={{ width: `${Math.min(100, Math.max(0, num))}%` }}
                        />
                      </div>

                      <div className="space-y-1.5 text-xs">
                        <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800/60">
                          <span className="text-slate-500 dark:text-slate-400">نسبة التقييمات الحديثة (5A):</span>
                          <span className="font-mono tabular-nums text-slate-800 dark:text-slate-200 font-semibold">
                            {scoreData.dimensions.resilienceProtection.freshRatio}%
                          </span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800/60">
                          <span className="text-slate-500 dark:text-slate-400">نقاط التأمين والحماية (5B):</span>
                          <span className="font-mono tabular-nums text-slate-800 dark:text-slate-200 font-semibold">
                            {Number(scoreData.dimensions.resilienceProtection.healthPoints) +
                              Number(scoreData.dimensions.resilienceProtection.lifePoints) +
                              Number(scoreData.dimensions.resilienceProtection.propertyPoints)}{" "}
                            / 100
                          </span>
                        </div>
                        <div className="flex justify-between py-1 text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                          <span>صحي: {scoreData.dimensions.resilienceProtection.healthPoints}</span>
                          <span>•</span>
                          <span>حياة: {scoreData.dimensions.resilienceProtection.lifePoints}</span>
                          <span>•</span>
                          <span>ممتلكات: {scoreData.dimensions.resilienceProtection.propertyPoints}</span>
                        </div>
                      </div>
                    </div>

                    <p className="text-xs text-slate-600 dark:text-slate-300 bg-slate-50/80 dark:bg-[#0E1420]/80 p-2.5 rounded-xl mt-3 leading-relaxed border border-slate-200/60 dark:border-slate-800/60">
                      {scoreData.dimensions.resilienceProtection.driverAr}
                    </p>
                  </div>
                );
              })()}

              {/* Dim 6: FI Progress */}
              {(() => {
                const num = parseFloat(scoreData.dimensions.fiProgress.score);
                const styles = getDimensionScoreStyles(num);
                return (
                  <div
                    className={`bg-white dark:bg-[#0B0F17] border rounded-2xl p-5 shadow-xs flex flex-col justify-between transition-all ${
                      weakestDimensionKey === "fiProgress"
                        ? "border-amber-400/70 dark:border-amber-600/70"
                        : "border-slate-200/90 dark:border-slate-800/80"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="size-7 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs flex items-center justify-center">
                            6
                          </span>
                          <h3 className="text-sm font-bold text-slate-900 dark:text-white">نسبة التقدم نحو الاستقلال المالي</h3>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {weakestDimensionKey === "fiProgress" && (
                            <span className="bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 text-[10px] font-bold px-2 py-0.5 rounded-md border border-amber-200 dark:border-amber-800">
                              أولوية تحسين
                            </span>
                          )}
                          <span className="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 font-mono text-[10px] font-bold px-2 py-0.5 rounded-md">
                            وزن 15%
                          </span>
                        </div>
                      </div>

                      <div className="flex items-baseline justify-between mt-3 mb-1">
                        <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">الدرجة المحققة:</span>
                        <div className="flex items-baseline gap-1.5">
                          <span className={styles.text}>{scoreData.dimensions.fiProgress.score}</span>
                          <span className="text-xs text-slate-400 dark:text-slate-500 font-normal">/ 100</span>
                        </div>
                      </div>

                      {/* Micro Progress Bar */}
                      <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden my-3">
                        <div
                          className={`h-full ${styles.fill} rounded-full transition-all duration-500`}
                          style={{ width: `${Math.min(100, Math.max(0, num))}%` }}
                        />
                      </div>

                      <div className="space-y-1.5 text-xs">
                        <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800/60">
                          <span className="text-slate-500 dark:text-slate-400">نسبة الهدف المحققة فعليًا:</span>
                          <span className="font-mono tabular-nums text-slate-800 dark:text-slate-200 font-semibold">
                            {scoreData.dimensions.fiProgress.fiProgressRatio}%
                          </span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800/60">
                          <span className="text-slate-500 dark:text-slate-400">الأصول الاستثمارية المؤهلة:</span>
                          <span className="font-mono tabular-nums text-slate-800 dark:text-slate-200 font-semibold">
                            <SensitiveValue>{formatMoney(scoreData.dimensions.fiProgress.investableAssetsBase, baseCurrency, 0)}</SensitiveValue>
                          </span>
                        </div>
                        <div className="flex justify-between py-1">
                          <span className="text-slate-500 dark:text-slate-400">مستهدف الاستقلال (SWR 4%):</span>
                          <span className="font-mono tabular-nums text-slate-800 dark:text-slate-200 font-semibold">
                            <SensitiveValue>{formatMoney(scoreData.dimensions.fiProgress.kFiBaselineBase, baseCurrency, 0)}</SensitiveValue>
                          </span>
                        </div>
                      </div>
                    </div>

                    <p className="text-xs text-slate-600 dark:text-slate-300 bg-slate-50/80 dark:bg-[#0E1420]/80 p-2.5 rounded-xl mt-3 leading-relaxed border border-slate-200/60 dark:border-slate-800/60">
                      {scoreData.dimensions.fiProgress.driverAr}
                    </p>
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* 4. DETERMINISTIC FI / FIRE HORIZON SIMULATOR */}
        {/* ==================================================================== */}
        <div className="space-y-6 pt-4 border-t border-slate-200 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <div className="size-8 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center">
                <Calculator className="size-4 text-indigo-600 dark:text-indigo-400" />
              </div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">محاكي أفق الاستقلال المالي — FIRE</h2>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              إسقاط حتمي دقيق يحسب تاريخ الوصول المستهدف باستخدام معادلة فيشر الرياضية ودقة حسابية متناهية
            </p>
          </div>

          {/* Interactive Controls & Mode Selector */}
          <div className="bg-white dark:bg-[#0B0F17] border border-slate-200/90 dark:border-slate-800/80 rounded-2xl p-6 shadow-xs">
            <div className="pb-3 border-b border-slate-100 dark:border-slate-800/80 mb-5">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">تحديد نمط الإنفاق والافتراضات</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                اختر أساس الإنفاق الذي ترغب في بناء خطة الاستقلال المالي عليه، أو عدّل معدلات العائد والتضخم والسحب الآمن
              </p>
            </div>

            <div className="space-y-6">
              {/* Spending Mode Segmented Control */}
              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">أساس الإنفاق السنوي المستهدف:</Label>
                <div className="bg-slate-100/90 dark:bg-[#0E1420] p-1.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 inline-flex flex-wrap gap-1 mb-6">
                  <button
                    type="button"
                    onClick={() => setSpendingMode("actual_ttm")}
                    className={`font-bold text-xs px-4 py-2 rounded-xl transition-all ${
                      spendingMode === "actual_ttm"
                        ? "bg-white dark:bg-[#1A2234] text-slate-900 dark:text-white shadow-xs border border-slate-200/60 dark:border-slate-700/60"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-800/40"
                    }`}
                  >
                    نمط الإنفاق الفعلي (المحقق)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSpendingMode("essential_ttm")}
                    className={`font-bold text-xs px-4 py-2 rounded-xl transition-all ${
                      spendingMode === "essential_ttm"
                        ? "bg-white dark:bg-[#1A2234] text-slate-900 dark:text-white shadow-xs border border-slate-200/60 dark:border-slate-700/60"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-800/40"
                    }`}
                  >
                    الاستقلال المالي الأساسي
                  </button>
                  <button
                    type="button"
                    onClick={() => setSpendingMode("custom")}
                    className={`font-bold text-xs px-4 py-2 rounded-xl transition-all ${
                      spendingMode === "custom"
                        ? "bg-white dark:bg-[#1A2234] text-slate-900 dark:text-white shadow-xs border border-slate-200/60 dark:border-slate-700/60"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-800/40"
                    }`}
                  >
                    الاستقلال المالي الشامل
                  </button>
                </div>
              </div>

              {/* Custom spending input if custom mode selected */}
              {spendingMode === "custom" && (
                <div className="max-w-md space-y-1.5 p-3.5 rounded-xl bg-slate-50 dark:bg-[#0E1420]/60 border border-slate-200 dark:border-slate-800">
                  <Label htmlFor="custom-spending" className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    قيمة الإنفاق السنوي المخصص ({baseCurrency}):
                  </Label>
                  <Input
                    id="custom-spending"
                    type="number"
                    placeholder="مثال: 120000"
                    value={customSpending}
                    onChange={e => setCustomSpending(e.target.value)}
                    className="bg-white dark:bg-[#0E1420] border border-slate-300 dark:border-slate-700/80 text-slate-900 dark:text-slate-100 rounded-xl font-medium text-xs py-2 px-3 font-mono focus:ring-1 focus:ring-slate-800"
                  />
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    سيتم حساب مستهدف رأس المال المطلوب بناءً على هذا الرقم ومعدل السحب السنوي الآمن لتحقيق نمط الاستقلال المالي الشامل أو ميزانية تقاعد مستهدفة.
                  </p>
                </div>
              )}

              {/* Assumptions Parameters Row with LTR-isolated range tracks */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t border-slate-100 dark:border-slate-800/80">
                <div className="space-y-2 rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-slate-50/50 dark:bg-[#0E1420]/60 p-3.5 min-h-[115px] flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="param-return" className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      العائد الاسمي السنوي (%):
                    </Label>
                    <Input
                      id="param-return"
                      type="number"
                      step="0.1"
                      min="0"
                      max="30"
                      value={customNominalReturn}
                      onChange={e => setCustomNominalReturn(e.target.value)}
                      className="h-7 w-20 font-mono text-xs text-center bg-white dark:bg-[#0E1420] border border-slate-300 dark:border-slate-700/80 rounded-lg"
                    />
                  </div>
                  <div dir="ltr" className="w-full">
                    <input
                      type="range"
                      min="0"
                      max="25"
                      step="0.1"
                      value={parseFloat(customNominalReturn) || 0}
                      onChange={e => setCustomNominalReturn(parseFloat(e.target.value).toFixed(1))}
                      className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-slate-900 dark:accent-white"
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">الافتراضي: 7.0% سنويًا</p>
                </div>

                <div className="space-y-2 rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-slate-50/50 dark:bg-[#0E1420]/60 p-3.5 min-h-[115px] flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="param-inflation" className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      التضخم السنوي المتوقع (%):
                    </Label>
                    <Input
                      id="param-inflation"
                      type="number"
                      step="0.1"
                      min="0"
                      max="25"
                      value={customInflation}
                      onChange={e => setCustomInflation(e.target.value)}
                      className="h-7 w-20 font-mono text-xs text-center bg-white dark:bg-[#0E1420] border border-slate-300 dark:border-slate-700/80 rounded-lg"
                    />
                  </div>
                  <div dir="ltr" className="w-full">
                    <input
                      type="range"
                      min="0"
                      max="20"
                      step="0.1"
                      value={parseFloat(customInflation) || 0}
                      onChange={e => setCustomInflation(parseFloat(e.target.value).toFixed(1))}
                      className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-slate-900 dark:accent-white"
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">الافتراضي: 3.0% سنويًا</p>
                </div>

                <div className="space-y-2 rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-slate-50/50 dark:bg-[#0E1420]/60 p-3.5 min-h-[115px] flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="param-swr" className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      معدل السحب السنوي الآمن (SWR) (%):
                    </Label>
                    <Input
                      id="param-swr"
                      type="number"
                      step="0.1"
                      min="1"
                      max="10"
                      value={customSwr}
                      onChange={e => setCustomSwr(e.target.value)}
                      className="h-7 w-20 font-mono text-xs text-center bg-white dark:bg-[#0E1420] border border-slate-300 dark:border-slate-700/80 rounded-lg"
                    />
                  </div>
                  <div dir="ltr" className="w-full">
                    <input
                      type="range"
                      min="1"
                      max="10"
                      step="0.1"
                      value={parseFloat(customSwr) || 4}
                      onChange={e => setCustomSwr(parseFloat(e.target.value).toFixed(1))}
                      className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-slate-900 dark:accent-white"
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">الافتراضي: 4.0% (قاعدة الـ 25 ضعفًا)</p>
                </div>

                <div className="space-y-2 rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-slate-50/50 dark:bg-[#0E1420]/60 p-3.5 min-h-[115px] flex flex-col justify-between text-center">
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-bold">العائد الحقيقي (معادلة Fisher):</p>
                  <div>
                    <p
                      className={`text-2xl font-bold font-mono tabular-nums ${
                        isNegativeReal ? "text-amber-600 dark:text-amber-400" : "text-slate-900 dark:text-white"
                      }`}
                    >
                      {fireData?.assumptions.realReturnPercent ?? "—"}%
                    </p>
                    {isNegativeReal && (
                      <span className="bg-amber-50 text-amber-700 border border-amber-200/80 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/60 font-bold text-[10px] px-1.5 py-0.5 rounded-md inline-block mt-0.5">
                        تآكل بالتضخم
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">r = (1+i)/(1+π) − 1</p>
                </div>
              </div>
            </div>
          </div>

          {/* Horizon Calculation Display with Persistent Containment */}
          {fireQuery.isLoading && !fireData ? (
            <Skeleton className="h-44 rounded-2xl" />
          ) : fireData ? (
            <div className="grid gap-6 lg:grid-cols-12">
              {/* Primary Solved Horizon Card */}
              <div className="lg:col-span-8 bg-white dark:bg-[#0B0F17] border border-slate-200/90 dark:border-slate-800/80 rounded-2xl p-6 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800/80 mb-5">
                    <div className="flex items-center gap-2">
                      <div className="size-7 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center">
                        <Sparkles className="size-4 text-amber-500" />
                      </div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white">النتيجة الحتمية للأفق الزمني المحسوب</h3>
                    </div>
                    <span
                      className={
                        fireData.primaryHorizon.isReachable
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200/80 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800/70 font-bold text-[11px] px-2.5 py-0.5 rounded-lg"
                          : "bg-amber-50 text-amber-700 border border-amber-200/80 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800/70 font-bold text-[11px] px-2.5 py-0.5 rounded-lg"
                      }
                    >
                      {fireData.primaryHorizon.statusLabelAr}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center mb-6">
                    <div className="p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-slate-50/50 dark:bg-[#0E1420]/60 min-h-[140px] flex flex-col justify-between">
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">الأفق بالسنوات</p>
                      <div className="my-auto">
                        {fireData.primaryHorizon.horizonYears ? (
                          <>
                            <p className="text-2xl font-bold font-mono text-slate-900 dark:text-white tabular-nums">
                              {fireData.primaryHorizon.horizonYears} سنة
                            </p>
                            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 font-mono">
                              {fireData.primaryHorizon.horizonMonths ? `(${fireData.primaryHorizon.horizonMonths} شهرًا)` : ""}
                            </p>
                          </>
                        ) : (
                          <p className="text-xs font-bold text-amber-700 dark:text-amber-300 leading-snug px-1">
                            غير محدد (يتطلب تنمية رأس المال)
                          </p>
                        )}
                      </div>
                      <div />
                    </div>

                    <div className="p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-slate-50/50 dark:bg-[#0E1420]/60 min-h-[140px] flex flex-col justify-between">
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">تاريخ الوصول المتوقع</p>
                      <div className="my-auto">
                        <p className="text-base sm:text-lg font-bold font-mono text-slate-900 dark:text-white tabular-nums">
                          {fireData.primaryHorizon.projectedDate ?? "غير محدد"}
                        </p>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">وفق الافتراضات المدخلة</p>
                      </div>
                      <div />
                    </div>

                    <div className="p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-slate-50/50 dark:bg-[#0E1420]/60 min-h-[140px] flex flex-col justify-between">
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">رأس المال المستهدف (K_FI)</p>
                      <div className="my-auto">
                        <p className="text-base sm:text-lg font-bold font-mono text-slate-900 dark:text-white tabular-nums">
                          <SensitiveValue>{formatMoney(fireData.targetCorpusBase, baseCurrency, 0)}</SensitiveValue>
                        </p>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">الإنفاق ÷ SWR</p>
                      </div>
                      <div />
                    </div>

                    <div className="p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-slate-50/50 dark:bg-[#0E1420]/60 min-h-[140px] flex flex-col justify-between">
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">الفجوة التراكمية المتبقية</p>
                      <div className="my-auto">
                        <p className="text-base sm:text-lg font-bold font-mono text-slate-900 dark:text-white tabular-nums">
                          <SensitiveValue>{formatMoney(fireData.gapCorpusBase, baseCurrency, 0)}</SensitiveValue>
                        </p>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">المستهدف − الأصول المؤهلة</p>
                      </div>
                      <div />
                    </div>
                  </div>

                  {/* Progress bar to target */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-slate-600 dark:text-slate-300">نسبة اكتمال رأس مال الاستقلال:</span>
                      <span className="font-mono font-bold text-slate-900 dark:text-white tabular-nums">{fireData.progressPercent}%</span>
                    </div>
                    <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-slate-900 dark:bg-white rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, Math.max(0, parseFloat(fireData.progressPercent)))}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                      <span>أصول مؤهلة: <SensitiveValue>{formatMoney(fireData.investableAssetsBase, baseCurrency, 0)}</SensitiveValue></span>
                      <span>مستهدف: <SensitiveValue>{formatMoney(fireData.targetCorpusBase, baseCurrency, 0)}</SensitiveValue></span>
                    </div>
                  </div>
                </div>

                <div className="pt-4 mt-6 border-t border-slate-100 dark:border-slate-800/60 text-[11px] text-slate-500 dark:text-slate-400 flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono">A(m) = A₀(1+r_m)^m + C·((1+r_m)^m − 1)/r_m</span>
                  <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                    <CheckCircle2 className="size-3.5" />
                    <span>تم التحقق من أصغر عدد صحيح للأشهر A(m*) ≥ K_FI</span>
                  </span>
                </div>
              </div>

              {/* Monthly Flow Insights Card */}
              <div className="lg:col-span-4 bg-white dark:bg-[#0B0F17] border border-slate-200/90 dark:border-slate-800/80 rounded-2xl p-6 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800/80 mb-5">
                    <div className="flex items-center gap-2">
                      <div className="size-7 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center">
                        <Coins className="size-4 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white">التدفقات الشهرية الداعمة للأفق</h3>
                    </div>
                  </div>

                  <div className="space-y-3 text-xs">
                    <div className="flex justify-between border-b border-slate-100 dark:border-slate-800/60 pb-2.5">
                      <span className="text-slate-500 dark:text-slate-400">الإنفاق السنوي المعتمد:</span>
                      <span className="font-mono font-bold text-slate-900 dark:text-white tabular-nums">
                        <SensitiveValue>{formatMoney(fireData.annualSpendingBase, baseCurrency, 0)}</SensitiveValue>
                      </span>
                    </div>
                    <div className="flex justify-between border-b border-slate-100 dark:border-slate-800/60 pb-2.5">
                      <span className="text-slate-500 dark:text-slate-400">الفائض الاستثماري الشهري (C):</span>
                      <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                        <SensitiveValue>{formatMoney(fireData.monthlyContributionBase, baseCurrency, 0)}</SensitiveValue>
                      </span>
                    </div>
                    <div className="flex justify-between border-b border-slate-100 dark:border-slate-800/60 pb-2.5">
                      <span className="text-slate-500 dark:text-slate-400">العائد الحقيقي الشهري (r_m):</span>
                      <span className="font-mono font-bold text-slate-900 dark:text-white tabular-nums">
                        {fireData.assumptions.monthlyRealRatePercent}%
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed pt-1">
                      الفائض الاستثماري الشهري يمثل الفائض التشغيلي بعد خصم نفقات المعيشة وفوائد القروض وأقساط سداد أصل الديون.
                    </p>
                  </div>
                </div>

                <div className="pt-4 mt-4 border-t border-slate-100 dark:border-slate-800/60 text-[11px] text-slate-500 dark:text-slate-400">
                  <span>الأصول الاستثمارية تستثني السكن الخاص والسيارات الشخصية.</span>
                </div>
              </div>
            </div>
          ) : null}

          {/* ==================================================================== */}
          {/* 5. THREE STANDARD SCENARIOS COMPARISON GRID (CONTAINED HEIGHT) */}
          {/* ==================================================================== */}
          {fireData?.scenarios && (
            <div className="space-y-4 pt-2">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">مقارنة السيناريوهات الثلاثة القياسية</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  مقارنة حتمية موحدة لاختبار حساسية الأفق الزمني لاختلاف ظروف السوق والإنفاق
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                {/* 1. Conservative Scenario */}
                <div className="bg-white dark:bg-[#0B0F17] border border-slate-200/90 dark:border-slate-800/80 rounded-2xl p-5 shadow-xs min-h-[220px] flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800/80 mb-3">
                      <div>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">{fireData.scenarios.conservative.nameLabelAr}</h4>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          عائد {fireData.scenarios.conservative.nominalReturnPercent}% · تضخم {fireData.scenarios.conservative.inflationPercent}% · سحب {fireData.scenarios.conservative.swrPercent}%
                        </p>
                      </div>
                      <span className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 font-bold text-[11px] px-2.5 py-0.5 rounded-lg">
                        متحفظ
                      </span>
                    </div>

                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between border-b border-slate-100 dark:border-slate-800/60 pb-1.5">
                        <span className="text-slate-500 dark:text-slate-400">الإنفاق السنوي (+10%):</span>
                        <span className="font-mono font-bold text-slate-900 dark:text-white tabular-nums">
                          <SensitiveValue>{formatMoney(fireData.scenarios.conservative.annualSpendingBase, baseCurrency, 0)}</SensitiveValue>
                        </span>
                      </div>
                      <div className="flex justify-between border-b border-slate-100 dark:border-slate-800/60 pb-1.5">
                        <span className="text-slate-500 dark:text-slate-400">المستهدف (K_FI):</span>
                        <span className="font-mono font-bold text-slate-900 dark:text-white tabular-nums">
                          <SensitiveValue>{formatMoney(fireData.scenarios.conservative.targetCorpusBase, baseCurrency, 0)}</SensitiveValue>
                        </span>
                      </div>
                      <div className="flex justify-between border-b border-slate-100 dark:border-slate-800/60 pb-1.5">
                        <span className="text-slate-500 dark:text-slate-400">الأفق بالسنوات:</span>
                        <span className="font-mono font-bold text-slate-900 dark:text-white tabular-nums">
                          {fireData.scenarios.conservative.horizonYears ? `${fireData.scenarios.conservative.horizonYears} سنة` : "غير محدد"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500 dark:text-slate-400">تاريخ الوصول:</span>
                        <span className="font-mono font-bold text-slate-900 dark:text-white tabular-nums">
                          {fireData.scenarios.conservative.projectedDate ?? "غير محدد"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. Base Case Scenario (Elevated Surface) */}
                <div className="bg-slate-50/70 dark:bg-slate-900/40 border-2 border-slate-900/40 dark:border-slate-600 rounded-2xl p-5 shadow-xs min-h-[220px] flex flex-col justify-between relative">
                  <div>
                    <div className="flex items-center justify-between pb-2 border-b border-slate-200/80 dark:border-slate-700/80 mb-3">
                      <div>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">{fireData.scenarios.base.nameLabelAr}</h4>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          عائد {fireData.scenarios.base.nominalReturnPercent}% · تضخم {fireData.scenarios.base.inflationPercent}% · سحب {fireData.scenarios.base.swrPercent}%
                        </p>
                      </div>
                      <span className="bg-slate-900 text-white dark:bg-white dark:text-slate-950 font-bold text-[11px] px-2.5 py-0.5 rounded-lg shadow-xs">
                        السيناريو المعتمد
                      </span>
                    </div>

                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between border-b border-slate-200/60 dark:border-slate-800/60 pb-1.5">
                        <span className="text-slate-500 dark:text-slate-400">الإنفاق السنوي (الفعلي):</span>
                        <span className="font-mono font-bold text-slate-900 dark:text-white tabular-nums">
                          <SensitiveValue>{formatMoney(fireData.scenarios.base.annualSpendingBase, baseCurrency, 0)}</SensitiveValue>
                        </span>
                      </div>
                      <div className="flex justify-between border-b border-slate-200/60 dark:border-slate-800/60 pb-1.5">
                        <span className="text-slate-500 dark:text-slate-400">المستهدف (K_FI):</span>
                        <span className="font-mono font-bold text-slate-900 dark:text-white tabular-nums">
                          <SensitiveValue>{formatMoney(fireData.scenarios.base.targetCorpusBase, baseCurrency, 0)}</SensitiveValue>
                        </span>
                      </div>
                      <div className="flex justify-between border-b border-slate-200/60 dark:border-slate-800/60 pb-1.5">
                        <span className="text-slate-500 dark:text-slate-400">الأفق بالسنوات:</span>
                        <span className="font-mono font-bold text-slate-900 dark:text-white tabular-nums">
                          {fireData.scenarios.base.horizonYears ? `${fireData.scenarios.base.horizonYears} سنة` : "غير محدد"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500 dark:text-slate-400">تاريخ الوصول:</span>
                        <span className="font-mono font-bold text-slate-900 dark:text-white tabular-nums">
                          {fireData.scenarios.base.projectedDate ?? "غير محدد"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 3. Optimistic Scenario */}
                <div className="bg-white dark:bg-[#0B0F17] border border-slate-200/90 dark:border-slate-800/80 rounded-2xl p-5 shadow-xs min-h-[220px] flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800/80 mb-3">
                      <div>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">{fireData.scenarios.optimistic.nameLabelAr}</h4>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          عائد {fireData.scenarios.optimistic.nominalReturnPercent}% · تضخم {fireData.scenarios.optimistic.inflationPercent}% · سحب {fireData.scenarios.optimistic.swrPercent}%
                        </p>
                      </div>
                      <span className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 font-bold text-[11px] px-2.5 py-0.5 rounded-lg">
                        متفائل
                      </span>
                    </div>

                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between border-b border-slate-100 dark:border-slate-800/60 pb-1.5">
                        <span className="text-slate-500 dark:text-slate-400">الإنفاق السنوي (الأساسي):</span>
                        <span className="font-mono font-bold text-slate-900 dark:text-white tabular-nums">
                          <SensitiveValue>{formatMoney(fireData.scenarios.optimistic.annualSpendingBase, baseCurrency, 0)}</SensitiveValue>
                        </span>
                      </div>
                      <div className="flex justify-between border-b border-slate-100 dark:border-slate-800/60 pb-1.5">
                        <span className="text-slate-500 dark:text-slate-400">المستهدف (K_FI):</span>
                        <span className="font-mono font-bold text-slate-900 dark:text-white tabular-nums">
                          <SensitiveValue>{formatMoney(fireData.scenarios.optimistic.targetCorpusBase, baseCurrency, 0)}</SensitiveValue>
                        </span>
                      </div>
                      <div className="flex justify-between border-b border-slate-100 dark:border-slate-800/60 pb-1.5">
                        <span className="text-slate-500 dark:text-slate-400">الأفق بالسنوات:</span>
                        <span className="font-mono font-bold text-slate-900 dark:text-white tabular-nums">
                          {fireData.scenarios.optimistic.horizonYears ? `${fireData.scenarios.optimistic.horizonYears} سنة` : "غير محدد"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500 dark:text-slate-400">تاريخ الوصول:</span>
                        <span className="font-mono font-bold text-slate-900 dark:text-white tabular-nums">
                          {fireData.scenarios.optimistic.projectedDate ?? "غير محدد"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ==================================================================== */}
          {/* 6. SAVE PLANNING ASSUMPTIONS CARD */}
          {/* ==================================================================== */}
          <div className="bg-white dark:bg-[#0B0F17] border border-slate-200/90 dark:border-slate-800/80 rounded-2xl p-6 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800/80 mb-5">
              <div className="flex items-center gap-2">
                <div className="size-7 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center">
                  <Save className="size-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">حفظ افتراضات التخطيط المالي للمساحة</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    احفظ هذه الافتراضات كمعايير أساسية لخطط التقاعد والاستقلال المالي في مساحة FAMILY
                  </p>
                </div>
              </div>
              <span className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 font-bold text-[11px] px-2.5 py-0.5 rounded-lg">
                صلاحية محرر / مالك
              </span>
            </div>

            <form onSubmit={handleSaveAssumptions} className="flex flex-wrap items-end gap-4">
              <div className="space-y-1">
                <Label htmlFor="save-ret-age" className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  سن التقاعد المستهدف:
                </Label>
                <Input
                  id="save-ret-age"
                  type="number"
                  min={18}
                  max={100}
                  value={targetRetirementAge}
                  onChange={e => setTargetRetirementAge(parseInt(e.target.value) || 60)}
                  className="bg-white dark:bg-[#0E1420] border border-slate-300 dark:border-slate-700/80 text-slate-900 dark:text-slate-100 rounded-xl font-medium text-xs py-2 px-3 text-center font-mono focus:ring-1 focus:ring-slate-800 w-28"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">العائد المحفوظ:</Label>
                <div className="p-2 border border-slate-200 dark:border-slate-800 rounded-xl font-mono text-xs bg-slate-50 dark:bg-[#0E1420] text-slate-900 dark:text-slate-100 w-24 text-center font-bold">
                  {customNominalReturn}%
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">التضخم المحفوظ:</Label>
                <div className="p-2 border border-slate-200 dark:border-slate-800 rounded-xl font-mono text-xs bg-slate-50 dark:bg-[#0E1420] text-slate-900 dark:text-slate-100 w-24 text-center font-bold">
                  {customInflation}%
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">معدل السحب SWR:</Label>
                <div className="p-2 border border-slate-200 dark:border-slate-800 rounded-xl font-mono text-xs bg-slate-50 dark:bg-[#0E1420] text-slate-900 dark:text-slate-100 w-24 text-center font-bold">
                  {customSwr}%
                </div>
              </div>

              <button
                type="submit"
                disabled={isSavingAssumptions}
                className="bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:hover:bg-slate-100 dark:text-slate-950 font-bold text-xs py-2.5 px-6 rounded-xl shadow-sm transition-all border border-slate-900 dark:border-transparent cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="size-3.5" />
                <span>{isSavingAssumptions ? "جارٍ الحفظ…" : "اعتماد الافتراضات"}</span>
              </button>
            </form>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
