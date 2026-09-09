import DashboardLayout from "@/components/DashboardLayout";
import PageHeader from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CircleAlert, CircleCheckBig, DatabaseZap, Gauge, Globe2, ShieldCheck } from "lucide-react";
import { trpc } from "@/lib/trpc";

const formatDateTime = (value: number | null) => value ? new Intl.DateTimeFormat("ar-EG", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "لا توجد لقطة";
const quoteStatusLabel: Record<string, string> = { live: "حي", delayed: "متأخر", manual: "يدوي موثق", last_known: "آخر سعر معروف", stale: "متقادم", unavailable: "غير متاح", base_currency: "عملة الأساس" };
const statusVariant = (status: string) => status === "unavailable" || status === "stale" ? "destructive" : status === "delayed" ? "secondary" : "default";

function QualityMetric({ label, value, tone = "default" }: { label: string; value: number; tone?: "default" | "alert" }) {
  return <div className={`rounded-xl border p-4 ${tone === "alert" && value ? "border-amber-300 bg-amber-50/70 dark:border-amber-900 dark:bg-amber-950/30" : "bg-muted/25"}`}><p className="text-xs font-medium text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-bold tabular-nums">{value}</p></div>;
}

export default function MarketDataQualityPage() {
  const quality = trpc.family.marketDataQuality.useQuery();
  const data = quality.data;
  return <DashboardLayout><main className="mx-auto max-w-7xl space-y-6" dir="rtl">
    <PageHeader
      title="جودة بيانات السوق"
      description="لوحة تشغيلية للمتابعة فقط: تعرض تغطية السعر والمصدر وتاريخ اللقطة وحالة التقادم، ولا تعرض قيمًا مالية ولا تحدّث أسعارًا ولا تنشئ أي صفقة أو قيد."
      breadcrumbs={[
        { label: "الرئيسية", href: "/" },
        { label: "الاستثمار والتداول", href: "/data-quality" },
        { label: "جودة بيانات السوق" },
      ]}
      badge={{ text: "مراقبة فقط", variant: "institutional" }}
      icon={DatabaseZap}
    />

    {quality.isLoading ? <Card className="fintech-surface-card"><CardContent className="py-14 text-center text-sm text-muted-foreground">جارٍ تحليل تغطية السعر والصرف…</CardContent></Card> : quality.error ? <Card className="border-destructive/30 bg-destructive/10"><CardContent className="py-5 text-sm text-destructive">تعذر تحميل لوحة الجودة: {quality.error.message}</CardContent></Card> : data ? <>
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><QualityMetric label="أدوات سوقية مراقبة" value={data.instruments.monitored} /><QualityMetric label="أدوات ذات لقطة صالحة" value={data.instruments.covered} /><QualityMetric label="أسعار أدوات متقادمة" value={data.instruments.stale} tone="alert" /><QualityMetric label="أسعار أدوات مفقودة" value={data.instruments.missing} tone="alert" /></section>
      <section className="grid gap-6 lg:grid-cols-[1.05fr_.95fr]"><Card className="fintech-surface-card"><CardHeader><CardTitle className="flex items-center gap-2"><DatabaseZap className="size-5 text-primary" />تغطية أسعار الأدوات</CardTitle><CardDescription>تراقب الأدوات ذات الرمز المسجل من الأسهم والصناديق والذهب. تعالج اللقطة كتقادمة بعد {data.staleAfterHours} ساعة.</CardDescription></CardHeader><CardContent className="space-y-4"><div className="grid grid-cols-2 gap-3 sm:grid-cols-4"><QualityMetric label="مغطاة" value={data.instruments.covered} /><QualityMetric label="متأخرة" value={data.instruments.delayed} /><QualityMetric label="متقادمة" value={data.instruments.stale} tone="alert" /><QualityMetric label="مفقودة" value={data.instruments.missing} tone="alert" /></div>{data.instruments.entries.length ? <div className="overflow-x-auto"><table className="w-full min-w-[680px] text-right text-sm"><thead className="bg-muted/70 text-xs text-muted-foreground"><tr><th className="p-3">الأداة</th><th className="p-3">الرمز</th><th className="p-3">المصدر</th><th className="p-3">حالة اللقطة</th><th className="p-3">آخر تحديث</th></tr></thead><tbody className="divide-y">{data.instruments.entries.map(item => <tr key={item.id}><td className="p-3 font-semibold">{item.name}</td><td className="p-3 text-muted-foreground" dir="ltr">{item.symbol}</td><td className="p-3 text-muted-foreground">{item.source || "—"}</td><td className="p-3"><Badge variant={statusVariant(item.quoteStatus)}>{quoteStatusLabel[item.quoteStatus] || item.quoteStatus}</Badge></td><td className="p-3 text-muted-foreground">{formatDateTime(item.asOf)}</td></tr>)}</tbody></table></div> : <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">لا توجد أدوات سوقية ذات رمز مسجل لمراقبتها بعد.</p>}</CardContent></Card>
        <Card className="fintech-surface-card"><CardHeader><CardTitle className="flex items-center gap-2"><Globe2 className="size-5 text-primary" />تغطية أسعار الصرف</CardTitle><CardDescription>تُقارن العملات المستخدمة بعملة الأساس في مساحة FAMILY. لا تظهر هذه اللوحة أي رصيد أو سعر صرف عددي.</CardDescription></CardHeader><CardContent className="space-y-4"><div className="grid grid-cols-3 gap-3"><QualityMetric label="مطلوبة" value={data.fx.required} /><QualityMetric label="مغطاة" value={data.fx.covered} /><QualityMetric label="فجوات أو تقادم" value={data.fx.missing + data.fx.stale} tone="alert" /></div>{data.fx.entries.length ? <div className="space-y-3">{data.fx.entries.map(item => <div key={item.currency} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-muted/25 p-4"><div><p className="font-bold" dir="ltr">{item.currency}</p><p className="mt-1 text-xs text-muted-foreground">{item.source || "لا يوجد مصدر مسجل"} · {formatDateTime(item.asOf)}</p></div><Badge variant={statusVariant(item.rateStatus)}>{quoteStatusLabel[item.rateStatus] || item.rateStatus}</Badge></div>)}</div> : <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">لا توجد عملات تحتاج تحويلًا إلى عملة الأساس حاليًا.</p>}</CardContent></Card></section>
      <Card className="fintech-surface-card"><CardContent className="flex flex-wrap items-start gap-3 py-5 text-sm text-muted-foreground"><ShieldCheck className="size-5 shrink-0 text-emerald-600" /><div><strong className="text-foreground">حدود الحوكمة محفوظة.</strong><p className="mt-1">تحسن هذه الشاشة شفافية جودة البيانات فقط. يظل تحديث Yahoo أو السعر اليدوي إجراءً صريحًا في شاشة التقييم، وتبقى الصفقات وإعادة التقييم خاضعة للدفتر المتوازن والاعتماد البشري.</p></div></CardContent></Card>
    </> : null}
  </main></DashboardLayout>;
}
