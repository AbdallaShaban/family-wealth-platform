import React, { useState, useEffect, memo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { formatMoney } from "@/lib/financialDisplay";
import { trpc } from "@/lib/trpc";

interface ReconciliationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: {
    id: number | string;
    name: string;
    value?: number | string | null;
    currency?: string | null;
  } | null;
  defaultCurrency?: string;
  onSuccess?: () => void;
}

export const ReconciliationModal = memo(function ReconciliationModal({
  open,
  onOpenChange,
  account,
  defaultCurrency = "EGP",
  onSuccess,
}: ReconciliationModalProps) {
  const utils = trpc.useUtils();
  const reconcileAccountMutation = trpc.family.accounts.reconcile.useMutation();

  const [actualBalance, setActualBalance] = useState("");
  const [memoText, setMemoText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currency = account?.currency || defaultCurrency;

  useEffect(() => {
    if (account && open) {
      setActualBalance(String(account.value || ""));
      setMemoText(`تسوية رصيد: ${account.name}`);
    }
  }, [account, open]);

  const handleReconcile = async () => {
    if (!account) return;
    const target = parseFloat(actualBalance);
    if (isNaN(target) || target < 0) {
      toast.error("يرجى إدخال رصيد فعلي صحيح");
      return;
    }

    try {
      setIsSubmitting(true);
      await reconcileAccountMutation.mutateAsync({
        accountId: Number(account.id),
        actualBalance: target.toFixed(2),
        memo: memoText.trim() || undefined,
      });

      await utils.family.dashboard.invalidate();
      await utils.family.accounts.invalidate();
      toast.success(`تمت تسوية رصيد ${account.name} بنجاح وتحديث السجلات الدفترية.`);
      onOpenChange(false);
      onSuccess?.();
    } catch (err: any) {
      toast.error(err.message || "تعذر إتمام التسوية");
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentVal = Number(account?.value || 0);
  const targetVal = parseFloat(actualBalance);
  const hasDiff = !isNaN(targetVal);
  const diff = hasDiff ? targetVal - currentVal : 0;
  const isGain = diff > 0;
  const isZero = Math.abs(diff) < 0.001;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-md rounded-2xl p-6 bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 text-right"
        dir="rtl"
      >
        <DialogHeader className="text-right space-y-1">
          <DialogTitle className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <RefreshCw className="size-5 text-emerald-600 animate-spin-reverse" />
            تسوية ومطابقة الرصيد الفعلي (Account Reconciliation)
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-600 dark:text-slate-400 font-medium">
            أدخل رصيدك الحقيقي الآن (مثل رصيد تيلدا أو الحساب البنكي الفعلي). سيقوم النظام باحتساب الفارق وقيد تسوية دفتري فوري.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#0E1420] border border-slate-200 dark:border-slate-800 text-xs space-y-1">
            <div className="flex items-center justify-between text-slate-500">
              <span>الحساب المستهدف:</span>
              <strong className="text-slate-900 dark:text-white font-bold">{account?.name}</strong>
            </div>
            <div className="flex items-center justify-between text-slate-500">
              <span>الرصيد الدفتري المسجل حالياً:</span>
              <b className="font-mono font-bold text-slate-900 dark:text-white" dir="ltr">
                {formatMoney(currentVal, currency, 2)}
              </b>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              الرصيد الفعلي الحقيقي الحالي ({currency})
            </Label>
            <Input
              type="number"
              step="any"
              placeholder="0.00"
              value={actualBalance}
              onChange={(e) => setActualBalance(e.target.value)}
              className="bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-sm font-mono font-bold"
              dir="ltr"
            />
          </div>

          {/* Dynamic Difference Calculation Display */}
          {hasDiff && (
            <div
              className={`p-3 rounded-xl border text-xs flex items-center justify-between ${
                isZero
                  ? "bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300"
                  : isGain
                  ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/60 text-emerald-900 dark:text-emerald-200"
                  : "bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/60 text-amber-900 dark:text-amber-200"
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="font-bold">
                  {isZero
                    ? "الرصيد متطابق تماماً"
                    : isGain
                    ? "فارق إيجابي (تسوية رصيد / عائد دوري)"
                    : "فارق سالب (تسوية رصيد / فرق تسوية)"}
                </span>
              </div>
              <b className="font-mono font-bold text-sm" dir="ltr">
                {isGain ? "+ " : isZero ? "" : "- "}
                {formatMoney(Math.abs(diff), currency, 2)}
              </b>
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              ملاحظات أو بيان التسوية (اختياري)
            </Label>
            <Input
              type="text"
              placeholder="مثال: تسوية رصيد تيلدا / إضافة عائد الصندوق اليومي"
              value={memoText}
              onChange={(e) => setMemoText(e.target.value)}
              className="bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-xs"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-start pt-2 border-t border-slate-100 dark:border-slate-800">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="rounded-xl text-xs"
          >
            إلغاء
          </Button>
          <Button
            type="button"
            disabled={isSubmitting || !actualBalance}
            onClick={handleReconcile}
            className="rounded-xl text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
          >
            {isSubmitting ? "جارٍ تسجيل قيد التسوية..." : "تأكيد التسوية وتحديث الدفتر"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});

export default ReconciliationModal;
