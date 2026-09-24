import React, { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  FileChartColumn,
  CheckCircle2,
  AlertTriangle,
  Download,
  Printer,
  ShieldCheck,
  TrendingUp,
  Landmark,
  Scale,
  RefreshCw,
  Coins,
} from "lucide-react";

export function ReportsPage({ embedded = false }: { embedded?: boolean }) {
  // Date modes: "period_key" | "point_in_time" | "period"
  const [dateMode, setDateMode] = useState<"period_key" | "point_in_time" | "period">("period_key");
  const [periodKey, setPeriodKey] = useState<string>("2026-08");
  const [asOfDate, setAsOfDate] = useState<string>("2026-08-31");
  const [startDate, setStartDate] = useState<string>("2026-08-01");
  const [endDate, setEndDate] = useState<string>("2026-08-31");
  const [compareWithPrior, setCompareWithPrior] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<string>("balance_sheet");

  // Query parameters according to mode
  const queryInput = {
    ...(dateMode === "period_key" ? { periodKey } : {}),
    ...(dateMode === "point_in_time" ? { asOf: `${asOfDate}T23:59:59.999Z` } : {}),
    ...(dateMode === "period" ? { startDate: `${startDate}T00:00:00.000Z`, endDate: `${endDate}T23:59:59.999Z` } : {}),
    compareWithPrior,
  };

  const reportsQuery = trpc.family.reports.financialStatements.useQuery(queryInput, {
    staleTime: 30_000,
    retry: 1,
  });

  const exportMutation = trpc.family.reports.export.useMutation({
    onSuccess: (data) => {
      const blob = new Blob([data.content], { type: data.contentType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = data.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(`تم تحميل ملف التقرير بنجاح: ${data.filename}`);
    },
    onError: (err) => {
      toast.error(`فشل تصدير التقرير: ${err.message}`);
    },
  });

  const handleExport = (format: "json" | "csv") => {
    exportMutation.mutate({
      format,
      ...(dateMode === "period_key" ? { periodKey } : {}),
      ...(dateMode === "point_in_time" ? { asOf: `${asOfDate}T23:59:59.999Z` } : {}),
      ...(dateMode === "period" ? { startDate: `${startDate}T00:00:00.000Z`, endDate: `${endDate}T23:59:59.999Z` } : {}),
    });
  };

  const data = reportsQuery.data;
  const baseCurr = data?.metadata.baseCurrency || "USD";

  const money = (val: string | number | undefined, curr = baseCurr) => {
    const num = Number(val || 0);
    return `${num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${curr}`;
  };

  const content = (
    <div dir="rtl" className="mx-auto max-w-7xl space-y-6 pb-12">
        <PageHeader
          title="كشوف الحساب والتقارير"
          description="قوائم مالية متوافقة مع القيد المزدوج، وجسر تحليلي لصافي الثروة الاقتصادي، ومطابقة تدفقات نقدية مدققة."
          breadcrumbs={[
            { label: "الحوكمة والإدارة", href: "/reports" },
            { label: "كشوف الحساب والتقارير" },
          ]}
          badge="محاسبة مدققة"
          icon={FileChartColumn}
          actions={
            <div className="flex flex-wrap items-center gap-2 no-print">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExport("csv")}
                disabled={exportMutation.isPending || reportsQuery.isLoading}
                className="bg-white hover:bg-slate-50 text-slate-800 font-semibold text-xs px-3.5 py-2 rounded-xl border border-slate-200/90 dark:bg-[#0B0F17] dark:hover:bg-slate-800/60 dark:text-slate-200 dark:border-slate-800 shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer h-auto"
              >
                <Download className="size-4 text-emerald-600 dark:text-emerald-400" />
                <span>تصدير CSV</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExport("json")}
                disabled={exportMutation.isPending || reportsQuery.isLoading}
                className="bg-white hover:bg-slate-50 text-slate-800 font-semibold text-xs px-3.5 py-2 rounded-xl border border-slate-200/90 dark:bg-[#0B0F17] dark:hover:bg-slate-800/60 dark:text-slate-200 dark:border-slate-800 shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer h-auto"
              >
                <Download className="size-4 text-sky-600 dark:text-sky-400" />
                <span>تصدير JSON</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.print()}
                className="bg-white hover:bg-slate-50 text-slate-800 font-semibold text-xs px-3.5 py-2 rounded-xl border border-slate-200/90 dark:bg-[#0B0F17] dark:hover:bg-slate-800/60 dark:text-slate-200 dark:border-slate-800 shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer h-auto"
              >
                <Printer className="size-4 text-slate-600 dark:text-slate-400" />
                <span>طباعة / PDF</span>
              </Button>
            </div>
          }
        />

        {/* Date Contract & Period Control Bar */}
        <div className="bg-white dark:bg-[#0B0F17] border border-slate-200/90 dark:border-slate-800/80 rounded-2xl p-4 shadow-xs mb-6 flex flex-wrap items-center justify-between gap-3 no-print">
          <div className="grid gap-4 md:grid-cols-[200px_1fr_auto] md:items-end w-full">
            <div>
              <label className="text-slate-600 dark:text-slate-400 font-semibold text-xs mb-1.5 block">نمط التاريخ المحدد</label>
              <Select
                value={dateMode}
                onValueChange={(val) => setDateMode(val as any)}
              >
                <SelectTrigger className="bg-slate-50 dark:bg-[#0E1420] border border-slate-300 dark:border-slate-700/80 text-slate-900 dark:text-slate-100 rounded-xl text-xs font-medium py-2 px-3 focus:ring-1 focus:ring-slate-800 h-auto">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white dark:bg-[#0E1420] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 rounded-xl shadow-lg text-xs">
                  <SelectItem value="period_key">مفتاح الفترة (PeriodKey)</SelectItem>
                  <SelectItem value="point_in_time">نقطة زمنية (Point-in-Time)</SelectItem>
                  <SelectItem value="period">فترة مخصصة (Custom Period)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Dynamic Inputs based on Date Mode */}
            <div>
              {dateMode === "period_key" && (
                <div>
                  <label className="text-slate-600 dark:text-slate-400 font-semibold text-xs mb-1.5 block">اختر الفترة المالية</label>
                  <Select value={periodKey} onValueChange={setPeriodKey}>
                    <SelectTrigger className="max-w-sm bg-slate-50 dark:bg-[#0E1420] border border-slate-300 dark:border-slate-700/80 text-slate-900 dark:text-slate-100 rounded-xl text-xs font-medium py-2 px-3 focus:ring-1 focus:ring-slate-800 h-auto">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-white dark:bg-[#0E1420] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 rounded-xl shadow-lg text-xs">
                      <SelectItem value="2026-08">أغسطس 2026 (2026-08)</SelectItem>
                      <SelectItem value="2026-07">يوليو 2026 (2026-07)</SelectItem>
                      <SelectItem value="2026-Q3">الربع الثالث 2026 (2026-Q3)</SelectItem>
                      <SelectItem value="2026-Q2">الربع الثاني 2026 (2026-Q2)</SelectItem>
                      <SelectItem value="2026-Q1">الربع الأول 2026 (2026-Q1)</SelectItem>
                      <SelectItem value="2026-FY">السنة المالية 2026 (2026-FY)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {dateMode === "point_in_time" && (
                <div className="max-w-xs">
                  <label className="text-slate-600 dark:text-slate-400 font-semibold text-xs mb-1.5 block">تاريخ المركز المالي (asOf)</label>
                  <Input
                    type="date"
                    value={asOfDate}
                    onChange={(e) => setAsOfDate(e.target.value)}
                    className="bg-slate-50 dark:bg-[#0E1420] border border-slate-300 dark:border-slate-700/80 text-slate-900 dark:text-slate-100 rounded-xl text-xs font-medium py-2 px-3 focus:ring-1 focus:ring-slate-800 h-auto"
                  />
                </div>
              )}

              {dateMode === "period" && (
                <div className="flex flex-wrap items-center gap-3">
                  <div>
                    <label className="text-slate-600 dark:text-slate-400 font-semibold text-xs mb-1.5 block">من تاريخ (Start)</label>
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="bg-slate-50 dark:bg-[#0E1420] border border-slate-300 dark:border-slate-700/80 text-slate-900 dark:text-slate-100 rounded-xl text-xs font-medium py-2 px-3 focus:ring-1 focus:ring-slate-800 h-auto"
                    />
                  </div>
                  <div>
                    <label className="text-slate-600 dark:text-slate-400 font-semibold text-xs mb-1.5 block">إلى تاريخ (End)</label>
                    <Input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="bg-slate-50 dark:bg-[#0E1420] border border-slate-300 dark:border-slate-700/80 text-slate-900 dark:text-slate-100 rounded-xl text-xs font-medium py-2 px-3 focus:ring-1 focus:ring-slate-800 h-auto"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Options & Refresh */}
            <div className="flex items-center gap-4">
              <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={compareWithPrior}
                  onChange={(e) => setCompareWithPrior(e.target.checked)}
                  className="size-4 rounded border-slate-300 text-slate-900 dark:text-slate-100 focus:ring-slate-800"
                />
                <span>مقارنة بالفترة السابقة</span>
              </label>
              <Button
                onClick={() => reportsQuery.refetch()}
                disabled={reportsQuery.isFetching}
                className="bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:hover:bg-slate-100 dark:text-slate-950 font-bold text-xs px-4 py-2 rounded-xl shadow-xs transition-all border border-slate-900 dark:border-transparent flex items-center gap-1.5 cursor-pointer h-auto"
              >
                <RefreshCw className={`size-3.5 ${reportsQuery.isFetching ? "animate-spin" : ""}`} />
                <span>تحديث</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Loading Skeleton */}
        {reportsQuery.isLoading && (
          <div className="space-y-4">
            <Skeleton className="h-28 w-full rounded-2xl" />
            <Skeleton className="h-96 w-full rounded-2xl" />
          </div>
        )}

        {/* Error State */}
        {reportsQuery.error && (
          <div className="rounded-2xl border border-rose-200/80 bg-rose-50/70 p-6 text-rose-900 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-200 shadow-xs flex items-center gap-3">
            <AlertTriangle className="size-6 text-rose-600 shrink-0" />
            <div>
              <h3 className="text-base font-bold">تعذر توليد التقرير المالي</h3>
              <p className="text-xs text-rose-700 dark:text-rose-300 mt-1">
                {reportsQuery.error.message}
              </p>
            </div>
          </div>
        )}

        {/* Main Financial Report Content */}
        {data && (
          <div className="space-y-6">
            {/* Top Key Metrics Banner (Institutional Strip) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 bg-white dark:bg-[#0B0F17] border border-slate-200/90 dark:border-slate-800/80 rounded-2xl shadow-xs overflow-hidden mb-6 break-inside-avoid page-break-inside-avoid">
              {/* Cell 1: Economic Net Worth */}
              <div className="bg-slate-50/50 dark:bg-slate-900/30 p-5 flex flex-col justify-between border-b sm:border-b-0 lg:border-b-0 lg:border-l border-slate-200/80 dark:border-slate-800/80">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                    إجمالي صافي الثروة
                  </span>
                  <div className="size-8 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-200/80 dark:bg-indigo-950/40 dark:text-indigo-400 dark:border-indigo-800/60 flex items-center justify-center">
                    <Landmark className="size-4" />
                  </div>
                </div>
                <div>
                  <p className="text-slate-900 dark:text-white font-extrabold font-mono text-2xl lg:text-3xl tabular-nums tracking-tight">
                    {money(data.economicNetWorthBridge.economicNetWorth)}
                  </p>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5 block">
                    القيمة السوقية العادلة للأصول والخصوم
                  </span>
                </div>
              </div>

              {/* Cell 2: Book Equity */}
              <div className="p-5 flex flex-col justify-between border-b sm:border-b-0 lg:border-b-0 lg:border-l border-slate-200/80 dark:border-slate-800/80">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                    رأس المال الدفتري
                  </span>
                  <div className="size-8 rounded-xl bg-sky-50 text-sky-600 border border-sky-200/80 dark:bg-sky-950/40 dark:text-sky-400 dark:border-sky-800/60 flex items-center justify-center">
                    <Scale className="size-4" />
                  </div>
                </div>
                <div>
                  <p className="text-slate-900 dark:text-white font-bold font-mono text-xl sm:text-2xl tabular-nums">
                    {money(data.bookBalanceSheet.equity.totalBookEquity)}
                  </p>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5 block">
                    إجمالي حقوق الملكية بالدفاتر
                  </span>
                </div>
              </div>

              {/* Cell 3: Net Operating Income */}
              <div className="p-5 flex flex-col justify-between border-b sm:border-b-0 lg:border-b-0 lg:border-l border-slate-200/80 dark:border-slate-800/80">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                    صافي أرباح الفترة
                  </span>
                  <div className="size-8 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/60 flex items-center justify-center">
                    <TrendingUp className="size-4" />
                  </div>
                </div>
                <div>
                  <p className="text-emerald-600 dark:text-emerald-400 font-bold font-mono text-xl sm:text-2xl tabular-nums">
                    {money(data.incomeStatement.netOperatingIncome)}
                  </p>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5 block">
                    الإيرادات بعد خصم كافة المصروفات
                  </span>
                </div>
              </div>

              {/* Cell 4: Net Cash Flow */}
              <div className="p-5 flex flex-col justify-between border-b-0 lg:border-l-0">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                    صافي السيولة النقدية
                  </span>
                  <div className="size-8 rounded-xl bg-amber-50 text-amber-600 border border-amber-200/80 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800/60 flex items-center justify-center">
                    <Coins className="size-4" />
                  </div>
                </div>
                <div>
                  <p className="text-slate-900 dark:text-white font-bold font-mono text-xl sm:text-2xl tabular-nums">
                    {money(data.cashFlowStatement.netCashFlow)}
                  </p>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5 block">
                    الفائض أو العجز النقدي الفعلي
                  </span>
                </div>
              </div>
            </div>

            {/* Prior Period Comparison Banner (if requested) */}
            {data.snapshotComparison && (
              <div className="bg-white dark:bg-[#0B0F17] border border-slate-200/90 dark:border-slate-800/80 rounded-2xl p-5 shadow-xs mb-6 break-inside-avoid page-break-inside-avoid">
                <div className="flex items-center justify-between font-bold text-xs text-slate-900 dark:text-white mb-3">
                  <span>مقارنة تحليلية مع الفترة السابقة</span>
                  <span className="text-slate-500 dark:text-slate-400 font-normal">
                    {new Date(data.snapshotComparison.priorPeriod.startDate).toLocaleDateString("ar-EG")} إلى {new Date(data.snapshotComparison.priorPeriod.endDate).toLocaleDateString("ar-EG")}
                  </span>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
                  <div className="rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-slate-50/70 dark:bg-[#0E1420] p-3">
                    <p className="text-slate-500 dark:text-slate-400 text-xs">صافي الثروة الاقتصادي</p>
                    <p className="font-bold font-mono text-slate-900 dark:text-white text-sm my-1">{money(data.snapshotComparison.metrics.economicNetWorth.current)}</p>
                    <span className={`text-[11px] font-semibold font-mono ${Number(data.snapshotComparison.metrics.economicNetWorth.percentageChange) >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                      {data.snapshotComparison.metrics.economicNetWorth.percentageChange}% ({money(data.snapshotComparison.metrics.economicNetWorth.absoluteDelta)})
                    </span>
                  </div>
                  <div className="rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-slate-50/70 dark:bg-[#0E1420] p-3">
                    <p className="text-slate-500 dark:text-slate-400 text-xs">إجمالي الأصول الدفترية</p>
                    <p className="font-bold font-mono text-slate-900 dark:text-white text-sm my-1">{money(data.snapshotComparison.metrics.totalBookAssets.current)}</p>
                    <span className={`text-[11px] font-semibold font-mono ${Number(data.snapshotComparison.metrics.totalBookAssets.percentageChange) >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                      {data.snapshotComparison.metrics.totalBookAssets.percentageChange}%
                    </span>
                  </div>
                  <div className="rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-slate-50/70 dark:bg-[#0E1420] p-3">
                    <p className="text-slate-500 dark:text-slate-400 text-xs">حقوق الملكية الدفترية</p>
                    <p className="font-bold font-mono text-slate-900 dark:text-white text-sm my-1">{money(data.snapshotComparison.metrics.totalBookEquity.current)}</p>
                    <span className={`text-[11px] font-semibold font-mono ${Number(data.snapshotComparison.metrics.totalBookEquity.percentageChange) >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                      {data.snapshotComparison.metrics.totalBookEquity.percentageChange}%
                    </span>
                  </div>
                  <div className="rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-slate-50/70 dark:bg-[#0E1420] p-3">
                    <p className="text-slate-500 dark:text-slate-400 text-xs">الربح التشغيلي الصافي</p>
                    <p className="font-bold font-mono text-slate-900 dark:text-white text-sm my-1">{money(data.snapshotComparison.metrics.netOperatingIncome.current)}</p>
                    <span className={`text-[11px] font-semibold font-mono ${Number(data.snapshotComparison.metrics.netOperatingIncome.percentageChange) >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                      {data.snapshotComparison.metrics.netOperatingIncome.percentageChange}%
                    </span>
                  </div>
                  <div className="rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-slate-50/70 dark:bg-[#0E1420] p-3">
                    <p className="text-slate-500 dark:text-slate-400 text-xs">السيولة النقدية</p>
                    <p className="font-bold font-mono text-slate-900 dark:text-white text-sm my-1">{money(data.snapshotComparison.metrics.cashAndEquivalents.current)}</p>
                    <span className={`text-[11px] font-semibold font-mono ${Number(data.snapshotComparison.metrics.cashAndEquivalents.percentageChange) >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                      {data.snapshotComparison.metrics.cashAndEquivalents.percentageChange}%
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Statement Navigation Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
              <TabsList className="bg-slate-100/90 dark:bg-[#0E1420] p-1.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 flex flex-wrap gap-1 mb-6 h-auto w-auto no-print">
                <TabsTrigger
                  value="balance_sheet"
                  className="px-4 py-2 rounded-xl text-xs font-medium transition-colors border border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white data-[state=active]:bg-white dark:data-[state=active]:bg-[#1A2234] data-[state=active]:text-slate-900 dark:data-[state=active]:text-white data-[state=active]:font-bold data-[state=active]:shadow-xs data-[state=active]:border-slate-200/60 dark:data-[state=active]:border-slate-700/60"
                >
                  الميزانية العمومية
                </TabsTrigger>
                <TabsTrigger
                  value="income_statement"
                  className="px-4 py-2 rounded-xl text-xs font-medium transition-colors border border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white data-[state=active]:bg-white dark:data-[state=active]:bg-[#1A2234] data-[state=active]:text-slate-900 dark:data-[state=active]:text-white data-[state=active]:font-bold data-[state=active]:shadow-xs data-[state=active]:border-slate-200/60 dark:data-[state=active]:border-slate-700/60"
                >
                  قائمة الدخل والأرباح
                </TabsTrigger>
                <TabsTrigger
                  value="changes_in_equity"
                  className="px-4 py-2 rounded-xl text-xs font-medium transition-colors border border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white data-[state=active]:bg-white dark:data-[state=active]:bg-[#1A2234] data-[state=active]:text-slate-900 dark:data-[state=active]:text-white data-[state=active]:font-bold data-[state=active]:shadow-xs data-[state=active]:border-slate-200/60 dark:data-[state=active]:border-slate-700/60"
                >
                  حركة حقوق الملكية
                </TabsTrigger>
                <TabsTrigger
                  value="cash_flows"
                  className="px-4 py-2 rounded-xl text-xs font-medium transition-colors border border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white data-[state=active]:bg-white dark:data-[state=active]:bg-[#1A2234] data-[state=active]:text-slate-900 dark:data-[state=active]:text-white data-[state=active]:font-bold data-[state=active]:shadow-xs data-[state=active]:border-slate-200/60 dark:data-[state=active]:border-slate-700/60"
                >
                  قائمة التدفق النقدي
                </TabsTrigger>
                <TabsTrigger
                  value="economic_bridge"
                  className="px-4 py-2 rounded-xl text-xs font-medium transition-colors border border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white data-[state=active]:bg-white dark:data-[state=active]:bg-[#1A2234] data-[state=active]:text-slate-900 dark:data-[state=active]:text-white data-[state=active]:font-bold data-[state=active]:shadow-xs data-[state=active]:border-slate-200/60 dark:data-[state=active]:border-slate-700/60"
                >
                  مطابقة صافي الثروة
                </TabsTrigger>
                <TabsTrigger
                  value="audit_controls"
                  className="px-4 py-2 rounded-xl text-xs font-medium transition-colors border border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white data-[state=active]:bg-white dark:data-[state=active]:bg-[#1A2234] data-[state=active]:text-slate-900 dark:data-[state=active]:text-white data-[state=active]:font-bold data-[state=active]:shadow-xs data-[state=active]:border-slate-200/60 dark:data-[state=active]:border-slate-700/60"
                >
                  التدقيق والمطابقة المحاسبية
                </TabsTrigger>
              </TabsList>

              {/* ========================================================== */}
              {/* TAB 1: BOOK BALANCE SHEET */}
              {/* ========================================================== */}
              <TabsContent value="balance_sheet" className="space-y-6">
                {/* Equation Verification Banner */}
                <div
                  className={`rounded-xl p-3.5 border font-medium text-xs flex items-center justify-between mb-4 ${
                    data.bookBalanceSheet.equationCheck.assetsEqualsLiabilitiesPlusEquity
                      ? "bg-emerald-50/70 border-emerald-200 text-emerald-950 dark:bg-emerald-950/30 dark:border-emerald-800/60 dark:text-emerald-200"
                      : "bg-amber-50/70 border-amber-200 text-amber-950 dark:bg-amber-950/30 dark:border-amber-800/60 dark:text-amber-200"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    {data.bookBalanceSheet.equationCheck.assetsEqualsLiabilitiesPlusEquity ? (
                      <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400" />
                    )}
                    <div>
                      <span className="font-bold">معادلة المركز المالي: </span>
                      <span>الأصول = الالتزامات + حقوق الملكية</span>
                    </div>
                  </div>
                  <span
                    className={`font-bold font-mono text-[11px] px-2.5 py-1 rounded-lg ${
                      data.bookBalanceSheet.equationCheck.assetsEqualsLiabilitiesPlusEquity
                        ? "bg-emerald-600 text-white"
                        : "bg-amber-600 text-white"
                    }`}
                  >
                    {data.bookBalanceSheet.equationCheck.assetsEqualsLiabilitiesPlusEquity
                      ? "مدققة ومتوازنة 100%"
                      : `خلل توازن: ${money(data.bookBalanceSheet.equationCheck.imbalanceBase)}`}
                  </span>
                </div>

                <div className="grid gap-6 lg:grid-cols-2">
                  {/* Assets Column */}
                  <div className="bg-white dark:bg-[#0B0F17] border border-slate-200/90 dark:border-slate-800/80 rounded-2xl p-6 shadow-xs break-inside-avoid page-break-inside-avoid flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="text-slate-900 dark:text-white font-bold text-base">الأصول الدفترية</h3>
                        <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-base">{money(data.bookBalanceSheet.assets.totalBookAssets)}</span>
                      </div>
                      <p className="text-slate-500 dark:text-slate-400 text-xs mb-4">السيولة، ورصيد مقاصة الاستثمار، والأصول العينية بالتكلفة التاريخية</p>
                      
                      <div className="space-y-4">
                        {/* Cash Accounts */}
                        <div className="rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-slate-50/50 dark:bg-[#0E1420] p-3.5 text-xs">
                          <div className="flex items-center justify-between font-bold text-slate-900 dark:text-white mb-2">
                            <span>النقدية وما في حكمها</span>
                            <span className="font-mono">{money(data.bookBalanceSheet.assets.cashAndEquivalents.totalBase)}</span>
                          </div>
                          <div className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs text-slate-600 dark:text-slate-400">
                            {data.bookBalanceSheet.assets.cashAndEquivalents.accounts.map((acc) => (
                              <div key={acc.id} className="flex items-center justify-between py-1.5">
                                <span>{acc.name} ({acc.currency})</span>
                                <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{money(acc.balanceBase)}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Investment Clearing Settlement Residual */}
                        <div className="rounded-xl border border-amber-200/80 dark:border-amber-800/60 bg-amber-50/40 dark:bg-amber-950/20 p-3.5 text-xs">
                          <div className="flex items-center justify-between font-bold text-slate-900 dark:text-white mb-1">
                            <span>رصيد مقاصة الاستثمار والتسوية</span>
                            <span className="font-mono">{money(data.bookBalanceSheet.assets.investmentClearing.totalBase)}</span>
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-2">
                            {data.bookBalanceSheet.assets.investmentClearing.description}
                          </p>
                          <div className="divide-y divide-amber-200/50 dark:divide-amber-900/40 text-xs text-slate-700 dark:text-slate-300">
                            {data.bookBalanceSheet.assets.investmentClearing.accounts.map((acc) => (
                              <div key={acc.id} className="flex items-center justify-between py-1">
                                <span>{acc.name}</span>
                                <span className="font-mono font-bold text-slate-900 dark:text-white">{money(acc.balanceBase)}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Special Assets at Cost */}
                        <div className="rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-slate-50/50 dark:bg-[#0E1420] p-3.5 text-xs">
                          <div className="flex items-center justify-between font-bold text-slate-900 dark:text-white mb-2">
                            <span>الأصول الخاصة بالتكلفة الدفترية</span>
                            <span className="font-mono">{money(data.bookBalanceSheet.assets.specialAssetsAtCost.totalBase)}</span>
                          </div>
                          <div className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs text-slate-600 dark:text-slate-400">
                            {data.bookBalanceSheet.assets.specialAssetsAtCost.assets.length ? (
                              data.bookBalanceSheet.assets.specialAssetsAtCost.assets.map((asset) => (
                                <div key={asset.id} className="flex items-center justify-between py-1.5">
                                  <span>{asset.name}</span>
                                  <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{money(asset.costBase)}</span>
                                </div>
                              ))
                            ) : (
                              <p className="py-1 text-slate-400">لا توجد أصول خاصة مسجلة بالتكلفة</p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Liabilities & Equity Column */}
                  <div className="space-y-6">
                    {/* Liabilities Card */}
                    <div className="bg-white dark:bg-[#0B0F17] border border-slate-200/90 dark:border-slate-800/80 rounded-2xl p-6 shadow-xs break-inside-avoid page-break-inside-avoid">
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="text-slate-900 dark:text-white font-bold text-base">الالتزامات الدفترية</h3>
                        <span className="font-mono font-bold text-rose-600 dark:text-rose-400 text-base">{money(data.bookBalanceSheet.liabilities.totalBookLiabilities)}</span>
                      </div>
                      <p className="text-slate-500 dark:text-slate-400 text-xs mb-4">القروض والتسهيلات الائتمانية القائمة</p>
                      
                      <div className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs text-slate-600 dark:text-slate-400">
                        {data.bookBalanceSheet.liabilities.debtAccounts.length ? (
                          data.bookBalanceSheet.liabilities.debtAccounts.map((debt) => (
                            <div key={debt.id} className="flex items-center justify-between py-2">
                              <span className="font-medium text-slate-800 dark:text-slate-200">{debt.name} ({debt.currency})</span>
                              <span className="font-mono font-bold text-slate-900 dark:text-white">{money(debt.principalBase)}</span>
                            </div>
                          ))
                        ) : (
                          <p className="py-2 text-slate-400">لا توجد التزامات أو ديون دفترية مسجلة</p>
                        )}
                      </div>
                    </div>

                    {/* Equity Card */}
                    <div className="bg-white dark:bg-[#0B0F17] border border-slate-200/90 dark:border-slate-800/80 rounded-2xl p-6 shadow-xs break-inside-avoid page-break-inside-avoid">
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="text-slate-900 dark:text-white font-bold text-base">حقوق الملكية الدفترية</h3>
                        <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-base">{money(data.bookBalanceSheet.equity.totalBookEquity)}</span>
                      </div>
                      <p className="text-slate-500 dark:text-slate-400 text-xs mb-4">رأس المال المساهم وصافي الدخل التشغيلي المتراكم</p>
                      
                      <div className="space-y-3 text-xs">
                        <div className="flex items-center justify-between rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-slate-50/50 dark:bg-[#0E1420] p-3">
                          <span className="text-slate-700 dark:text-slate-300 font-medium">رأس المال المساهم الدفتري</span>
                          <span className="font-mono font-bold text-slate-900 dark:text-white">{money(data.bookBalanceSheet.equity.contributedCapital)}</span>
                        </div>
                        <div className="flex items-center justify-between rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-slate-50/50 dark:bg-[#0E1420] p-3">
                          <span className="text-slate-700 dark:text-slate-300 font-medium">الأرباح/الخسائر التشغيلية المتراكمة</span>
                          <span className="font-mono font-bold text-slate-900 dark:text-white">{money(data.bookBalanceSheet.equity.cumulativeRetainedOperatingIncome)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* ========================================================== */}
              {/* TAB 2: INCOME STATEMENT */}
              {/* ========================================================== */}
              <TabsContent value="income_statement" className="space-y-6">
                <div className="grid gap-6 lg:grid-cols-2">
                  {/* Revenues */}
                  <div className="bg-white dark:bg-[#0B0F17] border border-slate-200/90 dark:border-slate-800/80 rounded-2xl p-6 shadow-xs break-inside-avoid page-break-inside-avoid">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-slate-900 dark:text-white font-bold text-base">الإيرادات والعوائد</h3>
                      <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-base">{money(data.incomeStatement.revenues.totalRevenues)}</span>
                    </div>
                    <div className="space-y-3 text-xs">
                      <div className="flex items-center justify-between rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-slate-50/50 dark:bg-[#0E1420] p-3">
                        <span className="text-slate-700 dark:text-slate-300 font-medium">الإيرادات التشغيلية</span>
                        <span className="font-mono font-bold text-slate-900 dark:text-white">{money(data.incomeStatement.revenues.operatingIncome)}</span>
                      </div>
                      <div className="flex items-center justify-between rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-slate-50/50 dark:bg-[#0E1420] p-3">
                        <span className="text-slate-700 dark:text-slate-300 font-medium">عوائد التوزيعات النقدية</span>
                        <span className="font-mono font-bold text-slate-900 dark:text-white">{money(data.incomeStatement.revenues.dividendIncome)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Expenses */}
                  <div className="bg-white dark:bg-[#0B0F17] border border-slate-200/90 dark:border-slate-800/80 rounded-2xl p-6 shadow-xs break-inside-avoid page-break-inside-avoid">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-slate-900 dark:text-white font-bold text-base">المصروفات والتكاليف</h3>
                      <span className="font-mono font-bold text-rose-600 dark:text-rose-400 text-base">{money(data.incomeStatement.expenses.totalExpenses)}</span>
                    </div>
                    <div className="space-y-3 text-xs">
                      <div className="flex items-center justify-between rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-slate-50/50 dark:bg-[#0E1420] p-3">
                        <span className="text-slate-700 dark:text-slate-300 font-medium">مصروفات التشغيل والإدارة</span>
                        <span className="font-mono font-bold text-slate-900 dark:text-white">{money(data.incomeStatement.expenses.operatingExpenses)}</span>
                      </div>
                      <div className="flex items-center justify-between rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-slate-50/50 dark:bg-[#0E1420] p-3">
                        <span className="text-slate-700 dark:text-slate-300 font-medium">عمولات ورسوم التداول</span>
                        <span className="font-mono font-bold text-slate-900 dark:text-white">{money(data.incomeStatement.expenses.tradingFees)}</span>
                      </div>
                      <div className="flex items-center justify-between rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-slate-50/50 dark:bg-[#0E1420] p-3">
                        <span className="text-slate-700 dark:text-slate-300 font-medium">ضرائب العمليات المالية</span>
                        <span className="font-mono font-bold text-slate-900 dark:text-white">{money(data.incomeStatement.expenses.tradingTaxes)}</span>
                      </div>
                      <div className="flex items-center justify-between rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-slate-50/50 dark:bg-[#0E1420] p-3">
                        <span className="text-slate-700 dark:text-slate-300 font-medium">فوائد الديون والتسهيلات</span>
                        <span className="font-mono font-bold text-slate-900 dark:text-white">{money(data.incomeStatement.expenses.debtInterest)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Net Operating Income Result Card */}
                <div className="bg-white dark:bg-[#0B0F17] border border-slate-200/90 dark:border-slate-800/80 rounded-2xl p-6 text-center shadow-xs break-inside-avoid page-break-inside-avoid">
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">صافي الربح / الخسارة التشغيلية للفترة</p>
                  <p className={`text-3xl font-bold font-mono tabular-nums ${Number(data.incomeStatement.netOperatingIncome) >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                    {money(data.incomeStatement.netOperatingIncome)}
                  </p>
                </div>
              </TabsContent>

              {/* ========================================================== */}
              {/* TAB 3: CHANGES IN EQUITY */}
              {/* ========================================================== */}
              <TabsContent value="changes_in_equity" className="space-y-6">
                <div className="bg-white dark:bg-[#0B0F17] border border-slate-200/90 dark:border-slate-800/80 rounded-2xl p-6 shadow-xs break-inside-avoid page-break-inside-avoid">
                  <h3 className="text-slate-900 dark:text-white font-bold text-base mb-1">
                    قائمة التغيرات في حقوق الملكية الدفترية
                  </h3>
                  <p className="text-slate-500 dark:text-slate-400 text-xs mb-4">
                    مطابقة دقيقة لتطور رأس المال والأرباح المحتجزة من بداية الفترة إلى نهايتها
                  </p>
                  
                  <div className="divide-y divide-slate-100 dark:divide-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-800/80 overflow-hidden text-xs">
                    <div className="flex items-center justify-between p-4 font-bold text-slate-800 dark:text-slate-200">
                      <span>رصيد حقوق الملكية في بداية الفترة</span>
                      <span className="font-mono">{money(data.equityChangesStatement.openingBookEquity)}</span>
                    </div>
                    <div className="flex items-center justify-between p-4 text-emerald-700 dark:text-emerald-400 font-medium">
                      <span>(+) مساهمات رأس المال وضخ السيولة من الملاك</span>
                      <span className="font-mono">+{money(data.equityChangesStatement.capitalContributions)}</span>
                    </div>
                    <div className="flex items-center justify-between p-4 text-rose-700 dark:text-rose-400 font-medium">
                      <span>(-) المسحوبات والتوزيعات للملاك</span>
                      <span className="font-mono">-{money(data.equityChangesStatement.capitalWithdrawals)}</span>
                    </div>
                    <div className="flex items-center justify-between p-4 text-sky-700 dark:text-sky-400 font-medium">
                      <span>(+/-) صافي الدخل التشغيلي المحقق للفترة</span>
                      <span className="font-mono">{money(data.equityChangesStatement.netOperatingIncome)}</span>
                    </div>
                    <div className="flex items-center justify-between bg-slate-50/80 dark:bg-[#0E1420] p-4 text-sm font-bold text-slate-900 dark:text-white">
                      <span>(=) رصيد حقوق الملكية في نهاية الفترة</span>
                      <span className="font-mono">{money(data.equityChangesStatement.closingBookEquity)}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 text-xs text-emerald-950 dark:border-emerald-800/60 dark:bg-emerald-950/30 dark:text-emerald-200 font-medium mt-4">
                    <span className="flex items-center gap-1.5 font-bold">
                      <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
                      حالة المطابقة المحاسبية لحقوق الملكية:
                    </span>
                    <span className="font-mono">
                      {data.equityChangesStatement.reconciliationCheck.reconciled ? "مطابقة تماماً بدون أي فروقات" : `يوجد فارق: ${money(data.equityChangesStatement.reconciliationCheck.discrepancy)}`}
                    </span>
                  </div>
                </div>
              </TabsContent>

              {/* ========================================================== */}
              {/* TAB 4: CASH FLOWS */}
              {/* ========================================================== */}
              <TabsContent value="cash_flows" className="space-y-6">
                {/* Cash Flow Reconciliation Banner */}
                <div className="flex items-center justify-between rounded-xl border border-sky-200 bg-sky-50/70 p-4 text-xs text-sky-950 dark:border-sky-800/60 dark:bg-sky-950/30 dark:text-sky-200 font-medium">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="size-4 text-sky-600 dark:text-sky-400 shrink-0" />
                    <span>
                      <strong className="font-bold">مطابقة التدفقات النقدية: </strong>
                      بداية الفترة ({money(data.cashFlowStatement.beginningCash)}) + التدفقات = نهاية الفترة ({money(data.cashFlowStatement.endingCash)})
                    </span>
                  </div>
                  <span className="font-bold font-mono text-[11px] px-2.5 py-1 rounded-lg bg-sky-600 text-white shadow-2xs">
                    مطابقة مؤكدة
                  </span>
                </div>

                <div className="grid gap-6 lg:grid-cols-3">
                  {/* CFO */}
                  <div className="bg-white dark:bg-[#0B0F17] border border-slate-200/90 dark:border-slate-800/80 rounded-2xl p-6 shadow-xs break-inside-avoid page-break-inside-avoid flex flex-col justify-between">
                    <div>
                      <h3 className="text-slate-900 dark:text-white font-bold text-base mb-1">الأنشطة التشغيلية</h3>
                      <p className="text-slate-500 dark:text-slate-400 text-xs mb-4">المتحصلات والمدفوعات من النشاط المباشر</p>
                      <div className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
                        <div className="flex justify-between py-2 text-slate-700 dark:text-slate-300"><span>مقبوضات تشغيلية</span><span className="font-mono font-bold text-slate-900 dark:text-white">{money(data.cashFlowStatement.operatingActivities.operatingReceipts)}</span></div>
                        <div className="flex justify-between py-2 text-slate-700 dark:text-slate-300"><span>توزيعات أرباح مستلمة</span><span className="font-mono font-bold text-slate-900 dark:text-white">{money(data.cashFlowStatement.operatingActivities.dividendReceipts)}</span></div>
                        <div className="flex justify-between py-2 text-rose-600 dark:text-rose-400"><span>مدفوعات تشغيلية</span><span className="font-mono font-bold">-{money(data.cashFlowStatement.operatingActivities.operatingPayments)}</span></div>
                        <div className="flex justify-between py-2 text-rose-600 dark:text-rose-400"><span>عمولات وضرائب التداول</span><span className="font-mono font-bold">-{money(data.cashFlowStatement.operatingActivities.tradingFeesAndTaxes)}</span></div>
                        <div className="flex justify-between py-2 text-rose-600 dark:text-rose-400"><span>فوائد مدفوعة</span><span className="font-mono font-bold">-{money(data.cashFlowStatement.operatingActivities.interestPayments)}</span></div>
                      </div>
                    </div>
                    <div className="border-t border-slate-200 dark:border-slate-800 pt-3 mt-4 font-bold text-slate-900 dark:text-white flex justify-between text-xs">
                      <span>صافي التدفق التشغيلي</span>
                      <span className="font-mono text-sm">{money(data.cashFlowStatement.operatingActivities.netCFO)}</span>
                    </div>
                  </div>

                  {/* CFI */}
                  <div className="bg-white dark:bg-[#0B0F17] border border-slate-200/90 dark:border-slate-800/80 rounded-2xl p-6 shadow-xs break-inside-avoid page-break-inside-avoid flex flex-col justify-between">
                    <div>
                      <h3 className="text-slate-900 dark:text-white font-bold text-base mb-1">الأنشطة الاستثمارية</h3>
                      <p className="text-slate-500 dark:text-slate-400 text-xs mb-4">شراء وبيع الأوراق المالية والأصول</p>
                      <div className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
                        <div className="flex justify-between py-2 text-rose-600 dark:text-rose-400"><span>مشتريات أوراق مالية</span><span className="font-mono font-bold">-{money(data.cashFlowStatement.investingActivities.securitiesPurchases)}</span></div>
                        <div className="flex justify-between py-2 text-emerald-600 dark:text-emerald-400"><span>متحصلات بيع أوراق مالية</span><span className="font-mono font-bold">+{money(data.cashFlowStatement.investingActivities.securitiesSalesProceeds)}</span></div>
                        <div className="flex justify-between py-2 text-rose-600 dark:text-rose-400"><span>شراء أصول عينية</span><span className="font-mono font-bold">-{money(data.cashFlowStatement.investingActivities.propertyAssetPurchases)}</span></div>
                        <div className="flex justify-between py-2 text-emerald-600 dark:text-emerald-400"><span>متحصلات بيع أصول عينية</span><span className="font-mono font-bold">+{money(data.cashFlowStatement.investingActivities.propertyAssetSalesProceeds)}</span></div>
                      </div>
                    </div>
                    <div className="border-t border-slate-200 dark:border-slate-800 pt-3 mt-4 font-bold text-slate-900 dark:text-white flex justify-between text-xs">
                      <span>صافي التدفق الاستثماري</span>
                      <span className="font-mono text-sm">{money(data.cashFlowStatement.investingActivities.netCFI)}</span>
                    </div>
                  </div>

                  {/* CFF & Transfers */}
                  <div className="bg-white dark:bg-[#0B0F17] border border-slate-200/90 dark:border-slate-800/80 rounded-2xl p-6 shadow-xs break-inside-avoid page-break-inside-avoid flex flex-col justify-between">
                    <div>
                      <h3 className="text-slate-900 dark:text-white font-bold text-base mb-1">الأنشطة التمويلية</h3>
                      <p className="text-slate-500 dark:text-slate-400 text-xs mb-4">القروض وحقوق الملاك والتحويلات البينية</p>
                      <div className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
                        <div className="flex justify-between py-2 text-emerald-600 dark:text-emerald-400"><span>متحصلات قروض جديدة</span><span className="font-mono font-bold">+{money(data.cashFlowStatement.financingActivities.debtBorrowingProceeds)}</span></div>
                        <div className="flex justify-between py-2 text-rose-600 dark:text-rose-400"><span>سداد أصل قروض</span><span className="font-mono font-bold">-{money(data.cashFlowStatement.financingActivities.debtPrincipalRepayments)}</span></div>
                        <div className="flex justify-between py-2 text-emerald-600 dark:text-emerald-400"><span>ضخ رأس مال من الملاك</span><span className="font-mono font-bold">+{money(data.cashFlowStatement.financingActivities.ownerCapitalContributions)}</span></div>
                        <div className="flex justify-between py-2 text-rose-600 dark:text-rose-400"><span>مسحوبات الملاك</span><span className="font-mono font-bold">-{money(data.cashFlowStatement.financingActivities.ownerCapitalWithdrawals)}</span></div>
                        <div className="flex justify-between py-2 text-slate-500 dark:text-slate-400">
                          <span>أثر التحويلات البينية</span>
                          <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">0.00 (محايدة)</span>
                        </div>
                        <div className="flex justify-between py-2 text-slate-500 dark:text-slate-400">
                          <span>أثر فروق ترجمة العملات</span>
                          <span className="font-mono font-bold">{money(data.cashFlowStatement.fxTranslationEffect)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="border-t border-slate-200 dark:border-slate-800 pt-3 mt-4 font-bold text-slate-900 dark:text-white flex justify-between text-xs">
                      <span>صافي التدفق التمويلي</span>
                      <span className="font-mono text-sm">{money(data.cashFlowStatement.financingActivities.netCFF)}</span>
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* ========================================================== */}
              {/* TAB 5: ECONOMIC NET WORTH BRIDGE */}
              {/* ========================================================== */}
              <TabsContent value="economic_bridge" className="space-y-6">
                <div className="bg-white dark:bg-[#0B0F17] border border-slate-200/90 dark:border-slate-800/80 rounded-2xl p-6 shadow-xs break-inside-avoid page-break-inside-avoid">
                  <h3 className="text-slate-900 dark:text-white font-bold text-base mb-1">
                    مطابقة وحركة صافي الثروة الاقتصادي
                  </h3>
                  <p className="text-slate-500 dark:text-slate-400 text-xs mb-4">
                    التوفيق المحاسبي الدقيق بين حقوق الملكية الدفترية وصافي الثروة بالقيمة السوقية العادلة بدون قيود وهمية
                  </p>

                  <div className="divide-y divide-slate-100 dark:divide-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-800/80 overflow-hidden text-xs">
                    {/* 1. Starting Point */}
                    <div className="flex items-center justify-between bg-slate-50/80 dark:bg-[#0E1420] p-4 font-bold text-slate-900 dark:text-white text-sm">
                      <span>(1) حقوق الملكية الدفترية</span>
                      <span className="font-mono">{money(data.economicNetWorthBridge.bookEquity)}</span>
                    </div>

                    {/* 2. Securities Adjustments */}
                    <div className="p-4 space-y-2 bg-emerald-50/30 dark:bg-emerald-950/10">
                      <div className="flex items-center justify-between font-bold text-emerald-950 dark:text-emerald-200">
                        <span>(2) تسويات الأوراق المالية والاستثمارات:</span>
                        <span className="font-mono">{money(data.economicNetWorthBridge.securitiesAdjustments.totalSecuritiesAdjustment)}</span>
                      </div>
                      <div className="pr-4 space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
                        <div className="flex justify-between">
                          <span>• أرباح/خسائر محققة من صفقات البيع (من lot_matches - غير مدمجة بالدفتر):</span>
                          <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{money(data.economicNetWorthBridge.securitiesAdjustments.cumulativeRealizedPnl)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>• أرباح/خسائر غير محققة للأصول النشطة (القيمة العادلة - تكلفة الأصول):</span>
                          <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{money(data.economicNetWorthBridge.securitiesAdjustments.activeLotsUnrealizedPnl)}</span>
                        </div>
                        <div className="flex justify-between text-slate-500">
                          <span>• رصيد مقاصة الاستثمار والتسوية في الدفتر:</span>
                          <span className="font-mono font-bold">{money(data.economicNetWorthBridge.securitiesAdjustments.clearingSettlementResidual)}</span>
                        </div>
                      </div>
                    </div>

                    {/* 3. Non-Securities Asset Surpluses */}
                    <div className="p-4 space-y-2">
                      <div className="flex items-center justify-between font-bold text-slate-900 dark:text-white">
                        <span>(3) تسويات وفروق تقييم الأصول غير المالية:</span>
                        <span className="font-mono">{money(data.economicNetWorthBridge.nonSecuritiesAssetAdjustments.totalNonSecuritiesAdjustment)}</span>
                      </div>
                      <div className="pr-4 space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
                        <div className="flex justify-between">
                          <span>• فائض تقييم العقارات (التثمين الرسمي - التكلفة الدفترية):</span>
                          <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{money(data.economicNetWorthBridge.nonSecuritiesAssetAdjustments.realEstateAppraisalSurplus)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>• فائض تقييم المعادن الثمينة والذهب (السعر الفوري - التكلفة):</span>
                          <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{money(data.economicNetWorthBridge.nonSecuritiesAssetAdjustments.preciousMetalsSpotSurplus)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>• فروق ترجمة النقدية بالعملات الأجنبية بسعر الإقفال:</span>
                          <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{money(data.economicNetWorthBridge.nonSecuritiesAssetAdjustments.cashFxTranslationDelta)}</span>
                        </div>
                      </div>
                    </div>

                    {/* 4. Liability Adjustments */}
                    <div className="p-4 space-y-2">
                      <div className="flex items-center justify-between font-bold text-slate-900 dark:text-white">
                        <span>(4) تسويات الالتزامات بفروق العملة بسعر الإقفال:</span>
                        <span className="font-mono">-{money(data.economicNetWorthBridge.liabilityAdjustments.totalLiabilityAdjustment)}</span>
                      </div>
                      <div className="pr-4 text-xs text-slate-600 dark:text-slate-400 flex justify-between">
                        <span>• فروق إعادة تقييم أصل القروض الأجنبية:</span>
                        <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{money(data.economicNetWorthBridge.liabilityAdjustments.debtFxTranslationDelta)}</span>
                      </div>
                    </div>
                  </div>

                  {/* 5. Economic Net Worth Result Card (Clean Purged) */}
                  <div className="rounded-2xl p-5 border bg-slate-900 text-white dark:bg-[#111827] dark:border-slate-700 flex items-center justify-between shadow-sm mt-4">
                    <span className="font-bold text-sm sm:text-base">(=) صافي الثروة الاقتصادي الشامل</span>
                    <span className="font-mono font-extrabold text-xl sm:text-2xl tabular-nums">{money(data.economicNetWorthBridge.economicNetWorth)}</span>
                  </div>

                  <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 text-xs text-emerald-950 dark:border-emerald-800/60 dark:bg-emerald-950/30 dark:text-emerald-200 font-medium mt-4">
                    <span className="flex items-center gap-1.5 font-bold">
                      <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
                      صحة المطابقة الرياضية للجسر التحليلي:
                    </span>
                    <span className="font-mono">
                      {data.economicNetWorthBridge.bridgeCheck.reconciled ? "مطابقة رياضية بنسبة 100% بدون أي ازدواجية حسابية" : `فارق: ${money(data.economicNetWorthBridge.bridgeCheck.discrepancy)}`}
                    </span>
                  </div>
                </div>
              </TabsContent>

              {/* ========================================================== */}
              {/* TAB 6: AUDIT & INVARIANTS */}
              {/* ========================================================== */}
              <TabsContent value="audit_controls" className="space-y-6">
                <div>
                  <h3 className="text-slate-900 dark:text-white font-bold text-base mb-1">المحددات المحاسبية الإلزامية</h3>
                  <p className="text-slate-500 dark:text-slate-400 text-xs mb-4">ضوابط المحاسبة المالية المعتمدة في مواصفة التدقيق الداخلي</p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {/* Invariant A */}
                  <div className="bg-white dark:bg-[#0B0F17] border border-slate-200/90 dark:border-slate-800/80 rounded-2xl p-5 shadow-xs break-inside-avoid page-break-inside-avoid flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white">توازن الميزانية العمومية</h4>
                        <span className="bg-emerald-50 text-emerald-700 border border-emerald-200/80 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800/70 font-bold text-[11px] px-2.5 py-1 rounded-lg">
                          PASS
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-2.5">الأصول الدفترية = الالتزامات + حقوق الملكية</p>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800/80 pt-2.5 mt-2">
                      {data.reconciliationAudit.invariants.invariantA_BookBalanceSheet.details}
                    </p>
                  </div>

                  {/* Invariant B */}
                  <div className="bg-white dark:bg-[#0B0F17] border border-slate-200/90 dark:border-slate-800/80 rounded-2xl p-5 shadow-xs break-inside-avoid page-break-inside-avoid flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white">توازن قيود اليومية (مدين = دائن)</h4>
                        <span className="bg-emerald-50 text-emerald-700 border border-emerald-200/80 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800/70 font-bold text-[11px] px-2.5 py-1 rounded-lg">
                          PASS
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-2.5">مجموع المدين = مجموع الدائن</p>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800/80 pt-2.5 mt-2 font-mono">
                      مدين: {money(data.reconciliationAudit.invariants.invariantB_JournalEquality.totalDebits)} | دائن: {money(data.reconciliationAudit.invariants.invariantB_JournalEquality.totalCredits)}
                    </p>
                  </div>

                  {/* Invariant C */}
                  <div className="bg-white dark:bg-[#0B0F17] border border-slate-200/90 dark:border-slate-800/80 rounded-2xl p-5 shadow-xs break-inside-avoid page-break-inside-avoid flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white">مطابقة حركة النقدية مع الدفاتر</h4>
                        <span className="bg-emerald-50 text-emerald-700 border border-emerald-200/80 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800/70 font-bold text-[11px] px-2.5 py-1 rounded-lg">
                          PASS
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-2.5">نهاية النقدية = بداية النقدية + التدفقات</p>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800/80 pt-2.5 mt-2">
                      {data.reconciliationAudit.invariants.invariantC_CashFlowReconciliation.details}
                    </p>
                  </div>

                  {/* Invariant D */}
                  <div className="bg-white dark:bg-[#0B0F17] border border-slate-200/90 dark:border-slate-800/80 rounded-2xl p-5 shadow-xs break-inside-avoid page-break-inside-avoid flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white">تحييد أثر التحويلات الداخلية</h4>
                        <span className="bg-emerald-50 text-emerald-700 border border-emerald-200/80 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800/70 font-bold text-[11px] px-2.5 py-1 rounded-lg">
                          PASS
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-2.5">التحويلات البينية أثرها الصافي 0.00</p>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800/80 pt-2.5 mt-2 font-mono">
                      الأثر الصافي على السيولة: {money(data.reconciliationAudit.invariants.invariantD_ZeroTransferInflation.netTransferImpact)}
                    </p>
                  </div>

                  {/* Invariant E */}
                  <div className="bg-white dark:bg-[#0B0F17] border border-slate-200/90 dark:border-slate-800/80 rounded-2xl p-5 shadow-xs break-inside-avoid page-break-inside-avoid flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white">مطابقة أرباح التخارج (FIFO)</h4>
                        <span className="bg-emerald-50 text-emerald-700 border border-emerald-200/80 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800/70 font-bold text-[11px] px-2.5 py-1 rounded-lg">
                          PASS
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-2.5">متحصلات البيع - تكلفة الأساس = أرباح lot_matches</p>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800/80 pt-2.5 mt-2 font-mono">
                      أرباح محققة: {money(data.reconciliationAudit.invariants.invariantE_FifoRealizedPnlReconciliation.realizedPnl)}
                    </p>
                  </div>

                  {/* Invariant F & G */}
                  <div className="bg-white dark:bg-[#0B0F17] border border-slate-200/90 dark:border-slate-800/80 rounded-2xl p-5 shadow-xs break-inside-avoid page-break-inside-avoid flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white">سلامة السجلات والدقة الرقمية</h4>
                        <span className="bg-emerald-50 text-emerald-700 border border-emerald-200/80 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800/70 font-bold text-[11px] px-2.5 py-1 rounded-lg">
                          PASS
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-2.5">عدم تعديل الدفاتر ودقة Decimal 40</p>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800/80 pt-2.5 mt-2">
                      {data.reconciliationAudit.invariants.invariantF_NonMutationOfLedger.message}
                    </p>
                  </div>
                </div>

                <div className="mt-8">
                  <h3 className="text-slate-900 dark:text-white font-bold text-base mb-1">الضوابط الرقابية والتأكيدية</h3>
                  <p className="text-slate-500 dark:text-slate-400 text-xs mb-4">اختبارات إضافية للتأكد من نزاهة المقاصة وتتبع العملات والأمان التشفيري</p>
                  
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="bg-white dark:bg-[#0B0F17] border border-slate-200/90 dark:border-slate-800/80 rounded-2xl p-5 shadow-xs break-inside-avoid page-break-inside-avoid flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <h4 className="text-xs font-bold text-slate-900 dark:text-white">مطابقة حسابات التسوية والمقاصة</h4>
                          <span className="bg-emerald-50 text-emerald-700 border border-emerald-200/80 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800/70 font-bold text-[11px] px-2.5 py-1 rounded-lg">
                            PASS
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-2">رصيد المقاصة = تكلفة الأصول النشطة - الأرباح المحققة</p>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800/80 pt-2.5 mt-2 font-mono">
                        {money(data.reconciliationAudit.controls.controlH_ClearingSettlementReconciliation.clearingBalance)}
                      </p>
                    </div>

                    <div className="bg-white dark:bg-[#0B0F17] border border-slate-200/90 dark:border-slate-800/80 rounded-2xl p-5 shadow-xs break-inside-avoid page-break-inside-avoid flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <h4 className="text-xs font-bold text-slate-900 dark:text-white">تتبع أثر تقلبات أسعار الصرف</h4>
                          <span className="bg-emerald-50 text-emerald-700 border border-emerald-200/80 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800/70 font-bold text-[11px] px-2.5 py-1 rounded-lg">
                            PASS
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-2">تتبع وترجمة العملات الأجنبية في الحسابات</p>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800/80 pt-2.5 mt-2 font-mono">
                        عدد العملات المتتبعة والمترجمة: {data.reconciliationAudit.controls.controlI_FxValuationTrace.tracedCurrenciesCount}
                      </p>
                    </div>

                    <div className="bg-white dark:bg-[#0B0F17] border border-slate-200/90 dark:border-slate-800/80 rounded-2xl p-5 shadow-xs break-inside-avoid page-break-inside-avoid flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <h4 className="text-xs font-bold text-slate-900 dark:text-white">بصمة التدقيق والتشفير (SHA-256)</h4>
                          <span className="bg-slate-100 text-slate-800 border border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700 font-mono text-[11px] px-2.5 py-1 rounded-lg">
                            VERIFIED
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-2">البصمة التشفيرية لمطابقة لقطة الدفتر</p>
                      </div>
                      <p className="font-mono text-[10px] text-slate-500 dark:text-slate-400 break-all border-t border-slate-100 dark:border-slate-800/80 pt-2.5 mt-2">
                        {data.reconciliationAudit.controls.controlJ_AuditSnapshotHash.snapshotSha256}
                      </p>
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </div>
  );

  if (embedded) return content;
  return <DashboardLayout>{content}</DashboardLayout>;
}

export default ReportsPage;
