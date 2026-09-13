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
    color: "text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-800/40",
    sign: "+",
    amountColor: "text-emerald-950 dark:text-emerald-300",
  },
  opening_balance: {
    label: "رصيد افتتاحي",
    icon: PlusCircle,
    color: "text-sky-700 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/40 border border-sky-200/60 dark:border-sky-800/40",
    sign: "+",
    amountColor: "text-emerald-950 dark:text-emerald-300",
  },
  income: {
    label: "دخل مصنف",
    icon: ArrowDownLeft,
    color: "text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-800/40",
    sign: "+",
    amountColor: "text-emerald-950 dark:text-emerald-300",
  },
  withdrawal: {
    label: "سحب سيولة",
    icon: ArrowUpRight,
    color: "text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-200/60 dark:border-rose-800/40",
    sign: "-",
    amountColor: "text-rose-950 dark:text-rose-300",
  },
  expense: {
    label: "مصروف مصنف",
    icon: ArrowUpRight,
    color: "text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-200/60 dark:border-rose-800/40",
    sign: "-",
    amountColor: "text-rose-950 dark:text-rose-300",
  },
  transfer: {
    label: "تحويل داخلي",
    icon: ArrowLeftRight,
    color: "text-sky-700 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/40 border border-sky-200/60 dark:border-sky-800/40",
    sign: "↔",
    amountColor: "text-slate-900 dark:text-slate-100",
  },
  buy: {
    label: "شراء استثمار",
    icon: TrendingUp,
    color: "text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-800/40",
    sign: "-",
    amountColor: "text-rose-950 dark:text-rose-300",
  },
  sell: {
    label: "بيع / تسييل",
    icon: TrendingDown,
    color: "text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border border-amber-200/60 dark:border-amber-800/40",
    sign: "+",
    amountColor: "text-emerald-950 dark:text-emerald-300",
  },
  debt_payment: {
    label: "سداد دين",
    icon: CreditCard,
    color: "text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700",
    sign: "-",
    amountColor: "text-rose-950 dark:text-rose-300",
  },
  fund_redemption: {
    label: "استرداد صندوق",
    icon: Coins,
    color: "text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border border-amber-200/60 dark:border-amber-800/40",
    sign: "+",
    amountColor: "text-emerald-950 dark:text-emerald-300",
  },
  dividend: {
    label: "توزيع نقدي",
    icon: ArrowDownLeft,
    color: "text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-800/40",
    sign: "+",
    amountColor: "text-emerald-950 dark:text-emerald-300",
  },
  fee: {
    label: "رسوم",
    icon: ArrowUpRight,
    color: "text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-200/60 dark:border-rose-800/40",
    sign: "-",
    amountColor: "text-rose-950 dark:text-rose-300",
  },
  tax: {
    label: "ضرائب",
    icon: ArrowUpRight,
    color: "text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-200/60 dark:border-rose-800/40",
    sign: "-",
    amountColor: "text-rose-950 dark:text-rose-300",
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

        {/* Unified Top 4 Ledger Metrics Executive Strip */}
        <section className="bg-white dark:bg-card rounded-2xl border border-slate-200/70 dark:border-border shadow-xs grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x lg:divide-x-reverse divide-slate-100 dark:divide-border/60 overflow-hidden">
          <div className="p-4 sm:p-5 flex flex-col justify-between hover:bg-slate-50/40 dark:hover:bg-muted/20 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-slate-600 dark:text-slate-400 font-semibold text-xs uppercase tracking-wider">
                حسابات التسوية
              </span>
              <div className="flex size-8 items-center justify-center rounded-lg border bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
                <Wallet className="size-4" />
              </div>
            </div>
            <div className="mt-3 mb-1">
              <strong className="font-mono text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tabular-nums block">
                {cashAccounts.length}
              </strong>
            </div>
            <span className="text-slate-500 dark:text-slate-400 text-xs font-medium block">
              حسابات نقدية نشطة
            </span>
          </div>

          <div className="p-4 sm:p-5 flex flex-col justify-between hover:bg-slate-50/40 dark:hover:bg-muted/20 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-slate-600 dark:text-slate-400 font-semibold text-xs uppercase tracking-wider">
                أدوات الاستثمار
              </span>
              <div className="flex size-8 items-center justify-center rounded-lg border bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20">
                <TrendingUp className="size-4" />
              </div>
            </div>
            <div className="mt-3 mb-1">
              <strong className="font-mono text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tabular-nums block">
                {fundInstruments.length}
              </strong>
            </div>
            <span className="text-slate-500 dark:text-slate-400 text-xs font-medium block">
              أدوات وصناديق متاحة
            </span>
          </div>

          <div className="p-4 sm:p-5 flex flex-col justify-between hover:bg-slate-50/40 dark:hover:bg-muted/20 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-slate-600 dark:text-slate-400 font-semibold text-xs uppercase tracking-wider">
                الالتزامات النشطة
              </span>
              <div className="flex size-8 items-center justify-center rounded-lg border bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20">
                <CreditCard className="size-4" />
              </div>
            </div>
            <div className="mt-3 mb-1">
              <strong className="font-mono text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tabular-nums block">
                {(debts.data ?? []).filter(d => d.status === "active").length}
              </strong>
            </div>
            <span className="text-slate-500 dark:text-slate-400 text-xs font-medium block">
              ديون قابلة للسداد
            </span>
          </div>

          <div className="p-4 sm:p-5 flex flex-col justify-between hover:bg-slate-50/40 dark:hover:bg-muted/20 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-slate-600 dark:text-slate-400 font-semibold text-xs uppercase tracking-wider">
                القيود المسجلة
              </span>
              <div className="flex size-8 items-center justify-center rounded-lg border bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
                <ShieldCheck className="size-4" />
              </div>
            </div>
            <div className="mt-3 mb-1">
              <strong className="font-mono text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tabular-nums block">
                {recentEvents.data?.length ?? 0}
              </strong>
            </div>
            <span className="text-slate-500 dark:text-slate-400 text-xs font-medium block">
              دفتر أستاذ متوازن
            </span>
          </div>
        </section>

        {/* Compact 1-line Action Dock */}
        <section className="rounded-2xl border border-slate-200/70 dark:border-border bg-white dark:bg-card p-3.5 sm:p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3" aria-labelledby="operations-heading">
          <div className="flex items-center gap-3">
            <Button
              onClick={() => {
                setActiveModal("deposit");
                setReviewStep(false);
              }}
              className="gap-2 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs h-9 px-4 rounded-xl shadow-xs shrink-0 cursor-pointer"
            >
              <PlusCircle className="size-4" />
              <span>تسجيل معاملة جديدة</span>
            </Button>
            <span className="hidden lg:inline-block text-xs font-medium text-slate-400 dark:text-muted-foreground">
              إجراء سريع:
            </span>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
            <button
              type="button"
              onClick={() => { setActiveModal("deposit"); setReviewStep(false); }}
              className="inline-flex items-center gap-1.5 py-1.5 px-3 rounded-xl border border-slate-200/80 dark:border-border bg-white dark:bg-card hover:bg-slate-50 dark:hover:bg-muted/40 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors whitespace-nowrap shadow-2xs cursor-pointer"
            >
              <ArrowDownLeft className="size-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>إيداع كاش</span>
            </button>
            <button
              type="button"
              onClick={() => { setActiveModal("withdrawal"); setReviewStep(false); }}
              className="inline-flex items-center gap-1.5 py-1.5 px-3 rounded-xl border border-slate-200/80 dark:border-border bg-white dark:bg-card hover:bg-slate-50 dark:hover:bg-muted/40 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors whitespace-nowrap shadow-2xs cursor-pointer"
            >
              <ArrowUpRight className="size-3.5 text-rose-600 dark:text-rose-400" />
              <span>سحب / مصروف</span>
            </button>
            <button
              type="button"
              onClick={() => { setActiveModal("transfer"); setReviewStep(false); }}
              className="inline-flex items-center gap-1.5 py-1.5 px-3 rounded-xl border border-slate-200/80 dark:border-border bg-white dark:bg-card hover:bg-slate-50 dark:hover:bg-muted/40 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors whitespace-nowrap shadow-2xs cursor-pointer"
            >
              <ArrowLeftRight className="size-3.5 text-sky-600 dark:text-sky-400" />
              <span>تحويل داخلي</span>
            </button>
            <button
              type="button"
              onClick={() => { setActiveModal("buy"); setReviewStep(false); }}
              className="inline-flex items-center gap-1.5 py-1.5 px-3 rounded-xl border border-slate-200/80 dark:border-border bg-white dark:bg-card hover:bg-slate-50 dark:hover:bg-muted/40 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors whitespace-nowrap shadow-2xs cursor-pointer"
            >
              <TrendingUp className="size-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>شراء استثمار</span>
            </button>
            <button
              type="button"
              onClick={() => { setActiveModal("sell"); setReviewStep(false); }}
              className="inline-flex items-center gap-1.5 py-1.5 px-3 rounded-xl border border-slate-200/80 dark:border-border bg-white dark:bg-card hover:bg-slate-50 dark:hover:bg-muted/40 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors whitespace-nowrap shadow-2xs cursor-pointer"
            >
              <TrendingDown className="size-3.5 text-amber-600 dark:text-amber-400" />
              <span>بيع / تسييل</span>
            </button>
            <button
              type="button"
              onClick={() => { setActiveModal("debt_payment"); setReviewStep(false); }}
              className="inline-flex items-center gap-1.5 py-1.5 px-3 rounded-xl border border-slate-200/80 dark:border-border bg-white dark:bg-card hover:bg-slate-50 dark:hover:bg-muted/40 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors whitespace-nowrap shadow-2xs cursor-pointer"
            >
              <CreditCard className="size-3.5 text-slate-600 dark:text-slate-400" />
              <span>سداد التزام</span>
            </button>
          </div>
        </section>

        {/* Section: Transactions Ledger Feed - Unified Table Container */}
        <section className="rounded-2xl border border-slate-200/70 dark:border-border bg-white dark:bg-card shadow-xs overflow-hidden" aria-labelledby="history-heading">
          {/* Integrated Header Toolbar directly attached to top of table */}
          <div className="p-4 sm:p-5 border-b border-slate-200/70 dark:border-border/60 flex flex-col gap-3.5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 id="history-heading" className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-foreground">
                <FileText className="size-4 text-emerald-600 dark:text-emerald-400" />
                <span>سجل المعاملات</span>
              </h2>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-muted-foreground">
                عرض ومراجعة العمليات المالية المسجلة في دفتر الأستاذ
              </p>
            </div>

            {/* Compact, responsive RTL Toolbar */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-44 flex-1 sm:flex-initial">
                <Search className="pointer-events-none absolute right-3 top-2.5 size-3.5 text-slate-400" />
                <Input
                  placeholder="بحث في البيان أو المبلغ..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="h-9 pr-9 text-xs bg-slate-50/50 dark:bg-muted/40 border-slate-200/80 dark:border-border"
                />
              </div>

              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="h-9 w-32 text-xs bg-slate-50/50 dark:bg-muted/40 border-slate-200/80 dark:border-border">
                  <Filter className="ml-1 size-3 text-slate-400" />
                  <SelectValue placeholder="نوع المعاملة" />
                </SelectTrigger>
                <SelectContent align="end">
                  <SelectItem value="all">كل العمليات</SelectItem>
                  <SelectItem value="cash_in">إيداع ودخل (+)</SelectItem>
                  <SelectItem value="cash_out">سحب ومصروف (-)</SelectItem>
                  <SelectItem value="transfer">تحويل داخلي (↔)</SelectItem>
                  <SelectItem value="trade">تداول واستثمار</SelectItem>
                  <SelectItem value="debt">سداد التزامات</SelectItem>
                </SelectContent>
              </Select>

              {cashAccounts.length > 0 && (
                <Select value={accountFilter} onValueChange={setAccountFilter}>
                  <SelectTrigger className="h-9 w-32 text-xs bg-slate-50/50 dark:bg-muted/40 border-slate-200/80 dark:border-border">
                    <Building2 className="ml-1 size-3 text-slate-400" />
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
                  className="h-9 px-2.5 text-xs text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
                  title="إعادة تعيين الفلاتر"
                >
                  <RotateCcw className="size-3.5" />
                  <span className="sr-only sm:not-sr-only sm:mr-1">إعادة ضبط</span>
                </Button>
              )}

              <Badge variant="outline" className="h-9 border-slate-200/80 dark:border-border bg-slate-50/50 dark:bg-muted/40 px-2.5 text-xs font-normal text-slate-600 dark:text-muted-foreground">
                {filteredEvents.length} عملية
              </Badge>
            </div>
          </div>

          {/* Transactions Table Container */}
          <div>
            {recentEvents.isLoading ? (
              <div className="space-y-3 p-6">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : filteredEvents.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 text-center">
                <div className="flex size-13 items-center justify-center rounded-full border border-slate-200/80 dark:border-border bg-slate-50 dark:bg-muted/40 text-slate-400">
                  <FileText className="size-6 text-slate-400" />
                </div>
                <h3 className="mt-4 text-base font-bold text-slate-900 dark:text-foreground">
                  {hasActiveFilters ? "لا توجد نتائج تطابق خيارات البحث" : "لا توجد معاملات حتى الآن"}
                </h3>
                <p className="mt-1 max-w-sm text-xs text-slate-500 dark:text-muted-foreground">
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
                    className="mt-4 gap-1.5 text-xs border-slate-200/80 dark:border-border bg-white dark:bg-card"
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
                    className="mt-4 gap-1.5 border-emerald-500/40 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100/60 dark:text-emerald-300 dark:bg-emerald-950/30"
                  >
                    <ArrowDownLeft className="size-3.5" />
                    تسجيل إيداع جديد
                  </Button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-right text-sm">
                  <thead className="border-b border-slate-200/80 dark:border-border bg-slate-50/80 dark:bg-slate-900/50 text-xs font-semibold text-slate-700 dark:text-slate-300">
                    <tr>
                      <th className="py-3.5 px-4 pr-5">نوع العملية</th>
                      <th className="py-3.5 px-4">الحساب المالي</th>
                      <th className="py-3.5 px-4">التاريخ والوقت</th>
                      <th className="py-3.5 px-4">البيان والملاحظات</th>
                      <th className="py-3.5 px-4">المبلغ الإجمالي</th>
                      <th className="py-3.5 px-4 pl-5">حالة القيد</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-card divide-y divide-slate-100 dark:divide-border/50">
                    {filteredEvents.map(event => {
                      const meta = eventLabel[event.eventType] || {
                        label: event.eventType,
                        icon: ArrowLeftRight,
                        color: "text-slate-600 dark:text-muted-foreground bg-slate-100 dark:bg-muted/40 border border-slate-200 dark:border-border",
                        sign: "",
                        amountColor: "text-slate-900 dark:text-slate-100",
                      };
                      const Icon = meta.icon;
                      const formattedAmount = formatMoney(event.grossAmount, event.currency, 2);
                      const accountInfo = event.primaryAccountId ? accountMap.get(event.primaryAccountId) : null;

                      return (
                        <tr
                          key={event.id}
                          className="border-b border-slate-100 dark:border-border/50 transition-colors hover:bg-slate-50/60 dark:hover:bg-muted/30 last:border-b-0"
                        >
                          {/* Type Column */}
                          <td className="py-3.5 px-4 pr-5">
                            <div className="flex items-center gap-2.5">
                              <div className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${meta.color}`}>
                                <Icon className="size-4" />
                              </div>
                              <div>
                                <p className="font-semibold text-slate-900 dark:text-foreground">
                                  {meta.label}
                                </p>
                                <p className="font-mono text-[11px] text-slate-500 dark:text-muted-foreground">
                                  #{event.id}
                                </p>
                              </div>
                            </div>
                          </td>

                          {/* Account Column */}
                          <td className="py-3.5 px-4">
                            <div className="text-xs">
                              <p className="font-semibold text-slate-900 dark:text-foreground">
                                {accountInfo?.name || "حساب المعاملة"}
                              </p>
                              <p className="font-mono text-[11px] text-slate-500 dark:text-muted-foreground mt-0.5">
                                {event.currency}
                              </p>
                            </div>
                          </td>

                          {/* Date Column */}
                          <td className="py-3.5 px-4 text-xs text-slate-500 dark:text-muted-foreground">
                            <div className="flex items-center gap-1.5 font-mono">
                              <Clock className="size-3 text-slate-400" />
                              <span>{new Date(event.occurredAt).toLocaleString("en-GB")}</span>
                            </div>
                          </td>

                          {/* Memo Column */}
                          <td className="max-w-xs py-3.5 px-4 text-xs text-slate-600 dark:text-muted-foreground">
                            <span className="truncate block" title={event.memo || ""}>
                              {event.memo || "—"}
                            </span>
                          </td>

                          {/* Amount Column */}
                          <td className="py-3.5 px-4">
                            <div className="font-mono text-sm sm:text-base font-bold tracking-tight" dir="ltr">
                              <span className={`${meta.amountColor} font-bold font-mono text-sm sm:text-base tabular-nums`}>
                                {meta.sign} <SensitiveValue>{formattedAmount}</SensitiveValue>
                              </span>
                            </div>
                          </td>

                          {/* Status Badge */}
                          <td className="py-3.5 px-4 pl-5">
                            {event.status === "posted" ? (
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200/50 dark:border-emerald-800/40 px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-slate-300">
                                <span className="size-1.5 rounded-full bg-emerald-600 shrink-0" />
                                <span>مرحّل</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200/50 dark:border-amber-800/40 px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-slate-300">
                                <span className="size-1.5 rounded-full bg-amber-500 shrink-0" />
                                <span>قيد المعالجة</span>
                              </span>
                            )}
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
