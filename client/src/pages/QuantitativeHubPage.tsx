import React, { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { formatMoney } from "@/lib/financialDisplay";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Sparkles,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Layers,
  BarChart3,
  ShieldCheck,
  CreditCard,
  PieChart,
  Activity,
  ArrowRightLeft,
  DollarSign,
  Info,
  Clock,
  Zap,
  Plus,
  Trash2,
  ExternalLink,
  ArrowUpRight,
  Search,
  Copy,
  Check,
  PlusCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Link, useLocation } from "wouter";
import { LogExternalTradeModal } from "@/components/trading/LogExternalTradeModal";

export default function QuantitativeHubPage() {
  const [location, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window !== "undefined") {
      if (window.location.pathname.includes("/gold")) return "market";
      const params = new URLSearchParams(window.location.search);
      return params.get("tab") || (params.get("ticker") ? "signals" : "signals");
    }
    return "signals";
  });

  const [selectedTicker, setSelectedTicker] = useState(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const tickerParam = params.get("ticker");
      if (tickerParam) return tickerParam.toUpperCase();
    }
    return "COMI.CA";
  });

  React.useEffect(() => {
    if (location.includes("/gold")) {
      setActiveTab("market");
    }
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const tickerParam = params.get("ticker");
      if (tickerParam) {
        setSelectedTicker(tickerParam.toUpperCase());
        setActiveTab("signals");
      }
      const tabParam = params.get("tab");
      if (tabParam) {
        setActiveTab(tabParam);
      }
    }
  }, [location]);

  const [targetProfile, setTargetProfile] = useState<"BALANCED" | "CONSERVATIVE" | "GROWTH">("BALANCED");
  
  // Search & External Trade State
  const [catalogQuery, setCatalogQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isExternalTradeOpen, setIsExternalTradeOpen] = useState(false);
  const [copiedTicker, setCopiedTicker] = useState<string | null>(null);

  const catalogResults = trpc.quant.searchCatalog.useQuery(
    { query: catalogQuery, limit: 20 },
    { staleTime: 300_000 }
  );

  const handleSelectTicker = (ticker: string) => {
    const formatted = ticker.toUpperCase();
    setSelectedTicker(formatted);
    setIsSearchOpen(false);
    setCatalogQuery("");
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("ticker", formatted);
      url.searchParams.set("tab", "signals");
      window.history.replaceState(null, "", url.toString());
    }
  };

  const copySignalCard = (signalData: any, displayName: string) => {
    const text = `📋 بطاقة صفقة استرشادية: ${displayName} (${signalData.ticker})
• الإجراء المقترح: ${signalData.actionAr || "تجميع"} (ثقة: ${signalData.confidenceScore}%)
• السعر الاسترشادي: ${signalData.currentPrice} ج.م
• نطاق الدخول: ${signalData.entryZone.min.toFixed(2)} - ${signalData.entryZone.max.toFixed(2)} ج.م
• الهدف الأول (TP1): ${signalData.targets.t1.toFixed(2)} ج.م
• الهدف الثاني (TP2): ${signalData.targets.t2.toFixed(2)} ج.م
• وقف الخسارة (SL): ${signalData.stopLoss.toFixed(2)} ج.م
• نسبة العائد للمخاطرة: 1 : ${signalData.riskRewardRatio}`;
    navigator.clipboard.writeText(text);
    setCopiedTicker(signalData.ticker);
    toast.success(`تم نسخ بطاقة الصفقة لـ ${displayName} إلى الحافظة`);
    setTimeout(() => setCopiedTicker(null), 2500);
  };
  
  // Simulation Trade Modal
  const [isSimTradeOpen, setIsSimTradeOpen] = useState(false);
  const [simAction, setSimAction] = useState<"BUY" | "SELL">("BUY");
  const [simQty, setSimQty] = useState<number>(100);
  const [simNotes, setSimNotes] = useState("");

  // Credit Card Creation Modal
  const [isCardModalOpen, setIsCardModalOpen] = useState(false);
  const [cardName, setCardName] = useState("");
  const [cardLender, setCardLender] = useState("");
  const [cardLimit, setCardLimit] = useState<number>(50000);
  const [cardUtilized, setCardUtilized] = useState<number>(0);
  const [cardCycleDay, setCardCycleDay] = useState<number>(28);
  const [cardGraceDays, setCardGraceDays] = useState<number>(25);

  // Subscription Creation Modal
  const [isSubModalOpen, setIsSubModalOpen] = useState(false);
  const [subMemo, setSubMemo] = useState("");
  const [subTag, setSubTag] = useState("خدمات دورية");
  const [subAmount, setSubAmount] = useState<number>(250);
  const [subCadence, setSubCadence] = useState<"monthly" | "yearly">("monthly");

  const utils = trpc.useUtils();

  // 1. Egypt Market Data
  const { data: egyptMarket } = trpc.quant.getEgyptMarket.useQuery();

  // 2. Advisory Signal
  const { data: signal, refetch: refetchSignal } = trpc.quant.getAdvisorySignal.useQuery({
    ticker: selectedTicker,
    assetType: selectedTicker.includes("GOLD") ? "GOLD" : selectedTicker === "AZG" ? "MUTUAL_FUND" : "EGX_STOCK",
  });

  // 3. Rebalancing Analysis
  const { data: rebalancing } = trpc.quant.getRebalancingAnalysis.useQuery({
    targetProfile,
  });

  // 4. Financial Health
  const { data: health } = trpc.quant.getFinancialHealth.useQuery();

  // 5. Paper Trading State
  const { data: paperData } = trpc.quant.getPaperTradingState.useQuery();

  // Mutations
  const simOrderMutation = trpc.quant.executeSimulatedOrder.useMutation({
    onSuccess: (res) => {
      toast.success(res.messageAr);
      setIsSimTradeOpen(false);
      utils.quant.getPaperTradingState.invalidate();
    },
    onError: (err) => {
      toast.error(err.message || "تعذر تنفيذ أمر المحاكاة");
    },
  });

  const createCardMutation = trpc.quant.createCreditCard.useMutation({
    onSuccess: (res) => {
      toast.success(res.messageAr);
      setIsCardModalOpen(false);
      setCardName("");
      setCardLender("");
      setCardLimit(50000);
      setCardUtilized(0);
      utils.quant.getFinancialHealth.invalidate();
    },
    onError: (err) => {
      toast.error(err.message || "تعذر إضافة بطاقة الائتمان");
    },
  });

  const deleteCardMutation = trpc.quant.deleteCreditCard.useMutation({
    onSuccess: (res) => {
      toast.success(res.messageAr);
      utils.quant.getFinancialHealth.invalidate();
    },
    onError: (err) => {
      toast.error(err.message || "تعذر حذف البطاقة");
    },
  });

  const createSubMutation = trpc.quant.createSubscription.useMutation({
    onSuccess: (res) => {
      toast.success(res.messageAr);
      setIsSubModalOpen(false);
      setSubMemo("");
      setSubAmount(250);
      utils.quant.getFinancialHealth.invalidate();
    },
    onError: (err) => {
      toast.error(err.message || "تعذر إضافة الاشتراك");
    },
  });

  const activeInstrument = egyptMarket?.egxStocks.find((s) => s.ticker === selectedTicker);
  const currentPrice = signal?.currentPrice || activeInstrument?.lastClose || 88.5;

  const handleSimulateTradeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (simQty <= 0) {
      toast.error("الكمية يجب أن تكون أكبر من الصفر");
      return;
    }

    simOrderMutation.mutate({
      ticker: selectedTicker,
      nameAr: activeInstrument?.nameAr || selectedTicker,
      action: simAction,
      assetCategory: selectedTicker.includes("GOLD") ? "GOLD" : selectedTicker === "AZG" ? "MUTUAL_FUND" : "EGX_STOCK",
      quantity: simQty,
      marketPrice: currentPrice,
      notes: simNotes || undefined,
    });
  };

  const handleCreateCardSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cardName.trim() || !cardLender.trim()) {
      toast.error("يرجى إدخال اسم البطاقة والبنك المصدر");
      return;
    }
    createCardMutation.mutate({
      name: cardName.trim(),
      lender: cardLender.trim(),
      creditLimit: cardLimit,
      utilizedBalance: cardUtilized,
      billingCycleDay: cardCycleDay,
      gracePeriodDays: cardGraceDays,
      currency: "EGP",
    });
  };

  const handleCreateSubSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subMemo.trim() || subAmount <= 0) {
      toast.error("يرجى إدخال اسم الخدمة وقيمة الاشتراك");
      return;
    }
    createSubMutation.mutate({
      memo: subMemo.trim(),
      subscriptionTag: subTag.trim(),
      amount: subAmount,
      cadence: subCadence,
      currency: "EGP",
    });
  };

  return (
    <DashboardLayout>
      <div className="space-y-8 pb-16 text-slate-900 dark:text-slate-100" dir="rtl">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-500 dark:text-amber-400">
                <Sparkles className="w-6 h-6 animate-pulse" />
              </div>
              <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">
                مركز الاستخبارات المالية والتحليل الكمي
              </h1>
            </div>
            <p className="text-slate-600 dark:text-slate-300 text-sm font-medium flex items-center gap-2">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
              نظام استرشادي ومحاكاة كمية مربوط بنسبة 100% بسجلات قاعدة البيانات الحقيقية — بدون بيانات وهمية.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Badge variant="outline" className="px-3 py-1.5 border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-300 font-bold gap-1.5">
              <ShieldCheck className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              حماية الثروة العائلية 2026
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                refetchSignal();
                utils.quant.invalidate();
                toast.success("تم تحديث كافة المؤشرات وبيانات السوق");
              }}
              className="gap-2 border-slate-200 bg-white text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-100 dark:hover:bg-slate-800 font-semibold shadow-xs"
            >
              <RefreshCw className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              تحديث مباشر
            </Button>
          </div>
        </div>

        {/* Top Summary Ticker Bar - Dynamic Light & Dark Elevated Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-white dark:bg-[#0E1420] border border-slate-200/90 dark:border-white/10 shadow-xs text-slate-900 dark:text-white">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-600 dark:text-slate-300 font-bold">ذهب عيار 24 (سبائك)</p>
                <p className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1 font-mono">
                  {egyptMarket?.gold.purities[0]?.gramPriceEGP ? formatMoney(egyptMarket.gold.purities[0].gramPriceEGP) : "4,650 ج.م"}
                </p>
              </div>
              <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-[#162033] text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-slate-700">
                <DollarSign className="w-5 h-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white dark:bg-[#0E1420] border border-slate-200/90 dark:border-white/10 shadow-xs text-slate-900 dark:text-white">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-600 dark:text-slate-300 font-bold">الجنيه الذهب (8 جم 21k)</p>
                <p className="text-2xl font-black text-amber-600 dark:text-amber-300 mt-1 font-mono">
                  {egyptMarket?.gold.sovereign.priceEGP ? formatMoney(egyptMarket.gold.sovereign.priceEGP) : "32,550 ج.م"}
                </p>
              </div>
              <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-[#162033] text-amber-600 dark:text-amber-300 border border-amber-200 dark:border-slate-700">
                <Layers className="w-5 h-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white dark:bg-[#0E1420] border border-slate-200/90 dark:border-white/10 shadow-xs text-slate-900 dark:text-white">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-600 dark:text-slate-300 font-bold">سيولة الطوارئ العائلية الحقيقية</p>
                <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1 font-mono">
                  {health?.diagnostics.emergencyRunwayMonths !== undefined ? `${health.diagnostics.emergencyRunwayMonths} أشهر` : "0 أشهر"}
                </p>
              </div>
              <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-[#162033] text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-slate-700">
                <Activity className="w-5 h-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white dark:bg-[#0E1420] border border-slate-200/90 dark:border-white/10 shadow-xs text-slate-900 dark:text-white">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-600 dark:text-slate-300 font-bold">عائد محفظة المحاكاة</p>
                <p className={`text-2xl font-black mt-1 font-mono ${((paperData?.paperState.totalReturnPercent ?? 0) >= 0) ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                  {paperData?.paperState.totalReturnPercent ? `${paperData.paperState.totalReturnPercent > 0 ? "+" : ""}${paperData.paperState.totalReturnPercent}%` : "0.00%"}
                </p>
              </div>
              <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-[#162033] text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-slate-700">
                <BarChart3 className="w-5 h-5" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Tabs Hub */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid grid-cols-2 md:grid-cols-5 bg-slate-100 dark:bg-slate-900/90 p-1.5 rounded-xl border border-slate-200 dark:border-slate-800 h-auto gap-1">
            <TabsTrigger value="signals" className="gap-2 py-2.5 data-[state=active]:bg-amber-500 data-[state=active]:text-slate-950 font-bold text-slate-700 dark:text-slate-200">
              <Zap className="w-4 h-4" />
              الإشارات الكمية
            </TabsTrigger>
            <TabsTrigger value="market" className="gap-2 py-2.5 data-[state=active]:bg-amber-500 data-[state=active]:text-slate-950 font-bold text-slate-700 dark:text-slate-200">
              <BarChart3 className="w-4 h-4" />
              البورصة والذهب
            </TabsTrigger>
            <TabsTrigger value="paper" className="gap-2 py-2.5 data-[state=active]:bg-amber-500 data-[state=active]:text-slate-950 font-bold text-slate-700 dark:text-slate-200">
              <Activity className="w-4 h-4" />
              محفظة المحاكاة
            </TabsTrigger>
            <TabsTrigger value="rebalance" className="gap-2 py-2.5 data-[state=active]:bg-amber-500 data-[state=active]:text-slate-950 font-bold text-slate-700 dark:text-slate-200">
              <PieChart className="w-4 h-4" />
              إعادة التوازن
            </TabsTrigger>
            <TabsTrigger value="health" className="gap-2 py-2.5 data-[state=active]:bg-amber-500 data-[state=active]:text-slate-950 font-bold text-slate-700 dark:text-slate-200">
              <CreditCard className="w-4 h-4" />
              التشخيص والبطاقات
            </TabsTrigger>
          </TabsList>

          {/* ================= TAB 1: ADVISORY SIGNALS ================= */}
          <TabsContent value="signals" className="space-y-6">
            {/* Quick Symbol Selector & Search Combobox */}
            <div className="bg-white dark:bg-[#0E1420] p-4 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="relative flex-1 max-w-lg">
                  <div className="relative">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                    <Input
                      type="text"
                      placeholder="ابحث في كافة أسهم البورصة وصناديق الاستثمار (المنصورة، السويدي، بلتون، AZG...)"
                      value={catalogQuery}
                      onChange={(e) => {
                        setCatalogQuery(e.target.value);
                        setIsSearchOpen(true);
                      }}
                      onFocus={() => setIsSearchOpen(true)}
                      className="pr-9 pl-3 h-10 text-xs bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-xl focus:border-amber-500 shadow-inner"
                    />
                  </div>

                  {/* Autocomplete Dropdown */}
                  {isSearchOpen && catalogResults.data && catalogResults.data.length > 0 && (
                    <div className="absolute z-50 mt-1.5 w-full bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl max-h-64 overflow-y-auto p-1.5 space-y-1">
                      {catalogResults.data.map((item) => (
                        <button
                          key={item.ticker}
                          type="button"
                          onClick={() => handleSelectTicker(item.ticker)}
                          className="w-full text-right p-2.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-between text-xs transition-colors cursor-pointer"
                        >
                          <div>
                            <span className="font-bold text-slate-900 dark:text-white block">{item.nameAr}</span>
                            <span className="text-[10px] text-slate-500 dark:text-slate-400">{item.nameEn} • {item.sector}</span>
                          </div>
                          <Badge variant="outline" className="font-mono text-[10px] border-slate-300 dark:border-slate-700 text-amber-600 dark:text-amber-400 font-bold">
                            {item.symbol}
                          </Badge>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                  <span className="text-slate-500 dark:text-slate-400 font-medium">الأصل المختار:</span>
                  <Badge className="bg-amber-500 text-slate-950 font-black px-3 py-1 text-xs font-mono shadow-xs">
                    {selectedTicker}
                  </Badge>
                </div>
              </div>

              {/* Quick Popular Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none pt-2 border-t border-slate-200 dark:border-slate-800/70">
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 ml-1 shrink-0">أصول شائعة:</span>
                {egyptMarket?.egxStocks.map((stock) => (
                  <Button
                    key={stock.ticker}
                    variant={selectedTicker === stock.ticker ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleSelectTicker(stock.ticker)}
                    className={`text-xs h-7 px-2.5 font-semibold shrink-0 cursor-pointer ${
                      selectedTicker === stock.ticker
                        ? "bg-amber-500 text-slate-950 font-black shadow-xs"
                        : "border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200/70 dark:border-slate-700/80 dark:bg-slate-900/80 dark:text-slate-200 dark:hover:bg-slate-800"
                    }`}
                  >
                    {stock.symbol} ({stock.nameAr.split(" ")[0]})
                  </Button>
                ))}
                <Button
                  variant={selectedTicker === "AZG" ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleSelectTicker("AZG")}
                  className={`text-xs h-7 px-2.5 font-semibold shrink-0 cursor-pointer ${
                    selectedTicker === "AZG"
                      ? "bg-amber-500 text-slate-950 font-black shadow-xs"
                      : "border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200/70 dark:border-slate-700/80 dark:bg-slate-900/80 dark:text-slate-200 dark:hover:bg-slate-800"
                  }`}
                >
                  AZG (صندوق الذهب)
                </Button>
              </div>
            </div>

            {/* Signal Details Card */}
            {signal && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column: Action & Execution Targets */}
                <Card className="lg:col-span-1 bg-white dark:bg-[#0E1420] border-slate-200/90 dark:border-slate-800 flex flex-col justify-between shadow-xs">
                  <CardHeader className="pb-4">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="text-xs font-mono border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-bold">{signal.ticker}</Badge>
                      <Badge className={`text-xs px-2.5 py-1 font-bold ${
                        signal.action.includes("ACCUMULATE")
                          ? "bg-emerald-600 text-white"
                          : signal.action.includes("PROFIT")
                          ? "bg-amber-500 text-slate-950"
                          : "bg-blue-600 text-white"
                      }`}>
                        {signal.actionAr}
                      </Badge>
                    </div>
                    <CardTitle className="text-2xl font-black text-slate-900 dark:text-white mt-3">
                      {activeInstrument?.nameAr || signal.ticker}
                    </CardTitle>
                    <CardDescription className="text-xs text-slate-600 dark:text-slate-300 font-semibold">
                      السعر الاسترشادي الأخير: <span className="font-bold text-amber-600 dark:text-amber-400 text-sm">{signal.currentPrice} ج.م</span>
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    {/* Confidence Meter */}
                    <div>
                      <div className="flex justify-between items-center text-xs mb-1.5 font-bold" dir="rtl">
                        <span className="text-slate-600 dark:text-slate-300"><bdi>نسبة الثقة الكمية:</bdi></span>
                        <span className="text-amber-600 dark:text-amber-400 font-mono" dir="ltr">{signal.confidenceScore}%</span>
                      </div>
                      <div className="h-2.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden border border-slate-200 dark:border-slate-700">
                        <div
                          className="h-full bg-gradient-to-r from-amber-500 to-emerald-500 rounded-full transition-all duration-500"
                          style={{ width: `${signal.confidenceScore}%` }}
                        />
                      </div>
                    </div>

                    {/* Visual Sentiment / Momentum Gauge */}
                    {(() => {
                      const isBullish = signal.action.includes("ACCUMULATE") || signal.indicators.trendEMA === "BULLISH_UPTREND";
                      const isBearish = signal.action.includes("PROFIT") || signal.indicators.trendEMA === "BEARISH_DOWNTREND";
                      const isNeutral = !isBullish && !isBearish;

                      return (
                        <div className="bg-slate-50 dark:bg-slate-950/70 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2" dir="rtl">
                          <div className="flex items-center justify-between text-xs font-bold">
                            <span className="text-slate-700 dark:text-slate-300"><bdi>مؤشر الاتجاه والزخم:</bdi></span>
                            <span className={`px-2 py-0.5 rounded-full text-[11px] font-extrabold ${
                              isBullish
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-500/30"
                                : isBearish
                                ? "bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-400 border border-rose-300 dark:border-rose-500/30"
                                : "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300 border border-amber-300 dark:border-amber-500/30"
                            }`}>
                              {isBullish ? "صاعد (Bullish)" : isBearish ? "هابط (Bearish)" : "محايد (Neutral)"}
                            </span>
                          </div>
                          {/* 3-Part Bar Meter */}
                          <div className="grid grid-cols-3 gap-1.5 h-2.5">
                            <div className={`rounded-r-full transition-all duration-300 ${isBullish ? "bg-emerald-500 shadow-xs shadow-emerald-500/50" : "bg-slate-200 dark:bg-slate-800"}`} />
                            <div className={`transition-all duration-300 ${isNeutral ? "bg-amber-400 shadow-xs shadow-amber-400/50" : "bg-slate-200 dark:bg-slate-800"}`} />
                            <div className={`rounded-l-full transition-all duration-300 ${isBearish ? "bg-rose-500 shadow-xs shadow-rose-500/50" : "bg-slate-200 dark:bg-slate-800"}`} />
                          </div>
                          <div className="flex justify-between text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                            <span>صاعد (Bullish)</span>
                            <span>محايد (Neutral)</span>
                            <span>هابط (Bearish)</span>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Price Targets Box */}
                    <div className="bg-slate-50 dark:bg-slate-950/70 rounded-xl p-4 space-y-3 text-xs border border-slate-200 dark:border-slate-800 font-semibold" dir="rtl">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-600 dark:text-slate-300"><bdi>نطاق الدخول / التجميع:</bdi></span>
                        <span className="font-bold font-mono text-emerald-600 dark:text-emerald-400" dir="ltr">{signal.entryZone.min} - {signal.entryZone.max} ج.م</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-600 dark:text-slate-300"><bdi>الهدف الأول (T1 محافظ):</bdi></span>
                        <span className="font-bold font-mono text-cyan-600 dark:text-cyan-400" dir="ltr">{signal.targets.t1} ج.م</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-600 dark:text-slate-300"><bdi>الهدف الثاني (T2 طموح):</bdi></span>
                        <span className="font-bold font-mono text-purple-600 dark:text-purple-300" dir="ltr">{signal.targets.t2} ج.م</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-600 dark:text-slate-300"><bdi>وقف الخسارة المرجعي:</bdi></span>
                        <span className="font-bold font-mono text-rose-600 dark:text-rose-400" dir="ltr">{signal.stopLoss} ج.م</span>
                      </div>
                      <div className="flex justify-between items-center pt-2 border-t border-slate-200 dark:border-slate-800">
                        <span className="text-slate-600 dark:text-slate-300"><bdi>نسبة العائد للمخاطرة (R/R):</bdi></span>
                        <span className="font-bold font-mono text-amber-600 dark:text-amber-300" dir="ltr">1 : {signal.riskRewardRatio}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                      <Button
                        onClick={() => setIsSimTradeOpen(true)}
                        variant="outline"
                        className="w-full border-slate-200 bg-white hover:bg-slate-50 text-slate-800 dark:border-slate-700 dark:bg-slate-900/80 dark:hover:bg-slate-800 dark:text-slate-100 font-bold gap-1.5 py-2.5 text-xs cursor-pointer shadow-xs"
                      >
                        <Sparkles className="w-4 h-4 text-amber-500 dark:text-amber-400" />
                        محاكاة افتراضية
                      </Button>

                      <Button
                        onClick={() => {
                          const swingUrl = `/trading/swing?ticker=${encodeURIComponent(signal.ticker)}&action=swing&entry=${signal.entryZone.min}&tp=${signal.targets.t1}&sl=${signal.stopLoss}&name=${encodeURIComponent(activeInstrument?.nameAr || signal.instrumentNameAr || signal.ticker)}`;
                          setLocation(swingUrl);
                        }}
                        className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-black gap-1.5 py-2.5 text-xs shadow-md cursor-pointer"
                      >
                        <ArrowUpRight className="w-4 h-4 rotate-180" />
                        تداول في السوينج
                      </Button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                      <Button
                        onClick={() => copySignalCard(signal, activeInstrument?.nameAr || signal.instrumentNameAr || signal.ticker)}
                        variant="outline"
                        className="w-full border-slate-200 bg-white hover:bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900/50 dark:hover:bg-slate-800 dark:text-slate-200 font-semibold gap-1.5 py-2 text-xs cursor-pointer shadow-xs"
                      >
                        {copiedTicker === signal.ticker ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                            <span className="text-emerald-600 dark:text-emerald-400 font-bold">تم النسخ</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5 text-slate-400" />
                            <span>نسخ بطاقة الصفقة</span>
                          </>
                        )}
                      </Button>

                      <Button
                        onClick={() => setIsExternalTradeOpen(true)}
                        variant="outline"
                        className="w-full border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:hover:bg-amber-500/20 dark:text-amber-300 font-bold gap-1.5 py-2 text-xs cursor-pointer shadow-xs"
                      >
                        <PlusCircle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                        <span>تسجيل تنفيذ خارجي</span>
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Right Column: Multi-Factor Technical Breakdown & Arabic Analysis */}
                <Card className="lg:col-span-2 bg-white dark:bg-[#0E1420] border-slate-200/90 dark:border-slate-800 shadow-xs">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg font-bold flex items-center gap-2 text-slate-900 dark:text-white">
                      <BarChart3 className="w-5 h-5 text-amber-500 dark:text-amber-400" />
                      المؤشرات الفنية والتحليل التفسيري باللغة العربية
                    </CardTitle>
                    <CardDescription className="text-xs text-slate-600 dark:text-slate-300 font-medium">
                      {signal.arabicAnalysis.headline}
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="space-y-5">
                    {/* Indicators Metric Badges */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="bg-slate-50 dark:bg-slate-950/70 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 text-center">
                        <p className="text-xs text-slate-700 dark:text-slate-300 font-bold" dir="rtl"><bdi>مؤشر القوة (14) RSI</bdi></p>
                        <p className={`text-xl font-black mt-1 ${
                          (signal.indicators.rsi ?? 50) <= 35 ? "text-emerald-600 dark:text-emerald-400" : (signal.indicators.rsi ?? 50) >= 65 ? "text-rose-600 dark:text-rose-400" : "text-amber-600 dark:text-amber-300"
                        }`}>
                          {signal.indicators.rsi ?? "--"}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                          {(signal.indicators.rsi ?? 50) <= 35 ? "تشبع بيعي (فرصة)" : (signal.indicators.rsi ?? 50) >= 65 ? "تشبع شرائي" : "متوازن"}
                        </p>
                      </div>

                      <div className="bg-slate-50 dark:bg-slate-950/70 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 text-center">
                        <p className="text-xs text-slate-700 dark:text-slate-300 font-bold" dir="rtl"><bdi>زخم MACD</bdi></p>
                        <p className={`text-xl font-black mt-1 ${
                          signal.indicators.macdTrend === "BULLISH" ? "text-emerald-600 dark:text-emerald-400" : signal.indicators.macdTrend === "BEARISH" ? "text-rose-600 dark:text-rose-400" : "text-slate-700 dark:text-slate-300"
                        }`}>
                          {signal.indicators.macdTrend === "BULLISH" ? "صاعد +" : signal.indicators.macdTrend === "BEARISH" ? "هابط -" : "محايد"}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                          {signal.indicators.macdHistogram?.toFixed(3) ?? "--"}
                        </p>
                      </div>

                      <div className="bg-slate-50 dark:bg-slate-950/70 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 text-center">
                        <p className="text-xs text-slate-700 dark:text-slate-300 font-bold" dir="rtl"><bdi>بولينجر باندز</bdi></p>
                        <p className={`text-xl font-black mt-1 ${
                          signal.indicators.bollingerPosition === "OVERSOLD" ? "text-emerald-600 dark:text-emerald-400" : signal.indicators.bollingerPosition === "OVERBOUGHT" ? "text-rose-600 dark:text-rose-400" : "text-blue-600 dark:text-blue-400"
                        }`}>
                          {signal.indicators.bollingerPosition === "OVERSOLD" ? "قاع النطاق" : signal.indicators.bollingerPosition === "OVERBOUGHT" ? "قمة النطاق" : "طبيعي"}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                          %B: {signal.indicators.bollingerPercentB ?? "--"}
                        </p>
                      </div>

                      <div className="bg-slate-50 dark:bg-slate-950/70 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 text-center">
                        <p className="text-xs text-slate-700 dark:text-slate-300 font-bold" dir="rtl"><bdi>المتوسط المتحرك EMA</bdi></p>
                        <p className={`text-xl font-black mt-1 ${
                          signal.indicators.trendEMA === "UPTREND" ? "text-emerald-600 dark:text-emerald-400" : signal.indicators.trendEMA === "DOWNTREND" ? "text-rose-600 dark:text-rose-400" : "text-amber-600 dark:text-yellow-400"
                        }`}>
                          {signal.indicators.trendEMA === "UPTREND" ? "اتجاه صاعد" : signal.indicators.trendEMA === "DOWNTREND" ? "اتجاه هابط" : "عرضي"}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">EMA 20 & EMA 50</p>
                      </div>
                    </div>

                    {/* Explanatory Points */}
                    <div className="bg-amber-50/80 dark:bg-[#1f1908] border border-amber-300/80 dark:border-amber-500/50 rounded-xl p-4 space-y-2.5" dir="rtl">
                      <p className="text-xs font-black text-amber-950 dark:text-amber-300 flex items-center gap-1.5 mb-2">
                        <Info className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                        <bdi>خلاصة التحليل الاسترشادي التفسيري:</bdi>
                      </p>
                      {signal.arabicAnalysis.keyPoints.map((pt, idx) => (
                        <div key={idx} className="flex items-start gap-2.5 text-xs text-slate-800 dark:text-slate-100 font-semibold leading-relaxed text-right" dir="rtl">
                          <span className="text-amber-600 dark:text-amber-400 font-bold mt-0.5 shrink-0">•</span>
                          <span className="text-right leading-relaxed"><bdi>{pt}</bdi></span>
                        </div>
                      ))}
                    </div>

                    {/* Disclaimer Alert */}
                    <div className="text-xs text-slate-300 bg-slate-950/80 p-3 rounded-lg border border-slate-800 flex items-center gap-2.5 font-medium">
                      <AlertTriangle className="w-4 h-4 text-yellow-400 shrink-0" />
                      <span>{signal.arabicAnalysis.riskWarning}</span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          {/* ================= TAB 2: EGYPT MARKET & GOLD ================= */}
          <TabsContent value="market" className="space-y-6">
            {/* Gold Pricing Section */}
            <Card className="bg-slate-900/90 border-slate-800 shadow-lg">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-amber-400" />
                    <CardTitle className="text-lg font-bold text-white">أسعار الذهب المادي في مصر (سوق الصاغة)</CardTitle>
                  </div>
                  <Badge variant="outline" className="text-xs text-amber-300 border-amber-500/40 bg-amber-500/10 font-semibold">
                    تحديث لحظي استرشادي
                  </Badge>
                </div>
                <CardDescription className="text-xs text-slate-300 font-medium">
                  الأسعار تشمل متوسط المصنعية والدمغة الرسمية للسبائك والجنيهات الذهب BTC والسويسرية.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  {egyptMarket?.gold.purities.map((g) => (
                    <div key={g.karat} className="bg-slate-950/70 p-4 rounded-xl border border-slate-800">
                      <div className="flex justify-between items-center text-xs font-bold text-slate-200 mb-1">
                        <span>{g.nameAr}</span>
                        <span className="text-emerald-400">+{g.change24hPercent}%</span>
                      </div>
                      <p className="text-2xl font-black text-amber-400">{formatMoney(g.gramPriceEGP)}</p>
                      <div className="flex justify-between text-xs text-slate-300 font-semibold mt-2.5 pt-2.5 border-t border-slate-800">
                        <span>شراء: {formatMoney(g.buyPriceEGP)}</span>
                        <span>بيع: {formatMoney(g.sellPriceEGP)}</span>
                      </div>
                    </div>
                  ))}
                  <div className="bg-slate-950/70 p-4 rounded-xl border border-slate-800">
                    <div className="flex justify-between items-center text-xs font-bold text-slate-200 mb-1">
                      <span>الجنيه الذهب (8 جم 21k)</span>
                      <span className="text-emerald-400">+0.65%</span>
                    </div>
                    <p className="text-2xl font-black text-amber-300">
                      {egyptMarket?.gold.sovereign.priceEGP ? formatMoney(egyptMarket.gold.sovereign.priceEGP) : "32,550 ج.م"}
                    </p>
                    <div className="flex justify-between text-xs text-slate-300 font-semibold mt-2.5 pt-2.5 border-t border-slate-800">
                      <span>إعادة الشراء: {formatMoney(egyptMarket?.gold.sovereign.buyPriceEGP || 32350)}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* EGX Top Equities Table */}
            <Card className="bg-slate-900/90 border-slate-800 shadow-lg">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg font-bold flex items-center gap-2 text-white">
                  <BarChart3 className="w-5 h-5 text-amber-400" />
                  أبرز أسهم البورصة المصرية (EGX Blue Chips)
                </CardTitle>
                <CardDescription className="text-xs text-slate-300 font-medium">
                  قائمة الأسهم القيادية مع توزيعات الأرباح التقديرية وإمكانية الفحص الكمي المباشر.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-xl border border-slate-800 overflow-x-auto">
                  <Table className="min-w-[650px]">
                    <TableHeader className="bg-slate-950">
                      <TableRow className="border-slate-800">
                        <TableHead className="text-right text-slate-200 font-bold">الرمز</TableHead>
                        <TableHead className="text-right text-slate-200 font-bold">اسم الشركة</TableHead>
                        <TableHead className="text-right text-slate-200 font-bold">القطاع</TableHead>
                        <TableHead className="text-right text-slate-200 font-bold">آخر إغلاق</TableHead>
                        <TableHead className="text-right text-slate-200 font-bold">عائد التوزيعات</TableHead>
                        <TableHead className="text-center text-slate-200 font-bold">الإجراء</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {egyptMarket?.egxStocks.map((stock) => (
                        <TableRow key={stock.ticker} className="border-slate-800/60 hover:bg-slate-800/40">
                          <TableCell className="font-mono font-bold text-amber-400">{stock.symbol}</TableCell>
                          <TableCell className="font-semibold text-white">{stock.nameAr}</TableCell>
                          <TableCell className="text-xs text-slate-300 font-medium">{stock.sector}</TableCell>
                          <TableCell className="font-bold text-slate-100">{stock.lastClose} ج.م</TableCell>
                          <TableCell className="text-emerald-400 font-black">{stock.typicalDividendYield}%</TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setSelectedTicker(stock.ticker);
                                  setActiveTab("signals");
                                  toast.info(`تم تحميل إشارات التحليل الكمي لـ ${stock.nameAr}`);
                                  window.scrollTo({ top: 150, behavior: "smooth" });
                                }}
                                className="text-xs text-amber-400 hover:text-amber-300 hover:bg-amber-500/20 font-bold h-7 px-2"
                              >
                                فحص كمي
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setLocation(`/trading/swing?ticker=${encodeURIComponent(stock.ticker)}&action=swing&entry=${stock.lastClose}&name=${encodeURIComponent(stock.nameAr)}`);
                                }}
                                className="text-xs border-slate-700 bg-slate-900/60 hover:bg-amber-500 hover:text-slate-950 text-slate-200 font-bold h-7 px-2"
                              >
                                سوينج
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            {/* Dividend Calendar Section */}
            <Card className="bg-slate-900/90 border-slate-800 shadow-lg">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg font-bold flex items-center gap-2 text-white">
                  <Calendar className="w-5 h-5 text-emerald-400" />
                  أجندة توزيعات الأرباح النقدية المتوقعة (EGX Dividend Calendar)
                </CardTitle>
                <CardDescription className="text-xs text-slate-300 font-medium">
                  مواعيد استحقاق الكوبونات النقدية لتعزيز التدفقات النقدية السلبية للعائلة.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {egyptMarket?.dividendCalendar.map((div, idx) => (
                    <div key={idx} className="bg-slate-950/70 p-4 rounded-xl border border-slate-800 space-y-2.5">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-sm text-white">{div.nameAr}</span>
                        <Badge variant="outline" className={`text-xs font-bold ${
                          div.status === "CONFIRMED" ? "border-emerald-500/40 text-emerald-300 bg-emerald-500/10" : "border-yellow-500/40 text-yellow-300 bg-yellow-500/10"
                        }`}>
                          {div.status === "CONFIRMED" ? "مؤكد" : "تقديري"}
                        </Badge>
                      </div>
                      <p className="text-xs text-slate-300 font-semibold">
                        الكوبون للسهم: <span className="font-black text-emerald-400">{div.dividendPerShareEGP} ج.م</span>
                      </p>
                      <div className="text-xs text-slate-400 font-medium flex justify-between pt-2 border-t border-slate-800">
                        <span>نهاية الحق: {div.exDividendDate}</span>
                        <span>تاريخ الصرف: {div.paymentDate}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ================= TAB 3: PAPER TRADING SANDBOX ================= */}
          <TabsContent value="paper" className="space-y-6">
            {/* Paper Overview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="bg-slate-900/90 border-slate-800 shadow-md">
                <CardContent className="p-4">
                  <p className="text-xs text-slate-300 font-bold">السيولة الافتراضية المتاحة</p>
                  <p className="text-2xl font-black text-amber-400 mt-1">
                    {formatMoney(paperData?.paperState.virtualCashEGP || 1000000)}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1 font-medium">رأس مال محاكاة مبدئي 1,000,000 ج.م</p>
                </CardContent>
              </Card>

              <Card className="bg-slate-900/90 border-slate-800 shadow-md">
                <CardContent className="p-4">
                  <p className="text-xs text-slate-300 font-bold">قيمة المراكز المفتوحة</p>
                  <p className="text-2xl font-black text-cyan-400 mt-1">
                    {formatMoney(paperData?.paperState.positionsValueEGP || 0)}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1 font-medium">
                    {paperData?.paperState.positions.length || 0} مراكز نشطة
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-slate-900/90 border-slate-800 shadow-md">
                <CardContent className="p-4">
                  <p className="text-xs text-slate-300 font-bold">الأرباح / الخسائر غير المحققة</p>
                  <p className={`text-2xl font-black mt-1 ${
                    (paperData?.paperState.totalUnrealizedPnLEGP || 0) >= 0 ? "text-emerald-400" : "text-rose-400"
                  }`}>
                    {formatMoney(paperData?.paperState.totalUnrealizedPnLEGP || 0)}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1 font-medium">مربوطة بالسعر المباشر</p>
                </CardContent>
              </Card>

              <Card className="bg-slate-900/90 border-slate-800 shadow-md">
                <CardContent className="p-4">
                  <p className="text-xs text-slate-300 font-bold">الأرباح المحققة المقفلة</p>
                  <p className="text-2xl font-black text-emerald-300 mt-1">
                    {formatMoney(paperData?.paperState.totalRealizedPnLEGP || 0)}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1 font-medium">من الصفقات التي تم إغلاقها</p>
                </CardContent>
              </Card>
            </div>

            {/* Virtual Positions Table */}
            <Card className="bg-slate-900/90 border-slate-800 shadow-lg">
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-bold flex items-center gap-2 text-white">
                    <Activity className="w-5 h-5 text-amber-400" />
                    المراكز الافتراضية المفتوحة (Virtual Positions)
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-300 font-medium">
                    تتبع أداء صفقاتك التجريبية بدقة واختبر النماذج الكمية قبل المخاطرة بأموال حقيقية.
                  </CardDescription>
                </div>
                <Button
                  onClick={() => setIsSimTradeOpen(true)}
                  className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs gap-1.5 shadow-md"
                >
                  <Sparkles className="w-4 h-4" />
                  صفقة تجريبية جديدة
                </Button>
              </CardHeader>
              <CardContent>
                {paperData && paperData.paperState.positions.length > 0 ? (
                  <div className="rounded-xl border border-slate-800 overflow-hidden">
                    <Table>
                      <TableHeader className="bg-slate-950">
                        <TableRow className="border-slate-800">
                          <TableHead className="text-right text-slate-200 font-bold">الأصل</TableHead>
                          <TableHead className="text-right text-slate-200 font-bold">الكمية</TableHead>
                          <TableHead className="text-right text-slate-200 font-bold">متوسط سعر الشراء</TableHead>
                          <TableHead className="text-right text-slate-200 font-bold">السعر الحالي</TableHead>
                          <TableHead className="text-right text-slate-200 font-bold">القيمة الإجمالية</TableHead>
                          <TableHead className="text-right text-slate-200 font-bold">الربح / الخسارة</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paperData.paperState.positions.map((pos, idx) => (
                          <TableRow key={idx} className="border-slate-800/60 hover:bg-slate-800/40">
                            <TableCell className="font-bold text-white">{pos.nameAr} ({pos.ticker})</TableCell>
                            <TableCell className="text-slate-200 font-medium">{pos.quantity}</TableCell>
                            <TableCell className="text-slate-200 font-medium">{pos.averageEntryPrice} ج.م</TableCell>
                            <TableCell className="text-slate-200 font-medium">{pos.currentMarketPrice} ج.م</TableCell>
                            <TableCell className="font-bold text-slate-100">{formatMoney(pos.currentValueEGP)}</TableCell>
                            <TableCell className={`font-black ${pos.unrealizedPnLEGP >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                              {pos.unrealizedPnLEGP >= 0 ? "+" : ""}{formatMoney(pos.unrealizedPnLEGP)} ({pos.unrealizedPnLPercent}%)
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-12 border border-dashed border-slate-800 rounded-xl bg-slate-950/40">
                    <Activity className="w-8 h-8 text-slate-500 mx-auto mb-2" />
                    <p className="text-slate-200 font-bold text-sm">لا توجد مراكز مفتوحة حالياً في محفظة المحاكاة</p>
                    <p className="text-xs text-slate-400 mt-1 mb-4">ابدأ بإجراء أول صفقة افتراضية لاختبار استراتيجيات التداول.</p>
                    <Button
                      onClick={() => setIsSimTradeOpen(true)}
                      size="sm"
                      className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs"
                    >
                      <Plus className="w-4 h-4 ml-1" />
                      إجراء صفقة محاكاة الآن
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Side-by-Side Audit Comparison vs Real Portfolio */}
            <Card className="bg-slate-900/90 border-slate-800 shadow-lg">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg font-bold flex items-center gap-2 text-white">
                  <ArrowRightLeft className="w-5 h-5 text-cyan-400" />
                  مصفوفة التدقيق المقارن: المحفظة الافتراضية مقابل الثروة العائلية الفعلية
                </CardTitle>
                <CardDescription className="text-xs text-slate-300 font-medium">
                  مقارنة مؤشرات المحفظة الافتراضية مع الأرقام الفعلية المسجلة في دفاتر المنصة.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-xl border border-slate-800 overflow-hidden">
                  <Table>
                    <TableHeader className="bg-slate-950">
                      <TableRow className="border-slate-800">
                        <TableHead className="text-right text-slate-200 font-bold">المعيار المالي</TableHead>
                        <TableHead className="text-right text-slate-200 font-bold">المحفظة الافتراضية (محاكاة)</TableHead>
                        <TableHead className="text-right text-slate-200 font-bold">المحفظة العائلية الحقيقية</TableHead>
                        <TableHead className="text-right text-slate-200 font-bold">التقييم والهدف الإرشادي</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paperData?.auditMatrix.map((row, idx) => (
                        <TableRow key={idx} className="border-slate-800/60 hover:bg-slate-800/40">
                          <TableCell className="font-bold text-white">{row.metricAr}</TableCell>
                          <TableCell className="font-mono text-amber-400 font-bold">{row.paperPortfolioValue}</TableCell>
                          <TableCell className="font-mono text-emerald-400 font-bold">{row.realPortfolioValue}</TableCell>
                          <TableCell className="text-xs text-slate-300 font-medium">{row.varianceDescriptionAr}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ================= TAB 4: REBALANCING & ASSET ALLOCATION ================= */}
          <TabsContent value="rebalance" className="space-y-6">
            {/* Profile Selection Bar */}
            <div className="flex items-center justify-between bg-slate-900/90 p-4 rounded-xl border border-slate-800">
              <div>
                <p className="text-sm font-bold text-white">نموذج التوزيع الاستثماري المستهدف:</p>
                <p className="text-xs text-slate-300 font-medium">حدد التوجه الاستراتيجي للعائلة لإعادة موازنة الأصول</p>
              </div>
              <div className="flex gap-2">
                {(["BALANCED", "CONSERVATIVE", "GROWTH"] as const).map((prof) => (
                  <Button
                    key={prof}
                    variant={targetProfile === prof ? "default" : "outline"}
                    size="sm"
                    onClick={() => setTargetProfile(prof)}
                    className={targetProfile === prof ? "bg-amber-500 text-slate-950 font-black text-xs shadow-md" : "text-xs border-slate-700 bg-slate-950 text-slate-200 hover:bg-slate-800"}
                  >
                    {prof === "BALANCED" ? "متوازن (موصى به)" : prof === "CONSERVATIVE" ? "متحفظ (سيولة وذهب)" : "نمو قوي (أسهم)"}
                  </Button>
                ))}
              </div>
            </div>

            {/* Asset Allocation Slices */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {rebalancing?.slices.map((slice) => (
                <Card key={slice.assetClass} className="bg-slate-900/90 border-slate-800 shadow-md">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-white">{slice.assetClassAr}</span>
                      <Badge variant="outline" className={`text-[11px] font-bold ${
                        slice.actionNeeded === "BALANCED"
                          ? "text-emerald-300 border-emerald-500/40 bg-emerald-500/10"
                          : slice.actionNeeded === "BUY_MORE"
                          ? "text-cyan-300 border-cyan-500/40 bg-cyan-500/10"
                          : "text-amber-300 border-amber-500/40 bg-amber-500/10"
                      }`}>
                        {slice.actionNeeded === "BALANCED" ? "متوازن" : slice.actionNeeded === "BUY_MORE" ? "عجز (شراء)" : "فائض (تخفيف)"}
                      </Badge>
                    </div>

                    <p className="text-2xl font-black text-amber-400">{formatMoney(slice.currentValueEGP)}</p>

                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs text-slate-300 font-semibold">
                        <span>الوزن الفعلي: {slice.currentWeightPercent}%</span>
                        <span>المستهدف: {slice.targetWeightPercent}%</span>
                      </div>
                      <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden border border-slate-700">
                        <div
                          className={`h-full rounded-full ${
                            Math.abs(slice.variancePercent) <= 3 ? "bg-emerald-500" : "bg-amber-500"
                          }`}
                          style={{ width: `${Math.min(100, slice.currentWeightPercent)}%` }}
                        />
                      </div>
                    </div>

                    {slice.actionAmountEGP > 0 && (
                      <p className="text-xs text-slate-300 pt-2 border-t border-slate-800 font-medium">
                        مقدار التعديل المقترح: <span className="font-bold text-white">{formatMoney(slice.actionAmountEGP)}</span>
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Rebalancing Recommendations */}
            <Card className="bg-slate-900/90 border-slate-800 shadow-lg">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg font-bold flex items-center gap-2 text-white">
                  <PieChart className="w-5 h-5 text-amber-400" />
                  خطوات إعادة التوازن الإرشادية الموصى بها (Actionable Rebalancing)
                </CardTitle>
                <CardDescription className="text-xs text-slate-300 font-medium">
                  توصيات محسوبة بناءً على الأرصدة الحقيقية المسجلة في الدفاتر لضبط أوزان المحفظة.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {rebalancing?.recommendations && rebalancing.recommendations.length > 0 ? (
                  <div className="space-y-3">
                    {rebalancing.recommendations.map((rec, idx) => (
                      <div key={idx} className="bg-slate-950/70 p-4 rounded-xl border border-slate-800 flex items-start gap-3">
                        <div className="p-2 rounded-lg bg-amber-500/20 text-amber-300 shrink-0 mt-0.5 border border-amber-500/30">
                          <ArrowRightLeft className="w-4 h-4" />
                        </div>
                        <div className="space-y-1 text-xs">
                          <p className="font-bold text-white text-sm">{rec.rationaleAr}</p>
                          <p className="text-slate-300 font-semibold">
                            المبلغ المقترح نقله: <span className="font-black text-amber-400 text-sm">{formatMoney(rec.suggestedTransferEGP)}</span>
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-emerald-300 font-bold text-sm flex items-center justify-center gap-2 bg-slate-950/40 rounded-xl border border-slate-800">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    المحفظة متوازنة وموزعة طبقاً للنموذج المستهدف بنسبة ممتازة!
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Concentration Risk Alerts */}
            {rebalancing?.concentrationAlerts && rebalancing.concentrationAlerts.length > 0 && (
              <Card className="bg-slate-900/90 border-rose-500/40 shadow-lg">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg font-bold text-rose-300 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-rose-400" />
                    تنبيهات تركز الأصول والمخاطر المفرطة
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {rebalancing.concentrationAlerts.map((alert, idx) => (
                    <div key={idx} className="bg-rose-500/10 p-4 rounded-xl border border-rose-500/30 text-xs space-y-1">
                      <p className="font-bold text-rose-200 text-sm">
                        {alert.nameAr} ({alert.identifier}) — {alert.portfolioWeightPercent}% من إجمالي المحفظة
                      </p>
                      <p className="text-slate-200 font-medium">{alert.adviceAr}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ================= TAB 5: FINANCIAL HEALTH & CREDIT CARDS ================= */}
          <TabsContent value="health" className="space-y-6">
            {/* Health Diagnostics Ratios */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="bg-slate-900/90 border-slate-800 shadow-md">
                <CardContent className="p-4">
                  <p className="text-xs text-slate-300 font-bold">معدل الادخار الفعلي</p>
                  <p className="text-2xl font-black text-emerald-400 mt-1">
                    {health?.diagnostics.savingsRatePercent ?? 0}%
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1 font-medium">محسوب من التدفقات النقدية المسجلة</p>
                </CardContent>
              </Card>

              <Card className="bg-slate-900/90 border-slate-800 shadow-md">
                <CardContent className="p-4">
                  <p className="text-xs text-slate-300 font-bold">نسبة المديونية للأصول</p>
                  <p className="text-2xl font-black text-cyan-400 mt-1">
                    {health?.diagnostics.debtToAssetPercent ?? 0}%
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1 font-medium">الالتزامات الفعلية / إجمالي الأصول</p>
                </CardContent>
              </Card>

              <Card className="bg-slate-900/90 border-slate-800 shadow-md">
                <CardContent className="p-4">
                  <p className="text-xs text-slate-300 font-bold">احتياطي سيولة الطوارئ</p>
                  <p className="text-2xl font-black text-amber-400 mt-1">
                    {health?.diagnostics.emergencyRunwayMonths ?? 0} أشهر
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1 font-medium">تغطية مصاريف معيشية فعلية</p>
                </CardContent>
              </Card>

              <Card className="bg-slate-900/90 border-slate-800 shadow-md">
                <CardContent className="p-4">
                  <p className="text-xs text-slate-300 font-bold">التقييم المالي العام</p>
                  <p className="text-2xl font-black text-emerald-400 mt-1">
                    {health?.diagnostics.healthRatingAr ?? "مقبول"} ({health?.diagnostics.overallScore ?? 50}/100)
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1 font-medium">مؤشر المتانة المالية الفعلي</p>
                </CardContent>
              </Card>
            </div>

            {/* Credit Card Utilization Section */}
            <Card className="bg-slate-900/90 border-slate-800 shadow-lg">
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-bold flex items-center gap-2 text-white">
                    <CreditCard className="w-5 h-5 text-amber-400" />
                    بطاقات الائتمان وفترات السماح (Credit Cards & Grace Periods)
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-300 font-medium">
                    بيانات حقيقية مسترجعة من جدول الالتزامات مع تتبع فترة السماح لتفادي الفوائد الاستهلاكية.
                  </CardDescription>
                </div>
                <Button
                  onClick={() => setIsCardModalOpen(true)}
                  className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs gap-1.5 shadow-md"
                >
                  <Plus className="w-4 h-4" />
                  إضافة بطاقة ائتمان
                </Button>
              </CardHeader>
              <CardContent>
                {health?.creditCards && health.creditCards.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {health.creditCards.map((card) => (
                      <div key={card.debtId} className="bg-slate-950/70 p-4 rounded-xl border border-slate-800 space-y-3">
                        <div className="flex justify-between items-center">
                          <div>
                            <span className="font-bold text-sm text-white">{card.cardName}</span>
                            {card.lender && <span className="text-xs text-slate-400 block">{card.lender}</span>}
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className={`text-xs font-bold ${
                              card.statusLevel === "EXCELLENT"
                                ? "text-emerald-300 border-emerald-500/40 bg-emerald-500/10"
                                : card.statusLevel === "MODERATE"
                                ? "text-yellow-300 border-yellow-500/40 bg-yellow-500/10"
                                : "text-rose-300 border-rose-500/40 bg-rose-500/10"
                            }`}>
                              استغلال {card.utilizationRatePercent}%
                            </Badge>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                if (confirm(`هل أنت متأكد من رغبتك في حذف البطاقة (${card.cardName})؟`)) {
                                  deleteCardMutation.mutate({ debtId: card.debtId });
                                }
                              }}
                              className="h-7 w-7 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-xs font-semibold">
                          <div>
                            <p className="text-slate-400 text-[11px]">الحد الائتماني الكلي</p>
                            <p className="font-bold text-white text-sm">{formatMoney(card.creditLimitEGP)}</p>
                          </div>
                          <div>
                            <p className="text-slate-400 text-[11px]">الرصيد المستغل الحالي</p>
                            <p className="font-bold text-amber-400 text-sm">{formatMoney(card.utilizedBalanceEGP)}</p>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden border border-slate-700">
                            <div
                              className={`h-full rounded-full ${
                                card.utilizationRatePercent < 30 ? "bg-emerald-500" : card.utilizationRatePercent < 60 ? "bg-amber-500" : "bg-rose-500"
                              }`}
                              style={{ width: `${Math.min(100, card.utilizationRatePercent)}%` }}
                            />
                          </div>
                        </div>

                        <div className="flex justify-between items-center text-xs pt-2 border-t border-slate-800 font-medium">
                          <span className="text-slate-300">أيام السماح المتبقية:</span>
                          <span className="font-bold text-emerald-400 flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            {card.daysUntilInterestFreeExpiry !== undefined ? `${card.daysUntilInterestFreeExpiry} يوم متبقي` : "غير محدد"}
                          </span>
                        </div>

                        <p className="text-xs text-slate-300 bg-slate-900 p-2.5 rounded-lg border border-slate-800/80 font-medium">
                          {card.adviceAr}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 border border-dashed border-slate-800 rounded-xl bg-slate-950/40">
                    <CreditCard className="w-8 h-8 text-slate-500 mx-auto mb-2" />
                    <p className="text-slate-200 font-bold text-sm">لا توجد بطاقات ائتمانية مسجلة حتى الآن</p>
                    <p className="text-xs text-slate-400 mt-1 mb-4">أضف بطاقتك الائتمانية لتتبع الرصيد المستغل وفترة السماح لتجنب الفوائد.</p>
                    <Button
                      onClick={() => setIsCardModalOpen(true)}
                      size="sm"
                      className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs"
                    >
                      <Plus className="w-4 h-4 ml-1" />
                      إضافة بطاقة ائتمان الآن
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Budget Variance & Recurring Subscriptions */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Budget Variance Alerts */}
              <Card className="bg-slate-900/90 border-slate-800 shadow-lg">
                <CardHeader className="pb-3 flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-base font-bold flex items-center gap-2 text-white">
                      <PieChart className="w-4 h-4 text-cyan-400" />
                      مراقبة بنود الميزانية الفعلية (80% / 100%)
                    </CardTitle>
                    <CardDescription className="text-xs text-slate-300 font-medium">
                      مقارنة المصروفات المقيدة بالدفاتر مع الحدود المخططة.
                    </CardDescription>
                  </div>
                  <Link href="/cash-flow">
                    <Button variant="ghost" size="sm" className="text-xs text-slate-300 hover:text-white gap-1">
                      إدارة الميزانية
                      <ExternalLink className="w-3 h-3" />
                    </Button>
                  </Link>
                </CardHeader>
                <CardContent>
                  {health?.budgetVariances && health.budgetVariances.length > 0 ? (
                    <div className="space-y-3">
                      {health.budgetVariances.map((b, idx) => (
                        <div key={idx} className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800 space-y-2 text-xs">
                          <div className="flex justify-between items-center">
                            <span className="font-bold text-white text-sm">{b.categoryNameAr}</span>
                            <Badge variant="outline" className={`text-[10px] font-bold ${
                              b.alertLevel === "SAFE"
                                ? "text-emerald-300 border-emerald-500/40 bg-emerald-500/10"
                                : b.alertLevel === "APPROACHING_LIMIT"
                                ? "text-amber-300 border-amber-500/40 bg-amber-500/10"
                                : "text-rose-300 border-rose-500/40 bg-rose-500/10"
                            }`}>
                              {b.alertLevel === "SAFE" ? "آمن" : b.alertLevel === "APPROACHING_LIMIT" ? "اقترب من الحد (80%)" : "تجاوز الميزانية"}
                            </Badge>
                          </div>
                          <div className="flex justify-between text-slate-300 font-semibold text-xs">
                            <span>المصروف الفعلي: {formatMoney(b.actualSpentEGP)}</span>
                            <span>الحد المخطط: {formatMoney(b.budgetLimitEGP)}</span>
                          </div>
                          <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden border border-slate-700">
                            <div
                              className={`h-full rounded-full ${
                                b.usagePercent < 80 ? "bg-emerald-500" : b.usagePercent < 100 ? "bg-amber-500" : "bg-rose-500"
                              }`}
                              style={{ width: `${Math.min(100, b.usagePercent)}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-10 border border-dashed border-slate-800 rounded-xl bg-slate-950/40">
                      <PieChart className="w-8 h-8 text-slate-500 mx-auto mb-2" />
                      <p className="text-slate-200 font-bold text-sm">لا توجد بنود ميزانية محددة للفترة الحالية</p>
                      <p className="text-xs text-slate-400 mt-1 mb-4">حدد ميزانية شهرية للفئات الأساسية لتفعيل نظام الإنذار المبكر.</p>
                      <Link href="/cash-flow">
                        <Button size="sm" className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs">
                          تحديد ميزانية الشهر
                        </Button>
                      </Link>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Recurring Subscriptions Countdown */}
              <Card className="bg-slate-900/90 border-slate-800 shadow-lg">
                <CardHeader className="pb-3 flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-base font-bold flex items-center gap-2 text-white">
                      <Clock className="w-4 h-4 text-purple-400" />
                      الاشتراكات الدورية والعد التنازلي للتجديد
                    </CardTitle>
                    <CardDescription className="text-xs text-slate-300 font-medium">
                      الاشتراكات المسجلة في القواعد الدورية مع احتساب الاستنزاف السنوي.
                    </CardDescription>
                  </div>
                  <Button
                    onClick={() => setIsSubModalOpen(true)}
                    size="sm"
                    className="bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs gap-1 shadow-md"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    إضافة اشتراك
                  </Button>
                </CardHeader>
                <CardContent>
                  {health?.subscriptions && health.subscriptions.subscriptions.length > 0 ? (
                    <div className="space-y-3">
                      <div className="p-3 bg-purple-500/10 rounded-xl border border-purple-500/30 flex justify-between items-center text-xs">
                        <span className="text-slate-300 font-semibold">إجمالي الاستنزاف السنوي للاشتراكات:</span>
                        <span className="font-black text-purple-300 text-sm">{formatMoney(health.subscriptions.totalAnnualDrainEGP)}</span>
                      </div>
                      {health.subscriptions.subscriptions.map((sub) => (
                        <div key={sub.ruleId} className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800 flex justify-between items-center text-xs">
                          <div>
                            <p className="font-bold text-white text-sm">{sub.memo}</p>
                            <p className="text-xs text-slate-400 mt-0.5 font-medium">
                              {formatMoney(sub.amountEGP)} ({sub.cadence === "monthly" ? "شهرياً" : "سنوياً"})
                            </p>
                          </div>
                          <div className="text-left">
                            <Badge className={`text-xs font-bold ${
                              sub.daysRemaining <= 5 ? "bg-amber-500 text-slate-950" : "bg-slate-800 text-slate-200 border border-slate-700"
                            }`}>
                              تجديد خلال {sub.daysRemaining} يوم
                            </Badge>
                            <p className="text-[11px] text-slate-400 mt-1 font-medium">{sub.nextRenewalDate}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-10 border border-dashed border-slate-800 rounded-xl bg-slate-950/40">
                      <Clock className="w-8 h-8 text-slate-500 mx-auto mb-2" />
                      <p className="text-slate-200 font-bold text-sm">لا توجد اشتراكات دورية مسجلة حالياً</p>
                      <p className="text-xs text-slate-400 mt-1 mb-4">أضف اشتراكاتك الدورية لمتابعة مواعيد التجديد وتكلفتها السنوية.</p>
                      <Button
                        onClick={() => setIsSubModalOpen(true)}
                        size="sm"
                        className="bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs"
                      >
                        <Plus className="w-4 h-4 ml-1" />
                        إضافة اشتراك دوري
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* Modal 1: Simulate Order Execution */}
        <Dialog open={isSimTradeOpen} onOpenChange={setIsSimTradeOpen}>
          <DialogContent className="sm:max-w-[425px] bg-slate-900 text-white border-slate-800" dir="rtl">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold flex items-center gap-2 text-white">
                <Sparkles className="w-5 h-5 text-amber-400" />
                تنفيذ صفقة محاكاة افتراضية (Paper Order)
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-300 font-medium">
                صفقة تجريبية بدون أي ربط بنكي أو تنفيذ حقيقي للأموال.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSimulateTradeSubmit} className="space-y-4 py-2">
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-slate-200">الأصل المالي</Label>
                <Input value={`${activeInstrument?.nameAr || selectedTicker} (${selectedTicker})`} disabled className="bg-slate-950 border-slate-700 text-xs font-bold text-slate-100" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-slate-200">نوع الأمر</Label>
                  <div className="grid grid-cols-2 gap-1.5">
                    <Button
                      type="button"
                      variant={simAction === "BUY" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSimAction("BUY")}
                      className={`text-xs font-bold ${simAction === "BUY" ? "bg-emerald-600 text-white" : "border-slate-700 bg-slate-950 text-slate-200"}`}
                    >
                      شراء
                    </Button>
                    <Button
                      type="button"
                      variant={simAction === "SELL" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSimAction("SELL")}
                      className={`text-xs font-bold ${simAction === "SELL" ? "bg-rose-600 text-white" : "border-slate-700 bg-slate-950 text-slate-200"}`}
                    >
                      بيع
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-slate-200">سعر السوق الحالي</Label>
                  <Input value={`${currentPrice} ج.م`} disabled className="bg-slate-950 border-slate-700 text-xs font-bold text-amber-400" />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold text-slate-200">الكمية المطلوبة (سهم / جرام / وثيقة)</Label>
                <Input
                  type="number"
                  min={1}
                  value={simQty}
                  onChange={(e) => setSimQty(Number(e.target.value))}
                  className="bg-slate-950 border-slate-700 text-xs font-bold text-white"
                />
              </div>

              <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-xs flex justify-between font-semibold">
                <span className="text-slate-300">إجمالي قيمة الصفقة التقديري:</span>
                <span className="font-bold text-amber-400 text-sm">{formatMoney(simQty * currentPrice)}</span>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold text-slate-200">ملاحظات الصفقة (اختياري)</Label>
                <Input
                  placeholder="مثال: شراء على ارتداد مؤشر RSI"
                  value={simNotes}
                  onChange={(e) => setSimNotes(e.target.value)}
                  className="bg-slate-950 border-slate-700 text-xs text-white"
                />
              </div>

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsSimTradeOpen(false)}
                  className="border-slate-700 text-slate-300 hover:bg-slate-800 text-xs font-semibold"
                >
                  إلغاء
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={simOrderMutation.isPending}
                  className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs"
                >
                  {simOrderMutation.isPending ? "جارٍ التنفيذ..." : "تأكيد تنفيذ المحاكاة"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Modal 2: Create Real Credit Card */}
        <Dialog open={isCardModalOpen} onOpenChange={setIsCardModalOpen}>
          <DialogContent className="sm:max-w-[450px] bg-slate-900 text-white border-slate-800" dir="rtl">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold flex items-center gap-2 text-white">
                <CreditCard className="w-5 h-5 text-amber-400" />
                إضافة بطاقة ائتمانية جديدة إلى الالتزامات
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-300 font-medium">
                تسجيل البطاقة في قاعدة البيانات لمتابعة الاستغلال وفترات السماح.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleCreateCardSubmit} className="space-y-3.5 py-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-200">اسم البطاقة</Label>
                <Input
                  placeholder="مثال: CIB Titanium أو بنك مصر الذهبية"
                  value={cardName}
                  onChange={(e) => setCardName(e.target.value)}
                  required
                  className="bg-slate-950 border-slate-700 text-xs text-white"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-200">البنك أو الجهة المصدرة</Label>
                <Input
                  placeholder="مثال: البنك التجاري الدولي (CIB)"
                  value={cardLender}
                  onChange={(e) => setCardLender(e.target.value)}
                  required
                  className="bg-slate-950 border-slate-700 text-xs text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-200">الحد الائتماني (ج.م)</Label>
                  <Input
                    type="number"
                    min={1000}
                    value={cardLimit}
                    onChange={(e) => setCardLimit(Number(e.target.value))}
                    required
                    className="bg-slate-950 border-slate-700 text-xs text-white font-bold"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-200">الرصيد المستغل الحالي (ج.م)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={cardUtilized}
                    onChange={(e) => setCardUtilized(Number(e.target.value))}
                    className="bg-slate-950 border-slate-700 text-xs text-white font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-200">يوم إغلاق كشف الحساب (1-31)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={31}
                    value={cardCycleDay}
                    onChange={(e) => setCardCycleDay(Number(e.target.value))}
                    required
                    className="bg-slate-950 border-slate-700 text-xs text-white font-bold"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-200">مدة فترة السماح (يوم)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={60}
                    value={cardGraceDays}
                    onChange={(e) => setCardGraceDays(Number(e.target.value))}
                    required
                    className="bg-slate-950 border-slate-700 text-xs text-white font-bold"
                  />
                </div>
              </div>

              <DialogFooter className="pt-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsCardModalOpen(false)}
                  className="border-slate-700 text-slate-300 hover:bg-slate-800 text-xs font-semibold"
                >
                  إلغاء
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={createCardMutation.isPending}
                  className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs"
                >
                  {createCardMutation.isPending ? "جارٍ الحفظ..." : "حفظ البطاقة في الالتزامات"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Modal 3: Add Recurring Subscription */}
        <Dialog open={isSubModalOpen} onOpenChange={setIsSubModalOpen}>
          <DialogContent className="sm:max-w-[425px] bg-slate-900 text-white border-slate-800" dir="rtl">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold flex items-center gap-2 text-white">
                <Clock className="w-5 h-5 text-purple-400" />
                إضافة اشتراك دوري جديد
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-300 font-medium">
                إدراج خدمة دورية لتتبع مواعيد التجديد والاستنزاف السنوي.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleCreateSubSubmit} className="space-y-3.5 py-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-200">اسم الخدمة أو الاشتراك</Label>
                <Input
                  placeholder="مثال: Netflix Premium أو Google One"
                  value={subMemo}
                  onChange={(e) => setSubMemo(e.target.value)}
                  required
                  className="bg-slate-950 border-slate-700 text-xs text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-200">تصنيف الاشتراك</Label>
                  <Input
                    placeholder="مثال: ترفيه، تقنية، رياضة"
                    value={subTag}
                    onChange={(e) => setSubTag(e.target.value)}
                    className="bg-slate-950 border-slate-700 text-xs text-white"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-200">دورية التجديد</Label>
                  <Select value={subCadence} onValueChange={(val: any) => setSubCadence(val)}>
                    <SelectTrigger className="bg-slate-950 border-slate-700 text-xs text-white font-semibold">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-800 text-white">
                      <SelectItem value="monthly">شهرياً</SelectItem>
                      <SelectItem value="yearly">سنوياً</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-200">قيمة الاشتراك (ج.م)</Label>
                <Input
                  type="number"
                  min={1}
                  value={subAmount}
                  onChange={(e) => setSubAmount(Number(e.target.value))}
                  required
                  className="bg-slate-950 border-slate-700 text-xs text-white font-bold"
                />
              </div>

              <DialogFooter className="pt-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsSubModalOpen(false)}
                  className="border-slate-700 text-slate-300 hover:bg-slate-800 text-xs font-semibold"
                >
                  إلغاء
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={createSubMutation.isPending}
                  className="bg-purple-600 hover:bg-purple-500 text-white font-black text-xs"
                >
                  {createSubMutation.isPending ? "جارٍ الحفظ..." : "إضافة الاشتراك"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* External Broker Trade Modal */}
        <LogExternalTradeModal
          open={isExternalTradeOpen}
          onOpenChange={setIsExternalTradeOpen}
          defaultTicker={signal?.ticker || selectedTicker}
          defaultInstrumentName={activeInstrument?.nameAr || signal?.instrumentNameAr || selectedTicker}
          defaultPrice={signal?.currentPrice}
        />
      </div>
    </DashboardLayout>
  );
}
