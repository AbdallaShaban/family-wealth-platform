import React from "react";
import { trpc } from "@/lib/trpc";
import {
  DashboardLayout,
  PageHeader,
  PageLoading,
  InlineError,
  dateTime,
  textError,
  AuditActionBadge,
  AuditDetails,
} from "./familyShared";
import { ShieldCheck } from "lucide-react";

export function AuditPage() {
  const audit = trpc.family.audit.recent.useQuery();

  return (
    <DashboardLayout>
      <div dir="rtl" className="mx-auto max-w-6xl space-y-6">
        <PageHeader
          title="سجل التدقيق الرقابي"
          description="أثر التغييرات والعمليات المالية والرقابية الموثقة زمنياً ضمن مساحتك المالية."
          breadcrumbs={[
            { label: "الرئيسية", href: "/" },
            { label: "الحوكمة والإدارة", href: "/operations" },
            { label: "سجل التدقيق الرقابي" },
          ]}
          badge={
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 text-slate-700 dark:text-slate-300 font-medium text-xs shadow-2xs">
              <ShieldCheck className="size-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>سجل رقابي غير قابل للتعديل (Append-Only)</span>
            </div>
          }
          icon={ShieldCheck}
        />

        {audit.isLoading ? (
          <PageLoading />
        ) : audit.error ? (
          <InlineError message={textError(audit.error)} />
        ) : audit.data?.length ? (
          <div className="bg-white dark:bg-[#0B0F17] border border-slate-200/90 dark:border-slate-800/80 rounded-2xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-right text-sm">
                <thead>
                  <tr className="bg-slate-50/90 dark:bg-[#0E1420] border-b border-slate-200/90 dark:border-slate-800/80">
                    <th className="py-3.5 px-4 text-xs font-bold text-slate-600 dark:text-slate-400">التاريخ والوقت</th>
                    <th className="py-3.5 px-4 text-xs font-bold text-slate-600 dark:text-slate-400">نوع العملية</th>
                    <th className="py-3.5 px-4 text-xs font-bold text-slate-600 dark:text-slate-400">المستخدم المنفذ</th>
                    <th className="py-3.5 px-4 text-xs font-bold text-slate-600 dark:text-slate-400">تفاصيل القيد والحدث</th>
                  </tr>
                </thead>
                <tbody>
                  {audit.data.map((record, idx) => (
                    <tr
                      key={record.id}
                      className={`border-b border-slate-200/70 dark:border-slate-800/70 hover:bg-slate-50/80 dark:hover:bg-[#0E1420] transition-colors align-top ${
                        idx === audit.data!.length - 1 ? "border-b-0" : ""
                      }`}
                    >
                      <td className="py-3.5 px-4 whitespace-nowrap text-xs">
                        <span className="font-mono tabular-nums text-slate-600 dark:text-slate-300 font-medium">
                          {dateTime(record.occurredAt)}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-xs">
                        <AuditActionBadge action={record.action} />
                      </td>
                      <td className="py-3.5 px-4 text-xs">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-[#1A2234] border border-slate-200/80 dark:border-slate-700/80 text-slate-800 dark:text-slate-200 font-mono font-bold">
                          المستخدم {record.actorUserId ? `#${record.actorUserId}` : "#1"}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-xs">
                        <AuditDetails targetType={record.targetType} targetId={record.targetId} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="size-14 rounded-2xl bg-slate-100 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-center mx-auto mb-4">
              <ShieldCheck className="size-6" />
            </div>
            <p className="text-sm font-bold text-slate-800 dark:text-slate-200">لا توجد أحداث تدقيق حتى الآن</p>
            <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 max-w-xs leading-5">
              سيظهر هنا إنشاء الحسابات والأسعار ونشر العمليات من مصدرها الفعلي بمجرد بدء التشغيل.
            </p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

export default AuditPage;
