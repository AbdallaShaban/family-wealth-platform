import React, { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Sparkles,
  ClipboardPaste,
  CheckCircle2,
  Building2,
  ArrowUpRight,
  ArrowDownLeft,
  Smartphone,
  Wallet,
  AlertCircle,
  ShieldCheck,
} from "lucide-react";

interface SmartSmsPasteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function SmartSmsPasteModal({ open, onOpenChange, onSuccess }: SmartSmsPasteModalProps) {
  const [rawText, setRawText] = useState("");
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [editableAmount, setEditableAmount] = useState<string>("");
  const [editableMemo, setEditableMemo] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const utils = trpc.useUtils();
  const accountsQuery = trpc.family.accounts.list.useQuery(undefined, { enabled: open });
  const parseMutation = trpc.quant.parseFinancialSms.useMutation();
  const postCashMutation = trpc.family.ledger.postCash.useMutation();

  const liquidAccounts = (accountsQuery.data ?? []).filter(
    (a) => ["bank", "cash", "wallet"].includes(a.accountType) && a.status !== "archived"
  );

  // Set default account when accounts load
  useEffect(() => {
    if (liquidAccounts.length > 0 && !selectedAccountId) {
      setSelectedAccountId(String(liquidAccounts[0].id));
    }
  }, [liquidAccounts, selectedAccountId]);

  // Trigger parsing whenever rawText changes (with debounce)
  useEffect(() => {
    const trimmed = rawText.trim();
    if (trimmed.length < 5) {
      parseMutation.reset();
      return;
    }

    const timer = setTimeout(() => {
      parseMutation.mutate(
        { text: trimmed },
        {
          onSuccess: (data) => {
            if (data.success && data.amount > 0) {
              setEditableAmount(data.amount.toFixed(2));
              setEditableMemo(data.suggestedMemo || "");

              // Smart match account if accountMask or provider matches
              if (data.provider && liquidAccounts.length > 0) {
                const matched = liquidAccounts.find(
                  (a) =>
                    a.institution?.toLowerCase().includes(data.provider.toLowerCase()) ||
                    a.name.toLowerCase().includes(data.provider.toLowerCase())
                );
                if (matched) {
                  setSelectedAccountId(String(matched.id));
                }
              }
            }
          },
        }
      );
    }, 300);

    return () => clearTimeout(timer);
  }, [rawText]);

