import React, { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import PageHeader from "@/components/PageHeader";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { ArrowLeftRight, Clock, Globe, Plus, RefreshCw } from "lucide-react";

const textError = (e: unknown) => (e instanceof Error ? e.message : "تعذر إكمال العملية");


const POPULAR_CURRENCIES = ["SAR", "EGP", "USD", "EUR", "AED", "KWD", "QAR", "GBP"];

export default function FxManagementPage() {
  const utils = trpc.useUtils();
  const accessibleWorkspaces = trpc.consolidation.listAccessible.useQuery();
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<number | undefined>(undefined);

  const [fromCurrency, setFromCurrency] = useState("SAR");
  const [toCurrency, setToCurrency] = useState("EGP");
  const [rate, setRate] = useState("");
  const [asOfDate, setAsOfDate] = useState(() => new Date().toISOString().slice(0, 10));

  const ratesQuery = trpc.consolidation.listRates.useQuery(
    selectedWorkspaceId ? { workspaceId: selectedWorkspaceId } : {},
    { staleTime: 15_000 }
  );

  const setRateMutation = trpc.consolidation.setFxRate.useMutation({
    onSuccess: (data) => {
      toast.success(`تم حفظ سعر الصرف بنجاح: 1 ${data.from} = ${data.rate} ${data.to}`);
      void ratesQuery.refetch();
      void utils.consolidation.summary.invalidate();
      setRate("");
    },
    onError: (err) => {
      toast.error(textError(err));
    },
  });

  const activeWsId = selectedWorkspaceId ?? accessibleWorkspaces.data?.[0]?.id;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeWsId) {
      toast.error("يرجى اختيار مساحة العمل أولاً.");
      return;
    }
    if (!rate || isNaN(Number(rate)) || Number(rate) <= 0) {
      toast.error("يرجى إدخال سعر صرف صالح أكبر من الصفر.");
      return;
    }
    setRateMutation.mutate({
      workspaceId: activeWsId,
      fromCurrency: fromCurrency.trim().toUpperCase(),
      toCurrency: toCurrency.trim().toUpperCase(),
      rate: rate.trim(),
      asOf: Date.parse(`${asOfDate}T00:00:00.000Z`),
    });
  };

  return (
    <DashboardLayout>
      <main className="space-y-6" dir="rtl">
        <PageHeader
          title="إدارة أسعار الصرف والعملات (FX Management)"
          description="توثيق وإدارة أسعار تحويل العملات متعددة الكيانات للتوحيد المالي ومنع الاعتماد على أسعار افتراضية."
          breadcrumbs={[
            { label: "الرئيسية", href: "/" },
            { label: "الحوكمة والإدارة", href: "/admin/users" },
            { label: "أسعار الصرف" },
          ]}
          badge={{ text: "حوكمة العملات", variant: "institutional" }}
          icon={ArrowLeftRight}
          actions={
            <button
              type="button"
              onClick={() => void ratesQuery.refetch()}
              disabled={ratesQuery.isFetching}
              className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:hover:bg-slate-100 dark:text-slate-950 font-bold text-xs py-2 px-4 rounded-xl shadow-xs transition-all border border-slate-900 dark:border-transparent disabled:opacity-50"
            >
              <RefreshCw className={`size-3.5 ${ratesQuery.isFetching ? "animate-spin" : ""}`} />
              تحديث الأسعار
            </button>
          }
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Add / Update Rate Form */}
          <div className="bg-white dark:bg-[#0B0F17] border border-slate-200/90 dark:border-slate-800/80 rounded-2xl p-5 shadow-xs">
            <div className="flex items-center gap-2 mb-4">
              <Plus className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <p className="text-slate-900 dark:text-white font-bold text-sm">تسجيل سعر صرف جديد</p>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              {accessibleWorkspaces.data && accessibleWorkspaces.data.length > 1 && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    مساحة العمل
                  </label>
                  <select
                    value={activeWsId}
                    onChange={(e) => setSelectedWorkspaceId(Number(e.target.value))}
                    className="w-full text-xs font-medium bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-slate-900 dark:text-white"
                  >
                    {accessibleWorkspaces.data.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name} ({w.baseCurrency})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    من عملة (Base)
                  </label>
                  <select
                    value={fromCurrency}
                    onChange={(e) => setFromCurrency(e.target.value)}
                    className="w-full text-xs font-mono font-bold bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-slate-900 dark:text-white"
                  >
                    {POPULAR_CURRENCIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    إلى عملة (Target)
                  </label>
                  <select
                    value={toCurrency}
                    onChange={(e) => setToCurrency(e.target.value)}
                    className="w-full text-xs font-mono font-bold bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-slate-900 dark:text-white"
                  >
                    {POPULAR_CURRENCIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  سعر الصرف (1 {fromCurrency} = كم {toCurrency})
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="مثال: 13.25"
                  value={rate}
                  onChange={(e) => setRate(e.target.value)}
                  className="w-full text-xs font-mono font-bold bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-slate-900 dark:text-white"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  تاريخ النفاذ (Effective Date)
                </label>
                <input
                  type="date"
                  value={asOfDate}
                  onChange={(e) => setAsOfDate(e.target.value)}
                  className="w-full text-xs font-mono bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2 text-slate-900 dark:text-white"
                  dir="rtl"
                />
              </div>

              <button
                type="submit"
                disabled={setRateMutation.isPending}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:hover:bg-slate-100 dark:text-slate-950 font-bold text-xs py-2.5 px-4 rounded-xl shadow-xs transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Plus className="size-3.5" />
                {setRateMutation.isPending ? "جارٍ الحفظ…" : "توثيق وحفظ السعر"}
              </button>
            </form>
          </div>

          {/* Rates Table */}
          <div className="lg:col-span-2 bg-white dark:bg-[#0B0F17] border border-slate-200/90 dark:border-slate-800/80 rounded-2xl shadow-xs overflow-hidden">
            <div className="p-5 border-b border-slate-200/90 dark:border-slate-800/80 flex items-center justify-between">
              <div>
                <p className="text-slate-900 dark:text-white font-bold text-sm mb-0.5">سجل أسعار الصرف الموثقة</p>
                <p className="text-slate-500 dark:text-slate-400 text-xs">
                  الأسعار المعتمدة المستخدمة في توحيد الكيانات والتقارير المالية.
                </p>
              </div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs text-slate-600 dark:text-slate-300 font-medium">
                <Globe className="size-3.5" />
                {ratesQuery.data?.length ?? 0} سعر مسجل
              </div>
            </div>

            {ratesQuery.isLoading ? (
              <p className="py-12 text-center text-xs text-slate-500 dark:text-slate-400">جارٍ تحميل الأسعار…</p>
            ) : ratesQuery.data?.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[500px] text-right text-xs">
                  <thead>
                    <tr className="bg-slate-50/90 dark:bg-[#0E1420] border-b border-slate-200/90 dark:border-slate-800/80">
                      <th className="py-3 px-4 font-bold text-slate-600 dark:text-slate-400">زوج العملة</th>
                      <th className="py-3 px-4 font-bold text-slate-600 dark:text-slate-400">سعر الصرف</th>
                      <th className="py-3 px-4 font-bold text-slate-600 dark:text-slate-400">المصدر</th>
                      <th className="py-3 px-4 font-bold text-slate-600 dark:text-slate-400">تاريخ النفاذ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {ratesQuery.data.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50/60 dark:hover:bg-[#111827]/40 transition-colors">
                        <td className="p-4 font-mono font-bold text-slate-900 dark:text-white" dir="ltr">
                          {r.fromCurrency} / {r.toCurrency}
                        </td>
                        <td className="p-4 font-mono font-bold text-emerald-600 dark:text-emerald-400 text-sm" dir="ltr">
                          {r.rate}
                        </td>
                        <td className="p-4">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                            {r.source === "manual" ? "يدوي" : r.source}
                          </span>
                        </td>
                        <td className="p-4 text-slate-500 dark:text-slate-400 font-mono" dir="ltr">
                          {new Date(r.asOf).toISOString().slice(0, 10)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Clock className="size-8 text-slate-400 mb-2" />
                <p className="text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">لا توجد أسعار صرف مسجلة</p>
                <p className="text-xs text-slate-500 max-w-xs leading-5">
                  قم بتسجيل سعر صرف من النموذج أعلاه لتمكين التوحيد عبر العملات.
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </DashboardLayout>
  );
}
