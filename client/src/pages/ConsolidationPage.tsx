import DashboardLayout from "@/components/DashboardLayout";
import PageHeader from "@/components/PageHeader";
import SensitiveValue from "@/components/SensitiveValue";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatMoney } from "@/lib/financialDisplay";
import { trpc } from "@/lib/trpc";
import { AlertCircle, Building2, Clock, Globe, Layers, PieChart, RefreshCw, ShieldAlert, Wallet } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

const CURRENCIES = ["SAR", "USD", "EGP", "AED", "EUR", "GBP", "KWD", "QAR"];

/** Render a timestamp in strict LTR to prevent BiDi scrambling in RTL containers */
function LtrDateTime({ value }: { value: number | string | null | undefined }) {
  if (!value) return <span className="text-slate-400 dark:text-slate-600">—</span>;
  const d = new Date(value);
  // YYYY-MM-DD • HH:mm
  const iso = d.toISOString();
  const date = iso.slice(0, 10);
  const time = iso.slice(11, 16);
  return (
    <span dir="ltr" className="inline-flex items-center font-mono tabular-nums text-xs">
      {date} • {time}
    </span>
  );
}

/** FX rate status badge */
function FxStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    identity:     "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800/60 dark:text-slate-400 dark:border-slate-700",
    authoritative:"bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800",
    stale:        "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800",
  };
  const label: Record<string, string> = { identity: "مطابقة", authoritative: "موثق", stale: "قديم >48h" };
  const cls = map[status] ?? "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800";
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-bold border ${cls}`}>
      {label[status] ?? "غير متوفر"}
    </span>
  );
}

/** Inter-entity claim type badge */
function ClaimTypeBadge({ claimType }: { claimType: string }) {
  if (claimType === "personal_iou_receivable")
    return <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800">مستحق له</span>;
  if (claimType === "personal_iou_payable")
    return <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800">مستحق عليه</span>;
  return <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800">التزام دين</span>;
}

export default function ConsolidationPage() {
  const [selectedCurrency, setSelectedCurrency] = useState("SAR");
  const [selectedWorkspaceIds, setSelectedWorkspaceIds] = useState<number[]>([]);

  const accessibleWorkspaces = trpc.consolidation.listAccessible.useQuery();

  useEffect(() => {
    if (accessibleWorkspaces.data?.length && selectedWorkspaceIds.length === 0) {
      setSelectedWorkspaceIds(accessibleWorkspaces.data.map(w => w.id));
    }
  }, [accessibleWorkspaces.data, selectedWorkspaceIds.length]);

  const consolidationQuery = trpc.consolidation.summary.useQuery(
    { workspaceIds: selectedWorkspaceIds, presentationCurrency: selectedCurrency },
    { enabled: selectedWorkspaceIds.length > 0, staleTime: 30_000 }
  );

  const toggleWorkspace = (id: number) => {
    setSelectedWorkspaceIds(prev => {
      if (prev.includes(id)) {
        if (prev.length === 1) { toast.warning("يجب الإبقاء على مساحة عمل واحدة على الأقل للدمج."); return prev; }
        return prev.filter(wId => wId !== id);
      }
      return [...prev, id];
    });
  };

  const selectAll = () => {
    if (accessibleWorkspaces.data) setSelectedWorkspaceIds(accessibleWorkspaces.data.map(w => w.id));
  };

  const data = consolidationQuery.data;

  return (
    <DashboardLayout>
      <main className="mx-auto max-w-7xl space-y-6" dir="rtl">
        <PageHeader
          title="توحيد الكيانات والدمج المالي"
          description="طبقة تجميعية محايدة لجمع وتضمين القوائم المالية والمحاسبية عبر كافة الكيانات والشراكات مع استبعاد المعاملات البينية."
          icon={Building2}
          breadcrumbs={[
            { label: "الرئيسية", href: "/" },
            { label: "الحوكمة والإدارة", href: "/governance" },
            { label: "توحيد الكيانات والدمج المالي" },
          ]}
          badge={{ text: "دفعة موحدة معتمدة", variant: "institutional" }}
          actions={
            <div className="flex items-center gap-3 flex-wrap">
              {/* Consolidation timestamp pill — strict LTR */}
              {data?.generatedAt && (
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 text-xs text-slate-700 dark:text-slate-300">
                  <Clock className="size-3.5 text-slate-500 dark:text-slate-400 shrink-0" />
                  <span className="text-slate-500 dark:text-slate-400">توقيت التوحيد:</span>
                  <LtrDateTime value={data.generatedAt} />
                </div>
              )}
              {/* Institutional refresh button */}
              <button
                type="button"
                onClick={() => void consolidationQuery.refetch()}
                disabled={consolidationQuery.isFetching}
                className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:hover:bg-slate-100 dark:text-slate-950 font-bold text-xs py-2 px-4 rounded-xl shadow-xs transition-all border border-slate-900 dark:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RefreshCw className={`size-3.5 ${consolidationQuery.isFetching ? "animate-spin" : ""}`} />
                تحديث البيانات
              </button>
            </div>
          }
        />

        {/* ── Entity Scope & Currency Selector ── */}
        <div className="bg-white dark:bg-[#0B0F17] border border-slate-200/90 dark:border-slate-800/80 rounded-2xl p-5 shadow-xs mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Globe className="size-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
            <p className="text-slate-900 dark:text-white font-bold text-sm">نطاق التوحيد وعملة العرض الموحدة</p>
          </div>
          <p className="text-slate-500 dark:text-slate-400 text-xs mb-4 leading-5">
            حدد الكيانات المستقلة المطلوب دمجها وعملة العرض المرجعية. يتم التحويل بناءً على أسعار الصرف التاريخية أو اللحظية الموثقة.
          </p>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 shrink-0">
                الكيانات المتاحة ({accessibleWorkspaces.data?.length ?? 0}):
              </span>
              {accessibleWorkspaces.data?.map(w => {
                const isChecked = selectedWorkspaceIds.includes(w.id);
                return (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() => toggleWorkspace(w.id)}
                    className={`inline-flex items-center gap-1.5 font-bold text-xs px-3 py-1.5 rounded-xl transition-colors ${
                      isChecked
                        ? "bg-slate-900 text-white dark:bg-white dark:text-slate-950 shadow-2xs border border-slate-900 dark:border-white"
                        : "bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 font-medium border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                    }`}
                  >
                    <span>{w.name}</span>
                    <span className={`font-mono text-[10px] ${isChecked ? "opacity-70" : "text-slate-400 dark:text-slate-500"}`}>({w.baseCurrency})</span>
                  </button>
                );
              })}
              {accessibleWorkspaces.data && selectedWorkspaceIds.length < accessibleWorkspaces.data.length && (
                <button
                  type="button"
                  onClick={selectAll}
                  className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline px-1"
                >
                  تحديد الكل
                </button>
              )}
            </div>

            {/* Currency select */}
            <div className="flex items-center gap-2 min-w-[180px]">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">عملة العرض:</span>
              <Select value={selectedCurrency} onValueChange={setSelectedCurrency}>
                <SelectTrigger id="currency-select" className="h-8 text-xs font-mono font-bold bg-white dark:bg-[#0E1420] border-slate-300 dark:border-slate-700/80 rounded-xl py-1.5 px-3">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map(curr => (
                    <SelectItem key={curr} value={curr} className="font-mono text-xs">{curr}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* ── Metric Strip ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {/* Card 1: Book Net Worth */}
          <div className="bg-white dark:bg-[#0B0F17] border border-slate-200/90 dark:border-slate-800/80 rounded-2xl p-5 shadow-xs">
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">صافي الثروة الدفتري الموحد</p>
            <p className="font-mono font-extrabold text-2xl lg:text-3xl text-slate-900 dark:text-white tabular-nums leading-none mb-2">
              <SensitiveValue>{formatMoney(data?.grossConsolidatedBookNetWorth ?? "0", selectedCurrency, 2)}</SensitiveValue>
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-4">مجموع حقوق الملكية لكافة الكيانات المحددة.</p>
          </div>

          {/* Card 2: Economic Net Worth */}
          <div className="bg-white dark:bg-[#0B0F17] border border-slate-200/90 dark:border-slate-800/80 rounded-2xl p-5 shadow-xs">
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">القيمة الاقتصادية العادلة الموحدة</p>
            <p className="font-mono font-extrabold text-2xl lg:text-3xl text-slate-900 dark:text-white tabular-nums leading-none mb-2">
              <SensitiveValue>{formatMoney(data?.grossConsolidatedEconomicNetWorth ?? "0", selectedCurrency, 2)}</SensitiveValue>
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-4">تشمل تقييم المحفظة الاستثمارية وأسعار السوق اللحظية.</p>
          </div>

          {/* Card 3: Total Assets */}
          <div className="bg-white dark:bg-[#0B0F17] border border-slate-200/90 dark:border-slate-800/80 rounded-2xl p-5 shadow-xs">
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">إجمالي الأصول الموحدة</p>
            <p className="font-mono font-bold text-xl lg:text-2xl text-slate-900 dark:text-white tabular-nums leading-none mb-2">
              <SensitiveValue>{formatMoney(data?.totalConsolidatedAssets ?? "0", selectedCurrency, 2)}</SensitiveValue>
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-4">النقد السائل + الاستثمارات + الأصول العينية.</p>
          </div>

          {/* Card 4: Inter-entity claims */}
          <div className="bg-white dark:bg-[#0B0F17] border border-slate-200/90 dark:border-slate-800/80 rounded-2xl p-5 shadow-xs">
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">الالتزامات والمعاملات البينية</p>
            <p className="font-mono font-bold text-xl lg:text-2xl text-slate-900 dark:text-white tabular-nums leading-none mb-2">
              <SensitiveValue>{formatMoney(data?.totalDisclosedInterEntityClaims ?? "0", selectedCurrency, 2)}</SensitiveValue>
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-4">
              {data?.interEntityDisclosures.length ?? 0} مطالبة مفصح عنها تخضع للإفصاح دون إلغاء وهمي.
            </p>
          </div>
        </div>

        {/* ── Detailed Tabs ── */}
        <Tabs defaultValue="entities" className="space-y-4">
          <TabsList className="bg-slate-100/90 dark:bg-[#0E1420] p-1.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 inline-flex flex-wrap gap-1 mb-6 h-auto">
            <TabsTrigger value="entities" className="gap-1.5 text-xs rounded-xl px-3 py-2 data-[state=active]:bg-white dark:data-[state=active]:bg-[#1A2234] data-[state=active]:font-bold data-[state=active]:shadow-xs">
              <Layers className="size-3.5" />
              تفكيك الكيانات ومساحات العمل ({data?.workspaces.length ?? 0})
            </TabsTrigger>
            <TabsTrigger value="allocation" className="gap-1.5 text-xs rounded-xl px-3 py-2 data-[state=active]:bg-white dark:data-[state=active]:bg-[#1A2234] data-[state=active]:font-bold data-[state=active]:shadow-xs">
              <PieChart className="size-3.5" />
              التوزيع المالي وفئات الأصول
            </TabsTrigger>
            <TabsTrigger value="disclosures" className="gap-1.5 text-xs rounded-xl px-3 py-2 data-[state=active]:bg-white dark:data-[state=active]:bg-[#1A2234] data-[state=active]:font-bold data-[state=active]:shadow-xs">
              <ShieldAlert className="size-3.5" />
              إفصاح المعاملات البينية والتسويات ({data?.interEntityDisclosures.length ?? 0})
            </TabsTrigger>
          </TabsList>

          {/* Tab 1: Entities Breakdown */}
          <TabsContent value="entities">
            <div className="bg-white dark:bg-[#0B0F17] border border-slate-200/90 dark:border-slate-800/80 rounded-2xl shadow-xs overflow-hidden">
              <div className="p-5 border-b border-slate-200/90 dark:border-slate-800/80">
                <p className="text-slate-900 dark:text-white font-bold text-sm mb-0.5">جدول تفكيك الكيانات المجمعة</p>
                <p className="text-slate-500 dark:text-slate-400 text-xs">عرض تفصيلي لكل مساحة عمل مع سعر الصرف المعتمد والقيم بعملة الأصل والعملة الموحدة.</p>
              </div>
              {consolidationQuery.isLoading ? (
                <p className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">جارٍ تجميع وتوحيد بيانات الكيانات…</p>
              ) : data?.workspaces.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[950px] text-right text-sm">
                    <thead>
                      <tr className="bg-slate-50/90 dark:bg-[#0E1420] border-b border-slate-200/90 dark:border-slate-800/80">
                        <th className="py-3.5 px-4 text-xs font-bold text-slate-600 dark:text-slate-400">الكيان / المساحة</th>
                        <th className="py-3.5 px-4 text-xs font-bold text-slate-600 dark:text-slate-400">الدور</th>
                        <th className="py-3.5 px-4 text-xs font-bold text-slate-600 dark:text-slate-400">العملة</th>
                        <th className="py-3.5 px-4 text-xs font-bold text-slate-600 dark:text-slate-400">سعر التحويل ({selectedCurrency})</th>
                        <th className="py-3.5 px-4 text-xs font-bold text-slate-600 dark:text-slate-400">الصافي الدفتري (الأصل)</th>
                        <th className="py-3.5 px-4 text-xs font-bold text-slate-600 dark:text-slate-400">الصافي الدفتري ({selectedCurrency})</th>
                        <th className="py-3.5 px-4 text-xs font-bold text-slate-600 dark:text-slate-400">القيمة العادلة ({selectedCurrency})</th>
                        <th className="py-3.5 px-4 text-xs font-bold text-slate-600 dark:text-slate-400">السيولة</th>
                        <th className="py-3.5 px-4 text-xs font-bold text-slate-600 dark:text-slate-400">الالتزامات</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.workspaces.map((ws, idx) => (
                        <tr key={ws.workspaceId} className={`border-b border-slate-200/70 dark:border-slate-800/70 hover:bg-slate-50/80 dark:hover:bg-[#0E1420] transition-colors ${idx === data.workspaces.length - 1 ? "border-b-0" : ""}`}>
                          <td className="py-3.5 px-4">
                            <p className="font-bold text-slate-900 dark:text-white text-xs">{ws.workspaceName}</p>
                            <p className="text-[10px] text-slate-500 dark:text-slate-500 font-mono mt-0.5">#{ws.workspaceId}</p>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-slate-100 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                              {ws.role}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 font-mono text-xs font-bold text-slate-900 dark:text-white">{ws.baseCurrency}</td>
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2">
                              <span dir="ltr" className="font-mono text-xs font-semibold text-slate-900 dark:text-white tabular-nums">
                                {ws.fxRateToPresentation}
                              </span>
                              <FxStatusBadge status={ws.fxRateStatus} />
                            </div>
                            {ws.fxRateAsOf && ws.fxRateStatus !== "identity" && (
                              <LtrDateTime value={ws.fxRateAsOf} />
                            )}
                          </td>
                          <td className="py-3.5 px-4 font-mono text-xs font-semibold text-slate-900 dark:text-white tabular-nums">
                            <SensitiveValue>{formatMoney(ws.grossBookNetWorthLocal, ws.baseCurrency, 2)}</SensitiveValue>
                          </td>
                          <td className="py-3.5 px-4 font-mono text-xs font-bold text-slate-900 dark:text-white tabular-nums">
                            <SensitiveValue>{formatMoney(ws.grossBookNetWorthConverted, selectedCurrency, 2)}</SensitiveValue>
                          </td>
                          <td className="py-3.5 px-4 font-mono text-xs font-bold text-slate-900 dark:text-white tabular-nums">
                            <SensitiveValue>{formatMoney(ws.economicNetWorthConverted, selectedCurrency, 2)}</SensitiveValue>
                          </td>
                          <td className="py-3.5 px-4 font-mono text-xs font-semibold text-slate-900 dark:text-white tabular-nums">
                            <SensitiveValue>{formatMoney(ws.liquidCashConverted, selectedCurrency, 2)}</SensitiveValue>
                          </td>
                          <td className="py-3.5 px-4 font-mono text-xs font-semibold text-rose-600 dark:text-rose-400 tabular-nums">
                            <SensitiveValue>{formatMoney(ws.liabilitiesConverted, selectedCurrency, 2)}</SensitiveValue>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-14 text-center">
                  <div className="size-12 rounded-2xl bg-slate-100 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-center mx-auto mb-3">
                    <Building2 className="size-6" />
                  </div>
                  <p className="text-slate-800 dark:text-slate-200 font-bold text-sm mb-1">لا توجد بيانات للكيانات المحددة</p>
                  <p className="text-slate-500 dark:text-slate-400 text-xs max-w-xs leading-5">حدد كيانات من شريط النطاق أعلاه لبدء الدمج والتوحيد.</p>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Tab 2: Consolidated Asset Allocation */}
          <TabsContent value="allocation">
            <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
              {/* Allocation bars */}
              <div className="bg-white dark:bg-[#0B0F17] border border-slate-200/90 dark:border-slate-800/80 rounded-2xl p-6 shadow-xs">
                <p className="text-slate-900 dark:text-white font-bold text-sm mb-0.5">التوزيع المالي الموحد حسب فئة الأصل</p>
                <p className="text-slate-500 dark:text-slate-400 text-xs mb-5">تجميع أوزان الأصول لكافة الكيانات المحددة بعد التحويل لعملة العرض ({selectedCurrency}).</p>
                <div className="space-y-4">
                  {data?.assetAllocation.map(item => (
                    <div key={item.assetClass} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-800 dark:text-slate-200">{item.labelAr}</span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono tabular-nums text-slate-600 dark:text-slate-400">
                            <SensitiveValue>{formatMoney(item.amountConverted, selectedCurrency, 2)}</SensitiveValue>
                          </span>
                          <span className="font-mono text-[11px] bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold">
                            {item.weightPercentage}%
                          </span>
                        </div>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800/80">
                        <div
                          className="h-full bg-slate-700 dark:bg-slate-300 transition-all rounded-full"
                          style={{ width: `${Math.min(100, Math.max(0, parseFloat(item.weightPercentage)))}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Conservative range */}
              <div className="bg-white dark:bg-[#0B0F17] border border-slate-200/90 dark:border-slate-800/80 rounded-2xl p-6 shadow-xs">
                <div className="flex items-center gap-2 mb-0.5">
                  <Wallet className="size-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                  <p className="text-slate-900 dark:text-white font-bold text-sm">المعادلة التحفظية بعد الإفصاح البيني</p>
                </div>
                <p className="text-slate-500 dark:text-slate-400 text-xs mb-5">المقارنة بين صافي الثروة المجمع الإجمالي والنطاق التحفظي بافتراض شطب الالتزامات والمستحقات المتبادلة.</p>
                <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-[#0E1420] p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500 dark:text-slate-400">صافي الثروة المجمع الإجمالي:</span>
                    <span className="font-mono tabular-nums text-sm font-bold text-slate-900 dark:text-white">
                      <SensitiveValue>{formatMoney(data?.netWorthPostDisclosureRange.gross ?? "0", selectedCurrency, 2)}</SensitiveValue>
                    </span>
                  </div>
                  <div className="flex items-center justify-between border-t border-slate-200/80 dark:border-slate-800 pt-3">
                    <span className="text-xs text-slate-500 dark:text-slate-400">إجمالي المطالبات البينية المفصح عنها:</span>
                    <span className="font-mono tabular-nums text-sm font-semibold text-amber-700 dark:text-amber-400">
                      <SensitiveValue>{formatMoney(data?.totalDisclosedInterEntityClaims ?? "0", selectedCurrency, 2)}</SensitiveValue>
                    </span>
                  </div>
                  <div className="flex items-center justify-between border-t border-slate-200/80 dark:border-slate-800 pt-3">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">النطاق الأدنى التحفظي:</span>
                    <span className="font-mono tabular-nums text-sm font-extrabold text-slate-900 dark:text-white">
                      <SensitiveValue>{formatMoney(data?.netWorthPostDisclosureRange.minAssumingAllInterEntityEliminated ?? "0", selectedCurrency, 2)}</SensitiveValue>
                    </span>
                  </div>
                </div>
                {data?.netWorthPostDisclosureRange.disclosureNote && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mt-4">{data.netWorthPostDisclosureRange.disclosureNote}</p>
                )}
              </div>
            </div>
          </TabsContent>

          {/* Tab 3: Inter-Entity Disclosures */}
          <TabsContent value="disclosures">
            <div className="bg-white dark:bg-[#0B0F17] border border-slate-200/90 dark:border-slate-800/80 rounded-2xl shadow-xs overflow-hidden">
              <div className="p-5 border-b border-slate-200/90 dark:border-slate-800/80 flex items-start gap-3">
                <AlertCircle className="size-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-slate-900 dark:text-white font-bold text-sm mb-0.5">سجل إفصاح المعاملات والمطالبات البينية</p>
                  <p className="text-slate-500 dark:text-slate-400 text-xs leading-5">التزامًا بمعايير الحوكمة المالية الدقيقة، يتم توثيق وإفصاح المعاملات البينية دون إجراء شطب أو تسوية وهمية غير مستندة لعقد إداري رسمي.</p>
                </div>
              </div>
              {data?.interEntityDisclosures.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[850px] text-right text-sm">
                    <thead>
                      <tr className="bg-slate-50/90 dark:bg-[#0E1420] border-b border-slate-200/90 dark:border-slate-800/80">
                        <th className="py-3.5 px-4 text-xs font-bold text-slate-600 dark:text-slate-400">الكيان المصدر</th>
                        <th className="py-3.5 px-4 text-xs font-bold text-slate-600 dark:text-slate-400">الطرف المقابل</th>
                        <th className="py-3.5 px-4 text-xs font-bold text-slate-600 dark:text-slate-400">نوع المطالبة</th>
                        <th className="py-3.5 px-4 text-xs font-bold text-slate-600 dark:text-slate-400">المبلغ الأصلي</th>
                        <th className="py-3.5 px-4 text-xs font-bold text-slate-600 dark:text-slate-400">المعادل ({selectedCurrency})</th>
                        <th className="py-3.5 px-4 text-xs font-bold text-slate-600 dark:text-slate-400">حالة الإلغاء</th>
                        <th className="py-3.5 px-4 text-xs font-bold text-slate-600 dark:text-slate-400">ملاحظة الحوكمة</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.interEntityDisclosures.map((d, index) => (
                        <tr key={index} className={`border-b border-slate-200/70 dark:border-slate-800/70 hover:bg-slate-50/80 dark:hover:bg-[#0E1420] transition-colors ${index === data.interEntityDisclosures.length - 1 ? "border-b-0" : ""}`}>
                          <td className="py-3.5 px-4 text-xs font-bold text-slate-900 dark:text-white">{d.sourceWorkspaceName}</td>
                          <td className="py-3.5 px-4 text-xs font-medium text-slate-700 dark:text-slate-300">{d.counterpartyName}</td>
                          <td className="py-3.5 px-4 text-xs"><ClaimTypeBadge claimType={d.claimType} /></td>
                          <td className="py-3.5 px-4 font-mono text-xs font-semibold text-slate-900 dark:text-white tabular-nums">
                            <SensitiveValue>{formatMoney(d.amountOriginal, d.currency, 2)}</SensitiveValue>
                          </td>
                          <td className="py-3.5 px-4 font-mono text-xs font-semibold text-slate-900 dark:text-white tabular-nums">
                            <SensitiveValue>{formatMoney(d.amountConverted, selectedCurrency, 2)}</SensitiveValue>
                          </td>
                          <td className="py-3.5 px-4 text-xs">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800">
                              إفصاح دون شطب
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-xs text-slate-500 dark:text-slate-400">{d.disclosureNote}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-14 text-center">
                  <div className="size-12 rounded-2xl bg-slate-100 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-center mx-auto mb-3">
                    <ShieldAlert className="size-6" />
                  </div>
                  <p className="text-slate-800 dark:text-slate-200 font-bold text-sm mb-1">لا توجد مطالبات بينية مسجلة</p>
                  <p className="text-slate-500 dark:text-slate-400 text-xs max-w-xs leading-5">لا توجد مطالبات أو ديون بينية في الكيانات المحددة حالياً.</p>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </DashboardLayout>
  );
}
