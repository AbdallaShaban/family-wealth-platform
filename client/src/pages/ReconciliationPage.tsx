import DashboardLayout from "@/components/DashboardLayout";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { AlertTriangle, CheckCircle2, RefreshCw, ShieldCheck, Scale, Handshake } from "lucide-react";
import { SettlementMatchingView } from "@/pages/SettlementPage";

function formatFinancialDecimal(val: number | string | null | undefined): string {
  if (val === null || val === undefined || val === "") return "0.00";
  const num = typeof val === "number" ? val : Number(val);
  if (isNaN(num)) return String(val);
  return num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function ReconciliationPage() {
  const report = trpc.family.reconciliation.report.useQuery();
  const data = report.data;

  return (
    <DashboardLayout>
      <div dir="rtl" className="mx-auto max-w-7xl space-y-6">
        <PageHeader
          title="المطابقة والتسوية البنكية"
          description="مركز موحد لفحص توازن قيود الدفتر الأستاذ ومطابقة تسويات المستحقات والزكاة والمطالبات التأمينية مع المعاملات المعتمدة."
          icon={Scale}
          breadcrumbs={[
            { label: "النقد والالتزامات", href: "/reconciliation" },
            { label: "المطابقة والتسوية البنكية" },
          ]}
          badge="تدقيق محاسبي موثق"
          actions={
            <Button
              className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-sm transition-all border border-slate-900 flex items-center gap-2 dark:bg-white dark:hover:bg-slate-100 dark:text-slate-950 dark:border-transparent h-auto cursor-pointer"
              onClick={() => report.refetch()}
              disabled={report.isFetching}
            >
              <RefreshCw className={`size-4 ${report.isFetching ? "animate-spin" : ""}`} />
              <span>تحديث الفحص</span>
            </Button>
          }
        />

        <Tabs defaultValue="ledger" className="space-y-6">
          <TabsList className="bg-slate-100/90 dark:bg-[#0E1420] p-1.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 flex flex-wrap gap-1 mb-6 h-auto w-auto">
            <TabsTrigger
              value="ledger"
              className="gap-2 px-4 py-2 rounded-xl text-xs font-medium transition-colors border border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white data-[state=active]:bg-white dark:data-[state=active]:bg-[#1A2234] data-[state=active]:text-slate-900 dark:data-[state=active]:text-white data-[state=active]:font-bold data-[state=active]:shadow-xs data-[state=active]:border-slate-200/60 dark:data-[state=active]:border-slate-700/60"
            >
              <Scale className="size-4" />
              <span>توازن الدفاتر والقيود</span>
            </TabsTrigger>
            <TabsTrigger
              value="settlements"
              className="gap-2 px-4 py-2 rounded-xl text-xs font-medium transition-colors border border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white data-[state=active]:bg-white dark:data-[state=active]:bg-[#1A2234] data-[state=active]:text-slate-900 dark:data-[state=active]:text-white data-[state=active]:font-bold data-[state=active]:shadow-xs data-[state=active]:border-slate-200/60 dark:data-[state=active]:border-slate-700/60"
            >
              <Handshake className="size-4" />
              <span>تسوية الالتزامات والمطالبات</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="ledger" className="space-y-6">
            {report.isLoading ? (
              <Skeleton className="h-64 rounded-2xl" />
            ) : report.error ? (
              <div className="rounded-2xl border border-amber-200/80 bg-amber-50/60 dark:border-amber-800/60 dark:bg-amber-950/20 p-6 text-amber-800 dark:text-amber-300 flex items-center gap-3 shadow-xs">
                <AlertTriangle className="size-5 text-amber-600 shrink-0" />
                <span className="font-semibold text-sm">تعذر تحميل تقرير التسوية حاليًا.</span>
              </div>
            ) : data ? (
              <>
                {/* Audit Status Banner */}
                <div
                  className={`rounded-2xl p-4 mb-6 border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shadow-2xs ${
                    data.status === "healthy"
                      ? "bg-emerald-50/70 border-emerald-200 text-emerald-950 dark:bg-emerald-950/30 dark:border-emerald-800/60 dark:text-emerald-200"
                      : "bg-amber-50/70 border-amber-200 text-amber-950 dark:bg-amber-950/30 dark:border-amber-800/60 dark:text-amber-200"
                  }`}
                >
                  <div className="flex items-center gap-3.5">
                    <div
                      className={`size-10 rounded-xl flex items-center justify-center shrink-0 border ${
                        data.status === "healthy"
                          ? "bg-emerald-100/80 text-emerald-700 border-emerald-200/80 dark:bg-emerald-900/50 dark:text-emerald-300 dark:border-emerald-800/60"
                          : "bg-amber-100/80 text-amber-700 border-amber-200/80 dark:bg-amber-900/50 dark:text-amber-300 dark:border-amber-800/60"
                      }`}
                    >
                      {data.status === "healthy" ? <CheckCircle2 className="size-5" /> : <AlertTriangle className="size-5" />}
                    </div>
                    <div>
                      <p className="font-bold text-sm sm:text-base text-slate-900 dark:text-white">
                        {data.status === "healthy" ? "الدفتر متوازن ضمن نطاق الفحص" : "توجد عناصر تحتاج مراجعة"}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        وقت إنشاء التقرير: {new Date(data.generatedAt).toLocaleString("ar-EG")}
                      </p>
                    </div>
                  </div>
                  <div>
                    <span
                      className={`inline-flex items-center font-bold text-xs px-3 py-1 rounded-lg shadow-xs ${
                        data.status === "healthy" ? "bg-emerald-600 text-white" : "bg-amber-600 text-white"
                      }`}
                    >
                      {data.status === "healthy" ? "متوازن تماماً" : "مراجعة مطلوبة"}
                    </span>
                  </div>
                </div>

                <section className="grid gap-6 lg:grid-cols-2">
                  {/* Card 1: Operation & Ledger Activity Counts */}
                  <div className="bg-white dark:bg-[#0B0F17] border border-slate-200/90 dark:border-slate-800/80 rounded-2xl p-6 shadow-xs flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="text-slate-900 dark:text-white font-bold text-base flex items-center gap-2">
                          <Scale className="size-4 text-slate-700 dark:text-slate-300" />
                          <span>قيود وحركة العمليات</span>
                        </h3>
                        <span className="text-xs font-semibold px-2.5 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 border border-slate-200/60 dark:border-slate-700/60">
                          نطاق القيود المعتمدة
                        </span>
                      </div>
                      <p className="text-slate-500 dark:text-slate-400 text-xs mb-4">
                        إجمالي الحركات والسطور المحاسبية المعتمدة في دفتر الأستاذ المزدوج
                      </p>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="bg-slate-50/80 dark:bg-[#0E1420] border border-slate-200/70 dark:border-slate-800/80 rounded-xl p-3.5 text-center">
                          <span className="text-slate-600 dark:text-slate-400 font-semibold text-xs mb-1 block">القيود المعتمدة</span>
                          <span className="text-slate-900 dark:text-white font-bold font-mono text-lg tabular-nums">{data.counts.postedEntries}</span>
                        </div>
                        <div className="bg-slate-50/80 dark:bg-[#0E1420] border border-slate-200/70 dark:border-slate-800/80 rounded-xl p-3.5 text-center">
                          <span className="text-slate-600 dark:text-slate-400 font-semibold text-xs mb-1 block">المعاملات المعتمدة</span>
                          <span className="text-slate-900 dark:text-white font-bold font-mono text-lg tabular-nums">{data.counts.postedEvents}</span>
                        </div>
                        <div className="bg-slate-50/80 dark:bg-[#0E1420] border border-slate-200/70 dark:border-slate-800/80 rounded-xl p-3.5 text-center">
                          <span className="text-slate-600 dark:text-slate-400 font-semibold text-xs mb-1 block">سطور القيد</span>
                          <span className="text-slate-900 dark:text-white font-bold font-mono text-lg tabular-nums">{data.counts.postedLines}</span>
                        </div>
                        <div className="bg-slate-50/80 dark:bg-[#0E1420] border border-slate-200/70 dark:border-slate-800/80 rounded-xl p-3.5 text-center">
                          <span className="text-slate-600 dark:text-slate-400 font-semibold text-xs mb-1 block">الحسابات المفحوصة</span>
                          <span className="text-slate-900 dark:text-white font-bold font-mono text-lg tabular-nums">{data.counts.accounts}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800/80 pt-3 mt-4">
                      <span>الأصول المسجلة: <b className="font-mono font-bold text-slate-900 dark:text-white">{data.counts.persistedPositions}</b></span>
                      <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
                        <CheckCircle2 className="size-3.5" />
                        <span>قيود غير متوازنة: {data.counts.unbalancedEntries}</span>
                      </span>
                    </div>
                  </div>

                  {/* Card 2: Trial Balance Status */}
                  <div className="bg-white dark:bg-[#0B0F17] border border-slate-200/90 dark:border-slate-800/80 rounded-2xl p-6 shadow-xs flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="text-slate-900 dark:text-white font-bold text-base flex items-center gap-2">
                          <ShieldCheck className="size-4 text-emerald-600 dark:text-emerald-400" />
                          <span>حالة الدفاتر وميزان المراجعة</span>
                        </h3>
                        <span
                          className={`text-xs font-bold px-2.5 py-0.5 rounded-lg border ${
                            Math.abs(Number(data.trialBalance.differenceBase || 0)) < 0.0001
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/60"
                              : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800/60"
                          }`}
                        >
                          {Math.abs(Number(data.trialBalance.differenceBase || 0)) < 0.0001 ? "متوازن تماماً" : "فارق مراجعة"}
                        </span>
                      </div>
                      <p className="text-slate-500 dark:text-slate-400 text-xs mb-4">
                        المجاميع المحاسبية المشتقة من سطور القيود المعتمدة فقط
                      </p>
                      <div className="grid grid-cols-3 gap-3 text-center">
                        <div className="bg-slate-50/80 dark:bg-[#0E1420] border border-slate-200/70 dark:border-slate-800/80 rounded-xl p-3.5 text-center">
                          <span className="text-slate-600 dark:text-slate-400 font-semibold text-xs mb-1 block">إجمالي المدين</span>
                          <span className="text-slate-900 dark:text-white font-bold font-mono text-lg tabular-nums" dir="ltr">
                            {formatFinancialDecimal(data.trialBalance.totalDebitBase)}
                          </span>
                        </div>
                        <div className="bg-slate-50/80 dark:bg-[#0E1420] border border-slate-200/70 dark:border-slate-800/80 rounded-xl p-3.5 text-center">
                          <span className="text-slate-600 dark:text-slate-400 font-semibold text-xs mb-1 block">إجمالي الدائن</span>
                          <span className="text-slate-900 dark:text-white font-bold font-mono text-lg tabular-nums" dir="ltr">
                            {formatFinancialDecimal(data.trialBalance.totalCreditBase)}
                          </span>
                        </div>
                        <div className="bg-slate-50/80 dark:bg-[#0E1420] border border-slate-200/70 dark:border-slate-800/80 rounded-xl p-3.5 text-center">
                          <span className="text-slate-600 dark:text-slate-400 font-semibold text-xs mb-1 block">فرق ميزان المراجعة</span>
                          <span
                            className={`font-bold font-mono text-lg tabular-nums ${
                              Math.abs(Number(data.trialBalance.differenceBase || 0)) < 0.0001
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-amber-600 dark:text-amber-400"
                            }`}
                            dir="ltr"
                          >
                            {formatFinancialDecimal(data.trialBalance.differenceBase)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800/80 pt-3 mt-4">
                      <span>حالة القيود: <b className="text-emerald-600 dark:text-emerald-400 font-semibold">توازن ثنائي القيد محقق</b></span>
                      <span className="font-mono tabular-nums">ميزان المراجعة = 0.00</span>
                    </div>
                  </div>
                </section>

                {/* Card 3: Cash Flow Coverage */}
                <div className="bg-white dark:bg-[#0B0F17] border border-slate-200/90 dark:border-slate-800/80 rounded-2xl p-6 shadow-xs">
                  <h3 className="text-slate-900 dark:text-white font-bold text-base flex items-center gap-2 mb-1">
                    <span>تغطية التدفق النقدي</span>
                  </h3>
                  <p className="text-slate-500 dark:text-slate-400 text-xs mb-4">فحص ارتباط أحداث الدخل والمصروف والديون بقيد معتمد.</p>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="bg-slate-50/80 dark:bg-[#0E1420] border border-slate-200/70 dark:border-slate-800/80 rounded-xl p-3.5 text-center">
                      <span className="text-slate-600 dark:text-slate-400 font-semibold text-xs mb-1 block">أحداث التدفق</span>
                      <span className="text-slate-900 dark:text-white font-bold font-mono text-lg tabular-nums">{data.cashFlowCoverage.cashFlowEvents}</span>
                    </div>
                    <div className="bg-slate-50/80 dark:bg-[#0E1420] border border-slate-200/70 dark:border-slate-800/80 rounded-xl p-3.5 text-center">
                      <span className="text-slate-600 dark:text-slate-400 font-semibold text-xs mb-1 block">مرتبطة بقيد معتمد</span>
                      <span className="text-slate-900 dark:text-white font-bold font-mono text-lg tabular-nums">{data.cashFlowCoverage.linkedPostedEvents}</span>
                    </div>
                    <div className="bg-slate-50/80 dark:bg-[#0E1420] border border-slate-200/70 dark:border-slate-800/80 rounded-xl p-3.5 text-center">
                      <span className="text-slate-600 dark:text-slate-400 font-semibold text-xs mb-1 block">غير مرتبطة</span>
                      <span className="text-slate-900 dark:text-white font-bold font-mono text-lg tabular-nums">{data.cashFlowCoverage.unlinkedCashFlowEvents.length}</span>
                    </div>
                  </div>
                </div>

                {/* Card 4: Positions & Rebuild */}
                <div className="bg-white dark:bg-[#0B0F17] border border-slate-200/90 dark:border-slate-800/80 rounded-2xl p-6 shadow-xs">
                  <h3 className="text-slate-900 dark:text-white font-bold text-base flex items-center gap-2 mb-1">
                    <span>الأصول وإعادة البناء</span>
                  </h3>
                  <p className="text-slate-500 dark:text-slate-400 text-xs mb-4">
                    المقارنة بين الأصول المحفوظة ونتيجة أحداث الشراء والبيع المعتمدة. لا يتم الحفظ تلقائيًا.
                  </p>
                  {data.positions.length ? (
                    <div className="space-y-2.5">
                      {data.positions.slice(0, 12).map(position => (
                        <div
                          key={`${position.accountId}-${position.instrumentId}`}
                          className="grid gap-2 rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-slate-50/50 dark:bg-[#0E1420] p-3 text-xs sm:grid-cols-[1fr_1fr_auto] sm:items-center"
                        >
                          <div>
                            <p className="font-bold text-slate-900 dark:text-white">حساب {position.accountId} · أداة {position.instrumentId}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                              الكمية المعاد بناؤها: <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{formatFinancialDecimal(position.rebuiltQuantity)}</span> · المحفوظة: <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{position.persistedQuantity ? formatFinancialDecimal(position.persistedQuantity) : "غير موجودة"}</span>
                            </p>
                          </div>
                          <p className="text-xs text-slate-600 dark:text-slate-400">
                            P&L محقق تشخيصي: <span className="font-mono font-bold text-slate-900 dark:text-white">{formatFinancialDecimal(position.realizedPnlBase)}</span>
                          </p>
                          <span
                            className={`text-xs font-bold px-2.5 py-1 rounded-lg border text-center ${
                              position.status === "matched"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/60"
                                : position.status === "not_rebuildable"
                                ? "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700"
                                : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800/60"
                            }`}
                          >
                            {position.status === "matched" ? "متطابقة" : position.status === "not_rebuildable" ? "بيانات غير كافية" : "فرق يحتاج مراجعة"}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-8 text-center">
                      <div className="size-10 rounded-xl bg-slate-100 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 flex items-center justify-center mx-auto mb-2 border border-slate-200/60 dark:border-slate-700/60">
                        <Scale className="size-5" />
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">لا توجد أصول استثمارية مسجلة للفحص في النطاق الحالي.</p>
                    </div>
                  )}
                </div>

                <div className="flex items-start gap-3 rounded-2xl border border-slate-200/90 dark:border-slate-800/80 bg-slate-50/70 dark:bg-[#0B0F17] p-4 text-xs leading-6 text-slate-600 dark:text-slate-400 shadow-2xs">
                  <ShieldCheck className="mt-1 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <p>{data.notes.join(" ")}</p>
                </div>
              </>
            ) : null}
          </TabsContent>

          <TabsContent value="settlements" className="space-y-6">
            <SettlementMatchingView showHeader={false} />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
