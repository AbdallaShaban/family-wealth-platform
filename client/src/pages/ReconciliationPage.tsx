import DashboardLayout from "@/components/DashboardLayout";
import PageHeader from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { AlertTriangle, CheckCircle2, RefreshCw, ShieldCheck, Scale } from "lucide-react";

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
  return <DashboardLayout><div dir="rtl" className="space-y-6">
    <PageHeader
      title="تسوية وتوازن الدفتر"
      description="فحص قراءة فقط يعيد احتساب توازن القيود والأرصدة والحيازات من الأحداث المنشورة. لا ينشئ هذا التقرير قيودًا ولا يعدّل أي رصيد."
      icon={Scale}
      breadcrumbs={[
        { label: "الاستثمار والتداول", href: "/investments" },
        { label: "تسوية الدفتر والمطابقة" },
      ]}
      badge="تدقيق توازن القيود"
      actions={
        <Button variant="outline" size="sm" onClick={() => report.refetch()} disabled={report.isFetching}>
          <RefreshCw className={`ml-2 size-4 ${report.isFetching ? "animate-spin" : ""}`} />
          تحديث الفحص
        </Button>
      }
    />
    {report.isLoading ? <Skeleton className="h-64" /> : report.error ? <Card><CardContent className="flex items-center gap-3 p-6 text-rose-700"><AlertTriangle className="size-5" />تعذر تحميل تقرير التسوية حاليًا.</CardContent></Card> : data ? <>
      <Card className={data.status === "healthy" ? "border-emerald-200 bg-emerald-50/50" : "border-amber-200 bg-amber-50/50"}><CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-3">{data.status === "healthy" ? <CheckCircle2 className="size-7 text-emerald-700" /> : <AlertTriangle className="size-7 text-amber-700" />}<div><p className="font-semibold text-slate-950">{data.status === "healthy" ? "الدفتر متوازن ضمن نطاق الفحص" : "توجد عناصر تحتاج مراجعة"}</p><p className="mt-1 text-xs text-slate-600">وقت إنشاء التقرير: {new Date(data.generatedAt).toLocaleString("ar-EG")}</p></div></div><Badge variant={data.status === "healthy" ? "secondary" : "outline"}>{data.status === "healthy" ? "سليم" : "مراجعة مطلوبة"}</Badge></CardContent></Card>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">{countLabels.map(([key, label]) => <Card key={key}><CardContent className="p-5"><p className="text-xs font-semibold text-slate-500">{label}</p><p className="mt-2 text-2xl font-bold text-slate-950">{data.counts[key]}</p></CardContent></Card>)}</section>
      <section className="grid gap-4 lg:grid-cols-2"><Card><CardHeader><CardTitle>ميزان المراجعة</CardTitle><CardDescription>المجاميع مشتقة من سطور القيود المنشورة فقط.</CardDescription></CardHeader><CardContent className="grid gap-3 sm:grid-cols-3"><div><p className="text-xs text-slate-500">إجمالي المدين</p><p className="mt-1 font-semibold">{data.trialBalance.totalDebitBase}</p></div><div><p className="text-xs text-slate-500">إجمالي الدائن</p><p className="mt-1 font-semibold">{data.trialBalance.totalCreditBase}</p></div><div><p className="text-xs text-slate-500">الفرق</p><p className={`mt-1 font-semibold ${data.trialBalance.differenceBase === "0.000000" ? "text-emerald-700" : "text-amber-700"}`}>{data.trialBalance.differenceBase}</p></div></CardContent></Card><Card><CardHeader><CardTitle>تغطية التدفق النقدي</CardTitle><CardDescription>فحص ارتباط أحداث الدخل والمصروف والديون بقيد منشور.</CardDescription></CardHeader><CardContent className="grid gap-3 sm:grid-cols-3"><div><p className="text-xs text-slate-500">أحداث التدفق</p><p className="mt-1 font-semibold">{data.cashFlowCoverage.cashFlowEvents}</p></div><div><p className="text-xs text-slate-500">مرتبطة بقيد</p><p className="mt-1 font-semibold">{data.cashFlowCoverage.linkedPostedEvents}</p></div><div><p className="text-xs text-slate-500">غير مرتبطة</p><p className="mt-1 font-semibold">{data.cashFlowCoverage.unlinkedCashFlowEvents.length}</p></div></CardContent></Card></section>
      <Card><CardHeader><CardTitle>الحيازات وإعادة البناء</CardTitle><CardDescription>المقارنة بين الحيازة المحفوظة ونتيجة أحداث الشراء والبيع المنشورة. لا يتم الحفظ تلقائيًا.</CardDescription></CardHeader><CardContent>{data.positions.length ? <div className="space-y-2">{data.positions.slice(0, 12).map(position => <div key={`${position.accountId}-${position.instrumentId}`} className="grid gap-2 rounded-xl border border-slate-200 p-3 text-sm sm:grid-cols-[1fr_1fr_auto] sm:items-center"><div><p className="font-semibold">حساب {position.accountId} · أداة {position.instrumentId}</p><p className="text-xs text-slate-500">الكمية المعاد بناؤها: {position.rebuiltQuantity} · المحفوظة: {position.persistedQuantity ?? "غير موجودة"}</p></div><p className="text-xs text-slate-500">P&L محقق تشخيصي: {position.realizedPnlBase}</p><Badge variant={position.status === "matched" ? "secondary" : "outline"}>{position.status === "matched" ? "متطابقة" : position.status === "not_rebuildable" ? "بيانات غير كافية" : "فرق يحتاج مراجعة"}</Badge></div>)}</div> : <p className="text-sm text-slate-500">لا توجد حيازات قابلة للفحص في النطاق الحالي.</p>}</CardContent></Card>
      <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs leading-6 text-slate-600"><ShieldCheck className="mt-1 size-4 shrink-0 text-emerald-700" /><p>{data.notes.join(" ")}</p></div>
    </> : null}
  </div></DashboardLayout>;
}
