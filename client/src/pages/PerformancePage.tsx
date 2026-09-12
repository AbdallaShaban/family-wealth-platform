import React, { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import PageHeader from "@/components/PageHeader";
import FinancialTooltip from "@/components/FinancialTooltip";
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
  RefreshCw,
  Info,
  Layers,
  Activity,
  Compass,
  Calendar,
  CheckCircle2,
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
    if (!val) return "text-[#64748B] dark:text-muted-foreground";
    const num = parseFloat(val);
    if (isNaN(num) || num === 0) return "text-[#0B1628] dark:text-foreground";
    return num > 0 ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400";
  };

  const baseCurrency = data?.baseCurrency || "EGP";

  return (
    <DashboardLayout>
      <div className="space-y-6 pb-12" dir="rtl">
        <PageHeader
          title="أداء المحفظة وعزو العوائد الاستثمارية"
          description="تحليل مؤسسي مسترشد بمنهجية GIPS للعائد المرجح زمنياً (TWR) والعائد المرجح بالتدفقات النقدية (MWR / IRR)"
          icon={TrendingUp}
          breadcrumbs={[
            { label: "الحوكمة والتحليل", href: "/wealth-health" },
            { label: "الأداء المالي (TWR/MWR)" },
          ]}
          badge="منهجية GIPS المحاسبية"
          actions={
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isFetching}
              className="gap-2 border-[#E2E8F0] dark:border-border text-xs"
            >
              <RefreshCw className={`size-3.5 ${isFetching ? "animate-spin text-emerald-600" : ""}`} />
              <span>تحديث الأداء</span>
            </Button>
          }
        />

        {/* Period & Benchmark Selector Toolbar */}
        <div className="rounded-xl border border-[#E2E8F0] dark:border-border bg-[#F8FAFC] dark:bg-card p-4 shadow-2xs">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            {/* Period Tabs */}
            <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center">
              <span className="text-xs font-semibold text-[#64748B] dark:text-muted-foreground ml-2">الفترة الزمنية:</span>
              <Tabs value={period} onValueChange={(v) => setPeriod(v as PeriodKey)}>
                <TabsList className="grid grid-cols-7 h-8 bg-[#EEF2F6] dark:bg-muted/60 border border-[#E2E8F0] dark:border-border">
                  <TabsTrigger value="mtd" className="text-xs font-medium">MTD</TabsTrigger>
                  <TabsTrigger value="qtd" className="text-xs font-medium">QTD</TabsTrigger>
                  <TabsTrigger value="ytd" className="text-xs font-semibold">YTD</TabsTrigger>
                  <TabsTrigger value="1y" className="text-xs font-medium">سنة</TabsTrigger>
                  <TabsTrigger value="3y" className="text-xs font-medium">3 سنين</TabsTrigger>
                  <TabsTrigger value="5y" className="text-xs font-medium">5 سنين</TabsTrigger>
                  <TabsTrigger value="inception" className="text-xs font-medium">من التأسيس</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {/* Benchmark Selector */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-[#64748B] dark:text-muted-foreground">المؤشر المقارن:</span>
                <select
                  value={benchmark}
                  onChange={(e) => setBenchmark(e.target.value)}
                  className="h-8 rounded-md border border-[#E2E8F0] dark:border-border bg-[#FFFFFF] dark:bg-background px-2.5 py-1 text-xs text-[#0B1628] dark:text-foreground font-medium shadow-xs focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-emerald-500"
                  aria-label="المؤشر المقارن"
                >
                  {benchmarksQuery.data?.map((b) => (
                    <option key={b.symbol} value={b.symbol}>
                      {b.name} ({b.symbol})
                    </option>
                  )) || <option value="SP500">S&P 500</option>}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Section 1: Primary KPI Metrics inside Section Surface */}
        <section className="rounded-2xl border border-[#E2E8F0] dark:border-border bg-[#EEF2F6] dark:bg-card/40 p-5 sm:p-6 shadow-2xs space-y-4" aria-labelledby="kpi-heading">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 id="kpi-heading" className="flex items-center gap-2 text-base font-bold text-[#0B1628] dark:text-foreground sm:text-lg">
                <Activity className="size-5 text-emerald-600 dark:text-emerald-400" />
                <span>المؤشرات المالية الرئيسية (GIPS Return & Risk)</span>
              </h2>
              <p className="text-xs text-[#64748B] dark:text-muted-foreground">
                قياس معدلات العائد المرجحة زمنياً ونقدياً وضوابط المخاطر للمحفظة
              </p>
            </div>
            <Badge variant="outline" className="self-start sm:self-center border-[#E2E8F0] dark:border-border bg-[#FFFFFF] dark:bg-card text-[#0B1628] dark:text-slate-100 text-xs font-semibold px-2.5 py-1">
              منهجية GIPS المحاسبية
            </Badge>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* 1. TWR (Time-Weighted Return) */}
            <div className="rounded-xl border border-[#E2E8F0] dark:border-border bg-[#FFFFFF] dark:bg-card p-4 shadow-xs">
              <div className="flex items-center justify-between mb-2">
                <FinancialTooltip term="TWR">
                  <span className="text-xs font-semibold text-[#64748B] dark:text-muted-foreground cursor-help border-b border-dashed border-[#64748B]/40">
                    العائد المرجح زمنياً (TWR)
                  </span>
                </FinancialTooltip>
                <Badge variant="outline" className="text-[10px] font-mono border-[#E2E8F0] dark:border-border bg-[#F8FAFC] dark:bg-muted/40 text-[#64748B] dark:text-muted-foreground">
                  {data?.twr.dataQuality === "exact_daily"
                    ? "يومي موثق"
                    : data?.twr.dataQuality === "cash_flow_linked"
                    ? "مرتبط بالتدفقات"
                    : "تقديري"}
                </Badge>
              </div>
              {isLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <div className="space-y-1">
                  <div className={`text-2xl font-bold tracking-tight font-mono ${getReturnColorClass(data?.twr.cumulativeTwr)}`}>
                    {formatPercent(data?.twr.cumulativeTwr)}
                  </div>
                  <div className="text-xs text-[#64748B] dark:text-muted-foreground flex items-center justify-between">
                    <span>
                      {data?.twr.annualizedTwr
                        ? `سنوي: ${formatPercent(data?.twr.annualizedTwr)}`
                        : "عائد تراكمي (أقل من سنة)"}
                    </span>
                    <span className="text-[11px] font-mono">
                      {data?.twr.periodDays} يوم
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* 2. MWR / IRR (Money-Weighted Return) */}
            <div className="rounded-xl border border-[#E2E8F0] dark:border-border bg-[#FFFFFF] dark:bg-card p-4 shadow-xs">
              <div className="flex items-center justify-between mb-2">
                <FinancialTooltip term="MWR">
                  <span className="text-xs font-semibold text-[#64748B] dark:text-muted-foreground cursor-help border-b border-dashed border-[#64748B]/40">
                    العائد المرجح بالتدفقات (MWR / IRR)
                  </span>
                </FinancialTooltip>
                <Badge variant="outline" className="text-[10px] font-mono border-[#E2E8F0] dark:border-border bg-[#F8FAFC] dark:bg-muted/40 text-[#64748B] dark:text-muted-foreground">
                  {data?.mwr.solverMethod === "newton"
                    ? "Newton-Raphson"
                    : data?.mwr.solverMethod === "bisection"
                    ? "Bisection"
                    : data?.mwr.solverMethod === "exact"
                    ? "تحليلي مباشر"
                    : "غير محدد"}
                </Badge>
              </div>
              {isLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <div className="space-y-1">
                  <div className={`text-2xl font-bold tracking-tight font-mono ${getReturnColorClass(data?.mwr.irr)}`}>
                    {data?.mwr.converged && data?.mwr.irr ? formatPercent(data?.mwr.irr) : "—"}
                  </div>
                  <div className="text-xs text-[#64748B] dark:text-muted-foreground">
                    {data?.mwr.converged ? (
                      <span>حل رقمي دقيق ({data.mwr.iterations} دورات)</span>
                    ) : (
                      <span className="text-amber-700 dark:text-amber-400">لا يوجد جذر حقيقي</span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* 3. Max Drawdown */}
            <div className="rounded-xl border border-[#E2E8F0] dark:border-border bg-[#FFFFFF] dark:bg-card p-4 shadow-xs">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-[#64748B] dark:text-muted-foreground">
                  أقصى تراجع (Max Drawdown)
                </span>
                <Scale className="size-4 text-[#64748B] dark:text-muted-foreground" />
              </div>
              {isLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <div className="space-y-1">
                  <div className="text-2xl font-bold tracking-tight font-mono text-[#0B1628] dark:text-foreground">
                    {formatPercent(data?.riskMetrics.maxDrawdown)}
                  </div>
                  <div className="text-xs text-[#64748B] dark:text-muted-foreground flex items-center justify-between">
                    <span>
                      {data?.riskMetrics.maxDrawdownRecoveryDate
                        ? "تم التعافي إلى القمة"
                        : parseFloat(data?.riskMetrics.maxDrawdown || "0") === 0
                        ? "لا يوجد تراجع مسجل"
                        : "قيد مرحلة التعافي"}
                    </span>
                    <span className="text-[11px] font-mono">
                      شارب: {data?.riskMetrics.sharpeRatio ?? "—"}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* 4. Alpha & Beta against Benchmark */}
            <div className="rounded-xl border border-[#E2E8F0] dark:border-border bg-[#FFFFFF] dark:bg-card p-4 shadow-xs">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-[#64748B] dark:text-muted-foreground">
                  مؤشرات المقارنة (Alpha & Beta)
                </span>
                <Badge
                  variant="outline"
                  className="text-[10px] border-[#E2E8F0] dark:border-border bg-[#F8FAFC] dark:bg-muted/40 text-[#64748B] dark:text-muted-foreground"
                >
                  {data?.benchmark.benchmarkStatus === "available"
                    ? "مؤشر مقترن"
                    : data?.benchmark.benchmarkStatus === "insufficient_quotes"
                    ? "بيانات غير كافية"
                    : "غير متوفر"}
                </Badge>
              </div>
              {isLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <div className="space-y-1">
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs text-[#64748B] dark:text-muted-foreground">ألفا (α):</span>
                    <span className={`text-xl font-bold font-mono ${getReturnColorClass(data?.benchmark.alpha)}`}>
                      {formatPercent(data?.benchmark.alpha)}
                    </span>
                    <span className="text-xs text-[#64748B] dark:text-muted-foreground mr-2">بيتا (β):</span>
                    <span className="text-xl font-bold font-mono text-[#0B1628] dark:text-foreground">
                      {data?.benchmark.beta ?? "—"}
                    </span>
                  </div>
                  <div className="text-xs text-[#64748B] dark:text-muted-foreground truncate">
                    المؤشر: {data?.benchmark.benchmarkSymbol}
                    {data?.benchmark.benchmarkCumulativeReturn && (
                      <span className="font-mono mr-1">
                        ({formatPercent(data.benchmark.benchmarkCumulativeReturn)})
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Benchmark Diagnostic Notice (If unavailable in DB) */}
        {!isLoading && data?.benchmark.benchmarkStatus !== "available" && (
          <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-[#FFFBEB] dark:bg-amber-950/40 p-4 text-xs text-[#0B1628] dark:text-slate-100 shadow-2xs">
            <Info className="size-5 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
            <div className="space-y-1">
              <strong className="font-bold text-[#0B1628] dark:text-slate-100">تنبيه جودة البيانات المرجعية: </strong>
              <p className="text-[#64748B] dark:text-slate-300 leading-relaxed">
                {data?.benchmark.message ||
                  `لم يتم تسجيل أسعار كافية للمؤشر (${data?.benchmark.benchmarkSymbol}) في مساحة العمل لهذا النطاق الزمني. تم إيقاف احتساب ألفا وبيتا تلقائيًا التزامًا بالحياد المؤسسي وعدم توليد أرقام تقديرية زائفة.`}
              </p>
            </div>
          </div>
        )}

        {/* Section 2: Capital Growth Waterfall inside Section Surface */}
        <section className="rounded-2xl border border-[#E2E8F0] dark:border-border bg-[#EEF2F6] dark:bg-card/40 p-5 sm:p-6 shadow-2xs space-y-4" aria-labelledby="waterfall-heading">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 id="waterfall-heading" className="flex items-center gap-2 text-base font-bold text-[#0B1628] dark:text-foreground sm:text-lg">
                <Activity className="size-5 text-emerald-600 dark:text-emerald-400" />
                <span>جسر نمو رأس المال (Capital Growth Waterfall)</span>
              </h2>
              <p className="mt-0.5 text-xs text-[#64748B] dark:text-muted-foreground">
                مطابقة محاسبية دقيقة: رأس المال الافتتاحي + الإيداعات - السحوبات + الربح/الخسارة = رأس المال الختامي
              </p>
            </div>
            <Badge variant="outline" className="self-start sm:self-center text-xs text-[#0B1628] dark:text-slate-100 bg-[#ECFDF5] dark:bg-emerald-950/50 border-emerald-500/30 font-semibold px-2.5 py-1">
              <CheckCircle2 className="size-3.5 ml-1 text-emerald-600 dark:text-emerald-400" />
              مطابقة محاسبية معتمدة
            </Badge>
          </div>

          {isLoading ? (
            <Skeleton className="h-24 w-full rounded-xl" />
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6 text-center">
              {/* 1. Start Capital */}
              <div className="rounded-xl bg-[#FFFFFF] dark:bg-card p-3.5 border border-[#E2E8F0] dark:border-border shadow-xs">
                <div className="text-[11px] text-[#64748B] dark:text-muted-foreground font-semibold mb-1.5">رأس المال الافتتاحي</div>
                <div className="font-bold text-sm font-mono text-[#0B1628] dark:text-foreground">
                  <SensitiveValue>{formatMoney(data?.capitalBridge.startingCapital || "0", baseCurrency)}</SensitiveValue>
                </div>
              </div>

              {/* 2. Total Deposits */}
              <div className="rounded-xl bg-[#FFFFFF] dark:bg-card p-3.5 border border-[#E2E8F0] dark:border-border shadow-xs relative overflow-hidden">
                <div className="absolute top-0 inset-x-0 h-1 bg-[#10B981]" />
                <div className="text-[11px] text-[#0B1628] dark:text-slate-100 font-semibold mb-1.5">(+) الإيداعات الرأسمالية</div>
                <div className="font-bold text-sm font-mono text-emerald-700 dark:text-emerald-400">
                  <SensitiveValue>{formatMoney(data?.capitalBridge.totalDeposits || "0", baseCurrency)}</SensitiveValue>
                </div>
              </div>

              {/* 3. Total Withdrawals */}
              <div className="rounded-xl bg-[#FFFBEB]/40 dark:bg-card p-3.5 border border-amber-500/30 dark:border-border shadow-xs relative overflow-hidden">
                <div className="absolute top-0 inset-x-0 h-1 bg-[#F59E0B]" />
                <div className="text-[11px] text-[#0B1628] dark:text-slate-100 font-semibold mb-1.5">(-) السحوبات والتوزيعات</div>
                <div className="font-bold text-sm font-mono text-[#0B1628] dark:text-foreground">
                  <SensitiveValue>{formatMoney(data?.capitalBridge.totalWithdrawals || "0", baseCurrency)}</SensitiveValue>
                </div>
              </div>

              {/* 4. Net Contributions */}
              <div className="rounded-xl bg-[#FFFFFF] dark:bg-card p-3.5 border border-[#E2E8F0] dark:border-border shadow-xs">
                <div className="text-[11px] text-[#64748B] dark:text-muted-foreground font-semibold mb-1.5">(=) صافي التدفق الخارجي</div>
                <div className="font-bold text-sm font-mono text-[#0B1628] dark:text-foreground">
                  <SensitiveValue>{formatMoney(data?.capitalBridge.netContributions || "0", baseCurrency)}</SensitiveValue>
                </div>
              </div>

              {/* 5. Investment Gain / Loss */}
              <div className="rounded-xl bg-[#FFFFFF] dark:bg-card p-3.5 border border-[#E2E8F0] dark:border-border shadow-xs relative overflow-hidden">
                <div className="absolute top-0 inset-x-0 h-1 bg-[#38BDF8]" />
                <div className="text-[11px] text-[#0B1628] dark:text-slate-100 font-semibold mb-1.5">(+/-) أرباح/خسائر الاستثمار</div>
                <div className={`font-bold text-sm font-mono ${getReturnColorClass(data?.capitalBridge.investmentGainLoss)}`}>
                  <SensitiveValue>{formatMoney(data?.capitalBridge.investmentGainLoss || "0", baseCurrency)}</SensitiveValue>
                </div>
              </div>

              {/* 6. Ending Capital */}
              <div className="rounded-xl bg-[#FFFFFF] dark:bg-card p-3.5 border-2 border-emerald-500/40 shadow-xs relative overflow-hidden">
                <div className="absolute top-0 inset-x-0 h-1 bg-[#10B981]" />
                <div className="text-[11px] text-emerald-700 dark:text-emerald-400 font-bold mb-1.5">(=) رأس المال الختامي</div>
                <div className="font-bold text-sm font-mono text-[#0B1628] dark:text-foreground">
                  <SensitiveValue>{formatMoney(data?.capitalBridge.endingCapital || "0", baseCurrency)}</SensitiveValue>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Section 3: Asset Class Performance Attribution inside Section Surface */}
        <section className="rounded-2xl border border-[#E2E8F0] dark:border-border bg-[#EEF2F6] dark:bg-card/40 p-5 sm:p-6 shadow-2xs space-y-4" aria-labelledby="attribution-heading">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 id="attribution-heading" className="flex items-center gap-2 text-base font-bold text-[#0B1628] dark:text-foreground sm:text-lg">
                <Layers className="size-5 text-emerald-600 dark:text-emerald-400" />
                <span>عزو الأداء حسب فئات الأصول (Asset Class Attribution)</span>
              </h2>
              <p className="mt-0.5 text-xs text-[#64748B] dark:text-muted-foreground">
                تحليل مساهمة كل فئة استثمارية في العائد الإجمالي للمحفظة وفق متوسط الأوزان النسبية
              </p>
            </div>
            <Badge variant="outline" className="self-start sm:self-center border-[#E2E8F0] dark:border-border bg-[#FFFFFF] dark:bg-card text-[#0B1628] dark:text-slate-100 font-semibold px-2.5 py-1 text-xs">
              العائد الإجمالي: {formatPercent(data?.attribution.totalReturn)}
            </Badge>
          </div>

          <div className="overflow-hidden rounded-xl border border-[#E2E8F0] dark:border-border bg-[#FFFFFF] dark:bg-card shadow-xs">
            {isLoading ? (
              <Skeleton className="h-36 w-full" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-right border-collapse min-w-[650px]">
                  <thead>
                    <tr className="border-b border-[#E2E8F0] dark:border-border bg-[#F8FAFC] dark:bg-muted/50 text-[11.5px] font-semibold text-[#0B1628] dark:text-foreground">
                      <th className="py-3 px-3.5 font-semibold">فئة الأصل</th>
                      <th className="py-3 px-3.5 font-semibold">القيمة الابتدائية</th>
                      <th className="py-3 px-3.5 font-semibold">القيمة الختامية</th>
                      <th className="py-3 px-3.5 font-semibold">الوزن النسبي المتوسط</th>
                      <th className="py-3 px-3.5 font-semibold">عائد الفئة</th>
                      <th className="py-3 px-3.5 font-semibold">المساهمة في عائد المحفظة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2E8F0] dark:divide-border/60 font-mono bg-[#FFFFFF] dark:bg-card">
                    {data?.attribution.assetClasses.map((ac) => (
                      <tr key={ac.assetClass} className="hover:bg-[#F8FAFC] dark:hover:bg-muted/30 transition-colors">
                        <td className="py-3 px-3.5 font-sans font-semibold text-[#0B1628] dark:text-foreground">
                          {ac.nameAr}
                        </td>
                        <td className="py-3 px-3.5 text-[#64748B] dark:text-muted-foreground">
                          <SensitiveValue>{formatMoney(ac.startValue, baseCurrency)}</SensitiveValue>
                        </td>
                        <td className="py-3 px-3.5 text-[#0B1628] dark:text-foreground font-semibold">
                          <SensitiveValue>{formatMoney(ac.endValue, baseCurrency)}</SensitiveValue>
                        </td>
                        <td className="py-3 px-3.5 text-[#64748B] dark:text-muted-foreground">
                          {(parseFloat(ac.averageWeight) * 100).toFixed(1)}%
                        </td>
                        <td className={`py-3 px-3.5 font-semibold ${getReturnColorClass(ac.assetReturn)}`}>
                          {formatPercent(ac.assetReturn)}
                        </td>
                        <td className={`py-3 px-3.5 font-bold ${getReturnColorClass(ac.contribution)}`}>
                          {formatPercent(ac.contribution)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-[#E2E8F0] dark:border-border font-bold bg-[#F8FAFC] dark:bg-muted/50 text-[#0B1628] dark:text-foreground">
                      <td className="py-3 px-3.5 font-sans">إجمالي مساهمات الفئات</td>
                      <td colSpan={4} className="py-3 px-3.5 font-sans text-left text-[#64748B] dark:text-muted-foreground font-normal">
                        مطابقة المساهمات مع العائد الكلي:
                      </td>
                      <td className={`py-3 px-3.5 font-mono font-bold ${getReturnColorClass(data?.attribution.reconciledSum)}`}>
                        {formatPercent(data?.attribution.reconciledSum)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            {/* Unsupported Dimensions Notice */}
            <div className="flex items-center justify-between text-[11px] text-[#64748B] dark:text-muted-foreground border-t border-[#E2E8F0] dark:border-border bg-[#F8FAFC]/50 dark:bg-muted/20 p-3">
              <span className="flex items-center gap-1.5">
                <Info className="size-3.5 text-[#64748B] shrink-0" />
                أبعاد العزو غير المشمولة لعدم توفر تصنيف قطاعي في الأدوات: عزو القطاعات GICS، تفاعل أسعار الصرف، عزو انتقاء الأسهم.
              </span>
              <span className="font-mono text-[11px]">
                فرق المطابقة: {formatPercent(data?.attribution.reconciliationDiff, 4)}
              </span>
            </div>
          </div>
        </section>

        {/* Section 4: GIPS Sub-Periods Breakdown inside Section Surface */}
        {data && data.twr.subPeriods.length > 1 && (
          <section className="rounded-2xl border border-[#E2E8F0] dark:border-border bg-[#EEF2F6] dark:bg-card/40 p-5 sm:p-6 shadow-2xs space-y-4" aria-labelledby="subperiods-heading">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 id="subperiods-heading" className="flex items-center gap-2 text-base font-bold text-[#0B1628] dark:text-foreground sm:text-lg">
                  <Calendar className="size-5 text-emerald-600 dark:text-emerald-400" />
                  <span>تفاصيل الفترات الجزئية المرجحة زمنياً (GIPS Sub-Periods)</span>
                </h2>
                <p className="mt-0.5 text-xs text-[#64748B] dark:text-muted-foreground">
                  تقسيم الفترات المحاسبية تلقائيًا عند تواريخ التدفقات الرأسمالية الخارجية لتحقيق الحياد المالي التام
                </p>
              </div>
              <Badge variant="outline" className="self-start sm:self-center border-[#E2E8F0] dark:border-border bg-[#FFFFFF] dark:bg-card text-[#0B1628] dark:text-slate-100 font-semibold text-xs px-2.5 py-1">
                {data.twr.subPeriods.length} فترات جزئية
              </Badge>
            </div>

            <div className="overflow-hidden rounded-xl border border-[#E2E8F0] dark:border-border bg-[#FFFFFF] dark:bg-card shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-right border-collapse min-w-[700px]">
                  <thead>
                    <tr className="border-b border-[#E2E8F0] dark:border-border bg-[#F8FAFC] dark:bg-muted/50 text-[11.5px] font-semibold text-[#0B1628] dark:text-foreground">
                      <th className="py-3 px-3.5 font-semibold">الفترة</th>
                      <th className="py-3 px-3.5 font-semibold">بداية الفترة</th>
                      <th className="py-3 px-3.5 font-semibold">قبل التدفق</th>
                      <th className="py-3 px-3.5 font-semibold">التدفق الخارجي</th>
                      <th className="py-3 px-3.5 font-semibold">بعد التدفق</th>
                      <th className="py-3 px-3.5 font-semibold">عائد الفترة الجزئية</th>
                      <th className="py-3 px-3.5 font-semibold">التراكمي المركب</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2E8F0] dark:divide-border/60 font-mono bg-[#FFFFFF] dark:bg-card">
                    {data.twr.subPeriods.map((sp, idx) => (
                      <tr key={idx} className="hover:bg-[#F8FAFC] dark:hover:bg-muted/30 transition-colors">
                        <td className="py-3 px-3.5 font-sans font-semibold text-[#0B1628] dark:text-foreground">
                          الفترة {idx + 1}
                        </td>
                        <td className="py-3 px-3.5 text-[#64748B] dark:text-muted-foreground">
                          <SensitiveValue>{formatMoney(sp.startValuation, baseCurrency)}</SensitiveValue>
                        </td>
                        <td className="py-3 px-3.5 text-[#64748B] dark:text-muted-foreground">
                          <SensitiveValue>{formatMoney(sp.endValuationPreFlow, baseCurrency)}</SensitiveValue>
                        </td>
                        <td className={`py-3 px-3.5 font-semibold ${parseFloat(sp.netCashFlow) > 0 ? "text-emerald-700 dark:text-emerald-400" : parseFloat(sp.netCashFlow) < 0 ? "text-amber-700 dark:text-amber-400" : "text-[#64748B] dark:text-muted-foreground"}`}>
                          <SensitiveValue>{formatMoney(sp.netCashFlow, baseCurrency)}</SensitiveValue>
                        </td>
                        <td className="py-3 px-3.5 text-[#0B1628] dark:text-foreground font-semibold">
                          <SensitiveValue>{formatMoney(sp.endValuationPostFlow, baseCurrency)}</SensitiveValue>
                        </td>
                        <td className={`py-3 px-3.5 font-bold ${getReturnColorClass(sp.subPeriodReturn)}`}>
                          {formatPercent(sp.subPeriodReturn)}
                        </td>
                        <td className={`py-3 px-3.5 font-bold ${getReturnColorClass(sp.cumulatedTwr)}`}>
                          {formatPercent(sp.cumulatedTwr)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}
      </div>
    </DashboardLayout>
  );
}
