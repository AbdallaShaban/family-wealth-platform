import React, { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  DashboardLayout,
  PageHeader,
  InlineError,
  PageLoading,
  money,
  textError,
  useFamilyPermissions,
} from "./familyShared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Umbrella, Loader2, AlertTriangle } from "lucide-react";

export function EmergencyFundPage({ embedded = false }: { embedded?: boolean }) {
  const utils = trpc.useUtils();
  const access = useFamilyPermissions();
  const summary = trpc.family.emergencyFund.summary.useQuery();
  const categories = trpc.family.cashFlow.categories.useQuery();
  const [targetMonths, setTargetMonths] = useState("3");
  const [lookbackMonths, setLookbackMonths] = useState("3");
  const [targetDate, setTargetDate] = useState("");

  const savePlan = trpc.family.emergencyFund.upsertPlan.useMutation({
    onSuccess: () => {
      toast.success("تم حفظ خطة الاحتياطي. سيعاد احتساب الغطاء من البيانات الفعلية.");
      void utils.family.emergencyFund.summary.invalidate();
    },
    onError: error => toast.error(textError(error)),
  });

  const setEssential = trpc.family.cashFlow.setEssential.useMutation({
    onSuccess: () => {
      void utils.family.cashFlow.categories.invalidate();
      void utils.family.emergencyFund.summary.invalidate();
    },
    onError: error => toast.error(textError(error)),
  });

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    savePlan.mutate({
      targetMonths,
      lookbackMonths: Number(lookbackMonths),
      targetDate: targetDate ? Date.parse(`${targetDate}T00:00:00.000Z`) : null,
    });
  };

  const plan = summary.data?.plan;
  useEffect(() => {
    if (!plan) return;
    setTargetMonths(plan.targetMonths);
    setLookbackMonths(String(plan.lookbackMonths));
    setTargetDate(plan.targetDate ? new Date(plan.targetDate).toISOString().slice(0, 10) : "");
  }, [plan?.targetMonths, plan?.lookbackMonths, plan?.targetDate]);

  const content = (
    <div dir="rtl" className="mx-auto max-w-7xl space-y-6">
        <PageHeader
          title="صندوق الطوارئ"
          description="تُقاس التغطية بالسيولة المقيمة مقابل متوسط المصروفات الأساسية المسجلة خلال فترة النظر، مضافًا إليه الحد الأدنى للديون. لا تفترض المنصة دخلًا أو عائدًا لم يُسجل."
          breadcrumbs={[
            { label: "الرئيسية", href: "/" },
            { label: "الالتزامات والحماية", href: "/emergency-fund" },
            { label: "صندوق الطوارئ" },
          ]}
          badge={{ text: "مرونة مالية", variant: "institutional" }}
          icon={Umbrella}
        />

        {summary.isLoading ? (
          <PageLoading />
        ) : summary.error ? (
          <InlineError message={textError(summary.error)} />
        ) : (
          <>
            {Number(summary.data?.essentialExpenseMonthlyBase ?? 0) <= 0 && (
              <Card className="border-amber-500/40 bg-amber-500/10 dark:bg-amber-950/30">
                <CardContent className="flex items-center gap-3 p-4 text-xs font-semibold text-amber-800 dark:text-amber-300">
                  <AlertTriangle className="size-5 shrink-0 text-amber-500" />
                  <div>
                    <p className="font-bold text-sm text-amber-900 dark:text-amber-200">تنبيه: لم يتم رصد أو تصنيف أي مصروفات أساسية شهرية بعد</p>
                    <p className="mt-0.5 text-slate-600 dark:text-slate-300">لحساب مدة تغطية واقعية وموثوقة لصندوق الطوارئ، يرجى تفعيل علامة "مصروف أساسي" على بنود وتصنيفات الإنفاق الأساسية أدناه أو تسجيل مصروفات فعلية.</p>
                  </div>
                </CardContent>
              </Card>
            )}

            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardDescription>السيولة المتاحة</CardDescription>
                  <CardTitle className="text-2xl text-emerald-700 dark:text-emerald-400">
                    {money(summary.data?.liquidReserveBase, summary.data?.baseCurrency || "EGP")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-slate-500 dark:text-slate-400">
                  حسابات نقدية ومصرفية ومحافظ ووساطة مقيمة فقط
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardDescription>مصروف أساسي شهري</CardDescription>
                  <CardTitle className="text-2xl">
                    {money(summary.data?.essentialExpenseMonthlyBase, summary.data?.baseCurrency || "EGP")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-slate-500 dark:text-slate-400">
                  متوسط آخر {plan?.lookbackMonths ?? 3} أشهر
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardDescription>التزام الدين الأدنى</CardDescription>
                  <CardTitle className="text-2xl">
                    {money(summary.data?.debtMinimumPaymentBase, summary.data?.baseCurrency || "EGP")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-slate-500 dark:text-slate-400">من عقود الدين النشطة</CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardDescription>مدة التغطية</CardDescription>
                  <CardTitle className="text-2xl">
                    {summary.data?.coverageMonths === null ? "غير قابلة للحساب" : `${summary.data?.coverageMonths} شهر`}
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-slate-500 dark:text-slate-400">
                  مقابل الإنفاق الأساسي والأقساط الدنيا
                </CardContent>
              </Card>
            </section>

            <Card
              className={
                summary.data?.recommendation.status === "funded"
                  ? "border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30 dark:border-emerald-800/60"
                  : "border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800/60"
              }
            >
              <CardContent
                className={`flex gap-3 p-5 text-sm ${
                  summary.data?.recommendation.status === "funded"
                    ? "text-emerald-900 dark:text-emerald-200"
                    : "text-amber-900 dark:text-amber-200"
                }`}
              >
                <Umbrella className="mt-0.5 size-5 shrink-0" />
                <div>
                  <p className="font-semibold">الإجراء المحسوب</p>
                  <p className="mt-1 leading-6">{summary.data?.recommendation.message}</p>
                </div>
              </CardContent>
            </Card>

            <section className="grid gap-6 lg:grid-cols-[.85fr_1.15fr]">
              <Card>
                <CardHeader>
                  <CardTitle>خطة الاحتياطي</CardTitle>
                  <CardDescription>
                    حدد الهدف والفترة التي تعكس نمط الإنفاق لديك. المساهمة الشهرية المطلوبة تظهر فقط عند تحديد تاريخ هدف مستقبلي.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={submit} className="grid gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="emergency-target">أشهر التغطية المستهدفة</Label>
                      <Input
                        id="emergency-target"
                        value={targetMonths}
                        onChange={event => setTargetMonths(event.target.value)}
                        disabled={!access.canEdit}
                        inputMode="decimal"
                        required
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="emergency-lookback">فترة متوسط المصروفات بالأشهر</Label>
                      <Input
                        id="emergency-lookback"
                        type="number"
                        min="1"
                        max="24"
                        value={lookbackMonths}
                        onChange={event => setLookbackMonths(event.target.value)}
                        disabled={!access.canEdit}
                        required
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="emergency-date">تاريخ الهدف</Label>
                      <Input
                        id="emergency-date"
                        type="date"
                        value={targetDate}
                        onChange={event => setTargetDate(event.target.value)}
                        disabled={!access.canEdit}
                      />
                    </div>
                    <Button type="submit" disabled={savePlan.isPending || !access.canEdit}>
                      {savePlan.isPending && <Loader2 className="ml-2 size-4 animate-spin" />}
                      {access.canEdit ? "حفظ الخطة" : "تتطلب صلاحية محرر"}
                    </Button>
                  </form>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>فجوة التمويل ومصدر الإنفاق</CardTitle>
                  <CardDescription>
                    يجب أن يعتمد الاحتياطي على فئات مصروف أساسية صريحة، لا على تصنيف افتراضي.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  {summary.data?.plan ? (
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="rounded-xl border bg-slate-50 dark:bg-slate-900/40 p-4 border-slate-200/80 dark:border-slate-800">
                        <p className="text-xs text-slate-500 dark:text-slate-400">الهدف</p>
                        <p className="mt-1 font-semibold text-slate-900 dark:text-white">
                          {money(summary.data.targetReserveBase, summary.data.baseCurrency)}
                        </p>
                      </div>
                      <div className="rounded-xl border bg-slate-50 dark:bg-slate-900/40 p-4 border-slate-200/80 dark:border-slate-800">
                        <p className="text-xs text-slate-500 dark:text-slate-400">الفجوة</p>
                        <p className="mt-1 font-semibold text-slate-900 dark:text-white">
                          {money(summary.data.fundingGapBase, summary.data.baseCurrency)}
                        </p>
                      </div>
                      <div className="rounded-xl border bg-slate-50 dark:bg-slate-900/40 p-4 border-slate-200/80 dark:border-slate-800">
                        <p className="text-xs text-slate-500 dark:text-slate-400">مساهمة شهرية</p>
                        <p className="mt-1 font-semibold text-slate-900 dark:text-white">
                          {summary.data.monthlyContributionNeededBase
                            ? money(summary.data.monthlyContributionNeededBase, summary.data.baseCurrency)
                            : "حدد تاريخ هدف"}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800/60 p-4 text-sm text-amber-900 dark:text-amber-200">
                      لم تحفظ هدف احتياطي بعد؛ يمكن للمنصة عرض السيولة ومتوسط الالتزامات فقط حتى تحدد عدد أشهر التغطية.
                    </div>
                  )}

                  {summary.data?.unvaluedCurrencies.length ? (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800/60 p-4 text-sm text-amber-900 dark:text-amber-200">
                      عملات سيولة غير مقيمة في عملة الأساس: {summary.data.unvaluedCurrencies.join("، ")}. لن تدخل في قيمة الاحتياطي إلى أن تسجل FX موثقًا.
                    </div>
                  ) : null}

                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">فئات المصروف الأساسية</p>
                    {categories.data?.filter(category => category.direction === "expense").length ? (
                      categories.data
                        .filter(category => category.direction === "expense")
                        .map(category => (
                          <div key={category.id} className="flex items-center justify-between rounded-lg border border-slate-200/80 dark:border-slate-800 p-3">
                            <span className="text-sm text-slate-900 dark:text-white">{category.name}</span>
                            <Button
                              type="button"
                              variant={category.isEssential === "yes" ? "default" : "outline"}
                              size="sm"
                              disabled={!access.isOwner || setEssential.isPending}
                              onClick={() =>
                                setEssential.mutate({
                                  categoryId: category.id,
                                  isEssential: category.isEssential !== "yes",
                                })
                              }
                            >
                              {category.isEssential === "yes" ? "أساسي" : "غير أساسي"}
                            </Button>
                          </div>
                        ))
                    ) : (
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        أضف فئات مصروف أولًا من صفحة التدفق والميزانية.
                      </p>
                    )}
                    {!access.isOwner && (
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        تغيير وسم «أساسي» محفوظ للمالك لأنّه يغيّر مقياس المرونة المالي.
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </section>
          </>
        )}
      </div>
  );

  if (embedded) return content;
  return <DashboardLayout>{content}</DashboardLayout>;
}

export default EmergencyFundPage;
