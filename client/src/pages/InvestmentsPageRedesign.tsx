import DashboardLayout from "@/components/DashboardLayout";
import PageHeader from "@/components/PageHeader";
import SensitiveValue from "@/components/SensitiveValue";
import ConfirmDialog from "@/components/ConfirmDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  BriefcaseBusiness,
  CircleAlert,
  Landmark,
  Loader2,
  Plus,
  TrendingUp,
  GitCompareArrows,
  ArrowLeftRight,
  Layers,
  ShieldCheck,
  CheckCircle2,
  DollarSign,
  Clock,
  TrendingDown,
  BarChart3,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { formatMoney } from "@/lib/financialDisplay";

type AssetType = "equity" | "fund" | "bond" | "gold" | "real_estate" | "cash_equivalent" | "other";
const assetTypeLabel: Record<AssetType, string> = {
  equity: "سهم",
  fund: "صندوق",
  bond: "سند",
  gold: "ذهب",
  real_estate: "عقار",
  cash_equivalent: "ما يعادل النقد",
  other: "أخرى",
};
const errorText = (error: unknown) => (error instanceof Error ? error.message : "تعذر إكمال العملية الآن.");

export default function InvestmentsPageRedesign() {
  const utils = trpc.useUtils();
  const [, setLocation] = useLocation();
  const access = trpc.family.bootstrap.useQuery();
  const accounts = trpc.family.accounts.list.useQuery();
  const instruments = trpc.family.instruments.list.useQuery();
  const portfolio = trpc.family.portfolio.list.useQuery();
  const lots = trpc.family.lots.list.useQuery();
  const realizedSummary = trpc.family.realizedPnl.summary.useQuery();
  const realizedList = trpc.family.realizedPnl.list.useQuery({ limit: 50 });
  const rebuildReport = trpc.family.lots.rebuildReport.useQuery();

  const baseCurrency = access.data?.workspace.baseCurrency || "EGP";
  const instrumentMap = useMemo(() => new Map((instruments.data ?? []).map((i) => [i.id, i.name])), [instruments.data]);

  // Tab State
  const [activeTab, setActiveTab] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("tab") || "holdings";
  });

  // Instrument Creation State
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [currency, setCurrency] = useState("EGP");
  const [assetType, setAssetType] = useState<AssetType>("equity");

  // Trade Execution State
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [tradeAccountId, setTradeAccountId] = useState("");
  const [tradeInstrumentId, setTradeInstrumentId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [feeAmount, setFeeAmount] = useState("");
  const [taxAmount, setTaxAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [confirmTradeOpen, setConfirmTradeOpen] = useState(false);

  // Manual Quote State
  const [quoteInstrumentId, setQuoteInstrumentId] = useState("");
  const [quotePrice, setQuotePrice] = useState("");

  const role = access.data?.membership.role || "viewer";
  const canAdvise = ["owner", "advisor"].includes(role);
  const canEdit = ["owner", "advisor", "editor"].includes(role);

  const tradeAccounts = (accounts.data ?? []).filter(
    (account) => ["cash", "bank", "brokerage", "wallet"].includes(account.accountType) && account.status === "active"
  );
  const selectedAccount = tradeAccounts.find((account) => String(account.id) === tradeAccountId);
  const selectedInstrument = instruments.data?.find((item) => String(item.id) === tradeInstrumentId);

  // Mutations
  const createInstrument = trpc.family.instruments.create.useMutation({
    onSuccess: () => {
      toast.success("تمت إضافة الأداة الاستثمارية بنجاح.");
      setName("");
      setSymbol("");
      void utils.family.instruments.list.invalidate();
    },
    onError: (error) => toast.error(errorText(error)),
  });

  const recordQuote = trpc.family.prices.recordManual.useMutation({
    onSuccess: () => {
      toast.success("تم حفظ سعر السوق اليدوي مع مصدره وتاريخه.");
      setQuotePrice("");
      void utils.family.portfolio.list.invalidate();
      void utils.family.dashboard.invalidate();
    },
    onError: (error) => toast.error(errorText(error)),
  });

  const trade = trpc.family.ledger.trade.useMutation({
    onSuccess: () => {
      toast.success("تم نشر الصفقة وتحديث الحيازة ومتوسط التكلفة وسجلات FIFO في معاملة واحدة.");
      setQuantity("");
      setUnitPrice("");
      setFeeAmount("");
      setTaxAmount("");
      setMemo("");
      setConfirmTradeOpen(false);
      void utils.family.dashboard.invalidate();
      void utils.family.accounts.list.invalidate();
      void utils.family.ledger.recent.invalidate();
      void utils.family.portfolio.list.invalidate();
      void utils.family.lots.list.invalidate();
      void utils.family.realizedPnl.summary.invalidate();
      void utils.family.realizedPnl.list.invalidate();
    },
    onError: (error) => {
      setConfirmTradeOpen(false);
      toast.error(errorText(error));
    },
  });

  const holdings = portfolio.data ?? [];
  const valuedHoldings = holdings.filter((item) => item.marketValue !== null && item.marketValue !== undefined);
  const needsQuote = holdings.filter((item) => item.quoteStatus === "unavailable");

  const submitInstrument = (event: React.FormEvent) => {
    event.preventDefault();
    createInstrument.mutate({ name, symbol: symbol || null, currency, assetType, isin: null });
  };

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

  return (
    <DashboardLayout>
      <main className="mx-auto max-w-7xl space-y-6" dir="rtl">
        <PageHeader
          title="الاستثمارات والحيازات"
          description="بوابة الاستثمار الموحدة: الحيازات الفعلية، الأدوات الاستثمارية، تنفيذ الصفقات، مؤشرات الأداء، الأرباح المحققة، وحزم FIFO المحاسبية."
          icon={BriefcaseBusiness}
          breadcrumbs={[
            { label: "الثروة والأصول", href: "/accounts" },
            { label: "الاستثمارات والحيازات" },
          ]}
          badge="حيازات وأسهم مدققة"
          actions={
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => setActiveTab("trades")}>
                <Plus className="ml-1 size-4" />
                تسجيل صفقة
              </Button>
              <Button variant="outline" size="sm" onClick={() => setLocation("/performance")}>
                <BarChart3 className="ml-1 size-4" />
                عزو العوائد الكامل
              </Button>
              <Button size="sm" onClick={() => setLocation("/risk")}>
                مراجعة التوزيع
              </Button>
            </div>
          }
        />

        {/* Overview Metric Cards */}
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="fintech-surface-card">
            <CardHeader className="pb-3">
              <CardDescription>الحيازات المنشورة</CardDescription>
              <CardTitle className="text-3xl">{portfolio.isLoading ? "—" : holdings.length}</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">مراكز فعلية نشأت من صفقات دفتر الأستاذ.</CardContent>
          </Card>
          <Card className="fintech-surface-card">
            <CardHeader className="pb-3">
              <CardDescription>حيازات بسعر موثق</CardDescription>
              <CardTitle className="text-3xl text-emerald-700">{portfolio.isLoading ? "—" : valuedHoldings.length}</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">تدخل القيمة فقط عند توثيق سعر سوق مؤرخ.</CardContent>
          </Card>
          <Card className="fintech-surface-card">
            <CardHeader className="pb-3">
              <CardDescription>تتطلب سعر سوق</CardDescription>
              <CardTitle className="text-3xl text-amber-700">{portfolio.isLoading ? "—" : needsQuote.length}</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">حيازات كميتها موجبة وبانتظار تسجيل السعر.</CardContent>
          </Card>
          <Card className="fintech-surface-card">
            <CardHeader className="pb-3">
              <CardDescription>إجمالي الربح المحقق (FIFO)</CardDescription>
              <CardTitle className={`text-2xl font-bold ${Number(realizedSummary.data?.realizedPnl || 0) >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                <SensitiveValue>
                  {realizedSummary.data ? formatMoney(realizedSummary.data.realizedPnl, baseCurrency, 2) : "—"}
                </SensitiveValue>
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">ناتج مطابقات بيع FIFO التاريخية المكتملة.</CardContent>
          </Card>
        </section>

        {/* 6 Unified Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-5">
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-3 lg:grid-cols-6 h-auto p-1 gap-1">
            <TabsTrigger value="holdings" className="py-2.5">الحيازات</TabsTrigger>
            <TabsTrigger value="instruments" className="py-2.5">الأدوات</TabsTrigger>
            <TabsTrigger value="trades" className="py-2.5">الصفقات والتداول</TabsTrigger>
            <TabsTrigger value="performance" className="py-2.5">ملخص الأداء</TabsTrigger>
            <TabsTrigger value="realized" className="py-2.5">الأرباح المحققة</TabsTrigger>
            <TabsTrigger value="lots" className="py-2.5">حزم FIFO</TabsTrigger>
          </TabsList>

          {/* TAB 1: Holdings */}
          <TabsContent value="holdings">
            <Card className="fintech-surface-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="size-5 text-primary" />
                  الحيازات الفعلية
                </CardTitle>
                <CardDescription>الكمية ومتوسط التكلفة والقيمة تُستمد من الصفقات المنشورة والأسعار الموثقة.</CardDescription>
              </CardHeader>
              <CardContent>
                {portfolio.isLoading ? (
                  <p className="py-12 text-center text-sm text-muted-foreground">جارٍ تحميل الحيازات…</p>
                ) : portfolio.error ? (
                  <p className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">{errorText(portfolio.error)}</p>
                ) : holdings.length ? (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[720px] text-right text-sm">
                      <thead className="bg-slate-50 text-xs text-slate-600">
                        <tr>
                          <th className="p-4">الأداة</th>
                          <th className="p-4">الكمية</th>
                          <th className="p-4">متوسط التكلفة</th>
                          <th className="p-4">القيمة السوقية</th>
                          <th className="p-4">حالة السعر</th>
                          <th className="p-4">إجراء</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {holdings.map((pos) => (
                          <tr key={pos.id}>
                            <td className="p-4">
                              <strong>{pos.instrumentName}</strong>
                              <p className="mt-1 text-xs text-muted-foreground">{pos.symbol || "بدون رمز"} · {pos.currency}</p>
                            </td>
                            <td className="p-4 font-mono font-semibold">{pos.quantity}</td>
                            <td className="p-4">
                              <SensitiveValue>{formatMoney(pos.averageCost, pos.costCurrency, 2)}</SensitiveValue>
                            </td>
                            <td className="p-4 font-semibold">
                              <SensitiveValue>{pos.marketValue ? formatMoney(pos.marketValue, pos.currency, 2) : "—"}</SensitiveValue>
                            </td>
                            <td className="p-4">
                              <Badge variant={pos.quoteStatus === "unavailable" ? "outline" : "secondary"}>
                                {pos.quoteStatus === "unavailable" ? "يتطلب سعرًا" : "متاح"}
                              </Badge>
                            </td>
                            <td className="p-4">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setTradeInstrumentId(String(pos.instrumentId));
                                  setSide("sell");
                                  setActiveTab("trades");
                                }}
                              >
                                تداول
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="fintech-empty-state">
                    <BriefcaseBusiness className="fintech-empty-state-icon" />
                    <h3>لا توجد حيازات منشورة</h3>
                    <p>أضف أداة، ثم سجّل صفقة شراء صريحة ليظهر المركز ومتوسط التكلفة في هذه الصفحة.</p>
                    <Button className="mt-4" onClick={() => setActiveTab("trades")}>
                      بدء تسجيل صفقة
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 2: Instruments */}
          <TabsContent value="instruments">
            <section className="grid gap-6 lg:grid-cols-[.8fr_1.2fr]">
              <Card className="fintech-surface-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Plus className="size-5 text-primary" />
                    إضافة أداة استثمارية
                  </CardTitle>
                  <CardDescription>تقتصر إضافة الأدوات وأسعارها على دور المالك أو المستشار.</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={submitInstrument} className="grid gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="instrument-name">الاسم</Label>
                      <Input id="instrument-name" value={name} onChange={(e) => setName(e.target.value)} disabled={!canAdvise} required minLength={2} />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="grid gap-2">
                        <Label htmlFor="instrument-symbol">الرمز (Ticker)</Label>
                        <Input id="instrument-symbol" value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())} disabled={!canAdvise} maxLength={48} placeholder="مثال: GC=F أو AAPL" />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="instrument-currency">العملة</Label>
                        <Input id="instrument-currency" value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} disabled={!canAdvise} minLength={3} maxLength={3} required />
                      </div>
                    </div>
                    <div className="grid gap-2">
                      <Label>الفئة</Label>
                      <Select value={assetType} onValueChange={(val) => setAssetType(val as AssetType)} disabled={!canAdvise}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(assetTypeLabel).map(([val, lbl]) => (
                            <SelectItem key={val} value={val}>{lbl}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button type="submit" disabled={!canAdvise || createInstrument.isPending}>
                      {createInstrument.isPending && <Loader2 className="ml-2 size-4 animate-spin" />}
                      {canAdvise ? "حفظ الأداة" : "تتطلب صلاحية مستشار"}
                    </Button>
                  </form>
                </CardContent>
              </Card>

              <Card className="fintech-surface-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Landmark className="size-5 text-primary" />
                    سجل الأدوات
                  </CardTitle>
                  <CardDescription>وجود الأداة لا يعني وجود حيازة أو قيمة؛ كلاهما يتطلب صفقة وسعرًا موثقًا.</CardDescription>
                </CardHeader>
                <CardContent>
                  {instruments.isLoading ? (
                    <p className="py-12 text-center text-sm text-muted-foreground">جارٍ تحميل الأدوات…</p>
                  ) : instruments.error ? (
                    <p className="flex gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
                      <CircleAlert className="size-4 shrink-0" />
                      {errorText(instruments.error)}
                    </p>
                  ) : instruments.data?.length ? (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[520px] text-right text-sm">
                        <thead className="bg-slate-50 text-xs text-slate-600">
                          <tr>
                            <th className="p-3">الاسم</th>
                            <th className="p-3">الرمز</th>
                            <th className="p-3">الفئة</th>
                            <th className="p-3">العملة</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {instruments.data.map((item) => (
                            <tr key={item.id}>
                              <td className="p-3 font-semibold">{item.name}</td>
                              <td className="p-3 font-mono text-xs">{item.symbol || "—"}</td>
                              <td className="p-3">
                                <Badge variant="outline">{assetTypeLabel[item.assetType as AssetType] || item.assetType}</Badge>
                              </td>
                              <td className="p-3">{item.currency}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="fintech-empty-state">
                      <Landmark className="fintech-empty-state-icon" />
                      <h3>لا توجد أدوات استثمارية</h3>
                      <p>أضف أداة برمزها وبياناتها الأساسية، ثم سجّل سعرًا أو صفقة بصورة صريحة.</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </section>
          </TabsContent>

          {/* TAB 3: Trades & Orders */}
          <TabsContent value="trades">
            <section className="grid gap-6 lg:grid-cols-[1.2fr_.8fr]">
              <Card className="fintech-surface-card">
                <CardHeader>
                  <CardTitle>مراجعة ونشر صفقة شراء أو بيع</CardTitle>
                  <CardDescription>الرسوم والضرائب تُسجل مع القيد المتوازن. لا يتم تعديل أي رصيد خارج دفتر الأستاذ.</CardDescription>
                </CardHeader>
                <CardContent>
                  {accounts.isLoading || instruments.isLoading ? (
                    <p className="py-12 text-center text-sm text-muted-foreground">جارٍ تجهيز نموذج الصفقة…</p>
                  ) : tradeAccounts.length && instruments.data?.length ? (
                    <form onSubmit={submitTrade} className="grid gap-4">
                      <div className="grid gap-3 sm:grid-cols-3">
                        <div className="grid gap-2">
                          <Label>نوع الصفقة</Label>
                          <Select value={side} onValueChange={(v) => setSide(v as "buy" | "sell")}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="buy">شراء</SelectItem>
                              <SelectItem value="sell">بيع</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid gap-2">
                          <Label>حساب التسوية</Label>
                          <Select value={tradeAccountId} onValueChange={setTradeAccountId}>
                            <SelectTrigger><SelectValue placeholder="اختر حسابًا" /></SelectTrigger>
                            <SelectContent>
                              {tradeAccounts.map((acc) => (
                                <SelectItem key={acc.id} value={String(acc.id)}>
                                  {acc.name} — {acc.currency}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid gap-2">
                          <Label>الأداة الاستثمارية</Label>
                          <Select value={tradeInstrumentId} onValueChange={setTradeInstrumentId}>
                            <SelectTrigger><SelectValue placeholder="اختر أداة" /></SelectTrigger>
                            <SelectContent>
                              {instruments.data.map((item) => (
                                <SelectItem key={item.id} value={String(item.id)}>
                                  {item.name} — {item.currency}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="grid gap-2">
                          <Label htmlFor="trade-quantity">الكمية</Label>
                          <Input id="trade-quantity" inputMode="decimal" value={quantity} onChange={(e) => setQuantity(e.target.value)} required />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="trade-price">سعر الوحدة</Label>
                          <Input id="trade-price" inputMode="decimal" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} required />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="trade-fee">الرسوم (اختياري)</Label>
                          <Input id="trade-fee" inputMode="decimal" value={feeAmount} onChange={(e) => setFeeAmount(e.target.value)} placeholder="0" />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="trade-tax">الضرائب (اختياري)</Label>
                          <Input id="trade-tax" inputMode="decimal" value={taxAmount} onChange={(e) => setTaxAmount(e.target.value)} placeholder="0" />
                        </div>
                      </div>

                      <div className="grid gap-2">
                        <Label htmlFor="trade-memo">مذكرة العملية</Label>
                        <Textarea id="trade-memo" value={memo} onChange={(e) => setMemo(e.target.value)} maxLength={2000} placeholder="اختياري" />
                      </div>

                      <Button type="submit" disabled={trade.isPending || !canAdvise}>
                        {trade.isPending && <Loader2 className="ml-2 size-4 animate-spin" />}
                        {canAdvise ? "مراجعة ونشر الصفقة" : "تتطلب صلاحية مستشار"}
                      </Button>
                    </form>
                  ) : (
                    <div className="fintech-empty-state">
                      <Landmark className="fintech-empty-state-icon" />
                      <h3>جهّز الحساب والأداة أولًا</h3>
                      <p>يلزم حساب تسوية نشط وأداة استثمارية قبل تسجيل صفقة فعلية.</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Manual Quote Card */}
              <Card className="fintech-surface-card">
                <CardHeader>
                  <CardTitle>سعر سوق يدوي موثق</CardTitle>
                  <CardDescription>تسجيل سعر للأداة مع طابع زمني دقيق دون الحاجة لمصدر خارجي.</CardDescription>
                </CardHeader>
                <CardContent>
                  {instruments.data?.length ? (
                    <form className="grid gap-4" onSubmit={submitQuote}>
                      <div className="grid gap-2">
                        <Label>الأداة</Label>
                        <Select value={quoteInstrumentId} onValueChange={setQuoteInstrumentId}>
                          <SelectTrigger><SelectValue placeholder="اختر أداة" /></SelectTrigger>
                          <SelectContent>
                            {instruments.data.map((item) => (
                              <SelectItem key={item.id} value={String(item.id)}>
                                {item.name} — {item.currency}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="manual-quote">سعر الوحدة</Label>
                        <Input id="manual-quote" inputMode="decimal" value={quotePrice} onChange={(e) => setQuotePrice(e.target.value)} required />
                      </div>
                      <Button type="submit" variant="outline" disabled={recordQuote.isPending || !canAdvise}>
                        {recordQuote.isPending && <Loader2 className="ml-2 size-4 animate-spin" />}
                        {canAdvise ? "حفظ السعر اليدوي" : "تتطلب صلاحية مستشار"}
                      </Button>
                    </form>
                  ) : (
                    <p className="flex gap-2 rounded-xl bg-muted/50 p-4 text-sm text-muted-foreground">
                      <CircleAlert className="size-4 shrink-0" />
                      أضف أداة استثمارية أولًا قبل تسجيل سعر.
                    </p>
                  )}
                </CardContent>
              </Card>
            </section>
          </TabsContent>

          {/* TAB 4: Performance Summary */}
          <TabsContent value="performance">
            <Card className="fintech-surface-card">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="size-5 text-primary" />
                      ملخص أداء المحفظة الاستثمارية
                    </CardTitle>
                    <CardDescription>مؤشرات الأداء الموزونة بالوقت والتدفقات النقدية من واقع قيود الدفتر.</CardDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setLocation("/performance")}>
                    فتح شاشة الأداء التفصيلية
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="rounded-xl border bg-slate-50 p-4">
                    <p className="text-xs text-slate-500">الحيازات النشطة</p>
                    <p className="mt-1 text-2xl font-bold">{holdings.length}</p>
                    <p className="mt-1 text-xs text-muted-foreground">موزعة على الأدوات المصنفة</p>
                  </div>
                  <div className="rounded-xl border bg-slate-50 p-4">
                    <p className="text-xs text-slate-500">حيازات مقيمة بسعر موثق</p>
                    <p className="mt-1 text-2xl font-bold text-emerald-700">{valuedHoldings.length}</p>
                    <p className="mt-1 text-xs text-muted-foreground">تظهر قيمتها السوقية بدقة</p>
                  </div>
                  <div className="rounded-xl border bg-slate-50 p-4">
                    <p className="text-xs text-slate-500">حزم FIFO النشطة</p>
                    <p className="mt-1 text-2xl font-bold font-mono">
                      {lots.data?.filter((l) => l.status === "open").length ?? 0}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">حزم شراء مفتوحة تتبع أقدمية التكلفة</p>
                  </div>
                </div>

                <div className="rounded-xl border p-4 bg-muted/20 flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold">تحليل عزو العوائد المتقدم (Brinson Allocation & Selection)</p>
                    <p className="text-xs text-muted-foreground">للاطلاع على منحنى العائد المرجح زمنيًا (TWR) وتحليل المخاطر المتقدم.</p>
                  </div>
                  <Button size="sm" onClick={() => setLocation("/performance")}>
                    الانتقال للأداء
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 5: Realized P&L */}
          <TabsContent value="realized">
            <Card className="fintech-surface-card">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <GitCompareArrows className="size-5 text-primary" />
                      الأرباح والخسائر المحققة (FIFO Realized P&L)
                    </CardTitle>
                    <CardDescription>النتائج المحققة الناتجة عن صفقات البيع ومطابقتها بحزم الشراء وفق معيار FIFO.</CardDescription>
                  </div>
                  <Badge variant="outline" className="font-mono">
                    {realizedList.data?.length ?? 0} مطابقة مسجلة
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                {realizedList.isLoading ? (
                  <p className="py-12 text-center text-sm text-muted-foreground">جارٍ تحميل الأرباح المحققة…</p>
                ) : realizedList.data?.length ? (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[700px] text-right text-sm">
                      <thead className="bg-slate-50 text-xs text-slate-600">
                        <tr>
                          <th className="p-3">الأداة</th>
                          <th className="p-3">الكمية المباعة</th>
                          <th className="p-3">سعر البيع</th>
                          <th className="p-3">أساس التكلفة (FIFO)</th>
                          <th className="p-3">الربح/الخسارة المحققة</th>
                          <th className="p-3">تاريخ البيع</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {realizedList.data.map((row) => {
                          const unitPrice = Number(row.quantity) > 0 ? (Number(row.grossProceeds) / Number(row.quantity)).toFixed(2) : "0.00";
                          return (
                            <tr key={row.id}>
                              <td className="p-3 font-semibold">{instrumentMap.get(row.instrumentId) || `#${row.instrumentId}`}</td>
                              <td className="p-3 font-mono">{row.quantity}</td>
                              <td className="p-3">
                                <SensitiveValue>{formatMoney(unitPrice, row.currency, 2)}</SensitiveValue>
                              </td>
                              <td className="p-3">
                                <SensitiveValue>{formatMoney(row.costBasis, row.currency, 2)}</SensitiveValue>
                              </td>
                              <td className={`p-3 font-semibold ${Number(row.realizedPnl) >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                                <SensitiveValue>{formatMoney(row.realizedPnl, row.currency, 2)}</SensitiveValue>
                              </td>
                              <td className="p-3 text-xs text-muted-foreground">
                                {new Date(row.matchedAt).toLocaleDateString("ar-EG")}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="fintech-empty-state">
                    <GitCompareArrows className="fintech-empty-state-icon" />
                    <h3>لا توجد أرباح محققة بعد</h3>
                    <p>تنشأ الأرباح أو الخسائر المحققة عند تنفيذ صفقات بيع على حيازات مشتراة سابقًا ومطابقتها بحزم FIFO.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 6: FIFO Lots */}
          <TabsContent value="lots">
            <Card className="fintech-surface-card">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Layers className="size-5 text-primary" />
                      سجل حزم الاستثمار (FIFO Lots)
                    </CardTitle>
                    <CardDescription>كل صفقة شراء تنشئ حزمة منفصلة تسجل الكمية الأصلية والمتبقية وتكلفة الوحدة.</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={rebuildReport.data?.status === "matched" ? "secondary" : "outline"} className="gap-1">
                      <ShieldCheck className="size-3.5" />
                      <span>{rebuildReport.data?.status === "matched" ? "تطابق كامل في إعادة البناء" : "جاهز للتدقيق"}</span>
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {lots.isLoading ? (
                  <p className="py-12 text-center text-sm text-muted-foreground">جارٍ تحميل الحزم…</p>
                ) : lots.data?.length ? (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[700px] text-right text-sm">
                      <thead className="bg-slate-50 text-xs text-slate-600">
                        <tr>
                          <th className="p-3">الأداة</th>
                          <th className="p-3">الكمية الأصلية</th>
                          <th className="p-3">الكمية المتبقية</th>
                          <th className="p-3">تكلفة الوحدة</th>
                          <th className="p-3">تاريخ الشراء</th>
                          <th className="p-3">الحالة</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {lots.data.map((lot) => (
                          <tr key={lot.id}>
                            <td className="p-3 font-semibold">{instrumentMap.get(lot.instrumentId) || `#${lot.instrumentId}`}</td>
                            <td className="p-3 font-mono">{lot.originalQuantity}</td>
                            <td className="p-3 font-mono font-bold">{lot.remainingQuantity}</td>
                            <td className="p-3">
                              <SensitiveValue>{formatMoney(lot.unitCost, lot.costCurrency, 2)}</SensitiveValue>
                            </td>
                            <td className="p-3 text-xs text-muted-foreground">
                              {new Date(lot.acquiredAt).toLocaleDateString("ar-EG")}
                            </td>
                            <td className="p-3">
                              <Badge variant={lot.status === "open" ? "secondary" : "outline"}>
                                {lot.status === "open" ? "مفتوحة" : "مغلقة"}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="fintech-empty-state">
                    <Layers className="fintech-empty-state-icon" />
                    <h3>لا توجد حزم FIFO بعد</h3>
                    <p>تنشأ الحزم تلقائيًا عند تسجيل صفقات شراء أدوات استثمارية في الدفتر.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Confirmation Dialog for Trades */}
        <ConfirmDialog
          open={confirmTradeOpen}
          onOpenChange={setConfirmTradeOpen}
          title={`تأكيد نشر صفقة ${side === "buy" ? "شراء" : "بيع"}`}
          description={`أنت على وشك نشر صفقة ${side === "buy" ? "شراء" : "بيع"} لـ ${quantity} وحدة من أداة "${selectedInstrument?.name}" عبر حساب "${selectedAccount?.name}". سيتم قيد العملية في دفتر الأستاذ وتحديث متوسط التكلفة والحيازات وحزم FIFO.`}
          confirmText={`تأكيد نشر صفقة الـ ${side === "buy" ? "شراء" : "بيع"}`}
          cancelText="إلغاء والعودة"
          isLoading={trade.isPending}
          onConfirm={executeConfirmedTrade}
        />
      </main>
    </DashboardLayout>
  );
}
