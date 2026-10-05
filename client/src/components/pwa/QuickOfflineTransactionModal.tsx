import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  ShoppingBag,
  Fuel,
  Coffee,
  Zap,
  Pill,
  Tag,
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

  const expenseCategories = [
    { label: "سوبرماركت", icon: ShoppingBag, memo: "سوبرماركت وبقالة" },
    { label: "بنزين ومواصلات", icon: Fuel, memo: "بنزين ومواصلات" },
    { label: "مطعم وكافيه", icon: Coffee, memo: "مطعم وكافيه" },
    { label: "فواتير وكهرباء", icon: Zap, memo: "فواتير وخدمات" },
    { label: "صيدلية وعلاج", icon: Pill, memo: "صيدلية ومستلزمات علاجية" },
    { label: "نثريات ومصروف", icon: Tag, memo: "مصروف جيب ونثريات" },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        dir="rtl"
        className="w-full max-w-lg bg-card border border-border text-foreground rounded-2xl shadow-xl p-5 sm:p-6 max-sm:!fixed max-sm:!bottom-0 max-sm:!top-auto max-sm:!left-0 max-sm:!right-0 max-sm:!translate-x-0 max-sm:!translate-y-0 max-sm:!max-w-full max-sm:!rounded-b-none max-sm:!rounded-t-3xl max-sm:!border-x-0 max-sm:!border-b-0 max-sm:max-h-[92vh] max-sm:overflow-y-auto"
      >
        {/* Mobile Pull Handle */}
        <div className="w-12 h-1.5 bg-muted-foreground/30 rounded-full mx-auto -mt-1 mb-3 sm:hidden" />

        <DialogHeader className="border-b border-border pb-3 text-right">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="size-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <Sparkles className="size-4.5" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-foreground leading-tight">
                  تسجيل مالي سريع (Offline Ready)
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  إدخال فوري للعمليات مع الحفظ المحلي التلقائي دون اتصال
                </DialogDescription>
              </div>
            </div>
            {!isOnline && (
              <span className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400 font-bold shrink-0">
                <WifiOff className="size-3" />
                دون اتصال
              </span>
            )}
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          {/* Operation Type Tabs */}
          <Tabs
            value={activeTab}
            onValueChange={(val) => setActiveTab(val as "expense" | "deposit" | "transfer")}
            className="w-full"
          >
            <TabsList className="grid grid-cols-3 bg-muted/60 border border-border p-1 h-12 rounded-xl">
              <TabsTrigger
                value="expense"
                className="text-xs font-bold gap-1.5 h-10 rounded-lg transition-all data-[state=active]:bg-rose-500/20 data-[state=active]:text-rose-600 dark:data-[state=active]:text-rose-300 data-[state=active]:border data-[state=active]:border-rose-500/40"
              >
                <ArrowDownLeft className="size-3.5" />
                <span>مصروف</span>
              </TabsTrigger>
              <TabsTrigger
                value="deposit"
                className="text-xs font-bold gap-1.5 h-10 rounded-lg transition-all data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-600 dark:data-[state=active]:text-emerald-300 data-[state=active]:border data-[state=active]:border-emerald-500/40"
              >
                <ArrowUpRight className="size-3.5" />
                <span>إيداع / دخل</span>
              </TabsTrigger>
              <TabsTrigger
                value="transfer"
                className="text-xs font-bold gap-1.5 h-10 rounded-lg transition-all data-[state=active]:bg-blue-500/20 data-[state=active]:text-blue-600 dark:data-[state=active]:text-blue-300 data-[state=active]:border data-[state=active]:border-blue-500/40"
              >
                <ArrowRightLeft className="size-3.5" />
                <span>تحويل</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Amount and Currency Display */}
          <div className="grid grid-cols-3 gap-2.5">
            <div className="col-span-2 space-y-1.5">
              <Label className="text-xs font-bold text-foreground">المبلغ *</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                autoFocus
                required
                className="bg-background border-input text-left font-mono font-black text-2xl tabular-nums min-h-[50px] h-13 text-emerald-600 dark:text-emerald-400 focus:border-emerald-500 rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-foreground">العملة</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger className="bg-background border-input font-mono font-bold text-xs min-h-[50px] h-13 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border text-popover-foreground">
                  <SelectItem value="EGP">EGP (جنيه)</SelectItem>
                  <SelectItem value="USD">USD (دولار)</SelectItem>
                  <SelectItem value="EUR">EUR (يورو)</SelectItem>
                  <SelectItem value="SAR">SAR (ريال)</SelectItem>
                  <SelectItem value="AED">AED (درهم)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Quick Amount Pills */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="font-semibold">مبالغ سريعة بنقرة واحدة:</span>
              {amount && (
                <button
                  type="button"
                  onClick={() => setAmount("")}
                  className="text-[11px] text-rose-500 dark:text-rose-400 hover:underline cursor-pointer"
                >
                  مسح المبلغ
                </button>
              )}
            </div>
            <div className="grid grid-cols-5 gap-1.5">
              {[50, 100, 200, 500, 1000].map((quickVal) => (
                <button
                  key={quickVal}
                  type="button"
                  onClick={() => {
                    const current = parseFloat(amount);
                    if (isNaN(current) || current <= 0) {
                      setAmount(String(quickVal));
                    } else {
                      setAmount(String(current + quickVal));
                    }
                  }}
                  className="min-h-[40px] py-2 rounded-xl text-xs font-mono font-bold tabular-nums bg-muted/60 hover:bg-muted text-foreground border border-border transition-all cursor-pointer hover:border-emerald-500/50 hover:text-emerald-600 dark:hover:text-emerald-300 active:scale-95 text-center"
                >
                  +{quickVal}
                </button>
              ))}
            </div>
          </div>

          {/* 1-Click Preset Category Chips (For Expense tab) */}
          {activeTab === "expense" && (
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-foreground">تصنيف المصروف بنقرة سريعة:</Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {expenseCategories.map((cat) => {
                  const Icon = cat.icon;
                  const isSelected = memo === cat.memo;
                  return (
                    <button
                      key={cat.label}
                      type="button"
                      onClick={() => setMemo(cat.memo)}
                      className={`flex items-center gap-2 px-3 py-2.5 min-h-[44px] rounded-xl text-xs font-bold border transition-all text-right cursor-pointer active:scale-95 ${
                        isSelected
                          ? "bg-emerald-500/20 border-emerald-500/60 text-emerald-700 dark:text-emerald-300"
                          : "bg-muted/40 border-border hover:bg-muted text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <Icon className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                      <span className="truncate">{cat.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Primary Account */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-foreground">
              {activeTab === "transfer" ? "من حساب (المصدر) *" : "الحساب المصرفي / الخزينة *"}
            </Label>
            <Select value={accountId} onValueChange={handleAccountChange}>
              <SelectTrigger className="bg-background border-input text-xs font-bold min-h-[48px] h-12 rounded-xl">
                <SelectValue placeholder="اختر الحساب..." />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border text-popover-foreground">
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
              <Label className="text-xs font-bold text-foreground">إلى حساب (الوجهة) *</Label>
              <Select value={toAccountId} onValueChange={setToAccountId}>
                <SelectTrigger className="bg-background border-input text-xs font-bold min-h-[48px] h-12 rounded-xl">
                  <SelectValue placeholder="اختر الحساب المحول إليه..." />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border text-popover-foreground">
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
            <Label className="text-xs font-bold text-foreground">البيان / ملاحظة (اختياري)</Label>
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
              className="bg-background border-input text-xs min-h-[48px] h-12 focus:border-emerald-500 rounded-xl"
            />
          </div>

          {/* Notice about Offline Queue */}
          {!isOnline && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-700 dark:text-amber-300 text-[11px] leading-relaxed flex items-center gap-2">
              <WifiOff className="size-4 shrink-0 text-amber-500" />
              <span>
                سيتم حفظ هذا القيد محلياً في ذاكرة جهازك فوراً، ومزامنته تلقائياً مع السيرفر عند عودة الاتصال.
              </span>
            </div>
          )}

          <DialogFooter className="border-t border-border pt-3 gap-2.5 flex-col-reverse sm:flex-row sm:justify-start">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="w-full sm:w-auto border-border bg-background hover:bg-muted text-foreground text-xs min-h-[48px] h-12 px-5 rounded-xl cursor-pointer font-bold"
            >
              إلغاء
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting}
              className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs gap-2 min-h-[48px] h-12 px-6 rounded-xl cursor-pointer shadow-md active:translate-y-px"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  <span>جاري الحفظ...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="size-4" />
                  <span>{isOnline ? "تسجيل القيد ونشره" : "حفظ محلياً دون اتصال"}</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