  const handlePasteClipboard = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText();
        if (text) {
          setRawText(text);
          toast.success("تم لصق النص من الحافظة بنجاح");
        }
      } else {
        toast.info("يرجى لصق النص يدوياً داخل الحقل");
      }
    } catch {
      toast.info("يرجى لصق النص يدوياً داخل الحقل");
    }
  };

  const parsed = parseMutation.data;

  const handleConfirmAndPost = async () => {
    const accountIdNum = parseInt(selectedAccountId, 10);
    const amountNum = parseFloat(editableAmount);

    if (isNaN(accountIdNum) || accountIdNum <= 0) {
      toast.error("يرجى اختيار الحساب البنكي أو المحفظة");
      return;
    }
    if (isNaN(amountNum) || amountNum <= 0) {
      toast.error("المبلغ المستخرج غير صالح");
      return;
    }

    setIsSubmitting(true);
    try {
      const eventType = parsed?.transactionType === "INCOME" ? "income" : "expense";
      const normalizedCurrency = parsed?.currency || "EGP";

      await postCashMutation.mutateAsync({
        eventType,
        accountId: accountIdNum,
        amount: amountNum.toFixed(2),
        currency: normalizedCurrency,
        occurredAt: Date.now(),
        memo: editableMemo.trim() || (parsed ? `${parsed.provider}: ${parsed.suggestedMemo}` : "قيد من رسالة بنكية"),
        idempotencyKey: `sms-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      });

      toast.success("تم تسجيل القيد في الدفتر المحاسبي بنجاح!");
      utils.family.accounts.list.invalidate();
      utils.family.bootstrap.invalidate();
      utils.quant.getForwardRunway.invalidate();

      // Reset modal
      setRawText("");
      parseMutation.reset();
      onOpenChange(false);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      toast.error(err?.message || "تعذر تسجيل القيد، يرجى المحاولة مرة أخرى.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="sm:max-w-lg bg-white dark:bg-[#0B0F17] border-slate-200 dark:border-white/10">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Smartphone className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-slate-900 dark:text-slate-100">
                لصق رسالة بنكية / إنستاباي الذكية
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 dark:text-slate-400">
                التعرف الفوري على رسائل إنستاباي، CIB، الأهلي، بنك مصر، فودافون كاش وتسجيلها بضغطة واحدة.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Input Box with Clipboard Paste Button */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                نص الرسالة أو إشعار المعاملة:
              </Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handlePasteClipboard}
                className="h-7 text-xs gap-1 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
              >
                <ClipboardPaste className="size-3.5" />
                <span>لصق من الحافظة</span>
              </Button>
            </div>
            <Textarea
              rows={3}
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder="مثال: تم تحويل مبلغ 1,250.00 جم إلى أحمد محمود عبر إنستاباي، أو عملية شراء POS بطاقة CIB..."
              className="text-xs font-mono resize-none bg-slate-50 dark:bg-white/[0.03] border-slate-200 dark:border-white/10"
            />
          </div>

          {/* Parsing State / Instant Preview Card */}
          {parseMutation.isPending && (
            <div className="flex items-center justify-center p-4 rounded-xl border border-dashed border-emerald-500/30 bg-emerald-500/5 text-xs text-emerald-600 gap-2">
              <Sparkles className="size-4 animate-spin" />
              <span>جاري تحليل بيانات المعاملة عبر المحلل الذكي...</span>
            </div>
          )}

          {parsed && parsed.success && (
            <div className="p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-500/5 dark:bg-emerald-500/[0.03] space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-600 text-white">
                    {parsed.provider}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold ${
                      parsed.transactionType === "INCOME"
                        ? "bg-teal-500/20 text-teal-800 dark:text-teal-300"
                        : "bg-rose-500/20 text-rose-800 dark:text-rose-300"
                    }`}
                  >
                    {parsed.transactionType === "INCOME" ? (
                      <>
                        <ArrowDownLeft className="size-3" />
                        <span>تحويل وارد / دخل</span>
                      </>
                    ) : (
                      <>
                        <ArrowUpRight className="size-3" />
                        <span>مصروف / مشتريات</span>
                      </>
                    )}
                  </span>
                </div>
                <span className="text-[11px] font-mono text-emerald-700 dark:text-emerald-400 font-semibold">
                  دقة التحليل: {parsed.confidence}%
                </span>
              </div>

              {/* Amount and Counterparty Details */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2 rounded-lg bg-white dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/10">
                  <span className="text-[10px] text-slate-500 block">المبلغ المستخرج:</span>
                  <div className="flex items-baseline gap-1 mt-0.5">
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={editableAmount}
                      onChange={(e) => setEditableAmount(e.target.value)}
                      className="h-7 text-sm font-bold font-mono text-slate-900 dark:text-slate-100 bg-transparent border-0 p-0 focus-visible:ring-0"
                    />
                    <span className="text-[11px] font-semibold text-slate-500">{parsed.currency}</span>
                  </div>
                </div>

                <div className="p-2 rounded-lg bg-white dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/10">
                  <span className="text-[10px] text-slate-500 block">الجهة / الطرف المقابل:</span>
                  <strong className="text-xs font-semibold text-slate-900 dark:text-slate-100 block truncate mt-1">
                    {parsed.counterparty || "غير محدد بالرسالة"}
                  </strong>
                </div>
              </div>

              {/* Memo input */}
              <div className="space-y-1">
                <Label className="text-[11px] text-slate-600 dark:text-slate-400">وصف القيد المقترح:</Label>
                <Input
                  value={editableMemo}
                  onChange={(e) => setEditableMemo(e.target.value)}
                  className="h-8 text-xs bg-white dark:bg-white/[0.03] border-slate-200 dark:border-white/10"
                />
              </div>

              {/* Account Selector */}
              <div className="space-y-1">
                <Label className="text-[11px] text-slate-600 dark:text-slate-400">
                  تسجيل المعاملة في حساب:
                </Label>
                <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                  <SelectTrigger className="h-8 text-xs bg-white dark:bg-white/[0.03] border-slate-200 dark:border-white/10">
                    <SelectValue placeholder="اختر الحساب المصرفي أو المحفظة" />
                  </SelectTrigger>
                  <SelectContent dir="rtl">
                    {liquidAccounts.map((acc) => (
                      <SelectItem key={acc.id} value={String(acc.id)}>
                        {acc.name} ({acc.institution || "حساب"}) — {Number(acc.balance).toLocaleString("en-US")} {acc.currency}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {parsed && !parsed.success && rawText.length >= 10 && (
            <div className="p-3 rounded-xl border border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-400 text-xs flex items-center gap-2">
              <AlertCircle className="size-4 shrink-0" />
              <span>لم يتم التعرف على نمط الرسالة البنكية بدقة. يمكنك مراجعة النص أو تعديل المبلغ يدوياً.</span>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:justify-start">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            إلغاء
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={!parsed || !parsed.success || isSubmitting || !editableAmount}
            onClick={handleConfirmAndPost}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-1.5"
          >
            {isSubmitting ? (
              <Sparkles className="size-4 animate-spin" />
            ) : (
              <CheckCircle2 className="size-4" />
            )}
            <span>تأكيد وتسجيل القيد في الدفتر</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
