import React, { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { formatMoney } from "@/lib/financialDisplay";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  TrendingUp,
  TrendingDown,
  Target,
  ShieldAlert,
  ArrowUpRight,
  Sparkles,
  BarChart2,
  Search,
  CheckCircle2,
  Clock,
  Layers,
  AlertCircle,
  HelpCircle,
  X,
} from "lucide-react";

interface QuickChip {
  label: string;
  ticker: string;
}

const QUICK_CHIPS: QuickChip[] = [
  { label: "CIB (البنك التجاري)", ticker: "COMI.CA" },
  { label: "السويدي إليكتريك", ticker: "SWDY.CA" },
  { label: "المصرية للاتصالات", ticker: "ETEL.CA" },
  { label: "أبو قير للأسمدة", ticker: "ABUK.CA" },
  { label: "فوري للمدفوعات", ticker: "FWRY.CA" },
  { label: "طلعت مصطفى", ticker: "TMGH.CA" },
  { label: "صندوق أزيموت للذهب (AZG)", ticker: "AZG" },
  { label: "ذهب عيار 24", ticker: "GOLD_24K" },
];

export default function RetailSignalsWidget() {
  const [_, setLocation] = useLocation();
  const reduceMotion = useReducedMotion();
  const [searchInput, setSearchInput] = useState("");
  const [activeTicker, setActiveTicker] = useState("COMI.CA");

  // Query live multi-factor advisory signal for active ticker
  const {
    data: liveSignal,
    isLoading: signalLoading,
    isFetching: signalFetching,
    error: signalError,
  } = trpc.quant.getAdvisorySignal.useQuery(
    {
      ticker: activeTicker,
      assetType: activeTicker.includes("GOLD")
        ? "GOLD"
        : activeTicker === "AZG"
        ? "MUTUAL_FUND"
        : "EGX_STOCK",
    },
    {
      staleTime: 60_000,
    }
  );

  // Handle Search Submit
  const handleSearchSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const query = searchInput.trim();
    if (!query) return;
    setActiveTicker(query);
  };

  // Helper for action badge colors
  const getActionTheme = (action?: string) => {
    switch (action) {
      case "STRONG_ACCUMULATE":
      case "ACCUMULATE":
        return {
          badgeClass: "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
          dotColor: "bg-emerald-500",
          borderHover: "hover:border-emerald-500/50",
          icon: TrendingUp,
        };
      case "TAKE_PROFIT_PARTIAL":
      case "TAKE_PROFIT_FULL":
        return {
          badgeClass: "bg-rose-500/20 text-rose-600 dark:text-rose-400 border-rose-500/30",
          dotColor: "bg-rose-500",
          borderHover: "hover:border-rose-500/50",
          icon: TrendingDown,
        };
      default: // WAIT, HOLD
        return {
          badgeClass: "bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30",
          dotColor: "bg-amber-500",
          borderHover: "hover:border-amber-500/50",
          icon: Clock,
        };
    }
  };

  const actionTheme = getActionTheme(liveSignal?.action);

  return (
    <section
      className="rounded-2xl border border-slate-200/90 dark:border-slate-800/80 bg-white dark:bg-[#0B0F17] p-6 shadow-xs"
      dir="rtl"
      aria-label="رادار إشارات السوق والبحث المباشر"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="flex size-6 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Sparkles className="size-3.5" />
            </span>
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              رادار الفرص الذكي والبحث المباشر
            </span>
          </div>
          <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white m-0">
            تحليل الأسهم والذهب المبسط للمستثمر اليومي (Live Retail Scorecards)
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 m-0 mt-1">
            تغذية حية متصلة بالبورصة المصرية والذهب مع ترجمة المؤشرات الفنية إلى إشارات مرور واضحة
          </p>
        </div>

        <Button
          onClick={() => setLocation(`/trading/swing?symbol=${activeTicker}`)}
          variant="outline"
          size="sm"
          className="text-xs font-bold rounded-xl border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1.5 h-auto py-2 px-3.5 self-start sm:self-auto cursor-pointer"
        >
          <BarChart2 className="size-3.5 text-emerald-500" />
          <span>المنصة المتقدمة للمتداولين</span>
        </Button>
      </div>

      {/* Direct Search Bar */}
      <form onSubmit={handleSearchSubmit} className="relative mb-3">
        <div className="relative flex items-center">
          <Search className="absolute right-3.5 size-4 text-slate-400 pointer-events-none" />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="ابحث برمز السهم أو الاسم (مثال: CIB, السويدي, ETEL, ABUK, طلعت مصطفى, ذهب, أزيموت)..."
            className="pr-10 pl-24 h-11 text-xs rounded-xl bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus-visible:ring-emerald-500"
          />
          <div className="absolute left-1.5 flex items-center gap-1">
            {searchInput && (
              <button
                type="button"
                onClick={() => setSearchInput("")}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                aria-label="مسح البحث"
              >
                <X className="size-3.5" />
              </button>
            )}
            <Button
              type="submit"
              size="sm"
              className="h-8 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-3 rounded-lg cursor-pointer"
            >
              تحليل مباشر
            </Button>
          </div>
        </div>
      </form>

      {/* Quick Suggestion Chips */}
      <div className="flex flex-wrap items-center gap-1.5 mb-6">
        <span className="text-[11px] font-semibold text-slate-400 ml-1">أشهر الأصول:</span>
        {QUICK_CHIPS.map((chip) => {
          const isSelected = activeTicker === chip.ticker || activeTicker === chip.ticker.replace(".CA", "");
          return (
            <button
              key={chip.ticker}
              type="button"
              onClick={() => {
                setActiveTicker(chip.ticker);
                setSearchInput(chip.label.split(" ")[0]);
              }}
              className={`text-[11px] font-medium px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                isSelected
                  ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-700 dark:text-emerald-300 font-bold"
                  : "bg-slate-100/80 dark:bg-slate-800/50 border-slate-200/60 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800"
              }`}
            >
              {chip.label}
            </button>
          );
        })}
      </div>

      {/* Live Featured Card */}
      {signalLoading || signalFetching ? (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
          <div className="flex justify-between items-center">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-6 w-24" />
          </div>
          <Skeleton className="h-16 w-full rounded-xl" />
          <Skeleton className="h-12 w-full rounded-xl" />
        </div>
      ) : signalError ? (
        <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-6 text-center">
          <AlertCircle className="size-8 text-rose-500 mx-auto mb-2" />
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
            تعذر جلب بيانات الرمز "{activeTicker}"
          </h3>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            تأكد من كتابة رمز السهم بشكل صحيح (مثال: COMI.CA أو SWDY) أو اختر أحد الأسهم المقترحة أعلاه.
          </p>
        </div>
      ) : liveSignal ? (
        <motion.div
          key={liveSignal.ticker}
          initial={reduceMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28 }}
          className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-gradient-to-br from-slate-50/70 via-white to-slate-50/30 dark:from-slate-900/60 dark:via-[#0E1626] dark:to-slate-900/80 p-5 sm:p-6 shadow-xs"
        >
          {/* Top Bar: Asset Info + Live Price + Action Traffic-Light Badge */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200/60 dark:border-slate-800/80">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white m-0">
                  {liveSignal.instrumentNameAr || liveSignal.ticker}
                </h3>
                <span className="font-mono text-xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                  {liveSignal.ticker}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                <span>المصدر:</span>
                <strong className="text-slate-700 dark:text-slate-300 font-medium">
                  {liveSignal.source || "البورصة المصرية / التحليل الكمي"}
                </strong>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-left sm:text-right">
                <span className="text-[10px] text-slate-500 dark:text-slate-400 block">
                  السعر اللحظي
                </span>
                <div className="flex items-baseline gap-1.5">
                  <strong className="text-xl sm:text-2xl font-mono font-extrabold text-slate-900 dark:text-white">
                    {formatMoney(liveSignal.currentPrice, "EGP")}
                  </strong>
                  {typeof liveSignal.changePercent === "number" && (
                    <span
                      className={`text-xs font-mono font-bold ${
                        liveSignal.changePercent >= 0 ? "text-emerald-500" : "text-rose-500"
                      }`}
                    >
                      {liveSignal.changePercent >= 0 ? "+" : ""}
                      {liveSignal.changePercent.toFixed(2)}%
                    </span>
                  )}
                </div>
              </div>

              {/* Traffic Light Action Badge */}
              <Badge
                variant="outline"
                className={`text-xs sm:text-sm font-extrabold px-3 py-1.5 rounded-xl border flex items-center gap-1.5 shadow-xs ${actionTheme.badgeClass}`}
              >
                <span className={`size-2 rounded-full ${actionTheme.dotColor} animate-pulse`} />
                <span>{liveSignal.actionAr}</span>
              </Badge>
            </div>
          </div>

          {/* Operational Metrics Grid: Entry, Targets, Stop-Loss, Safety Ratio */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-4">
            <div className="bg-white dark:bg-slate-900/70 border border-slate-200/60 dark:border-slate-800 rounded-xl p-3">
              <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 block mb-0.5">
                منطقة الشراء والتجميع
              </span>
              <strong className="text-xs sm:text-sm font-mono font-bold text-slate-800 dark:text-slate-200">
                {liveSignal.entryZone.min.toFixed(2)} - {liveSignal.entryZone.max.toFixed(2)} ج.م
              </strong>
            </div>

            <div className="bg-white dark:bg-slate-900/70 border border-emerald-500/20 rounded-xl p-3">
              <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 mb-0.5">
                <Target className="size-3" />
                هدف البيع الأول (T1)
              </span>
              <strong className="text-xs sm:text-sm font-mono font-bold text-emerald-600 dark:text-emerald-400">
                {liveSignal.targets.t1.toFixed(2)} ج.م
              </strong>
            </div>

            <div className="bg-white dark:bg-slate-900/70 border border-emerald-500/20 rounded-xl p-3">
              <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 flex items-center gap-1 mb-0.5">
                <Target className="size-3" />
                هدف البيع الأقصى (T2)
              </span>
              <strong className="text-xs sm:text-sm font-mono font-bold text-emerald-700 dark:text-emerald-300">
                {liveSignal.targets.t2.toFixed(2)} ج.م
              </strong>
            </div>

            <div className="bg-white dark:bg-slate-900/70 border border-rose-500/20 rounded-xl p-3">
              <span className="text-[10px] font-semibold text-rose-500 flex items-center gap-1 mb-0.5">
                <ShieldAlert className="size-3" />
                وقف الخسارة الصارم
              </span>
              <strong className="text-xs sm:text-sm font-mono font-bold text-rose-600 dark:text-rose-400">
                {liveSignal.stopLoss.toFixed(2)} ج.م
              </strong>
            </div>
          </div>

          {/* Plain Arabic Rationale & Confidence */}
          <div className="rounded-xl bg-slate-100/70 dark:bg-slate-800/40 p-4 border border-slate-200/50 dark:border-slate-800">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <CheckCircle2 className="size-4 text-emerald-500" />
                {liveSignal.arabicAnalysis.headline}
              </span>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-500 dark:text-slate-400">نسبة الأمان:</span>
                <Badge variant="outline" className="font-mono text-[10px] font-bold border-slate-300 dark:border-slate-700">
                  1 : {liveSignal.riskRewardRatio}
                </Badge>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 mr-2">نسبة الثقة:</span>
                <span className="font-mono text-xs font-extrabold text-emerald-600 dark:text-emerald-400">
                  {liveSignal.confidenceScore}%
                </span>
              </div>
            </div>

            <ul className="m-0 pr-4 space-y-1 text-xs text-slate-600 dark:text-slate-300">
              {liveSignal.arabicAnalysis.keyPoints.map((point, idx) => (
                <li key={idx} className="list-disc leading-relaxed">
                  {point}
                </li>
              ))}
            </ul>

            <div className="mt-3 pt-2.5 border-t border-slate-200/60 dark:border-slate-700/60 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <span className="text-[10px] text-slate-400 leading-tight">
                {liveSignal.arabicAnalysis.riskWarning}
              </span>
              <Button
                onClick={() => setLocation(`/trading/swing?symbol=${liveSignal.ticker}`)}
                size="sm"
                className="bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white font-bold text-xs py-1.5 px-3 rounded-lg h-auto flex items-center gap-1 cursor-pointer shrink-0"
              >
                <span>متابعة وتداول في محفظة السوينج</span>
                <ArrowUpRight className="size-3.5 rotate-180" />
              </Button>
            </div>
          </div>
        </motion.div>
      ) : null}
    </section>
  );
}
