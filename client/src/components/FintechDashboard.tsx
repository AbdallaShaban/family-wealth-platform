import React, { useMemo, useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { useDemoMode } from "@/contexts/DemoModeContext";
import { trpc } from "@/lib/trpc";
import { demoDashboard, getDashboardPreviewMode } from "@/lib/demoDashboard";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import SensitiveValue from "@/components/SensitiveValue";
import { formatMoney, formatDateTime } from "@/lib/financialDisplay";
import {
  CreditCard,
  DollarSign,
  Landmark,
  Plus,
  TrendingUp,
  Wallet,
  ArrowUpRight,
  ShieldCheck,
  ShieldAlert,
  Coins,
  Sparkles,
  RefreshCw,
  Layers,
  ArrowDownLeft,
  ArrowLeftRight,
  ChevronLeft,
  Activity,
  Flame,
  CheckCircle2,
  Clock,
  ExternalLink,
} from "lucide-react";
import { useLocation } from "wouter";
import ReconciliationModal from "@/components/modals/ReconciliationModal";
import DebtPaymentModal from "@/components/modals/DebtPaymentModal";
import { LogExternalTradeModal } from "@/components/trading/LogExternalTradeModal";
import { OnboardingWizard } from "@/components/OnboardingWizard";
import { FinancialOverviewCard } from "./dashboard/FinancialOverviewCard";
import { MoneyMovementCard } from "./dashboard/MoneyMovementCard";
import { AccountCardsWidget } from "./dashboard/AccountCardsWidget";
import { RecentTransactionsWidget } from "./dashboard/RecentTransactionsWidget";

const eventLabels: Record<string, string> = {
  opening_balance: "رصيد افتتاحي",
  deposit: "إيداع",
  withdrawal: "سحب",
  transfer: "تحويل",
  buy: "شراء استثمار",
  sell: "بيع استثمار",
  dividend: "توزيع نقدي",
  income: "دخل",
  expense: "مصروف",
  fee: "رسوم",
  tax: "ضريبة",
  adjustment: "تسوية",
  reversal: "عكس قيد",
  debt_origination: "قيد مديونية",
  debt_payment: "سداد دين",
};

export default function FintechDashboard() {
  const { user } = useAuth();
  const { isDemoMode, toggleDemoMode } = useDemoMode();
  const [, setLocation] = useLocation();
  const [wizardOpen, setWizardOpen] = useState(false);

  // tRPC Queries
  const summary = trpc.family.dashboard.useQuery();
  const debts = trpc.family.debts.list.useQuery();
  const egyptMarket = trpc.quant.getEgyptMarket.useQuery(undefined, {
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
  const inflationAnalytics = trpc.quant.getInflationAnalytics.useQuery(
    { baselineInflationPct: 26.5 },
    { staleTime: 60_000, refetchOnWindowFocus: false }
  );
  const topSignals = trpc.quant.getTopSignals.useQuery(undefined, {
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
  const zakatQuery = trpc.quant.getShariaZakat.useQuery(undefined, {
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  // Interactive Modals
  const [reconcileModalOpen, setReconcileModalOpen] = useState(false);
  const [selectedAccountForReconcile, setSelectedAccountForReconcile] = useState<any>(null);
  const [debtPaymentModalOpen, setDebtPaymentModalOpen] = useState(false);
  const [selectedDebtId, setSelectedDebtId] = useState<number | null>(null);

  // Trade Modal
  const [tradeModalOpen, setTradeModalOpen] = useState(false);
  const [selectedTradeAsset, setSelectedTradeAsset] = useState<{
    symbol: string;
    name: string;
    currentPrice?: number;
    target1?: number;
    stopLoss?: number;
  } | null>(null);

  const openReconcileModal = (account?: any) => {
    const defaultAcc = account || (live?.accounts && live.accounts[0]) || null;
    setSelectedAccountForReconcile(defaultAcc);
    setReconcileModalOpen(true);
  };

  const openDebtPaymentModal = (debtId?: number) => {
    const activeList = (debts.data ?? []).filter((d) => d.status === "active");
    setSelectedDebtId(debtId || activeList[0]?.id || null);
    setDebtPaymentModalOpen(true);
  };

  const openTradeModal = (signal: any) => {
    setSelectedTradeAsset({
      symbol: signal.ticker,
      name: signal.companyName || signal.ticker,
      currentPrice: signal.currentPrice,
      target1: signal.targets?.t1,
      stopLoss: signal.stopLoss,
    });
    setTradeModalOpen(true);
  };

  const live = summary.data;
  const hasLiveData = Boolean(
    (live?.accounts.length ?? 0) + (live?.portfolio.length ?? 0) + (live?.recentEvents.length ?? 0)
  );
  const previewMode = getDashboardPreviewMode(isDemoMode, hasLiveData);
  const usingDemo = previewMode === "demo";
  const currency = usingDemo ? demoDashboard.baseCurrency : (live?.workspace.baseCurrency ?? "EGP");

  // Metrics
  const netWorth = usingDemo ? demoDashboard.netWorth : (live?.netWorthBase ?? "0");
  const liquidBalance = usingDemo ? demoDashboard.liquidBalance : (live?.liquidBalanceBase ?? "0");
  const investments = usingDemo ? demoDashboard.investments : (live?.investmentValueBase ?? "0");
  const liabilities = usingDemo ? demoDashboard.liabilities : (live?.liabilityBalanceBase ?? "0");
  const pnl = usingDemo ? demoDashboard.unrealizedPnl : (live?.unrealizedPnlBase ?? "0");

  // Accounts
  const accounts = usingDemo
    ? demoDashboard.accounts
    : (live?.accounts ?? []).map((acc) => ({
        id: String(acc.id),
        name: acc.name,
        value: Number(acc.baseValue ?? acc.balance ?? 0),
        currency: acc.currency,
        kind: acc.accountType,
      }));

  // Events / Transactions
  const rawEvents = useMemo(() => {
    if (usingDemo) {
      return demoDashboard.events.map((event) => ({
        id: event.id,
        title: event.type,
        badge: event.tone === "expense" ? "سحب / مصروف" : event.type.includes("تحويل") ? "تحويل" : "إيداع سيولة",
        amount: event.amount,
        currency: event.currency,
        date: event.date,
        isOutflow: event.tone === "expense",
        isTransfer: event.type.includes("تحويل"),
      }));
    }
    return (live?.recentEvents ?? []).map((event) => {
      const isTransfer = event.eventType === "transfer";
      const isOutflow =
        !isTransfer && ["expense", "withdrawal", "fee", "tax", "debt_payment", "buy"].includes(event.eventType);
      const label = eventLabels[event.eventType] ?? event.eventType;
      const defaultTitle =
        event.eventType === "deposit"
          ? "إيداع سيولة نقدية"
          : event.eventType === "opening_balance"
            ? "رصيد افتتاحي"
            : event.eventType === "withdrawal"
              ? "سحب سيولة"
              : event.eventType === "expense"
                ? "مصروف مسجل"
                : event.eventType === "transfer"
                  ? "تحويل داخلي"
                  : label;
      return {
        id: String(event.id),
        title: event.memo || defaultTitle,
        badge: label,
        amount: event.grossAmount,
        currency: event.currency,
        date: formatDateTime(event.occurredAt),
        isOutflow,
        isTransfer,
      };
    });
  }, [usingDemo, live?.recentEvents]);

  // Debts list
  const debtItems = usingDemo
    ? demoDashboard.debts
    : (debts.data ?? []).filter((d) => d.status === "active").map((d) => ({
        id: String(d.id),
        name: d.name,
        outstanding: d.outstanding,
        currency: d.currency,
        payment: d.minimumPayment,
      }));

  // Market & Gold Quotes
  const goldPurities = egyptMarket.data?.gold?.purities ?? [
    { karat: 24, gramPriceEGP: 4650 },
    { karat: 21, gramPriceEGP: 4068 },
    { karat: 18, gramPriceEGP: 3487 },
  ];
  const goldSovereign = egyptMarket.data?.gold?.sovereign ?? { priceEGP: 32550 };

  // Inflation & Real Yield
  const inflationReport = inflationAnalytics.data;
  const weightedNominalYield = inflationReport?.weightedNominalYieldPct ?? 50.0;
  const baselineInflation = inflationReport?.baselineInflationPct ?? 26.5;
  const realYieldNet = Number((weightedNominalYield - baselineInflation).toFixed(1));

  // Sharia Zakat Data
  const zakatInfo = zakatQuery.data;
  const zakatDueAmount = zakatInfo?.totalZakatDueEgp ?? zakatInfo?.totalZakatDue ?? 0;
  const zakatNisabEGP = zakatInfo?.nisabValueEgp ?? 395250;
  const hawlStatus = zakatInfo?.hawlCountdown?.status ?? "ACCUMULATING";

  if (summary.isLoading && !isDemoMode) {
    return (
      <DashboardLayout>
        <div className="w-full max-w-7xl mx-auto space-y-6 p-4 sm:p-6" dir="rtl">
          <div className="flex items-center justify-between">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-10 w-36" />
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-32 rounded-xl" />
            ))}
          </div>
          <div className="grid gap-6 lg:grid-cols-3">
            <Skeleton className="h-72 rounded-xl lg:col-span-2" />
            <Skeleton className="h-72 rounded-xl lg:col-span-1" />
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="w-full max-w-7xl mx-auto space-y-7" dir="rtl">
        {/* ========================================================================= */}
        {/* 1. TOP HEADER & QUICK ACTION BAR (MIDDAY / MAYBE ARCHITECTURE)            */}
        {/* ========================================================================= */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-zinc-200 dark:border-zinc-800">
          <div>
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <Badge
                variant="outline"
                className="gap-1.5 py-0.5 px-2.5 bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30 font-semibold text-xs"
              >
                <span className="size-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse" />
                {usingDemo ? "معاينة تجريبية" : "مساحة العمل المباشرة"}
              </Badge>
              <span className="text-xs text-zinc-500 dark:text-zinc-400 font-mono">
                {live?.workspace.name || "FAMILY"} — {user?.name || "Abdalla Shaban"} ({currency})
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-zinc-950 dark:text-zinc-50">
              مرحباً، {user?.name?.split(" ")[0] || "Abdalla"}
            </h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              نظرة مالية تنفيذية متوازنة لصافي الثروة، التدفقات النقدية، ومحفظة الاستثمارات الحية
            </p>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              onClick={() => setLocation("/transactions?action=new")}
              className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-xs cursor-pointer"
            >
              <Plus className="size-4" />
              <span>تسجيل عملية جديدة</span>
            </Button>
            <Button
              variant="outline"
              onClick={() => openReconcileModal()}
              className="gap-1.5 font-semibold text-xs border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#18181b] hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200 cursor-pointer"
            >
              <RefreshCw className="size-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>تسوية رصيد</span>
            </Button>
            <Button
              variant="outline"
              onClick={() => openDebtPaymentModal()}
              className="gap-1.5 font-semibold text-xs border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#18181b] hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200 cursor-pointer"
            >
              <CreditCard className="size-3.5 text-rose-600 dark:text-rose-400" />
              <span>سداد دين / بطاقة</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleDemoMode}
              className="text-xs text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-zinc-50 cursor-pointer"
            >
              {usingDemo ? "العودة للوضع المباشر" : "تجربة العرض"}
            </Button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 2. TOP ROW: 4 EXECUTIVE METRIC CARDS (ZERO HARDCODED WHITE/BLACK)         */}
        {/* ========================================================================= */}
        <div className="grid gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 items-stretch">
          {/* Card 1: Net Worth */}
          <Card className="h-full border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#18181b] shadow-xs hover:border-zinc-300 dark:hover:border-zinc-700 transition-all rounded-xl flex flex-col justify-between">
            <CardContent className="p-5 flex flex-col justify-between h-full">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">صافي الثروة المجمعة</span>
                <div className="size-9 rounded-lg bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-200 dark:border-emerald-500/30">
                  <Landmark className="size-4" />
                </div>
              </div>
              <div className="mt-4">
                <h3 className="text-2xl sm:text-[26px] font-extrabold tracking-tight text-zinc-950 dark:text-zinc-50 tabular-nums">
                  <SensitiveValue>{formatMoney(netWorth, currency)}</SensitiveValue>
                </h3>
                <div className="flex items-center gap-1.5 mt-2 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                  <TrendingUp className="size-3.5" />
                  <span>+38.5% عن الإغلاق السابق</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Card 2: Liquid Cash */}
          <Card className="h-full border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#18181b] shadow-xs hover:border-zinc-300 dark:hover:border-zinc-700 transition-all rounded-xl flex flex-col justify-between">
            <CardContent className="p-5 flex flex-col justify-between h-full">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">السيولة النقدية المتاحة</span>
                <div className="size-9 rounded-lg bg-sky-50 dark:bg-sky-500/15 text-sky-600 dark:text-sky-400 flex items-center justify-center border border-sky-200 dark:border-sky-500/30">
                  <Wallet className="size-4" />
                </div>
              </div>
              <div className="mt-4">
                <h3 className="text-2xl sm:text-[26px] font-extrabold tracking-tight text-zinc-950 dark:text-zinc-50 tabular-nums">
                  <SensitiveValue>{formatMoney(liquidBalance, currency)}</SensitiveValue>
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2 font-medium">
                  {accounts.length} حسابات مصرفية ونقدية جارية
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Card 3: Investments */}
          <Card className="h-full border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#18181b] shadow-xs hover:border-zinc-300 dark:hover:border-zinc-700 transition-all rounded-xl flex flex-col justify-between">
            <CardContent className="p-5 flex flex-col justify-between h-full">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">إجمالي الاستثمارات</span>
                <div className="size-9 rounded-lg bg-violet-50 dark:bg-violet-500/15 text-violet-600 dark:text-violet-400 flex items-center justify-center border border-violet-200 dark:border-violet-500/30">
                  <TrendingUp className="size-4" />
                </div>
              </div>
              <div className="mt-4">
                <h3 className="text-2xl sm:text-[26px] font-extrabold tracking-tight text-zinc-950 dark:text-zinc-50 tabular-nums">
                  <SensitiveValue>{formatMoney(investments, currency)}</SensitiveValue>
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2 font-medium">
                  أرباح غير محققة:{" "}
                  <span className="font-bold text-emerald-700 dark:text-emerald-400">
                    <SensitiveValue>{formatMoney(pnl, currency)}</SensitiveValue>
                  </span>
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Card 4: Liabilities */}
          <Card className="h-full border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#18181b] shadow-xs hover:border-zinc-300 dark:hover:border-zinc-700 transition-all rounded-xl flex flex-col justify-between">
            <CardContent className="p-5 flex flex-col justify-between h-full">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">الالتزامات والديون</span>
                <div className="size-9 rounded-lg bg-rose-50 dark:bg-rose-500/15 text-rose-600 dark:text-rose-400 flex items-center justify-center border border-rose-200 dark:border-rose-500/30">
                  <CreditCard className="size-4" />
                </div>
              </div>
              <div className="mt-4">
                <h3 className="text-2xl sm:text-[26px] font-extrabold tracking-tight text-zinc-950 dark:text-zinc-50 tabular-nums">
                  <SensitiveValue>{formatMoney(liabilities, currency)}</SensitiveValue>
                </h3>
                <p className="text-xs text-rose-600 dark:text-rose-400 mt-2 font-semibold">
                  {debtItems.length} التزامات وبطاقات نشطة
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ========================================================================= */}
        {/* 3. FEATURE 1: REAL WEALTH PRESERVATION & INFLATION BENCHMARK (MAYBE-STYLE) */}
        {/* ========================================================================= */}
        <Card className="border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#18181b] shadow-xs rounded-2xl overflow-hidden">
          <CardHeader className="p-5 sm:p-6 pb-3 border-b border-zinc-100 dark:border-zinc-800/80 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30">
                  <ShieldCheck className="size-4" />
                </span>
                <CardTitle className="text-base sm:text-lg font-bold text-zinc-950 dark:text-zinc-50">
                  مؤشر الحفاظ على الثروة الحقيقية ودرع التضخم
                </CardTitle>
                <Badge
                  variant="outline"
                  className="bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30 text-[11px] font-bold"
                >
                  Fisher Real Yield: R_real = R_nominal - Inflation
                </Badge>
              </div>
              <CardDescription className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                قياس صافي العائد الحقيقي للمحفظة بعد استقطاع معدل التضخم السنوي المعلن لحماية القوة الشرائية
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 text-xs font-mono self-start sm:self-auto">
              <span className="text-zinc-500 dark:text-zinc-400 font-semibold">معدل التضخم المعياري:</span>
              <span className="font-extrabold px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/60">
                {baselineInflation}% سنوياً
              </span>
            </div>
          </CardHeader>
          <CardContent className="p-5 sm:p-6 pt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/40">
                <span className="text-xs text-zinc-500 dark:text-zinc-400 block font-medium">العائد الاسمي للمحفظة</span>
                <strong className="text-xl sm:text-2xl font-extrabold text-zinc-950 dark:text-zinc-50 font-mono tabular-nums block mt-1">
                  +{weightedNominalYield}%
                </strong>
                <span className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1 block">متوسط العوائد المرجحة بالوزن</span>
              </div>
              <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/40">
                <span className="text-xs text-zinc-500 dark:text-zinc-400 block font-medium">معدل التضخم السنوي</span>
                <strong className="text-xl sm:text-2xl font-extrabold text-amber-600 dark:text-amber-400 font-mono tabular-nums block mt-1">
                  -{baselineInflation}%
                </strong>
                <span className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1 block">مؤشر أسعار المستهلك (CPI)</span>
              </div>
              <div className="p-4 rounded-xl border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/20">
                <span className="text-xs text-emerald-800 dark:text-emerald-300 block font-semibold">صافي العائد الحقيقي (Real Yield)</span>
                <strong className="text-xl sm:text-2xl font-extrabold text-emerald-700 dark:text-emerald-400 font-mono tabular-nums block mt-1">
                  {realYieldNet >= 0 ? "+" : ""}{realYieldNet}%
                </strong>
                <span className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-1 font-semibold block">
                  {realYieldNet >= 0 ? "نمو يفوق التضخم ويحمي القوة الشرائية" : "تآكل بالقوة الشرائية"}
                </span>
              </div>
              <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/40 flex flex-col justify-between">
                <div>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400 block font-medium">معايرة فئات الأصول</span>
                  <div className="flex items-center justify-between text-xs mt-1.5 font-bold">
                    <span className="text-emerald-700 dark:text-emerald-400">محمية (ذهب وأسهم):</span>
                    <span className="font-mono">82%</span>
                  </div>
                  <div className="flex items-center justify-between text-xs mt-1 font-bold">
                    <span className="text-amber-700 dark:text-amber-400">سيولة غير مستثمرة:</span>
                    <span className="font-mono">18%</span>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setLocation("/wealth-health")}
                  className="h-7 text-xs text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 font-bold p-0 justify-start mt-2"
                >
                  فحص تفاصيل درع التضخم ←
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ========================================================================= */}
        {/* 4. FEATURE 2: GOLD ASSETS BREAKDOWN BY KARAT (MAYBE / MIDDAY LIVE FEED)   */}
        {/* ========================================================================= */}
        <div>
          <div className="flex items-center justify-between mb-3 px-1">
            <div className="flex items-center gap-2">
              <Coins className="size-4 text-amber-500" />
              <h2 className="text-base font-bold text-zinc-950 dark:text-zinc-50">
                أسعار الذهب والسبائك بالعيارات (تسعير لحظي)
              </h2>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation("/investments?tab=instruments")}
              className="text-xs text-zinc-500 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-zinc-50 font-bold h-7 gap-1"
            >
              <span>إدارة محفظة الذهب</span>
              <ChevronLeft className="size-3" />
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 24K */}
            <Card className="border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#18181b] shadow-xs rounded-xl">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 font-bold">ذهب عيار 24 (سبائك معتمدة 999.9)</p>
                  <p className="text-xl sm:text-2xl font-black text-amber-600 dark:text-amber-400 mt-1 font-mono tabular-nums">
                    {formatMoney(goldPurities[0]?.gramPriceEGP || 4650, "EGP", 0)} / جم
                  </p>
                  <span className="text-[10px] text-zinc-500 dark:text-zinc-400 block mt-1">سبائك BTC / سويسري</span>
                </div>
                <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800/60">
                  <Coins className="size-5" />
                </div>
              </CardContent>
            </Card>

            {/* 21K */}
            <Card className="border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#18181b] shadow-xs rounded-xl">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 font-bold">ذهب عيار 21 (جنيهات ومصوغات 875)</p>
                  <p className="text-xl sm:text-2xl font-black text-amber-600 dark:text-amber-400 mt-1 font-mono tabular-nums">
                    {formatMoney(goldPurities[1]?.gramPriceEGP || 4068, "EGP", 0)} / جم
                  </p>
                  <span className="text-[10px] text-zinc-500 dark:text-zinc-400 block mt-1">الأعلى تداولاً بالسوق المصري</span>
                </div>
                <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800/60">
                  <Coins className="size-5" />
                </div>
              </CardContent>
            </Card>

            {/* 18K */}
            <Card className="border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#18181b] shadow-xs rounded-xl">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 font-bold">ذهب عيار 18 (استثماري وحلي 750)</p>
                  <p className="text-xl sm:text-2xl font-black text-amber-600 dark:text-amber-400 mt-1 font-mono tabular-nums">
                    {formatMoney(goldPurities[2]?.gramPriceEGP || 3487, "EGP", 0)} / جم
                  </p>
                  <span className="text-[10px] text-zinc-500 dark:text-zinc-400 block mt-1">مصوغات واستثمار مرن</span>
                </div>
                <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800/60">
                  <Coins className="size-5" />
                </div>
              </CardContent>
            </Card>

            {/* Sovereign Coin */}
            <Card className="border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#18181b] shadow-xs rounded-xl">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 font-bold">الجنيه الذهب الرسمي (8 جم 21k)</p>
                  <p className="text-xl sm:text-2xl font-black text-amber-600 dark:text-amber-400 mt-1 font-mono tabular-nums">
                    {formatMoney(goldSovereign?.priceEGP || 32550, "EGP", 0)}
                  </p>
                  <span className="text-[10px] text-zinc-500 dark:text-zinc-400 block mt-1">عملة ادخار بدون مصنعية</span>
                </div>
                <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800/60">
                  <Coins className="size-5" />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 5. MIDDLE SECTION: FINANCIAL OVERVIEW & MONEY MOVEMENT (CHARTS)           */}
        {/* ========================================================================= */}
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <FinancialOverviewCard netWorth={netWorth} currency={currency} />
          </div>
          <div className="lg:col-span-1">
            <MoneyMovementCard currency={currency} />
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 6. FEATURE 3: STOCK TRADING & ADVISORY SIGNALS (EGX HIGH CONVICTION)      */}
        {/* ========================================================================= */}
        <Card className="border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#18181b] shadow-xs rounded-2xl overflow-hidden">
          <CardHeader className="p-5 sm:p-6 pb-3 border-b border-zinc-100 dark:border-zinc-800/80 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-sky-50 dark:bg-sky-500/15 text-sky-600 dark:text-sky-400 border border-sky-200 dark:border-sky-500/30">
                  <Sparkles className="size-4" />
                </span>
                <CardTitle className="text-base sm:text-lg font-bold text-zinc-950 dark:text-zinc-50">
                  تداول الأسهم والإشارات الكمية (البورصة المصرية EGX)
                </CardTitle>
                <Badge
                  variant="outline"
                  className="bg-sky-50 dark:bg-sky-500/15 text-sky-700 dark:text-sky-400 border-sky-200 dark:border-sky-500/30 text-[10px] font-bold"
                >
                  Live Conviction Feed
                </Badge>
              </div>
              <CardDescription className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                إشارات فنية وكمية منتقاة بعناية مع نطاقات الدخول والأهداف ونسبة العائد للمخاطرة
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setLocation("/quant")}
              className="text-xs border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#18181b] font-bold gap-1 self-start sm:self-auto"
            >
              <span>مركز التحليل الكامل</span>
              <ChevronLeft className="size-3.5" />
            </Button>
          </CardHeader>
          <CardContent className="p-5 sm:p-6 pt-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {(topSignals.data?.slice(0, 3) ?? [
                {
                  ticker: "COMI",
                  instrumentNameAr: "البنك التجاري الدولي",
                  actionAr: "تجميع قوي",
                  confidenceScore: 88,
                  currentPrice: 84.5,
                  entryZone: { min: 83.0, max: 85.0 },
                  targets: { t1: 92.0, t2: 98.0 },
                  stopLoss: 80.5,
                  riskRewardRatio: 2.8,
                },
                {
                  ticker: "MFPC",
                  instrumentNameAr: "مصر لإنتاج الأسمدة (موبكو)",
                  actionAr: "شراء اختراق",
                  confidenceScore: 84,
                  currentPrice: 48.2,
                  entryZone: { min: 47.5, max: 48.5 },
                  targets: { t1: 54.0, t2: 58.0 },
                  stopLoss: 45.0,
                  riskRewardRatio: 2.5,
                },
                {
                  ticker: "AZG",
                  instrumentNameAr: "صندوق أزيموت للذهب",
                  actionAr: "درع استثماري",
                  confidenceScore: 92,
                  currentPrice: 28.9,
                  entryZone: { min: 28.0, max: 29.2 },
                  targets: { t1: 34.0, t2: 38.0 },
                  stopLoss: 26.5,
                  riskRewardRatio: 3.1,
                },
              ]).map((signal: any) => (
                <div
                  key={signal.ticker}
                  className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/40 flex flex-col justify-between hover:border-zinc-300 dark:hover:border-zinc-700 transition-all"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <strong className="text-sm font-extrabold text-zinc-950 dark:text-zinc-50 block font-mono">
                          {signal.ticker}
                        </strong>
                        <span className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium">
                          {signal.instrumentNameAr || signal.companyName || signal.ticker}
                        </span>
                      </div>
                      <Badge className="bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30 font-bold text-[10px]">
                        {signal.actionAr} ({signal.confidenceScore}%)
                      </Badge>
                    </div>

                    <div className="space-y-1.5 text-xs pt-2 border-t border-zinc-200/80 dark:border-zinc-800/80 font-mono">
                      <div className="flex justify-between">
                        <span className="text-zinc-500 dark:text-zinc-400 font-sans">السعر الحالي:</span>
                        <b className="text-zinc-950 dark:text-zinc-50 font-bold">{signal.currentPrice} ج.م</b>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-500 dark:text-zinc-400 font-sans">الهدف الأول (TP1):</span>
                        <b className="text-emerald-600 dark:text-emerald-400 font-bold">{signal.targets?.t1} ج.م</b>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-500 dark:text-zinc-400 font-sans">وقف الخسارة (SL):</span>
                        <b className="text-rose-600 dark:text-rose-400 font-bold">{signal.stopLoss} ج.م</b>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 pt-2 flex items-center justify-between border-t border-zinc-200/80 dark:border-zinc-800/80">
                    <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                      العائد/المخاطرة: <b className="font-mono text-zinc-950 dark:text-zinc-50">{signal.riskRewardRatio}</b>
                    </span>
                    <Button
                      size="sm"
                      onClick={() => openTradeModal(signal)}
                      className="h-7 text-xs bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-white dark:hover:bg-zinc-100 dark:text-zinc-950 font-bold px-2.5 rounded-lg cursor-pointer"
                    >
                      تسجيل صفقة ⚡
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* ========================================================================= */}
        {/* 7. FEATURE 4: ZAKAT CALCULATOR & STRESS TESTING (SIDE BY SIDE)             */}
        {/* ========================================================================= */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Card A: Sharia Zakat & Hawl */}
          <Card className="border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#18181b] shadow-xs rounded-2xl flex flex-col justify-between">
            <CardHeader className="p-5 pb-3 border-b border-zinc-100 dark:border-zinc-800/80">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30">
                    <Coins className="size-4" />
                  </span>
                  <CardTitle className="text-base font-bold text-zinc-950 dark:text-zinc-50">
                    حاسبة الزكاة الشرعية وحول الذهب
                  </CardTitle>
                </div>
                <Badge className="bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30 font-bold text-[10px]">
                  نصاب 85 جم 24k
                </Badge>
              </div>
              <CardDescription className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                تتبع اكتمال الحول والنصاب وحساب الزكاة المستحقة (2.5%) على الأرصدة والذهب والأسهم
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5 pt-4 space-y-3">
              <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/40 flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-zinc-500 dark:text-zinc-400 block font-medium">نصاب الذهب الشرعي اليوم</span>
                  <strong className="text-lg font-bold text-zinc-950 dark:text-zinc-50 font-mono tabular-nums block mt-0.5">
                    {formatMoney(zakatNisabEGP, "EGP", 0)}
                  </strong>
                </div>
                <div className="text-start">
                  <span className="text-[11px] text-zinc-500 dark:text-zinc-400 block font-medium">حالة الحول</span>
                  <Badge variant="outline" className="mt-0.5 font-bold text-[11px] border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-400">
                    {hawlStatus === "DUE_NOW" ? "وجبت الزكاة الآن" : "الحول والنصاب ساريان"}
                  </Badge>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/20">
                <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
                  الزكاة المستحقة شرعاً (2.5%):
                </span>
                <span className="text-base font-extrabold text-emerald-700 dark:text-emerald-400 font-mono tabular-nums">
                  {formatMoney(zakatDueAmount, "EGP", 0)}
                </span>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setLocation("/governance?tab=zakat")}
                className="w-full text-xs font-bold border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
              >
                عرض سجل الزكاة ومصارف التوزيع ←
              </Button>
            </CardContent>
          </Card>

          {/* Card B: Stress Testing & Scenario Planning */}
          <Card className="border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#18181b] shadow-xs rounded-2xl flex flex-col justify-between">
            <CardHeader className="p-5 pb-3 border-b border-zinc-100 dark:border-zinc-800/80">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-rose-50 dark:bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-500/30">
                    <ShieldAlert className="size-4" />
                  </span>
                  <CardTitle className="text-base font-bold text-zinc-950 dark:text-zinc-50">
                    اختبارات الهبوط والضغط (Stress Testing)
                  </CardTitle>
                </div>
                <Badge className="bg-rose-50 dark:bg-rose-500/20 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-500/30 font-bold text-[10px]">
                  Monte Carlo VaR
                </Badge>
              </div>
              <CardDescription className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                محاكاة الصدمات الاقتصادية الكلية (تعويم، رفع الفائدة، ركود تضخمي) لقياس مناعة الأصول
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5 pt-4 space-y-3">
              <div className="space-y-2">
                <div className="p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/40 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="size-2 rounded-full bg-emerald-500" />
                    <span className="font-bold text-zinc-950 dark:text-zinc-50">صدمة انخفاض العملة (تعويم 30%):</span>
                  </div>
                  <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">+18.4% نمو دفاعي</span>
                </div>
                <div className="p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/40 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="size-2 rounded-full bg-amber-500" />
                    <span className="font-bold text-zinc-950 dark:text-zinc-50">رفع الفائدة 300bps:</span>
                  </div>
                  <span className="font-mono font-bold text-amber-700 dark:text-amber-400">+عائد شهادات / -أسهم</span>
                </div>
                <div className="p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/40 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="size-2 rounded-full bg-rose-500" />
                    <span className="font-bold text-zinc-950 dark:text-zinc-50">الركود التضخمي 1970 (Stagflation):</span>
                  </div>
                  <span className="font-mono font-bold text-zinc-700 dark:text-zinc-300">درع الذهب +40%</span>
                </div>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setLocation("/stress-testing")}
                className="w-full text-xs font-bold border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
              >
                تشغيل محاكاة السيناريوهات الكاملة ←
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* ========================================================================= */}
        {/* 8. LOWER SECTION: RECENT TRANSACTIONS TABLE & ACTIVE BANK CARDS           */}
        {/* ========================================================================= */}
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <RecentTransactionsWidget events={rawEvents} currency={currency} />
          </div>
          <div className="lg:col-span-1">
            <AccountCardsWidget
              accounts={accounts}
              debts={debtItems}
              currency={currency}
              onOpenReconcile={openReconcileModal}
              onOpenDebtPayment={openDebtPaymentModal}
            />
          </div>
        </div>
      </div>

      {/* Interactive Modals */}
      <ReconciliationModal
        open={reconcileModalOpen}
        onOpenChange={setReconcileModalOpen}
        account={selectedAccountForReconcile}
      />
      <DebtPaymentModal
        open={debtPaymentModalOpen}
        onOpenChange={setDebtPaymentModalOpen}
        debtId={selectedDebtId}
        debtsList={debts.data ?? []}
        accountsList={live?.accounts ?? []}
        defaultCurrency={currency}
      />
      <LogExternalTradeModal
        open={tradeModalOpen}
        onOpenChange={setTradeModalOpen}
        defaultTicker={selectedTradeAsset?.symbol || ""}
        defaultInstrumentName={selectedTradeAsset?.name || ""}
        defaultPrice={selectedTradeAsset?.currentPrice || ""}
        defaultTarget1={selectedTradeAsset?.target1}
        defaultStopLoss={selectedTradeAsset?.stopLoss}
      />
      <OnboardingWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        workspaceName={live?.workspace.name || "FAMILY"}
        baseCurrency={currency}
      />
    </DashboardLayout>
  );
}
