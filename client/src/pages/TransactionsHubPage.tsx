import DashboardLayout from "@/components/DashboardLayout";
import PageHeader from "@/components/PageHeader";
import SensitiveValue from "@/components/SensitiveValue";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  ArrowLeft,
  ArrowLeftRight,
  ArrowUpRight,
  BriefcaseBusiness,
  Building2,
  CheckCircle2,
  Clock,
  Coins,
  CreditCard,
  FileText,
  Filter,
  Loader2,
  PlusCircle,
  RefreshCw,
  RotateCcw,
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

type SemanticTone = "emerald" | "amber" | "sky" | "slate";

interface OperationConfig {
  id: OperationType;
  title: string;
  shortDesc: string;
  icon: React.ElementType;
  badge: string;
  tone: SemanticTone;
}

// 1. Primary operations tier: Capital allocation & liquidity inflows
const PRIMARY_OPERATIONS: OperationConfig[] = [
  {
    id: "deposit",
    title: "إيداع / إضافة سيولة",
    shortDesc: "إضافة سيولة نقدية أو بنكية إلى أحد الحسابات مع قيد محاسبي متوازن.",
    icon: ArrowDownLeft,
    badge: "سيولة واردة",
    tone: "emerald",
  },
  {
    id: "buy",
    title: "شراء / استثمار",
    shortDesc: "تنفيذ شراء أسهم أو صناديق أو ذهب مع خصم القيمة وتحديث الحيازة.",
    icon: TrendingUp,
    badge: "استثمار رأسمالي",
    tone: "emerald",
  },
  {
    id: "transfer",
    title: "تحويل بين الحسابات",
    shortDesc: "نقل آمن للقيمة بين حسابين للمستخدم مع قفل مانع للتعارض والرصيد السلبي.",
    icon: ArrowLeftRight,
    badge: "تحويل داخلي",
    tone: "sky",
  },
];

// 2. Secondary operations tier: Liquidations, outflows & debt obligations
const SECONDARY_OPERATIONS: OperationConfig[] = [
  {
    id: "sell",
    title: "بيع أصل / استثمار",
    shortDesc: "بيع حيازة استثمارية مسجلة وإيداع العائد في حساب التسوية.",
    icon: TrendingDown,
    badge: "تسييل أصل",
    tone: "amber",
  },
  {
    id: "withdrawal",
    title: "سحب / مصروف",
    shortDesc: "صرف أو سحب نقدي مع تحديد الحساب والفئة المالية والمذكرة التوثيقية.",
    icon: ArrowUpRight,
    badge: "سيولة صادرة",
    tone: "amber",
  },
  {
    id: "fund_redemption",
    title: "استرداد استثمار / صندوق",
    shortDesc: "استرداد وثائق صندوق استثماري أو تسييل أصل عبر مسار البيع المعتمد.",
    icon: Coins,
    badge: "استرداد وثائق",
    tone: "amber",
  },
  {
    id: "debt_payment",
    title: "سداد دين / التزام",
    shortDesc: "ترحيل سداد التزام (أصل، فائدة، رسوم) بقيد متوازن يقلل رصيد الدين.",
    icon: CreditCard,
    badge: "سداد التزام",
    tone: "slate",
  },
];

const ALL_OPERATIONS: OperationConfig[] = [...PRIMARY_OPERATIONS, ...SECONDARY_OPERATIONS];

// Tone styling dictionary conforming strictly to institutional palette
const TONE_STYLES: Record<
  SemanticTone,
  {
    iconBox: string;
    badge: string;
    cardBorderHover: string;
    accentLine: string;
    actionText: string;
    arrowColor: string;
  }
> = {
  emerald: {
    iconBox:
      "bg-[#ECFDF5] dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25 group-hover:bg-emerald-100/60 dark:group-hover:bg-emerald-900/60",
    badge:
      "bg-[#ECFDF5] dark:bg-emerald-950/50 text-[#0B1628] dark:text-slate-100 border border-emerald-500/30 font-semibold",
    cardBorderHover:
      "hover:border-emerald-500/50 dark:hover:border-emerald-500/40 hover:shadow-emerald-950/10",
    accentLine: "bg-[#10B981]",
    actionText:
      "text-[#0B1628] dark:text-slate-100 font-semibold group-hover:text-emerald-700 dark:group-hover:text-emerald-400",
    arrowColor: "text-emerald-600 dark:text-emerald-400",
  },
  sky: {
    iconBox:
      "bg-[#F0F9FF] dark:bg-sky-950/50 text-sky-600 dark:text-sky-400 border border-sky-500/25 group-hover:bg-sky-100/60 dark:group-hover:bg-sky-900/60",
    badge:
      "bg-[#F0F9FF] dark:bg-sky-950/50 text-[#0B1628] dark:text-slate-100 border border-sky-500/30 font-semibold",
    cardBorderHover:
      "hover:border-sky-500/50 dark:hover:border-sky-500/40 hover:shadow-sky-950/10",
    accentLine: "bg-[#38BDF8]",
    actionText:
      "text-[#0B1628] dark:text-slate-100 font-semibold group-hover:text-sky-700 dark:group-hover:text-sky-400",
    arrowColor: "text-sky-600 dark:text-sky-400",
  },
  amber: {
    iconBox:
      "bg-[#FFFBEB] dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 border border-amber-500/25 group-hover:bg-amber-100/60 dark:group-hover:bg-amber-900/60",
    badge:
      "bg-[#FFFBEB] dark:bg-amber-950/50 text-[#0B1628] dark:text-slate-100 border border-amber-500/30 font-semibold",
    cardBorderHover:
      "hover:border-amber-500/50 dark:hover:border-amber-500/40 hover:shadow-amber-950/10",
    accentLine: "bg-[#F59E0B]",
    actionText:
      "text-[#0B1628] dark:text-slate-100 font-semibold group-hover:text-amber-700 dark:group-hover:text-amber-400",
    arrowColor: "text-amber-600 dark:text-amber-400",
  },
  slate: {
    iconBox:
      "bg-[#F1F5F9] dark:bg-slate-800/50 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 group-hover:bg-slate-200/60 dark:group-hover:bg-slate-700/60",
    badge:
      "bg-[#F1F5F9] dark:bg-slate-800/50 text-[#0B1628] dark:text-slate-100 border border-slate-300 dark:border-slate-700 font-semibold",
    cardBorderHover:
      "hover:border-slate-400 dark:hover:border-slate-500",
    accentLine: "bg-[#64748B]",
    actionText:
      "text-[#0B1628] dark:text-slate-100 font-semibold group-hover:text-slate-900 dark:group-hover:text-slate-200",
    arrowColor: "text-slate-600 dark:text-slate-300",
  },
};

