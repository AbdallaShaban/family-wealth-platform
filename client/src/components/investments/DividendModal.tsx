import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CircleDollarSign, Loader2, Check } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

interface DividendModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedPos: {
    instrumentId: number;
    instrumentName: string;
    symbol?: string | null;
    quantity: string | number;
    currency: string;
  } | null;
  baseCurrency?: string;
  accounts: Array<{
    id: number;
    name: string;
    accountType: string;
    institution?: string | null;
    currency: string;
    status: string;
  }>;
}

const errorText = (error: unknown) => (error instanceof Error ? error.message : "تعذر إكمال العملية الآن.");

export const DividendModal = React.memo(function DividendModal({
  open,
  onOpenChange,
  selectedPos,
  baseCurrency = "EGP",
  accounts,
}: DividendModalProps) {
  const utils = trpc.useUtils();
  const [dividendAccountId, setDividendAccountId] = useState("");
  const [dividendAmount, setDividendAmount] = useState("");
  const [dividendMemo, setDividendMemo] = useState("");

  useEffect(() => {
    if (selectedPos) {
      setDividendAmount("");
      setDividendMemo(`توزيع أرباح نقدية: ${selectedPos.instrumentName || selectedPos.symbol || ""}`);
      const bankAcc = accounts.find(
        (a) => ["bank", "cash", "wallet"].includes(a.accountType) && a.status === "active"
      ) || accounts[0];
      if (bankAcc) {
        setDividendAccountId(String(bankAcc.id));
      }
    }
  }, [selectedPos, accounts]);

  const postDividendMutation = trpc.family.ledger.postDividend.useMutation({
    onSuccess: () => {
      toast.success("تم تسجيل توزيع الأرباح وترحيله إلى الحساب المصرفي ودفتر الأستاذ بنجاح.");
      onOpenChange(false);
      setDividendAmount("");
      void utils.family.accounts.list.invalidate();
      void utils.family.dashboard.invalidate();
      void utils.family.cashFlow.invalidate();
      void utils.family.portfolio.list.invalidate();
      void utils.family.ledger.recent.invalidate();
    },
    onError: (error) => toast.error(errorText(error)),
  });

  const handleRecordDividend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPos || !dividendAccountId || !dividendAmount) {
      toast.error("يرجى تحديد الحساب البنكي وإدخال قيمة التوزيعات.");
      return;
    }
    const val = Number(dividendAmount);
    if (isNaN(val) || val <= 0) {
      toast.error("يرجى إدخال مبلغ صحيح أكبر من الصفر.");
      return;
    }
    await postDividendMutation.mutateAsync({
      accountId: Number(dividendAccountId),
      instrumentId: selectedPos.instrumentId,
      amount: val.toFixed(2),
      currency: selectedPos.currency || baseCurrency,
      occurredAt: Date.now(),
      memo: dividendMemo || `توزيع أرباح نقدية: ${selectedPos.instrumentName}`,
      idempotencyKey: `dividend-${selectedPos.instrumentId}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md text-right bg-white dark:bg-[#0B0F17] border border-slate-200 dark:border-slate-800" dir="rtl">
        <form onSubmit={handleRecordDividend}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-white">
              <CircleDollarSign className="size-5 text-emerald-600 dark:text-emerald-400" />
              <span>تسجيل توزيع أرباح نقدية (Cash Dividend)</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 dark:text-slate-400">
              إيداع التوزيعات النقدية لحيازتك مباشرة في أحد الحسابات البنكية مع إنشاء القيد في دفتر الأستاذ.
            </DialogDescription>
          </DialogHeader>

          {selectedPos && (
            <div className="space-y-4 py-4">
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-900 dark:text-white">
                    {selectedPos.instrumentName}
                  </span>
                  <span className="font-mono text-slate-500 dark:text-slate-400">
                    {selectedPos.symbol || "بدون رمز"}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-200/60 dark:border-slate-800/60">
                  <span>الكمية المملوكة: <b className="font-mono text-slate-800 dark:text-slate-200">{selectedPos.quantity}</b></span>
                  <span>العملة: <b className="font-mono text-slate-800 dark:text-slate-200">{selectedPos.currency || baseCurrency}</b></span>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="dividend-account" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  الحساب المودع به (حساب بنكي / نقدي)
                </Label>
                <Select value={dividendAccountId} onValueChange={setDividendAccountId}>
                  <SelectTrigger id="dividend-account" className="w-full text-right text-xs rounded-xl">
                    <SelectValue placeholder="اختر الحساب البنكي المستقبل" />
                  </SelectTrigger>
                  <SelectContent dir="rtl" className="bg-white dark:bg-[#0B0F17]">
                    {accounts
                      .filter((a) => ["bank", "cash", "wallet"].includes(a.accountType) && a.status === "active")
                      .map((acc) => (
                        <SelectItem key={acc.id} value={String(acc.id)} className="text-xs">
                          {acc.name} ({acc.institution || acc.accountType}) · {acc.currency}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="dividend-amount" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  إجمالي مبلغ التوزيع ({selectedPos.currency || baseCurrency})
                </Label>
                <Input
                  id="dividend-amount"
                  type="number"
                  step="any"
                  min="0.01"
                  required
                  placeholder="0.00"
                  value={dividendAmount}
                  onChange={(e) => setDividendAmount(e.target.value)}
                  className="text-right font-mono text-sm rounded-xl"
                  dir="ltr"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="dividend-memo" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  البيان / ملاحظات القيد
                </Label>
                <Input
                  id="dividend-memo"
                  type="text"
                  placeholder="توزيع أرباح نقدية عن الفترة..."
                  value={dividendMemo}
                  onChange={(e) => setDividendMemo(e.target.value)}
                  className="text-right text-xs rounded-xl"
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 flex-row-reverse justify-between items-center border-t border-slate-150 dark:border-slate-800 pt-3">
            <Button
              type="submit"
              disabled={postDividendMutation.isPending || !dividendAmount || !dividendAccountId}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-5 rounded-xl shadow-sm flex items-center gap-1.5 cursor-pointer"
            >
              {postDividendMutation.isPending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Check className="size-3.5" />
              )}
              <span>تأكيد وتسجيل التوزيع</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="rounded-xl text-xs px-4"
            >
              إلغاء
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
});
