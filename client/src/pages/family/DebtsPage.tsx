import React, { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  DashboardLayout,
  PageHeader,
  InlineError,
  money,
  textError,
  useFamilyPermissions,
} from "./familyShared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import CreditCardsHub from "@/components/banking/CreditCardsHub";
import { CreditCard, ArrowUpRight, Building2, Calendar, Loader2, Percent } from "lucide-react";

export const debtTypeLabel: Record<string, string> = {
  loan: "قرض",
  credit_card: "بطاقة ائتمان",
  mortgage: "تمويل عقاري",
  personal: "دين شخصي",
  other: "أخرى",
};

export function DebtsPage({ embedded = false }: { embedded?: boolean }) {
  const utils = trpc.useUtils();
  const access = useFamilyPermissions();
  const debts = trpc.family.debts.list.useQuery();
  const accounts = trpc.family.accounts.list.useQuery();
  const categories = trpc.family.cashFlow.categories.useQuery();

  const [name, setName] = useState("");
  const [lender, setLender] = useState("");
  const [debtType, setDebtType] = useState<"loan" | "credit_card" | "mortgage" | "personal" | "other">("loan");
  const [principal, setPrincipal] = useState("");
  const [currency, setCurrency] = useState("EGP");
  const [rate, setRate] = useState("0");
  const [minimumPayment, setMinimumPayment] = useState("");
  const [paymentDay, setPaymentDay] = useState("");
  const [startDate, setStartDate] = useState("");
  const [maturityDate, setMaturityDate] = useState("");
  const [fundingAccountId, setFundingAccountId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [memo, setMemo] = useState("");

  const [paymentDebtId, setPaymentDebtId] = useState("");
  const [paymentAccountId, setPaymentAccountId] = useState("");
  const [paymentPrincipal, setPaymentPrincipal] = useState("");
  const [paymentInterest, setPaymentInterest] = useState("0");
  const [paymentFee, setPaymentFee] = useState("0");
  const [paymentMemo, setPaymentMemo] = useState("");

  const [projectionDebtId, setProjectionDebtId] = useState("");
  const [extraPayment, setExtraPayment] = useState("");

  const projectionInput = useMemo(
    () => (projectionDebtId ? { debtId: Number(projectionDebtId), horizonMonths: 120, extraPrincipal: extraPayment || undefined } : undefined),
    [projectionDebtId, extraPayment]
  );
  const projection = trpc.family.debts.projection.useQuery(projectionInput!, { enabled: Boolean(projectionInput) });

  const create = trpc.family.debts.create.useMutation({
    onSuccess: () => {
      toast.success("تم إنشاء الالتزام وقيد رصيده الافتتاحي في دفتر الأستاذ.");
      setName("");
      setLender("");
      setPrincipal("");
      setMinimumPayment("");
      setMemo("");
      void utils.family.debts.list.invalidate();
      void utils.family.dashboard.invalidate();
      void utils.family.accounts.list.invalidate();
      void utils.family.emergencyFund.summary.invalidate();
      void utils.family.cashFlow.summary.invalidate();
    },
    onError: error => toast.error(textError(error)),
  });

  const postPayment = trpc.family.debts.postPayment.useMutation({
    onSuccess: () => {
      toast.success("تم ترحيل سداد الدين: أصل وفائدة ورسوم ضمن قيد متوازن.");
      setPaymentPrincipal("");
      setPaymentInterest("0");
      setPaymentFee("0");
      setPaymentMemo("");
      setPaymentDebtId("");
      void utils.family.debts.list.invalidate();
      void utils.family.dashboard.invalidate();
      void utils.family.accounts.list.invalidate();
      void utils.family.ledger.recent.invalidate();
      void utils.family.emergencyFund.summary.invalidate();
      void utils.family.cashFlow.summary.invalidate();
    },
    onError: error => toast.error(textError(error)),
  });

  const cashAccounts = (accounts.data ?? []).filter(account => ["cash", "bank", "brokerage", "wallet"].includes(account.accountType));
  const expenseCategories = (categories.data ?? []).filter(category => category.direction === "expense");
  const selectedDebt = debts.data?.find(debt => String(debt.id) === paymentDebtId);

  const createDebt = (event: React.FormEvent) => {
    event.preventDefault();
    if (!startDate) return toast.error("حدد تاريخ بداية الالتزام.");
    create.mutate({
      name,
      lender: lender || null,
      debtType,
      originalPrincipal: principal,
      currency,
      annualInterestRate: rate,
      minimumPayment,
      paymentDay: paymentDay ? Number(paymentDay) : null,
      startDate: Date.parse(`${startDate}T00:00:00.000Z`),
      maturityDate: maturityDate ? Date.parse(`${maturityDate}T00:00:00.000Z`) : null,
      cashAccountId: fundingAccountId ? Number(fundingAccountId) : null,
      cashFlowCategoryId: categoryId ? Number(categoryId) : null,
      memo: memo || null,
      idempotencyKey: crypto.randomUUID(),
    });
  };

  const submitPayment = (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedDebt || !paymentAccountId) return toast.error("اختر الدين وحساب السداد.");
    postPayment.mutate({
      debtId: selectedDebt.id,
      cashAccountId: Number(paymentAccountId),
      principalAmount: paymentPrincipal,
      interestAmount: paymentInterest || null,
      feeAmount: paymentFee || null,
      occurredAt: Date.now(),
      memo: paymentMemo || null,
      idempotencyKey: crypto.randomUUID(),
    });
  };

  const activeDebts = useMemo(() => (debts.data ?? []).filter(d => d.status === "active"), [debts.data]);

  const primaryCurrency = useMemo(() => {
    return activeDebts[0]?.currency || "EGP";
  }, [activeDebts]);

  const totalOutstanding = useMemo(() => {
    return activeDebts.reduce((sum, d) => sum + Number(d.baseOutstanding ?? d.outstanding ?? 0), 0);
  }, [activeDebts]);

  const totalMonthlyPayment = useMemo(() => {
    return activeDebts.reduce((sum, d) => sum + Number(d.minimumPayment || 0), 0);
  }, [activeDebts]);

  const nextDuePaymentInfo = useMemo(() => {
    if (!activeDebts.length) return "لا يوجد";
    const debtsWithDay = activeDebts.filter(d => typeof d.paymentDay === "number" && d.paymentDay > 0);
    if (!debtsWithDay.length) {
      const withMaturity = activeDebts.filter(d => d.maturityDate && d.maturityDate > Date.now());
      if (withMaturity.length) {
        withMaturity.sort((a, b) => a.maturityDate! - b.maturityDate!);
        return new Intl.DateTimeFormat("ar-EG", { month: "short", day: "numeric" }).format(new Date(withMaturity[0].maturityDate!));
      }
      return "غير محدد";
    }
    const today = new Date();
    const currentDay = today.getUTCDate();
    const upcomingThisMonth = debtsWithDay
      .map(d => d.paymentDay!)
      .filter(d => d >= currentDay)
      .sort((a, b) => a - b);
    if (upcomingThisMonth.length) {
      return `يوم ${upcomingThisMonth[0]} من الشهر`;
    }
    const allDays = debtsWithDay.map(d => d.paymentDay!).sort((a, b) => a - b);
    return `يوم ${allDays[0]} من الشهر القادم`;
  }, [activeDebts]);

  const inputClass =
    "bg-white dark:bg-[#0E1420] border border-slate-300 dark:border-slate-700/80 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-xl font-medium text-xs py-2.5 px-3 focus:outline-hidden focus:border-slate-800 dark:focus:border-slate-400 focus:ring-1 focus:ring-slate-800 dark:focus:ring-slate-400 transition-all h-auto";

  const content = (
    <div dir="rtl" className="mx-auto max-w-7xl space-y-6">
        <PageHeader
          title="الديون والالتزامات"
          description="الرصيد المستحق معروض من الحساب الالتزامي المقيد، لا من حقل قابل للتعديل. يحسب النموذج جدول التكلفة من معدل الفائدة والقسط المدخلين، ولا يقارن بعوائد استثمارية مفترضة."
          breadcrumbs={[
            { label: "النقد والالتزامات", href: "/debts" },
            { label: "الديون والالتزامات" },
          ]}
          badge={{ text: "إدارة الالتزامات", variant: "institutional" }}
          icon={CreditCard}
        />

        <Tabs defaultValue="credit_cards" className="w-full">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 mb-6">
            <TabsList className="bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl">
              <TabsTrigger value="credit_cards" className="rounded-lg text-xs font-bold gap-2 px-4 py-2 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:shadow-2xs">
                <CreditCard className="size-3.5 text-rose-500" />
                كروت المشتريات والتقسيط 0%
              </TabsTrigger>
              <TabsTrigger value="loans" className="rounded-lg text-xs font-bold gap-2 px-4 py-2 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:shadow-2xs">
                <Building2 className="size-3.5 text-slate-500" />
                القروض والالتزامات العامة
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="credit_cards" className="m-0 space-y-6">
            <CreditCardsHub />
          </TabsContent>

          <TabsContent value="loans" className="m-0 space-y-6">
            {/* Top Executive Asymmetric Metric Strip (With Semantic Tints) */}
            <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 bg-white dark:bg-[#0B0F17] border border-slate-200/90 dark:border-slate-800/80 rounded-2xl shadow-xs overflow-hidden mb-6">
          {/* Cell 1 (إجمالي الالتزامات القائمة - Total Principal Remaining) */}
          <div className="bg-slate-50/50 dark:bg-slate-900/30 p-5 flex flex-col justify-between border-b sm:border-b-0 lg:border-b-0 lg:border-l border-slate-200/80 dark:border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-slate-600 dark:text-slate-400 font-semibold text-xs flex items-center gap-2">
                إجمالي الالتزامات القائمة
              </span>
              <div className="size-8 rounded-xl bg-rose-50 text-rose-600 border border-rose-200/80 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800/60 flex items-center justify-center">
                <CreditCard className="size-4" />
              </div>
            </div>
            <div className="mt-2 mb-1">
              <strong className="text-slate-900 dark:text-white font-extrabold font-mono text-2xl lg:text-3xl tabular-nums tracking-tight block">
                {debts.isLoading ? <Skeleton className="h-8 w-28" /> : money(String(totalOutstanding), primaryCurrency)}
              </strong>
            </div>
            <span className="text-slate-400 dark:text-slate-500 text-[11px] font-medium block">
              أصل الدين المتبقي غير المسدد
            </span>
          </div>

          {/* Cell 2 (خدمة الدين والأقساط الشهرية - Monthly Debt Service) */}
          <div className="p-5 flex flex-col justify-between border-b sm:border-b-0 lg:border-b-0 lg:border-l border-slate-200/80 dark:border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-slate-600 dark:text-slate-400 font-semibold text-xs flex items-center gap-2">
                خدمة الدين والأقساط الشهرية
              </span>
              <div className="size-8 rounded-xl bg-amber-50 text-amber-600 border border-amber-200/80 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800/60 flex items-center justify-center">
                <ArrowUpRight className="size-4" />
              </div>
            </div>
            <div className="mt-2 mb-1">
              <strong className="text-slate-900 dark:text-white font-bold font-mono text-xl sm:text-2xl tabular-nums block">
                {debts.isLoading ? <Skeleton className="h-8 w-28" /> : money(String(totalMonthlyPayment), primaryCurrency)}
              </strong>
            </div>
            <span className="text-slate-400 dark:text-slate-500 text-[11px] font-medium block">
              إجمالي الأقساط المستحقة شهرياً
            </span>
          </div>

          {/* Cell 3 (الالتزامات النشطة - Active Liabilities) */}
          <div className="p-5 flex flex-col justify-between border-b sm:border-b-0 lg:border-b-0 lg:border-l border-slate-200/80 dark:border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-slate-600 dark:text-slate-400 font-semibold text-xs flex items-center gap-2">
                الالتزامات النشطة
              </span>
              <div className="size-8 rounded-xl bg-sky-50 text-sky-600 border border-sky-200/80 dark:bg-sky-950/40 dark:text-sky-400 dark:border-sky-800/60 flex items-center justify-center">
                <Building2 className="size-4" />
              </div>
            </div>
            <div className="mt-2 mb-1">
              <strong className="text-slate-900 dark:text-white font-bold font-mono text-xl sm:text-2xl tabular-nums block">
                {debts.isLoading ? <Skeleton className="h-8 w-12" /> : activeDebts.length}
              </strong>
            </div>
            <span className="text-slate-400 dark:text-slate-500 text-[11px] font-medium block">
              قروض وبطاقات ائتمانية مفعلة
            </span>
          </div>

          {/* Cell 4 (أقرب استحقاق قادم - Next Due Payment) */}
          <div className="p-5 flex flex-col justify-between border-b-0 lg:border-l-0">
            <div className="flex items-center justify-between">
              <span className="text-slate-600 dark:text-slate-400 font-semibold text-xs flex items-center gap-2">
                أقرب استحقاق قادم
              </span>
              <div className="size-8 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-200/80 dark:bg-indigo-950/40 dark:text-indigo-400 dark:border-indigo-800/60 flex items-center justify-center">
                <Calendar className="size-4" />
              </div>
            </div>
            <div className="mt-2 mb-1">
              <strong className="text-slate-900 dark:text-white font-bold text-base sm:text-lg tabular-nums block">
                {debts.isLoading ? <Skeleton className="h-8 w-24" /> : nextDuePaymentInfo}
              </strong>
            </div>
            <span className="text-slate-400 dark:text-slate-500 text-[11px] font-medium block">
              الموعد المحدد لسداد الدفعة التالية
            </span>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[.9fr_1.1fr]">
          {/* Card 1: إضافة دين أو بطاقة */}
          <div className="bg-white dark:bg-[#0B0F17] border border-slate-200/90 dark:border-slate-800/80 rounded-2xl p-6 shadow-xs">
            <div className="mb-5">
              <h3 className="text-slate-900 dark:text-white font-bold text-base mb-1">إضافة دين أو بطاقة</h3>
              <p className="text-slate-500 dark:text-slate-400 text-xs">
                إن كان الدين قائمًا قبل استخدام FAMILY، اترك حساب صرف القيمة فارغًا ليُسجل كرصد افتتاحي مقابل حقوق الملكية. إذا صُرفت قيمته الآن، اختر الحساب الذي استلمها.
              </p>
            </div>

            <form onSubmit={createDebt} className="grid gap-4">
              <div>
                <Label htmlFor="debt-name" className="text-slate-700 dark:text-slate-300 font-semibold text-xs mb-1.5 block">
                  الاسم
                </Label>
                <Input
                  id="debt-name"
                  value={name}
                  onChange={event => setName(event.target.value)}
                  disabled={!access.canEdit}
                  placeholder="مثال: تمويل شخصي أو بطاقة ائتمان"
                  required
                  className={inputClass}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="debt-lender" className="text-slate-700 dark:text-slate-300 font-semibold text-xs mb-1.5 block">
                    المقرض / الجهة
                  </Label>
                  <Input
                    id="debt-lender"
                    value={lender}
                    onChange={event => setLender(event.target.value)}
                    disabled={!access.canEdit}
                    placeholder="مثال: مصرف الراجحي"
                    className={inputClass}
                  />
                </div>
                <div>
                  <Label className="text-slate-700 dark:text-slate-300 font-semibold text-xs mb-1.5 block">
                    النوع
                  </Label>
                  <Select value={debtType} onValueChange={value => setDebtType(value as typeof debtType)} disabled={!access.canEdit}>
                    <SelectTrigger className={inputClass}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(debtTypeLabel).map(([value, label]) => (
                        <SelectItem key={value} value={value}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="debt-principal" className="text-slate-700 dark:text-slate-300 font-semibold text-xs mb-1.5 block">
                    الأصل
                  </Label>
                  <Input
                    id="debt-principal"
                    value={principal}
                    onChange={event => setPrincipal(event.target.value)}
                    inputMode="decimal"
                    disabled={!access.canEdit}
                    placeholder="0.00"
                    required
                    className={inputClass}
                  />
                </div>
                <div>
                  <Label htmlFor="debt-currency" className="text-slate-700 dark:text-slate-300 font-semibold text-xs mb-1.5 block">
                    العملة
                  </Label>
                  <Input
                    id="debt-currency"
                    value={currency}
                    onChange={event => setCurrency(event.target.value.toUpperCase())}
                    maxLength={3}
                    disabled={!access.canEdit}
                    required
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <Label htmlFor="debt-rate" className="text-slate-700 dark:text-slate-300 font-semibold text-xs mb-1.5 block">
                    فائدة سنوية %
                  </Label>
                  <Input
                    id="debt-rate"
                    value={rate}
                    onChange={event => setRate(event.target.value)}
                    inputMode="decimal"
                    disabled={!access.canEdit}
                    placeholder="0.0"
                    required
                    className={inputClass}
                  />
                </div>
                <div>
                  <Label htmlFor="debt-minimum" className="text-slate-700 dark:text-slate-300 font-semibold text-xs mb-1.5 block">
                    القسط الأدنى
                  </Label>
                  <Input
                    id="debt-minimum"
                    value={minimumPayment}
                    onChange={event => setMinimumPayment(event.target.value)}
                    inputMode="decimal"
                    disabled={!access.canEdit}
                    placeholder="0.00"
                    required
                    className={inputClass}
                  />
                </div>
                <div>
                  <Label htmlFor="debt-day" className="text-slate-700 dark:text-slate-300 font-semibold text-xs mb-1.5 block">
                    يوم الاستحقاق
                  </Label>
                  <Input
                    id="debt-day"
                    value={paymentDay}
                    onChange={event => setPaymentDay(event.target.value)}
                    inputMode="numeric"
                    min="1"
                    max="31"
                    placeholder="1–31"
                    disabled={!access.canEdit}
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="debt-start" className="text-slate-700 dark:text-slate-300 font-semibold text-xs mb-1.5 block">
                    تاريخ البداية
                  </Label>
                  <Input
                    id="debt-start"
                    type="date"
                    value={startDate}
                    onChange={event => setStartDate(event.target.value)}
                    disabled={!access.canEdit}
                    required
                    className={inputClass}
                  />
                </div>
                <div>
                  <Label htmlFor="debt-maturity" className="text-slate-700 dark:text-slate-300 font-semibold text-xs mb-1.5 block">
                    الاستحقاق النهائي
                  </Label>
                  <Input
                    id="debt-maturity"
                    type="date"
                    value={maturityDate}
                    onChange={event => setMaturityDate(event.target.value)}
                    disabled={!access.canEdit}
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label className="text-slate-700 dark:text-slate-300 font-semibold text-xs mb-1.5 block">
                    حساب صرف قيمة الدين
                  </Label>
                  <Select value={fundingAccountId || undefined} onValueChange={setFundingAccountId} disabled={!access.canEdit}>
                    <SelectTrigger className={inputClass}>
                      <SelectValue placeholder="اختياري لدين قائم سابق" />
                    </SelectTrigger>
                    <SelectContent>
                      {cashAccounts.map(account => (
                        <SelectItem value={String(account.id)} key={account.id}>
                          {account.name} — {account.currency}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-slate-700 dark:text-slate-300 font-semibold text-xs mb-1.5 block">
                    فئة خدمة الدين
                  </Label>
                  <Select value={categoryId || undefined} onValueChange={setCategoryId} disabled={!access.canEdit}>
                    <SelectTrigger className={inputClass}>
                      <SelectValue placeholder="اختياري؛ فئة مصروف" />
                    </SelectTrigger>
                    <SelectContent>
                      {expenseCategories.map(category => (
                        <SelectItem value={String(category.id)} key={category.id}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="debt-memo" className="text-slate-700 dark:text-slate-300 font-semibold text-xs mb-1.5 block">
                  مذكرة
                </Label>
                <Textarea
                  id="debt-memo"
                  value={memo}
                  onChange={event => setMemo(event.target.value)}
                  disabled={!access.canEdit}
                  maxLength={2000}
                  placeholder="ملاحظات وشروط إضافية"
                  className={`${inputClass} resize-none`}
                />
              </div>

              <Button
                type="submit"
                disabled={create.isPending || !access.canEdit}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm py-3 px-6 rounded-xl shadow-sm transition-all dark:bg-white dark:hover:bg-slate-100 dark:text-slate-950 border border-slate-900 dark:border-transparent mt-4 h-auto"
              >
                {create.isPending && <Loader2 className="ml-2 size-4 animate-spin" />}
                {access.canEdit ? "تسجيل الالتزام" : "تتطلب صلاحية محرر"}
              </Button>
            </form>
          </div>

          {/* Card 2: الرصيد والجدولة */}
          <div className="bg-white dark:bg-[#0B0F17] border border-slate-200/90 dark:border-slate-800/80 rounded-2xl p-6 shadow-xs flex flex-col justify-between">
            <div>
              <div className="mb-5">
                <h3 className="text-slate-900 dark:text-white font-bold text-base mb-1">الرصيد والجدولة</h3>
                <p className="text-slate-500 dark:text-slate-400 text-xs">
                  ينشأ سداد فعلي فقط عبر نموذج السداد أدناه. هذه القائمة لا تتيح تعديل الرصيد يدويًا.
                </p>
              </div>

              {debts.isLoading ? (
                <Skeleton className="h-96 rounded-xl" />
              ) : debts.error ? (
                <InlineError message={textError(debts.error)} />
              ) : debts.data?.length ? (
                <div className="overflow-x-auto rounded-xl border border-slate-200/80 dark:border-slate-800">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-100/80 dark:bg-[#0E1420] text-slate-800 dark:text-slate-200 font-bold text-xs border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="py-3 px-4">الالتزام</th>
                        <th className="py-3 px-4">النوع / الحالة</th>
                        <th className="py-3 px-4 font-mono">المستحق</th>
                        <th className="py-3 px-4 font-mono">القسط الأدنى</th>
                        <th className="py-3 px-4 font-mono">الفائدة</th>
                        <th className="py-3 px-4 text-center">الإجراءات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 bg-white dark:bg-[#0B0F17]">
                      {debts.data.map(debt => (
                        <tr key={debt.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                          <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white">
                            <div>{debt.name}</div>
                            {debt.lender && <div className="text-[11px] text-slate-400 font-normal">{debt.lender}</div>}
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <Badge
                                variant="outline"
                                className={
                                  debt.status === "active"
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800 text-[10px]"
                                    : debt.status === "paid"
                                      ? "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-400 dark:border-sky-800 text-[10px]"
                                      : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 text-[10px]"
                                }
                              >
                                {debt.status === "active" ? "نشط" : debt.status === "paid" ? "مسدد" : "مؤرشف"}
                              </Badge>
                              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                                {debtTypeLabel[debt.debtType]}
                              </span>
                            </div>
                          </td>
                          <td className="py-3.5 px-4 font-mono font-bold tabular-nums text-slate-900 dark:text-white">
                            <div>{money(debt.outstanding, debt.currency)}</div>
                            {debt.baseOutstanding && debt.currency !== "EGP" ? (
                              <div className="text-[10px] text-slate-400 font-normal">{money(debt.baseOutstanding, "EGP")}</div>
                            ) : null}
                          </td>
                          <td className="py-3.5 px-4 font-mono font-bold tabular-nums text-slate-900 dark:text-white">
                            <div>{money(debt.minimumPayment, debt.currency)}</div>
                            {debt.paymentDay ? (
                              <div className="text-[10px] text-slate-400 font-normal font-sans">يوم {debt.paymentDay}</div>
                            ) : null}
                          </td>
                          <td className="py-3.5 px-4 font-mono font-bold tabular-nums text-slate-900 dark:text-white">
                            {debt.annualInterestRate}%
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              {debt.status === "active" && access.canEdit && (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setPaymentDebtId(String(debt.id));
                                    setPaymentPrincipal("");
                                    setPaymentInterest("0");
                                    setPaymentFee("0");
                                  }}
                                  className="rounded-xl text-xs font-semibold bg-white hover:bg-slate-50 text-slate-900 dark:bg-[#0E1420] dark:hover:bg-slate-800 dark:text-white border border-slate-200 dark:border-slate-700 shadow-2xs h-8 px-3"
                                >
                                  سداد
                                </Button>
                              )}
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={() => setProjectionDebtId(String(debt.id))}
                                className="rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800 h-8 px-3"
                              >
                                الجدول
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-10 px-4">
                  <div className="size-12 rounded-2xl bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 flex items-center justify-center mx-auto mb-3 border border-slate-200/60 dark:border-slate-700/60">
                    <CreditCard className="size-6" />
                  </div>
                  <h4 className="text-slate-900 dark:text-white font-bold text-sm mb-1">
                    لا توجد التزامات مسجلة
                  </h4>
                  <p className="text-slate-500 dark:text-slate-400 text-xs max-w-sm mx-auto">
                    أضف قرضًا أو بطاقة ائتمان. لن يظهر أي رصيد دين في تقارير FAMILY قبل تسجيله بقيد افتتاحي أو صرف فعلي معتمد.
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Modal / Card: ترحيل سداد الدين */}
        {paymentDebtId && (
          <div className="bg-white dark:bg-[#0B0F17] border border-slate-200/90 dark:border-slate-800/80 rounded-2xl p-6 shadow-xs">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h3 className="text-slate-900 dark:text-white font-bold text-base mb-1">ترحيل سداد الدين</h3>
                <p className="text-slate-500 dark:text-slate-400 text-xs">
                  أدخل فقط مبلغ الأصل المسدد والفائدة والرسوم الفعلية. يمنع النظام السداد فوق رصيد الأصل القائم أو السحب فوق رصيد الحساب.
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setPaymentDebtId("")}
                className="text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white text-xs"
              >
                إلغاء
              </Button>
            </div>
            <form onSubmit={submitPayment} className="grid gap-4 md:grid-cols-4">
              <div>
                <Label className="text-slate-700 dark:text-slate-300 font-semibold text-xs mb-1.5 block">الالتزام</Label>
                <Select value={paymentDebtId} onValueChange={setPaymentDebtId} disabled={!access.canEdit}>
                  <SelectTrigger className={inputClass}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {debts.data?.filter(debt => debt.status === "active").map(debt => (
                      <SelectItem key={debt.id} value={String(debt.id)}>{debt.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-slate-700 dark:text-slate-300 font-semibold text-xs mb-1.5 block">حساب السداد</Label>
                <Select value={paymentAccountId || undefined} onValueChange={setPaymentAccountId} disabled={!access.canEdit}>
                  <SelectTrigger className={inputClass}><SelectValue placeholder="حساب السداد" /></SelectTrigger>
                  <SelectContent>
                    {cashAccounts.filter(account => account.currency === selectedDebt?.currency).map(account => (
                      <SelectItem value={String(account.id)} key={account.id}>{account.name} — {account.currency}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-slate-700 dark:text-slate-300 font-semibold text-xs mb-1.5 block">الأصل</Label>
                <Input
                  value={paymentPrincipal}
                  onChange={event => setPaymentPrincipal(event.target.value)}
                  disabled={!access.canEdit}
                  inputMode="decimal"
                  placeholder="الأصل"
                  required
                  className={inputClass}
                />
              </div>
              <div>
                <Label className="text-slate-700 dark:text-slate-300 font-semibold text-xs mb-1.5 block">الفائدة</Label>
                <Input
                  value={paymentInterest}
                  onChange={event => setPaymentInterest(event.target.value)}
                  disabled={!access.canEdit}
                  inputMode="decimal"
                  placeholder="الفائدة"
                  className={inputClass}
                />
              </div>
              <div>
                <Label className="text-slate-700 dark:text-slate-300 font-semibold text-xs mb-1.5 block">الرسوم</Label>
                <Input
                  value={paymentFee}
                  onChange={event => setPaymentFee(event.target.value)}
                  disabled={!access.canEdit}
                  inputMode="decimal"
                  placeholder="الرسوم"
                  className={inputClass}
                />
              </div>
              <div className="md:col-span-2">
                <Label className="text-slate-700 dark:text-slate-300 font-semibold text-xs mb-1.5 block">مذكرة</Label>
                <Textarea
                  value={paymentMemo}
                  onChange={event => setPaymentMemo(event.target.value)}
                  disabled={!access.canEdit}
                  placeholder="مذكرة اختيارية"
                  className={`${inputClass} resize-none`}
                />
              </div>
              <div className="flex items-end">
                <Button
                  type="submit"
                  disabled={postPayment.isPending || !access.canEdit}
                  className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm py-2.5 px-6 rounded-xl shadow-sm transition-all dark:bg-white dark:hover:bg-slate-100 dark:text-slate-950 border border-slate-900 dark:border-transparent h-auto"
                >
                  {postPayment.isPending && <Loader2 className="ml-2 size-4 animate-spin" />}
                  ترحيل السداد
                </Button>
              </div>
            </form>
          </div>
        )}

        {/* Card: جدول تكلفة الدين */}
        {projectionDebtId && (
          <div className="bg-white dark:bg-[#0B0F17] border border-slate-200/90 dark:border-slate-800/80 rounded-2xl p-6 shadow-xs">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h3 className="text-slate-900 dark:text-white font-bold text-base mb-1">جدول تكلفة الدين</h3>
                <p className="text-slate-500 dark:text-slate-400 text-xs">
                  حساب تعاقدي حتى 120 شهرًا وفق الرصيد والفائدة والقسط الحاليين. السداد الإضافي أدناه يقارن تكلفة الدين فقط.
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setProjectionDebtId("")}
                className="text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white text-xs"
              >
                إغلاق
              </Button>
            </div>
            <div className="mb-5 flex max-w-sm gap-2">
              <Input
                value={extraPayment}
                onChange={event => setExtraPayment(event.target.value)}
                inputMode="decimal"
                placeholder="سداد إضافي شهري اختياري"
                className={inputClass}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => void projection.refetch()}
                className="rounded-xl text-xs font-semibold bg-white hover:bg-slate-50 text-slate-900 dark:bg-[#0E1420] dark:hover:bg-slate-800 dark:text-white border border-slate-200 dark:border-slate-700 h-auto py-2.5 px-4 shadow-2xs"
              >
                حساب
              </Button>
            </div>
            {projection.isLoading ? (
              <Skeleton className="h-32 rounded-xl" />
            ) : projection.error ? (
              <InlineError message={textError(projection.error)} />
            ) : projection.data ? (
              <div className="grid gap-3 sm:grid-cols-4">
                <div className="rounded-xl bg-slate-50 dark:bg-slate-900/40 p-4 border border-slate-100 dark:border-slate-800/80">
                  <p className="text-xs text-slate-500 dark:text-slate-400">إجمالي الفائدة المعروضة</p>
                  <p className="mt-1 font-mono font-bold text-base text-slate-900 dark:text-white tabular-nums">
                    {money(projection.data.schedule.totalInterest, projection.data.currency)}
                  </p>
                </div>
                <div className="rounded-xl bg-slate-50 dark:bg-slate-900/40 p-4 border border-slate-100 dark:border-slate-800/80">
                  <p className="text-xs text-slate-500 dark:text-slate-400">الرصيد بعد الأفق</p>
                  <p className="mt-1 font-mono font-bold text-base text-slate-900 dark:text-white tabular-nums">
                    {money(projection.data.schedule.endingBalance, projection.data.currency)}
                  </p>
                </div>
                <div className="rounded-xl bg-slate-50 dark:bg-slate-900/40 p-4 border border-slate-100 dark:border-slate-800/80">
                  <p className="text-xs text-slate-500 dark:text-slate-400">إهلاك سلبي</p>
                  <p className="mt-1 font-semibold text-sm text-slate-900 dark:text-white">
                    {projection.data.schedule.negativeAmortization ? "القسط لا يغطي الفائدة" : "لا"}
                  </p>
                </div>
                {projection.data.comparison && (
                  <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/30 p-4 border border-emerald-200/80 dark:border-emerald-800/60">
                    <p className="text-xs text-emerald-700 dark:text-emerald-400">أثر السداد الإضافي</p>
                    <p className="mt-1 font-bold text-sm text-emerald-800 dark:text-emerald-300">
                      يوفر {money(projection.data.comparison.interestSaved, projection.data.currency)} و{projection.data.comparison.monthsSaved} شهرًا
                    </p>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        )}
          </TabsContent>
        </Tabs>
      </div>
  );

  if (embedded) return content;
  return <DashboardLayout>{content}</DashboardLayout>;
}

export default DebtsPage;
