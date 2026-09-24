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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CreditCard } from "lucide-react";
import { toast } from "sonner";
import { formatMoney } from "@/lib/financialDisplay";
import { trpc } from "@/lib/trpc";

interface DebtPaymentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  debtId: number | null;
  debtsList: any[];
  accountsList: any[];
  defaultCurrency?: string;
  onSuccess?: () => void;
}

export const DebtPaymentModal = memo(function DebtPaymentModal({
  open,
  onOpenChange,
  debtId,
  debtsList,
  accountsList,
  defaultCurrency = "EGP",
  onSuccess,
}: DebtPaymentModalProps) {
  const utils = trpc.useUtils();
  const postDebtPaymentMutation = trpc.family.debts.postPayment.useMutation();

  const [selectedDebtId, setSelectedDebtId] = useState<number | null>(debtId);
  const [paymentAccountId, setPaymentAccountId] = useState<string>("");
  const [paymentPrincipal, setPaymentPrincipal] = useState<string>("");
  const [paymentInterest, setPaymentInterest] = useState<string>("");
  const [paymentMemo, setPaymentMemo] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      const activeList = debtsList.filter((d) => d.status === "active");
      const targetId = debtId || activeList[0]?.id || null;
      setSelectedDebtId(targetId);

      const targetDebt = activeList.find((d) => d.id === targetId);
      if (targetDebt) {
        setPaymentPrincipal(String(targetDebt.minimumPayment || ""));
        setPaymentMemo(`سداد دفعة: ${targetDebt.name}`);
      } else {
        setPaymentPrincipal("");
        setPaymentMemo("");
      }
      setPaymentInterest("");

      const defaultCash = accountsList.find((a) =>
        ["bank", "cash", "wallet"].includes(a.accountType)
      );
      setPaymentAccountId(defaultCash ? String(defaultCash.id) : "");
    }
  }, [open, debtId, debtsList, accountsList]);

  const handlePostDebtPayment = async () => {
    if (!selectedDebtId) {
      toast.error("يرجى اختيار الالتزام أو الدين");
      return;
    }
    const accId = parseInt(paymentAccountId, 10);
    if (!accId) {
      toast.error("يرجى اختيار الحساب البنكي أو النقدي للسداد");
      return;
    }
    const principalNum = parseFloat(paymentPrincipal);
    if (!principalNum || principalNum <= 0) {
      toast.error("يرجى إدخال مبلغ سداد أصل دين صحيح");
      return;
    }

    try {
      setIsSubmitting(true);
      await postDebtPaymentMutation.mutateAsync({
        debtId: selectedDebtId,
        cashAccountId: accId,
        principalAmount: Number(principalNum).toFixed(6),
        interestAmount: paymentInterest.trim() ? Number(paymentInterest).toFixed(6) : null,
        feeAmount: null,
        occurredAt: Date.now(),
        memo: paymentMemo.trim() || null,
        idempotencyKey: `debt_pay_${selectedDebtId}_${Date.now()}`,
      });
      await utils.family.dashboard.invalidate();
      await utils.family.debts.invalidate();
      toast.success("تم قيد وتسجيل سداد دفعة الدين بنجاح");
      onOpenChange(false);
      onSuccess?.();
    } catch (err: any) {
      toast.error(err.message || "تعذر قيد سداد الدين");
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedDebt = debtsList.find((d) => d.id === selectedDebtId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-md rounded-2xl p-6 bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 text-right"
        dir="rtl"
      >
        <DialogHeader className="text-right space-y-1">
          <DialogTitle className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <CreditCard className="size-5 text-rose-500" />
            سداد دفعة التزام أو كارت ائتمان
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-600 dark:text-slate-400 font-medium">
            سيتم قيد المعاملة محاسبياً بخصم المبلغ من الحساب النقدي وتخفيض رصيد الالتزام.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              اختر الالتزام / كارت الائتمان
            </Label>
            <Select
              value={selectedDebtId ? String(selectedDebtId) : ""}
              onValueChange={(val) => {
                const id = parseInt(val, 10);
                setSelectedDebtId(id);
                const d = debtsList.find((item) => item.id === id);
                if (d) {
                  setPaymentPrincipal(String(d.minimumPayment || ""));
                  setPaymentMemo(`سداد دفعة: ${d.name}`);
                }
              }}
            >
              <SelectTrigger className="bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-xs">
                <SelectValue placeholder="اختر الالتزام..." />
              </SelectTrigger>
              <SelectContent dir="rtl">
                {debtsList
                  .filter((d) => d.status === "active")
                  .map((d) => (
                    <SelectItem key={d.id} value={String(d.id)} className="text-xs">
                      {d.name} ({formatMoney(d.currentBalance || d.originalPrincipal || 0, d.currency || defaultCurrency)})
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              حساب الخصم والسداد (نقدي / بنكي)
            </Label>
            <Select value={paymentAccountId} onValueChange={setPaymentAccountId}>
              <SelectTrigger className="bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-xs">
                <SelectValue placeholder="اختر الحساب..." />
              </SelectTrigger>
              <SelectContent dir="rtl">
                {accountsList
                  .filter((a) => ["bank", "cash", "wallet"].includes(a.accountType))
                  .map((a) => (
                    <SelectItem key={a.id} value={String(a.id)} className="text-xs">
                      {a.name} ({formatMoney(a.value || 0, a.currency || defaultCurrency)})
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                سداد الأصل ({selectedDebt?.currency || defaultCurrency}) *
              </Label>
              <Input
                type="number"
                step="any"
                placeholder="0.00"
                value={paymentPrincipal}
                onChange={(e) => setPaymentPrincipal(e.target.value)}
                className="bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-xs font-mono font-bold"
                dir="ltr"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                فائدة محملة (إن وجدت)
              </Label>
              <Input
                type="number"
                step="any"
                placeholder="0.00"
                value={paymentInterest}
                onChange={(e) => setPaymentInterest(e.target.value)}
                className="bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-xs font-mono"
                dir="ltr"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              بيان / ملاحظات
            </Label>
            <Input
              type="text"
              placeholder="ملاحظات توضيحية لعملية السداد"
              value={paymentMemo}
              onChange={(e) => setPaymentMemo(e.target.value)}
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
            disabled={isSubmitting || !paymentPrincipal || parseFloat(paymentPrincipal) <= 0}
            onClick={handlePostDebtPayment}
            className="rounded-xl text-xs bg-rose-600 hover:bg-rose-700 text-white font-bold"
          >
            {isSubmitting ? "جارٍ تسجيل السداد..." : "تأكيد وقيد السداد"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});

export default DebtPaymentModal;
