import React, { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useDemoMode } from "@/contexts/DemoModeContext";
import {
  CreditCard,
  Percent,
  Clock,
  Plus,
  ShieldCheck,
  Building2,
  Calendar,
  AlertTriangle,
  Receipt,
  CheckCircle2,
  ArrowDownLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import SensitiveValue from "@/components/SensitiveValue";
import { formatMoney } from "@/lib/financialDisplay";
import { TransactionAdvisorWidget } from "@/components/TransactionAdvisorWidget";

export function CreditCardsHub() {
  const { isDemoMode } = useDemoMode();
  const utils = trpc.useUtils();
  const creditCardsQuery = trpc.family.creditCards.list.useQuery(undefined, { enabled: !isDemoMode });
  const accountsQuery = trpc.family.accounts.list.useQuery();
  const createCreditCardMutation = trpc.family.creditCards.create.useMutation();
  const createInstallmentMutation = trpc.family.creditCards.createInstallment.useMutation();
  const payCreditCardDueMutation = trpc.family.creditCards.payDue.useMutation();

  // State: Add Card Modal
  const [addCardModalOpen, setAddCardModalOpen] = useState(false);
  const [cardName, setCardName] = useState("");
  const [cardLender, setCardLender] = useState("");
  const [cardLimit, setCardLimit] = useState("");
  const [cardBalance, setCardBalance] = useState("0");
  const [cardBillingDay, setCardBillingDay] = useState("1");
  const [cardDueDay, setCardDueDay] = useState("25");
  const [cardMinPayment, setCardMinPayment] = useState("5");
  const [isSubmittingCard, setIsSubmittingCard] = useState(false);

  // State: Installment Modal
  const [addInstallmentModalOpen, setAddInstallmentModalOpen] = useState(false);
  const [selectedCardForInstallment, setSelectedCardForInstallment] = useState<number | null>(null);
  const [installmentMerchant, setInstallmentMerchant] = useState("");
  const [installmentTotal, setInstallmentTotal] = useState("");
  const [installmentMonthly, setInstallmentMonthly] = useState("");
  const [installmentMonths, setInstallmentMonths] = useState("12");
  const [isSubmittingInstallment, setIsSubmittingInstallment] = useState(false);

  // State: Pay Card Due Modal
  const [payDueModalOpen, setPayDueModalOpen] = useState(false);
  const [selectedCardForPayment, setSelectedCardForPayment] = useState<any>(null);
  const [payDueAmount, setPayDueAmount] = useState("");
  const [payDueAccountId, setPayDueAccountId] = useState("");
  const [payDueMemo, setPayDueMemo] = useState("");
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);

  const cards = creditCardsQuery.data ?? [];
  const liquidAccounts = useMemo(() => {
    return (accountsQuery.data ?? []).filter(a => ["bank", "cash", "wallet"].includes(a.accountType) && a.status !== "archived");
  }, [accountsQuery.data]);

  // Aggregate Metrics
  const totalLimit = useMemo(() => {
    return cards.reduce((sum, c) => sum + (Number(c.creditLimit) || 0), 0);
  }, [cards]);

  const totalDues = useMemo(() => {
    return cards.reduce((sum, c) => sum + (Number(c.currentBalance) || 0), 0);
  }, [cards]);

  const totalAvailable = useMemo(() => {
    return Math.max(0, totalLimit - totalDues);
  }, [totalLimit, totalDues]);

  const overallUtilization = useMemo(() => {
    if (totalLimit <= 0) return 0;
    return Math.min(100, (totalDues / totalLimit) * 100);
  }, [totalDues, totalLimit]);

  const allActiveInstallments = useMemo(() => {
    return cards.flatMap(c => ((c.activeInstallments ?? []) as any[]).map(inst => ({ ...inst, cardName: c.name, cardLender: c.lender })));
  }, [cards]);

  const totalMonthlyInstallments = useMemo(() => {
    return allActiveInstallments.reduce((sum, inst) => sum + (Number(inst.monthlyAmount) || 0), 0);
  }, [allActiveInstallments]);

  const handleCreateCreditCard = async () => {
    const limitNum = parseFloat(cardLimit);
    const balNum = parseFloat(cardBalance) || 0;
    if (!cardName.trim()) {
      toast.error("يرجى إدخال اسم الكارت");
      return;
    }
    if (!limitNum || limitNum <= 0) {
      toast.error("يرجى إدخال الحد الائتماني للكارت");
      return;
    }

    try {
      setIsSubmittingCard(true);
      await createCreditCardMutation.mutateAsync({
        name: cardName.trim(),
        lender: cardLender.trim() || undefined,
        creditLimit: Number(limitNum).toFixed(6),
        currentBalance: Number(balNum).toFixed(6),
        currency: "EGP",
        statementDay: parseInt(cardBillingDay, 10) || 1,
        dueDay: parseInt(cardDueDay, 10) || 25,
        minPaymentDue: cardMinPayment ? String(cardMinPayment) : undefined,
      });

      await utils.family.creditCards.list.invalidate();
      await utils.family.dashboard.invalidate();
      await utils.family.debts.list.invalidate();
      toast.success("تم تسجيل وإضافة كارت المشتريات بنجاح");
      setAddCardModalOpen(false);
      setCardName("");
      setCardLender("");
      setCardLimit("");
      setCardBalance("0");
    } catch (err: any) {
      toast.error(err.message || "تعذر إضافة كارت المشتريات");
    } finally {
      setIsSubmittingCard(false);
    }
  };

  const handleCreateInstallment = async () => {
    if (!selectedCardForInstallment) {
      toast.error("يرجى اختيار الكارت المرتبط بالتقسيط");
      return;
    }
    const totNum = parseFloat(installmentTotal);
    const tenure = parseInt(installmentMonths, 10) || 12;
    if (!installmentMerchant.trim()) {
      toast.error("يرجى إدخال اسم التاجر أو وصف السلعة المشتراة");
      return;
    }
    if (!totNum || totNum <= 0) {
      toast.error("يرجى إدخال إجمالي مبلغ خطة التقسيط");
      return;
    }

    try {
      setIsSubmittingInstallment(true);
      await createInstallmentMutation.mutateAsync({
        debtId: selectedCardForInstallment,
        merchantName: installmentMerchant.trim(),
        planName: installmentMerchant.trim(),
        totalAmount: Number(totNum).toFixed(6),
        remainingMonths: tenure,
        tenureMonths: tenure,
        startDate: Date.now(),
      });

      await utils.family.creditCards.list.invalidate();
      await utils.family.dashboard.invalidate();
      toast.success("تم تسجيل خطة التقسيط 0% بنجاح");
      setAddInstallmentModalOpen(false);
      setInstallmentMerchant("");
      setInstallmentTotal("");
      setInstallmentMonthly("");
    } catch (err: any) {
      toast.error(err.message || "تعذر قيد خطة التقسيط");
    } finally {
      setIsSubmittingInstallment(false);
    }
  };

  const openPayDueModal = (card: any) => {
    setSelectedCardForPayment(card);
    setPayDueAmount(String(card.currentBalance > 0 ? card.currentBalance : ""));
    const def = liquidAccounts[0];
    setPayDueAccountId(def ? String(def.id) : "");
    setPayDueMemo(`سداد مديونية كارت: ${card.name}`);
    setPayDueModalOpen(true);
  };

  const handlePayDue = async () => {
    if (!selectedCardForPayment) return;
    const amountNum = parseFloat(payDueAmount);
    const accId = parseInt(payDueAccountId, 10);
    if (!amountNum || amountNum <= 0) {
      toast.error("يرجى إدخال مبلغ سداد صحيح");
      return;
    }
    if (!accId) {
      toast.error("يرجى اختيار الحساب البنكي أو النقدي للسداد");
      return;
    }

    try {
      setIsSubmittingPayment(true);
      await payCreditCardDueMutation.mutateAsync({
        debtId: selectedCardForPayment.id,
        cashAccountId: accId,
        amount: Number(amountNum).toFixed(6),
        memo: payDueMemo.trim() || undefined,
      });

      await utils.family.creditCards.list.invalidate();
      await utils.family.dashboard.invalidate();
      await utils.family.debts.list.invalidate();
      await utils.family.accounts.list.invalidate();
      toast.success("تم سداد مديونية الكارت واستعادة الحد المتاح فورياً");
      setPayDueModalOpen(false);
    } catch (err: any) {
      toast.error(err.message || "تعذر تسجيل سداد كارت المشتريات");
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Top Controls & KPI Ribbon */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400 border border-rose-200 dark:border-rose-800">
            <CreditCard className="size-5.5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              كروت المشتريات والتقسيط بدون فوائد (Credit Cards Hub)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              مراقبة سقف الاستخدام الائتماني (30%)، عداد فترات السماح، والسداد بنقرة واحدة
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0 flex-wrap">
          {cards.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (cards[0]) setSelectedCardForInstallment(cards[0].id);
                setAddInstallmentModalOpen(true);
              }}
              className="text-xs font-bold border-slate-200 dark:border-slate-700 h-9 px-3 rounded-xl cursor-pointer flex items-center gap-1.5"
            >
              <Percent className="size-3.5" />
              + خطة تقسيط 0%
            </Button>
          )}
          <Button
            size="sm"
            onClick={() => setAddCardModalOpen(true)}
            className="text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white h-9 px-4 rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5"
          >
            <Plus className="size-4" />
            إضافة كارت مشتريات
          </Button>
        </div>
      </div>

      {/* Aggregate KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 block">إجمالي المديونية المستحقة</span>
          <strong className="text-xl font-bold font-mono text-rose-600 dark:text-rose-400 mt-1 block" dir="ltr">
            <SensitiveValue>{formatMoney(totalDues, "EGP", 0)}</SensitiveValue>
          </strong>
          <span className="text-[11px] text-slate-400 mt-1 block">
            مخصومة تلقائياً من صافي الثروة
          </span>
        </div>

        <div className="bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 block">إجمالي الحدود المتاحة</span>
          <strong className="text-xl font-bold font-mono text-slate-900 dark:text-white mt-1 block" dir="ltr">
            <SensitiveValue>{formatMoney(totalAvailable, "EGP", 0)}</SensitiveValue>
          </strong>
          <span className="text-[11px] text-slate-400 mt-1 block">
            من إجمالي سقف {formatMoney(totalLimit, "EGP", 0)}
          </span>
        </div>

        <div className="bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 block">نسبة الاستخدام الإجمالية</span>
          <div className="flex items-center gap-2 mt-1">
            <strong className={`text-xl font-bold font-mono ${overallUtilization > 30 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"}`}>
              {overallUtilization.toFixed(1)}%
            </strong>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${overallUtilization > 30 ? "bg-rose-50 text-rose-700 dark:bg-rose-950/40" : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40"}`}>
              {overallUtilization <= 30 ? "آمن (<30%)" : "تجاوز السقف"}
            </span>
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">
            السقف المثالي للتقييم الائتماني 30%
          </span>
        </div>

        <div className="bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 block">أقساط 0% النشطة شهرياً</span>
          <strong className="text-xl font-bold font-mono text-indigo-600 dark:text-indigo-400 mt-1 block" dir="ltr">
            <SensitiveValue>{formatMoney(totalMonthlyInstallments, "EGP", 0)}</SensitiveValue>
          </strong>
          <span className="text-[11px] text-slate-400 mt-1 block">
            {allActiveInstallments.length} خطط تقسيط نشطة
          </span>
        </div>
      </div>

      {/* Main Cards Grid */}
      {cards.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {cards.map((card) => (
            <div
              key={card.id}
              className="bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-2xl p-4.5 shadow-sm hover:border-rose-300 dark:hover:border-rose-900 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                    <Building2 className="size-3 ml-1" />
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

                <strong className="text-slate-900 dark:text-white font-bold text-base block mt-2.5">
                  {card.name}
                </strong>

                {/* Financial Metrics */}
                <div className="grid grid-cols-2 gap-2 mt-3.5 p-3 rounded-xl bg-slate-50 dark:bg-[#0E1420] border border-slate-100 dark:border-slate-800 text-xs">
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
                <div className="mt-3.5 space-y-1">
                  <div className="flex items-center justify-between text-[11px] font-semibold">
                    <span className="text-slate-600 dark:text-slate-400">
                      نسبة الاستخدام: <b className="font-mono">{card.utilizationRate.toFixed(1)}%</b>
                    </span>
                    <span
                      className={`font-bold ${
                        card.isOverCeiling
                          ? "text-rose-600 dark:text-rose-400"
                          : "text-emerald-600 dark:text-emerald-400"
                      }`}
                    >
                      {card.isOverCeiling ? "تحذير: تجاوز 30%" : "آمن (تحت 30%)"}
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        card.isOverCeiling
                          ? "bg-rose-500"
                          : "bg-emerald-500"
                      }`}
                      style={{ width: `${Math.min(100, Math.max(2, card.utilizationRate))}%` }}
                    />
                  </div>
                </div>

                {/* Billing dates info */}
                <div className="mt-3 text-[11px] text-slate-500 flex items-center justify-between border-t border-slate-100 dark:border-slate-800/80 pt-2.5">
                  <span>إصدار المطالبة: يوم {card.statementDay}</span>
                  <span>الحد الأدنى للسداد: {formatMoney(card.minPaymentDue, card.currency, 0)}</span>
                </div>

                {/* Active Installments Count */}
                {card.activeInstallments && card.activeInstallments.length > 0 && (
                  <div className="mt-2 text-[10.5px] text-indigo-600 dark:text-indigo-400 font-semibold flex items-center gap-1">
                    <Receipt className="size-3" />
                    يحتوي على {card.activeInstallments.length} خطط تقسيط بدون فوائد
                  </div>
                )}
              </div>

              <div className="mt-4 pt-3.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setSelectedCardForInstallment(card.id);
                    setAddInstallmentModalOpen(true);
                  }}
                  className="text-xs h-7.5 px-2.5 rounded-lg border-slate-200 dark:border-slate-700 cursor-pointer flex items-center gap-1 text-slate-700 dark:text-slate-300"
                >
                  <Percent className="size-3" />
                  تقسيط
                </Button>

                <Button
                  size="sm"
                  disabled={Number(card.currentBalance) <= 0}
                  onClick={() => openPayDueModal(card)}
                  className="text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white h-7.5 px-3 rounded-lg shadow-2xs cursor-pointer flex items-center gap-1"
                >
                  <ArrowDownLeft className="size-3.5" />
                  سداد المستحق
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white dark:bg-[#0F172A] border border-dashed border-slate-200 dark:border-slate-800 rounded-3xl p-10 text-center max-w-xl mx-auto my-6">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400 mx-auto mb-3">
            <CreditCard className="size-7" />
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            لا توجد كروت مشتريات أو ائتمان مسجلة حالياً
          </h3>
          <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
            أضف كروت المشتريات الخاصة بك لمراقبة سقف الاستخدام الائتماني (30%)، ومتابعة فترات السماح لتجنب الفوائد، وإدارة خطط التقسيط بدون فوائد والسداد بنقرة واحدة.
          </p>
          <Button
            onClick={() => setAddCardModalOpen(true)}
            className="mt-4 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs h-9 px-5 rounded-xl shadow-xs cursor-pointer inline-flex items-center gap-1.5"
          >
            <Plus className="size-4" />
            إضافة أول كارت مشتريات
          </Button>
        </div>
      )}

      {/* 0% Installment Plans Table / List */}
      {allActiveInstallments.length > 0 && (
        <div className="bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Receipt className="size-4.5 text-indigo-600" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                خطط التقسيط النشطة بدون فوائد (0% Installments Tracker)
              </h3>
            </div>
            <span className="text-xs font-semibold text-slate-500">
              إجمالي الأقساط الشهرية: <b className="font-mono text-slate-900 dark:text-white">{formatMoney(totalMonthlyInstallments, "EGP", 0)}</b>
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-right">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 pb-2">
                  <th className="py-2 font-medium">السلعة / التاجر</th>
                  <th className="py-2 font-medium">الكارت المرتبط</th>
                  <th className="py-2 font-medium">إجمالي العملية</th>
                  <th className="py-2 font-medium">القسط الشهري</th>
                  <th className="py-2 font-medium">المتبقي</th>
                  <th className="py-2 font-medium">الحالة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                {allActiveInstallments.map((inst) => (
                  <tr key={inst.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                    <td className="py-2.5 font-bold text-slate-800 dark:text-slate-200">{inst.merchantName}</td>
                    <td className="py-2.5 text-slate-500">{inst.cardName}</td>
                    <td className="py-2.5 font-mono text-slate-700 dark:text-slate-300">{formatMoney(inst.totalAmount, "EGP", 0)}</td>
                    <td className="py-2.5 font-mono font-bold text-indigo-600 dark:text-indigo-400">{formatMoney(inst.monthlyAmount, "EGP", 0)}</td>
                    <td className="py-2.5 text-slate-600 dark:text-slate-400">{inst.remainingMonths} من {inst.tenureMonths} شهراً</td>
                    <td className="py-2.5">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                        تقسيط 0%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal: Add Credit Card */}
      <Dialog open={addCardModalOpen} onOpenChange={setAddCardModalOpen}>
        <DialogContent className="max-w-md bg-white dark:bg-[#0F172A] border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <CreditCard className="size-5 text-rose-600" />
              إضافة كارت مشتريات جديد
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              تسجيل الكارت لمتابعة سقف الاستخدام الائتماني والديون المستحقة وفترة السماح لتجنب الفائدة.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 py-2">
            <div>
              <Label className="text-xs font-semibold mb-1 block">اسم الكارت</Label>
              <Input
                placeholder="مثال: البلاتينيوم كاش باك أو تيتانيوم CIB"
                value={cardName}
                onChange={(e) => setCardName(e.target.value)}
                className="text-xs h-9"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold mb-1 block">البنك المصدر / الجهة</Label>
                <Input
                  placeholder="مثال: البنك التجاري الدولي CIB"
                  value={cardLender}
                  onChange={(e) => setCardLender(e.target.value)}
                  className="text-xs h-9"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold mb-1 block">الحد الائتماني الإجمالي (EGP)</Label>
                <Input
                  type="number"
                  placeholder="50000"
                  value={cardLimit}
                  onChange={(e) => setCardLimit(e.target.value)}
                  className="text-xs font-mono h-9"
                  dir="ltr"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold mb-1 block">المديونية الحالية (إن وجدت)</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={cardBalance}
                  onChange={(e) => setCardBalance(e.target.value)}
                  className="text-xs font-mono h-9"
                  dir="ltr"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold mb-1 block">الحد الأدنى للسداد (%)</Label>
                <Input
                  type="number"
                  placeholder="5"
                  value={cardMinPayment}
                  onChange={(e) => setCardMinPayment(e.target.value)}
                  className="text-xs font-mono h-9"
                  dir="ltr"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold mb-1 block">يوم صدور المطالبة شهرياً</Label>
                <Input
                  type="number"
                  min="1"
                  max="31"
                  placeholder="1"
                  value={cardBillingDay}
                  onChange={(e) => setCardBillingDay(e.target.value)}
                  className="text-xs font-mono h-9"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold mb-1 block">يوم الاستحقاق النهائي للسداد</Label>
                <Input
                  type="number"
                  min="1"
                  max="31"
                  placeholder="25"
                  value={cardDueDay}
                  onChange={(e) => setCardDueDay(e.target.value)}
                  className="text-xs font-mono h-9"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setAddCardModalOpen(false)}
              className="text-xs h-9"
            >
              إلغاء
            </Button>
            <Button
              disabled={isSubmittingCard}
              onClick={handleCreateCreditCard}
              className="text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white h-9 px-4"
            >
              {isSubmittingCard ? "جارٍ الحفظ..." : "حفظ وقيد الكارت"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Add Installment Plan */}
      <Dialog open={addInstallmentModalOpen} onOpenChange={setAddInstallmentModalOpen}>
        <DialogContent className="max-w-md bg-white dark:bg-[#0F172A] border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Percent className="size-5 text-indigo-600" />
              إضافة خطة تقسيط 0% فوائد
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              تتبع الأقساط الشهرية وخصمها من التوقعات الشهرية للسيولة الحرة دون تكرار أصل الدين.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 py-2">
            <div>
              <Label className="text-xs font-semibold mb-1 block">كارت المشتريات المرتبط</Label>
              <Select
                value={selectedCardForInstallment ? String(selectedCardForInstallment) : ""}
                onValueChange={(val) => setSelectedCardForInstallment(parseInt(val, 10))}
              >
                <SelectTrigger className="text-xs h-9">
                  <SelectValue placeholder="اختر كارت المشتريات..." />
                </SelectTrigger>
                <SelectContent>
                  {cards.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.name} ({c.lender || "كارت"})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs font-semibold mb-1 block">اسم السلعة أو التاجر</Label>
              <Input
                placeholder="مثال: جهاز لابتوب / أمازون مصر / بي تك"
                value={installmentMerchant}
                onChange={(e) => setInstallmentMerchant(e.target.value)}
                className="text-xs h-9"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold mb-1 block">إجمالي مبلغ الشراء (EGP)</Label>
                <Input
                  type="number"
                  placeholder="24000"
                  value={installmentTotal}
                  onChange={(e) => {
                    setInstallmentTotal(e.target.value);
                    const tot = parseFloat(e.target.value);
                    const mos = parseInt(installmentMonths, 10);
                    if (tot && mos) setInstallmentMonthly((tot / mos).toFixed(2));
                  }}
                  className="text-xs font-mono h-9"
                  dir="ltr"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold mb-1 block">عدد أشهر التقسيط</Label>
                <Select
                  value={installmentMonths}
                  onValueChange={(val) => {
                    setInstallmentMonths(val);
                    const tot = parseFloat(installmentTotal);
                    const mos = parseInt(val, 10);
                    if (tot && mos) setInstallmentMonthly((tot / mos).toFixed(2));
                  }}
                >
                  <SelectTrigger className="text-xs h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="3">3 أشهر</SelectItem>
                    <SelectItem value="6">6 أشهر</SelectItem>
                    <SelectItem value="9">9 أشهر</SelectItem>
                    <SelectItem value="12">12 شهراً (سنة)</SelectItem>
                    <SelectItem value="18">18 شهراً</SelectItem>
                    <SelectItem value="24">24 شهراً (سنتين)</SelectItem>
                    <SelectItem value="36">36 شهراً (3 سنوات)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="text-xs font-semibold mb-1 block">القسط الشهري (EGP)</Label>
              <Input
                type="number"
                placeholder="2000"
                value={installmentMonthly}
                onChange={(e) => setInstallmentMonthly(e.target.value)}
                className="text-xs font-mono h-9"
                dir="ltr"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setAddInstallmentModalOpen(false)}
              className="text-xs h-9"
            >
              إلغاء
            </Button>
            <Button
              disabled={isSubmittingInstallment}
              onClick={handleCreateInstallment}
              className="text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white h-9 px-4"
            >
              {isSubmittingInstallment ? "جارٍ الحفظ..." : "حفظ خطة التقسيط"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Pay Credit Card Due */}
      <Dialog open={payDueModalOpen} onOpenChange={setPayDueModalOpen}>
        <DialogContent className="max-w-md bg-white dark:bg-[#0F172A] border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <ArrowDownLeft className="size-5 text-rose-600" />
              سداد مستحقات كارت المشتريات (1-Click Settle)
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              سداد رصيد الكارت من حسابك البنكي أو النقدي لإعادة الحد المتاح وتفادي الفوائد بقيد محاسبي مزدوج.
            </DialogDescription>
          </DialogHeader>

          {selectedCardForPayment && (
            <div className="space-y-3.5 py-2">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#0E1420] border border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                <div>
                  <span className="text-slate-500 block">الكارت المحدد:</span>
                  <b className="text-slate-900 dark:text-white">{selectedCardForPayment.name}</b>
                </div>
                <div className="text-left" dir="ltr">
                  <span className="text-slate-500 block">المديونية المستحقة:</span>
                  <b className="font-mono text-rose-600 font-bold">
                    {formatMoney(selectedCardForPayment.currentBalance, selectedCardForPayment.currency, 0)}
                  </b>
                </div>
              </div>

              <div>
                <Label className="text-xs font-semibold mb-1 block">المبلغ المراد سداده (EGP)</Label>
                <Input
                  type="number"
                  placeholder="المبلغ"
                  value={payDueAmount}
                  onChange={(e) => setPayDueAmount(e.target.value)}
                  className="text-xs font-mono h-9"
                  dir="ltr"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold mb-1 block">حساب الخصم (البنك أو المحفظة)</Label>
                <Select value={payDueAccountId} onValueChange={setPayDueAccountId}>
                  <SelectTrigger className="text-xs h-9">
                    <SelectValue placeholder="اختر حساب الخصم للسداد..." />
                  </SelectTrigger>
                  <SelectContent>
                    {liquidAccounts.map((acc) => (
                      <SelectItem key={acc.id} value={String(acc.id)}>
                        {acc.name} ({formatMoney(acc.baseValue ?? acc.balance, acc.currency, 0)})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-semibold mb-1 block">البيان / ملاحظة القيد</Label>
                <Input
                  value={payDueMemo}
                  onChange={(e) => setPayDueMemo(e.target.value)}
                  className="text-xs h-9"
                />
              </div>

              {/* Real-time Advisor Widget */}
              <TransactionAdvisorWidget
                type="credit_card"
                amount={parseFloat(payDueAmount) || 0}
                creditCardId={selectedCardForPayment.id}
                currency={selectedCardForPayment.currency}
              />
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setPayDueModalOpen(false)}
              className="text-xs h-9"
            >
              إلغاء
            </Button>
            <Button
              disabled={isSubmittingPayment}
              onClick={handlePayDue}
              className="text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white h-9 px-4"
            >
              {isSubmittingPayment ? "جارٍ السداد..." : "تأكيد السداد وتحديث الحد"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
export default CreditCardsHub;
