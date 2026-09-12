import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { CircleAlert } from "lucide-react";

export default function PriorityAlerts() {
  const { isAuthenticated } = useAuth();
  const alerts = trpc.family.planning.marketSignals.useQuery();
  if (!isAuthenticated || alerts.isLoading || alerts.error || !alerts.data?.length) return null;
  return <section role="alert" aria-live="polite" className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/40 dark:border-amber-800/40 p-4 text-right text-sm text-[#0B1628] dark:text-slate-100"><div className="flex items-center gap-2 font-semibold"><CircleAlert className="size-5 text-amber-600 dark:text-amber-400" />تنبيهات أولوية</div><ul className="mt-2 space-y-2">{alerts.data.slice(0, 3).map(alert => <li key={alert.id}><strong>{alert.title}:</strong> {alert.detail}</li>)}</ul><p className="mt-3 text-xs text-slate-600 dark:text-slate-400">هذه إشارات للمراجعة فقط ولا تعرض أي قيمة مالية أو تنفذ عملية تلقائية.</p></section>;
}
