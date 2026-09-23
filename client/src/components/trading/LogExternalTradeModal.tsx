import React, { useState, useEffect, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { formatMoney } from "@/lib/financialDisplay";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Calculator,
  Calendar,
  CheckCircle2,
  Clock,
  DollarSign,
  Landmark,
  ShieldCheck,
  Zap,
} from "lucide-react";

export interface LogExternalTradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTicker?: string;
  defaultInstrumentName?: string;
  defaultPrice?: number | string;
  defaultSide?: "buy" | "sell";
  defaultTarget1?: number | string;
  defaultStopLoss?: number | string;
  onSuccess?: () => void;
}

export function LogExternalTradeModal({
  open,
  onOpenChange,
  defaultTicker = "",
  defaultInstrumentName = "",
  defaultPrice = "",
  defaultSide = "buy",
  defaultTarget1,
  defaultStopLoss,
  onSuccess,
}: LogExternalTradeModalProps) {
  const utils = trpc.useUtils();
  const accountsQuery = trpc.family.accounts.list.useQuery(undefined, { enabled: open });
  const instrumentsQuery = trpc.family.instruments.list.useQuery(undefined, { enabled: open });

  const [side, setSide] = useState<"buy" | "sell">(defaultSide);
  const [ticker, setTicker] = useState(defaultTicker);
  const [instrumentName, setInstrumentName] = useState(defaultInstrumentName);
  const [selectedInstrumentId, setSelectedInstrumentId] = useState<string>("");
  const [quantity, setQuantity] = useState("");
  const [unitPrice, setUnitPrice] = useState(defaultPrice ? String(defaultPrice) : "");
  const [feeAmount, setFeeAmount] = useState("");
  const [brokerSource, setBrokerSource] = useState("تطبيق ثاندر (Thndr)");
  const [settlementAccountId, setSettlementAccountId] = useState("");
  const [memo, setMemo] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sync defaults when modal opens or defaults change
  useEffect(() => {
    if (open) {
      setSide(defaultSide);
      setTicker(defaultTicker);
      setInstrumentName(defaultInstrumentName);
      setUnitPrice(defaultPrice ? String(defaultPrice) : "");
      setQuantity("");
      setFeeAmount("");
      setMemo(`تنفيذ خارجي عبر ${brokerSource}`);
    }
  }, [open, defaultSide, defaultTicker, defaultInstrumentName, defaultPrice]);

  // Match instrument from list
  const availableInstruments = instrumentsQuery.data ?? [];
  useEffect(() => {
    if (!open || !availableInstruments.length) return;
    const match = availableInstruments.find((item) => {
      const sym = item.symbol?.trim().toUpperCase();
      const def = defaultTicker?.trim().toUpperCase();
      if (sym && def && (sym === def || sym === def.replace(".CA", "") || `${sym}.CA` === def)) {
        return true;
      }
      if (defaultInstrumentName && item.name.includes(defaultInstrumentName)) {
        return true;
      }
      return false;
    });

    if (match) {
      setSelectedInstrumentId(String(match.id));
      if (!ticker) setTicker(match.symbol || "");
      if (!instrumentName) setInstrumentName(match.name);
    } else if (availableInstruments.length > 0 && !selectedInstrumentId) {
      setSelectedInstrumentId(String(availableInstruments[0].id));
    }
  }, [open, availableInstruments, defaultTicker, defaultInstrumentName]);

  // Liquid accounts for settlement
  const liquidAccounts = useMemo(() => {
    return (accountsQuery.data ?? []).filter(
      (a) => ["bank", "cash", "wallet", "brokerage"].includes(a.accountType) && a.status === "active"
    );
  }, [accountsQuery.data]);

  // Auto-select first liquid account with balance
  useEffect(() => {
    if (open && liquidAccounts.length > 0 && !settlementAccountId) {
      const bestAcc = liquidAccounts.find((a) => Number(a.baseValue ?? a.balance ?? 0) > 0) || liquidAccounts[0];
      setSettlementAccountId(String(bestAcc.id));
    }
  }, [open, liquidAccounts, settlementAccountId]);

  // Mutations
  const createInstrumentMutation = trpc.family.instruments.create.useMutation();
  const tradeMutation = trpc.family.ledger.trade.useMutation();

  // Calculations
  const qtyNum = parseFloat(quantity) || 0;
  const priceNum = parseFloat(unitPrice) || 0;
  const feeNum = parseFloat(feeAmount) || 0;
  const grossAmount = qtyNum * priceNum;
  const netTotal = side === "buy" ? grossAmount + feeNum : Math.max(0, grossAmount - feeNum);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!qtyNum || qtyNum <= 0) {
      toast.error("يرجى إدخال كمية منفذة صالحة أكبر من صفر.");
      return;
    }
    if (!priceNum || priceNum <= 0) {
      toast.error("يرجى إدخال سعر تنفيذ صحيح للوحدة.");
      return;
    }
    if (!settlementAccountId) {
      toast.error("يرجى اختيار حساب التسوية المصرفي أو المحفظة.");
      return;
    }

    try {
      setIsSubmitting(true);
      let instrumentId = parseInt(selectedInstrumentId, 10);

      // If no valid instrumentId, create new instrument record on the fly
      if (!instrumentId || isNaN(instrumentId)) {
        const createdInst = await createInstrumentMutation.mutateAsync({
          name: instrumentName || ticker || "أداة مالية جديدة",
          symbol: ticker ? ticker.toUpperCase() : null,
          assetType: ticker.includes("GOLD") ? "gold" : ticker === "AZG" ? "fund" : "equity",
          currency: "EGP",
          subCategory: "تداول خارجي",
          sector: "سوق المال المصري",
        });
        instrumentId = createdInst.id;
        await utils.family.instruments.list.invalidate();
      }

      // Record trade in audited double-entry ledger
      const memoText = memo.trim()
        ? memo.trim()
        : `صفقة ${side === "buy" ? "شراء" : "بيع"} خارجية عبر ${brokerSource} — ${ticker || instrumentName}`;

      await tradeMutation.mutateAsync({
        side,
        accountId: parseInt(settlementAccountId, 10),
        instrumentId,
        quantity: String(qtyNum),
        unitPrice: String(priceNum),
        feeAmount: feeNum > 0 ? String(feeNum) : null,
        occurredAt: Date.now(),
        memo: memoText,
        idempotencyKey: `ext_trade_${instrumentId}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      });

      // Invalidate relevant caches
      await Promise.all([
        utils.family.dashboard.invalidate(),
        utils.family.accounts.list.invalidate(),
        utils.family.portfolio.list.invalidate(),
        utils.family.ledger.recent.invalidate(),
        utils.family.investments.transactions.invalidate(),
        utils.family.lots.list.invalidate(),
        utils.quant.getPaperTradingState.invalidate(),
      ]);

      toast.success(
        `تم تسجيل صفقة ${side === "buy" ? "الشراء" : "البيع"} بنجاح (${qtyNum} وحدة بسعر ${priceNum} ج.م) وقيدها في حسابات التسوية.`
      );
      onOpenChange(false);
      onSuccess?.();
    } catch (err: any) {
      toast.error(err.message || "تعذر تسجيل الصفقة الخارجية.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg bg-[#0B1222] border-slate-800 text-slate-100 p-6" dir="rtl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              <Zap className="size-4" />
            </span>
            <DialogTitle className="text-lg font-bold text-white">
              تسجيل صفقة خارجية (Log External Trade)
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-slate-400 mt-1">
            تسجيل الصفقات المنفذة عبر تطبيقات التداول والبنوك الخارجية (Thndr، البنك الأهلي، CIB، هيرميس) لإدراجها في محاسبة FIFO وحساب التسوية T+2.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* Signal Reference Badge if available */}
          {(defaultTarget1 || defaultStopLoss) && (
            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="border-amber-500/40 text-amber-400 bg-amber-500/10 font-bold">
                  مستويات الإشارة المقترحة
                </Badge>
                <span className="text-slate-300 font-semibold">{ticker || defaultTicker}</span>
              </div>
              <div className="flex items-center gap-3 text-[11px] font-mono">
                {defaultTarget1 && (
                  <span className="text-emerald-400 font-bold">
                    الهدف: {Number(defaultTarget1).toFixed(2)} ج.م
                  </span>
                )}
                {defaultStopLoss && (
                  <span className="text-rose-400 font-bold">
                    وقف الخسارة: {Number(defaultStopLoss).toFixed(2)} ج.م
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Trade Direction Toggle (BUY / SELL) */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setSide("buy")}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-xs transition-all border cursor-pointer ${
                side === "buy"
                  ? "bg-emerald-600 text-white border-emerald-500 shadow-md shadow-emerald-950/50"
                  : "bg-slate-900 text-slate-400 border-slate-800 hover:text-white"
              }`}
            >
              <ArrowDownLeft className="size-4" />
              <span>شراء (BUY)</span>
            </button>
            <button
              type="button"
              onClick={() => setSide("sell")}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-xs transition-all border cursor-pointer ${
                side === "sell"
                  ? "bg-rose-600 text-white border-rose-500 shadow-md shadow-rose-950/50"
                  : "bg-slate-900 text-slate-400 border-slate-800 hover:text-white"
              }`}
            >
              <ArrowUpRight className="size-4" />
              <span>بيع (SELL)</span>
            </button>
          </div>

          {/* Asset Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-semibold text-slate-300 block mb-1">
                الأداة المالية / السهم
              </Label>
              <Select
                value={selectedInstrumentId}
                onValueChange={(val) => {
                  setSelectedInstrumentId(val);
                  const inst = availableInstruments.find((i) => String(i.id) === val);
                  if (inst) {
                    setTicker(inst.symbol || "");
                    setInstrumentName(inst.name);
                  }
                }}
              >
                <SelectTrigger className="bg-slate-900 border-slate-700 text-white text-xs">
                  <SelectValue placeholder="اختر من الأدوات المسجلة..." />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800 text-white max-h-60">
                  {availableInstruments.map((inst) => (
                    <SelectItem key={inst.id} value={String(inst.id)}>
                      {inst.name} ({inst.symbol || inst.assetType})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs font-semibold text-slate-300 block mb-1">
                رمز السهم (الرمز الخارجي)
              </Label>
              <Input
                value={ticker}
                onChange={(e) => setTicker(e.target.value.toUpperCase())}
                placeholder="مثال: COMI.CA أو SWDY"
                className="bg-slate-900 border-slate-700 text-white font-mono font-bold text-xs"
              />
            </div>
          </div>

          {/* Quantity & Executed Price */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-semibold text-slate-300 block mb-1">
                الكمية المنفذة (عدد الأسهم/الوثائق)
              </Label>
              <Input
                type="number"
                step="any"
                min="0.0001"
                required
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="0"
                className="bg-slate-900 border-slate-700 text-white font-mono font-bold text-sm"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold text-slate-300 block mb-1">
                سعر التنفيذ الفعلي (ج.م)
              </Label>
              <Input
                type="number"
                step="any"
                min="0.0001"
                required
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
                placeholder="0.00"
                className="bg-slate-900 border-slate-700 text-white font-mono font-bold text-sm"
              />
            </div>
          </div>

          {/* Broker App & Commission */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-semibold text-slate-300 block mb-1">
                الوسيط / تطبيق التداول
              </Label>
              <Select value={brokerSource} onValueChange={setBrokerSource}>
                <SelectTrigger className="bg-slate-900 border-slate-700 text-white text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800 text-white">
                  <SelectItem value="تطبيق ثاندر (Thndr)">تطبيق ثاندر (Thndr)</SelectItem>
                  <SelectItem value="البنك الأهلي المصري (NBE Brokerage)">البنك الأهلي (NBE Brokerage)</SelectItem>
                  <SelectItem value="البنك التجاري الدولي (CIB Brokerage)">البنك التجاري الدولي (CIB)</SelectItem>
                  <SelectItem value="إي إف جي هيرميس (EFG Hermes)">إي إف جي هيرميس (EFG Hermes)</SelectItem>
                  <SelectItem value="مباشر للوساطة (Mubasher Financial)">مباشر للوساطة (Mubasher)</SelectItem>
                  <SelectItem value="أخرى / وسيط خارجي">أخرى / وسيط خارجي</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs font-semibold text-slate-300 block mb-1">
                عمولة الوسيط والرسوم (اختياري)
              </Label>
              <Input
                type="number"
                step="any"
                min="0"
                value={feeAmount}
                onChange={(e) => setFeeAmount(e.target.value)}
                placeholder="0.00"
                className="bg-slate-900 border-slate-700 text-white font-mono text-xs"
              />
            </div>
          </div>

          {/* Settlement Account */}
          <div>
            <Label className="text-xs font-semibold text-slate-300 block mb-1">
              حساب التسوية والخصم / الإيداع
            </Label>
            <Select value={settlementAccountId} onValueChange={setSettlementAccountId}>
              <SelectTrigger className="bg-slate-900 border-slate-700 text-white text-xs">
                <SelectValue placeholder="اختر الحساب المصرفي أو المحفظة..." />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-800 text-white">
                {liquidAccounts.map((acc) => (
                  <SelectItem key={acc.id} value={String(acc.id)}>
                    {acc.name} — متاح: {formatMoney(acc.baseValue ?? acc.balance ?? 0, acc.currency, 0)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Live Summary Outlay Box */}
          <div className="bg-[#0F172A] border border-slate-800 rounded-xl p-3.5 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">إجمالي قيمة الصفقة:</span>
              <strong className="font-mono text-white text-sm">{formatMoney(grossAmount, "EGP", 2)}</strong>
            </div>
            {feeNum > 0 && (
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>العمولة والرسوم:</span>
                <span className="font-mono">{formatMoney(feeNum, "EGP", 2)}</span>
              </div>
            )}
            <div className="flex items-center justify-between text-xs pt-1.5 border-t border-slate-800 font-bold">
              <span className="text-slate-200">
                {side === "buy" ? "صافي المبلغ المخصوم من الحساب:" : "صافي الحصيلة المودعة بالدفتر:"}
              </span>
              <strong className={`font-mono text-base ${side === "buy" ? "text-amber-400" : "text-emerald-400"}`}>
                {formatMoney(netTotal, "EGP", 2)}
              </strong>
            </div>

            <div className="flex items-center gap-1.5 text-[10.5px] text-slate-400 pt-1">
              <Clock className="size-3 text-amber-400 shrink-0" />
              <span>
                مبيعات الأسهم تخضع لتسوية T+2 (المقاصة بيومي عمل) وتظهر كسيولة معلقة في لوحة التحكم.
              </span>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="border-slate-700 text-slate-300 hover:bg-slate-800"
            >
              إلغاء
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !qtyNum || !priceNum || !settlementAccountId}
              className={`font-bold text-white ${
                side === "buy" ? "bg-emerald-600 hover:bg-emerald-500" : "bg-rose-600 hover:bg-rose-500"
              }`}
            >
              {isSubmitting ? "جارٍ تسجيل الصفقة..." : `تأكيد تسجيل صفقة ال${side === "buy" ? "شراء" : "بيع"}`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
