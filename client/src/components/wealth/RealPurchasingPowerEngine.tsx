import React, { useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  ShieldAlert,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Percent,
  Coins,
  Building2,
  Landmark,
  Wallet,
  Sparkles,
  Info,
  Scale,
  Flame,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import SensitiveValue from "@/components/SensitiveValue";
import { formatMoney } from "@/lib/financialDisplay";

interface RealPurchasingPowerEngineProps {
  compact?: boolean;
}

export function RealPurchasingPowerEngine({ compact = false }: RealPurchasingPowerEngineProps) {
  const [inflationInput, setInflationInput] = useState<number>(26.5);
  const inflationQuery = trpc.quant.getInflationAnalytics.useQuery({
    baselineInflationPct: inflationInput,
  });

  const report = inflationQuery.data;

  if (inflationQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  if (!report) {
    return null;
  }

  const getScoreColor = (score: number) => {
    if (score >= 70) return "text-emerald-700 dark:text-emerald-400";
    if (score >= 40) return "text-amber-700 dark:text-amber-400";
    return "text-rose-700 dark:text-rose-400";
  };

  const getScoreBg = (score: number) => {
    if (score >= 70) return "bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-300";
    if (score >= 40) return "bg-amber-500/10 border-amber-500/30 text-amber-800 dark:text-amber-300";
    return "bg-rose-500/10 border-rose-500/30 text-rose-800 dark:text-rose-300";
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Executive Card: مؤشر الحفاظ على الثروة الحقيقية */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 text-white p-6 rounded-3xl border border-slate-800 shadow-md relative overflow-hidden">
        {/* Subtle background glow */}
        <div className="absolute -top-24 -left-24 size-72 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 size-72 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  <ShieldCheck className="size-5" />
                </span>
                <h3 className="text-lg font-black tracking-tight text-white">
                  مؤشر الحفاظ على الثروة الحقيقية ودرع التضخم
                </h3>
              </div>
              <p className="text-xs text-slate-300">
                قياس صافي العائد الحقيقي للمحفظة بعد استقطاع معدل التضخم السنوي (Fisher Equation: R_real = R_nominal - Inflation).
              </p>
            </div>

            {/* Baseline Inflation Tag */}
            <div className="flex items-center gap-2 bg-white/5 border border-white/10 px-3 py-1.5 rounded-xl text-xs font-mono">
              <span className="text-slate-400">معدل التضخم القياسي:</span>
              <strong className="text-amber-300 font-bold">{report.baselineInflationPct}%</strong>
            </div>
          </div>

          {/* 3 Executive Highlight Columns */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Col 1: Wealth Preservation Score (0-100) */}
            <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center gap-4">
              <div className="size-16 rounded-2xl bg-white/5 border border-white/10 flex flex-col items-center justify-center shrink-0">
                <span className={`text-2xl font-black font-mono tabular-nums ${getScoreColor(report.wealthPreservationScore)}`}>
                  {report.wealthPreservationScore}
                </span>
                <span className="text-[9px] text-slate-400 font-bold">/ 100</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold block">كفاءة درع الثروة</span>
                <span className={`inline-block text-xs font-bold px-2 py-0.5 rounded-md mt-1 border ${getScoreBg(report.wealthPreservationScore)}`}>
                  {report.preservationStatusAr}
                </span>
              </div>
            </div>

            {/* Col 2: Weighted Real Yield */}
            <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-400 font-bold block">العائد الحقيقي الموزون (Real Yield)</span>
                <strong
                  className={`text-2xl font-black font-mono block mt-1 ${
                    report.weightedRealYieldPct >= 0 ? "text-emerald-400" : "text-rose-400"
                  }`}
                  dir="ltr"
                >
                  {report.weightedRealYieldPct >= 0 ? "+" : ""}
                  {report.weightedRealYieldPct}%
                </strong>
                <span className="text-[10px] text-slate-400 font-mono">
                  (العائد الاسمي {report.weightedNominalYieldPct}% - التضخم {report.baselineInflationPct}%)
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-white/5 border border-white/10">
                {report.weightedRealYieldPct >= 0 ? (
                  <TrendingUp className="size-5 text-emerald-400" />
                ) : (
                  <TrendingDown className="size-5 text-rose-400" />
                )}
              </div>
            </div>

            {/* Col 3: Net Annual Real Drag / Purchasing Power Gain */}
            <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-400 font-bold block">
                  {report.netAnnualRealDragEgp >= 0 ? "صافي نمو القوة الشرائية سنوياً" : "إجمالي تآكل القوة الشرائية سنوياً"}
                </span>
                <strong
                  className={`text-xl font-black font-mono block mt-1 ${
                    report.netAnnualRealDragEgp >= 0 ? "text-emerald-400" : "text-rose-400"
                  }`}
                  dir="ltr"
                >
                  <SensitiveValue>
                    {`${report.netAnnualRealDragEgp >= 0 ? "+" : ""}${formatMoney(report.netAnnualRealDragEgp, "EGP")}`}
                  </SensitiveValue>
                </strong>
                <span className="text-[10px] text-slate-400">
                  {report.netAnnualRealDragEgp >= 0 ? "نمو يفوق معدلات التضخم" : "خسارة فعلية بالقوة الشرائية"}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-white/5 border border-white/10">
                {report.netAnnualRealDragEgp >= 0 ? (
                  <ShieldCheck className="size-5 text-emerald-400" />
                ) : (
                  <Flame className="size-5 text-rose-400" />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Asset Buckets Benchmark Grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Scale className="size-4 text-emerald-600 dark:text-emerald-400" />
            <span>معايرة فئات الأصول ضد التضخم (Protected vs. Eroding Benchmarks)</span>
          </h4>
          <span className="text-[11px] text-slate-500 font-mono">
            خط الأساس: {report.baselineInflationPct}%
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {report.buckets.map((b) => {
            const isProtected = b.status === "PROTECTED";
            return (
              <div
                key={b.bucketKey}
                className={`p-4 rounded-2xl border transition-all ${
                  isProtected
                    ? "bg-white dark:bg-[#0B0F17] border-emerald-500/30 hover:border-emerald-500/50 shadow-xs"
                    : "bg-white dark:bg-[#0B0F17] border-rose-500/30 hover:border-rose-500/50 shadow-xs"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                    {b.labelAr}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold ${
                      isProtected
                        ? "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30"
                        : "bg-rose-500/10 text-rose-800 dark:text-rose-300 border border-rose-500/30"
                    }`}
                  >
                    {isProtected ? (
                      <>
                        <ShieldCheck className="size-3" />
                        <span>درع التضخم (محمي)</span>
                      </>
                    ) : (
                      <>
                        <TrendingDown className="size-3" />
                        <span>تآكل القوة الشرائية</span>
                      </>
                    )}
                  </span>
                </div>

                {/* Nominal Value & Weight */}
                <div className="my-2">
                  <strong className="text-base font-bold font-mono text-slate-900 dark:text-white block" dir="ltr">
                    <SensitiveValue>{formatMoney(b.nominalValueEgp, "EGP")}</SensitiveValue>
                  </strong>
                  <span className="text-[10px] text-slate-500 font-mono">
                    الوزن النسبي: {b.weightPct}% من المحفظة
                  </span>
                </div>

                {/* Returns Breakdown */}
                <div className="pt-2 border-t border-slate-100 dark:border-white/5 space-y-1 text-[11px] font-mono">
                  <div className="flex items-center justify-between text-slate-500">
                    <span>العائد الاسمي:</span>
                    <strong className="text-slate-800 dark:text-slate-200">+{b.nominalYieldPct}%</strong>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">العائد الحقيقي الصافي:</span>
                    <strong className={isProtected ? "text-emerald-600 dark:text-emerald-400 font-bold" : "text-rose-600 dark:text-rose-400 font-bold"}>
                      {b.realYieldPct >= 0 ? "+" : ""}{b.realYieldPct}%
                    </strong>
                  </div>
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-slate-500">الأثر النقدي السنوي:</span>
                    <strong className={b.annualMonetaryDragEgp >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}>
                      <SensitiveValue>{`${b.annualMonetaryDragEgp >= 0 ? "+" : ""}${formatMoney(b.annualMonetaryDragEgp, "EGP")}`}</SensitiveValue>
                    </strong>
                  </div>
                </div>

                <p className="text-[10px] text-slate-500 mt-2 line-clamp-2">
                  {b.descriptionAr}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Strategic Guidance Bulletins */}
      {report.recommendationsAr && report.recommendationsAr.length > 0 && (
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200/80 dark:border-slate-800 space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200">
            <Sparkles className="size-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>توصيات إعادة توازن المحفظة للحماية من التضخم:</span>
          </div>
          <ul className="list-disc list-inside text-xs text-slate-600 dark:text-slate-400 space-y-1">
            {report.recommendationsAr.map((rec, idx) => (
              <li key={idx}>{rec}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
