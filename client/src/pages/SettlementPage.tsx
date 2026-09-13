import DashboardLayout from "@/components/DashboardLayout";
import PageHeader from "@/components/PageHeader";
import ConfirmDialog from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, Link2, Handshake } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import SensitiveValue from "@/components/SensitiveValue";
import { formatMoney } from "@/lib/financialDisplay";

const errorText = (error: unknown) => error instanceof Error ? error.message : "تعذر إكمال التسوية.";
const money = (value: string | null | undefined, currency?: string) => value ? <SensitiveValue>{formatMoney(value, currency, 2)}</SensitiveValue> : "—";

interface PendingSettlement {
  type: "iou" | "zakat" | "claim";
  id: number;
  title: string;
  description: string;
}

export function SettlementMatchingView({ showHeader = true }: { showHeader?: boolean }) {
  const utils = trpc.useUtils();
  const events = trpc.family.ledger.recent.useQuery();
  const ious = trpc.family.ious.list.useQuery();
  const zakat = trpc.family.zakat.list.useQuery();
  const claims = trpc.family.insurance.claims.useQuery();
  const [eventId, setEventId] = useState("none");
  const [pendingAction, setPendingAction] = useState<PendingSettlement | null>(null);

  const settleIou = trpc.family.ious.settle.useMutation({
    onSuccess: () => {
      toast.success("تم ربط المستحق بالحركة المنشورة.");
      setPendingAction(null);
      void utils.family.ious.list.invalidate();
    },
    onError: error => {
      setPendingAction(null);
      toast.error(errorText(error));
    },
  });
  const payZakat = trpc.family.zakat.markPaid.useMutation({
    onSuccess: () => {
      toast.success("تم تعليم التقييم كمدفوع.");
      setPendingAction(null);
      void utils.family.zakat.list.invalidate();
    },
    onError: error => {
      setPendingAction(null);
      toast.error(errorText(error));
    },
  });
  const receiveClaim = trpc.family.insurance.markReceived.useMutation({
    onSuccess: () => {
      toast.success("تم ربط التعويض بالحركة المنشورة.");
      setPendingAction(null);
      void utils.family.insurance.claims.invalidate();
    },
    onError: error => {
      setPendingAction(null);
      toast.error(errorText(error));
    },
  });

  const selected = eventId === "none" ? null : Number(eventId);
  const busy = settleIou.isPending || payZakat.isPending || receiveClaim.isPending;

  const handleConfirmAction = () => {
    if (!selected || !pendingAction) return;
    if (pendingAction.type === "iou") {
      settleIou.mutate({ iouId: pendingAction.id, financialEventId: selected });
    } else if (pendingAction.type === "zakat") {
      payZakat.mutate({ assessmentId: pendingAction.id, financialEventId: selected });
    } else if (pendingAction.type === "claim") {
      receiveClaim.mutate({ claimId: pendingAction.id, financialEventId: selected });
    }
  };

  return (
    <div className="space-y-6" dir="rtl">
      {showHeader && (
        <PageHeader
          title="تسويات مرتبطة بالدفتر"
          description="اختر حدثاً منشوراً أولاً. يتحقق النظام خادمياً من أنه ضمن مساحتك وأن نوعه وعملته يتوافقان مع السجل قبل أي تغيير للحالة."
          icon={Handshake}
          breadcrumbs={[
            { label: "النقد والالتزامات", href: "/cash-flow" },
            { label: "التسويات وتصفية الالتزامات" },
          ]}
          badge="مطابقة مع الدفتر"
        />
      )}

      {/* Reference Ledger Selector Card */}
      <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800/80 bg-white dark:bg-[#0B0F17] p-6 shadow-xs">
        <div className="mb-1">
          <h3 className="text-slate-900 dark:text-white font-bold text-base flex items-center gap-2">
            <Link2 className="size-5 text-slate-700 dark:text-slate-300" />
            <span>حدث الدفتر المرجعي</span>
          </h3>
        </div>
        <p className="text-slate-500 dark:text-slate-400 text-xs mb-4">
          الاختيار لا ينشئ قيداً جديداً ولا يعيد كتابة قيود سابقة.
        </p>
        <div>
          <Label className="text-slate-700 dark:text-slate-300 font-semibold text-xs mb-1.5 block">حدث منشور</Label>
          <Select value={eventId} onValueChange={setEventId}>
            <SelectTrigger className="bg-white dark:bg-[#0E1420] border border-slate-300 dark:border-slate-700/80 text-slate-900 dark:text-slate-100 rounded-xl font-medium text-xs py-2.5 px-3 focus:ring-1 focus:ring-slate-800 dark:focus:ring-slate-400 transition-all h-auto">
              <SelectValue placeholder="اختر حدث الدفتر" />
            </SelectTrigger>
            <SelectContent className="bg-white dark:bg-[#0E1420] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 rounded-xl shadow-lg">
              <SelectItem value="none">اختر حدثاً منشوراً</SelectItem>
              {events.data?.filter(event => event.status === "posted").map(event => (
                <SelectItem key={event.id} value={String(event.id)}>
                  #{event.id} · {event.eventType} · {money(event.grossAmount, event.currency)} · {event.currency}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <section className="grid gap-6 lg:grid-cols-3">
        <SettlementCard
          title="المستحقات النشطة"
          items={ious.data?.filter(item => item.status === "active") ?? []}
          render={item => (
            <>
              <b className="text-slate-900 dark:text-white font-bold text-sm block">{item.counterpartyName}</b>
              <p className="text-slate-500 dark:text-slate-400 text-xs">
                {item.direction === "receivable" ? "مستحق لك" : "مستحق عليك"} · {money(item.amount, item.currency)}
              </p>
              <Button
                className="w-full sm:w-auto bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:hover:bg-slate-100 dark:text-slate-950 font-bold text-xs px-3.5 py-2 rounded-xl shadow-xs transition-all disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-1.5 border border-slate-900 dark:border-transparent mt-2 h-auto cursor-pointer"
                disabled={!selected || busy}
                onClick={() =>
                  setPendingAction({
                    type: "iou",
                    id: item.id,
                    title: "تأكيد تسوية المستحق",
                    description: `هل أنت متأكد من تسوية المستحق لطرف "${item.counterpartyName}" وربطه بحدث الدفتر #${selected}؟`,
                  })
                }
              >
                <CheckCircle2 className="size-4" />
                <span>تسوية بالحدث</span>
              </Button>
            </>
          )}
        />

        <SettlementCard
          title="تقييمات زكاة قابلة للدفع"
          items={zakat.data?.filter(item => item.status === "calculated") ?? []}
          render={item => (
            <>
              <b className="text-slate-900 dark:text-white font-bold text-sm block">{money(item.zakatDueBase, item.currency)}</b>
              <p className="text-slate-500 dark:text-slate-400 text-xs">وعاء مؤهل {money(item.eligibleBase, item.currency)}</p>
              <Button
                className="w-full sm:w-auto bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:hover:bg-slate-100 dark:text-slate-950 font-bold text-xs px-3.5 py-2 rounded-xl shadow-xs transition-all disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-1.5 border border-slate-900 dark:border-transparent mt-2 h-auto cursor-pointer"
                disabled={!selected || busy}
                onClick={() =>
                  setPendingAction({
                    type: "zakat",
                    id: item.id,
                    title: "تأكيد سداد تقييم الزكاة",
                    description: `هل أنت متأكد من تعليم تقييم الزكاة كمدفوع وربطه بحدث الدفتر المنشور #${selected}؟`,
                  })
                }
              >
                <CheckCircle2 className="size-4" />
                <span>تعليم كمدفوع</span>
              </Button>
            </>
          )}
        />

        <SettlementCard
          title="مطالبات مقدمة"
          items={claims.data?.filter(item => item.status === "submitted") ?? []}
          render={item => (
            <>
              <b className="text-slate-900 dark:text-white font-bold text-sm block">{item.policyName}</b>
              <p className="text-slate-500 dark:text-slate-400 text-xs">مطالبة {money(item.claimedAmount, item.currency)}</p>
              <Button
                className="w-full sm:w-auto bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:hover:bg-slate-100 dark:text-slate-950 font-bold text-xs px-3.5 py-2 rounded-xl shadow-xs transition-all disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-1.5 border border-slate-900 dark:border-transparent mt-2 h-auto cursor-pointer"
                disabled={!selected || busy}
                onClick={() =>
                  setPendingAction({
                    type: "claim",
                    id: item.id,
                    title: "تأكيد استلام التعويض",
                    description: `هل أنت متأكد من تسجيل استلام مبلغ التعويض لوثيقة "${item.policyName}" وربطه بالحدث #${selected}؟`,
                  })
                }
              >
                <CheckCircle2 className="size-4" />
                <span>تسجيل الاستلام</span>
              </Button>
            </>
          )}
        />
      </section>

      <ConfirmDialog
        open={Boolean(pendingAction)}
        onOpenChange={open => !open && setPendingAction(null)}
        title={pendingAction?.title || "تأكيد التسوية"}
        description={pendingAction?.description || ""}
        confirmText="تأكيد التسوية والربط"
        cancelText="إلغاء"
        isLoading={busy}
        onConfirm={handleConfirmAction}
      />
    </div>
  );
}

export default function SettlementPage() {
  return (
    <DashboardLayout>
      <main className="mx-auto max-w-6xl space-y-6" dir="rtl">
        <SettlementMatchingView showHeader={true} />
      </main>
    </DashboardLayout>
  );
}

function SettlementCard<T extends { id: number }>({
  title,
  items,
  render,
}: {
  title: string;
  items: T[];
  render: (item: T) => React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800/80 bg-white dark:bg-[#0B0F17] p-6 shadow-xs flex flex-col justify-between">
      <div>
        <h3 className="text-slate-900 dark:text-white font-bold text-base mb-4">{title}</h3>
        <div className="space-y-3">
          {items.length ? (
            items.map(item => (
              <div
                className="space-y-2 rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-slate-50/60 dark:bg-[#0E1420] p-4 text-xs"
                key={item.id}
              >
                {render(item)}
              </div>
            ))
          ) : (
            <div className="py-8 text-center">
              <div className="size-10 rounded-xl bg-slate-100 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 flex items-center justify-center mx-auto mb-2 border border-slate-200/60 dark:border-slate-700/60">
                <Handshake className="size-5" />
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">لا توجد سجلات تتطلب تسوية.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

