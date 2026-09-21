import React, { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { formatMoney } from "@/lib/financialDisplay";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp,
  TrendingDown,
  Target,
  ShieldAlert,
  ArrowUpRight,
  Sparkles,
  BarChart2,
  RefreshCw,
} from "lucide-react";

interface SignalScorecard {
  ticker: string;
  nameAr: string;
  assetType: "STOCK" | "GOLD" | "FUND";
  currentPrice: number;
  entryZone: string;
  targetPrice: number;
  stopLossPrice: number;
  action: "ACCUMULATE" | "WAIT" | "TAKE_PROFIT";
  actionLabelAr: string;
  badgeClass: string;
  reasonAr: string;
  riskReward: string;
}

export default function RetailSignalsWidget() {
  const [_, setLocation] = useLocation();
  const reduceMotion = useReducedMotion();
  const [activeTab, setActiveTab] = useState<"ALL" | "STOCKS" | "GOLD">("ALL");

  // Query egypt market and instruments
  const { data: egyptMarket, isLoading: marketLoading } = trpc.quant.getEgyptMarket.useQuery();

  // Representative signals mapped for non-expert retail users
  const representativeSignals: SignalScorecard[] = [
    {
      ticker: "COMI.CA",
      nameAr: "البنك التجاري الدولي",
      assetType: "STOCK",
      currentPrice: 88.5,
      entryZone: "86.50 - 88.50 ج.م",
      targetPrice: 96.0,
      stopLossPrice: 83.5,
      action: "ACCUMULATE",
      actionLabelAr: "فرصة تجميع وشراء",
      badgeClass: "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
      reasonAr: "ارتداد إيجابي أعلى المتوسط المتحرك لـ 20 يوماً مع تماسك عند الدعم ونمو مستمر في الأرباح.",
      riskReward: "1 : 2.4",
    },
    {
      ticker: "AZG",
      nameAr: "صندوق أزيموت للذهب العيني",
      assetType: "GOLD",
      currentPrice: (() => {
        const gold24k = egyptMarket?.gold?.purities?.find((p) => p.karat === 24)?.gramPriceEGP;
        const azgFund = egyptMarket?.mutualFunds?.find((f) => f.code === "AZG");
        return azgFund?.latestNAV ?? (gold24k ? Number((gold24k / 100).toFixed(2)) : 46.5);
      })(),
      entryZone: "منطقة تجميع تدريجي",
      targetPrice: 54.0,
      stopLossPrice: 42.0,
      action: "ACCUMULATE",
      actionLabelAr: "تحوط وتجميع تدريجي",
      badgeClass: "bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30",
      reasonAr: "تحوط استراتيجي من تذبذب العملة وملاذ آمن طويل الأجل لحفظ القوة الشرائية للأسرة.",
      riskReward: "1 : 2.1",
    },
    {
      ticker: "SWDY.CA",
      nameAr: "السويدي إليكتريك",
      assetType: "STOCK",
      currentPrice: 47.25,
      entryZone: "44.00 - 45.50 ج.م",
      targetPrice: 53.0,
      stopLossPrice: 42.0,
      action: "WAIT",
      actionLabelAr: "انتظار نقطة دخول أفضل",
      badgeClass: "bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/30",
      reasonAr: "السعر قريب من المقاومة السعرية الحالية؛ يُفضل الانتظار حتى التهدئة وإعادة الاختبار قبل الشراء.",
      riskReward: "1 : 1.7",
    },
  ];

  const filteredSignals = representativeSignals.filter((item) => {
    if (activeTab === "STOCKS") return item.assetType === "STOCK";
    if (activeTab === "GOLD") return item.assetType === "GOLD";
    return true;
  });

  return (
    <section
      className="rounded-2xl border border-slate-200/90 dark:border-slate-800/80 bg-white dark:bg-[#0B0F17] p-6 shadow-xs"
      dir="rtl"
      aria-label="رادار إشارات السوق للمبتدئين"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="flex size-6 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Sparkles className="size-3.5" />
            </span>
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              رادار الفرص الذكية
            </span>
          </div>
          <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white m-0">
            توصيات التداول والاستثمار المبسطة (Easy Stock Signals)
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 m-0 mt-1">
            إشارات واضحة بإشارات المرور (شراء / انتظار / جني أرباح) بدون تعقيد الرسوم البيانية
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Tab Filter */}
          <div className="flex items-center gap-1 rounded-xl bg-slate-100 dark:bg-slate-800/60 p-1 border border-slate-200/60 dark:border-slate-800">
            <button
              onClick={() => setActiveTab("ALL")}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                activeTab === "ALL"
                  ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs"
                  : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-200"
              }`}
            >
              الكل
            </button>
            <button
              onClick={() => setActiveTab("STOCKS")}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                activeTab === "STOCKS"
                  ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs"
                  : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-200"
              }`}
            >
              أسهم
            </button>
            <button
              onClick={() => setActiveTab("GOLD")}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                activeTab === "GOLD"
                  ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs"
                  : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-200"
              }`}
            >
              ذهب
            </button>
          </div>

          <Button
            onClick={() => setLocation("/trading/swing")}
            variant="outline"
            size="sm"
            className="text-xs font-bold rounded-xl border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1.5 h-auto py-1.5 px-3"
          >
            <BarChart2 className="size-3.5" />
            <span>منصة التحليل الكاملة</span>
          </Button>
        </div>
      </div>

      {/* Grid of Simplified Signal Scorecards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {filteredSignals.map((sig) => (
          <div
            key={sig.ticker}
            className="flex flex-col justify-between rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 p-4.5 hover:border-slate-300 dark:hover:border-slate-700 transition-all group"
          >
            <div>
              {/* Header: Name + Badge */}
              <div className="flex items-start justify-between gap-2 mb-2.5">
                <div>
                  <strong className="text-sm font-bold text-slate-900 dark:text-white block">
                    {sig.nameAr}
                  </strong>
                  <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 block mt-0.5">
                    {sig.ticker}
                  </span>
                </div>
                <Badge
                  variant="outline"
                  className={`text-[10px] font-extrabold px-2 py-0.5 rounded-lg border ${sig.badgeClass}`}
                >
                  {sig.actionLabelAr}
                </Badge>
              </div>

              {/* Price & Target Row */}
              <div className="grid grid-cols-3 gap-2 py-2.5 my-2 border-y border-slate-200/60 dark:border-slate-800/80 bg-white/60 dark:bg-slate-900/60 rounded-xl px-3">
                <div>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 block">
                    السعر الحالي
                  </span>
                  <strong className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200">
                    {formatMoney(sig.currentPrice, "EGP")}
                  </strong>
                </div>
                <div>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5">
                    <Target className="size-2.5" />
                    هدف البيع
                  </span>
                  <strong className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    {formatMoney(sig.targetPrice, "EGP")}
                  </strong>
                </div>
                <div>
                  <span className="text-[10px] text-rose-500 flex items-center gap-0.5">
                    <ShieldAlert className="size-2.5" />
                    وقف الخسارة
                  </span>
                  <strong className="text-xs font-mono font-bold text-rose-600 dark:text-rose-400">
                    {formatMoney(sig.stopLossPrice, "EGP")}
                  </strong>
                </div>
              </div>

              {/* Plain Arabic Reason */}
              <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed m-0">
                {sig.reasonAr}
              </p>
            </div>

            {/* Footer with Risk/Reward & Action Button */}
            <div className="mt-4 pt-3 border-t border-slate-200/60 dark:border-slate-800/80 flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                <span>نسبة الأمان:</span>
                <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                  {sig.riskReward}
                </span>
              </div>
              <Button
                onClick={() => setLocation(`/trading/swing?symbol=${sig.ticker}`)}
                size="sm"
                variant="ghost"
                className="text-xs text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 font-bold p-0 h-auto flex items-center gap-1 cursor-pointer"
              >
                <span>متابعة الصفقة</span>
                <ArrowUpRight className="size-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
