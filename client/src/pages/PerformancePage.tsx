import React, { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import SensitiveValue from "@/components/SensitiveValue";
import { formatMoney } from "@/lib/financialDisplay";
import {
  TrendingUp,
  Scale,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Info,
  Calendar,
  Layers,
  ArrowDownLeft,
  ArrowUpRight,
  Activity,
  BarChart3,
  Percent,
  Compass,
  FileSpreadsheet,
} from "lucide-react";

type PeriodKey = "mtd" | "qtd" | "ytd" | "1y" | "3y" | "5y" | "inception";

export default function PerformancePage() {
  const [period, setPeriod] = useState<PeriodKey>("ytd");
  const [benchmark, setBenchmark] = useState<string>("SP500");
  const [riskFreeRate, setRiskFreeRate] = useState<string>("0.0000");

  const utils = trpc.useUtils();

  const performanceQuery = trpc.performance.getPerformanceSummary.useQuery(
    {
      period,
      benchmark,
      riskFreeRate,
    },
    {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    }
  );

  const benchmarksQuery = trpc.performance.listAvailableBenchmarks.useQuery(undefined, {
    staleTime: 60_000,
  });

  const data = performanceQuery.data;
  const isLoading = performanceQuery.isLoading;
  const isFetching = performanceQuery.isFetching;

  const handleRefresh = () => {
    void utils.performance.getPerformanceSummary.invalidate();
  };

  const formatPercent = (val: string | null | undefined, decimals = 2) => {
    if (val === null || val === undefined) return "—";
    const num = parseFloat(val) * 100;
    if (isNaN(num)) return "—";
    const sign = num > 0 ? "+" : "";
    return `${sign}${num.toFixed(decimals)}%`;
  };

  const getReturnColorClass = (val: string | null | undefined) => {
    if (!val) return "text-muted-foreground";
    const num = parseFloat(val);
    if (isNaN(num) || num === 0) return "text-foreground";
    return num > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400";
  };

  const baseCurrency = data?.baseCurrency || "EGP";

  return (
    <DashboardLayout>
      <div className="space-y-6 pb-12" dir="rtl">
        {/* Header Section */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <TrendingUp className="size-5" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-foreground">
                  أداء المحفظة وعزو العوائد الاستثمارية
                </h1>
                <p className="text-sm text-muted-foreground">
                  تحليل مؤسسي مسترشد بمنهجية GIPS للعائد الموزون بالوقت (TWR) والعائد الموزون بالمال (MWR / IRR)
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isFetching}
              className="gap-2"
            >
              <RefreshCw className={`size-3.5 ${isFetching ? "animate-spin" : ""}`} />
              <span>تحديث الأداء</span>
            </Button>
          </div>
        </div>

        {/* Period & Benchmark Selector Bar */}
        <Card className="border-border/60 shadow-xs">
          <CardContent className="p-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              {/* Period Tabs */}
              <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center">
                <span className="text-xs font-semibold text-muted-foreground">نطاق التقييم:</span>
                <Tabs value={period} onValueChange={(v) => setPeriod(v as PeriodKey)}>
                  <TabsList className="grid grid-cols-4 sm:flex sm:flex-wrap gap-1">
                    <TabsTrigger value="mtd" className="text-xs">MTD (الشهر)</TabsTrigger>
                    <TabsTrigger value="qtd" className="text-xs">QTD (الربع)</TabsTrigger>
                    <TabsTrigger value="ytd" className="text-xs">YTD (العام)</TabsTrigger>
                    <TabsTrigger value="1y" className="text-xs">سنة (1Y)</TabsTrigger>
                    <TabsTrigger value="3y" className="text-xs">3 سنوات</TabsTrigger>
                    <TabsTrigger value="5y" className="text-xs">5 سنوات</TabsTrigger>
                    <TabsTrigger value="inception" className="text-xs">منذ التأسيس</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              {/* Benchmark Selector */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <Compass className="size-4 text-muted-foreground" />
                  <span className="text-xs font-semibold text-muted-foreground">المؤشر المرجعي:</span>
                  <select
                    value={benchmark}
                    onChange={(e) => setBenchmark(e.target.value)}
                    className="h-8 rounded-md border border-input bg-background px-2.5 text-xs text-foreground focus:outline-hidden focus:ring-1 focus:ring-ring"
                  >
                    <option value="SP500">S&P 500 الأمريكي</option>
                    <option value="MSCI_WORLD">MSCI World العالمي</option>
                    <option value="TASI">تاسي السعودي TASI</option>
                    <option value="GOLD_USD">الذهب العالمي (USD)</option>
                    <option value="NONE">بدون مؤشر مرجعي</option>
                  </select>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Primary KPI Metrics Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* 1. TWR (Time-Weighted Return) */}
          <Card className="border-border/60">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardDescription className="text-xs font-semibold">العائد الموزون بالوقت (TWR)</CardDescription>
                <Badge variant="outline" className="text-[10px] font-mono">
                  {data?.twr.dataQuality === "exact_daily"
                    ? "يومي موثق"
                    : data?.twr.dataQuality === "cash_flow_linked"
                    ? "مرتبط بالتدفقات"
                    : "تقديري"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <div className="space-y-1">
                  <div className={`text-2xl font-bold tracking-tight font-mono ${getReturnColorClass(data?.twr.cumulativeTwr)}`}>
                    {formatPercent(data?.twr.cumulativeTwr)}
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center justify-between">
                    <span>
                      {data?.twr.annualizedTwr
                        ? `سنوي: ${formatPercent(data?.twr.annualizedTwr)}`
                        : "عائد تراكمي (أقل من سنة)"}
                    </span>
                    <span className="text-[11px] text-muted-foreground/80 font-mono">
                      {data?.twr.periodDays} يوم
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 2. MWR / IRR (Money-Weighted Return) */}
          <Card className="border-border/60">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardDescription className="text-xs font-semibold">العائد الموزون بالمال (MWR / IRR)</CardDescription>
                <Badge variant="outline" className="text-[10px] font-mono">
                  {data?.mwr.solverMethod === "newton"
                    ? "Newton-Raphson"
                    : data?.mwr.solverMethod === "bisection"
                    ? "Bisection Fallback"
                    : data?.mwr.solverMethod === "exact"
                    ? "تحليلي مباشر"
                    : "غير محدد"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <div className="space-y-1">
                  <div className={`text-2xl font-bold tracking-tight font-mono ${getReturnColorClass(data?.mwr.irr)}`}>
                    {data?.mwr.converged && data?.mwr.irr ? formatPercent(data?.mwr.irr) : "—"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {data?.mwr.converged ? (
                      <span>حل رقمي دقيق ({data.mwr.iterations} دورات تقارب)</span>
                    ) : (
                      <span className="text-amber-500">لا يوجد جذر حقيقي للتدفقات</span>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 3. Max Drawdown */}
          <Card className="border-border/60">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardDescription className="text-xs font-semibold">أقصى تراجع للمحفظة (Max Drawdown)</CardDescription>
                <Scale className="size-4 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <div className="space-y-1">
                  <div className="text-2xl font-bold tracking-tight font-mono text-rose-600 dark:text-rose-400">
                    {formatPercent(data?.riskMetrics.maxDrawdown)}
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center justify-between">
                    <span>
                      {data?.riskMetrics.maxDrawdownRecoveryDate
                        ? "تم التعافي إلى القمة"
                        : parseFloat(data?.riskMetrics.maxDrawdown || "0") === 0
                        ? "لا يوجد تراجع مسجل"
                        : "قيد مرحلة التعافي"}
                    </span>
                    <span className="text-[11px] font-mono text-muted-foreground/80">
                      نسبة شارب: {data?.riskMetrics.sharpeRatio ?? "—"}
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 4. Alpha & Beta against Benchmark */}
          <Card className="border-border/60">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardDescription className="text-xs font-semibold">مؤشرات المقارنة (Alpha & Beta)</CardDescription>
                <Badge
                  variant={data?.benchmark.benchmarkStatus === "available" ? "secondary" : "outline"}
                  className="text-[10px]"
                >
                  {data?.benchmark.benchmarkStatus === "available"
                    ? "مؤشر مقترن"
                    : data?.benchmark.benchmarkStatus === "insufficient_quotes"
                    ? "بيانات غير كافية"
                    : "غير متوفر"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <div className="space-y-1">
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs text-muted-foreground">ألفا (α):</span>
                    <span className={`text-xl font-bold font-mono ${getReturnColorClass(data?.benchmark.alpha)}`}>
                      {formatPercent(data?.benchmark.alpha)}
                    </span>
                    <span className="text-xs text-muted-foreground mr-2">بيتا (β):</span>
                    <span className="text-xl font-bold font-mono text-foreground">
                      {data?.benchmark.beta ?? "—"}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    المؤشر: {data?.benchmark.benchmarkSymbol}
                    {data?.benchmark.benchmarkCumulativeReturn && (
                      <span className="font-mono mr-1">
                        ({formatPercent(data.benchmark.benchmarkCumulativeReturn)})
                      </span>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Benchmark Diagnostic Notice (If unavailable in DB) */}
        {!isLoading && data?.benchmark.benchmarkStatus !== "available" && (
          <div className="flex items-start gap-3 rounded-lg border border-amber-500/20 bg-amber-500/10 p-3.5 text-xs text-amber-800 dark:text-amber-200">
            <Info className="size-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
            <div>
              <strong>تنبيه جودة البيانات المرجعية: </strong>
              <span>
                {data?.benchmark.message ||
                  `لم يتم تسجيل أسعار كافية للمؤشر (${data?.benchmark.benchmarkSymbol}) في مساحة العمل لهذا النطاق الزمني. تم إيقاف احتساب ألفا وبيتا تلقائيًا التزامًا بالحياد المؤسسي وعدم توليد أرقام تقديرية زائفة.`}
              </span>
            </div>
          </div>
        )}

        {/* Capital Growth Waterfall / Bridge Card */}
        <Card className="border-border/60 shadow-xs">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Activity className="size-4 text-primary" />
                  <span>جسر نمو رأس المال (Capital Growth Waterfall)</span>
                </CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  مطابقة محاسبية دقيقة: رأس المال الافتتاحي + الإيداعات - السحوبات + الربح/الخسارة = رأس المال الختامي
                </CardDescription>
              </div>
              <Badge variant="outline" className="text-xs text-emerald-600 dark:text-emerald-400 border-emerald-500/30">
                <CheckCircle2 className="size-3 ml-1" />
                مطابقة محاسبية معتمدة
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-20 w-full" />
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6 text-center">
                {/* 1. Start Capital */}
                <div className="rounded-lg bg-muted/40 p-3 border border-border/40">
                  <div className="text-[11px] text-muted-foreground font-medium mb-1">رأس المال الافتتاحي</div>
                  <div className="font-bold text-sm font-mono text-foreground">
                    <SensitiveValue>{formatMoney(data?.capitalBridge.startingCapital || "0", baseCurrency)}</SensitiveValue>
                  </div>
                </div>

                {/* 2. Total Deposits */}
                <div className="rounded-lg bg-emerald-500/10 p-3 border border-emerald-500/20">
                  <div className="text-[11px] text-emerald-700 dark:text-emerald-300 font-medium mb-1">(+) الإيداعات الرأسمالية</div>
                  <div className="font-bold text-sm font-mono text-emerald-600 dark:text-emerald-400">
                    <SensitiveValue>{formatMoney(data?.capitalBridge.totalDeposits || "0", baseCurrency)}</SensitiveValue>
                  </div>
                </div>

                {/* 3. Total Withdrawals */}
                <div className="rounded-lg bg-rose-500/10 p-3 border border-rose-500/20">
                  <div className="text-[11px] text-rose-700 dark:text-rose-300 font-medium mb-1">(-) السحوبات والتوزيعات</div>
                  <div className="font-bold text-sm font-mono text-rose-600 dark:text-rose-400">
                    <SensitiveValue>{formatMoney(data?.capitalBridge.totalWithdrawals || "0", baseCurrency)}</SensitiveValue>
                  </div>
                </div>

                {/* 4. Net Contributions */}
                <div className="rounded-lg bg-muted/40 p-3 border border-border/40">
                  <div className="text-[11px] text-muted-foreground font-medium mb-1">(=) صافي التدفق الخارجي</div>
                  <div className="font-bold text-sm font-mono text-foreground">
                    <SensitiveValue>{formatMoney(data?.capitalBridge.netContributions || "0", baseCurrency)}</SensitiveValue>
                  </div>
                </div>

                {/* 5. Investment Gain / Loss */}
                <div className="rounded-lg bg-blue-500/10 p-3 border border-blue-500/20">
                  <div className="text-[11px] text-blue-700 dark:text-blue-300 font-medium mb-1">(+/-) أرباح/خسائر الاستثمار</div>
                  <div className={`font-bold text-sm font-mono ${getReturnColorClass(data?.capitalBridge.investmentGainLoss)}`}>
                    <SensitiveValue>{formatMoney(data?.capitalBridge.investmentGainLoss || "0", baseCurrency)}</SensitiveValue>
                  </div>
                </div>

                {/* 6. Ending Capital */}
                <div className="rounded-lg bg-primary/10 p-3 border border-primary/20">
                  <div className="text-[11px] text-primary font-semibold mb-1">(=) رأس المال الختامي</div>
                  <div className="font-bold text-sm font-mono text-foreground">
                    <SensitiveValue>{formatMoney(data?.capitalBridge.endingCapital || "0", baseCurrency)}</SensitiveValue>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Asset Class Performance Attribution Table */}
        <Card className="border-border/60 shadow-xs">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Layers className="size-4 text-primary" />
                  <span>عزو الأداء حسب فئات الأصول (Asset Class Attribution)</span>
                </CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  تحليل مساهمة كل فئة استثمارية في العائد الإجمالي للمحفظة وفق متوسط الأوزان النسبية
                </CardDescription>
              </div>
              <div className="text-xs font-mono text-muted-foreground">
                العائد الإجمالي: {formatPercent(data?.attribution.totalReturn)}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-right border-collapse">
                  <thead>
                    <tr className="border-b border-border/60 bg-muted/30 text-muted-foreground">
                      <th className="py-2.5 px-3 font-semibold">فئة الأصل</th>
                      <th className="py-2.5 px-3 font-semibold">القيمة الابتدائية</th>
                      <th className="py-2.5 px-3 font-semibold">القيمة الختامية</th>
                      <th className="py-2.5 px-3 font-semibold">الوزن النسبي المتوسط</th>
                      <th className="py-2.5 px-3 font-semibold">عائد الفئة</th>
                      <th className="py-2.5 px-3 font-semibold">المساهمة في عائد المحفظة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40 font-mono">
                    {data?.attribution.assetClasses.map((ac) => (
                      <tr key={ac.assetClass} className="hover:bg-muted/20 transition-colors">
                        <td className="py-2.5 px-3 font-sans font-medium text-foreground">
                          {ac.nameAr}
                        </td>
                        <td className="py-2.5 px-3 text-muted-foreground">
                          <SensitiveValue>{formatMoney(ac.startValue, baseCurrency)}</SensitiveValue>
                        </td>
                        <td className="py-2.5 px-3 text-foreground font-semibold">
                          <SensitiveValue>{formatMoney(ac.endValue, baseCurrency)}</SensitiveValue>
                        </td>
                        <td className="py-2.5 px-3 text-muted-foreground">
                          {(parseFloat(ac.averageWeight) * 100).toFixed(1)}%
                        </td>
                        <td className={`py-2.5 px-3 font-semibold ${getReturnColorClass(ac.assetReturn)}`}>
                          {formatPercent(ac.assetReturn)}
                        </td>
                        <td className={`py-2.5 px-3 font-bold ${getReturnColorClass(ac.contribution)}`}>
                          {formatPercent(ac.contribution)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-border font-bold bg-muted/40">
                      <td className="py-2.5 px-3 font-sans">إجمالي مساهمات الفئات</td>
                      <td colSpan={4} className="py-2.5 px-3 font-sans text-left text-muted-foreground font-normal">
                        مطابقة المساهمات مع العائد الكلي:
                      </td>
                      <td className={`py-2.5 px-3 font-mono ${getReturnColorClass(data?.attribution.reconciledSum)}`}>
                        {formatPercent(data?.attribution.reconciledSum)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            {/* Unsupported Dimensions Notice */}
            <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground/80 border-t border-border/40 pt-2.5">
              <span className="flex items-center gap-1.5">
                <Info className="size-3 text-muted-foreground" />
                أبعاد العزو غير المشمولة لعدم توفر تصنيف قطاعي في الأدوات: عزو القطاعات GICS، تفاعل أسعار الصرف، عزو انتقاء الأسهم.
              </span>
              <span className="font-mono">
                فرق المطابقة: {formatPercent(data?.attribution.reconciliationDiff, 4)}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* GIPS Sub-Periods Breakdown */}
        {data && data.twr.subPeriods.length > 1 && (
          <Card className="border-border/60 shadow-xs">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <Calendar className="size-4 text-primary" />
                    <span>تفاصيل الفترات الجزئية الموزونة بالوقت (GIPS Sub-Periods)</span>
                  </CardTitle>
                  <CardDescription className="text-xs mt-0.5">
                    تقسيم الفترات المحاسبية تلقائيًا عند تواريخ التدفقات الرأسمالية الخارجية لتحقيق الحياد المالي التام
                  </CardDescription>
                </div>
                <Badge variant="outline" className="text-xs font-mono">
                  {data.twr.subPeriods.length} فترات جزئية
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-right border-collapse">
                  <thead>
                    <tr className="border-b border-border/60 bg-muted/30 text-muted-foreground">
                      <th className="py-2.5 px-3 font-semibold">الفترة</th>
                      <th className="py-2.5 px-3 font-semibold">بداية الفترة</th>
                      <th className="py-2.5 px-3 font-semibold">قبل التدفق</th>
                      <th className="py-2.5 px-3 font-semibold">التدفق الخارجي</th>
                      <th className="py-2.5 px-3 font-semibold">بعد التدفق</th>
                      <th className="py-2.5 px-3 font-semibold">عائد الفترة الجزئية</th>
                      <th className="py-2.5 px-3 font-semibold">التراكمي المركب</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40 font-mono">
                    {data.twr.subPeriods.map((sp, idx) => (
                      <tr key={idx} className="hover:bg-muted/20 transition-colors">
                        <td className="py-2.5 px-3 font-sans font-medium text-foreground">
                          الفترة {idx + 1}
                        </td>
                        <td className="py-2.5 px-3 text-muted-foreground">
                          <SensitiveValue>{formatMoney(sp.startValuation, baseCurrency)}</SensitiveValue>
                        </td>
                        <td className="py-2.5 px-3 text-muted-foreground">
                          <SensitiveValue>{formatMoney(sp.endValuationPreFlow, baseCurrency)}</SensitiveValue>
                        </td>
                        <td className={`py-2.5 px-3 font-semibold ${parseFloat(sp.netCashFlow) > 0 ? "text-emerald-600" : parseFloat(sp.netCashFlow) < 0 ? "text-rose-600" : "text-muted-foreground"}`}>
                          <SensitiveValue>{formatMoney(sp.netCashFlow, baseCurrency)}</SensitiveValue>
                        </td>
                        <td className="py-2.5 px-3 text-foreground font-semibold">
                          <SensitiveValue>{formatMoney(sp.endValuationPostFlow, baseCurrency)}</SensitiveValue>
                        </td>
                        <td className={`py-2.5 px-3 font-bold ${getReturnColorClass(sp.subPeriodReturn)}`}>
                          {formatPercent(sp.subPeriodReturn)}
                        </td>
                        <td className={`py-2.5 px-3 font-bold ${getReturnColorClass(sp.cumulatedTwr)}`}>
                          {formatPercent(sp.cumulatedTwr)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
