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
import { CashFlowRegisterCard } from "./CashFlowRegisterPage";
import { RecurringRulesCard } from "./RecurringRulesPage";
import { ForwardRunwayMatrix } from "@/components/banking/ForwardRunwayMatrix";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { WalletCards, Calendar, ArrowDownLeft, ArrowUpRight, Target, Loader2 } from "lucide-react";

function currentPeriodKey() {
  return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", timeZone: "UTC" }).format(new Date());
}

export function CashFlowPage({ embedded = false }: { embedded?: boolean }) {
  const utils = trpc.useUtils();
  const access = useFamilyPermissions();
  const [periodKey, setPeriodKey] = useState(currentPeriodKey);
  const [categoryName, setCategoryName] = useState("");
  const [categoryDirection, setCategoryDirection] = useState<"income" | "expense">("expense");
  const [budgetCategoryId, setBudgetCategoryId] = useState("");
  const [budgetAmount, setBudgetAmount] = useState("");

  const categories = trpc.family.cashFlow.categories.useQuery();
  const summary = trpc.family.cashFlow.summary.useQuery({ periodKey });

  const createCategory = trpc.family.cashFlow.createCategory.useMutation({
    onSuccess: () => {
      toast.success("تمت إضافة الفئة المالية ضمن نطاق FAMILY.");
      setCategoryName("");
      void utils.family.cashFlow.categories.invalidate();
    },
    onError: error => toast.error(textError(error)),
  });

  const upsertBudget = trpc.family.cashFlow.upsertBudget.useMutation({
    onSuccess: () => {
      toast.success("تم حفظ الخطة الشهرية وربطها بالفئة.");
      setBudgetAmount("");
      void utils.family.cashFlow.summary.invalidate();
    },
    onError: error => toast.error(textError(error)),
  });

  const addCategory = (event: React.FormEvent) => {
    event.preventDefault();
    createCategory.mutate({
      name: categoryName,
      direction: categoryDirection,
      color: categoryDirection === "income" ? "#047857" : "#b45309",
    });
  };

  const saveBudget = (event: React.FormEvent) => {
    event.preventDefault();
    if (!budgetCategoryId) return toast.error("اختر فئة للميزانية.");
    upsertBudget.mutate({ categoryId: Number(budgetCategoryId), periodKey, plannedAmountBase: budgetAmount });
  };

  const formattedPeriod = useMemo(() => {
    if (!periodKey) return "";
    const [year, month] = periodKey.split("-").map(Number);
    if (!year || !month) return periodKey;
    const date = new Date(year, month - 1, 1);
    return new Intl.DateTimeFormat("ar-EG", { month: "long", year: "numeric" }).format(date);
  }, [periodKey]);

  const totalPlannedExpense = useMemo(() => {
    return (summary.data?.categories ?? [])
      .filter(c => c.direction === "expense")
      .reduce((sum, c) => sum + Number(c.plannedAmountBase || 0), 0);
  }, [summary.data?.categories]);

  const actualExpense = Number(summary.data?.expenseActualBase || 0);
  const budgetExecutionRate = totalPlannedExpense > 0 ? Math.round((actualExpense / totalPlannedExpense) * 100) : null;

  const content = (
    <div dir="rtl" className="mx-auto max-w-7xl space-y-6">
        <PageHeader
          title="التدفق النقدي والسيولة"
          description="المقارنة هنا تعتمد على مبالغ المعاملات المعتمدة والقيم الأساسية في دفتر القيود. لن يظهر فعلي أو مخطط بلا بيانات مسجلة."
          breadcrumbs={[
            { label: "النقد والالتزامات", href: "/cash-flow" },
            { label: "التدفق النقدي والسيولة" },
          ]}
          badge={{ text: "إدارة السيولة", variant: "institutional" }}
          icon={WalletCards}
          actions={
            <div className="relative inline-flex items-center gap-2 bg-white dark:bg-[#0B0F17] border border-slate-200/90 dark:border-slate-800/80 px-3.5 py-2 rounded-xl text-slate-900 dark:text-white font-bold text-xs shadow-2xs">
              <Calendar className="size-4 text-slate-500 dark:text-slate-400 shrink-0" />
              <span>{formattedPeriod || periodKey}</span>
              <input
                aria-label="الفترة الشهرية"
                type="month"
                value={periodKey}
                onChange={event => setPeriodKey(event.target.value)}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              />
            </div>
          }
        />

        {/* Top Executive Asymmetric Metric Strip (With Semantic Tints) */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 bg-white dark:bg-[#0B0F17] border border-slate-200/90 dark:border-slate-800/80 rounded-2xl shadow-xs overflow-hidden mb-6">
          {/* Cell 1 (صافي التدفق النقدي - Net Cash Flow) */}
          <div className="bg-slate-50/50 dark:bg-slate-900/30 p-5 flex flex-col justify-between border-b sm:border-b-0 lg:border-b-0 lg:border-l border-slate-200/80 dark:border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-slate-600 dark:text-slate-400 font-semibold text-xs flex items-center gap-2">
                صافي التدفق النقدي
              </span>
              <div className="size-8 rounded-xl bg-sky-50 text-sky-600 border border-sky-200/80 dark:bg-sky-950/40 dark:text-sky-400 dark:border-sky-800/60 flex items-center justify-center">
                <WalletCards className="size-4" />
              </div>
            </div>
            <div className="mt-2 mb-1">
              <strong className="text-slate-900 dark:text-white font-extrabold font-mono text-2xl lg:text-3xl tabular-nums tracking-tight block">
                {money(summary.data?.netCashFlowBase, summary.data?.baseCurrency || "EGP")}
              </strong>
            </div>
            <span className="text-slate-400 dark:text-slate-500 text-[11px] font-medium block">
              الفارق بين الإيرادات والمصروفات المحققة
            </span>
          </div>

          {/* Cell 2 (التدفقات الداخلة / الدخل - Inflows) */}
          <div className="p-5 flex flex-col justify-between border-b sm:border-b-0 lg:border-b-0 lg:border-l border-slate-200/80 dark:border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-slate-600 dark:text-slate-400 font-semibold text-xs flex items-center gap-2">
                التدفقات الداخلة / الدخل
              </span>
              <div className="size-8 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/60 flex items-center justify-center">
                <ArrowDownLeft className="size-4" />
              </div>
            </div>
            <div className="mt-2 mb-1">
              <strong className="text-emerald-600 dark:text-emerald-400 font-bold font-mono text-xl sm:text-2xl tabular-nums block">
                {money(summary.data?.incomeActualBase, summary.data?.baseCurrency || "EGP")}
              </strong>
            </div>
            <span className="text-slate-400 dark:text-slate-500 text-[11px] font-medium block">
              إجمالي المقبوضات والسيولة الواردة
            </span>
          </div>

          {/* Cell 3 (التدفقات الخارجة / المصروفات - Outflows) */}
          <div className="p-5 flex flex-col justify-between border-b sm:border-b-0 lg:border-b-0 lg:border-l border-slate-200/80 dark:border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-slate-600 dark:text-slate-400 font-semibold text-xs flex items-center gap-2">
                التدفقات الخارجة / المصروفات
              </span>
              <div className="size-8 rounded-xl bg-rose-50 text-rose-600 border border-rose-200/80 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800/60 flex items-center justify-center">
                <ArrowUpRight className="size-4" />
              </div>
            </div>
            <div className="mt-2 mb-1">
              <strong className="text-slate-900 dark:text-white font-bold font-mono text-xl sm:text-2xl tabular-nums block">
                {money(summary.data?.expenseActualBase, summary.data?.baseCurrency || "EGP")}
              </strong>
            </div>
            <span className="text-slate-400 dark:text-slate-500 text-[11px] font-medium block">
              إجمالي المدفوعات والالتزامات المنصرفة
            </span>
          </div>

          {/* Cell 4 (الميزانية والانضباط المالي - Budget Allocation) */}
          <div className="p-5 flex flex-col justify-between border-b-0 lg:border-l-0">
            <div className="flex items-center justify-between">
              <span className="text-slate-600 dark:text-slate-400 font-semibold text-xs flex items-center gap-2">
                الميزانية والانضباط المالي
              </span>
              <div className="size-8 rounded-xl bg-amber-50 text-amber-600 border border-amber-200/80 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800/60 flex items-center justify-center">
                <Target className="size-4" />
              </div>
            </div>
            <div className="mt-2 mb-1">
              <strong className="text-slate-900 dark:text-white font-bold font-mono text-xl sm:text-2xl tabular-nums block">
                {budgetExecutionRate !== null ? `${budgetExecutionRate}%` : "—"}
              </strong>
            </div>
            <span className="text-slate-400 dark:text-slate-500 text-[11px] font-medium block">
              نسبة تنفيذ الخطة المعتمدة
            </span>
          </div>
        </section>

        {/* Sub-Tabs Bar */}
        <Tabs defaultValue="summary" className="space-y-6">
          <TabsList className="bg-slate-100/90 dark:bg-[#0E1420] p-1.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 flex flex-wrap gap-1 mb-6 h-auto w-full sm:w-auto justify-start">
            <TabsTrigger
              value="summary"
              className="data-[state=active]:bg-white data-[state=active]:dark:bg-[#1A2234] data-[state=active]:text-slate-900 data-[state=active]:dark:text-white data-[state=active]:font-bold data-[state=active]:shadow-xs data-[state=active]:border-slate-200/60 data-[state=active]:dark:border-slate-700/60 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-medium text-xs px-4 py-2 rounded-xl transition-colors border border-transparent shadow-none"
            >
              ملخص التدفق والميزانية
            </TabsTrigger>
            <TabsTrigger
              value="runway"
              className="data-[state=active]:bg-white data-[state=active]:dark:bg-[#1A2234] data-[state=active]:text-slate-900 data-[state=active]:dark:text-white data-[state=active]:font-bold data-[state=active]:shadow-xs data-[state=active]:border-slate-200/60 data-[state=active]:dark:border-slate-700/60 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-medium text-xs px-4 py-2 rounded-xl transition-colors border border-transparent shadow-none"
            >
              مدرج السيولة والتوقعات (Forward Runway)
            </TabsTrigger>
            <TabsTrigger
              value="record"
              className="data-[state=active]:bg-white data-[state=active]:dark:bg-[#1A2234] data-[state=active]:text-slate-900 data-[state=active]:dark:text-white data-[state=active]:font-bold data-[state=active]:shadow-xs data-[state=active]:border-slate-200/60 data-[state=active]:dark:border-slate-700/60 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-medium text-xs px-4 py-2 rounded-xl transition-colors border border-transparent shadow-none"
            >
              تسجيل تدفق جديد
            </TabsTrigger>
            <TabsTrigger
              value="recurring"
              className="data-[state=active]:bg-white data-[state=active]:dark:bg-[#1A2234] data-[state=active]:text-slate-900 data-[state=active]:dark:text-white data-[state=active]:font-bold data-[state=active]:shadow-xs data-[state=active]:border-slate-200/60 data-[state=active]:dark:border-slate-700/60 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-medium text-xs px-4 py-2 rounded-xl transition-colors border border-transparent shadow-none"
            >
              المعاملات المتكررة
            </TabsTrigger>
          </TabsList>

          <TabsContent value="summary" className="space-y-6">
            <section className="grid gap-6 lg:grid-cols-[.8fr_1.2fr]">
              {/* Form Card: إعداد الفئات والخطة */}
              <div className="bg-white dark:bg-[#0B0F17] border border-slate-200/90 dark:border-slate-800/80 rounded-2xl p-6 shadow-xs">
                <div className="mb-6">
                  <h3 className="text-slate-900 dark:text-white font-bold text-base mb-1">إعداد الفئات والخطة</h3>
                  <p className="text-slate-500 dark:text-slate-400 text-xs">
                    الفئات تحدد اتجاه العملية، والخطة تحفظ بعملة الأساس للفترة المختارة.
                  </p>
                </div>

                <div className="space-y-6">
                  <form onSubmit={addCategory} className="grid gap-3 rounded-xl border border-slate-200/70 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-900/30 p-4">
                    <Label htmlFor="category-name" className="text-slate-700 dark:text-slate-300 font-semibold text-xs mb-1.5 block">
                      فئة جديدة
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        id="category-name"
                        value={categoryName}
                        onChange={event => setCategoryName(event.target.value)}
                        disabled={!access.canEdit}
                        placeholder="مثال: إيجار أو راتب"
                        required
                        className="bg-white dark:bg-[#0E1420] border border-slate-300 dark:border-slate-700/80 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-xl font-medium text-xs py-2.5 px-3 focus:outline-hidden focus:border-slate-800 dark:focus:border-slate-400 focus:ring-1 focus:ring-slate-800 dark:focus:ring-slate-400 transition-all h-auto"
                      />
                      <Select value={categoryDirection} onValueChange={value => setCategoryDirection(value as typeof categoryDirection)} disabled={!access.canEdit}>
                        <SelectTrigger className="w-32 bg-white dark:bg-[#0E1420] border border-slate-300 dark:border-slate-700/80 text-slate-900 dark:text-slate-100 rounded-xl font-medium text-xs py-2.5 px-3 focus:outline-hidden focus:border-slate-800 dark:focus:border-slate-400 focus:ring-1 focus:ring-slate-800 dark:focus:ring-slate-400 transition-all h-auto">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="income">دخل</SelectItem>
                          <SelectItem value="expense">مصروف</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      type="submit"
                      disabled={createCategory.isPending || !access.canEdit}
                      className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs py-2.5 px-4 rounded-xl shadow-sm transition-all dark:bg-white dark:hover:bg-slate-100 dark:text-slate-950 border border-slate-900 dark:border-transparent mt-2 h-auto"
                    >
                      {createCategory.isPending && <Loader2 className="ml-2 size-4 animate-spin" />}
                      {access.canEdit ? "إضافة فئة" : "تتطلب صلاحية محرر"}
                    </Button>
                  </form>

                  <form onSubmit={saveBudget} className="grid gap-3">
                    <Label className="text-slate-700 dark:text-slate-300 font-semibold text-xs mb-1.5 block">
                      خطة للفترة {formattedPeriod || periodKey}
                    </Label>
                    <Select value={budgetCategoryId} onValueChange={setBudgetCategoryId} disabled={!access.canEdit}>
                      <SelectTrigger className="bg-white dark:bg-[#0E1420] border border-slate-300 dark:border-slate-700/80 text-slate-900 dark:text-slate-100 rounded-xl font-medium text-xs py-2.5 px-3 focus:outline-hidden focus:border-slate-800 dark:focus:border-slate-400 focus:ring-1 focus:ring-slate-800 dark:focus:ring-slate-400 transition-all h-auto">
                        <SelectValue placeholder="اختر فئة" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.data?.map(category => (
                          <SelectItem value={String(category.id)} key={category.id}>
                            {category.direction === "income" ? "دخل" : "مصروف"} · {category.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      value={budgetAmount}
                      onChange={event => setBudgetAmount(event.target.value)}
                      disabled={!access.canEdit}
                      inputMode="decimal"
                      placeholder={`المبلغ بعملة الأساس (${summary.data?.baseCurrency || "EGP"})`}
                      required
                      className="bg-white dark:bg-[#0E1420] border border-slate-300 dark:border-slate-700/80 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-xl font-medium text-xs py-2.5 px-3 focus:outline-hidden focus:border-slate-800 dark:focus:border-slate-400 focus:ring-1 focus:ring-slate-800 dark:focus:ring-slate-400 transition-all h-auto"
                    />
                    <Button
                      type="submit"
                      variant="outline"
                      disabled={upsertBudget.isPending || !access.canEdit}
                      className="w-full bg-slate-100 hover:bg-slate-200 text-slate-900 font-bold text-xs py-2.5 px-4 rounded-xl transition-all dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-white border border-slate-200 dark:border-slate-700 mt-3 h-auto"
                    >
                      {upsertBudget.isPending && <Loader2 className="ml-2 size-4 animate-spin" />}
                      حفظ الخطة
                    </Button>
                  </form>
                </div>
              </div>

              {/* Table Card: فعلي مقابل مخطط */}
              <div className="bg-white dark:bg-[#0B0F17] border border-slate-200/90 dark:border-slate-800/80 rounded-2xl p-6 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="mb-4">
                    <h3 className="text-slate-900 dark:text-white font-bold text-base mb-1">فعلي مقابل مخطط</h3>
                    <p className="text-slate-500 dark:text-slate-400 text-xs">
                      يتوسع الجدول فقط عند وجود أحداث مصنفة أو خطة لفئة في الفترة المختارة.
                    </p>
                  </div>

                  {summary.isLoading ? (
                    <Skeleton className="h-60 rounded-xl" />
                  ) : summary.error ? (
                    <InlineError message={textError(summary.error)} />
                  ) : summary.data?.categories.length ? (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[620px] text-right text-sm">
                        <thead className="border-b border-slate-100 dark:border-slate-800/60 text-xs font-semibold text-slate-500 dark:text-slate-400">
                          <tr>
                            <th className="pb-3 px-3">الفئة</th>
                            <th className="pb-3 px-3">الاتجاه</th>
                            <th className="pb-3 px-3 font-mono">فعلي</th>
                            <th className="pb-3 px-3 font-mono">مخطط</th>
                            <th className="pb-3 px-3 font-mono">الفرق</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                          {summary.data.categories.map(row => {
                            const isExpense = row.direction === "expense";
                            const diff = Number(row.plannedAmountBase) - Number(row.actualAmountBase);
                            const isOverBudget = isExpense && Number(row.actualAmountBase) > Number(row.plannedAmountBase);
                            return (
                              <tr key={row.categoryId} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                                <td className="py-3.5 px-3 font-semibold text-slate-900 dark:text-white">{row.categoryName}</td>
                                <td className="py-3.5 px-3">
                                  <Badge variant={row.direction === "income" ? "secondary" : "outline"} className="text-[11px] font-semibold">
                                    {row.direction === "income" ? "دخل" : "مصروف"}
                                  </Badge>
                                </td>
                                <td className="py-3.5 px-3 font-mono font-bold text-slate-900 dark:text-white tabular-nums">
                                  {money(row.actualAmountBase, summary.data.baseCurrency)}
                                </td>
                                <td className="py-3.5 px-3 font-mono text-slate-600 dark:text-slate-400 tabular-nums">
                                  {money(row.plannedAmountBase, summary.data.baseCurrency)}
                                </td>
                                <td className={`py-3.5 px-3 font-mono font-bold tabular-nums ${isOverBudget ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                                  {money(String(diff), summary.data.baseCurrency)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-center py-10 px-4">
                      <div className="size-12 rounded-2xl bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 flex items-center justify-center mx-auto mb-3 border border-slate-200/60 dark:border-slate-700/60">
                        <WalletCards className="size-6" />
                      </div>
                      <h4 className="text-slate-900 dark:text-white font-bold text-sm mb-1">
                        لا توجد بيانات تدفق مصنفة لهذه الفترة
                      </h4>
                      <p className="text-slate-500 dark:text-slate-400 text-xs max-w-sm mx-auto">
                        أنشئ فئة، ثم اخترها عند تسجيل دخل أو مصروف، وحدد خطة شهرية عند الحاجة.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </section>
          </TabsContent>

          <TabsContent value="runway" className="space-y-6">
            <ForwardRunwayMatrix />
          </TabsContent>

          <TabsContent value="record" className="space-y-6">
            <CashFlowRegisterCard onComplete={() => void utils.family.cashFlow.summary.invalidate()} />
          </TabsContent>

          <TabsContent value="recurring" className="space-y-6">
            <RecurringRulesCard />
          </TabsContent>
        </Tabs>
      </div>
  );

  if (embedded) return content;
  return <DashboardLayout>{content}</DashboardLayout>;
}

export default CashFlowPage;
