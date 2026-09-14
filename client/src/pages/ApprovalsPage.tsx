import DashboardLayout from "@/components/DashboardLayout";
import PageHeader from "@/components/PageHeader";
import SensitiveValue from "@/components/SensitiveValue";
import { CheckCheck, CheckCircle2, CircleAlert, LockKeyhole, Play, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { formatMoney } from "@/lib/financialDisplay";

type ApprovalActionType = "cash_event" | "transfer" | "trade" | "budget_adjustment" | "period_adjustment";
const actionName: Record<ApprovalActionType, string> = { cash_event: "حركة نقدية", transfer: "تحويل", trade: "صفقة تداول", budget_adjustment: "تسوية ميزانية", period_adjustment: "إغلاق فترة" };
const statusName: Record<string, string> = { pending: "بانتظار القرار", approved: "معتمدة", rejected: "مرفوضة", expired: "منتهية", executed: "منفذة" };
const errorText = (error: unknown) => error instanceof Error ? error.message : "تعذر إكمال العملية الآن.";
const money = (value: string | null | undefined, currency: string | null | undefined) => value && currency ? <SensitiveValue>{formatMoney(value, currency, 0)}</SensitiveValue> : "—";
const dateTime = (value: number | null | undefined) => {
  if (!value) return <span className="text-slate-400">—</span>;
  const iso = new Date(value).toISOString();
  return <span dir="ltr" className="inline-flex items-center font-mono tabular-nums text-xs">{iso.slice(0, 10)} • {iso.slice(11, 16)}</span>;
};

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending:  "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800",
    approved: "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800",
    rejected: "bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800",
    expired:  "bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800/60 dark:text-slate-400 dark:border-slate-700",
    executed: "bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800",
  };
  const cls = map[status] ?? "bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800/60 dark:text-slate-400 dark:border-slate-700";
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-bold ${cls}`}>{statusName[status] || status}</span>;
}

function DecisionStatusBadge({ decision }: { decision: string }) {
  const isApproved = decision === "approved";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-bold ${isApproved ? "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800" : "bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800"}`}>
      {isApproved ? "اعتماد" : "رفض"}
    </span>
  );
}

