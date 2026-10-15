import React, { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatMoney } from "@/lib/financialDisplay";
import SensitiveValue from "@/components/SensitiveValue";
import {
  Wallet,
  Coins,
  ArrowDownLeft,
  ArrowUpRight,
  AlertTriangle,
  CheckCircle2,
  PieChart,
  Layers,
} from "lucide-react";

export function ZeroBasedBudgetMatrix({ periodKey }: { periodKey: string }) {
  const overviewQuery = trpc.family.cashFlow.zeroBasedOverview.useQuery(
    { periodKey },
    { staleTime: 30_000 }
  );

  const data = overviewQuery.data;
  const isLoading = overviewQuery.isLoading;
  const baseCurrency = data?.baseCurrency || "EGP";

  const getVarianceBadge = (status: "under_budget" | "on_track" | "warning" | "exceeded") => {
    switch (status) {
      case "on_track":
      case "under_budget":
        return (
          <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 gap-1 text-[10px]">
            <CheckCircle2 className="size-3" />
            <span>ضمن الخطة</span>
          </Badge>
        );
      case "warning":
        return (
          <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30 gap-1 text-[10px]">
            <AlertTriangle className="size-3" />
            <span>اقتراب من الحد (80%+)</span>
          </Badge>
        );
      case "exceeded":
        return (
          <Badge className="bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30 gap-1 text-[10px]">
            <AlertTriangle className="size-3" />
            <span>تجاوز الميزانية</span>
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Zero-Based Core Banner (Actual Budget Style: "To Be Budgeted") */}
      <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-gradient-to-r from-slate-900 to-slate-800 text-white p-5 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-300 font-semibold uppercase tracking-wider">
                مبدأ الميزانية الصفرية (Zero-Based Envelope)
              </span>
              <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-[10px]">
                Actual Budget Architecture
              </Badge>
            </div>
            <h3 className="text-lg font-bold text-white">
              تخصيص كامل الدخل لظروف وفئات الإنفاق والادخار
            </h3>
            <p className="text-xs text-slate-300">
              كل جنيه يجب أن يُحدد له دور واضح (To Be Budgeted = 0) لضمان انضباط التدفقات
            </p>
          </div>

          <div className="flex items-center gap-6">
            <div className="text-center md:text-right">
              <span className="text-[11px] text-slate-400 block font-medium">إجمالي الدخل المحصل</span>
              <span className="text-xl font-bold font-mono text-emerald-400">
                <SensitiveValue>{formatMoney(data?.totalIncomeActual ?? 0, baseCurrency)}</SensitiveValue>
              </span>
            </div>

            <div className="h-8 w-px bg-slate-700" />

            <div className="text-center md:text-right">
              <span className="text-[11px] text-slate-400 block font-medium">إجمالي المخصص بالميزانية</span>
              <span className="text-xl font-bold font-mono text-sky-400">
                <SensitiveValue>{formatMoney(data?.totalExpenseBudgeted ?? 0, baseCurrency)}</SensitiveValue>
              </span>
            </div>

            <div className="h-8 w-px bg-slate-700" />

            <div className="text-center md:text-right">
              <span className="text-[11px] text-slate-400 block font-medium">المتبقي للتخصيص</span>
              <span className={`text-xl font-bold font-mono ${(data?.toBeBudgeted ?? 0) < 0 ? "text-rose-400" : "text-amber-300"}`}>
                <SensitiveValue>{formatMoney(data?.toBeBudgeted ?? 0, baseCurrency)}</SensitiveValue>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Envelopes Grid / Table */}
      <Card className="border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#0E1420] shadow-xs">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Layers className="size-4 text-emerald-600" />
                <span>أظرف الميزانية الشهرية والإنفاق الفعلي (Envelopes)</span>
              </CardTitle>
              <CardDescription className="text-xs mt-1">
                تتبع المبلغ المخطط، المنصرف الفعلي من الدفتر، ورصيد الترحيل (Rollover) من الشهر السابق
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                {data?.categories.length ?? 0} فئات
              </Badge>
              {(data?.overspentCategoriesCount ?? 0) > 0 && (
                <Badge variant="destructive" className="text-xs">
                  {data?.overspentCategoriesCount} فئات تجاوزت
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : (data?.categories.length ?? 0) === 0 ? (
            <div className="text-center py-10 text-slate-400 dark:text-slate-500 text-xs">
              لم يتم العثور على فئات مسجلة لهذا الشهر.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-right border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold">
                    <th className="py-2.5 px-3">الفئة</th>
                    <th className="py-2.5 px-3">المخطط (Budgeted)</th>
                    <th className="py-2.5 px-3">المنصرف الفعلي</th>
                    <th className="py-2.5 px-3">الترحيل (Rollover)</th>
                    <th className="py-2.5 px-3">المتبقي بالظرف</th>
                    <th className="py-2.5 px-3">نسبة الاستهلاك</th>
                    <th className="py-2.5 px-3">الحالة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-mono">
                  {data?.categories.map((cat) => {
                    const isExpense = cat.direction === "expense";
                    return (
                      <tr key={cat.categoryId} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                        <td className="py-3 px-3 font-sans font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                          <span
                            className="size-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: cat.color || "#10B981" }}
                          />
                          <span>{cat.categoryName}</span>
                          {cat.isEssential && (
                            <Badge variant="outline" className="text-[9px] px-1.5 py-0">
                              أساسي
                            </Badge>
                          )}
                        </td>
                        <td className="py-3 px-3 font-semibold text-slate-900 dark:text-white">
                          <SensitiveValue>{formatMoney(cat.budgetedAmount, baseCurrency)}</SensitiveValue>
                        </td>
                        <td className={`py-3 px-3 font-bold ${isExpense ? "text-slate-800 dark:text-slate-200" : "text-emerald-700 dark:text-emerald-400"}`}>
                          <SensitiveValue>{formatMoney(cat.actualAmount, baseCurrency)}</SensitiveValue>
                        </td>
                        <td className={`py-3 px-3 font-semibold ${cat.rolloverAmount >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                          <SensitiveValue>{formatMoney(cat.rolloverAmount, baseCurrency)}</SensitiveValue>
                        </td>
                        <td className={`py-3 px-3 font-bold ${cat.availableAmount >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400"}`}>
                          <SensitiveValue>{formatMoney(cat.availableAmount, baseCurrency)}</SensitiveValue>
                        </td>
                        <td className="py-3 px-3 font-sans">
                          {isExpense ? (
                            <div className="space-y-1">
                              <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
                                <span>{cat.spentPercentage}%</span>
                              </div>
                              <div className="w-24 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${
                                    cat.spentPercentage > 100
                                      ? "bg-rose-500"
                                      : cat.spentPercentage >= 80
                                      ? "bg-amber-500"
                                      : "bg-emerald-500"
                                  }`}
                                  style={{ width: `${Math.min(100, cat.spentPercentage)}%` }}
                                />
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="py-3 px-3 font-sans">
                          {isExpense ? getVarianceBadge(cat.varianceStatus) : (
                            <Badge variant="outline" className="text-[10px]">دخل محصل</Badge>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
