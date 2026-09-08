import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, Link2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import SensitiveValue from "@/components/SensitiveValue";
import { formatMoney } from "@/lib/financialDisplay";

const errorText = (error: unknown) => error instanceof Error ? error.message : "تعذر إكمال التسوية.";
const money = (value: string | null | undefined, currency?: string) => value ? <SensitiveValue>{formatMoney(value, currency, 0)}</SensitiveValue> : "—";

export default function SettlementPage() {
  const utils = trpc.useUtils();
  const events = trpc.family.ledger.recent.useQuery();
  const ious = trpc.family.ious.list.useQuery();
  const zakat = trpc.family.zakat.list.useQuery();
  const claims = trpc.family.insurance.claims.useQuery();
  const [eventId, setEventId] = useState("none");
  const settleIou = trpc.family.ious.settle.useMutation({ onSuccess: () => { toast.success("تم ربط المستحق بالحركة المنشورة."); void utils.family.ious.list.invalidate(); }, onError: error => toast.error(errorText(error)) });
  const payZakat = trpc.family.zakat.markPaid.useMutation({ onSuccess: () => { toast.success("تم تعليم التقييم كمدفوع."); void utils.family.zakat.list.invalidate(); }, onError: error => toast.error(errorText(error)) });
  const receiveClaim = trpc.family.insurance.markReceived.useMutation({ onSuccess: () => { toast.success("تم ربط التعويض بالحركة المنشورة."); void utils.family.insurance.claims.invalidate(); }, onError: error => toast.error(errorText(error)) });
  const selected = eventId === "none" ? null : Number(eventId);
  const busy = settleIou.isPending || payZakat.isPending || receiveClaim.isPending;
  return <DashboardLayout><main className="mx-auto max-w-6xl space-y-6" dir="rtl"><header className="rounded-[1.75rem] bg-gradient-to-l from-emerald-700 to-slate-950 p-7 text-white"><p className="text-sm text-emerald-100">FAMILY / LEDGER-BOUND SETTLEMENTS</p><h1 className="mt-2 text-3xl font-bold">تسويات مرتبطة بالدفتر</h1><p className="mt-2 text-sm leading-6 text-slate-200">اختر حدثاً منشوراً أولاً. يتحقق النظام خادمياً من أنه ضمن مساحتك وأن نوعه وعملته يتوافقان مع السجل قبل أي تغيير للحالة.</p></header><Card className="fintech-surface-card"><CardHeader><CardTitle className="flex items-center gap-2"><Link2 className="size-5 text-primary" />حدث الدفتر المرجعي</CardTitle><CardDescription>الاختيار لا ينشئ قيداً جديداً ولا يعيد كتابة قيود سابقة.</CardDescription></CardHeader><CardContent><Label>حدث منشور</Label><Select value={eventId} onValueChange={setEventId}><SelectTrigger className="mt-2"><SelectValue placeholder="اختر حدث الدفتر" /></SelectTrigger><SelectContent><SelectItem value="none">اختر حدثاً منشوراً</SelectItem>{events.data?.filter(event => event.status === "posted").map(event => <SelectItem key={event.id} value={String(event.id)}>#{event.id} · {event.eventType} · {money(event.grossAmount, event.currency)} · {event.currency}</SelectItem>)}</SelectContent></Select></CardContent></Card><section className="grid gap-5 lg:grid-cols-3"><SettlementCard title="المستحقات النشطة" items={ious.data?.filter(item => item.status === "active") ?? []} render={item => <><b>{item.counterpartyName}</b><p>{item.direction === "receivable" ? "مستحق لك" : "مستحق عليك"} · {money(item.amount, item.currency)}</p><Button size="sm" disabled={!selected || busy} onClick={() => selected && settleIou.mutate({ iouId: item.id, financialEventId: selected })}><CheckCircle2 className="size-4" />تسوية بالحدث</Button></>} /><SettlementCard title="تقييمات زكاة قابلة للدفع" items={zakat.data?.filter(item => item.status === "calculated") ?? []} render={item => <><b>{money(item.zakatDueBase, item.currency)}</b><p>وعاء مؤهل {money(item.eligibleBase, item.currency)}</p><Button size="sm" disabled={!selected || busy} onClick={() => selected && payZakat.mutate({ assessmentId: item.id, financialEventId: selected })}><CheckCircle2 className="size-4" />تعليم كمدفوع</Button></>} /><SettlementCard title="مطالبات مقدمة" items={claims.data?.filter(item => item.status === "submitted") ?? []} render={item => <><b>{item.policyName}</b><p>مطالبة {money(item.claimedAmount, item.currency)}</p><Button size="sm" disabled={!selected || busy} onClick={() => selected && receiveClaim.mutate({ claimId: item.id, financialEventId: selected })}><CheckCircle2 className="size-4" />تسجيل الاستلام</Button></>} /></section></main></DashboardLayout>;
}

function SettlementCard<T extends { id: number }>({ title, items, render }: { title: string; items: T[]; render: (item: T) => React.ReactNode }) {
  return <Card className="fintech-surface-card"><CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader><CardContent className="space-y-3">{items.length ? items.map(item => <div className="space-y-2 rounded-xl bg-muted/50 p-3 text-sm" key={item.id}>{render(item)}</div>) : <p className="py-5 text-center text-sm text-muted-foreground">لا توجد سجلات تتطلب تسوية.</p>}</CardContent></Card>;
}
