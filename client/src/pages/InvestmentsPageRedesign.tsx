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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  BriefcaseBusiness,
  CircleAlert,
  CircleDollarSign,
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
  Pencil,
  Trash2,
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

const subCategoriesByAssetType: Record<AssetType, Array<{ value: string; label: string }>> = {
  fund: [
    { value: "MONEY_MARKET_FUND", label: "صندوق نقد يومي (سيولة)" },
    { value: "EQUITY_FUND", label: "صندوق أسهم" },
    { value: "GOLD_FUND", label: "صندوق ذهب (مثل AZG)" },
    { value: "BALANCED_FUND", label: "صندوق متوازن" },
    { value: "REAL_ESTATE_FUND", label: "صندوق استثمار عقاري" },
    { value: "OTHER", label: "صندوق آخر" },
  ],
  equity: [
    { value: "DIRECT_EQUITY", label: "أسهم مدرجة مباشرة (EGX)" },
    { value: "OTHER", label: "أخرى" },
  ],
  gold: [
    { value: "PHYSICAL_GOLD", label: "ذهب عيني / كسر" },
    { value: "GOLD_BARS", label: "سبائك معتمدة (عيار 24)" },
    { value: "GOLD_COINS", label: "جنيهات ذهب (عيار 21)" },
    { value: "OTHER", label: "أخرى" },
  ],
  real_estate: [
    { value: "RESIDENTIAL_REAL_ESTATE", label: "عقار سكني" },
    { value: "COMMERCIAL_REAL_ESTATE", label: "عقار تجاري / إداري" },
    { value: "OTHER", label: "أخرى" },
  ],
  bond: [
    { value: "GOVERNMENT_BOND", label: "سندات حكومية وأذون خزانة" },
    { value: "CORPORATE_BOND", label: "سندات توريق وشركات" },
    { value: "OTHER", label: "أخرى" },
  ],
  cash_equivalent: [
    { value: "TREASURY_BILLS", label: "أذون خزانة قصيرة الأجل" },
    { value: "CERTIFICATE_OF_DEPOSIT", label: "شهادات ادخار بنكية" },
    { value: "OTHER", label: "أخرى" },
  ],
  other: [
    { value: "OTHER", label: "عام / غير مصنف" },
  ],
};