export default function ApprovalsPage() {
  const utils = trpc.useUtils();
  const requests = trpc.family.governance.requests.useQuery();
  const history = trpc.family.governance.decisionHistory.useQuery();
  const currentUser = trpc.auth.me.useQuery();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const decide = trpc.family.governance.decide.useMutation({ onSuccess: () => { toast.success("تم تسجيل قرار الاعتماد."); void utils.family.governance.requests.invalidate(); void utils.family.governance.decisionHistory.invalidate(); }, onError: error => toast.error(errorText(error)) });
  const executeCash = trpc.family.ledger.executeApprovedCash.useMutation({ onSuccess: () => { toast.success("نُشرت الحركة النقدية المعتمدة."); void utils.family.governance.requests.invalidate(); }, onError: error => toast.error(errorText(error)) });
  const executeTransfer = trpc.family.ledger.executeApprovedTransfer.useMutation({ onSuccess: () => { toast.success("نُشر التحويل المعتمد."); void utils.family.governance.requests.invalidate(); }, onError: error => toast.error(errorText(error)) });
  const executeTrade = trpc.family.ledger.executeApprovedTrade.useMutation({ onSuccess: () => { toast.success("نُشرت الصفقة المعتمدة."); void utils.family.governance.requests.invalidate(); }, onError: error => toast.error(errorText(error)) });
  const executeBudget = trpc.family.governance.executeApprovedBudgetAdjustment.useMutation({ onSuccess: () => { toast.success("نُفذت تسوية الميزانية المعتمدة."); void utils.family.governance.requests.invalidate(); }, onError: error => toast.error(errorText(error)) });
  const closePeriod = trpc.family.governance.closeApprovedPeriod.useMutation({ onSuccess: () => { toast.success("أُغلقت الفترة المعتمدة."); void utils.family.governance.requests.invalidate(); }, onError: error => toast.error(errorText(error)) });
  const selected = useMemo(() => requests.data?.find(item => item.id === selectedId) || requests.data?.[0] || null, [requests.data, selectedId]);
  useEffect(() => { if (requests.data?.length && selectedId === null) setSelectedId(requests.data[0].id); }, [requests.data, selectedId]);
  const execute = (request: { id: number; actionType: ApprovalActionType }) => {
    if (request.actionType === "cash_event") executeCash.mutate({ requestId: request.id });
    if (request.actionType === "transfer") executeTransfer.mutate({ requestId: request.id });
    if (request.actionType === "trade") executeTrade.mutate({ requestId: request.id });
    if (request.actionType === "budget_adjustment") executeBudget.mutate({ requestId: request.id });
    if (request.actionType === "period_adjustment") closePeriod.mutate({ requestId: request.id });
  };
  const isExecuting = executeCash.isPending || executeTransfer.isPending || executeTrade.isPending || executeBudget.isPending || closePeriod.isPending;

  return (
    <DashboardLayout>
      <main className="mx-auto max-w-7xl space-y-6" dir="rtl">
        <PageHeader
          title="الموافقات وقرارات الاعتماد"
          description="إدارة ومراجعة العمليات المجمدة المشروطة باعتماد مزدوج قبل النفاذ المالي."
          breadcrumbs={[
            { label: "الرئيسية", href: "/" },
            { label: "الحوكمة والإدارة", href: "/approvals" },
            { label: "الموافقات وقرارات الاعتماد" },
          ]}
          badge={
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 text-slate-700 dark:text-slate-300 font-medium text-xs shadow-2xs">
              <CheckCheck className="size-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>حوكمة الاعتماد المزدوج (Four-Eyes Principle)</span>
            </div>
          }
          icon={LockKeyhole}
        />

        {/* Main grid: Requests + Details */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-8">

          {/* ── Requests Column ── */}
          <div className="lg:col-span-5">
            <div className="bg-white dark:bg-[#0B0F17] border border-slate-200/90 dark:border-slate-800/80 rounded-2xl p-6 shadow-xs h-full">
              <div className="flex items-center justify-between mb-1">
                <p className="text-slate-900 dark:text-white font-bold text-sm flex items-center gap-2">
                  <LockKeyhole className="size-4 text-indigo-600 dark:text-indigo-400" />
                  طلبات الاعتماد
                </p>
              </div>
              <p className="text-slate-500 dark:text-slate-400 text-xs mb-4">اختر طلبًا لعرض تفاصيله وإجراء القرار المسموح به.</p>

              {requests.isLoading ? (
                <p className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">جارٍ تحميل الطلبات…</p>
              ) : requests.error ? (
                <div className="rounded-xl border border-rose-200/80 dark:border-rose-800/60 bg-rose-50 dark:bg-rose-950/30 p-4 text-sm text-rose-700 dark:text-rose-300 flex items-center gap-2">
                  <CircleAlert className="size-4 shrink-0" />{errorText(requests.error)}
                </div>
              ) : requests.data?.length ? (
                <div className="space-y-2">
                  {requests.data.map(request => (
                    <button
                      key={request.id}
                      type="button"
                      onClick={() => setSelectedId(request.id)}
                      className={`w-full text-right p-4 rounded-xl border transition-all cursor-pointer ${
                        selected?.id === request.id
                          ? "border-indigo-300 dark:border-indigo-700 bg-indigo-50/60 dark:bg-indigo-950/30"
                          : "border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-[#0E1420] hover:border-slate-300 dark:hover:border-slate-700"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-bold text-slate-900 dark:text-white text-xs truncate">
                            {actionName[request.actionType as ApprovalActionType] || request.actionType}
                          </p>
                          <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5 leading-5">
                            طلبه {request.requesterName || "عضو العائلة"} · {dateTime(request.createdAt)}
                          </p>
                          {request.amount && request.currency && (
                            <p className="font-mono font-bold text-slate-900 dark:text-white tabular-nums text-sm mt-1">
                              <SensitiveValue>{formatMoney(request.amount, request.currency, 0)}</SensitiveValue>
                            </p>
                          )}
                        </div>
                        <StatusBadge status={request.status} />
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="size-12 rounded-2xl bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-center mx-auto mb-3">
                    <ShieldCheck className="size-6" />
                  </div>
                  <p className="text-slate-800 dark:text-slate-200 font-bold text-sm mb-1">لا توجد طلبات اعتماد</p>
                  <p className="text-slate-500 dark:text-slate-400 text-xs max-w-sm mx-auto leading-relaxed">ستظهر هنا فقط العمليات التي تجاوزت سياسة اعتماد فعالة وتم تجميد بياناتها للمراجعة.</p>
                </div>
              )}
            </div>
          </div>

          {/* ── Details Column ── */}
          <div className="lg:col-span-7">
            <div className="bg-white dark:bg-[#0B0F17] border border-slate-200/90 dark:border-slate-800/80 rounded-2xl p-6 shadow-xs h-full">
              <div className="flex items-center justify-between mb-1">
                <p className="text-slate-900 dark:text-white font-bold text-sm flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-indigo-600 dark:text-indigo-400" />
                  تفاصيل الطلب
                </p>
              </div>
              <p className="text-slate-500 dark:text-slate-400 text-xs mb-4">راجع نوع العملية والمبلغ والمقدم وانتهاء الصلاحية قبل أي قرار أو تنفيذ.</p>

              {selected ? (
                <div className="space-y-5">
                  {/* Metric grid */}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-[#0E1420] p-4">
                      <p className="text-xs text-slate-500 dark:text-slate-400">نوع العملية</p>
                      <p className="mt-1 font-bold text-slate-900 dark:text-white text-sm">{actionName[selected.actionType as ApprovalActionType] || selected.actionType}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-[#0E1420] p-4">
                      <p className="text-xs text-slate-500 dark:text-slate-400">القيمة المجمدة</p>
                      <p className="mt-1 font-mono font-bold text-slate-900 dark:text-white tabular-nums text-lg">
                        <SensitiveValue>{money(selected.amount, selected.currency)}</SensitiveValue>
                      </p>
                    </div>
                    <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-[#0E1420] p-4">
                      <p className="text-xs text-slate-500 dark:text-slate-400">مقدم الطلب</p>
                      <p className="mt-1 font-semibold text-slate-900 dark:text-white text-sm">{selected.requesterName || "عضو العائلة"}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-[#0E1420] p-4">
                      <p className="text-xs text-slate-500 dark:text-slate-400">انتهاء الطلب</p>
                      <p className="mt-1 font-mono font-semibold text-slate-900 dark:text-white text-sm tabular-nums">{dateTime(selected.expiresAt)}</p>
                    </div>
                  </div>

                  {/* Status info */}
                  <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/40 dark:bg-[#0E1420] p-4 text-sm flex items-start gap-3">
                    <div className="flex-1">
                      <p className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        حالة الطلب: <StatusBadge status={selected.status} />
                      </p>
                      <p className="mt-2 text-slate-500 dark:text-slate-400 text-xs leading-5">
                        {selected.executedEventId
                          ? `تم تنفيذ العملية في حدث دفتر رقم #${selected.executedEventId}.`
                          : "يبقى الطلب منفصلًا عن الدفتر حتى يُنفّذ صراحة بعد الاعتماد."}
                      </p>
                    </div>
                  </div>

                  {/* Approve / Reject actions */}
                  {selected.status === "pending" && selected.requestedByUserId !== currentUser.data?.id && (
                    <div className="flex flex-wrap gap-3">
                      <button
                        type="button"
                        disabled={decide.isPending}
                        onClick={() => decide.mutate({ requestId: selected.id, decision: "approved", note: null, reconfirmed: true })}
                        className="bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:hover:bg-slate-100 dark:text-slate-950 font-bold text-xs py-2.5 px-5 rounded-xl shadow-xs transition-all border border-slate-900 dark:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        اعتماد القرار
                      </button>
                      <button
                        type="button"
                        disabled={decide.isPending}
                        onClick={() => decide.mutate({ requestId: selected.id, decision: "rejected", note: null, reconfirmed: true })}
                        className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200/80 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/60 font-bold text-xs py-2.5 px-5 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        رفض الطلب
                      </button>
                    </div>
                  )}

                  {/* Self-approval guard */}
                  {selected.status === "pending" && selected.requestedByUserId === currentUser.data?.id && (
                    <div className="flex items-center gap-2 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/60 p-3 text-sm text-amber-700 dark:text-amber-300">
                      <CircleAlert className="size-4 shrink-0" />
                      لا يمكنك اعتماد أو رفض الطلب الذي أنشأته — مبدأ الفصل بين الصلاحيات.
                    </div>
                  )}

                  {/* Execute approved */}
                  {selected.status === "approved" && (
                    <button
                      type="button"
                      disabled={isExecuting}
                      onClick={() => execute({ id: selected.id, actionType: selected.actionType as ApprovalActionType })}
                      className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white font-bold text-xs py-2.5 px-5 rounded-xl shadow-xs transition-all border border-indigo-700 dark:border-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Play className="size-3.5" />
                      تنفيذ البيانات المجمدة
                    </button>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="size-12 rounded-2xl bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-center mx-auto mb-3">
                    <LockKeyhole className="size-6" />
                  </div>
                  <p className="text-slate-800 dark:text-slate-200 font-bold text-sm mb-1">اختر طلبًا</p>
                  <p className="text-slate-500 dark:text-slate-400 text-xs max-w-sm mx-auto leading-relaxed">حدد طلب اعتماد من القائمة لعرض التفاصيل والإجراءات المتاحة وفق صلاحيتك.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Decision Log ── */}
        <div className="bg-white dark:bg-[#0B0F17] border border-slate-200/90 dark:border-slate-800/80 rounded-2xl p-6 shadow-xs">
          <div className="mb-1">
            <p className="text-slate-900 dark:text-white font-bold text-sm">سجل القرارات</p>
          </div>
          <p className="text-slate-500 dark:text-slate-400 text-xs mb-5">يحفظ القرار والمعتمد ووقت الإقرار ومصير التنفيذ ضمن مساحة العائلة فقط.</p>

          {history.isLoading ? (
            <p className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">جارٍ تحميل السجل…</p>
          ) : history.data?.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[650px] text-right text-sm">
                <thead>
                  <tr className="bg-slate-50/90 dark:bg-[#0E1420] border-b border-slate-200/90 dark:border-slate-800/80">
                    <th className="py-3.5 px-4 text-xs font-bold text-slate-600 dark:text-slate-400">القرار</th>
                    <th className="py-3.5 px-4 text-xs font-bold text-slate-600 dark:text-slate-400">رقم الطلب</th>
                    <th className="py-3.5 px-4 text-xs font-bold text-slate-600 dark:text-slate-400">المعتمد</th>
                    <th className="py-3.5 px-4 text-xs font-bold text-slate-600 dark:text-slate-400">وقت الإقرار</th>
                    <th className="py-3.5 px-4 text-xs font-bold text-slate-600 dark:text-slate-400">حالة الطلب</th>
                  </tr>
                </thead>
                <tbody>
                  {history.data.map((entry, idx) => (
                    <tr key={entry.id} className={`border-b border-slate-200/70 dark:border-slate-800/70 hover:bg-slate-50/80 dark:hover:bg-[#0E1420] transition-colors align-middle ${idx === history.data.length - 1 ? "border-b-0" : ""}`}>
                      <td className="py-3.5 px-4 text-xs"><DecisionStatusBadge decision={entry.decision} /></td>
                      <td className="py-3.5 px-4 text-xs"><span className="font-mono font-semibold text-slate-700 dark:text-slate-300">#{entry.requestId}</span></td>
                      <td className="py-3.5 px-4 text-xs font-medium text-slate-800 dark:text-slate-200">{entry.approverName || "عضو معتمد"}</td>
                      <td className="py-3.5 px-4 text-xs"><span className="font-mono tabular-nums text-slate-600 dark:text-slate-300">{dateTime(entry.reconfirmedAt || entry.createdAt)}</span></td>
                      <td className="py-3.5 px-4 text-xs"><StatusBadge status={entry.requestStatus} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="size-12 rounded-2xl bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-center mx-auto mb-3">
                <CheckCheck className="size-6" />
              </div>
              <p className="text-slate-800 dark:text-slate-200 font-bold text-sm mb-1">لا يوجد سجل قرارات بعد</p>
              <p className="text-slate-500 dark:text-slate-400 text-xs max-w-sm mx-auto leading-relaxed">ستُدوَّن قرارات الاعتماد والرفض هنا فور إصدارها من قِبل أعضاء النطاق المخوّلين.</p>
            </div>
          )}
        </div>
      </main>
    </DashboardLayout>
  );
}
