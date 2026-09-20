import DashboardLayout from "@/components/DashboardLayout";
import PageHeader from "@/components/PageHeader";
import VaultAttachmentField from "@/components/VaultAttachmentField";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  BadgeDollarSign,
  BookOpenCheck,
  Landmark,
  Loader2,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  CashEvent,
  CreateAccountDialog,
  dateTime,
  EmptyState,
  eventLabel,
  InlineError,
  money,
  textError,
  useFamilyPermissions,
} from "./familyShared";

const ReceiptTextIcon = BookOpenCheck;

export default function LedgerPage() {
  const utils = trpc.useUtils();
  const access = useFamilyPermissions();
  const accounts = trpc.family.accounts.list.useQuery();
  const events = trpc.family.ledger.recent.useQuery();
  const [eventType, setEventType] = useState<CashEvent>("deposit");
  const [accountId, setAccountId] = useState("");
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [vaultDocId, setVaultDocId] = useState<number | null>(null);
  const selected = accounts.data?.find(account => String(account.id) === accountId);

  const post = trpc.family.ledger.postCash.useMutation({
    onSuccess: result => {
      toast.success(result.approvalRequired ? "تم تجميد العملية وإنشاء طلب اعتماد عائلي." : "تم نشر العملية وقيدها في الدفتر.");
      void utils.family.dashboard.invalidate();
      void utils.family.accounts.list.invalidate();
      void utils.family.ledger.recent.invalidate();
      setAmount("");
      setMemo("");
      setVaultDocId(null);
    },
    onError: error => toast.error(textError(error)),
  });

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!selected) return toast.error("اختر حسابًا أولًا.");
    const fullMemo = vaultDocId ? `${memo ? memo + " " : ""}[مستند الخزنة #${vaultDocId}]` : (memo || null);
    post.mutate({
      eventType,
      accountId: Number(accountId),
      amount,
      currency: selected.currency,
      occurredAt: Date.now(),
      memo: fullMemo,
      idempotencyKey: crypto.randomUUID(),
    });
  };

  return (
    <DashboardLayout>
      <div dir="rtl" className="mx-auto max-w-6xl space-y-6">
        <PageHeader
          title="العمليات والدفتر"
          description="لا تعدّل هذه الشاشة الرصيد مباشرةً؛ تنشئ عملية تُرحّل إلى قيد مدين/دائن متوازن."
          breadcrumbs={[
            { label: "الرئيسية", href: "/" },
            { label: "العمليات والسيولة", href: "/ledger" },
            { label: "العمليات والدفتر" },
          ]}
          badge={{ text: "القيد المزدوج", variant: "institutional" }}
          icon={BadgeDollarSign}
        />
        <div className="grid gap-6 lg:grid-cols-[.75fr_1.25fr]">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BadgeDollarSign className="size-5 text-emerald-700" />
                تسجيل عملية نقدية
              </CardTitle>
              <CardDescription>تحقق الخادم من الحساب والعملة والرصيد المتاح قبل النشر.</CardDescription>
            </CardHeader>
            <CardContent>
              {accounts.isLoading ? (
                <Skeleton className="h-64" />
              ) : accounts.data?.length ? (
                <form onSubmit={submit} className="grid gap-4">
                  <div className="grid gap-2">
                    <Label>نوع العملية</Label>
                    <Select value={eventType} onValueChange={value => setEventType(value as CashEvent)} disabled={!access.canEdit}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="deposit">إيداع</SelectItem>
                        <SelectItem value="withdrawal">سحب</SelectItem>
                        <SelectItem value="income">دخل</SelectItem>
                        <SelectItem value="expense">مصروف</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>الحساب</Label>
                    <Select value={accountId} onValueChange={setAccountId} disabled={!access.canEdit}>
                      <SelectTrigger><SelectValue placeholder="اختر حسابًا" /></SelectTrigger>
                      <SelectContent>
                        {accounts.data.map(account => (
                          <SelectItem key={account.id} value={String(account.id)}>
                            {account.name} — {account.currency}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="transaction-amount">المبلغ</Label>
                    <Input id="transaction-amount" inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} disabled={!access.canEdit} required />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="transaction-memo">مذكرة</Label>
                    <Textarea id="transaction-memo" value={memo} onChange={e => setMemo(e.target.value)} disabled={!access.canEdit} maxLength={2000} placeholder="اختياري" />
                  </div>
                  <VaultAttachmentField linkedEntityType="financial_event" onSelectDocument={(id: number | null) => setVaultDocId(id)} disabled={!access.canEdit} />
                  <Button type="submit" disabled={post.isPending || !access.canEdit}>
                    {post.isPending && <Loader2 className="ml-2 size-4 animate-spin" />}
                    {access.canEdit ? "نشر العملية" : "تتطلب صلاحية محرر"}
                  </Button>
                </form>
              ) : (
                <EmptyState icon={Landmark} title="أضف حسابًا قبل تسجيل العمليات" description="العملية يجب أن ترتبط بحساب مملوك لنطاقك المالي." action={<CreateAccountDialog />} />
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ArrowLeftRight className="size-5 text-emerald-700" />
                العمليات المنشورة
              </CardTitle>
              <CardDescription>العمليات الحديثة تُقرأ مباشرة من دفتر نطاقك.</CardDescription>
            </CardHeader>
            <CardContent>
              {events.isLoading ? (
                <Skeleton className="h-64" />
              ) : events.error ? (
                <InlineError message={textError(events.error)} />
              ) : events.data?.length ? (
                <div className="divide-y">
                  {events.data.map(event => (
                    <div className="flex items-center justify-between gap-4 py-4" key={event.id}>
                      <div className="flex items-center gap-3">
                        <div className="rounded-full bg-emerald-50 p-2 text-emerald-700">
                          {["withdrawal", "expense", "sell"].includes(event.eventType) ? (
                            <ArrowUpRight className="size-4" />
                          ) : (
                            <ArrowDownLeft className="size-4" />
                          )}
                        </div>
                        <div>
                          <p className="font-semibold">{eventLabel[event.eventType] || event.eventType}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            {dateTime(event.occurredAt)}
                            {event.memo ? ` · ${event.memo}` : ""}
                          </p>
                        </div>
                      </div>
                      <div className="text-left">
                        <p className="font-semibold">{money(event.grossAmount, event.currency)}</p>
                        <Badge className="mt-1" variant={event.status === "posted" ? "secondary" : "outline"}>
                          {event.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState icon={ReceiptTextIcon} title="دفترك جاهز لبدء التسجيل" description="بعد نشر أول إيداع أو مصروف أو تحويل ستظهر العملية هنا مع تاريخها وحالتها." />
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
export { LedgerPage };
