import React, { useState } from "react";
import DashboardLayout from "./DashboardLayout";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  TrendingUp,
  CreditCard,
  PlusCircle,
  Landmark,
  Wallet,
  Coins,
  ArrowLeftRight,
  ChevronLeft,
  CheckCircle2,
  Building2,
  Smartphone,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowRight,
  ShieldCheck,
  Calendar,
  Receipt,
  Sparkles,
  Activity,
  Scale,
} from "lucide-react";
import { FinancialOverviewCard } from "./dashboard/FinancialOverviewCard";
import { ReconciliationModal } from "./modals/ReconciliationModal";
import { DebtPaymentModal } from "./modals/DebtPaymentModal";
import { QuickOfflineTransactionModal } from "./pwa/QuickOfflineTransactionModal";
import { SmartReceiptPasteModal } from "./transactions/SmartReceiptPasteModal";
import SensitiveValue from "./SensitiveValue";

function formatEGP(val: number | string | null | undefined): string {
  const num = Number(val) || 0;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "EGP",
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(num);
}

export default function FintechDashboard() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  // Dialog States
  const [reconciliationOpen, setReconciliationOpen] = useState(false);
  const [reconciliationAccount, setReconciliationAccount] = useState<{
    id: number;
    name: string;
    value: string | null;
    currency: string;
  } | null>(null);
  const [debtPaymentOpen, setDebtPaymentOpen] = useState(false);
  const [selectedDebtId, setSelectedDebtId] = useState<number | null>(null);
  const [quickEntryOpen, setQuickEntryOpen] = useState(false);
  const [receiptOcrOpen, setReceiptOcrOpen] = useState(false);

  // tRPC Queries
  const summary = trpc.family.dashboard.useQuery();
  const accounts = trpc.family.accounts.list.useQuery();
  const debts = trpc.family.debts.list.useQuery();
  const goldFeed = trpc.family.market.liveGoldAndFx.useQuery(undefined, {
    retry: false,
    staleTime: 60_000,
  });

  if (summary.isLoading && !summary.data) {
    return (
      <DashboardLayout>
        <div className="w-full max-w-7xl mx-auto space-y-6 p-4 sm:p-6 lg:p-8" dir="rtl">
          <Skeleton className="h-44 rounded-3xl bg-muted" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-40 rounded-2xl bg-muted" />
            ))}
          </div>
          <Skeleton className="h-48 rounded-2xl bg-muted" />
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <Skeleton className="lg:col-span-7 h-96 rounded-2xl bg-muted" />
            <Skeleton className="lg:col-span-5 h-96 rounded-2xl bg-muted" />
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const live = summary.data;

  // Real Database Numbers with strict precision
  const netWorth = Number(live?.netWorthBase ?? 0);
  const liquidAssets = Number(live?.liquidBalanceBase ?? 0);
  const investedAssets = Number(live?.investmentValueBase ?? 0);
  const totalDebts = Number(live?.liabilityBalanceBase ?? 0);
  const grossAssets = Math.max(0, liquidAssets + investedAssets);
  const currency = live?.workspace?.baseCurrency || "EGP";
  const workspaceName = live?.workspace?.name || "FAMILY";

  const accountsList = accounts.data ?? live?.accounts ?? [];
  const debtsList = debts.data ?? [];
  const firstAccount = accountsList.length > 0 ? accountsList[0] : null;

  // Solvency & Liquidity Ratios
  const liquiditySharePct = grossAssets > 0 ? Math.round((liquidAssets / grossAssets) * 100) : 0;
  const investmentSharePct = grossAssets > 0 ? Math.round((investedAssets / grossAssets) * 100) : 0;
  const debtToAssetPct = grossAssets > 0 ? Math.round((totalDebts / grossAssets) * 100) : 0;

  // Live Gold / FX Telemetry
  const gold24k = Number((goldFeed.data as any)?.gram24kEgp || (goldFeed.data as any)?.karat24 || 0);
  const gold21k = Number((goldFeed.data as any)?.gram21kEgp || (goldFeed.data as any)?.karat21 || 0);
  const usdEgp = Number((goldFeed.data as any)?.usdEgpRate || (goldFeed.data as any)?.usdToEgp || 0);

  // Nearest debt calculation
  const nearestDebt = debtsList.find((d: any) => d.paymentDay || d.maturityDate);
  const nearestDueText = nearestDebt
    ? `أقرب استحقاق: يوم ${nearestDebt.paymentDay || "25"} من الشهر`
    : debtsList.length > 0
    ? `${debtsList.length} التزامات وبطاقات نشطة`
    : "خزينة خالية من المديونيات";

  // Quick Wealth Distribution calculation
  const wealthBreakdown = (() => {
    const portfolioList = live?.portfolio ?? [];

    // 1. Bullion & Gold
    const goldFromPortfolio = portfolioList
      .filter(
        (p: any) =>
          p.assetClass === "gold" ||
          p.instrumentType === "gold" ||
          p.instrumentName?.toLowerCase().includes("ذهب") ||
          p.instrumentName?.toLowerCase().includes("gold") ||
          p.symbol?.toLowerCase().includes("azg")
      )
      .reduce((sum: number, p: any) => sum + Number(p.baseMarketValue || 0), 0);
    const goldVal = goldFromPortfolio;

    // 2. Bank Accounts
    const bankFromAccounts = accountsList
      .filter((a: any) => a.accountType === "bank")
      .reduce((sum: number, a: any) => sum + Number(a.baseValue ?? a.balance ?? 0), 0);
    const bankVal = bankFromAccounts;

    // 3. E-Wallets & Cash
    const walletFromAccounts = accountsList
      .filter((a: any) => ["wallet", "cash"].includes(a.accountType))
      .reduce((sum: number, a: any) => sum + Number(a.baseValue ?? a.balance ?? 0), 0);
    const walletVal =
      walletFromAccounts > 0 ? walletFromAccounts : Math.max(0, liquidAssets - bankVal);

    // 4. Stocks & Securities
    const stocksVal = Math.max(0, investedAssets - goldVal);

    const totalAssetsSum = goldVal + bankVal + walletVal + stocksVal || 1;

    const calcPct = (val: number) => {
      const p = (val / totalAssetsSum) * 100;
      if (p <= 0) return { num: 0, text: "0%" };
      if (p < 1) return { num: Math.max(3, p), text: `${p.toFixed(1)}%` };
      return { num: Math.round(p), text: `${Math.round(p)}%` };
    };

    const goldPct = calcPct(goldVal);
    const bankPct = calcPct(bankVal);
    const walletPct = calcPct(walletVal);
    const stocksPct = calcPct(stocksVal);

    return [
      {
        id: "gold",
        title: "الذهب والسبائك السيادية",
        subtitle: "صناديق التحوط والسبائك الذهبية",
        value: goldVal,
        percentage: goldPct.text,
        barWidth: goldPct.num,
        icon: Coins,
        color: "text-amber-600 dark:text-amber-400",
        bg: "bg-amber-500/12 border-amber-500/25",
        barColor: "bg-amber-500",
        href: "/investments",
      },
      {
        id: "banks",
        title: "الخزانة المصرفية والبنوك",
        subtitle: "حسابات جارية وتوفير وعوائد",
        value: bankVal,
        percentage: bankPct.text,
        barWidth: bankPct.num,
        icon: Building2,
        color: "text-emerald-600 dark:text-emerald-400",
        bg: "bg-emerald-500/12 border-emerald-500/25",
        barColor: "bg-emerald-500",
        href: "/banking",
      },
      {
        id: "wallets",
        title: "المحافظ الرقمية والنقدية",
        subtitle: "إنستاباي ومحافظ فورية وكاش",
        value: walletVal,
        percentage: walletPct.text,
        barWidth: walletPct.num,
        icon: Smartphone,
        color: "text-sky-600 dark:text-sky-400",
        bg: "bg-sky-500/12 border-sky-500/25",
        barColor: "bg-sky-500",
        href: "/banking",
      },
      {
        id: "stocks",
        title: "الأسهم وصناديق الاستثمار",
        subtitle: "الأوراق المالية وصناديق العائد",
        value: stocksVal,
        percentage: stocksPct.text,
        barWidth: stocksPct.num,
        icon: TrendingUp,
        color: "text-teal-600 dark:text-teal-400",
        bg: "bg-teal-500/12 border-teal-500/25",
        barColor: "bg-teal-500",
        href: "/investments",
      },
    ];
  })();

  // Recent 5 transactions mapping
  const recentEvents = (
    live?.recentEvents && live.recentEvents.length > 0 ? live.recentEvents.slice(0, 6) : []
  ).map((e: any) => {
    const isOut = ["expense", "buy", "withdrawal", "debt_payment"].includes(e.eventType);
    const isTransfer = e.eventType === "transfer";
    const dateFormatted = e.occurredAt
      ? new Date(e.occurredAt).toLocaleDateString("ar-EG", {
          month: "short",
          day: "numeric",
        })
      : "اليوم";

    const badgeLabel =
      e.eventType === "buy"
        ? "استثمار مباشر"
        : e.eventType === "sell"
        ? "بيع وتسييل"
        : e.eventType === "dividend"
        ? "توزيع أرباح"
        : e.eventType === "debt_payment"
        ? "سداد دين"
        : e.eventType === "deposit" || e.eventType === "income"
        ? "إيداع / إيراد"
        : isTransfer
        ? "تحويل داخلي"
        : "مصروف تشغيلي";

    return {
      id: String(e.id),
      title: e.notes || e.description || `عملية ${badgeLabel}`,
      badge: badgeLabel,
      amount: Number(e.grossAmount || e.amount || 0),
      currency: e.currency || currency,
      date: dateFormatted,
      isOutflow: isOut,
      isTransfer,
    };
  });

  const handleOpenReconcile = (acc?: any) => {
    const target = acc || firstAccount;
    if (target) {
      setReconciliationAccount({
        id: target.id,
        name: target.name,
        value: target.baseValue ?? target.balance,
        currency: target.currency,
      });
    } else {
      setReconciliationAccount(null);
    }
    setReconciliationOpen(true);
  };

  const handleOpenDebtPayment = (debtId?: number) => {
    setSelectedDebtId(debtId ?? (debtsList.length > 0 ? debtsList[0].id : null));
    setDebtPaymentOpen(true);
  };

  return (
    <DashboardLayout>
      <div className="w-full max-w-7xl mx-auto space-y-6 p-3 sm:p-5 lg:p-6" dir="rtl">
        {/* ========================================================================= */}
        {/* SOVEREIGN TREASURY COMMAND DECK (منصة القيادة السيادية للثروة) */}
        {/* ========================================================================= */}
        <section className="relative overflow-hidden rounded-3xl border border-slate-200/90 dark:border-emerald-500/25 bg-gradient-to-br from-[#0B1322] via-[#0F1B30] to-[#0A2229] text-white p-5 sm:p-7 shadow-[0_20px_50px_rgba(6,20,35,0.28)] dark:shadow-[0_24px_60px_rgba(0,0,0,0.6)]">
          {/* Subtle Architectural Ambient Glows */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-28 -left-24 size-80 rounded-full bg-emerald-500/12 blur-3xl"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-32 right-1/4 size-72 rounded-full bg-amber-500/8 blur-3xl"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-l from-emerald-400/80 via-amber-300/40 to-transparent"
          />

          <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            {/* Right Column: Greeting, Sovereign Net Worth & Telemetry */}
            <div className="space-y-3 max-w-2xl">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-400/30">
                  <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
                  خزينة العائلة السيادية · {workspaceName}
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono font-bold bg-white/8 text-slate-200 border border-white/12">
                  <ShieldCheck className="size-3.5 text-emerald-400" />
                  دفتر القيد المزدوج نشط ({currency})
                </span>
              </div>

              <div>
                <p className="text-xs sm:text-sm text-slate-300 font-medium">
                  مرحباً بك، <strong className="text-white font-bold">{user?.name || "العضو الرئيسي"}</strong> — صافي الثروة المجمعة المعتمدة
                </p>
                <div className="mt-1.5 flex flex-wrap items-baseline gap-3">
                  <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white font-mono tabular-nums">
                    <SensitiveValue>{formatEGP(netWorth)}</SensitiveValue>
                  </h1>
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                    <TrendingUp className="size-3.5" />
                    ملاءة مالية {100 - Math.min(100, debtToAssetPct)}%
                  </span>
                </div>
              </div>

              {/* Live Market & Gold Reserve Telemetry Ribbon */}
              <div className="pt-1 flex flex-wrap items-center gap-2 sm:gap-3 text-xs">
                {gold24k > 0 && (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/7 border border-white/10 text-amber-300">
                    <Coins className="size-3.5 text-amber-400" />
                    <span className="text-slate-300">ذهب 24K:</span>
                    <strong className="font-mono tabular-nums text-white">
                      {Math.round(gold24k).toLocaleString("en-US")} ج.م
                    </strong>
                  </div>
                )}
                {gold21k > 0 && (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/7 border border-white/10 text-amber-300">
                    <Sparkles className="size-3.5 text-amber-400" />
                    <span className="text-slate-300">ذهب 21K:</span>
                    <strong className="font-mono tabular-nums text-white">
                      {Math.round(gold21k).toLocaleString("en-US")} ج.م
                    </strong>
                  </div>
                )}
                {usdEgp > 0 && (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/7 border border-white/10 text-emerald-300">
                    <Activity className="size-3.5 text-emerald-400" />
                    <span className="text-slate-300">USD/EGP:</span>
                    <strong className="font-mono tabular-nums text-white">
                      {usdEgp.toFixed(2)}
                    </strong>
                  </div>
                )}
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/7 border border-white/10 text-sky-300">
                  <Landmark className="size-3.5 text-sky-400" />
                  <span className="text-slate-300">الحسابات النشطة:</span>
                  <strong className="font-mono tabular-nums text-white">
                    {accountsList.length}
                  </strong>
                </div>
              </div>
            </div>

            {/* Left Column: Instant Command Triggers */}
            <div className="flex flex-col sm:flex-row lg:flex-col xl:flex-row items-stretch sm:items-center gap-2.5 shrink-0">
              <Button
                onClick={() => setQuickEntryOpen(true)}
                className="bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-slate-950 font-extrabold h-11 px-5 text-xs gap-2 rounded-xl shadow-[0_10px_25px_rgba(16,185,129,0.35)] transition-all cursor-pointer"
              >
                <PlusCircle className="size-4 stroke-[2.5]" />
                <span>تسجيل قيد سريع</span>
              </Button>

              <Button
                onClick={() => setReceiptOcrOpen(true)}
                className="bg-white/10 hover:bg-white/18 text-white border border-white/18 font-bold h-11 px-4 text-xs gap-2 rounded-xl backdrop-blur-md transition-all cursor-pointer"
              >
                <Receipt className="size-4 text-emerald-400" />
                <span>مسح إيصال OCR</span>
              </Button>

              <div className="flex items-center gap-2">
                <Button
                  onClick={() => handleOpenReconcile()}
                  className="flex-1 bg-white/8 hover:bg-white/15 text-slate-100 border border-white/14 font-bold h-11 px-3.5 text-xs gap-1.5 rounded-xl transition-all cursor-pointer"
                >
                  <ArrowLeftRight className="size-3.5 text-sky-400" />
                  <span>تسوية رصيد</span>
                </Button>

                <Button
                  onClick={() => handleOpenDebtPayment()}
                  className="flex-1 bg-rose-500/15 hover:bg-rose-500/25 text-rose-200 border border-rose-400/30 font-bold h-11 px-3.5 text-xs gap-1.5 rounded-xl transition-all cursor-pointer"
                >
                  <CreditCard className="size-3.5 text-rose-400" />
                  <span>سداد التزام</span>
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* 4 ARCHITECTURAL WEALTH PILLARS (الأعمدة الأربعة للمركز المالي) */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Pillar 1: إجمالي الأصول المجمعة */}
          <Card
            onClick={() => setLocation("/wealth-health")}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === "Enter" && setLocation("/wealth-health")}
            className="relative overflow-hidden border border-slate-200/90 dark:border-slate-800/90 bg-white dark:bg-[#111827] p-5 rounded-2xl hover:border-emerald-500/50 hover:-translate-y-0.5 transition-all cursor-pointer group"
          >
            <div className="pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-gradient-to-l from-emerald-500 to-teal-400" />
            <div className="flex items-center justify-between pb-3">
              <span className="text-xs font-extrabold text-slate-500 dark:text-slate-400">
                إجمالي الأصول (Gross Assets)
              </span>
              <div className="size-10 rounded-xl bg-emerald-500/12 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25 flex items-center justify-center group-hover:scale-105 transition-transform">
                <Scale className="size-4.5" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white font-mono tracking-tight tabular-nums">
              <SensitiveValue>{formatEGP(grossAssets)}</SensitiveValue>
            </div>
            <div className="mt-3 flex items-center justify-between text-[11px] font-bold">
              <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <ShieldCheck className="size-3.5" />
                مؤشر صحة الثروة
              </span>
              <span className="font-mono text-slate-500 dark:text-slate-400">100%</span>
            </div>
          </Card>

          {/* Pillar 2: السيولة النقدية والكاش المتاح */}
          <Card
            onClick={() => setLocation("/banking")}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === "Enter" && setLocation("/banking")}
            className="relative overflow-hidden border border-slate-200/90 dark:border-slate-800/90 bg-white dark:bg-[#111827] p-5 rounded-2xl hover:border-sky-500/50 hover:-translate-y-0.5 transition-all cursor-pointer group"
          >
            <div className="pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-gradient-to-l from-sky-500 to-cyan-400" />
            <div className="flex items-center justify-between pb-3">
              <span className="text-xs font-extrabold text-slate-500 dark:text-slate-400">
                السيولة النقدية الحرة (Liquid Cash)
              </span>
              <div className="size-10 rounded-xl bg-sky-500/12 text-sky-600 dark:text-sky-400 border border-sky-500/25 flex items-center justify-center group-hover:scale-105 transition-transform">
                <Wallet className="size-4.5" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-sky-600 dark:text-sky-400 font-mono tracking-tight tabular-nums">
              <SensitiveValue>{formatEGP(liquidAssets)}</SensitiveValue>
            </div>
            <div className="mt-3 flex items-center justify-between text-[11px] font-bold">
              <span className="text-slate-600 dark:text-slate-300 flex items-center gap-1">
                <CheckCircle2 className="size-3.5 text-sky-500" />
                {accountsList.length} حسابات ومحافظ
              </span>
              <span className="font-mono px-2 py-0.5 rounded bg-sky-500/10 text-sky-700 dark:text-sky-300">
                {liquiditySharePct}% من الأصول
              </span>
            </div>
          </Card>

          {/* Pillar 3: المحفظة الاستثمارية والذهب */}
          <Card
            onClick={() => setLocation("/investments")}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === "Enter" && setLocation("/investments")}
            className="relative overflow-hidden border border-slate-200/90 dark:border-slate-800/90 bg-white dark:bg-[#111827] p-5 rounded-2xl hover:border-amber-500/50 hover:-translate-y-0.5 transition-all cursor-pointer group"
          >
            <div className="pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-gradient-to-l from-amber-500 to-yellow-400" />
            <div className="flex items-center justify-between pb-3">
              <span className="text-xs font-extrabold text-slate-500 dark:text-slate-400">
                المحفظة والاحتياطي الذهبي
              </span>
              <div className="size-10 rounded-xl bg-amber-500/12 text-amber-600 dark:text-amber-400 border border-amber-500/25 flex items-center justify-center group-hover:scale-105 transition-transform">
                <Coins className="size-4.5" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-amber-600 dark:text-amber-400 font-mono tracking-tight tabular-nums">
              <SensitiveValue>{formatEGP(investedAssets)}</SensitiveValue>
            </div>
            <div className="mt-3 flex items-center justify-between text-[11px] font-bold">
              <span className="text-slate-600 dark:text-slate-300 flex items-center gap-1">
                <TrendingUp className="size-3.5 text-amber-500" />
                أسهم وصناديق وسبائك
              </span>
              <span className="font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-700 dark:text-amber-300">
                {investmentSharePct}% من الأصول
              </span>
            </div>
          </Card>

          {/* Pillar 4: الالتزامات والديون المستحقة */}
          <Card
            onClick={() => setLocation("/banking?tab=debts")}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === "Enter" && setLocation("/banking?tab=debts")}
            className="relative overflow-hidden border border-slate-200/90 dark:border-slate-800/90 bg-white dark:bg-[#111827] p-5 rounded-2xl hover:border-rose-500/50 hover:-translate-y-0.5 transition-all cursor-pointer group"
          >
            <div className="pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-gradient-to-l from-rose-500 to-pink-500" />
            <div className="flex items-center justify-between pb-3">
              <span className="text-xs font-extrabold text-slate-500 dark:text-slate-400">
                الالتزامات والائتمان (Liabilities)
              </span>
              <div className="size-10 rounded-xl bg-rose-500/12 text-rose-600 dark:text-rose-400 border border-rose-500/25 flex items-center justify-center group-hover:scale-105 transition-transform">
                <CreditCard className="size-4.5" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-rose-600 dark:text-rose-400 font-mono tracking-tight tabular-nums">
              <SensitiveValue>{formatEGP(totalDebts)}</SensitiveValue>
            </div>
            <div className="mt-3 flex items-center justify-between text-[11px] font-bold">
              <span className="text-rose-700 dark:text-rose-300 flex items-center gap-1 truncate">
                <Calendar className="size-3.5 text-rose-500 shrink-0" />
                <span className="truncate">{nearestDueText}</span>
              </span>
              <span className="font-mono px-2 py-0.5 rounded bg-rose-500/10 text-rose-700 dark:text-rose-300 shrink-0">
                {debtToAssetPct}% عبء
              </span>
            </div>
          </Card>
        </div>

        {/* ========================================================================= */}
        {/* SOVEREIGN ASSET MATRIX & STACKED ALLOCATION BAR (مصفوفة توزيع الثروة) */}
        {/* ========================================================================= */}
        <Card className="border border-slate-200/90 dark:border-slate-800/90 bg-white dark:bg-[#111827] rounded-2xl overflow-hidden">
          <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-200/80 dark:border-slate-800/80 px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-500/12 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25">
                <ShieldCheck className="size-5" />
              </div>
              <div>
                <CardTitle className="text-base font-extrabold text-slate-900 dark:text-white">
                  هيكل توزيع الثروة والأصول السيادية
                </CardTitle>
                <CardDescription className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
                  تحليل تركز رأس المال عبر الذهب، الخزانة المصرفية، المحافظ الفورية، والأوراق المالية
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setLocation("/banking")}
                className="h-8 text-xs font-bold border-slate-200 dark:border-slate-700 bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl cursor-pointer"
              >
                <span>بوابة البنوك</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setLocation("/investments")}
                className="h-8 text-xs font-bold border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20 rounded-xl gap-1 cursor-pointer"
              >
                <span>إدارة المحفظة</span>
                <ChevronLeft className="size-3.5" />
              </Button>
            </div>
          </CardHeader>

          <CardContent className="p-5 space-y-5">
            {/* Multi-Segment Stacked Allocation Bar */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-600 dark:text-slate-400">
                <span>شريط التوزيع النسبي لإجمالي الأصول</span>
                <span className="font-mono tabular-nums text-slate-900 dark:text-white">
                  <SensitiveValue>{formatEGP(grossAssets)}</SensitiveValue>
                </span>
              </div>
              <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-[#0B0F17] p-0.5 gap-1 border border-slate-200/70 dark:border-slate-800">
                {wealthBreakdown.map((item) => (
                  <div
                    key={item.id}
                    className={`h-full ${item.barColor} first:rounded-r-full last:rounded-l-full transition-all duration-500`}
                    style={{ width: `${Math.max(4, item.barWidth)}%` }}
                    title={`${item.title}: ${item.percentage}`}
                  />
                ))}
              </div>
            </div>

            {/* 4 Asset Class Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {wealthBreakdown.map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.id}
                    onClick={() => setLocation(item.href)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === "Enter" && setLocation(item.href)}
                    className="p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800/90 bg-slate-50/70 dark:bg-[#0B0F17]/70 hover:bg-white dark:hover:bg-[#162032] hover:border-emerald-500/40 transition-all cursor-pointer group"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`size-9 rounded-xl ${item.bg} border flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform`}
                        >
                          <Icon className={`size-4.5 ${item.color}`} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-extrabold text-slate-900 dark:text-white truncate group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                            {item.title}
                          </p>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                            {item.subtitle}
                          </p>
                        </div>
                      </div>
                      <span className="text-xs font-black font-mono tabular-nums px-2 py-0.5 rounded-lg bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white shrink-0">
                        {item.percentage}
                      </span>
                    </div>

                    <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800/80 flex items-baseline justify-between">
                      <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                        القيمة المقومة
                      </span>
                      <div className="text-base font-black font-mono tabular-nums text-slate-900 dark:text-white">
                        <SensitiveValue>{formatEGP(item.value)}</SensitiveValue>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Active Accounts Quick Strip (if accounts exist) */}
            {accountsList.length > 0 && (
              <div className="pt-3 border-t border-slate-200/80 dark:border-slate-800/80">
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-xs font-extrabold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Landmark className="size-3.5 text-emerald-500" />
                    أرصدة الحسابات البنكية والمحافظ المباشرة ({accountsList.length})
                  </span>
                  <button
                    type="button"
                    onClick={() => setLocation("/banking")}
                    className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                  >
                    إدارة جميع الحسابات ←
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                  {accountsList.slice(0, 4).map((acc: any) => (
                    <div
                      key={acc.id}
                      onClick={() => handleOpenReconcile(acc)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => e.key === "Enter" && handleOpenReconcile(acc)}
                      className="flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#0B0F17]/90 hover:border-emerald-500/40 transition-all cursor-pointer"
                      title="انقر لتسوية رصيد هذا الحساب"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          {acc.name}
                        </p>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                          {acc.institution || acc.accountType} · {acc.currency}
                        </p>
                      </div>
                      <strong className="text-xs font-extrabold font-mono tabular-nums text-emerald-600 dark:text-emerald-400 shrink-0">
                        <SensitiveValue>
                          {formatEGP(acc.baseValue ?? acc.balance ?? 0)}
                        </SensitiveValue>
                      </strong>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ========================================================================= */}
        {/* CASH FLOW TRAJECTORY & EXECUTIVE LEDGER FEED */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Main Chart Column: 7 cols */}
          <div className="lg:col-span-7">
            <FinancialOverviewCard netWorth={netWorth} currency={currency} />
          </div>

          {/* Activity Column (Latest Transactions): 5 cols */}
          <div className="lg:col-span-5">
            <Card className="relative overflow-hidden border border-slate-200/90 dark:border-slate-800/90 bg-white dark:bg-[#111827] rounded-2xl">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-l from-emerald-500/60 via-amber-500/20 to-transparent"
              />
              <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-slate-200/80 dark:border-slate-800/80 px-5 py-4">
                <div>
                  <CardTitle className="text-base font-extrabold text-slate-900 dark:text-white">
                    سجل القيود والحركات الفورية
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
                    أحدث القيود المرحلة في دفتر الأستاذ المزدوج
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setLocation("/transactions")}
                  className="h-8 text-xs font-bold border-slate-200 dark:border-slate-700 bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-900 dark:text-white cursor-pointer px-3 rounded-xl gap-1"
                >
                  <span>كل القيود</span>
                  <ChevronLeft className="size-3.5" />
                </Button>
              </CardHeader>

              <CardContent className="p-3.5 divide-y divide-slate-200/70 dark:divide-slate-800/80">
                {recentEvents.length === 0 ? (
                  <div className="py-12 px-4 text-center space-y-3">
                    <div className="mx-auto size-11 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 flex items-center justify-center">
                      <ArrowLeftRight className="size-5" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        لا توجد معاملات مسجلة حتى الآن
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                        ابدأ بتسجيل أول قيد مالي أو مسح إيصال إنستاباي ليظهر فوراً في الدفتر
                      </p>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => setQuickEntryOpen(true)}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl h-8 px-3.5 cursor-pointer"
                    >
                      <PlusCircle className="size-3.5 ml-1.5" />
                      تسجيل أول معاملة
                    </Button>
                  </div>
                ) : (
                  recentEvents.map((tx) => {
                    const amountNum = Math.abs(Number(tx.amount));
                    return (
                      <div
                        key={tx.id}
                        className="py-3 px-2.5 flex items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-[#162032] rounded-xl transition-colors group"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`size-9 rounded-xl flex items-center justify-center shrink-0 border ${
                              tx.isTransfer
                                ? "bg-sky-500/12 text-sky-600 dark:text-sky-400 border-sky-500/25"
                                : tx.isOutflow
                                ? "bg-rose-500/12 text-rose-600 dark:text-rose-400 border-rose-500/25"
                                : "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400 border-emerald-500/25"
                            }`}
                          >
                            {tx.isTransfer ? (
                              <ArrowLeftRight className="size-4" />
                            ) : tx.isOutflow ? (
                              <ArrowUpRight className="size-4" />
                            ) : (
                              <ArrowDownLeft className="size-4" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-extrabold text-slate-900 dark:text-white truncate group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                              {tx.title}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                                {tx.badge}
                              </span>
                              <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                                {tx.date}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="text-left shrink-0">
                          <span
                            className={`text-xs font-black font-mono tabular-nums ${
                              tx.isOutflow
                                ? "text-rose-600 dark:text-rose-400"
                                : tx.isTransfer
                                ? "text-slate-900 dark:text-white"
                                : "text-emerald-600 dark:text-emerald-400"
                            }`}
                          >
                            <SensitiveValue>
                              {tx.isOutflow ? "- " : tx.isTransfer ? "" : "+ "}
                              {formatEGP(amountNum)}
                            </SensitiveValue>
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}

                <div className="pt-3 pb-1 px-2">
                  <Button
                    variant="ghost"
                    onClick={() => setLocation("/transactions")}
                    className="w-full text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 h-9 gap-1.5 rounded-xl cursor-pointer"
                  >
                    <span>فتح دفتر الأستاذ وسجل العمليات الكامل</span>
                    <ArrowRight className="size-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Operational Modals */}
        <ReconciliationModal
          open={reconciliationOpen}
          onOpenChange={setReconciliationOpen}
          account={reconciliationAccount}
          defaultCurrency={currency}
        />

        <DebtPaymentModal
          open={debtPaymentOpen}
          onOpenChange={setDebtPaymentOpen}
          debtId={selectedDebtId}
          debtsList={debtsList}
          accountsList={accountsList}
          defaultCurrency={currency}
        />

        <QuickOfflineTransactionModal
          open={quickEntryOpen}
          onOpenChange={setQuickEntryOpen}
        />

        <SmartReceiptPasteModal
          open={receiptOcrOpen}
          onOpenChange={setReceiptOcrOpen}
        />
      </div>
    </DashboardLayout>
  );
}
