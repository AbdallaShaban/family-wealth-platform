import React, { useState } from "react";
import { trpc } from "@/lib/trpc";
import { formatMoney } from "@/lib/financialDisplay";
import SensitiveValue from "@/components/SensitiveValue";
import {
  Sparkles,
  ShieldCheck,
  ShieldAlert,
  TrendingUp,
  Coins,
  Flame,
  Scale,
  SlidersHorizontal,
  FileDown,
  Info,
  CheckCircle2,
  AlertTriangle,
  Lightbulb,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { toast } from "sonner";

interface WealthAdvisorCardProps {
  onExportPdf?: () => void;
}

export default function WealthAdvisorCard({ onExportPdf }: WealthAdvisorCardProps) {
  const [customInflation, setCustomInflation] = useState<number>(26.5);
  const [customTargetMonths, setCustomTargetMonths] = useState<number>(6);
  const [showAdvancedSettings, setShowAdvancedSettings] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<"brief" | "rebalance" | "liquidity" | "allocation">("brief");

  const advisorQuery = trpc.family.wealthHealth.getAdvisorInsights.useQuery(
    {
      customInflationRate: customInflation,
      customTargetMonths: customTargetMonths,
    },
    {
      staleTime: 60_000,
    }
  );

  const data = advisorQuery.data;

  const handleDownloadPdf = async () => {
    if (onExportPdf) {
      onExportPdf();
      return;
    }
    try {
      toast.loading("جارٍ تجهيز وتحميل التقرير التنفيذي الشامل بالـ PDF...", { id: "advisor-pdf" });
      const res = await fetch("/api/reports/executive-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      if (!res.ok) {
        throw new Error("فشل توليد التقرير");
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `تقرير_المستشار_المالي_التنفيذي_${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success("تم تنزيل التقرير التنفيذي بنجاح متضمناً توجيهات المستشار الذكي.", { id: "advisor-pdf" });
    } catch {
      toast.error("تعذر تحميل التقرير، يرجى المحاولة من صفحة التقارير.", { id: "advisor-pdf" });
    }
  };

  return (
    <div className="bg-white dark:bg-[#0B0F17] border border-slate-200/90 dark:border-slate-800/80 rounded-2xl shadow-xs overflow-hidden transition-all duration-200">
      {/* 1. TOP EXECUTIVE AI HEADER */}
      <div className="bg-linear-to-r from-sky-900 via-indigo-950 to-slate-900 text-white p-5 md:p-6 relative overflow-hidden">
        {/* Subtle decorative mesh background glow */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-sky-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none -ml-20 -mb-20" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="size-12 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center shrink-0 shadow-inner">
              <Sparkles className="size-6 text-amber-300 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h3 className="text-lg md:text-xl font-bold tracking-tight text-white flex items-center gap-2">
                  المستشار المالي والتحليلي بالذكاء الاصطناعي
                </h3>
                <span className="bg-sky-500/20 text-sky-200 border border-sky-400/30 text-[11px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-xs">
                  <span>Advisory-Only</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping inline-block" />
                </span>
                <span className="bg-amber-500/20 text-amber-200 border border-amber-400/30 text-[10px] font-semibold px-2 py-0.5 rounded-md">
                  لا تعديل آلي في الدفاتر
                </span>
              </div>
              <p className="text-xs md:text-sm text-slate-300 mt-1">
                تشخيص ذكي لهيكل السيولة، فجوة التوزيع الاستراتيجي، ومقترحات إعادة التوازن المحددة بالأرقام
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
            <button
              onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
              className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/15 text-xs font-semibold text-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer"
              title="تعديل فرضيات التضخم واحتياطي الطوارئ"
            >
              <SlidersHorizontal className="size-3.5" />
              <span>المعايير</span>
              {showAdvancedSettings ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
            </button>
            <button
              onClick={handleDownloadPdf}
              className="px-3.5 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-sm transition-transform active:scale-95 cursor-pointer"
            >
              <FileDown className="size-3.5" />
              <span>تضمين بالتقرير التنفيذي</span>
            </button>
          </div>
        </div>

        {/* Dynamic Controls Drawer */}
        {showAdvancedSettings && (
          <div className="mt-4 pt-4 border-t border-white/15 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="bg-white/5 p-3 rounded-xl border border-white/10 space-y-1.5">
              <div className="flex justify-between items-center text-slate-300">
                <span className="font-semibold">معدل التضخم السنوي المستهدف:</span>
                <span className="font-mono font-bold text-amber-300">{customInflation}%</span>
              </div>
              <input
                type="range"
                min="5"
                max="50"
                step="0.5"
                value={customInflation}
                onChange={e => setCustomInflation(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-sky-400"
              />
              <div className="flex justify-between text-[10px] text-slate-400">
                <span>5% (عالمي)</span>
                <span>26.5% (الأساس المعلن بمصر)</span>
                <span>50% (متشدد)</span>
              </div>
            </div>

            <div className="bg-white/5 p-3 rounded-xl border border-white/10 space-y-1.5">
              <div className="flex justify-between items-center text-slate-300">
                <span className="font-semibold">مستهدف صندوق الطوارئ والسيولة:</span>
                <span className="font-mono font-bold text-sky-300">{customTargetMonths} أشهر نفقات</span>
              </div>
              <input
                type="range"
                min="3"
                max="18"
                step="1"
                value={customTargetMonths}
                onChange={e => setCustomTargetMonths(parseInt(e.target.value, 10))}
                className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-sky-400"
              />
              <div className="flex justify-between text-[10px] text-slate-400">
                <span>3 أشهر (حد أدنى)</span>
                <span>6 أشهر (المعيار الدولي)</span>
                <span>18 شهراً (تحفظ كامل)</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 2. TAB NAVIGATION */}
      <div className="border-b border-slate-200 dark:border-slate-800 px-4 md:px-6 bg-slate-50/70 dark:bg-slate-900/40 flex items-center justify-between overflow-x-auto">
        <div className="flex gap-2 py-2.5">
          <button
            onClick={() => setActiveTab("brief")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === "brief"
                ? "bg-sky-600 text-white shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <Lightbulb className="size-3.5" />
            <span>التشخيص التنفيذي والفرص</span>
          </button>

          <button
            onClick={() => setActiveTab("rebalance")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === "rebalance"
                ? "bg-sky-600 text-white shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <Scale className="size-3.5" />
            <span>توصيات إعادة التوازن</span>
            {data?.recommendations && (
              <span className="bg-white/20 text-white px-1.5 py-0.2 rounded-full text-[10px]">
                {data.recommendations.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("liquidity")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === "liquidity"
                ? "bg-sky-600 text-white shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <Flame className="size-3.5" />
            <span>السيولة الراكدة وصندوق الطوارئ</span>
          </button>

          <button
            onClick={() => setActiveTab("allocation")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === "allocation"
                ? "bg-sky-600 text-white shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <TrendingUp className="size-3.5" />
            <span>مصفوفة فجوة التوزيع</span>
          </button>
        </div>

        {advisorQuery.isFetching && (
          <span className="text-[11px] text-slate-400 animate-pulse font-mono">جارٍ التحديث...</span>
        )}
      </div>

      {/* 3. CONTENT PANELS */}
      <div className="p-5 md:p-6">
        {advisorQuery.isLoading ? (
          <div className="space-y-4 py-8">
            <div className="h-6 bg-slate-200 dark:bg-slate-800 rounded-md w-1/3 animate-pulse" />
            <div className="h-20 bg-slate-100 dark:bg-slate-900 rounded-xl animate-pulse" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="h-28 bg-slate-100 dark:bg-slate-900 rounded-xl animate-pulse" />
              <div className="h-28 bg-slate-100 dark:bg-slate-900 rounded-xl animate-pulse" />
              <div className="h-28 bg-slate-100 dark:bg-slate-900 rounded-xl animate-pulse" />
            </div>
          </div>
        ) : !data ? (
          <div className="text-center py-10 text-slate-500">
            <AlertTriangle className="size-8 mx-auto text-amber-500 mb-2" />
            <p>تعذر تحميل بيانات المستشار المالي. يرجى إعادة المحاولة.</p>
          </div>
        ) : (
          <div>
            {/* ============================================================== */}
            {/* TAB 1: EXECUTIVE BRIEFING & KEY OPPORTUNITIES */}
            {/* ============================================================== */}
            {activeTab === "brief" && (
              <div className="space-y-5">
                {/* Executive Prose Greeting Card */}
                <div className="bg-sky-50/70 dark:bg-sky-950/20 border border-sky-100 dark:border-sky-900/50 rounded-xl p-4 md:p-5">
                  <div className="flex items-start gap-3">
                    <div className="size-8 rounded-lg bg-sky-600 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                      <Sparkles className="size-4" />
                    </div>
                    <div className="space-y-2 flex-1">
                      <p className="text-xs md:text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {data.executiveBriefAr.greeting}
                      </p>
                      <p className="text-xs md:text-sm text-slate-700 dark:text-slate-300 leading-relaxed font-normal">
                        {data.executiveBriefAr.overallDiagnosisAr}
                      </p>
                    </div>
                  </div>
                </div>

                {/* 3 Core Insights Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Card 1: Key Opportunity */}
                  <div className="bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-800/50 rounded-xl p-4 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider flex items-center gap-1">
                          <CheckCircle2 className="size-3.5" />
                          <span>أبرز فرصة تعظيم عائد</span>
                        </span>
                        <span className="bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200 text-[10px] font-bold px-2 py-0.5 rounded-full">
                          عائد إيجابي
                        </span>
                      </div>
                      <p className="text-xs text-slate-800 dark:text-slate-200 font-medium leading-relaxed">
                        {data.executiveBriefAr.keyOpportunityAr}
                      </p>
                    </div>
                    {data.recommendations[0]?.suggestedAmountBase && (
                      <div className="mt-3 pt-3 border-t border-emerald-200/60 dark:border-emerald-800/40 text-xs text-emerald-900 dark:text-emerald-300 font-bold flex justify-between items-center">
                        <span>المبلغ المستهدف:</span>
                        <SensitiveValue>
                          <span className="font-mono text-sm">
                            {formatMoney(data.recommendations[0].suggestedAmountBase, data.baseCurrency)}
                          </span>
                        </SensitiveValue>
                      </div>
                    )}
                  </div>

                  {/* Card 2: Inflation Shield Status */}
                  <div className="bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-800/50 rounded-xl p-4 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wider flex items-center gap-1">
                          <ShieldCheck className="size-3.5" />
                          <span>كفاءة درع التضخم</span>
                        </span>
                        <span className="bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200 text-[10px] font-bold px-2 py-0.5 rounded-full">
                          {data.inflationShield.shieldScore}/100
                        </span>
                      </div>
                      <p className="text-xs text-slate-800 dark:text-slate-200 font-medium leading-relaxed">
                        {data.inflationShield.shieldStatusAr}. {data.inflationShield.summaryAr}
                      </p>
                    </div>
                    <div className="mt-3 pt-3 border-t border-amber-200/60 dark:border-amber-800/40 text-xs flex justify-between items-center text-slate-700 dark:text-slate-300">
                      <span>العائد الحقيقي الصافي:</span>
                      <span
                        className={`font-mono font-bold ${
                          data.inflationShield.portfolioRealYieldPct >= 0
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-rose-600 dark:text-rose-400"
                        }`}
                      >
                        {data.inflationShield.portfolioRealYieldPct > 0 ? "+" : ""}
                        {data.inflationShield.portfolioRealYieldPct.toFixed(1)}%
                      </span>
                    </div>
                  </div>

                  {/* Card 3: Primary Risk Alert */}
                  <div className="bg-rose-50/60 dark:bg-rose-950/20 border border-rose-200/80 dark:border-rose-800/50 rounded-xl p-4 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-bold text-rose-800 dark:text-rose-300 uppercase tracking-wider flex items-center gap-1">
                          <ShieldAlert className="size-3.5" />
                          <span>تنبيه المخاطر الأول</span>
                        </span>
                        <span className="bg-rose-100 dark:bg-rose-900 text-rose-800 dark:text-rose-200 text-[10px] font-bold px-2 py-0.5 rounded-full">
                          مخاطر حتمية
                        </span>
                      </div>
                      <p className="text-xs text-slate-800 dark:text-slate-200 font-medium leading-relaxed">
                        {data.executiveBriefAr.primaryRiskAlertAr}
                      </p>
                    </div>
                    <div className="mt-3 pt-3 border-t border-rose-200/60 dark:border-rose-800/40 text-xs text-rose-900 dark:text-rose-300 font-semibold flex justify-between items-center">
                      <span>السيولة غير المستغلة:</span>
                      <SensitiveValue>
                        <span className="font-mono text-sm font-bold">
                          {formatMoney(data.liquidity.stagnantSurplusCashBase, data.baseCurrency)}
                        </span>
                      </SensitiveValue>
                    </div>
                  </div>
                </div>

                {/* Quick Rebalancing Action Callout */}
                {data.recommendations.length > 0 && (
                  <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-4 bg-slate-50 dark:bg-slate-900/60 flex flex-col md:flex-row items-center justify-between gap-3">
                    <div className="flex items-center gap-3 text-xs text-slate-700 dark:text-slate-300">
                      <span className="font-bold text-sky-700 dark:text-sky-400">التوصية الرئيسية القادمة:</span>
                      <span className="font-semibold text-slate-900 dark:text-white">
                        {data.recommendations[0].titleAr}
                      </span>
                    </div>
                    <button
                      onClick={() => setActiveTab("rebalance")}
                      className="text-xs font-bold text-sky-600 hover:text-sky-700 dark:text-sky-400 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <span>عرض تفاصيل خطة إعادة التوازن</span>
                      <ExternalLink className="size-3" />
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ============================================================== */}
            {/* TAB 2: PRIORITIZED REBALANCING RECOMMENDATIONS */}
            {/* ============================================================== */}
            {activeTab === "rebalance" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                    توجيهات إعادة التوازن والمخصصات المستهدفة ({data.recommendations.length})
                  </h4>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    مرتبة حسب الأولوية وتأثيرها على العائد وحماية الثروة
                  </span>
                </div>

                <div className="space-y-3">
                  {data.recommendations.map((rec, idx) => {
                    const isCritical = rec.priority === "CRITICAL";
                    const isHigh = rec.priority === "HIGH";
                    const isOpp = rec.priority === "OPPORTUNITY";

                    return (
                      <div
                        key={rec.id || idx}
                        className={`rounded-xl border p-4 md:p-5 transition-all ${
                          isCritical
                            ? "bg-rose-50/40 dark:bg-rose-950/20 border-rose-300 dark:border-rose-900/60"
                            : isHigh
                            ? "bg-amber-50/40 dark:bg-amber-950/20 border-amber-300 dark:border-amber-900/60"
                            : isOpp
                            ? "bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-900/60"
                            : "bg-slate-50/60 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800"
                        }`}
                      >
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                                isCritical
                                  ? "bg-rose-600 text-white"
                                  : isHigh
                                  ? "bg-amber-500 text-slate-950 font-extrabold"
                                  : isOpp
                                  ? "bg-emerald-600 text-white"
                                  : "bg-slate-600 text-white"
                              }`}
                            >
                              {rec.priorityLabelAr}
                            </span>
                            <h5 className="text-sm font-bold text-slate-900 dark:text-white">
                              {rec.titleAr}
                            </h5>
                          </div>

                          {rec.suggestedAmountBase && (
                            <div className="flex items-center gap-1.5 text-xs self-start md:self-auto bg-white dark:bg-slate-800 px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-700 shadow-2xs">
                              <span className="text-slate-500">المبلغ المقترح للتوجيه:</span>
                              <SensitiveValue>
                                <span className="font-mono font-bold text-slate-900 dark:text-white text-sm">
                                  {formatMoney(rec.suggestedAmountBase, data.baseCurrency)}
                                </span>
                              </SensitiveValue>
                            </div>
                          )}
                        </div>

                        <p className="text-xs text-slate-700 dark:text-slate-300 font-semibold mb-2">
                          {rec.actionSummaryAr}
                        </p>
                        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mb-3">
                          {rec.actionDetailsAr}
                        </p>

                        <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 bg-white/60 dark:bg-slate-800/60 p-2 rounded-lg border border-slate-200/50 dark:border-slate-700/50 font-mono">
                          <TrendingUp className="size-3 text-sky-600 dark:text-sky-400 shrink-0" />
                          <span>الأثر المتوقع: {rec.impactMetricsAr}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ============================================================== */}
            {/* TAB 3: STAGNANT LIQUIDITY & EMERGENCY FUND */}
            {/* ============================================================== */}
            {activeTab === "liquidity" && (
              <div className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
                    <span className="text-[11px] text-slate-500 font-semibold block mb-1">
                      إجمالي السيولة النقدية الحالية
                    </span>
                    <SensitiveValue>
                      <span className="font-mono font-bold text-xl text-slate-900 dark:text-white">
                        {formatMoney(data.liquidity.totalLiquidCashBase, data.baseCurrency)}
                      </span>
                    </SensitiveValue>
                    <span className="text-[10px] text-slate-400 mt-1 block">
                      حسابات جارية، توفير، وخزينة نقدية
                    </span>
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
                    <span className="text-[11px] text-slate-500 font-semibold block mb-1">
                      احتياطي الطوارئ المطلوب ({data.liquidity.emergencyFundMonthsTarget} أشهر)
                    </span>
                    <SensitiveValue>
                      <span className="font-mono font-bold text-xl text-sky-600 dark:text-sky-400">
                        {formatMoney(data.liquidity.emergencyFundRequiredBase, data.baseCurrency)}
                      </span>
                    </SensitiveValue>
                    <span className="text-[10px] text-slate-400 mt-1 block">
                      استناداً لنفقات معيشية {formatMoney(data.liquidity.monthlyEssentialBurnBase, data.baseCurrency)}/شهر
                    </span>
                  </div>

                  <div className="bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/60 rounded-xl p-4">
                    <span className="text-[11px] text-amber-800 dark:text-amber-300 font-semibold block mb-1">
                      فائض السيولة الراكدة غير المستغلة
                    </span>
                    <SensitiveValue>
                      <span className="font-mono font-bold text-xl text-amber-600 dark:text-amber-400">
                        {formatMoney(data.liquidity.stagnantSurplusCashBase, data.baseCurrency)}
                      </span>
                    </SensitiveValue>
                    <span className="text-[10px] text-amber-700/80 dark:text-amber-400 mt-1 block">
                      نسبة {data.liquidity.stagnantRatioPct.toFixed(1)}% من إجمالي النقد المتاح
                    </span>
                  </div>

                  <div className="bg-rose-50/70 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/60 rounded-xl p-4">
                    <span className="text-[11px] text-rose-800 dark:text-rose-300 font-semibold block mb-1">
                      تآكل القوة الشرائية السنوي
                    </span>
                    <SensitiveValue>
                      <span className="font-mono font-bold text-xl text-rose-600 dark:text-rose-400">
                        -{formatMoney(data.liquidity.annualPurchasingPowerLossBase, data.baseCurrency)}
                      </span>
                    </SensitiveValue>
                    <span className="text-[10px] text-rose-700/80 dark:text-rose-400 mt-1 block">
                      خسارة سنوية حتمية عند تضخم {data.inflationShield.headlineInflationPct}%
                    </span>
                  </div>
                </div>

                {/* Liquidity Assessment Banner */}
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex items-start gap-3">
                  <Info className="size-4 text-sky-600 dark:text-sky-400 shrink-0 mt-0.5" />
                  <div className="text-xs space-y-1">
                    <strong className="text-slate-900 dark:text-white">
                      تقييم وضع السيولة: {data.liquidity.liquidityHealthStatusAr}
                    </strong>
                    <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                      {data.liquidity.summaryAr}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* ============================================================== */}
            {/* TAB 4: STRATEGIC ALLOCATION GAP MATRIX */}
            {/* ============================================================== */}
            {activeTab === "allocation" && (
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                    مصفوفة فجوة التوزيع الاستراتيجي (Target Allocation Gap Matrix)
                  </h4>
                  <span className="text-xs text-slate-500 font-mono">
                    المعيار الاستراتيجي المحافظ لإدارة ثروات العائلات
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  {data.allocationGaps.buckets.map(b => {
                    const isUnder = b.status === "UNDERWEIGHT";
                    const isOver = b.status === "OVERWEIGHT";

                    return (
                      <div
                        key={b.key}
                        className="bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-xl p-4"
                      >
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-slate-900 dark:text-white">
                              {b.labelAr}
                            </span>
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                                isUnder
                                  ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                                  : isOver
                                  ? "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300"
                                  : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                              }`}
                            >
                              {b.statusAr}
                            </span>
                          </div>

                          <div className="flex items-center gap-3 text-xs font-mono">
                            <span className="text-slate-500">
                              الحالي: <strong className="text-slate-900 dark:text-white">{b.currentWeightPct}%</strong>
                            </span>
                            <span className="text-slate-400">/</span>
                            <span className="text-slate-500">
                              المستهدف: <strong className="text-slate-900 dark:text-white">{b.targetWeightPct}%</strong>
                            </span>
                            <span className="text-slate-400">/</span>
                            <span
                              className={`font-bold ${
                                isUnder
                                  ? "text-amber-600 dark:text-amber-400"
                                  : isOver
                                  ? "text-sky-600 dark:text-sky-400"
                                  : "text-emerald-600 dark:text-emerald-400"
                              }`}
                            >
                              الفجوة: {b.gapWeightPct > 0 ? "+" : ""}
                              {b.gapWeightPct}%
                            </span>
                          </div>
                        </div>

                        {/* Progress Bar Comparison */}
                        <div className="space-y-1 mb-2">
                          <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden flex">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${
                                isUnder ? "bg-amber-500" : isOver ? "bg-sky-500" : "bg-emerald-500"
                              }`}
                              style={{ width: `${Math.min(100, b.currentWeightPct)}%` }}
                            />
                          </div>
                        </div>

                        <div className="flex justify-between items-center text-xs">
                          <span className="text-slate-600 dark:text-slate-400 text-[11px]">
                            {b.recommendedActionAr}
                          </span>
                          <SensitiveValue>
                            <span className="font-mono text-slate-700 dark:text-slate-300 font-bold">
                              {formatMoney(b.currentValueBase, data.baseCurrency)}
                            </span>
                          </SensitiveValue>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 4. FOOTER ADVISORY NOTICE */}
      <div className="px-5 py-3 bg-slate-100/60 dark:bg-slate-900/80 border-t border-slate-200/80 dark:border-slate-800/80 flex flex-col md:flex-row items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
        <div className="flex items-center gap-1.5">
          <ShieldCheck className="size-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>
            تنبيه حوكمة الثروة: كافة التوجيهات استشارية تشخيصية ولا يتم تنفيذ أي عمليات مالية أو قيود تلقائياً.
          </span>
        </div>
        <span className="font-mono">
          آخر تحديث: {new Date(data?.asOf || Date.now()).toLocaleTimeString("ar-EG")}
        </span>
      </div>
    </div>
  );
}
