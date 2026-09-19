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
  Sparkles,
  RefreshCw,
  Target,
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
} from "lucide-react";
import { toast } from "sonner";

export default function QuantitativeHubPage() {
  const [selectedTicker, setSelectedTicker] = useState("COMI.CA");
  const [targetProfile, setTargetProfile] = useState<"BALANCED" | "CONSERVATIVE" | "GROWTH">("BALANCED");
  const [isSimTradeOpen, setIsSimTradeOpen] = useState(false);
  const [simAction, setSimAction] = useState<"BUY" | "SELL">("BUY");
  const [simQty, setSimQty] = useState<number>(100);
  const [simNotes, setSimNotes] = useState("");

  const utils = trpc.useUtils();

  // 1. Egypt Market Data
  const { data: egyptMarket, isLoading: isMarketLoading } = trpc.quant.getEgyptMarket.useQuery();

  // 2. Advisory Signal
  const { data: signal, isLoading: isSignalLoading, refetch: refetchSignal } = trpc.quant.getAdvisorySignal.useQuery({
    ticker: selectedTicker,
    assetType: selectedTicker.includes("GOLD") ? "GOLD" : selectedTicker === "AZG" ? "MUTUAL_FUND" : "EGX_STOCK",
  });

  // 3. Rebalancing Analysis
  const { data: rebalancing, isLoading: isRebalanceLoading } = trpc.quant.getRebalancingAnalysis.useQuery({
    targetProfile,
  });

  // 4. Financial Health
  const { data: health, isLoading: isHealthLoading } = trpc.quant.getFinancialHealth.useQuery();

  // 5. Paper Trading State
  const { data: paperData, isLoading: isPaperLoading } = trpc.quant.getPaperTradingState.useQuery();

  // Simulated Order Mutation
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

  return (
    <DashboardLayout>
      <div className="space-y-8 pb-16" dir="rtl">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-border/40 pb-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500">
                <Sparkles className="w-6 h-6 animate-pulse" />
              </div>
              <h1 className="text-3xl font-black tracking-tight bg-gradient-to-r from-amber-400 via-yellow-200 to-amber-500 bg-clip-text text-transparent">
                مركز الاستخبارات المالية والتحليل الكمي
              </h1>
            </div>
            <p className="text-muted-foreground text-sm flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              نظام استرشادي ومحاكاة كمية متقدمة (Strictly Advisory & Simulation) — لا يتم تنفيذ أي أوامر مالية حقيقية عبر وسطاء.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Badge variant="outline" className="px-3 py-1.5 border-amber-500/30 bg-amber-500/5 text-amber-400 gap-1.5">
              <ShieldCheck className="w-4 h-4" />
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
              className="gap-2 border-border/60 hover:bg-accent/50"
            >
              <RefreshCw className="w-4 h-4" />
              تحديث مباشر
            </Button>
          </div>
        </div>

        {/* Top Summary Ticker Bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-card/40 backdrop-blur border-border/60">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium">ذهب عيار 24 (سبائك)</p>
                <p className="text-xl font-bold text-amber-400 mt-1">
                  {egyptMarket?.gold.purities[0]?.gramPriceEGP ? formatMoney(egyptMarket.gold.purities[0].gramPriceEGP) : "4,650 ج.م"}
                </p>
              </div>
              <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
                <DollarSign className="w-5 h-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/40 backdrop-blur border-border/60">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium">الجنيه الذهب (8 جم 21k)</p>
                <p className="text-xl font-bold text-amber-300 mt-1">
                  {egyptMarket?.gold.sovereign.priceEGP ? formatMoney(egyptMarket.gold.sovereign.priceEGP) : "32,550 ج.م"}
                </p>
              </div>
              <div className="p-2 rounded-lg bg-yellow-500/10 text-yellow-400">
                <Layers className="w-5 h-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/40 backdrop-blur border-border/60">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium">سيولة الطوارئ العائلية</p>
                <p className="text-xl font-bold text-emerald-400 mt-1">
                  {health?.diagnostics.emergencyRunwayMonths ? `${health.diagnostics.emergencyRunwayMonths} أشهر` : "6 أشهر"}
                </p>
              </div>
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                <Activity className="w-5 h-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/40 backdrop-blur border-border/60">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium">عائد محفظة المحاكاة</p>
                <p className={`text-xl font-bold mt-1 ${((paperData?.paperState.totalReturnPercent ?? 0) >= 0) ? "text-emerald-400" : "text-rose-400"}`}>
                  {paperData?.paperState.totalReturnPercent ? `${paperData.paperState.totalReturnPercent > 0 ? "+" : ""}${paperData.paperState.totalReturnPercent}%` : "+0.00%"}
                </p>
              </div>
              <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
                <BarChart3 className="w-5 h-5" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Tabs Hub */}
        <Tabs defaultValue="signals" className="space-y-6">
          <TabsList className="grid grid-cols-2 md:grid-cols-5 bg-card/60 p-1 rounded-xl border border-border/60 h-auto">
            <TabsTrigger value="signals" className="gap-2 py-2.5 data-[state=active]:bg-amber-500 data-[state=active]:text-black font-semibold">
              <Zap className="w-4 h-4" />
              الإشارات الكمية
            </TabsTrigger>
            <TabsTrigger value="market" className="gap-2 py-2.5 data-[state=active]:bg-amber-500 data-[state=active]:text-black font-semibold">
              <BarChart3 className="w-4 h-4" />
              البورصة والذهب
            </TabsTrigger>
            <TabsTrigger value="paper" className="gap-2 py-2.5 data-[state=active]:bg-amber-500 data-[state=active]:text-black font-semibold">
              <Activity className="w-4 h-4" />
              محفظة المحاكاة
            </TabsTrigger>
            <TabsTrigger value="rebalance" className="gap-2 py-2.5 data-[state=active]:bg-amber-500 data-[state=active]:text-black font-semibold">
              <PieChart className="w-4 h-4" />
              إعادة التوازن
            </TabsTrigger>
            <TabsTrigger value="health" className="gap-2 py-2.5 data-[state=active]:bg-amber-500 data-[state=active]:text-black font-semibold">
              <CreditCard className="w-4 h-4" />
              التشخيص والبطاقات
            </TabsTrigger>
          </TabsList>

          {/* ================= TAB 1: ADVISORY SIGNALS ================= */}
          <TabsContent value="signals" className="space-y-6">
            {/* Quick Symbol Selector */}
            <div className="flex flex-wrap items-center gap-2 bg-card/30 p-3 rounded-xl border border-border/50">
              <span className="text-xs font-semibold text-muted-foreground ml-2">اختر الأصل للتحليل:</span>
              {egyptMarket?.egxStocks.map((stock) => (
                <Button
                  key={stock.ticker}
                  variant={selectedTicker === stock.ticker ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedTicker(stock.ticker)}
                  className={`text-xs h-8 ${selectedTicker === stock.ticker ? "bg-amber-500 text-black font-bold" : "border-border/60"}`}
                >
                  {stock.symbol} ({stock.nameAr.split(" ")[0]})
                </Button>
              ))}
              <Button
                variant={selectedTicker === "AZG" ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedTicker("AZG")}
                className={`text-xs h-8 ${selectedTicker === "AZG" ? "bg-amber-500 text-black font-bold" : "border-border/60"}`}
              >
                AZG (صندوق الذهب)
              </Button>
            </div>

            {/* Signal Details Card */}
            {signal && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column: Action & Execution Targets */}
                <Card className="lg:col-span-1 bg-card/40 backdrop-blur border-border/70 flex flex-col justify-between">
                  <CardHeader className="pb-4">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="text-xs font-mono">{signal.ticker}</Badge>
                      <Badge className={`text-xs px-2.5 py-1 ${
                        signal.action.includes("ACCUMULATE")
                          ? "bg-emerald-500 text-white"
                          : signal.action.includes("PROFIT")
                          ? "bg-amber-500 text-black"
                          : "bg-blue-500 text-white"
                      }`}>
                        {signal.actionAr}
                      </Badge>
                    </div>
                    <CardTitle className="text-2xl font-bold mt-3">
                      {activeInstrument?.nameAr || signal.ticker}
                    </CardTitle>
                    <CardDescription className="text-xs text-muted-foreground">
                      السعر الاسترشادي الأخير: <span className="font-bold text-foreground">{signal.currentPrice} ج.م</span>
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    {/* Confidence Meter */}
                    <div>
                      <div className="flex justify-between text-xs mb-1.5 font-medium">
                        <span className="text-muted-foreground">نسبة الثقة الكمية:</span>
                        <span className="text-amber-400 font-bold">{signal.confidenceScore}%</span>
                      </div>
                      <div className="h-2 w-full bg-secondary/50 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-amber-500 to-emerald-400 rounded-full transition-all duration-500"
                          style={{ width: `${signal.confidenceScore}%` }}
                        />
                      </div>
                    </div>

                    {/* Price Targets Box */}
                    <div className="bg-secondary/30 rounded-xl p-3.5 space-y-2.5 text-xs border border-border/40">
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">نطاق الدخول / التجميع:</span>
                        <span className="font-bold text-emerald-400">{signal.entryZone.min} - {signal.entryZone.max} ج.م</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">الهدف الأول (T1 محافظ):</span>
                        <span className="font-bold text-cyan-400">{signal.targets.t1} ج.م</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">الهدف الثاني (T2 طموح):</span>
                        <span className="font-bold text-purple-400">{signal.targets.t2} ج.م</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">وقف الخسارة المرجعي:</span>
                        <span className="font-bold text-rose-400">{signal.stopLoss} ج.م</span>
                      </div>
                      <div className="flex justify-between items-center pt-1 border-t border-border/40">
                        <span className="text-muted-foreground">نسبة العائد للمخاطرة (R/R):</span>
                        <span className="font-bold text-amber-300">1 : {signal.riskRewardRatio}</span>
                      </div>
                    </div>

                    <Button
                      onClick={() => setIsSimTradeOpen(true)}
                      className="w-full bg-amber-500 hover:bg-amber-400 text-black font-bold gap-2 py-2"
                    >
                      <Sparkles className="w-4 h-4" />
                      محاكاة صفقة افتراضية
                    </Button>
                  </CardContent>
                </Card>

                {/* Right Column: Multi-Factor Technical Breakdown & Arabic Analysis */}
                <Card className="lg:col-span-2 bg-card/40 backdrop-blur border-border/70">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg font-bold flex items-center gap-2">
                      <BarChart3 className="w-5 h-5 text-amber-400" />
                      المؤشرات الفنية والتحليل التفسيري باللغة العربية
                    </CardTitle>
                    <CardDescription className="text-xs text-muted-foreground">
                      {signal.arabicAnalysis.headline}
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="space-y-5">
                    {/* Indicators Metric Badges */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="bg-secondary/40 p-3 rounded-xl border border-border/40 text-center">
                        <p className="text-[11px] text-muted-foreground font-medium">مؤشر القوة RSI (14)</p>
                        <p className={`text-lg font-bold mt-1 ${
                          (signal.indicators.rsi ?? 50) <= 35 ? "text-emerald-400" : (signal.indicators.rsi ?? 50) >= 65 ? "text-rose-400" : "text-amber-300"
                        }`}>
                          {signal.indicators.rsi ?? "--"}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {(signal.indicators.rsi ?? 50) <= 35 ? "تشبع بيعي" : (signal.indicators.rsi ?? 50) >= 65 ? "تشبع شرائي" : "متوازن"}
                        </p>
                      </div>

                      <div className="bg-secondary/40 p-3 rounded-xl border border-border/40 text-center">
                        <p className="text-[11px] text-muted-foreground font-medium">زخم MACD</p>
                        <p className={`text-lg font-bold mt-1 ${
                          signal.indicators.macdTrend === "BULLISH" ? "text-emerald-400" : signal.indicators.macdTrend === "BEARISH" ? "text-rose-400" : "text-muted-foreground"
                        }`}>
                          {signal.indicators.macdTrend === "BULLISH" ? "صاعد +" : signal.indicators.macdTrend === "BEARISH" ? "هابط -" : "محايد"}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {signal.indicators.macdHistogram?.toFixed(3) ?? "--"}
                        </p>
                      </div>

                      <div className="bg-secondary/40 p-3 rounded-xl border border-border/40 text-center">
                        <p className="text-[11px] text-muted-foreground font-medium">بولينجر باندز</p>
                        <p className={`text-lg font-bold mt-1 ${
                          signal.indicators.bollingerPosition === "OVERSOLD" ? "text-emerald-400" : signal.indicators.bollingerPosition === "OVERBOUGHT" ? "text-rose-400" : "text-blue-400"
                        }`}>
                          {signal.indicators.bollingerPosition === "OVERSOLD" ? "قاع النطاق" : signal.indicators.bollingerPosition === "OVERBOUGHT" ? "قمة النطاق" : "طبيعي"}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          %B: {signal.indicators.bollingerPercentB ?? "--"}
                        </p>
                      </div>

                      <div className="bg-secondary/40 p-3 rounded-xl border border-border/40 text-center">
                        <p className="text-[11px] text-muted-foreground font-medium">المتوسط المتحرك EMA</p>
                        <p className={`text-lg font-bold mt-1 ${
                          signal.indicators.trendEMA === "UPTREND" ? "text-emerald-400" : signal.indicators.trendEMA === "DOWNTREND" ? "text-rose-400" : "text-yellow-400"
                        }`}>
                          {signal.indicators.trendEMA === "UPTREND" ? "اتجاه صاعد" : signal.indicators.trendEMA === "DOWNTREND" ? "اتجاه هابط" : "عرضي"}
                        </p>
                        <p className="text-[10px] text-muted-foreground">EMA 20 & EMA 50</p>
                      </div>
                    </div>

                    {/* Explanatory Points */}
                    <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4 space-y-2">
                      <p className="text-xs font-bold text-amber-400 flex items-center gap-1.5 mb-2">
                        <Info className="w-4 h-4" />
                        خلاصة التحليل الاسترشادي التفسيري:
                      </p>
                      {signal.arabicAnalysis.keyPoints.map((pt, idx) => (
                        <div key={idx} className="flex items-start gap-2 text-xs text-foreground/90">
                          <span className="text-amber-500 mt-0.5">•</span>
                          <span>{pt}</span>
                        </div>
                      ))}
                    </div>

                    {/* Disclaimer Alert */}
                    <div className="text-[11px] text-muted-foreground bg-secondary/30 p-2.5 rounded-lg border border-border/30 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-yellow-500 shrink-0" />
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
            <Card className="bg-card/40 backdrop-blur border-border/70">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-amber-400" />
                    <CardTitle className="text-lg font-bold">أسعار الذهب المادي في مصر (سوق الصاغة)</CardTitle>
                  </div>
                  <Badge variant="outline" className="text-xs text-amber-400 border-amber-500/30">
                    تحديث لحظي استرشادي
                  </Badge>
                </div>
                <CardDescription className="text-xs text-muted-foreground">
                  الأسعار تشمل متوسط المصنعية والدمغة الرسمية للسبائك والجنيهات الذهب BTC والسويسرية.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  {egyptMarket?.gold.purities.map((g) => (
                    <div key={g.karat} className="bg-secondary/30 p-3.5 rounded-xl border border-border/40">
                      <div className="flex justify-between items-center text-xs font-semibold text-muted-foreground mb-1">
                        <span>{g.nameAr}</span>
                        <span className="text-emerald-400">+{g.change24hPercent}%</span>
                      </div>
                      <p className="text-xl font-black text-amber-400">{formatMoney(g.gramPriceEGP)}</p>
                      <div className="flex justify-between text-[11px] text-muted-foreground mt-2 pt-2 border-t border-border/40">
                        <span>شراء: {formatMoney(g.buyPriceEGP)}</span>
                        <span>بيع: {formatMoney(g.sellPriceEGP)}</span>
                      </div>
                    </div>
                  ))}
                  <div className="bg-secondary/30 p-3.5 rounded-xl border border-border/40">
                    <div className="flex justify-between items-center text-xs font-semibold text-muted-foreground mb-1">
                      <span>الجنيه الذهب (8 جم 21k)</span>
                      <span className="text-emerald-400">+0.65%</span>
                    </div>
                    <p className="text-xl font-black text-amber-300">
                      {egyptMarket?.gold.sovereign.priceEGP ? formatMoney(egyptMarket.gold.sovereign.priceEGP) : "32,550 ج.م"}
                    </p>
                    <div className="flex justify-between text-[11px] text-muted-foreground mt-2 pt-2 border-t border-border/40">
                      <span>إعادة الشراء: {formatMoney(egyptMarket?.gold.sovereign.buyPriceEGP || 32350)}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* EGX Top Equities Table */}
            <Card className="bg-card/40 backdrop-blur border-border/70">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-amber-400" />
                  أبرز أسهم البورصة المصرية (EGX Blue Chips)
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  قائمة الأسهم القيادية مع توزيعات الأرباح التقديرية وإمكانية الفحص الكمي المباشر.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-xl border border-border/60 overflow-hidden">
                  <Table>
                    <TableHeader className="bg-secondary/40">
                      <TableRow>
                        <TableHead className="text-right">الرمز</TableHead>
                        <TableHead className="text-right">اسم الشركة</TableHead>
                        <TableHead className="text-right">القطاع</TableHead>
                        <TableHead className="text-right">آخر إغلاق</TableHead>
                        <TableHead className="text-right">عائد التوزيعات</TableHead>
                        <TableHead className="text-center">الإجراء</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {egyptMarket?.egxStocks.map((stock) => (
                        <TableRow key={stock.ticker} className="hover:bg-secondary/20">
                          <TableCell className="font-mono font-bold text-amber-400">{stock.symbol}</TableCell>
                          <TableCell className="font-medium">{stock.nameAr}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{stock.sector}</TableCell>
                          <TableCell className="font-semibold">{stock.lastClose} ج.م</TableCell>
                          <TableCell className="text-emerald-400 font-bold">{stock.typicalDividendYield}%</TableCell>
                          <TableCell className="text-center">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedTicker(stock.ticker);
                                toast.info(`تم تحميل إشارات التحليل الكمي لـ ${stock.nameAr}`);
                              }}
                              className="text-xs text-amber-400 hover:text-amber-300 hover:bg-amber-500/10"
                            >
                              فحص كمي
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            {/* Dividend Calendar Section */}
            <Card className="bg-card/40 backdrop-blur border-border/70">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-emerald-400" />
                  أجندة توزيعات الأرباح النقدية المتوقعة (EGX Dividend Calendar)
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  مواعيد استحقاق الكوبونات النقدية لتعزيز التدفقات النقدية السلبية للعائلة.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {egyptMarket?.dividendCalendar.map((div, idx) => (
                    <div key={idx} className="bg-secondary/30 p-3.5 rounded-xl border border-border/40 space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-sm text-foreground">{div.nameAr}</span>
                        <Badge variant="outline" className={`text-[10px] ${
                          div.status === "CONFIRMED" ? "border-emerald-500/40 text-emerald-400" : "border-yellow-500/40 text-yellow-400"
                        }`}>
                          {div.status === "CONFIRMED" ? "مؤكد" : "تقديري"}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        الكوبون للسهم: <span className="font-bold text-emerald-400">{div.dividendPerShareEGP} ج.م</span>
                      </p>
                      <div className="text-[11px] text-muted-foreground flex justify-between pt-1 border-t border-border/30">
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
              <Card className="bg-card/40 backdrop-blur border-border/70">
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground font-medium">السيولة الافتراضية المتاحة</p>
                  <p className="text-xl font-bold text-amber-400 mt-1">
                    {formatMoney(paperData?.paperState.virtualCashEGP || 1000000)}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-1">رأس مال محاكاة مبدئي 1,000,000 ج.م</p>
                </CardContent>
              </Card>

              <Card className="bg-card/40 backdrop-blur border-border/70">
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground font-medium">قيمة المراكز المفتوحة</p>
                  <p className="text-xl font-bold text-cyan-400 mt-1">
                    {formatMoney(paperData?.paperState.positionsValueEGP || 0)}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {paperData?.paperState.positions.length || 0} مراكز نشطة
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-card/40 backdrop-blur border-border/70">
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground font-medium">الأرباح / الخسائر غير المحققة</p>
                  <p className={`text-xl font-bold mt-1 ${
                    (paperData?.paperState.totalUnrealizedPnLEGP || 0) >= 0 ? "text-emerald-400" : "text-rose-400"
                  }`}>
                    {formatMoney(paperData?.paperState.totalUnrealizedPnLEGP || 0)}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-1">مربوطة بالسعر المباشر</p>
                </CardContent>
              </Card>

              <Card className="bg-card/40 backdrop-blur border-border/70">
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground font-medium">الأرباح المحققة المقفلة</p>
                  <p className="text-xl font-bold text-emerald-300 mt-1">
                    {formatMoney(paperData?.paperState.totalRealizedPnLEGP || 0)}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-1">من الصفقات التي تم إغلاقها</p>
                </CardContent>
              </Card>
            </div>

            {/* Virtual Positions Table */}
            <Card className="bg-card/40 backdrop-blur border-border/70">
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-bold flex items-center gap-2">
                    <Activity className="w-5 h-5 text-amber-400" />
                    المراكز الافتراضية المفتوحة (Virtual Positions)
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground">
                    تتبع أداء صفقاتك التجريبية بدقة واختبر النماذج الكمية قبل المخاطرة بأموال حقيقية.
                  </CardDescription>
                </div>
                <Button
                  onClick={() => setIsSimTradeOpen(true)}
                  className="bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs gap-1.5"
                >
                  <Sparkles className="w-4 h-4" />
                  صفقة تجريبية جديدة
                </Button>
              </CardHeader>
              <CardContent>
                {paperData && paperData.paperState.positions.length > 0 ? (
                  <div className="rounded-xl border border-border/60 overflow-hidden">
                    <Table>
                      <TableHeader className="bg-secondary/40">
                        <TableRow>
                          <TableHead className="text-right">الأصل</TableHead>
                          <TableHead className="text-right">الكمية</TableHead>
                          <TableHead className="text-right">متوسط سعر الشراء</TableHead>
                          <TableHead className="text-right">السعر الحالي</TableHead>
                          <TableHead className="text-right">القيمة الإجمالية</TableHead>
                          <TableHead className="text-right">الربح / الخسارة</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paperData.paperState.positions.map((pos, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="font-bold">{pos.nameAr} ({pos.ticker})</TableCell>
                            <TableCell>{pos.quantity}</TableCell>
                            <TableCell>{pos.averageEntryPrice} ج.م</TableCell>
                            <TableCell>{pos.currentMarketPrice} ج.م</TableCell>
                            <TableCell className="font-semibold">{formatMoney(pos.currentValueEGP)}</TableCell>
                            <TableCell className={`font-bold ${pos.unrealizedPnLEGP >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                              {pos.unrealizedPnLEGP >= 0 ? "+" : ""}{formatMoney(pos.unrealizedPnLEGP)} ({pos.unrealizedPnLPercent}%)
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-10 text-muted-foreground text-sm">
                    لا توجد مراكز مفتوحة حالياً في محفظة المحاكاة. ابدأ بإضافة صفقة تجريبية جديدة.
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Side-by-Side Audit Comparison vs Real Portfolio */}
            <Card className="bg-card/40 backdrop-blur border-border/70">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <ArrowRightLeft className="w-5 h-5 text-cyan-400" />
                  مصفوفة التدقيق المقارن: المحفظة الافتراضية مقابل الثروة العائلية الفعلية
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  مقارنة مؤشرات المحفظة الافتراضية مع المحفظة الحقيقية لقياس حجم التعرض ومخاطر السيولة.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-xl border border-border/60 overflow-hidden">
                  <Table>
                    <TableHeader className="bg-secondary/40">
                      <TableRow>
                        <TableHead className="text-right">المعيار المالي</TableHead>
                        <TableHead className="text-right">المحفظة الافتراضية (محاكاة)</TableHead>
                        <TableHead className="text-right">المحفظة العائلية الحقيقية</TableHead>
                        <TableHead className="text-right">التقييم والهدف الإرشادي</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paperData?.auditMatrix.map((row, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-bold text-foreground">{row.metricAr}</TableCell>
                          <TableCell className="font-mono text-amber-400">{row.paperPortfolioValue}</TableCell>
                          <TableCell className="font-mono text-emerald-400">{row.realPortfolioValue}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{row.varianceDescriptionAr}</TableCell>
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
            <div className="flex items-center justify-between bg-card/30 p-4 rounded-xl border border-border/50">
              <div>
                <p className="text-sm font-bold">نموذج التوزيع الاستثماري المستهدف:</p>
                <p className="text-xs text-muted-foreground">حدد التوجه الاستراتيجي للعائلة لإعادة موازنة الأصول</p>
              </div>
              <div className="flex gap-2">
                {(["BALANCED", "CONSERVATIVE", "GROWTH"] as const).map((prof) => (
                  <Button
                    key={prof}
                    variant={targetProfile === prof ? "default" : "outline"}
                    size="sm"
                    onClick={() => setTargetProfile(prof)}
                    className={targetProfile === prof ? "bg-amber-500 text-black font-bold text-xs" : "text-xs border-border/60"}
                  >
                    {prof === "BALANCED" ? "متوازن (موصى به)" : prof === "CONSERVATIVE" ? "متحفظ (سيولة وذهب)" : "نمو قوي (أسهم)"}
                  </Button>
                ))}
              </div>
            </div>

            {/* Asset Allocation Slices */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {rebalancing?.slices.map((slice) => (
                <Card key={slice.assetClass} className="bg-card/40 backdrop-blur border-border/70">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-foreground">{slice.assetClassAr}</span>
                      <Badge variant="outline" className={`text-[10px] ${
                        slice.actionNeeded === "BALANCED"
                          ? "text-emerald-400 border-emerald-500/30"
                          : slice.actionNeeded === "BUY_MORE"
                          ? "text-cyan-400 border-cyan-500/30"
                          : "text-amber-400 border-amber-500/30"
                      }`}>
                        {slice.actionNeeded === "BALANCED" ? "متوازن" : slice.actionNeeded === "BUY_MORE" ? "عجز (شراء)" : "فائض (تخفيف)"}
                      </Badge>
                    </div>

                    <p className="text-xl font-bold text-amber-400">{formatMoney(slice.currentValueEGP)}</p>

                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>الوزن الحالي: {slice.currentWeightPercent}%</span>
                        <span>المستهدف: {slice.targetWeightPercent}%</span>
                      </div>
                      <div className="h-2 w-full bg-secondary/60 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            Math.abs(slice.variancePercent) <= 3 ? "bg-emerald-500" : "bg-amber-500"
                          }`}
                          style={{ width: `${Math.min(100, slice.currentWeightPercent)}%` }}
                        />
                      </div>
                    </div>

                    {slice.actionAmountEGP > 0 && (
                      <p className="text-[11px] text-muted-foreground pt-2 border-t border-border/30">
                        مقدار التعديل: <span className="font-bold text-foreground">{formatMoney(slice.actionAmountEGP)}</span>
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Rebalancing Recommendations */}
            <Card className="bg-card/40 backdrop-blur border-border/70">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <PieChart className="w-5 h-5 text-amber-400" />
                  خطوات إعادة التوازن الإرشادية الموصى بها (Actionable Rebalancing)
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  توصيات تدريجية لتحقيق التوازن بين فئات الأصول وحماية رأس المال من التضخم.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {rebalancing?.recommendations && rebalancing.recommendations.length > 0 ? (
                  <div className="space-y-3">
                    {rebalancing.recommendations.map((rec, idx) => (
                      <div key={idx} className="bg-secondary/30 p-3.5 rounded-xl border border-border/40 flex items-start gap-3">
                        <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 shrink-0 mt-0.5">
                          <ArrowRightLeft className="w-4 h-4" />
                        </div>
                        <div className="space-y-1 text-xs">
                          <p className="font-bold text-foreground">{rec.rationaleAr}</p>
                          <p className="text-muted-foreground text-[11px]">
                            المبلغ المقترح نقله: <span className="font-bold text-amber-400">{formatMoney(rec.suggestedTransferEGP)}</span>
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 text-emerald-400 font-semibold text-sm flex items-center justify-center gap-2">
                    <CheckCircle2 className="w-5 h-5" />
                    المحفظة متوازنة وموزعة طبقاً للنموذج المستهدف بنسبة ممتازة!
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Concentration Risk Alerts */}
            {rebalancing?.concentrationAlerts && rebalancing.concentrationAlerts.length > 0 && (
              <Card className="bg-card/40 backdrop-blur border-rose-500/30">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg font-bold text-rose-400 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-rose-400" />
                    تنبيهات تركز الأصول والمخاطر المفرطة
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {rebalancing.concentrationAlerts.map((alert, idx) => (
                    <div key={idx} className="bg-rose-500/10 p-3.5 rounded-xl border border-rose-500/20 text-xs space-y-1">
                      <p className="font-bold text-rose-300">
                        {alert.nameAr} ({alert.identifier}) — {alert.portfolioWeightPercent}% من إجمالي المحفظة
                      </p>
                      <p className="text-foreground/90">{alert.adviceAr}</p>
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
              <Card className="bg-card/40 backdrop-blur border-border/70">
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground font-medium">معدل الادخار الشهري</p>
                  <p className="text-xl font-bold text-emerald-400 mt-1">
                    {health?.diagnostics.savingsRatePercent ?? 35}%
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-1">من الدخل الصافي الشهري</p>
                </CardContent>
              </Card>

              <Card className="bg-card/40 backdrop-blur border-border/70">
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground font-medium">نسبة المديونية للأصول</p>
                  <p className="text-xl font-bold text-cyan-400 mt-1">
                    {health?.diagnostics.debtToAssetPercent ?? 12.5}%
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-1">ضمن النطاق الآمن (&lt; 30%)</p>
                </CardContent>
              </Card>

              <Card className="bg-card/40 backdrop-blur border-border/70">
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground font-medium">احتياطي سيولة الطوارئ</p>
                  <p className="text-xl font-bold text-amber-400 mt-1">
                    {health?.diagnostics.emergencyRunwayMonths ?? 6} أشهر
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-1">تغطية مصاريف معيشية فورية</p>
                </CardContent>
              </Card>

              <Card className="bg-card/40 backdrop-blur border-border/70">
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground font-medium">التقييم المالي العام</p>
                  <p className="text-xl font-bold text-emerald-400 mt-1">
                    {health?.diagnostics.healthRatingAr ?? "ممتاز"} ({health?.diagnostics.overallScore ?? 85}/100)
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-1">مؤشر المتانة المالية</p>
                </CardContent>
              </Card>
            </div>

            {/* Credit Card Utilization Section */}
            <Card className="bg-card/40 backdrop-blur border-border/70">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-amber-400" />
                  بطاقات الائتمان ومتابعة فترات السماح (Credit Cards & Grace Periods)
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  تجنب فوائد التمويل الاستهلاكي عبر سداد المديونية قبل انتهاء فترة السماح الخالية من الفوائد.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {health?.creditCards.map((card) => (
                    <div key={card.debtId} className="bg-secondary/30 p-4 rounded-xl border border-border/40 space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-sm text-foreground">{card.cardName}</span>
                        <Badge variant="outline" className={`text-xs ${
                          card.statusLevel === "EXCELLENT"
                            ? "text-emerald-400 border-emerald-500/30"
                            : card.statusLevel === "MODERATE"
                            ? "text-yellow-400 border-yellow-500/30"
                            : "text-rose-400 border-rose-500/30"
                        }`}>
                          استغلال {card.utilizationRatePercent}%
                        </Badge>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <p className="text-muted-foreground text-[11px]">الحد الائتماني الكلي</p>
                          <p className="font-bold text-foreground">{formatMoney(card.creditLimitEGP)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground text-[11px]">الرصيد المستغل الحالي</p>
                          <p className="font-bold text-amber-400">{formatMoney(card.utilizedBalanceEGP)}</p>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <div className="h-2 w-full bg-secondary/60 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              card.utilizationRatePercent < 30 ? "bg-emerald-500" : card.utilizationRatePercent < 60 ? "bg-amber-500" : "bg-rose-500"
                            }`}
                            style={{ width: `${Math.min(100, card.utilizationRatePercent)}%` }}
                          />
                        </div>
                      </div>

                      <div className="flex justify-between items-center text-xs pt-2 border-t border-border/30">
                        <span className="text-muted-foreground">أيام السماح المتبقية:</span>
                        <span className="font-bold text-emerald-400 flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {card.daysUntilInterestFreeExpiry ? `${card.daysUntilInterestFreeExpiry} يوم متبقي` : "25 يوم (تقديري)"}
                        </span>
                      </div>

                      <p className="text-[11px] text-muted-foreground bg-secondary/40 p-2 rounded-lg">
                        {card.adviceAr}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Budget Variance & Recurring Subscriptions */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Budget Variance Alerts */}
              <Card className="bg-card/40 backdrop-blur border-border/70">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <PieChart className="w-4 h-4 text-cyan-400" />
                    مراقبة بنود الميزانية والإنذار المبكر (80% / 100%)
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {health?.budgetVariances.map((b, idx) => (
                    <div key={idx} className="bg-secondary/30 p-3 rounded-xl border border-border/40 space-y-2 text-xs">
                      <div className="flex justify-between items-center">
                        <span className="font-bold">{b.categoryNameAr}</span>
                        <Badge variant="outline" className={`text-[10px] ${
                          b.alertLevel === "SAFE"
                            ? "text-emerald-400 border-emerald-500/30"
                            : b.alertLevel === "APPROACHING_LIMIT"
                            ? "text-amber-400 border-amber-500/30"
                            : "text-rose-400 border-rose-500/30"
                        }`}>
                          {b.alertLevel === "SAFE" ? "آمن" : b.alertLevel === "APPROACHING_LIMIT" ? "اقترب من الحد (80%)" : "تجاوز الميزانية"}
                        </Badge>
                      </div>
                      <div className="flex justify-between text-muted-foreground text-[11px]">
                        <span>المصروف: {formatMoney(b.actualSpentEGP)}</span>
                        <span>المحدد: {formatMoney(b.budgetLimitEGP)}</span>
                      </div>
                      <div className="h-1.5 w-full bg-secondary/60 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            b.usagePercent < 80 ? "bg-emerald-500" : b.usagePercent < 100 ? "bg-amber-500" : "bg-rose-500"
                          }`}
                          style={{ width: `${Math.min(100, b.usagePercent)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Recurring Subscriptions Countdown */}
              <Card className="bg-card/40 backdrop-blur border-border/70">
                <CardHeader className="pb-3 flex flex-row items-center justify-between">
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <Clock className="w-4 h-4 text-purple-400" />
                    الاشتراكات الدورية والعد التنازلي للتجديد
                  </CardTitle>
                  <Badge variant="outline" className="text-[11px] text-purple-300">
                    استنزاف سنوي: {formatMoney(health?.subscriptions.totalAnnualDrainEGP || 0)}
                  </Badge>
                </CardHeader>
                <CardContent className="space-y-3">
                  {health?.subscriptions.subscriptions.map((sub) => (
                    <div key={sub.ruleId} className="bg-secondary/30 p-3 rounded-xl border border-border/40 flex justify-between items-center text-xs">
                      <div>
                        <p className="font-bold text-foreground">{sub.memo}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {formatMoney(sub.amountEGP)} ({sub.cadence === "monthly" ? "شهرياً" : "سنوياً"})
                        </p>
                      </div>
                      <div className="text-left">
                        <Badge className={`text-xs ${
                          sub.daysRemaining <= 5 ? "bg-amber-500 text-black" : "bg-secondary text-foreground"
                        }`}>
                          تجديد خلال {sub.daysRemaining} يوم
                        </Badge>
                        <p className="text-[10px] text-muted-foreground mt-1">{sub.nextRenewalDate}</p>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* Modal: Simulate Order Execution */}
        <Dialog open={isSimTradeOpen} onOpenChange={setIsSimTradeOpen}>
          <DialogContent className="sm:max-w-[425px]" dir="rtl">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-400" />
                تنفيذ صفقة محاكاة افتراضية (Paper Order)
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                صفقة تجريبية بدون أي ربط بنكي أو تنفيذ حقيقي للأموال.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSimulateTradeSubmit} className="space-y-4 py-2">
              <div className="space-y-2">
                <Label className="text-xs font-semibold">الأصل المالي</Label>
                <Input value={`${activeInstrument?.nameAr || selectedTicker} (${selectedTicker})`} disabled className="bg-secondary/40 text-xs font-medium" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-xs font-semibold">نوع الأمر</Label>
                  <div className="grid grid-cols-2 gap-1.5">
                    <Button
                      type="button"
                      variant={simAction === "BUY" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSimAction("BUY")}
                      className={`text-xs ${simAction === "BUY" ? "bg-emerald-500 text-white font-bold" : "border-border/60"}`}
                    >
                      شراء
                    </Button>
                    <Button
                      type="button"
                      variant={simAction === "SELL" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSimAction("SELL")}
                      className={`text-xs ${simAction === "SELL" ? "bg-rose-500 text-white font-bold" : "border-border/60"}`}
                    >
                      بيع
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-semibold">سعر السوق الحالي</Label>
                  <Input value={`${currentPrice} ج.م`} disabled className="bg-secondary/40 text-xs font-medium" />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold">الكمية المطلوبة (سهم / جرام / وثيقة)</Label>
                <Input
                  type="number"
                  min={1}
                  value={simQty}
                  onChange={(e) => setSimQty(Number(e.target.value))}
                  className="text-xs"
                />
              </div>

              <div className="p-3 bg-secondary/30 rounded-lg border border-border/40 text-xs flex justify-between">
                <span className="text-muted-foreground">إجمالي قيمة الصفقة التقديري:</span>
                <span className="font-bold text-amber-400">{formatMoney(simQty * currentPrice)}</span>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold">ملاحظات الصفقة (اختياري)</Label>
                <Input
                  placeholder="مثال: شراء على ارتداد مؤشر RSI"
                  value={simNotes}
                  onChange={(e) => setSimNotes(e.target.value)}
                  className="text-xs"
                />
              </div>

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsSimTradeOpen(false)}
                  className="text-xs"
                >
                  إلغاء
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={simOrderMutation.isPending}
                  className="bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs"
                >
                  {simOrderMutation.isPending ? "جارٍ التنفيذ..." : "تأكيد تنفيذ المحاكاة"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
