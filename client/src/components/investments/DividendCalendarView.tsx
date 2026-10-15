import React from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatMoney } from "@/lib/financialDisplay";
import SensitiveValue from "@/components/SensitiveValue";
import {
  CalendarDays,
  Coins,
  TrendingUp,
  Percent,
  CheckCircle2,
  Clock,
  HelpCircle,
  FileSpreadsheet,
} from "lucide-react";

export function DividendCalendarView() {
  const analyticsQuery = trpc.family.dividends.getAnalytics.useQuery(undefined, {
    staleTime: 30_000,
  });

  const data = analyticsQuery.data;
  const isLoading = analyticsQuery.isLoading;
  const baseCurrency = data?.summary.baseCurrency || "EGP";

  const getStatusBadge = (status: "paid" | "declared" | "projected") => {
    switch (status) {
      case "paid":
        return (
          <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 gap-1 text-[11px]">
            <CheckCircle2 className="size-3" />
            <span>مدفوع ومقيد</span>
          </Badge>
        );
      case "declared":
        return (
          <Badge className="bg-sky-500/15 text-sky-700 dark:text-sky-400 border-sky-500/30 gap-1 text-[11px]">
            <Clock className="size-3" />
            <span>معلن رسميًا</span>
          </Badge>
        );
      case "projected":
        return (
          <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30 gap-1 text-[11px]">
            <HelpCircle className="size-3" />
            <span>تقديري متوقع</span>
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Top 4 Dividend KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* KPI 1: Total Paid */}
        <Card className="border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#0E1420] shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              إجمالي التوزيعات المستلمة
            </span>
            <div className="size-8 rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 flex items-center justify-center">
              <Coins className="size-4" />
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-28" />
            ) : (
              <div className="space-y-1">
                <div className="text-2xl font-bold font-mono text-emerald-700 dark:text-emerald-400">
                  <SensitiveValue>
                    {formatMoney(data?.summary.totalPaidDividendsBase ?? 0, baseCurrency)}
                  </SensitiveValue>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  مؤكدة ومقيدة بالدفتر ({data?.summary.paidCount ?? 0} عملية)
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* KPI 2: Projected Annual Income */}
        <Card className="border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#0E1420] shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              الدخل السنوي المتوقع
            </span>
            <div className="size-8 rounded-xl bg-sky-50 text-sky-600 dark:bg-sky-950/40 dark:text-sky-400 flex items-center justify-center">
              <TrendingUp className="size-4" />
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-28" />
            ) : (
              <div className="space-y-1">
                <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white">
                  <SensitiveValue>
                    {formatMoney(data?.summary.projectedAnnualDividendsBase ?? 0, baseCurrency)}
                  </SensitiveValue>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  وفق توزيعات الأسهم الحالية ({data?.summary.projectedCount ?? 0} أصل)
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* KPI 3: Portfolio Dividend Yield */}
        <Card className="border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#0E1420] shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              عائد التوزيعات الحالي (Div Yield)
            </span>
            <div className="size-8 rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400 flex items-center justify-center">
              <Percent className="size-4" />
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-28" />
            ) : (
              <div className="space-y-1">
                <div className="text-2xl font-bold font-mono text-indigo-700 dark:text-indigo-400">
                  {data?.summary.portfolioDividendYieldPct.toFixed(2)}%
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  منسوب للقيمة السوقية الحالية
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* KPI 4: Yield on Cost (YoC) */}
        <Card className="border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#0E1420] shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              العائد على التكلفة (Yield on Cost)
            </span>
            <div className="size-8 rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400 flex items-center justify-center">
              <CalendarDays className="size-4" />
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-28" />
            ) : (
              <div className="space-y-1">
                <div className="text-2xl font-bold font-mono text-amber-700 dark:text-amber-400">
                  {data?.summary.portfolioYieldOnCostPct.toFixed(2)}%
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  منسوب لتكلفة الاقتناء الأصلية (FIFO)
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Calendar & Holdings Tables */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Table 1: Dividend Calendar */}
        <Card className="border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#0E1420] shadow-xs">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <CalendarDays className="size-4 text-emerald-600" />
                  <span>جدول توزيعات الأرباح (المدفوعة والمتوقعة)</span>
                </CardTitle>
                <CardDescription className="text-xs mt-1">
                  سجل التوزيعات التاريخية المؤكدة والتوزيعات المستقبلية المستحقة
                </CardDescription>
              </div>
              <Badge variant="outline" className="text-xs font-mono">
                {data?.calendar.length ?? 0} عملية
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-48 w-full" />
            ) : (data?.calendar.length ?? 0) === 0 ? (
              <div className="text-center py-10 text-slate-400 dark:text-slate-500 text-xs">
                لا توجد توزيعات مسجلة أو مجدولة للمحفظة حاليًا.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-right border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold">
                      <th className="py-2.5 px-3">الأصل</th>
                      <th className="py-2.5 px-3">تاريخ الصرف</th>
                      <th className="py-2.5 px-3">المبلغ</th>
                      <th className="py-2.5 px-3">الحالة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-mono">
                    {data?.calendar.map((ev: any) => (
                      <tr key={ev.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                        <td className="py-2.5 px-3 font-sans font-semibold text-slate-900 dark:text-white">
                          <div>{ev.instrumentName}</div>
                          <div className="text-[10px] text-slate-400 font-mono">{ev.ticker}</div>
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400">
                          {ev.paymentDate}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white">
                          <SensitiveValue>{formatMoney(ev.baseAmount, baseCurrency)}</SensitiveValue>
                        </td>
                        <td className="py-2.5 px-3">
                          {getStatusBadge(ev.status)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Table 2: Yield on Cost Breakdown */}
        <Card className="border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#0E1420] shadow-xs">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <FileSpreadsheet className="size-4 text-indigo-600" />
                  <span>تحليل العائد والإنتاجية للأصول (Yield on Cost)</span>
                </CardTitle>
                <CardDescription className="text-xs mt-1">
                  مقارنة العائد السنوي المتوقع لكل حيازة بالنسبة لتكلفتها وقيمتها السوقية
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-48 w-full" />
            ) : (data?.holdingsYield.length ?? 0) === 0 ? (
              <div className="text-center py-10 text-slate-400 dark:text-slate-500 text-xs">
                لا توجد حيازات استثمارية مفتوحة في المحفظة حاليًا.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-right border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold">
                      <th className="py-2.5 px-3">السهم</th>
                      <th className="py-2.5 px-3">الأسهم</th>
                      <th className="py-2.5 px-3">الدخل السنوي</th>
                      <th className="py-2.5 px-3">Yield</th>
                      <th className="py-2.5 px-3">YoC</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-mono">
                    {data?.holdingsYield.map((h: any) => (
                      <tr key={h.instrumentId} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                        <td className="py-2.5 px-3 font-sans font-semibold text-slate-900 dark:text-white">
                          <div>{h.name}</div>
                          <div className="text-[10px] text-slate-400 font-mono">{h.symbol}</div>
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400">
                          {h.sharesCount.toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-emerald-700 dark:text-emerald-400">
                          <SensitiveValue>{formatMoney(h.projectedAnnualIncomeBase, baseCurrency)}</SensitiveValue>
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-indigo-700 dark:text-indigo-400">
                          {h.dividendYieldPct.toFixed(2)}%
                        </td>
                        <td className="py-2.5 px-3 font-bold text-amber-700 dark:text-amber-400">
                          {h.yieldOnCostPct.toFixed(2)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
