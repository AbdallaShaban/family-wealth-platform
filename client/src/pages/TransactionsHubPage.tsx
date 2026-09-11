import DashboardLayout from "@/components/DashboardLayout";
import PageHeader from "@/components/PageHeader";
import SensitiveValue from "@/components/SensitiveValue";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { formatMoney } from "@/lib/financialDisplay";
import { trpc } from "@/lib/trpc";
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  BriefcaseBusiness,
  CheckCircle2,
  Clock,
  Coins,
  CreditCard,
  FileText,
  Filter,
  Loader2,
  PlusCircle,
  RefreshCw,
  Search,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import React, { useMemo, useState } from "react";
import { toast } from "sonner";

type OperationType =
  | "deposit"
  | "withdrawal"
  | "transfer"
  | "buy"
  | "sell"
  | "fund_redemption"
  | "debt_payment";

interface OperationConfig {
  id: OperationType;
  title: string;
  shortDesc: string;
  icon: React.ElementType;
  badge: string;
  badgeColor: string;
}

const OPERATIONS: OperationConfig[] = [
  {
    id: "deposit",
    title: "إيداع / إضافة سيولة",
    shortDesc: "إضافة سيولة نقدية أو بنكية إلى أحد الحسابات مع قيد محاسبي متوازن.",
    icon: ArrowDownLeft,
    badge: "سيولة واردة",
    badgeColor: "bg-emerald-500/10 text-emerald-700 border-emerald-200 dark:border-emerald-800 dark:text-emerald-400",
  },
  {
    id: "withdrawal",
    title: "سحب / مصروف",
    shortDesc: "صرف أو سحب نقدي مع تحديد الحساب والفئة المالية والمذكرة.",
    icon: ArrowUpRight,
    badge: "سيولة صادرة",
    badgeColor: "bg-red-500/10 text-red-700 border-red-200 dark:border-red-800 dark:text-red-400",
  },
  {
    id: "transfer",
    title: "تحويل بين الحسابات",
    shortDesc: "نقل آمن للقيمة بين حسابين للمستخدم مع قفل مانع للتعارض والرصيد السلبي.",
    icon: ArrowLeftRight,
    badge: "تحويل داخلي",
    badgeColor: "bg-blue-500/10 text-blue-700 border-blue-200 dark:border-blue-800 dark:text-blue-400",
  },
  {
    id: "buy",
    title: "شراء أصل / استثمار",
    shortDesc: "تنفيذ شراء أسهم أو صناديق أو ذهب مع خصم القيمة وتحديث الحيازة.",
    icon: TrendingUp,
    badge: "استثمار جديد",
    badgeColor: "bg-emerald-500/10 text-emerald-700 border-emerald-200 dark:border-emerald-800 dark:text-emerald-400",
  },
  {
    id: "sell",
    title: "بيع أصل / استثمار",
    shortDesc: "بيع حيازة استثمارية مسجلة وإيداع العائد في حساب التسوية.",
    icon: TrendingDown,
    badge: "تسييل أصل",
    badgeColor: "bg-amber-500/10 text-amber-700 border-amber-200 dark:border-amber-800 dark:text-amber-400",
  },
  {
    id: "fund_redemption",
    title: "استرداد استثمار / صندوق",
    shortDesc: "استرداد وثائق صندوق استثماري أو استرداد أصل عبر مسار البيع النظامي المعتمد.",
    icon: Coins,
    badge: "استرداد وثائق",
    badgeColor: "bg-indigo-500/10 text-indigo-700 border-indigo-200 dark:border-indigo-800 dark:text-indigo-400",
  },
  {
    id: "debt_payment",
    title: "سداد دين / التزام",
    shortDesc: "ترحيل سداد التزام (أصل، فائدة، رسوم) بقيد متوازن يقلل رصيد الدين.",
    icon: CreditCard,
    badge: "سداد التزام",
    badgeColor: "bg-purple-500/10 text-purple-700 border-purple-200 dark:border-purple-800 dark:text-purple-400",
  },
];

