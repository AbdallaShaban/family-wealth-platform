import DashboardLayout from "@/components/DashboardLayout";
import PageHeader from "@/components/PageHeader";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CircleAlert, Clock3, Gauge, Globe2, Loader2, ShieldCheck, RefreshCw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";

const errorText = (error: unknown) => (error instanceof Error ? error.message : "تعذر إكمال العملية الآن.");

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

  const gaps = dashboard.data
    ? [
        ...dashboard.data.unvaluedCurrencies,
        ...dashboard.data.unvaluedInstruments,
        ...(dashboard.data.staleFxCurrencies ?? []).map(currency => `سعر صرف متقادم: ${currency}`),
      ]
    : [];

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const baseCurrency = dashboard.data?.workspace.baseCurrency;
    if (!baseCurrency) return;
    record.mutate({ fromCurrency, toCurrency: baseCurrency, rate, asOf: Date.now() });
  };

  return (
    <DashboardLayout>
      <main className="mx-auto max-w-6xl space-y-6" dir="rtl">
        <PageHeader
          title="تقييم الأصول وأسعار الصرف"
          description="تظل القيمة الإجمالية مشروطة بسعر سوق أو صرف مؤرخ ومصدر واضح. سعر Yahoo قد يكون متأخرًا، ولا تمثل هذه الصفحة تنفيذًا أو توصية."
          icon={Globe2}
          breadcrumbs={[
            { label: "الرئيسية", href: "/" },
            { label: "النظرة المالية والتقييم", href: "/valuation" },
            { label: "تقييم الأصول وأسعار الصرف" },
          ]}
          badge={{ text: "مراقبة واعتماد الأسعار", variant: "institutional" }}
        />

        {/* Sub-navigation segmented toggle pill */}
        <div className="bg-slate-100/90 dark:bg-[#0E1420] p-1.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 inline-flex gap-1 mb-2">
          <Link
            href="/valuation"
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all bg-white dark:bg-[#1A2234] text-slate-900 dark:text-white shadow-xs border border-slate-200/60 dark:border-slate-700/60"
          >
            <Globe2 className="size-4" />
            تقييم الأصول وأسعار الصرف
          </Link>
          <Link
            href="/data-quality"
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-800/40"
          >
            <Gauge className="size-4" />
            جودة بيانات وتسعير السوق
          </Link>
        </div>

        <section className="grid gap-6 lg:grid-cols-[.85fr_1.15fr]">
          {/* تحديث سعر الصرف */}
          <div className="bg-white dark:bg-[#0B0F17] border border-slate-200/90 dark:border-slate-800/80 rounded-2xl p-6 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800/80 mb-5">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
                    <div className="size-8 rounded-xl bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 flex items-center justify-center">
                      <Globe2 className="size-4 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    تحديث سعر الصرف
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    ابحث في Yahoo Finance عن زوج العملة مقابل عملة الأساس، أو سجّل بديلًا يدويًا موثقًا.
                  </p>
                </div>
              </div>

              <form className="grid gap-4" onSubmit={submit}>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="fx-from" className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      من العملة
                    </Label>
                    <Input
                      id="fx-from"
                      value={fromCurrency}
                      onChange={event => setFromCurrency(event.target.value.toUpperCase())}
                      minLength={3}
                      maxLength={3}
                      placeholder="USD"
                      required
                      className="bg-white dark:bg-[#0E1420] border border-slate-300 dark:border-slate-700/80 text-slate-900 dark:text-slate-100 rounded-xl font-medium text-xs py-2.5 px-3 focus:ring-1 focus:ring-slate-800 font-mono uppercase"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      إلى عملة الأساس
                    </Label>
                    <Input
                      value={dashboard.data?.workspace.baseCurrency || "—"}
                      disabled
                      className="bg-slate-50 dark:bg-[#0E1420]/50 border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 rounded-xl font-medium text-xs py-2.5 px-3 font-mono cursor-not-allowed"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  disabled={!canAdvise || !fromCurrency || refreshYahoo.isPending}
                  onClick={() => refreshYahoo.mutate({ fromCurrency })}
                  className="w-full bg-white hover:bg-slate-50 text-slate-800 font-semibold text-xs py-2.5 px-4 rounded-xl border border-slate-200/90 dark:bg-[#0E1420] dark:hover:bg-slate-800/60 dark:text-slate-200 dark:border-slate-800 shadow-2xs transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {refreshYahoo.isPending ? (
                    <Loader2 className="ml-1.5 size-4 animate-spin" />
                  ) : (
                    <RefreshCw className="ml-1.5 size-3.5" />
                  )}
                  تحديث من Yahoo Finance
                </button>

                <div className="grid gap-2 pt-1">
                  <Label htmlFor="fx-rate" className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    سعر يدوي بديل
                  </Label>
                  <Input
                    id="fx-rate"
                    inputMode="decimal"
                    value={rate}
                    onChange={event => setRate(event.target.value)}
                    placeholder="مثال: 3.75"
                    required
                    className="bg-white dark:bg-[#0E1420] border border-slate-300 dark:border-slate-700/80 text-slate-900 dark:text-slate-100 rounded-xl font-medium text-xs py-2.5 px-3 focus:ring-1 focus:ring-slate-800 font-mono"
                  />
                </div>

                <button
                  type="submit"
                  disabled={!canAdvise || record.isPending}
                  className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs py-2.5 px-4 rounded-xl shadow-sm transition-all dark:bg-white dark:hover:bg-slate-100 dark:text-slate-950 border border-slate-900 dark:border-transparent mt-3 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {record.isPending && <Loader2 className="ml-1.5 size-4 animate-spin" />}
                  {canAdvise ? "حفظ السعر اليدوي" : "تتطلب صلاحية مستشار"}
                </button>
              </form>
            </div>
          </div>

          {/* فجوات التقييم */}
          <div className="bg-white dark:bg-[#0B0F17] border border-slate-200/90 dark:border-slate-800/80 rounded-2xl p-6 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800/80 mb-5">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
                    <div className="size-8 rounded-xl bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 flex items-center justify-center">
                      <CircleAlert className="size-4 text-amber-600 dark:text-amber-400" />
                    </div>
                    فجوات التقييم
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    إشارات حالة تستند فقط إلى الحسابات والحيازات المسجلة في مساحة FAMILY.
                  </p>
                </div>
              </div>

              {dashboard.isLoading ? (
                <p className="py-12 text-center text-xs text-slate-500 dark:text-slate-400">جارٍ فحص تغطية الأسعار…</p>
              ) : dashboard.error ? (
                <p className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-xs text-destructive">
                  {errorText(dashboard.error)}
                </p>
              ) : gaps.length ? (
                <div className="space-y-3">
                  {gaps.map(gap => (
                    <div
                      key={gap}
                      className="flex items-start gap-3 rounded-xl border border-amber-200/80 bg-amber-50/60 dark:border-amber-800/40 dark:bg-amber-950/30 p-4 text-xs text-amber-950 dark:text-amber-200 font-medium"
                    >
                      <CircleAlert className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
                      <p>
                        يلزم إدخال سعر موثق أو سعر صرف حديث للبيان: <strong>{gap}</strong>.
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-10">
                  <div className="size-12 rounded-2xl bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-center mx-auto mb-3">
                    <ShieldCheck className="size-6 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1">لا توجد فجوات تقييم حاليًا</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                    تتوفر الأسعار اللازمة للبيانات المسجلة. راجع المصدر والتاريخ قبل اتخاذ قرار مالي.
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* اللقطة الرسمية للتقرير */}
        <div className="bg-white dark:bg-[#0B0F17] border border-slate-200/90 dark:border-slate-800/80 rounded-2xl p-6 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800/80 mb-5">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
                <div className="size-8 rounded-xl bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 flex items-center justify-center">
                  <ShieldCheck className="size-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                اللقطة الرسمية للتقرير
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                لقطة مؤرخة لصافي الثروة ومكوناته، تُحفظ كقراءة تقريرية مستقلة ولا تنشئ قيدًا أو إعادة تقييم.
              </p>
            </div>
            <button
              disabled={!canAdvise || captureOfficial.isPending}
              onClick={() => captureOfficial.mutate()}
              className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs py-2 px-3.5 rounded-xl shadow-sm transition-all dark:bg-white dark:hover:bg-slate-100 dark:text-slate-950 disabled:opacity-50 disabled:cursor-not-allowed shrink-0 cursor-pointer"
            >
              {captureOfficial.isPending && <Loader2 className="ml-1.5 size-4 animate-spin" />}
              {canAdvise ? "التقاط لقطة تقرير" : "تتطلب صلاحية مستشار"}
            </button>
          </div>

          <div>
            {officialLatest.isLoading ? (
              <p className="py-6 text-center text-xs text-slate-500 dark:text-slate-400">جارٍ تحميل آخر لقطة…</p>
            ) : officialLatest.data ? (
              <div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                  <div className="rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-slate-50/50 dark:bg-[#0E1420]/60 p-3.5">
                    <span className="text-xs text-slate-500 dark:text-slate-400 block mb-1 font-medium">صافي الثروة المؤرخ</span>
                    <span className="font-mono text-base font-bold text-slate-900 dark:text-white tabular-nums">
                      {officialLatest.data.netWorthBase != null
                        ? Number(officialLatest.data.netWorthBase).toLocaleString("en-US", { maximumFractionDigits: 2 })
                        : "غير متاح"}{" "}
                      <span className="text-xs text-slate-500">{officialLatest.data.baseCurrency}</span>
                    </span>
                  </div>
                  <div className="rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-slate-50/50 dark:bg-[#0E1420]/60 p-3.5">
                    <span className="text-xs text-slate-500 dark:text-slate-400 block mb-1 font-medium">إجمالي الاستثمارات</span>
                    <span className="font-mono text-base font-bold text-slate-900 dark:text-white tabular-nums">
                      {officialLatest.data.investmentValueBase != null
                        ? Number(officialLatest.data.investmentValueBase).toLocaleString("en-US", { maximumFractionDigits: 2 })
                        : "غير متاح"}{" "}
                      <span className="text-xs text-slate-500">{officialLatest.data.baseCurrency}</span>
                    </span>
                  </div>
                  <div className="rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-slate-50/50 dark:bg-[#0E1420]/60 p-3.5">
                    <span className="text-xs text-slate-500 dark:text-slate-400 block mb-1 font-medium">إجمالي الالتزامات</span>
                    <span className="font-mono text-base font-bold text-slate-900 dark:text-white tabular-nums">
                      {officialLatest.data.liabilityBalanceBase != null
                        ? Number(officialLatest.data.liabilityBalanceBase).toLocaleString("en-US", { maximumFractionDigits: 2 })
                        : "غير متاح"}{" "}
                      <span className="text-xs text-slate-500">{officialLatest.data.baseCurrency}</span>
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400 pt-3 border-t border-slate-100 dark:border-slate-800/60">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">حالة اللقطة:</span>
                    <span
                      className={
                        officialLatest.data.status === "official"
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200/80 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800/70 font-bold text-[11px] px-2.5 py-0.5 rounded-lg"
                          : "bg-amber-50 text-amber-700 border border-amber-200/80 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800/70 font-bold text-[11px] px-2.5 py-0.5 rounded-lg"
                      }
                    >
                      {officialLatest.data.status === "official"
                        ? "رسمية معتمدة"
                        : officialLatest.data.status === "review_required"
                        ? "تحتاج مراجعة"
                        : "غير متاحة"}
                    </span>
                    <span className="mr-3">
                      جودة البيانات: <strong className="text-slate-700 dark:text-slate-300 font-mono">{officialLatest.data.quality}</strong>
                    </span>
                  </div>

                  <div className="flex items-center gap-3 font-mono text-[11px]">
                    <span>تاريخ التقييم: {new Date(officialLatest.data.valuationAsOf).toLocaleString("ar-EG")}</span>
                    <span>•</span>
                    <span>الالتقاط: {new Date(officialLatest.data.capturedAt).toLocaleString("ar-EG")}</span>
                  </div>
                </div>

                {Array.isArray(officialLatest.data.warnings) && officialLatest.data.warnings.length > 0 && (
                  <div className="mt-3 p-3 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/40 text-xs text-amber-900 dark:text-amber-200 font-medium">
                    تحذيرات الجودة: {officialLatest.data.warnings.slice(0, 3).join(" · ")}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-6">
                <div className="size-12 rounded-2xl bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-center mx-auto mb-3">
                  <ShieldCheck className="size-6 text-slate-400 dark:text-slate-500" />
                </div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1">لم تُحفظ لقطة رسمية بعد</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                  يمكنك التقاط لقطة مؤرخة ومعتمدة لصافي الثروة عند اكتمال مراجعة وتحديث أسعار الأصول.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* سجل مصادر التقييم */}
        <div className="bg-white dark:bg-[#0B0F17] border border-slate-200/90 dark:border-slate-800/80 rounded-2xl p-6 shadow-xs">
          <div className="pb-4 border-b border-slate-100 dark:border-slate-800/80 mb-5">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
              <div className="size-8 rounded-xl bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 flex items-center justify-center">
                <Clock3 className="size-4 text-sky-600 dark:text-sky-400" />
              </div>
              سجل مصادر التقييم
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              لقطات تاريخية للبيانات الخارجية، مرتبطة بمصدرها دون تعديل القيود أو إنشاء إعادة تقييم تلقائية.
            </p>
          </div>

          {valuationHistory.isLoading ? (
            <p className="py-8 text-center text-xs text-slate-500 dark:text-slate-400">جارٍ تحميل سجل التقييم…</p>
          ) : valuationHistory.error ? (
            <p className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-xs text-destructive">
              {errorText(valuationHistory.error)}
            </p>
          ) : valuationHistory.data?.length ? (
            <div className="space-y-2.5">
              {valuationHistory.data.map(item => (
                <div
                  key={item.id}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-slate-50/50 dark:bg-[#0E1420]/60 p-4 text-xs"
                >
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-slate-900 dark:text-white font-mono">
                        {item.provenance.normalizedSymbol || item.provenance.source}
                      </span>
                      <span className="bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded-md font-semibold text-[10px]">
                        {item.provenance.provider}
                      </span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">
                        الحالة: {item.provenance.status} · الجودة: {item.quality}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                      <Clock3 className="size-3 shrink-0" />
                      <span>المصدر: {new Date(item.asOf).toLocaleString("ar-EG")}</span>
                      <span>•</span>
                      <span>الالتقاط: {new Date(item.capturedAt).toLocaleString("ar-EG")}</span>
                    </div>
                  </div>
                  <div className="text-left font-mono text-[11px] text-slate-500 dark:text-slate-400 shrink-0">
                    <div>Provenance #{item.provenance.id}</div>
                    <div>Snapshot #{item.id}</div>
                    {item.quoteId && <div>Quote #{item.quoteId}</div>}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="size-12 rounded-2xl bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-center mx-auto mb-3">
                <Clock3 className="size-6 text-slate-400 dark:text-slate-500" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1">لا توجد لقطات تقييم بعد</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                ستظهر هنا لقطات السوق الجديدة بعد التحديث، مع مصدرها وتوقيتها وحالتها.
              </p>
            </div>
          )}
        </div>
      </main>
    </DashboardLayout>
  );
}
