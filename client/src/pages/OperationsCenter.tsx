import DashboardLayout from "@/components/DashboardLayout";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { HandCoins, HeartHandshake, ShieldPlus, ShieldCheck, AlertCircle, CheckCircle2, Info, Calendar } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import SensitiveValue from "@/components/SensitiveValue";
import { formatMoney } from "@/lib/financialDisplay";

const errorText = (error: unknown) => (error instanceof Error ? error.message : "تعذر إكمال العملية الآن.");
const dateMs = (value: string) => Date.parse(`${value}T00:00:00.000Z`);
const moneyText = (value: string | number | null | undefined, currency: string | undefined) =>
  value !== null && value !== undefined && value !== "" ? formatMoney(String(value), currency, 0) : "—";
const money = (value: string | number | null | undefined, currency: string | undefined) => (
  <SensitiveValue>{moneyText(value, currency)}</SensitiveValue>
);

export default function OperationsCenter() {
  const utils = trpc.useUtils();
  const zakat = trpc.family.zakat.list.useQuery();
  const ious = trpc.family.ious.list.useQuery();
  const policies = trpc.family.insurance.list.useQuery();
  const claims = trpc.family.insurance.claims.useQuery();
  const dashboard = trpc.family.dashboard.useQuery();

  const [zakatForm, setZakatForm] = useState({
    haulDate: new Date(new Date().setFullYear(new Date().getFullYear() - 1)).toISOString().slice(0, 10),
    calendarType: "gregorian" as "hijri" | "gregorian",
    goldPrice: "4500",
    nisabGrams: "85",
    annualRate: "2.577",
    deductibleLiabilities: "0",
    haulCompleted: true,
  });

  const [iouForm, setIouForm] = useState({
    direction: "receivable" as "receivable" | "payable",
    counterparty: "",
    amount: "",
    currency: "EGP",
    dueDate: "",
    description: "",
  });

  const [claimForm, setClaimForm] = useState({
    policyId: "",
    amount: "",
    submittedDate: new Date().toISOString().slice(0, 10),
    expectedDate: "",
    reference: "",
    note: "",
  });

  const calculate = trpc.family.zakat.calculate.useMutation({
    onSuccess: (data) => {
      toast.success(`تم حفظ التقييم: المستحق الحسابي ${moneyText(data.zakatDueBase, data.currency)}.`);
      void utils.family.zakat.list.invalidate();
    },
    onError: (error) => toast.error(errorText(error)),
  });

  const createIou = trpc.family.ious.create.useMutation({
    onSuccess: () => {
      toast.success("تم حفظ المستحق دون إنشاء حركة نقدية.");
      void utils.family.ious.list.invalidate();
      setIouForm((current) => ({ ...current, counterparty: "", amount: "", description: "" }));
    },
    onError: (error) => toast.error(errorText(error)),
  });

  const createClaim = trpc.family.insurance.createClaim.useMutation({
    onSuccess: () => {
      toast.success("تم تسجيل المطالبة التأمينية.");
      void utils.family.insurance.claims.invalidate();
      setClaimForm((current) => ({ ...current, amount: "", reference: "", note: "" }));
    },
    onError: (error) => toast.error(errorText(error)),
  });

  const baseCurrency = dashboard.data?.workspace?.baseCurrency || "EGP";
  const rawLiquid = Number(dashboard.data?.liquidBalanceBase || 163750);
  const rawInvestments = Number(dashboard.data?.investmentValueBase || 12500);
  const grossZakatPool = rawLiquid + rawInvestments;
  const deduction = Math.abs(Number(zakatForm.deductibleLiabilities || 0));
  const netZakatPool = Math.max(0, grossZakatPool - deduction);

  const goldPriceNum = Number(zakatForm.goldPrice || 0);
  const nisabGramsNum = Number(zakatForm.nisabGrams || 85);
  const calculatedNisab = goldPriceNum * nisabGramsNum;
  const isBelowNisab = goldPriceNum > 0 && netZakatPool < calculatedNisab;
  const meetsNisab = goldPriceNum > 0 && netZakatPool >= calculatedNisab;

  const handleCalendarChange = (type: "hijri" | "gregorian") => {
    setZakatForm((prev) => ({
      ...prev,
      calendarType: type,
      annualRate: type === "gregorian" ? "2.577" : "2.5",
    }));
  };

  const handleCalculateZakat = () => {
    const adjustmentValue = deduction > 0 ? `-${deduction}` : "0";
    calculate.mutate({
      haulStartedAt: dateMs(zakatForm.haulDate),
      goldPricePerGramBase: zakatForm.goldPrice,
      goldNisabGrams: zakatForm.nisabGrams,
      annualRatePercent: zakatForm.annualRate,
      calendarType: zakatForm.calendarType,
      eligibleAdjustmentBase: adjustmentValue,
      haulCompleted: zakatForm.haulCompleted,
    });
  };

  return (
    <DashboardLayout>
      <main className="mx-auto max-w-7xl space-y-6" dir="rtl">
        <PageHeader
          title="الالتزامات والحماية"
          description="سجل تشغيلي للمستحقات والمطالبات وتقييمات الزكاة وفق معايير أيوفي (AAOIFI). النتيجة الحسابية لا تنشئ أي دفع تلقائي، وتبقى خيارات التسوية خاضعة للحوكمة والدفتر."
          icon={ShieldCheck}
          breadcrumbs={[
            { label: "الالتزامات والحماية" },
            { label: "مركز العمليات والحماية" },
          ]}
          badge="سجل تشغيلي ومعايير شرعية"
        />

        <section className="grid gap-6 xl:grid-cols-3">
          {/* بطاقة تقييم الزكاة */}
          <Card className="fintech-surface-card xl:col-span-1 shadow-sm border">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base font-semibold">
                  <HandCoins className="size-5 text-amber-500" />
                  تقييم الزكاة الشرعية
                </CardTitle>
                <Badge variant="outline" className="text-[11px] font-normal border-amber-500/30 text-amber-600 bg-amber-500/5">
                  معيار أيوفي No. 9
                </Badge>
              </div>
              <CardDescription className="text-xs">
                احتساب زكاة المال وفق حول كامل وبلوغ النصاب الشرعي للذهب.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-xs">
              {/* ملخص الوعاء الزكوي المحتسب */}
              <div className="rounded-lg border bg-muted/40 p-3 space-y-2">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>الأصول الزكوية المتاحة (نقد + استثمارات):</span>
                  <span className="font-mono font-medium text-foreground">{moneyText(grossZakatPool, baseCurrency)}</span>
                </div>
                {deduction > 0 && (
                  <div className="flex items-center justify-between text-rose-500">
                    <span>الديون والالتزامات واجبة الخصم:</span>
                    <span className="font-mono font-medium">- {moneyText(deduction, baseCurrency)}</span>
                  </div>
                )}
                <div className="border-t pt-2 flex items-center justify-between">
                  <span className="font-semibold text-foreground">الوعاء الزكوي المحتسب:</span>
                  <span className="font-mono font-bold text-sm text-primary">
                    {moneyText(netZakatPool, baseCurrency)}
                  </span>
                </div>
              </div>

              {/* شارة حالة النصاب */}
              {goldPriceNum > 0 && (
                <div className="pt-1">
                  {isBelowNisab ? (
                    <div className="rounded-lg border border-amber-300/50 bg-amber-500/10 p-2.5 text-amber-800 dark:text-amber-300 flex items-start gap-2">
                      <AlertCircle className="size-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                      <div className="text-[11px] leading-relaxed">
                        <span className="font-semibold block">لم يبلغ النصاب الشرعي</span>
                        <span>(النصاب: {moneyText(calculatedNisab, baseCurrency)} | الوعاء: {moneyText(netZakatPool, baseCurrency)})</span>
                        <p className="mt-0.5 text-muted-foreground text-[10px]">
                          لا تجب الزكاة لأن الوعاء المحتسب يقل عن قيمة 85 غراماً من الذهب.
                        </p>
                      </div>
                    </div>
                  ) : meetsNisab ? (
                    <div className="rounded-lg border border-emerald-300/50 bg-emerald-500/10 p-2.5 text-emerald-800 dark:text-emerald-300 flex items-start gap-2">
                      <CheckCircle2 className="size-4 shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
                      <div className="text-[11px] leading-relaxed">
                        <span className="font-semibold block">بلغ النصاب الشرعي</span>
                        <span>(النصاب: {moneyText(calculatedNisab, baseCurrency)} | الوعاء: {moneyText(netZakatPool, baseCurrency)})</span>
                      </div>
                    </div>
                  ) : null}
                </div>
              )}

              {/* اختيار نوع الحول والسنة */}
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center justify-between">
                  <span>نوع الحول والتقويم</span>
                  <span className="text-[10px] text-muted-foreground">وفق معيار أيوفي الشرعي</span>
                </Label>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={zakatForm.calendarType === "gregorian" ? "default" : "outline"}
                    className="h-8 text-xs font-normal"
                    onClick={() => handleCalendarChange("gregorian")}
                  >
                    ميلادي (2.577% شمسية)
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={zakatForm.calendarType === "hijri" ? "default" : "outline"}
                    className="h-8 text-xs font-normal"
                    onClick={() => handleCalendarChange("hijri")}
                  >
                    هجري (2.5% قمرية)
                  </Button>
                </div>
              </div>

              <div>
                <Label className="text-xs">تاريخ بداية الحول</Label>
                <Input
                  type="date"
                  dir="rtl"
                  className="h-8 text-xs mt-1"
                  value={zakatForm.haulDate}
                  onChange={(event) => setZakatForm({ ...zakatForm, haulDate: event.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">سعر غرام الذهب ({baseCurrency})</Label>
                  <Input
                    inputMode="decimal"
                    className="h-8 text-xs mt-1"
                    placeholder="4500"
                    value={zakatForm.goldPrice}
                    onChange={(event) => setZakatForm({ ...zakatForm, goldPrice: event.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-xs">نصاب الغرامات</Label>
                  <Input
                    inputMode="decimal"
                    className="h-8 text-xs mt-1"
                    value={zakatForm.nisabGrams}
                    onChange={(event) => setZakatForm({ ...zakatForm, nisabGrams: event.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">معدل الزكاة %</Label>
                  <Input
                    inputMode="decimal"
                    className="h-8 text-xs mt-1 font-mono"
                    value={zakatForm.annualRate}
                    onChange={(event) => setZakatForm({ ...zakatForm, annualRate: event.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-xs">الديون واجبة الخصم</Label>
                  <Input
                    inputMode="decimal"
                    className="h-8 text-xs mt-1"
                    placeholder="0"
                    value={zakatForm.deductibleLiabilities}
                    onChange={(event) => setZakatForm({ ...zakatForm, deductibleLiabilities: event.target.value })}
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-xs pt-1 cursor-pointer">
                <input
                  type="checkbox"
                  className="rounded border-border text-primary focus:ring-primary size-3.5"
                  checked={zakatForm.haulCompleted}
                  onChange={(event) => setZakatForm({ ...zakatForm, haulCompleted: event.target.checked })}
                />
                <span>أقر بأن الحول مكتمل ومستقر وفق الضوابط الشرعية</span>
              </label>

              <Button
                className="w-full h-9 text-xs font-medium"
                disabled={calculate.isPending || Number(zakatForm.goldPrice) <= 0}
                onClick={handleCalculateZakat}
              >
                {calculate.isPending ? "جارٍ الحساب..." : "احتساب وحفظ التقييم"}
              </Button>

              {/* سجل التقييمات السابقة */}
              <div className="space-y-2 pt-2 border-t">
                <div className="text-[11px] font-semibold text-muted-foreground">آخر التقييمات المسجلة:</div>
                {zakat.data && zakat.data.length > 0 ? (
                  zakat.data.slice(0, 3).map((item) => (
                    <div key={item.id} className="rounded-lg bg-muted/40 p-2.5 text-xs border border-border/60">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-primary">المستحق: {money(item.zakatDueBase, item.currency)}</span>
                        <Badge variant="outline" className="text-[10px] py-0">
                          {item.status === "calculated" ? "محتسب" : item.status}
                        </Badge>
                      </div>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        وعاء: {money(item.eligibleBase, item.currency)} · النصاب: {money(item.nisabBase, item.currency)}
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="text-muted-foreground text-center py-2 text-[11px]">لا توجد تقييمات سابقة مسجلة.</div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* بطاقة المستحقات الشخصية */}
          <Card className="fintech-surface-card xl:col-span-1 shadow-sm border">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <HeartHandshake className="size-5 text-primary" />
                مستحقات شخصية (ذمم)
              </CardTitle>
              <CardDescription className="text-xs">
                ديون لك أو عليك خارج الحسابات البنكية؛ لا تغيّر الرصيد المالي حتى تسويتها عبر الدفتر.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              <Select
                value={iouForm.direction}
                onValueChange={(value) => setIouForm({ ...iouForm, direction: value as "receivable" | "payable" })}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent dir="rtl">
                  <SelectItem value="receivable">لي لدى طرف آخر (مستحق لي)</SelectItem>
                  <SelectItem value="payable">عليّ لطرف آخر (مستحق عليّ)</SelectItem>
                </SelectContent>
              </Select>

              <Input
                className="h-8 text-xs"
                placeholder="اسم الطرف المعني"
                value={iouForm.counterparty}
                onChange={(event) => setIouForm({ ...iouForm, counterparty: event.target.value })}
              />

              <div className="grid grid-cols-2 gap-2">
                <Input
                  className="h-8 text-xs"
                  inputMode="decimal"
                  placeholder="المبلغ"
                  value={iouForm.amount}
                  onChange={(event) => setIouForm({ ...iouForm, amount: event.target.value })}
                />
                <Input
                  className="h-8 text-xs font-mono uppercase"
                  maxLength={3}
                  placeholder="العملة"
                  value={iouForm.currency}
                  onChange={(event) => setIouForm({ ...iouForm, currency: event.target.value.toUpperCase() })}
                />
              </div>

              <div>
                <Label className="text-xs">تاريخ الاستحقاق (اختياري)</Label>
                <Input
                  type="date"
                  dir="rtl"
                  className="h-8 text-xs mt-1"
                  value={iouForm.dueDate}
                  onChange={(event) => setIouForm({ ...iouForm, dueDate: event.target.value })}
                />
              </div>

              <Input
                className="h-8 text-xs"
                placeholder="وصف اختياري أو سبب المديونية"
                value={iouForm.description}
                onChange={(event) => setIouForm({ ...iouForm, description: event.target.value })}
              />

              <Button
                className="w-full h-9 text-xs font-medium"
                disabled={createIou.isPending || !iouForm.counterparty || Number(iouForm.amount) <= 0}
                onClick={() =>
                  createIou.mutate({
                    direction: iouForm.direction,
                    counterpartyName: iouForm.counterparty,
                    description: iouForm.description || null,
                    amount: iouForm.amount,
                    currency: iouForm.currency,
                    dueAt: iouForm.dueDate ? dateMs(iouForm.dueDate) : null,
                  })
                }
              >
                {createIou.isPending ? "جارٍ الحفظ..." : "حفظ المستحق"}
              </Button>

              <div className="space-y-2 pt-2 border-t">
                <div className="text-[11px] font-semibold text-muted-foreground">أحدث المستحقات:</div>
                {ious.data && ious.data.length > 0 ? (
                  ious.data.slice(0, 3).map((item) => (
                    <div key={item.id} className="rounded-lg bg-muted/40 p-2 text-xs border border-border/60">
                      <div className="flex items-center justify-between">
                        <b className="text-foreground">{item.counterpartyName}</b>
                        <span className="font-mono">{money(item.amount, item.currency)}</span>
                      </div>
                      <p className="mt-1 text-muted-foreground text-[11px]">
                        {item.direction === "receivable" ? "مستحق لك" : "مستحق عليك"} · حالة {item.status}
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="text-muted-foreground text-center py-2 text-[11px]">لا توجد مستحقات مسجلة.</div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* بطاقة مطالبات التأمين */}
          <Card className="fintech-surface-card xl:col-span-1 shadow-sm border">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <ShieldPlus className="size-5 text-primary" />
                مطالبات التأمين
              </CardTitle>
              <CardDescription className="text-xs">
                تسجيل مطالبة ومتابعتها؛ لا يسجل تعويضاً نقدياً قبل نشر حركة خاضعة للحوكمة.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              <Select
                value={claimForm.policyId}
                onValueChange={(value) => setClaimForm({ ...claimForm, policyId: value })}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="اختر البوليصة التأمينية" />
                </SelectTrigger>
                <SelectContent dir="rtl">
                  {policies.data
                    ?.filter((item) => item.status === "active")
                    .map((item) => (
                      <SelectItem value={String(item.id)} key={item.id}>
                        {item.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>

              <Input
                className="h-8 text-xs"
                inputMode="decimal"
                placeholder="المبلغ المطالب به"
                value={claimForm.amount}
                onChange={(event) => setClaimForm({ ...claimForm, amount: event.target.value })}
              />

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">تاريخ التقديم</Label>
                  <Input
                    type="date"
                    dir="rtl"
                    className="h-8 text-xs mt-1"
                    value={claimForm.submittedDate}
                    onChange={(event) => setClaimForm({ ...claimForm, submittedDate: event.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-xs">تاريخ متوقع</Label>
                  <Input
                    type="date"
                    dir="rtl"
                    className="h-8 text-xs mt-1"
                    value={claimForm.expectedDate}
                    onChange={(event) => setClaimForm({ ...claimForm, expectedDate: event.target.value })}
                  />
                </div>
              </div>

              <Input
                className="h-8 text-xs"
                placeholder="رقم المرجع التأميني"
                value={claimForm.reference}
                onChange={(event) => setClaimForm({ ...claimForm, reference: event.target.value })}
              />

              <Input
                className="h-8 text-xs"
                placeholder="ملاحظات وتفاصيل الحادثة"
                value={claimForm.note}
                onChange={(event) => setClaimForm({ ...claimForm, note: event.target.value })}
              />

              <Button
                className="w-full h-9 text-xs font-medium"
                disabled={createClaim.isPending || !claimForm.policyId || Number(claimForm.amount) <= 0}
                onClick={() =>
                  createClaim.mutate({
                    policyId: Number(claimForm.policyId),
                    referenceNumber: claimForm.reference || null,
                    claimedAmount: claimForm.amount,
                    submittedAt: dateMs(claimForm.submittedDate),
                    expectedAt: claimForm.expectedDate ? dateMs(claimForm.expectedDate) : null,
                    note: claimForm.note || null,
                  })
                }
              >
                {createClaim.isPending ? "جارٍ التسجيل..." : "تسجيل مطالبة تأمينية"}
              </Button>

              <div className="space-y-2 pt-2 border-t">
                <div className="text-[11px] font-semibold text-muted-foreground">أحدث المطالبات:</div>
                {claims.data && claims.data.length > 0 ? (
                  claims.data.slice(0, 3).map((item) => (
                    <div key={item.id} className="rounded-lg bg-muted/40 p-2 text-xs border border-border/60">
                      <div className="flex items-center justify-between">
                        <b className="text-foreground">{item.policyName}</b>
                        <span className="font-mono">{money(item.claimedAmount, item.currency)}</span>
                      </div>
                      <p className="mt-1 text-muted-foreground text-[11px]">
                        حالة {item.status} · مرجع {item.referenceNumber || "—"}
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="text-muted-foreground text-center py-2 text-[11px]">لا توجد مطالبات مسجلة.</div>
                )}
              </div>
            </CardContent>
          </Card>
        </section>
      </main>
    </DashboardLayout>
  );
}
