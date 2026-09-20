import React, { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  DashboardLayout,
  PageHeader,
  textError,
  useFamilyPermissions,
} from "./familyShared";
import { VaultAttachmentField } from "@/components/VaultAttachmentField";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { ReceiptText, Loader2 } from "lucide-react";

export function CashFlowRegisterCard({ onComplete }: { onComplete?: () => void }) {
  const utils = trpc.useUtils();
  const access = useFamilyPermissions();
  const accounts = trpc.family.accounts.list.useQuery();
  const categories = trpc.family.cashFlow.categories.useQuery();
  const [eventType, setEventType] = useState<"income" | "expense">("expense");
  const [accountId, setAccountId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [vaultDocId, setVaultDocId] = useState<number | null>(null);
  const [attachDocument, setAttachDocument] = useState(false);

  const post = trpc.family.ledger.postCash.useMutation({
    onSuccess: () => {
      toast.success("تم نشر التدفق وتصنيفه في الدفتر.");
      setAmount("");
      setMemo("");
      setVaultDocId(null);
      setAttachDocument(false);
      void utils.family.ledger.recent.invalidate();
      void utils.family.dashboard.invalidate();
      void utils.family.cashFlow.summary.invalidate();
      onComplete?.();
    },
    onError: error => toast.error(textError(error)),
  });

  const eligibleCategories = (categories.data ?? []).filter(category => category.direction === eventType);
  const selectedAccount = accounts.data?.find(account => String(account.id) === accountId);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedAccount || !categoryId) return toast.error("اختر الحساب وفئة التدفق.");
    const fullMemo = attachDocument && vaultDocId ? `${memo ? memo + " " : ""}[مستند الخزنة #${vaultDocId}]` : memo || null;
    post.mutate({
      eventType,
      accountId: selectedAccount.id,
      categoryId: Number(categoryId),
      amount,
      currency: selectedAccount.currency,
      occurredAt: Date.now(),
      memo: fullMemo,
      idempotencyKey: crypto.randomUUID(),
    });
  };

  const inputClass =
    "bg-white dark:bg-[#0E1420] border border-slate-300 dark:border-slate-700/80 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-xl font-medium text-xs py-2.5 px-3 focus:outline-hidden focus:border-slate-800 dark:focus:border-slate-400 focus:ring-1 focus:ring-slate-800 dark:focus:ring-slate-400 transition-all h-auto";

  return (
    <div className="bg-white dark:bg-[#0B0F17] border border-slate-200/90 dark:border-slate-800/80 rounded-2xl p-6 shadow-xs max-w-2xl mx-auto">
      <div className="mb-6">
        <h3 className="text-slate-900 dark:text-white font-bold text-base mb-1">تسجيل تدفق جديد</h3>
        <p className="text-slate-500 dark:text-slate-400 text-xs">
          اختر الفئة أولًا؛ لا تقبل المنصة فئة دخل لمصروف أو فئة مصروف لدخل.
        </p>
      </div>

      {accounts.isLoading || categories.isLoading ? (
        <Skeleton className="h-72 rounded-xl" />
      ) : (
        <form onSubmit={submit} className="grid gap-5">
          <div>
            <Label className="text-slate-700 dark:text-slate-300 font-semibold text-xs mb-1.5 block">
              الاتجاه
            </Label>
            <Select
              value={eventType}
              onValueChange={value => {
                setEventType(value as typeof eventType);
                setCategoryId("");
              }}
              disabled={!access.canEdit}
            >
              <SelectTrigger className={inputClass}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="income">دخل</SelectItem>
                <SelectItem value="expense">مصروف</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-slate-700 dark:text-slate-300 font-semibold text-xs mb-1.5 block">
              الحساب
            </Label>
            <Select value={accountId} onValueChange={setAccountId} disabled={!access.canEdit}>
              <SelectTrigger className={inputClass}>
                <SelectValue placeholder="اختر حسابًا" />
              </SelectTrigger>
              <SelectContent>
                {accounts.data
                  ?.filter(account => ["cash", "bank", "brokerage", "wallet"].includes(account.accountType))
                  .map(account => (
                    <SelectItem key={account.id} value={String(account.id)}>
                      {account.name} — {account.currency}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-slate-700 dark:text-slate-300 font-semibold text-xs mb-1.5 block">
              الفئة
            </Label>
            <Select value={categoryId} onValueChange={setCategoryId} disabled={!access.canEdit}>
              <SelectTrigger className={inputClass}>
                <SelectValue placeholder={`اختر فئة ${eventType === "income" ? "دخل" : "مصروف"}`} />
              </SelectTrigger>
              <SelectContent>
                {eligibleCategories.map(category => (
                  <SelectItem key={category.id} value={String(category.id)}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="classified-flow-amount" className="text-slate-700 dark:text-slate-300 font-semibold text-xs mb-1.5 block">
              المبلغ {selectedAccount ? `(${selectedAccount.currency})` : ""}
            </Label>
            <Input
              id="classified-flow-amount"
              value={amount}
              onChange={event => setAmount(event.target.value)}
              disabled={!access.canEdit}
              inputMode="decimal"
              required
              className={inputClass}
            />
          </div>

          <div>
            <Label htmlFor="classified-flow-memo" className="text-slate-700 dark:text-slate-300 font-semibold text-xs mb-1.5 block">
              مذكرة
            </Label>
            <Textarea
              id="classified-flow-memo"
              value={memo}
              onChange={event => setMemo(event.target.value)}
              disabled={!access.canEdit}
              maxLength={2000}
              placeholder="اختياري"
              className={`${inputClass} resize-none`}
            />
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={attachDocument}
                onChange={e => {
                  setAttachDocument(e.target.checked);
                  if (!e.target.checked) setVaultDocId(null);
                }}
                className="rounded-md border-slate-300 text-slate-900 focus:ring-slate-800 dark:border-slate-700 dark:bg-[#0E1420]"
              />
              <span>إرفاق مستند/فاتورة</span>
            </label>
            {attachDocument && (
              <div className="pt-1">
                <VaultAttachmentField
                  linkedEntityType="financial_event"
                  onSelectDocument={(id: number | null) => setVaultDocId(id)}
                  disabled={!access.canEdit}
                />
              </div>
            )}
          </div>

          <Button
            type="submit"
            disabled={post.isPending || !access.canEdit}
            className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm py-3 px-6 rounded-xl shadow-sm transition-all dark:bg-white dark:hover:bg-slate-100 dark:text-slate-950 border border-slate-900 dark:border-transparent mt-4 h-auto"
          >
            {post.isPending && <Loader2 className="ml-2 size-4 animate-spin" />}
            {access.canEdit ? "إتمام التدفق المحاسبي" : "تتطلب صلاحية محرر"}
          </Button>
        </form>
      )}
    </div>
  );
}

export function CashFlowRegisterPage() {
  const utils = trpc.useUtils();
  return (
    <DashboardLayout>
      <div dir="rtl" className="mx-auto max-w-3xl space-y-6">
        <PageHeader
          title="تسجيل دخل أو مصروف مصنف"
          description="ستغذي هذه العملية دفتر القيود والحساب والتدفق النقدي الفعلي ومقارنة الميزانية، ولا تعدّل أي رصيد مباشرة."
          breadcrumbs={[
            { label: "الرئيسية", href: "/" },
            { label: "العمليات والسيولة", href: "/cash-flow" },
            { label: "تسجيل تدفق مصنف" },
          ]}
          badge={{ text: "تدفق مصنف", variant: "institutional" }}
          icon={ReceiptText}
        />
        <CashFlowRegisterCard onComplete={() => void utils.family.cashFlow.summary.invalidate()} />
      </div>
    </DashboardLayout>
  );
}

export default CashFlowRegisterPage;
