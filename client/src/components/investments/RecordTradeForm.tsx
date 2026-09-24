import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import ConfirmDialog from "@/components/ConfirmDialog";
import { Landmark, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

interface RecordTradeFormProps {
  canAdvise: boolean;
  tradeAccounts: Array<{ id: number; name: string; currency: string }>;
  instruments: Array<{ id: number; name: string; currency: string; symbol?: string | null }>;
  preselectedInstrumentId?: string;
  preselectedSide?: "buy" | "sell";
  onSuccess?: () => void;
}

const errorText = (error: unknown) => (error instanceof Error ? error.message : "تعذر إكمال العملية الآن.");

export const RecordTradeForm = React.memo(function RecordTradeForm({
  canAdvise,
  tradeAccounts,
  instruments,
  preselectedInstrumentId,
  preselectedSide = "buy",
  onSuccess,
}: RecordTradeFormProps) {
  const utils = trpc.useUtils();
  const [side, setSide] = useState<"buy" | "sell">(preselectedSide);
  const [transactionDate, setTransactionDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [tradeAccountId, setTradeAccountId] = useState("");
  const [tradeInstrumentId, setTradeInstrumentId] = useState(preselectedInstrumentId || "");
  const [quantity, setQuantity] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [feeAmount, setFeeAmount] = useState("");
  const [taxAmount, setTaxAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [confirmTradeOpen, setConfirmTradeOpen] = useState(false);

  useEffect(() => {
    if (preselectedInstrumentId) {
      setTradeInstrumentId(preselectedInstrumentId);
    }
  }, [preselectedInstrumentId]);

  useEffect(() => {
    if (preselectedSide) {
      setSide(preselectedSide);
    }
  }, [preselectedSide]);

  // Default first account if none selected
  useEffect(() => {
    if (!tradeAccountId && tradeAccounts.length > 0) {
      setTradeAccountId(String(tradeAccounts[0].id));
    }
  }, [tradeAccounts, tradeAccountId]);

  const selectedAccount = tradeAccounts.find((account) => String(account.id) === tradeAccountId);
  const selectedInstrument = instruments.find((item) => String(item.id) === tradeInstrumentId);

  const tradeMutation = trpc.family.ledger.trade.useMutation({
    onSuccess: () => {
      toast.success("تم نشر الصفقة وتحديث الحيازة ومتوسط التكلفة وسجلات FIFO في معاملة واحدة.");
      setTransactionDate(new Date().toISOString().split("T")[0]);
      setQuantity("");
      setUnitPrice("");
      setFeeAmount("");
      setTaxAmount("");
      setMemo("");
      setConfirmTradeOpen(false);
      void utils.family.dashboard.invalidate();
      void utils.family.accounts.list.invalidate();
      void utils.family.ledger.recent.invalidate();
      void utils.family.investments.transactions.invalidate();
      void utils.family.portfolio.list.invalidate();
      void utils.family.lots.list.invalidate();
      void utils.family.realizedPnl.summary.invalidate();
      void utils.family.realizedPnl.list.invalidate();
      onSuccess?.();
    },
    onError: (error) => {
      setConfirmTradeOpen(false);
      toast.error(errorText(error));
    },
  });

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedAccount || !selectedInstrument) return toast.error("اختر حساب تسوية وأداة استثمارية أولًا.");
    const q = Number(quantity);
    const p = Number(unitPrice);
    if (isNaN(q) || q <= 0) return toast.error("يرجى إدخال كمية صحيحة أكبر من الصفر.");
    if (isNaN(p) || p <= 0) return toast.error("يرجى إدخال سعر وحدة صحيح أكبر من الصفر.");
    setConfirmTradeOpen(true);
  };

  const executeConfirmedTrade = () => {
    if (!selectedAccount || !selectedInstrument) return;
    const dateObj = new Date(transactionDate + "T12:00:00Z");
    const occurredAtMs = isNaN(dateObj.getTime()) ? Date.now() : dateObj.getTime();
    tradeMutation.mutate({
      side,
      accountId: selectedAccount.id,
      instrumentId: selectedInstrument.id,
      quantity,
      unitPrice,
      feeAmount: feeAmount || null,
      taxAmount: taxAmount || null,
      occurredAt: occurredAtMs,
      date: transactionDate,
      memo: memo || null,
      idempotencyKey: crypto.randomUUID(),
    });
  };

  return (
    <>
      <Card className="bg-white dark:bg-[#0B0F17] border border-slate-200/90 dark:border-slate-800/80 rounded-2xl shadow-xs overflow-hidden">
        <CardHeader className="border-b border-slate-100 dark:border-slate-800/80 p-5">
          <CardTitle className="text-slate-900 dark:text-white font-bold text-base">
            مراجعة وتسجيل صفقة شراء أو بيع
          </CardTitle>
          <CardDescription className="text-slate-500 dark:text-slate-400 text-xs mt-1">
            الرسوم والضرائب تُسجل مع القيد المتوازن. لا يتم تعديل أي رصيد خارج دفتر الأستاذ. الأرباح المحققة تُحسب وفق منهجية FIFO ومقيدة بدفتر الأستاذ المزدوج.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-5">
          {tradeAccounts.length && instruments.length ? (
            <form onSubmit={handleSubmit} className="grid gap-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="grid gap-2">
                  <Label className="text-slate-700 dark:text-slate-300 font-semibold text-xs">نوع الصفقة</Label>
                  <Select value={side} onValueChange={(v) => setSide(v as "buy" | "sell")}>
                    <SelectTrigger className="w-full bg-white dark:bg-[#0E1420] border border-slate-300 dark:border-slate-700/80 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-slate-800 focus:ring-1 focus:ring-slate-800 rounded-xl font-medium text-sm py-2.5 px-3 h-auto">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-white dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-800">
                      <SelectItem value="buy">شراء</SelectItem>
                      <SelectItem value="sell">بيع</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="trade-date" className="text-slate-700 dark:text-slate-300 font-semibold text-xs">
                    تاريخ العملية
                  </Label>
                  <Input
                    id="trade-date"
                    type="date"
                    value={transactionDate}
                    onChange={(e) => setTransactionDate(e.target.value)}
                    required
                    className="w-full bg-white dark:bg-[#0E1420] border border-slate-300 dark:border-slate-700/80 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-slate-800 focus:ring-1 focus:ring-slate-800 rounded-xl font-medium text-sm py-2 px-3 h-auto font-mono text-right"
                  />
                </div>
                <div className="grid gap-2">
                  <Label className="text-slate-700 dark:text-slate-300 font-semibold text-xs">حساب التسوية</Label>
                  <Select value={tradeAccountId} onValueChange={setTradeAccountId}>
                    <SelectTrigger className="w-full bg-white dark:bg-[#0E1420] border border-slate-300 dark:border-slate-700/80 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-slate-800 focus:ring-1 focus:ring-slate-800 rounded-xl font-medium text-sm py-2.5 px-3 h-auto">
                      <SelectValue placeholder="اختر حسابًا" />
                    </SelectTrigger>
                    <SelectContent className="bg-white dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-800">
                      {tradeAccounts.map((acc) => (
                        <SelectItem key={acc.id} value={String(acc.id)}>
                          {acc.name} — {acc.currency}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label className="text-slate-700 dark:text-slate-300 font-semibold text-xs">الأداة الاستثمارية</Label>
                  <Select value={tradeInstrumentId} onValueChange={setTradeInstrumentId}>
                    <SelectTrigger className="w-full bg-white dark:bg-[#0E1420] border border-slate-300 dark:border-slate-700/80 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-slate-800 focus:ring-1 focus:ring-slate-800 rounded-xl font-medium text-sm py-2.5 px-3 h-auto">
                      <SelectValue placeholder="اختر أداة" />
                    </SelectTrigger>
                    <SelectContent className="bg-white dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-800">
                      {instruments.map((item) => (
                        <SelectItem key={item.id} value={String(item.id)}>
                          {item.name} {item.symbol ? `(${item.symbol})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="grid gap-2">
                  <Label htmlFor="trade-qty" className="text-slate-700 dark:text-slate-300 font-semibold text-xs">
                    الكمية (عدد الوحدات / الأسهم)
                  </Label>
                  <Input
                    id="trade-qty"
                    inputMode="decimal"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    placeholder="100"
                    required
                    className="bg-white dark:bg-[#0E1420] border border-slate-300 dark:border-slate-700/80 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-slate-800 focus:ring-1 focus:ring-slate-800 rounded-xl font-medium text-sm py-2.5 px-3 h-auto font-mono text-left"
                    dir="ltr"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="trade-price" className="text-slate-700 dark:text-slate-300 font-semibold text-xs">
                    سعر الوحدة
                  </Label>
                  <Input
                    id="trade-price"
                    inputMode="decimal"
                    value={unitPrice}
                    onChange={(e) => setUnitPrice(e.target.value)}
                    placeholder="0.00"
                    required
                    className="bg-white dark:bg-[#0E1420] border border-slate-300 dark:border-slate-700/80 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-slate-800 focus:ring-1 focus:ring-slate-800 rounded-xl font-medium text-sm py-2.5 px-3 h-auto font-mono text-left"
                    dir="ltr"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="trade-fee" className="text-slate-700 dark:text-slate-300 font-semibold text-xs">
                    العمولة والمصروفات (اختياري)
                  </Label>
                  <Input
                    id="trade-fee"
                    inputMode="decimal"
                    value={feeAmount}
                    onChange={(e) => setFeeAmount(e.target.value)}
                    placeholder="0.00"
                    className="bg-white dark:bg-[#0E1420] border border-slate-300 dark:border-slate-700/80 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-slate-800 focus:ring-1 focus:ring-slate-800 rounded-xl font-medium text-sm py-2.5 px-3 h-auto font-mono text-left"
                    dir="ltr"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="trade-tax" className="text-slate-700 dark:text-slate-300 font-semibold text-xs">
                    الضرائب (اختياري)
                  </Label>
                  <Input
                    id="trade-tax"
                    inputMode="decimal"
                    value={taxAmount}
                    onChange={(e) => setTaxAmount(e.target.value)}
                    placeholder="0.00"
                    className="bg-white dark:bg-[#0E1420] border border-slate-300 dark:border-slate-700/80 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-slate-800 focus:ring-1 focus:ring-slate-800 rounded-xl font-medium text-sm py-2.5 px-3 h-auto font-mono text-left"
                    dir="ltr"
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="trade-memo" className="text-slate-700 dark:text-slate-300 font-semibold text-xs">
                  مذكرة العملية
                </Label>
                <Textarea
                  id="trade-memo"
                  value={memo}
                  onChange={(e) => setMemo(e.target.value)}
                  maxLength={2000}
                  placeholder="ملاحظات أو مذكرة العملية (اختياري)..."
                  className="bg-white dark:bg-[#0E1420] border border-slate-300 dark:border-slate-700/80 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-slate-800 focus:ring-1 focus:ring-slate-800 rounded-xl font-medium text-sm py-2.5 px-3"
                />
              </div>

              <Button
                type="submit"
                disabled={tradeMutation.isPending || !canAdvise}
                className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm py-2.5 px-6 rounded-xl shadow-sm transition-all dark:bg-white dark:hover:bg-slate-100 dark:text-slate-950 border border-slate-900 dark:border-transparent disabled:opacity-50 disabled:cursor-not-allowed mt-2"
              >
                {tradeMutation.isPending && <Loader2 className="ml-2 size-4 animate-spin" />}
                {canAdvise ? "تسجيل واعتماد الصفقة" : "تتطلب صلاحية مستشار"}
              </Button>
            </form>
          ) : (
            <div className="p-8 text-center">
              <div className="flex size-12 items-center justify-center rounded-2xl border bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/20 dark:border-slate-700/60 mx-auto mb-3">
                <Landmark className="size-6" />
              </div>
              <h3 className="text-slate-900 dark:text-white font-bold text-base mb-1">جهّز الحساب والأداة أولًا</h3>
              <p className="text-slate-600 dark:text-slate-400 text-xs max-w-md mx-auto mb-2">
                يلزم حساب تسوية نشط وأداة استثمارية قبل تسجيل صفقة فعلية.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirmTradeOpen}
        onOpenChange={setConfirmTradeOpen}
        title={`تأكيد تسجيل صفقة ${side === "buy" ? "شراء" : "بيع"}`}
        description={`أنت على وشك تسجيل صفقة ${side === "buy" ? "شراء" : "بيع"} لـ ${quantity} وحدة من أداة "${selectedInstrument?.name}" عبر حساب "${selectedAccount?.name}" بتاريخ ${transactionDate}. سيتم قيد العملية في دفتر الأستاذ وتحديث متوسط التكلفة والحيازات وحزم FIFO.`}
        confirmText={`تأكيد تسجيل صفقة الـ ${side === "buy" ? "شراء" : "بيع"}`}
        cancelText="إلغاء والعودة"
        isLoading={tradeMutation.isPending}
        onConfirm={executeConfirmedTrade}
      />
    </>
  );
});
