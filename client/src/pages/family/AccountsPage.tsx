import React, { useState, useMemo } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import {
  ArrowLeftRight,
  Building2,
  CheckCircle2,
  Landmark,
  Wallet,
  WalletCards,
  CreditCard,
  Calendar,
  LayoutGrid,
  Table as TableIcon,
  Smartphone,
  ShieldCheck,
  TrendingUp,
  Percent,
} from "lucide-react";
import { useLocation } from "wouter";
import SensitiveValue from "@/components/SensitiveValue";
import { formatMoney } from "@/lib/financialDisplay";
import { ReconciliationModal } from "@/components/modals/ReconciliationModal";
import {
  AccountType,
  accountTypeLabel,
  CreateAccountDialog,
  EmptyState,
  InlineError,
  money,
  PageLoading,
  textError,
} from "./familyShared";

export default function AccountsPage({ embedded = false }: { embedded?: boolean }) {
  const [, setLocation] = useLocation();
  const query = trpc.family.accounts.list.useQuery();
  const creditCardsQuery = trpc.family.creditCards.list.useQuery();
  const workspace = trpc.family.bootstrap.useQuery();
  const baseCurrency = workspace.data?.workspace.baseCurrency || "EGP";

  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");

  // Reconciliation modal state
  const [reconcileOpen, setReconcileOpen] = useState(false);
  const [reconcileAccount, setReconcileAccount] = useState<{
    id: number | string;
    name: string;
    value?: number | string | null;
    currency?: string | null;
  } | null>(null);

  const handleOpenReconcile = (acc: any) => {
    setReconcileAccount({
      id: acc.id,
      name: acc.name,
      value: acc.baseValue ?? acc.balance,
      currency: acc.currency,
    });
    setReconcileOpen(true);
  };

  const accounts = query.data ?? [];
  const cards = creditCardsQuery.data ?? [];
  const activeAccounts = useMemo(() => accounts.filter((a) => a.status !== "archived"), [accounts]);

  const totalLiquidity = useMemo(() => {
    return activeAccounts.reduce((sum, acc) => {
      const val = acc.baseValue !== null ? Number(acc.baseValue) : Number(acc.balance);
      return sum + (isNaN(val) ? 0 : val);
    }, 0);
  }, [activeAccounts]);

  const bankAccounts = useMemo(() => {
    return activeAccounts.filter((a) => a.accountType === "bank");
  }, [activeAccounts]);

  const totalBankBalance = useMemo(() => {
    return bankAccounts.reduce((sum, acc) => {
      const val = acc.baseValue !== null ? Number(acc.baseValue) : Number(acc.balance);
      return sum + (isNaN(val) ? 0 : val);
    }, 0);
  }, [bankAccounts]);

  const cashAccounts = useMemo(() => {
    return activeAccounts.filter((a) => ["cash", "wallet"].includes(a.accountType));
  }, [activeAccounts]);

  const totalCashBalance = useMemo(() => {
    return cashAccounts.reduce((sum, acc) => {
      const val = acc.baseValue !== null ? Number(acc.baseValue) : Number(acc.balance);
      return sum + (isNaN(val) ? 0 : val);
    }, 0);
  }, [cashAccounts]);

  // Aggregate credit card stats
  const totalCreditLimit = useMemo(() => {
    return cards.reduce((sum, c) => sum + (Number(c.creditLimit) || 0), 0);
  }, [cards]);

  const totalCreditDues = useMemo(() => {
    return cards.reduce((sum, c) => sum + (Number(c.currentBalance) || 0), 0);
  }, [cards]);

  const totalCreditAvailable = useMemo(() => {
    return Math.max(0, totalCreditLimit - totalCreditDues);
  }, [totalCreditLimit, totalCreditDues]);

  const activeCount = activeAccounts.length;

  const actionControls = (
    <div className="flex items-center gap-2">
      {/* View Mode Toggle */}
      <div className="flex items-center gap-1 bg-muted p-1 rounded-xl border border-border">
        <button
          onClick={() => setViewMode("cards")}
          className={`p-1.5 rounded-lg transition-all cursor-pointer ${
            viewMode === "cards"
              ? "bg-card text-foreground shadow-xs font-bold"
              : "text-muted-foreground hover:text-foreground"
          }`}
          title="عرض البطاقات"
        >
          <LayoutGrid className="size-4" />
        </button>
        <button
          onClick={() => setViewMode("table")}
          className={`p-1.5 rounded-lg transition-all cursor-pointer ${
            viewMode === "table"
              ? "bg-card text-foreground shadow-xs font-bold"
              : "text-muted-foreground hover:text-foreground"
          }`}
          title="عرض الجدول المحاسبي"
        >
          <TableIcon className="size-4" />
        </button>
      </div>

      <Button
        variant="outline"
        size="sm"
        onClick={() => setLocation("/transfers")}
        className="bg-card hover:bg-muted text-foreground font-semibold text-xs px-3.5 py-2 rounded-xl border border-border shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
      >
        <ArrowLeftRight className="size-3.5 text-emerald-600 dark:text-emerald-400" />
        <span>تحويل أموال</span>
      </Button>

      <CreateAccountDialog
        compact
        triggerClassName="bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold text-xs px-4 py-2 rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
      />
    </div>
  );

  const content = (
    <div dir="rtl" className="mx-auto max-w-7xl space-y-6">
      {!embedded ? (
        <PageHeader
          title="الحسابات والسيولة والبطاقات"
          description="إدارة متكاملة للحسابات البنكية الجارية والتوفير، محافظ الكاش الذكية، والبطاقات الائتمانية مع فترات السماح."
          breadcrumbs={[
            { label: "الحسابات والسيولة", href: "/banking" },
            { label: "الأرصدة والبطاقات" },
          ]}
          badge={{ text: "قيود متوازنة", variant: "institutional" }}
          icon={Landmark}
          actions={actionControls}
        />
      ) : (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-1">
          <div>
            <h2 className="text-base font-bold text-foreground">الحسابات والبطاقات النشطة</h2>
            <p className="text-xs text-muted-foreground">عرض الأرصدة المصرفية، المحافظ الذكية، وكروت الائتمان ومواعيد السداد</p>
          </div>
          {actionControls}
        </div>
      )}

      {query.isLoading ? (
        <PageLoading />
      ) : query.error ? (
        <InlineError message={textError(query.error)} />
      ) : !query.data?.length ? (
        <EmptyState
          icon={Landmark}
          title="لا توجد حسابات مسجلة بعد"
          description="أضف حسابًا نقديًا أو مصرفيًا أو محفظة إلكترونية للبدء في تتبع السيولة اليومية."
          action={
            <CreateAccountDialog triggerClassName="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer" />
          }
        />
      ) : (
        <>
          {/* Executive Top Metric Strip */}
          <section className="bg-card border border-border rounded-2xl shadow-xs grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 overflow-hidden">
            {/* Cell 1: إجمالي السيولة النقدية */}
            <div className="p-5 flex flex-col justify-between hover:bg-muted/30 transition-colors border-b sm:border-b-0 lg:border-b-0 lg:border-l border-border">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground font-bold text-xs">
                  إجمالي السيولة النقدية
                </span>
                <div className="size-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center justify-center">
                  <WalletCards className="size-4" />
                </div>
              </div>
              <div className="mt-2.5 mb-1">
                <strong className="text-foreground font-black font-mono text-2xl lg:text-3xl tabular-nums block">
                  <SensitiveValue>{formatMoney(totalLiquidity, baseCurrency, 2)}</SensitiveValue>
                </strong>
              </div>
              <span className="text-muted-foreground text-[11px] font-medium block">
                مجموع الحسابات الجارية والمحافظ
              </span>
            </div>

            {/* Cell 2: أرصدة البنوك المصرفية */}
            <div className="p-5 flex flex-col justify-between hover:bg-muted/30 transition-colors border-b sm:border-b-0 lg:border-b-0 lg:border-l border-border">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground font-bold text-xs">
                  أرصدة البنوك المصرفية
                </span>
                <div className="size-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center justify-center">
                  <Building2 className="size-4" />
                </div>
              </div>
              <div className="mt-2.5 mb-1">
                <strong className="text-foreground font-black font-mono text-2xl lg:text-3xl tabular-nums block">
                  <SensitiveValue>{formatMoney(totalBankBalance, baseCurrency, 2)}</SensitiveValue>
                </strong>
              </div>
              <span className="text-muted-foreground text-[11px] font-medium block">
                {bankAccounts.length} حسابات مصرفية نشطة
              </span>
            </div>

            {/* Cell 3: النقد السائل والمحافظ */}
            <div className="p-5 flex flex-col justify-between hover:bg-muted/30 transition-colors border-b sm:border-b-0 lg:border-b-0 lg:border-l border-border">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground font-bold text-xs">
                  الكاش والمحافظ الإلكترونية
                </span>
                <div className="size-8 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20 flex items-center justify-center">
                  <Smartphone className="size-4" />
                </div>
              </div>
              <div className="mt-2.5 mb-1">
                <strong className="text-foreground font-black font-mono text-2xl lg:text-3xl tabular-nums block">
                  <SensitiveValue>{formatMoney(totalCashBalance, baseCurrency, 2)}</SensitiveValue>
                </strong>
              </div>
              <span className="text-muted-foreground text-[11px] font-medium block">
                {cashAccounts.length} محافظ نقدية وذكية
              </span>
            </div>

            {/* Cell 4: حدود البطاقات المتاحة */}
            <div className="p-5 flex flex-col justify-between hover:bg-muted/30 transition-colors">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground font-bold text-xs">
                  حدود الائتمان المتاحة
                </span>
                <div className="size-8 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 flex items-center justify-center">
                  <CreditCard className="size-4" />
                </div>
              </div>
              <div className="mt-2.5 mb-1">
                <strong className="text-foreground font-black font-mono text-2xl lg:text-3xl tabular-nums block">
                  <SensitiveValue>{formatMoney(totalCreditAvailable, baseCurrency, 2)}</SensitiveValue>
                </strong>
              </div>
              <span className="text-muted-foreground text-[11px] font-medium block">
                من إجمالي حد ائتماني {formatMoney(totalCreditLimit, baseCurrency, 0)}
              </span>
            </div>
          </section>

          {/* ========================================================================= */}
          {/* VIEW MODE 1: MODERN CALM CARDS GRID (Default) */}
          {/* ========================================================================= */}
          {viewMode === "cards" ? (
            <div className="space-y-8">
              {/* SECTION A: البنوك والحسابات المصرفية */}
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Building2 className="size-4 text-emerald-600 dark:text-emerald-400" />
                    <h3 className="text-sm font-bold text-foreground">الحسابات المصرفية</h3>
                    <Badge variant="outline" className="text-xs font-mono">
                      {bankAccounts.length}
                    </Badge>
                  </div>
                  <span className="text-xs font-mono text-muted-foreground tabular-nums">
                    المجموع: {formatMoney(totalBankBalance, baseCurrency, 2)}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {bankAccounts.map((acc: any) => (
                    <Card
                      key={acc.id}
                      className="border border-border bg-card text-card-foreground shadow-xs rounded-2xl p-5 hover:border-emerald-500/40 transition-all flex flex-col justify-between group"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="flex items-center gap-2.5">
                            <div className="size-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                              <Building2 className="size-5" />
                            </div>
                            <div className="min-w-0">
                              <h4 className="text-sm font-bold text-foreground truncate group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                                {acc.name}
                              </h4>
                              <p className="text-[11px] text-muted-foreground font-mono mt-0.5">
                                {acc.institution || "حساب مصرفي"} · {acc.currency}
                              </p>
                            </div>
                          </div>
                          <Badge variant="secondary" className="text-[10px] font-bold shrink-0">
                            {accountTypeLabel[acc.accountType as AccountType] || acc.accountType}
                          </Badge>
                        </div>

                        <div className="my-4 pt-3 border-t border-border/60">
                          <span className="text-[10px] font-bold text-muted-foreground block mb-1">
                            الرصيد الفعلي
                          </span>
                          <div className="text-2xl font-black font-mono tabular-nums text-foreground">
                            <SensitiveValue>{money(acc.balance, acc.currency)}</SensitiveValue>
                          </div>
                          {acc.currency !== baseCurrency && acc.baseValue !== null && (
                            <span className="text-xs font-mono text-muted-foreground mt-1 block">
                              ≈ {formatMoney(acc.baseValue, baseCurrency, 2)}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-3 border-t border-border/60">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenReconcile(acc)}
                          className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 hover:bg-muted h-8 px-2.5 rounded-lg cursor-pointer gap-1.5"
                        >
                          <ArrowLeftRight className="size-3.5" />
                          <span>تسوية الرصيد</span>
                        </Button>

                        <span className="text-[11px] font-mono text-muted-foreground">
                          {acc.status === "active" ? "✓ نشط" : "مؤرشف"}
                        </span>
                      </div>
                    </Card>
                  ))}
                </div>
              </section>

              {/* SECTION B: المحافظ والكاش الذكي */}
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Smartphone className="size-4 text-sky-600 dark:text-sky-400" />
                    <h3 className="text-sm font-bold text-foreground">محافظ الكاش والإنستاباي</h3>
                    <Badge variant="outline" className="text-xs font-mono">
                      {cashAccounts.length}
                    </Badge>
                  </div>
                  <span className="text-xs font-mono text-muted-foreground tabular-nums">
                    المجموع: {formatMoney(totalCashBalance, baseCurrency, 2)}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {cashAccounts.map((acc: any) => (
                    <Card
                      key={acc.id}
                      className="border border-border bg-card text-card-foreground shadow-xs rounded-2xl p-5 hover:border-sky-500/40 transition-all flex flex-col justify-between group"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="flex items-center gap-2.5">
                            <div className="size-10 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
                              {acc.accountType === "wallet" ? (
                                <Smartphone className="size-5" />
                              ) : (
                                <Wallet className="size-5" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <h4 className="text-sm font-bold text-foreground truncate group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">
                                {acc.name}
                              </h4>
                              <p className="text-[11px] text-muted-foreground font-mono mt-0.5">
                                {acc.institution || "محفظة رقمية"} · {acc.currency}
                              </p>
                            </div>
                          </div>
                          <Badge variant="secondary" className="text-[10px] font-bold shrink-0">
                            {accountTypeLabel[acc.accountType as AccountType] || acc.accountType}
                          </Badge>
                        </div>

                        <div className="my-4 pt-3 border-t border-border/60">
                          <span className="text-[10px] font-bold text-muted-foreground block mb-1">
                            الرصيد الحر المتاح
                          </span>
                          <div className="text-2xl font-black font-mono tabular-nums text-foreground">
                            <SensitiveValue>{money(acc.balance, acc.currency)}</SensitiveValue>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-3 border-t border-border/60">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenReconcile(acc)}
                          className="text-xs font-bold text-sky-600 dark:text-sky-400 hover:text-sky-700 dark:hover:text-sky-300 hover:bg-muted h-8 px-2.5 rounded-lg cursor-pointer gap-1.5"
                        >
                          <ArrowLeftRight className="size-3.5" />
                          <span>تسوية الرصيد</span>
                        </Button>

                        <span className="text-[11px] font-mono text-muted-foreground">
                          {acc.status === "active" ? "✓ جاهز للصرف" : "مؤرشف"}
                        </span>
                      </div>
                    </Card>
                  ))}
                </div>
              </section>

              {/* SECTION C: البطاقات الائتمانية والحدود المتاحة (مع إبراز فترات الاستحقاق) */}
              {cards.length > 0 && (
                <section className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CreditCard className="size-4 text-indigo-600 dark:text-indigo-400" />
                      <h3 className="text-sm font-bold text-foreground">
                        كروت الائتمان ومواعيد السداد وفترات السماح
                      </h3>
                      <Badge variant="outline" className="text-xs font-mono">
                        {cards.length}
                      </Badge>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setLocation("/banking?tab=debts")}
                      className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline p-0 h-auto"
                    >
                      إدارة الديون والتقسيط ←
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {cards.map((c: any) => {
                      const limitNum = Number(c.creditLimit) || 0;
                      const balNum = Number(c.currentBalance) || 0;
                      const avail = Math.max(0, limitNum - balNum);
                      const utilPct = limitNum > 0 ? Math.min(100, Math.round((balNum / limitNum) * 100)) : 0;

                      return (
                        <Card
                          key={c.id}
                          className="border border-border bg-card text-card-foreground shadow-xs rounded-2xl p-5 hover:border-indigo-500/40 transition-all flex flex-col justify-between group"
                        >
                          <div>
                            <div className="flex items-start justify-between gap-3 mb-3">
                              <div className="flex items-center gap-2.5">
                                <div className="size-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                                  <CreditCard className="size-5" />
                                </div>
                                <div className="min-w-0">
                                  <h4 className="text-sm font-bold text-foreground truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                                    {c.name}
                                  </h4>
                                  <p className="text-[11px] text-muted-foreground font-mono mt-0.5">
                                    {c.lender || "بطاقة ائتمان"}
                                  </p>
                                </div>
                              </div>
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-0.5 rounded-full">
                                استغلال {utilPct}%
                              </span>
                            </div>

                            {/* Prominent Available Limit Display */}
                            <div className="my-4 pt-3 border-t border-border/60">
                              <div className="flex items-baseline justify-between mb-1">
                                <span className="text-[10px] font-bold text-muted-foreground">
                                  الحد المتاح للشراء الفوري
                                </span>
                                <span className="text-xs font-mono text-muted-foreground tabular-nums">
                                  من إجمالي {formatMoney(limitNum, baseCurrency, 0)}
                                </span>
                              </div>
                              <div className="text-2xl font-black font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                                <SensitiveValue>{formatMoney(avail, baseCurrency, 2)}</SensitiveValue>
                              </div>

                              {/* Utilization progress bar */}
                              <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden mt-2.5">
                                <div
                                  className={`h-full rounded-full transition-all duration-500 ${
                                    utilPct > 75
                                      ? "bg-rose-500"
                                      : utilPct > 40
                                      ? "bg-amber-500"
                                      : "bg-emerald-500"
                                  }`}
                                  style={{ width: `${Math.max(4, utilPct)}%` }}
                                />
                              </div>
                            </div>

                            {/* Highlighted Due Date Badge (ميعاد الاستحقاق البارز) */}
                            <div className="p-2.5 rounded-xl bg-muted/50 border border-border flex items-center justify-between text-xs mb-3">
                              <span className="text-muted-foreground font-medium flex items-center gap-1.5">
                                <Calendar className="size-3.5 text-rose-500" />
                                <span>تاريخ السداد القادم:</span>
                              </span>
                              <strong className="text-foreground font-bold font-mono">
                                يوم {c.dueDay || 25} من كل شهر
                              </strong>
                            </div>
                          </div>

                          <div className="flex items-center justify-between pt-3 border-t border-border/60">
                            <span className="text-xs font-mono text-muted-foreground">
                              المستحق: <strong className="text-rose-600 dark:text-rose-400 font-bold tabular-nums">{formatMoney(balNum, baseCurrency, 2)}</strong>
                            </span>

                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setLocation("/banking?tab=debts")}
                              className="text-xs font-bold border-border bg-card hover:bg-muted text-foreground h-8 px-3 rounded-lg cursor-pointer"
                            >
                              سداد الكارت
                            </Button>
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                </section>
              )}
            </div>
          ) : (
            /* ========================================================================= */
            /* VIEW MODE 2: CLASSIC ACCOUNTING TABLE */
            /* ========================================================================= */
            <div className="bg-card border border-border rounded-2xl shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-right text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="bg-muted/50 text-foreground font-bold text-xs py-3.5 px-4 text-right">
                        الحساب
                      </th>
                      <th className="bg-muted/50 text-foreground font-bold text-xs py-3.5 px-4 text-right">
                        النوع
                      </th>
                      <th className="bg-muted/50 text-foreground font-bold text-xs py-3.5 px-4 text-right">
                        الجهة
                      </th>
                      <th className="bg-muted/50 text-foreground font-bold text-xs py-3.5 px-4 text-right">
                        الرصيد الفعلي
                      </th>
                      <th className="bg-muted/50 text-foreground font-bold text-xs py-3.5 px-4 text-right">
                        التقييم / العملة
                      </th>
                      <th className="bg-muted/50 text-foreground font-bold text-xs py-3.5 px-4 text-center">
                        إجراءات
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {query.data.map((account) => {
                      const isBank = account.accountType === "bank";
                      const isCash = ["cash", "wallet"].includes(account.accountType);
                      const isBrokerage = account.accountType === "brokerage";
                      return (
                        <tr
                          key={account.id}
                          className="hover:bg-muted/40 transition-colors"
                        >
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2.5">
                              <div
                                className={`flex size-8 shrink-0 items-center justify-center rounded-lg border ${
                                  isBank
                                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                                    : isCash
                                    ? "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20"
                                    : isBrokerage
                                    ? "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20"
                                    : "bg-muted text-muted-foreground border-border"
                                }`}
                              >
                                {isBank ? (
                                  <Building2 className="size-4" />
                                ) : isCash ? (
                                  <Wallet className="size-4" />
                                ) : isBrokerage ? (
                                  <TrendingUp className="size-4" />
                                ) : (
                                  <Landmark className="size-4" />
                                )}
                              </div>
                              <div>
                                <span className="text-foreground font-bold text-sm block">
                                  {account.name}
                                </span>
                                <span className="text-[11px] font-mono font-medium text-muted-foreground block mt-0.5">
                                  {account.currency}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <Badge variant="secondary" className="text-xs font-medium">
                              {accountTypeLabel[account.accountType as AccountType] || account.accountType}
                            </Badge>
                          </td>
                          <td className="py-3.5 px-4 text-muted-foreground font-medium text-xs">
                            {account.institution || "—"}
                          </td>
                          <td className="py-3.5 px-4">
                            <span
                              className="text-foreground font-bold font-mono text-sm sm:text-base tabular-nums block"
                              dir="ltr"
                            >
                              {money(account.balance, account.currency)}
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            {account.baseValue !== null ? (
                              <div className="flex items-center gap-1.5" dir="ltr">
                                <span className="text-foreground font-bold font-mono text-sm sm:text-base tabular-nums">
                                  {money(account.baseValue, baseCurrency)}
                                </span>
                                {account.currency !== baseCurrency && (
                                  <span className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded border border-border">
                                    {baseCurrency}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 text-xs font-medium bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-full">
                                يتطلب سعر صرف
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenReconcile(account)}
                              className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:bg-muted h-7 px-2.5 cursor-pointer"
                            >
                              تسوية
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Reconciliation Modal */}
      <ReconciliationModal
        open={reconcileOpen}
        onOpenChange={setReconcileOpen}
        account={reconcileAccount}
        defaultCurrency={baseCurrency}
        onSuccess={() => {
          query.refetch();
        }}
      />
    </div>
  );

  if (embedded) return content;
  return <DashboardLayout>{content}</DashboardLayout>;
}
export { AccountsPage };
