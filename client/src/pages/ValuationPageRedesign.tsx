import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CircleAlert, Clock3, Gauge, Globe2, Loader2, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";

const errorText = (error: unknown) => error instanceof Error ? error.message : "تعذر إكمال العملية الآن.";

export default function ValuationPageRedesign() {
  const utils = trpc.useUtils();
  const dashboard = trpc.family.dashboard.useQuery();
  const bootstrap = trpc.family.bootstrap.useQuery();
  const valuationHistory = trpc.family.valuation.history.useQuery({ limit: 50 });
  const officialLatest = trpc.family.valuation.officialLatest.useQuery();
  const [fromCurrency, setFromCurrency] = useState("");
  const [rate, setRate] = useState("");
  const canAdvise = ["owner", "advisor"].includes(bootstrap.data?.membership.role || "");
  const record = trpc.family.fx.recordManual.useMutation({
    onSuccess: () => {
      toast.success("تم حفظ سعر الصرف مع مصدره وتاريخه.");
      setRate("");
      void utils.family.dashboard.invalidate();
      void utils.family.accounts.list.invalidate();
      void utils.family.portfolio.list.invalidate();
    },
    onError: error => toast.error(errorText(error)),
  });
  const captureOfficial = trpc.family.valuation.captureOfficial.useMutation({
    onSuccess: result => {
      toast.success(result.status === "official" ? "تم حفظ لقطة تقرير رسمية." : "تم حفظ اللقطة مع حالة مراجعة بسبب جودة البيانات.");
      void officialLatest.refetch();
    },
    onError: error => toast.error(errorText(error)),
  });
  const refreshYahoo = trpc.family.fx.refreshYahoo.useMutation({
    onSuccess: data => {
      if (data.skipped) toast.message(data.message);
      else toast.success(`تم جلب سعر ${data.fromCurrency}/${data.toCurrency} من Yahoo Finance.`);
      void utils.family.dashboard.invalidate();
      void utils.family.accounts.list.invalidate();
      void utils.family.portfolio.list.invalidate();
    },
    onError: error => toast.error(errorText(error)),
  });
  const gaps = dashboard.data ? [...dashboard.data.unvaluedCurrencies, ...dashboard.data.unvaluedInstruments, ...(dashboard.data.staleFxCurrencies ?? []).map(currency => `سعر صرف متقادم: ${currency}`)] : [];
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const baseCurrency = dashboard.data?.workspace.baseCurrency;
    if (!baseCurrency) return;
    record.mutate({ fromCurrency, toCurrency: baseCurrency, rate, asOf: Date.now() });
  };

  return <DashboardLayout><main className="mx-auto max-w-6xl space-y-6" dir="rtl">
    <header className="border-b pb-6">
      <p className="text-xs font-semibold uppercase tracking-[.15em] text-emerald-700">FAMILY / VALUATION CONTROL</p>
      <h1 className="mt-2 text-3xl font-bold">التقييم والعملات</h1>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3"><p className="max-w-3xl text-sm leading-6 text-slate-500">تظل القيمة الإجمالية مشروطة بسعر سوق أو صرف مؤرخ ومصدر واضح. سعر Yahoo قد يكون متأخرًا، ولا تمثل هذه الصفحة تنفيذًا أو توصية.</p><Link href="/data-quality" className="inline-flex h-9 items-center rounded-lg border border-primary/25 bg-primary/5 px-3 text-sm font-semibold text-primary transition-colors hover:bg-primary/10"><Gauge className="ml-2 size-4" />جودة بيانات السوق</Link></div>
    </header>
    <section className="grid gap-6 lg:grid-cols-[.85fr_1.15fr]">
      <Card className="fintech-surface-card"><CardHeader><CardTitle className="flex items-center gap-2"><Globe2 className="size-5 text-primary" />تحديث سعر الصرف</CardTitle><CardDescription>ابحث في Yahoo Finance عن زوج العملة مقابل عملة الأساس، أو سجّل بديلًا يدويًا موثقًا.</CardDescription></CardHeader><CardContent><form className="grid gap-4" onSubmit={submit}><div className="grid gap-3 sm:grid-cols-2"><div className="grid gap-2"><Label htmlFor="fx-from">من العملة</Label><Input id="fx-from" value={fromCurrency} onChange={event => setFromCurrency(event.target.value.toUpperCase())} minLength={3} maxLength={3} placeholder="USD" required /></div><div className="grid gap-2"><Label>إلى عملة الأساس</Label><Input value={dashboard.data?.workspace.baseCurrency || "—"} disabled /></div></div><Button type="button" variant="outline" disabled={!canAdvise || !fromCurrency || refreshYahoo.isPending} onClick={() => refreshYahoo.mutate({ fromCurrency })}>{refreshYahoo.isPending && <Loader2 className="ml-2 size-4 animate-spin" />}تحديث من Yahoo Finance</Button><div className="grid gap-2"><Label htmlFor="fx-rate">سعر يدوي بديل</Label><Input id="fx-rate" inputMode="decimal" value={rate} onChange={event => setRate(event.target.value)} required /></div><Button type="submit" disabled={!canAdvise || record.isPending}>{record.isPending && <Loader2 className="ml-2 size-4 animate-spin" />}{canAdvise ? "حفظ السعر اليدوي" : "تتطلب صلاحية مستشار"}</Button></form></CardContent></Card>
      <Card className="fintech-surface-card"><CardHeader><CardTitle>فجوات التقييم</CardTitle><CardDescription>إشارات حالة تستند فقط إلى الحسابات والحيازات المسجلة في مساحة FAMILY.</CardDescription></CardHeader><CardContent>{dashboard.isLoading ? <p className="py-12 text-center text-sm text-muted-foreground">جارٍ فحص تغطية الأسعار…</p> : dashboard.error ? <p className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">{errorText(dashboard.error)}</p> : gaps.length ? <div className="space-y-3">{gaps.map(gap => <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950" key={gap}><CircleAlert className="mt-0.5 size-4 shrink-0" /><p>يلزم إدخال سعر موثق أو سعر صرف حديث للبيان: <strong>{gap}</strong>.</p></div>)}</div> : <div className="fintech-empty-state"><Globe2 className="fintech-empty-state-icon" /><h3>لا توجد فجوات تقييم حاليًا</h3><p>تتوفر الأسعار اللازمة للبيانات المسجلة. راجع المصدر والتاريخ قبل اتخاذ قرار مالي.</p></div>}</CardContent></Card>
    </section>
    <Card className="fintech-surface-card"><CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="size-5 text-primary" />اللقطة الرسمية للتقرير</CardTitle><CardDescription>لقطة مؤرخة لصافي الثروة ومكوناته، تُحفظ كقراءة تقريرية مستقلة ولا تنشئ قيدًا أو إعادة تقييم.</CardDescription></CardHeader><CardContent><div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between"><div>{officialLatest.isLoading ? <p className="text-sm text-muted-foreground">جارٍ تحميل آخر لقطة…</p> : officialLatest.data ? <><p className="text-sm font-semibold">الحالة: <span className={officialLatest.data.status === "official" ? "text-emerald-700" : "text-amber-700"}>{officialLatest.data.status === "official" ? "رسمية" : officialLatest.data.status === "review_required" ? "تحتاج مراجعة" : "غير متاحة"}</span> · جودة البيانات: {officialLatest.data.quality}</p><p className="mt-1 text-xs text-muted-foreground">التقييم: {new Date(officialLatest.data.valuationAsOf).toLocaleString()} · الالتقاط: {new Date(officialLatest.data.capturedAt).toLocaleString()} · عملة الأساس: {officialLatest.data.baseCurrency}</p><p className="mt-2 text-sm text-muted-foreground">صافي الثروة: {officialLatest.data.netWorthBase ?? "غير متاح"} · الاستثمار: {officialLatest.data.investmentValueBase ?? "غير متاح"} · الالتزامات: {officialLatest.data.liabilityBalanceBase ?? "غير متاح"}</p>{Array.isArray(officialLatest.data.warnings) && officialLatest.data.warnings.length > 0 && <p className="mt-2 text-xs text-amber-700">تحذيرات: {officialLatest.data.warnings.slice(0, 3).join(" · ")}</p>}</> : <p className="text-sm text-muted-foreground">لم تُحفظ لقطة رسمية بعد.</p>}</div><Button disabled={!canAdvise || captureOfficial.isPending} onClick={() => captureOfficial.mutate()}>{captureOfficial.isPending && <Loader2 className="ml-2 size-4 animate-spin" />}{canAdvise ? "التقاط لقطة تقرير" : "تتطلب صلاحية مستشار"}</Button></div></CardContent></Card>
    <Card className="fintech-surface-card"><CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="size-5 text-primary" />سجل مصادر التقييم</CardTitle><CardDescription>لقطات تاريخية للبيانات الخارجية، مرتبطة بمصدرها دون تعديل القيود أو إنشاء إعادة تقييم تلقائية.</CardDescription></CardHeader><CardContent>{valuationHistory.isLoading ? <p className="py-8 text-center text-sm text-muted-foreground">جارٍ تحميل سجل التقييم…</p> : valuationHistory.error ? <p className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">{errorText(valuationHistory.error)}</p> : valuationHistory.data?.length ? <div className="space-y-3">{valuationHistory.data.map(item => <div className="grid gap-3 rounded-xl border border-border/70 bg-background/50 p-4 text-sm md:grid-cols-[1fr_auto]" key={item.id}><div><p className="font-semibold">{item.provenance.normalizedSymbol || item.provenance.source}</p><p className="mt-1 text-muted-foreground">{item.provenance.provider} · {item.provenance.status} · {item.quality}</p><p className="mt-1 text-xs text-muted-foreground"><Clock3 className="ml-1 inline size-3" />المصدر: {new Date(item.asOf).toLocaleString()} · الالتقاط: {new Date(item.capturedAt).toLocaleString()}</p></div><div className="text-left text-xs text-muted-foreground"><p>Provenance #{item.provenance.id}</p><p>Snapshot #{item.id}</p>{item.quoteId && <p>Quote #{item.quoteId}</p>}</div></div>)}</div> : <div className="fintech-empty-state"><ShieldCheck className="fintech-empty-state-icon" /><h3>لا توجد لقطات تقييم بعد</h3><p>ستظهر هنا لقطات السوق الجديدة بعد التحديث، مع مصدرها وتوقيتها وحالتها.</p></div>}</CardContent></Card>
  </main></DashboardLayout>;
}
