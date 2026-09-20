import DashboardLayout from "@/components/DashboardLayout";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { ArrowLeftRight, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { CreateAccountDialog, EmptyState, textError } from "./familyShared";

export default function TransfersPage() {
  const utils = trpc.useUtils();
  const accounts = trpc.family.accounts.list.useQuery();
  const [fromAccountId, setFromAccountId] = useState("");
  const [toAccountId, setToAccountId] = useState("");
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const from = accounts.data?.find(account => String(account.id) === fromAccountId);
  const to = accounts.data?.find(account => String(account.id) === toAccountId);

  const transfer = trpc.family.ledger.transfer.useMutation({
    onSuccess: () => {
      toast.success("تم نشر التحويل بقيد متوازن بين الحسابين.");
      void utils.family.dashboard.invalidate();
      void utils.family.accounts.list.invalidate();
      void utils.family.ledger.recent.invalidate();
      setAmount("");
      setMemo("");
    },
    onError: error => toast.error(textError(error)),
  });

  const transferable = (accounts.data ?? []).filter(
    account => ["cash", "bank", "brokerage", "wallet"].includes(account.accountType) && account.status === "active"
  );

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!from || !to) return toast.error("اختر حساب المصدر وحساب الوجهة.");
    transfer.mutate({
      fromAccountId: from.id,
      toAccountId: to.id,
      amount,
      currency: from.currency,
      occurredAt: Date.now(),
      memo: memo || null,
      idempotencyKey: crypto.randomUUID(),
    });
  };

  return (
    <DashboardLayout>
      <div dir="rtl" className="mx-auto max-w-3xl space-y-6">
        <PageHeader
          title="تحويل بين الحسابات"
          description="ينقل التحويل القيمة بين حسابين ضمن نطاق FAMILY نفسه، ويمنع الخادم الرصيد السلبي والوصول خارج النطاق."
          breadcrumbs={[
            { label: "الرئيسية", href: "/" },
            { label: "العمليات والسيولة", href: "/transfers" },
            { label: "تحويل بين الحسابات" },
          ]}
          badge={{ text: "تحويل داخلي", variant: "institutional" }}
          icon={ArrowLeftRight}
        />
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowLeftRight className="size-5 text-emerald-700" />
              تحويل آمن
            </CardTitle>
            <CardDescription>
              تُقفل حسابات المصدر والوجهة بترتيب ثابت داخل معاملة قاعدة البيانات لتقليل تعارض التزامن.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {accounts.isLoading ? (
              <Skeleton className="h-64" />
            ) : transferable.length >= 2 ? (
              <form onSubmit={submit} className="grid gap-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label>من الحساب</Label>
                    <Select value={fromAccountId} onValueChange={setFromAccountId}>
                      <SelectTrigger><SelectValue placeholder="حساب المصدر" /></SelectTrigger>
                      <SelectContent>
                        {transferable.map(account => (
                          <SelectItem key={account.id} value={String(account.id)}>
                            {account.name} — {account.currency}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>إلى الحساب</Label>
                    <Select value={toAccountId} onValueChange={setToAccountId}>
                      <SelectTrigger><SelectValue placeholder="حساب الوجهة" /></SelectTrigger>
                      <SelectContent>
                        {transferable
                          .filter(account => String(account.id) !== fromAccountId)
                          .map(account => (
                            <SelectItem key={account.id} value={String(account.id)}>
                              {account.name} — {account.currency}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="transfer-amount">المبلغ {from ? `(${from.currency})` : ""}</Label>
                  <Input id="transfer-amount" value={amount} onChange={e => setAmount(e.target.value)} inputMode="decimal" required />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="transfer-memo">مذكرة</Label>
                  <Textarea id="transfer-memo" value={memo} onChange={e => setMemo(e.target.value)} maxLength={2000} placeholder="اختياري" />
                </div>
                <Button type="submit" disabled={transfer.isPending}>
                  {transfer.isPending && <Loader2 className="ml-2 size-4 animate-spin" />}
                  نشر التحويل
                </Button>
              </form>
            ) : (
              <EmptyState
                icon={ArrowLeftRight}
                title="أضف حسابين قابلين للتحويل"
                description="يلزم وجود حسابي نقد أو بنك أو وساطة نشطين على الأقل قبل إنشاء تحويل داخلي."
                action={<CreateAccountDialog />}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
export { TransfersPage };
