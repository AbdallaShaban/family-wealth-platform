import DashboardLayout from "@/components/DashboardLayout";
import PageHeader from "@/components/PageHeader";
import FinancialTooltip from "@/components/FinancialTooltip";
import SensitiveValue from "@/components/SensitiveValue";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeftRight, Coins, GitCompareArrows, Loader2, Split, ShieldCheck, Layers } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { formatMoney } from "@/lib/financialDisplay";

const errorText = (error: unknown) => error instanceof Error ? error.message : "تعذر إكمال العملية الآن.";
const dateValue = () => new Date().toISOString().slice(0, 10);
const asTimestamp = (value: string) => new Date(`${value}T00:00:00.000Z`).getTime();

export default function LotAccountingPage() {
  const utils = trpc.useUtils();
  const bootstrap = trpc.family.bootstrap.useQuery();
  const lots = trpc.family.lots.list.useQuery();
  const realized = trpc.family.realizedPnl.list.useQuery({ limit: 100 });
  const realizedSummary = trpc.family.realizedPnl.summary.useQuery();
  const rebuild = trpc.family.lots.rebuildReport.useQuery();
  const transfers = trpc.family.lots.transfers.useQuery();
  const actions = trpc.family.lots.corporateActions.useQuery();
  const accounts = trpc.family.accounts.list.useQuery();
  const instruments = trpc.family.instruments.list.useQuery();
  const [transferFrom, setTransferFrom] = useState("");
  const [transferTo, setTransferTo] = useState("");
  const [transferInstrument, setTransferInstrument] = useState("");
  const [transferQuantity, setTransferQuantity] = useState("");
  const [transferDate, setTransferDate] = useState(dateValue);
  const [splitInstrument, setSplitInstrument] = useState("");
  const [splitRatio, setSplitRatio] = useState("");
  const [splitDate, setSplitDate] = useState(dateValue);
  const [dividendInstrument, setDividendInstrument] = useState("");
  const [dividendCashAccount, setDividendCashAccount] = useState("");
  const [dividendPerShare, setDividendPerShare] = useState("");
  const [dividendExDate, setDividendExDate] = useState(dateValue);
  const [dividendPaymentDate, setDividendPaymentDate] = useState(dateValue);
  const [dividendTaxAmount, setDividendTaxAmount] = useState("");
  const [dividendMemo, setDividendMemo] = useState("");
  const role = bootstrap.data?.membership.role ?? "viewer";
  const canEdit = ["editor", "advisor", "owner"].includes(role);
  const canAdvise = ["advisor", "owner"].includes(role);
  const refreshLotViews = () => {
    void utils.family.lots.list.invalidate();
    void utils.family.lots.rebuildReport.invalidate();
    void utils.family.lots.transfers.invalidate();
    void utils.family.lots.corporateActions.invalidate();
    void utils.family.realizedPnl.list.invalidate();
    void utils.family.realizedPnl.summary.invalidate();
    void utils.family.portfolio.list.invalidate();
    void utils.family.accounts.list.invalidate();
  };
  const transfer = trpc.family.lots.transfer.useMutation({ onSuccess: result => { toast.success("matchedLots" in result ? `تم نقل ${result.transferredQuantity} من الحيازة عبر ${result.matchedLots} Lots.` : "التحويل موجود مسبقًا ولم يُكرر."); refreshLotViews(); setTransferQuantity(""); }, onError: error => toast.error(errorText(error)) });
  const split = trpc.family.lots.stockSplit.useMutation({ onSuccess: result => { toast.success("affectedLots" in result ? `تم تسجيل التجزئة وتحديث ${result.affectedLots} Lots.` : "إجراء التجزئة موجود مسبقًا ولم يُكرر."); refreshLotViews(); setSplitRatio(""); }, onError: error => toast.error(errorText(error)) });
  const dividend = trpc.family.lots.cashDividend.useMutation({
    onSuccess: result => {
      toast.success(result.duplicate ? "توزيع الأرباح مسجل مسبقًا ولم يُكرر." : `تم ترحيل توزيعات أرباح ${result.symbol} بصافي ${formatMoney(result.netCashAmount, result.currency, 2)}.`);
      refreshLotViews();
      setDividendPerShare("");
      setDividendTaxAmount("");
      setDividendMemo("");
    },
    onError: error => toast.error(errorText(error)),
  });
  const openLots = lots.data?.filter(item => item.status === "open") ?? [];
  const accountName = useMemo(() => new Map((accounts.data ?? []).map(item => [item.id, item.name])), [accounts.data]);
  const instrumentName = useMemo(() => new Map((instruments.data ?? []).map(item => [item.id, item.name])), [instruments.data]);
  const cashAccounts = useMemo(() => (accounts.data ?? []).filter(acc => ["cash", "bank", "brokerage", "wallet"].includes(acc.accountType)), [accounts.data]);
  const submitTransfer = (event: React.FormEvent) => {
    event.preventDefault();
    if (!transferFrom || !transferTo || !transferInstrument || !transferQuantity) return;
    transfer.mutate({ fromAccountId: Number(transferFrom), toAccountId: Number(transferTo), instrumentId: Number(transferInstrument), quantity: transferQuantity, occurredAt: asTimestamp(transferDate), memo: "تحويل حيازة مع الحفاظ على أساس التكلفة", idempotencyKey: crypto.randomUUID() });
  };
  const submitSplit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!splitInstrument || !splitRatio) return;
    split.mutate({ instrumentId: Number(splitInstrument), ratio: splitRatio, effectiveAt: asTimestamp(splitDate), memo: "Stock split موثق يدويًا", idempotencyKey: crypto.randomUUID() });
  };
  const submitDividend = (event: React.FormEvent) => {
    event.preventDefault();
    if (!dividendInstrument || !dividendCashAccount || !dividendPerShare) return;
    dividend.mutate({
      instrumentId: Number(dividendInstrument),
      cashAccountId: Number(dividendCashAccount),
      dividendPerShare,
      exDate: asTimestamp(dividendExDate),
      paymentDate: asTimestamp(dividendPaymentDate),
      taxAmount: dividendTaxAmount || "0",
      memo: dividendMemo || null,
      idempotencyKey: crypto.randomUUID(),
    });
  };
  return <DashboardLayout><main className="mx-auto max-w-7xl space-y-6" dir="rtl">
    <PageHeader
      title="محاسبة الحصص (FIFO) والأرباح المحققة"
      description="طبقة استثمارية قابلة للتتبع تُبنى من أحداث الدفتر المنشورة. لا تغيّر إعادة البناء الدفتر، ولا تُنشئ صفقات أو تقييمات تلقائية."
      icon={Layers}
      breadcrumbs={[
        { label: "الاستثمار والتداول", href: "/investments" },
        { label: "محاسبة الحصص (FIFO)" },
      ]}
      badge="معيار FIFO مدقق"
      actions={
        <div className="flex items-center gap-2">
          <FinancialTooltip term="FIFO">
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-semibold text-primary cursor-help">
              <ShieldCheck className="size-3.5" />
              مبدأ FIFO المحاسبي
            </span>
          </FinancialTooltip>
        </div>
      }
    />
    <section className="grid gap-4 sm:grid-cols-4"><Card className="fintech-surface-card"><CardHeader className="pb-2"><CardDescription>Lots المفتوحة</CardDescription><CardTitle className="text-3xl">{lots.isLoading ? "—" : openLots.length}</CardTitle></CardHeader><CardContent className="text-xs text-muted-foreground">حيازات لم تُغلق بالكامل.</CardContent></Card><Card className="fintech-surface-card"><CardHeader className="pb-2"><CardDescription>Lots الكلية</CardDescription><CardTitle className="text-3xl">{lots.isLoading ? "—" : lots.data?.length ?? 0}</CardTitle></CardHeader><CardContent className="text-xs text-muted-foreground">بما فيها المنقولة والمغلقة.</CardContent></Card><Card className="fintech-surface-card"><CardHeader className="pb-2"><CardDescription>Realized P&L</CardDescription><CardTitle className="text-2xl"><SensitiveValue>{formatMoney(realizedSummary.data?.realizedPnl ?? "0", bootstrap.data?.workspace.baseCurrency ?? "EGP", 2)}</SensitiveValue></CardTitle></CardHeader><CardContent className="text-xs text-muted-foreground">بعد الرسوم والضرائب الموزعة.</CardContent></Card><Card className="fintech-surface-card"><CardHeader className="pb-2"><CardDescription>سلامة إعادة البناء</CardDescription><CardTitle className="text-xl">{rebuild.isLoading ? "—" : rebuild.data?.status === "matched" ? "متطابق" : "يتطلب مراجعة"}</CardTitle></CardHeader><CardContent className="text-xs text-muted-foreground">مصدر المقارنة: أحداث منشورة فقط.</CardContent></Card></section>
    <Tabs defaultValue="lots" className="space-y-5"><TabsList className="investment-tabs-list"><TabsTrigger value="lots">سجل Lots</TabsTrigger><TabsTrigger value="pnl">Realized P&L</TabsTrigger><TabsTrigger value="operations">عمليات الحيازة</TabsTrigger><TabsTrigger value="rebuild">سلامة المصدر</TabsTrigger></TabsList>
      <TabsContent value="lots"><Card className="fintech-surface-card"><CardHeader><CardTitle>سجل التكلفة حسب Lot</CardTitle><CardDescription>كل Lot يحمل حدث الاكتساب، أساس التكلفة، والكمية المتبقية. القيم محمية بوضع الخصوصية.</CardDescription></CardHeader><CardContent>{lots.isLoading ? <p className="py-10 text-center text-sm text-muted-foreground">جارٍ تحميل Lots…</p> : lots.error ? <p className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">{errorText(lots.error)}</p> : lots.data?.length ? <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-right text-sm"><thead className="bg-slate-50 text-xs text-slate-600"><tr><th className="p-3">الحساب / الأداة</th><th className="p-3">حدث الاكتساب</th><th className="p-3">الأصل</th><th className="p-3">المتبقي</th><th className="p-3">تكلفة الوحدة</th><th className="p-3">الحالة</th></tr></thead><tbody className="divide-y">{lots.data.map(item => <tr key={item.id}><td className="p-3"><strong>{accountName.get(item.accountId) ?? `حساب #${item.accountId}`}</strong><p className="text-xs text-muted-foreground">{instrumentName.get(item.instrumentId) ?? `أداة #${item.instrumentId}`}</p></td><td className="p-3 font-mono text-xs">#{item.acquisitionEventId}<p className="mt-1 text-xs text-muted-foreground">{new Date(item.acquiredAt).toLocaleDateString("ar-EG")}</p></td><td className="p-3"><SensitiveValue>{item.originalQuantity}</SensitiveValue></td><td className="p-3 font-semibold"><SensitiveValue>{item.remainingQuantity}</SensitiveValue></td><td className="p-3"><SensitiveValue>{formatMoney(item.unitCost, item.costCurrency, 4)}</SensitiveValue></td><td className="p-3"><Badge variant={item.status === "open" ? "secondary" : "outline"}>{item.status === "open" ? "مفتوح" : "مغلق"}</Badge>{item.sourceLotId ? <p className="mt-1 text-[11px] text-muted-foreground">منقول من Lot #{item.sourceLotId}</p> : null}</td></tr>)}</tbody></table></div> : <p className="py-12 text-center text-sm text-muted-foreground">لا توجد Lots منشورة بعد.</p>}</CardContent></Card></TabsContent>
      <TabsContent value="pnl"><Card className="fintech-surface-card"><CardHeader><CardTitle>مطابقات FIFO وRealized P&L</CardTitle><CardDescription>كل عملية بيع مرتبطة بـLot محدد، مع فصل التكلفة والرسوم والضرائب والعائد الإجمالي.</CardDescription></CardHeader><CardContent>{realized.isLoading ? <p className="py-10 text-center text-sm text-muted-foreground">جارٍ تحميل المطابقات…</p> : realized.data?.length ? <div className="overflow-x-auto"><table className="w-full min-w-[920px] text-right text-sm"><thead className="bg-slate-50 text-xs text-slate-600"><tr><th className="p-3">البيع / Lot</th><th className="p-3">الكمية</th><th className="p-3">التكلفة</th><th className="p-3">العائد</th><th className="p-3">رسوم + ضريبة</th><th className="p-3">Realized P&L</th></tr></thead><tbody className="divide-y">{realized.data.map(item => <tr key={item.id}><td className="p-3 font-mono text-xs">بيع #{item.sellEventId} ← Lot #{item.lotId}</td><td className="p-3"><SensitiveValue>{item.quantity}</SensitiveValue></td><td className="p-3"><SensitiveValue>{formatMoney(item.costBasis, item.currency, 2)}</SensitiveValue></td><td className="p-3"><SensitiveValue>{formatMoney(item.grossProceeds, item.currency, 2)}</SensitiveValue></td><td className="p-3"><SensitiveValue>{formatMoney(item.allocatedFee, item.currency, 2)} + {formatMoney(item.allocatedTax, item.currency, 2)}</SensitiveValue></td><td className="p-3 font-semibold"><SensitiveValue>{formatMoney(item.realizedPnl, item.currency, 2)}</SensitiveValue></td></tr>)}</tbody></table></div> : <p className="py-12 text-center text-sm text-muted-foreground">لا توجد عمليات بيع مطابقة بعد.</p>}</CardContent></Card></TabsContent>
      <TabsContent value="operations"><div className="grid gap-6 lg:grid-cols-3"><Card className="fintech-surface-card"><CardHeader><CardTitle className="flex items-center gap-2"><ArrowLeftRight className="size-5 text-primary" />تحويل حيازة</CardTitle><CardDescription>ينقل الكمية عبر Lots FIFO ويحافظ على cost basis. لا يُعامل كبيع ولا ينتج P&L.</CardDescription></CardHeader><CardContent><form className="grid gap-4" onSubmit={submitTransfer}><div className="grid gap-2"><Label>الأداة</Label><Select value={transferInstrument} onValueChange={setTransferInstrument} disabled={!canEdit}><SelectTrigger><SelectValue placeholder="اختر الأداة" /></SelectTrigger><SelectContent>{(instruments.data ?? []).map(item => <SelectItem key={item.id} value={String(item.id)}>{item.name} · {item.symbol || item.currency}</SelectItem>)}</SelectContent></Select></div><div className="grid gap-3 sm:grid-cols-2"><div className="grid gap-2"><Label>من الحساب</Label><Select value={transferFrom} onValueChange={setTransferFrom} disabled={!canEdit}><SelectTrigger><SelectValue placeholder="المصدر" /></SelectTrigger><SelectContent>{(accounts.data ?? []).map(item => <SelectItem key={item.id} value={String(item.id)}>{item.name}</SelectItem>)}</SelectContent></Select></div><div className="grid gap-2"><Label>إلى الحساب</Label><Select value={transferTo} onValueChange={setTransferTo} disabled={!canEdit}><SelectTrigger><SelectValue placeholder="الوجهة" /></SelectTrigger><SelectContent>{(accounts.data ?? []).map(item => <SelectItem key={item.id} value={String(item.id)}>{item.name}</SelectItem>)}</SelectContent></Select></div></div><div className="grid gap-3 sm:grid-cols-2"><div className="grid gap-2"><Label htmlFor="transfer-quantity">الكمية</Label><Input id="transfer-quantity" value={transferQuantity} onChange={event => setTransferQuantity(event.target.value)} inputMode="decimal" disabled={!canEdit} required /></div><div className="grid gap-2"><Label htmlFor="transfer-date">تاريخ التحويل</Label><Input id="transfer-date" type="date" value={transferDate} onChange={event => setTransferDate(event.target.value)} disabled={!canEdit} required /></div></div><Button type="submit" disabled={!canEdit || transfer.isPending}>{transfer.isPending && <Loader2 className="ml-2 size-4 animate-spin" />}{canEdit ? "تسجيل تحويل حيازة" : "تتطلب صلاحية محرر"}</Button></form></CardContent></Card><Card className="fintech-surface-card"><CardHeader><CardTitle className="flex items-center gap-2"><Split className="size-5 text-primary" />Stock split</CardTitle><CardDescription>يُسجل إجراء شركة غير نقدي، يضرب الكمية ويقسم تكلفة الوحدة، مع provenance وتدقيق.</CardDescription></CardHeader><CardContent><form className="grid gap-4" onSubmit={submitSplit}><div className="grid gap-2"><Label>الأداة</Label><Select value={splitInstrument} onValueChange={setSplitInstrument} disabled={!canAdvise}><SelectTrigger><SelectValue placeholder="اختر الأداة" /></SelectTrigger><SelectContent>{(instruments.data ?? []).map(item => <SelectItem key={item.id} value={String(item.id)}>{item.name} · {item.symbol || item.currency}</SelectItem>)}</SelectContent></Select></div><div className="grid gap-3 sm:grid-cols-2"><div className="grid gap-2"><Label htmlFor="split-ratio">النسبة (مثال 2)</Label><Input id="split-ratio" value={splitRatio} onChange={event => setSplitRatio(event.target.value)} inputMode="decimal" disabled={!canAdvise} required /></div><div className="grid gap-2"><Label htmlFor="split-date">تاريخ السريان</Label><Input id="split-date" type="date" value={splitDate} onChange={event => setSplitDate(event.target.value)} disabled={!canAdvise} required /></div></div><Button type="submit" disabled={!canAdvise || split.isPending}>{split.isPending && <Loader2 className="ml-2 size-4 animate-spin" />}{canAdvise ? "تسجيل الإجراء" : "تتطلب صلاحية مستشار"}</Button></form></CardContent></Card><Card className="fintech-surface-card"><CardHeader><CardTitle className="flex items-center gap-2"><Coins className="size-5 text-emerald-600" />توزيعات أرباح نقدية (Cash Dividend)</CardTitle><CardDescription>توزيع نقدي متوازن ذريًا على حيازات Lots المفتوحة في تاريخ الاستحقاق دون المساس بأساس التكلفة.</CardDescription></CardHeader><CardContent><form className="grid gap-3" onSubmit={submitDividend}><div className="grid gap-2"><Label>الأداة الاستثمارية</Label><Select value={dividendInstrument} onValueChange={setDividendInstrument} disabled={!canAdvise}><SelectTrigger><SelectValue placeholder="اختر أداة التوزيع" /></SelectTrigger><SelectContent>{(instruments.data ?? []).map(item => <SelectItem key={item.id} value={String(item.id)}>{item.name} · {item.symbol || item.currency}</SelectItem>)}</SelectContent></Select></div><div className="grid gap-2"><Label>حساب استلام النقد</Label><Select value={dividendCashAccount} onValueChange={setDividendCashAccount} disabled={!canAdvise}><SelectTrigger><SelectValue placeholder="اختر الحساب النقدي" /></SelectTrigger><SelectContent>{cashAccounts.map(item => <SelectItem key={item.id} value={String(item.id)}>{item.name} ({item.currency})</SelectItem>)}</SelectContent></Select></div><div className="grid gap-3 sm:grid-cols-2"><div className="grid gap-2"><Label htmlFor="dividend-dps">عائد السهم الواحد</Label><Input id="dividend-dps" value={dividendPerShare} onChange={event => setDividendPerShare(event.target.value)} inputMode="decimal" placeholder="مثال: 2.50" disabled={!canAdvise} required /></div><div className="grid gap-2"><Label htmlFor="dividend-tax">ضريبة الاستقطاع (اختياري)</Label><Input id="dividend-tax" value={dividendTaxAmount} onChange={event => setDividendTaxAmount(event.target.value)} inputMode="decimal" placeholder="0.00" disabled={!canAdvise} /></div></div><div className="grid gap-3 sm:grid-cols-2"><div className="grid gap-2"><Label htmlFor="dividend-ex-date">تاريخ الاستحقاق (Ex-Date)</Label><Input id="dividend-ex-date" type="date" value={dividendExDate} onChange={event => setDividendExDate(event.target.value)} disabled={!canAdvise} required /></div><div className="grid gap-2"><Label htmlFor="dividend-pay-date">تاريخ الصرف (Payment Date)</Label><Input id="dividend-pay-date" type="date" value={dividendPaymentDate} onChange={event => setDividendPaymentDate(event.target.value)} disabled={!canAdvise} required /></div></div><div className="grid gap-2"><Label htmlFor="dividend-memo">ملاحظات / بيان (اختياري)</Label><Input id="dividend-memo" value={dividendMemo} onChange={event => setDividendMemo(event.target.value)} placeholder="مثال: توزيع أرباح الربع الثاني 2026" disabled={!canAdvise} /></div><Button type="submit" disabled={!canAdvise || dividend.isPending} className="mt-1">{dividend.isPending && <Loader2 className="ml-2 size-4 animate-spin" />}{canAdvise ? "ترحيل توزيعات الأرباح" : "تتطلب صلاحية مستشار"}</Button></form></CardContent></Card></div></TabsContent>
      <TabsContent value="rebuild"><div className="grid gap-6 lg:grid-cols-[1.1fr_.9fr]"><Card className="fintech-surface-card"><CardHeader><CardTitle className="flex items-center gap-2"><GitCompareArrows className="size-5 text-primary" />تقرير إعادة البناء التشخيصي</CardTitle><CardDescription>مقارنة deterministic بين أحداث الدفتر المنشورة والـLots المحفوظة. التقرير لا يكتب إلى قاعدة البيانات.</CardDescription></CardHeader><CardContent>{rebuild.isLoading ? <p className="py-8 text-center text-sm text-muted-foreground">جارٍ بناء التقرير…</p> : rebuild.error ? <p className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">{errorText(rebuild.error)}</p> : <div className="space-y-4"><div className="flex flex-wrap items-center gap-2"><Badge variant={rebuild.data?.status === "matched" ? "secondary" : "outline"}>{rebuild.data?.status === "matched" ? "متطابق" : "يتطلب مراجعة"}</Badge><span className="text-xs text-muted-foreground">{rebuild.data?.rebuiltLotCount} معاد البناء · {rebuild.data?.persistedLotCount} محفوظ · {rebuild.data?.rebuiltMatchCount} مطابقة</span></div>{(rebuild.data?.issues.length ?? 0) > 0 && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><strong>مشكلات الأحداث ({rebuild.data?.issueCount})</strong><ul className="mt-2 list-disc space-y-1 pr-5">{rebuild.data?.issues.slice(0, 8).map(issue => <li key={`${issue.eventId}-${issue.code}`}>الحدث #{issue.eventId}: {issue.message}</li>)}</ul></div>}{(rebuild.data?.differences.length ?? 0) > 0 && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><strong>فروقات Lots ({rebuild.data?.differenceCount})</strong><p className="mt-2">تحتاج الفروقات إلى مراجعة بشرية أو ترحيل تصحيحي صريح؛ لا يتم التصحيح تلقائيًا.</p></div>}{!rebuild.data?.issues.length && !rebuild.data?.differences.length && <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">لم تُكتشف فروقات بين الـsource events والـLots المحفوظة.</p>}</div>}</CardContent></Card><div className="space-y-6"><Card className="fintech-surface-card"><CardHeader><CardTitle>Corporate Actions</CardTitle></CardHeader><CardContent>{actions.data?.length ? <ul className="space-y-3 text-sm">{actions.data.map(action => <li key={action.id} className="flex items-center justify-between border-b pb-3"><span>أداة #{action.instrumentId} · {new Date(action.effectiveAt).toLocaleDateString("ar-EG")}</span><Badge variant="outline">× {action.ratio}</Badge></li>)}</ul> : <p className="text-sm text-muted-foreground">لا توجد إجراءات مسجلة.</p>}</CardContent></Card><Card className="fintech-surface-card"><CardHeader><CardTitle>Lineage التحويلات</CardTitle></CardHeader><CardContent>{transfers.data?.length ? <ul className="space-y-3 text-sm">{transfers.data.slice(0, 8).map(item => <li key={item.id} className="flex items-center justify-between border-b pb-3"><span>#{item.sourceLotId} ← #{item.destinationLotId}</span><SensitiveValue>{item.quantity}</SensitiveValue></li>)}</ul> : <p className="text-sm text-muted-foreground">لا توجد تحويلات Lots مسجلة.</p>}</CardContent></Card></div></div></TabsContent>
    </Tabs>
  </main></DashboardLayout>;
}
