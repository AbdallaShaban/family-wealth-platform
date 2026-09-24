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
import { Textarea } from "@/components/ui/textarea";
import ConfirmDialog from "@/components/ConfirmDialog";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

interface TradeActionModalsProps {
  editOpen: boolean;
  onEditOpenChange: (open: boolean) => void;
  deleteOpen: boolean;
  onDeleteOpenChange: (open: boolean) => void;
  tradeItem: any | null;
  tradeAccounts: Array<{ id: number; name: string; currency: string }>;
}

const errorText = (error: unknown) => (error instanceof Error ? error.message : "تعذر إكمال العملية الآن.");

export const TradeActionModals = React.memo(function TradeActionModals({
  editOpen,
  onEditOpenChange,
  deleteOpen,
  onDeleteOpenChange,
  tradeItem,
  tradeAccounts,
}: TradeActionModalsProps) {
  const utils = trpc.useUtils();

  const [editTradeDate, setEditTradeDate] = useState("");
  const [editTradeQuantity, setEditTradeQuantity] = useState("");
  const [editTradeUnitPrice, setEditTradeUnitPrice] = useState("");
  const [editTradeAccountId, setEditTradeAccountId] = useState("");
  const [editTradeFeeAmount, setEditTradeFeeAmount] = useState("");
  const [editTradeTaxAmount, setEditTradeTaxAmount] = useState("");
  const [editTradeMemo, setEditTradeMemo] = useState("");

  useEffect(() => {
    if (tradeItem) {
      const dateObj = new Date(tradeItem.occurredAt);
      const localIso = new Date(dateObj.getTime() - dateObj.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
      setEditTradeDate(localIso);
      setEditTradeQuantity(tradeItem.quantity ? String(tradeItem.quantity) : "");
      setEditTradeUnitPrice(tradeItem.unitPrice ? String(tradeItem.unitPrice) : "");
      setEditTradeAccountId(tradeItem.primaryAccountId ? String(tradeItem.primaryAccountId) : "");
      setEditTradeFeeAmount(tradeItem.feeAmount ? String(tradeItem.feeAmount) : "");
      setEditTradeTaxAmount(tradeItem.taxAmount ? String(tradeItem.taxAmount) : "");
      setEditTradeMemo(tradeItem.memo || "");
    }
  }, [tradeItem]);

  const updateTradeMutation = trpc.family.investments.updateTransaction.useMutation({
    onSuccess: () => {
      toast.success("تم تعديل الصفقة وعكس القيود السابقة في دفتر الأستاذ بنجاح.");
      onEditOpenChange(false);
      void utils.family.investments.transactions.invalidate();
      void utils.family.ledger.recent.invalidate();
      void utils.family.portfolio.list.invalidate();
      void utils.family.lots.list.invalidate();
      void utils.family.accounts.list.invalidate();
      void utils.family.realizedPnl.summary.invalidate();
      void utils.family.realizedPnl.list.invalidate();
      void utils.family.dashboard.invalidate();
    },
    onError: (error) => toast.error(errorText(error)),
  });

  const deleteTradeMutation = trpc.family.investments.deleteTransaction.useMutation({
    onSuccess: () => {
      toast.success("تم حذف الصفقة وعكس قيودها المحاسبية بنجاح.");
      onDeleteOpenChange(false);
      void utils.family.investments.transactions.invalidate();
      void utils.family.ledger.recent.invalidate();
      void utils.family.portfolio.list.invalidate();
      void utils.family.lots.list.invalidate();
      void utils.family.accounts.list.invalidate();
      void utils.family.realizedPnl.summary.invalidate();
      void utils.family.realizedPnl.list.invalidate();
      void utils.family.dashboard.invalidate();
    },
    onError: (error) => {
      onDeleteOpenChange(false);
      toast.error(errorText(error));
    },
  });

  const handleSaveEditTrade = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tradeItem) return;
    const occurredAtMs = editTradeDate ? new Date(editTradeDate).getTime() : tradeItem.occurredAt;
    updateTradeMutation.mutate({
      id: tradeItem.id,
      accountId: editTradeAccountId ? Number(editTradeAccountId) : undefined,
      quantity: editTradeQuantity,
      unitPrice: editTradeUnitPrice,
      feeAmount: editTradeFeeAmount || null,
      taxAmount: editTradeTaxAmount || null,
      occurredAt: occurredAtMs,
      memo: editTradeMemo || null,
    });
  };

  const handleConfirmDeleteTrade = () => {
    if (!tradeItem) return;
    deleteTradeMutation.mutate({ id: tradeItem.id });
  };

  return (
    <>
      <Dialog open={editOpen} onOpenChange={onEditOpenChange}>
        <DialogContent className="max-w-lg w-full bg-white text-slate-900 dark:bg-[#0B0F17] dark:text-slate-100 border border-slate-200 dark:border-slate-800 shadow-2xl rounded-2xl" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 dark:text-white">
              تعديل بيانات الصفقة #{tradeItem?.id}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 dark:text-slate-400">
              سيتم عكس القيد المحاسبي وحسابات FIFO السابقة تلقائياً وإعادة تسجيل الصفقة بالقيم المعدلة لضمان توازن دفتر الأستاذ بنسبة 100%.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveEditTrade} className="grid gap-3.5 mt-2">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label className="text-xs font-semibold">حساب التسوية</Label>
                <Select value={editTradeAccountId} onValueChange={setEditTradeAccountId}>
                  <SelectTrigger className="rounded-xl text-sm">
                    <SelectValue placeholder="اختر الحساب" />
                  </SelectTrigger>
                  <SelectContent className="bg-white dark:bg-[#0B0F17]">
                    {tradeAccounts.map((acc) => (
                      <SelectItem key={acc.id} value={String(acc.id)}>
                        {acc.name} ({acc.currency})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs font-semibold">التاريخ والوقت</Label>
                <Input
                  type="datetime-local"
                  value={editTradeDate}
                  onChange={(e) => setEditTradeDate(e.target.value)}
                  required
                  className="rounded-xl text-sm font-mono"
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label className="text-xs font-semibold">الكمية</Label>
                <Input
                  inputMode="decimal"
                  value={editTradeQuantity}
                  onChange={(e) => setEditTradeQuantity(e.target.value)}
                  required
                  className="rounded-xl text-sm font-mono"
                />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs font-semibold">سعر الوحدة</Label>
                <Input
                  inputMode="decimal"
                  value={editTradeUnitPrice}
                  onChange={(e) => setEditTradeUnitPrice(e.target.value)}
                  required
                  className="rounded-xl text-sm font-mono"
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label className="text-xs font-semibold">الرسوم (اختياري)</Label>
                <Input
                  inputMode="decimal"
                  value={editTradeFeeAmount}
                  onChange={(e) => setEditTradeFeeAmount(e.target.value)}
                  className="rounded-xl text-sm font-mono"
                />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs font-semibold">الضرائب (اختياري)</Label>
                <Input
                  inputMode="decimal"
                  value={editTradeTaxAmount}
                  onChange={(e) => setEditTradeTaxAmount(e.target.value)}
                  className="rounded-xl text-sm font-mono"
                />
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label className="text-xs font-semibold">ملاحظات / مذكرة</Label>
              <Textarea
                value={editTradeMemo}
                onChange={(e) => setEditTradeMemo(e.target.value)}
                maxLength={2000}
                className="rounded-xl text-sm"
              />
            </div>

            <DialogFooter className="mt-3 gap-2 flex-row-reverse">
              <Button
                type="button"
                variant="outline"
                onClick={() => onEditOpenChange(false)}
                className="rounded-xl text-xs"
              >
                إلغاء
              </Button>
              <Button
                type="submit"
                disabled={updateTradeMutation.isPending}
                className="rounded-xl text-xs bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900"
              >
                {updateTradeMutation.isPending && <Loader2 className="ml-2 size-3.5 animate-spin" />}
                حفظ التعديلات وعكس القيود
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={onDeleteOpenChange}
        title="حذف الصفقة الاستثمارية وعكس القيد"
        description={`هل أنت متأكد من حذف هذه الصفقة #${tradeItem?.id}؟ سيتم إلغاء العملية وعكس قيود اليومية المحاسبية واستعادة رصيد النقدية وسجلات FIFO آلياً.`}
        confirmText={deleteTradeMutation.isPending ? "جارٍ الحذف والعكس..." : "تأكيد الحذف والعكس"}
        cancelText="إلغاء"
        variant="destructive"
        isLoading={deleteTradeMutation.isPending}
        onConfirm={handleConfirmDeleteTrade}
      />
    </>
  );
});