const eventLabel: Record<string, { label: string; icon: React.ElementType; color: string; sign: string }> = {
  deposit: { label: "إيداع سيولة", icon: ArrowDownLeft, color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40", sign: "+" },
  opening_balance: { label: "رصيد افتتاحي", icon: PlusCircle, color: "text-blue-600 bg-blue-50 dark:bg-blue-950/40", sign: "+" },
  income: { label: "دخل مصنف", icon: ArrowDownLeft, color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40", sign: "+" },
  withdrawal: { label: "سحب سيولة", icon: ArrowUpRight, color: "text-red-600 bg-red-50 dark:bg-red-950/40", sign: "-" },
  expense: { label: "مصروف مصنف", icon: ArrowUpRight, color: "text-red-600 bg-red-50 dark:bg-red-950/40", sign: "-" },
  transfer: { label: "تحويل داخلي", icon: ArrowLeftRight, color: "text-blue-600 bg-blue-50 dark:bg-blue-950/40", sign: "⇄" },
  buy: { label: "شراء استثمار", icon: TrendingUp, color: "text-indigo-600 bg-indigo-50 dark:bg-indigo-950/40", sign: "-" },
  sell: { label: "بيع / استرداد", icon: TrendingDown, color: "text-amber-600 bg-amber-50 dark:bg-amber-950/40", sign: "+" },
  debt_payment: { label: "سداد دين", icon: CreditCard, color: "text-purple-600 bg-purple-50 dark:bg-purple-950/40", sign: "-" },
};

export default function TransactionsHubPage() {
  const utils = trpc.useUtils();

  // Queries
  const accounts = trpc.family.accounts.list.useQuery();
  const recentEvents = trpc.family.ledger.recent.useQuery();
  const instruments = trpc.family.instruments.list.useQuery();
  const debts = trpc.family.debts.list.useQuery();
  const categories = trpc.family.cashFlow.categories.useQuery();

  // Dialog State
  const [activeModal, setActiveModal] = useState<OperationType | null>(null);
  const [reviewStep, setReviewStep] = useState(false);

  // Form Fields
  const [primaryAccountId, setPrimaryAccountId] = useState<string>("");
  const [targetAccountId, setTargetAccountId] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [memo, setMemo] = useState<string>("");
  const [instrumentId, setInstrumentId] = useState<string>("");
  const [quantity, setQuantity] = useState<string>("");
  const [unitPrice, setUnitPrice] = useState<string>("");
  const [feeAmount, setFeeAmount] = useState<string>("");
  const [taxAmount, setTaxAmount] = useState<string>("");
  const [debtId, setDebtId] = useState<string>("");
  const [interestAmount, setInterestAmount] = useState<string>("0");

  // Filter state for recent transactions
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  // Invalidate all related financial read queries
  const invalidateAll = () => {
    void utils.family.dashboard.invalidate();
    void utils.family.accounts.list.invalidate();
    void utils.family.ledger.recent.invalidate();
    void utils.family.cashFlow.summary.invalidate();
    void utils.family.portfolio.list.invalidate();
    void utils.family.debts.list.invalidate();
  };

  // Reset form
  const resetForm = () => {
    setActiveModal(null);
    setReviewStep(false);
    setPrimaryAccountId("");
    setTargetAccountId("");
    setAmount("");
    setCategoryId("");
    setMemo("");
    setInstrumentId("");
    setQuantity("");
    setUnitPrice("");
    setFeeAmount("");
    setTaxAmount("");
    setDebtId("");
    setInterestAmount("0");
  };

  // Mutations
  const postCash = trpc.family.ledger.postCash.useMutation({
    onSuccess: () => {
      toast.success("تم ترحيل العملية ونشر القيد المحاسبي المتوازن بنجاح.");
      invalidateAll();
      resetForm();
    },
    onError: err => toast.error(err.message || "تعذر تنفيذ العملية النقدية."),
  });

  const postTransfer = trpc.family.ledger.transfer.useMutation({
    onSuccess: () => {
      toast.success("تم تنفيذ التحويل بقيد متوازن بين الحسابين بنجاح.");
      invalidateAll();
      resetForm();
    },
    onError: err => toast.error(err.message || "تعذر تنفيذ التحويل الداخلي."),
  });

  const postTrade = trpc.family.ledger.trade.useMutation({
    onSuccess: () => {
      toast.success("تم تنفيذ الصفقة وتحديث الحيازة ومتوسط التكلفة بنجاح.");
      invalidateAll();
      resetForm();
    },
    onError: err => toast.error(err.message || "تعذر تنفيذ الصفقة الاستثمارية."),
  });

  const postDebtPayment = trpc.family.debts.postPayment.useMutation({
    onSuccess: () => {
      toast.success("تم ترحيل سداد الدين وتحديث الرصيد المستحق بنجاح.");
      invalidateAll();
      resetForm();
    },
    onError: err => toast.error(err.message || "تعذر سداد الدين."),
  });

  const isPending =
    postCash.isPending || postTransfer.isPending || postTrade.isPending || postDebtPayment.isPending;

  // Selected entities
  const selectedAccount = (accounts.data ?? []).find(a => String(a.id) === primaryAccountId);
  const selectedTargetAccount = (accounts.data ?? []).find(a => String(a.id) === targetAccountId);
  const selectedInstrument = (instruments.data ?? []).find(i => String(i.id) === instrumentId);
  const selectedDebt = (debts.data ?? []).find(d => String(d.id) === debtId);

  // Filter accounts suitable for cash/transfers
  const cashAccounts = (accounts.data ?? []).filter(
    a => ["cash", "bank", "brokerage", "wallet"].includes(a.accountType) && a.status === "active"
  );

  // Eligible fund/investment instruments
  const fundInstruments = (instruments.data ?? []).filter(i =>
    ["fund", "equity", "gold", "bond"].includes(i.assetType)
  );

  // Execute operation
  const handleExecute = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewStep) {
      // Validate inputs before advancing to review
      if (activeModal === "deposit" || activeModal === "withdrawal") {
        if (!primaryAccountId || !amount || Number(amount) <= 0) {
          return toast.error("يرجى اختيار الحساب وإدخال مبلغ صالح.");
        }
      } else if (activeModal === "transfer") {
        if (!primaryAccountId || !targetAccountId || primaryAccountId === targetAccountId) {
          return toast.error("يرجى اختيار حساب مصدر وحساب وجهة مختلفين.");
        }
        if (!amount || Number(amount) <= 0) {
          return toast.error("يرجى إدخال مبلغ تحويل صالح.");
        }
      } else if (activeModal === "buy" || activeModal === "sell" || activeModal === "fund_redemption") {
        if (!primaryAccountId || !instrumentId) {
          return toast.error("يرجى اختيار حساب التسوية والأداة الاستثمارية.");
        }
        if (!quantity || Number(quantity) <= 0 || !unitPrice || Number(unitPrice) <= 0) {
          return toast.error("يرجى إدخال كمية وسعر وحدة صالحين.");
        }
      } else if (activeModal === "debt_payment") {
        if (!debtId || !primaryAccountId || !amount || Number(amount) <= 0) {
          return toast.error("يرجى اختيار الالتزام وحساب السداد وإدخال مبلغ الأصل.");
        }
      }
      setReviewStep(true);
      return;
    }

    // Step 2: Confirmation & Execution
    const idempotencyKey = crypto.randomUUID();
    const occurredAt = Date.now();

    if (activeModal === "deposit") {
      if (!selectedAccount) return;
      postCash.mutate({
        eventType: "deposit",
        accountId: selectedAccount.id,
        amount,
        currency: selectedAccount.currency,
        occurredAt,
        categoryId: categoryId ? Number(categoryId) : null,
        memo: memo || null,
        idempotencyKey,
      });
    } else if (activeModal === "withdrawal") {
      if (!selectedAccount) return;
      postCash.mutate({
        eventType: categoryId ? "expense" : "withdrawal",
        accountId: selectedAccount.id,
        amount,
        currency: selectedAccount.currency,
        occurredAt,
        categoryId: categoryId ? Number(categoryId) : null,
        memo: memo || null,
        idempotencyKey,
      });
    } else if (activeModal === "transfer") {
      if (!selectedAccount || !selectedTargetAccount) return;
      postTransfer.mutate({
        fromAccountId: selectedAccount.id,
        toAccountId: selectedTargetAccount.id,
        amount,
        currency: selectedAccount.currency,
        occurredAt,
        memo: memo || null,
        idempotencyKey,
      });
    } else if (activeModal === "buy" || activeModal === "sell" || activeModal === "fund_redemption") {
      if (!selectedAccount || !selectedInstrument) return;
      const side = activeModal === "buy" ? "buy" : "sell";
      postTrade.mutate({
        side,
        accountId: selectedAccount.id,
        instrumentId: selectedInstrument.id,
        quantity,
        unitPrice,
        feeAmount: feeAmount || null,
        taxAmount: taxAmount || null,
        occurredAt,
        memo: memo || null,
        idempotencyKey,
      });
    } else if (activeModal === "debt_payment") {
      if (!selectedDebt || !selectedAccount) return;
      postDebtPayment.mutate({
        debtId: selectedDebt.id,
        cashAccountId: selectedAccount.id,
        principalAmount: amount,
        interestAmount: interestAmount && Number(interestAmount) > 0 ? interestAmount : null,
        feeAmount: feeAmount && Number(feeAmount) > 0 ? feeAmount : null,
        occurredAt,
        memo: memo || null,
        idempotencyKey,
      });
    }
  };

  // Filtered recent events
  const filteredEvents = useMemo(() => {
    let list = recentEvents.data ?? [];
    if (typeFilter !== "all") {
      list = list.filter(e => {
        if (typeFilter === "cash_in") return ["deposit", "income", "opening_balance"].includes(e.eventType);
        if (typeFilter === "cash_out") return ["withdrawal", "expense"].includes(e.eventType);
        if (typeFilter === "transfer") return e.eventType === "transfer";
        if (typeFilter === "trade") return ["buy", "sell"].includes(e.eventType);
        if (typeFilter === "debt") return e.eventType === "debt_payment";
        return true;
      });
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        e =>
          (e.memo && e.memo.toLowerCase().includes(q)) ||
          e.currency.toLowerCase().includes(q) ||
          e.grossAmount.includes(q) ||
          (eventLabel[e.eventType]?.label && eventLabel[e.eventType].label.toLowerCase().includes(q))
      );
    }
    return list;
  }, [recentEvents.data, typeFilter, searchQuery]);

  return (
    <DashboardLayout>
      <div dir="rtl" className="mx-auto max-w-7xl space-y-6">
        <PageHeader
          title="المعاملات المالية"
          description="مركز إدخال العمليات المالية اليومية وإدارة تدفقات السيولة والاستثمارات والالتزامات بقيد محاسبي متوازن وسجل تدقيق فوري."
          breadcrumbs={[
            { label: "الرئيسية", href: "/" },
            { label: "النقد والالتزامات", href: "/transactions" },
            { label: "المعاملات المالية" },
          ]}
          badge={{ text: "مركز العمليات اليومية", variant: "institutional" }}
          icon={ArrowLeftRight}
          actions={
            <Button
              variant="outline"
              size="sm"
              onClick={invalidateAll}
              disabled={recentEvents.isFetching}
              className="gap-2"
            >
              <RefreshCw className={`size-4 ${recentEvents.isFetching ? "animate-spin" : ""}`} />
              تحديث البيانات
            </Button>
          }
        />

        {/* Action Buttons Grid */}
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {OPERATIONS.map(op => {
            const Icon = op.icon;
            return (
              <Card
                key={op.id}
                className="group relative cursor-pointer overflow-hidden border-border/80 transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-500/50 hover:shadow-md dark:hover:border-emerald-500/30"
                onClick={() => {
                  setActiveModal(op.id);
                  setReviewStep(false);
                }}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400 group-hover:scale-105 transition-transform">
                      <Icon className="size-5" />
                    </div>
                    <Badge variant="outline" className={`text-xs font-normal ${op.badgeColor}`}>
                      {op.badge}
                    </Badge>
                  </div>
                  <CardTitle className="mt-3 text-base font-bold text-slate-900 dark:text-slate-100">
                    {op.title}
                  </CardTitle>
                  <CardDescription className="text-xs leading-5 line-clamp-2">
                    {op.shortDesc}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-between text-xs text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/40"
                  >
                    <span>بدء العملية</span>
                    <ArrowLeftRight className="size-3.5 rotate-180" />
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </section>

        {/* Recent Transactions Feed */}
        <Card className="border-border/80 shadow-sm">
          <CardHeader className="border-b border-border/60 pb-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg font-bold">
                  <FileText className="size-5 text-emerald-600 dark:text-emerald-400" />
                  سجل المعاملات والعمليات المنشورة
                </CardTitle>
                <CardDescription className="mt-1 text-xs">
                  العمليات المنشورة فعليًا في دفتر الأستاذ والمقيدة بقيود مزدوجة متوازنة.
                </CardDescription>
              </div>

              {/* Filters */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative min-w-44">
                  <Search className="absolute right-3 top-2.5 size-4 text-slate-400" />
                  <Input
                    placeholder="بحث في العمليات..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="h-9 pr-9 text-xs"
                  />
                </div>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="h-9 w-36 text-xs">
                    <Filter className="ml-1.5 size-3.5 text-slate-400" />
                    <SelectValue placeholder="تصفية النوع" />
                  </SelectTrigger>
                  <SelectContent align="end">
                    <SelectItem value="all">كل العمليات</SelectItem>
                    <SelectItem value="cash_in">إيداعات ودخل</SelectItem>
                    <SelectItem value="cash_out">سحوبات ومصروفات</SelectItem>
                    <SelectItem value="transfer">تحويلات داخلية</SelectItem>
                    <SelectItem value="trade">تداول واستثمار</SelectItem>
                    <SelectItem value="debt">سداد التزامات</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {recentEvents.isLoading ? (
              <div className="space-y-3 p-6">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : filteredEvents.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 text-center">
                <div className="flex size-14 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400">
                  <ArrowLeftRight className="size-6" />
                </div>
                <h3 className="mt-4 text-base font-semibold text-slate-900 dark:text-slate-100">
                  لا توجد عمليات تطابق البحث
                </h3>
                <p className="mt-1 text-xs text-slate-500 max-w-sm">
                  اختر أحد الأزرار بالأعلى لتسجيل إيداع أو سحب أو تحويل أو صفقة استثمارية.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-right text-sm">
                  <thead className="bg-slate-50 text-xs font-semibold text-slate-500 dark:bg-slate-900/50 dark:text-slate-400">
                    <tr>
                      <th className="p-3.5 pr-6">نوع العملية</th>
                      <th className="p-3.5">المبلغ والعملة</th>
                      <th className="p-3.5">التاريخ والوقت</th>
                      <th className="p-3.5">الملاحظة / البيان</th>
                      <th className="p-3.5 pl-6">حالة القيد</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {filteredEvents.map(event => {
                      const meta = eventLabel[event.eventType] || {
                        label: event.eventType,
                        icon: ArrowLeftRight,
                        color: "text-slate-600 bg-slate-100",
                        sign: "",
                      };
                      const Icon = meta.icon;
                      const formattedAmount = formatMoney(event.grossAmount, event.currency, 2);
                      const isPositive = ["deposit", "income", "opening_balance", "sell"].includes(
                        event.eventType
                      );

                      return (
                        <tr
                          key={event.id}
                          className="transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-900/30"
                        >
                          <td className="p-3.5 pr-6">
                            <div className="flex items-center gap-2.5">
                              <div className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${meta.color}`}>
                                <Icon className="size-4" />
                              </div>
                              <div>
                                <p className="font-semibold text-slate-900 dark:text-slate-100">
                                  {meta.label}
                                </p>
                                <p className="text-[11px] text-slate-400">
                                  قيد رقم #{event.id}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="p-3.5">
                            <div className="font-mono text-sm font-bold tracking-tight">
                              <span
                                className={
                                  isPositive
                                    ? "text-emerald-600 dark:text-emerald-400"
                                    : "text-red-600 dark:text-red-400"
                                }
                              >
                                {meta.sign} <SensitiveValue>{formattedAmount}</SensitiveValue>
                              </span>
                            </div>
                          </td>
                          <td className="p-3.5 text-xs text-slate-500 dark:text-slate-400">
                            <div className="flex items-center gap-1.5">
                              <Clock className="size-3 text-slate-400" />
                              <span>{new Date(event.occurredAt).toLocaleString("en-GB")}</span>
                            </div>
                          </td>
                          <td className="p-3.5 text-xs text-slate-600 dark:text-slate-300 max-w-xs truncate">
                            {event.memo || "—"}
                          </td>
                          <td className="p-3.5 pl-6">
                            <Badge
                              variant="outline"
                              className="gap-1 border-emerald-300 bg-emerald-50 text-[11px] font-normal text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                            >
                              <ShieldCheck className="size-3 text-emerald-600" />
                              <span>قيد مرحل</span>
                            </Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Interactive Operation Dialog */}
        <Dialog open={activeModal !== null} onOpenChange={open => !open && resetForm()}>
          <DialogContent className="max-w-xl" dir="rtl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-lg font-bold">
                {activeModal && (
                  <>
                    {React.createElement(
                      OPERATIONS.find(op => op.id === activeModal)?.icon || ArrowLeftRight,
                      { className: "size-5 text-emerald-600" }
                    )}
                    <span>{OPERATIONS.find(op => op.id === activeModal)?.title}</span>
                  </>
                )}
              </DialogTitle>
              <DialogDescription className="text-xs">
                {reviewStep
                  ? "راجع تفاصيل العملية قبل تأكيد الترحيل النهائي إلى دفتر الأستاذ."
                  : OPERATIONS.find(op => op.id === activeModal)?.shortDesc}
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleExecute} className="space-y-4">
              {!reviewStep ? (
                <>
                  {/* Operation: Deposit or Withdrawal */}
                  {(activeModal === "deposit" || activeModal === "withdrawal") && (
                    <>
                      <div className="grid gap-2">
                        <Label>الحساب المالي</Label>
                        <Select value={primaryAccountId} onValueChange={setPrimaryAccountId} required>
                          <SelectTrigger>
                            <SelectValue placeholder="اختر الحساب المستهدف" />
                          </SelectTrigger>
                          <SelectContent>
                            {cashAccounts.map(account => (
                              <SelectItem key={account.id} value={String(account.id)}>
                                {account.name} — الرصيد: {formatMoney(account.balance, account.currency, 2)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="grid gap-2">
                          <Label htmlFor="tx-amount">
                            المبلغ {selectedAccount ? `(${selectedAccount.currency})` : ""}
                          </Label>
                          <Input
                            id="tx-amount"
                            type="number"
                            step="any"
                            min="0.01"
                            value={amount}
                            onChange={e => setAmount(e.target.value)}
                            placeholder="0.00"
                            required
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label>تصنيف التدفق (اختياري)</Label>
                          <Select value={categoryId} onValueChange={setCategoryId}>
                            <SelectTrigger>
                              <SelectValue placeholder="اختر تصنيفاً" />
                            </SelectTrigger>
                            <SelectContent>
                              {(categories.data ?? [])
                                .filter(c =>
                                  activeModal === "deposit" ? c.direction === "income" : c.direction === "expense"
                                )
                                .map(c => (
                                  <SelectItem key={c.id} value={String(c.id)}>
                                    {c.name}
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="grid gap-2">
                        <Label htmlFor="tx-memo">مذكرة أو بيان العملية</Label>
                        <Textarea
                          id="tx-memo"
                          value={memo}
                          onChange={e => setMemo(e.target.value)}
                          placeholder="ملاحظات توثيقية إضافية للتدقيق..."
                          rows={2}
                          maxLength={2000}
                        />
                      </div>
                    </>
                  )}

                  {/* Operation: Internal Transfer */}
                  {activeModal === "transfer" && (
                    <>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="grid gap-2">
                          <Label>من الحساب (المصدر)</Label>
                          <Select value={primaryAccountId} onValueChange={setPrimaryAccountId} required>
                            <SelectTrigger>
                              <SelectValue placeholder="حساب الخصم" />
                            </SelectTrigger>
                            <SelectContent>
                              {cashAccounts.map(account => (
                                <SelectItem key={account.id} value={String(account.id)}>
                                  {account.name} ({formatMoney(account.balance, account.currency, 2)})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid gap-2">
                          <Label>إلى الحساب (الوجهة)</Label>
                          <Select value={targetAccountId} onValueChange={setTargetAccountId} required>
                            <SelectTrigger>
                              <SelectValue placeholder="حساب الإيداع" />
                            </SelectTrigger>
                            <SelectContent>
                              {cashAccounts
                                .filter(account => String(account.id) !== primaryAccountId)
                                .map(account => (
                                  <SelectItem key={account.id} value={String(account.id)}>
                                    {account.name} ({formatMoney(account.balance, account.currency, 2)})
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="grid gap-2">
                        <Label htmlFor="tr-amount">
                          مبلغ التحويل {selectedAccount ? `(${selectedAccount.currency})` : ""}
                        </Label>
                        <Input
                          id="tr-amount"
                          type="number"
                          step="any"
                          min="0.01"
                          value={amount}
                          onChange={e => setAmount(e.target.value)}
                          placeholder="0.00"
                          required
                        />
                      </div>

                      <div className="grid gap-2">
                        <Label htmlFor="tr-memo">بيان التحويل</Label>
                        <Textarea
                          id="tr-memo"
                          value={memo}
                          onChange={e => setMemo(e.target.value)}
                          placeholder="مذكرة التحويل الداخلي..."
                          rows={2}
                          maxLength={2000}
                        />
                      </div>
                    </>
                  )}

                  {/* Operation: Buy / Sell / Fund Redemption */}
                  {(activeModal === "buy" ||
                    activeModal === "sell" ||
                    activeModal === "fund_redemption") && (
                    <>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="grid gap-2">
                          <Label>حساب التسوية النقدية</Label>
                          <Select value={primaryAccountId} onValueChange={setPrimaryAccountId} required>
                            <SelectTrigger>
                              <SelectValue placeholder="اختر الحساب النقدي" />
                            </SelectTrigger>
                            <SelectContent>
                              {cashAccounts.map(account => (
                                <SelectItem key={account.id} value={String(account.id)}>
                                  {account.name} ({formatMoney(account.balance, account.currency, 2)})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid gap-2">
                          <Label>
                            {activeModal === "fund_redemption"
                              ? "الصندوق / الأداة الاستثمارية"
                              : "الأداة الاستثمارية"}
                          </Label>
                          <Select value={instrumentId} onValueChange={setInstrumentId} required>
                            <SelectTrigger>
                              <SelectValue placeholder="اختر الأداة" />
                            </SelectTrigger>
                            <SelectContent>
                              {(activeModal === "fund_redemption"
                                ? fundInstruments
                                : instruments.data ?? []
                              ).map(inst => (
                                <SelectItem key={inst.id} value={String(inst.id)}>
                                  {inst.name} ({inst.symbol || inst.assetType}) — {inst.currency}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="grid gap-2">
                          <Label htmlFor="tr-qty">الكمية / عدد الوثائق</Label>
                          <Input
                            id="tr-qty"
                            type="number"
                            step="any"
                            min="0.0001"
                            value={quantity}
                            onChange={e => setQuantity(e.target.value)}
                            placeholder="0"
                            required
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="tr-price">
                            سعر الوحدة {selectedInstrument ? `(${selectedInstrument.currency})` : ""}
                          </Label>
                          <Input
                            id="tr-price"
                            type="number"
                            step="any"
                            min="0.0001"
                            value={unitPrice}
                            onChange={e => setUnitPrice(e.target.value)}
                            placeholder="0.00"
                            required
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="grid gap-2">
                          <Label htmlFor="tr-fees">رسوم المعاملة (اختياري)</Label>
                          <Input
                            id="tr-fees"
                            type="number"
                            step="any"
                            min="0"
                            value={feeAmount}
                            onChange={e => setFeeAmount(e.target.value)}
                            placeholder="0.00"
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="tr-tax">الضرائب (اختياري)</Label>
                          <Input
                            id="tr-tax"
                            type="number"
                            step="any"
                            min="0"
                            value={taxAmount}
                            onChange={e => setTaxAmount(e.target.value)}
                            placeholder="0.00"
                          />
                        </div>
                      </div>

                      <div className="grid gap-2">
                        <Label htmlFor="tr-memo">بيان الصفقة</Label>
                        <Textarea
                          id="tr-memo"
                          value={memo}
                          onChange={e => setMemo(e.target.value)}
                          placeholder="ملاحظات توثيق الصفقة..."
                          rows={2}
                          maxLength={2000}
                        />
                      </div>
                    </>
                  )}

                  {/* Operation: Debt Payment */}
                  {activeModal === "debt_payment" && (
                    <>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="grid gap-2">
                          <Label>الالتزام / القرض المستحق</Label>
                          <Select value={debtId} onValueChange={setDebtId} required>
                            <SelectTrigger>
                              <SelectValue placeholder="اختر الالتزام" />
                            </SelectTrigger>
                            <SelectContent>
                              {(debts.data ?? [])
                                .filter(d => d.status === "active")
                                .map(d => (
                                  <SelectItem key={d.id} value={String(d.id)}>
                                    {d.name} — المستحق: {formatMoney(d.outstanding, d.currency, 2)}
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid gap-2">
                          <Label>حساب السداد</Label>
                          <Select value={primaryAccountId} onValueChange={setPrimaryAccountId} required>
                            <SelectTrigger>
                              <SelectValue placeholder="اختر حساب الخصم" />
                            </SelectTrigger>
                            <SelectContent>
                              {cashAccounts.map(account => (
                                <SelectItem key={account.id} value={String(account.id)}>
                                  {account.name} ({formatMoney(account.balance, account.currency, 2)})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                        <div className="grid gap-2">
                          <Label htmlFor="dp-principal">مبلغ الأصل المسدد</Label>
                          <Input
                            id="dp-principal"
                            type="number"
                            step="any"
                            min="0.01"
                            value={amount}
                            onChange={e => setAmount(e.target.value)}
                            placeholder="0.00"
                            required
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="dp-interest">الفائدة (إن وجدت)</Label>
                          <Input
                            id="dp-interest"
                            type="number"
                            step="any"
                            min="0"
                            value={interestAmount}
                            onChange={e => setInterestAmount(e.target.value)}
                            placeholder="0.00"
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="dp-fee">رسوم السداد</Label>
                          <Input
                            id="dp-fee"
                            type="number"
                            step="any"
                            min="0"
                            value={feeAmount}
                            onChange={e => setFeeAmount(e.target.value)}
                            placeholder="0.00"
                          />
                        </div>
                      </div>

                      <div className="grid gap-2">
                        <Label htmlFor="dp-memo">مذكرة السداد</Label>
                        <Textarea
                          id="dp-memo"
                          value={memo}
                          onChange={e => setMemo(e.target.value)}
                          placeholder="رقم مرجع السداد أو ملاحظة..."
                          rows={2}
                          maxLength={2000}
                        />
                      </div>
                    </>
                  )}
                </>
              ) : (
                /* Step 2: Review & Summary */
                <div className="space-y-4 py-2">
                  <div className="rounded-xl border border-border/80 bg-slate-50/70 p-4 dark:bg-slate-900/40 space-y-3">
                    <div className="flex items-center justify-between border-b pb-2 text-xs text-slate-500">
                      <span>نوع العملية:</span>
                      <span className="font-bold text-slate-900 dark:text-slate-100">
                        {OPERATIONS.find(op => op.id === activeModal)?.title}
                      </span>
                    </div>

                    {selectedAccount && (
                      <div className="flex items-center justify-between text-xs">
                        <span>
                          {activeModal === "transfer" ? "حساب المصدر (الخصم):" : "الحساب المستهدف:"}
                        </span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {selectedAccount.name} ({formatMoney(selectedAccount.balance, selectedAccount.currency, 2)})
                        </span>
                      </div>
                    )}

                    {selectedTargetAccount && (
                      <div className="flex items-center justify-between text-xs">
                        <span>حساب الوجهة (الإيداع):</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {selectedTargetAccount.name} ({formatMoney(selectedTargetAccount.balance, selectedTargetAccount.currency, 2)})
                        </span>
                      </div>
                    )}

                    {selectedInstrument && (
                      <div className="flex items-center justify-between text-xs">
                        <span>الأداة الاستثمارية:</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {selectedInstrument.name} ({selectedInstrument.currency})
                        </span>
                      </div>
                    )}

                    {selectedDebt && (
                      <div className="flex items-center justify-between text-xs">
                        <span>عقد الالتزام:</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {selectedDebt.name} (المستحق: {formatMoney(selectedDebt.outstanding, selectedDebt.currency, 2)})
                        </span>
                      </div>
                    )}

                    {/* Amount calculation */}
                    <div className="flex items-center justify-between border-t pt-2 text-sm">
                      <span className="font-medium text-slate-600 dark:text-slate-400">إجمالي القيمة:</span>
                      <span className="font-mono text-base font-bold text-emerald-600 dark:text-emerald-400">
                        {activeModal === "buy" || activeModal === "sell" || activeModal === "fund_redemption" ? (
                          formatMoney(
                            (Number(quantity) * Number(unitPrice) + Number(feeAmount || 0) + Number(taxAmount || 0)).toFixed(2),
                            selectedInstrument?.currency || "EGP",
                            2
                          )
                        ) : (
                          formatMoney(amount, selectedAccount?.currency || "EGP", 2)
                        )}
                      </span>
                    </div>

                    {memo && (
                      <div className="border-t pt-2 text-xs text-slate-500">
                        <span className="font-medium">البيان: </span>
                        <span>{memo}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 rounded-lg bg-emerald-50/70 p-3 text-xs text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                    <ShieldCheck className="size-4 shrink-0 text-emerald-600" />
                    <span>
                      سيتم نشر العملية مباشرة في دفتر الأستاذ بقيد مزدوج متوازن وحفظ سجل التدقيق.
                    </span>
                  </div>
                </div>
              )}

              <DialogFooter className="gap-2 sm:gap-0 pt-2">
                {reviewStep ? (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setReviewStep(false)}
                      disabled={isPending}
                    >
                      تعديل البيانات
                    </Button>
                    <Button
                      type="submit"
                      disabled={isPending}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                    >
                      {isPending && <Loader2 className="ml-2 size-4 animate-spin" />}
                      تأكيد ونشر القيد
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={resetForm}
                      disabled={isPending}
                    >
                      إلغاء
                    </Button>
                    <Button
                      type="submit"
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                    >
                      مراجعة العملية
                    </Button>
                  </>
                )}
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