const egxSectors = [
  { value: "Financial Services & Banks", label: "البنوك والخدمات المالية غير المصرفية" },
  { value: "Real Estate & Development", label: "العقارات والتطوير العقاري" },
  { value: "Healthcare & Pharma", label: "الرعاية الصحية والأدوية" },
  { value: "Construction & Building Materials", label: "البناء ومواد التشييد" },
  { value: "Food & Beverage", label: "الأغذية والمشروبات والتبغ" },
  { value: "Telecom & Tech", label: "الاتصالات والإعلام والتكنولوجيا" },
  { value: "Industrial & Textiles", label: "الصناعة والسلع المعمرة والمنسوجات" },
  { value: "Energy & Basic Materials", label: "الموارد الأساسية والبتروكيماويات" },
  { value: "Tourism & Entertainment", label: "السياحة والترفيه" },
  { value: "OTHER", label: "قطاع آخر / غير مصنف" },
];

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
  const recentTrades = trpc.family.investments.transactions.useQuery({ limit: 50 });

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
  const [subCategory, setSubCategory] = useState("DIRECT_EQUITY");
  const [sector, setSector] = useState("Financial Services & Banks");

  const showSector = assetType === "equity" || (assetType === "fund" && subCategory === "EQUITY_FUND");

  const handleAssetTypeChange = (newType: AssetType) => {
    setAssetType(newType);
    const available = subCategoriesByAssetType[newType] || [];
    setSubCategory(available.length > 0 ? available[0].value : "OTHER");
  };

  // Instrument Edit & Delete State
  const [editInstrumentModalOpen, setEditInstrumentModalOpen] = useState(false);
  const [deleteInstrumentModalOpen, setDeleteInstrumentModalOpen] = useState(false);
  const [selectedInstrumentForAction, setSelectedInstrumentForAction] = useState<any | null>(null);

  const [editName, setEditName] = useState("");
  const [editSymbol, setEditSymbol] = useState("");
  const [editAssetType, setEditAssetType] = useState<AssetType>("equity");
  const [editSubCategory, setEditSubCategory] = useState("DIRECT_EQUITY");
  const [editSector, setEditSector] = useState("Financial Services & Banks");

  const handleOpenEditInstrument = (inst: any) => {
    setSelectedInstrumentForAction(inst);
    setEditName(inst.name || "");
    setEditSymbol(inst.symbol || "");
    const aType = (inst.assetType || "equity") as AssetType;
    setEditAssetType(aType);
    setEditSubCategory(inst.subCategory || "");
    setEditSector(inst.sector || "");
    setEditInstrumentModalOpen(true);
  };

  const handleOpenDeleteInstrument = (inst: any) => {
    setSelectedInstrumentForAction(inst);
    setDeleteInstrumentModalOpen(true);
  };

  // Trade Record State
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [tradeAccountId, setTradeAccountId] = useState("");
  const [tradeInstrumentId, setTradeInstrumentId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [feeAmount, setFeeAmount] = useState("");
  const [taxAmount, setTaxAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [confirmTradeOpen, setConfirmTradeOpen] = useState(false);

  // Trade Edit & Delete State
  const [editTradeModalOpen, setEditTradeModalOpen] = useState(false);
  const [deleteTradeModalOpen, setDeleteTradeModalOpen] = useState(false);
  const [selectedTradeForAction, setSelectedTradeForAction] = useState<any | null>(null);

  const [editTradeDate, setEditTradeDate] = useState("");
  const [editTradeQuantity, setEditTradeQuantity] = useState("");
  const [editTradeUnitPrice, setEditTradeUnitPrice] = useState("");
  const [editTradeAccountId, setEditTradeAccountId] = useState("");
  const [editTradeFeeAmount, setEditTradeFeeAmount] = useState("");
  const [editTradeTaxAmount, setEditTradeTaxAmount] = useState("");
  const [editTradeMemo, setEditTradeMemo] = useState("");

  const handleOpenEditTrade = (trItem: any) => {
    setSelectedTradeForAction(trItem);
    const dateObj = new Date(trItem.occurredAt);
    const localIso = new Date(dateObj.getTime() - dateObj.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    setEditTradeDate(localIso);
    setEditTradeQuantity(trItem.quantity ? String(trItem.quantity) : "");
    setEditTradeUnitPrice(trItem.unitPrice ? String(trItem.unitPrice) : "");
    setEditTradeAccountId(trItem.primaryAccountId ? String(trItem.primaryAccountId) : "");
    setEditTradeFeeAmount(trItem.feeAmount ? String(trItem.feeAmount) : "");
    setEditTradeTaxAmount(trItem.taxAmount ? String(trItem.taxAmount) : "");
    setEditTradeMemo(trItem.memo || "");
    setEditTradeModalOpen(true);
  };

  const handleOpenDeleteTrade = (trItem: any) => {
    setSelectedTradeForAction(trItem);
    setDeleteTradeModalOpen(true);
  };

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
      setSubCategory("DIRECT_EQUITY");
      setSector("Financial Services & Banks");
      void utils.family.instruments.list.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "فشل حفظ الأداة الاستثمارية.");
    },
  });

  const updateInstrumentMutation = trpc.family.instruments.update.useMutation({
    onSuccess: () => {
      toast.success("تم تعديل الأداة الاستثمارية بنجاح.");
      setEditInstrumentModalOpen(false);
      void utils.family.instruments.list.invalidate();
      void utils.family.portfolio.list.invalidate();
    },
    onError: (error) => toast.error(errorText(error)),
  });

  const deleteInstrumentMutation = trpc.family.instruments.delete.useMutation({
    onSuccess: () => {
      toast.success("تم حذف الأداة الاستثمارية بنجاح.");
      setDeleteInstrumentModalOpen(false);
      void utils.family.instruments.list.invalidate();
      void utils.family.portfolio.list.invalidate();
    },
    onError: (error) => {
      setDeleteInstrumentModalOpen(false);
      toast.error(error.message || "فشل حذف الأداة الاستثمارية.");
    },
  });

  const updateTradeMutation = trpc.family.investments.updateTransaction.useMutation({
    onSuccess: () => {
      toast.success("تم تعديل الصفقة وعكس القيود السابقة في دفتر الأستاذ بنجاح.");
      setEditTradeModalOpen(false);
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
      setDeleteTradeModalOpen(false);
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
      setDeleteTradeModalOpen(false);
      toast.error(errorText(error));
    },
  });

  const handleSaveEditInstrument = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInstrumentForAction) return;
    updateInstrumentMutation.mutate({
      id: selectedInstrumentForAction.id,
      name: editName,
      symbol: editSymbol.trim() ? editSymbol.trim() : null,
      assetType: editAssetType,
      subCategory: editSubCategory.trim() ? editSubCategory.trim() : null,
      sector: editSector.trim() ? editSector.trim() : null,
    });
  };

  const handleConfirmDeleteInstrument = () => {
    if (!selectedInstrumentForAction) return;
    deleteInstrumentMutation.mutate({ id: selectedInstrumentForAction.id });
  };

  const handleSaveEditTrade = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTradeForAction) return;
    const occurredAtMs = editTradeDate ? new Date(editTradeDate).getTime() : selectedTradeForAction.occurredAt;
    updateTradeMutation.mutate({
      id: selectedTradeForAction.id,
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
    if (!selectedTradeForAction) return;
    deleteTradeMutation.mutate({ id: selectedTradeForAction.id });
  };

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
      void utils.family.investments.transactions.invalidate();
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

  const totalMarketValue = useMemo(() => {
    return holdings.reduce((sum, pos) => {
      const val = Number(pos.baseMarketValue ?? (pos.currency === baseCurrency ? pos.marketValue : 0) ?? 0);
      return sum + (isNaN(val) ? 0 : val);
    }, 0);
  }, [holdings, baseCurrency]);

  const submitInstrument = (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) {
      return toast.error("يرجى إدخال اسم الأداة الاستثمارية.");
    }
    createInstrument.mutate({
      name: name.trim(),
      symbol: symbol.trim() || null,
      currency: currency.trim() || "EGP",
      assetType,
      subCategory: subCategory || null,
      sector: showSector ? sector : null,
      isin: null,
    });
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
          title="الاستثمارات والمحافظ"
          description="بوابة الاستثمار الموحدة: الأصول الاستثمارية والمراكز، الأدوات، تنفيذ الصفقات، مؤشرات الأداء، الأرباح المحققة، وحزم FIFO المحاسبية."
          icon={BriefcaseBusiness}
          breadcrumbs={[
            { label: "الثروة والأصول", href: "/investments" },
            { label: "الاستثمارات والمحافظ" },
          ]}
          badge={{ text: "محافظ وأصول استثمارية مدققة", variant: "institutional" }}
          actions={
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                onClick={() => setActiveTab("trades")}
                className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-sm transition-all border border-slate-900 dark:bg-white dark:hover:bg-slate-100 dark:text-slate-950 dark:border-transparent flex items-center gap-1.5"
              >
                <Plus className="size-3.5" />
                + تسجيل صفقة
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setLocation("/performance")}
                className="bg-white hover:bg-slate-50 text-slate-800 font-semibold text-xs px-4 py-2.5 rounded-xl border border-slate-200/90 shadow-2xs dark:bg-slate-800/60 dark:hover:bg-slate-800 dark:text-slate-200 dark:border-slate-700/60 transition-all flex items-center gap-1.5"
              >
                <BarChart3 className="size-3.5" />
                تحليل عوائد المحفظة
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setLocation("/risk")}
                className="bg-white hover:bg-slate-50 text-slate-800 font-semibold text-xs px-4 py-2.5 rounded-xl border border-slate-200/90 shadow-2xs dark:bg-slate-800/60 dark:hover:bg-slate-800 dark:text-slate-200 dark:border-slate-700/60 transition-all flex items-center gap-1.5"
              >
                <GitCompareArrows className="size-3.5" />
                مراجعة التوزيع
              </Button>
            </div>
          }
        />

        {/* Executive Metric Strip */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 bg-white dark:bg-[#0B0F17] border border-slate-200/90 dark:border-slate-800/80 rounded-2xl shadow-xs overflow-hidden mb-6">
          {/* Cell 1: القيمة السوقية الإجمالية */}
          <div className="lg:col-span-2 bg-slate-50/50 dark:bg-slate-900/30 p-5 flex flex-col justify-between border-b sm:border-b-0 lg:border-b-0 lg:border-l border-slate-200/80 dark:border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-slate-600 dark:text-slate-400 font-semibold text-xs flex items-center gap-2">
                القيمة السوقية الإجمالية
              </span>
              <div className="size-8 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/60 flex items-center justify-center">
                <CircleDollarSign className="size-4" />
              </div>
            </div>
            <div className="mt-1">
              <strong className="text-slate-900 dark:text-white font-extrabold font-mono text-xl sm:text-2xl lg:text-3xl tabular-nums tracking-tight whitespace-nowrap block">
                <SensitiveValue>
                  {portfolio.isLoading ? "—" : formatMoney(totalMarketValue, baseCurrency, 2)}
                </SensitiveValue>
              </strong>
            </div>
            <span className="text-slate-400 dark:text-slate-500 text-[11px] mt-1 font-medium block">
              إجمالي تقييم الأصول والأسهم بالسعر الحالي
            </span>
          </div>

          {/* Cell 2: إجمالي الأصول النشطة */}
          <div className="lg:col-span-1 p-5 flex flex-col justify-between border-b sm:border-b-0 lg:border-b-0 lg:border-l border-slate-200/80 dark:border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-slate-600 dark:text-slate-400 font-semibold text-xs flex items-center gap-2">
                إجمالي الأصول النشطة
              </span>
              <div className="size-8 rounded-xl bg-sky-50 text-sky-600 border border-sky-200/80 dark:bg-sky-950/40 dark:text-sky-400 dark:border-sky-800/60 flex items-center justify-center">
                <BriefcaseBusiness className="size-4" />
              </div>
            </div>
            <div className="mt-1">
              <strong className="text-slate-900 dark:text-white font-bold font-mono text-xl sm:text-2xl tabular-nums block">
                {portfolio.isLoading ? "—" : holdings.length}
              </strong>
            </div>
            <span className="text-slate-400 dark:text-slate-500 text-[11px] mt-1 font-medium block">
              المراكز المفتوحة داخل المحفظة
            </span>
          </div>

          {/* Cell 3: أصول مقيّمة بالسوق */}
          <div className="lg:col-span-1 p-5 flex flex-col justify-between border-b sm:border-b-0 lg:border-b-0 lg:border-l border-slate-200/80 dark:border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-slate-600 dark:text-slate-400 font-semibold text-xs flex items-center gap-2">
                أصول مقيّمة بالسوق
              </span>
              <div className="size-8 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-200/80 dark:bg-indigo-950/40 dark:text-indigo-400 dark:border-indigo-800/60 flex items-center justify-center">
                <CheckCircle2 className="size-4" />
              </div>
            </div>
            <div className="mt-1">
              <strong className="text-slate-900 dark:text-white font-bold font-mono text-xl sm:text-2xl tabular-nums block">
                {portfolio.isLoading ? "—" : valuedHoldings.length}
              </strong>
            </div>
            <span className="text-slate-400 dark:text-slate-500 text-[11px] mt-1 font-medium block">
              أصول محدثة بآخر سعر إغلاق
            </span>
          </div>

          {/* Cell 4: بانتظار التسعير */}
          <div className="lg:col-span-1 p-5 flex flex-col justify-between border-b-0 lg:border-l-0">
            <div className="flex items-center justify-between">
              <span className="text-slate-600 dark:text-slate-400 font-semibold text-xs flex items-center gap-2">
                بانتظار التسعير
              </span>
              <div className="size-8 rounded-xl bg-amber-50 text-amber-600 border border-amber-200/80 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800/60 flex items-center justify-center">
                <Clock className="size-4" />
              </div>
            </div>
            <div className="mt-1">
              <strong className="text-slate-900 dark:text-white font-bold font-mono text-xl sm:text-2xl tabular-nums block">
                {portfolio.isLoading ? "—" : needsQuote.length}
              </strong>
            </div>
            <span className="text-slate-400 dark:text-slate-500 text-[11px] mt-1 font-medium block">
              أصول تحتاج تحديث سعر السوق
            </span>
          </div>
        </section>

        {/* 6 Unified Tabs with Bank-Grade Segmented Control */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-slate-100/90 dark:bg-[#0E1420] p-1.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 flex flex-wrap gap-1 mb-6 h-auto w-full justify-start">
            <TabsTrigger value="holdings" className="data-[state=active]:bg-white data-[state=active]:dark:bg-[#1A2234] data-[state=active]:text-slate-900 data-[state=active]:dark:text-white data-[state=active]:font-bold data-[state=active]:shadow-xs data-[state=active]:border-slate-200/60 data-[state=active]:dark:border-slate-700/60 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-medium text-xs px-4 py-2 rounded-xl transition-colors border border-transparent shadow-none">
              الأصول الاستثمارية
            </TabsTrigger>
            <TabsTrigger value="instruments" className="data-[state=active]:bg-white data-[state=active]:dark:bg-[#1A2234] data-[state=active]:text-slate-900 data-[state=active]:dark:text-white data-[state=active]:font-bold data-[state=active]:shadow-xs data-[state=active]:border-slate-200/60 data-[state=active]:dark:border-slate-700/60 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-medium text-xs px-4 py-2 rounded-xl transition-colors border border-transparent shadow-none">
              الأدوات
            </TabsTrigger>
            <TabsTrigger value="trades" className="data-[state=active]:bg-white data-[state=active]:dark:bg-[#1A2234] data-[state=active]:text-slate-900 data-[state=active]:dark:text-white data-[state=active]:font-bold data-[state=active]:shadow-xs data-[state=active]:border-slate-200/60 data-[state=active]:dark:border-slate-700/60 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-medium text-xs px-4 py-2 rounded-xl transition-colors border border-transparent shadow-none">
              تسجيل الصفقات
            </TabsTrigger>
            <TabsTrigger value="performance" className="data-[state=active]:bg-white data-[state=active]:dark:bg-[#1A2234] data-[state=active]:text-slate-900 data-[state=active]:dark:text-white data-[state=active]:font-bold data-[state=active]:shadow-xs data-[state=active]:border-slate-200/60 data-[state=active]:dark:border-slate-700/60 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-medium text-xs px-4 py-2 rounded-xl transition-colors border border-transparent shadow-none">
              ملخص الأداء
            </TabsTrigger>
            <TabsTrigger value="realized" className="data-[state=active]:bg-white data-[state=active]:dark:bg-[#1A2234] data-[state=active]:text-slate-900 data-[state=active]:dark:text-white data-[state=active]:font-bold data-[state=active]:shadow-xs data-[state=active]:border-slate-200/60 data-[state=active]:dark:border-slate-700/60 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-medium text-xs px-4 py-2 rounded-xl transition-colors border border-transparent shadow-none">
              الأرباح المحققة
            </TabsTrigger>
            <TabsTrigger value="lots" className="data-[state=active]:bg-white data-[state=active]:dark:bg-[#1A2234] data-[state=active]:text-slate-900 data-[state=active]:dark:text-white data-[state=active]:font-bold data-[state=active]:shadow-xs data-[state=active]:border-slate-200/60 data-[state=active]:dark:border-slate-700/60 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-medium text-xs px-4 py-2 rounded-xl transition-colors border border-transparent shadow-none">
              حزم FIFO
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: Holdings */}
          <TabsContent value="holdings">
            {portfolio.isLoading ? (
              <div className="bg-white dark:bg-[#0B0F17] border border-slate-200/90 dark:border-slate-800/80 rounded-2xl p-12 text-center shadow-xs">
                <p className="text-sm text-slate-500 dark:text-slate-400">جارٍ تحميل الأصول الاستثمارية…</p>
              </div>
            ) : portfolio.error ? (
              <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-6 text-sm text-destructive">
                {errorText(portfolio.error)}
              </div>
            ) : holdings.length ? (
              <div className="bg-white dark:bg-[#0B0F17] border border-slate-200/90 dark:border-slate-800/80 rounded-2xl shadow-xs overflow-hidden">
                <div className="p-5 sm:p-6 border-b border-slate-100 dark:border-slate-800/80">
                  <h2 className="text-slate-900 dark:text-white font-bold text-base flex items-center gap-2">
                    <TrendingUp className="size-5 text-sky-600 dark:text-sky-400" />
                    الأصول الاستثمارية والمراكز
                  </h2>
                  <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">
                    الكمية ومتوسط التكلفة والقيمة تُستمد من الصفقات المعتمدة والأسعار الموثقة بالسوق.
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] text-right text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800">
                        <th className="bg-slate-100/80 dark:bg-[#0E1420] text-slate-800 dark:text-slate-200 font-bold text-xs py-3.5 px-4 text-right">الأداة</th>
                        <th className="bg-slate-100/80 dark:bg-[#0E1420] text-slate-800 dark:text-slate-200 font-bold text-xs py-3.5 px-4 text-right">الكمية</th>
                        <th className="bg-slate-100/80 dark:bg-[#0E1420] text-slate-800 dark:text-slate-200 font-bold text-xs py-3.5 px-4 text-right">متوسط التكلفة</th>
                        <th className="bg-slate-100/80 dark:bg-[#0E1420] text-slate-800 dark:text-slate-200 font-bold text-xs py-3.5 px-4 text-right">القيمة السوقية</th>
                        <th className="bg-slate-100/80 dark:bg-[#0E1420] text-slate-800 dark:text-slate-200 font-bold text-xs py-3.5 px-4 text-right">حالة السعر</th>
                        <th className="bg-slate-100/80 dark:bg-[#0E1420] text-slate-800 dark:text-slate-200 font-bold text-xs py-3.5 px-4 text-right">إجراء</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                      {holdings.map((pos) => (
                        <tr key={pos.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors">
                          <td className="py-3.5 px-4">
                            <strong className="text-slate-900 dark:text-slate-100 font-bold text-sm block">{pos.instrumentName}</strong>
                            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 font-mono">{pos.symbol || "بدون رمز"} · {pos.currency}</p>
                          </td>
                          <td className="py-3.5 px-4 font-mono font-bold text-slate-900 dark:text-white tabular-nums">{pos.quantity}</td>
                          <td className="py-3.5 px-4 font-mono text-slate-900 dark:text-white tabular-nums">
                            <SensitiveValue>{formatMoney(pos.averageCost, pos.costCurrency, 2)}</SensitiveValue>
                          </td>
                          <td className="py-3.5 px-4 font-mono font-bold text-slate-900 dark:text-white tabular-nums">
                            <SensitiveValue>{pos.marketValue ? formatMoney(pos.marketValue, pos.currency, 2) : "—"}</SensitiveValue>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${
                              pos.quoteStatus === "unavailable"
                                ? "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200/60 dark:border-amber-800/40"
                                : "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200/60 dark:border-emerald-800/40"
                            }`}>
                              {pos.quoteStatus === "unavailable" ? "يتطلب سعرًا" : "متاح"}
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setTradeInstrumentId(String(pos.instrumentId));
                                setSide("sell");
                                setActiveTab("trades");
                              }}
                              className="bg-white hover:bg-slate-50 text-slate-800 font-semibold text-xs px-3 py-1.5 rounded-lg border border-slate-200/90 shadow-2xs dark:bg-slate-800/60 dark:hover:bg-slate-800 dark:text-slate-200 dark:border-slate-700/60 transition-all"
                            >
                              تداول
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="bg-white dark:bg-[#0B0F17] border border-slate-200/90 dark:border-slate-800/80 rounded-2xl p-8 text-center shadow-xs">
                <div className="flex size-12 items-center justify-center rounded-2xl border bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/20 dark:border-slate-700/60 mx-auto mb-3">
                  <BriefcaseBusiness className="size-6" />
                </div>
                <h3 className="text-slate-900 dark:text-white font-bold text-base mb-1">
                  لا توجد أصول استثمارية مسجلة حالياً
                </h3>
                <p className="text-slate-600 dark:text-slate-400 text-xs max-w-md mx-auto mb-5">
                  ابدأ بتسجيل أول صفقة شراء أو إضافة أداة مالية لبناء محفظتك الاستثمارية.
                </p>
                <Button
                  size="sm"
                  onClick={() => setActiveTab("trades")}
                  className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-sm transition-all border border-slate-900 dark:bg-white dark:hover:bg-slate-100 dark:text-slate-950 dark:border-transparent inline-flex items-center gap-1.5"
                >
                  <Plus className="size-3.5" />
                  بدء تسجيل صفقة
                </Button>
              </div>
            )}
          </TabsContent>

          {/* TAB 2: Instruments */}
          <TabsContent value="instruments">
            <section className="grid gap-6 lg:grid-cols-[.8fr_1.2fr]">
              <Card className="bg-white dark:bg-[#0B0F17] border border-slate-200/90 dark:border-slate-800/80 rounded-2xl shadow-xs overflow-hidden">
                <CardHeader className="border-b border-slate-100 dark:border-slate-800/80 p-5">
                  <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-white font-bold text-base">
                    <Plus className="size-5 text-sky-600 dark:text-sky-400" />
                    إضافة أداة استثمارية
                  </CardTitle>
                  <CardDescription className="text-slate-500 dark:text-slate-400 text-xs mt-1">تقتصر إضافة الأدوات وأسعارها على دور المالك أو المستشار.</CardDescription>
                </CardHeader>
                <CardContent className="p-5">
                  <form onSubmit={submitInstrument} className="grid gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="instrument-name" className="text-slate-700 dark:text-slate-300 font-semibold text-xs">الاسم</Label>
                      <Input
                        id="instrument-name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        disabled={!canAdvise}
                        required
                        minLength={2}
                        placeholder="اسم الأداة الاستثمارية"
                        className="bg-white dark:bg-[#0E1420] border border-slate-300 dark:border-slate-700/80 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-slate-800 focus:ring-1 focus:ring-slate-800 rounded-xl font-medium text-sm py-2.5 px-3 h-auto"
                      />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="grid gap-2">
                        <Label htmlFor="instrument-symbol" className="text-slate-700 dark:text-slate-300 font-semibold text-xs">الرمز (Ticker)</Label>
                        <Input
                          id="instrument-symbol"
                          value={symbol}
                          onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                          disabled={!canAdvise}
                          maxLength={48}
                          placeholder="مثال: GC=F أو AAPL"
                          className="bg-white dark:bg-[#0E1420] border border-slate-300 dark:border-slate-700/80 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-slate-800 focus:ring-1 focus:ring-slate-800 rounded-xl font-medium text-sm py-2.5 px-3 h-auto uppercase font-mono"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="instrument-currency" className="text-slate-700 dark:text-slate-300 font-semibold text-xs">العملة</Label>
                        <Input
                          id="instrument-currency"
                          value={currency}
                          onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                          disabled={!canAdvise}
                          minLength={3}
                          maxLength={3}
                          required
                          placeholder="SAR"
                          className="bg-white dark:bg-[#0E1420] border border-slate-300 dark:border-slate-700/80 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-slate-800 focus:ring-1 focus:ring-slate-800 rounded-xl font-medium text-sm py-2.5 px-3 h-auto uppercase font-mono"
                        />
                      </div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="grid gap-2">
                        <Label className="text-slate-800 dark:text-slate-200 font-bold text-xs">الفئة الرئيسية (Asset Class)</Label>
                        <Select value={assetType} onValueChange={(val) => handleAssetTypeChange(val as AssetType)} disabled={!canEdit}>
                          <SelectTrigger className="w-full bg-white dark:bg-[#0E1420] border border-slate-300 dark:border-slate-700/80 text-slate-900 dark:text-slate-100 focus:border-slate-800 focus:ring-1 focus:ring-slate-800 rounded-xl font-medium text-sm py-2.5 px-3 h-auto">
                            <SelectValue placeholder="اختر الفئة" />
                          </SelectTrigger>
                          <SelectContent className="bg-white dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-800">
                            {Object.entries(assetTypeLabel).map(([val, lbl]) => (
                              <SelectItem key={val} value={val}>{lbl}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="grid gap-2">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="instrument-subcategory" className="text-slate-800 dark:text-slate-200 font-bold text-xs">التصنيف الفرعي (Sub-Category)</Label>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400">اختر أو اكتب بحرية</span>
                        </div>
                        <Input
                          id="instrument-subcategory"
                          list="add-subcategories-list"
                          value={subCategory}
                          onChange={(e) => setSubCategory(e.target.value)}
                          disabled={!canEdit}
                          placeholder="اختر من المقترحات أو اكتب تصنيفاً مخصصاً..."
                          className="bg-white dark:bg-[#0E1420] border border-slate-300 dark:border-slate-700/80 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-slate-800 focus:ring-1 focus:ring-slate-800 rounded-xl font-medium text-sm py-2.5 px-3 h-auto"
                        />
                        <datalist id="add-subcategories-list">
                          {(subCategoriesByAssetType[assetType] || []).map((sub) => (
                            <option key={sub.value} value={sub.value}>{sub.label}</option>
                          ))}
                        </datalist>
                      </div>
                    </div>

                    {showSector && (
                      <div className="grid gap-2">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="instrument-sector" className="text-slate-800 dark:text-slate-200 font-bold text-xs">القطاع الاقتصادي (Sector)</Label>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400">اختر أو اكتب قطاعاً مخصصاً</span>
                        </div>
                        <Input
                          id="instrument-sector"
                          list="add-sectors-list"
                          value={sector}
                          onChange={(e) => setSector(e.target.value)}
                          disabled={!canEdit}
                          placeholder="اختر من القطاعات أو اكتب قطاعاً جديداً..."
                          className="bg-white dark:bg-[#0E1420] border border-slate-300 dark:border-slate-700/80 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-slate-800 focus:ring-1 focus:ring-slate-800 rounded-xl font-medium text-sm py-2.5 px-3 h-auto"
                        />
                        <datalist id="add-sectors-list">
                          {egxSectors.map((sec) => (
                            <option key={sec.value} value={sec.value}>{sec.label}</option>
                          ))}
                        </datalist>
                      </div>
                    )}

                    <Button
                      type="submit"
                      disabled={!canEdit || createInstrument.isPending}
                      className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm py-2.5 px-6 rounded-xl shadow-sm transition-all dark:bg-white dark:hover:bg-slate-100 dark:text-slate-950 border border-slate-900 dark:border-transparent disabled:opacity-50 disabled:cursor-not-allowed mt-2"
                    >
                      {createInstrument.isPending && <Loader2 className="ml-2 size-4 animate-spin" />}
                      {canEdit ? "حفظ الأداة" : "تتطلب صلاحية محرر أو مستشار"}
                    </Button>
                  </form>
                </CardContent>
              </Card>

              <Card className="bg-white dark:bg-[#0B0F17] border border-slate-200/90 dark:border-slate-800/80 rounded-2xl shadow-xs overflow-hidden">
                <CardHeader className="border-b border-slate-100 dark:border-slate-800/80 p-5">
                  <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-white font-bold text-base">
                    <Landmark className="size-5 text-sky-600 dark:text-sky-400" />
                    سجل الأدوات
                  </CardTitle>
                  <CardDescription className="text-slate-500 dark:text-slate-400 text-xs mt-1">وجود الأداة لا يعني وجود حيازة أو قيمة؛ كلاهما يتطلب صفقة وسعرًا موثقًا.</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  {instruments.isLoading ? (
                    <p className="py-12 text-center text-sm text-slate-500 dark:text-slate-400">جارٍ تحميل الأدوات…</p>
                  ) : instruments.error ? (
                    <div className="m-4 flex gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
                      <CircleAlert className="size-4 shrink-0" />
                      {errorText(instruments.error)}
                    </div>
                  ) : instruments.data?.length ? (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[560px] text-right text-sm">
                        <thead>
                          <tr className="border-b border-slate-200 dark:border-slate-800">
                            <th className="bg-slate-100/80 dark:bg-[#0E1420] text-slate-800 dark:text-slate-200 font-bold text-xs border-b border-slate-200 dark:border-slate-800 py-3.5 px-4 text-right">الاسم</th>
                            <th className="bg-slate-100/80 dark:bg-[#0E1420] text-slate-800 dark:text-slate-200 font-bold text-xs border-b border-slate-200 dark:border-slate-800 py-3.5 px-4 text-right">الرمز</th>
                            <th className="bg-slate-100/80 dark:bg-[#0E1420] text-slate-800 dark:text-slate-200 font-bold text-xs border-b border-slate-200 dark:border-slate-800 py-3.5 px-4 text-right">الفئة والتصنيف</th>
                            <th className="bg-slate-100/80 dark:bg-[#0E1420] text-slate-800 dark:text-slate-200 font-bold text-xs border-b border-slate-200 dark:border-slate-800 py-3.5 px-4 text-right">القطاع</th>
                            <th className="bg-slate-100/80 dark:bg-[#0E1420] text-slate-800 dark:text-slate-200 font-bold text-xs border-b border-slate-200 dark:border-slate-800 py-3.5 px-4 text-right">العملة</th>
                            <th className="bg-slate-100/80 dark:bg-[#0E1420] text-slate-800 dark:text-slate-200 font-bold text-xs border-b border-slate-200 dark:border-slate-800 py-3.5 px-4 text-left">الإجراءات</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                          {instruments.data.map((item) => (
                            <tr key={item.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors">
                              <td className="py-3.5 px-4">
                                <span className="text-slate-900 dark:text-white font-bold text-sm block">{item.name}</span>
                              </td>
                              <td className="py-3.5 px-4">
                                {item.symbol ? (
                                  <span className="font-mono font-semibold bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 px-2 py-0.5 rounded text-xs border border-slate-200/60 dark:border-slate-700/60">
                                    {item.symbol}
                                  </span>
                                ) : (
                                  <span className="text-xs text-slate-400 dark:text-slate-500 font-mono">—</span>
                                )}
                              </td>
                              <td className="py-3.5 px-4">
                                <div className="flex flex-col gap-1">
                                  <span className="inline-flex w-fit items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200/60 dark:border-slate-700/60">
                                    {assetTypeLabel[item.assetType as AssetType] || item.assetType}
                                  </span>
                                  {item.subCategory && (
                                    <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                                      {subCategoriesByAssetType[item.assetType as AssetType]?.find(s => s.value === item.subCategory || s.label === item.subCategory)?.label || item.subCategory}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="py-3.5 px-4">
                                {item.sector ? (
                                  <span className="text-xs text-slate-700 dark:text-slate-300 font-medium">
                                    {egxSectors.find(s => s.value === item.sector || s.label === item.sector)?.label || item.sector}
                                  </span>
                                ) : (
                                  <span className="text-xs text-slate-400 dark:text-slate-500 font-mono">—</span>
                                )}
                              </td>
                              <td className="py-3.5 px-4">
                                <span className="font-mono font-bold text-xs text-slate-800 dark:text-slate-200 bg-slate-100/80 dark:bg-slate-800/80 px-2.5 py-1 rounded-md border border-slate-200/60 dark:border-slate-700/60">
                                  {item.currency}
                                </span>
                              </td>
                              <td className="py-3.5 px-4 text-left">
                                <div className="flex items-center gap-1.5 justify-end">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    disabled={!canEdit}
                                    onClick={() => handleOpenEditInstrument(item)}
                                    className="h-8 px-2.5 text-xs text-slate-700 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800 rounded-lg gap-1"
                                  >
                                    <Pencil className="size-3.5" />
                                    <span>تعديل</span>
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    disabled={!canEdit}
                                    onClick={() => handleOpenDeleteInstrument(item)}
                                    className="h-8 px-2.5 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-950/30 rounded-lg gap-1"
                                  >
                                    <Trash2 className="size-3.5" />
                                    <span>حذف</span>
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="p-8 text-center">
                      <div className="flex size-12 items-center justify-center rounded-2xl border bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/20 dark:border-slate-700/60 mx-auto mb-3">
                        <Landmark className="size-6" />
                      </div>
                      <h3 className="text-slate-900 dark:text-white font-bold text-base mb-1">لا توجد أدوات استثمارية</h3>
                      <p className="text-slate-600 dark:text-slate-400 text-xs max-w-md mx-auto mb-2">أضف أداة برمزها وبياناتها الأساسية، ثم سجّل سعرًا أو صفقة بصورة صريحة.</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </section>
          </TabsContent>

          {/* TAB 3: Trades & Orders */}
          <TabsContent value="trades">
            <section className="grid gap-6 lg:grid-cols-[1.2fr_.8fr]">
              <Card className="bg-white dark:bg-[#0B0F17] border border-slate-200/90 dark:border-slate-800/80 rounded-2xl shadow-xs overflow-hidden">
                <CardHeader className="border-b border-slate-100 dark:border-slate-800/80 p-5">
                  <CardTitle className="text-slate-900 dark:text-white font-bold text-base">مراجعة وتسجيل صفقة شراء أو بيع</CardTitle>
                  <CardDescription className="text-slate-500 dark:text-slate-400 text-xs mt-1">
                    الرسوم والضرائب تُسجل مع القيد المتوازن. لا يتم تعديل أي رصيد خارج دفتر الأستاذ. الأرباح المحققة تُحسب وفق منهجية FIFO ومقيدة بدفتر الأستاذ المزدوج.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-5">
                  {accounts.isLoading || instruments.isLoading ? (
                    <p className="py-12 text-center text-sm text-slate-500 dark:text-slate-400">جارٍ تجهيز نموذج الصفقة…</p>
                  ) : tradeAccounts.length && instruments.data?.length ? (
                    <form onSubmit={submitTrade} className="grid gap-4">
                      <div className="grid gap-3 sm:grid-cols-3">
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
                          <Label htmlFor="trade-quantity" className="text-slate-700 dark:text-slate-300 font-semibold text-xs">الكمية</Label>
                          <Input
                            id="trade-quantity"
                            inputMode="decimal"
                            value={quantity}
                            onChange={(e) => setQuantity(e.target.value)}
                            required
                            placeholder="0.00"
                            className="bg-white dark:bg-[#0E1420] border border-slate-300 dark:border-slate-700/80 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-slate-800 focus:ring-1 focus:ring-slate-800 rounded-xl font-medium text-sm py-2.5 px-3 h-auto font-mono"
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="trade-price" className="text-slate-700 dark:text-slate-300 font-semibold text-xs">سعر الوحدة</Label>
                          <Input
                            id="trade-price"
                            inputMode="decimal"
                            value={unitPrice}
                            onChange={(e) => setUnitPrice(e.target.value)}
                            required
                            placeholder="0.00"
                            className="bg-white dark:bg-[#0E1420] border border-slate-300 dark:border-slate-700/80 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-slate-800 focus:ring-1 focus:ring-slate-800 rounded-xl font-medium text-sm py-2.5 px-3 h-auto font-mono"
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="trade-fee" className="text-slate-700 dark:text-slate-300 font-semibold text-xs">الرسوم (اختياري)</Label>
                          <Input
                            id="trade-fee"
                            inputMode="decimal"
                            value={feeAmount}
                            onChange={(e) => setFeeAmount(e.target.value)}
                            placeholder="0.00"
                            className="bg-white dark:bg-[#0E1420] border border-slate-300 dark:border-slate-700/80 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-slate-800 focus:ring-1 focus:ring-slate-800 rounded-xl font-medium text-sm py-2.5 px-3 h-auto font-mono"
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="trade-tax" className="text-slate-700 dark:text-slate-300 font-semibold text-xs">الضرائب (اختياري)</Label>
                          <Input
                            id="trade-tax"
                            inputMode="decimal"
                            value={taxAmount}
                            onChange={(e) => setTaxAmount(e.target.value)}
                            placeholder="0.00"
                            className="bg-white dark:bg-[#0E1420] border border-slate-300 dark:border-slate-700/80 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-slate-800 focus:ring-1 focus:ring-slate-800 rounded-xl font-medium text-sm py-2.5 px-3 h-auto font-mono"
                          />
                        </div>
                      </div>

                      <div className="grid gap-2">
                        <Label htmlFor="trade-memo" className="text-slate-700 dark:text-slate-300 font-semibold text-xs">مذكرة العملية</Label>
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
                        disabled={trade.isPending || !canAdvise}
                        className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm py-2.5 px-6 rounded-xl shadow-sm transition-all dark:bg-white dark:hover:bg-slate-100 dark:text-slate-950 border border-slate-900 dark:border-transparent disabled:opacity-50 disabled:cursor-not-allowed mt-2"
                      >
                        {trade.isPending && <Loader2 className="ml-2 size-4 animate-spin" />}
                        {canAdvise ? "تسجيل واعتماد الصفقة" : "تتطلب صلاحية مستشار"}
                      </Button>
                    </form>
                  ) : (
                    <div className="p-8 text-center">
                      <div className="flex size-12 items-center justify-center rounded-2xl border bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/20 dark:border-slate-700/60 mx-auto mb-3">
                        <Landmark className="size-6" />
                      </div>
                      <h3 className="text-slate-900 dark:text-white font-bold text-base mb-1">جهّز الحساب والأداة أولًا</h3>
                      <p className="text-slate-600 dark:text-slate-400 text-xs max-w-md mx-auto mb-2">يلزم حساب تسوية نشط وأداة استثمارية قبل تسجيل صفقة فعلية.</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Manual Quote Card */}
              <Card className="bg-white dark:bg-[#0B0F17] border border-slate-200/90 dark:border-slate-800/80 rounded-2xl shadow-xs overflow-hidden">
                <CardHeader className="border-b border-slate-100 dark:border-slate-800/80 p-5">
                  <CardTitle className="text-slate-900 dark:text-white font-bold text-base">سعر سوق يدوي موثق</CardTitle>
                  <CardDescription className="text-slate-500 dark:text-slate-400 text-xs mt-1">تسجيل سعر للأداة مع طابع زمني دقيق دون الحاجة لمصدر خارجي.</CardDescription>
                </CardHeader>
                <CardContent className="p-5">
                  {instruments.data?.length ? (
                    <form className="grid gap-4" onSubmit={submitQuote}>
                      <div className="grid gap-2">
                        <Label className="text-slate-700 dark:text-slate-300 font-semibold text-xs">الأداة</Label>
                        <Select value={quoteInstrumentId} onValueChange={setQuoteInstrumentId}>
                          <SelectTrigger className="w-full bg-white dark:bg-[#0E1420] border border-slate-300 dark:border-slate-700/80 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-slate-800 focus:ring-1 focus:ring-slate-800 rounded-xl font-medium text-sm py-2.5 px-3 h-auto">
                            <SelectValue placeholder="اختر أداة" />
                          </SelectTrigger>
                          <SelectContent className="bg-white dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-800">
                            {instruments.data.map((item) => (
                              <SelectItem key={item.id} value={String(item.id)}>
                                {item.name} — {item.currency}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="manual-quote" className="text-slate-700 dark:text-slate-300 font-semibold text-xs">سعر الوحدة</Label>
                        <Input
                          id="manual-quote"
                          inputMode="decimal"
                          value={quotePrice}
                          onChange={(e) => setQuotePrice(e.target.value)}
                          required
                          placeholder="0.00"
                          className="bg-white dark:bg-[#0E1420] border border-slate-300 dark:border-slate-700/80 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-slate-800 focus:ring-1 focus:ring-slate-800 rounded-xl font-medium text-sm py-2.5 px-3 h-auto font-mono"
                        />
                      </div>
                      <Button
                        type="submit"
                        disabled={recordQuote.isPending || !canAdvise}
                        className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm py-2.5 px-6 rounded-xl shadow-sm transition-all dark:bg-white dark:hover:bg-slate-100 dark:text-slate-950 border border-slate-900 dark:border-transparent disabled:opacity-50 disabled:cursor-not-allowed mt-2"
                      >
                        {recordQuote.isPending && <Loader2 className="ml-2 size-4 animate-spin" />}
                        {canAdvise ? "حفظ السعر اليدوي" : "تتطلب صلاحية مستشار"}
                      </Button>
                    </form>
                  ) : (
                    <p className="flex gap-2 rounded-xl bg-muted/50 p-4 text-sm text-slate-500 dark:text-slate-400">
                      <CircleAlert className="size-4 shrink-0" />
                      أضف أداة استثمارية أولًا قبل تسجيل سعر.
                    </p>
                  )}
                </CardContent>
              </Card>
            </section>

            {/* Section: Recent Investment Trades Ledger */}
            <Card className="bg-white dark:bg-[#0B0F17] border border-slate-200/90 dark:border-slate-800/80 rounded-2xl shadow-xs overflow-hidden mt-6">
              <CardHeader className="border-b border-slate-100 dark:border-slate-800/80 p-5 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-slate-900 dark:text-white font-bold text-base flex items-center gap-2">
                    <ArrowLeftRight className="size-5 text-emerald-600 dark:text-emerald-400" />
                    سجل صفقات التداول والمعاملات الاستثمارية
                  </CardTitle>
                  <CardDescription className="text-slate-500 dark:text-slate-400 text-xs mt-1">
                    سجل الصفقات المنفذة مع إمكانية التعديل والحذف مع تسوية وعكس قيود دفتر الأستاذ وسجلات FIFO آلياً.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs font-mono">
                    {recentTrades.data?.length ?? 0} صفقة
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {recentTrades.isLoading ? (
                  <p className="py-12 text-center text-sm text-slate-500 dark:text-slate-400">جارٍ تحميل الصفقات…</p>
                ) : recentTrades.data?.length ? (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[760px] text-right text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-800">
                          <th className="bg-slate-100/80 dark:bg-[#0E1420] text-slate-800 dark:text-slate-200 font-bold text-xs py-3.5 px-4 text-right">نوع الصفقة</th>
                          <th className="bg-slate-100/80 dark:bg-[#0E1420] text-slate-800 dark:text-slate-200 font-bold text-xs py-3.5 px-4 text-right">الأداة الاستثمارية</th>
                          <th className="bg-slate-100/80 dark:bg-[#0E1420] text-slate-800 dark:text-slate-200 font-bold text-xs py-3.5 px-4 text-right">حساب التسوية</th>
                          <th className="bg-slate-100/80 dark:bg-[#0E1420] text-slate-800 dark:text-slate-200 font-bold text-xs py-3.5 px-4 text-right">التاريخ والوقت</th>
                          <th className="bg-slate-100/80 dark:bg-[#0E1420] text-slate-800 dark:text-slate-200 font-bold text-xs py-3.5 px-4 text-right">الكمية</th>
                          <th className="bg-slate-100/80 dark:bg-[#0E1420] text-slate-800 dark:text-slate-200 font-bold text-xs py-3.5 px-4 text-right">سعر الوحدة</th>
                          <th className="bg-slate-100/80 dark:bg-[#0E1420] text-slate-800 dark:text-slate-200 font-bold text-xs py-3.5 px-4 text-right">الإجمالي الصافي</th>
                          <th className="bg-slate-100/80 dark:bg-[#0E1420] text-slate-800 dark:text-slate-200 font-bold text-xs py-3.5 px-4 text-right">الحالة</th>
                          <th className="bg-slate-100/80 dark:bg-[#0E1420] text-slate-800 dark:text-slate-200 font-bold text-xs py-3.5 px-4 text-left">الإجراءات</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                        {recentTrades.data.map((trItem) => {
                          const inst = instruments.data?.find((i) => i.id === trItem.instrumentId);
                          const acc = accounts.data?.find((a) => a.id === trItem.primaryAccountId);
                          const isBuy = trItem.eventType === "buy";
                          return (
                            <tr key={trItem.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors">
                              <td className="py-3.5 px-4">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                                  isBuy ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300" : "bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300"
                                }`}>
                                  {isBuy ? "شراء" : "بيع"}
                                </span>
                              </td>
                              <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-white">
                                {inst?.name || `أداة #${trItem.instrumentId}`}
                                {inst?.symbol && (
                                  <span className="font-mono text-xs text-slate-500 mr-1.5">({inst.symbol})</span>
                                )}
                              </td>
                              <td className="py-3.5 px-4 text-xs text-slate-600 dark:text-slate-300">
                                {acc?.name || "حساب المعاملة"}
                              </td>
                              <td className="py-3.5 px-4 font-mono text-xs text-slate-600 dark:text-slate-400">
                                {new Date(trItem.occurredAt).toLocaleString("en-GB")}
                              </td>
                              <td className="py-3.5 px-4 font-mono font-bold text-xs">
                                {trItem.quantity ? Number(trItem.quantity).toLocaleString() : "—"}
                              </td>
                              <td className="py-3.5 px-4 font-mono text-xs">
                                {trItem.unitPrice ? formatMoney(trItem.unitPrice, trItem.currency, 2) : "—"}
                              </td>
                              <td className="py-3.5 px-4 font-mono font-bold text-xs text-slate-900 dark:text-white">
                                {formatMoney(trItem.grossAmount, trItem.currency, 2)}
                              </td>
                              <td className="py-3.5 px-4">
                                <span className="inline-flex items-center text-xs font-medium text-emerald-700 dark:text-emerald-400">
                                  <CheckCircle2 className="size-3.5 ml-1 inline" />
                                  مرحّل
                                </span>
                              </td>
                              <td className="py-3.5 px-4 text-left">
                                <div className="flex items-center gap-1.5 justify-end">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    disabled={!canEdit}
                                    onClick={() => handleOpenEditTrade(trItem)}
                                    className="h-8 px-2.5 text-xs text-slate-700 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800 rounded-lg gap-1"
                                  >
                                    <Pencil className="size-3.5" />
                                    <span>تعديل</span>
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    disabled={!canEdit}
                                    onClick={() => handleOpenDeleteTrade(trItem)}
                                    className="h-8 px-2.5 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-950/30 rounded-lg gap-1"
                                  >
                                    <Trash2 className="size-3.5" />
                                    <span>حذف</span>
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="py-8 text-center text-sm text-slate-500">لا توجد صفقات منفذة مسجلة حتى الآن.</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 4: Performance Summary */}
          <TabsContent value="performance">
            <Card className="bg-white dark:bg-[#0B0F17] border border-slate-200/90 dark:border-slate-800/80 rounded-2xl p-6 shadow-xs">
              <CardHeader className="border-b border-slate-100 dark:border-slate-800/80 pb-5 px-0 pt-0">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-white font-bold text-base">
                      <BarChart3 className="size-5 text-sky-600 dark:text-sky-400" />
                      ملخص أداء المحفظة الاستثمارية
                    </CardTitle>
                    <CardDescription className="text-slate-500 dark:text-slate-400 text-xs mt-1">مؤشرات الأداء الموزونة بالوقت والتدفقات النقدية من واقع قيود الدفتر.</CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setLocation("/performance")}
                    className="bg-white hover:bg-slate-50 text-slate-800 font-semibold text-xs px-3.5 py-2 rounded-xl border border-slate-200/90 shadow-2xs dark:bg-slate-800/60 dark:hover:bg-slate-800 dark:text-slate-200 dark:border-slate-700/60 transition-all"
                  >
                    فتح شاشة الأداء التفصيلية
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="px-0 pb-0 pt-5 space-y-6">
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/80 dark:bg-[#0E1420] p-4">
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">الأصول النشطة</p>
                    <p className="mt-1 text-2xl font-bold font-mono text-slate-900 dark:text-white tabular-nums">{holdings.length}</p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">موزعة على الأدوات المصنفة</p>
                  </div>
                  <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/80 dark:bg-[#0E1420] p-4">
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">أصول مقيّمة بالسوق</p>
                    <p className="mt-1 text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400 tabular-nums">{valuedHoldings.length}</p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">تظهر قيمتها السوقية بدقة</p>
                  </div>
                  <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/80 dark:bg-[#0E1420] p-4">
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">حزم FIFO النشطة</p>
                    <p className="mt-1 text-2xl font-bold font-mono text-slate-900 dark:text-white tabular-nums">
                      {lots.data?.filter((l) => l.status === "open").length ?? 0}
                    </p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">حزم شراء مفتوحة تتبع أقدمية التكلفة</p>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-[#0E1420]/50 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">تحليل عوائد المحفظة المتقدم (Brinson Allocation & Selection)</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">للاطلاع على منحنى العائد المرجح زمنيًا (TWR) وتحليل المخاطر المتقدم.</p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => setLocation("/performance")}
                    className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs px-4 py-2 rounded-xl shadow-sm transition-all border border-slate-900 dark:bg-white dark:hover:bg-slate-100 dark:text-slate-950 dark:border-transparent shrink-0"
                  >
                    الانتقال للأداء
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 5: Realized P&L */}
          <TabsContent value="realized">
            <Card className="bg-white dark:bg-[#0B0F17] border border-slate-200/90 dark:border-slate-800/80 rounded-2xl p-6 shadow-xs">
              <CardHeader className="border-b border-slate-100 dark:border-slate-800/80 pb-5 px-0 pt-0">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-white font-bold text-base">
                      <GitCompareArrows className="size-5 text-sky-600 dark:text-sky-400" />
                      الأرباح والخسائر المحققة (FIFO Realized P&L)
                    </CardTitle>
                    <CardDescription className="text-slate-500 dark:text-slate-400 text-xs mt-1">النتائج المحققة الناتجة عن صفقات البيع ومطابقتها بحزم الشراء وفق معيار FIFO.</CardDescription>
                  </div>
                  <Badge variant="outline" className="font-mono text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700">
                    {realizedList.data?.length ?? 0} مطابقة مسجلة
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-0 pt-5">
                {realizedList.isLoading ? (
                  <p className="py-12 text-center text-sm text-slate-500 dark:text-slate-400">جارٍ تحميل الأرباح المحققة…</p>
                ) : realizedList.data?.length ? (
                  <div className="overflow-x-auto rounded-xl border border-slate-200/80 dark:border-slate-800">
                    <table className="w-full min-w-[700px] text-right text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-800">
                          <th className="bg-slate-100/80 dark:bg-[#0E1420] text-slate-800 dark:text-slate-200 font-bold text-xs py-3.5 px-4 text-right">الأداة</th>
                          <th className="bg-slate-100/80 dark:bg-[#0E1420] text-slate-800 dark:text-slate-200 font-bold text-xs py-3.5 px-4 text-right">الكمية المباعة</th>
                          <th className="bg-slate-100/80 dark:bg-[#0E1420] text-slate-800 dark:text-slate-200 font-bold text-xs py-3.5 px-4 text-right">سعر البيع</th>
                          <th className="bg-slate-100/80 dark:bg-[#0E1420] text-slate-800 dark:text-slate-200 font-bold text-xs py-3.5 px-4 text-right">أساس التكلفة (FIFO)</th>
                          <th className="bg-slate-100/80 dark:bg-[#0E1420] text-slate-800 dark:text-slate-200 font-bold text-xs py-3.5 px-4 text-right">الربح/الخسارة المحققة</th>
                          <th className="bg-slate-100/80 dark:bg-[#0E1420] text-slate-800 dark:text-slate-200 font-bold text-xs py-3.5 px-4 text-right">تاريخ البيع</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                        {realizedList.data.map((row) => {
                          const unitPrice = Number(row.quantity) > 0 ? (Number(row.grossProceeds) / Number(row.quantity)).toFixed(2) : "0.00";
                          return (
                            <tr key={row.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors">
                              <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-slate-100">{instrumentMap.get(row.instrumentId) || `#${row.instrumentId}`}</td>
                              <td className="py-3.5 px-4 font-mono font-bold text-slate-900 dark:text-white tabular-nums">{row.quantity}</td>
                              <td className="py-3.5 px-4 font-mono text-slate-900 dark:text-white tabular-nums">
                                <SensitiveValue>{formatMoney(unitPrice, row.currency, 2)}</SensitiveValue>
                              </td>
                              <td className="py-3.5 px-4 font-mono text-slate-900 dark:text-white tabular-nums">
                                <SensitiveValue>{formatMoney(row.costBasis, row.currency, 2)}</SensitiveValue>
                              </td>
                              <td className={`py-3.5 px-4 font-mono font-bold tabular-nums ${Number(row.realizedPnl) >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                                <SensitiveValue>{formatMoney(row.realizedPnl, row.currency, 2)}</SensitiveValue>
                              </td>
                              <td className="py-3.5 px-4 text-xs text-slate-500 dark:text-slate-400">
                                {new Date(row.matchedAt).toLocaleDateString("ar-EG")}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-8 text-center">
                    <div className="flex size-12 items-center justify-center rounded-2xl border bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/20 dark:border-slate-700/60 mx-auto mb-3">
                      <GitCompareArrows className="size-6" />
                    </div>
                    <h3 className="text-slate-900 dark:text-white font-bold text-base mb-1">لا توجد أرباح محققة بعد</h3>
                    <p className="text-slate-600 dark:text-slate-400 text-xs max-w-md mx-auto mb-2">تنشأ الأرباح أو الخسائر المحققة عند تنفيذ صفقات بيع على حيازات مشتراة سابقًا ومطابقتها بحزم FIFO.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 6: FIFO Lots */}
          <TabsContent value="lots">
            <Card className="bg-white dark:bg-[#0B0F17] border border-slate-200/90 dark:border-slate-800/80 rounded-2xl p-6 shadow-xs">
              <CardHeader className="border-b border-slate-100 dark:border-slate-800/80 pb-5 px-0 pt-0">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-white font-bold text-base">
                      <Layers className="size-5 text-sky-600 dark:text-sky-400" />
                      سجل حزم الاستثمار (FIFO Lots)
                    </CardTitle>
                    <CardDescription className="text-slate-500 dark:text-slate-400 text-xs mt-1">كل صفقة شراء تنشئ حزمة منفصلة تسجل الكمية الأصلية والمتبقية وتكلفة الوحدة.</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={rebuildReport.data?.status === "matched" ? "secondary" : "outline"} className="gap-1 border-slate-200 dark:border-slate-700">
                      <ShieldCheck className="size-3.5" />
                      <span>{rebuildReport.data?.status === "matched" ? "تطابق كامل في إعادة البناء" : "جاهز للتدقيق"}</span>
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0 pt-5">
                {lots.isLoading ? (
                  <p className="py-12 text-center text-sm text-slate-500 dark:text-slate-400">جارٍ تحميل الحزم…</p>
                ) : lots.data?.length ? (
                  <div className="overflow-x-auto rounded-xl border border-slate-200/80 dark:border-slate-800">
                    <table className="w-full min-w-[700px] text-right text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-800">
                          <th className="bg-slate-100/80 dark:bg-[#0E1420] text-slate-800 dark:text-slate-200 font-bold text-xs py-3.5 px-4 text-right">الأداة</th>
                          <th className="bg-slate-100/80 dark:bg-[#0E1420] text-slate-800 dark:text-slate-200 font-bold text-xs py-3.5 px-4 text-right">الكمية الأصلية</th>
                          <th className="bg-slate-100/80 dark:bg-[#0E1420] text-slate-800 dark:text-slate-200 font-bold text-xs py-3.5 px-4 text-right">الكمية المتبقية</th>
                          <th className="bg-slate-100/80 dark:bg-[#0E1420] text-slate-800 dark:text-slate-200 font-bold text-xs py-3.5 px-4 text-right">تكلفة الوحدة</th>
                          <th className="bg-slate-100/80 dark:bg-[#0E1420] text-slate-800 dark:text-slate-200 font-bold text-xs py-3.5 px-4 text-right">تاريخ الشراء</th>
                          <th className="bg-slate-100/80 dark:bg-[#0E1420] text-slate-800 dark:text-slate-200 font-bold text-xs py-3.5 px-4 text-right">الحالة</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                        {lots.data.map((lot) => (
                          <tr key={lot.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors">
                            <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-slate-100">{instrumentMap.get(lot.instrumentId) || `#${lot.instrumentId}`}</td>
                            <td className="py-3.5 px-4 font-mono font-bold text-slate-900 dark:text-white tabular-nums">{lot.originalQuantity}</td>
                            <td className="py-3.5 px-4 font-mono font-bold text-slate-900 dark:text-white tabular-nums">{lot.remainingQuantity}</td>
                            <td className="py-3.5 px-4 font-mono text-slate-900 dark:text-white tabular-nums">
                              <SensitiveValue>{formatMoney(lot.unitCost, lot.costCurrency, 2)}</SensitiveValue>
                            </td>
                            <td className="py-3.5 px-4 text-xs text-slate-500 dark:text-slate-400">
                              {new Date(lot.acquiredAt).toLocaleDateString("ar-EG")}
                            </td>
                            <td className="py-3.5 px-4">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
                                lot.status === "open"
                                  ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200/60 dark:border-emerald-800/40"
                                  : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200/60 dark:border-slate-700/60"
                              }`}>
                                {lot.status === "open" ? "مفتوحة" : "مغلقة"}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-8 text-center">
                    <div className="flex size-12 items-center justify-center rounded-2xl border bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/20 dark:border-slate-700/60 mx-auto mb-3">
                      <Layers className="size-5" />
                    </div>
                    <h3 className="text-slate-900 dark:text-white font-bold text-base mb-1">لا توجد حزم FIFO بعد</h3>
                    <p className="text-slate-600 dark:text-slate-400 text-xs max-w-md mx-auto mb-2">تنشأ الحزم تلقائيًا عند تسجيل صفقات شراء أدوات استثمارية في الدفتر.</p>
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
          title={`تأكيد تسجيل صفقة ${side === "buy" ? "شراء" : "بيع"}`}
          description={`أنت على وشك تسجيل صفقة ${side === "buy" ? "شراء" : "بيع"} لـ ${quantity} وحدة من أداة "${selectedInstrument?.name}" عبر حساب "${selectedAccount?.name}". سيتم قيد العملية في دفتر الأستاذ وتحديث متوسط التكلفة والحيازات وحزم FIFO.`}
          confirmText={`تأكيد تسجيل صفقة الـ ${side === "buy" ? "شراء" : "بيع"}`}
          cancelText="إلغاء والعودة"
          isLoading={trade.isPending}
          onConfirm={executeConfirmedTrade}
        />

        {/* Edit Instrument Dialog */}
        <Dialog open={editInstrumentModalOpen} onOpenChange={setEditInstrumentModalOpen}>
          <DialogContent className="max-w-md w-full bg-white text-slate-900 dark:bg-[#0B0F17] dark:text-slate-100 border border-slate-200 dark:border-slate-800 shadow-2xl rounded-2xl" dir="rtl">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-slate-900 dark:text-white">تعديل بيانات الأداة الاستثمارية</DialogTitle>
              <DialogDescription className="text-xs text-slate-500 dark:text-slate-400">
                تعديل الاسم والرمز والفئة والتصنيف والقطاع للأداة.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSaveEditInstrument} className="grid gap-3.5 mt-2">
              <div className="grid gap-1.5">
                <Label className="text-xs font-semibold">اسم الأداة</Label>
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  required
                  className="rounded-xl text-sm"
                />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs font-semibold">رمز التداول (Ticker)</Label>
                <Input
                  value={editSymbol}
                  onChange={(e) => setEditSymbol(e.target.value.toUpperCase())}
                  placeholder="EGX Ticker..."
                  className="rounded-xl text-sm font-mono"
                />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs font-semibold">الفئة الأساسية</Label>
                <Select
                  value={editAssetType}
                  onValueChange={(val) => {
                    const nextType = val as AssetType;
                    setEditAssetType(nextType);
                    const avail = subCategoriesByAssetType[nextType] || [];
                    setEditSubCategory(avail.length > 0 ? avail[0].value : "OTHER");
                  }}
                >
                  <SelectTrigger className="rounded-xl text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white dark:bg-[#0B0F17]">
                    {Object.entries(assetTypeLabel).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="edit-instrument-subcategory" className="text-xs font-semibold">التصنيف الفرعي</Label>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">اختر أو اكتب مخصص</span>
                </div>
                <Input
                  id="edit-instrument-subcategory"
                  list="edit-subcategories-list"
                  value={editSubCategory}
                  onChange={(e) => setEditSubCategory(e.target.value)}
                  placeholder="اختر أو اكتب تصنيفاً فرعياً مخصصاً..."
                  className="rounded-xl text-sm"
                />
                <datalist id="edit-subcategories-list">
                  {(subCategoriesByAssetType[editAssetType] || []).map((sc) => (
                    <option key={sc.value} value={sc.value}>{sc.label}</option>
                  ))}
                </datalist>
              </div>
              <div className="grid gap-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="edit-instrument-sector" className="text-xs font-semibold">القطاع</Label>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">اختر أو اكتب مخصص</span>
                </div>
                <Input
                  id="edit-instrument-sector"
                  list="edit-sectors-list"
                  value={editSector}
                  onChange={(e) => setEditSector(e.target.value)}
                  placeholder="اختر أو اكتب قطاعاً مخصصاً..."
                  className="rounded-xl text-sm"
                />
                <datalist id="edit-sectors-list">
                  {egxSectors.map((sec) => (
                    <option key={sec.value} value={sec.value}>{sec.label}</option>
                  ))}
                </datalist>
              </div>
              <DialogFooter className="mt-3 gap-2 flex-row-reverse">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditInstrumentModalOpen(false)}
                  className="rounded-xl text-xs"
                >
                  إلغاء
                </Button>
                <Button
                  type="submit"
                  disabled={updateInstrumentMutation.isPending}
                  className="rounded-xl text-xs bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900"
                >
                  {updateInstrumentMutation.isPending && <Loader2 className="ml-2 size-3.5 animate-spin" />}
                  حفظ التعديلات
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Delete Instrument ConfirmDialog */}
        <ConfirmDialog
          open={deleteInstrumentModalOpen}
          onOpenChange={setDeleteInstrumentModalOpen}
          title="حذف الأداة الاستثمارية"
          description={`هل أنت متأكد من حذف الأداة "${selectedInstrumentForAction?.name}" (${selectedInstrumentForAction?.symbol || "بدون رمز"})؟ سيتم التحقق من عدم وجود عمليات محاسبية أو حيازات مفتوحة مرتبطة بها.`}
          confirmText={deleteInstrumentMutation.isPending ? "جارٍ الحذف..." : "تأكيد الحذف"}
          cancelText="إلغاء"
          variant="destructive"
          isLoading={deleteInstrumentMutation.isPending}
          onConfirm={handleConfirmDeleteInstrument}
        />

        {/* Edit Trade Modal */}
        <Dialog open={editTradeModalOpen} onOpenChange={setEditTradeModalOpen}>
          <DialogContent className="max-w-lg w-full bg-white text-slate-900 dark:bg-[#0B0F17] dark:text-slate-100 border border-slate-200 dark:border-slate-800 shadow-2xl rounded-2xl" dir="rtl">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-slate-900 dark:text-white">
                تعديل بيانات الصفقة #{selectedTradeForAction?.id}
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
                  onClick={() => setEditTradeModalOpen(false)}
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

        {/* Delete Trade ConfirmDialog */}
        <ConfirmDialog
          open={deleteTradeModalOpen}
          onOpenChange={setDeleteTradeModalOpen}
          title="حذف الصفقة الاستثمارية وعكس القيد"
          description={`هل أنت متأكد من حذف هذه الصفقة #${selectedTradeForAction?.id}؟ سيتم إلغاء العملية وعكس قيود اليومية المحاسبية واستعادة رصيد النقدية وسجلات FIFO آلياً.`}
          confirmText={deleteTradeMutation.isPending ? "جارٍ الحذف والعكس..." : "تأكيد الحذف والعكس"}
          cancelText="إلغاء"
          variant="destructive"
          isLoading={deleteTradeMutation.isPending}
          onConfirm={handleConfirmDeleteTrade}
        />
      </main>
    </DashboardLayout>
  );
}
