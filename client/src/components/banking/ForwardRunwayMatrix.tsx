import React, { useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  TrendingUp,
  Clock,
  Coins,
  ShieldCheck,
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  Landmark,
  Calendar,
  Globe2,
  Sparkles,
  CreditCard,
  Repeat,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import SensitiveValue from "@/components/SensitiveValue";
import { formatMoney } from "@/lib/financialDisplay";

export function ForwardRunwayMatrix() {
  const [horizonMonths, setHorizonMonths] = useState<number>(6);
  const runwayQuery = trpc.quant.getForwardRunway.useQuery({ horizonMonths });

  const report = runwayQuery.data;

  if (runwayQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-44 w-full rounded-2xl" />
        <Skeleton className="h-72 w-full rounded-2xl" />
      </div>
    );
  }

  if (!report) {
    return null;
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "EXCELLENT":
        return {
          bg: "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border-emerald-500/30",
          icon: ShieldCheck,
          text: "مدرج أمان نقدي ممتاز",
        };
      case "ADEQUATE":
        return {
          bg: "bg-blue-500/10 text-blue-800 dark:text-blue-300 border-blue-500/30",
          icon: Clock,
          text: "مدرج سيولة تشغيلي كافٍ",
        };
      case "CAUTION":
        return {
          bg: "bg-amber-500/10 text-amber-800 dark:text-amber-300 border-amber-500/30",
          icon: AlertTriangle,
          text: "تحذير: مدرج السيولة محدود",
        };
      case "CRITICAL":
      default:
        return {
          bg: "bg-rose-500/10 text-rose-800 dark:text-rose-300 border-rose-500/30",
          icon: AlertTriangle,
          text: "حرج: استنزاف السيولة سريع",
        };
    }
  };

  const statusBadge = getStatusBadge(report.runwayStatus);
  const StatusIcon = statusBadge.icon;

  return (
    <div className="space-y-6" dir="rtl">
      {/* Top Header & Horizon Selector */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white dark:bg-[#0B0F17] p-5 rounded-2xl border border-slate-200/90 dark:border-slate-800/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <TrendingUp className="size-5" />
            </span>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              محرك مدرج السيولة والتوقعات المستقبلية (Forward Runway Engine)
            </h3>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            محاكاة نقدية حية تدمج الاشتراكات الدورية (5 دورات)، عوائد واستحقاقات الشهادات البنكية، وأقساط بطاقات الائتمان.
          </p>
        </div>

        {/* Horizon Period Selector */}
        <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-900/60 p-1 rounded-xl border border-slate-200 dark:border-slate-800 self-stretch sm:self-auto justify-center">
          {[3, 6, 12].map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setHorizonMonths(m)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                horizonMonths === m
                  ? "bg-white dark:bg-[#1A2234] text-slate-950 dark:text-white shadow-xs border border-slate-200/80 dark:border-slate-700"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              {m} أشهر
            </button>
          ))}
        </div>
      </div>

      {/* 4 Summary Metric Tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Safe Runway Months */}
        <div className="p-5 rounded-2xl bg-white dark:bg-[#0B0F17] border border-slate-200/90 dark:border-slate-800/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
              مدرج الأمان النقدي (Runway)
            </span>
            <div className={`p-1.5 rounded-lg border text-xs font-bold flex items-center gap-1 ${statusBadge.bg}`}>
              <StatusIcon className="size-3.5" />
            </div>
          </div>
          <div className="my-2">
            <strong className="text-2xl sm:text-3xl font-bold font-mono text-slate-950 dark:text-white tabular-nums block" dir="ltr">
              {report.safeRunwayMonths > 90 ? "> 99" : report.safeRunwayMonths.toFixed(1)} <span className="text-sm font-normal">شهر</span>
            </strong>
          </div>
          <span className="text-[11px] text-slate-500 font-medium block truncate">
            {report.runwayStatusAr}
          </span>
        </div>

        {/* Metric 2: Starting Liquid EGP */}
        <div className="p-5 rounded-2xl bg-white dark:bg-[#0B0F17] border border-slate-200/90 dark:border-slate-800/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
              السيولة المحلية الحرة الحالية
            </span>
            <div className="size-7 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Landmark className="size-4" />
            </div>
          </div>
          <div className="my-2">
            <strong className="text-xl sm:text-2xl font-bold font-mono text-emerald-700 dark:text-emerald-400 tabular-nums block" dir="ltr">
              <SensitiveValue>{formatMoney(report.startingLiquidEgp, "EGP")}</SensitiveValue>
            </strong>
          </div>
          <span className="text-[11px] text-slate-500 font-medium block">
            رصيد البنوك والمحافظ النقدية بالجنية المصري
          </span>
        </div>

        {/* Metric 3: Monthly Burn Rate */}
        <div className="p-5 rounded-2xl bg-white dark:bg-[#0B0F17] border border-slate-200/90 dark:border-slate-800/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
              الاستنزاف الشهري الدوري (Burn)
            </span>
            <div className="size-7 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center">
              <ArrowUpRight className="size-4" />
            </div>
          </div>
          <div className="my-2">
            <strong className="text-xl sm:text-2xl font-bold font-mono text-slate-900 dark:text-white tabular-nums block" dir="ltr">
              <SensitiveValue>{formatMoney(report.monthlyBurnRateEgp, "EGP")}</SensitiveValue>
            </strong>
          </div>
          <span className="text-[11px] text-slate-500 font-medium block">
            التزامات دورية + أدنى سداد بطاقات وأقساط
          </span>
        </div>

        {/* Metric 4: Projected Ending Balance */}
        <div className="p-5 rounded-2xl bg-white dark:bg-[#0B0F17] border border-slate-200/90 dark:border-slate-800/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
              الرصيد المتوقع بعد {horizonMonths} أشهر
            </span>
            <div className="size-7 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Calendar className="size-4" />
            </div>
          </div>
          <div className="my-2">
            <strong className="text-xl sm:text-2xl font-bold font-mono text-slate-950 dark:text-white tabular-nums block" dir="ltr">
              <SensitiveValue>{formatMoney(report.projectedEndingBalanceEgp, "EGP")}</SensitiveValue>
            </strong>
          </div>
          <span className={`text-[11px] font-semibold block ${report.net6MonthDeltaEgp >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
            صافي الحركة: {report.net6MonthDeltaEgp >= 0 ? "+" : ""}{formatMoney(report.net6MonthDeltaEgp, "EGP")}
          </span>
        </div>
      </div>

      {/* Foreign Currency Reserves Partition (USD, EUR, SAR) */}
      {report.foreignCurrencyBalances && report.foreignCurrencyBalances.length > 0 && (
        <div className="p-5 rounded-2xl bg-slate-50 dark:bg-[#0E1420] border border-slate-200/80 dark:border-slate-800">
          <div className="flex items-center gap-2 mb-3">
            <Globe2 className="size-4 text-emerald-600 dark:text-emerald-400" />
            <h4 className="text-xs font-bold text-slate-900 dark:text-white">
              مخزون الأمان من العملات الأجنبية (مفصولة عن تدفقات الجنيه المصري)
            </h4>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {report.foreignCurrencyBalances.map((fc) => (
              <div
                key={fc.currency}
                className="p-3.5 rounded-xl bg-white dark:bg-[#0B0F17] border border-slate-200/80 dark:border-white/5 flex items-center justify-between"
              >
                <div>
                  <span className="text-[10px] text-slate-500 font-bold block">{fc.currency} احتياطي حر</span>
                  <strong className="text-base font-bold font-mono text-slate-900 dark:text-white block mt-0.5" dir="ltr">
                    <SensitiveValue>{formatMoney(fc.totalAmount, fc.currency)}</SensitiveValue>
                  </strong>
                </div>
                <div className="text-left">
                  <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded-md">
                    تغطية ~{fc.estimatedMonthsCoverage} شهر
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Month-by-Month Forward Timeline Table */}
      <div className="bg-white dark:bg-[#0B0F17] rounded-2xl border border-slate-200/90 dark:border-slate-800/80 overflow-hidden shadow-xs">
        <div className="p-4 border-b border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between">
          <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Clock className="size-4 text-emerald-600 dark:text-emerald-400" />
            <span>جدول التدفقات التراكمية الشهرية للأشهر الـ {horizonMonths} القادمة</span>
          </h4>
          <span className="text-[11px] text-slate-500 font-mono">
            جميع القيم بالجنيه المصري (EGP)
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50/80 dark:bg-slate-900/40 text-slate-500 dark:text-slate-400 text-[11px] font-semibold border-b border-slate-200/80 dark:border-slate-800/80">
              <tr>
                <th className="py-3 px-4">الشهر</th>
                <th className="py-3 px-4">رصيد أول المدة</th>
                <th className="py-3 px-4">عوائد الشهادات الدورية</th>
                <th className="py-3 px-4">استرداد أصل الشهادات</th>
                <th className="py-3 px-4">استنزاف الاشتراكات</th>
                <th className="py-3 px-4">أقساط الديون والبطاقات</th>
                <th className="py-3 px-4">صافي التدفق الشهري</th>
                <th className="py-3 px-4 font-bold text-slate-900 dark:text-white">رصيد نهاية المدة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800/60">
              {report.timeline.map((m) => (
                <tr key={m.monthKey} className="hover:bg-slate-50/60 dark:hover:bg-white/[0.02] transition-colors">
                  <td className="py-3 px-4 font-bold text-slate-900 dark:text-slate-100">
                    {m.monthNameAr} <span className="text-[10px] text-slate-500 font-mono">({m.monthKey})</span>
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-700 dark:text-slate-300" dir="ltr">
                    <SensitiveValue>{formatMoney(m.startingBalanceEgp, "EGP")}</SensitiveValue>
                  </td>
                  <td className="py-3 px-4 font-mono text-emerald-600 dark:text-emerald-400" dir="ltr">
                    {m.certificateYieldEgp > 0 ? (
                      <SensitiveValue>{`+${formatMoney(m.certificateYieldEgp, "EGP")}`}</SensitiveValue>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="py-3 px-4 font-mono text-teal-600 dark:text-teal-400" dir="ltr">
                    {m.maturingPrincipalEgp > 0 ? (
                      <SensitiveValue>{`+${formatMoney(m.maturingPrincipalEgp, "EGP")}`}</SensitiveValue>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="py-3 px-4 font-mono text-rose-600 dark:text-rose-400" dir="ltr">
                    {m.subscriptionsBurnEgp > 0 ? (
                      <SensitiveValue>{`-${formatMoney(m.subscriptionsBurnEgp, "EGP")}`}</SensitiveValue>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="py-3 px-4 font-mono text-rose-600 dark:text-rose-400" dir="ltr">
                    {m.debtInstallmentsEgp > 0 ? (
                      <SensitiveValue>{`-${formatMoney(m.debtInstallmentsEgp, "EGP")}`}</SensitiveValue>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td
                    className={`py-3 px-4 font-mono font-bold ${
                      m.netMonthlyDeltaEgp >= 0
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-rose-600 dark:text-rose-400"
                    }`}
                    dir="ltr"
                  >
                    <SensitiveValue>
                      {`${m.netMonthlyDeltaEgp >= 0 ? "+" : ""}${formatMoney(m.netMonthlyDeltaEgp, "EGP")}`}
                    </SensitiveValue>
                  </td>
                  <td className="py-3 px-4 font-mono font-bold text-slate-950 dark:text-white" dir="ltr">
                    <SensitiveValue>{formatMoney(m.endingBalanceEgp, "EGP")}</SensitiveValue>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
