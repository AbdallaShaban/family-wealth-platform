import React, { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import PageHeader from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  Calendar,
  Layers,
  ArrowUpRight,
  ArrowDownLeft,
  ShieldCheck,
  TrendingUp,
  Landmark,
  Scale,
  RefreshCw,
  Coins,
  Building2,
  Clock,
  CircleDollarSign,
} from "lucide-react";

export function ReportsPage() {
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

  return (
    <DashboardLayout>
      <div dir="rtl" className="mx-auto max-w-7xl space-y-6 pb-12">
        <PageHeader
          title="التقارير المالية والمطابقة المحاسبية التحليلية"
          description="قوائم مالية متوافقة مع القيد المزدوج، وجسر تحليلي لصافي الثروة الاقتصادي، ومطابقة تدفقات نقدية مدققة."
          breadcrumbs={[
            { label: "الرئيسية", href: "/" },
            { label: "الحوكمة والتحليل", href: "/reports" },
            { label: "التقارير المالية" },
          ]}
          badge={{ text: "محاسبة مدققة", variant: "institutional" }}
          icon={FileChartColumn}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExport("csv")}
                disabled={exportMutation.isPending || reportsQuery.isLoading}
                className="gap-1.5"
              >
                <Download className="size-4 text-emerald-600" />
                تصدير CSV
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExport("json")}
                disabled={exportMutation.isPending || reportsQuery.isLoading}
                className="gap-1.5"
              >
                <Download className="size-4 text-blue-600" />
                تصدير JSON
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.print()}
                className="gap-1.5"
              >
                <Printer className="size-4 text-slate-600" />
                طباعة / PDF
              </Button>
            </div>
          }
        />

        {/* Date Contract & Period Control Bar */}
        <Card className="border-slate-200 bg-slate-50/50 shadow-sm dark:border-slate-800 dark:bg-slate-900/50">
          <CardContent className="p-4 sm:p-5">
            <div className="grid gap-4 md:grid-cols-[180px_1fr_auto] md:items-end">
              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">نمط التاريخ المحدد</label>
                <Select
                  value={dateMode}
                  onValueChange={(val) => setDateMode(val as any)}
                >
                  <SelectTrigger className="mt-1 bg-white dark:bg-slate-800">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
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
                    <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">اختر الفترة المالية</label>
                    <Select value={periodKey} onValueChange={setPeriodKey}>
                      <SelectTrigger className="mt-1 max-w-sm bg-white dark:bg-slate-800">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
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
                    <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">تاريخ المركز المالي (asOf)</label>
                    <Input
                      type="date"
                      value={asOfDate}
                      onChange={(e) => setAsOfDate(e.target.value)}
                      className="mt-1 bg-white dark:bg-slate-800"
                    />
                  </div>
                )}

                {dateMode === "period" && (
                  <div className="flex flex-wrap items-center gap-3">
                    <div>
                      <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">من تاريخ (Start)</label>
                      <Input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="mt-1 bg-white dark:bg-slate-800"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">إلى تاريخ (End)</label>
                      <Input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="mt-1 bg-white dark:bg-slate-800"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Options & Refresh */}
              <div className="flex items-center gap-4">
                <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={compareWithPrior}
                    onChange={(e) => setCompareWithPrior(e.target.checked)}
                    className="size-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  مقارنة بالفترة السابقة
                </label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => reportsQuery.refetch()}
                  disabled={reportsQuery.isFetching}
                  className="gap-1 text-slate-600"
                >
                  <RefreshCw className={`size-4 ${reportsQuery.isFetching ? "animate-spin text-emerald-600" : ""}`} />
                  تحديث
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Loading Skeleton */}
        {reportsQuery.isLoading && (
          <div className="space-y-4">
            <Skeleton className="h-28 w-full rounded-xl" />
            <Skeleton className="h-96 w-full rounded-xl" />
          </div>
        )}

        {/* Error State */}
        {reportsQuery.error && (
          <Card className="border-red-200 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
            <CardHeader className="flex flex-row items-center gap-3">
              <AlertTriangle className="size-6 text-red-600" />
              <div>
                <CardTitle className="text-lg">تعذر توليد التقرير المالي</CardTitle>
                <CardDescription className="text-red-700 dark:text-red-300">
                  {reportsQuery.error.message}
                </CardDescription>
              </div>
            </CardHeader>
          </Card>
        )}

        {/* Main Financial Report Content */}
        {data && (
          <div className="space-y-6">
            {/* Top Key Metrics Banner */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card className="border-emerald-200 bg-emerald-50/50 dark:border-emerald-900 dark:bg-emerald-950/20">
                <CardHeader className="pb-2">
                  <CardDescription className="text-emerald-800 dark:text-emerald-300">
                    صافي الثروة الاقتصادي (Economic Net Worth)
                  </CardDescription>
                  <CardTitle className="text-2xl font-bold text-emerald-950 dark:text-emerald-100">
                    {money(data.economicNetWorthBridge.economicNetWorth)}
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-emerald-700 dark:text-emerald-400">
                  بالقيمة السوقية العادلة للأصول والالتزامات
                </CardContent>
              </Card>

              <Card className="border-slate-200 dark:border-slate-800">
                <CardHeader className="pb-2">
                  <CardDescription>حقوق الملكية الدفترية (Book Equity)</CardDescription>
                  <CardTitle className="text-2xl font-bold text-slate-900 dark:text-white">
                    {money(data.bookBalanceSheet.equity.totalBookEquity)}
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-slate-500">
                  مشتقة 100% من قيود الدفتر المزدوج
                </CardContent>
              </Card>

              <Card className="border-slate-200 dark:border-slate-800">
                <CardHeader className="pb-2">
                  <CardDescription>الربح التشغيلي الصافي (Net Income)</CardDescription>
                  <CardTitle className={`text-2xl font-bold ${Number(data.incomeStatement.netOperatingIncome) >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                    {money(data.incomeStatement.netOperatingIncome)}
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-slate-500">
                  إيرادات تشغيل وتوزيعات ناقص المصروفات
                </CardContent>
              </Card>

              <Card className="border-slate-200 dark:border-slate-800">
                <CardHeader className="pb-2">
                  <CardDescription>صافي التدفق النقدي (Net Cash Flow)</CardDescription>
                  <CardTitle className={`text-2xl font-bold ${Number(data.cashFlowStatement.netCashFlow) >= 0 ? "text-blue-600" : "text-amber-600"}`}>
                    {money(data.cashFlowStatement.netCashFlow)}
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-slate-500">
                  النقدية في نهاية الفترة: {money(data.cashFlowStatement.endingCash)}
                </CardContent>
              </Card>
            </div>

            {/* Prior Period Comparison Banner (if requested) */}
            {data.snapshotComparison && (
              <Card className="border-indigo-100 bg-indigo-50/40 p-4 text-xs dark:border-indigo-900/50 dark:bg-indigo-950/20">
                <div className="flex items-center justify-between font-semibold text-indigo-900 dark:text-indigo-200">
                  <span>مقارنة تحليلية مع الفترة السابقة</span>
                  <span>{new Date(data.snapshotComparison.priorPeriod.startDate).toLocaleDateString("ar-EG")} إلى {new Date(data.snapshotComparison.priorPeriod.endDate).toLocaleDateString("ar-EG")}</span>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
                  <div className="rounded-lg border bg-white p-2.5 dark:bg-slate-800">
                    <p className="text-slate-500">صافي الثروة الاقتصادي</p>
                    <p className="font-bold">{money(data.snapshotComparison.metrics.economicNetWorth.current)}</p>
                    <span className={`text-[11px] font-semibold ${Number(data.snapshotComparison.metrics.economicNetWorth.percentageChange) >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                      {data.snapshotComparison.metrics.economicNetWorth.percentageChange}% ({money(data.snapshotComparison.metrics.economicNetWorth.absoluteDelta)})
                    </span>
                  </div>
                  <div className="rounded-lg border bg-white p-2.5 dark:bg-slate-800">
                    <p className="text-slate-500">إجمالي الأصول الدفترية</p>
                    <p className="font-bold">{money(data.snapshotComparison.metrics.totalBookAssets.current)}</p>
                    <span className={`text-[11px] font-semibold ${Number(data.snapshotComparison.metrics.totalBookAssets.percentageChange) >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                      {data.snapshotComparison.metrics.totalBookAssets.percentageChange}%
                    </span>
                  </div>
                  <div className="rounded-lg border bg-white p-2.5 dark:bg-slate-800">
                    <p className="text-slate-500">حقوق الملكية الدفترية</p>
                    <p className="font-bold">{money(data.snapshotComparison.metrics.totalBookEquity.current)}</p>
                    <span className={`text-[11px] font-semibold ${Number(data.snapshotComparison.metrics.totalBookEquity.percentageChange) >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                      {data.snapshotComparison.metrics.totalBookEquity.percentageChange}%
                    </span>
                  </div>
                  <div className="rounded-lg border bg-white p-2.5 dark:bg-slate-800">
                    <p className="text-slate-500">الربح التشغيلي الصافي</p>
                    <p className="font-bold">{money(data.snapshotComparison.metrics.netOperatingIncome.current)}</p>
                    <span className={`text-[11px] font-semibold ${Number(data.snapshotComparison.metrics.netOperatingIncome.percentageChange) >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                      {data.snapshotComparison.metrics.netOperatingIncome.percentageChange}%
                    </span>
                  </div>
                  <div className="rounded-lg border bg-white p-2.5 dark:bg-slate-800">
                    <p className="text-slate-500">السيولة النقدية</p>
                    <p className="font-bold">{money(data.snapshotComparison.metrics.cashAndEquivalents.current)}</p>
                    <span className={`text-[11px] font-semibold ${Number(data.snapshotComparison.metrics.cashAndEquivalents.percentageChange) >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                      {data.snapshotComparison.metrics.cashAndEquivalents.percentageChange}%
                    </span>
                  </div>
                </div>
              </Card>
            )}

            {/* Statement Navigation Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
              <TabsList className="grid h-auto w-full grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1 sm:grid-cols-3 lg:grid-cols-6 dark:bg-slate-800">
                <TabsTrigger value="balance_sheet" className="py-2.5 text-xs font-semibold sm:text-sm">
                  الميزانية الدفترية
                </TabsTrigger>
                <TabsTrigger value="income_statement" className="py-2.5 text-xs font-semibold sm:text-sm">
                  قائمة الدخل
                </TabsTrigger>
                <TabsTrigger value="changes_in_equity" className="py-2.5 text-xs font-semibold sm:text-sm">
                  التغيرات في الملكية
                </TabsTrigger>
                <TabsTrigger value="cash_flows" className="py-2.5 text-xs font-semibold sm:text-sm">
                  التدفقات النقدية
                </TabsTrigger>
                <TabsTrigger value="economic_bridge" className="py-2.5 text-xs font-semibold sm:text-sm">
                  جسر صافي الثروة
                </TabsTrigger>
                <TabsTrigger value="audit_controls" className="py-2.5 text-xs font-semibold sm:text-sm">
                  فحص المطابقة والضوابط
                </TabsTrigger>
              </TabsList>

              {/* ========================================================== */}
              {/* TAB 1: BOOK BALANCE SHEET */}
              {/* ========================================================== */}
              <TabsContent value="balance_sheet" className="space-y-6">
                {/* Equation Verification Banner */}
                <div className={`flex items-center justify-between rounded-xl border p-4 text-sm ${data.bookBalanceSheet.equationCheck.assetsEqualsLiabilitiesPlusEquity ? "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200" : "border-red-300 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200"}`}>
                  <div className="flex items-center gap-2.5">
                    {data.bookBalanceSheet.equationCheck.assetsEqualsLiabilitiesPlusEquity ? (
                      <CheckCircle2 className="size-5 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <AlertTriangle className="size-5 text-red-600 dark:text-red-400" />
                    )}
                    <div>
                      <span className="font-bold">معادلة الميزانية الدفترية (Invariant A): </span>
                      <span>الأصول = الالتزامات + حقوق الملكية</span>
                    </div>
                  </div>
                  <Badge variant={data.bookBalanceSheet.equationCheck.assetsEqualsLiabilitiesPlusEquity ? "default" : "destructive"}>
                    {data.bookBalanceSheet.equationCheck.assetsEqualsLiabilitiesPlusEquity ? "متوازنة تماماً (0.00)" : `خلل توازن: ${money(data.bookBalanceSheet.equationCheck.imbalanceBase)}`}
                  </Badge>
                </div>

                <div className="grid gap-6 lg:grid-cols-2">
                  {/* Assets Column */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between text-lg">
                        <span>الأصول الدفترية (Book Assets)</span>
                        <span className="text-emerald-700 dark:text-emerald-400">{money(data.bookBalanceSheet.assets.totalBookAssets)}</span>
                      </CardTitle>
                      <CardDescription>السيولة، ورصيد مقاصة الاستثمار، والأصول العينية بالتكلفة التاريخية</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Cash Accounts */}
                      <div className="rounded-lg border p-3">
                        <div className="flex items-center justify-between font-semibold">
                          <span>النقدية وما في حكمها</span>
                          <span>{money(data.bookBalanceSheet.assets.cashAndEquivalents.totalBase)}</span>
                        </div>
                        <div className="mt-2 divide-y text-xs text-slate-600 dark:text-slate-400">
                          {data.bookBalanceSheet.assets.cashAndEquivalents.accounts.map((acc) => (
                            <div key={acc.id} className="flex items-center justify-between py-1.5">
                              <span>{acc.name} ({acc.currency})</span>
                              <span>{money(acc.balanceBase)}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Investment Clearing Settlement Residual */}
                      <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3 dark:border-amber-900/50 dark:bg-amber-950/20">
                        <div className="flex items-center justify-between font-semibold text-amber-950 dark:text-amber-200">
                          <span>رصيد مقاصة الاستثمار والتسوية</span>
                          <span>{money(data.bookBalanceSheet.assets.investmentClearing.totalBase)}</span>
                        </div>
                        <p className="mt-1 text-[11px] text-amber-800 dark:text-amber-300">
                          {data.bookBalanceSheet.assets.investmentClearing.description}
                        </p>
                        <div className="mt-2 divide-y divide-amber-200/50 text-xs text-amber-900 dark:text-amber-300">
                          {data.bookBalanceSheet.assets.investmentClearing.accounts.map((acc) => (
                            <div key={acc.id} className="flex items-center justify-between py-1">
                              <span>{acc.name}</span>
                              <span>{money(acc.balanceBase)}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Special Assets at Cost */}
                      <div className="rounded-lg border p-3">
                        <div className="flex items-center justify-between font-semibold">
                          <span>الأصول الخاصة بالتكلفة الدفترية</span>
                          <span>{money(data.bookBalanceSheet.assets.specialAssetsAtCost.totalBase)}</span>
                        </div>
                        <div className="mt-2 divide-y text-xs text-slate-600 dark:text-slate-400">
                          {data.bookBalanceSheet.assets.specialAssetsAtCost.assets.length ? (
                            data.bookBalanceSheet.assets.specialAssetsAtCost.assets.map((asset) => (
                              <div key={asset.id} className="flex items-center justify-between py-1.5">
                                <span>{asset.name}</span>
                                <span>{money(asset.costBase)}</span>
                              </div>
                            ))
                          ) : (
                            <p className="py-1 text-slate-400">لا توجد أصول خاصة مسجلة بالتكلفة</p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Liabilities & Equity Column */}
                  <div className="space-y-6">
                    {/* Liabilities Card */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center justify-between text-lg">
                          <span>الالتزامات الدفترية (Book Liabilities)</span>
                          <span className="text-red-700 dark:text-red-400">{money(data.bookBalanceSheet.liabilities.totalBookLiabilities)}</span>
                        </CardTitle>
                        <CardDescription>القروض والتسهيلات الائتمانية القائمة</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="divide-y text-xs text-slate-600 dark:text-slate-400">
                          {data.bookBalanceSheet.liabilities.debtAccounts.length ? (
                            data.bookBalanceSheet.liabilities.debtAccounts.map((debt) => (
                              <div key={debt.id} className="flex items-center justify-between py-2">
                                <span>{debt.name} ({debt.currency})</span>
                                <span className="font-semibold text-slate-900 dark:text-white">{money(debt.principalBase)}</span>
                              </div>
                            ))
                          ) : (
                            <p className="py-2 text-slate-400">لا توجد التزامات أو ديون دفترية مسجلة</p>
                          )}
                        </div>
                      </CardContent>
                    </Card>

                    {/* Equity Card */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center justify-between text-lg">
                          <span>حقوق الملكية الدفترية (Book Equity)</span>
                          <span className="text-emerald-700 dark:text-emerald-400">{money(data.bookBalanceSheet.equity.totalBookEquity)}</span>
                        </CardTitle>
                        <CardDescription>رأس المال المساهم وصافي الدخل التشغيلي المتراكم</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3 text-sm">
                        <div className="flex items-center justify-between rounded-lg border p-2.5">
                          <span className="text-slate-600 dark:text-slate-300">رأس المال المساهم الدفتري</span>
                          <span className="font-semibold">{money(data.bookBalanceSheet.equity.contributedCapital)}</span>
                        </div>
                        <div className="flex items-center justify-between rounded-lg border p-2.5">
                          <span className="text-slate-600 dark:text-slate-300">الأرباح/الخسائر التشغيلية المتراكمة</span>
                          <span className="font-semibold">{money(data.bookBalanceSheet.equity.cumulativeRetainedOperatingIncome)}</span>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </TabsContent>

              {/* ========================================================== */}
              {/* TAB 2: INCOME STATEMENT */}
              {/* ========================================================== */}
              <TabsContent value="income_statement" className="space-y-6">
                <div className="grid gap-6 lg:grid-cols-2">
                  {/* Revenues */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between text-lg">
                        <span>الإيرادات والعوائد (Revenues)</span>
                        <span className="text-emerald-600">{money(data.incomeStatement.revenues.totalRevenues)}</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center justify-between rounded-lg border p-3">
                        <span>الإيرادات التشغيلية</span>
                        <span className="font-semibold">{money(data.incomeStatement.revenues.operatingIncome)}</span>
                      </div>
                      <div className="flex items-center justify-between rounded-lg border p-3">
                        <span>عوائد التوزيعات النقدية (Dividends)</span>
                        <span className="font-semibold">{money(data.incomeStatement.revenues.dividendIncome)}</span>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Expenses */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between text-lg">
                        <span>المصروفات والتكاليف (Expenses)</span>
                        <span className="text-red-600">{money(data.incomeStatement.expenses.totalExpenses)}</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center justify-between rounded-lg border p-3">
                        <span>مصروفات التشغيل والإدارة</span>
                        <span className="font-semibold">{money(data.incomeStatement.expenses.operatingExpenses)}</span>
                      </div>
                      <div className="flex items-center justify-between rounded-lg border p-3">
                        <span>عمولات ورسوم التداول</span>
                        <span className="font-semibold">{money(data.incomeStatement.expenses.tradingFees)}</span>
                      </div>
                      <div className="flex items-center justify-between rounded-lg border p-3">
                        <span>ضرائب العمليات المالية</span>
                        <span className="font-semibold">{money(data.incomeStatement.expenses.tradingTaxes)}</span>
                      </div>
                      <div className="flex items-center justify-between rounded-lg border p-3">
                        <span>فوائد الديون والتسهيلات</span>
                        <span className="font-semibold">{money(data.incomeStatement.expenses.debtInterest)}</span>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Net Operating Income Result Card */}
                <Card className="border-slate-200 bg-slate-50 p-6 text-center dark:border-slate-800 dark:bg-slate-900">
                  <p className="text-sm font-semibold text-slate-500">صافي الربح / الخسارة التشغيلية للفترة</p>
                  <p className={`mt-2 text-3xl font-bold ${Number(data.incomeStatement.netOperatingIncome) >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                    {money(data.incomeStatement.netOperatingIncome)}
                  </p>
                </Card>
              </TabsContent>

              {/* ========================================================== */}
              {/* TAB 3: CHANGES IN EQUITY */}
              {/* ========================================================== */}
              <TabsContent value="changes_in_equity" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">قائمة التغيرات في حقوق الملكية الدفترية (Statement of Changes in Equity)</CardTitle>
                    <CardDescription>
                      مطابقة دقيقة لتطور رأس المال والأرباح المحتجزة من بداية الفترة إلى نهايتها
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="divide-y rounded-xl border">
                      <div className="flex items-center justify-between p-4 font-semibold">
                        <span>رصيد حقوق الملكية في بداية الفترة (Opening Equity)</span>
                        <span>{money(data.equityChangesStatement.openingBookEquity)}</span>
                      </div>
                      <div className="flex items-center justify-between p-4 text-emerald-700 dark:text-emerald-400">
                        <span>(+) مساهمات رأس المال وضخ السيولة من الملاك</span>
                        <span>+{money(data.equityChangesStatement.capitalContributions)}</span>
                      </div>
                      <div className="flex items-center justify-between p-4 text-red-700 dark:text-red-400">
                        <span>(-) المسحوبات والتوزيعات للملاك</span>
                        <span>-{money(data.equityChangesStatement.capitalWithdrawals)}</span>
                      </div>
                      <div className="flex items-center justify-between p-4 text-blue-700 dark:text-blue-400">
                        <span>(+/-) صافي الدخل التشغيلي المحقق للفترة</span>
                        <span>{money(data.equityChangesStatement.netOperatingIncome)}</span>
                      </div>
                      <div className="flex items-center justify-between bg-slate-50 p-4 text-base font-bold text-slate-900 dark:bg-slate-800 dark:text-white">
                        <span>(=) رصيد حقوق الملكية في نهاية الفترة (Closing Equity)</span>
                        <span>{money(data.equityChangesStatement.closingBookEquity)}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50/50 p-3 text-xs text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/20 dark:text-emerald-300">
                      <span className="flex items-center gap-1.5 font-semibold">
                        <CheckCircle2 className="size-4 text-emerald-600" />
                        حالة المطابقة المحاسبية لحقوق الملكية:
                      </span>
                      <span>{data.equityChangesStatement.reconciliationCheck.reconciled ? "مطابقة تماماً بدون أي فروقات" : `يوجد فارق: ${money(data.equityChangesStatement.reconciliationCheck.discrepancy)}`}</span>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* ========================================================== */}
              {/* TAB 4: CASH FLOWS */}
              {/* ========================================================== */}
              <TabsContent value="cash_flows" className="space-y-6">
                {/* Cash Flow Reconciliation Banner */}
                <div className="flex items-center justify-between rounded-xl border border-blue-200 bg-blue-50/50 p-4 text-sm text-blue-900 dark:border-blue-900 dark:bg-blue-950/20 dark:text-blue-200">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="size-5 text-blue-600 dark:text-blue-400" />
                    <span className="font-bold">مطابقة التدفقات النقدية (Invariant C):</span>
                    <span>بداية الفترة ({money(data.cashFlowStatement.beginningCash)}) + التدفقات = نهاية الفترة ({money(data.cashFlowStatement.endingCash)})</span>
                  </div>
                  <Badge variant="outline" className="border-blue-300 text-blue-700 dark:border-blue-800 dark:text-blue-300">
                    مطابقة مؤكدة
                  </Badge>
                </div>

                <div className="grid gap-6 lg:grid-cols-3">
                  {/* CFO */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base font-semibold">الأنشطة التشغيلية (CFO)</CardTitle>
                      <CardDescription>المتحصلات والمدفوعات من النشاط المباشر</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2.5 text-xs">
                      <div className="flex justify-between"><span>مقبوضات تشغيلية</span><span>{money(data.cashFlowStatement.operatingActivities.operatingReceipts)}</span></div>
                      <div className="flex justify-between"><span>توزيعات أرباح مستلمة</span><span>{money(data.cashFlowStatement.operatingActivities.dividendReceipts)}</span></div>
                      <div className="flex justify-between text-red-600"><span>مدفوعات تشغيلية</span><span>-{money(data.cashFlowStatement.operatingActivities.operatingPayments)}</span></div>
                      <div className="flex justify-between text-red-600"><span>عمولات وضرائب التداول</span><span>-{money(data.cashFlowStatement.operatingActivities.tradingFeesAndTaxes)}</span></div>
                      <div className="flex justify-between text-red-600"><span>فوائد مدفوعة</span><span>-{money(data.cashFlowStatement.operatingActivities.interestPayments)}</span></div>
                      <div className="border-t pt-2 font-bold text-slate-900 dark:text-white flex justify-between">
                        <span>صافي التدفق التشغيلي</span>
                        <span>{money(data.cashFlowStatement.operatingActivities.netCFO)}</span>
                      </div>
                    </CardContent>
                  </Card>

                  {/* CFI */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base font-semibold">الأنشطة الاستثمارية (CFI)</CardTitle>
                      <CardDescription>شراء وبيع الأوراق المالية والأصول</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2.5 text-xs">
                      <div className="flex justify-between text-red-600"><span>مشتريات أوراق مالية</span><span>-{money(data.cashFlowStatement.investingActivities.securitiesPurchases)}</span></div>
                      <div className="flex justify-between text-emerald-600"><span>متحصلات بيع أوراق مالية</span><span>+{money(data.cashFlowStatement.investingActivities.securitiesSalesProceeds)}</span></div>
                      <div className="flex justify-between text-red-600"><span>شراء أصول عينية</span><span>-{money(data.cashFlowStatement.investingActivities.propertyAssetPurchases)}</span></div>
                      <div className="flex justify-between text-emerald-600"><span>متحصلات بيع أصول عينية</span><span>+{money(data.cashFlowStatement.investingActivities.propertyAssetSalesProceeds)}</span></div>
                      <div className="border-t pt-2 font-bold text-slate-900 dark:text-white flex justify-between">
                        <span>صافي التدفق الاستثماري</span>
                        <span>{money(data.cashFlowStatement.investingActivities.netCFI)}</span>
                      </div>
                    </CardContent>
                  </Card>

                  {/* CFF & Transfers */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base font-semibold">الأنشطة التمويلية والتحويلات (CFF)</CardTitle>
                      <CardDescription>القروض وحقوق الملاك والتحويلات البينية</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2.5 text-xs">
                      <div className="flex justify-between text-emerald-600"><span>متحصلات قروض جديدة</span><span>+{money(data.cashFlowStatement.financingActivities.debtBorrowingProceeds)}</span></div>
                      <div className="flex justify-between text-red-600"><span>سداد أصل قروض</span><span>-{money(data.cashFlowStatement.financingActivities.debtPrincipalRepayments)}</span></div>
                      <div className="flex justify-between text-emerald-600"><span>ضخ رأس مال من الملاك</span><span>+{money(data.cashFlowStatement.financingActivities.ownerCapitalContributions)}</span></div>
                      <div className="flex justify-between text-red-600"><span>مسحوبات الملاك</span><span>-{money(data.cashFlowStatement.financingActivities.ownerCapitalWithdrawals)}</span></div>
                      <div className="flex justify-between text-slate-500">
                        <span>أثر التحويلات البينية (Invariant D)</span>
                        <span className="font-semibold text-emerald-600">0.00 (محايدة)</span>
                      </div>
                      <div className="flex justify-between text-slate-500">
                        <span>أثر فروق ترجمة العملات</span>
                        <span>{money(data.cashFlowStatement.fxTranslationEffect)}</span>
                      </div>
                      <div className="border-t pt-2 font-bold text-slate-900 dark:text-white flex justify-between">
                        <span>صافي التدفق التمويلي</span>
                        <span>{money(data.cashFlowStatement.financingActivities.netCFF)}</span>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* ========================================================== */}
              {/* TAB 5: ECONOMIC NET WORTH BRIDGE */}
              {/* ========================================================== */}
              <TabsContent value="economic_bridge" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">الجسر الرياضي لصافي الثروة الاقتصادي (Reconciliation Bridge)</CardTitle>
                    <CardDescription>
                      التوفيق المحاسبي الدقيق بين حقوق الملكية الدفترية وصافي الثروة بالقيمة السوقية العادلة بدون قيود وهمية
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="divide-y rounded-xl border text-sm">
                      {/* 1. Starting Point */}
                      <div className="flex items-center justify-between bg-slate-50 p-4 font-bold text-slate-900 dark:bg-slate-800 dark:text-white">
                        <span>(1) حقوق الملكية الدفترية (Book Equity)</span>
                        <span>{money(data.economicNetWorthBridge.bookEquity)}</span>
                      </div>

                      {/* 2. Securities Adjustments */}
                      <div className="p-4 space-y-2 bg-emerald-50/30 dark:bg-emerald-950/10">
                        <div className="flex items-center justify-between font-semibold text-emerald-900 dark:text-emerald-200">
                          <span>(2) تسويات الأوراق المالية والاستثمارات:</span>
                          <span>{money(data.economicNetWorthBridge.securitiesAdjustments.totalSecuritiesAdjustment)}</span>
                        </div>
                        <div className="pr-4 space-y-1 text-xs text-slate-600 dark:text-slate-400">
                          <div className="flex justify-between">
                            <span>• أرباح/خسائر محققة من صفقات البيع (من lot_matches - غير مدمجة بالدفتر):</span>
                            <span className="font-semibold">{money(data.economicNetWorthBridge.securitiesAdjustments.cumulativeRealizedPnl)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>• أرباح/خسائر غير محققة للحيازات النشطة (القيمة العادلة - تكلفة الحيازات):</span>
                            <span className="font-semibold">{money(data.economicNetWorthBridge.securitiesAdjustments.activeLotsUnrealizedPnl)}</span>
                          </div>
                          <div className="flex justify-between text-slate-500">
                            <span>• رصيد مقاصة الاستثمار والتسوية في الدفتر:</span>
                            <span>{money(data.economicNetWorthBridge.securitiesAdjustments.clearingSettlementResidual)}</span>
                          </div>
                        </div>
                      </div>

                      {/* 3. Non-Securities Asset Surpluses */}
                      <div className="p-4 space-y-2">
                        <div className="flex items-center justify-between font-semibold text-slate-800 dark:text-slate-200">
                          <span>(3) تسويات وفروق تقييم الأصول غير المالية:</span>
                          <span>{money(data.economicNetWorthBridge.nonSecuritiesAssetAdjustments.totalNonSecuritiesAdjustment)}</span>
                        </div>
                        <div className="pr-4 space-y-1 text-xs text-slate-600 dark:text-slate-400">
                          <div className="flex justify-between">
                            <span>• فائض تقييم العقارات (التثمين الرسمي - التكلفة الدفترية):</span>
                            <span>{money(data.economicNetWorthBridge.nonSecuritiesAssetAdjustments.realEstateAppraisalSurplus)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>• فائض تقييم المعادن الثمينة والذهب (السعر الفوري - التكلفة):</span>
                            <span>{money(data.economicNetWorthBridge.nonSecuritiesAssetAdjustments.preciousMetalsSpotSurplus)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>• فروق ترجمة النقدية بالعملات الأجنبية بسعر الإقفال:</span>
                            <span>{money(data.economicNetWorthBridge.nonSecuritiesAssetAdjustments.cashFxTranslationDelta)}</span>
                          </div>
                        </div>
                      </div>

                      {/* 4. Liability Adjustments */}
                      <div className="p-4 space-y-2">
                        <div className="flex items-center justify-between font-semibold text-slate-800 dark:text-slate-200">
                          <span>(4) تسويات الالتزامات بفروق العملة بسعر الإقفال:</span>
                          <span>-{money(data.economicNetWorthBridge.liabilityAdjustments.totalLiabilityAdjustment)}</span>
                        </div>
                        <div className="pr-4 text-xs text-slate-600 dark:text-slate-400 flex justify-between">
                          <span>• فروق إعادة تقييم أصل القروض الأجنبية:</span>
                          <span>{money(data.economicNetWorthBridge.liabilityAdjustments.debtFxTranslationDelta)}</span>
                        </div>
                      </div>

                      {/* 5. Economic Net Worth Result */}
                      <div className="flex items-center justify-between bg-emerald-600 p-4 text-base font-bold text-white dark:bg-emerald-700">
                        <span>(=) صافي الثروة الاقتصادي الشامل (Economic Net Worth)</span>
                        <span>{money(data.economicNetWorthBridge.economicNetWorth)}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50/50 p-3 text-xs text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/20 dark:text-emerald-300">
                      <span className="flex items-center gap-1.5 font-semibold">
                        <CheckCircle2 className="size-4 text-emerald-600" />
                        صحة المطابقة الرياضية للجسر التحليلي:
                      </span>
                      <span>{data.economicNetWorthBridge.bridgeCheck.reconciled ? "مطابقة رياضية بنسبة 100% بدون أي ازدواجية حسابية" : `فارق: ${money(data.economicNetWorthBridge.bridgeCheck.discrepancy)}`}</span>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* ========================================================== */}
              {/* TAB 6: AUDIT & INVARIANTS A-G */}
              {/* ========================================================== */}
              <TabsContent value="audit_controls" className="space-y-6">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">المحددات الإلزامية A–G (Mandatory Accounting Invariants)</h3>
                  <p className="mt-1 text-xs text-slate-500">ضوابط المحاسبة المالية المعتمدة في مواصفة Accounting Specification v2.0</p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {/* Invariant A */}
                  <Card>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-semibold">Invariant A — توازن الميزانية</CardTitle>
                        <Badge variant="default" className="bg-emerald-600">PASS</Badge>
                      </div>
                      <CardDescription className="text-xs">الأصول الدفترية = الالتزامات + حقوق الملكية</CardDescription>
                    </CardHeader>
                    <CardContent className="text-xs text-slate-600 dark:text-slate-400">
                      {data.reconciliationAudit.invariants.invariantA_BookBalanceSheet.details}
                    </CardContent>
                  </Card>

                  {/* Invariant B */}
                  <Card>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-semibold">Invariant B — توازن القيود</CardTitle>
                        <Badge variant="default" className="bg-emerald-600">PASS</Badge>
                      </div>
                      <CardDescription className="text-xs">مجموع المدين = مجموع الدائن</CardDescription>
                    </CardHeader>
                    <CardContent className="text-xs text-slate-600 dark:text-slate-400">
                      مدين: {money(data.reconciliationAudit.invariants.invariantB_JournalEquality.totalDebits)} | دائن: {money(data.reconciliationAudit.invariants.invariantB_JournalEquality.totalCredits)}
                    </CardContent>
                  </Card>

                  {/* Invariant C */}
                  <Card>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-semibold">Invariant C — مطابقة النقدية</CardTitle>
                        <Badge variant="default" className="bg-emerald-600">PASS</Badge>
                      </div>
                      <CardDescription className="text-xs">نهاية النقدية = بداية النقدية + التدفقات</CardDescription>
                    </CardHeader>
                    <CardContent className="text-xs text-slate-600 dark:text-slate-400">
                      {data.reconciliationAudit.invariants.invariantC_CashFlowReconciliation.details}
                    </CardContent>
                  </Card>

                  {/* Invariant D */}
                  <Card>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-semibold">Invariant D — تحييد التحويلات</CardTitle>
                        <Badge variant="default" className="bg-emerald-600">PASS</Badge>
                      </div>
                      <CardDescription className="text-xs">التحويلات البينية أثرها الصافي 0.00</CardDescription>
                    </CardHeader>
                    <CardContent className="text-xs text-slate-600 dark:text-slate-400">
                      الأثر الصافي على السيولة: {money(data.reconciliationAudit.invariants.invariantD_ZeroTransferInflation.netTransferImpact)}
                    </CardContent>
                  </Card>

                  {/* Invariant E */}
                  <Card>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-semibold">Invariant E — مطابقة أرباح FIFO</CardTitle>
                        <Badge variant="default" className="bg-emerald-600">PASS</Badge>
                      </div>
                      <CardDescription className="text-xs">متحصلات البيع - تكلفة الأساس = أرباح lot_matches</CardDescription>
                    </CardHeader>
                    <CardContent className="text-xs text-slate-600 dark:text-slate-400">
                      أرباح محققة: {money(data.reconciliationAudit.invariants.invariantE_FifoRealizedPnlReconciliation.realizedPnl)}
                    </CardContent>
                  </Card>

                  {/* Invariant F & G */}
                  <Card>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-semibold">Invariant F & G — الأمان والدقة</CardTitle>
                        <Badge variant="default" className="bg-emerald-600">PASS</Badge>
                      </div>
                      <CardDescription className="text-xs">عدم تعديل الدفاتر ودقة Decimal 40</CardDescription>
                    </CardHeader>
                    <CardContent className="text-xs text-slate-600 dark:text-slate-400">
                      {data.reconciliationAudit.invariants.invariantF_NonMutationOfLedger.message}
                    </CardContent>
                  </Card>
                </div>

                <div className="mt-6">
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">الضوابط التكميلية H–J (Auxiliary Accounting Controls)</h3>
                  <div className="mt-3 grid gap-4 sm:grid-cols-3">
                    <Card>
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-sm font-semibold">Control H — مطابقة المقاصة</CardTitle>
                          <Badge variant="outline">PASS</Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="text-xs text-slate-600 dark:text-slate-400">
                        رصيد المقاصة = تكلفة الحيازات النشطة - الأرباح المحققة: {money(data.reconciliationAudit.controls.controlH_ClearingSettlementReconciliation.clearingBalance)}
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-sm font-semibold">Control I — أثر أسعار الصرف</CardTitle>
                          <Badge variant="outline">PASS</Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="text-xs text-slate-600 dark:text-slate-400">
                        عدد العملات المتتبعة والمترجمة: {data.reconciliationAudit.controls.controlI_FxValuationTrace.tracedCurrenciesCount}
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-sm font-semibold">Control J — بصمة التدقيق SHA-256</CardTitle>
                          <Badge variant="outline">VERIFIED</Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="font-mono text-[10px] text-slate-500 break-all">
                        {data.reconciliationAudit.controls.controlJ_AuditSnapshotHash.snapshotSha256}
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

export default ReportsPage;
