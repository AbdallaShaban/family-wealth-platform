import React, { useEffect, useState, useMemo } from "react";
import { useLocation } from "wouter";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { formatMoney } from "@/lib/financialDisplay";
import {
  Command,
  Search,
  ArrowUpRight,
  ArrowDownLeft,
  ArrowLeftRight,
  TrendingUp,
  Landmark,
  Wallet,
  Receipt,
  FileSpreadsheet,
  CheckCircle2,
  Sparkles,
  Loader2,
  AlertCircle,
  CreditCard,
  ShieldCheck,
} from "lucide-react";

type IntentType = "trade" | "deposit" | "expense" | "transfer" | "navigate";

interface ParsedIntent {
  type: IntentType;
  rawText: string;
  side?: "buy" | "sell";
  quantity?: number;
  symbol?: string;
  unitPrice?: number;
  grossAmount?: number;
  amount?: number;
  accountHint?: string;
  toAccountHint?: string;
  memo?: string;
  path?: string;
  label?: string;
}

export function OmniCommandBar({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const [query, setQuery] = useState("");
  const [isExecuting, setIsExecuting] = useState(false);
  const [confirmStep, setConfirmStep] = useState(false);

  // Load available accounts and instruments to match natural language hints
  const accountsQuery = trpc.family.accounts.list.useQuery(undefined, { enabled: open });
  const instrumentsQuery = trpc.family.instruments.list.useQuery(undefined, { enabled: open });
  const postCashMutation = trpc.family.ledger.postCash.useMutation();
  const postTradeMutation = trpc.family.ledger.recordTrade.useMutation();

  const accounts = accountsQuery.data || [];
  const instruments = instrumentsQuery.data || [];

  // Reset state when closed
  useEffect(() => {
    if (!open) {
      setQuery("");
      setConfirmStep(false);
      setIsExecuting(false);
    }
  }, [open]);

  // Natural Language Intent Parser
  const parsedIntent = useMemo<ParsedIntent | null>(() => {
    const raw = query.trim();
    if (!raw) return null;

    // 1. Trade Match: e.g. "شراء 100 COMI @ 88.5 حساب CIB" or "بيع 500 ISPH" or "buy 50 SWDY"
    const tradeRegex = /^(شراء|بيع|buy|sell)\s+(\d+(?:\.\d+)?)\s+([A-Za-z0-9_.\u0600-\u06FF]+)(?:\s*@\s*(\d+(?:\.\d+)?))?(?:\s+(?:حساب\s+)?([^\n@]+))?/i;
    const tradeMatch = raw.match(tradeRegex);
    if (tradeMatch) {
      const isBuy = tradeMatch[1] === "شراء" || tradeMatch[1].toLowerCase() === "buy";
      const quantity = parseFloat(tradeMatch[2]);
      const symbol = tradeMatch[3].trim().toUpperCase();
      const unitPrice = tradeMatch[4] ? parseFloat(tradeMatch[4]) : undefined;
      const accountHint = tradeMatch[5]?.trim();
      const grossAmount = unitPrice ? quantity * unitPrice : undefined;

      return {
        type: "trade",
        rawText: raw,
        side: isBuy ? "buy" : "sell",
        quantity,
        symbol,
        unitPrice,
        grossAmount,
        accountHint,
      };
    }

    // 2. Deposit / Income Match: e.g. "ايداع 5000 تيلدا" or "دخل 15000 راتب"
    const depositRegex = /^(ايداع|إيداع|دخل|deposit|income)\s+(\d+(?:\.\d+)?)(?:\s+(?:في\s+|حساب\s+)?([^\n]+))?/i;
    const depositMatch = raw.match(depositRegex);
    if (depositMatch) {
      const amount = parseFloat(depositMatch[2]);
      const accountHint = depositMatch[3]?.trim();
      return {
        type: "deposit",
        rawText: raw,
        amount,
        accountHint,
        memo: `إيداع سريع: ${accountHint || "نقدي"}`,
      };
    }

    // 3. Expense / Spend Match: e.g. "صرف 450 بنزين" or "مصروف 1200 بقالة" or "سحب 2000 مصاريف"
    const expenseRegex = /^(صرف|مصروف|سحب|شراء\s+مشتريات|expense|spend|withdraw)\s+(\d+(?:\.\d+)?)(?:\s+(?:من\s+|حساب\s+)?([^\n]+))?/i;
    const expenseMatch = raw.match(expenseRegex);
    if (expenseMatch) {
      const amount = parseFloat(expenseMatch[2]);
      const memo = expenseMatch[3]?.trim() || "مصروف سريع";
      return {
        type: "expense",
        rawText: raw,
        amount,
        memo,
      };
    }

    // 4. Quick Navigations
    const navItems = [
      { keywords: ["محفظة", "استثمار", "اسهم", "سهم", "invest"], path: "/investments", label: "الانتقال إلى المحفظة الاستثمارية" },
      { keywords: ["معاملات", "عمليات", "تحويلات", "حركات", "trans"], path: "/transactions", label: "الانتقال إلى سجل المعاملات" },
      { keywords: ["حسابات", "بنوك", "بنك", "سيولة", "acc"], path: "/accounts", label: "الانتقال إلى الحسابات المصرفية والسيولة" },
      { keywords: ["ديون", "كروت", "فيزا", "تقسيط", "debts"], path: "/debts", label: "الانتقال إلى كروت الائتمان والديون" },
      { keywords: ["شهادات", "ودائع", "banking", "certs"], path: "/banking", label: "الانتقال إلى الشهادات البنكية والودائع" },
      { keywords: ["تقارير", "تدقيق", "ميزانية", "reports"], path: "/reports", label: "الانتقال إلى التقارير المالية والتدقيق" },
    ];

    for (const nav of navItems) {
      if (nav.keywords.some((kw) => raw.toLowerCase().includes(kw))) {
        return {
          type: "navigate",
          rawText: raw,
          path: nav.path,
          label: nav.label,
        };
      }
    }

    return null;
  }, [query]);

  // Match resolved target accounts & instruments
  const matchedAccount = useMemo(() => {
    if (!parsedIntent) return accounts[0] || null;
    const hint = parsedIntent.accountHint?.toLowerCase();
    if (!hint) return accounts[0] || null;

    const exact = accounts.find(
      (a) =>
        a.name.toLowerCase().includes(hint) ||
        (a.institution && a.institution.toLowerCase().includes(hint))
    );
    return exact || accounts[0] || null;
  }, [parsedIntent, accounts]);

  const matchedInstrument = useMemo(() => {
    if (!parsedIntent || parsedIntent.type !== "trade") return null;
    const sym = parsedIntent.symbol?.toLowerCase();
    if (!sym) return null;

    return (
      instruments.find(
        (i) =>
          (i.symbol && i.symbol.toLowerCase() === sym) ||
          i.name.toLowerCase().includes(sym) ||
          (i.symbol && i.symbol.toLowerCase().replace(/\.ca$/i, "") === sym)
      ) || null
    );
  }, [parsedIntent, instruments]);

  // Execute the parsed financial command
  const handleExecute = async () => {
    if (!parsedIntent) return;

    if (parsedIntent.type === "navigate" && parsedIntent.path) {
      setLocation(parsedIntent.path);
      onOpenChange(false);
      return;
    }

    if (parsedIntent.type === "deposit" || parsedIntent.type === "expense") {
      if (!matchedAccount) {
        toast.error("لم يتم العثور على حساب نقدي مناسب لتنفيذ العملية.");
        return;
      }
      if (!parsedIntent.amount || parsedIntent.amount <= 0) {
        toast.error("يرجى إدخال مبلغ مالي صالح أكبر من صفر.");
        return;
      }

      setIsExecuting(true);
      try {
        await postCashMutation.mutateAsync({
          accountId: matchedAccount.id,
          eventType: parsedIntent.type === "deposit" ? "deposit" : "expense",
          amount: String(parsedIntent.amount),
          currency: matchedAccount.currency || "EGP",
          occurredAt: Date.now(),
          memo: parsedIntent.memo || (parsedIntent.type === "deposit" ? "إيداع سريع" : "مصروف سريع"),
          idempotencyKey: `omni-cash-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        });

        await utils.family.invalidate();
        toast.success(
          `تم بنجاح ${parsedIntent.type === "deposit" ? "إيداع" : "صرف"} ${formatMoney(parsedIntent.amount, matchedAccount.currency || "EGP")} في حساب ${matchedAccount.name}.`
        );
        onOpenChange(false);
      } catch (err: any) {
        toast.error(err?.message || "تعذر تنفيذ العملية المالية.");
      } finally {
        setIsExecuting(false);
      }
      return;
    }

    if (parsedIntent.type === "trade") {
      if (!matchedAccount) {
        toast.error("يرجى تحديد حساب تداول أو حساب نقدي متاح.");
        return;
      }
      if (!matchedInstrument) {
        toast.error(`السهم "${parsedIntent.symbol}" غير مسجل في أدواتك الاستثمارية. يرجى إضافته أولاً.`);
        return;
      }
      if (!parsedIntent.quantity || parsedIntent.quantity <= 0) {
        toast.error("يرجى إدخال كمية أسهم صالحة.");
        return;
      }
      if (!parsedIntent.unitPrice || parsedIntent.unitPrice <= 0) {
        toast.error("يرجى إدخال سعر تنفيذ السهم باستخدام علامة @ (مثال: @ 88.5).");
        return;
      }

      setIsExecuting(true);
      try {
        await postTradeMutation.mutateAsync({
          side: parsedIntent.side || "buy",
          accountId: matchedAccount.id,
          instrumentId: matchedInstrument.id,
          quantity: String(parsedIntent.quantity),
          unitPrice: String(parsedIntent.unitPrice),
          occurredAt: Date.now(),
          memo: `أمر تداول فوري عبر لوحة الأوامر الذكية: ${parsedIntent.side === "buy" ? "شراء" : "بيع"} ${parsedIntent.quantity} ${matchedInstrument.symbol}`,
          idempotencyKey: `omni-trade-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        });

        await utils.family.invalidate();
        toast.success(
          `تم بنجاح ترحيل صفقة ${parsedIntent.side === "buy" ? "شراء" : "بيع"} ${parsedIntent.quantity} سهم من ${matchedInstrument.name} إلى دفتر الأستاذ.`
        );
        onOpenChange(false);
      } catch (err: any) {
        toast.error(err?.message || "تعذر تنفيذ صفقة التداول.");
      } finally {
        setIsExecuting(false);
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-2xl bg-[#0B0F17] border border-white/10 text-slate-100 p-0 overflow-hidden shadow-2xl rounded-2xl"
        dir="rtl"
      >
        <DialogHeader className="p-4 border-b border-white/10 bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
              <Command className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-white flex items-center gap-2">
                لوحة الأوامر الذكية الشاملة
                <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-400 bg-emerald-950/40">
                  Ctrl + K
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-400 mt-0.5">
                اكتب أي أمر بلغة بسيطة للتنفيذ الفوري أو التنقل السريع في المنصة
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="p-4 space-y-4">
          {/* Quick Input Bar */}
          <div className="relative">
            <Search className="absolute right-3.5 top-3.5 size-4 text-slate-400" />
            <Input
              autoFocus
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setConfirmStep(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && parsedIntent) {
                  if (confirmStep) {
                    handleExecute();
                  } else {
                    setConfirmStep(true);
                  }
                }
              }}
              placeholder="مثال: شراء 100 COMI @ 88.5 أو ايداع 5000 تيلدا أو صرف 450 بنزين..."
              className="pr-10 pl-4 py-6 bg-slate-950/80 border-white/15 text-slate-100 placeholder:text-slate-500 focus-visible:ring-emerald-500 rounded-xl text-sm"
            />
          </div>

          {/* Parsed Intent Card & Preview */}
          {parsedIntent ? (
            <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-950/20 space-y-3 animate-in fade-in-50 duration-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge
                    className={
                      parsedIntent.type === "trade"
                        ? parsedIntent.side === "buy"
                          ? "bg-emerald-600 text-white"
                          : "bg-rose-600 text-white"
                        : parsedIntent.type === "deposit"
                        ? "bg-emerald-600 text-white"
                        : parsedIntent.type === "expense"
                        ? "bg-amber-600 text-white"
                        : "bg-sky-600 text-white"
                    }
                  >
                    {parsedIntent.type === "trade"
                      ? parsedIntent.side === "buy"
                        ? "أمر شراء أسهم"
                        : "أمر بيع أسهم"
                      : parsedIntent.type === "deposit"
                      ? "إيداع نقدي فوري"
                      : parsedIntent.type === "expense"
                      ? "تسجيل مصروف فوري"
                      : "تنقل سريع"}
                  </Badge>
                  <span className="text-xs text-slate-300 font-mono">
                    فهم الأمر المالي بنجاح
                  </span>
                </div>
                <span className="text-[11px] text-slate-400">
                  اضغط Enter للتأكيد والترحيل
                </span>
              </div>

              {/* Trade Specific Breakdown */}
              {parsedIntent.type === "trade" && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs">
                  <div className="p-2.5 rounded-lg bg-black/40 border border-white/5">
                    <span className="text-slate-400 block text-[10px]">الرمز</span>
                    <strong className="text-emerald-400 font-mono text-sm">
                      {matchedInstrument?.symbol || parsedIntent.symbol}
                    </strong>
                    <span className="text-[10px] text-slate-400 block truncate">
                      {matchedInstrument?.name || "غير مسجل"}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-black/40 border border-white/5">
                    <span className="text-slate-400 block text-[10px]">الكمية</span>
                    <strong className="text-white font-mono text-sm">
                      {parsedIntent.quantity?.toLocaleString() || 0}
                    </strong>
                  </div>
                  <div className="p-2.5 rounded-lg bg-black/40 border border-white/5">
                    <span className="text-slate-400 block text-[10px]">سعر التنفيذ</span>
                    <strong className="text-white font-mono text-sm">
                      {parsedIntent.unitPrice ? `${parsedIntent.unitPrice.toFixed(2)} ج.م` : "سعر السوق"}
                    </strong>
                  </div>
                  <div className="p-2.5 rounded-lg bg-black/40 border border-white/5">
                    <span className="text-slate-400 block text-[10px]">الحساب المرتبط</span>
                    <strong className="text-white text-xs truncate block">
                      {matchedAccount?.name || "حساب افتراضي"}
                    </strong>
                  </div>
                </div>
              )}

              {/* Cashflow Specific Breakdown */}
              {(parsedIntent.type === "deposit" || parsedIntent.type === "expense") && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1 text-xs">
                  <div className="p-2.5 rounded-lg bg-black/40 border border-white/5">
                    <span className="text-slate-400 block text-[10px]">المبلغ</span>
                    <strong className="text-emerald-400 font-mono text-sm">
                      {parsedIntent.amount ? formatMoney(parsedIntent.amount, "EGP") : "—"}
                    </strong>
                  </div>
                  <div className="p-2.5 rounded-lg bg-black/40 border border-white/5">
                    <span className="text-slate-400 block text-[10px]">الحساب المستهدف</span>
                    <strong className="text-white text-xs truncate block">
                      {matchedAccount?.name || "الحساب الرئيسي"}
                    </strong>
                  </div>
                  <div className="p-2.5 rounded-lg bg-black/40 border border-white/5 col-span-2 sm:col-span-1">
                    <span className="text-slate-400 block text-[10px]">البيان / الملاحظة</span>
                    <strong className="text-slate-200 text-xs truncate block">
                      {parsedIntent.memo || "—"}
                    </strong>
                  </div>
                </div>
              )}

              {/* Navigation Breakdown */}
              {parsedIntent.type === "navigate" && (
                <div className="p-2.5 rounded-lg bg-black/40 border border-white/5 flex items-center justify-between">
                  <span className="text-slate-200 text-xs">{parsedIntent.label}</span>
                  <Badge variant="outline" className="text-sky-400 border-sky-500/30">
                    {parsedIntent.path}
                  </Badge>
                </div>
              )}

              {/* 1-Click Confirmation Prompt */}
              <div className="pt-2 flex items-center justify-between gap-3 border-t border-white/10">
                <span className="text-xs text-slate-300">
                  {confirmStep
                    ? "هل أنت متأكد من رغبتك في ترحيل هذا القيد فوراً إلى الدفتر؟"
                    : "جاهز للتنفيذ الفوري المباشر"}
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setConfirmStep(false)}
                    className="text-xs text-slate-400 hover:text-white"
                  >
                    إلغاء
                  </Button>
                  <Button
                    size="sm"
                    disabled={isExecuting}
                    onClick={handleExecute}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs px-4"
                  >
                    {isExecuting ? (
                      <>
                        <Loader2 className="size-3.5 animate-spin ml-1.5" />
                        جارٍ الترحيل...
                      </>
                    ) : confirmStep ? (
                      "تأكيد نهائي وترحيل ✓"
                    ) : (
                      "ترحيل إلى الدفتر ↵"
                    )}
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            /* Cheat-sheet / Quick Shortcuts when empty */
            <div className="space-y-3 pt-2">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                أوامر سريعة يمكنك كتابتها مباشرة:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <button
                  onClick={() => setQuery("شراء 100 COMI @ 88.5")}
                  className="p-2.5 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.06] text-right transition-all flex items-center gap-2 group"
                >
                  <ArrowUpRight className="size-4 text-emerald-400 shrink-0" />
                  <div className="min-w-0">
                    <span className="block font-medium text-slate-200 group-hover:text-emerald-300">
                      شراء 100 COMI @ 88.5
                    </span>
                    <span className="block text-[10px] text-slate-500">
                      تسجيل صفقة شراء أسهم بنك CIB
                    </span>
                  </div>
                </button>

                <button
                  onClick={() => setQuery("بيع 500 ISPH")}
                  className="p-2.5 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.06] text-right transition-all flex items-center gap-2 group"
                >
                  <ArrowDownLeft className="size-4 text-rose-400 shrink-0" />
                  <div className="min-w-0">
                    <span className="block font-medium text-slate-200 group-hover:text-rose-300">
                      بيع 500 ISPH
                    </span>
                    <span className="block text-[10px] text-slate-500">
                      تسجيل صفقة بيع أسهم ابن سينا فارما
                    </span>
                  </div>
                </button>

                <button
                  onClick={() => setQuery("ايداع 5000 تيلدا")}
                  className="p-2.5 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.06] text-right transition-all flex items-center gap-2 group"
                >
                  <Wallet className="size-4 text-emerald-400 shrink-0" />
                  <div className="min-w-0">
                    <span className="block font-medium text-slate-200 group-hover:text-emerald-300">
                      ايداع 5000 تيلدا
                    </span>
                    <span className="block text-[10px] text-slate-500">
                      إيداع نقدي فوري في محفظة تيلدا
                    </span>
                  </div>
                </button>

                <button
                  onClick={() => setQuery("صرف 450 بنزين")}
                  className="p-2.5 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.06] text-right transition-all flex items-center gap-2 group"
                >
                  <Receipt className="size-4 text-amber-400 shrink-0" />
                  <div className="min-w-0">
                    <span className="block font-medium text-slate-200 group-hover:text-amber-300">
                      صرف 450 بنزين
                    </span>
                    <span className="block text-[10px] text-slate-500">
                      تسجيل مصروف وقود مباشر
                    </span>
                  </div>
                </button>
              </div>

              {/* Navigation Links */}
              <div className="pt-2 border-t border-white/5 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-400">
                <span className="text-slate-500 ml-1">انتقال سريع:</span>
                <button
                  onClick={() => {
                    setLocation("/investments");
                    onOpenChange(false);
                  }}
                  className="px-2 py-1 rounded-md bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-colors"
                >
                  المحفظة
                </button>
                <button
                  onClick={() => {
                    setLocation("/transactions");
                    onOpenChange(false);
                  }}
                  className="px-2 py-1 rounded-md bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-colors"
                >
                  المعاملات
                </button>
                <button
                  onClick={() => {
                    setLocation("/debts");
                    onOpenChange(false);
                  }}
                  className="px-2 py-1 rounded-md bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-colors"
                >
                  كروت الائتمان
                </button>
                <button
                  onClick={() => {
                    setLocation("/banking");
                    onOpenChange(false);
                  }}
                  className="px-2 py-1 rounded-md bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-colors"
                >
                  الشهادات البنكية
                </button>
                <button
                  onClick={() => {
                    setLocation("/reports");
                    onOpenChange(false);
                  }}
                  className="px-2 py-1 rounded-md bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-colors"
                >
                  التدقيق
                </button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default OmniCommandBar;
