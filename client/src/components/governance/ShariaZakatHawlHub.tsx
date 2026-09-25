import React, { useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  Coins,
  ShieldCheck,
  Clock,
  Scale,
  Calendar,
  AlertCircle,
  HelpCircle,
  Sparkles,
  BookOpen,
  ArrowDownLeft,
  CheckCircle2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import SensitiveValue from "@/components/SensitiveValue";
import { formatMoney } from "@/lib/financialDisplay";

export function ShariaZakatHawlHub() {
  const [customPrice, setCustomPrice] = useState<string>("");
  const zakatQuery = trpc.quant.getShariaZakat.useQuery(
    customPrice ? { customGoldPrice24k: parseFloat(customPrice) } : undefined
  );

  const data = zakatQuery.data;

  if (zakatQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-44 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const getHawlBadge = () => {
    switch (data.hawlCountdown.status) {
      case "DUE_NOW":
        return {
          bg: "bg-emerald-600 text-white border-emerald-600",
          text: "وجبت الزكاة شرعاً (اكتمل الحول والنصاب)",
          icon: CheckCircle2,
        };
      case "ACCUMULATING":
        return {
          bg: "bg-blue-500/10 text-blue-800 dark:text-blue-300 border-blue-500/30",
          text: `الحول جارٍ — متبقي ${data.hawlCountdown.remainingDays} يوماً قمرياً`,
          icon: Clock,
        };
      case "BELOW_NISAB":
      default:
        return {
          bg: "bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/30",
          text: "دون النصاب الشرعي للذهب",
          icon: AlertCircle,
        };
    }
  };

  const hawlBadge = getHawlBadge();
  const HawlIcon = hawlBadge.icon;
  const progressPercent = Math.min(
    100,
    Math.round((data.hawlCountdown.elapsedDays / data.hawlCountdown.totalLunarDays) * 100)
  );

  return (
    <div className="space-y-6" dir="rtl">
      {/* Top Banner: Gold Nisab Live Tracking */}
      <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent dark:from-amber-500/15 dark:via-transparent border border-amber-500/25 rounded-2xl p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/30 shrink-0">
              <Coins className="size-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  محرك الزكاة الشرعية وحول الذهب (AAOIFI Standard No. 9)
                </h3>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-500/30">
                  نصاب 85 جرام عيار 24
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                تتبع ديناميكي لحظي لنصاب الذهب بناءً على أسعار السوق المحلي، مع تصنيف الأصول وتتبع الحول القمري (354 يوماً).
              </p>
            </div>
          </div>

          <div className="bg-white dark:bg-[#0B0F17] p-3 rounded-xl border border-amber-500/30 flex items-center gap-3 shrink-0 self-stretch sm:self-auto justify-between">
            <div>
              <span className="text-[10px] text-slate-500 font-bold block">سعر جرام الذهب عيار 24 اليوم</span>
              <strong className="text-sm font-bold font-mono text-amber-600 dark:text-amber-400 block" dir="ltr">
                {data.gold24kPricePerGram.toLocaleString("en-US")} ج.م / جرام
              </strong>
            </div>
            <div className="text-left border-r pr-3 border-slate-200 dark:border-white/10">
              <span className="text-[10px] text-slate-500 font-bold block">قيمة النصاب الشرعي</span>
              <strong className="text-sm font-bold font-mono text-slate-900 dark:text-white block" dir="ltr">
                <SensitiveValue>{formatMoney(data.nisabValueEgp, "EGP")}</SensitiveValue>
              </strong>
            </div>
          </div>
        </div>
      </div>

      {/* Hawl Tracker Card & Due Countdown */}
      <div className="bg-white dark:bg-[#0B0F17] p-5 rounded-2xl border border-slate-200/90 dark:border-slate-800/80 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Clock className="size-4 text-emerald-600 dark:text-emerald-400" />
            <h4 className="text-xs font-bold text-slate-900 dark:text-white">
              عداد الحول القمري الشرعي (Lunar Hawl Tracker)
            </h4>
          </div>
          <div className={`px-2.5 py-1 rounded-xl text-xs font-bold border flex items-center gap-1.5 ${hawlBadge.bg}`}>
            <HawlIcon className="size-3.5" />
            <span>{hawlBadge.text}</span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs font-mono text-slate-500">
            <span>انقضى: {data.hawlCountdown.elapsedDays} يوم</span>
            <span>الحول الكامل: {data.hawlCountdown.totalLunarDays} يوم قمري ({progressPercent}%)</span>
            <span>تاريخ الوجوب: {data.hawlCountdown.dueDateFormattedAr}</span>
          </div>
          <div className="w-full h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                data.hawlCountdown.isDue
                  ? "bg-emerald-600 dark:bg-emerald-500"
                  : "bg-amber-500"
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* 4 Primary Zakat Metric Tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Total Gross Wealth */}
        <div className="p-5 rounded-2xl bg-white dark:bg-[#0B0F17] border border-slate-200/90 dark:border-slate-800/80 shadow-xs flex flex-col justify-between">
          <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
            إجمالي الثروة المسجلة
          </span>
          <div className="my-2">
            <strong className="text-xl sm:text-2xl font-bold font-mono text-slate-950 dark:text-white tabular-nums block" dir="ltr">
              <SensitiveValue>{formatMoney(data.totalGrossWealthEgp, "EGP")}</SensitiveValue>
            </strong>
          </div>
          <span className="text-[11px] text-slate-500 font-medium block">
            نقدية + ذهب + محافظ أسهم
          </span>
        </div>

        {/* Metric 2: Deductible Debts */}
        <div className="p-5 rounded-2xl bg-white dark:bg-[#0B0F17] border border-slate-200/90 dark:border-slate-800/80 shadow-xs flex flex-col justify-between">
          <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
            الديون العاجلة واجبة الخصم
          </span>
          <div className="my-2">
            <strong className="text-xl sm:text-2xl font-bold font-mono text-rose-600 dark:text-rose-400 tabular-nums block" dir="ltr">
              <SensitiveValue>{`-${formatMoney(data.deductibleDebtsEgp, "EGP")}`}</SensitiveValue>
            </strong>
          </div>
          <span className="text-[11px] text-slate-500 font-medium block">
            تُخصم الالتزامات واجبة السداد فوراً
          </span>
        </div>

        {/* Metric 3: Net Zakatable Base */}
        <div className="p-5 rounded-2xl bg-white dark:bg-[#0B0F17] border border-slate-200/90 dark:border-slate-800/80 shadow-xs flex flex-col justify-between">
          <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
            صافي الوعاء الزكوي الخاضع
          </span>
          <div className="my-2">
            <strong className="text-xl sm:text-2xl font-bold font-mono text-blue-600 dark:text-blue-400 tabular-nums block" dir="ltr">
              <SensitiveValue>{formatMoney(data.netZakatableWealthEgp, "EGP")}</SensitiveValue>
            </strong>
          </div>
          <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 block">
            {data.isAboveNisab ? "✓ بلغ النصاب الشرعي" : "دون النصاب"}
          </span>
        </div>

        {/* Metric 4: Total Zakat Due */}
        <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-teal-500/5 dark:from-emerald-500/15 dark:to-transparent border border-emerald-500/30 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
              إجمالي فريضة الزكاة الواجبة (2.5%)
            </span>
            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-600 text-white">
              2.5%
            </span>
          </div>
          <div className="my-2">
            <strong className="text-2xl sm:text-3xl font-black font-mono text-emerald-700 dark:text-emerald-300 tabular-nums block" dir="ltr">
              <SensitiveValue>{formatMoney(data.totalZakatDueEgp, "EGP")}</SensitiveValue>
            </strong>
          </div>
          <span className="text-[11px] text-slate-600 dark:text-slate-400 font-medium block">
            {data.hawlCountdown.isDue ? "واجبة الإخراج الفوري للمستحقين" : "القيمة المقدرة عند اكتمال الحول"}
          </span>
        </div>
      </div>

      {/* Asset Breakdown Sheet Table per AAOIFI Standard */}
      <div className="bg-white dark:bg-[#0B0F17] rounded-2xl border border-slate-200/90 dark:border-slate-800/80 overflow-hidden shadow-xs">
        <div className="p-4 border-b border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between">
          <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Scale className="size-4 text-emerald-600 dark:text-emerald-400" />
            <span>بيان تفصيل الأصول وتطبيق الفتوى الشرعية (AAOIFI Standard No. 9)</span>
          </h4>
          <span className="text-[11px] text-slate-500 font-mono">
            النسبة المقررة: 2.5% للسنة الهجرية
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50/80 dark:bg-slate-900/40 text-slate-500 dark:text-slate-400 text-[11px] font-semibold border-b border-slate-200/80 dark:border-slate-800/80">
              <tr>
                <th className="py-3 px-4">الفئة الزكوية</th>
                <th className="py-3 px-4">القيمة السوقية الإجمالية</th>
                <th className="py-3 px-4">نسبة الوعاء الخاضع</th>
                <th className="py-3 px-4">الوعاء الزكوي الصافي</th>
                <th className="py-3 px-4">مقدار الزكاة (2.5%)</th>
                <th className="py-3 px-4">الحكم والتكييف الشرعي</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800/60">
              {data.assetBreakdown.map((b) => (
                <tr key={b.categoryKey} className="hover:bg-slate-50/60 dark:hover:bg-white/[0.02] transition-colors">
                  <td className="py-3 px-4 font-bold text-slate-900 dark:text-slate-100">
                    {b.labelAr}
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-700 dark:text-slate-300" dir="ltr">
                    <SensitiveValue>{formatMoney(b.grossAmountEgp, "EGP")}</SensitiveValue>
                  </td>
                  <td className="py-3 px-4 font-mono font-semibold text-blue-600 dark:text-blue-400">
                    {b.zakatablePercentage}%
                  </td>
                  <td className="py-3 px-4 font-mono font-semibold text-slate-900 dark:text-slate-100" dir="ltr">
                    <SensitiveValue>{formatMoney(b.zakatableAmountEgp, "EGP")}</SensitiveValue>
                  </td>
                  <td className="py-3 px-4 font-mono font-bold text-emerald-600 dark:text-emerald-400" dir="ltr">
                    <SensitiveValue>{formatMoney(b.zakatDueEgp, "EGP")}</SensitiveValue>
                  </td>
                  <td className="py-3 px-4 text-[11px] text-slate-600 dark:text-slate-400 max-w-xs">
                    {b.shariaRuleAr}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sharia Ruling Notes */}
      <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200/80 dark:border-slate-800 space-y-1.5">
        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200">
          <BookOpen className="size-3.5 text-emerald-600 dark:text-emerald-400" />
          <span>ضوابط الاحتساب الشرعي المعتمدة:</span>
        </div>
        <ul className="list-disc list-inside text-xs text-slate-600 dark:text-slate-400 space-y-1">
          {data.rulingNotesAr.map((note, idx) => (
            <li key={idx}>{note}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
