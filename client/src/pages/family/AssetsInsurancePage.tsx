import React, { useState, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  DashboardLayout,
  PageHeader,
  InlineError,
  EmptyState,
  money,
  dateTime,
  textError,
  useFamilyPermissions,
} from "./familyShared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ShieldCheck, BriefcaseBusiness, Umbrella, Loader2 } from "lucide-react";

export const specialAssetTypeLabel: Record<string, string> = {
  real_estate: "عقار",
  gold: "ذهب",
  commodity: "سلعة",
  other: "أصل آخر",
};

export const policyTypeLabel: Record<string, string> = {
  health: "صحي",
  life: "حياة",
  property: "ممتلكات",
  motor: "مركبات",
  other: "أخرى",
};

export const premiumCadenceLabel: Record<string, string> = {
  monthly: "شهري",
  quarterly: "ربع سنوي",
  yearly: "سنوي",
  other: "أخرى",
};

function isoDateInput(timestamp = Date.now()) {
  return new Date(timestamp).toISOString().slice(0, 10);
}

function arabicDate(timestamp: number) {
  return new Intl.DateTimeFormat("ar-EG", { dateStyle: "medium" }).format(new Date(timestamp));
}

const utcDateInput = arabicDate;

export function GoldYahooSuggestionCard() {
  const utils = trpc.useUtils();
  const access = useFamilyPermissions();
  const [, setLocation] = useLocation();
  const assets = trpc.family.specialAssets.list.useQuery();
  const [assetId, setAssetId] = useState("");
  const input = useMemo(() => ({ assetId: Number(assetId) || 1, symbol: "GC=F" }), [assetId]);
  const suggestion = trpc.family.specialAssets.suggestYahooGoldValue.useQuery(input, { enabled: false, retry: false });
  const recordValuation = trpc.family.specialAssets.recordYahooGoldValuation.useMutation({
    onSuccess: data => {
      toast.success(`حُفظ snapshot الذهب من ${data.source} بحالة مراجعة؛ لم يُنشأ قيد.`);
      void utils.family.specialAssets.list.invalidate();
    },
    onError: error => toast.error(textError(error)),
  });

  const prepareDraft = async () => {
    const result = await suggestion.refetch();
    if (!result.data) return toast.error(textError(result.error));
    sessionStorage.setItem(
      "family-gold-revaluation-draft",
      JSON.stringify({
        assetId: result.data.assetId,
        targetValue: result.data.suggestedTargetValue,
        memo: `اقتراح ${result.data.symbol} من ${result.data.source} بتاريخ ${arabicDate(result.data.asOf)}؛ راجعه قبل النشر.`,
      })
    );
    setLocation("/assets-insurance");
  };

  const goldAssets = (assets.data ?? []).filter(asset => asset.assetType === "gold" && asset.status === "active");

  return (
    <Card className="border-amber-200 bg-amber-50">
      <CardHeader>
        <CardTitle className="text-base">اقتراح إعادة تقييم الذهب</CardTitle>
        <CardDescription>
          يحوّل سعر GC=F من Yahoo من الأونصة التروية إلى جرام عند تسجيل الوحدة بوضوح. لا ينشر هذا الاقتراح قيدًا ماليًا.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="grid flex-1 gap-2">
          <Label>أصل الذهب</Label>
          <Select value={assetId} onValueChange={setAssetId} disabled={!access.canAdvise || !goldAssets.length}>
            <SelectTrigger>
              <SelectValue placeholder={goldAssets.length ? "اختر أصل الذهب" : "لا يوجد ذهب نشط بكمية ووحدة"} />
            </SelectTrigger>
            <SelectContent>
              {goldAssets.map(asset => (
                <SelectItem key={asset.id} value={String(asset.id)}>
                  {asset.name} — {asset.quantity || "بدون كمية"} {asset.unit || ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={!assetId || !access.canAdvise || suggestion.isFetching}
            onClick={prepareDraft}
          >
            {suggestion.isFetching && <Loader2 className="ml-2 size-4 animate-spin" />}
            تعبئة مسودة Yahoo
          </Button>
          <Button
            type="button"
            disabled={!assetId || !access.canAdvise || recordValuation.isPending}
            onClick={() =>
              recordValuation.mutate({
                assetId: Number(assetId),
                symbol: "GC=F",
                note: "تقييم Yahoo محفوظ للمراجعة؛ لا يُعتمد دفترًا تلقائيًا.",
              })
            }
          >
            {recordValuation.isPending && <Loader2 className="ml-2 size-4 animate-spin" />}
            حفظ snapshot للمراجعة
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function AssetsInsurancePage() {
  const utils = trpc.useUtils();
  const [, setLocation] = useLocation();
  const access = useFamilyPermissions();
  const [assetTab, setAssetTab] = useState<"registry" | "revaluation" | "insurance">("registry");
  const bootstrap = trpc.family.bootstrap.useQuery();
  const assets = trpc.family.specialAssets.list.useQuery();
  const policies = trpc.family.insurance.list.useQuery();
  const claims = trpc.family.insurance.claims.useQuery();
  const accounts = trpc.family.accounts.list.useQuery();
  const categories = trpc.family.cashFlow.categories.useQuery();

  const [assetAccountId, setAssetAccountId] = useState("");
  const [assetType, setAssetType] = useState<"real_estate" | "gold" | "commodity" | "other">("real_estate");
  const [assetName, setAssetName] = useState("");
  const [assetQuantity, setAssetQuantity] = useState("");
  const [assetUnit, setAssetUnit] = useState("");
  const [assetDetails, setAssetDetails] = useState("");
  const [assetOwnershipType, setAssetOwnershipType] = useState<"sole" | "joint" | "usufruct" | "other">("sole");
  const [assetOwnershipShare, setAssetOwnershipShare] = useState("100");
  const [assetAcquisitionDate, setAssetAcquisitionDate] = useState("");
  const [assetAcquisitionCost, setAssetAcquisitionCost] = useState("");
  const [assetAcquisitionCurrency, setAssetAcquisitionCurrency] = useState("EGP");
  const [assetLocation, setAssetLocation] = useState("");
  const [assetMarketSymbol, setAssetMarketSymbol] = useState("GC=F");
  const [assetPurity, setAssetPurity] = useState("");
  const [assetValuationMethod, setAssetValuationMethod] = useState<"ledger_balance" | "market_quote" | "manual" | "appraisal">("ledger_balance");
  const [assetValuationSource, setAssetValuationSource] = useState("");
  const [assetValuationDate, setAssetValuationDate] = useState("");
  const [assetValuationNote, setAssetValuationNote] = useState("");

  const [revaluationAssetId, setRevaluationAssetId] = useState("");
  const [revaluationTarget, setRevaluationTarget] = useState("");
  const [revaluationDate, setRevaluationDate] = useState(isoDateInput);
  const [revaluationMemo, setRevaluationMemo] = useState("");

  const [policyName, setPolicyName] = useState("");
  const [policyType, setPolicyType] = useState<"health" | "life" | "property" | "motor" | "other">("health");
  const [insurer, setInsurer] = useState("");
  const [policyNumber, setPolicyNumber] = useState("");
  const [coverageAmount, setCoverageAmount] = useState("");
  const [policyCurrency, setPolicyCurrency] = useState("EGP");
  const [premiumAmount, setPremiumAmount] = useState("");
  const [premiumCadence, setPremiumCadence] = useState<"monthly" | "quarterly" | "yearly" | "other">("yearly");
  const [policyCategoryId, setPolicyCategoryId] = useState("");
  const [policyStartsAt, setPolicyStartsAt] = useState("");
  const [policyEndsAt, setPolicyEndsAt] = useState("");
  const [beneficiaries, setBeneficiaries] = useState("");
  const [claimsNote, setClaimsNote] = useState("");
  const [policyRenewalAt, setPolicyRenewalAt] = useState("");
  const [policyDueDay, setPolicyDueDay] = useState("");
  const [deductibleAmount, setDeductibleAmount] = useState("");
  const [deductibleCurrency, setDeductibleCurrency] = useState("EGP");
  const [providerContact, setProviderContact] = useState("");
  const [policyTerms, setPolicyTerms] = useState("");

  const [claimPolicyId, setClaimPolicyId] = useState("");
  const [claimReference, setClaimReference] = useState("");
  const [claimAmount, setClaimAmount] = useState("");
  const [claimDate, setClaimDate] = useState(isoDateInput);
  const [claimExpectedDate, setClaimExpectedDate] = useState("");
  const [claimNote, setClaimNote] = useState("");

  const [premiumPolicyId, setPremiumPolicyId] = useState("");
  const [premiumAccountId, setPremiumAccountId] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMemo, setPaymentMemo] = useState("");

  useEffect(() => {
    const raw = sessionStorage.getItem("family-gold-revaluation-draft");
    if (!raw) return;
    try {
      const draft = JSON.parse(raw) as { assetId?: number; targetValue?: string; memo?: string };
      if (Number.isInteger(draft.assetId) && draft.targetValue) {
        setRevaluationAssetId(String(draft.assetId));
        setRevaluationTarget(draft.targetValue);
        setRevaluationMemo(draft.memo || "");
        setAssetTab("revaluation");
      }
    } finally {
      sessionStorage.removeItem("family-gold-revaluation-draft");
    }
  }, []);

  const createAsset = trpc.family.specialAssets.create.useMutation({
    onSuccess: () => {
      toast.success("تم حفظ سجل الأصل ضمن نطاقك. تبقى قيمته مستمدة من حساب الأصل المقيد.");
      setAssetAccountId("");
      setAssetName("");
      setAssetQuantity("");
      setAssetUnit("");
      setAssetDetails("");
      setAssetOwnershipType("sole");
      setAssetOwnershipShare("100");
      setAssetAcquisitionDate("");
      setAssetAcquisitionCost("");
      setAssetLocation("");
      setAssetMarketSymbol("GC=F");
      setAssetPurity("");
      setAssetValuationMethod("ledger_balance");
      setAssetValuationSource("");
      setAssetValuationDate("");
      setAssetValuationNote("");
      void utils.family.specialAssets.list.invalidate();
    },
    onError: error => toast.error(textError(error)),
  });

  const revalueAsset = trpc.family.specialAssets.revalue.useMutation({
    onSuccess: data => {
      toast.success(data.direction === "increase" ? "نُشرت زيادة التقييم في دفتر الأصول." : "نُشرت خفضة التقييم في دفتر الأصول.");
      setRevaluationTarget("");
      setRevaluationMemo("");
      void utils.family.specialAssets.list.invalidate();
      void utils.family.accounts.list.invalidate();
      void utils.family.dashboard.invalidate();
      void utils.family.ledger.recent.invalidate();
    },
    onError: error => toast.error(textError(error)),
  });

  const createPolicy = trpc.family.insurance.create.useMutation({
    onSuccess: () => {
      toast.success("تم حفظ بوليصة التأمين. لا يُسجل قسط مالي إلا عند نشر دفعة صريحة.");
      setPolicyName("");
      setInsurer("");
      setPolicyNumber("");
      setCoverageAmount("");
      setPremiumAmount("");
      setPolicyCategoryId("");
      setPolicyStartsAt("");
      setPolicyEndsAt("");
      setBeneficiaries("");
      setClaimsNote("");
      setPolicyRenewalAt("");
      setPolicyDueDay("");
      setDeductibleAmount("");
      setProviderContact("");
      setPolicyTerms("");
      void utils.family.insurance.list.invalidate();
    },
    onError: error => toast.error(textError(error)),
  });

  const postPremium = trpc.family.insurance.postPremium.useMutation({
    onSuccess: () => {
      toast.success("نُشر قسط التأمين كمصروف مصنف وقيد متوازن.");
      setPremiumAccountId("");
      setPaymentAmount("");
      setPaymentMemo("");
      void utils.family.insurance.list.invalidate();
      void utils.family.accounts.list.invalidate();
      void utils.family.dashboard.invalidate();
      void utils.family.ledger.recent.invalidate();
      void utils.family.cashFlow.summary.invalidate();
    },
    onError: error => toast.error(textError(error)),
  });

  const createClaim = trpc.family.insurance.createClaim.useMutation({
    onSuccess: () => {
      toast.success("سُجلت المطالبة بحالة مقدمة؛ لا تُعتبر محصلة حتى ربطها بدخل منشور.");
      setClaimPolicyId("");
      setClaimReference("");
      setClaimAmount("");
      setClaimExpectedDate("");
      setClaimNote("");
      void utils.family.insurance.claims.invalidate();
      void utils.family.insurance.list.invalidate();
    },
    onError: error => toast.error(textError(error)),
  });

  const assetAccounts = (accounts.data ?? []).filter(account => account.accountType === "asset");
  const usedAssetAccountIds = new Set((assets.data ?? []).map(asset => asset.accountId));
  const availableAssetAccounts = assetAccounts.filter(account => !usedAssetAccountIds.has(account.id));
  const expenseCategories = (categories.data ?? []).filter(category => category.direction === "expense");
  const selectedRevaluationAsset = assets.data?.find(asset => String(asset.id) === revaluationAssetId);
  const selectedPolicy = policies.data?.find(policy => String(policy.id) === premiumPolicyId);
  const workspaceBaseCurrency = bootstrap.data?.workspace.baseCurrency ?? "EGP";
  const eligiblePaymentAccounts = (accounts.data ?? []).filter(
    account => ["cash", "bank", "brokerage", "wallet"].includes(account.accountType) && account.currency === selectedPolicy?.currency
  );

  const submitAsset = (event: React.FormEvent) => {
    event.preventDefault();
    if (!assetAccountId) return toast.error("أنشئ أو اختر حساب أصل نشطًا قبل إضافة السجل.");
    createAsset.mutate({
      assetAccountId: Number(assetAccountId),
      assetType,
      name: assetName,
      quantity: assetQuantity || null,
      unit: assetUnit || null,
      ownershipType: assetOwnershipType,
      ownershipShare: assetOwnershipShare,
      acquisitionDate: assetAcquisitionDate ? Date.parse(`${assetAcquisitionDate}T00:00:00.000Z`) : null,
      acquisitionCost: assetAcquisitionCost || null,
      acquisitionCurrency: assetAcquisitionCost ? assetAcquisitionCurrency : null,
      location: assetLocation || null,
      marketSymbol: assetMarketSymbol || null,
      purity: assetPurity || null,
      valuationMethod: assetValuationMethod,
      valuationSource: assetValuationSource || null,
      valuationAsOf: assetValuationDate ? Date.parse(`${assetValuationDate}T00:00:00.000Z`) : null,
      valuationNote: assetValuationNote || null,
      details: assetDetails || null,
    });
  };

  const submitRevaluation = (event: React.FormEvent) => {
    event.preventDefault();
    if (!revaluationAssetId || !revaluationDate) return toast.error("اختر الأصل وتاريخ التقييم.");
    revalueAsset.mutate({
      assetId: Number(revaluationAssetId),
      targetValue: revaluationTarget,
      occurredAt: Date.parse(`${revaluationDate}T00:00:00.000Z`),
      memo: revaluationMemo || null,
      idempotencyKey: crypto.randomUUID(),
    });
  };

  const submitPolicy = (event: React.FormEvent) => {
    event.preventDefault();
    createPolicy.mutate({
      name: policyName,
      policyType,
      insurer: insurer || null,
      policyNumber: policyNumber || null,
      coverageAmount: coverageAmount || null,
      currency: policyCurrency,
      premiumAmount: premiumAmount || null,
      premiumCadence: premiumAmount ? premiumCadence : null,
      cashFlowCategoryId: policyCategoryId ? Number(policyCategoryId) : null,
      startsAt: policyStartsAt ? Date.parse(`${policyStartsAt}T00:00:00.000Z`) : null,
      endsAt: policyEndsAt ? Date.parse(`${policyEndsAt}T00:00:00.000Z`) : null,
      renewalAt: policyRenewalAt ? Date.parse(`${policyRenewalAt}T00:00:00.000Z`) : null,
      premiumDueDay: policyDueDay ? Number(policyDueDay) : null,
      deductibleAmount: deductibleAmount || null,
      deductibleCurrency: deductibleAmount ? deductibleCurrency : null,
      providerContact: providerContact || null,
      policyTerms: policyTerms || null,
      beneficiaries: beneficiaries || null,
      claimsNote: claimsNote || null,
    });
  };

  const submitPremium = (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedPolicy || !premiumAccountId) return toast.error("اختر بوليصة وحساب دفع متوافقين.");
    postPremium.mutate({
      policyId: selectedPolicy.id,
      cashAccountId: Number(premiumAccountId),
      amount: paymentAmount,
      occurredAt: Date.now(),
      memo: paymentMemo || null,
      idempotencyKey: crypto.randomUUID(),
    });
  };

  const submitClaim = (event: React.FormEvent) => {
    event.preventDefault();
    if (!claimPolicyId) return toast.error("اختر البوليصة المرتبطة بالمطالبة.");
    createClaim.mutate({
      policyId: Number(claimPolicyId),
      referenceNumber: claimReference || null,
      claimedAmount: claimAmount,
      submittedAt: Date.parse(`${claimDate}T00:00:00.000Z`),
      expectedAt: claimExpectedDate ? Date.parse(`${claimExpectedDate}T00:00:00.000Z`) : null,
      note: claimNote || null,
    });
  };

  return (
    <DashboardLayout>
      <div dir="rtl" className="family-assets-page mx-auto max-w-7xl space-y-6" data-active-tab={assetTab}>
        <PageHeader
          title="الأصول الخاصة والتأمين"
          description="تربط هذه الوحدة الأصل بحساب أصول مقيد، وتوثق وثيقة التأمين بصورة مستقلة. إعادة التقييم أو دفع القسط ينشئان عملية دفتر وسجل تدقيق؛ لا تُضاف قيمة أو نفقة مباشرة من الواجهة."
          breadcrumbs={[
            { label: "الرئيسية", href: "/" },
            { label: "الثروة والأصول", href: "/investments" },
            { label: "الأصول الخاصة والتأمين" },
          ]}
          badge={{ text: "حماية وأصول عينية", variant: "institutional" }}
          icon={ShieldCheck}
        />
        <Tabs value={assetTab} onValueChange={value => setAssetTab(value as "registry" | "revaluation" | "insurance")} className="space-y-6">
          <TabsList className="family-assets-tabs-institutional">
            <TabsTrigger value="registry" className="family-assets-tab-trigger">سجل الأصول وحيازتها</TabsTrigger>
            <TabsTrigger value="revaluation" className="family-assets-tab-trigger">إعادة التقييم والقيمة السوقية</TabsTrigger>
            <TabsTrigger value="insurance" className="family-assets-tab-trigger">وثائق ومطالبات التأمين</TabsTrigger>
          </TabsList>

          <TabsContent value="registry" className="space-y-6">
            <section className="grid gap-6 xl:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>إضافة أصل خاص</CardTitle>
                  <CardDescription>
                    أنشئ حساب أصل برصيد افتتاحي مقيد من صفحة الحسابات، ثم اربطه بسجل عقار أو ذهب أو سلعة. لا يُستخدم السجل لإدخال قيمة مستقلة.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {accounts.isLoading || assets.isLoading ? (
                    <Skeleton className="h-[31rem]" />
                  ) : (
                    <form onSubmit={submitAsset} className="grid gap-4">
                      <div className="grid gap-2">
                        <Label>حساب الأصل</Label>
                        <Select value={assetAccountId} onValueChange={setAssetAccountId} disabled={!access.canEdit || !availableAssetAccounts.length}>
                          <SelectTrigger>
                            <SelectValue placeholder={availableAssetAccounts.length ? "اختر حساب الأصل" : "لا يوجد حساب أصل متاح"} />
                          </SelectTrigger>
                          <SelectContent>
                            {availableAssetAccounts.map(account => (
                              <SelectItem value={String(account.id)} key={account.id}>
                                {account.name} — {money(account.balance, account.currency)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {!availableAssetAccounts.length && (
                          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200/80 bg-amber-50/70 dark:bg-amber-950/30 dark:border-amber-800/60 p-4 text-xs text-amber-900 dark:text-amber-200 shadow-2xs">
                            <span>تحتاج إلى حساب نوعه «أصل» قبل إنشاء السجل، أو أن الحسابات المتاحة مرتبطة بالفعل بأصول أخرى.</span>
                            <button
                              type="button"
                              onClick={() => setLocation("/accounts")}
                              className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold text-xs px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shrink-0"
                            >
                              إلى الحسابات
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="grid gap-2 sm:grid-cols-2">
                        <div className="grid gap-2">
                          <Label htmlFor="private-asset-name">اسم الأصل</Label>
                          <Input id="private-asset-name" value={assetName} onChange={event => setAssetName(event.target.value)} disabled={!access.canEdit} minLength={2} required />
                        </div>
                        <div className="grid gap-2">
                          <Label>النوع</Label>
                          <Select value={assetType} onValueChange={value => setAssetType(value as typeof assetType)} disabled={!access.canEdit}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {Object.entries(specialAssetTypeLabel).map(([value, label]) => (
                                <SelectItem key={value} value={value}>{label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="grid gap-2 sm:grid-cols-2">
                        <div className="grid gap-2">
                          <Label htmlFor="private-asset-quantity">الكمية</Label>
                          <Input id="private-asset-quantity" value={assetQuantity} onChange={event => setAssetQuantity(event.target.value)} disabled={!access.canEdit} inputMode="decimal" placeholder="اختياري" />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="private-asset-unit">الوحدة</Label>
                          <Input id="private-asset-unit" value={assetUnit} onChange={event => setAssetUnit(event.target.value)} disabled={!access.canEdit} maxLength={48} placeholder="مثال: جرام أو متر²" />
                        </div>
                      </div>

                      <div className="grid gap-2 sm:grid-cols-3">
                        <div className="grid gap-2">
                          <Label>نوع الملكية</Label>
                          <Select value={assetOwnershipType} onValueChange={value => setAssetOwnershipType(value as typeof assetOwnershipType)} disabled={!access.canEdit}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="sole">ملكية كاملة</SelectItem>
                              <SelectItem value="joint">ملكية مشتركة</SelectItem>
                              <SelectItem value="usufruct">حق انتفاع</SelectItem>
                              <SelectItem value="other">أخرى</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="private-asset-share">نسبة الملكية %</Label>
                          <Input id="private-asset-share" value={assetOwnershipShare} onChange={event => setAssetOwnershipShare(event.target.value)} disabled={!access.canEdit} inputMode="decimal" required />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="private-asset-location">الموقع</Label>
                          <Input id="private-asset-location" value={assetLocation} onChange={event => setAssetLocation(event.target.value)} disabled={!access.canEdit} maxLength={255} placeholder="مدينة أو وصف مختصر" />
                        </div>
                      </div>

                      <div className="grid gap-2 sm:grid-cols-3">
                        <div className="grid gap-2">
                          <Label htmlFor="private-asset-acquisition-date">تاريخ الاقتناء</Label>
                          <Input id="private-asset-acquisition-date" type="date" value={assetAcquisitionDate} onChange={event => setAssetAcquisitionDate(event.target.value)} disabled={!access.canEdit} />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="private-asset-acquisition-cost">تكلفة الاقتناء</Label>
                          <Input id="private-asset-acquisition-cost" value={assetAcquisitionCost} onChange={event => setAssetAcquisitionCost(event.target.value)} disabled={!access.canEdit} inputMode="decimal" />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="private-asset-acquisition-currency">عملة التكلفة</Label>
                          <Input id="private-asset-acquisition-currency" value={assetAcquisitionCurrency} onChange={event => setAssetAcquisitionCurrency(event.target.value.toUpperCase())} disabled={!access.canEdit || !assetAcquisitionCost} minLength={3} maxLength={3} />
                        </div>
                      </div>

                      <div className="grid gap-2 sm:grid-cols-3">
                        <div className="grid gap-2">
                          <Label htmlFor="private-asset-market-symbol">رمز السوق</Label>
                          <Input id="private-asset-market-symbol" value={assetMarketSymbol} onChange={event => setAssetMarketSymbol(event.target.value.toUpperCase())} disabled={!access.canEdit} maxLength={48} placeholder="GC=F للذهب" />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="private-asset-purity">النقاوة %</Label>
                          <Input id="private-asset-purity" value={assetPurity} onChange={event => setAssetPurity(event.target.value)} disabled={!access.canEdit || assetType !== "gold"} inputMode="decimal" placeholder="مثال 99.9" />
                        </div>
                        <div className="grid gap-2">
                          <Label>منهجية التقييم</Label>
                          <Select value={assetValuationMethod} onValueChange={value => setAssetValuationMethod(value as typeof assetValuationMethod)} disabled={!access.canEdit}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="ledger_balance">رصيد الدفتر</SelectItem>
                              <SelectItem value="market_quote">سعر سوق</SelectItem>
                              <SelectItem value="manual">يدوي</SelectItem>
                              <SelectItem value="appraisal">تقييم خبير</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="grid gap-2">
                        <Label htmlFor="private-asset-details">وصف أو ملاحظات الملكية</Label>
                        <Textarea id="private-asset-details" value={assetDetails} onChange={event => setAssetDetails(event.target.value)} disabled={!access.canEdit} maxLength={4000} placeholder="اختياري؛ لا تحفظ مستندات أو أرقام حساسة في هذا الحقل" />
                      </div>

                      <div className="grid gap-2 sm:grid-cols-2">
                        <div className="grid gap-2">
                          <Label htmlFor="private-asset-valuation-source">مصدر التقييم</Label>
                          <Input id="private-asset-valuation-source" value={assetValuationSource} onChange={event => setAssetValuationSource(event.target.value)} disabled={!access.canEdit} maxLength={255} placeholder="مصدر أو اسم خبير" />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="private-asset-valuation-date">تاريخ التقييم</Label>
                          <Input id="private-asset-valuation-date" type="date" value={assetValuationDate} onChange={event => setAssetValuationDate(event.target.value)} disabled={!access.canEdit} />
                        </div>
                      </div>

                      <div className="grid gap-2">
                        <Label htmlFor="private-asset-valuation-note">ملاحظة التقييم</Label>
                        <Textarea id="private-asset-valuation-note" value={assetValuationNote} onChange={event => setAssetValuationNote(event.target.value)} disabled={!access.canEdit} maxLength={4000} placeholder="لماذا اختيرت هذه المنهجية؟" />
                      </div>

                      <button
                        type="submit"
                        disabled={createAsset.isPending || !access.canEdit || !availableAssetAccounts.length}
                        className="w-full bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:hover:bg-slate-100 dark:text-slate-950 font-bold text-xs py-2.5 px-4 rounded-xl shadow-sm border border-slate-900 dark:border-transparent transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        {createAsset.isPending && <Loader2 className="ml-2 size-4 animate-spin" />}
                        {access.canEdit ? "حفظ سجل الأصل" : "تتطلب صلاحية محرر"}
                      </button>
                    </form>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>سجل الأصول الخاصة</CardTitle>
                  <CardDescription>
                    القيمة الظاهرة هي رصيد حساب الأصل من دفتر القيود، لا قيمة نصية مكررة في سجل الأصل.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {assets.isLoading ? (
                    <Skeleton className="h-56" />
                  ) : assets.error ? (
                    <InlineError message={textError(assets.error)} />
                  ) : assets.data?.length ? (
                    <div className="space-y-3">
                      {assets.data.map(asset => (
                        <div key={asset.id} className="rounded-xl border border-slate-200/90 dark:border-slate-800/80 bg-white dark:bg-[#0E1420] p-4">
                          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="font-semibold text-slate-900 dark:text-white">{asset.name}</p>
                                <Badge variant="secondary">{specialAssetTypeLabel[asset.assetType]}</Badge>
                              </div>
                              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                                الحساب: {asset.accountName} · {asset.currency}
                              </p>
                              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                {asset.quantity ? `${asset.quantity} ${asset.unit || "وحدة"}` : "لا توجد كمية مسجلة"}
                                {asset.details ? ` · ${asset.details}` : ""}
                              </p>
                              {asset.location ? <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">الموقع: {asset.location}</p> : null}
                              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                الملكية: {asset.ownershipShare}% · {asset.ownershipType === "sole" ? "كاملة" : asset.ownershipType === "joint" ? "مشتركة" : asset.ownershipType === "usufruct" ? "حق انتفاع" : "أخرى"}
                              </p>
                            </div>
                            <div className="text-right sm:text-left">
                              <p className="text-xs text-slate-500 dark:text-slate-400">الرصيد المقيد</p>
                              <p className="mt-1 font-semibold text-emerald-700 dark:text-emerald-400">{money(asset.balance, asset.currency)}</p>
                              {asset.baseValue !== null ? (
                                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{money(asset.baseValue, workspaceBaseCurrency)}</p>
                              ) : (
                                <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">يحتاج سعر صرف</p>
                              )}
                              {asset.latestValuation ? (
                                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                  آخر تقييم: {money(asset.latestValuation.value, asset.latestValuation.currency)} · {asset.latestValuation.source}
                                </p>
                              ) : (
                                <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">لا يوجد تقييم provenance</p>
                              )}
                              <Badge className="mt-2" variant={asset.valuationStatus === "current" ? "secondary" : "outline"}>
                                {asset.valuationStatus === "current" ? "تقييم حالي" : asset.valuationStatus === "review_required" ? "يتطلب مراجعة" : "دفتر/غير مقيم"}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-10 text-center">
                      <div className="size-12 rounded-2xl bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-center mx-auto mb-3">
                        <BriefcaseBusiness className="size-5" />
                      </div>
                      <p className="text-sm font-bold text-slate-800 dark:text-slate-200">لا توجد أصول خاصة مسجلة</p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 max-w-xs">
                        أنشئ حساب أصل مقيد ثم أضف سجل العقار أو الذهب أو السلعة من نموذج الإدخال أعلاه.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </section>
          </TabsContent>

          <TabsContent value="revaluation" className="space-y-6">
            <GoldYahooSuggestionCard />
            <section className="grid gap-6 xl:grid-cols-1">
              <Card>
                <CardHeader>
                  <CardTitle>إعادة تقييم موثقة</CardTitle>
                  <CardDescription>
                    أدخل القيمة الجديدة للأصل في عملة حسابه. ينشئ النظام قيد مكسب أو خسارة تقييم متوازن ولا ينفذ شراءً أو بيعًا.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {assets.isLoading ? (
                    <Skeleton className="h-[31rem]" />
                  ) : (
                    <form onSubmit={submitRevaluation} className="grid gap-4">
                      <div className="grid gap-2">
                        <Label>الأصل</Label>
                        <Select
                          value={revaluationAssetId}
                          onValueChange={value => {
                            setRevaluationAssetId(value);
                            const asset = assets.data?.find(item => String(item.id) === value);
                            setRevaluationTarget(asset?.balance ?? "");
                          }}
                          disabled={!access.canAdvise}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="اختر أصلًا مسجلًا" />
                          </SelectTrigger>
                          <SelectContent>
                            {assets.data?.filter(asset => asset.status === "active").map(asset => (
                              <SelectItem key={asset.id} value={String(asset.id)}>
                                {asset.name} — {money(asset.balance, asset.currency)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {selectedRevaluationAsset ? (
                        <div className="rounded-xl border border-slate-200/80 dark:border-slate-700/80 bg-slate-50 dark:bg-[#0E1420] p-4 text-sm">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <span className="font-semibold text-slate-900 dark:text-white">القيمة المقيدة حاليًا</span>
                            <span className="font-semibold text-emerald-700 dark:text-emerald-400">{money(selectedRevaluationAsset.balance, selectedRevaluationAsset.currency)}</span>
                          </div>
                          <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
                            التقييم بعملة الحساب: {selectedRevaluationAsset.currency}
                            {selectedRevaluationAsset.baseValue !== null
                              ? ` · القيمة بعملة الأساس: ${money(selectedRevaluationAsset.baseValue, workspaceBaseCurrency)}`
                              : " · يلزم سعر صرف لتقييم القيمة الأساسية"}
                            .
                          </p>
                        </div>
                      ) : (
                        <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-700 p-4 text-sm text-slate-500 dark:text-slate-400">
                          اختر أصلًا لعرض قيمته الدفترية قبل إنشاء التعديل.
                        </div>
                      )}

                      <div className="grid gap-2 sm:grid-cols-2">
                        <div className="grid gap-2">
                          <Label htmlFor="private-asset-target">قيمة التقييم الجديدة</Label>
                          <Input id="private-asset-target" value={revaluationTarget} onChange={event => setRevaluationTarget(event.target.value)} disabled={!access.canAdvise} inputMode="decimal" required />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="private-asset-date">تاريخ التقييم</Label>
                          <Input id="private-asset-date" type="date" value={revaluationDate} onChange={event => setRevaluationDate(event.target.value)} disabled={!access.canAdvise} required />
                        </div>
                      </div>

                      <div className="grid gap-2">
                        <Label htmlFor="private-revaluation-note">مرجع أو ملاحظة التقييم</Label>
                        <Textarea id="private-revaluation-note" value={revaluationMemo} onChange={event => setRevaluationMemo(event.target.value)} disabled={!access.canAdvise} maxLength={2000} placeholder="مثال: تقييم خبير مؤرخ أو سعر سوق موثق" />
                      </div>

                      <button
                        type="submit"
                        disabled={revalueAsset.isPending || !access.canAdvise || !revaluationAssetId}
                        className="w-full bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:hover:bg-slate-100 dark:text-slate-950 font-bold text-xs py-2.5 px-4 rounded-xl shadow-sm border border-slate-900 dark:border-transparent transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        {revalueAsset.isPending && <Loader2 className="ml-2 size-4 animate-spin" />}
                        {access.canAdvise ? "نشر إعادة التقييم" : "تتطلب صلاحية مستشار"}
                      </button>
                    </form>
                  )}
                </CardContent>
              </Card>
            </section>
          </TabsContent>

          <TabsContent value="insurance" className="space-y-6">
            <section className="grid gap-6 xl:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>إضافة وثيقة تأمين</CardTitle>
                  <CardDescription>
                    الوثيقة سجل تغطية فقط. اختر فئة مصروف إن أردت ربط أقساطها اللاحقة بالتدفق النقدي الفعلي.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {categories.isLoading ? (
                    <Skeleton className="h-[35rem]" />
                  ) : (
                    <form onSubmit={submitPolicy} className="grid gap-4">
                      <div className="grid gap-2 sm:grid-cols-2">
                        <div className="grid gap-2">
                          <Label htmlFor="policy-name">اسم الوثيقة</Label>
                          <Input id="policy-name" value={policyName} onChange={event => setPolicyName(event.target.value)} disabled={!access.canEdit} required minLength={2} />
                        </div>
                        <div className="grid gap-2">
                          <Label>نوع التأمين</Label>
                          <Select value={policyType} onValueChange={value => setPolicyType(value as typeof policyType)} disabled={!access.canEdit}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {Object.entries(policyTypeLabel).map(([value, label]) => (
                                <SelectItem key={value} value={value}>{label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="grid gap-2 sm:grid-cols-2">
                        <div className="grid gap-2">
                          <Label htmlFor="policy-insurer">شركة التأمين</Label>
                          <Input id="policy-insurer" value={insurer} onChange={event => setInsurer(event.target.value)} disabled={!access.canEdit} maxLength={160} />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="policy-number">رقم الوثيقة</Label>
                          <Input id="policy-number" value={policyNumber} onChange={event => setPolicyNumber(event.target.value)} disabled={!access.canEdit} maxLength={160} />
                        </div>
                      </div>

                      <div className="grid gap-2 sm:grid-cols-3">
                        <div className="grid gap-2">
                          <Label htmlFor="policy-coverage">قيمة التغطية</Label>
                          <Input id="policy-coverage" value={coverageAmount} onChange={event => setCoverageAmount(event.target.value)} disabled={!access.canEdit} inputMode="decimal" />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="policy-currency">العملة</Label>
                          <Input id="policy-currency" value={policyCurrency} onChange={event => setPolicyCurrency(event.target.value.toUpperCase())} disabled={!access.canEdit} minLength={3} maxLength={3} required />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="policy-premium">القسط المتوقع</Label>
                          <Input id="policy-premium" value={premiumAmount} onChange={event => setPremiumAmount(event.target.value)} disabled={!access.canEdit} inputMode="decimal" />
                        </div>
                      </div>

                      <div className="grid gap-2 sm:grid-cols-2">
                        <div className="grid gap-2">
                          <Label>دورية القسط</Label>
                          <Select value={premiumCadence} onValueChange={value => setPremiumCadence(value as typeof premiumCadence)} disabled={!access.canEdit || !premiumAmount}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {Object.entries(premiumCadenceLabel).map(([value, label]) => (
                                <SelectItem key={value} value={value}>{label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid gap-2">
                          <Label>فئة قسط التأمين</Label>
                          <Select value={policyCategoryId || undefined} onValueChange={setPolicyCategoryId} disabled={!access.canEdit}>
                            <SelectTrigger><SelectValue placeholder="اختياري؛ فئة مصروف" /></SelectTrigger>
                            <SelectContent>
                              {expenseCategories.map(category => (
                                <SelectItem key={category.id} value={String(category.id)}>{category.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="grid gap-2 sm:grid-cols-2">
                        <div className="grid gap-2">
                          <Label htmlFor="policy-start">تاريخ البداية</Label>
                          <Input id="policy-start" type="date" value={policyStartsAt} onChange={event => setPolicyStartsAt(event.target.value)} disabled={!access.canEdit} />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="policy-end">تاريخ الانتهاء</Label>
                          <Input id="policy-end" type="date" value={policyEndsAt} onChange={event => setPolicyEndsAt(event.target.value)} disabled={!access.canEdit} min={policyStartsAt || undefined} />
                        </div>
                      </div>

                      <div className="grid gap-2 sm:grid-cols-3">
                        <div className="grid gap-2">
                          <Label htmlFor="policy-renewal">تاريخ التجديد</Label>
                          <Input id="policy-renewal" type="date" value={policyRenewalAt} onChange={event => setPolicyRenewalAt(event.target.value)} disabled={!access.canEdit} min={policyStartsAt || undefined} max={policyEndsAt || undefined} />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="policy-due-day">يوم استحقاق القسط</Label>
                          <Input id="policy-due-day" type="number" min="1" max="31" value={policyDueDay} onChange={event => setPolicyDueDay(event.target.value)} disabled={!access.canEdit || !premiumAmount} placeholder="1–31" />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="policy-provider-contact">بيانات المزود</Label>
                          <Input id="policy-provider-contact" value={providerContact} onChange={event => setProviderContact(event.target.value)} disabled={!access.canEdit} maxLength={255} placeholder="هاتف أو بريد" />
                        </div>
                      </div>

                      <div className="grid gap-2 sm:grid-cols-3">
                        <div className="grid gap-2">
                          <Label htmlFor="policy-deductible">قيمة التحمل</Label>
                          <Input id="policy-deductible" value={deductibleAmount} onChange={event => setDeductibleAmount(event.target.value)} disabled={!access.canEdit} inputMode="decimal" />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="policy-deductible-currency">عملة التحمل</Label>
                          <Input id="policy-deductible-currency" value={deductibleCurrency} onChange={event => setDeductibleCurrency(event.target.value.toUpperCase())} disabled={!access.canEdit || !deductibleAmount} minLength={3} maxLength={3} />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="policy-terms">الشروط المختصرة</Label>
                          <Input id="policy-terms" value={policyTerms} onChange={event => setPolicyTerms(event.target.value)} disabled={!access.canEdit} maxLength={12000} placeholder="استثناءات أو ملاحظات" />
                        </div>
                      </div>

                      <div className="grid gap-2">
                        <Label htmlFor="policy-beneficiaries">المستفيدون</Label>
                        <Textarea id="policy-beneficiaries" value={beneficiaries} onChange={event => setBeneficiaries(event.target.value)} disabled={!access.canEdit} maxLength={4000} placeholder="اختياري" />
                      </div>

                      <div className="grid gap-2">
                        <Label htmlFor="policy-claims">ملاحظات المطالبات</Label>
                        <Textarea id="policy-claims" value={claimsNote} onChange={event => setClaimsNote(event.target.value)} disabled={!access.canEdit} maxLength={4000} placeholder="اختياري" />
                      </div>

                      <button
                        type="submit"
                        disabled={createPolicy.isPending || !access.canEdit}
                        className="w-full bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:hover:bg-slate-100 dark:text-slate-950 font-bold text-xs py-2.5 px-4 rounded-xl shadow-sm border border-slate-900 dark:border-transparent transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        {createPolicy.isPending && <Loader2 className="ml-2 size-4 animate-spin" />}
                        {access.canEdit ? "حفظ الوثيقة" : "تتطلب صلاحية محرر"}
                      </button>
                    </form>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>وثائق التأمين</CardTitle>
                  <CardDescription>
                    يعرض السجل التغطية والقسط المخطط وآخر قسط منشور فقط؛ لا يفترض استحقاقًا أو دفعًا تلقائيًا.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {policies.isLoading ? (
                    <Skeleton className="h-64" />
                  ) : policies.error ? (
                    <InlineError message={textError(policies.error)} />
                  ) : policies.data?.length ? (
                    <div className="space-y-3">
                      {policies.data.map(policy => (
                        <div key={policy.id} className="rounded-xl border border-slate-200/90 dark:border-slate-800/80 bg-white dark:bg-[#0E1420] p-4">
                          <div className="flex flex-col justify-between gap-3 sm:flex-row">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="font-semibold text-slate-900 dark:text-white">{policy.name}</p>
                                <Badge variant="secondary">{policyTypeLabel[policy.policyType]}</Badge>
                                <Badge variant="outline">{policy.status === "active" ? "نشطة" : policy.status === "expired" ? "منتهية" : "مؤرشفة"}</Badge>
                              </div>
                              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                                {policy.insurer || "جهة غير محددة"}{policy.policyNumber ? ` · وثيقة ${policy.policyNumber}` : ""}
                              </p>
                              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                تغطية: {policy.coverageAmount ? money(policy.coverageAmount, policy.currency) : "غير مسجلة"} · قسط متوقع: {policy.premiumAmount ? `${money(policy.premiumAmount, policy.currency)}${policy.premiumCadence ? ` / ${premiumCadenceLabel[policy.premiumCadence]}` : ""}` : "غير مسجل"}
                              </p>
                              {policy.startsAt || policy.endsAt ? (
                                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                  {policy.startsAt ? `تبدأ ${utcDateInput(policy.startsAt)}` : ""}
                                  {policy.startsAt && policy.endsAt ? " · " : ""}
                                  {policy.endsAt ? `تنتهي ${utcDateInput(policy.endsAt)}` : ""}
                                </p>
                              ) : null}
                              {policy.renewalAt ? (
                                <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                                  التجديد: {utcDateInput(policy.renewalAt)}{policy.premiumDueDay ? ` · يوم الاستحقاق ${policy.premiumDueDay}` : ""}
                                </p>
                              ) : null}
                              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                المطالبات: {policy.claimSummary.total} · مقدمة {policy.claimSummary.submitted} · محصلة {policy.claimSummary.paid}
                              </p>
                            </div>
                            <div className="rounded-lg bg-slate-50 dark:bg-[#0B0F17] border border-slate-200/70 dark:border-slate-800/80 p-3 text-xs text-slate-600 dark:text-slate-400">
                              {policy.latestPremiumPayment ? (
                                <>
                                  <p>آخر قسط منشور</p>
                                  <p className="mt-1 font-semibold text-slate-900 dark:text-white">
                                    {money(policy.latestPremiumPayment.amount, policy.latestPremiumPayment.currency)}
                                  </p>
                                  <p className="mt-1">{dateTime(policy.latestPremiumPayment.occurredAt)}</p>
                                </>
                              ) : (
                                <p>لم يُنشر قسط مالي بعد.</p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-10 text-center">
                      <div className="size-12 rounded-2xl bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-center mx-auto mb-3">
                        <Umbrella className="size-5" />
                      </div>
                      <p className="text-sm font-bold text-slate-800 dark:text-slate-200">لا توجد وثائق تأمين</p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 max-w-xs">
                        أضف وثيقة للتعامل مع التغطية والقسط المتوقع، ثم انشر أي قسط مدفوع من النموذج المجاور.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </section>

            <section className="grid gap-6 xl:grid-cols-1">
              <Card>
                <CardHeader>
                  <CardTitle>تسجيل سداد القسط</CardTitle>
                  <CardDescription>
                    ينشر القسط كمصروف مصنف من حساب دفع وبالعملة نفسها، مع ربطه بالوثيقة. لا تُنشأ دفعات متكررة تلقائيًا من هذه الشاشة.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {policies.isLoading || accounts.isLoading ? (
                    <Skeleton className="h-64" />
                  ) : (
                    <form onSubmit={submitPremium} className="grid gap-4">
                      <div className="grid gap-2">
                        <Label>الوثيقة</Label>
                        <Select
                          value={premiumPolicyId}
                          onValueChange={value => {
                            setPremiumPolicyId(value);
                            setPremiumAccountId("");
                            const policy = policies.data?.find(item => String(item.id) === value);
                            setPaymentAmount(policy?.premiumAmount ?? "");
                          }}
                          disabled={!access.canEdit}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="اختر وثيقة نشطة" />
                          </SelectTrigger>
                          <SelectContent>
                            {policies.data?.filter(policy => policy.status === "active").map(policy => (
                              <SelectItem key={policy.id} value={String(policy.id)}>
                                {policy.name} — {policy.currency}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {selectedPolicy && !selectedPolicy.cashFlowCategoryId ? (
                        <div className="rounded-lg border border-amber-200/80 bg-amber-50/70 dark:bg-amber-950/30 dark:border-amber-800/60 p-3 text-xs leading-5 text-amber-900 dark:text-amber-200">
                          هذه الوثيقة غير مرتبطة بفئة مصروف، لذا لا يمكن نشر قسط منها حتى تُنشأ وثيقة مرتبطة بفئة مناسبة. لا يضع النظام فئة افتراضية.
                        </div>
                      ) : null}

                      <div className="grid gap-2">
                        <Label>حساب الدفع</Label>
                        <Select value={premiumAccountId} onValueChange={setPremiumAccountId} disabled={!access.canEdit || !selectedPolicy || !selectedPolicy.cashFlowCategoryId}>
                          <SelectTrigger>
                            <SelectValue placeholder={selectedPolicy ? "اختر حساباً بنفس العملة" : "اختر الوثيقة أولًا"} />
                          </SelectTrigger>
                          <SelectContent>
                            {eligiblePaymentAccounts.map(account => (
                              <SelectItem key={account.id} value={String(account.id)}>
                                {account.name} — {money(account.balance, account.currency)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="grid gap-2">
                        <Label htmlFor="insurance-payment-amount">
                          المبلغ المدفوع {selectedPolicy ? `(${selectedPolicy.currency})` : ""}
                        </Label>
                        <Input
                          id="insurance-payment-amount"
                          value={paymentAmount}
                          onChange={event => setPaymentAmount(event.target.value)}
                          disabled={!access.canEdit || !selectedPolicy || !selectedPolicy.cashFlowCategoryId}
                          inputMode="decimal"
                          required
                        />
                      </div>

                      <div className="grid gap-2">
                        <Label htmlFor="insurance-payment-memo">مذكرة الدفع</Label>
                        <Textarea
                          id="insurance-payment-memo"
                          value={paymentMemo}
                          onChange={event => setPaymentMemo(event.target.value)}
                          disabled={!access.canEdit || !selectedPolicy || !selectedPolicy.cashFlowCategoryId}
                          maxLength={2000}
                          placeholder="اختياري؛ اسم الوثيقة يستخدم تلقائيًا عند تركه فارغًا"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={postPremium.isPending || !access.canEdit || !selectedPolicy || !selectedPolicy.cashFlowCategoryId || !premiumAccountId}
                        className="w-full bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:hover:bg-slate-100 dark:text-slate-950 font-bold text-xs py-2.5 px-4 rounded-xl shadow-sm border border-slate-900 dark:border-transparent transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        {postPremium.isPending && <Loader2 className="ml-2 size-4 animate-spin" />}
                        {access.canEdit ? "نشر قسط التأمين" : "تتطلب صلاحية محرر"}
                      </button>
                    </form>
                  )}
                </CardContent>
              </Card>
            </section>

            <section className="grid gap-6 xl:grid-cols-[.8fr_1.2fr]">
              <Card>
                <CardHeader>
                  <CardTitle>تسجيل مطالبة</CardTitle>
                  <CardDescription>
                    تُحفظ المطالبة كسجل متابعة فقط. لا تصبح محصلة إلا عند ربطها بحركة دخل منشورة بنفس العملة.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={submitClaim} className="grid gap-4">
                    <div className="grid gap-2">
                      <Label>البوليصة</Label>
                      <Select value={claimPolicyId} onValueChange={setClaimPolicyId} disabled={!access.canEdit}>
                        <SelectTrigger>
                          <SelectValue placeholder="اختر بوليصة نشطة" />
                        </SelectTrigger>
                        <SelectContent>
                          {policies.data?.filter(policy => policy.status === "active").map(policy => (
                            <SelectItem key={policy.id} value={String(policy.id)}>
                              {policy.name} — {policy.currency}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="grid gap-2">
                        <Label htmlFor="claim-amount">قيمة المطالبة</Label>
                        <Input id="claim-amount" value={claimAmount} onChange={event => setClaimAmount(event.target.value)} disabled={!access.canEdit} inputMode="decimal" required />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="claim-reference">المرجع</Label>
                        <Input id="claim-reference" value={claimReference} onChange={event => setClaimReference(event.target.value)} disabled={!access.canEdit} maxLength={160} />
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="grid gap-2">
                        <Label htmlFor="claim-date">تاريخ التقديم</Label>
                        <Input id="claim-date" type="date" value={claimDate} onChange={event => setClaimDate(event.target.value)} disabled={!access.canEdit} required />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="claim-expected-date">تاريخ متوقع</Label>
                        <Input id="claim-expected-date" type="date" value={claimExpectedDate} onChange={event => setClaimExpectedDate(event.target.value)} disabled={!access.canEdit} />
                      </div>
                    </div>

                    <Textarea value={claimNote} onChange={event => setClaimNote(event.target.value)} disabled={!access.canEdit} maxLength={4000} placeholder="ملاحظات المطالبة أو رقم البلاغ" />
                    <Button type="submit" disabled={createClaim.isPending || !access.canEdit || !claimPolicyId}>
                      {createClaim.isPending && <Loader2 className="ml-2 size-4 animate-spin" />}
                      تسجيل المطالبة
                    </Button>
                  </form>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>سجل المطالبات</CardTitle>
                  <CardDescription>
                    حالة كل مطالبة ومبلغها المستحق والمحصّل كما هو مرتبط بالدفتر.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {claims.isLoading ? (
                    <Skeleton className="h-48" />
                  ) : claims.error ? (
                    <InlineError message={textError(claims.error)} />
                  ) : claims.data?.length ? (
                    <div className="space-y-3">
                      {claims.data.map(claim => (
                        <div key={claim.id} className="rounded-xl border p-4">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <p className="font-semibold">{claim.policyName}</p>
                              <p className="text-xs text-muted-foreground">
                                {claim.referenceNumber || "بدون مرجع"} · {arabicDate(claim.submittedAt)}
                              </p>
                            </div>
                            <Badge variant={claim.status === "paid" ? "secondary" : "outline"}>
                              {claim.status === "paid" ? "مدفوعة" : "مقدمة"}
                            </Badge>
                          </div>
                          <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                            <span>المطالب به: <strong>{money(claim.claimedAmount, claim.currency)}</strong></span>
                            <span>المحصّل: <strong>{claim.receivedAmount ? money(claim.receivedAmount, claim.currency) : "لم يُحصّل"}</strong></span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <EmptyState icon={Umbrella} title="لا توجد مطالبات" description="أضف مطالبة من النموذج لتتبعها دون إنشاء دخل أو قيد تلقائي." />
                  )}
                </CardContent>
              </Card>
            </section>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

export default AssetsInsurancePage;
