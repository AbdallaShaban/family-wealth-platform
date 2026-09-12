import DashboardLayout from "@/components/DashboardLayout";
import PageHeader from "@/components/PageHeader";
import ConfirmDialog from "@/components/ConfirmDialog";
import SensitiveValue from "@/components/SensitiveValue";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { CircleAlert, Landmark, Loader2, TrendingUp, DollarSign } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { formatMoney } from "@/lib/financialDisplay";

const errorText = (error: unknown) => error instanceof Error ? error.message : "تعذر إكمال العملية الآن.";

export default function TradingPageRedesign() {
  const utils = trpc.useUtils();
  const [, setLocation] = useLocation();
  const accounts = trpc.family.accounts.list.useQuery();
  const instruments = trpc.family.instruments.list.useQuery();
  const portfolio = trpc.family.portfolio.list.useQuery();
  const bootstrap = trpc.family.bootstrap.useQuery();
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [accountId, setAccountId] = useState("");
  const [instrumentId, setInstrumentId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [feeAmount, setFeeAmount] = useState("");
  const [taxAmount, setTaxAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [quoteInstrumentId, setQuoteInstrumentId] = useState("");
  const [quotePrice, setQuotePrice] = useState("");
  const [confirmTradeOpen, setConfirmTradeOpen] = useState(false);

  const tradeAccounts = (accounts.data ?? []).filter(account => ["cash", "bank", "brokerage", "wallet"].includes(account.accountType) && account.status === "active");
  const selectedAccount = tradeAccounts.find(account => String(account.id) === accountId);
  const selectedInstrument = instruments.data?.find(instrument => String(instrument.id) === instrumentId);
  const canAdvise = ["owner", "advisor"].includes(bootstrap.data?.membership.role || "");

  useEffect(() => {
    const raw = sessionStorage.getItem("family-trade-draft");
    if (!raw) return;
    try {
      const draft = JSON.parse(raw) as { instrumentId?: number; side?: "buy" | "sell" };
      if (Number.isInteger(draft.instrumentId) && draft.side) {
        setInstrumentId(String(draft.instrumentId));
        setSide(draft.side);
      }
    } finally {
      sessionStorage.removeItem("family-trade-draft");
    }
  }, []);

  const trade = trpc.family.ledger.trade.useMutation({
    onSuccess: () => {
      toast.success("تم نشر الصفقة وتحديث الحيازة ومتوسط التكلفة في معاملة واحدة.");
      setQuantity(""); setUnitPrice(""); setFeeAmount(""); setTaxAmount(""); setMemo("");
      setConfirmTradeOpen(false);
      void utils.family.dashboard.invalidate();
      void utils.family.accounts.list.invalidate();
      void utils.family.ledger.recent.invalidate();
      void utils.family.portfolio.list.invalidate();
    },
    onError: error => {
      setConfirmTradeOpen(false);
      toast.error(errorText(error));
    },
  });
  const recordQuote = trpc.family.prices.recordManual.useMutation({
    onSuccess: () => { toast.success("تم حفظ سعر السوق اليدوي مع مصدره وتاريخه."); setQuotePrice(""); void utils.family.portfolio.list.invalidate(); void utils.family.dashboard.invalidate(); },
    onError: error => toast.error(errorText(error)),
  });
  const chargePreviewInput = useMemo(() => {
    const gross = Number(quantity) * Number(unitPrice);
    return { side, grossAmount: Number.isFinite(gross) && gross > 0 ? String(gross) : "1", currency: selectedInstrument?.currency || "USD" };
  }, [quantity, unitPrice, side, selectedInstrument?.currency]);
  const chargePreview = trpc.family.feeTax.preview.useQuery(chargePreviewInput, { enabled: chargePreviewInput.grossAmount !== "1" && Boolean(selectedInstrument) });

  const submitTrade = (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedAccount || !selectedInstrument) return toast.error("اختر حساب تسوية وأداة استثمارية أولًا.");
    setConfirmTradeOpen(true);
  };
  const executeConfirmedTrade = () => {
    if (!selectedAccount || !selectedInstrument) return;
    trade.mutate({
      side,
      accountId: selectedAccount.id,
      instrumentId: selectedInstrument.id,
      quantity,
      unitPrice,
      feeAmount: feeAmount || null,
      taxAmount: taxAmount || null,
      occurredAt: Date.now(),
      memo: memo || null,
      idempotencyKey: crypto.randomUUID(),
    });
  };
  const submitQuote = (event: React.FormEvent) => {
    event.preventDefault();
    if (!quoteInstrumentId) return toast.error("اختر الأداة أولًا.");
    recordQuote.mutate({ instrumentId: Number(quoteInstrumentId), price: quotePrice, asOf: Date.now() });
  };

  return <DashboardLayout><main className="mx-auto max-w-7xl space-y-6" dir="rtl">
    <PageHeader
      title="التداول والحيازات"
      description="تتحقق المنصة من الرصيد أو الكمية قبل النشر. لا تُنشئ إشارات السوق أي صفقة؛ يبقى القرار والمراجعة والتأكيد مسؤولية المستخدم."
      icon={TrendingUp}
      breadcrumbs={[
        { label: "الاستثمار والتداول", href: "/investments" },
        { label: "أوامر التداول والحيازات" },
      ]}
      badge="تدقيق المعاملات"
      actions={
        <Button variant="outline" size="sm" onClick={() => setLocation("/research/prices")}>
          بيانات المراقبة والأسعار
        </Button>
      }
    />
    <Tabs defaultValue="trade" className="space-y-5">
      <TabsList className="investment-tabs-list"><TabsTrigger value="trade">تسجيل صفقة</TabsTrigger><TabsTrigger value="holdings">الحيازات</TabsTrigger><TabsTrigger value="quotes">سعر يدوي</TabsTrigger></TabsList>
      <TabsContent value="trade"><Card className="fintech-surface-card"><CardHeader><CardTitle>مراجعة وتسجيل صفقة شراء أو بيع</CardTitle><CardDescription>الرسوم والضرائب المقترحة تُسجل مع القيد المتوازن. الأرباح المحققة تُحسب وفق منهجية FIFO ومقيدة بدفتر الأستاذ المزدوج.</CardDescription></CardHeader><CardContent>{accounts.isLoading || instruments.isLoading ? <p className="py-12 text-center text-sm text-muted-foreground">جارٍ تجهيز نموذج الصفقة…</p> : tradeAccounts.length && instruments.data?.length ? <form onSubmit={submitTrade} className="grid gap-4"><div className="grid gap-3 sm:grid-cols-3"><div className="grid gap-2"><Label>العملية</Label><Select value={side} onValueChange={value => setSide(value as "buy" | "sell")}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="buy">شراء</SelectItem><SelectItem value="sell">بيع</SelectItem></SelectContent></Select></div><div className="grid gap-2"><Label>حساب التسوية</Label><Select value={accountId} onValueChange={setAccountId}><SelectTrigger><SelectValue placeholder="اختر حسابًا" /></SelectTrigger><SelectContent>{tradeAccounts.map(account => <SelectItem key={account.id} value={String(account.id)}>{account.name} — {account.currency}</SelectItem>)}</SelectContent></Select></div><div className="grid gap-2"><Label>الأداة</Label><Select value={instrumentId} onValueChange={setInstrumentId}><SelectTrigger><SelectValue placeholder="اختر أداة" /></SelectTrigger><SelectContent>{instruments.data.map(item => <SelectItem key={item.id} value={String(item.id)}>{item.name} — {item.currency}</SelectItem>)}</SelectContent></Select></div></div><div className="grid gap-3 sm:grid-cols-2"><div className="grid gap-2"><Label htmlFor="trade-quantity">الكمية</Label><Input id="trade-quantity" inputMode="decimal" value={quantity} onChange={event => setQuantity(event.target.value)} required /></div><div className="grid gap-2"><Label htmlFor="trade-price">سعر الوحدة</Label><Input id="trade-price" inputMode="decimal" value={unitPrice} onChange={event => setUnitPrice(event.target.value)} required /></div><div className="grid gap-2"><Label htmlFor="trade-fee">الرسوم</Label><Input id="trade-fee" inputMode="decimal" value={feeAmount} onChange={event => setFeeAmount(event.target.value)} placeholder="0" /></div><div className="grid gap-2"><Label htmlFor="trade-tax">الضرائب</Label><Input id="trade-tax" inputMode="decimal" value={taxAmount} onChange={event => setTaxAmount(event.target.value)} placeholder="0" /></div></div>{chargePreview.data?.rows.length ? <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-[#0B1628] dark:text-slate-100 font-medium"><p>اقتراح القواعد: رسوم {formatMoney(chargePreview.data.suggestedFeeAmount, chargePreview.data.currency, 2)} وضريبة {formatMoney(chargePreview.data.suggestedTaxAmount, chargePreview.data.currency, 2)}.</p><Button className="mt-3" type="button" size="sm" variant="outline" onClick={() => { setFeeAmount(chargePreview.data!.suggestedFeeAmount); setTaxAmount(chargePreview.data!.suggestedTaxAmount); toast.message("تم تطبيق الاقتراح على النموذج. راجعه قبل النشر."); }}>تطبيق الاقتراح</Button></div> : null}<div className="grid gap-2"><Label htmlFor="trade-memo">مذكرة العملية</Label><Textarea id="trade-memo" value={memo} onChange={event => setMemo(event.target.value)} maxLength={2000} placeholder="اختياري" /></div><Button type="submit" disabled={trade.isPending || !canAdvise}>{trade.isPending && <Loader2 className="ml-2 size-4 animate-spin" />}{canAdvise ? "تسجيل ونشر الصفقة" : "تتطلب صلاحية مستشار"}</Button></form> : <div className="fintech-empty-state"><Landmark className="fintech-empty-state-icon" /><h3>جهّز الحساب والأداة أولًا</h3><p>يلزم حساب تسوية وأداة استثمارية بالعملة نفسها قبل تسجيل صفقة فعلية.</p></div>}</CardContent></Card></TabsContent>
      <TabsContent value="holdings"><Card className="fintech-surface-card"><CardHeader><CardTitle className="flex items-center gap-2"><TrendingUp className="size-5 text-primary" />الحيازات الفعلية</CardTitle><CardDescription>تُحسب الحيازة ومتوسط التكلفة من الصفقات المنشورة. القيمة تتطلب سعر سوق موثقًا.</CardDescription></CardHeader><CardContent>{portfolio.isLoading ? <p className="py-10 text-center text-sm text-muted-foreground">جارٍ تحميل الحيازات…</p> : portfolio.error ? <p className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">{errorText(portfolio.error)}</p> : portfolio.data?.length ? <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-right text-sm"><thead className="bg-slate-50 text-xs text-slate-600"><tr><th className="p-4">الأداة</th><th className="p-4">الكمية</th><th className="p-4">متوسط التكلفة</th><th className="p-4">القيمة</th><th className="p-4">الحالة</th></tr></thead><tbody className="divide-y">{portfolio.data.map(position => <tr key={position.id}><td className="p-4"><strong>{position.instrumentName}</strong><p className="mt-1 text-xs text-muted-foreground">{position.symbol || "بدون رمز"} · {position.currency}</p></td><td className="p-4">{position.quantity}</td><td className="p-4"><SensitiveValue>{formatMoney(position.averageCost, position.costCurrency, 2)}</SensitiveValue></td><td className="p-4 font-semibold"><SensitiveValue>{position.marketValue ? formatMoney(position.marketValue, position.currency, 2) : "—"}</SensitiveValue></td><td className="p-4"><Badge variant={position.quoteStatus === "unavailable" ? "outline" : "secondary"}>{position.quoteStatus === "unavailable" ? "يتطلب سعرًا" : "متاح"}</Badge></td></tr>)}</tbody></table></div> : <div className="fintech-empty-state"><TrendingUp className="fintech-empty-state-icon" /><h3>لا توجد حيازات منشورة</h3><p>ستنمو هذه القائمة من صفقات الشراء والبيع المنشورة فقط.</p></div>}</CardContent></Card></TabsContent>
      <TabsContent value="quotes"><Card className="fintech-surface-card max-w-2xl"><CardHeader><CardTitle>سعر سوق يدوي موثق</CardTitle><CardDescription>يسجل السعر مع تاريخ الإدخال. للحصول على Yahoo Finance ومصدره ووقت الاقتباس، استخدم شاشة بيانات المراقبة.</CardDescription></CardHeader><CardContent>{instruments.data?.length ? <form className="grid gap-4" onSubmit={submitQuote}><div className="grid gap-2"><Label>الأداة</Label><Select value={quoteInstrumentId} onValueChange={setQuoteInstrumentId}><SelectTrigger><SelectValue placeholder="اختر أداة" /></SelectTrigger><SelectContent>{instruments.data.map(item => <SelectItem key={item.id} value={String(item.id)}>{item.name} — {item.currency}</SelectItem>)}</SelectContent></Select></div><div className="grid gap-2"><Label htmlFor="manual-quote">سعر الوحدة</Label><Input id="manual-quote" inputMode="decimal" value={quotePrice} onChange={event => setQuotePrice(event.target.value)} required /></div><Button type="submit" disabled={recordQuote.isPending || !canAdvise}>{recordQuote.isPending && <Loader2 className="ml-2 size-4 animate-spin" />}{canAdvise ? "حفظ السعر اليدوي" : "تتطلب صلاحية مستشار"}</Button></form> : <p className="flex gap-2 rounded-xl bg-muted/50 p-4 text-sm text-muted-foreground"><CircleAlert className="size-4 shrink-0" />أضف أداة استثمارية أولًا قبل تسجيل سعر.</p>}</CardContent></Card></TabsContent>
    </Tabs>

    <ConfirmDialog
      open={confirmTradeOpen}
      onOpenChange={setConfirmTradeOpen}
      title={`تأكيد نشر صفقة ${side === "buy" ? "شراء" : "بيع"}`}
      description={`أنت على وشك نشر صفقة ${side === "buy" ? "شراء" : "بيع"} لـ ${quantity} وحدة من أداة "${selectedInstrument?.name}" عبر حساب "${selectedAccount?.name}". سيتم قيد العملية في دفتر الأستاذ وتحديث متوسط التكلفة والحيازات.`}
      confirmText={`تأكيد نشر صفقة الـ ${side === "buy" ? "شراء" : "بيع"}`}
      cancelText="إلغاء والعودة"
      isLoading={trade.isPending}
      onConfirm={executeConfirmedTrade}
    />
  </main></DashboardLayout>;
}
