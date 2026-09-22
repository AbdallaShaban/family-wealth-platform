import React, { useMemo, useRef, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { useDemoMode } from "@/contexts/DemoModeContext";

import { formatMoney, formatDate, formatFullTimestamp } from "@/lib/financialDisplay";
import { CandlestickChart } from "@/components/trading/CandlestickChart";
import {
  calculateRiskReward,
  calculateRecommendedPositionSize,
  calculateExitTimeline,
} from "../../../server/swingTradingMath";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  TrendingUp,
  TrendingDown,
  ShieldAlert,
  Sparkles,
  Plus,
  RefreshCw,
  Clock,
  Target,
  ArrowUpRight,
  ArrowDownRight,
  AlertTriangle,
  Info,
  CheckCircle2,
  Calendar,
  Layers,
  BarChart3,
  Lightbulb,
} from "lucide-react";
import { toast } from "sonner";

type CategoryFilter = "ALL" | "EGX_STOCK" | "NBE_MUTUAL_FUND" | "TELDA_LIQUIDITY" | "GOLD" | "CRYPTO_OTHER";
type StatusFilter = "ALL" | "OPEN" | "CLOSED";
type TradeExecutionMode = "ADVISORY_TRACKING" | "FUNDED_LEDGER";

export default function SwingTradingPage() {
  // Hoist ALL hooks to the top level
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>("ALL");
  const [selectedStatus, setSelectedStatus] = useState<StatusFilter>("ALL");
  const [paperOnlyFilter, setPaperOnlyFilter] = useState<boolean | undefined>(undefined);
  const [selectedTradeId, setSelectedTradeId] = useState<number | null>(null);
  const chartSectionRef = useRef<HTMLDivElement | null>(null);

  // Modals state
  const [isNewTradeOpen, setIsNewTradeOpen] = useState(false);
  const [isCloseModalOpen, setIsCloseModalOpen] = useState(false);
  const [tradeToClose, setTradeToClose] = useState<any | null>(null);

  // Dual-layer execution mode (Option A: Advisory Tracking vs Option B: Official Funded Ledger)
  const [tradeExecutionMode, setTradeExecutionMode] = useState<TradeExecutionMode>("ADVISORY_TRACKING");

  // Form states for New Trade
  const [formInstrumentId, setFormInstrumentId] = useState<string>("");
  const [formCategory, setFormCategory] = useState<"EGX_STOCK" | "NBE_MUTUAL_FUND" | "TELDA_LIQUIDITY" | "GOLD" | "CRYPTO_OTHER">("EGX_STOCK");
  const [formDirection, setFormDirection] = useState<"LONG" | "SHORT">("LONG");
  const [formQuantity, setFormQuantity] = useState<string>("100");
  const [formEntryPrice, setFormEntryPrice] = useState<string>("");
  const [formStopLoss, setFormStopLoss] = useState<string>("");
  const [formTakeProfit, setFormTakeProfit] = useState<string>("");
  const [formHoldingDays, setFormHoldingDays] = useState<string>("10");
  const [formStrategyTag, setFormStrategyTag] = useState<string>("EMA_PULLBACK");
  const [formFundingAccount, setFormFundingAccount] = useState<string>("");
  const [formNotes, setFormNotes] = useState<string>("");

  // Form states for Close Trade
  const [closeExitPrice, setCloseExitPrice] = useState<string>("");
  const [closeStatus, setCloseStatus] = useState<"TARGET_HIT" | "STOPPED_OUT" | "CLOSED_MANUALLY" | "TIME_EXPIRED">("TARGET_HIT");
  const [closeNotes, setCloseNotes] = useState<string>("");

  // TRPC Queries
  const tradesQuery = trpc.swingTrading.list.useQuery({
    filterCategory: selectedCategory,
    status: selectedStatus,
    isPaperTrading: paperOnlyFilter,
  });

  const diagnosticsQuery = trpc.swingTrading.diagnostics.useQuery();

  const instrumentsQuery = trpc.family.instruments.list.useQuery();
  const accountsQuery = trpc.family.accounts.list.useQuery();
  const portfolioQuery = trpc.family.portfolio.list.useQuery();
  const egyptMarketQuery = trpc.quant.getEgyptMarket.useQuery();

  // Mutations
  const utils = trpc.useUtils();

  const createTradeMutation = trpc.swingTrading.create.useMutation({
    onSuccess: async (data) => {
      toast.success("تم تسجيل صفقة السوينج بنجاح في خطة التداول");
      setIsNewTradeOpen(false);
      resetNewTradeForm();
      await utils.swingTrading.list.invalidate();
      await utils.swingTrading.diagnostics.invalidate();
      // If funded trade, also invalidate financial balances and accounts
      await utils.family.accounts.list.invalidate();
      if (data.tradeId) {
        setSelectedTradeId(data.tradeId);
      }
    },
    onError: (err) => {
      toast.error(err.message || "حدث خطأ أثناء حفظ الصفقة");
    },
  });

  const closeTradeMutation = trpc.swingTrading.close.useMutation({
    onSuccess: async () => {
      toast.success("تم تسجيل إغلاق الصفقة وتحديث مؤشرات الأداء");
      setIsCloseModalOpen(false);
      setTradeToClose(null);
      await utils.swingTrading.list.invalidate();
      await utils.swingTrading.diagnostics.invalidate();
    },
    onError: (err) => {
      toast.error(err.message || "فشل إغلاق الصفقة");
    },
  });

  const seedDemoMutation = trpc.swingTrading.seedDemoData.useMutation({
    onSuccess: async () => {
      await utils.swingTrading.list.invalidate();
      await utils.swingTrading.diagnostics.invalidate();
      await utils.swingTrading.getCandles.invalidate();
      toast.success("تم تحميل البيانات والصفقات التجريبية بنجاح");
    },
    onError: (err) => {
      toast.error(`فشل تحميل البيانات التجريبية: ${err.message || "حدث خطأ غير متوقع"}`);
    },
  });

  const { isDemoMode } = useDemoMode();
  const rawTrades = tradesQuery.data ?? [];

  // Clean Trades State: Demo seeded trades only show when explicitly in DemoMode
  const trades = useMemo(() => {
    if (isDemoMode) return rawTrades;
    return rawTrades.filter((t) => !t.isPaperTrading && !t.notes?.includes("ارتداد إيجابي"));
  }, [rawTrades, isDemoMode]);

  const diagnostics = diagnosticsQuery.data;
  const instruments = instrumentsQuery.data ?? [];
  const accounts = accountsQuery.data ?? [];

  // Currently active selected trade for charting
  const activeTrade = useMemo(() => {
    if (selectedTradeId) {
      const found = trades.find((t) => t.id === selectedTradeId);
      if (found) return found;
    }
    return trades.length > 0 ? trades[0] : null;
  }, [trades, selectedTradeId]);


  // Query candles for active trade
  const activeInstrumentId = activeTrade?.instrumentId ?? (instruments.length > 0 ? instruments[0].id : 1);
  const candlesQuery = trpc.swingTrading.getCandles.useQuery(
    {
      instrumentId: activeInstrumentId,
      timeframe: "1d",
      limit: 60,
    },
    { enabled: !!activeInstrumentId }
  );

  // Dynamic Live Co-Pilot calculation for the trade entry modal
  const coPilotInsights = useMemo(() => {
    const entry = Number(formEntryPrice);
    const sl = formStopLoss ? Number(formStopLoss) : null;
    const tp = formTakeProfit ? Number(formTakeProfit) : null;
    const days = Math.max(1, Number(formHoldingDays) || 10);

    const rr = calculateRiskReward(entry || 100, sl, tp, formDirection);
    const timeline = calculateExitTimeline(Date.now(), days);

    // Assume 100,000 baseline liquidity or diagnostics active capital
    const liquidCapital = 100000;
    const posSize = entry && sl ? calculateRecommendedPositionSize(liquidCapital, entry, sl, 1.5) : null;

    return {
      rr,
      timeline,
      posSize,
    };
  }, [formEntryPrice, formStopLoss, formTakeProfit, formDirection, formHoldingDays]);

  // Dynamic labels, placeholders, and units based on selected assetCategory
  const assetInputConfig = useMemo(() => {
    switch (formCategory) {
      case "GOLD":
        return {
          quantityLabel: "الوزن (جرام) *",
          quantityPlaceholder: "مثال: 50.00",
          priceLabel: "سعر جرام عيار 24 (ج.م) *",
          pricePlaceholder: "سعر الجرام الحالي",
          unitName: "جرام",
        };
      case "NBE_MUTUAL_FUND":
        return {
          quantityLabel: "عدد الوثائق (Units) *",
          quantityPlaceholder: "مثال: 500",
          priceLabel: "سعر استرداد الوثيقة (NAV) *",
          pricePlaceholder: "سعر الوثيقة الحالي",
          unitName: "وثيقة",
        };
      case "EGX_STOCK":
      default:
        return {
          quantityLabel: "عدد الأسهم (Shares) *",
          quantityPlaceholder: "مثال: 1000",
          priceLabel: "سعر السهم (ج.م) *",
          pricePlaceholder: "سعر الدخول للسهم",
          unitName: "سهم",
        };
    }
  }, [formCategory]);

  const resetNewTradeForm = () => {
    setTradeExecutionMode("ADVISORY_TRACKING");
    setFormInstrumentId("");
    setFormQuantity(formCategory === "GOLD" ? "50" : formCategory === "NBE_MUTUAL_FUND" ? "500" : "1000");
    setFormEntryPrice("");
    setFormStopLoss("");
    setFormTakeProfit("");
    setFormHoldingDays("10");
    setFormFundingAccount("");
    setFormNotes("");
  };

  const handleOpenCloseModal = (trade: any) => {
    setTradeToClose(trade);
    setCloseExitPrice(String(trade.currentPrice || trade.entryPrice));
    setCloseStatus(
      trade.currentPrice >= trade.takeProfitPrice && trade.takeProfitPrice > 0
        ? "TARGET_HIT"
        : trade.currentPrice <= trade.stopLossPrice && trade.stopLossPrice > 0
        ? "STOPPED_OUT"
        : "CLOSED_MANUALLY"
    );
    setCloseNotes("");
    setIsCloseModalOpen(true);
  };

  const handleSubmitNewTrade = (e: React.FormEvent) => {
    e.preventDefault();
    const instId = Number(formInstrumentId);
    const qty = Number(formQuantity);
    const entry = Number(formEntryPrice);

    if (!instId || instId <= 0) {
      toast.error("يرجى اختيار أداة مالية صالحة");
      return;
    }
    if (!qty || qty <= 0) {
      toast.error("يرجى إدخال كمية صحيحة أكبر من صفر");
      return;
    }
    if (!entry || entry <= 0) {
      toast.error("يرجى إدخال سعر دخول صحيح");
      return;
    }

    const isFunded = tradeExecutionMode === "FUNDED_LEDGER";
    if (isFunded && (!formFundingAccount || Number(formFundingAccount) <= 0)) {
      toast.error("يرجى تحديد حساب التمويل (البنك أو الكاش) لخصم قيمة الصفقة الرسمية");
      return;
    }

    createTradeMutation.mutate({
      instrumentId: instId,
      assetCategory: formCategory,
      fundingAccountId: isFunded && formFundingAccount ? Number(formFundingAccount) : undefined,
      isPaperTrading: !isFunded,
      direction: formDirection,
      quantity: qty,
      entryPrice: entry,
      stopLossPrice: formStopLoss ? Number(formStopLoss) : undefined,
      takeProfitPrice: formTakeProfit ? Number(formTakeProfit) : undefined,
      entryDate: Date.now(),
      targetHoldingDays: Number(formHoldingDays) || 10,
      strategyTag: formStrategyTag,
      notes: formNotes || undefined,
    });
  };

  const handleSubmitCloseTrade = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tradeToClose) return;
    const exitPrice = Number(closeExitPrice);
    if (!exitPrice || exitPrice <= 0) {
      toast.error("يرجى إدخال سعر خروج صالح");
      return;
    }

    closeTradeMutation.mutate({
      tradeId: tradeToClose.id,
      exitPrice,
      exitDate: Date.now(),
      status: closeStatus,
      notes: closeNotes || undefined,
    });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 pb-12" dir="rtl">
        {/* Top Header & Advisory Mission */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800/80 pb-5">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
                <BarChart3 className="h-7 w-7 text-amber-500 dark:text-amber-400" />
                محرك صفقات السوينج والمستشار المالي
              </h1>
              <Badge className="bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/30 text-xs px-2.5 py-0.5 font-medium">
                Advisory Co-Pilot
              </Badge>
            </div>
            <div className="mt-3 flex items-start sm:items-center gap-2.5 rounded-xl border border-amber-200 dark:border-amber-800/40 bg-amber-50/80 dark:bg-amber-950/30 p-3 shadow-sm">
              <Info className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5 sm:mt-0" />
              <p className="text-xs sm:text-sm leading-relaxed text-slate-700 dark:text-slate-200 font-normal">
                تتبع استراتيجي لفرص التداول وحساب التكلفة قصير ومتوسط الأجل في البورصة المصرية وصناديق الاستثمار والذهب،
                مع إدارة منضبطة للمخاطر وتاريخ التسوية T+2 دون المساس بالقيود المحاسبية.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {isDemoMode && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => seedDemoMutation.mutate()}
                disabled={seedDemoMutation.isPending}
                className="border-slate-700 bg-slate-900/60 text-slate-300 hover:bg-slate-800"
              >
                {seedDemoMutation.isPending ? (
                  <RefreshCw className="h-4 w-4 ml-1 animate-spin text-amber-400" />
                ) : (
                  <Sparkles className="h-4 w-4 ml-1 text-amber-400" />
                )}
                {seedDemoMutation.isPending ? "جارٍ التحميل..." : "تحميل بيانات تجريبية"}
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                tradesQuery.refetch();
                diagnosticsQuery.refetch();
                candlesQuery.refetch();
              }}
              className="border-slate-700 bg-slate-900/60 text-slate-300 hover:bg-slate-800"
            >
              <RefreshCw className="h-4 w-4 ml-1" />
              تحديث
            </Button>
            <Button
              onClick={() => setIsNewTradeOpen(true)}
              className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold shadow-lg shadow-amber-500/20"
            >
              <Plus className="h-4 w-4 ml-1" />
              تسجيل صفقة سوينج
            </Button>
          </div>
        </div>

        {/* Behavioral Diagnostic Warnings Strip */}
        {diagnostics?.behavioralTips && diagnostics.behavioralTips.length > 0 && (
          <div className="space-y-2">
            {diagnostics.behavioralTips.map((tip, idx) => (
              <div
                key={idx}
                className="flex items-center gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-200"
              >
                <Lightbulb className="h-5 w-5 text-amber-400 shrink-0" />
                <span>{tip}</span>
              </div>
            ))}
          </div>
        )}

        {/* KPI Strip */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {/* Active Capital */}
          <Card className="border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/60 backdrop-blur shadow-sm">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-slate-600 dark:text-slate-300 font-medium text-xs flex items-center justify-between">
                <span>رأس المال في الصفقات النشطة</span>
                <Layers className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="text-slate-900 dark:text-white font-bold text-lg font-mono">
                {formatMoney(diagnostics?.activeCapital ?? 0, "EGP")}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {diagnostics?.openTradesCount ?? 0} صفقات مفتوحة حالياً
              </div>
            </CardContent>
          </Card>

          {/* Win Rate */}
          <Card className="border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/60 backdrop-blur shadow-sm">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-slate-600 dark:text-slate-300 font-medium text-xs flex items-center justify-between">
                <span>معدل النجاح (Win Rate)</span>
                <Target className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="text-emerald-600 dark:text-emerald-400 font-bold text-lg font-mono">
                {diagnostics?.winRate ?? 0}%
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                من إجمالي {diagnostics?.closedTradesCount ?? 0} صفقة مغلقة
              </div>
            </CardContent>
          </Card>

          {/* Realized P&L */}
          <Card className="border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/60 backdrop-blur shadow-sm">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-slate-600 dark:text-slate-300 font-medium text-xs flex items-center justify-between">
                <span>الأرباح المحققة (المغلقة)</span>
                <TrendingUp className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div
                className={`font-bold text-lg font-mono ${
                  (diagnostics?.totalRealizedPnl ?? 0) >= 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-rose-600 dark:text-rose-400"
                }`}
              >
                {formatMoney(diagnostics?.totalRealizedPnl ?? 0, "EGP")}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">صافي العائد المحقق</div>
            </CardContent>
          </Card>

          {/* Profit Factor */}
          <Card className="border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/60 backdrop-blur shadow-sm">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-slate-600 dark:text-slate-300 font-medium text-xs flex items-center justify-between">
                <span>معامل الربحية (Profit Factor)</span>
                <BarChart3 className="h-4 w-4 text-purple-600 dark:text-purple-400" />
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              {diagnostics?.profitFactor !== undefined &&
              (diagnostics.profitFactor >= 999 || !Number.isFinite(diagnostics.profitFactor)) ? (
                <div className="flex items-center gap-2">
                  <span className="text-slate-900 dark:text-white font-bold text-lg font-mono">∞</span>
                  <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 text-xs px-2 py-0.5 font-normal">
                    بدون خسائر
                  </Badge>
                </div>
              ) : (
                <div className="text-slate-900 dark:text-white font-bold text-lg font-mono">
                  {diagnostics?.profitFactor ? diagnostics.profitFactor.toFixed(2) : "1.00"}
                </div>
              )}
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">الأرباح الإجمالية / الخسائر</div>
            </CardContent>
          </Card>

          {/* Avg Holding Period */}
          <Card className="border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/60 backdrop-blur shadow-sm">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-slate-600 dark:text-slate-300 font-medium text-xs flex items-center justify-between">
                <span>متوسط مدة الاحتفاظ</span>
                <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="text-slate-900 dark:text-white font-bold text-lg font-mono">
                {diagnostics?.avgHoldingDays ?? 0} أيام تداول
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">تستثني عطلات البورصة المصرية</div>
            </CardContent>
          </Card>
        </div>

        {/* Filter Bar Pills */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-y border-slate-800/80 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-slate-400 ml-1">الأصول:</span>
            {[
              { id: "ALL", label: "الكل" },
              { id: "EGX_STOCK", label: "البورصة المصرية (EGX)" },
              { id: "NBE_MUTUAL_FUND", label: "صناديق البنك الأهلي" },
              { id: "GOLD", label: "الذهب الفعلي" },
              { id: "TELDA_LIQUIDITY", label: "سيولة تيلدا" },
              { id: "CRYPTO_OTHER", label: "أخرى" },
            ].map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id as CategoryFilter)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  selectedCategory === cat.id
                    ? "bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20"
                    : "bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-slate-200 border border-slate-800"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-400 ml-1">الحالة:</span>
            {[
              { id: "ALL", label: "الكل" },
              { id: "OPEN", label: "مفتوحة" },
              { id: "CLOSED", label: "مغلقة" },
            ].map((st) => (
              <button
                key={st.id}
                onClick={() => setSelectedStatus(st.id as StatusFilter)}
                className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                  selectedStatus === st.id
                    ? "bg-slate-800 text-white border border-slate-700 font-semibold"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>
        </div>

        {/* Live Candlestick Chart View */}
        {activeTrade && (
          <div ref={chartSectionRef} className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span>الرسم البياني الفني والتحليلي:</span>
                  <span className="text-amber-500 dark:text-amber-400 font-mono">{activeTrade.instrumentSymbol}</span>
                  <span className="text-xs text-slate-600 dark:text-slate-300 font-medium">
                    ({activeTrade.instrumentName})
                  </span>
                </h2>
                {activeTrade.isPaperTrading && (
                  <Badge className="bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border-slate-300 dark:border-slate-700 text-[10px]">
                    ورقي / تجريبي
                  </Badge>
                )}
              </div>
              <div className="text-xs text-slate-600 dark:text-slate-300 font-medium flex items-center gap-2">
                <span>تاريخ التسوية المتوقع (T+2):</span>
                <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                  {formatDate(activeTrade.settlementDate)}
                </span>
              </div>
            </div>

            <CandlestickChart
              candles={candlesQuery.data?.candles ?? []}
              ema20={candlesQuery.data?.ema20 ?? []}
              ema50={candlesQuery.data?.ema50 ?? []}
              rsi14={candlesQuery.data?.rsi14 ?? []}
              supports={candlesQuery.data?.supports ?? []}
              resistances={candlesQuery.data?.resistances ?? []}
              entryPrice={activeTrade.entryPrice}
              stopLossPrice={activeTrade.stopLossPrice}
              takeProfitPrice={activeTrade.takeProfitPrice}
              symbol={activeTrade.instrumentSymbol}
              currency={activeTrade.instrumentCurrency}
              timeframe="D1 (يومي)"
              height={380}
            />
          </div>
        )}

        {/* Active Positions & Watchlist Table */}
        <div className="rounded-xl border border-slate-800 bg-[#0B0F17] overflow-hidden shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 px-5 py-3.5 bg-slate-900/90">
            <h3 className="font-bold text-white text-sm flex items-center gap-2">
              <Target className="h-4 w-4 text-amber-400" />
              قائمة صفقات السوينج النشطة والمكتملة ({trades.length})
            </h3>
            <span className="text-xs text-slate-300 font-medium">
              انقر على أي صفقة لعرض الرسم البياني الفني ومستويات الدعم والمقاومة
            </span>
          </div>

          {trades.length === 0 ? (
            <div className="py-16 px-4 text-center">
              <div className="mx-auto w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-4 text-amber-400 shadow-inner">
                <Target className="h-7 w-7" />
              </div>
              <p className="font-bold text-white text-base sm:text-lg">
                لا توجد صفقات سوينج مفتوحة حالياً - افتح صفقة جديدة لتتبعها
              </p>
              <p className="text-xs sm:text-sm text-slate-400 mt-1.5 max-w-md mx-auto">
                سجل صفقات الأسهم وصناديق الاستثمار والذهب، مع تتبع آلي للأهداف ووقف الخسارة ومواعيد التسوية.
              </p>
              <Button
                onClick={() => setIsNewTradeOpen(true)}
                className="mt-5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-5 py-2.5 shadow-lg shadow-amber-500/20"
              >
                + فتح صفقة جديدة
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-950 border-b border-slate-800">
                  <TableRow className="border-b border-slate-800 hover:bg-transparent">
                    <TableHead className="text-right text-xs font-bold text-slate-200 py-3.5">
                      الأداة المالية
                    </TableHead>
                    <TableHead className="text-right text-xs font-bold text-slate-200 py-3.5">
                      الاتجاه والكمية
                    </TableHead>
                    <TableHead className="text-right text-xs font-bold text-slate-200 py-3.5">
                      سعر الدخول
                    </TableHead>
                    <TableHead className="text-right text-xs font-bold text-slate-200 py-3.5">
                      السعر الحالي
                    </TableHead>
                    <TableHead className="text-right text-xs font-bold text-slate-200 py-3.5">
                      الربح / الخسارة
                    </TableHead>
                    <TableHead className="text-right text-xs font-bold text-slate-200 py-3.5">
                      إدارة المخاطر (SL / TP)
                    </TableHead>
                    <TableHead className="text-right text-xs font-bold text-slate-200 py-3.5">
                      الأفق الزمني و T+2
                    </TableHead>
                    <TableHead className="text-right text-xs font-bold text-slate-200 py-3.5">
                      الحالة والإجراء
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {trades.map((trade) => {
                    const isSelected = activeTrade?.id === trade.id;
                    const isProfit = trade.pnlAmount >= 0;
                    return (
                      <TableRow
                        key={trade.id}
                        onClick={() => {
                          setSelectedTradeId(trade.id);
                          chartSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                        }}
                        className={`cursor-pointer border-b border-slate-800 transition-colors ${
                          isSelected
                            ? "bg-amber-500/15 hover:bg-amber-500/20"
                            : "hover:bg-slate-800/60"
                        }`}
                      >
                        {/* Instrument & Symbol */}
                        <TableCell className="py-3.5">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-amber-400 text-sm">
                              {trade.instrumentSymbol}
                            </span>
                            {trade.isPaperTrading ? (
                              <Badge className="bg-slate-800 border border-slate-700 text-slate-200 text-[10px] font-semibold px-2 py-0.5">
                                ورقي
                              </Badge>
                            ) : null}
                          </div>
                          <div className="text-xs text-white font-medium truncate max-w-[170px] mt-0.5">
                            {trade.instrumentName}
                          </div>
                        </TableCell>

                        {/* Direction & Quantity */}
                        <TableCell className="py-3.5">
                          <div className="flex items-center gap-1.5 text-xs font-bold">
                            {trade.direction === "LONG" ? (
                              <span className="text-emerald-400 font-bold flex items-center">
                                <ArrowUpRight className="h-4 w-4 ml-0.5" /> شراء (LONG)
                              </span>
                            ) : (
                              <span className="text-rose-400 font-bold flex items-center">
                                <ArrowDownRight className="h-4 w-4 ml-0.5" /> بيع (SHORT)
                              </span>
                            )}
                          </div>
                          <div className="text-xs font-mono text-slate-200 font-medium mt-1">
                            {Number(trade.quantity).toLocaleString()} سهم / وحدة
                          </div>
                        </TableCell>

                        {/* Entry Price */}
                        <TableCell className="font-mono text-xs py-3.5">
                          <div className="text-white font-bold">{formatMoney(trade.entryPrice, trade.instrumentCurrency)}</div>
                          <div className="text-[11px] text-slate-300 font-medium mt-0.5">
                            {formatDate(trade.entryDate)}
                          </div>
                        </TableCell>

                        {/* Current Price */}
                        <TableCell className="font-mono text-xs py-3.5">
                          <div className="flex items-center gap-1.5 text-white font-bold">
                            <span
                              className={`h-2 w-2 rounded-full ${
                                trade.quoteStatus === "live" ? "bg-emerald-400" : "bg-slate-400"
                              }`}
                            />
                            {formatMoney(trade.currentPrice, trade.instrumentCurrency)}
                          </div>
                          <div className="text-[11px] text-slate-300 font-medium mt-0.5">
                            {trade.quoteStatus === "live" ? "سعر مباشر" : "سعر الإغلاق"}
                          </div>
                        </TableCell>

                        {/* P&L */}
                        <TableCell className="font-mono text-xs py-3.5">
                          <div
                            className={`font-bold text-sm flex items-center gap-1 ${
                              isProfit ? "text-emerald-400" : "text-rose-400"
                            }`}
                          >
                            {isProfit ? "+" : ""}
                            {formatMoney(trade.pnlAmount, trade.instrumentCurrency)}
                          </div>
                          <div
                            className={`text-xs font-bold mt-0.5 ${
                              isProfit ? "text-emerald-400" : "text-rose-400"
                            }`}
                          >
                            {isProfit ? "+" : ""}
                            {trade.pnlPercent.toFixed(2)}%
                          </div>
                        </TableCell>

                        {/* Risk Management */}
                        <TableCell className="text-xs font-mono py-3.5">
                          {(() => {
                            const isTradeOpen = trade.status === "OPEN";
                            const curPrice = Number(trade.currentPrice);
                            const tp = trade.takeProfitPrice ? Number(trade.takeProfitPrice) : null;
                            const sl = trade.stopLossPrice ? Number(trade.stopLossPrice) : null;

                            // Proximity to Take Profit: 0 < (tp - curPrice) / curPrice <= 0.02
                            const tpDiffRatio = (isTradeOpen && tp && curPrice > 0) ? (tp - curPrice) / curPrice : null;
                            const isNearTp = tpDiffRatio !== null && tpDiffRatio > 0 && tpDiffRatio <= 0.02;
                            const tpRemaining = tpDiffRatio !== null ? (tpDiffRatio * 100).toFixed(1) : null;

                            // Proximity to Stop Loss: 0 < (curPrice - sl) / curPrice <= 0.02
                            const slDiffRatio = (isTradeOpen && sl && curPrice > 0) ? (curPrice - sl) / curPrice : null;
                            const isNearSl = slDiffRatio !== null && slDiffRatio > 0 && slDiffRatio <= 0.02;
                            const slRemaining = slDiffRatio !== null ? (slDiffRatio * 100).toFixed(1) : null;

                            return (
                              <div className="space-y-1">
                                <div className="space-y-0.5">
                                  <div className="text-rose-400 font-semibold text-xs">
                                    وقف: {trade.stopLossPrice ? Number(trade.stopLossPrice).toFixed(2) : "غير محدد"}
                                  </div>
                                  <div className="text-emerald-400 font-semibold text-xs">
                                    هدف: {trade.takeProfitPrice ? Number(trade.takeProfitPrice).toFixed(2) : "غير محدد"}
                                  </div>
                                  {trade.riskRewardRatio && (
                                    <div className="text-[11px] text-slate-300 font-medium">
                                      R:R: 1:{Number(trade.riskRewardRatio).toFixed(1)}
                                    </div>
                                  )}
                                </div>

                                {isNearTp && (
                                  <div className="mt-1">
                                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-300 border border-emerald-500/50 animate-pulse font-sans">
                                      <span>🎯</span>
                                      <span>اقترب من الهدف (باقي {tpRemaining}%)</span>
                                    </span>
                                  </div>
                                )}

                                {isNearSl && (
                                  <div className="mt-1">
                                    <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/20 px-2 py-0.5 text-[10px] font-bold text-rose-300 border border-rose-500/50 animate-pulse font-sans">
                                      <span>⚠️</span>
                                      <span>اقترب من وقف الخسارة (باقي {slRemaining}%)</span>
                                    </span>
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                        </TableCell>

                        {/* Holding Timeline */}
                        <TableCell className="text-xs font-mono py-3.5">
                          <div className="text-white font-medium">
                            {trade.elapsedTradingDays} من {trade.targetHoldingDays} أيام
                          </div>
                          <div className="text-[11px] text-slate-300 font-medium mt-0.5">
                            تسوية: {formatDate(trade.settlementDate)}
                          </div>
                        </TableCell>

                        {/* Status & Actions */}
                        <TableCell className="py-3.5">
                          <div className="flex items-center gap-2">
                            {trade.status === "OPEN" ? (
                              <Badge className="bg-blue-500/20 text-blue-300 border border-blue-500/40 text-xs font-bold px-2 py-0.5">
                                مفتوحة
                              </Badge>
                            ) : trade.status === "TARGET_HIT" ? (
                              <Badge className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-bold px-2 py-0.5">
                                تم الهدف
                              </Badge>
                            ) : trade.status === "STOPPED_OUT" ? (
                              <Badge className="bg-rose-500/20 text-rose-300 border border-rose-500/40 text-xs font-bold px-2 py-0.5">
                                وقف الخسارة
                              </Badge>
                            ) : (
                              <Badge className="bg-slate-800 text-slate-200 border border-slate-700 text-xs font-bold px-2 py-0.5">
                                {trade.status}
                              </Badge>
                            )}

                            {trade.status === "OPEN" && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenCloseModal(trade);
                                }}
                                className="h-7 border-slate-700 bg-slate-800 hover:bg-slate-700 text-white font-medium text-xs px-2.5"
                              >
                                إغلاق الصفقة
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        {/* Strategy Attribution & Behavioral Section */}
        {diagnostics?.strategyAttribution && diagnostics.strategyAttribution.length > 0 && (
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
            <h3 className="font-bold text-white text-sm flex items-center gap-2 mb-3">
              <Layers className="h-4 w-4 text-purple-400" />
              توزيع الأداء حسب الاستراتيجية (Strategy Attribution)
            </h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {diagnostics.strategyAttribution.map((strat) => (
                <div
                  key={strat.strategy}
                  className="rounded-lg border border-slate-800 bg-slate-950/60 p-3"
                >
                  <div className="text-xs font-semibold text-slate-300">{strat.strategy}</div>
                  <div className="mt-2 flex items-baseline justify-between">
                    <span className="text-xs text-slate-400">نسبة النجاح:</span>
                    <span className="font-mono text-sm font-bold text-emerald-400">
                      {strat.winRate}%
                    </span>
                  </div>
                  <div className="mt-1 flex items-baseline justify-between">
                    <span className="text-xs text-slate-400">إجمالي الأرباح:</span>
                    <span
                      className={`font-mono text-xs font-bold ${
                        strat.totalPnl >= 0 ? "text-emerald-400" : "text-rose-400"
                      }`}
                    >
                      {formatMoney(strat.totalPnl, "EGP")}
                    </span>
                  </div>
                  <div className="mt-1 text-[11px] text-slate-500">{strat.count} صفقات مسجلة</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Modal: New Swing Trade Entry with Advisory Co-Pilot */}
        <Dialog open={isNewTradeOpen} onOpenChange={setIsNewTradeOpen}>
          <DialogContent className="max-w-2xl bg-slate-950 border-slate-800 text-slate-100" dir="rtl">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-white flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-amber-400" />
                تسجيل صفقة سوينج جديدة (Trade Entry)
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-400">
                المستشار المالي الذكي: يقدم نصائح واقتراحات فورية لحجم الصفقة وإدارة المخاطر. الزر متاح
                دائماً للحفظ دون قيود إلزامية.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmitNewTrade} className="space-y-4">
              {/* Dual-Layer Architecture: Execution Mode Selector */}
              <div className="space-y-2 rounded-xl border border-slate-800 bg-slate-900/40 p-3.5">
                <Label className="text-xs font-bold text-slate-200 block">
                  طريقة تسجيل الصفقة في النظام (Execution Mode):
                </Label>
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  {/* Option A (Default) */}
                  <div
                    onClick={() => {
                      setTradeExecutionMode("ADVISORY_TRACKING");
                      setFormFundingAccount("");
                    }}
                    className={`cursor-pointer rounded-xl border p-3 transition-all ${
                      tradeExecutionMode === "ADVISORY_TRACKING"
                        ? "border-amber-500 bg-amber-500/10 shadow-md shadow-amber-500/10"
                        : "border-slate-800 bg-slate-900/80 hover:border-slate-700"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-amber-300">
                        «صفقة تتبع واستشارة حرة»
                      </span>
                      <span
                        className={`h-3 w-3 rounded-full border ${
                          tradeExecutionMode === "ADVISORY_TRACKING"
                            ? "border-amber-400 bg-amber-400"
                            : "border-slate-600 bg-transparent"
                        }`}
                      />
                    </div>
                    <p className="mt-1.5 text-[11px] leading-relaxed text-slate-400">
                      لا تؤثر على أرصدة البنك ولا تُنشئ قيوداً محاسبية (مناسبة لمتابعة محافظك الخارجية وتطبيقات التداول).
                    </p>
                  </div>

                  {/* Option B */}
                  <div
                    onClick={() => setTradeExecutionMode("FUNDED_LEDGER")}
                    className={`cursor-pointer rounded-xl border p-3 transition-all ${
                      tradeExecutionMode === "FUNDED_LEDGER"
                        ? "border-emerald-500 bg-emerald-500/10 shadow-md shadow-emerald-500/10"
                        : "border-slate-800 bg-slate-900/80 hover:border-slate-700"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-emerald-300">
                        «صفقة ممولة مرتبطة بالدفاتر»
                      </span>
                      <span
                        className={`h-3 w-3 rounded-full border ${
                          tradeExecutionMode === "FUNDED_LEDGER"
                            ? "border-emerald-400 bg-emerald-400"
                            : "border-slate-600 bg-transparent"
                        }`}
                      />
                    </div>
                    <p className="mt-1.5 text-[11px] leading-relaxed text-slate-400">
                      تخصم قيمة الشراء من حسابك البنكي وتُسجل كأصل استثماري رسمي في القوائم المالية.
                    </p>
                  </div>
                </div>
              </div>

              {/* Instrument & Category */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-300">الأداة المالية *</Label>
                  <Select
                    value={formInstrumentId}
                    onValueChange={(val) => {
                      setFormInstrumentId(val);
                      const inst = instruments.find((i) => String(i.id) === val);
                      if (inst) {
                        // 1. Check portfolio position live quote
                        const pos = (portfolioQuery.data ?? []).find((p) => p.instrumentId === inst.id);
                        if (pos?.marketPrice && Number(pos.marketPrice) > 0) {
                          setFormEntryPrice(Number(pos.marketPrice).toFixed(2));
                        } else if (inst.symbol) {
                          // 2. Check Egypt Market stocks
                          const stock = (egyptMarketQuery.data?.egxStocks ?? []).find(
                            (s) => s.ticker === inst.symbol || s.symbol === inst.symbol?.replace(".CA", "")
                          );
                          if (stock?.lastClose) {
                            setFormEntryPrice(Number(stock.lastClose).toFixed(2));
                          } else if (inst.assetType === "gold" || inst.symbol.includes("GOLD") || inst.name.includes("ذهب")) {
                            const g24 = egyptMarketQuery.data?.gold.purities[0]?.gramPriceEGP;
                            if (g24) setFormEntryPrice(Number(g24).toFixed(2));
                          } else if (inst.symbol === "COMI.CA") {
                            setFormEntryPrice("88.50");
                          } else if (inst.symbol === "SWDY.CA") {
                            setFormEntryPrice("47.25");
                          }
                        }
                      }
                    }}
                  >
                    <SelectTrigger className="bg-slate-900 border-slate-800 text-xs">
                      <SelectValue placeholder="اختر أداة مالية أو سهماً" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                      {instruments.map((inst) => (
                        <SelectItem key={inst.id} value={String(inst.id)}>
                          {inst.symbol ? `${inst.symbol} — ` : ""}
                          {inst.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-300">فئة الأصل</Label>
                  <Select
                    value={formCategory}
                    onValueChange={(val: any) => setFormCategory(val)}
                  >
                    <SelectTrigger className="bg-slate-900 border-slate-800 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                      <SelectItem value="EGX_STOCK">أسهم البورصة المصرية (EGX)</SelectItem>
                      <SelectItem value="NBE_MUTUAL_FUND">صناديق استثمار البنك الأهلي</SelectItem>
                      <SelectItem value="GOLD">الذهب الفعلي</SelectItem>
                      <SelectItem value="TELDA_LIQUIDITY">سيولة تيلدا</SelectItem>
                      <SelectItem value="CRYPTO_OTHER">أخرى</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Direction, Quantity, Entry Price */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-300">الاتجاه</Label>
                  <Select
                    value={formDirection}
                    onValueChange={(val: any) => setFormDirection(val)}
                  >
                    <SelectTrigger className="bg-slate-900 border-slate-800 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                      <SelectItem value="LONG">شراء (LONG)</SelectItem>
                      <SelectItem value="SHORT">بيع (SHORT)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-300">{assetInputConfig.quantityLabel}</Label>
                  <Input
                    type="number"
                    step="any"
                    value={formQuantity}
                    onChange={(e) => setFormQuantity(e.target.value)}
                    placeholder={assetInputConfig.quantityPlaceholder}
                    className="bg-slate-900 border-slate-800 text-xs font-mono"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-300">{assetInputConfig.priceLabel}</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formEntryPrice}
                    onChange={(e) => setFormEntryPrice(e.target.value)}
                    placeholder={assetInputConfig.pricePlaceholder}
                    className="bg-slate-900 border-slate-800 text-xs font-mono"
                    required
                  />
                </div>
              </div>

              {/* Stop Loss, Take Profit, Target Days */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-rose-400">وقف الخسارة (Stop Loss)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formStopLoss}
                    onChange={(e) => setFormStopLoss(e.target.value)}
                    placeholder="اختياري (مثال: 81.00)"
                    className="bg-slate-900 border-slate-800 text-xs font-mono text-rose-300"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-emerald-400">الهدف الربحي (Take Profit)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formTakeProfit}
                    onChange={(e) => setFormTakeProfit(e.target.value)}
                    placeholder="اختياري (مثال: 94.00)"
                    className="bg-slate-900 border-slate-800 text-xs font-mono text-emerald-300"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-300">أيام الاحتفاظ المستهدفة</Label>
                  <Input
                    type="number"
                    value={formHoldingDays}
                    onChange={(e) => setFormHoldingDays(e.target.value)}
                    placeholder="10"
                    className="bg-slate-900 border-slate-800 text-xs font-mono"
                  />
                </div>
              </div>

              {/* Strategy & Conditional Funding Account */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-300">استراتيجية التداول</Label>
                  <Select
                    value={formStrategyTag}
                    onValueChange={(val) => setFormStrategyTag(val)}
                  >
                    <SelectTrigger className="bg-slate-900 border-slate-800 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                      <SelectItem value="EMA_PULLBACK">ارتداد من متوسط متحرك (EMA Pullback)</SelectItem>
                      <SelectItem value="BREAKOUT">اختراق مقاومة بحجم تداول (Breakout)</SelectItem>
                      <SelectItem value="RSI_OVERSOLD">تشبع بيعي (RSI Oversold)</SelectItem>
                      <SelectItem value="MEAN_REVERSION">ارتداد للمتوسط (Mean Reversion)</SelectItem>
                      <SelectItem value="CATALYST">محفز مالي / أرباح (Catalyst)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {tradeExecutionMode === "FUNDED_LEDGER" ? (
                  <div className="space-y-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
                    <Label className="text-xs font-bold text-emerald-300">
                      حساب الخصم / التمويل البنكي *
                    </Label>
                    <Select
                      value={formFundingAccount}
                      onValueChange={(val) => setFormFundingAccount(val)}
                    >
                      <SelectTrigger className="bg-slate-900 border-slate-800 text-xs text-white">
                        <SelectValue placeholder="اختر الحساب البنكي أو النقدي للخصم" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                        {accounts.map((acc) => (
                          <SelectItem key={acc.id} value={String(acc.id)}>
                            {acc.name} ({acc.currency})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <div className="rounded-lg border border-slate-800/80 bg-slate-900/30 p-3 flex items-center gap-2 text-xs text-slate-400">
                    <Info className="h-4 w-4 text-amber-400 shrink-0" />
                    <span>صفقة حرة بدون ربط بنكي — لن تُخصم أي أموال من الدفاتر.</span>
                  </div>
                )}
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-300">ملاحظات وفرضية الصفقة (Thesis)</Label>
                <Textarea
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="سجل أسباب الدخول، مستويات الدعم والمقاومة، أو أي ملاحظات أخرى..."
                  className="bg-slate-900 border-slate-800 text-xs"
                  rows={2}
                />
              </div>

              {/* Dynamic Advisory Co-Pilot Insights Card */}
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3.5 space-y-2 text-xs">
                <div className="flex items-center gap-2 font-bold text-amber-400">
                  <Sparkles className="h-4 w-4" />
                  <span>تحليل المستشار المالي الفوري (Advisory Insights):</span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-slate-300">
                  <div>
                    معدل العائد للمخاطرة (R:R):{" "}
                    <b
                      className={
                        coPilotInsights.rr.isFavorable ? "text-emerald-400" : "text-amber-300"
                      }
                    >
                      {coPilotInsights.rr.riskRewardRatio
                        ? `1 : ${coPilotInsights.rr.riskRewardRatio.toFixed(1)}`
                        : "غير محدد (اختياري)"}
                    </b>
                  </div>
                  <div>
                    تاريخ التسوية المتوقع (T+2):{" "}
                    <b className="text-blue-300 font-mono">
                      {formatDate(coPilotInsights.timeline.settlementDate)}
                    </b>
                  </div>
                </div>

                {/* Visual Risk/Reward Ratio Meter Bar */}
                {coPilotInsights.rr.riskRewardRatio ? (
                  <div className="space-y-1.5 border-t border-amber-500/20 pt-2">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-300">مقياس جدوى المخاطرة للعائد:</span>
                      <Badge
                        variant="outline"
                        className={`text-xs font-mono font-bold ${
                          coPilotInsights.rr.riskRewardRatio >= 2.5
                            ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                            : coPilotInsights.rr.riskRewardRatio >= 1.5
                            ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
                            : "bg-rose-500/20 text-rose-400 border-rose-500/30"
                        }`}
                      >
                        {coPilotInsights.rr.riskRewardRatio >= 2.5
                          ? "عائد ممتاز (≥ 1:2.5)"
                          : coPilotInsights.rr.riskRewardRatio >= 1.5
                          ? "عائد مقبول (≥ 1:1.5)"
                          : "مخاطرة مرتفعة (< 1:1.5)"}
                      </Badge>
                    </div>
                    <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden border border-slate-700">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          coPilotInsights.rr.riskRewardRatio >= 2.5
                            ? "bg-emerald-500 shadow-sm shadow-emerald-500/50"
                            : coPilotInsights.rr.riskRewardRatio >= 1.5
                            ? "bg-amber-400 shadow-sm shadow-amber-400/50"
                            : "bg-rose-500 shadow-sm shadow-rose-500/50"
                        }`}
                        style={{ width: `${Math.min(100, Math.max(10, (coPilotInsights.rr.riskRewardRatio / 4) * 100))}%` }}
                      />
                    </div>
                  </div>
                ) : null}

                {coPilotInsights.posSize && (
                  <div className="text-slate-400 border-t border-amber-500/20 pt-1.5">
                    الكمية المقترحة لإبقاء المخاطرة تحت 1.5% من رأس المال:{" "}
                    <b className="text-white font-mono">
                      {coPilotInsights.posSize.recommendedQuantity} {assetInputConfig.unitName}
                    </b>{" "}
                    (تكلفة: {formatMoney(coPilotInsights.posSize.totalCost, "EGP")})
                  </div>
                )}

                {!formStopLoss && (
                  <div className="text-slate-400 text-[11px] flex items-center gap-1.5 text-amber-300/80">
                    <Info className="h-3.5 w-3.5 shrink-0" />
                    <span>
                      نصيحة استشارية: تسجيل وقف الخسارة يحميك من تقلبات السوق المفاجئة، لكن يمكنك
                      الحفظ بدونه.
                    </span>
                  </div>
                )}
              </div>

              <DialogFooter className="gap-2 sm:gap-0 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setIsNewTradeOpen(false)}
                  className="text-slate-400 hover:text-white text-xs"
                >
                  إلغاء
                </Button>
                {/* CRITICAL: Save button is NEVER disabled due to missing SL/TP/account/R:R */}
                <Button
                  type="submit"
                  disabled={createTradeMutation.isPending}
                  className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs"
                >
                  {createTradeMutation.isPending ? "جاري الحفظ..." : "سجل الصفقة الآن"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Modal: Close Swing Trade */}
        <Dialog open={isCloseModalOpen} onOpenChange={setIsCloseModalOpen}>
          <DialogContent className="max-w-md bg-slate-950 border-slate-800 text-slate-100" dir="rtl">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-white flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                تسجيل إغلاق صفقة سوينج
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-400">
                أدخل سعر التنفيذ الفعلي لتحديث مؤشرات الأداء ومعدل النجاح.
              </DialogDescription>
            </DialogHeader>

            {tradeToClose && (
              <form onSubmit={handleSubmitCloseTrade} className="space-y-3.5">
                <div className="rounded-lg bg-slate-900 p-3 text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-400">الأداة:</span>
                    <span className="font-bold text-white font-mono">
                      {tradeToClose.instrumentSymbol} ({tradeToClose.instrumentName})
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">سعر الدخول:</span>
                    <span className="font-mono text-slate-200">
                      {formatMoney(tradeToClose.entryPrice, tradeToClose.instrumentCurrency)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">الكمية:</span>
                    <span className="font-mono text-slate-200">
                      {tradeToClose.quantity} سهم / وحدة
                    </span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-300">سعر الخروج الفعلي (EGP) *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={closeExitPrice}
                    onChange={(e) => setCloseExitPrice(e.target.value)}
                    className="bg-slate-900 border-slate-800 text-xs font-mono text-white"
                    required
                  />
                </div>

                {/* Profit Lock-in Advisor (Profit Sweeping Recommendation) */}
                {(() => {
                  const exitPriceNum = parseFloat(closeExitPrice);
                  const entryPriceNum = parseFloat(tradeToClose.entryPrice);
                  const quantityNum = parseFloat(tradeToClose.quantity);
                  const isLong = (tradeToClose.direction ?? "LONG") === "LONG";
                  const currency = tradeToClose.instrumentCurrency ?? "EGP";

                  if (!isNaN(exitPriceNum) && exitPriceNum > 0 && !isNaN(entryPriceNum) && !isNaN(quantityNum)) {
                    const realizedProfit = isLong
                      ? (exitPriceNum - entryPriceNum) * quantityNum
                      : (entryPriceNum - exitPriceNum) * quantityNum;

                    if (realizedProfit > 0) {
                      const halfProfit = realizedProfit * 0.5;
                      return (
                        <div className="rounded-xl border border-emerald-500/40 bg-gradient-to-br from-emerald-950/40 via-amber-950/20 to-slate-900/80 p-3.5 shadow-lg space-y-2">
                          <div className="flex items-center gap-2 text-xs font-bold text-emerald-300">
                            <span className="text-base">🛡️</span>
                            <span>توصية المستشار: تأمين وحصاد الأرباح (Profit Sweeping)</span>
                          </div>
                          <p className="text-xs text-slate-200 leading-relaxed font-normal">
                            تهانينا على تحقيق ربح قدره{" "}
                            <span className="font-bold text-emerald-400 font-mono">
                              {formatMoney(realizedProfit, currency)}
                            </span>
                            ! لبناء ثروة تراكمية آمنة، يقترح المستشار ترحيل 50% من هذا الربح (
                            <span className="font-bold text-amber-400 font-mono">
                              {formatMoney(halfProfit, currency)}
                            </span>
                            ) إلى أصول دفاعية منخفضة المخاطر (مثل صناديق البنك الأهلي النقدية أو الذهب) لتجنب إعادة المخاطرة بها في السوق.
                          </p>
                        </div>
                      );
                    }
                  }
                  return null;
                })()}

                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-300">سبب الإغلاق / النتيجة</Label>
                  <Select
                    value={closeStatus}
                    onValueChange={(val: any) => setCloseStatus(val)}
                  >
                    <SelectTrigger className="bg-slate-900 border-slate-800 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                      <SelectItem value="TARGET_HIT">تحقق الهدف الربحي (Target Hit)</SelectItem>
                      <SelectItem value="STOPPED_OUT">تفعيل وقف الخسارة (Stopped Out)</SelectItem>
                      <SelectItem value="CLOSED_MANUALLY">إغلاق يدوي مبكر (Closed Manually)</SelectItem>
                      <SelectItem value="TIME_EXPIRED">انتهاء الأجل الزمني (Time Expired)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-300">ملاحظات الإغلاق والدروس المستفادة</Label>
                  <Textarea
                    value={closeNotes}
                    onChange={(e) => setCloseNotes(e.target.value)}
                    placeholder="هل كان الخروج وفق الخطة؟ ما الدروس المستفادة؟"
                    className="bg-slate-900 border-slate-800 text-xs"
                    rows={2}
                  />
                </div>

                <DialogFooter className="gap-2 sm:gap-0 pt-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setIsCloseModalOpen(false)}
                    className="text-slate-400 hover:text-white text-xs"
                  >
                    إلغاء
                  </Button>
                  <Button
                    type="submit"
                    disabled={closeTradeMutation.isPending}
                    className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs"
                  >
                    {closeTradeMutation.isPending ? "جاري الحفظ..." : "تأكيد إغلاق الصفقة"}
                  </Button>
                </DialogFooter>
              </form>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
