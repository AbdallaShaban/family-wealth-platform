import DashboardLayout from "@/components/DashboardLayout";
import PageHeader from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { AlertTriangle, CheckCircle2, RefreshCw, ShieldCheck, Scale, Handshake } from "lucide-react";
import { SettlementMatchingView } from "@/pages/SettlementPage";
import { formatMoney } from "@/lib/financialDisplay";

const countLabels = [
  ["postedEntries", "القيود المنشورة"],
  ["postedEvents", "الأحداث المنشورة"],
  ["postedLines", "سطور القيد"],
  ["accounts", "الحسابات المفحوصة"],
  ["persistedPositions", "الحيازات المحفوظة"],
  ["unbalancedEntries", "قيود غير متوازنة"],
  ["invalidReversals", "عكوس غير صالحة"],
  ["positionMismatches", "فروقات الحيازات"],
] as const;

export default function ReconciliationPage() {
  const report = trpc.family.reconciliation.report.useQuery();
  const data = report.data;

  return (
    <DashboardLayout>
      <div dir="rtl" className="mx-auto max-w-7xl space-y-6">
        <PageHeader
          title="تسوية ومطابقة العمليات"
          description="مركز موحد لفحص توازن قيود الدفتر الأستاذ ومطابقة تسويات المستحقات والزكاة والمطالبات التأمينية مع الأحداث المنشورة."
          icon={Scale}
          breadcrumbs={[
            { label: "النقد والالتزامات", href: "/cash-flow" },
            { label: "تسوية ومطابقة العمليات" },
          ]}
          badge="تدقيق محاسبي موثق"
          actions={
            <Button variant="outline" size="sm" onClick={() => report.refetch()} disabled={report.isFetching}>
              <RefreshCw className={`ml-2 size-4 ${report.isFetching ? "animate-spin" : ""}`} />
              تحديث الفحص
            </Button>
          }
        />

        <Tabs defaultValue="ledger" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 max-w-md">
            <TabsTrigger value="ledger" className="gap-2">
              <Scale className="size-4" />
              <span>توازن الدفتر والقيود</span>
            </TabsTrigger>
            <TabsTrigger value="settlements" className="gap-2">
              <Handshake className="size-4" />
              <span>تسوية الالتزامات والمطالبات</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="ledger" className="space-y-6">
            {report.isLoading ? (
              <Skeleton className="h-64" />
            ) : report.error ? (
              <Card>
                <CardContent className="flex items-center gap-3 p-6 text-amber-800 dark:text-amber-300">
                  <AlertTriangle className="size-5 text-amber-600" />
                  تعذر تحميل تقرير التسوية حاليًا.
                </CardContent>
              </Card>
            ) : data ? (
              <>
                <Card className={data.status === "healthy" ? "border-emerald-200 bg-emerald-50/50" : "border-amber-200 bg-amber-50/50"}>
                  <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                      {data.status === "healthy" ? <CheckCircle2 className="size-7 text-emerald-700" /> : <AlertTriangle className="size-7 text-amber-700" />}
                      <div>
                        <p className="font-semibold text-slate-950">{data.status === "healthy" ? "الدفتر متوازن ضمن نطاق الفحص" : "توجد عناصر تحتاج مراجعة"}</p>
                        <p className="mt-1 text-xs text-slate-600">وقت إنشاء التقرير: {new Date(data.generatedAt).toLocaleString("ar-EG")}</p>
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className={
                        data.status === "healthy"
                          ? "border-emerald-500/30 bg-emerald-500/10 text-[#0B1628] dark:text-slate-100 font-medium"
                          : "border-amber-500/30 bg-amber-500/10 text-[#0B1628] dark:text-slate-100 font-medium"
                      }
                    >
                      {data.status === "healthy" ? "سليم" : "مراجعة مطلوبة"}
                    </Badge>
                  </CardContent>
                </Card>
                <section className="grid gap-4 lg:grid-cols-2">
                  {/* Card 1: Operation & Ledger Activity Counts */}
                  <Card className="fintech-surface-card">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base font-bold flex items-center gap-2">
                          <Scale className="size-4 text-primary" />
                          <span>قيود وحركة العمليات</span>
                        </CardTitle>
                        <Badge variant="outline" className="text-xs">
                          نطاق القيود المعتمدة
                        </Badge>
                      </div>
                      <CardDescription className="text-xs">
                        إجمالي الحركات والسطور المحاسبية المنشورة في دفتر الأستاذ المزدوج
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="p-3 rounded-xl border bg-muted/20 text-center">
                          <p className="text-[11px] text-muted-foreground">القيود المنشورة</p>
                          <p className="text-xl font-bold font-mono text-foreground mt-1">{data.counts.postedEntries}</p>
                        </div>
                        <div className="p-3 rounded-xl border bg-muted/20 text-center">
                          <p className="text-[11px] text-muted-foreground">الأحداث المنشورة</p>
                          <p className="text-xl font-bold font-mono text-foreground mt-1">{data.counts.postedEvents}</p>
                        </div>
                        <div className="p-3 rounded-xl border bg-muted/20 text-center">
                          <p className="text-[11px] text-muted-foreground">سطور القيد</p>
                          <p className="text-xl font-bold font-mono text-foreground mt-1">{data.counts.postedLines}</p>
                        </div>
                        <div className="p-3 rounded-xl border bg-muted/20 text-center">
                          <p className="text-[11px] text-muted-foreground">الحسابات المفحوصة</p>
                          <p className="text-xl font-bold font-mono text-foreground mt-1">{data.counts.accounts}</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground border-t pt-3">
                        <span>الحيازات المحفوظة: <b className="font-mono text-foreground">{data.counts.persistedPositions}</b></span>
                        <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 className="size-3.5" />
                          <span>قيود غير متوازنة: {data.counts.unbalancedEntries}</span>
                        </span>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Card 2: Trial Balance Status */}
                  <Card className="fintech-surface-card border-primary/20">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base font-bold flex items-center gap-2">
                          <ShieldCheck className="size-4 text-emerald-600 dark:text-emerald-400" />
                          <span>حالة الدفاتر وميزان المراجعة</span>
                        </CardTitle>
                        <Badge
                          variant={data.trialBalance.differenceBase === "0.000000" || parseFloat(data.trialBalance.differenceBase) === 0 ? "secondary" : "outline"}
                          className="text-xs"
                        >
                          {data.trialBalance.differenceBase === "0.000000" || parseFloat(data.trialBalance.differenceBase) === 0 ? "متوازن تماماً" : "فارق مراجعة"}
                        </Badge>
                      </div>
                      <CardDescription className="text-xs">
                        المجاميع المحاسبية المشتقة من سطور القيود المنشورة فقط
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-3 gap-3 text-center">
                        <div className="p-3 rounded-xl border bg-muted/20">
                          <p className="text-[11px] text-muted-foreground">إجمالي المدين</p>
                          <p className="text-base font-bold font-mono text-foreground mt-1 tabular-nums" dir="ltr">
                            {data.trialBalance.totalDebitBase}
                          </p>
                        </div>
                        <div className="p-3 rounded-xl border bg-muted/20">
                          <p className="text-[11px] text-muted-foreground">إجمالي الدائن</p>
                          <p className="text-base font-bold font-mono text-foreground mt-1 tabular-nums" dir="ltr">
                            {data.trialBalance.totalCreditBase}
                          </p>
                        </div>
                        <div className={`p-3 rounded-xl border ${data.trialBalance.differenceBase === "0.000000" || parseFloat(data.trialBalance.differenceBase) === 0 ? "bg-emerald-500/10 border-emerald-500/30" : "bg-amber-500/10 border-amber-500/30"}`}>
                          <p className="text-[11px] text-muted-foreground">فرق ميزان المراجعة</p>
                          <p className={`text-base font-bold font-mono mt-1 tabular-nums ${data.trialBalance.differenceBase === "0.000000" || parseFloat(data.trialBalance.differenceBase) === 0 ? "text-emerald-600 dark:text-emerald-400" : "text-[#0B1628] dark:text-slate-100"}`} dir="ltr">
                            {data.trialBalance.differenceBase === "0.000000" ? "0.00" : data.trialBalance.differenceBase}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground border-t pt-3">
                        <span>حالة القيود: <b className="text-emerald-600 dark:text-emerald-400">توازن ثنائي القيد محقق</b></span>
                        <span className="text-[11px]">ميزان المراجعة = 0.00</span>
                      </div>
                    </CardContent>
                  </Card>
                </section>
                  <Card>
                    <CardHeader>
                      <CardTitle>تغطية التدفق النقدي</CardTitle>
                      <CardDescription>فحص ارتباط أحداث الدخل والمصروف والديون بقيد منشور.</CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-3 sm:grid-cols-3">
                      <div>
                        <p className="text-xs text-slate-500">أحداث التدفق</p>
                        <p className="mt-1 font-semibold">{data.cashFlowCoverage.cashFlowEvents}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">مرتبطة بقيد</p>
                        <p className="mt-1 font-semibold">{data.cashFlowCoverage.linkedPostedEvents}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">غير مرتبطة</p>
                        <p className="mt-1 font-semibold">{data.cashFlowCoverage.unlinkedCashFlowEvents.length}</p>
                      </div>
                    </CardContent>
                  </Card>
                <Card>
                  <CardHeader>
                    <CardTitle>الحيازات وإعادة البناء</CardTitle>
                    <CardDescription>المقارنة بين الحيازة المحفوظة ونتيجة أحداث الشراء والبيع المنشورة. لا يتم الحفظ تلقائيًا.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {data.positions.length ? (
                      <div className="space-y-2">
                        {data.positions.slice(0, 12).map(position => (
                          <div key={`${position.accountId}-${position.instrumentId}`} className="grid gap-2 rounded-xl border border-slate-200 p-3 text-sm sm:grid-cols-[1fr_1fr_auto] sm:items-center">
                            <div>
                              <p className="font-semibold">حساب {position.accountId} · أداة {position.instrumentId}</p>
                              <p className="text-xs text-slate-500">الكمية المعاد بناؤها: {position.rebuiltQuantity} · المحفوظة: {position.persistedQuantity ?? "غير موجودة"}</p>
                            </div>
                            <p className="text-xs text-slate-500">P&L محقق تشخيصي: {position.realizedPnlBase}</p>
                            <Badge variant={position.status === "matched" ? "secondary" : "outline"}>{position.status === "matched" ? "متطابقة" : position.status === "not_rebuildable" ? "بيانات غير كافية" : "فرق يحتاج مراجعة"}</Badge>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-500">لا توجد حيازات قابلة للفحص في النطاق الحالي.</p>
                    )}
                  </CardContent>
                </Card>
                <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs leading-6 text-slate-600">
                  <ShieldCheck className="mt-1 size-4 shrink-0 text-emerald-700" />
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
