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
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useState, useMemo } from "react";
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

  // Pagination state (Limit 25/50)
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const allEvents = events.data ?? [];
  const totalEvents = allEvents.length;
  const totalPages = Math.max(1, Math.ceil(totalEvents / pageSize));

  const paginatedEvents = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return allEvents.slice(startIndex, startIndex + pageSize);
  }, [allEvents, currentPage, pageSize]);

  const post = trpc.family.ledger.postCash.useMutation({
    onSuccess: result => {
      toast.success(result.approvalRequired ? "تم تجميد العملية وإنشاء طلب اعتماد عائلي." : "تم نشر العملية وقيدها في الدفتر.");
      void utils.family.dashboard.invalidate();
      void utils.family.accounts.list.invalidate();
      void utils.family.ledger.recent.invalidate();
      void utils.family.cashFlow.summary.invalidate();
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
          <Card className="border border-border/50 shadow-xs rounded-2xl bg-white dark:bg-[#0E1420] overflow-hidden">
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
          <Card className="border border-border/50 shadow-xs rounded-2xl bg-white dark:bg-[#0E1420] overflow-hidden">
            <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3 border-b border-border/40">
              <div>
                <CardTitle className="flex items-center gap-2 text-base font-bold">
                  <ArrowLeftRight className="size-5 text-emerald-700 dark:text-emerald-400" />
                  <span>العمليات المنشورة</span>
                </CardTitle>
                <CardDescription className="text-xs">العمليات الحديثة تُقرأ مباشرة من دفتر نطاقك المحاسبي.</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-medium text-slate-500 bg-slate-100 dark:bg-slate-800/80 px-2.5 py-1 rounded-lg border border-border/50">
                  {totalEvents} قيد
                </span>
                <Select value={String(pageSize)} onValueChange={(val) => { setPageSize(Number(val)); setCurrentPage(1); }}>
                  <SelectTrigger className="h-7 text-xs w-20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="15">15 صف</SelectItem>
                    <SelectItem value="25">25 صف</SelectItem>
                    <SelectItem value="50">50 صف</SelectItem>
                    <SelectItem value="100">100 صف</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="p-4 sm:p-5">
              {events.isLoading ? (
                <Skeleton className="h-64" />
              ) : events.error ? (
                <InlineError message={textError(events.error)} />
              ) : allEvents.length ? (
                <div className="space-y-4">
                  <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {paginatedEvents.map(event => (
                      <div className="flex items-center justify-between gap-4 py-3.5 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 px-2 rounded-xl transition-colors" key={event.id}>
                        <div className="flex items-center gap-3">
                          <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-800/60 p-2 text-emerald-700 dark:text-emerald-400">
                            {["withdrawal", "expense", "sell"].includes(event.eventType) ? (
                              <ArrowUpRight className="size-4" />
                            ) : (
                              <ArrowDownLeft className="size-4" />
                            )}
                          </div>
                          <div>
                            <p className="font-semibold text-sm text-slate-900 dark:text-slate-100">{eventLabel[event.eventType] || event.eventType}</p>
                            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                              {dateTime(event.occurredAt)}
                              {event.memo ? ` · ${event.memo}` : ""}
                            </p>
                          </div>
                        </div>
                        <div className="text-left" dir="ltr">
                          <p className="font-semibold font-mono text-sm text-slate-900 dark:text-slate-100">{money(event.grossAmount, event.currency)}</p>
                          <Badge className="mt-0.5" variant={event.status === "posted" ? "secondary" : "outline"}>
                            {event.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Responsive Pagination Bar */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between pt-3 border-t border-border/40 text-xs">
                      <span className="text-slate-500 font-medium">
                        صفحة {currentPage} من {totalPages} ({totalEvents} إجمالي)
                      </span>
                      <div className="flex items-center gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={currentPage <= 1}
                          onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                          className="h-8 px-2.5 text-xs gap-1"
                        >
                          <ChevronRight className="size-3.5" />
                          <span>السابق</span>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={currentPage >= totalPages}
                          onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                          className="h-8 px-2.5 text-xs gap-1"
                        >
                          <span>التالي</span>
                          <ChevronLeft className="size-3.5" />
                        </Button>
                      </div>
                    </div>
                  )}
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
