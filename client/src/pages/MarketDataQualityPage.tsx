import DashboardLayout from "@/components/DashboardLayout";
import PageHeader from "@/components/PageHeader";
import { CircleAlert, DatabaseZap, Gauge, Globe2, ShieldCheck, Clock3 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";

const formatDateTime = (value: number | null) =>
  value
    ? new Intl.DateTimeFormat("ar-EG", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value))
    : "لا توجد لقطة";

const quoteStatusLabel: Record<string, string> = {
  live: "حي",
  delayed: "متأخر",
  manual: "يدوي موثق",
  last_known: "آخر سعر معروف",
  stale: "متقادم",
  unavailable: "غير متاح",
  base_currency: "عملة الأساس",
};

export default function MarketDataQualityPage() {
  const quality = trpc.family.marketDataQuality.useQuery();
  const data = quality.data;

  return (
    <DashboardLayout>
      <main className="mx-auto max-w-7xl space-y-6" dir="rtl">
        <PageHeader
          title="جودة بيانات وتسعير السوق"
          description="لوحة تشغيلية للمتابعة فقط: تعرض تغطية السعر والمصدر وتاريخ اللقطة وحالة التقادم، ولا تعرض قيمًا مالية ولا تحدّث أسعارًا ولا تنشئ أي صفقة أو قيد."
          breadcrumbs={[
            { label: "الرئيسية", href: "/" },
            { label: "النظرة المالية والتقييم", href: "/valuation" },
            { label: "جودة بيانات وتسعير السوق" },
          ]}
          badge={{ text: "مراقبة فقط", variant: "institutional" }}
          icon={DatabaseZap}
        />

        {/* Sub-navigation segmented toggle pill */}
        <div className="bg-slate-100/90 dark:bg-[#0E1420] p-1.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 inline-flex gap-1 mb-2">
          <Link
            href="/valuation"
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-800/40"
          >
            <Globe2 className="size-4" />
            تقييم الأصول وأسعار الصرف
          </Link>
          <Link
            href="/data-quality"
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all bg-white dark:bg-[#1A2234] text-slate-900 dark:text-white shadow-xs border border-slate-200/60 dark:border-slate-700/60"
          >
            <Gauge className="size-4" />
            جودة بيانات وتسعير السوق
          </Link>
        </div>

        {quality.isLoading ? (
          <div className="bg-white dark:bg-[#0B0F17] border border-slate-200/90 dark:border-slate-800/80 rounded-2xl p-14 text-center text-xs text-slate-500 dark:text-slate-400">
            جارٍ تحليل تغطية السعر والصرف…
          </div>
        ) : quality.error ? (
          <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-5 text-xs text-destructive">
            تعذر تحميل لوحة الجودة: {quality.error.message}
          </div>
        ) : data ? (
          <>
            {/* Top 4-Column Executive Metric Strip with Bulletproof Dividers */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 bg-white dark:bg-[#0B0F17] border border-slate-200/90 dark:border-slate-800/80 rounded-2xl shadow-xs overflow-hidden mb-6">
              {/* Cell 1: أدوات موثقة بمرجعية */}
              <div className="p-5 flex flex-col justify-between border-b sm:border-b-0 lg:border-b-0 lg:border-l border-slate-200/80 dark:border-slate-800/80">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">أدوات موثقة بمرجعية</span>
                  <div className="size-8 rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 flex items-center justify-center">
                    <ShieldCheck className="size-4" />
                  </div>
                </div>
                <div className="text-slate-900 dark:text-white font-bold font-mono text-xl sm:text-2xl tabular-nums">
                  {data.instruments.covered}
                </div>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-medium">
                  من إجمالي {data.instruments.monitored} أداة مراقبة
                </span>
              </div>

              {/* Cell 2: أدوات ذات تنبيه معلق */}
              <div className="p-5 flex flex-col justify-between border-b sm:border-b-0 lg:border-b-0 lg:border-l border-slate-200/80 dark:border-slate-800/80">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">أدوات ذات تنبيه معلق</span>
                  <div className="size-8 rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400 flex items-center justify-center">
                    <CircleAlert className="size-4" />
                  </div>
                </div>
                <div className="text-slate-900 dark:text-white font-bold font-mono text-xl sm:text-2xl tabular-nums">
                  {data.instruments.delayed}
                </div>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-medium">
                  أسعار متأخرة عن وقت التداول
                </span>
              </div>

              {/* Cell 3: أسعار أدوات متقادمة */}
              <div className="p-5 flex flex-col justify-between border-b sm:border-b-0 lg:border-b-0 lg:border-l border-slate-200/80 dark:border-slate-800/80">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">أسعار أدوات متقادمة</span>
                  <div className="size-8 rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400 flex items-center justify-center">
                    <Clock3 className="size-4" />
                  </div>
                </div>
                <div className="text-slate-900 dark:text-white font-bold font-mono text-xl sm:text-2xl tabular-nums">
                  {data.instruments.stale}
                </div>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-medium">
                  تجاوزت {data.staleAfterHours} ساعة بدون تحديث
                </span>
              </div>

              {/* Cell 4: أسعار أدوات مفقودة */}
              <div className="p-5 flex flex-col justify-between border-b-0 lg:border-l-0">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">أسعار أدوات مفقودة</span>
                  <div className="size-8 rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400 flex items-center justify-center">
                    <DatabaseZap className="size-4" />
                  </div>
                </div>
                <div className="text-slate-900 dark:text-white font-bold font-mono text-xl sm:text-2xl tabular-nums">
                  {data.instruments.missing}
                </div>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-medium">
                  لا توجد لها لقطة مسجلة
                </span>
              </div>
            </div>

            {/* Coverage Tables & Details */}
            <section className="grid gap-6 lg:grid-cols-[1.05fr_.95fr]">
              {/* Card 1: تغطية أسعار الأدوات */}
              <div className="bg-white dark:bg-[#0B0F17] border border-slate-200/90 dark:border-slate-800/80 rounded-2xl p-6 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800/80 mb-5">
                    <div>
                      <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
                        <div className="size-8 rounded-xl bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 flex items-center justify-center">
                          <DatabaseZap className="size-4 text-indigo-600 dark:text-indigo-400" />
                        </div>
                        تغطية أسعار الأدوات
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        تراقب الأدوات ذات الرمز المسجل من الأسهم والصناديق والذهب. تعالج اللقطة كتقادمة بعد {data.staleAfterHours} ساعة.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-4">
                    <div className="rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-slate-50/50 dark:bg-[#0E1420]/60 p-3">
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 block mb-0.5 font-medium">مغطاة</span>
                      <span className="font-mono text-lg font-bold text-slate-900 dark:text-white tabular-nums">{data.instruments.covered}</span>
                    </div>
                    <div className="rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-slate-50/50 dark:bg-[#0E1420]/60 p-3">
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 block mb-0.5 font-medium">متأخرة</span>
                      <span className="font-mono text-lg font-bold text-amber-600 dark:text-amber-400 tabular-nums">{data.instruments.delayed}</span>
                    </div>
                    <div className="rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-slate-50/50 dark:bg-[#0E1420]/60 p-3">
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 block mb-0.5 font-medium">متقادمة</span>
                      <span className="font-mono text-lg font-bold text-rose-600 dark:text-rose-400 tabular-nums">{data.instruments.stale}</span>
                    </div>
                    <div className="rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-slate-50/50 dark:bg-[#0E1420]/60 p-3">
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 block mb-0.5 font-medium">مفقودة</span>
                      <span className="font-mono text-lg font-bold text-indigo-600 dark:text-indigo-400 tabular-nums">{data.instruments.missing}</span>
                    </div>
                  </div>

                  {data.instruments.entries.length ? (
                    <div className="overflow-x-auto rounded-xl border border-slate-200/80 dark:border-slate-800/80">
                      <table className="w-full text-right text-xs">
                        <thead className="bg-slate-100/80 dark:bg-[#0E1420] text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200/80 dark:border-slate-800">
                          <tr>
                            <th className="p-3">الأداة</th>
                            <th className="p-3">الرمز</th>
                            <th className="p-3">المصدر</th>
                            <th className="p-3">حالة اللقطة</th>
                            <th className="p-3">آخر تحديث</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 bg-white dark:bg-[#0B0F17]">
                          {data.instruments.entries.map(item => (
                            <tr key={item.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                              <td className="p-3 font-semibold text-slate-900 dark:text-white">{item.name}</td>
                              <td className="p-3 font-mono font-bold text-slate-600 dark:text-slate-400" dir="ltr">
                                {item.symbol}
                              </td>
                              <td className="p-3 text-slate-500 dark:text-slate-400">{item.source || "—"}</td>
                              <td className="p-3">
                                <span
                                  className={
                                    item.quoteStatus === "live"
                                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200/80 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800/70 font-bold text-[11px] px-2.5 py-0.5 rounded-lg inline-block"
                                      : item.quoteStatus === "delayed"
                                      ? "bg-amber-50 text-amber-700 border border-amber-200/80 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800/70 font-bold text-[11px] px-2.5 py-0.5 rounded-lg inline-block"
                                      : item.quoteStatus === "stale"
                                      ? "bg-rose-50 text-rose-700 border border-rose-200/80 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800/70 font-bold text-[11px] px-2.5 py-0.5 rounded-lg inline-block"
                                      : "bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 font-bold text-[11px] px-2.5 py-0.5 rounded-lg inline-block"
                                  }
                                >
                                  {quoteStatusLabel[item.quoteStatus] || item.quoteStatus}
                                </span>
                              </td>
                              <td className="p-3 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                                {formatDateTime(item.asOf)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="rounded-xl border border-dashed border-slate-300 dark:border-slate-750 p-6 text-center text-xs text-slate-500 dark:text-slate-400">
                      لا توجد أدوات سوقية ذات رمز مسجل لمراقبتها بعد.
                    </p>
                  )}
                </div>
              </div>

              {/* Card 2: تغطية أسعار الصرف */}
              <div className="bg-white dark:bg-[#0B0F17] border border-slate-200/90 dark:border-slate-800/80 rounded-2xl p-6 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800/80 mb-5">
                    <div>
                      <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
                        <div className="size-8 rounded-xl bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 flex items-center justify-center">
                          <Globe2 className="size-4 text-sky-600 dark:text-sky-400" />
                        </div>
                        تغطية أسعار الصرف
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        تُقارن العملات المستخدمة بعملة الأساس في مساحة FAMILY. لا تظهر هذه اللوحة أي رصيد أو سعر صرف عددي.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3 mb-4">
                    <div className="rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-slate-50/50 dark:bg-[#0E1420]/60 p-3">
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 block mb-0.5 font-medium">مطلوبة</span>
                      <span className="font-mono text-lg font-bold text-slate-900 dark:text-white tabular-nums">{data.fx.required}</span>
                    </div>
                    <div className="rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-slate-50/50 dark:bg-[#0E1420]/60 p-3">
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 block mb-0.5 font-medium">مغطاة</span>
                      <span className="font-mono text-lg font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">{data.fx.covered}</span>
                    </div>
                    <div className="rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-slate-50/50 dark:bg-[#0E1420]/60 p-3">
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 block mb-0.5 font-medium">فجوات أو تقادم</span>
                      <span className="font-mono text-lg font-bold text-amber-600 dark:text-amber-400 tabular-nums">
                        {data.fx.missing + data.fx.stale}
                      </span>
                    </div>
                  </div>

                  {data.fx.entries.length ? (
                    <div className="space-y-2.5">
                      {data.fx.entries.map(item => (
                        <div
                          key={item.currency}
                          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-slate-50/50 dark:bg-[#0E1420]/60 p-3.5"
                        >
                          <div>
                            <p className="font-bold font-mono text-sm text-slate-900 dark:text-white" dir="ltr">
                              {item.currency}
                            </p>
                            <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                              {item.source || "لا يوجد مصدر مسجل"} · {formatDateTime(item.asOf)}
                            </p>
                          </div>
                          <span
                            className={
                              item.rateStatus === "live"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200/80 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800/70 font-bold text-[11px] px-2.5 py-0.5 rounded-lg"
                                : item.rateStatus === "delayed"
                                ? "bg-amber-50 text-amber-700 border border-amber-200/80 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800/70 font-bold text-[11px] px-2.5 py-0.5 rounded-lg"
                                : item.rateStatus === "stale"
                                ? "bg-rose-50 text-rose-700 border border-rose-200/80 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800/70 font-bold text-[11px] px-2.5 py-0.5 rounded-lg"
                                : "bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 font-bold text-[11px] px-2.5 py-0.5 rounded-lg"
                            }
                          >
                            {quoteStatusLabel[item.rateStatus] || item.rateStatus}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="rounded-xl border border-dashed border-slate-300 dark:border-slate-750 p-6 text-center text-xs text-slate-500 dark:text-slate-400">
                      لا توجد عملات تحتاج تحويلًا إلى عملة الأساس حاليًا.
                    </p>
                  )}
                </div>
              </div>
            </section>

            {/* Governance Card */}
            <div className="bg-white dark:bg-[#0B0F17] border border-slate-200/90 dark:border-slate-800/80 rounded-2xl p-5 shadow-xs flex items-start gap-3.5">
              <div className="size-9 rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                <ShieldCheck className="size-5" />
              </div>
              <div className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                <strong className="text-slate-900 dark:text-white font-bold text-sm block mb-0.5">حدود الحوكمة محفوظة.</strong>
                تحسن هذه الشاشة شفافية جودة البيانات فقط. يظل تحديث Yahoo أو السعر اليدوي إجراءً صريحًا في شاشة التقييم، وتبقى الصفقات وإعادة التقييم خاضعة للدفتر المتوازن والاعتماد البشري.
              </div>
            </div>
          </>
        ) : null}
      </main>
    </DashboardLayout>
  );
}
