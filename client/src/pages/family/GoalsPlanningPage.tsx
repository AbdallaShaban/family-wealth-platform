import DashboardLayout from "@/components/DashboardLayout";
import PageHeader from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { Loader2, Target } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { EmptyState, InlineError, money, textError, useFamilyPermissions } from "./familyShared";

export const goalTypeLabel: Record<string, string> = {
  emergency_fund: "صندوق طوارئ",
  retirement: "تقاعد",
  education: "تعليم",
  legacy: "إرث",
  custom: "هدف مخصص",
};

export const goalMetricLabel: Record<string, string> = {
  net_worth: "صافي الثروة",
  liquid_assets: "السيولة",
  investments: "الاستثمارات",
};

export const goalFundingSourceLabel: Record<string, string> = {
  cash_flow: "التدفق النقدي",
  savings: "المدخرات",
  investments: "الاستثمارات",
  mixed: "مختلط",
  other: "مصدر آخر",
};

export default function GoalsPlanningPage() {
  const utils = trpc.useUtils();
  const access = useFamilyPermissions();
  const goals = trpc.family.goals.list.useQuery();
  const retirement = trpc.family.retirement.get.useQuery();
  const retirementProjection = trpc.family.retirement.projection.useQuery();
  const [name, setName] = useState("");
  const [goalType, setGoalType] = useState<"emergency_fund" | "retirement" | "education" | "legacy" | "custom">("custom");
  const [metric, setMetric] = useState<"net_worth" | "liquid_assets" | "investments">("liquid_assets");
  const [targetAmount, setTargetAmount] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [priority, setPriority] = useState("3");
  const [fundingSource, setFundingSource] = useState<"cash_flow" | "savings" | "investments" | "mixed" | "other">("cash_flow");
  const [monthlyContribution, setMonthlyContribution] = useState("0");
  const [assumedReturn, setAssumedReturn] = useState("0");
  const [assumedInflation, setAssumedInflation] = useState("0");

  const [currentAge, setCurrentAge] = useState("35");
  const [retirementAge, setRetirementAge] = useState("60");
  const [retirementAssets, setRetirementAssets] = useState("131250.00");
  const [retirementContribution, setRetirementContribution] = useState("10000.00");
  const [annualSpending, setAnnualSpending] = useState("120000.00");
  const [withdrawalRate, setWithdrawalRate] = useState("4");
  const [retirementReturn, setRetirementReturn] = useState("7.0");
  const [retirementInflation, setRetirementInflation] = useState("3.0");

  useEffect(() => {
    if (!retirement.data) return;
    if (retirement.data.currentAge) setCurrentAge(String(retirement.data.currentAge));
    if (retirement.data.retirementAge) setRetirementAge(String(retirement.data.retirementAge));
    if (retirement.data.currentRetirementAssets && parseFloat(retirement.data.currentRetirementAssets) > 0) setRetirementAssets(retirement.data.currentRetirementAssets);
    if (retirement.data.monthlyContribution) setRetirementContribution(retirement.data.monthlyContribution);
    if (retirement.data.annualSpending && parseFloat(retirement.data.annualSpending) > 0) setAnnualSpending(retirement.data.annualSpending);
    if (retirement.data.safeWithdrawalRate) setWithdrawalRate(retirement.data.safeWithdrawalRate);
    if (retirement.data.assumedAnnualReturn) setRetirementReturn(retirement.data.assumedAnnualReturn);
    if (retirement.data.assumedAnnualInflation) setRetirementInflation(retirement.data.assumedAnnualInflation);
  }, [retirement.data?.id]);

  const create = trpc.family.goals.create.useMutation({
    onSuccess: () => {
      toast.success("تم حفظ الهدف بتمويل وافتراضات معلنة. تقدم الهدف يبقى مشتقًا من بيانات FAMILY الفعلية.");
      setName("");
      setTargetAmount("");
      setTargetDate("");
      setPriority("3");
      setMonthlyContribution("0");
      setAssumedReturn("0");
      setAssumedInflation("0");
      void utils.family.goals.list.invalidate();
    },
    onError: error => toast.error(textError(error)),
  });

  const saveRetirement = trpc.family.retirement.upsert.useMutation({
    onSuccess: () => {
      toast.success("تم حفظ خطة التقاعد. الإسقاط يعرض افتراضاته ولا يدّعي احتمال نجاح.");
      void utils.family.retirement.get.invalidate();
      void utils.family.retirement.projection.invalidate();
    },
    onError: error => toast.error(textError(error)),
  });

  const submitGoal = (event: React.FormEvent) => {
    event.preventDefault();
    create.mutate({
      name,
      goalType,
      metric,
      targetAmount,
      targetDate: targetDate ? Date.parse(`${targetDate}T00:00:00.000Z`) : null,
      priority: Number(priority),
      fundingSource,
      monthlyContribution,
      assumedAnnualReturn: assumedReturn,
      assumedAnnualInflation: assumedInflation,
    });
  };

  const submitRetirement = (event: React.FormEvent) => {
    event.preventDefault();
    saveRetirement.mutate({
      currentAge: Number(currentAge),
      retirementAge: Number(retirementAge),
      currentRetirementAssets: retirementAssets,
      monthlyContribution: retirementContribution,
      annualSpending,
      safeWithdrawalRate: withdrawalRate,
      assumedAnnualReturn: retirementReturn,
      assumedAnnualInflation: retirementInflation,
    });
  };

  return (
    <DashboardLayout>
      <div dir="rtl" className="mx-auto max-w-7xl space-y-6">
        <PageHeader
          title="الأهداف والتقاعد والاستقلال المالي"
          description="يحافظ FAMILY على التقدم الحالي المستمد من الدفتر، ثم يضيف إسقاطًا حتميًا يعتمد فقط على مساهمتك والعائد والتضخم ومعدل السحب التي تدخلها. لا يعرض احتمالات نجاح أو توصية شراء/بيع."
          breadcrumbs={[
            { label: "الرئيسية", href: "/" },
            { label: "الحوكمة والتحليل", href: "/operations" },
            { label: "الأهداف والتقاعد والاستقلال المالي" },
          ]}
          badge={{ text: "تخطيط حتمي", variant: "institutional" }}
          icon={Target}
        />
        <section className="grid gap-6 xl:grid-cols-[.85fr_1.15fr]">
          <Card>
            <CardHeader>
              <CardTitle>هدف مالي جديد</CardTitle>
              <CardDescription>المساهمة والافتراضات اختيارية ولكنها تصبح جزءًا ظاهرًا من منهجية الإسقاط إذا حُدّد تاريخ مستهدف.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={submitGoal} className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="planning-goal-name">اسم الهدف</Label>
                  <Input id="planning-goal-name" value={name} onChange={event => setName(event.target.value)} disabled={!access.canEdit} required minLength={2} />
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label>النوع</Label>
                    <Select value={goalType} onValueChange={value => setGoalType(value as typeof goalType)} disabled={!access.canEdit}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(goalTypeLabel).map(([value, label]) => (
                          <SelectItem key={value} value={value}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>المقياس الحالي</Label>
                    <Select value={metric} onValueChange={value => setMetric(value as typeof metric)} disabled={!access.canEdit}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(goalMetricLabel).map(([value, label]) => (
                          <SelectItem key={value} value={value}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  <div className="grid gap-2">
                    <Label htmlFor="planning-goal-target">الهدف</Label>
                    <Input id="planning-goal-target" value={targetAmount} onChange={event => setTargetAmount(event.target.value)} disabled={!access.canEdit} inputMode="decimal" required />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="planning-goal-priority">الأولوية (1–5)</Label>
                    <Input id="planning-goal-priority" type="number" min="1" max="5" value={priority} onChange={event => setPriority(event.target.value)} disabled={!access.canEdit} required />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="planning-goal-date">التاريخ المستهدف</Label>
                    <Input id="planning-goal-date" type="date" value={targetDate} onChange={event => setTargetDate(event.target.value)} disabled={!access.canEdit} />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label>مصدر التمويل</Label>
                  <Select value={fundingSource} onValueChange={value => setFundingSource(value as typeof fundingSource)} disabled={!access.canEdit}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(goalFundingSourceLabel).map(([value, label]) => (
                        <SelectItem key={value} value={value}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  <div className="grid gap-2">
                    <Label htmlFor="planning-goal-contribution">مساهمة شهرية</Label>
                    <Input id="planning-goal-contribution" value={monthlyContribution} onChange={event => setMonthlyContribution(event.target.value)} disabled={!access.canEdit} inputMode="decimal" required />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="planning-goal-return">عائد سنوي مفترض %</Label>
                    <Input id="planning-goal-return" value={assumedReturn} onChange={event => setAssumedReturn(event.target.value)} disabled={!access.canEdit} inputMode="decimal" required />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="planning-goal-inflation">تضخم سنوي مفترض %</Label>
                    <Input id="planning-goal-inflation" value={assumedInflation} onChange={event => setAssumedInflation(event.target.value)} disabled={!access.canEdit} inputMode="decimal" required />
                  </div>
                </div>
                <Button type="submit" disabled={create.isPending || !access.canEdit}>
                  {create.isPending && <Loader2 className="ml-2 size-4 animate-spin" />}
                  {access.canEdit ? "حفظ الهدف" : "تتطلب صلاحية محرر"}
                </Button>
              </form>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>تقدم وإسقاط الأهداف</CardTitle>
              <CardDescription>القيمة الحالية والنسبة من الدفتر؛ القيم المستقبلية تتطلب تاريخًا وتستخدم الافتراضات المعروضة مع كل هدف.</CardDescription>
            </CardHeader>
            <CardContent>
              {goals.isLoading ? (
                <Skeleton className="h-96" />
              ) : goals.error ? (
                <InlineError message={textError(goals.error)} />
              ) : goals.data?.length ? (
                <div className="space-y-4">
                  {goals.data.map(goal => (
                    <div key={goal.id} className="rounded-xl border border-slate-200/90 dark:border-slate-800/80 bg-white dark:bg-[#0E1420] p-4">
                      <div className="flex flex-col justify-between gap-3 sm:flex-row">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold text-slate-900 dark:text-white">{goal.name}</p>
                            <Badge variant="outline">أولوية {goal.priority}</Badge>
                            <Badge variant="secondary">
                              {parseFloat(goal.targetAmount || "0") > 0 ? `${goal.progressPercent}% فعلي` : "0.0% (الهدف غير محدد)"}
                            </Badge>
                          </div>
                          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                            {goalTypeLabel[goal.goalType]} · مصدر التمويل: {goalFundingSourceLabel[goal.fundingSource]} · القيمة الحالية: {money(goal.currentAmount, goal.currency)} من {money(goal.targetAmount, goal.currency)}
                          </p>
                        </div>
                        {goal.projection.monthsToTarget ? (
                          <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">متوقع: {money(goal.projection.projectedAmount, goal.currency)}</p>
                        ) : null}
                      </div>
                      <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                        <div className="h-full rounded-full bg-emerald-600 transition-[width] duration-300" style={{ width: `${parseFloat(goal.targetAmount || "0") > 0 ? goal.progressPercent : 0}%` }} />
                      </div>
                      {goal.projection.monthsToTarget ? (
                        <div className="mt-4 grid gap-2 text-xs text-slate-600 dark:text-slate-300 sm:grid-cols-3">
                          <span>هدف بعد التضخم: {money(goal.projection.inflationAdjustedTargetAmount, goal.currency)}</span>
                          <span>فجوة متوقعة: {money(goal.projection.projectedGap, goal.currency)}</span>
                          <span>مساهمة لازمة: {money(goal.projection.requiredMonthlyContribution, goal.currency)}/شهر</span>
                          <span className="sm:col-span-3">الافتراضات: مساهمة {money(goal.monthlyContribution, goal.currency)} شهريًا، عائد {goal.assumedAnnualReturn}%، تضخم {goal.assumedAnnualInflation}%، وأفق {goal.projection.monthsToTarget} شهرًا.</span>
                        </div>
                      ) : (
                        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">احفظ تاريخًا مستهدفًا لحساب الإسقاط؛ لا تخمن المنصة موعدًا من تلقاء نفسها.</p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState icon={Target} title="لا توجد أهداف بعد" description="أنشئ هدفًا مرتبطًا بمقياس مالي حقيقي، ثم أضف تاريخًا ومساهمة وافتراضات معلنة إن أردت إسقاطًا حتميًا." />
              )}
            </CardContent>
          </Card>
        </section>
        <section className="grid gap-6 xl:grid-cols-[.85fr_1.15fr]">
          <Card>
            <CardHeader>
              <CardTitle>خطة تقاعد واستقلال مالي</CardTitle>
              <CardDescription>تحسب قيمة الاستقلال من الإنفاق السنوي المتوقع عند التقاعد مقسومًا على معدل السحب المدخل. هذه ليست نصيحة أو احتمال نجاح.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={submitRetirement} className="grid gap-4">
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="retirement-current-age">العمر الحالي</Label>
                    <Input id="retirement-current-age" type="number" value={currentAge} onChange={event => setCurrentAge(event.target.value)} disabled={!access.canEdit} required />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="retirement-age">عمر التقاعد</Label>
                    <Input id="retirement-age" type="number" value={retirementAge} onChange={event => setRetirementAge(event.target.value)} disabled={!access.canEdit} required />
                  </div>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="retirement-assets">أصول التقاعد الحالية</Label>
                    <Input id="retirement-assets" value={retirementAssets} onChange={event => setRetirementAssets(event.target.value)} disabled={!access.canEdit} inputMode="decimal" required />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="retirement-contribution">مساهمة شهرية</Label>
                    <Input id="retirement-contribution" value={retirementContribution} onChange={event => setRetirementContribution(event.target.value)} disabled={!access.canEdit} inputMode="decimal" required />
                  </div>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="retirement-spending">إنفاق سنوي حالي</Label>
                    <Input id="retirement-spending" value={annualSpending} onChange={event => setAnnualSpending(event.target.value)} disabled={!access.canEdit} inputMode="decimal" required />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="retirement-withdrawal">معدل السحب %</Label>
                    <Input id="retirement-withdrawal" value={withdrawalRate} onChange={event => setWithdrawalRate(event.target.value)} disabled={!access.canEdit} inputMode="decimal" required />
                  </div>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="retirement-return">عائد سنوي مفترض %</Label>
                    <Input id="retirement-return" value={retirementReturn} onChange={event => setRetirementReturn(event.target.value)} disabled={!access.canEdit} inputMode="decimal" required />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="retirement-inflation">تضخم سنوي مفترض %</Label>
                    <Input id="retirement-inflation" value={retirementInflation} onChange={event => setRetirementInflation(event.target.value)} disabled={!access.canEdit} inputMode="decimal" required />
                  </div>
                </div>
                <Button type="submit" disabled={saveRetirement.isPending || !access.canEdit}>
                  {saveRetirement.isPending && <Loader2 className="ml-2 size-4 animate-spin" />}
                  {access.canEdit ? "حفظ خطة التقاعد" : "تتطلب صلاحية محرر"}
                </Button>
              </form>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>نتيجة السيناريو الحتمي</CardTitle>
              <CardDescription>النتيجة تعرض القيم الاسمية المتوقعة وفق المعطيات المدخلة ولا تستخدم سعر سوق أو توزيع احتمالي.</CardDescription>
            </CardHeader>
            <CardContent>
              {retirementProjection.isLoading ? (
                <Skeleton className="h-64" />
              ) : retirementProjection.error ? (
                <InlineError message={textError(retirementProjection.error)} />
              ) : retirementProjection.data ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl bg-slate-50 p-4">
                    <p className="text-xs text-slate-500">سنوات حتى التقاعد</p>
                    <p className="mt-1 text-xl font-semibold">
                      {retirementProjection.data.projection.financialIndependenceTarget && parseFloat(retirementProjection.data.projection.financialIndependenceTarget) > 0 && retirementProjection.data.projection.yearsToRetirement !== null ? `${retirementProjection.data.projection.yearsToRetirement} سنة` : "غير محدد"}
                    </p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-4">
                    <p className="text-xs text-slate-500">أصول متوقعة عند التقاعد</p>
                    <p className="mt-1 text-xl font-semibold">{money(retirementProjection.data.projection.projectedAssetsAtRetirement, retirementProjection.data.plan.currency)}</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-4">
                    <p className="text-xs text-slate-500">هدف الاستقلال المالي</p>
                    <p className="mt-1 text-xl font-semibold">{money(retirementProjection.data.projection.financialIndependenceTarget, retirementProjection.data.plan.currency)}</p>
                  </div>
                  <div className="rounded-xl bg-amber-50 p-4">
                    <p className="text-xs text-amber-800">فجوة الاستقلال المالي</p>
                    <p className="mt-1 text-xl font-semibold text-amber-900">{money(retirementProjection.data.projection.gapToFinancialIndependence, retirementProjection.data.plan.currency)}</p>
                  </div>
                  <p className="text-xs leading-6 text-slate-500 sm:col-span-2">الافتراضات: عائد سنوي {retirementProjection.data.projection.nominalAnnualReturn}%، تضخم سنوي {retirementProjection.data.projection.annualInflation}%، ومعدل سحب {retirementProjection.data.projection.safeWithdrawalRate}%. لا تعبر هذه النتيجة عن احتمال نجاح أو توصية استثمار.</p>
                </div>
              ) : (
                <EmptyState icon={Target} title="أدخل خطة تقاعد" description="بعد حفظ العمر والأصول والمساهمة والإنفاق والافتراضات، تعرض المنصة فجوة حتمية قابلة للمراجعة." />
              )}
            </CardContent>
          </Card>
        </section>
      </div>
    </DashboardLayout>
  );
}
export { GoalsPlanningPage };
