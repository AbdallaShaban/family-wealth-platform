import { useAuth } from "@/_core/hooks/useAuth";
import { useDemoMode } from "@/contexts/DemoModeContext";
import { trpc } from "@/lib/trpc";
import { demoDashboard, getDashboardPreviewMode } from "@/lib/demoDashboard";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import SensitiveValue from "@/components/SensitiveValue";
import { formatMoney, formatDateTime } from "@/lib/financialDisplay";
import { Input } from "@/components/ui/input";
import {
  CreditCard,
  DollarSign,
  Landmark,
  Plus,
  Search,
  Smartphone,
  TrendingUp,
  Wallet,
  ArrowUpRight,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import ReconciliationModal from "@/components/modals/ReconciliationModal";
import DebtPaymentModal from "@/components/modals/DebtPaymentModal";
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
  const { isDemoMode } = useDemoMode();
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [wizardOpen, setWizardOpen] = useState(false);

  // tRPC Queries
  const summary = trpc.family.dashboard.useQuery();
  const debts = trpc.family.debts.list.useQuery();
  const creditCards = trpc.family.creditCards.list.useQuery(undefined, { enabled: !isDemoMode });

  // Interactive Modals
  const [reconcileModalOpen, setReconcileModalOpen] = useState(false);
  const [selectedAccountForReconcile, setSelectedAccountForReconcile] = useState<any>(null);
  const [debtPaymentModalOpen, setDebtPaymentModalOpen] = useState(false);
  const [selectedDebtId, setSelectedDebtId] = useState<number | null>(null);

  const openReconcileModal = (account: any) => {
    setSelectedAccountForReconcile(account);
    setReconcileModalOpen(true);
  };

  const openDebtPaymentModal = (debtId?: number) => {
    const activeList = (debts.data ?? []).filter((d) => d.status === "active");
    setSelectedDebtId(debtId || activeList[0]?.id || null);
    setDebtPaymentModalOpen(true);
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

  if (summary.isLoading && !isDemoMode) {
    return (
      <DashboardLayout>
        <div className="flex-1 space-y-6 p-4 sm:p-6 md:p-8" dir="rtl">
          <div className="flex items-center justify-between">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-10 w-36" />
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-32 rounded-xl" />
            ))}
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <Skeleton className="h-72 rounded-xl" />
            <Skeleton className="h-72 rounded-xl" />
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="flex-1 space-y-6 p-4 sm:p-6 md:p-8" dir="rtl">
        {/* ========================================================================= */}
        {/* 1. TOP HEADER & QUICK ACTION BAR (FINTECH OPEN-SOURCE TEMPLATE)          */}
        {/* ========================================================================= */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-border/60">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Badge
                variant="outline"
                className="gap-1.5 py-0.5 px-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25 font-semibold text-xs"
              >
                <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                {usingDemo ? "معاينة تجريبية" : "مساحة العمل المباشرة"}
              </Badge>
              <span className="text-xs text-muted-foreground font-mono">
                {live?.workspace.name || "FAMILY"} — {user?.name || "Abdalla Shaban"} ({currency})
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
              مرحباً، {user?.name?.split(" ")[0] || "Abdalla"}
            </h1>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2.5">
            <Button
              onClick={() => setLocation("/transactions?action=new")}
              className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-md shadow-emerald-600/20"
            >
              <Plus className="size-4" />
              <span>تسجيل عملية جديدة</span>
            </Button>
            <Button
              variant="outline"
              onClick={() => setLocation("/banking")}
              className="gap-1.5 font-semibold text-xs border-border/80 hidden md:inline-flex"
            >
              <Landmark className="size-3.5" />
              <span>الحسابات</span>
            </Button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 2. TOP ROW: 4 CLEAN BANKING METRIC CARDS (SHADCN FINTECH CARDS)          */}
        {/* ========================================================================= */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {/* Card 1: Net Worth */}
          <Card className="border border-border/60 bg-card/60 backdrop-blur-md shadow-xs hover:border-border transition-all">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-muted-foreground">صافي الثروة المجمعة</span>
                <div className="size-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-500/20">
                  <Landmark className="size-4" />
                </div>
              </div>
              <div className="mt-3">
                <h3 className="text-2xl font-extrabold tracking-tight text-foreground tabular-nums">
                  <SensitiveValue>{formatMoney(netWorth, currency)}</SensitiveValue>
                </h3>
                <div className="flex items-center gap-1.5 mt-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  <TrendingUp className="size-3.5" />
                  <span>+38.5% عن الإغلاق السابق</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Card 2: Liquid Cash */}
          <Card className="border border-border/60 bg-card/60 backdrop-blur-md shadow-xs hover:border-border transition-all">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-muted-foreground">السيولة النقدية المتاحة</span>
                <div className="size-9 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center border border-sky-500/20">
                  <Wallet className="size-4" />
                </div>
              </div>
              <div className="mt-3">
                <h3 className="text-2xl font-extrabold tracking-tight text-foreground tabular-nums">
                  <SensitiveValue>{formatMoney(liquidBalance, currency)}</SensitiveValue>
                </h3>
                <p className="text-xs text-muted-foreground mt-2 font-medium">
                  {accounts.length} حسابات مصرفية ونقدية جارية
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Card 3: Investments */}
          <Card className="border border-border/60 bg-card/60 backdrop-blur-md shadow-xs hover:border-border transition-all">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-muted-foreground">إجمالي الاستثمارات</span>
                <div className="size-9 rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-400 flex items-center justify-center border border-violet-500/20">
                  <TrendingUp className="size-4" />
                </div>
              </div>
              <div className="mt-3">
                <h3 className="text-2xl font-extrabold tracking-tight text-foreground tabular-nums">
                  <SensitiveValue>{formatMoney(investments, currency)}</SensitiveValue>
                </h3>
                <p className="text-xs text-muted-foreground mt-2 font-medium">
                  أرباح غير محققة:{" "}
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                    <SensitiveValue>{formatMoney(pnl, currency)}</SensitiveValue>
                  </span>
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Card 4: Liabilities */}
          <Card className="border border-border/60 bg-card/60 backdrop-blur-md shadow-xs hover:border-border transition-all">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-muted-foreground">الالتزامات والديون</span>
                <div className="size-9 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center border border-rose-500/20">
                  <CreditCard className="size-4" />
                </div>
              </div>
              <div className="mt-3">
                <h3 className="text-2xl font-extrabold tracking-tight text-foreground tabular-nums">
                  <SensitiveValue>{formatMoney(liabilities, currency)}</SensitiveValue>
                </h3>
                <p className="text-xs text-rose-600 dark:text-rose-400 mt-2 font-semibold">
                  {debtItems.length} التزامات نشطة
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ========================================================================= */}
        {/* 3. MIDDLE SECTION: FINANCIAL OVERVIEW & MONEY MOVEMENT (CHARTS)           */}
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
        {/* 4. LOWER SECTION: RECENT TRANSACTIONS TABLE & ACTIVE BANK CARDS           */}
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
      <OnboardingWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        workspaceName={live?.workspace.name || "FAMILY"}
        baseCurrency={currency}
      />
    </DashboardLayout>
  );
}
