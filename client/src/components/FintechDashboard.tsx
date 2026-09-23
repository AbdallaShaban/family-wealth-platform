import { useAuth } from "@/_core/hooks/useAuth";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  BadgeDollarSign,
  BarChart3,
  CircleDollarSign,
  DollarSign,
  Eye,
  Landmark,
  MoreHorizontal,
  Plus,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  TrendingDown,
  TrendingUp,
  WalletCards,
  Pencil,
  Filter,
  RefreshCw,
  Info,
  CreditCard,
  Building2,
  Calendar,
  Clock,
  Percent,
  Receipt,
  Coins,
} from "lucide-react";
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { demoDashboard, getDashboardPreviewMode } from "@/lib/demoDashboard";
import { useDemoMode } from "@/contexts/DemoModeContext";
import { trpc } from "@/lib/trpc";
import { TransactionAdvisorWidget } from "@/components/TransactionAdvisorWidget";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import SensitiveValue from "@/components/SensitiveValue";
import { formatMoney, formatDateTime, formatDate, normalizeCurrency } from "@/lib/financialDisplay";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

const FintechCharts = lazy(() => import("./FintechCharts"));
import OnboardingChecklist from "./OnboardingChecklist";
import { OnboardingWizard } from "./OnboardingWizard";
import WealthCoPilotCard from "./dashboard/WealthCoPilotCard";
import RetailSignalsWidget from "./dashboard/RetailSignalsWidget";

const eventLabels: Record<string, string> = {
  opening_balance: "رصيد افتتاحي",
  deposit: "إيداع",
  withdrawal: "سحب",
  transfer: "تحويل",
  buy: "شراء",
  sell: "بيع",
  dividend: "توزيع نقدي",
  income: "دخل",
  expense: "مصروف",
  fee: "رسوم",
  tax: "ضريبة",
  adjustment: "تسوية",
  reversal: "عكس عملية",
};

function AnimatedMoney({ value, currency }: { value: number | string; currency: string }) {
  const target = Number(value) || 0;
  const [display, setDisplay] = useState(0);
  const previousTarget = useRef(0);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (reduceMotion) {
      setDisplay(target);
      previousTarget.current = target;
      return;
    }
    let frame = 0;
    const startedAt = performance.now();
    const initial = previousTarget.current;
    const duration = 760;
    const tick = (now: number) => {
      const progress = Math.min((now - startedAt) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 4);
      setDisplay(initial + (target - initial) * eased);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    previousTarget.current = target;
    return () => cancelAnimationFrame(frame);
  }, [target, reduceMotion]);

  const safeCurrency = normalizeCurrency(currency);
  const formattedNumber = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(display) ? display : 0);

  return (
    <span className="tabular-nums inline-flex items-baseline gap-1.5" dir="ltr">
      <span className="text-xs sm:text-sm font-semibold text-slate-500 dark:text-slate-400 select-none">
        {safeCurrency}
      </span>
      <SensitiveValue>{formattedNumber}</SensitiveValue>
    </span>
  );
}

