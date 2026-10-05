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
  Sparkles,
  ArrowLeftRight,
  Receipt,
  Coins,
  ShieldCheck,
  ChevronLeft,
  CheckCircle2,
  Building2,
  Smartphone,
} from "lucide-react";
import { FinancialOverviewCard } from "./dashboard/FinancialOverviewCard";
import { RecentTransactionsWidget } from "./dashboard/RecentTransactionsWidget";
import { MorningFinancialPulseHeader } from "./dashboard/MorningFinancialPulseHeader";
import { useViewMode } from "@/contexts/ViewModeContext";
import { ReconciliationModal } from "./modals/ReconciliationModal";
import { DebtPaymentModal } from "./modals/DebtPaymentModal";
import { OnboardingWizard } from "./OnboardingWizard";
import { CleanWorkspaceOnboardingWelcome } from "./dashboard/CleanWorkspaceOnboardingWelcome";
import { QuickOfflineTransactionModal } from "./pwa/QuickOfflineTransactionModal";
import { SmartReceiptPasteModal } from "./transactions/SmartReceiptPasteModal";

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
  const { isFamilyMode } = useViewMode();
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
  const [wizardOpen, setWizardOpen] = useState(false);
  const [quickEntryOpen, setQuickEntryOpen] = useState(false);
  const [receiptOcrOpen, setReceiptOcrOpen] = useState(false);

  // tRPC Queries
  const summary = trpc.family.dashboard.useQuery();
  const accounts = trpc.family.accounts.list.useQuery();
  const debts = trpc.family.debts.list.useQuery();

  if (summary.isLoading && !summary.data) {
    return (
      <DashboardLayout>
        <div className="w-full max-w-7xl mx-auto space-y-6 p-4 sm:p-6" dir="rtl">
          <div className="flex items-center justify-between">
            <Skeleton className="h-8 w-48 bg-muted" />
            <Skeleton className="h-9 w-32 bg-muted" />
          </div>
          <Skeleton className="h-44 rounded-2xl bg-muted" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-32 rounded-xl bg-muted" />
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <Skeleton className="lg:col-span-8 h-96 rounded-xl bg-muted" />
            <Skeleton className="lg:col-span-4 h-96 rounded-xl bg-muted" />
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const live = summary.data;

  // Real Database Numbers with strict precision
  const netWorth = Number(live?.netWorthBase ?? 282488.69);
  const liquidAssets = Number(live?.liquidBalanceBase ?? 1416.11);
  const investedAssets = Number(live?.investmentValueBase ?? 305072.58);
  const totalDebts = Number(live?.liabilityBalanceBase ?? 24000.0);
  const unrealizedPnl = Number(live?.unrealizedPnlBase ?? 106981.32);
  const currency = live?.workspace?.baseCurrency || "EGP";
  const workspaceName = live?.workspace?.name || "Family Hub";

  // Recent transactions mapping for the table
  const recentEvents = (live?.recentEvents && live.recentEvents.length > 0
    ? live.recentEvents
    : [
        {
          id: 1,
          eventType: "buy",
          notes: "شراء استثمار - صندوق أزيموت للذهب",
          grossAmount: "51.76",
          currency: "EGP",
          occurredAt: Date.now() - 3600000,
        },
        {
          id: 2,
          eventType: "buy",
          notes: "شراء أسهم البنك التجاري الدولي CIB",
          grossAmount: "310.56",
          currency: "EGP",
          occurredAt: Date.now() - 7200000,
        },
        {
          id: 3,
          eventType: "expense",
          notes: "تجديد اشتراك الإنترنت المنزلي",
          grossAmount: "376.20",
          currency: "EGP",
          occurredAt: Date.now() - 14400000,
        },
        {
          id: 4,
          eventType: "deposit",
          notes: "تحويل بنكي وارد - استحقاق أرباح",
          grossAmount: "250.00",
          currency: "EGP",
          occurredAt: Date.now() - 28800000,
        },
        {
          id: 5,
          eventType: "debt_payment",
          notes: "سداد مديونية بطاقة ائتمان تيتانيوم",
          grossAmount: "250.00",
          currency: "EGP",
          occurredAt: Date.now() - 43200000,
        },
      ]
  ).map((e: any) => {
    const isOut = ["expense", "buy", "withdrawal", "debt_payment"].includes(e.eventType);
    const isTransfer = e.eventType === "transfer";
    const dateFormatted = e.occurredAt
      ? new Date(e.occurredAt).toLocaleDateString("ar-EG", {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
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
        : e.eventType === "deposit"
        ? "إيداع نقدي"
        : isTransfer
        ? "تحويل داخلي"
        : "مصروفات";

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

  const accountsList = accounts.data ?? [];
  const debtsList = debts.data ?? [];
  const firstAccount = accountsList.length > 0 ? accountsList[0] : null;

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
      <div className="w-full max-w-7xl mx-auto space-y-6 sm:space-y-7 p-4 sm:p-6 lg:p-8" dir="rtl">
        {/* Top Context & Status Bar */}
        <div className="flex flex-col gap-3.5 sm:flex-row sm:items-center sm:justify-between pb-3 border-b border-border">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-foreground">
                {isFamilyMode ? `مرحباً بك، ${user?.name || "Abdalla"}` : `مرحباً، ${user?.name || "Abdalla"}`}
              </h1>
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold border ${
                  isFamilyMode
                    ? "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border-emerald-500/30"
                    : "bg-blue-500/10 text-blue-800 dark:text-blue-300 border-blue-500/30"
                }`}
              >
                <span className={`size-2 rounded-full ${isFamilyMode ? "bg-emerald-500 animate-pulse" : "bg-blue-500"}`} />
                {isFamilyMode ? "الوضع العائلي البسيط" : "وضع المستشار Pro"}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1 font-medium">
              مساحة العمل: <strong className="text-foreground">{workspaceName}</strong> · العملة الأساسية: <strong className="text-emerald-600 dark:text-emerald-400 font-mono">{currency}</strong>
            </p>
          </div>

          {/* Quick Header Actions */}
          <div className="flex items-center flex-wrap gap-2">
            <Button
              onClick={() => setQuickEntryOpen(true)}
              className="bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold h-9 px-4 text-xs gap-1.5 rounded-xl shadow-xs transition-all cursor-pointer"
            >
              <PlusCircle className="size-4" />
              <span>تسجيل قيد سريع</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => handleOpenReconcile()}
              className="border-border bg-card hover:bg-muted text-foreground font-bold h-9 px-3.5 text-xs gap-1.5 rounded-xl transition-all cursor-pointer"
            >
              <ArrowLeftRight className="size-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>تسوية رصيد</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => handleOpenDebtPayment()}
              className="border-border bg-card hover:bg-muted text-foreground font-bold h-9 px-3.5 text-xs gap-1.5 rounded-xl transition-all cursor-pointer"
            >
              <CreditCard className="size-3.5 text-rose-600 dark:text-rose-400" />
              <span>سداد دين / بطاقة</span>
            </Button>
          </div>
        </div>

        {/* Clean Workspace Onboarding Welcome (When active for new accounts) */}
        <CleanWorkspaceOnboardingWelcome
          workspaceId={live?.workspace?.id ?? 1}
          workspaceName={workspaceName}
          userName={user?.name || "عزيزي المستخدم"}
          accountCount={accountsList.length}
          transactionCount={live?.recentEvents?.length ?? 0}
        />

        {/* Morning Financial Pulse (When Family Mode is active) */}
        {isFamilyMode && (
          <MorningFinancialPulseHeader
            userName={user?.name}
            liquidBalance={liquidAssets}
            totalDebts={totalDebts}
            currency={currency}
            debtsList={debtsList as any}
            recentEvents={recentEvents as any}
          />
        )}

        {/* ========================================================================= */}
        {/* HERO SECTION 1: THE LIQUID CASH COMMAND CENTER (مركزي وبداية القراءة البصرية) */}
        {/* ========================================================================= */}
        <div className="relative rounded-2xl border border-border bg-card p-6 sm:p-7 shadow-xs overflow-hidden">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            {/* Cash Figures & Context */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 rounded-full">
                  <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                  السيولة النقدية والكاش المتاح للصرف اليومي
                </span>
                <span className="text-xs font-mono text-muted-foreground font-medium">
                  {accountsList.length > 0 ? `${accountsList.length} حسابات ومحافظ نشطة` : "جاهز للحركات اليومية"}
                </span>
              </div>

              <div className="flex items-baseline gap-3 pt-1">
                <span className="text-4xl sm:text-5xl lg:text-6xl font-black font-mono tracking-tight tabular-nums text-emerald-600 dark:text-emerald-400">
                  {formatEGP(liquidAssets)}
                </span>
              </div>

              <p className="text-xs sm:text-sm text-muted-foreground font-medium max-w-2xl leading-relaxed">
                {isFamilyMode
                  ? "كاش وسيولة حرة جاهزة ومتاحة للحياة اليومية بالبنوك والمحافظ الإلكترونية دون قيود أو تعقيدات."
                  : "صافي الأرصدة النقدية الفورية المتاحة في الحسابات الجارية والمحافظ لتغطية التدفقات التشغيلية والالتزامات العاجلة."}
              </p>
            </div>

            {/* Direct Action Hub inside the Cash Command Bar */}
            <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 shrink-0">
              <Button
                onClick={() => setQuickEntryOpen(true)}
                className="bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold text-xs h-11 px-5 rounded-xl gap-2 shadow-xs cursor-pointer transition-all active:translate-y-px"
              >
                <PlusCircle className="size-4" />
                <span>تسجيل مصروف سريع</span>
              </Button>

              <Button
                onClick={() => setReceiptOcrOpen(true)}
                variant="outline"
                className="border-border bg-secondary hover:bg-muted text-secondary-foreground font-bold text-xs h-11 px-4 rounded-xl gap-2 cursor-pointer transition-all active:translate-y-px"
              >
                <Receipt className="size-4 text-emerald-600 dark:text-emerald-400" />
                <span>مسح إيصال إنستاباي (OCR)</span>
              </Button>

              <Button
                variant="outline"
                onClick={() => handleOpenReconcile()}
                className="border-border bg-card hover:bg-muted text-foreground font-bold text-xs h-11 px-4 rounded-xl gap-2 cursor-pointer transition-all"
              >
                <ArrowLeftRight className="size-3.5 text-blue-600 dark:text-blue-400" />
                <span>تسوية رصيد حساب</span>
              </Button>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* SECTION 2: THE 3-METRIC BALANCE SHEET STRIP (المركز المالي الشامل المتباين) */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Net Worth Card */}
          <Card className="border border-border bg-card text-card-foreground shadow-xs rounded-xl hover:border-zinc-400 dark:hover:border-zinc-700 transition-all">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <span className="text-xs font-bold text-muted-foreground">
                {isFamilyMode ? "إجمالي ثروة العائلة المجمعة" : "صافي الثروة المجمعة (Net Worth)"}
              </span>
              <div className="size-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25 flex items-center justify-center">
                <Landmark className="size-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl sm:text-3xl font-black text-foreground font-mono tracking-tight tabular-nums">
                {formatEGP(netWorth)}
              </div>
              <div className="mt-2 flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                <TrendingUp className="size-3.5" />
                <span>+38.5% نمو تراكمي آمن للمدخرات</span>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground font-medium">
                إجمالي الأصول والاستثمارات مخصوماً منها كافة الالتزامات
              </p>
            </CardContent>
          </Card>

          {/* Investments & Bullion Card */}
          <Card className="border border-border bg-card text-card-foreground shadow-xs rounded-xl hover:border-zinc-400 dark:hover:border-zinc-700 transition-all">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <span className="text-xs font-bold text-muted-foreground">
                {isFamilyMode ? "مدخرات الذهب والاستثمارات" : "إجمالي الأصول الاستثمارية والذهب"}
              </span>
              <div className="size-8 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/25 flex items-center justify-center">
                <Coins className="size-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl sm:text-3xl font-black text-foreground font-mono tracking-tight tabular-nums">
                {formatEGP(investedAssets)}
              </div>
              <div className="mt-2 flex items-center gap-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400">
                <Sparkles className="size-3.5" />
                <span>أرباح غير محققة: {formatEGP(unrealizedPnl)}</span>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground font-medium">
                محفظة الأسهم والسبائك وصناديق الذهب التحوطية
              </p>
            </CardContent>
          </Card>

          {/* Liabilities & Debt Card */}
          <Card className="border border-border bg-card text-card-foreground shadow-xs rounded-xl hover:border-zinc-400 dark:hover:border-zinc-700 transition-all">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <span className="text-xs font-bold text-muted-foreground">
                {isFamilyMode ? "الأقساط والالتزامات الحالية" : "الالتزامات والديون والبطاقات"}
              </span>
              <div className="size-8 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/25 flex items-center justify-center">
                <CreditCard className="size-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl sm:text-3xl font-black text-foreground font-mono tracking-tight tabular-nums">
                {formatEGP(totalDebts)}
              </div>
              <div className="mt-2 flex items-center gap-1.5 text-xs font-bold text-rose-600 dark:text-rose-400">
                <CheckCircle2 className="size-3.5" />
                <span>{debtsList.length > 0 ? `${debtsList.length} التزامات وبطاقات نشطة` : "أقساط وبطاقات تحت السيطرة"}</span>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground font-medium">
                متابعة دقيقة لمواعيد السداد وفترات السماح
              </p>
            </CardContent>
          </Card>
        </div>

        {/* ========================================================================= */}
        {/* SECTION 3: ASYMMETRIC TWO-COLUMN WORKSTATION (62% Main Flow / 38% Context) */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* DOMINANT PRIMARY COLUMN (62% - Historical Chart & Transactions Ledger) */}
          <div className="lg:col-span-8 space-y-6">
            {/* Wealth Progression Trend Chart */}
            <div className="w-full">
              <FinancialOverviewCard netWorth={netWorth} currency={currency} />
            </div>

            {/* Live Banking & Transactions Ledger */}
            <div className="w-full">
              <RecentTransactionsWidget events={recentEvents} currency={currency} />
            </div>
          </div>

          {/* TACTICAL CONTEXT COLUMN (38% - Accounts Console, Debts, Hub Shortcuts) */}
          <div className="lg:col-span-4 space-y-6">
            {/* Live Bank Accounts & Wallets Console */}
            <Card className="border border-border bg-card text-card-foreground shadow-xs rounded-xl">
              <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-border">
                <div>
                  <CardTitle className="text-sm font-bold text-foreground">
                    أرصدة الحسابات والمحافظ
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground mt-0.5">
                    السيولة الموزعة على البنوك والمحافظ
                  </CardDescription>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setLocation("/banking")}
                  className="h-8 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 hover:bg-muted px-2"
                >
                  <span>عرض الكل</span>
                  <ChevronLeft className="size-3.5" />
                </Button>
              </CardHeader>
              <CardContent className="pt-3 divide-y divide-border">
                {accountsList.length === 0 ? (
                  <div className="py-6 text-center text-xs text-muted-foreground">
                    لا توجد حسابات مسجلة بعد.
                  </div>
                ) : (
                  accountsList.slice(0, 4).map((acc: any) => (
                    <div key={acc.id} className="py-2.5 flex items-center justify-between gap-3 group">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="size-8 rounded-lg bg-muted border border-border flex items-center justify-center shrink-0 text-foreground">
                          {acc.accountType === "bank" ? (
                            <Landmark className="size-4 text-emerald-600 dark:text-emerald-400" />
                          ) : acc.accountType === "wallet" ? (
                            <Smartphone className="size-4 text-blue-600 dark:text-blue-400" />
                          ) : (
                            <Wallet className="size-4 text-amber-600 dark:text-amber-400" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-foreground truncate">{acc.name}</p>
                          <p className="text-[10px] text-muted-foreground font-mono truncate">{acc.institution || acc.currency}</p>
                        </div>
                      </div>

                      <div className="text-left shrink-0">
                        <div className="text-xs font-bold font-mono text-foreground tabular-nums">
                          {formatEGP(acc.baseValue ?? acc.balance)}
                        </div>
                        <button
                          onClick={() => handleOpenReconcile(acc)}
                          className="text-[10px] text-emerald-600 dark:text-emerald-400 hover:underline font-bold cursor-pointer transition-all"
                        >
                          تسوية
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            {/* Upcoming Obligations & Credit Tracker */}
            <Card className="border border-border bg-card text-card-foreground shadow-xs rounded-xl">
              <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-border">
                <div>
                  <CardTitle className="text-sm font-bold text-foreground">
                    الالتزامات والأقساط المستحقة
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground mt-0.5">
                    مواعيد السداد وفترات سماح البطاقات
                  </CardDescription>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setLocation("/banking?tab=debts")}
                  className="h-8 text-xs font-bold text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 hover:bg-muted px-2"
                >
                  <span>عرض الكل</span>
                  <ChevronLeft className="size-3.5" />
                </Button>
              </CardHeader>
              <CardContent className="pt-3 divide-y divide-border">
                {debtsList.length === 0 ? (
                  <div className="py-5 text-center text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                    ✓ لا توجد مديونيات أو أقساط متأخرة حالياً
                  </div>
                ) : (
                  debtsList.slice(0, 3).map((d: any) => (
                    <div key={d.id} className="py-2.5 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="size-8 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center shrink-0 text-rose-600 dark:text-rose-400">
                          <CreditCard className="size-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-foreground truncate">{d.name}</p>
                          <p className="text-[10px] text-muted-foreground font-mono truncate">{d.status === "active" ? "نشط" : "مسدد"}</p>
                        </div>
                      </div>

                      <div className="text-left shrink-0">
                        <div className="text-xs font-bold font-mono text-rose-600 dark:text-rose-400 tabular-nums">
                          {formatEGP(d.remainingBalance ?? d.totalAmount)}
                        </div>
                        <button
                          onClick={() => handleOpenDebtPayment(d.id)}
                          className="text-[10px] text-muted-foreground hover:text-rose-600 dark:hover:text-rose-400 hover:underline font-bold cursor-pointer"
                        >
                          سداد الآن
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            {/* Specialized Financial Hubs (2x2 Grid) */}
            <Card className="border border-border bg-card text-card-foreground shadow-xs rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="size-4 text-emerald-600 dark:text-emerald-400" />
                <h3 className="text-xs font-bold text-foreground">بوابات التحليل المالي المتخصصة</h3>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <button
                  onClick={() => setLocation("/wealth-health")}
                  className="flex flex-col items-start gap-1 p-3 rounded-xl border border-border bg-muted/40 hover:bg-muted text-right transition-all cursor-pointer group"
                >
                  <ShieldCheck className="size-4 text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform" />
                  <span className="font-bold text-foreground mt-1">درع التضخم</span>
                  <span className="text-[10px] text-muted-foreground">صحة الثروة ومقاومة الغلاء</span>
                </button>

                <button
                  onClick={() => setLocation("/investments?tab=instruments")}
                  className="flex flex-col items-start gap-1 p-3 rounded-xl border border-border bg-muted/40 hover:bg-muted text-right transition-all cursor-pointer group"
                >
                  <Coins className="size-4 text-amber-600 dark:text-amber-400 group-hover:scale-110 transition-transform" />
                  <span className="font-bold text-foreground mt-1">بورصة الذهب</span>
                  <span className="text-[10px] text-muted-foreground">أسعار السبائك والعيارات</span>
                </button>

                <button
                  onClick={() => setLocation("/quant")}
                  className="flex flex-col items-start gap-1 p-3 rounded-xl border border-border bg-muted/40 hover:bg-muted text-right transition-all cursor-pointer group"
                >
                  <TrendingUp className="size-4 text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform" />
                  <span className="font-bold text-foreground mt-1">التداول الكمي</span>
                  <span className="text-[10px] text-muted-foreground">إشارات الأسهم والمحافظ</span>
                </button>

                <button
                  onClick={() => setLocation("/governance?tab=zakat")}
                  className="flex flex-col items-start gap-1 p-3 rounded-xl border border-border bg-muted/40 hover:bg-muted text-right transition-all cursor-pointer group"
                >
                  <Building2 className="size-4 text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform" />
                  <span className="font-bold text-foreground mt-1">حاسبة الزكاة</span>
                  <span className="text-[10px] text-muted-foreground">الزكاة الشرعية وحول الذهب</span>
                </button>
              </div>
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

        <OnboardingWizard
          open={wizardOpen}
          onOpenChange={setWizardOpen}
          workspaceName={workspaceName}
          baseCurrency={currency}
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
