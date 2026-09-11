import React, { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import PageHeader from "@/components/PageHeader";
import FinancialTooltip from "@/components/FinancialTooltip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import SensitiveValue from "@/components/SensitiveValue";
import { formatMoney } from "@/lib/financialDisplay";
import {
  HeartPulse,
  ShieldCheck,
  TrendingUp,
  Activity,
  AlertTriangle,
  CheckCircle2,
  Coins,
  RefreshCw,
  Scale,
  Sparkles,
  Zap,
  Info,
  Calendar,
  Layers,
  Building2,
  Lock,
  ArrowUpRight,
  Calculator,
  Save,
  HelpCircle,
} from "lucide-react";

export default function WealthHealthPage() {
  const utils = trpc.useUtils();

  // FIRE Simulator Interactive State
  const [spendingMode, setSpendingMode] = useState<"actual_ttm" | "essential_ttm" | "custom">("actual_ttm");
  const [customSpending, setCustomSpending] = useState<string>("");
  const [customNominalReturn, setCustomNominalReturn] = useState<string>("7.0");
  const [customInflation, setCustomInflation] = useState<string>("3.0");
  const [customSwr, setCustomSwr] = useState<string>("4.0");

  // Save Assumptions State
  const [targetRetirementAge, setTargetRetirementAge] = useState<number>(60);
  const [isSavingAssumptions, setIsSavingAssumptions] = useState<boolean>(false);

  // Queries
  const scoreQuery = trpc.family.wealthHealth.getScoreCard.useQuery({}, {
    staleTime: 30_000,
    retry: 1,
  });

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
  });

  const saveAssumptionsMutation = trpc.family.wealthHealth.saveAssumptions.useMutation({
    onSuccess: (data) => {
      toast.success(data.message || "تم حفظ الافتراضات بنجاح.");
      setIsSavingAssumptions(false);
      void utils.family.wealthHealth.getFireStatus.invalidate();
      void utils.family.wealthHealth.getScoreCard.invalidate();
    },
    onError: (err) => {
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

  // Score color helper
  const getScoreColorClass = (val: number) => {
    if (val >= 85) return "text-emerald-500 dark:text-emerald-400";
    if (val >= 70) return "text-blue-500 dark:text-blue-400";
    if (val >= 50) return "text-amber-500 dark:text-amber-400";
    return "text-rose-500 dark:text-rose-400";
  };

  const getScoreBgClass = (val: number) => {
    if (val >= 85) return "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400";
    if (val >= 70) return "bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-blue-400";
    if (val >= 50) return "bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400";
    return "bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400";
  };

  const totalScoreNum = scoreData ? parseFloat(scoreData.totalScore) : 0;

  return (
    <DashboardLayout>
      <div className="space-y-8 p-4 md:p-8 max-w-7xl mx-auto" dir="rtl">
        {/* ==================================================================== */}
        {/* 1. HEADER & ACTIONS */}
        {/* ==================================================================== */}
        <PageHeader
          title="الصحة المالية ومحاكي الاستقلال المالي"
          description="مؤشر حتمي شامل متعدد الأبعاد (0–100) ومحاكي أفق الاستقلال المالي والتقاعد (FIRE)"
          icon={HeartPulse}
          breadcrumbs={[
            { label: "الحوكمة والتحليل" },
            { label: "صحة الثروة ومؤشر FIRE" },
          ]}
          badge="مؤشر حتمي 0–100"
          actions={
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                void utils.family.wealthHealth.getScoreCard.invalidate();
                void utils.family.wealthHealth.getFireStatus.invalidate();
                toast.info("تم تحديث بيانات الصحة المالية.");
              }}
              disabled={scoreQuery.isRefetching || fireQuery.isRefetching}
              className="gap-2"
            >
              <RefreshCw className={`size-4 ${scoreQuery.isRefetching ? "animate-spin" : ""}`} />
              <span>تحديث الفحص</span>
            </Button>
          }
        />

        {/* ==================================================================== */}
        {/* 2. OVERALL SCORE HERO GAUGE & CONFIDENCE */}
        {/* ==================================================================== */}
        {scoreQuery.isLoading ? (
          <div className="grid gap-6 md:grid-cols-3">
            <Skeleton className="h-48 rounded-2xl" />
            <Skeleton className="h-48 rounded-2xl md:col-span-2" />
          </div>
        ) : scoreData ? (
          <div className="grid gap-6 lg:grid-cols-12 items-stretch">
            {/* Main Score Hero Card */}
            <Card className="lg:col-span-5 bg-gradient-to-br from-card via-card to-muted/30 border border-border/80 shadow-sm relative overflow-hidden flex flex-col justify-between">
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-2xl pointer-events-none" />
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <FinancialTooltip term="FIRE_SCORE">
                    <CardTitle className="text-base font-medium text-muted-foreground cursor-help border-b border-dashed border-muted-foreground/50">
                      مؤشر الصحة المالية الشامل
                    </CardTitle>
                  </FinancialTooltip>
                  <Badge variant="outline" className={`font-mono font-semibold ${getScoreBgClass(totalScoreNum)}`}>
                    {scoreData.ratingTier === "excellent" ? "مرونة استثنائية" : scoreData.ratingTier === "good" ? "نمو متوازن" : scoreData.ratingTier === "moderate" ? "تحت المراقبة" : "حرج"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="py-4">
                <div className="flex items-baseline gap-2 justify-center my-2">
                  <span className={`text-6xl font-black tracking-tight font-mono ${getScoreColorClass(totalScoreNum)}`}>
                    {scoreData.totalScore}
                  </span>
                  <span className="text-xl text-muted-foreground font-semibold">/ 100</span>
                </div>
                <p className="text-center text-sm font-medium mt-2 text-foreground/90">
                  {scoreData.ratingTierLabelAr}
                </p>
              </CardContent>
              <div className="p-4 bg-muted/40 border-t border-border/50 flex items-center justify-between text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="size-4 text-primary" />
                  <span>دقة حتمية بدون عشوائية</span>
                </div>
                <span>آخر تقييم: {new Date(scoreData.asOf).toLocaleDateString("ar-EG")}</span>
              </div>
            </Card>

            {/* Data Confidence & Quality Card */}
            <Card className="lg:col-span-7 bg-card border border-border/80 shadow-sm flex flex-col justify-between">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <Activity className="size-4 text-primary" />
                    <span>مستوى موثوقية وجودة البيانات المحاسبية</span>
                  </CardTitle>
                  <Badge
                    className={
                      scoreData.confidence.level === "high"
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                        : scoreData.confidence.level === "medium"
                        ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30"
                        : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30"
                    }
                  >
                    {scoreData.confidence.level === "high" ? "ثقة عالية" : scoreData.confidence.level === "medium" ? "ثقة متوسطة" : "ثقة منخفضة (بيانات أولية)"}
                  </Badge>
                </div>
                <CardDescription className="text-xs">
                  يُحسب مؤشر الثقة وفق مدة تاريخ الدفتر، واكتمال تصنيف المصروفات، وحداثة تقييمات الأصول.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 py-2">
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="rounded-xl border bg-muted/20 p-3">
                    <p className="text-xs text-muted-foreground">تاريخ الدفتر</p>
                    <p className="text-lg font-bold font-mono mt-0.5">{scoreData.confidence.historyMonths} شهرًا</p>
                  </div>
                  <div className="rounded-xl border bg-muted/20 p-3">
                    <p className="text-xs text-muted-foreground">اكتمال التصنيف</p>
                    <p className="text-lg font-bold font-mono mt-0.5">{scoreData.confidence.completenessPercent}%</p>
                  </div>
                  <div className="rounded-xl border bg-muted/20 p-3">
                    <p className="text-xs text-muted-foreground">تقييمات حديثة</p>
                    <p className="text-lg font-bold font-mono mt-0.5">{scoreData.confidence.freshnessRatio}%</p>
                  </div>
                </div>

                {scoreData.confidence.warningsAr.length > 0 && (
                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2">
                    <AlertTriangle className="size-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                    <div className="space-y-1">
                      {scoreData.confidence.warningsAr.map((w, i) => (
                        <p key={i}>{w}</p>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
              <div className="p-3 bg-muted/40 border-t border-border/50 text-[11px] text-muted-foreground flex items-center gap-1.5">
                <Info className="size-3.5 text-muted-foreground" />
                <span>الدفتر المحاسبي ذو القيد المزدوج هو المرجع الحصري لجميع التدفقات والالتزامات.</span>
              </div>
            </Card>
          </div>
        ) : null}

        {/* ==================================================================== */}
        {/* 3. SIX DIMENSION BREAKDOWN CARDS */}
        {/* ==================================================================== */}
        {scoreData && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold">أبعاد الصحة المالية الستة</h2>
                <p className="text-xs text-muted-foreground">أوزان معيارية غير متداخلة تغطي كافة جوانب السلامة المالية</p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {/* Dim 1: Liquidity */}
              <Card className={`border shadow-sm transition-all ${weakestDimensionKey === "liquidity" ? "ring-2 ring-rose-500/30 border-rose-500/40 bg-rose-500/[0.02]" : "border-border/70 hover:border-primary/40"}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold text-xs">
                        1
                      </span>
                      <CardTitle className="text-sm font-semibold">السيولة والمرونة في الطوارئ</CardTitle>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {weakestDimensionKey === "liquidity" && (
                        <Badge variant="destructive" className="text-[10px] bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30">
                          أولوية تحسين
                        </Badge>
                      )}
                      <Badge variant="outline" className="text-xs font-mono font-bold">
                        وزن 20%
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-baseline justify-between border-b pb-2">
                    <span className="text-xs text-muted-foreground">الدرجة المحققة:</span>
                    <span className={`text-2xl font-bold font-mono ${getScoreColorClass(parseFloat(scoreData.dimensions.liquidity.score))}`}>
                      {scoreData.dimensions.liquidity.score} <span className="text-xs text-muted-foreground font-normal">/ 100</span>
                    </span>
                  </div>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">أشهر التغطية الاحتياطية:</span>
                      <span className="font-mono font-bold text-foreground">{scoreData.dimensions.liquidity.runwayMonths} شهرًا</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">الاحتياطي النقدي المؤهل:</span>
                      <span className="font-mono"><SensitiveValue>{formatMoney(scoreData.dimensions.liquidity.liquidReservesBase, baseCurrency, 0)}</SensitiveValue></span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">النفقات الأساسية الشهرية:</span>
                      <span className="font-mono"><SensitiveValue>{formatMoney(scoreData.dimensions.liquidity.monthlyEssentialOutflowsBase, baseCurrency, 0)}</SensitiveValue></span>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground bg-muted/30 p-2.5 rounded-lg leading-relaxed">
                    {scoreData.dimensions.liquidity.driverAr}
                  </p>
                </CardContent>
              </Card>

              {/* Dim 2: Debt Sustainability */}
              <Card className={`border shadow-sm transition-all ${weakestDimensionKey === "debtSustainability" ? "ring-2 ring-rose-500/30 border-rose-500/40 bg-rose-500/[0.02]" : "border-border/70 hover:border-primary/40"}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400 font-bold text-xs">
                        2
                      </span>
                      <CardTitle className="text-sm font-semibold">استدامة الديون والملاءة</CardTitle>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {weakestDimensionKey === "debtSustainability" && (
                        <Badge variant="destructive" className="text-[10px] bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30">
                          أولوية تحسين
                        </Badge>
                      )}
                      <Badge variant="outline" className="text-xs font-mono font-bold">
                        وزن 20%
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-baseline justify-between border-b pb-2">
                    <span className="text-xs text-muted-foreground">الدرجة المحققة:</span>
                    <span className={`text-2xl font-bold font-mono ${getScoreColorClass(parseFloat(scoreData.dimensions.debtSustainability.score))}`}>
                      {scoreData.dimensions.debtSustainability.score} <span className="text-xs text-muted-foreground font-normal">/ 100</span>
                    </span>
                  </div>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">نسبة الرافعة (الدين/الأصول):</span>
                      <span className="font-mono font-bold text-foreground">{scoreData.dimensions.debtSustainability.leverageRatio}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">معدل تغطية خدمة الدين (DSCR):</span>
                      <span className="font-mono font-bold text-foreground">{scoreData.dimensions.debtSustainability.dscr}x</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">أصل الديون القائمة:</span>
                      <span className="font-mono"><SensitiveValue>{formatMoney(scoreData.dimensions.debtSustainability.totalDebtBase, baseCurrency, 0)}</SensitiveValue></span>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground bg-muted/30 p-2.5 rounded-lg leading-relaxed">
                    {scoreData.dimensions.debtSustainability.driverAr}
                  </p>
                </CardContent>
              </Card>

              {/* Dim 3: Savings Velocity */}
              <Card className={`border shadow-sm transition-all ${weakestDimensionKey === "savingsVelocity" ? "ring-2 ring-rose-500/30 border-rose-500/40 bg-rose-500/[0.02]" : "border-border/70 hover:border-primary/40"}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold text-xs">
                        3
                      </span>
                      <CardTitle className="text-sm font-semibold">سرعة الادخار وتراكم الثروة</CardTitle>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {weakestDimensionKey === "savingsVelocity" && (
                        <Badge variant="destructive" className="text-[10px] bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30">
                          أولوية تحسين
                        </Badge>
                      )}
                      <Badge variant="outline" className="text-xs font-mono font-bold">
                        وزن 20%
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-baseline justify-between border-b pb-2">
                    <span className="text-xs text-muted-foreground">الدرجة المحققة:</span>
                    <span className={`text-2xl font-bold font-mono ${getScoreColorClass(parseFloat(scoreData.dimensions.savingsVelocity.score))}`}>
                      {scoreData.dimensions.savingsVelocity.score} <span className="text-xs text-muted-foreground font-normal">/ 100</span>
                    </span>
                  </div>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">معدل الادخار التشغيلي:</span>
                      <span className="font-mono font-bold text-foreground">{scoreData.dimensions.savingsVelocity.operatingSavingsRate}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">تراكم الثروة السنوي الصافي:</span>
                      <span className="font-mono"><SensitiveValue>{formatMoney(scoreData.dimensions.savingsVelocity.netWealthAccumulationBase, baseCurrency, 0)}</SensitiveValue></span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">المساهمة الاستثمارية الشهرية:</span>
                      <span className="font-mono"><SensitiveValue>{formatMoney(scoreData.dimensions.savingsVelocity.monthlyFiContributionBase, baseCurrency, 0)}</SensitiveValue></span>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground bg-muted/30 p-2.5 rounded-lg leading-relaxed">
                    {scoreData.dimensions.savingsVelocity.driverAr}
                  </p>
                </CardContent>
              </Card>

              {/* Dim 4: Portfolio Diversification */}
              <Card className={`border shadow-sm transition-all ${weakestDimensionKey === "diversification" ? "ring-2 ring-rose-500/30 border-rose-500/40 bg-rose-500/[0.02]" : "border-border/70 hover:border-primary/40"}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold text-xs">
                        4
                      </span>
                      <CardTitle className="text-sm font-semibold">تنوع المحفظة ومخاطر التركيز</CardTitle>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {weakestDimensionKey === "diversification" && (
                        <Badge variant="destructive" className="text-[10px] bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30">
                          أولوية تحسين
                        </Badge>
                      )}
                      <Badge variant="outline" className="text-xs font-mono font-bold">
                        وزن 15%
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-baseline justify-between border-b pb-2">
                    <span className="text-xs text-muted-foreground">الدرجة المحققة:</span>
                    <span className={`text-2xl font-bold font-mono ${getScoreColorClass(parseFloat(scoreData.dimensions.diversification.score))}`}>
                      {scoreData.dimensions.diversification.score} <span className="text-xs text-muted-foreground font-normal">/ 100</span>
                    </span>
                  </div>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">مؤشر هيرفندال (HHI):</span>
                      <span className="font-mono font-bold text-foreground">{scoreData.dimensions.diversification.hhi}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">تركيز أكبر أصل منفرد:</span>
                      <span className="font-mono font-bold text-foreground">{scoreData.dimensions.diversification.topHoldingWeight}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">اسم الأصل الأكبر:</span>
                      <span className="truncate max-w-[150px] text-foreground font-medium">{scoreData.dimensions.diversification.topHoldingName}</span>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground bg-muted/30 p-2.5 rounded-lg leading-relaxed">
                    {scoreData.dimensions.diversification.driverAr}
                  </p>
                </CardContent>
              </Card>

              {/* Dim 5: Resilience & Protection */}
              <Card className={`border shadow-sm transition-all ${weakestDimensionKey === "resilienceProtection" ? "ring-2 ring-rose-500/30 border-rose-500/40 bg-rose-500/[0.02]" : "border-border/70 hover:border-primary/40"}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400 font-bold text-xs">
                        5
                      </span>
                      <CardTitle className="text-sm font-semibold">جودة التقييمات والحماية</CardTitle>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {weakestDimensionKey === "resilienceProtection" && (
                        <Badge variant="destructive" className="text-[10px] bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30">
                          أولوية تحسين
                        </Badge>
                      )}
                      <Badge variant="outline" className="text-xs font-mono font-bold">
                        وزن 10%
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-baseline justify-between border-b pb-2">
                    <span className="text-xs text-muted-foreground">الدرجة المحققة:</span>
                    <span className={`text-2xl font-bold font-mono ${getScoreColorClass(parseFloat(scoreData.dimensions.resilienceProtection.score))}`}>
                      {scoreData.dimensions.resilienceProtection.score} <span className="text-xs text-muted-foreground font-normal">/ 100</span>
                    </span>
                  </div>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">نسبة التقييمات الحديثة (5A):</span>
                      <span className="font-mono font-bold text-foreground">{scoreData.dimensions.resilienceProtection.freshRatio}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">نقاط التأمين والحماية (5B):</span>
                      <span className="font-mono font-bold text-foreground">
                        {Number(scoreData.dimensions.resilienceProtection.healthPoints) +
                          Number(scoreData.dimensions.resilienceProtection.lifePoints) +
                          Number(scoreData.dimensions.resilienceProtection.propertyPoints)}{" "}
                        / 100
                      </span>
                    </div>
                    <div className="flex justify-between text-[11px] text-muted-foreground">
                      <span>صحي: {scoreData.dimensions.resilienceProtection.healthPoints}</span>
                      <span>حياة: {scoreData.dimensions.resilienceProtection.lifePoints}</span>
                      <span>ممتلكات: {scoreData.dimensions.resilienceProtection.propertyPoints}</span>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground bg-muted/30 p-2.5 rounded-lg leading-relaxed">
                    {scoreData.dimensions.resilienceProtection.driverAr}
                  </p>
                </CardContent>
              </Card>

              {/* Dim 6: FI Progress */}
              <Card className={`border shadow-sm transition-all ${weakestDimensionKey === "fiProgress" ? "ring-2 ring-rose-500/30 border-rose-500/40 bg-rose-500/[0.02]" : "border-border/70 hover:border-primary/40"}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 font-bold text-xs">
                        6
                      </span>
                      <CardTitle className="text-sm font-semibold">نسبة التقدم نحو الاستقلال المالي</CardTitle>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {weakestDimensionKey === "fiProgress" && (
                        <Badge variant="destructive" className="text-[10px] bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30">
                          أولوية تحسين
                        </Badge>
                      )}
                      <Badge variant="outline" className="text-xs font-mono font-bold">
                        وزن 15%
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-baseline justify-between border-b pb-2">
                    <span className="text-xs text-muted-foreground">الدرجة المحققة:</span>
                    <span className={`text-2xl font-bold font-mono ${getScoreColorClass(parseFloat(scoreData.dimensions.fiProgress.score))}`}>
                      {scoreData.dimensions.fiProgress.score} <span className="text-xs text-muted-foreground font-normal">/ 100</span>
                    </span>
                  </div>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">نسبة الهدف المحققة فعليًا:</span>
                      <span className="font-mono font-bold text-foreground">{scoreData.dimensions.fiProgress.fiProgressRatio}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">الأصول الاستثمارية المؤهلة:</span>
                      <span className="font-mono"><SensitiveValue>{formatMoney(scoreData.dimensions.fiProgress.investableAssetsBase, baseCurrency, 0)}</SensitiveValue></span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">مستهدف الاستقلال (SWR 4%):</span>
                      <span className="font-mono"><SensitiveValue>{formatMoney(scoreData.dimensions.fiProgress.kFiBaselineBase, baseCurrency, 0)}</SensitiveValue></span>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground bg-muted/30 p-2.5 rounded-lg leading-relaxed">
                    {scoreData.dimensions.fiProgress.driverAr}
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* 4. DETERMINISTIC FI / FIRE HORIZON SIMULATOR */}
        {/* ==================================================================== */}
        <div className="space-y-6 pt-4 border-t border-border/60">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2">
            <div>
              <div className="flex items-center gap-2">
                <Calculator className="size-5 text-primary" />
                <h2 className="text-xl font-bold">محاكي أفق الاستقلال المالي — FIRE</h2>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                إسقاط حتمي دقيق يحسب تاريخ الوصول المستهدف باستخدام معادلة فيشر الرياضية الدقيقة ودقة 40 رقمًا عشريًا
              </p>
            </div>
            <Badge variant="secondary" className="font-mono text-xs text-muted-foreground">
              Decimal.js Precision 40
            </Badge>
          </div>

          {/* Interactive Controls & Mode Selector */}
          <Card className="border border-border/80 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">تحديد نمط الإنفاق والافتراضات</CardTitle>
              <CardDescription className="text-xs">
                اختر أساس الإنفاق الذي ترغب في بناء خطة الاستقلال المالي عليه، أو عدّل معدلات العائد والتضخم والسحب الآمن
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Spending Mode Tabs */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-muted-foreground">أساس الإنفاق السنوي المستهدف:</Label>
                <Tabs value={spendingMode} onValueChange={(val) => setSpendingMode(val as any)} className="w-full">
                  <TabsList className="grid grid-cols-3 w-full max-w-xl">
                    <TabsTrigger value="actual_ttm" className="text-xs">
                      الإنفاق الفعلي لآخر 12 شهرًا
                    </TabsTrigger>
                    <TabsTrigger value="essential_ttm" className="text-xs">
                      التقاعد البسيط (Lean FIRE)
                    </TabsTrigger>
                    <TabsTrigger value="custom" className="text-xs">
                      التقاعد الوفير / مخصص (Fat FIRE)
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              {/* Custom spending input if custom mode selected */}
              {spendingMode === "custom" && (
                <div className="max-w-md space-y-1.5 p-3 rounded-xl bg-muted/30 border">
                  <Label htmlFor="custom-spending" className="text-xs font-semibold">
                    قيمة الإنفاق السنوي المخصص ({baseCurrency}):
                  </Label>
                  <Input
                    id="custom-spending"
                    type="number"
                    placeholder="مثال: 120000"
                    value={customSpending}
                    onChange={(e) => setCustomSpending(e.target.value)}
                    className="font-mono text-sm"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    سيتم حساب مستهدف رأس المال المطلوب (Corpus) بناءً على هذا الرقم ومعدل السحب الآمن لمطابقة نمط التقاعد الوفير (Fat FIRE) أو ميزانية تقاعد مستهدفة.
                  </p>
                </div>
              )}

              {/* Assumptions Parameters Row with Dual Slider + Input */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2 border-t border-border/50">
                <div className="space-y-2 rounded-xl border bg-card/60 p-3">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="param-return" className="text-xs font-semibold text-muted-foreground">
                      العائد الاسمي السنوي (%):
                    </Label>
                    <Input
                      id="param-return"
                      type="number"
                      step="0.1"
                      min="0"
                      max="30"
                      value={customNominalReturn}
                      onChange={(e) => setCustomNominalReturn(e.target.value)}
                      className="h-7 w-20 font-mono text-xs text-left"
                    />
                  </div>
                  <Slider
                    min={0}
                    max={25}
                    step={0.1}
                    value={[parseFloat(customNominalReturn) || 0]}
                    onValueChange={([val]) => setCustomNominalReturn(val.toFixed(1))}
                    className="py-1"
                  />
                  <p className="text-[11px] text-muted-foreground">الافتراضي: 7.0% سنويًا</p>
                </div>

                <div className="space-y-2 rounded-xl border bg-card/60 p-3">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="param-inflation" className="text-xs font-semibold text-muted-foreground">
                      التضخم السنوي المتوقع (%):
                    </Label>
                    <Input
                      id="param-inflation"
                      type="number"
                      step="0.1"
                      min="0"
                      max="25"
                      value={customInflation}
                      onChange={(e) => setCustomInflation(e.target.value)}
                      className="h-7 w-20 font-mono text-xs text-left"
                    />
                  </div>
                  <Slider
                    min={0}
                    max={20}
                    step={0.1}
                    value={[parseFloat(customInflation) || 0]}
                    onValueChange={([val]) => setCustomInflation(val.toFixed(1))}
                    className="py-1"
                  />
                  <p className="text-[11px] text-muted-foreground">الافتراضي: 3.0% سنويًا</p>
                </div>

                <div className="space-y-2 rounded-xl border bg-card/60 p-3">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="param-swr" className="text-xs font-semibold text-muted-foreground">
                      معدل السحب الآمن SWR (%):
                    </Label>
                    <Input
                      id="param-swr"
                      type="number"
                      step="0.1"
                      min="1"
                      max="10"
                      value={customSwr}
                      onChange={(e) => setCustomSwr(e.target.value)}
                      className="h-7 w-20 font-mono text-xs text-left"
                    />
                  </div>
                  <Slider
                    min={1}
                    max={10}
                    step={0.1}
                    value={[parseFloat(customSwr) || 4]}
                    onValueChange={([val]) => setCustomSwr(val.toFixed(1))}
                    className="py-1"
                  />
                  <p className="text-[11px] text-muted-foreground">الافتراضي: 4.0% (قاعدة الـ 25 ضعفًا)</p>
                </div>

                <div className="space-y-2 rounded-xl border bg-primary/5 border-primary/20 p-3 flex flex-col justify-between text-center">
                  <p className="text-[11px] text-muted-foreground font-semibold">العائد الحقيقي (معادلة Fisher):</p>
                  <p className="text-2xl font-bold font-mono text-primary">
                    {fireData?.assumptions.realReturnPercent ?? "—"}%
                  </p>
                  <p className="text-[10px] text-muted-foreground">r = (1+i)/(1+π) − 1</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Horizon Calculation Display */}
          {fireQuery.isLoading ? (
            <Skeleton className="h-44 rounded-2xl" />
          ) : fireData ? (
            <div className="grid gap-6 lg:grid-cols-12">
              {/* Primary Solved Horizon Card */}
              <Card className="lg:col-span-8 border border-border/80 shadow-sm bg-gradient-to-br from-card via-card to-primary/5">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                      <Sparkles className="size-4 text-primary" />
                      <span>النتيجة الحتمية للأفق الزمني المحسوب</span>
                    </CardTitle>
                    <Badge
                      className={
                        fireData.primaryHorizon.isReachable
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                          : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30"
                      }
                    >
                      {fireData.primaryHorizon.statusLabelAr}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6 pt-2">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                    <div className="p-3 rounded-xl border bg-card/60">
                      <p className="text-xs text-muted-foreground">الأفق بالسنوات</p>
                      <p className="text-2xl font-bold font-mono text-primary mt-1">
                        {fireData.primaryHorizon.horizonYears ? `${fireData.primaryHorizon.horizonYears} سنة` : "—"}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {fireData.primaryHorizon.horizonMonths ? `(${fireData.primaryHorizon.horizonMonths} شهرًا)` : "غير محدد"}
                      </p>
                    </div>

                    <div className="p-3 rounded-xl border bg-card/60">
                      <p className="text-xs text-muted-foreground">تاريخ الوصول المتوقع</p>
                      <p className="text-lg font-bold font-mono text-foreground mt-1">
                        {fireData.primaryHorizon.projectedDate ?? "—"}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">وفق الافتراضات المدخلة</p>
                    </div>

                    <div className="p-3 rounded-xl border bg-card/60">
                      <p className="text-xs text-muted-foreground">رأس المال المستهدف (K_FI)</p>
                      <p className="text-lg font-bold font-mono text-foreground mt-1">
                        <SensitiveValue>{formatMoney(fireData.targetCorpusBase, baseCurrency, 0)}</SensitiveValue>
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">الإنفاق ÷ SWR</p>
                    </div>

                    <div className="p-3 rounded-xl border bg-card/60">
                      <p className="text-xs text-muted-foreground">الفجوة التراكمية المتبقية</p>
                      <p className="text-lg font-bold font-mono text-foreground mt-1">
                        <SensitiveValue>{formatMoney(fireData.gapCorpusBase, baseCurrency, 0)}</SensitiveValue>
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">المستهدف − الأصول المؤهلة</p>
                    </div>
                  </div>

                  {/* Progress bar to target */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">نسبة اكتمال رأس مال الاستقلال:</span>
                      <span className="font-mono font-bold text-foreground">{fireData.progressPercent}%</span>
                    </div>
                    <div className="h-3 w-full bg-muted/60 rounded-full overflow-hidden border border-border/40">
                      <div
                        className="h-full bg-primary rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, Math.max(0, parseFloat(fireData.progressPercent)))}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[11px] text-muted-foreground">
                      <span>أصول مؤهلة: <SensitiveValue>{formatMoney(fireData.investableAssetsBase, baseCurrency, 0)}</SensitiveValue></span>
                      <span>مستهدف: <SensitiveValue>{formatMoney(fireData.targetCorpusBase, baseCurrency, 0)}</SensitiveValue></span>
                    </div>
                  </div>
                </CardContent>
                <div className="p-3 bg-muted/30 border-t border-border/50 text-[11px] text-muted-foreground flex items-center justify-between">
                  <span>المعادلة: A(m) = A₀(1+r_m)^m + C·((1+r_m)^m − 1)/r_m</span>
                  <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="size-3.5" />
                    <span>تم التحقق من أصغر عدد صحيح للأشهر A(m*) ≥ K_FI</span>
                  </span>
                </div>
              </Card>

              {/* Monthly Flow Insights Card */}
              <Card className="lg:col-span-4 border border-border/80 shadow-sm flex flex-col justify-between">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Coins className="size-4 text-primary" />
                    <span>التدفقات الشهرية الداعمة للأفق</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-xs">
                  <div className="flex justify-between border-b pb-2">
                    <span className="text-muted-foreground">الإنفاق السنوي المعتمد:</span>
                    <span className="font-mono font-bold"><SensitiveValue>{formatMoney(fireData.annualSpendingBase, baseCurrency, 0)}</SensitiveValue></span>
                  </div>
                  <div className="flex justify-between border-b pb-2">
                    <span className="text-muted-foreground">الفائض الاستثماري الشهري (C):</span>
                    <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      <SensitiveValue>{formatMoney(fireData.monthlyContributionBase, baseCurrency, 0)}</SensitiveValue>
                    </span>
                  </div>
                  <div className="flex justify-between border-b pb-2">
                    <span className="text-muted-foreground">العائد الحقيقي الشهري (r_m):</span>
                    <span className="font-mono font-bold text-foreground">{fireData.assumptions.monthlyRealRatePercent}%</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed pt-1">
                    الفائض الاستثماري الشهري يمثل الفائض التشغيلي بعد خصم نفقات المعيشة وفوائد القروض وأقساط سداد أصل الديون.
                  </p>
                </CardContent>
                <div className="p-3 bg-muted/40 border-t border-border/50 text-[11px] text-muted-foreground">
                  <span>الأصول الاستثمارية تستثني السكن الخاص والسيارات الشخصية.</span>
                </div>
              </Card>
            </div>
          ) : null}

          {/* ==================================================================== */}
          {/* 5. THREE STANDARD SCENARIOS COMPARISON GRID */}
          {/* ==================================================================== */}
          {fireData?.scenarios && (
            <div className="space-y-4 pt-2">
              <div>
                <h3 className="text-base font-bold">مقارنة السيناريوهات الثلاثة القياسية</h3>
                <p className="text-xs text-muted-foreground">
                  مقارنة حتمية موحدة لاختبار حساسية الأفق الزمني لاختلاف ظروف السوق والإنفاق
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                {/* 1. Conservative Scenario */}
                <Card className="border border-border/70 shadow-sm bg-card hover:border-border transition-colors">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-semibold">{fireData.scenarios.conservative.nameLabelAr}</CardTitle>
                      <Badge variant="outline" className="text-[11px]">متحفظ</Badge>
                    </div>
                    <CardDescription className="text-xs">
                      عائد اسمي {fireData.scenarios.conservative.nominalReturnPercent}% · تضخم {fireData.scenarios.conservative.inflationPercent}% · سحب {fireData.scenarios.conservative.swrPercent}%
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2.5 text-xs">
                    <div className="flex justify-between border-b pb-1.5">
                      <span className="text-muted-foreground">الإنفاق السنوي (+10%):</span>
                      <span className="font-mono font-semibold">
                        <SensitiveValue>{formatMoney(fireData.scenarios.conservative.annualSpendingBase, baseCurrency, 0)}</SensitiveValue>
                      </span>
                    </div>
                    <div className="flex justify-between border-b pb-1.5">
                      <span className="text-muted-foreground">المستهدف (K_FI):</span>
                      <span className="font-mono font-semibold">
                        <SensitiveValue>{formatMoney(fireData.scenarios.conservative.targetCorpusBase, baseCurrency, 0)}</SensitiveValue>
                      </span>
                    </div>
                    <div className="flex justify-between border-b pb-1.5">
                      <span className="text-muted-foreground">الأفق بالسنوات:</span>
                      <span className="font-mono font-bold text-foreground">
                        {fireData.scenarios.conservative.horizonYears ? `${fireData.scenarios.conservative.horizonYears} سنة` : "غير قابل للتحقيق"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">تاريخ الوصول:</span>
                      <span className="font-mono text-muted-foreground">
                        {fireData.scenarios.conservative.projectedDate ?? "—"}
                      </span>
                    </div>
                  </CardContent>
                </Card>

                {/* 2. Base Case Scenario */}
                <Card className="border border-primary/30 shadow-sm bg-primary/5 hover:border-primary/50 transition-colors">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-semibold text-primary">{fireData.scenarios.base.nameLabelAr}</CardTitle>
                      <Badge className="text-[11px] bg-primary text-primary-foreground">الأساس</Badge>
                    </div>
                    <CardDescription className="text-xs">
                      عائد اسمي {fireData.scenarios.base.nominalReturnPercent}% · تضخم {fireData.scenarios.base.inflationPercent}% · سحب {fireData.scenarios.base.swrPercent}%
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2.5 text-xs">
                    <div className="flex justify-between border-b pb-1.5">
                      <span className="text-muted-foreground">الإنفاق السنوي (الفعلي):</span>
                      <span className="font-mono font-semibold">
                        <SensitiveValue>{formatMoney(fireData.scenarios.base.annualSpendingBase, baseCurrency, 0)}</SensitiveValue>
                      </span>
                    </div>
                    <div className="flex justify-between border-b pb-1.5">
                      <span className="text-muted-foreground">المستهدف (K_FI):</span>
                      <span className="font-mono font-semibold text-primary">
                        <SensitiveValue>{formatMoney(fireData.scenarios.base.targetCorpusBase, baseCurrency, 0)}</SensitiveValue>
                      </span>
                    </div>
                    <div className="flex justify-between border-b pb-1.5">
                      <span className="text-muted-foreground">الأفق بالسنوات:</span>
                      <span className="font-mono font-bold text-foreground">
                        {fireData.scenarios.base.horizonYears ? `${fireData.scenarios.base.horizonYears} سنة` : "غير قابل للتحقيق"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">تاريخ الوصول:</span>
                      <span className="font-mono text-foreground font-semibold">
                        {fireData.scenarios.base.projectedDate ?? "—"}
                      </span>
                    </div>
                  </CardContent>
                </Card>

                {/* 3. Optimistic Scenario */}
                <Card className="border border-border/70 shadow-sm bg-card hover:border-border transition-colors">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-semibold">{fireData.scenarios.optimistic.nameLabelAr}</CardTitle>
                      <Badge variant="outline" className="text-[11px]">متفائل</Badge>
                    </div>
                    <CardDescription className="text-xs">
                      عائد اسمي {fireData.scenarios.optimistic.nominalReturnPercent}% · تضخم {fireData.scenarios.optimistic.inflationPercent}% · سحب {fireData.scenarios.optimistic.swrPercent}%
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2.5 text-xs">
                    <div className="flex justify-between border-b pb-1.5">
                      <span className="text-muted-foreground">الإنفاق السنوي (الأساسي):</span>
                      <span className="font-mono font-semibold">
                        <SensitiveValue>{formatMoney(fireData.scenarios.optimistic.annualSpendingBase, baseCurrency, 0)}</SensitiveValue>
                      </span>
                    </div>
                    <div className="flex justify-between border-b pb-1.5">
                      <span className="text-muted-foreground">المستهدف (K_FI):</span>
                      <span className="font-mono font-semibold">
                        <SensitiveValue>{formatMoney(fireData.scenarios.optimistic.targetCorpusBase, baseCurrency, 0)}</SensitiveValue>
                      </span>
                    </div>
                    <div className="flex justify-between border-b pb-1.5">
                      <span className="text-muted-foreground">الأفق بالسنوات:</span>
                      <span className="font-mono font-bold text-foreground">
                        {fireData.scenarios.optimistic.horizonYears ? `${fireData.scenarios.optimistic.horizonYears} سنة` : "غير قابل للتحقيق"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">تاريخ الوصول:</span>
                      <span className="font-mono text-muted-foreground">
                        {fireData.scenarios.optimistic.projectedDate ?? "—"}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {/* ==================================================================== */}
          {/* 6. SAVE PLANNING ASSUMPTIONS DRAWER/CARD */}
          {/* ==================================================================== */}
          <Card className="border border-border/80 bg-muted/20">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Save className="size-4 text-primary" />
                  <span>حفظ افتراضات التخطيط المالي للمساحة</span>
                </CardTitle>
                <Badge variant="outline" className="text-[11px]">صلاحية محرر / مالك</Badge>
              </div>
              <CardDescription className="text-xs">
                احفظ هذه الافتراضات كمعايير أساسية لخطط التقاعد والاستقلال المالي في مساحة FAMILY
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaveAssumptions} className="flex flex-wrap items-end gap-4">
                <div className="space-y-1">
                  <Label htmlFor="save-ret-age" className="text-xs">سن التقاعد المستهدف:</Label>
                  <Input
                    id="save-ret-age"
                    type="number"
                    min={18}
                    max={100}
                    value={targetRetirementAge}
                    onChange={(e) => setTargetRetirementAge(parseInt(e.target.value) || 60)}
                    className="w-28 font-mono text-sm"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">العائد المحفوظ:</Label>
                  <div className="p-2 border rounded-md font-mono text-sm bg-background w-24 text-center">
                    {customNominalReturn}%
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">التضخم المحفوظ:</Label>
                  <div className="p-2 border rounded-md font-mono text-sm bg-background w-24 text-center">
                    {customInflation}%
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">معدل السحب SWR:</Label>
                  <div className="p-2 border rounded-md font-mono text-sm bg-background w-24 text-center">
                    {customSwr}%
                  </div>
                </div>

                <Button type="submit" disabled={isSavingAssumptions} size="sm" className="gap-1.5">
                  <Save className="size-3.5" />
                  <span>{isSavingAssumptions ? "جارٍ الحفظ…" : "اعتماد الافتراضات"}</span>
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
