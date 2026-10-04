import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
import {
  ArrowDownLeft,
  ArrowUpRight,
  ArrowRightLeft,
  WifiOff,
  Sparkles,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { useOfflineSync } from "@/contexts/OfflineSyncContext";
import { toast } from "sonner";

export function QuickOfflineTransactionModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { isOnline, cachedAccounts, recordQuickTransaction } = useOfflineSync();

  const [activeTab, setActiveTab] = useState<"expense" | "deposit" | "transfer">("expense");
  const [accountId, setAccountId] = useState<string>("");
  const [toAccountId, setToAccountId] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [currency, setCurrency] = useState<string>("EGP");
  const [memo, setMemo] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Auto-select first account if not selected
  React.useEffect(() => {
    if (!accountId && cachedAccounts.length > 0) {
      setAccountId(String(cachedAccounts[0].id));
      if (cachedAccounts[0].currency) {
        setCurrency(cachedAccounts[0].currency);
      }
    }
  }, [cachedAccounts, accountId]);

  const handleAccountChange = (val: string) => {
    setAccountId(val);
    const selected = cachedAccounts.find((a) => String(a.id) === val);
    if (selected?.currency) {
      setCurrency(selected.currency);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      toast.error("يرجى إدخال مبلغ مالي صحيح أكبر من الصفر.");
      return;
    }

    if (!accountId) {
      toast.error("يرجى اختيار الحساب المصرفي.");
      return;
    }

    if (activeTab === "transfer") {
      if (!toAccountId) {
        toast.error("يرجى اختيار الحساب المحول إليه.");
        return;
      }
      if (accountId === toAccountId) {
        toast.error("لا يمكن التحويل لنفس الحساب.");
        return;
      }
    }

    setIsSubmitting(true);
    try {
      await recordQuickTransaction({
        type: activeTab,
        accountId: parseInt(accountId, 10),
        toAccountId: activeTab === "transfer" ? parseInt(toAccountId, 10) : undefined,
        amount: parsedAmount.toFixed(2),
        currency: currency.toUpperCase(),
        occurredAt: Date.now(),
        memo: memo.trim() || undefined,
      });

      // Reset form and close
      setAmount("");
      setMemo("");
      onOpenChange(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "فشل تسجيل العملية";
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-w-md bg-zinc-950 border-zinc-800 text-zinc-100">
        <DialogHeader className="border-b border-zinc-800/80 pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                <Sparkles className="size-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-zinc-100">
                  تسجيل مالي سريع (Offline Ready)
                </DialogTitle>
                <DialogDescription className="text-xs text-zinc-400">
                  إدخال فوري للعمليات مع الحفظ المحلي التلقائي دون اتصال
                </DialogDescription>
              </div>
            </div>
            {!isOnline && (
              <span className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 font-bold">
                <WifiOff className="size-3" />
                دون اتصال
              </span>
            )}
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Operation Type Tabs */}
          <Tabs
            value={activeTab}
            onValueChange={(val) => setActiveTab(val as "expense" | "deposit" | "transfer")}
            className="w-full"
          >
            <TabsList className="grid grid-cols-3 bg-zinc-900 border border-zinc-800">
              <TabsTrigger
                value="expense"
                className="text-xs gap-1 data-[state=active]:bg-rose-500/20 data-[state=active]:text-rose-300"
              >
                <ArrowDownLeft className="size-3.5" />
                مصروف
              </TabsTrigger>
              <TabsTrigger
                value="deposit"
                className="text-xs gap-1 data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-300"
              >
                <ArrowUpRight className="size-3.5" />
                إيداع / دخل
              </TabsTrigger>
              <TabsTrigger
                value="transfer"
                className="text-xs gap-1 data-[state=active]:bg-blue-500/20 data-[state=active]:text-blue-300"
              >
                <ArrowRightLeft className="size-3.5" />
                تحويل
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Amount and Currency */}
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2 space-y-1.5">
              <Label className="text-xs text-zinc-300">المبلغ *</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                autoFocus
                required
                className="bg-zinc-900 border-zinc-800 text-left font-mono font-bold text-base focus:border-emerald-500"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-zinc-300">العملة</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger className="bg-zinc-900 border-zinc-800 font-mono text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-800 text-zinc-200">
                  <SelectItem value="EGP">EGP (جنيه)</SelectItem>
                  <SelectItem value="USD">USD (دولار)</SelectItem>
                  <SelectItem value="EUR">EUR (يورو)</SelectItem>
                  <SelectItem value="SAR">SAR (ريال)</SelectItem>
                  <SelectItem value="AED">AED (درهم)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Primary Account */}
          <div className="space-y-1.5">
            <Label className="text-xs text-zinc-300">
              {activeTab === "transfer" ? "من حساب (المصدر) *" : "الحساب المصرفي / الخزينة *"}
            </Label>
            <Select value={accountId} onValueChange={handleAccountChange}>
              <SelectTrigger className="bg-zinc-900 border-zinc-800 text-xs">
                <SelectValue placeholder="اختر الحساب..." />
              </SelectTrigger>
              <SelectContent className="bg-zinc-900 border-zinc-800 text-zinc-200">
                {cachedAccounts.map((acc) => (
                  <SelectItem key={acc.id} value={String(acc.id)}>
                    {acc.name} ({acc.currency})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Transfer Destination Account */}
          {activeTab === "transfer" && (
            <div className="space-y-1.5">
              <Label className="text-xs text-zinc-300">إلى حساب (الوجهة) *</Label>
              <Select value={toAccountId} onValueChange={setToAccountId}>
                <SelectTrigger className="bg-zinc-900 border-zinc-800 text-xs">
                  <SelectValue placeholder="اختر الحساب المحول إليه..." />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-800 text-zinc-200">
                  {cachedAccounts
                    .filter((acc) => String(acc.id) !== accountId)
                    .map((acc) => (
                      <SelectItem key={acc.id} value={String(acc.id)}>
                        {acc.name} ({acc.currency})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Memo / Description */}
          <div className="space-y-1.5">
            <Label className="text-xs text-zinc-300">البيان / ملاحظة (اختياري)</Label>
            <Input
              type="text"
              placeholder={
                activeTab === "expense"
                  ? "مثال: مصروفات صيانة دورية، مشتريات..."
                  : activeTab === "transfer"
                  ? "مثال: تحويل تغذية محفظة إنستاباي..."
                  : "مثال: إيداع نقدي، أرباح استثمار..."
              }
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              className="bg-zinc-900 border-zinc-800 text-xs focus:border-emerald-500"
            />
          </div>

          {/* Notice about Offline Queue */}
          {!isOnline && (
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-300 text-[11px] leading-relaxed flex items-center gap-2">
              <WifiOff className="size-4 shrink-0 text-amber-400" />
              <span>
                سيتم حفظ هذا القيد محلياً في ذاكرة جهازك فوراً، ومزامنته تلقائياً مع السيرفر عند عودة الاتصال.
              </span>
            </div>
          )}

          <DialogFooter className="border-t border-zinc-800/80 pt-3 gap-2 sm:justify-start">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="border-zinc-700 text-zinc-300 text-xs"
            >
              إلغاء
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs gap-1.5"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  جاري الحفظ...
                </>
              ) : (
                <>
                  <CheckCircle2 className="size-3.5" />
                  {isOnline ? "تسجيل القيد ونشره" : "حفظ محلياً دون اتصال"}
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