function ExecutiveMetricCell({
  icon: Icon,
  label,
  value,
  currency,
  detail,
  accent = "emerald",
  className = "",
  isPriority = false,
  infoTooltip,
}: {
  icon: any;
  label: string;
  value: any;
  currency: string;
  detail: any;
  accent?: "indigo" | "emerald" | "sky" | "rose" | "amber";
  className?: string;
  isPriority?: boolean;
  infoTooltip?: React.ReactNode;
}) {
  const accentStyles = {
    indigo:
      "bg-indigo-50 text-indigo-800 border border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-200 dark:border-indigo-800/60",
    emerald:
      "bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-800/60",
    sky:
      "bg-sky-50 text-sky-800 border border-sky-200 dark:bg-sky-950/40 dark:text-sky-200 dark:border-sky-800/60",
    amber:
      "bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-800/60",
    rose:
      "bg-rose-50 text-rose-800 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-200 dark:border-rose-800/60",
  }[accent || "emerald"];

  return (
    <div
      className={`p-5 flex flex-col justify-between transition-colors ${isPriority
          ? "bg-slate-50/60 dark:bg-slate-900/30"
          : "hover:bg-slate-50/40 dark:hover:bg-slate-900/20"
        } ${className}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-slate-600 dark:text-slate-400 font-semibold text-xs tracking-wider uppercase">
            {label}
          </span>
          {infoTooltip && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-help inline-flex items-center"
                  aria-label="معلومات إضافية"
                >
                  <Info className="size-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent
                side="top"
                className="max-w-xs text-xs p-3 bg-slate-900 text-slate-100 border border-slate-700 shadow-xl z-50 rounded-xl"
              >
                {infoTooltip}
              </TooltipContent>
            </Tooltip>
          )}
        </div>
        <div className={`flex size-8 items-center justify-center rounded-xl ${accentStyles}`}>
          <Icon className="size-4" />
        </div>
      </div>
      <div className="mt-3.5 mb-1.5">
        <strong
          className={`font-mono tabular-nums tracking-tight block overflow-hidden text-ellipsis whitespace-nowrap ${isPriority
              ? "text-slate-900 dark:text-white font-bold text-2xl lg:text-3xl"
              : "text-slate-900 dark:text-white font-bold text-xl sm:text-2xl"
            }`}
        >
          <AnimatedMoney value={value} currency={currency} />
        </strong>
      </div>
      <span className="text-slate-600 dark:text-slate-400 text-xs font-medium block leading-relaxed">
        {detail}
      </span>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <DashboardLayout>
      <div className="fintech-page space-y-6" dir="rtl">
        <Skeleton className="h-36 w-full rounded-[2rem]" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton className="h-44 rounded-[1.5rem]" key={index} />
          ))}
        </div>
        <Skeleton className="h-[26rem] w-full rounded-[1.5rem]" />
      </div>
    </DashboardLayout>
  );
}

const FINTECH_ASSET_PALETTE = [
  "#10B981", // Emerald
  "#6366F1", // Indigo
  "#0EA5E9", // Sky Blue
  "#F59E0B", // Amber
  "#F43F5E", // Rose
  "#14B8A6", // Teal
  "#8B5CF6", // Violet
  "#EC4899", // Pink
];

export default function FintechDashboard() {
  const { user } = useAuth();
  const { isDemoMode, toggleDemoMode } = useDemoMode();
  const [_, setLocation] = useLocation();
  const [wizardOpen, setWizardOpen] = useState(false);
  const summary = trpc.family.dashboard.useQuery();
  const debts = trpc.family.debts.list.useQuery();
  const decisions = trpc.family.planning.decisionCenter.useQuery(undefined, { enabled: !isDemoMode });
  const marketOverview = trpc.family.marketOverview.useQuery(undefined, { enabled: !isDemoMode });
  const goals = trpc.family.goals.list.useQuery(undefined, { enabled: !isDemoMode });
  const cashFlowQuery = trpc.family.cashFlow.history.useQuery(undefined, { enabled: !isDemoMode });
  const triggersQuery = trpc.family.market.getPriceTriggers.useQuery(undefined, { enabled: !isDemoMode });
  const certificatesQuery = trpc.family.certificates.list.useQuery(undefined, { enabled: !isDemoMode });
  const creditCardsQuery = trpc.family.creditCards.list.useQuery(undefined, { enabled: !isDemoMode });
  const utils = trpc.useUtils();
  const reduceMotion = useReducedMotion();
  const postDebtPaymentMutation = trpc.family.debts.postPayment.useMutation();
  const setTriggerMutation = trpc.family.market.setPriceTriggers.useMutation();
  const postDividendMutation = trpc.family.ledger.postDividend.useMutation();
  const reconcileAccountMutation = trpc.family.accounts.reconcile.useMutation();
  const createCertMutation = trpc.family.certificates.create.useMutation();
  const collectYieldMutation = trpc.family.certificates.collectYield.useMutation();
  const createCreditCardMutation = trpc.family.creditCards.create.useMutation();
  const createInstallmentMutation = trpc.family.creditCards.createInstallment.useMutation();
  const payCreditCardDueMutation = trpc.family.creditCards.payDue.useMutation();

  // State: Reconciliation Modal
  const [reconcileModalOpen, setReconcileModalOpen] = useState(false);
  const [selectedAccountForReconcile, setSelectedAccountForReconcile] = useState<any>(null);
  const [actualReconcileBalance, setActualReconcileBalance] = useState("");
  const [reconcileMemo, setReconcileMemo] = useState("");
  const [isSubmittingReconcile, setIsSubmittingReconcile] = useState(false);

  // State: Bank Certificate Modal
  const [addCertModalOpen, setAddCertModalOpen] = useState(false);
  const [certName, setCertName] = useState("");
  const [certBank, setCertBank] = useState("");
  const [certPrincipal, setCertPrincipal] = useState("");
  const [certRate, setCertRate] = useState("23.5");
  const [certFrequency, setCertFrequency] = useState<"monthly" | "quarterly" | "semi_annual" | "annual">("monthly");
  const [certIssueDate, setCertIssueDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [certMaturityDate, setCertMaturityDate] = useState(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() + 3);
    return d.toISOString().slice(0, 10);
  });
  const [certLinkedAccountId, setCertLinkedAccountId] = useState("");
  const [isSubmittingCert, setIsSubmittingCert] = useState(false);
  const [collectingCertId, setCollectingCertId] = useState<number | null>(null);

  // State: Credit Card & Installments Modals
  const [addCardModalOpen, setAddCardModalOpen] = useState(false);
  const [cardName, setCardName] = useState("");
  const [cardLender, setCardLender] = useState("");
  const [cardLimit, setCardLimit] = useState("");
  const [cardCurrentBalance, setCardCurrentBalance] = useState("");
  const [cardStatementDay, setCardStatementDay] = useState("1");
  const [cardDueDay, setCardDueDay] = useState("25");
  const [cardMinPayment, setCardMinPayment] = useState("");
  const [isSubmittingCard, setIsSubmittingCard] = useState(false);

  // State: 0% Installment Plan Modal
  const [addInstallmentModalOpen, setAddInstallmentModalOpen] = useState(false);
  const [selectedCardForInstallment, setSelectedCardForInstallment] = useState<number | null>(null);
  const [installmentMerchant, setInstallmentMerchant] = useState("");
  const [installmentPlanName, setInstallmentPlanName] = useState("");
  const [installmentTotal, setInstallmentTotal] = useState("");
  const [installmentTenure, setInstallmentTenure] = useState("12");
  const [installmentRemaining, setInstallmentRemaining] = useState("12");
  const [isSubmittingInstallment, setIsSubmittingInstallment] = useState(false);

  // State: Pay Credit Card Due Modal (1-Click)
  const [payCardModalOpen, setPayCardModalOpen] = useState(false);
  const [selectedCardForPayment, setSelectedCardForPayment] = useState<any>(null);
  const [cardPaySourceAccountId, setCardPaySourceAccountId] = useState("");
  const [cardPayAmount, setCardPayAmount] = useState("");
  const [cardPayMemo, setCardPayMemo] = useState("");
  const [isSubmittingCardPay, setIsSubmittingCardPay] = useState(false);

  // Dialog state: Debt Payment
  const [debtPaymentModalOpen, setDebtPaymentModalOpen] = useState(false);
  const [selectedDebtId, setSelectedDebtId] = useState<number | null>(null);
  const [paymentAccountId, setPaymentAccountId] = useState<string>("");
  const [paymentPrincipal, setPaymentPrincipal] = useState<string>("");
  const [paymentInterest, setPaymentInterest] = useState<string>("");
  const [paymentMemo, setPaymentMemo] = useState<string>("");
  const [isSubmittingDebtPayment, setIsSubmittingDebtPayment] = useState(false);

  const openDebtPaymentModal = (debtId?: number) => {
    const activeList = (debts.data ?? []).filter(d => d.status === "active");
    const targetId = debtId || activeList[0]?.id || null;
    setSelectedDebtId(targetId);
    const targetDebt = activeList.find(d => d.id === targetId);
    if (targetDebt) {
      setPaymentPrincipal(String(targetDebt.minimumPayment || ""));
      setPaymentMemo(`سداد دفعة: ${targetDebt.name}`);
    } else {
      setPaymentPrincipal("");
      setPaymentMemo("");
    }
    setPaymentInterest("");
    const defaultCash = (summary.data?.accounts ?? []).find(a => ["bank", "cash", "wallet"].includes(a.accountType));
    setPaymentAccountId(defaultCash ? String(defaultCash.id) : "");
    setDebtPaymentModalOpen(true);
  };

  const handlePostDebtPayment = async () => {
    if (!selectedDebtId) {
      toast.error("يرجى اختيار الالتزام أو الدين");
      return;
    }
    const accId = parseInt(paymentAccountId, 10);
    if (!accId) {
      toast.error("يرجى اختيار الحساب البنكي أو النقدي للسداد");
      return;
    }
    const principalNum = parseFloat(paymentPrincipal);
    if (!principalNum || principalNum <= 0) {
      toast.error("يرجى إدخال مبلغ سداد أصل دين صحيح");
      return;
    }
    try {
      setIsSubmittingDebtPayment(true);
      await postDebtPaymentMutation.mutateAsync({
        debtId: selectedDebtId,
        cashAccountId: accId,
        principalAmount: Number(principalNum).toFixed(6),
        interestAmount: paymentInterest.trim() ? Number(paymentInterest).toFixed(6) : null,
        feeAmount: null,
        occurredAt: Date.now(),
        memo: paymentMemo.trim() || null,
        idempotencyKey: `debt_pay_${selectedDebtId}_${Date.now()}`,
      });
      await utils.family.dashboard.invalidate();
      await utils.family.debts.invalidate();
      toast.success("تم قيد وتسجيل سداد دفعة الدين بنجاح");
      setDebtPaymentModalOpen(false);
      setPaymentPrincipal("");
      setPaymentInterest("");
      setPaymentMemo("");
    } catch (err: any) {
      toast.error(err.message || "تعذر قيد سداد الدين");
    } finally {
      setIsSubmittingDebtPayment(false);
    }
  };

  const openReconcileModal = (account: any) => {
    setSelectedAccountForReconcile(account);
    setActualReconcileBalance(String(account.value || ""));
    setReconcileMemo(`تسوية رصيد: ${account.name}`);
    setReconcileModalOpen(true);
  };

  const handleReconcileAccount = async () => {
    if (!selectedAccountForReconcile) return;
    const target = parseFloat(actualReconcileBalance);
    if (isNaN(target) || target < 0) {
      toast.error("يرجى إدخال رصيد فعلي صحيح");
      return;
    }
    try {
      setIsSubmittingReconcile(true);
      await reconcileAccountMutation.mutateAsync({
        accountId: Number(selectedAccountForReconcile.id),
        actualBalance: target.toFixed(2),
        memo: reconcileMemo.trim() || undefined,
      });
      await utils.family.dashboard.invalidate();
      await utils.family.accounts.invalidate();
      toast.success(`تمت تسوية رصيد ${selectedAccountForReconcile.name} بنجاح وتحديث السجلات الدفترية.`);
      setReconcileModalOpen(false);
    } catch (err: any) {
      toast.error(err.message || "تعذر إتمام التسوية");
    } finally {
      setIsSubmittingReconcile(false);
    }
  };

  const handleCreateCertificate = async () => {
    if (!certName.trim() || !certBank.trim()) {
      toast.error("يرجى إدخال اسم الشهادة واسم البنك");
      return;
    }
    const principalNum = parseFloat(certPrincipal);
    if (!principalNum || principalNum <= 0) {
      toast.error("يرجى إدخال أصل الشهادة بشكل صحيح");
      return;
    }
    const rateNum = parseFloat(certRate);
    if (!rateNum || rateNum <= 0) {
      toast.error("يرجى إدخال سعر الفائدة");
      return;
    }
    try {
      setIsSubmittingCert(true);
      await createCertMutation.mutateAsync({
        certificateName: certName.trim(),
        bankName: certBank.trim(),
        principalAmount: principalNum.toFixed(2),
        interestRate: rateNum.toFixed(2),
        payoutFrequency: certFrequency,
        issueDate: new Date(certIssueDate).getTime(),
        maturityDate: new Date(certMaturityDate).getTime(),
        linkedPayoutAccountId: certLinkedAccountId ? Number(certLinkedAccountId) : null,
      });
      await utils.family.dashboard.invalidate();
      await utils.family.certificates.invalidate();
      toast.success("تم ربط وقيد الشهادة البنكية بنجاح");
      setAddCertModalOpen(false);
      setCertName("");
      setCertBank("");
      setCertPrincipal("");
    } catch (err: any) {
      toast.error(err.message || "تعذر إضافة الشهادة");
    } finally {
      setIsSubmittingCert(false);
    }
  };

  const handleCollectYield = async (certId: number) => {
    try {
      setCollectingCertId(certId);
      const res = await collectYieldMutation.mutateAsync({ certificateId: certId });
      await utils.family.dashboard.invalidate();
      await utils.family.certificates.invalidate();
      await utils.family.accounts.invalidate();
      toast.success(`تم تحصيل عائد بقيمة ${formatMoney(res.collectedAmount, res.currency, 0)} وإيداعه في الحساب بنجاح.`);
    } catch (err: any) {
      toast.error(err.message || "تعذر تحصيل العائد");
    } finally {
      setCollectingCertId(null);
    }
  };

  const handleCreateCreditCard = async () => {
    if (!cardName.trim()) {
      toast.error("يرجى إدخال اسم الكارت");
      return;
    }
    const limitNum = parseFloat(cardLimit);
    if (!limitNum || limitNum <= 0) {
      toast.error("يرجى إدخال الحد الائتماني للكارت");
      return;
    }
    try {
      setIsSubmittingCard(true);
      await createCreditCardMutation.mutateAsync({
        name: cardName.trim(),
        lender: cardLender.trim() || undefined,
        creditLimit: limitNum.toFixed(2),
        currentBalance: cardCurrentBalance ? parseFloat(cardCurrentBalance).toFixed(2) : "0",
        statementDay: cardStatementDay ? parseInt(cardStatementDay, 10) : 1,
        dueDay: cardDueDay ? parseInt(cardDueDay, 10) : 25,
        minPaymentDue: cardMinPayment ? parseFloat(cardMinPayment).toFixed(2) : undefined,
      });
      await utils.family.dashboard.invalidate();
      await utils.family.creditCards.invalidate();
      await utils.family.debts.invalidate();
      toast.success("تمت إضافة كارت المشتريات بنجاح");
      setAddCardModalOpen(false);
      setCardName("");
      setCardLender("");
      setCardLimit("");
      setCardCurrentBalance("");
    } catch (err: any) {
      toast.error(err.message || "تعذر إضافة الكارت");
    } finally {
      setIsSubmittingCard(false);
    }
  };

  const handleCreateInstallment = async () => {
    if (!selectedCardForInstallment) {
      toast.error("يرجى اختيار كارت المشتريات");
      return;
    }
    if (!installmentMerchant.trim() || !installmentPlanName.trim()) {
      toast.error("يرجى إدخال اسم التاجر وخطة التقسيط");
      return;
    }
    const totalNum = parseFloat(installmentTotal);
    if (!totalNum || totalNum <= 0) {
      toast.error("يرجى إدخال إجمالي مبلغ التقسيط");
      return;
    }
    const tenureNum = parseInt(installmentTenure, 10);
    const remainingNum = parseInt(installmentRemaining, 10) || tenureNum;
    try {
      setIsSubmittingInstallment(true);
      const res = await createInstallmentMutation.mutateAsync({
        debtId: selectedCardForInstallment,
        merchantName: installmentMerchant.trim(),
        planName: installmentPlanName.trim(),
        totalAmount: totalNum.toFixed(2),
        tenureMonths: tenureNum,
        remainingMonths: remainingNum,
      });
      await utils.family.dashboard.invalidate();
      await utils.family.creditCards.invalidate();
      toast.success(`تمت إضافة خطة التقسيط بقسط شهري ${formatMoney(res.monthlyAmount, currency, 0)} بنجاح.`);
      setAddInstallmentModalOpen(false);
      setInstallmentMerchant("");
      setInstallmentPlanName("");
      setInstallmentTotal("");
    } catch (err: any) {
      toast.error(err.message || "تعذر إضافة خطة التقسيط");
    } finally {
      setIsSubmittingInstallment(false);
    }
  };

  const openPayCardModal = (card: any) => {
    setSelectedCardForPayment(card);
    setCardPayAmount(String(card.currentBalance || ""));
    setCardPayMemo(`سداد مديونية كارت: ${card.name}`);
    const defaultCash = (summary.data?.accounts ?? []).find(a => ["bank", "cash", "wallet"].includes(a.accountType));
    setCardPaySourceAccountId(defaultCash ? String(defaultCash.id) : "");
    setPayCardModalOpen(true);
  };

  const handlePayCardDue = async () => {
    if (!selectedCardForPayment) return;
    const accId = parseInt(cardPaySourceAccountId, 10);
    if (!accId) {
      toast.error("يرجى اختيار الحساب المصرفي أو النقدي المسحوب منه");
      return;
    }
    const payNum = parseFloat(cardPayAmount);
    if (!payNum || payNum <= 0) {
      toast.error("يرجى إدخال مبلغ سداد صحيح");
      return;
    }
    try {
      setIsSubmittingCardPay(true);
      await payCreditCardDueMutation.mutateAsync({
        debtId: selectedCardForPayment.id,
        cashAccountId: accId,
        amount: payNum.toFixed(2),
        memo: cardPayMemo.trim() || undefined,
      });
      await utils.family.dashboard.invalidate();
      await utils.family.creditCards.invalidate();
      await utils.family.debts.invalidate();
      await utils.family.accounts.invalidate();
      toast.success("تم سداد مستحقات الكارت وتحديث الرصيد والحد المتاح بنجاح.");
      setPayCardModalOpen(false);
    } catch (err: any) {
      toast.error(err.message || "تعذر سداد مستحقات الكارت");
    } finally {
      setIsSubmittingCardPay(false);
    }
  };

  // Dialog state: Price Triggers
  const [triggerModalOpen, setTriggerModalOpen] = useState(false);
  const [selectedTriggerItem, setSelectedTriggerItem] = useState<{
    instrumentId: number;
    name: string;
    symbol: string | null;
    currency: string;
    targetBuyPrice: string;
    targetTakeProfitPrice: string;
    currentPrice: number | null;
  } | null>(null);

  // Dialog state: Cash Dividend
  const [dividendModalOpen, setDividendModalOpen] = useState(false);
  const [selectedDividendItem, setSelectedDividendItem] = useState<{
    instrumentId: number;
    name: string;
    symbol: string | null;
    currency: string;
  } | null>(null);
  const [dividendAmount, setDividendAmount] = useState("");
  const [dividendAccountId, setDividendAccountId] = useState("");
  const [dividendMemo, setDividendMemo] = useState("");
  const [isSubmittingDividend, setIsSubmittingDividend] = useState(false);
  const [isSubmittingTrigger, setIsSubmittingTrigger] = useState(false);

  // Table Filter State & Quick Manual Price State
  const [tableFilter, setTableFilter] = useState<"all" | "equity" | "fund" | "gold">("all");
  const [quickPriceModalOpen, setQuickPriceModalOpen] = useState(false);
  const [selectedItemForPrice, setSelectedItemForPrice] = useState<{
    instrumentId: number;
    name: string;
    symbol: string | null;
    currency: string;
    assetType: string;
    price?: number | string | null;
  } | null>(null);
  const [quickPriceValue, setQuickPriceValue] = useState("");

  const recordManualPrice = trpc.family.prices.recordManual.useMutation({
    onSuccess: () => {
      toast.success("تم تسجيل وتحديث السعر السوقي / سعر الوثيقة بنجاح.");
      setQuickPriceModalOpen(false);
      void utils.family.dashboard.invalidate();
      void marketOverview.refetch();
    },
    onError: (err) => {
      toast.error(err.message || "تعذر تسجيل السعر");
    },
  });

  // Safely memoize portfolioMap and cashAccounts BEFORE any early returns
  type PortfolioItem = NonNullable<typeof summary.data>["portfolio"][number];
  const portfolioMap = useMemo(() => {
    const map = new Map<number, PortfolioItem>();
    if (summary.data?.portfolio) {
      summary.data.portfolio.forEach(pos => map.set(pos.instrumentId, pos));
    }
    return map;
  }, [summary.data?.portfolio]);

  const cashAccounts = useMemo(() => {
    return (summary.data?.accounts ?? []).filter(account => ["bank", "cash", "wallet"].includes(account.accountType));
  }, [summary.data?.accounts]);

  if (summary.isLoading && !isDemoMode) return <DashboardSkeleton />;
  if (summary.error && !isDemoMode) {
    return (
      <DashboardLayout>
        <div className="fintech-page py-12" dir="rtl">
          <Card className="border-rose-200 bg-rose-50/70">
            <CardContent className="p-8 text-rose-900">
              تعذر تحميل لوحة التحكم الآن. حاول تحديث الصفحة، أو فعّل وضع العرض التجريبي لمعاينة الواجهة دون أي تغيير في بياناتك.
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  const live = summary.data;
  const hasLiveData = Boolean((live?.accounts.length ?? 0) + (live?.portfolio.length ?? 0) + (live?.recentEvents.length ?? 0));
  const previewMode = getDashboardPreviewMode(isDemoMode, hasLiveData);
  const usingDemo = previewMode === "demo";
  const currency = usingDemo ? demoDashboard.baseCurrency : (live?.workspace.baseCurrency ?? "EGP");
  const accounts = usingDemo
    ? demoDashboard.accounts
    : (live?.accounts ?? []).map(account => ({
      id: String(account.id),
      name: account.name,
      value: Number(account.baseValue ?? account.balance ?? 0),
      currency: account.currency,
      kind: account.accountType,
    }));
  const allocation = usingDemo
    ? [...demoDashboard.allocation]
    : (live?.accounts ?? [])
        .filter(account => ["bank", "cash", "wallet"].includes(account.accountType) && account.baseValue !== null && Number(account.baseValue) > 0)
        .map((account, index) => ({
          name: account.name,
          value: Number(account.baseValue),
          color: FINTECH_ASSET_PALETTE[index % FINTECH_ASSET_PALETTE.length],
        }));

  const cashFlow = usingDemo ? [...demoDashboard.cashFlow] : (cashFlowQuery.data ?? []);

  const openTriggerModal = (
    item: { instrumentId: number; name: string; symbol: string | null; currency: string },
    targetBuy: number | null,
    targetSell: number | null,
    currentPrice: number | null
  ) => {
    setSelectedTriggerItem({
      instrumentId: item.instrumentId,
      name: item.name,
      symbol: item.symbol,
      currency: item.currency,
      targetBuyPrice: targetBuy !== null ? String(targetBuy) : "",
      targetTakeProfitPrice: targetSell !== null ? String(targetSell) : "",
      currentPrice,
    });
    setTriggerModalOpen(true);
  };

  const handleSaveTriggers = async () => {
    if (!selectedTriggerItem) return;
    try {
      setIsSubmittingTrigger(true);
      await setTriggerMutation.mutateAsync({
        instrumentId: selectedTriggerItem.instrumentId,
        targetBuyPrice: selectedTriggerItem.targetBuyPrice.trim() || null,
        targetTakeProfitPrice: selectedTriggerItem.targetTakeProfitPrice.trim() || null,
      });
      await utils.family.market.getPriceTriggers.invalidate();
      toast.success("تم حفظ أهداف الأسعار وتنبيهات التداول بنجاح");
      setTriggerModalOpen(false);
    } catch (err: any) {
      toast.error(err.message || "حدث خطأ أثناء حفظ التنبيهات");
    } finally {
      setIsSubmittingTrigger(false);
    }
  };

  const openDividendModal = (item: { instrumentId: number; name: string; symbol: string | null; currency: string }) => {
    const defaultAcc = (live?.accounts ?? []).find(a =>
      ["cash", "bank", "brokerage"].includes(a.accountType)
    );
    setSelectedDividendItem(item);
    setDividendAmount("");
    setDividendAccountId(defaultAcc ? String(defaultAcc.id) : "");
    setDividendMemo(`توزيع أرباح نقدية: ${item.name}`);
    setDividendModalOpen(true);
  };

  const handlePostDividend = async () => {
    if (!selectedDividendItem) return;
    const amountNum = parseFloat(dividendAmount);
    if (!amountNum || amountNum <= 0) {
      toast.error("يرجى إدخال مبلغ توزيع صحيح");
      return;
    }
    const accId = parseInt(dividendAccountId, 10);
    if (!accId) {
      toast.error("يرجى اختيار الحساب المستلم للتوزيع النقدي");
      return;
    }
    try {
      setIsSubmittingDividend(true);
      await postDividendMutation.mutateAsync({
        accountId: accId,
        instrumentId: selectedDividendItem.instrumentId,
        amount: dividendAmount.trim(),
        currency: selectedDividendItem.currency,
        occurredAt: Date.now(),
        memo: dividendMemo.trim() || undefined,
        idempotencyKey: `div_${selectedDividendItem.instrumentId}_${Date.now()}`,
      });
      await utils.family.dashboard.invalidate();
      toast.success("تم قيد وتوزيع الأرباح النقدية بنجاح دون المساس بعدد الأسهم");
      setDividendModalOpen(false);
    } catch (err: any) {
      toast.error(err.message || "تعذر تسجيل التوزيع النقدي");
    } finally {
      setIsSubmittingDividend(false);
    }
  };

  const openQuickPriceModal = (item: {
    instrumentId: number;
    name: string;
    symbol: string | null;
    currency: string;
    assetType: string;
    price?: number | string | null;
  }) => {
    setSelectedItemForPrice(item);
    setQuickPriceValue(item.price ? String(item.price) : "");
    setQuickPriceModalOpen(true);
  };

  const events = usingDemo
    ? demoDashboard.events.map(event => {
      const isExpense = event.tone === "expense";
      const isTransfer = event.type.includes("تحويل");
      return {
        id: event.id,
        title: event.type,
        badge: isExpense ? "سحب / مصروف" : isTransfer ? "تحويل" : event.tone === "growth" ? "تقييم أصل" : "إيداع سيولة",
        amount: event.amount,
        currency: event.currency,
        date: event.date,
        tone: event.tone,
        isOutflow: isExpense,
        isTransfer,
      };
    })
    : (live?.recentEvents ?? []).map(event => {
      const isTransfer = event.eventType === "transfer";
      const isOutflow = !isTransfer && ["expense", "withdrawal", "fee", "tax", "debt_payment", "buy"].includes(event.eventType);
      const label = eventLabels[event.eventType] ?? event.eventType;
      const defaultTitle =
        event.eventType === "deposit"
          ? "إيداع سيولة نقدية"
          : event.eventType === "opening_balance"
            ? "رصيد افتتاحي للحساب"
            : event.eventType === "withdrawal"
              ? "سحب سيولة نقدية"
              : event.eventType === "expense"
                ? "مصروف مصنف"
                : event.eventType === "transfer"
                  ? "تحويل داخلي"
                  : label;
      return {
        id: String(event.id),
        title: event.memo ? event.memo : defaultTitle,
        badge: label,
        amount: event.grossAmount,
        currency: event.currency,
        date: formatDateTime(event.occurredAt),
        tone: isTransfer ? ("transfer" as const) : isOutflow ? ("expense" as const) : ("income" as const),
        isOutflow,
        isTransfer,
      };
    });
  const debtItems = usingDemo
    ? demoDashboard.debts
    : (debts.data ?? []).filter(debt => debt.status === "active").map(debt => ({
      id: String(debt.id),
      name: debt.name,
      outstanding: debt.outstanding,
      currency: debt.currency,
      payment: debt.minimumPayment,
      rate: debt.annualInterestRate,
    }));
  const netWorth = usingDemo ? demoDashboard.netWorth : (live?.netWorthBase ?? "0");
  const liquidBalance = usingDemo ? demoDashboard.liquidBalance : (live?.liquidBalanceBase ?? "0");
  const liabilities = usingDemo ? demoDashboard.liabilities : (live?.liabilityBalanceBase ?? "0");
  const investments = usingDemo ? demoDashboard.investments : (live?.investmentValueBase ?? "0");
  const pnl = usingDemo ? demoDashboard.unrealizedPnl : (live?.unrealizedPnlBase ?? "0");
  const hasAccounts = usingDemo ? true : Boolean(live?.accounts && live.accounts.length > 0);
  const hasTransactions = usingDemo ? true : Boolean(live?.recentEvents && live.recentEvents.length > 0);
  const hasInvestments = usingDemo ? true : Boolean((live?.portfolio && live.portfolio.length > 0) || Number(live?.investmentValueBase ?? 0) > 0);
  const hasGoals = usingDemo ? true : Boolean(goals.data && goals.data.length > 0);

  return (
    <DashboardLayout>
      <div className="fintech-page pb-10 space-y-5 bg-[#F8FAFC]/90 dark:bg-transparent -m-4 sm:-m-6 md:-m-8 p-4 sm:p-6 md:p-8 min-h-screen text-slate-900 dark:text-slate-100" dir="rtl">
        <motion.section
          className="bg-slate-900 text-white dark:bg-[#0E1420] border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.06)] dark:shadow-none mb-4 relative overflow-hidden flex flex-col md:flex-row md:items-center md:justify-between gap-4"
          initial={reduceMotion ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.42, ease: [0.23, 1, 0.32, 1] }}
        >
          <div className="relative z-10 flex flex-col justify-center">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-300 mb-0.5">
              <span className="size-2 rounded-full bg-emerald-400" />
              <span>النظرة المالية العامة</span>
              <span className="opacity-40">•</span>
              <span className="bg-white/10 text-slate-200 border border-white/15 backdrop-blur-sm text-xs px-2.5 py-0.5 rounded-lg">
                {usingDemo ? "وضع العرض التجريبي" : "بياناتك المسجلة"}
              </span>
            </div>
            <h1 className="m-0 mt-1 text-lg sm:text-xl font-bold leading-tight text-white">
              {user?.name?.trim() ? `مرحباً ${user.name.trim().split(/\s+/)[0]}، ` : "مرحباً بك، "}
              <span className="text-slate-300">هذا هو وضعك المالي اليوم.</span>
            </h1>
            <p className="m-0 mt-1 text-xs leading-relaxed text-slate-300/90 max-w-xl">
              ملخص تشغيلي متوازن للأرصدة النقدية والاستثمارات والأصول والالتزامات المالية في مساحتك.
            </p>
          </div>
          <div className="relative z-10 flex flex-wrap items-center gap-2.5 sm:self-center shrink-0">
            <div className="flex items-center gap-2 rounded-xl bg-white/10 text-slate-200 border border-white/15 backdrop-blur-sm px-3 py-1.5">
              <ShieldCheck className="size-4 text-emerald-400 shrink-0" />
              <div className="leading-tight text-right">
                <span className="text-[10px] text-slate-400 block">حالة البيانات</span>
                <strong className="text-xs text-white">{usingDemo ? "عرض توضيحي آمن" : "قيودك المالية"}</strong>
              </div>
            </div>
            <Button
              onClick={() => setLocation("/accounts")}
              size="sm"
              className="bg-white hover:bg-slate-100 text-slate-950 font-bold text-xs py-2 px-3.5 rounded-xl shadow-xs transition-all dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-white dark:border dark:border-slate-700 flex items-center gap-1.5 cursor-pointer h-auto"
            >
              <Plus className="size-3.5" />
              إضافة حساب
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={toggleDemoMode}
              className="bg-white/10 hover:bg-white/15 text-white border border-white/15 backdrop-blur-sm font-semibold text-xs py-2 px-3.5 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer h-auto"
            >
              <Eye className="size-3.5" />
              {usingDemo ? "العودة لبياناتي" : "معاينة ببيانات تجريبية"}
            </Button>
          </div>
        </motion.section>

        <WealthCoPilotCard
          baseCurrency={currency}
          isDemo={usingDemo}
        />

        <OnboardingChecklist
          hasAccounts={hasAccounts}
          hasTransactions={hasTransactions}
          hasInvestments={hasInvestments}
          hasGoals={hasGoals}
        />

        {!usingDemo && decisions.data?.length ? (
          <section className="bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-sm" aria-label="مركز القرارات">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-3">
              <div>
                <p className="text-amber-800 dark:text-amber-400 font-bold text-xs uppercase tracking-wider">مركز القرار</p>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">أهم ثلاث إشارات فقط</h2>
              </div>
              <Button variant="ghost" onClick={() => setLocation("/approvals")} className="text-xs font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white cursor-pointer">
                إدارة القرارات ←
              </Button>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              {decisions.data.slice(0, 3).map(item => (
                <button
                  onClick={() => setLocation(item.actionPath)}
                  className="bg-slate-50/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 p-3.5 rounded-xl text-right transition-all flex flex-col justify-between cursor-pointer group"
                  key={item.id}
                >
                  <span className="inline-block px-2 py-0.5 rounded text-[11px] font-bold bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200 border border-amber-200 dark:border-amber-800/60 w-fit mb-2">
                    {item.priority}
                  </span>
                  <div>
                    <strong className="text-slate-900 dark:text-white text-sm font-semibold block group-hover:text-amber-600 dark:group-hover:text-amber-300 transition-colors">
                      {item.title}
                    </strong>
                    <p className="text-slate-600 dark:text-slate-400 font-medium text-xs mt-1">{item.detail}</p>
                  </div>
                  {item.amount && (
                    <b className="font-mono font-bold text-slate-900 dark:text-white text-sm mt-2 block" dir="ltr">
                      <SensitiveValue>{formatMoney(item.amount, item.currency || currency, 0)}</SensitiveValue>
                    </b>
                  )}
                </button>
              ))}
            </div>
          </section>
        ) : null}

        <motion.section
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden mb-6"
          initial={reduceMotion ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.42, delay: 0.05 }}
        >
          <ExecutiveMetricCell
            icon={CircleDollarSign}
            label="صافي الثروة"
            value={netWorth}
            currency={currency}
            detail={
              usingDemo ? (
                "لقطة توضيحية قابلة للاستبدال"
              ) : live?.netWorthDelta ? (
                <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                  <span
                    className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10.5px] font-bold font-mono border ${live.netWorthDelta.isPositive
                        ? "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-800/60"
                        : "bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-200 dark:border-rose-800/60"
                      }`}
                  >
                    <span>{live.netWorthDelta.isPositive ? "▲ +" : "▼ -"}</span>
                    <span>{currency} {formatMoney(live.netWorthDelta.absolute, currency, 2)}</span>
                    <span>({live.netWorthDelta.isPositive ? "+" : "-"}{live.netWorthDelta.percentage}%)</span>
                  </span>
                  <span className="text-[10px] text-slate-600 dark:text-slate-400 font-medium">عن الإغلاق السابق</span>
                </div>
              ) : (
                "مُقوّم بعملة الأساس"
              )
            }
            accent="indigo"
            isPriority={true}
            className="border-b sm:border-b-0 lg:border-b-0 lg:border-l border-slate-200 dark:border-slate-800"
          />
          <ExecutiveMetricCell
            icon={WalletCards}
            label="السيولة المتاحة"
            value={liquidBalance}
            currency={currency}
            infoTooltip={
              <div className="space-y-2 text-right" dir="rtl">
                <p className="font-bold text-emerald-400 text-xs">تفصيل السيولة النقدية والتسويات المعلقة:</p>
                <div className="text-[11px] leading-relaxed text-slate-300 space-y-1.5">
                  <p>
                    <strong className="text-white">• سيولة حرة:</strong> مبالغ نقدية فورية مودعة بالحسابات المصرفية والمحافظ الإلكترونية، متاحة للسحب أو التحويل الفوري.
                  </p>
                  <p>
                    <strong className="text-amber-300">• معلق تسوية (T+2):</strong> حصيلة مبيعات أسهم أو وثائق استثمار بالبورصة المصرية، قيد المقاصة المركزية وتصبح جاهزة للسحب البنكي بعد يومي عمل رسميين من تاريخ التنفيذ.
                  </p>
                </div>
              </div>
            }
            detail={
              !usingDemo && live?.unsettledCashBase && Number(live.unsettledCashBase) > 0 ? (
                <div className="text-[11px] leading-tight space-y-0.5 mt-0.5">
                  <div className="flex items-center justify-between text-slate-700 dark:text-slate-300">
                    <span>سيولة حرة:</span>
                    <b className="font-mono text-emerald-800 dark:text-emerald-400 font-bold">
                      {formatMoney(live.freeLiquidityBase ?? liquidBalance, currency, 2)}
                    </b>
                  </div>
                  <div className="flex items-center justify-between text-slate-600 dark:text-slate-400 text-[10.5px]">
                    <span>معلّق تسوية T+2:</span>
                    <b className="font-mono text-amber-800 dark:text-amber-400 font-bold">
                      {formatMoney(live.unsettledCashBase, currency, 2)}
                    </b>
                  </div>
                </div>
              ) : (
                "الحسابات النقدية والمصرفية"
              )
            }
            accent="emerald"
            className="border-b sm:border-b-0 lg:border-b-0 lg:border-l border-slate-200 dark:border-slate-800"
          />
          <ExecutiveMetricCell
            icon={BarChart3}
            label="قيمة الاستثمارات"
            value={investments}
            currency={currency}
            detail={
              <>
                <span>ربح غير محقق </span>
                <SensitiveValue>{formatMoney(pnl, currency, 2)}</SensitiveValue>
              </>
            }
            accent="sky"
            className="border-b sm:border-b-0 lg:border-b-0 lg:border-l border-slate-200 dark:border-slate-800"
          />
          <ExecutiveMetricCell
            icon={BadgeDollarSign}
            label="الالتزامات والديون"
            value={liabilities}
            currency={currency}
            detail="قروض وبطاقات نشطة"
            accent="rose"
            className="border-b-0 lg:border-l-0"
          />
        </motion.section>

        <RetailSignalsWidget />

        {!usingDemo && marketOverview.data?.entries.length ? (
          <section className="bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm" aria-label="مراقبة السوق">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800 mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-amber-800 dark:text-amber-400 font-bold text-xs uppercase tracking-wider m-0">المحفظة وسوق المال</p>
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
                    <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    EGX & Mutual Funds Live Feed
                  </span>
                </div>
                <h2 className="text-lg font-extrabold text-slate-900 dark:text-white mt-1">
                  أبرز تحركات السوق ومراكز المحفظة
                </h2>
                <p className="text-xs text-slate-600 dark:text-slate-400 font-medium mt-0.5">
                  ملخص تنفيذي لأهم المراكز الاستثمارية المتحركة بالبورصة وصناديق الاستثمار مع حساب الأرباح غير المحققة.
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  onClick={() => setLocation("/investments")}
                  className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs gap-1.5 rounded-xl h-9 px-4 shadow-xs cursor-pointer"
                >
                  <span>فتح جدول الأرباح والخسائر الكامل (13 عموداً)</span>
                  <ArrowUpRight className="size-4" />
                </Button>
              </div>
            </div>

            {/* Top 4 Movers & Holdings Grid */}
            {(() => {
              const allEntries = marketOverview.data?.entries ?? [];
              const sorted = [...allEntries].sort((a, b) => {
                const aPos = portfolioMap.get(a.instrumentId);
                const bPos = portfolioMap.get(b.instrumentId);
                const aOwned = Boolean(aPos && Number(aPos.quantity) > 0);
                const bOwned = Boolean(bPos && Number(bPos.quantity) > 0);
                if (aOwned && !bOwned) return -1;
                if (!aOwned && bOwned) return 1;
                const aVal = aPos ? Math.abs(Number(aPos.baseMarketValue || aPos.costBasis || 0)) : (Number(a.price || 0));
                const bVal = bPos ? Math.abs(Number(bPos.baseMarketValue || bPos.costBasis || 0)) : (Number(b.price || 0));
                return bVal - aVal;
              }).slice(0, 4);

              const totalOwned = allEntries.filter((e) => {
                const pos = portfolioMap.get(e.instrumentId);
                return Boolean(pos && Number(pos.quantity) > 0);
              }).length;

              return (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                    {sorted.map((item) => {
                      const pos = portfolioMap.get(item.instrumentId);
                      const isOwned = Boolean(pos && Number(pos.quantity) > 0);
                      const costNum = Number(pos?.costBasis || 0);
                      const pnlNum = Number(pos?.unrealizedPnl || 0);
                      const returnPct = costNum > 0 ? (pnlNum / costNum) * 100 : null;
                      return (
                        <div
                          key={item.instrumentId}
                          onClick={() => setLocation("/investments")}
                          className="bg-slate-50/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col justify-between hover:border-amber-500/40 transition-all cursor-pointer group"
                        >
                          <div>
                            <div className="flex items-center justify-between gap-1 mb-2">
                              <span className="font-mono font-bold text-xs text-slate-900 dark:text-white group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                                {item.symbol || item.name}
                              </span>
                              <div className="flex items-center gap-1">
                                {isOwned && (
                                  <span className="bg-emerald-50 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 text-[10px] font-bold px-1.5 py-0.5 rounded">
                                    مملوك
                                  </span>
                                )}
                                <span className="text-[10px] text-slate-600 dark:text-slate-400 font-medium">
                                  {item.assetType === "equity" ? "سهم" : item.assetType === "fund" ? "صندوق" : "ذهب"}
                                </span>
                              </div>
                            </div>
                            <h3 className="text-xs font-semibold text-slate-900 dark:text-slate-200 line-clamp-1 mb-3">
                              {item.name}
                            </h3>
                          </div>

                          <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-1.5">
                            <div className="flex items-baseline justify-between">
                              <span className="text-[11px] text-slate-600 dark:text-slate-400 font-medium">السعر:</span>
                              <div className="flex items-center gap-1.5">
                                <b className="font-mono text-sm font-bold text-slate-900 dark:text-white" dir="ltr">
                                  {formatMoney(item.price, item.currency, 2)}
                                </b>
                                <span
                                  className="text-[10px] font-bold font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                                >
                                  {item.quoteStatus === "live" ? "مباشر" : "مسجل"}
                                </span>
                              </div>
                            </div>

                            {isOwned && pos && (
                              <div className="flex items-center justify-between text-[11px] pt-1 border-t border-dashed border-slate-200 dark:border-slate-800">
                                <span className="text-slate-600 dark:text-slate-400 font-medium">ربح غير محقق:</span>
                                <span
                                  className={`font-mono font-bold ${
                                    Number(pos.baseUnrealizedPnl || 0) >= 0
                                      ? "text-emerald-800 dark:text-emerald-300"
                                      : "text-rose-800 dark:text-rose-300"
                                  }`}
                                  dir="ltr"
                                >
                                  {formatMoney(pos.baseUnrealizedPnl, currency, 0)}
                                  {returnPct !== null ? ` (${returnPct >= 0 ? "+" : ""}${returnPct.toFixed(1)}%)` : ""}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 bg-slate-50/70 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-600 dark:text-slate-400">
                    <div className="flex items-center gap-2">
                      <span className="size-2 rounded-full bg-emerald-500" />
                      <span>{allEntries.length} أصل مالي مراقب • {totalOwned} مركز استثماري نشط بمحفظتك</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setLocation("/investments")}
                      className="text-xs font-bold text-amber-800 hover:text-amber-900 dark:text-amber-400 dark:hover:text-amber-300 h-auto p-0 cursor-pointer"
                    >
                      إدارة كافة الأصول الاستثمارية والأسعار اللحظية ←
                    </Button>
                  </div>
                </div>
              );
            })()}
          </section>
        ) : null}

        {previewMode === "empty" ? (
          <section className="fintech-empty-stage">
            <div className="fintech-empty-icon">
              <Sparkles className="size-7" />
            </div>
            <div>
              <p className="fintech-overline">ابدأ من نقطة واضحة</p>
              <h2>لوحتك جاهزة لبناء الصورة المالية.</h2>
              <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-sm">
                أضف حسابك الأول لإنشاء الرصيد الافتتاحي بقيد متوازن عبر معالج الإعداد المالي، أو فعّل العرض التجريبي لمعاينة الرسوم والبطاقات دون إضافة أي بيانات إلى نطاقك.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button onClick={() => setWizardOpen(true)} className="bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:hover:bg-slate-100 dark:text-slate-950 font-bold text-xs py-2.5 px-4 rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer h-auto">
                  <Sparkles className="size-4" />بدء مساعد الإعداد المالي
                </Button>
                <Button variant="outline" onClick={toggleDemoMode} className="bg-white hover:bg-slate-50 text-slate-800 font-semibold text-xs py-2.5 px-4 rounded-xl border border-slate-200/90 dark:bg-[#0B0F17] dark:hover:bg-slate-800/60 dark:text-slate-200 dark:border-slate-800 shadow-2xs transition-all cursor-pointer h-auto">
                  تشغيل العرض التجريبي
                </Button>
              </div>
            </div>
          </section>
        ) : (
          <>
            <Suspense
              fallback={
                <section className="fintech-content-grid">
                  <Skeleton className="h-[360px] rounded-2xl" />
                  <Skeleton className="h-[360px] rounded-2xl" />
                </section>
              }
            >
              <FintechCharts
                allocation={allocation}
                cashFlow={cashFlow}
                currency={currency}
                usingDemo={usingDemo}
                onShowLedger={() => setLocation("/cash-flow")}
              />
            </Suspense>
            <section className="fintech-content-grid fintech-lower-grid">
              <motion.article
                className="bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 shadow-sm rounded-2xl p-5 sm:p-6 flex flex-col justify-between h-full"
                initial={reduceMotion ? false : { opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.42, delay: 0.26 }}
              >
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800/80 mb-2">
                  <div>
                    <h2 className="text-base font-bold text-slate-900 dark:text-white">
                      آخر ما تحرك في المساحة
                    </h2>
                    <p className="text-xs text-slate-600 dark:text-slate-400 font-medium mt-0.5">
                      أحدث العمليات النقدية والتحويلات المسجلة
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setLocation("/transactions")}
                    className="text-xs font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white h-8 gap-1 cursor-pointer"
                  >
                    <span>عرض كافة المعاملات</span>
                    <span aria-hidden="true">←</span>
                  </Button>
                </div>
                {events.length ? (
                  <div className="flex-1 flex flex-col justify-between">
                    <div>
                      {events.slice(0, 5).map((event) => {
                        const isTransfer = event.isTransfer;
                        const isOutflow = event.isOutflow;
                        return (
                          <div
                            key={event.id}
                            className="group flex items-center justify-between py-3 border-b border-slate-100 dark:border-slate-800/60 last:border-0 hover:bg-slate-50/50 dark:hover:bg-slate-900/30 px-2 rounded-lg transition-colors"
                          >
                            {/* Right Side (Transaction Details in RTL) */}
                            <div className="flex items-center gap-3 min-w-0">
                              {isTransfer ? (
                                <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 flex items-center justify-center shrink-0">
                                  <ArrowLeftRight className="size-4" />
                                </div>
                              ) : isOutflow ? (
                                <div className="w-8 h-8 rounded-full bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 text-rose-800 dark:text-rose-400 flex items-center justify-center shrink-0">
                                  <ArrowUpRight className="size-4" />
                                </div>
                              ) : (
                                <div className="w-8 h-8 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-400 flex items-center justify-center shrink-0">
                                  <ArrowDownLeft className="size-4" />
                                </div>
                              )}
                              <div className="min-w-0">
                                <strong className="text-slate-900 dark:text-white font-semibold text-sm truncate block">
                                  {event.title}
                                </strong>
                                <span className="text-slate-600 dark:text-slate-400 text-xs mt-0.5 block font-medium">
                                  {event.date}
                                </span>
                              </div>
                            </div>

                            {/* Subtle track line connecting details and amount on desktop for comfortable visual tracking */}
                            <div className="hidden sm:block flex-1 mx-4 border-b border-dashed border-slate-200 dark:border-slate-800 group-hover:border-slate-300 dark:group-hover:border-slate-700 transition-colors" />

                            {/* Left Side (Amount in RTL) */}
                            <div className="shrink-0 text-left" dir="ltr">
                              <span
                                className={
                                  isTransfer
                                    ? "font-mono font-bold text-slate-700 dark:text-slate-300 tabular-nums text-xs"
                                    : isOutflow
                                      ? "font-mono font-bold text-slate-900 dark:text-white tabular-nums text-xs"
                                      : "font-mono font-bold text-emerald-800 dark:text-emerald-400 tabular-nums text-xs"
                                }
                              >
                                {isTransfer ? "↔ " : isOutflow ? "- " : "+ "}
                                <SensitiveValue>
                                  {formatMoney(Math.abs(Number(event.amount)), event.currency, 0)}
                                </SensitiveValue>
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="flex h-full min-h-[170px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#0E1420]/50 p-6 text-center my-2">
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      لا توجد حركات مسجلة حديثاً
                    </p>
                    <p className="mt-1 max-w-xs text-[11px] leading-relaxed text-slate-600 dark:text-slate-400 font-medium">
                      ستظهر هنا أحدث عمليات الإيداع والصرف المسجلة في حساباتك.
                    </p>
                  </div>
                )}
              </motion.article>
              <motion.article
                className="bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 shadow-sm rounded-2xl p-5 sm:p-6 flex flex-col justify-between h-full"
                initial={reduceMotion ? false : { opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.42, delay: 0.31 }}
              >
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800/80 mb-2">
                  <div>
                    <h2 className="text-base font-bold text-slate-900 dark:text-white">
                      نظرة على السداد
                    </h2>
                    <p className="text-xs text-slate-600 dark:text-slate-400 font-medium mt-0.5">
                      موقف الالتزامات والأقساط وخدمة الدين
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {debtItems.length > 0 && !usingDemo && (
                      <Button
                        size="sm"
                        onClick={() => openDebtPaymentModal()}
                        className="text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white h-7 px-2.5 rounded-lg shadow-xs cursor-pointer"
                      >
                        سداد دفعة
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setLocation("/debts")}
                      className="text-xs font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white h-7 cursor-pointer"
                    >
                      إدارة الديون
                    </Button>
                  </div>
                </div>
                {debtItems.length ? (
                  <div className="flex-1 flex flex-col justify-between">
                    <div>
                      {debtItems.slice(0, 5).map((debt) => (
                        <div
                          className="border-b border-slate-100 dark:border-slate-800/60 py-2.5 px-3 flex items-center justify-between hover:bg-slate-50/60 dark:hover:bg-slate-900/30 transition-colors rounded-lg last:border-b-0 cursor-pointer group"
                          key={debt.id}
                          onClick={() => !usingDemo && openDebtPaymentModal(Number(debt.id))}
                          title={usingDemo ? undefined : "انقر لتسجيل سداد دفعة لهذا الدين"}
                        >
                          <div>
                            <strong className="text-xs font-bold text-slate-900 dark:text-white block">
                              {debt.name}
                            </strong>
                            <small className="text-[11px] font-medium text-slate-600 dark:text-slate-400 block mt-0.5">
                              دفعة دنيا <SensitiveValue>{formatMoney(debt.payment, debt.currency, 0)}</SensitiveValue> شهرياً
                            </small>
                          </div>
                          <div className="text-left" dir="ltr">
                            <b className="font-mono font-bold text-slate-900 dark:text-white text-sm">
                              <SensitiveValue>{formatMoney(debt.outstanding, debt.currency, 0)}</SensitiveValue>
                            </b>
                            <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mt-0.5" dir="rtl">
                              {debt.rate}% سنوياً
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col justify-between flex-1 py-1 space-y-3">
                    {/* Sleek Status Badge */}
                    <div className="flex items-center gap-3 p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60">
                      <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shrink-0">
                        <ShieldCheck className="size-4" />
                      </div>
                      <div className="min-w-0">
                        <strong className="text-slate-900 dark:text-white font-bold text-sm block truncate">
                          سجل التزامات آمن وخالٍ من الديون
                        </strong>
                        <span className="text-slate-600 dark:text-slate-400 text-xs block mt-0.5 font-medium">
                          لا توجد قروض، بطاقات أو التزامات تمويلية مستحقة السداد.
                        </span>
                      </div>
                    </div>

                    {/* Institutional 3-Tile Metric Grid */}
                    <div className="grid grid-cols-3 gap-2.5 text-center">
                      <div className="bg-slate-50 dark:bg-[#0E1420] border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-center">
                        <span className="text-slate-600 dark:text-slate-400 font-semibold text-xs block">
                          إجمالي الالتزامات
                        </span>
                        <strong className="text-slate-900 dark:text-white font-bold font-mono text-base mt-1 block">
                          0 {currency}
                        </strong>
                      </div>
                      <div className="bg-slate-50 dark:bg-[#0E1420] border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-center">
                        <span className="text-slate-600 dark:text-slate-400 font-semibold text-xs block">
                          عبء خدمة الدين
                        </span>
                        <strong className="text-slate-900 dark:text-white font-bold font-mono text-base mt-1 block">
                          0.0%
                        </strong>
                      </div>
                      <div className="bg-slate-50 dark:bg-[#0E1420] border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-center">
                        <span className="text-slate-600 dark:text-slate-400 font-semibold text-xs block">
                          التصنيف الائتماني
                        </span>
                        <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-800/60 font-bold text-xs px-2.5 py-1 rounded-lg inline-block mt-1">
                          ممتاز AAA
                        </span>
                      </div>
                    </div>

                    {/* Operational Solvency Bottom Indicator */}
                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-[#0E1420] border border-slate-200 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300">
                      <span className="font-semibold">الملاءة المالية التشغيلية:</span>
                      <span className="font-bold text-emerald-800 dark:text-emerald-400 flex items-center gap-1.5">
                        <span className="inline-block size-2 rounded-full bg-emerald-500" />
                        تغطية سيولة تامة 100%
                      </span>
                    </div>
                  </div>
                )}
              </motion.article>
            </section>
            <motion.section
              className="mt-6"
              initial={reduceMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.35, delay: 0.36 }}
            >
              <div className="flex items-center justify-between mb-3.5">
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">
                    ملخص مواقفك المالية
                  </h2>
                  <p className="text-xs text-slate-600 dark:text-slate-400 font-medium mt-0.5">
                    توزيع الأرصدة والسيولة عبر الحسابات المسجلة
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setLocation("/accounts")}
                  className="text-xs font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white h-8 gap-1 cursor-pointer"
                >
                  <span>عرض الحسابات</span>
                  <span aria-hidden="true">←</span>
                </Button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 w-full">
                {accounts.map((account) => (
                  <div
                    key={account.id}
                    className="bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm hover:border-slate-300 dark:hover:border-slate-700 transition-all text-right group flex flex-col justify-between min-h-[125px] w-full"
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                        {account.kind}
                      </span>
                      <div className="flex items-center gap-1">
                        {!usingDemo && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openReconcileModal(account);
                            }}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors cursor-pointer"
                            title="تسوية الرصيد الفعلي (مطابقة الرصيد الحقيقي)"
                          >
                            <RefreshCw className="size-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setLocation("/accounts")}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                          title="عرض تفاصيل الحساب"
                        >
                          <ArrowUpRight className="size-3.5" />
                        </button>
                      </div>
                    </div>

                    <strong
                      className="text-slate-900 dark:text-white font-bold text-sm leading-snug line-clamp-2 block mt-2.5 w-full break-words"
                      title={account.name}
                    >
                      {account.name}
                    </strong>

                    <div className="text-left w-full mt-3 flex items-center justify-between" dir="ltr">
                      <span className="font-mono font-bold text-slate-900 dark:text-white text-base tabular-nums tracking-tight">
                        <SensitiveValue>{formatMoney(account.value, account.currency, 0)}</SensitiveValue>
                      </span>
                      {!usingDemo && (
                        <span className="text-[10px] font-semibold text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 cursor-pointer" onClick={() => openReconcileModal(account)} dir="rtl">
                          تسوية 🔄
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </motion.section>

            {/* INSTITUTIONAL SECTION 1: BANK CERTIFICATES & FIXED DEPOSITS (الشهادات البنكية والودائع) */}
            <motion.section
              className="mt-6"
              initial={reduceMotion ? false : { opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.38, delay: 0.4 }}
            >
              <div className="flex items-center justify-between mb-3.5 flex-wrap gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <Landmark className="size-4.5 text-indigo-600 dark:text-indigo-400" />
                    <h2 className="text-base font-bold text-slate-900 dark:text-white">
                      الشهادات البنكية والودائع (Fixed Banking Income)
                    </h2>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 font-medium mt-0.5">
                    إدارة الأصول ذات العائد الثابت، مواعيد الاستحقاق، وتحصيل العائد بنقرة واحدة
                  </p>
                </div>
                {!usingDemo && (
                  <Button
                    size="sm"
                    onClick={() => {
                      setCertLinkedAccountId(cashAccounts[0] ? String(cashAccounts[0].id) : "");
                      setAddCertModalOpen(true);
                    }}
                    className="text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white h-8 px-3 rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5"
                  >
                    <Plus className="size-3.5" />
                    ربط شهادة جديدة
                  </Button>
                )}
              </div>

              {(certificatesQuery.data ?? []).length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {(certificatesQuery.data ?? []).map((cert) => (
                    <div
                      key={cert.id}
                      className="bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm hover:border-indigo-300 dark:hover:border-indigo-800 transition-all flex flex-col justify-between min-h-[160px]"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                            {cert.bankName}
                          </span>
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-bold border ${
                              cert.daysToMaturity === 0
                                ? "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300"
                                : "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300"
                            }`}
                          >
                            <Clock className="size-3" />
                            {cert.daysToMaturity === 0
                              ? "مستحقة الصرف"
                              : `متبقي ${cert.daysToMaturity} يوماً`}
                          </span>
                        </div>

                        <strong className="text-slate-900 dark:text-white font-bold text-sm block mt-2">
                          {cert.certificateName}
                        </strong>

                        <div className="grid grid-cols-2 gap-2 mt-3 p-2.5 rounded-xl bg-slate-50 dark:bg-[#0E1420] border border-slate-100 dark:border-slate-800/80 text-xs">
                          <div>
                            <span className="text-[10.5px] text-slate-500 block">أصل الشهادة:</span>
                            <b className="font-mono font-bold text-slate-900 dark:text-white text-xs" dir="ltr">
                              <SensitiveValue>{formatMoney(cert.principalAmount, cert.currency, 0)}</SensitiveValue>
                            </b>
                          </div>
                          <div>
                            <span className="text-[10.5px] text-slate-500 block">
                              العائد ({cert.interestRate}%):
                            </span>
                            <b className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-xs" dir="ltr">
                              +<SensitiveValue>{formatMoney(cert.periodicYield, cert.currency, 0)}</SensitiveValue>
                            </b>
                            <span className="text-[9.5px] text-slate-400 block">
                              {cert.payoutFrequency === "monthly"
                                ? "شهرياً"
                                : cert.payoutFrequency === "quarterly"
                                ? "ربع سنوي"
                                : cert.payoutFrequency === "semi_annual"
                                ? "نصف سنوي"
                                : "سنوياً"}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                        <span className="text-[11px] text-slate-500 font-medium truncate max-w-[150px]">
                          {cert.linkedAccountName ? `يُصرف إلى: ${cert.linkedAccountName}` : "غير محدد حساب الصرف"}
                        </span>
                        {!usingDemo && cert.status === "active" && (
                          <Button
                            size="sm"
                            disabled={collectingCertId === cert.id}
                            onClick={() => handleCollectYield(cert.id)}
                            className="text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white h-7 px-2.5 rounded-lg shadow-2xs cursor-pointer flex items-center gap-1"
                          >
                            <Coins className="size-3" />
                            {collectingCertId === cert.id ? "جارٍ التحصيل..." : "تحصيل العائد"}
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-white dark:bg-[#0F172A] border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl p-6 text-center">
                  <Landmark className="size-8 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    لا توجد شهادات بنكية أو ودائع مسجلة حالياً
                  </p>
                  <p className="text-[11px] text-slate-500 mt-1 max-w-sm mx-auto">
                    سجّل شهاداتك ذات العائد الدوري (مثل شهادات الأهلي وبنك مصر) لمتابعة استحقاقاتها وتحصيل عوائدها بنقرة واحدة في حسابك البنكي.
                  </p>
                  {!usingDemo && (
                    <Button
                      size="sm"
                      onClick={() => {
                        setCertLinkedAccountId(cashAccounts[0] ? String(cashAccounts[0].id) : "");
                        setAddCertModalOpen(true);
                      }}
                      className="mt-3 text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white h-8 px-3 rounded-xl shadow-xs cursor-pointer"
                    >
                      + ربط أول شهادة بنكية
                    </Button>
                  )}
                </div>
              )}
            </motion.section>

            {/* INSTITUTIONAL SECTION 2: CREDIT CARDS & 0% INSTALLMENTS (كروت المشتريات والتقسيط) */}
            <motion.section
              className="mt-6 mb-4"
              initial={reduceMotion ? false : { opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.38, delay: 0.44 }}
            >
              <div className="flex items-center justify-between mb-3.5 flex-wrap gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <CreditCard className="size-4.5 text-rose-600 dark:text-rose-400" />
                    <h2 className="text-base font-bold text-slate-900 dark:text-white">
                      كروت المشتريات والتقسيط (Credit Cards & 0% Installments)
                    </h2>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 font-medium mt-0.5">
                    مراقبة سقف الاستخدام الائتماني (30%)، فترات السماح، وخطط التقسيط بدون فوائد
                  </p>
                </div>
                {!usingDemo && (
                  <div className="flex items-center gap-2">
                    {(creditCardsQuery.data ?? []).length > 0 && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const firstCard = (creditCardsQuery.data ?? [])[0];
                          setSelectedCardForInstallment(firstCard ? firstCard.id : null);
                          setAddInstallmentModalOpen(true);
                        }}
                        className="text-xs font-bold border-slate-200 dark:border-slate-700 h-8 px-3 rounded-xl cursor-pointer flex items-center gap-1.5"
                      >
                        <Percent className="size-3.5" />
                        + خطة تقسيط 0%
                      </Button>
                    )}
                    <Button
                      size="sm"
                      onClick={() => setAddCardModalOpen(true)}
                      className="text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white h-8 px-3 rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5"
                    >
                      <Plus className="size-3.5" />
                      إضافة كارت مشتريات
                    </Button>
                  </div>
                )}
              </div>

              {(creditCardsQuery.data ?? []).length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {(creditCardsQuery.data ?? []).map((card) => (
                    <div
                      key={card.id}
                      className="bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm hover:border-rose-300 dark:hover:border-rose-900 transition-all flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                            {card.lender || "كارت ائتمان"}
                          </span>
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-bold border ${
                              card.graceDaysRemaining <= 5
                                ? "bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/50 dark:text-rose-200"
                                : "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300"
                            }`}
                          >
                            <Clock className="size-3" />
                            متبقي {card.graceDaysRemaining} يوماً على السداد
                          </span>
                        </div>

                        <strong className="text-slate-900 dark:text-white font-bold text-sm block mt-2">
                          {card.name}
                        </strong>

                        {/* Financial Metrics */}
                        <div className="grid grid-cols-2 gap-2 mt-3 p-2.5 rounded-xl bg-slate-50 dark:bg-[#0E1420] border border-slate-100 dark:border-slate-800 text-xs">
                          <div>
                            <span className="text-[10.5px] text-slate-500 block">مديونية الكارت:</span>
                            <b className="font-mono font-bold text-rose-600 dark:text-rose-400 text-sm" dir="ltr">
                              <SensitiveValue>{formatMoney(card.currentBalance, card.currency, 0)}</SensitiveValue>
                            </b>
                          </div>
                          <div>
                            <span className="text-[10.5px] text-slate-500 block">الحد المتاح:</span>
                            <b className="font-mono font-bold text-slate-900 dark:text-white text-sm" dir="ltr">
                              <SensitiveValue>{formatMoney(card.availableLimit, card.currency, 0)}</SensitiveValue>
                            </b>
                          </div>
                        </div>

                        {/* Utilization Gauge */}
                        <div className="mt-3 space-y-1">
                          <div className="flex items-center justify-between text-[11px] font-semibold">
                            <span className="text-slate-600 dark:text-slate-400">
                              نسبة الاستخدام: <b className="font-mono">{card.utilizationRate}%</b>
                            </span>
                            <span
                              className={`text-[10px] font-bold ${
                                card.utilizationRate > 50
                                  ? "text-rose-600"
                                  : card.utilizationRate > 30
                                  ? "text-amber-600"
                                  : "text-emerald-600"
                              }`}
                            >
                              {card.utilizationRate > 30 ? "⚠️ فوق سقف 30%" : "✅ سقف آمن"}
                            </span>
                          </div>
                          <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                            <div
                              className={`h-full transition-all duration-500 rounded-full ${
                                card.utilizationRate > 50
                                  ? "bg-rose-500"
                                  : card.utilizationRate > 30
                                  ? "bg-amber-500"
                                  : "bg-emerald-500"
                              }`}
                              style={{ width: `${Math.min(100, Math.max(2, card.utilizationRate))}%` }}
                            />
                          </div>
                        </div>

                        {/* 0% Installment Plans list */}
                        {card.activeInstallments.length > 0 && (
                          <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1">
                            <span className="text-[10.5px] font-bold text-slate-500 block">
                              خطط التقسيط النشطة (0%):
                            </span>
                            {card.activeInstallments.map((inst: any) => (
                              <div
                                key={inst.id}
                                className="flex items-center justify-between text-[11px] py-1 px-2 rounded-lg bg-slate-50/70 dark:bg-slate-900/50"
                              >
                                <span className="font-medium text-slate-800 dark:text-slate-200">
                                  {inst.merchantName} - {inst.planName}
                                </span>
                                <span className="font-mono font-bold text-slate-700 dark:text-slate-300" dir="ltr">
                                  {formatMoney(inst.monthlyAmount, card.currency, 0)}/شهر ({inst.remainingMonths} متبقي)
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                        <span className="text-[11px] text-slate-500 font-medium">
                          حد الكارت: {formatMoney(card.creditLimit, card.currency, 0)}
                        </span>
                        {!usingDemo && Number(card.currentBalance) > 0 && (
                          <Button
                            size="sm"
                            onClick={() => openPayCardModal(card)}
                            className="text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white h-7 px-3 rounded-lg shadow-2xs cursor-pointer flex items-center gap-1"
                          >
                            سداد الكارت (1-Click)
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-white dark:bg-[#0F172A] border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl p-6 text-center">
                  <CreditCard className="size-8 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    لا توجد كروت مشتريات مسجلة
                  </p>
                  <p className="text-[11px] text-slate-500 mt-1 max-w-sm mx-auto">
                    أضف كروت الائتمان الخاصة بك لمتابعة الحد الائتماني المتاح، وتنبيهات مهلة السداد قبل احتساب الفوائد، وتتبع خطط التقسيط بدون فوائد.
                  </p>
                  {!usingDemo && (
                    <Button
                      size="sm"
                      onClick={() => setAddCardModalOpen(true)}
                      className="mt-3 text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white h-8 px-3 rounded-xl shadow-xs cursor-pointer"
                    >
                      + إضافة كارت مشتريات
                    </Button>
                  )}
                </div>
              )}
            </motion.section>
          </>
        )}
        <OnboardingWizard
          open={wizardOpen}
          onOpenChange={setWizardOpen}
          workspaceName={live?.workspace.name || "مساحة FAMILY"}
          baseCurrency={live?.workspace.baseCurrency || "EGP"}
        />

        {/* Dialog: Edit Price Triggers */}
        <Dialog open={triggerModalOpen} onOpenChange={setTriggerModalOpen}>
          <DialogContent dir="rtl" className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <SlidersHorizontal className="size-4 text-emerald-600" />
                <span>أهداف التداول وتنبيهات الأسعار</span>
              </DialogTitle>
              <DialogDescription>
                حدد أهداف الشراء وجني الأرباح للأصل{" "}
                <b className="text-slate-900 dark:text-white">
                  {selectedTriggerItem?.symbol || selectedTriggerItem?.name}
                </b>
                . ستتلقى تنبيهاً ذكياً فور وصول السعر للهدف.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              {selectedTriggerItem?.currentPrice !== null && (
                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 text-xs">
                  <span className="text-slate-600 dark:text-slate-400">السعر المرجعي الحالي:</span>
                  <strong className="font-mono font-bold text-slate-900 dark:text-white" dir="ltr">
                    {formatMoney(selectedTriggerItem?.currentPrice ?? 0, selectedTriggerItem?.currency || "EGP", 2)}
                  </strong>
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="targetBuyPrice" className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  سعر الشراء المستهدف (Dip Buy Trigger)
                </Label>
                <div className="relative flex items-center">
                  <Input
                    id="targetBuyPrice"
                    type="number"
                    step="0.01"
                    placeholder="مثال: 29.50"
                    value={selectedTriggerItem?.targetBuyPrice || ""}
                    onChange={(e) =>
                      setSelectedTriggerItem((prev) => (prev ? { ...prev, targetBuyPrice: e.target.value } : null))
                    }
                    className="font-mono font-bold text-slate-900 dark:text-slate-100 text-left pl-16 pr-3 h-10 rounded-xl border-slate-200 dark:border-slate-800 focus-visible:ring-2 focus-visible:ring-emerald-500/20 focus-visible:border-emerald-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    dir="ltr"
                  />
                  <span className="absolute left-2.5 px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-mono font-bold tracking-tight pointer-events-none border border-slate-200/60 dark:border-slate-700/60">
                    {selectedTriggerItem?.currency || "EGP"}
                  </span>
                </div>
                <p className="text-[10.5px] text-slate-500 dark:text-slate-400 font-medium">
                  يُطلق تنبيهاً ذكياً عند انخفاض السعر إلى هذا المستوى أو أدنى منه.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="targetTakeProfitPrice" className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  سعر جني الأرباح المستهدف (Take-Profit Trigger)
                </Label>
                <div className="relative flex items-center">
                  <Input
                    id="targetTakeProfitPrice"
                    type="number"
                    step="0.01"
                    placeholder="مثال: 45.00"
                    value={selectedTriggerItem?.targetTakeProfitPrice || ""}
                    onChange={(e) =>
                      setSelectedTriggerItem((prev) => (prev ? { ...prev, targetTakeProfitPrice: e.target.value } : null))
                    }
                    className="font-mono font-bold text-slate-900 dark:text-slate-100 text-left pl-16 pr-3 h-10 rounded-xl border-slate-200 dark:border-slate-800 focus-visible:ring-2 focus-visible:ring-emerald-500/20 focus-visible:border-emerald-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    dir="ltr"
                  />
                  <span className="absolute left-2.5 px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-mono font-bold tracking-tight pointer-events-none border border-slate-200/60 dark:border-slate-700/60">
                    {selectedTriggerItem?.currency || "EGP"}
                  </span>
                </div>
                <p className="text-[10.5px] text-slate-500 dark:text-slate-400 font-medium">
                  يُطلق تنبيهاً ذكياً عند ارتفاع السعر وتحقيق هدف جني الأرباح.
                </p>
              </div>
            </div>

            <DialogFooter className="gap-2 sm:justify-start">
              <Button
                variant="outline"
                onClick={() => setTriggerModalOpen(false)}
                disabled={isSubmittingTrigger}
              >
                إلغاء
              </Button>
              <Button
                onClick={handleSaveTriggers}
                disabled={isSubmittingTrigger}
                className="bg-slate-900 hover:bg-slate-800 text-white dark:bg-emerald-600 dark:hover:bg-emerald-500"
              >
                {isSubmittingTrigger ? "جارٍ الحفظ..." : "حفظ التنبيهات"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog: Log Cash Dividend */}
        <Dialog open={dividendModalOpen} onOpenChange={setDividendModalOpen}>
          <DialogContent dir="rtl" className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <DollarSign className="size-4 text-emerald-600" />
                <span>تسجيل توزيع أرباح نقدية</span>
              </DialogTitle>
              <DialogDescription>
                قيد توزيع نقدي للأصل{" "}
                <b className="text-slate-900 dark:text-white">
                  {selectedDividendItem?.symbol || selectedDividendItem?.name}
                </b>
                . يُودع المبلغ في الحساب المختار كإيراد توزيعات دون التأثير على عدد الأسهم.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="dividendAccount" className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  الحساب المستلم للتوزيع
                </Label>
                <Select value={dividendAccountId} onValueChange={setDividendAccountId}>
                  <SelectTrigger id="dividendAccount" className="w-full text-right" dir="rtl">
                    <SelectValue placeholder="اختر الحساب البنكي أو النقدي" />
                  </SelectTrigger>
                  <SelectContent dir="rtl">
                    {(live?.accounts ?? [])
                      .filter((acc) => ["cash", "bank", "brokerage", "wallet"].includes(acc.accountType))
                      .map((acc) => (
                        <SelectItem key={acc.id} value={String(acc.id)}>
                          {acc.name} ({acc.currency})
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="dividendAmount" className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  إجمالي المبلغ المستلم (صافي التوزيع)
                </Label>
                <div className="relative">
                  <Input
                    id="dividendAmount"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={dividendAmount}
                    onChange={(e) => setDividendAmount(e.target.value)}
                    className="font-mono text-left"
                    dir="ltr"
                  />
                  <span className="absolute left-3 top-2.5 text-xs text-slate-400 pointer-events-none font-mono">
                    {selectedDividendItem?.currency || "EGP"}
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="dividendMemo" className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  البيان / ملاحظة القيد
                </Label>
                <Input
                  id="dividendMemo"
                  value={dividendMemo}
                  onChange={(e) => setDividendMemo(e.target.value)}
                  placeholder="مثال: توزيعات أرباح النصف الأول 2026"
                />
              </div>

              <div className="p-3 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/60 text-[11px] text-emerald-800 dark:text-emerald-300">
                <b>ملاحظة محاسبية:</b> سيُسجل هذا التوزيع كقيد إيراد استثماري ويُضاف لرصيد الحساب المالي، دون تغيير في رصيد الأسهم أو كلفة الشراء التاريخية.
              </div>
            </div>

            <DialogFooter className="gap-2 sm:justify-start">
              <Button
                variant="outline"
                onClick={() => setDividendModalOpen(false)}
                disabled={isSubmittingDividend}
              >
                إلغاء
              </Button>
              <Button
                onClick={handlePostDividend}
                disabled={isSubmittingDividend}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {isSubmittingDividend ? "جارٍ القيد..." : "قيد التوزيع في الحساب"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Quick Price Entry Dialog */}
        <Dialog open={quickPriceModalOpen} onOpenChange={setQuickPriceModalOpen}>
          <DialogContent className="max-w-md rounded-2xl p-6 bg-white dark:bg-[#0B0F17] border border-slate-200 dark:border-slate-800 text-right" dir="rtl">
            <DialogHeader className="text-right space-y-1">
              <DialogTitle className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Pencil className="size-4 text-emerald-600" />
                {selectedItemForPrice?.assetType === "fund"
                  ? "تسجيل ومطابقة سعر الوثيقة (Thndr / NAV Matching)"
                  : "تحديث السعر السوقي يدوياً"}
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                {selectedItemForPrice?.name} ({selectedItemForPrice?.symbol})
                {selectedItemForPrice?.assetType === "fund" && (
                  <span className="block text-[11px] text-teal-600 dark:text-teal-400 font-semibold mt-1">
                    يمكنك إدخال سعر الوثيقة المعتمد فوراً لمطابقة كشف حساب ثاندر (Thndr) أو مدير الصندوق.
                  </span>
                )}
              </DialogDescription>
            </DialogHeader>

            <div className="py-4 space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {selectedItemForPrice?.assetType === "fund"
                    ? "سعر الوثيقة المعتمد (NAV) بكشف ثاندر (EGP)"
                    : "السعر السوقي للأصل (EGP)"}
                </Label>
                <div className="relative">
                  <Input
                    type="text"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={quickPriceValue}
                    onChange={(e) => setQuickPriceValue(e.target.value)}
                    className="rounded-xl text-sm font-mono font-bold text-left pl-14"
                    dir="ltr"
                    autoFocus
                  />
                  <span className="absolute left-3 top-2.5 text-xs text-slate-400 pointer-events-none font-mono font-bold">
                    {selectedItemForPrice?.currency || "EGP"}
                  </span>
                </div>
              </div>
              <p className="text-[11px] text-slate-500">
                {selectedItemForPrice?.assetType === "fund"
                  ? "سيتم تسجيل السعر كقيمة أصول صافية (NAV) معتمدة ومطابقة لمحفظة ثاندر وتحديث العوائد غير المحققة فوراً."
                  : "سيتم تسجيل السعر كتقييم سوقي لحظي معتمد للأصل."}
              </p>
            </div>

            <DialogFooter className="gap-2 sm:justify-start">
              <Button
                type="button"
                variant="outline"
                onClick={() => setQuickPriceModalOpen(false)}
                className="rounded-xl text-xs"
              >
                إلغاء
              </Button>
              <Button
                type="button"
                disabled={recordManualPrice.isPending || !quickPriceValue || isNaN(Number(quickPriceValue))}
                onClick={() => {
                  if (!selectedItemForPrice) return;
                  recordManualPrice.mutate({
                    instrumentId: selectedItemForPrice.instrumentId,
                    price: quickPriceValue.trim(),
                    asOf: Date.now(),
                  });
                }}
                className="rounded-xl text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
              >
                {recordManualPrice.isPending ? "جارٍ الحفظ..." : "حفظ السعر واعتماد التقييم"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Debt Paydown Modal */}
        <Dialog open={debtPaymentModalOpen} onOpenChange={setDebtPaymentModalOpen}>
          <DialogContent className="max-w-md rounded-2xl p-6 bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 text-right" dir="rtl">
            <DialogHeader className="text-right space-y-1">
              <DialogTitle className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <BadgeDollarSign className="size-5 text-rose-500" />
                تسجيل سداد دفعة دين / التزام مالي
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                قيد محاسبي مزدوج يخفض رصيد الدين القائم ويسحب الدفعة من حسابك النقدي أو البنكي.
              </DialogDescription>
            </DialogHeader>

            <div className="py-4 space-y-3.5">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  العقد أو الدين المستهدف
                </Label>
                <Select
                  value={selectedDebtId ? String(selectedDebtId) : ""}
                  onValueChange={(val) => {
                    const id = Number(val);
                    setSelectedDebtId(id);
                    const target = (debts.data ?? []).find(d => d.id === id);
                    if (target) {
                      setPaymentPrincipal(String(target.minimumPayment || ""));
                      setPaymentMemo(`سداد دفعة: ${target.name}`);
                    }
                  }}
                >
                  <SelectTrigger className="bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-xs text-right">
                    <SelectValue placeholder="اختر الدين المراد سداده" />
                  </SelectTrigger>
                  <SelectContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                    {(debts.data ?? [])
                      .filter(d => d.status === "active")
                      .map((debt) => (
                        <SelectItem key={debt.id} value={String(debt.id)} className="text-xs text-right">
                          {debt.name} (قائم: {formatMoney(debt.outstanding, debt.currency, 0)})
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  الحساب المصرفي / النقدي المسحوب منه
                </Label>
                <Select value={paymentAccountId} onValueChange={setPaymentAccountId}>
                  <SelectTrigger className="bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-xs text-right">
                    <SelectValue placeholder="اختر الحساب المسحوب منه السداد" />
                  </SelectTrigger>
                  <SelectContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                    {cashAccounts.map((acc) => (
                      <SelectItem key={acc.id} value={String(acc.id)} className="text-xs text-right">
                        {acc.name} (رصيد: {formatMoney(acc.baseValue ?? acc.balance, acc.currency, 0)})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    سداد أصل الدين (EGP)
                  </Label>
                  <Input
                    type="number"
                    min="1"
                    step="any"
                    placeholder="0.00"
                    value={paymentPrincipal}
                    onChange={(e) => setPaymentPrincipal(e.target.value)}
                    className="bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-xs font-mono font-bold"
                    dir="ltr"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    فوائد أو مصاريف (اختياري)
                  </Label>
                  <Input
                    type="number"
                    min="0"
                    step="any"
                    placeholder="0.00"
                    value={paymentInterest}
                    onChange={(e) => setPaymentInterest(e.target.value)}
                    className="bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-xs font-mono"
                    dir="ltr"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  ملاحظات القيد
                </Label>
                <Input
                  type="text"
                  placeholder="ملاحظات توضيحية لعملية السداد"
                  value={paymentMemo}
                  onChange={(e) => setPaymentMemo(e.target.value)}
                  className="bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-xs"
                />
              </div>
            </div>

            <DialogFooter className="gap-2 sm:justify-start pt-2 border-t border-slate-100 dark:border-slate-800">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDebtPaymentModalOpen(false)}
                className="rounded-xl text-xs"
              >
                إلغاء
              </Button>
              <Button
                type="button"
                disabled={isSubmittingDebtPayment || !paymentPrincipal || parseFloat(paymentPrincipal) <= 0}
                onClick={handlePostDebtPayment}
                className="rounded-xl text-xs bg-rose-600 hover:bg-rose-700 text-white font-bold"
              >
                {isSubmittingDebtPayment ? "جارٍ تسجيل السداد..." : "تأكيد وقيد السداد"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* DIALOG 1: QUICK BALANCE RECONCILIATION MODAL (تسوية ومطابقة الرصيد الفعلي) */}
        <Dialog open={reconcileModalOpen} onOpenChange={setReconcileModalOpen}>
          <DialogContent className="max-w-md rounded-2xl p-6 bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 text-right" dir="rtl">
            <DialogHeader className="text-right space-y-1">
              <DialogTitle className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <RefreshCw className="size-5 text-emerald-600 animate-spin-reverse" />
                تسوية ومطابقة الرصيد الفعلي (Account Reconciliation)
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                أدخل رصيدك الحقيقي الآن (مثل رصيد تيلدا أو الحساب البنكي الفعلي). سيقوم النظام باحتساب الفارق وقيد تسوية دفتري فوري.
              </DialogDescription>
            </DialogHeader>

            <div className="py-4 space-y-4">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#0E1420] border border-slate-200 dark:border-slate-800 text-xs space-y-1">
                <div className="flex items-center justify-between text-slate-500">
                  <span>الحساب المستهدف:</span>
                  <strong className="text-slate-900 dark:text-white font-bold">{selectedAccountForReconcile?.name}</strong>
                </div>
                <div className="flex items-center justify-between text-slate-500">
                  <span>الرصيد الدفتري المسجل حالياً:</span>
                  <b className="font-mono font-bold text-slate-900 dark:text-white" dir="ltr">
                    {formatMoney(selectedAccountForReconcile?.value || 0, selectedAccountForReconcile?.currency || currency, 2)}
                  </b>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  الرصيد الفعلي الحقيقي الحالي ({selectedAccountForReconcile?.currency || currency})
                </Label>
                <Input
                  type="number"
                  step="any"
                  placeholder="0.00"
                  value={actualReconcileBalance}
                  onChange={(e) => setActualReconcileBalance(e.target.value)}
                  className="bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-sm font-mono font-bold"
                  dir="ltr"
                />
              </div>

              {/* Dynamic Difference Calculation Display */}
              {actualReconcileBalance && !isNaN(parseFloat(actualReconcileBalance)) && (
                (() => {
                  const target = parseFloat(actualReconcileBalance);
                  const current = Number(selectedAccountForReconcile?.value || 0);
                  const diff = target - current;
                  const isGain = diff > 0;
                  const isZero = Math.abs(diff) < 0.001;

                  return (
                    <div
                      className={`p-3 rounded-xl border text-xs flex items-center justify-between ${
                        isZero
                          ? "bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300"
                          : isGain
                          ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/60 text-emerald-900 dark:text-emerald-200"
                          : "bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/60 text-amber-900 dark:text-amber-200"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-bold">
                          {isZero
                            ? "الرصيد متطابق تماماً"
                            : isGain
                            ? "فارق إيجابي (تسوية رصيد / عائد دوري)"
                            : "فارق سالب (تسوية رصيد / فرق تسوية)"}
                        </span>
                      </div>
                      <b className="font-mono font-bold text-sm" dir="ltr">
                        {isGain ? "+ " : isZero ? "" : "- "}
                        {formatMoney(Math.abs(diff), selectedAccountForReconcile?.currency || currency, 2)}
                      </b>
                    </div>
                  );
                })()
              )}

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  ملاحظات أو بيان التسوية (اختياري)
                </Label>
                <Input
                  type="text"
                  placeholder="مثال: تسوية رصيد تيلدا / إضافة عائد الصندوق اليومي"
                  value={reconcileMemo}
                  onChange={(e) => setReconcileMemo(e.target.value)}
                  className="bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-xs"
                />
              </div>
            </div>

            <DialogFooter className="gap-2 sm:justify-start pt-2 border-t border-slate-100 dark:border-slate-800">
              <Button
                type="button"
                variant="outline"
                onClick={() => setReconcileModalOpen(false)}
                className="rounded-xl text-xs"
              >
                إلغاء
              </Button>
              <Button
                type="button"
                disabled={isSubmittingReconcile || !actualReconcileBalance}
                onClick={handleReconcileAccount}
                className="rounded-xl text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
              >
                {isSubmittingReconcile ? "جارٍ تسجيل قيد التسوية..." : "تأكيد التسوية وتحديث الدفتر"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* DIALOG 2: ADD BANK CERTIFICATE (ربط شهادة بنكية جديدة) */}
        <Dialog open={addCertModalOpen} onOpenChange={setAddCertModalOpen}>
          <DialogContent className="max-w-md rounded-2xl p-6 bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 text-right" dir="rtl">
            <DialogHeader className="text-right space-y-1">
              <DialogTitle className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Landmark className="size-5 text-indigo-600" />
                ربط شهادة بنكية أو وديعة جديدة
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                تُضاف قيمة أصل الشهادة إلى صافي الثروة والدخل الثابت (وتُستبعد من السيولة الحرة حتى موعد استحقاقها).
              </DialogDescription>
            </DialogHeader>

            <div className="py-4 space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">اسم الشهادة</Label>
                  <Input
                    type="text"
                    placeholder="مثال: الشهادة البلاتينية"
                    value={certName}
                    onChange={(e) => setCertName(e.target.value)}
                    className="bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">اسم البنك المصدر</Label>
                  <Input
                    type="text"
                    placeholder="مثال: البنك الأهلي المصري"
                    value={certBank}
                    onChange={(e) => setCertBank(e.target.value)}
                    className="bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">أصل الشهادة (EGP)</Label>
                  <Input
                    type="number"
                    min="1"
                    step="any"
                    placeholder="100000"
                    value={certPrincipal}
                    onChange={(e) => setCertPrincipal(e.target.value)}
                    className="bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-xs font-mono font-bold"
                    dir="ltr"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">سعر الفائدة السنوي (%)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="23.5"
                    value={certRate}
                    onChange={(e) => setCertRate(e.target.value)}
                    className="bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-xs font-mono font-bold"
                    dir="ltr"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">دورية صرف العائد</Label>
                <Select value={certFrequency} onValueChange={(val: any) => setCertFrequency(val)}>
                  <SelectTrigger className="bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-xs text-right">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                    <SelectItem value="monthly" className="text-xs text-right">شهرياً (Monthly)</SelectItem>
                    <SelectItem value="quarterly" className="text-xs text-right">ربع سنوي (كل 3 أشهر)</SelectItem>
                    <SelectItem value="semi_annual" className="text-xs text-right">نصف سنوي (كل 6 أشهر)</SelectItem>
                    <SelectItem value="annual" className="text-xs text-right">سنوياً (Annual)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">تاريخ الربط / الإصدار</Label>
                  <Input
                    type="date"
                    value={certIssueDate}
                    onChange={(e) => setCertIssueDate(e.target.value)}
                    className="bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">تاريخ الاستحقاق (Maturity)</Label>
                  <Input
                    type="date"
                    value={certMaturityDate}
                    onChange={(e) => setCertMaturityDate(e.target.value)}
                    className="bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">الحساب البنكي المرتبط لصرف العائد</Label>
                <Select value={certLinkedAccountId} onValueChange={setCertLinkedAccountId}>
                  <SelectTrigger className="bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-xs text-right">
                    <SelectValue placeholder="اختر الحساب البنكي لصرف العائد" />
                  </SelectTrigger>
                  <SelectContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                    {cashAccounts.map((acc) => (
                      <SelectItem key={acc.id} value={String(acc.id)} className="text-xs text-right">
                        {acc.name} ({acc.currency})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter className="gap-2 sm:justify-start pt-2 border-t border-slate-100 dark:border-slate-800">
              <Button
                type="button"
                variant="outline"
                onClick={() => setAddCertModalOpen(false)}
                className="rounded-xl text-xs"
              >
                إلغاء
              </Button>
              <Button
                type="button"
                disabled={isSubmittingCert || !certName || !certPrincipal}
                onClick={handleCreateCertificate}
                className="rounded-xl text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
              >
                {isSubmittingCert ? "جارٍ حفظ الشهادة..." : "تأكيد وربط الشهادة"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* DIALOG 3: ADD CREDIT CARD (إضافة كارت مشتريات) */}
        <Dialog open={addCardModalOpen} onOpenChange={setAddCardModalOpen}>
          <DialogContent className="max-w-md rounded-2xl p-6 bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 text-right" dir="rtl">
            <DialogHeader className="text-right space-y-1">
              <DialogTitle className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <CreditCard className="size-5 text-rose-600" />
                إضافة كارت مشتريات (Credit Card)
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                متابعة المديونية، الحد الائتماني، وفترات السماح لتفادي الفوائد وغرامات التأخير.
              </DialogDescription>
            </DialogHeader>

            <div className="py-4 space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">اسم الكارت</Label>
                  <Input
                    type="text"
                    placeholder="مثال: CIB Titanium"
                    value={cardName}
                    onChange={(e) => setCardName(e.target.value)}
                    className="bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">البنك المصدر</Label>
                  <Input
                    type="text"
                    placeholder="مثال: CIB أو بنك مصر"
                    value={cardLender}
                    onChange={(e) => setCardLender(e.target.value)}
                    className="bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">الحد الائتماني الإجمالي (EGP)</Label>
                  <Input
                    type="number"
                    min="1"
                    placeholder="50000"
                    value={cardLimit}
                    onChange={(e) => setCardLimit(e.target.value)}
                    className="bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-xs font-mono font-bold"
                    dir="ltr"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">المديونية الحالية إن وُجدت (EGP)</Label>
                  <Input
                    type="number"
                    min="0"
                    placeholder="0.00"
                    value={cardCurrentBalance}
                    onChange={(e) => setCardCurrentBalance(e.target.value)}
                    className="bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-xs font-mono"
                    dir="ltr"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">يوم صدور كشف الحساب</Label>
                  <Input
                    type="number"
                    min="1"
                    max="31"
                    placeholder="1"
                    value={cardStatementDay}
                    onChange={(e) => setCardStatementDay(e.target.value)}
                    className="bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-xs font-mono"
                    dir="ltr"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">يوم السداد لتجنب الفائدة (Due Day)</Label>
                  <Input
                    type="number"
                    min="1"
                    max="31"
                    placeholder="25"
                    value={cardDueDay}
                    onChange={(e) => setCardDueDay(e.target.value)}
                    className="bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-xs font-mono font-bold"
                    dir="ltr"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">الحد الأدنى للسداد (Min Payment)</Label>
                <Input
                  type="number"
                  placeholder="يُحسب تلقائياً (5% تقريباً) إن تُرك فارغاً"
                  value={cardMinPayment}
                  onChange={(e) => setCardMinPayment(e.target.value)}
                  className="bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-xs font-mono"
                  dir="ltr"
                />
              </div>
            </div>

            <DialogFooter className="gap-2 sm:justify-start pt-2 border-t border-slate-100 dark:border-slate-800">
              <Button
                type="button"
                variant="outline"
                onClick={() => setAddCardModalOpen(false)}
                className="rounded-xl text-xs"
              >
                إلغاء
              </Button>
              <Button
                type="button"
                disabled={isSubmittingCard || !cardName || !cardLimit}
                onClick={handleCreateCreditCard}
                className="rounded-xl text-xs bg-rose-600 hover:bg-rose-700 text-white font-bold"
              >
                {isSubmittingCard ? "جارٍ إضافة الكارت..." : "تأكيد وإضافة الكارت"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* DIALOG 4: ADD 0% INSTALLMENT PLAN (إضافة خطة تقسيط 0%) */}
        <Dialog open={addInstallmentModalOpen} onOpenChange={setAddInstallmentModalOpen}>
          <DialogContent className="max-w-md rounded-2xl p-6 bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 text-right" dir="rtl">
            <DialogHeader className="text-right space-y-1">
              <DialogTitle className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Percent className="size-5 text-indigo-600" />
                إضافة خطة تقسيط 0% فوائد
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                تتبع أقساطك الشهرية المستقطعة دون مضاعفة الدين المحاسبي.
              </DialogDescription>
            </DialogHeader>

            <div className="py-4 space-y-3.5">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">كارت المشتريات التابع له التقسيط</Label>
                <Select
                  value={selectedCardForInstallment ? String(selectedCardForInstallment) : ""}
                  onValueChange={(val) => setSelectedCardForInstallment(Number(val))}
                >
                  <SelectTrigger className="bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-xs text-right">
                    <SelectValue placeholder="اختر الكارت" />
                  </SelectTrigger>
                  <SelectContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                    {(creditCardsQuery.data ?? []).map((c) => (
                      <SelectItem key={c.id} value={String(c.id)} className="text-xs text-right">
                        {c.name} ({c.lender})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">اسم المتجر / التاجر</Label>
                  <Input
                    type="text"
                    placeholder="مثال: Amazon أو B.Tech"
                    value={installmentMerchant}
                    onChange={(e) => setInstallmentMerchant(e.target.value)}
                    className="bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">وصف السلعة / الخطة</Label>
                  <Input
                    type="text"
                    placeholder="مثال: لابتوب / جهاز منزلي"
                    value={installmentPlanName}
                    onChange={(e) => setInstallmentPlanName(e.target.value)}
                    className="bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">إجمالي مبلغ العملية (EGP)</Label>
                <Input
                  type="number"
                  min="1"
                  placeholder="مثال: 24000"
                  value={installmentTotal}
                  onChange={(e) => setInstallmentTotal(e.target.value)}
                  className="bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-xs font-mono font-bold"
                  dir="ltr"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">إجمالي مدة التقسيط (شهور)</Label>
                  <Input
                    type="number"
                    min="1"
                    placeholder="12"
                    value={installmentTenure}
                    onChange={(e) => setInstallmentTenure(e.target.value)}
                    className="bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-xs font-mono"
                    dir="ltr"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">الأشهر المتبقية حالياً</Label>
                  <Input
                    type="number"
                    min="1"
                    placeholder="12"
                    value={installmentRemaining}
                    onChange={(e) => setInstallmentRemaining(e.target.value)}
                    className="bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-xs font-mono"
                    dir="ltr"
                  />
                </div>
              </div>

              {installmentTotal && installmentTenure && parseFloat(installmentTotal) > 0 && parseInt(installmentTenure, 10) > 0 && (
                <div className="p-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 text-xs flex items-center justify-between">
                  <span className="font-semibold text-indigo-900 dark:text-indigo-200">القسط الشهري المحسوب:</span>
                  <b className="font-mono font-bold text-sm text-indigo-800 dark:text-indigo-300" dir="ltr">
                    {formatMoney(parseFloat(installmentTotal) / parseInt(installmentTenure, 10), currency, 0)}/شهر
                  </b>
                </div>
              )}
            </div>

            <DialogFooter className="gap-2 sm:justify-start pt-2 border-t border-slate-100 dark:border-slate-800">
              <Button
                type="button"
                variant="outline"
                onClick={() => setAddInstallmentModalOpen(false)}
                className="rounded-xl text-xs"
              >
                إلغاء
              </Button>
              <Button
                type="button"
                disabled={isSubmittingInstallment || !installmentMerchant || !installmentTotal}
                onClick={handleCreateInstallment}
                className="rounded-xl text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
              >
                {isSubmittingInstallment ? "جارٍ التسجيل..." : "تأكيد خطة التقسيط"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* DIALOG 5: PAY CREDIT CARD DUE (سداد مستحقات الكارت - 1-Click) */}
        <Dialog open={payCardModalOpen} onOpenChange={setPayCardModalOpen}>
          <DialogContent className="max-w-md rounded-2xl p-6 bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 text-right" dir="rtl">
            <DialogHeader className="text-right space-y-1">
              <DialogTitle className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <CreditCard className="size-5 text-rose-600" />
                سداد مستحقات كارت المشتريات (1-Click)
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                سداد فوري من حسابك البنكي أو النقدي لتصفير مديونية الكارت واستعادة الحد المتاح بالكامل.
              </DialogDescription>
            </DialogHeader>

            <div className="py-4 space-y-3.5">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#0E1420] border border-slate-200 dark:border-slate-800 text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">الكارت المستهدف:</span>
                  <strong className="text-slate-900 dark:text-white font-bold">{selectedCardForPayment?.name}</strong>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">المديونية القائمة الحالية:</span>
                  <b className="font-mono font-bold text-rose-600 dark:text-rose-400" dir="ltr">
                    {formatMoney(selectedCardForPayment?.currentBalance || 0, selectedCardForPayment?.currency || currency, 2)}
                  </b>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">الحد الائتماني الإجمالي:</span>
                  <b className="font-mono font-bold text-slate-900 dark:text-white" dir="ltr">
                    {formatMoney(selectedCardForPayment?.creditLimit || 0, selectedCardForPayment?.currency || currency, 2)}
                  </b>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  الحساب المصرفي أو النقدي المسحوب منه السداد
                </Label>
                <Select value={cardPaySourceAccountId} onValueChange={setCardPaySourceAccountId}>
                  <SelectTrigger className="bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-xs text-right">
                    <SelectValue placeholder="اختر الحساب المسحوب منه" />
                  </SelectTrigger>
                  <SelectContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                    {cashAccounts.map((acc) => (
                      <SelectItem key={acc.id} value={String(acc.id)} className="text-xs text-right">
                        {acc.name} (رصيد متاح: {formatMoney(acc.baseValue ?? acc.balance, acc.currency, 0)})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">مبلغ السداد (EGP)</Label>
                  <button
                    type="button"
                    onClick={() => setCardPayAmount(String(selectedCardForPayment?.currentBalance || ""))}
                    className="text-[10.5px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                  >
                    سداد كامل المديونية (100%)
                  </button>
                </div>
                <Input
                  type="number"
                  min="1"
                  step="any"
                  placeholder="0.00"
                  value={cardPayAmount}
                  onChange={(e) => setCardPayAmount(e.target.value)}
                  className="bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-sm font-mono font-bold"
                  dir="ltr"
                />
              </div>

              {/* Real-Time Transaction Financial Advisor Widget */}
              {cardPayAmount && parseFloat(cardPayAmount) > 0 && (
                <TransactionAdvisorWidget
                  type="expense"
                  amount={cardPayAmount}
                  currency={selectedCardForPayment?.currency || currency}
                />
              )}

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">ملاحظات السداد</Label>
                <Input
                  type="text"
                  placeholder="سداد مستحقات الكارت"
                  value={cardPayMemo}
                  onChange={(e) => setCardPayMemo(e.target.value)}
                  className="bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-xs"
                />
              </div>
            </div>

            <DialogFooter className="gap-2 sm:justify-start pt-2 border-t border-slate-100 dark:border-slate-800">
              <Button
                type="button"
                variant="outline"
                onClick={() => setPayCardModalOpen(false)}
                className="rounded-xl text-xs"
              >
                إلغاء
              </Button>
              <Button
                type="button"
                disabled={isSubmittingCardPay || !cardPayAmount || parseFloat(cardPayAmount) <= 0}
                onClick={handlePayCardDue}
                className="rounded-xl text-xs bg-rose-600 hover:bg-rose-700 text-white font-bold"
              >
                {isSubmittingCardPay ? "جارٍ تسجيل السداد..." : "تأكيد السداد وتحديث الدفتر"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}

