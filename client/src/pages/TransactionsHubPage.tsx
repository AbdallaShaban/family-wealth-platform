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
import ConfirmDialog from "@/components/ConfirmDialog";
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
  Pencil,
  Trash2,
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
    shortDesc: "تنفيذ شراء أسهم أو صناديق أو ذهب مع خصم القيمة وتحديث الأصل الاستثماري.",
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
    shortDesc: "بيع أصل استثماري مسجل وإيداع العائد في حساب التسوية.",
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
      "bg-emerald-50 text-emerald-950 border border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/60 font-semibold text-xs px-2.5 py-1 rounded-full",
    cardBorderHover:
      "hover:border-emerald-500/50 dark:hover:border-emerald-500/40 hover:shadow-emerald-950/10",
    accentLine: "bg-[#10B981]",
    actionText:
      "text-[#0B1628] dark:text-slate-100 font-semibold group-hover:text-emerald-700 dark:group-hover:text-emerald-400",
    arrowColor: "text-emerald-600 dark:text-emerald-400",
  },
  sky: {
    iconBox:
      "bg-[#F0F9FF] dark:bg-slate-800/50 text-slate-700 dark:text-slate-300 border border-sky-500/25 dark:border-slate-700/60 group-hover:bg-sky-100/60 dark:group-hover:bg-slate-700/60",
    badge:
      "bg-sky-50 text-sky-950 border border-sky-300 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800/60 font-semibold text-xs px-2.5 py-1 rounded-full",
    cardBorderHover:
      "hover:border-sky-500/50 dark:hover:border-slate-700 hover:shadow-sky-950/10 dark:hover:shadow-none",
    accentLine: "bg-[#38BDF8] dark:bg-slate-500",
    actionText:
      "text-[#0B1628] dark:text-slate-100 font-semibold group-hover:text-sky-700 dark:group-hover:text-slate-200",
    arrowColor: "text-sky-600 dark:text-slate-300",
  },
  amber: {
    iconBox:
      "bg-[#FFFBEB] dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/25 dark:border-amber-500/25 group-hover:bg-amber-100/60 dark:group-hover:bg-amber-500/20",
    badge:
      "bg-amber-50 text-amber-950 border border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800/60 font-semibold text-xs px-2.5 py-1 rounded-full",
    cardBorderHover:
      "hover:border-amber-500/50 dark:hover:border-slate-700 hover:shadow-amber-950/10 dark:hover:shadow-none",
    accentLine: "bg-[#F59E0B]",
    actionText:
      "text-[#0B1628] dark:text-slate-100 font-semibold group-hover:text-amber-700 dark:group-hover:text-amber-400",
    arrowColor: "text-amber-600 dark:text-amber-400",
  },
  slate: {
    iconBox:
      "bg-[#F1F5F9] dark:bg-slate-800/50 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700/60 group-hover:bg-slate-200/60 dark:group-hover:bg-slate-700/60",
    badge:
      "bg-slate-100 text-slate-900 border border-slate-300 dark:bg-slate-800/80 dark:text-slate-200 dark:border-slate-700/80 font-semibold text-xs px-2.5 py-1 rounded-full",
    cardBorderHover:
      "hover:border-slate-400 dark:hover:border-slate-600 dark:hover:shadow-none",
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
    color: "text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200/60 dark:border-emerald-500/25",
    sign: "+",
    amountColor: "text-emerald-900 dark:text-emerald-400",
  },
  opening_balance: {
    label: "رصيد افتتاحي",
    icon: PlusCircle,
    color: "text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60",
    sign: "+",
    amountColor: "text-emerald-900 dark:text-emerald-400",
  },
  income: {
    label: "دخل مصنف",
    icon: ArrowDownLeft,
    color: "text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200/60 dark:border-emerald-500/25",
    sign: "+",
    amountColor: "text-emerald-900 dark:text-emerald-400",
  },
  withdrawal: {
    label: "سحب سيولة",
    icon: ArrowUpRight,
    color: "text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10 border border-rose-200/60 dark:border-rose-500/25",
    sign: "-",
    amountColor: "text-rose-900 dark:text-rose-400",
  },
  expense: {
    label: "مصروف مصنف",
    icon: ArrowUpRight,
    color: "text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10 border border-rose-200/60 dark:border-rose-500/25",
    sign: "-",
    amountColor: "text-rose-900 dark:text-rose-400",
  },
  transfer: {
    label: "تحويل داخلي",
    icon: ArrowLeftRight,
    color: "text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60",
    sign: "↔",
    amountColor: "text-slate-900 dark:text-slate-200",
  },
  buy: {
    label: "شراء استثمار",
    icon: TrendingUp,
    color: "text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200/60 dark:border-emerald-500/25",
    sign: "-",
    amountColor: "text-rose-900 dark:text-rose-400",
  },
  sell: {
    label: "بيع / تسييل",
    icon: TrendingDown,
    color: "text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border border-amber-200/60 dark:border-amber-500/25",
    sign: "+",
    amountColor: "text-emerald-900 dark:text-emerald-400",
  },
  debt_payment: {
    label: "سداد دين",
    icon: CreditCard,
    color: "text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60",
    sign: "-",
    amountColor: "text-rose-900 dark:text-rose-400",
  },
  fund_redemption: {
    label: "استرداد صندوق",
    icon: Coins,
    color: "text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border border-amber-200/60 dark:border-amber-500/25",
    sign: "+",
    amountColor: "text-emerald-900 dark:text-emerald-400",
  },
  dividend: {
    label: "توزيع نقدي",
    icon: ArrowDownLeft,
    color: "text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200/60 dark:border-emerald-500/25",
    sign: "+",
    amountColor: "text-emerald-900 dark:text-emerald-400",
  },
  fee: {
    label: "رسوم",
    icon: ArrowUpRight,
    color: "text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10 border border-rose-200/60 dark:border-rose-500/25",
    sign: "-",
    amountColor: "text-rose-900 dark:text-rose-400",
  },
  tax: {
    label: "ضرائب",
    icon: ArrowUpRight,
    color: "text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10 border border-rose-200/60 dark:border-rose-500/25",
    sign: "-",
    amountColor: "text-rose-900 dark:text-rose-400",
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

  const access = trpc.family.bootstrap.useQuery();
  const canEdit = ["owner", "advisor", "editor"].includes(access.data?.membership.role || "viewer");

  // Delete Transaction State
  const [deleteTransactionOpen, setDeleteTransactionOpen] = useState(false);
  const [selectedTransactionForDelete, setSelectedTransactionForDelete] = useState<any | null>(null);

  // Edit Trade State
  const [editTradeModalOpen, setEditTradeModalOpen] = useState(false);
  const [selectedTradeForEdit, setSelectedTradeForEdit] = useState<any | null>(null);
  const [editTradeDate, setEditTradeDate] = useState("");
  const [editTradeQuantity, setEditTradeQuantity] = useState("");
  const [editTradeUnitPrice, setEditTradeUnitPrice] = useState("");
  const [editTradeAccountId, setEditTradeAccountId] = useState("");
  const [editTradeFeeAmount, setEditTradeFeeAmount] = useState("");
  const [editTradeTaxAmount, setEditTradeTaxAmount] = useState("");
  const [editTradeMemo, setEditTradeMemo] = useState("");

  const handleOpenEditTrade = (event: any) => {
    setSelectedTradeForEdit(event);
    const dateObj = new Date(event.occurredAt);
    const localIso = new Date(dateObj.getTime() - dateObj.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    setEditTradeDate(localIso);
    setEditTradeQuantity(event.quantity ? String(event.quantity) : "");
    setEditTradeUnitPrice(event.unitPrice ? String(event.unitPrice) : "");
    setEditTradeAccountId(event.primaryAccountId ? String(event.primaryAccountId) : "");
    setEditTradeFeeAmount(event.feeAmount ? String(event.feeAmount) : "");
    setEditTradeTaxAmount(event.taxAmount ? String(event.taxAmount) : "");
    setEditTradeMemo(event.memo || "");
    setEditTradeModalOpen(true);
  };

  const handleOpenDelete = (event: any) => {
    setSelectedTransactionForDelete(event);
    setDeleteTransactionOpen(true);
  };

  const deleteTransactionMutation = trpc.family.ledger.deleteTransaction.useMutation({
    onSuccess: () => {
      toast.success("تم حذف المعاملة وعكس قيودها في دفتر الأستاذ بنجاح.");
      setDeleteTransactionOpen(false);
      invalidateAll();
    },
    onError: (err) => {
      setDeleteTransactionOpen(false);
      toast.error(err.message || "تعذر إلغاء أو حذف المعاملة.");
    },
  });

  const updateTradeMutation = trpc.family.ledger.updateTransaction.useMutation({
    onSuccess: () => {
      toast.success("تم تعديل الصفقة وعكس القيود السابقة في دفتر الأستاذ بنجاح.");
      setEditTradeModalOpen(false);
      invalidateAll();
    },
    onError: (err) => toast.error(err.message || "فشل تعديل الصفقة."),
  });

  const handleSaveEditTrade = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTradeForEdit) return;
    const occurredAtMs = editTradeDate ? new Date(editTradeDate).getTime() : selectedTradeForEdit.occurredAt;
    updateTradeMutation.mutate({
      id: selectedTradeForEdit.id,
      accountId: editTradeAccountId ? Number(editTradeAccountId) : undefined,
      quantity: editTradeQuantity,
      unitPrice: editTradeUnitPrice,
      feeAmount: editTradeFeeAmount || null,
      taxAmount: editTradeTaxAmount || null,
      occurredAt: occurredAtMs,
      memo: editTradeMemo || null,
    });
  };

  const handleConfirmDelete = () => {
    if (!selectedTransactionForDelete) return;
    deleteTransactionMutation.mutate({ id: selectedTransactionForDelete.id });
  };

  const isPending =
    postCash.isPending || postTransfer.isPending || postTrade.isPending || postDebtPayment.isPending || deleteTransactionMutation.isPending || updateTradeMutation.isPending;

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
      <div dir="rtl" className="mx-auto max-w-7xl space-y-4">
        {/* Executive Header / Hero */}
        <PageHeader
          title="المعاملات المالية"
          description="إدارة وتنفيذ ومراجعة جميع العمليات المالية والاستثمارية"
          breadcrumbs={[
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
          className="p-3.5 sm:p-4 space-y-2 rounded-2xl dark:bg-[#0B0F17]/90 dark:border-slate-800/80 dark:shadow-none"
          actions={
            <Button
              variant="outline"
              size="sm"
              onClick={invalidateAll}
              disabled={recentEvents.isFetching}
              className="h-8 gap-1.5 border-border/80 text-xs hover:border-emerald-500/40 hover:bg-emerald-500/5 hover:text-emerald-600 dark:border-slate-800 dark:bg-[#0E1420] dark:text-slate-300 dark:hover:bg-slate-800/50"
            >
              <RefreshCw className={`size-3.5 ${recentEvents.isFetching ? "animate-spin text-emerald-500" : ""}`} />
              <span>تحديث البيانات</span>
            </Button>
          }
        />

        {/* Unified Top 4 Ledger Metrics Executive Strip */}
        <section className="bg-white dark:bg-[#0B0F17] border border-slate-200/90 dark:border-slate-800/80 shadow-xs rounded-2xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 overflow-hidden mb-6">
          <div className="py-3 px-4 flex flex-col justify-between hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors border-b sm:border-b-0 lg:border-b-0 lg:border-l border-slate-200/80 dark:border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-slate-700 dark:text-slate-300 font-semibold text-xs uppercase tracking-wider">
                حسابات التسوية
              </span>
              <div className="flex size-7 items-center justify-center rounded-lg border bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 dark:border-emerald-500/30">
                <Wallet className="size-3.5" />
              </div>
            </div>
            <div className="mt-1.5 mb-0.5">
              <strong className="font-mono text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tabular-nums block">
                {cashAccounts.length}
              </strong>
            </div>
            <span className="text-slate-500 dark:text-slate-400 text-xs font-medium block">
              حسابات نقدية نشطة
            </span>
          </div>

          <div className="py-3 px-4 flex flex-col justify-between hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors border-b sm:border-b-0 lg:border-b-0 lg:border-l border-slate-200/80 dark:border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-slate-700 dark:text-slate-300 font-semibold text-xs uppercase tracking-wider">
                أدوات الاستثمار
              </span>
              <div className="flex size-7 items-center justify-center rounded-lg border bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/20 dark:border-slate-700/60">
                <TrendingUp className="size-3.5" />
              </div>
            </div>
            <div className="mt-1.5 mb-0.5">
              <strong className="font-mono text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tabular-nums block">
                {fundInstruments.length}
              </strong>
            </div>
            <span className="text-slate-500 dark:text-slate-400 text-xs font-medium block">
              أدوات وصناديق متاحة
            </span>
          </div>

          <div className="py-3 px-4 flex flex-col justify-between hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors border-b sm:border-b-0 lg:border-b-0 lg:border-l border-slate-200/80 dark:border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-slate-700 dark:text-slate-300 font-semibold text-xs uppercase tracking-wider">
                الالتزامات النشطة
              </span>
              <div className="flex size-7 items-center justify-center rounded-lg border bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20 dark:border-rose-500/30">
                <CreditCard className="size-3.5" />
              </div>
            </div>
            <div className="mt-1.5 mb-0.5">
              <strong className="font-mono text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tabular-nums block">
                {(debts.data ?? []).filter(d => d.status === "active").length}
              </strong>
            </div>
            <span className="text-slate-500 dark:text-slate-400 text-xs font-medium block">
              ديون قابلة للسداد
            </span>
          </div>

          <div className="py-3 px-4 flex flex-col justify-between hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors border-b-0 lg:border-l-0">
            <div className="flex items-center justify-between">
              <span className="text-slate-700 dark:text-slate-300 font-semibold text-xs uppercase tracking-wider">
                القيود المسجلة
              </span>
              <div className="flex size-7 items-center justify-center rounded-lg border bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 dark:border-emerald-500/30">
                <ShieldCheck className="size-3.5" />
              </div>
            </div>
            <div className="mt-1.5 mb-0.5">
              <strong className="font-mono text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tabular-nums block">
                {recentEvents.data?.length ?? 0}
              </strong>
            </div>
            <span className="text-slate-500 dark:text-slate-400 text-xs font-medium block">
              دفتر أستاذ متوازن
            </span>
          </div>
        </section>

        {/* Compact 1-line Action Dock */}
        <section className="rounded-2xl border border-slate-200/90 dark:border-slate-800/80 bg-white dark:bg-[#0B0F17] py-2.5 px-3.5 sm:px-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-2.5" aria-labelledby="operations-heading">
          <div className="flex items-center gap-2.5">
            <Button
              onClick={() => {
                setActiveModal("deposit");
                setReviewStep(false);
              }}
              className="gap-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs px-4 py-2 rounded-xl shadow-sm transition-all border border-slate-900 dark:bg-white dark:hover:bg-slate-100 dark:text-slate-950 dark:border-transparent shrink-0 cursor-pointer h-auto"
            >
              <PlusCircle className="size-3.5 text-white dark:text-slate-950" />
              <span>تسجيل معاملة جديدة</span>
            </Button>
            <span className="hidden lg:inline-block text-xs font-medium text-slate-400 dark:text-slate-500">
              إجراء سريع:
            </span>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 md:pb-0 scrollbar-none">
            <button
              type="button"
              onClick={() => { setActiveModal("deposit"); setReviewStep(false); }}
              className="inline-flex items-center gap-1.5 py-1 px-2.5 rounded-xl border border-slate-200/90 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-800 shadow-2xs transition-colors whitespace-nowrap cursor-pointer dark:bg-slate-800/60 dark:hover:bg-slate-800 dark:text-slate-200 dark:border-slate-700/60"
            >
              <ArrowDownLeft className="size-3 text-emerald-600 dark:text-emerald-400" />
              <span>إيداع كاش</span>
            </button>
            <button
              type="button"
              onClick={() => { setActiveModal("withdrawal"); setReviewStep(false); }}
              className="inline-flex items-center gap-1.5 py-1 px-2.5 rounded-xl border border-slate-200/90 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-800 shadow-2xs transition-colors whitespace-nowrap cursor-pointer dark:bg-slate-800/60 dark:hover:bg-slate-800 dark:text-slate-200 dark:border-slate-700/60"
            >
              <ArrowUpRight className="size-3 text-rose-600 dark:text-rose-400" />
              <span>سحب / مصروف</span>
            </button>
            <button
              type="button"
              onClick={() => { setActiveModal("transfer"); setReviewStep(false); }}
              className="inline-flex items-center gap-1.5 py-1 px-2.5 rounded-xl border border-slate-200/90 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-800 shadow-2xs transition-colors whitespace-nowrap cursor-pointer dark:bg-slate-800/60 dark:hover:bg-slate-800 dark:text-slate-200 dark:border-slate-700/60"
            >
              <ArrowLeftRight className="size-3 text-slate-600 dark:text-slate-300" />
              <span>تحويل داخلي</span>
            </button>
            <button
              type="button"
              onClick={() => { setActiveModal("buy"); setReviewStep(false); }}
              className="inline-flex items-center gap-1.5 py-1 px-2.5 rounded-xl border border-slate-200/90 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-800 shadow-2xs transition-colors whitespace-nowrap cursor-pointer dark:bg-slate-800/60 dark:hover:bg-slate-800 dark:text-slate-200 dark:border-slate-700/60"
            >
              <TrendingUp className="size-3 text-emerald-600 dark:text-emerald-400" />
              <span>شراء استثمار</span>
            </button>
            <button
              type="button"
              onClick={() => { setActiveModal("sell"); setReviewStep(false); }}
              className="inline-flex items-center gap-1.5 py-1 px-2.5 rounded-xl border border-slate-200/90 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-800 shadow-2xs transition-colors whitespace-nowrap cursor-pointer dark:bg-slate-800/60 dark:hover:bg-slate-800 dark:text-slate-200 dark:border-slate-700/60"
            >
              <TrendingDown className="size-3 text-amber-600 dark:text-amber-400" />
              <span>بيع / تسييل</span>
            </button>
            <button
              type="button"
              onClick={() => { setActiveModal("debt_payment"); setReviewStep(false); }}
              className="inline-flex items-center gap-1.5 py-1 px-2.5 rounded-xl border border-slate-200/90 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-800 shadow-2xs transition-colors whitespace-nowrap cursor-pointer dark:bg-slate-800/60 dark:hover:bg-slate-800 dark:text-slate-200 dark:border-slate-700/60"
            >
              <CreditCard className="size-3 text-slate-600 dark:text-slate-300" />
              <span>سداد التزام</span>
            </button>
          </div>
        </section>

        {/* Section: Transactions Ledger Feed - Unified Table Container */}
        <section className="rounded-2xl border border-slate-200/90 dark:border-slate-800/80 bg-white dark:bg-[#0B0F17] shadow-xs overflow-hidden" aria-labelledby="history-heading">
          {/* Integrated Header Toolbar directly attached to top of table */}
          <div className="p-3 sm:p-4 border-b border-slate-200/90 dark:border-slate-800/80 flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 id="history-heading" className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-slate-100">
                <FileText className="size-4 text-emerald-600 dark:text-emerald-400" />
                <span>سجل المعاملات</span>
              </h2>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                عرض ومراجعة العمليات المالية المسجلة في دفتر الأستاذ
              </p>
            </div>

            {/* Compact, responsive RTL Toolbar */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-44 flex-1 sm:flex-initial">
                <Search className="pointer-events-none absolute right-3 top-2.5 size-3.5 text-slate-400 dark:text-slate-500" />
                <Input
                  placeholder="بحث في البيان أو المبلغ..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="h-8.5 pr-9 text-xs bg-white text-slate-900 border border-slate-300 placeholder:text-slate-400 focus:border-slate-500 dark:bg-[#0E1420] dark:text-slate-100 dark:border-slate-700/80 dark:placeholder:text-slate-500"
                />
              </div>

              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="h-8.5 w-32 text-xs bg-white text-slate-900 border border-slate-300 placeholder:text-slate-400 focus:border-slate-500 dark:bg-[#0E1420] dark:text-slate-100 dark:border-slate-700/80">
                  <Filter className="ml-1 size-3 text-slate-400 dark:text-slate-500" />
                  <SelectValue placeholder="نوع المعاملة" />
                </SelectTrigger>
                <SelectContent align="end" className="dark:bg-[#0E1420] dark:border-slate-800 dark:text-slate-100">
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
                  <SelectTrigger className="h-8.5 w-32 text-xs bg-white text-slate-900 border border-slate-300 placeholder:text-slate-400 focus:border-slate-500 dark:bg-[#0E1420] dark:text-slate-100 dark:border-slate-700/80">
                    <Building2 className="ml-1 size-3 text-slate-400 dark:text-slate-500" />
                    <SelectValue placeholder="الحساب" />
                  </SelectTrigger>
                  <SelectContent align="end" className="dark:bg-[#0E1420] dark:border-slate-800 dark:text-slate-100">
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
                  className="h-8.5 px-2.5 text-xs text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-slate-800/50"
                  title="إعادة تعيين الفلاتر"
                >
                  <RotateCcw className="size-3.5" />
                  <span className="sr-only sm:not-sr-only sm:mr-1">إعادة ضبط</span>
                </Button>
              )}

              <Badge variant="outline" className="h-8.5 border-slate-300 dark:border-slate-700/80 bg-slate-50 dark:bg-[#0E1420] px-2.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                {filteredEvents.length} عملية
              </Badge>
            </div>
          </div>

          {/* Transactions Table Container */}
          <div>
            {recentEvents.isLoading ? (
              <div className="space-y-3 p-6">
                <Skeleton className="h-10 w-full dark:bg-slate-800/40" />
                <Skeleton className="h-10 w-full dark:bg-slate-800/40" />
                <Skeleton className="h-10 w-full dark:bg-slate-800/40" />
              </div>
            ) : filteredEvents.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 text-center">
                <div className="flex size-13 items-center justify-center rounded-full border border-slate-200/80 dark:border-slate-800 bg-slate-50 dark:bg-[#0E1420] text-slate-400 dark:text-slate-500">
                  <FileText className="size-6 text-slate-400 dark:text-slate-500" />
                </div>
                <h3 className="mt-4 text-base font-bold text-slate-900 dark:text-slate-100">
                  {hasActiveFilters ? "لا توجد نتائج تطابق خيارات البحث" : "لا توجد معاملات مسجلة في هذه الفترة"}
                </h3>
                <p className="mt-1 max-w-sm text-xs text-slate-500 dark:text-slate-400">
                  {hasActiveFilters
                    ? "جرّب تعديل كلمات البحث أو تصفير الفلاتر لعرض كافة القيود المسجلة."
                    : "ابدأ بإضافة أول معاملة لتغذية كشوف الحساب ودفتر الأستاذ من أزرار العمليات أعلاه."}
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
                    className="mt-4 gap-1.5 text-xs border-slate-300 dark:border-slate-800 bg-white dark:bg-[#0E1420] text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
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
                    className="mt-4 gap-1.5 border border-emerald-300 dark:border-emerald-800/60 text-xs font-semibold text-emerald-950 dark:text-emerald-300 bg-emerald-50 hover:bg-emerald-100/70 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/40"
                  >
                    <ArrowDownLeft className="size-3.5" />
                    تسجيل إيداع جديد
                  </Button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-right text-sm">
                  <thead className="bg-slate-100/80 text-slate-800 font-bold text-xs border-b border-slate-200 dark:bg-[#0E1420] dark:text-slate-200 dark:border-slate-800 uppercase tracking-wide">
                    <tr>
                      <th className="py-3 px-4 pr-5 font-bold text-slate-800 dark:text-slate-200">نوع العملية</th>
                      <th className="py-3 px-4 font-bold text-slate-800 dark:text-slate-200">الحساب المالي</th>
                      <th className="py-3 px-4 font-bold text-slate-800 dark:text-slate-200">التاريخ والوقت</th>
                      <th className="py-3 px-4 font-bold text-slate-800 dark:text-slate-200">البيان والملاحظات</th>
                      <th className="py-3 px-4 font-bold text-slate-800 dark:text-slate-200">المبلغ الإجمالي</th>
                      <th className="py-3 px-4 font-bold text-slate-800 dark:text-slate-200">حالة القيد</th>
                      <th className="py-3 px-4 pl-5 font-bold text-slate-800 dark:text-slate-200 text-center">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-[#0B0F17] divide-y divide-slate-100 dark:divide-slate-800/60">
                    {filteredEvents.map(event => {
                      const meta = eventLabel[event.eventType] || {
                        label: event.eventType,
                        icon: ArrowLeftRight,
                        color: "text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60",
                        sign: "",
                        amountColor: "text-slate-900 dark:text-slate-200",
                      };
                      const Icon = meta.icon;
                      const formattedAmount = formatMoney(event.grossAmount, event.currency, 2);
                      const accountInfo = event.primaryAccountId ? accountMap.get(event.primaryAccountId) : null;
                      const isTrade = event.eventType === "buy" || event.eventType === "sell";
                      const isVoid = event.status === "void";

                      return (
                        <tr
                          key={event.id}
                          className="hover:bg-slate-50/90 border-b border-slate-100 text-slate-900 dark:hover:bg-slate-800/40 dark:border-slate-800/60 dark:text-slate-100 transition-colors last:border-b-0"
                        >
                          {/* Type Column */}
                          <td className="py-3 px-4 pr-5">
                            <div className="flex items-center gap-2.5">
                              <div className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${meta.color}`}>
                                <Icon className="size-4" />
                              </div>
                              <div>
                                <p className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                                  {meta.label}
                                </p>
                                <p className="font-mono text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                  #{event.id}
                                </p>
                              </div>
                            </div>
                          </td>

                          {/* Account Column */}
                          <td className="py-3 px-4">
                            <div>
                              <p className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                                {accountInfo?.name || "حساب المعاملة"}
                              </p>
                              <p className="font-mono text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                {event.currency}
                              </p>
                            </div>
                          </td>

                          {/* Date Column */}
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-1.5 font-mono text-xs font-medium text-slate-600 dark:text-slate-400">
                              <Clock className="size-3 text-slate-500 dark:text-slate-400 shrink-0" />
                              <span>{new Date(event.occurredAt).toLocaleString("en-GB")}</span>
                            </div>
                          </td>

                          {/* Memo Column */}
                          <td className="max-w-xs py-3 px-4 text-xs text-slate-600 dark:text-slate-300">
                            <span className="truncate block" title={event.memo || ""}>
                              {event.memo || "—"}
                            </span>
                          </td>

                          {/* Amount Column */}
                          <td className="py-3 px-4">
                            <div className="font-mono text-sm sm:text-base font-bold tracking-tight" dir="ltr">
                              <span className={`${meta.amountColor} font-bold font-mono text-sm sm:text-base tabular-nums`}>
                                {meta.sign} <SensitiveValue>{formattedAmount}</SensitiveValue>
                              </span>
                            </div>
                          </td>

                          {/* Status Badge */}
                          <td className="py-3 px-4">
                            {event.status === "posted" ? (
                              <span className="inline-flex items-center rounded-full bg-emerald-50 text-emerald-950 border border-emerald-300 font-semibold text-xs px-2.5 py-1 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800/60 whitespace-nowrap">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400 inline-block ml-1.5 shrink-0" />
                                <span>مرحّل</span>
                              </span>
                            ) : event.status === "void" ? (
                              <span className="inline-flex items-center rounded-full bg-rose-50 text-rose-950 border border-rose-300 font-semibold text-xs px-2.5 py-1 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800/60 whitespace-nowrap">
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-600 dark:bg-rose-400 inline-block ml-1.5 shrink-0" />
                                <span>ملغاة (معكوسة)</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center rounded-full bg-amber-50 text-amber-950 border border-amber-300 font-semibold text-xs px-2.5 py-1 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800/60 whitespace-nowrap">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-600 dark:bg-amber-400 inline-block ml-1.5 shrink-0" />
                                <span>معلق</span>
                              </span>
                            )}
                          </td>

                          {/* Actions Column */}
                          <td className="py-3 px-4 pl-5 text-center">
                            {canEdit && !isVoid ? (
                              <div className="flex items-center justify-center gap-1.5">
                                {isTrade && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleOpenEditTrade(event)}
                                    className="h-8 w-8 p-0 rounded-lg text-slate-600 hover:text-sky-600 hover:bg-sky-50 dark:text-slate-400 dark:hover:text-sky-400 dark:hover:bg-sky-950/50"
                                    title="تعديل الصفقة"
                                  >
                                    <Pencil className="size-3.5" />
                                  </Button>
                                )}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleOpenDelete(event)}
                                  className="h-8 w-8 p-0 rounded-lg text-slate-600 hover:text-rose-600 hover:bg-rose-50 dark:text-slate-400 dark:hover:text-rose-400 dark:hover:bg-rose-950/50"
                                  title="حذف / إلغاء القيد"
                                >
                                  <Trash2 className="size-3.5" />
                                </Button>
                              </div>
                            ) : (
                              <span className="text-slate-400 text-xs">—</span>
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
          <DialogContent className="max-w-xl sm:max-w-xl w-full overflow-hidden bg-white text-slate-900 dark:bg-[#0B0F17] dark:text-slate-100 border border-slate-200 dark:border-slate-800 shadow-2xl rounded-2xl" dir="rtl">
            <DialogHeader className="border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center justify-between">
                <DialogTitle className="flex items-center gap-2 text-slate-900 dark:text-white font-bold text-lg">
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
                    className={TONE_STYLES[ALL_OPERATIONS.find(op => op.id === activeModal)?.tone || "emerald"].badge}
                  >
                    {ALL_OPERATIONS.find(op => op.id === activeModal)?.badge}
                  </Badge>
                )}
              </div>
              <DialogDescription className="text-slate-600 dark:text-slate-400 text-xs font-medium mt-1">
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
                        <Label className="text-slate-800 dark:text-slate-200 font-semibold text-xs mb-1.5 block">الحساب المالي</Label>
                        <Select value={primaryAccountId} onValueChange={setPrimaryAccountId} required>
                          <SelectTrigger className="w-full min-w-0 justify-between overflow-hidden bg-white text-slate-900 border border-slate-300 placeholder:text-slate-400 focus:border-slate-600 focus:ring-1 focus:ring-slate-600 rounded-xl dark:bg-[#0E1420] dark:text-slate-100 dark:border-slate-700 dark:placeholder:text-slate-500">
                            <SelectValue placeholder="اختر الحساب المستهدف" className="truncate" />
                          </SelectTrigger>
                          <SelectContent className="max-w-[calc(100vw-2rem)] w-[var(--radix-select-trigger-width)] bg-white dark:bg-[#0E1420] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100">
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
                          <Label htmlFor="tx-amount" className="text-slate-800 dark:text-slate-200 font-semibold text-xs mb-1.5 block">
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
                            className="w-full bg-white text-slate-900 border border-slate-300 placeholder:text-slate-400 focus:border-slate-600 focus:ring-1 focus:ring-slate-600 rounded-xl dark:bg-[#0E1420] dark:text-slate-100 dark:border-slate-700 dark:placeholder:text-slate-500"
                            required
                          />
                        </div>
                        <div className="grid gap-2 min-w-0">
                          <Label className="text-slate-800 dark:text-slate-200 font-semibold text-xs mb-1.5 block">تصنيف التدفق (اختياري)</Label>
                          <Select value={categoryId} onValueChange={setCategoryId}>
                            <SelectTrigger className="w-full min-w-0 justify-between overflow-hidden bg-white text-slate-900 border border-slate-300 placeholder:text-slate-400 focus:border-slate-600 focus:ring-1 focus:ring-slate-600 rounded-xl dark:bg-[#0E1420] dark:text-slate-100 dark:border-slate-700 dark:placeholder:text-slate-500">
                              <SelectValue placeholder="اختر تصنيفاً" className="truncate" />
                            </SelectTrigger>
                            <SelectContent className="max-w-[calc(100vw-2rem)] w-[var(--radix-select-trigger-width)] bg-white dark:bg-[#0E1420] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100">
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
                        <Label htmlFor="tx-memo" className="text-slate-800 dark:text-slate-200 font-semibold text-xs mb-1.5 block">البيان والملاحظات</Label>
                        <Textarea
                          id="tx-memo"
                          value={memo}
                          onChange={e => setMemo(e.target.value)}
                          placeholder="ملاحظات توثيقية إضافية للتدقيق..."
                          rows={2}
                          maxLength={2000}
                          className="w-full bg-white text-slate-900 border border-slate-300 placeholder:text-slate-400 focus:border-slate-600 focus:ring-1 focus:ring-slate-600 rounded-xl dark:bg-[#0E1420] dark:text-slate-100 dark:border-slate-700 dark:placeholder:text-slate-500"
                        />
                      </div>
                    </>
                  )}

                  {/* Operation: Internal Transfer */}
                  {activeModal === "transfer" && (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="grid gap-2 min-w-0">
                          <Label className="text-slate-800 dark:text-slate-200 font-semibold text-xs mb-1.5 block">من الحساب (المصدر)</Label>
                          <Select value={primaryAccountId} onValueChange={setPrimaryAccountId} required>
                            <SelectTrigger className="w-full min-w-0 justify-between overflow-hidden bg-white text-slate-900 border border-slate-300 placeholder:text-slate-400 focus:border-slate-600 focus:ring-1 focus:ring-slate-600 rounded-xl dark:bg-[#0E1420] dark:text-slate-100 dark:border-slate-700 dark:placeholder:text-slate-500">
                              <SelectValue placeholder="حساب الخصم" className="truncate" />
                            </SelectTrigger>
                            <SelectContent className="max-w-[calc(100vw-2rem)] w-[var(--radix-select-trigger-width)] bg-white dark:bg-[#0E1420] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100">
                              {cashAccounts.map(account => (
                                <SelectItem key={account.id} value={String(account.id)}>
                                  <span className="truncate">{account.name} ({formatMoney(account.balance, account.currency, 2)})</span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid gap-2 min-w-0">
                          <Label className="text-slate-800 dark:text-slate-200 font-semibold text-xs mb-1.5 block">إلى الحساب (الوجهة)</Label>
                          <Select value={targetAccountId} onValueChange={setTargetAccountId} required>
                            <SelectTrigger className="w-full min-w-0 justify-between overflow-hidden bg-white text-slate-900 border border-slate-300 placeholder:text-slate-400 focus:border-slate-600 focus:ring-1 focus:ring-slate-600 rounded-xl dark:bg-[#0E1420] dark:text-slate-100 dark:border-slate-700 dark:placeholder:text-slate-500">
                              <SelectValue placeholder="حساب الإيداع" className="truncate" />
                            </SelectTrigger>
                            <SelectContent className="max-w-[calc(100vw-2rem)] w-[var(--radix-select-trigger-width)] bg-white dark:bg-[#0E1420] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100">
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
                        <Label htmlFor="tr-amount" className="text-slate-800 dark:text-slate-200 font-semibold text-xs mb-1.5 block">
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
                          className="w-full bg-white text-slate-900 border border-slate-300 placeholder:text-slate-400 focus:border-slate-600 focus:ring-1 focus:ring-slate-600 rounded-xl dark:bg-[#0E1420] dark:text-slate-100 dark:border-slate-700 dark:placeholder:text-slate-500"
                          required
                        />
                      </div>

                      <div className="grid gap-2 min-w-0">
                        <Label htmlFor="tr-memo" className="text-slate-800 dark:text-slate-200 font-semibold text-xs mb-1.5 block">البيان والملاحظات</Label>
                        <Textarea
                          id="tr-memo"
                          value={memo}
                          onChange={e => setMemo(e.target.value)}
                          placeholder="مذكرة التحويل الداخلي..."
                          rows={2}
                          maxLength={2000}
                          className="w-full bg-white text-slate-900 border border-slate-300 placeholder:text-slate-400 focus:border-slate-600 focus:ring-1 focus:ring-slate-600 rounded-xl dark:bg-[#0E1420] dark:text-slate-100 dark:border-slate-700 dark:placeholder:text-slate-500"
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
                          <Label className="text-slate-800 dark:text-slate-200 font-semibold text-xs mb-1.5 block">حساب التسوية النقدية</Label>
                          <Select value={primaryAccountId} onValueChange={setPrimaryAccountId} required>
                            <SelectTrigger className="w-full min-w-0 justify-between overflow-hidden bg-white text-slate-900 border border-slate-300 placeholder:text-slate-400 focus:border-slate-600 focus:ring-1 focus:ring-slate-600 rounded-xl dark:bg-[#0E1420] dark:text-slate-100 dark:border-slate-700 dark:placeholder:text-slate-500">
                              <SelectValue placeholder="اختر الحساب النقدي" className="truncate" />
                            </SelectTrigger>
                            <SelectContent className="max-w-[calc(100vw-2rem)] w-[var(--radix-select-trigger-width)] bg-white dark:bg-[#0E1420] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100">
                              {cashAccounts.map(account => (
                                <SelectItem key={account.id} value={String(account.id)}>
                                  <span className="truncate">{account.name} ({formatMoney(account.balance, account.currency, 2)})</span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid gap-2 min-w-0">
                          <Label className="text-slate-800 dark:text-slate-200 font-semibold text-xs mb-1.5 block">
                            {activeModal === "fund_redemption"
                              ? "الصندوق / الأداة الاستثمارية"
                              : "الأداة الاستثمارية"}
                          </Label>
                          <Select value={instrumentId} onValueChange={setInstrumentId} required>
                            <SelectTrigger className="w-full min-w-0 justify-between overflow-hidden bg-white text-slate-900 border border-slate-300 placeholder:text-slate-400 focus:border-slate-600 focus:ring-1 focus:ring-slate-600 rounded-xl dark:bg-[#0E1420] dark:text-slate-100 dark:border-slate-700 dark:placeholder:text-slate-500">
                              <SelectValue placeholder="اختر الأداة" className="truncate" />
                            </SelectTrigger>
                            <SelectContent className="max-w-[calc(100vw-2rem)] w-[var(--radix-select-trigger-width)] bg-white dark:bg-[#0E1420] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100">
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
                          <Label htmlFor="tr-qty" className="text-slate-800 dark:text-slate-200 font-semibold text-xs mb-1.5 block">الكمية / عدد الوثائق</Label>
                          <Input
                            id="tr-qty"
                            type="number"
                            step="any"
                            min="0.0001"
                            value={quantity}
                            onChange={e => setQuantity(e.target.value)}
                            placeholder="0"
                            className="w-full bg-white text-slate-900 border border-slate-300 placeholder:text-slate-400 focus:border-slate-600 focus:ring-1 focus:ring-slate-600 rounded-xl dark:bg-[#0E1420] dark:text-slate-100 dark:border-slate-700 dark:placeholder:text-slate-500"
                            required
                          />
                        </div>
                        <div className="grid gap-2 min-w-0">
                          <Label htmlFor="tr-price" className="text-slate-800 dark:text-slate-200 font-semibold text-xs mb-1.5 block">
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
                            className="w-full bg-white text-slate-900 border border-slate-300 placeholder:text-slate-400 focus:border-slate-600 focus:ring-1 focus:ring-slate-600 rounded-xl dark:bg-[#0E1420] dark:text-slate-100 dark:border-slate-700 dark:placeholder:text-slate-500"
                            required
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="grid gap-2 min-w-0">
                          <Label htmlFor="tr-fees" className="text-slate-800 dark:text-slate-200 font-semibold text-xs mb-1.5 block">رسوم المعاملة (اختياري)</Label>
                          <Input
                            id="tr-fees"
                            type="number"
                            step="any"
                            min="0"
                            value={feeAmount}
                            onChange={e => setFeeAmount(e.target.value)}
                            placeholder="0.00"
                            className="w-full bg-white text-slate-900 border border-slate-300 placeholder:text-slate-400 focus:border-slate-600 focus:ring-1 focus:ring-slate-600 rounded-xl dark:bg-[#0E1420] dark:text-slate-100 dark:border-slate-700 dark:placeholder:text-slate-500"
                          />
                        </div>
                        <div className="grid gap-2 min-w-0">
                          <Label htmlFor="tr-tax" className="text-slate-800 dark:text-slate-200 font-semibold text-xs mb-1.5 block">الضرائب (اختياري)</Label>
                          <Input
                            id="tr-tax"
                            type="number"
                            step="any"
                            min="0"
                            value={taxAmount}
                            onChange={e => setTaxAmount(e.target.value)}
                            placeholder="0.00"
                            className="w-full bg-white text-slate-900 border border-slate-300 placeholder:text-slate-400 focus:border-slate-600 focus:ring-1 focus:ring-slate-600 rounded-xl dark:bg-[#0E1420] dark:text-slate-100 dark:border-slate-700 dark:placeholder:text-slate-500"
                          />
                        </div>
                      </div>

                      <div className="grid gap-2 min-w-0">
                        <Label htmlFor="tr-memo" className="text-slate-800 dark:text-slate-200 font-semibold text-xs mb-1.5 block">البيان والملاحظات</Label>
                        <Textarea
                          id="tr-memo"
                          value={memo}
                          onChange={e => setMemo(e.target.value)}
                          placeholder="ملاحظات توثيق الصفقة..."
                          rows={2}
                          maxLength={2000}
                          className="w-full bg-white text-slate-900 border border-slate-300 placeholder:text-slate-400 focus:border-slate-600 focus:ring-1 focus:ring-slate-600 rounded-xl dark:bg-[#0E1420] dark:text-slate-100 dark:border-slate-700 dark:placeholder:text-slate-500"
                        />
                      </div>
                    </>
                  )}

                  {/* Operation: Debt Payment */}
                  {activeModal === "debt_payment" && (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="grid gap-2 min-w-0">
                          <Label className="text-slate-800 dark:text-slate-200 font-semibold text-xs mb-1.5 block">الالتزام / القرض المستحق</Label>
                          <Select value={debtId} onValueChange={setDebtId} required>
                            <SelectTrigger className="w-full min-w-0 justify-between overflow-hidden bg-white text-slate-900 border border-slate-300 placeholder:text-slate-400 focus:border-slate-600 focus:ring-1 focus:ring-slate-600 rounded-xl dark:bg-[#0E1420] dark:text-slate-100 dark:border-slate-700 dark:placeholder:text-slate-500">
                              <SelectValue placeholder="اختر الالتزام" className="truncate" />
                            </SelectTrigger>
                            <SelectContent className="max-w-[calc(100vw-2rem)] w-[var(--radix-select-trigger-width)] bg-white dark:bg-[#0E1420] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100">
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
                          <Label className="text-slate-800 dark:text-slate-200 font-semibold text-xs mb-1.5 block">حساب السداد</Label>
                          <Select value={primaryAccountId} onValueChange={setPrimaryAccountId} required>
                            <SelectTrigger className="w-full min-w-0 justify-between overflow-hidden bg-white text-slate-900 border border-slate-300 placeholder:text-slate-400 focus:border-slate-600 focus:ring-1 focus:ring-slate-600 rounded-xl dark:bg-[#0E1420] dark:text-slate-100 dark:border-slate-700 dark:placeholder:text-slate-500">
                              <SelectValue placeholder="اختر حساب الخصم" className="truncate" />
                            </SelectTrigger>
                            <SelectContent className="max-w-[calc(100vw-2rem)] w-[var(--radix-select-trigger-width)] bg-white dark:bg-[#0E1420] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100">
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
                          <Label htmlFor="dp-principal" className="text-slate-800 dark:text-slate-200 font-semibold text-xs mb-1.5 block">مبلغ الأصل المسدد</Label>
                          <Input
                            id="dp-principal"
                            type="number"
                            step="any"
                            min="0.01"
                            value={amount}
                            onChange={e => setAmount(e.target.value)}
                            placeholder="0.00"
                            className="w-full bg-white text-slate-900 border border-slate-300 placeholder:text-slate-400 focus:border-slate-600 focus:ring-1 focus:ring-slate-600 rounded-xl dark:bg-[#0E1420] dark:text-slate-100 dark:border-slate-700 dark:placeholder:text-slate-500"
                            required
                          />
                        </div>
                        <div className="grid gap-2 min-w-0">
                          <Label htmlFor="dp-interest" className="text-slate-800 dark:text-slate-200 font-semibold text-xs mb-1.5 block">الفائدة (إن وجدت)</Label>
                          <Input
                            id="dp-interest"
                            type="number"
                            step="any"
                            min="0"
                            value={interestAmount}
                            onChange={e => setInterestAmount(e.target.value)}
                            placeholder="0.00"
                            className="w-full bg-white text-slate-900 border border-slate-300 placeholder:text-slate-400 focus:border-slate-600 focus:ring-1 focus:ring-slate-600 rounded-xl dark:bg-[#0E1420] dark:text-slate-100 dark:border-slate-700 dark:placeholder:text-slate-500"
                          />
                        </div>
                        <div className="grid gap-2 min-w-0">
                          <Label htmlFor="dp-fee" className="text-slate-800 dark:text-slate-200 font-semibold text-xs mb-1.5 block">رسوم السداد</Label>
                          <Input
                            id="dp-fee"
                            type="number"
                            step="any"
                            min="0"
                            value={feeAmount}
                            onChange={e => setFeeAmount(e.target.value)}
                            placeholder="0.00"
                            className="w-full bg-white text-slate-900 border border-slate-300 placeholder:text-slate-400 focus:border-slate-600 focus:ring-1 focus:ring-slate-600 rounded-xl dark:bg-[#0E1420] dark:text-slate-100 dark:border-slate-700 dark:placeholder:text-slate-500"
                          />
                        </div>
                      </div>

                      <div className="grid gap-2 min-w-0">
                        <Label htmlFor="dp-memo" className="text-slate-800 dark:text-slate-200 font-semibold text-xs mb-1.5 block">البيان والملاحظات</Label>
                        <Textarea
                          id="dp-memo"
                          value={memo}
                          onChange={e => setMemo(e.target.value)}
                          placeholder="رقم مرجع السداد أو ملاحظة..."
                          rows={2}
                          maxLength={2000}
                          className="w-full bg-white text-slate-900 border border-slate-300 placeholder:text-slate-400 focus:border-slate-600 focus:ring-1 focus:ring-slate-600 rounded-xl dark:bg-[#0E1420] dark:text-slate-100 dark:border-slate-700 dark:placeholder:text-slate-500"
                        />
                      </div>
                    </>
                  )}
                </>
              ) : (
                /* Step 2: Elevated Institutional Review Summary */
                <div className="space-y-4 py-1">
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-[#0E1420] p-4 space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2 text-xs text-slate-600 dark:text-slate-400">
                      <span>نوع العملية المسجلة:</span>
                      <span className="font-bold text-slate-900 dark:text-white">
                        {ALL_OPERATIONS.find(op => op.id === activeModal)?.title}
                      </span>
                    </div>

                    {selectedAccount && (
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-600 dark:text-slate-400">
                          {activeModal === "transfer" ? "حساب المصدر (الخصم):" : "حساب التسوية / الخصم:"}
                        </span>
                        <span className="font-semibold text-slate-900 dark:text-white">
                          {selectedAccount.name} ({formatMoney(selectedAccount.balance, selectedAccount.currency, 2)})
                        </span>
                      </div>
                    )}

                    {selectedTargetAccount && (
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-600 dark:text-slate-400">حساب الوجهة (الإيداع):</span>
                        <span className="font-semibold text-slate-900 dark:text-white">
                          {selectedTargetAccount.name} ({formatMoney(selectedTargetAccount.balance, selectedTargetAccount.currency, 2)})
                        </span>
                      </div>
                    )}

                    {selectedInstrument && (
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-600 dark:text-slate-400">الأداة الاستثمارية:</span>
                        <span className="font-semibold text-slate-900 dark:text-white">
                          {selectedInstrument.name} ({selectedInstrument.currency})
                        </span>
                      </div>
                    )}

                    {selectedDebt && (
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-600 dark:text-slate-400">عقد الالتزام:</span>
                        <span className="font-semibold text-slate-900 dark:text-white">
                          {selectedDebt.name} (المستحق: {formatMoney(selectedDebt.outstanding, selectedDebt.currency, 2)})
                        </span>
                      </div>
                    )}

                    {/* Breakdown for trade operations */}
                    {(activeModal === "buy" || activeModal === "sell" || activeModal === "fund_redemption") && (
                      <div className="space-y-1.5 border-t border-slate-200 dark:border-slate-800 pt-2 text-xs">
                        <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                          <span>القيمة الأساسية ({quantity} × {unitPrice}):</span>
                          <span className="font-mono font-semibold text-slate-900 dark:text-white">
                            {formatMoney(
                              (Number(quantity || 0) * Number(unitPrice || 0)).toFixed(2),
                              selectedInstrument?.currency || "EGP",
                              2
                            )}
                          </span>
                        </div>
                        {Number(feeAmount || 0) > 0 && (
                          <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                            <span>رسوم المعاملة:</span>
                            <span className="font-mono font-semibold text-slate-900 dark:text-white">
                              {formatMoney(Number(feeAmount).toFixed(2), selectedInstrument?.currency || "EGP", 2)}
                            </span>
                          </div>
                        )}
                        {Number(taxAmount || 0) > 0 && (
                          <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                            <span>الضرائب:</span>
                            <span className="font-mono font-semibold text-slate-900 dark:text-white">
                              {formatMoney(Number(taxAmount).toFixed(2), selectedInstrument?.currency || "EGP", 2)}
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Breakdown for debt payment */}
                    {activeModal === "debt_payment" && (
                      <div className="space-y-1.5 border-t border-slate-200 dark:border-slate-800 pt-2 text-xs">
                        <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                          <span>أصل الدين المسدد:</span>
                          <span className="font-mono font-semibold text-slate-900 dark:text-white">
                            {formatMoney(amount, selectedAccount?.currency || "EGP", 2)}
                          </span>
                        </div>
                        {Number(interestAmount || 0) > 0 && (
                          <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                            <span>الفائدة المسددة:</span>
                            <span className="font-mono font-semibold text-slate-900 dark:text-white">
                              {formatMoney(interestAmount, selectedAccount?.currency || "EGP", 2)}
                            </span>
                          </div>
                        )}
                        {Number(feeAmount || 0) > 0 && (
                          <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                            <span>رسوم السداد:</span>
                            <span className="font-mono font-semibold text-slate-900 dark:text-white">
                              {formatMoney(feeAmount, selectedAccount?.currency || "EGP", 2)}
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Prominent Net Cash Flow highlight box */}
                    <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B0F17] p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                            صافي التدفق النقدي:
                          </span>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
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
                        <div className="text-left font-mono text-base font-bold text-slate-900 dark:text-white">
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
                      <div className="border-t border-slate-200 dark:border-slate-800 pt-2 text-xs text-slate-600 dark:text-slate-400">
                        <span className="font-semibold text-slate-800 dark:text-slate-200">البيان: </span>
                        <span className="text-slate-700 dark:text-slate-300">{memo}</span>
                      </div>
                    )}
                  </div>

                  {/* Security and ledger invariant guarantee badge */}
                  <div className="flex items-center gap-2 rounded-lg border border-emerald-300 dark:border-emerald-800/60 bg-emerald-50 dark:bg-emerald-950/40 p-3 text-xs font-medium text-emerald-950 dark:text-emerald-300">
                    <ShieldCheck className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    <span>
                      سيتم ترحيل المعاملة بقيد محاسبي مزدوج متوازن مع تثبيت سجل التدقيق المقترن.
                    </span>
                  </div>
                </div>
              )}

              <DialogFooter className="gap-2 sm:gap-0 pt-3 border-t border-slate-200 dark:border-slate-800">
                {reviewStep ? (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setReviewStep(false)}
                      disabled={isPending}
                      className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white text-sm font-semibold px-4 py-2.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0E1420] rounded-xl"
                    >
                      تعديل البيانات
                    </Button>
                    <Button
                      type="submit"
                      disabled={isPending}
                      className="bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:hover:bg-slate-100 dark:text-slate-950 font-bold text-sm py-2.5 px-5 rounded-xl shadow-sm transition-all"
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
                      className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white text-sm font-semibold"
                    >
                      إلغاء
                    </Button>
                    <Button
                      type="submit"
                      className="bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:hover:bg-slate-100 dark:text-slate-950 font-bold text-sm py-2.5 px-5 rounded-xl shadow-sm transition-all"
                    >
                      مراجعة العملية
                    </Button>
                  </>
                )}
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Edit Trade Modal */}
        <Dialog open={editTradeModalOpen} onOpenChange={setEditTradeModalOpen}>
          <DialogContent className="max-w-lg w-full bg-white text-slate-900 dark:bg-[#0B0F17] dark:text-slate-100 border border-slate-200 dark:border-slate-800 shadow-2xl rounded-2xl" dir="rtl">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-slate-900 dark:text-white">
                تعديل بيانات الصفقة #{selectedTradeForEdit?.id}
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 dark:text-slate-400">
                سيتم عكس القيد المحاسبي وحسابات FIFO السابقة تلقائياً وإعادة تسجيل الصفقة بالقيم المعدلة لضمان توازن دفتر الأستاذ بنسبة 100%.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSaveEditTrade} className="grid gap-3.5 mt-2">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label className="text-xs font-semibold">حساب التسوية</Label>
                  <Select value={editTradeAccountId} onValueChange={setEditTradeAccountId}>
                    <SelectTrigger className="rounded-xl text-sm">
                      <SelectValue placeholder="اختر الحساب" />
                    </SelectTrigger>
                    <SelectContent className="bg-white dark:bg-[#0B0F17]">
                      {(accounts.data ?? []).map((acc) => (
                        <SelectItem key={acc.id} value={String(acc.id)}>
                          {acc.name} ({acc.currency})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-xs font-semibold">التاريخ والوقت</Label>
                  <Input
                    type="datetime-local"
                    value={editTradeDate}
                    onChange={(e) => setEditTradeDate(e.target.value)}
                    required
                    className="rounded-xl text-sm font-mono"
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label className="text-xs font-semibold">الكمية</Label>
                  <Input
                    inputMode="decimal"
                    value={editTradeQuantity}
                    onChange={(e) => setEditTradeQuantity(e.target.value)}
                    required
                    className="rounded-xl text-sm font-mono"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-xs font-semibold">سعر الوحدة</Label>
                  <Input
                    inputMode="decimal"
                    value={editTradeUnitPrice}
                    onChange={(e) => setEditTradeUnitPrice(e.target.value)}
                    required
                    className="rounded-xl text-sm font-mono"
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label className="text-xs font-semibold">الرسوم (اختياري)</Label>
                  <Input
                    inputMode="decimal"
                    value={editTradeFeeAmount}
                    onChange={(e) => setEditTradeFeeAmount(e.target.value)}
                    className="rounded-xl text-sm font-mono"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-xs font-semibold">الضرائب (اختياري)</Label>
                  <Input
                    inputMode="decimal"
                    value={editTradeTaxAmount}
                    onChange={(e) => setEditTradeTaxAmount(e.target.value)}
                    className="rounded-xl text-sm font-mono"
                  />
                </div>
              </div>

              <div className="grid gap-1.5">
                <Label className="text-xs font-semibold">ملاحظات / بيان العملية</Label>
                <Textarea
                  value={editTradeMemo}
                  onChange={(e) => setEditTradeMemo(e.target.value)}
                  maxLength={2000}
                  className="rounded-xl text-sm"
                />
              </div>

              <DialogFooter className="mt-3 gap-2 flex-row-reverse">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditTradeModalOpen(false)}
                  className="rounded-xl text-xs"
                >
                  إلغاء
                </Button>
                <Button
                  type="submit"
                  disabled={updateTradeMutation.isPending}
                  className="rounded-xl text-xs bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900"
                >
                  {updateTradeMutation.isPending && <Loader2 className="ml-2 size-3.5 animate-spin" />}
                  حفظ التعديلات وعكس القيود
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Delete Transaction ConfirmDialog */}
        <ConfirmDialog
          open={deleteTransactionOpen}
          onOpenChange={setDeleteTransactionOpen}
          title="إلغاء وحذف المعاملة المحاسبية"
          description={`هل أنت متأكد من حذف العملية #${selectedTransactionForDelete?.id} (${selectedTransactionForDelete?.memo || selectedTransactionForDelete?.eventType || ""})؟ سيتم إلغاء العملية وعكس قيود اليومية المحاسبية واستعادة أرصدة الحسابات وسجلات FIFO آلياً.`}
          confirmText={deleteTransactionMutation.isPending ? "جارٍ الحذف والعكس..." : "تأكيد الحذف والعكس"}
          cancelText="إلغاء"
          variant="destructive"
          isLoading={deleteTransactionMutation.isPending}
          onConfirm={handleConfirmDelete}
        />
      </div>
    </DashboardLayout>
  );
}
