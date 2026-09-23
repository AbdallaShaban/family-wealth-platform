import React, { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { formatMoney } from "@/lib/financialDisplay";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  TrendingUp,
  Target,
  ShieldAlert,
  ArrowUpRight,
  Sparkles,
  BarChart2,
  ExternalLink,
  CheckCircle2,
  Scale,
  Zap,
  Copy,
  Check,
  PlusCircle,
} from "lucide-react";
import { toast } from "sonner";
import { LogExternalTradeModal } from "@/components/trading/LogExternalTradeModal";

export default function RetailSignalsWidget() {
  const [, setLocation] = useLocation();
  const reduceMotion = useReducedMotion();
  const [tradeModalOpen, setTradeModalOpen] = useState(false);
  const [tradeAsset, setTradeAsset] = useState<{ symbol: string; name: string; currentPrice?: number } | null>(null);
  const [copiedTicker, setCopiedTicker] = useState<string | null>(null);

  const copyTradeCard = (signal: any, displayName: string) => {
    const text = `📋 بطاقة صفقة استرشادية: ${displayName} (${signal.ticker})
• الإجراء المقترح: ${signal.actionAr || "تجميع"} (ثقة: ${signal.confidenceScore}%)
• السعر الاسترشادي: ${signal.currentPrice} ج.م
• نطاق الدخول: ${signal.entryZone.min.toFixed(2)} - ${signal.entryZone.max.toFixed(2)} ج.م
• الهدف الأول (TP1): ${signal.targets.t1.toFixed(2)} ج.م
• وقف الخسارة (SL): ${signal.stopLoss.toFixed(2)} ج.م
• نسبة العائد للمخاطرة: 1 : ${signal.riskRewardRatio}`;
    navigator.clipboard.writeText(text);
    setCopiedTicker(signal.ticker);
    toast.success(`تم نسخ بطاقة الصفقة لـ ${displayName} إلى الحافظة بنجاح`);
    setTimeout(() => setCopiedTicker(null), 2500);
  };

  // Query live top 3 high-conviction quantitative signals
  const {
    data: topSignals,
    isLoading,
    isFetching,
    error,
  } = trpc.quant.getTopSignals.useQuery(undefined, {
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const getActionTheme = (action?: string) => {
    switch (action) {
      case "STRONG_ACCUMULATE":
        return {
          badgeClass: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
          dotColor: "bg-emerald-500",
          cardBorder: "hover:border-emerald-500/40",
          label: "شراء وتجميع قوي",
        };
      case "ACCUMULATE":
        return {
          badgeClass: "bg-teal-500/15 text-teal-600 dark:text-teal-400 border-teal-500/30",
          dotColor: "bg-teal-500",
          cardBorder: "hover:border-teal-500/40",
          label: "تجميع تدريجي",
        };
      case "TAKE_PROFIT_PARTIAL":
        return {
          badgeClass: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
          dotColor: "bg-amber-500",
          cardBorder: "hover:border-amber-500/40",
          label: "جني أرباح جزئي",
        };
      case "TAKE_PROFIT_FULL":
      case "DEFENSIVE_EXIT":
        return {
          badgeClass: "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30",
          dotColor: "bg-rose-500",
          cardBorder: "hover:border-rose-500/40",
          label: "خروج وقائي",
        };
      case "HOLD":
      case "WAIT":
      default:
        return {
          badgeClass: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30",
          dotColor: "bg-blue-500",
          cardBorder: "hover:border-blue-500/40",
          label: "احتفاظ ومراقبة",
        };
    }
  };

  return (
    <section
      aria-label="أبرز إشارات السوق والفرص الاستثمارية"
      className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#0B1222] p-5 sm:p-6 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.06)] dark:shadow-none"
      dir="rtl"
    >
      {/* Widget Header: Market Highlights & Top Signals */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800/80 mb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1.5 rounded-lg bg-amber-500/15 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30">
              <Sparkles className="size-4" />
            </span>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white m-0 tracking-tight">
              أبرز إشارات وفرص السوق (Market Highlights & Top Signals)
            </h2>
            <Badge
              variant="outline"
              className="text-[11px] font-bold border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300 mr-2"
            >
              أفضل 3 فرص عالية الثقة
            </Badge>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 m-0">
            تحليل كمي لحظي يجمع بين المتوسطات المتحركة، مستويات فيبوناتشي، وزخم البولينجر لتحديد أفضل نقاط الدخول والخروج.
          </p>
        </div>

        {/* Link to Full Quantitative Intelligence Hub */}
        <Button
          onClick={() => setLocation("/quant")}
          variant="outline"
          size="sm"
          className="shrink-0 h-9 gap-1.5 text-xs font-bold border-slate-300 dark:border-slate-700 hover:border-amber-500/50 hover:bg-amber-500/10 hover:text-amber-600 dark:hover:text-amber-300 transition-colors"
        >
          <BarChart2 className="size-3.5 text-amber-500" />
          <span>مركز الاستخبارات الكامل</span>
          <ExternalLink className="size-3 opacity-70" />
        </Button>
      </div>

      {/* Loading Skeleton */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="rounded-xl border border-slate-200/60 dark:border-slate-800/60 p-4 space-y-3 bg-slate-50/50 dark:bg-slate-900/30"
            >
              <div className="flex items-center justify-between">
                <Skeleton className="h-5 w-24 rounded" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
              <Skeleton className="h-8 w-32 rounded" />
              <div className="grid grid-cols-2 gap-2 pt-2">
                <Skeleton className="h-12 rounded-lg" />
                <Skeleton className="h-12 rounded-lg" />
              </div>
              <div className="flex gap-2 pt-2">
                <Skeleton className="h-8 flex-1 rounded-lg" />
                <Skeleton className="h-8 flex-1 rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      ) : error || !topSignals || topSignals.length === 0 ? (
        <div className="py-8 text-center text-xs text-slate-500 dark:text-slate-400 bg-slate-50/50 dark:bg-slate-900/40 rounded-xl border border-slate-200 dark:border-slate-800">
          <p className="font-semibold">جاري تحديث إشارات البورصة والذهب اللحظية...</p>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setLocation("/quant")}
            className="mt-2 text-amber-500 font-bold text-xs"
          >
            استعراض كافة الأصول في مركز الاستخبارات
          </Button>
        </div>
      ) : (
        /* Top 3 High-Conviction Setups Carousel/Grid */
        <div className="overflow-x-auto pb-2 scrollbar-none snap-x -mx-1 px-1">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 min-w-[280px]">
            {topSignals.map((signal, index) => {
              const theme = getActionTheme(signal.action);
              const isGold = signal.ticker.includes("GOLD");
              const isFund = signal.ticker === "AZG";
              const displayName = signal.instrumentNameAr || signal.ticker;

              // Build deep links with query parameters
              const quantUrl = `/quant?ticker=${encodeURIComponent(signal.ticker)}`;
              const swingUrl = `/trading/swing?ticker=${encodeURIComponent(
                signal.ticker
              )}&action=swing&entry=${signal.entryZone.min}&tp=${signal.targets.t1}&sl=${
                signal.stopLoss
              }&name=${encodeURIComponent(displayName)}`;

              return (
                <motion.div
                  key={signal.ticker}
                  initial={reduceMotion ? undefined : { opacity: 0, y: 10 }}
                  animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.08, duration: 0.25 }}
                  className={`flex flex-col justify-between rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-4 transition-all duration-200 hover:shadow-md ${theme.cardBorder}`}
                >
                  <div>
                    {/* Card Header: Symbol, Name & Action Badge */}
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-xs font-extrabold text-slate-900 dark:text-white">
                            {signal.ticker}
                          </span>
                          <span className="text-[10px] text-slate-400 font-medium">
                            {isGold ? "ذهب فيزيائي" : isFund ? "صندوق استثمار" : "أسهم EGX"}
                          </span>
                        </div>
                        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 mt-0.5 line-clamp-1">
                          {displayName}
                        </h3>
                      </div>

                      <Badge
                        variant="outline"
                        className={`text-[10px] font-extrabold px-2 py-0.5 border ${theme.badgeClass} shrink-0`}
                      >
                        <span className={`size-1.5 rounded-full ${theme.dotColor} inline-block ml-1 animate-pulse`} />
                        {signal.actionAr || theme.label}
                      </Badge>
                    </div>

                    {/* Price & Confidence Meter */}
                    <div className="flex items-baseline justify-between mb-3 bg-slate-50 dark:bg-slate-950/60 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800/70">
                      <div>
                        <span className="text-[10px] text-slate-400 block">السعر اللحظي</span>
                        <span className="text-base font-black font-mono text-slate-900 dark:text-white">
                          {formatMoney(signal.currentPrice)}
                        </span>
                      </div>
                      <div className="text-left">
                        <span className="text-[10px] text-slate-400 block">درجة الثقة الكمية</span>
                        <span className="text-xs font-black font-mono text-emerald-600 dark:text-emerald-400">
                          {signal.confidenceScore}%
                        </span>
                      </div>
                    </div>

                    {/* Key Tactical Levels (Entry, TP1, SL, R:R) */}
                    <div className="grid grid-cols-2 gap-2 text-xs mb-3.5">
                      <div className="bg-slate-50/80 dark:bg-slate-950/40 p-2 rounded-md border border-slate-100 dark:border-slate-800/60">
                        <span className="text-[10px] text-slate-400 block mb-0.5 font-medium">منطقة الشراء</span>
                        <span className="font-mono font-bold text-slate-700 dark:text-slate-200 text-[11px]">
                          {signal.entryZone.min.toFixed(2)} - {signal.entryZone.max.toFixed(2)}
                        </span>
                      </div>

                      <div className="bg-emerald-50/40 dark:bg-emerald-950/20 p-2 rounded-md border border-emerald-200/50 dark:border-emerald-800/40">
                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 block mb-0.5 font-medium flex items-center gap-0.5">
                          <Target className="size-2.5" />
                          الهدف الأول (TP1)
                        </span>
                        <span className="font-mono font-bold text-emerald-700 dark:text-emerald-300 text-[11px]">
                          {signal.targets.t1.toFixed(2)} ج.م
                        </span>
                      </div>

                      <div className="bg-rose-50/40 dark:bg-rose-950/20 p-2 rounded-md border border-rose-200/50 dark:border-rose-800/40">
                        <span className="text-[10px] text-rose-600 dark:text-rose-400 block mb-0.5 font-medium flex items-center gap-0.5">
                          <ShieldAlert className="size-2.5" />
                          وقف الخسارة
                        </span>
                        <span className="font-mono font-bold text-rose-700 dark:text-rose-300 text-[11px]">
                          {signal.stopLoss.toFixed(2)} ج.م
                        </span>
                      </div>

                      <div className="bg-slate-50/80 dark:bg-slate-950/40 p-2 rounded-md border border-slate-100 dark:border-slate-800/60">
                        <span className="text-[10px] text-slate-400 block mb-0.5 font-medium flex items-center gap-0.5">
                          <Scale className="size-2.5" />
                          العائد للمخاطرة (R:R)
                        </span>
                        <span className="font-mono font-bold text-amber-600 dark:text-amber-400 text-[11px]">
                          1 : {signal.riskRewardRatio}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons Matrix */}
                  <div className="space-y-1.5 pt-2.5 border-t border-slate-100 dark:border-slate-800/80">
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        onClick={() => setLocation(quantUrl)}
                        variant="outline"
                        size="sm"
                        className="w-full text-xs font-bold h-8 border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 cursor-pointer"
                      >
                        <BarChart2 className="size-3 ml-1 text-slate-500" />
                        <span>تحليل معمق</span>
                      </Button>

                      <Button
                        onClick={() => setLocation(swingUrl)}
                        size="sm"
                        className="w-full text-xs font-bold h-8 bg-slate-900 hover:bg-slate-800 dark:bg-amber-500 dark:hover:bg-amber-400 dark:text-slate-950 text-white shadow-xs cursor-pointer"
                      >
                        <Zap className="size-3 ml-1" />
                        <span>تنفيذ سوينج</span>
                        <ArrowUpRight className="size-3 rotate-180 mr-0.5" />
                      </Button>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        onClick={() => copyTradeCard(signal, displayName)}
                        variant="ghost"
                        size="sm"
                        className="w-full text-[11px] font-semibold h-7 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                      >
                        {copiedTicker === signal.ticker ? (
                          <>
                            <Check className="size-3 ml-1 text-emerald-500" />
                            <span className="text-emerald-500">تم النسخ</span>
                          </>
                        ) : (
                          <>
                            <Copy className="size-3 ml-1 text-slate-400" />
                            <span>نسخ بطاقة الصفقة</span>
                          </>
                        )}
                      </Button>

                      <Button
                        onClick={() => {
                          setTradeAsset({
                            symbol: signal.ticker,
                            name: displayName,
                            currentPrice: signal.currentPrice,
                          });
                          setTradeModalOpen(true);
                        }}
                        variant="ghost"
                        size="sm"
                        className="w-full text-[11px] font-semibold h-7 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 cursor-pointer"
                      >
                        <PlusCircle className="size-3 ml-1 text-amber-500" />
                        <span>تسجيل صفقة خارجية</span>
                      </Button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* External Trade Modal */}
      <LogExternalTradeModal
        open={tradeModalOpen}
        onOpenChange={setTradeModalOpen}
        defaultTicker={tradeAsset?.symbol}
        defaultInstrumentName={tradeAsset?.name}
        defaultPrice={tradeAsset?.currentPrice}
      />
    </section>
  );
}