// Event labels for ledger feed
const eventLabel: Record<
  string,
  { label: string; icon: React.ElementType; color: string; sign: string; amountColor: string }
> = {
  deposit: {
    label: "إيداع سيولة",
    icon: ArrowDownLeft,
    color: "text-emerald-600 dark:text-emerald-400 bg-[#ECFDF5] dark:bg-emerald-950/40 border border-emerald-500/25",
    sign: "+",
    amountColor: "text-emerald-700 dark:text-emerald-400",
  },
  opening_balance: {
    label: "رصيد افتتاحي",
    icon: PlusCircle,
    color: "text-sky-600 dark:text-sky-400 bg-[#F0F9FF] dark:bg-sky-950/40 border border-sky-500/25",
    sign: "+",
    amountColor: "text-sky-700 dark:text-sky-400",
  },
  income: {
    label: "دخل مصنف",
    icon: ArrowDownLeft,
    color: "text-emerald-600 dark:text-emerald-400 bg-[#ECFDF5] dark:bg-emerald-950/40 border border-emerald-500/25",
    sign: "+",
    amountColor: "text-emerald-700 dark:text-emerald-400",
  },
  withdrawal: {
    label: "سحب سيولة",
    icon: ArrowUpRight,
    color: "text-amber-600 dark:text-amber-400 bg-[#FFFBEB] dark:bg-amber-950/40 border border-amber-500/25",
    sign: "-",
    amountColor: "text-[#0B1628] dark:text-slate-100",
  },
  expense: {
    label: "مصروف مصنف",
    icon: ArrowUpRight,
    color: "text-amber-600 dark:text-amber-400 bg-[#FFFBEB] dark:bg-amber-950/40 border border-amber-500/25",
    sign: "-",
    amountColor: "text-[#0B1628] dark:text-slate-100",
  },
  transfer: {
    label: "تحويل داخلي",
    icon: ArrowLeftRight,
    color: "text-sky-600 dark:text-sky-400 bg-[#F0F9FF] dark:bg-sky-950/40 border border-sky-500/25",
    sign: "⇄",
    amountColor: "text-[#0B1628] dark:text-slate-100",
  },
  buy: {
    label: "شراء استثمار",
    icon: TrendingUp,
    color: "text-emerald-600 dark:text-emerald-400 bg-[#ECFDF5] dark:bg-emerald-950/40 border border-emerald-500/25",
    sign: "-",
    amountColor: "text-[#0B1628] dark:text-slate-100",
  },
  sell: {
    label: "بيع / تسييل",
    icon: TrendingDown,
    color: "text-amber-600 dark:text-amber-400 bg-[#FFFBEB] dark:bg-amber-950/40 border border-amber-500/25",
    sign: "+",
    amountColor: "text-[#0B1628] dark:text-slate-100",
  },
  debt_payment: {
    label: "سداد دين",
    icon: CreditCard,
    color: "text-slate-700 dark:text-slate-300 bg-[#F1F5F9] dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700",
    sign: "-",
    amountColor: "text-[#0B1628] dark:text-slate-100",
  },
};

