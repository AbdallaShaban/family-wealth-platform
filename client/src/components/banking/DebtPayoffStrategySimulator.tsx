import React, { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { formatMoney } from "@/lib/financialDisplay";
import SensitiveValue from "@/components/SensitiveValue";
import {
  Flame,
  Snowflake,
  ShieldAlert,
  TrendingDown,
  Calendar,
  Sparkles,
  ArrowRight,
  Clock,
  ShieldCheck,
} from "lucide-react";

export function DebtPayoffStrategySimulator() {
  const [extraPayment, setExtraPayment] = useState<number>(1000);

  const comparisonQuery = trpc.family.debts.snowballAvalancheComparison.useQuery(
    { extraMonthlyPayment: extraPayment },
    { staleTime: 30_000 }
  );

  const data = comparisonQuery.data;
  const isLoading = comparisonQuery.isLoading;
  const baseCurrency = data?.currency || "EGP";

  return (
    <div className="space-y-6" dir="rtl">
      {/* Strategy Control & Overview Banner */}
      <Card className="border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#0E1420] shadow-xs">
        <CardHeader className="pb-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Flame className="size-4 text-amber-500" />
                  <span>محاكاة استراتيجيات التخلص من الديون (Snowball vs. Avalanche)</span>
                </CardTitle>
                <Badge variant="outline" className="text-xs">
                  محاكاة رياضية نقية
                </Badge>
              </div>
              <CardDescription className="text-xs mt-1">
                مقارنة علمية دقيقة بين طريقتي كرة الثلج (الأصغر رصيداً) والانهيار الجليدي (الأعلى فائدة) لتسريع التحرر المالي
              </CardDescription>
            </div>

            {/* Extra Payment Input */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 whitespace-nowrap">
                السداد الإضافي الشهري:
              </span>
              <div className="relative w-36">
                <Input
                  type="number"
                  min={0}
                  step={100}
                  value={extraPayment}
                  onChange={(e) => setExtraPayment(Math.max(0, Number(e.target.value) || 0))}
                  className="font-mono text-left pl-10 text-xs h-9"
                />
                <span className="absolute left-2.5 top-2 text-[10px] text-slate-400 font-mono">
                  {baseCurrency}
                </span>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800 text-center">
            <div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-medium">إجمالي أصل الديون</span>
              <span className="text-lg font-bold font-mono text-slate-900 dark:text-white">
                <SensitiveValue>{formatMoney(data?.totalDebtBalance ?? 0, baseCurrency)}</SensitiveValue>
              </span>
            </div>
            <div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-medium">الحد الأدنى الشهري الحالي</span>
              <span className="text-lg font-bold font-mono text-slate-900 dark:text-white">
                <SensitiveValue>{formatMoney(data?.totalMonthlyMinimum ?? 0, baseCurrency)}</SensitiveValue>
              </span>
            </div>
            <div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-medium">الالتزامات النشطة</span>
              <span className="text-lg font-bold font-mono text-slate-900 dark:text-white">
                {data?.debtsCount ?? 0}
              </span>
            </div>
            <div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-medium">فترة الأمان النقدي (Runway)</span>
              <span className="text-lg font-bold font-mono text-emerald-600 dark:text-emerald-400">
                {data?.cashRunwayMonths ? `${data.cashRunwayMonths.toFixed(1)} شهر` : "—"}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recommended Strategy Insight Card */}
      {data && data.debtsCount > 0 && (
        <div className="rounded-xl border border-indigo-500/30 bg-indigo-50/50 dark:bg-indigo-950/20 p-4 text-xs shadow-xs">
          <div className="flex items-start gap-3">
            <Sparkles className="size-5 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <strong className="font-bold text-slate-900 dark:text-white text-sm">
                  التوصية الاستراتيجية الذكية:
                </strong>
                <Badge className="bg-indigo-600 text-white text-[10px]">
                  {data.recommendedStrategy === "avalanche" ? "الانهيار الجليدي (Avalanche)" : "كرة الثلج (Snowball)"}
                </Badge>
              </div>
              <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                {data.recommendationReason}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Side-by-Side 3 Strategy Cards */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Strategy 1: Baseline */}
        <Card className="border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#0E1420] shadow-xs flex flex-col justify-between">
          <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">السيناريو التعاقدي</span>
              <Clock className="size-4 text-slate-400" />
            </div>
            <CardTitle className="text-base font-bold text-slate-800 dark:text-slate-200 mt-1">
              سداد الحد الأدنى فقط
            </CardTitle>
            <CardDescription className="text-xs">
              الالتزام بالدفعات الدنيا الشهرية دون أي تسريع
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            {isLoading ? (
              <Skeleton className="h-28 w-full" />
            ) : (
              <div className="space-y-3 font-mono">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 font-sans">مدة السداد المتوقعة:</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {data?.baseline.totalMonths} شهر
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 font-sans">تاريخ التحرر من الديون:</span>
                  <span className="font-bold text-slate-700 dark:text-slate-300">
                    {data?.baseline.debtFreeDateStr}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 font-sans">إجمالي الفوائد المدفوعة:</span>
                  <span className="font-bold text-rose-600 dark:text-rose-400">
                    <SensitiveValue>{formatMoney(data?.baseline.totalInterestPaid ?? 0, baseCurrency)}</SensitiveValue>
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs border-t border-slate-100 dark:border-slate-800 pt-2 font-bold">
                  <span className="text-slate-700 dark:text-slate-300 font-sans">التكلفة الكلية للدين:</span>
                  <span className="text-slate-900 dark:text-white">
                    <SensitiveValue>{formatMoney(data?.baseline.totalCost ?? 0, baseCurrency)}</SensitiveValue>
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Strategy 2: Snowball */}
        <Card className={`border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#0E1420] shadow-xs flex flex-col justify-between ${data?.recommendedStrategy === "snowball" ? "ring-2 ring-indigo-500" : ""}`}>
          <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-sky-600 dark:text-sky-400">زخم نفسي أسرع</span>
              <Snowflake className="size-4 text-sky-500" />
            </div>
            <CardTitle className="text-base font-bold text-slate-900 dark:text-white mt-1">
              كرة الثلج (Debt Snowball)
            </CardTitle>
            <CardDescription className="text-xs">
              سداد أصغر رصيد أولاً لتعزيز الانضباط النفسي
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            {isLoading ? (
              <Skeleton className="h-28 w-full" />
            ) : (
              <div className="space-y-3 font-mono">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 font-sans">مدة السداد المتوقعة:</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    {data?.snowball.totalMonths} شهر
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 font-sans">تسريع التحرر بمقدار:</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    +{data?.snowball.monthsSavedVsBaseline} شهر
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 font-sans">تاريخ التحرر:</span>
                  <span className="font-bold text-slate-700 dark:text-slate-300">
                    {data?.snowball.debtFreeDateStr}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 font-sans">الفوائد التي تم توفيرها:</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    <SensitiveValue>{formatMoney(data?.snowball.interestSavedVsBaseline ?? 0, baseCurrency)}</SensitiveValue>
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Strategy 3: Avalanche */}
        <Card className={`border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#0E1420] shadow-xs flex flex-col justify-between ${data?.recommendedStrategy === "avalanche" ? "ring-2 ring-emerald-500" : ""}`}>
          <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">الأعلى توفيراً للفوائد</span>
              <Flame className="size-4 text-emerald-500" />
            </div>
            <CardTitle className="text-base font-bold text-slate-900 dark:text-white mt-1">
              الانهيار الجليدي (Debt Avalanche)
            </CardTitle>
            <CardDescription className="text-xs">
              استهداف الدين ذو الفائدة الأعلى رياضياً أولاً
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            {isLoading ? (
              <Skeleton className="h-28 w-full" />
            ) : (
              <div className="space-y-3 font-mono">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 font-sans">مدة السداد المتوقعة:</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    {data?.avalanche.totalMonths} شهر
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 font-sans">تسريع التحرر بمقدار:</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    +{data?.avalanche.monthsSavedVsBaseline} شهر
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 font-sans">تاريخ التحرر:</span>
                  <span className="font-bold text-slate-700 dark:text-slate-300">
                    {data?.avalanche.debtFreeDateStr}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 font-sans">الفوائد التي تم توفيرها:</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    <SensitiveValue>{formatMoney(data?.avalanche.interestSavedVsBaseline ?? 0, baseCurrency)}</SensitiveValue>
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