export default function TransactionsHubPage() {
  const utils = trpc.useUtils();

  // Existing queries (zero modifications to backend or contracts)
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

  // Filter state for recent transactions feed
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [accountFilter, setAccountFilter] = useState<string>("all");

  // Invalidate all related financial read queries
  const invalidateAll = () => {
    void utils.family.dashboard.invalidate();
    void utils.family.accounts.list.invalidate();
    void utils.family.ledger.recent.invalidate();
    void utils.family.cashFlow.summary.invalidate();
    void utils.family.portfolio.list.invalidate();
    void utils.family.debts.list.invalidate();
  };

  // Reset form state
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

  // Selected entities for dialogs
  const selectedAccount = (accounts.data ?? []).find(a => String(a.id) === primaryAccountId);
  const selectedTargetAccount = (accounts.data ?? []).find(a => String(a.id) === targetAccountId);
  const selectedInstrument = (instruments.data ?? []).find(i => String(i.id) === instrumentId);
  const selectedDebt = (debts.data ?? []).find(d => String(d.id) === debtId);

  // Eligible cash/settlement accounts
  const cashAccounts = (accounts.data ?? []).filter(
    a => ["cash", "bank", "brokerage", "wallet"].includes(a.accountType) && a.status === "active"
  );

  // Map of account ID to name for fast table lookup
  const accountMap = useMemo(() => {
    const map = new Map<number, { name: string; currency: string }>();
    (accounts.data ?? []).forEach(a => map.set(a.id, { name: a.name, currency: a.currency }));
    return map;
  }, [accounts.data]);

  // Eligible fund/investment instruments
  const fundInstruments = (instruments.data ?? []).filter(i =>
    ["fund", "equity", "gold", "bond"].includes(i.assetType)
  );

  // Execute operation handler
  const handleExecute = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewStep) {
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
    if (accountFilter !== "all") {
      list = list.filter(e => String(e.primaryAccountId) === accountFilter);
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
  }, [recentEvents.data, typeFilter, accountFilter, searchQuery]);

  // Operational metrics computed purely from existing loaded data
  const hasActiveFilters = searchQuery !== "" || typeFilter !== "all" || accountFilter !== "all";

  return (
    <DashboardLayout>
      <div dir="rtl" className="mx-auto max-w-7xl space-y-7">
        {/* Executive Header / Hero */}
        <PageHeader
          title="المعاملات المالية"
          description="إدارة وتنفيذ ومراجعة جميع العمليات المالية والاستثمارية"
          breadcrumbs={[
            { label: "الرئيسية", href: "/" },
            { label: "النقد والالتزامات", href: "/transactions" },
            { label: "المعاملات المالية" },
          ]}
          badge={
            <div className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-[#0B1628] dark:text-slate-100">
              <span className="relative flex size-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
              </span>
              <span>مركز العمليات المعتمد</span>
            </div>
          }
          icon={ArrowLeftRight}
          actions={
            <Button
              variant="outline"
              size="sm"
              onClick={invalidateAll}
              disabled={recentEvents.isFetching}
              className="h-9 gap-2 border-border/80 text-xs hover:border-emerald-500/40 hover:bg-emerald-500/5 hover:text-emerald-600 dark:hover:text-emerald-400"
            >
              <RefreshCw className={`size-3.5 ${recentEvents.isFetching ? "animate-spin text-emerald-500" : ""}`} />
              <span>تحديث البيانات</span>
            </Button>
          }
        />

        {/* Operational Context KPI Section */}
        <section className="rounded-2xl border border-[#E2E8F0] dark:border-border bg-[#EEF2F6] dark:bg-card/40 p-4 sm:p-5 shadow-2xs">
          <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-4 sm:gap-4">
            <div className="rounded-xl border border-[#E2E8F0] dark:border-border bg-[#FFFFFF] dark:bg-card p-4 shadow-xs transition-all hover:shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs text-[#64748B] dark:text-muted-foreground">حسابات التسوية</span>
                <Wallet className="size-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <p className="mt-1 font-mono text-xl font-bold text-[#0B1628] dark:text-foreground">
                {cashAccounts.length}
              </p>
              <span className="text-[11px] text-[#64748B] dark:text-muted-foreground">حسابات نقدية نشطة</span>
            </div>

            <div className="rounded-xl border border-[#E2E8F0] dark:border-border bg-[#FFFFFF] dark:bg-card p-4 shadow-xs transition-all hover:shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs text-[#64748B] dark:text-muted-foreground">أدوات الاستثمار</span>
                <TrendingUp className="size-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <p className="mt-1 font-mono text-xl font-bold text-[#0B1628] dark:text-foreground">
                {fundInstruments.length}
              </p>
              <span className="text-[11px] text-[#64748B] dark:text-muted-foreground">أدوات وصناديق متاحة</span>
            </div>

            <div className="rounded-xl border border-[#E2E8F0] dark:border-border bg-[#FFFFFF] dark:bg-card p-4 shadow-xs transition-all hover:shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs text-[#64748B] dark:text-muted-foreground">الالتزامات النشطة</span>
                <CreditCard className="size-4 text-[#64748B] dark:text-slate-400" />
              </div>
              <p className="mt-1 font-mono text-xl font-bold text-[#0B1628] dark:text-foreground">
                {(debts.data ?? []).filter(d => d.status === "active").length}
              </p>
              <span className="text-[11px] text-[#64748B] dark:text-muted-foreground">ديون قابلة للسداد</span>
            </div>

            <div className="rounded-xl border border-[#E2E8F0] dark:border-border bg-[#FFFFFF] dark:bg-card p-4 shadow-xs transition-all hover:shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs text-[#64748B] dark:text-muted-foreground">القيود الأخيرة</span>
                <ShieldCheck className="size-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <p className="mt-1 font-mono text-xl font-bold text-[#0B1628] dark:text-foreground">
                {recentEvents.data?.length ?? 0}
              </p>
              <span className="text-[11px] font-medium text-[#0B1628] dark:text-slate-200">دفتر أستاذ متوازن</span>
            </div>
          </div>
        </section>

        {/* Section: Execution of Operations inside soft institutional wrapper */}
        <section className="rounded-2xl border border-[#E2E8F0] dark:border-border bg-[#EEF2F6] dark:bg-card/40 p-5 sm:p-6 shadow-2xs space-y-5" aria-labelledby="operations-heading">
          <div className="flex items-center justify-between border-b border-[#E2E8F0] dark:border-border/60 pb-3.5">
            <div>
              <h2 id="operations-heading" className="flex items-center gap-2 text-base font-bold text-[#0B1628] dark:text-foreground sm:text-lg">
                <BriefcaseBusiness className="size-5 text-emerald-600 dark:text-emerald-400" />
                <span>تنفيذ معاملة</span>
              </h2>
              <p className="mt-0.5 text-xs text-[#64748B] dark:text-muted-foreground">
                اختر نوع العملية المالية أو الاستثمارية المراد تسجيلها وترحيلها
              </p>
            </div>
            <span className="rounded-md border border-[#E2E8F0] dark:border-border bg-[#FFFFFF] dark:bg-card px-2.5 py-1 text-[11px] font-medium text-[#64748B] dark:text-muted-foreground shadow-2xs">
              7 مسارات عمليات معتمدة
            </span>
          </div>

          {/* Row 1: Primary Inflow & Capital Allocation (3 visually dominant tiles) */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-[11px] font-bold tracking-wider text-[#64748B] dark:text-muted-foreground">
              <span className="size-2 rounded-full bg-emerald-500" />
              <span>المعاملات الرأسمالية وإدارة السيولة الأساسية</span>
            </div>
            <div className="grid grid-cols-1 gap-3.5 sm:gap-4 md:grid-cols-3">
              {PRIMARY_OPERATIONS.map(op => {
                const Icon = op.icon;
                const style = TONE_STYLES[op.tone];
                return (
                  <div
                    key={op.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      setActiveModal(op.id);
                      setReviewStep(false);
                    }}
                    onKeyDown={e => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setActiveModal(op.id);
                        setReviewStep(false);
                      }
                    }}
                    className={`group relative flex cursor-pointer flex-col justify-between overflow-hidden rounded-xl border border-[#E2E8F0] dark:border-border bg-[#FFFFFF] dark:bg-card p-5 shadow-xs transition-all duration-200 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-emerald-500 ${style.cardBorderHover} hover:-translate-y-1 hover:shadow-sm`}
                  >
                    {/* Top subtle highlight line */}
                    <div className={`absolute inset-x-0 top-0 h-1 opacity-90 ${style.accentLine}`} />

                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div className={`flex size-12 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-105 ${style.iconBox}`}>
                          <Icon className="size-6" />
                        </div>
                        <Badge variant="outline" className={`text-[11px] font-medium ${style.badge}`}>
                          {op.badge}
                        </Badge>
                      </div>

                      <h3 className="mt-3.5 text-base font-bold text-[#0B1628] dark:text-foreground">
                        {op.title}
                      </h3>
                      <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-[#64748B] dark:text-muted-foreground">
                        {op.shortDesc}
                      </p>
                    </div>

                    <div className="mt-4 flex items-center justify-between border-t border-[#E2E8F0] dark:border-border/50 pt-3 text-xs font-semibold">
                      <span className={style.actionText}>بدء العملية</span>
                      <ArrowLeft className={`size-3.5 transition-transform duration-200 group-hover:-translate-x-1 ${style.arrowColor}`} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Row 2: Liquidations, Outflows & Debt Obligations (4 structured tiles) */}
          <div className="space-y-2 pt-1">
            <div className="flex items-center gap-1.5 text-[11px] font-bold tracking-wider text-[#64748B] dark:text-muted-foreground">
              <span className="size-2 rounded-full bg-amber-500" />
              <span>عمليات التسييل والمصروفات والالتزامات</span>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
              {SECONDARY_OPERATIONS.map(op => {
                const Icon = op.icon;
                const style = TONE_STYLES[op.tone];
                return (
                  <div
                    key={op.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      setActiveModal(op.id);
                      setReviewStep(false);
                    }}
                    onKeyDown={e => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setActiveModal(op.id);
                        setReviewStep(false);
                      }
                    }}
                    className={`group relative flex cursor-pointer flex-col justify-between overflow-hidden rounded-xl border border-[#E2E8F0] dark:border-border bg-[#FFFFFF] dark:bg-card p-4 shadow-xs transition-all duration-200 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-emerald-500 ${style.cardBorderHover} hover:-translate-y-0.5 hover:shadow-sm`}
                  >
                    {/* Top subtle highlight line */}
                    <div className={`absolute inset-x-0 top-0 h-0.5 opacity-80 ${style.accentLine}`} />

                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div className={`flex size-10 items-center justify-center rounded-lg transition-transform duration-200 group-hover:scale-105 ${style.iconBox}`}>
                          <Icon className="size-5" />
                        </div>
                        <Badge variant="outline" className={`text-[10.5px] ${style.badge}`}>
                          {op.badge}
                        </Badge>
                      </div>

                      <h3 className="mt-2.5 text-sm font-bold text-[#0B1628] dark:text-foreground">
                        {op.title}
                      </h3>
                      <p className="mt-1 line-clamp-2 text-[11.5px] leading-relaxed text-[#64748B] dark:text-muted-foreground">
                        {op.shortDesc}
                      </p>
                    </div>

                    <div className="mt-3 flex items-center justify-between border-t border-[#E2E8F0] dark:border-border/40 pt-2.5 text-xs font-medium">
                      <span className={style.actionText}>بدء العملية</span>
                      <ArrowLeft className={`size-3 transition-transform duration-200 group-hover:-translate-x-1 ${style.arrowColor}`} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Section: Transactions Ledger Feed inside soft institutional wrapper */}
        <section className="rounded-2xl border border-[#E2E8F0] dark:border-border bg-[#EEF2F6] dark:bg-card/40 p-5 sm:p-6 shadow-2xs space-y-4" aria-labelledby="history-heading">
          <div className="flex flex-col gap-3 rounded-xl border border-[#E2E8F0] dark:border-border bg-[#F8FAFC] dark:bg-card p-4 shadow-2xs sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 id="history-heading" className="flex items-center gap-2 text-base font-bold text-[#0B1628] dark:text-foreground sm:text-lg">
                <FileText className="size-5 text-emerald-600 dark:text-emerald-400" />
                <span>سجل المعاملات</span>
              </h2>
              <p className="mt-0.5 text-xs text-[#64748B] dark:text-muted-foreground">
                عرض ومراجعة العمليات المالية المسجلة في دفتر الأستاذ
              </p>
            </div>

            {/* Compact, responsive RTL Toolbar */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-44 flex-1 sm:flex-initial">
                <Search className="pointer-events-none absolute right-3 top-2.5 size-3.5 text-[#64748B] dark:text-muted-foreground" />
                <Input
                  placeholder="بحث في البيان أو المبلغ..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="h-9 pr-9 text-xs bg-[#FFFFFF] dark:bg-card border-[#E2E8F0] dark:border-border"
                />
              </div>

              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="h-9 w-32 text-xs bg-[#FFFFFF] dark:bg-card border-[#E2E8F0] dark:border-border">
                  <Filter className="ml-1 size-3 text-[#64748B] dark:text-muted-foreground" />
                  <SelectValue placeholder="نوع المعاملة" />
                </SelectTrigger>
                <SelectContent align="end">
                  <SelectItem value="all">كل العمليات</SelectItem>
                  <SelectItem value="cash_in">إيداع ودخل (+)</SelectItem>
                  <SelectItem value="cash_out">سحب ومصروف (-)</SelectItem>
                  <SelectItem value="transfer">تحويل داخلي (⇄)</SelectItem>
                  <SelectItem value="trade">تداول واستثمار</SelectItem>
                  <SelectItem value="debt">سداد التزامات</SelectItem>
                </SelectContent>
              </Select>

              {cashAccounts.length > 0 && (
                <Select value={accountFilter} onValueChange={setAccountFilter}>
                  <SelectTrigger className="h-9 w-32 text-xs bg-[#FFFFFF] dark:bg-card border-[#E2E8F0] dark:border-border">
                    <Building2 className="ml-1 size-3 text-[#64748B] dark:text-muted-foreground" />
                    <SelectValue placeholder="الحساب" />
                  </SelectTrigger>
                  <SelectContent align="end">
                    <SelectItem value="all">كل الحسابات</SelectItem>
                    {cashAccounts.map(acc => (
                      <SelectItem key={acc.id} value={String(acc.id)}>
                        {acc.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSearchQuery("");
                    setTypeFilter("all");
                    setAccountFilter("all");
                  }}
                  className="h-9 px-2.5 text-xs text-[#64748B] hover:text-[#0B1628] dark:text-muted-foreground dark:hover:text-foreground"
                  title="إعادة تعيين الفلاتر"
                >
                  <RotateCcw className="size-3.5" />
                  <span className="sr-only sm:not-sr-only sm:mr-1">إعادة ضبط</span>
                </Button>
              )}

              <Badge variant="outline" className="h-9 border-[#E2E8F0] dark:border-border bg-[#FFFFFF] dark:bg-card px-2.5 text-xs font-normal text-[#64748B] dark:text-muted-foreground shadow-2xs">
                {filteredEvents.length} عملية
              </Badge>
            </div>
          </div>

          {/* Transactions Table Container */}
          <div className="overflow-hidden rounded-xl border border-[#E2E8F0] dark:border-border bg-[#FFFFFF] dark:bg-card shadow-xs">
            {recentEvents.isLoading ? (
              <div className="space-y-3 p-6">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : filteredEvents.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 text-center">
                <div className="flex size-13 items-center justify-center rounded-full border border-[#E2E8F0] dark:border-border bg-[#EEF2F6] dark:bg-muted/40 text-[#64748B] dark:text-muted-foreground">
                  <FileText className="size-6 text-[#64748B]/80 dark:text-muted-foreground/80" />
                </div>
                <h3 className="mt-4 text-base font-bold text-[#0B1628] dark:text-foreground">
                  {hasActiveFilters ? "لا توجد نتائج تطابق خيارات البحث" : "لا توجد معاملات حتى الآن"}
                </h3>
                <p className="mt-1 max-w-sm text-xs text-[#64748B] dark:text-muted-foreground">
                  {hasActiveFilters
                    ? "جرّب تعديل كلمات البحث أو تصفير الفلاتر لعرض كافة القيود المسجلة."
                    : "ابدأ بإضافة أول معاملة مالية إلى حسابك من أزرار العمليات أعلاه."}
                </p>
                {hasActiveFilters ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSearchQuery("");
                      setTypeFilter("all");
                      setAccountFilter("all");
                    }}
                    className="mt-4 gap-1.5 text-xs border-[#E2E8F0] dark:border-border bg-[#FFFFFF] dark:bg-card"
                  >
                    <RotateCcw className="size-3.5" />
                    إعادة ضبط التصفية
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setActiveModal("deposit");
                      setReviewStep(false);
                    }}
                    className="mt-4 gap-1.5 border-emerald-500/40 text-xs font-medium text-[#0B1628] bg-emerald-50/50 hover:bg-emerald-500/10 dark:text-slate-100 dark:bg-transparent"
                  >
                    <ArrowDownLeft className="size-3.5" />
                    تسجيل إيداع جديد
                  </Button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-right text-sm">
                  <thead className="border-b border-[#E2E8F0] dark:border-border bg-[#F8FAFC] dark:bg-muted/50 text-[11.5px] font-semibold text-[#0B1628] dark:text-foreground">
                    <tr>
                      <th className="p-3.5 pr-5">نوع العملية</th>
                      <th className="p-3.5">الحساب المالي</th>
                      <th className="p-3.5">التاريخ والوقت</th>
                      <th className="p-3.5">البيان والملاحظات</th>
                      <th className="p-3.5">المبلغ الإجمالي</th>
                      <th className="p-3.5 pl-5">حالة القيد</th>
                    </tr>
                  </thead>
                  <tbody className="bg-[#FFFFFF] dark:bg-card divide-y divide-[#E2E8F0] dark:divide-border/60">
                    {filteredEvents.map(event => {
                      const meta = eventLabel[event.eventType] || {
                        label: event.eventType,
                        icon: ArrowLeftRight,
                        color: "text-[#64748B] dark:text-muted-foreground bg-[#EEF2F6] dark:bg-muted/40 border border-[#E2E8F0] dark:border-border",
                        sign: "",
                        amountColor: "text-[#0B1628] dark:text-foreground",
                      };
                      const Icon = meta.icon;
                      const formattedAmount = formatMoney(event.grossAmount, event.currency, 2);
                      const accountInfo = event.primaryAccountId ? accountMap.get(event.primaryAccountId) : null;

                      return (
                        <tr
                          key={event.id}
                          className="transition-colors hover:bg-[#F8FAFC] dark:hover:bg-muted/30"
                        >
                          {/* Type Column */}
                          <td className="p-3.5 pr-5">
                            <div className="flex items-center gap-2.5">
                              <div className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${meta.color}`}>
                                <Icon className="size-4" />
                              </div>
                              <div>
                                <p className="font-semibold text-[#0B1628] dark:text-foreground">
                                  {meta.label}
                                </p>
                                <p className="font-mono text-[11px] text-[#64748B] dark:text-muted-foreground">
                                  #{event.id}
                                </p>
                              </div>
                            </div>
                          </td>

                          {/* Account Column */}
                          <td className="p-3.5">
                            <div className="text-xs">
                              <p className="font-medium text-[#0B1628] dark:text-foreground">
                                {accountInfo?.name || "حساب المعاملة"}
                              </p>
                              <p className="font-mono text-[11px] text-[#64748B] dark:text-muted-foreground">
                                {event.currency}
                              </p>
                            </div>
                          </td>

                          {/* Date Column */}
                          <td className="p-3.5 text-xs text-[#64748B] dark:text-muted-foreground">
                            <div className="flex items-center gap-1.5 font-mono">
                              <Clock className="size-3 text-[#64748B]/70 dark:text-muted-foreground/70" />
                              <span>{new Date(event.occurredAt).toLocaleString("en-GB")}</span>
                            </div>
                          </td>

                          {/* Memo Column */}
                          <td className="max-w-xs p-3.5 text-xs text-[#64748B] dark:text-muted-foreground">
                            <span className="truncate block" title={event.memo || ""}>
                              {event.memo || "—"}
                            </span>
                          </td>

                          {/* Amount Column */}
                          <td className="p-3.5">
                            <div className="font-mono text-sm font-bold tracking-tight">
                              <span className={meta.amountColor}>
                                {meta.sign} <SensitiveValue>{formattedAmount}</SensitiveValue>
                              </span>
                            </div>
                          </td>

                          {/* Status Badge */}
                          <td className="p-3.5 pl-5">
                            <Badge
                              variant="outline"
                              className="gap-1 border-emerald-500/30 bg-emerald-500/10 text-[11px] font-medium text-[#0B1628] dark:text-slate-100"
                            >
                              <ShieldCheck className="size-3 text-emerald-600 dark:text-emerald-400" />
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
          </div>
        </section>

        {/* Institutional Operation Dialog & Review Summary */}
        <Dialog open={activeModal !== null} onOpenChange={open => !open && resetForm()}>
          <DialogContent className="max-w-xl sm:max-w-xl w-full overflow-hidden border-border bg-card" dir="rtl">
            <DialogHeader className="border-b border-border/60 pb-3">
              <div className="flex items-center justify-between">
                <DialogTitle className="flex items-center gap-2 text-lg font-bold text-foreground">
                  {activeModal && (
                    <>
                      {React.createElement(
                        ALL_OPERATIONS.find(op => op.id === activeModal)?.icon || ArrowLeftRight,
                        {
                          className: `size-5 ${
                            TONE_STYLES[ALL_OPERATIONS.find(op => op.id === activeModal)?.tone || "emerald"].arrowColor
                          }`,
                        }
                      )}
                      <span>{ALL_OPERATIONS.find(op => op.id === activeModal)?.title}</span>
                    </>
                  )}
                </DialogTitle>
                {activeModal && (
                  <Badge
                    variant="outline"
                    className={`text-[11px] ${
                      TONE_STYLES[ALL_OPERATIONS.find(op => op.id === activeModal)?.tone || "emerald"].badge
                    }`}
                  >
                    {ALL_OPERATIONS.find(op => op.id === activeModal)?.badge}
                  </Badge>
                )}
              </div>
              <DialogDescription className="text-xs text-muted-foreground mt-1">
                {reviewStep
                  ? "راجع تفاصيل العملية قبل تأكيد الترحيل النهائي إلى دفتر الأستاذ."
                  : ALL_OPERATIONS.find(op => op.id === activeModal)?.shortDesc}
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleExecute} className="space-y-4 pt-1">
              {!reviewStep ? (
                <>
                  {/* Operation: Deposit or Withdrawal */}
                  {(activeModal === "deposit" || activeModal === "withdrawal") && (
                    <>
                      <div className="grid gap-2 min-w-0">
                        <Label className="text-xs font-semibold">الحساب المالي</Label>
                        <Select value={primaryAccountId} onValueChange={setPrimaryAccountId} required>
                          <SelectTrigger className="w-full min-w-0 justify-between overflow-hidden">
                            <SelectValue placeholder="اختر الحساب المستهدف" className="truncate" />
                          </SelectTrigger>
                          <SelectContent className="max-w-[calc(100vw-2rem)] w-[var(--radix-select-trigger-width)]">
                            {cashAccounts.map(account => (
                              <SelectItem key={account.id} value={String(account.id)}>
                                <span className="truncate">{account.name} — الرصيد: {formatMoney(account.balance, account.currency, 2)}</span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="grid gap-2 min-w-0">
                          <Label htmlFor="tx-amount" className="text-xs font-semibold">
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
                            className="w-full"
                            required
                          />
                        </div>
                        <div className="grid gap-2 min-w-0">
                          <Label className="text-xs font-semibold">تصنيف التدفق (اختياري)</Label>
                          <Select value={categoryId} onValueChange={setCategoryId}>
                            <SelectTrigger className="w-full min-w-0 justify-between overflow-hidden">
                              <SelectValue placeholder="اختر تصنيفاً" className="truncate" />
                            </SelectTrigger>
                            <SelectContent className="max-w-[calc(100vw-2rem)] w-[var(--radix-select-trigger-width)]">
                              {(categories.data ?? [])
                                .filter(c =>
                                  activeModal === "deposit" ? c.direction === "income" : c.direction === "expense"
                                )
                                .map(c => (
                                  <SelectItem key={c.id} value={String(c.id)}>
                                    <span className="truncate">{c.name}</span>
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="grid gap-2 min-w-0">
                        <Label htmlFor="tx-memo" className="text-xs font-semibold">مذكرة أو بيان العملية</Label>
                        <Textarea
                          id="tx-memo"
                          value={memo}
                          onChange={e => setMemo(e.target.value)}
                          placeholder="ملاحظات توثيقية إضافية للتدقيق..."
                          rows={2}
                          maxLength={2000}
                          className="w-full"
                        />
                      </div>
                    </>
                  )}

                  {/* Operation: Internal Transfer */}
                  {activeModal === "transfer" && (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="grid gap-2 min-w-0">
                          <Label className="text-xs font-semibold">من الحساب (المصدر)</Label>
                          <Select value={primaryAccountId} onValueChange={setPrimaryAccountId} required>
                            <SelectTrigger className="w-full min-w-0 justify-between overflow-hidden">
                              <SelectValue placeholder="حساب الخصم" className="truncate" />
                            </SelectTrigger>
                            <SelectContent className="max-w-[calc(100vw-2rem)] w-[var(--radix-select-trigger-width)]">
                              {cashAccounts.map(account => (
                                <SelectItem key={account.id} value={String(account.id)}>
                                  <span className="truncate">{account.name} ({formatMoney(account.balance, account.currency, 2)})</span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid gap-2 min-w-0">
                          <Label className="text-xs font-semibold">إلى الحساب (الوجهة)</Label>
                          <Select value={targetAccountId} onValueChange={setTargetAccountId} required>
                            <SelectTrigger className="w-full min-w-0 justify-between overflow-hidden">
                              <SelectValue placeholder="حساب الإيداع" className="truncate" />
                            </SelectTrigger>
                            <SelectContent className="max-w-[calc(100vw-2rem)] w-[var(--radix-select-trigger-width)]">
                              {cashAccounts
                                .filter(account => String(account.id) !== primaryAccountId)
                                .map(account => (
                                  <SelectItem key={account.id} value={String(account.id)}>
                                    <span className="truncate">{account.name} ({formatMoney(account.balance, account.currency, 2)})</span>
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="grid gap-2 min-w-0">
                        <Label htmlFor="tr-amount" className="text-xs font-semibold">
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
                          className="w-full"
                          required
                        />
                      </div>

                      <div className="grid gap-2 min-w-0">
                        <Label htmlFor="tr-memo" className="text-xs font-semibold">بيان التحويل</Label>
                        <Textarea
                          id="tr-memo"
                          value={memo}
                          onChange={e => setMemo(e.target.value)}
                          placeholder="مذكرة التحويل الداخلي..."
                          rows={2}
                          maxLength={2000}
                          className="w-full"
                        />
                      </div>
                    </>
                  )}

                  {/* Operation: Buy / Sell / Fund Redemption */}
                  {(activeModal === "buy" ||
                    activeModal === "sell" ||
                    activeModal === "fund_redemption") && (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="grid gap-2 min-w-0">
                          <Label className="text-xs font-semibold">حساب التسوية النقدية</Label>
                          <Select value={primaryAccountId} onValueChange={setPrimaryAccountId} required>
                            <SelectTrigger className="w-full min-w-0 justify-between overflow-hidden">
                              <SelectValue placeholder="اختر الحساب النقدي" className="truncate" />
                            </SelectTrigger>
                            <SelectContent className="max-w-[calc(100vw-2rem)] w-[var(--radix-select-trigger-width)]">
                              {cashAccounts.map(account => (
                                <SelectItem key={account.id} value={String(account.id)}>
                                  <span className="truncate">{account.name} ({formatMoney(account.balance, account.currency, 2)})</span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid gap-2 min-w-0">
                          <Label className="text-xs font-semibold">
                            {activeModal === "fund_redemption"
                              ? "الصندوق / الأداة الاستثمارية"
                              : "الأداة الاستثمارية"}
                          </Label>
                          <Select value={instrumentId} onValueChange={setInstrumentId} required>
                            <SelectTrigger className="w-full min-w-0 justify-between overflow-hidden">
                              <SelectValue placeholder="اختر الأداة" className="truncate" />
                            </SelectTrigger>
                            <SelectContent className="max-w-[calc(100vw-2rem)] w-[var(--radix-select-trigger-width)]">
                              {(activeModal === "fund_redemption"
                                ? fundInstruments
                                : instruments.data ?? []
                              ).map(inst => (
                                <SelectItem key={inst.id} value={String(inst.id)}>
                                  <span className="truncate">{inst.name} ({inst.symbol || inst.assetType}) — {inst.currency}</span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="grid gap-2 min-w-0">
                          <Label htmlFor="tr-qty" className="text-xs font-semibold">الكمية / عدد الوثائق</Label>
                          <Input
                            id="tr-qty"
                            type="number"
                            step="any"
                            min="0.0001"
                            value={quantity}
                            onChange={e => setQuantity(e.target.value)}
                            placeholder="0"
                            className="w-full"
                            required
                          />
                        </div>
                        <div className="grid gap-2 min-w-0">
                          <Label htmlFor="tr-price" className="text-xs font-semibold">
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
                            className="w-full"
                            required
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="grid gap-2 min-w-0">
                          <Label htmlFor="tr-fees" className="text-xs font-semibold">رسوم المعاملة (اختياري)</Label>
                          <Input
                            id="tr-fees"
                            type="number"
                            step="any"
                            min="0"
                            value={feeAmount}
                            onChange={e => setFeeAmount(e.target.value)}
                            placeholder="0.00"
                            className="w-full"
                          />
                        </div>
                        <div className="grid gap-2 min-w-0">
                          <Label htmlFor="tr-tax" className="text-xs font-semibold">الضرائب (اختياري)</Label>
                          <Input
                            id="tr-tax"
                            type="number"
                            step="any"
                            min="0"
                            value={taxAmount}
                            onChange={e => setTaxAmount(e.target.value)}
                            placeholder="0.00"
                            className="w-full"
                          />
                        </div>
                      </div>

                      <div className="grid gap-2 min-w-0">
                        <Label htmlFor="tr-memo" className="text-xs font-semibold">بيان الصفقة</Label>
                        <Textarea
                          id="tr-memo"
                          value={memo}
                          onChange={e => setMemo(e.target.value)}
                          placeholder="ملاحظات توثيق الصفقة..."
                          rows={2}
                          maxLength={2000}
                          className="w-full"
                        />
                      </div>
                    </>
                  )}

                  {/* Operation: Debt Payment */}
                  {activeModal === "debt_payment" && (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="grid gap-2 min-w-0">
                          <Label className="text-xs font-semibold">الالتزام / القرض المستحق</Label>
                          <Select value={debtId} onValueChange={setDebtId} required>
                            <SelectTrigger className="w-full min-w-0 justify-between overflow-hidden">
                              <SelectValue placeholder="اختر الالتزام" className="truncate" />
                            </SelectTrigger>
                            <SelectContent className="max-w-[calc(100vw-2rem)] w-[var(--radix-select-trigger-width)]">
                              {(debts.data ?? [])
                                .filter(d => d.status === "active")
                                .map(d => (
                                  <SelectItem key={d.id} value={String(d.id)}>
                                    <span className="truncate">{d.name} — المستحق: {formatMoney(d.outstanding, d.currency, 2)}</span>
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid gap-2 min-w-0">
                          <Label className="text-xs font-semibold">حساب السداد</Label>
                          <Select value={primaryAccountId} onValueChange={setPrimaryAccountId} required>
                            <SelectTrigger className="w-full min-w-0 justify-between overflow-hidden">
                              <SelectValue placeholder="اختر حساب الخصم" className="truncate" />
                            </SelectTrigger>
                            <SelectContent className="max-w-[calc(100vw-2rem)] w-[var(--radix-select-trigger-width)]">
                              {cashAccounts.map(account => (
                                <SelectItem key={account.id} value={String(account.id)}>
                                  <span className="truncate">{account.name} ({formatMoney(account.balance, account.currency, 2)})</span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="grid gap-2 min-w-0">
                          <Label htmlFor="dp-principal" className="text-xs font-semibold">مبلغ الأصل المسدد</Label>
                          <Input
                            id="dp-principal"
                            type="number"
                            step="any"
                            min="0.01"
                            value={amount}
                            onChange={e => setAmount(e.target.value)}
                            placeholder="0.00"
                            className="w-full"
                            required
                          />
                        </div>
                        <div className="grid gap-2 min-w-0">
                          <Label htmlFor="dp-interest" className="text-xs font-semibold">الفائدة (إن وجدت)</Label>
                          <Input
                            id="dp-interest"
                            type="number"
                            step="any"
                            min="0"
                            value={interestAmount}
                            onChange={e => setInterestAmount(e.target.value)}
                            placeholder="0.00"
                            className="w-full"
                          />
                        </div>
                        <div className="grid gap-2 min-w-0">
                          <Label htmlFor="dp-fee" className="text-xs font-semibold">رسوم السداد</Label>
                          <Input
                            id="dp-fee"
                            type="number"
                            step="any"
                            min="0"
                            value={feeAmount}
                            onChange={e => setFeeAmount(e.target.value)}
                            placeholder="0.00"
                            className="w-full"
                          />
                        </div>
                      </div>

                      <div className="grid gap-2 min-w-0">
                        <Label htmlFor="dp-memo" className="text-xs font-semibold">مذكرة السداد</Label>
                        <Textarea
                          id="dp-memo"
                          value={memo}
                          onChange={e => setMemo(e.target.value)}
                          placeholder="رقم مرجع السداد أو ملاحظة..."
                          rows={2}
                          maxLength={2000}
                          className="w-full"
                        />
                      </div>
                    </>
                  )}
                </>
              ) : (
                /* Step 2: Elevated Institutional Review Summary */
                <div className="space-y-4 py-1">
                  <div className="rounded-xl border border-border/80 bg-muted/30 p-4 space-y-3">
                    <div className="flex items-center justify-between border-b border-border/60 pb-2 text-xs text-muted-foreground">
                      <span>نوع العملية المسجلة:</span>
                      <span className="font-bold text-foreground">
                        {ALL_OPERATIONS.find(op => op.id === activeModal)?.title}
                      </span>
                    </div>

                    {selectedAccount && (
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">
                          {activeModal === "transfer" ? "حساب المصدر (الخصم):" : "حساب التسوية / الخصم:"}
                        </span>
                        <span className="font-semibold text-foreground">
                          {selectedAccount.name} ({formatMoney(selectedAccount.balance, selectedAccount.currency, 2)})
                        </span>
                      </div>
                    )}

                    {selectedTargetAccount && (
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">حساب الوجهة (الإيداع):</span>
                        <span className="font-semibold text-foreground">
                          {selectedTargetAccount.name} ({formatMoney(selectedTargetAccount.balance, selectedTargetAccount.currency, 2)})
                        </span>
                      </div>
                    )}

                    {selectedInstrument && (
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">الأداة الاستثمارية:</span>
                        <span className="font-semibold text-foreground">
                          {selectedInstrument.name} ({selectedInstrument.currency})
                        </span>
                      </div>
                    )}

                    {selectedDebt && (
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">عقد الالتزام:</span>
                        <span className="font-semibold text-foreground">
                          {selectedDebt.name} (المستحق: {formatMoney(selectedDebt.outstanding, selectedDebt.currency, 2)})
                        </span>
                      </div>
                    )}

                    {/* Breakdown for trade operations */}
                    {(activeModal === "buy" || activeModal === "sell" || activeModal === "fund_redemption") && (
                      <div className="space-y-1.5 border-t border-border/60 pt-2 text-xs">
                        <div className="flex items-center justify-between text-muted-foreground">
                          <span>القيمة الأساسية ({quantity} × {unitPrice}):</span>
                          <span className="font-mono font-medium text-foreground">
                            {formatMoney(
                              (Number(quantity || 0) * Number(unitPrice || 0)).toFixed(2),
                              selectedInstrument?.currency || "EGP",
                              2
                            )}
                          </span>
                        </div>
                        {Number(feeAmount || 0) > 0 && (
                          <div className="flex items-center justify-between text-muted-foreground">
                            <span>رسوم المعاملة:</span>
                            <span className="font-mono font-medium text-foreground">
                              {formatMoney(Number(feeAmount).toFixed(2), selectedInstrument?.currency || "EGP", 2)}
                            </span>
                          </div>
                        )}
                        {Number(taxAmount || 0) > 0 && (
                          <div className="flex items-center justify-between text-muted-foreground">
                            <span>الضرائب:</span>
                            <span className="font-mono font-medium text-foreground">
                              {formatMoney(Number(taxAmount).toFixed(2), selectedInstrument?.currency || "EGP", 2)}
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Breakdown for debt payment */}
                    {activeModal === "debt_payment" && (
                      <div className="space-y-1.5 border-t border-border/60 pt-2 text-xs">
                        <div className="flex items-center justify-between text-muted-foreground">
                          <span>أصل الدين المسدد:</span>
                          <span className="font-mono font-medium text-foreground">
                            {formatMoney(amount, selectedAccount?.currency || "EGP", 2)}
                          </span>
                        </div>
                        {Number(interestAmount || 0) > 0 && (
                          <div className="flex items-center justify-between text-muted-foreground">
                            <span>الفائدة المسددة:</span>
                            <span className="font-mono font-medium text-foreground">
                              {formatMoney(interestAmount, selectedAccount?.currency || "EGP", 2)}
                            </span>
                          </div>
                        )}
                        {Number(feeAmount || 0) > 0 && (
                          <div className="flex items-center justify-between text-muted-foreground">
                            <span>رسوم السداد:</span>
                            <span className="font-mono font-medium text-foreground">
                              {formatMoney(feeAmount, selectedAccount?.currency || "EGP", 2)}
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Prominent Net Cash Flow highlight box */}
                    <div className="rounded-lg border border-border/80 bg-card p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-xs font-semibold text-muted-foreground">
                            صافي التدفق النقدي:
                          </span>
                          <p className="text-[11px] text-muted-foreground/80">
                            {activeModal === "buy"
                              ? "خصم من الحساب النقدي (القيمة + الرسوم + الضرائب)"
                              : activeModal === "sell" || activeModal === "fund_redemption"
                              ? "إيداع في الحساب النقدي (القيمة - الرسوم - الضرائب)"
                              : activeModal === "debt_payment"
                              ? "إجمالي الخصم للسداد (الأصل + الفائدة + الرسوم)"
                              : activeModal === "deposit"
                              ? "إيداع في الحساب المالي"
                              : activeModal === "withdrawal"
                              ? "خصم من الحساب المالي"
                              : "نقل متوازن بين الحسابين"}
                          </p>
                        </div>
                        <div className="text-left font-mono text-base font-bold text-[#0B1628] dark:text-slate-100">
                          {activeModal === "buy" || activeModal === "sell" || activeModal === "fund_redemption" ? (
                            <span>
                              {formatMoney(
                                (
                                  activeModal === "buy"
                                    ? Number(quantity || 0) * Number(unitPrice || 0) +
                                      Number(feeAmount || 0) +
                                      Number(taxAmount || 0)
                                    : Number(quantity || 0) * Number(unitPrice || 0) -
                                      Number(feeAmount || 0) -
                                      Number(taxAmount || 0)
                                ).toFixed(2),
                                selectedInstrument?.currency || "EGP",
                                2
                              )}
                            </span>
                          ) : activeModal === "debt_payment" ? (
                            <span>
                              {formatMoney(
                                (
                                  Number(amount || 0) +
                                  Number(interestAmount || 0) +
                                  Number(feeAmount || 0)
                                ).toFixed(2),
                                selectedAccount?.currency || "EGP",
                                2
                              )}
                            </span>
                          ) : (
                            <span>
                              {formatMoney(amount, selectedAccount?.currency || "EGP", 2)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {memo && (
                      <div className="border-t border-border/60 pt-2 text-xs text-muted-foreground">
                        <span className="font-semibold text-foreground">البيان: </span>
                        <span>{memo}</span>
                      </div>
                    )}
                  </div>

                  {/* Security and ledger invariant guarantee badge */}
                  <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs font-medium text-[#0B1628] dark:text-slate-100">
                    <ShieldCheck className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    <span>
                      سيتم ترحيل المعاملة بقيد محاسبي مزدوج متوازن مع تثبيت سجل التدقيق المقترن.
                    </span>
                  </div>
                </div>
              )}

              <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-border/60">
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
