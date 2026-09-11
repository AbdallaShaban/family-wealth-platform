import React, { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import PageHeader from "@/components/PageHeader";
import FinancialTooltip from "@/components/FinancialTooltip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import SensitiveValue from "@/components/SensitiveValue";
import { formatMoney } from "@/lib/financialDisplay";
import { toast } from "sonner";
import {
  ShieldAlert,
  ShieldCheck,
  TrendingDown,
  Activity,
  AlertTriangle,
  RefreshCw,
  Info,
  Calendar,
  Layers,
  Coins,
  Sliders,
  Play,
  Save,
  Clock,
  Sparkles,
  Lock,
  ArrowDownRight,
  Database,
  BarChart4,
  Flame,
} from "lucide-react";

type PredefinedScenarioKey =
  | "gfc_2008_inspired"
  | "stagflation_1970_inspired"
  | "covid_2020_inspired"
  | "devaluation_30pct"
  | "rate_hike_300bps";

const PREDEFINED_SCENARIOS_META: Array<{
  id: PredefinedScenarioKey;
  nameAr: string;
  descriptionAr: string;
  basis: string;
}> = [
  {
    id: "gfc_2008_inspired",
    nameAr: "الأزمة المالية العالمية 2008 (GFC)",
    descriptionAr: "محاكاة صدمة سيولة وائتمان حادة مصحوبة بانكماش تقييمات الأسهم والعقارات التجارية.",
    basis: "صدمة ماكرو بارامترية (أسهم -45%، عقار -25%، صكوك -5%، نقد 0%)",
  },
  {
    id: "stagflation_1970_inspired",
    nameAr: "الركود التضخمي 1970 (Stagflation)",
    descriptionAr: "محاكاة ركود تضخمي حاد مع صدمة أسعار طاقة وارتفاع التضخم والذهب وضغط السندات.",
    basis: "صدمة ماكرو بارامترية (ذهب +40%، صكوك -15%، أسهم -20%، تضخم +600bps)",
  },
  {
    id: "covid_2020_inspired",
    nameAr: "صدمة سيولة الأسواق 2020 (COVID)",
    descriptionAr: "محاكاة صدمة سيولة خاطفة وحادة في الأصول الخطرة وتجميد مؤقت للتدفقات النقدية.",
    basis: "صدمة ماكرو بارامترية (أسهم -35%، عقار -10%، تيسير نقدي)",
  },
  {
    id: "devaluation_30pct",
    nameAr: "انخفاض العملة المحلية 30%",
    descriptionAr: "محاكاة انخفاض حاد في القوة الشرائية وسعر صرف عملة الأساس مع تضخم مستورد.",
    basis: "صدمة ماكرو بارامترية (نقد -30%، ذهب +35%، أسهم -15%، عقار +10%)",
  },
  {
    id: "rate_hike_300bps",
    nameAr: "رفع الفائدة الحاد +300 نقطة أساس",
    descriptionAr: "محاكاة تشديد نقدي عنيف يؤدي لتراجع أسعار السندات وارتفاع تكلفة خدمة الديون.",
    basis: "صدمة ماكرو بارامترية (سندات -12%، عقار -15%، فائدة +300bps)",
  },
];

export default function StressTestingPage() {
  const [selectedTab, setSelectedTab] = useState<string>("macro");
  const [selectedScenarioId, setSelectedScenarioId] = useState<PredefinedScenarioKey>("gfc_2008_inspired");

  // Monte Carlo parameters state
  const [mcHorizonYears, setMcHorizonYears] = useState<number>(20);
  const [mcIterations, setMcIterations] = useState<number>(2000);
  const [mcSeed, setMcSeed] = useState<number>(421337);
  const [mcMonthlyOutflow, setMcMonthlyOutflow] = useState<string>("");

  // Liquidity ladder parameters state
  const [revenueHaircutPct, setRevenueHaircutPct] = useState<number>(50); // 50%

  // Save scenario modal state
  const [isSaveModalOpen, setIsSaveModalOpen] = useState<boolean>(false);
  const [saveScenarioName, setSaveScenarioName] = useState<string>("");
  const [saveScenarioDesc, setSaveScenarioDesc] = useState<string>("");

  const utils = trpc.useUtils();

  // Queries
  const profileQuery = trpc.stressTesting.getPortfolioStressProfile.useQuery({}, {
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  const macroSimQuery = trpc.stressTesting.runMacroSimulation.useQuery(
    { shockType: selectedScenarioId },
    {
      staleTime: 60_000,
      refetchOnWindowFocus: false,
    }
  );

  const monteCarloQuery = trpc.stressTesting.runMonteCarlo.useQuery(
    {
      horizonYears: mcHorizonYears,
      iterations: mcIterations,
      seed: mcSeed,
      spendingAnnualBase: mcMonthlyOutflow.trim()
        ? (parseFloat(mcMonthlyOutflow) * 12).toFixed(4)
        : undefined,
    },
    {
      staleTime: 60_000,
      refetchOnWindowFocus: false,
    }
  );

  const liquidityQuery = trpc.stressTesting.getLiquidityRunway.useQuery(
    {
      revenueHaircutPercent: revenueHaircutPct,
      estimatedMonthlyRevenueBase: "0.00",
    },
    {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    }
  );

  const savedScenariosQuery = trpc.stressTesting.listSavedScenarios.useQuery(undefined, {
    staleTime: 30_000,
  });

  const saveScenarioMutation = trpc.stressTesting.saveScenario.useMutation({
    onSuccess: () => {
      toast.success("تم حفظ السيناريو في سجل النماذج التحليلية بنجاح");
      setIsSaveModalOpen(false);
      setSaveScenarioName("");
      setSaveScenarioDesc("");
      void utils.stressTesting.listSavedScenarios.invalidate();
    },
    onError: (err) => {
      toast.error(`فشل حفظ السيناريو: ${err.message}`);
    },
  });

  const profile = profileQuery.data;
  const macroData = macroSimQuery.data;
  const liquidityData = liquidityQuery.data;
  const mcData = monteCarloQuery.data;
  const isMcLoading = monteCarloQuery.isFetching;

  const baseCurrency = profile?.portfolio.baseCurrency || "EGP";

  const handleRandomizeSeed = () => {
    const newSeed = Math.floor(Math.random() * 900000) + 100000;
    setMcSeed(newSeed);
  };

  const handleSaveCurrentScenario = () => {
    if (!saveScenarioName.trim()) {
      toast.error("يرجى إدخال اسم للسيناريو التحليلي");
      return;
    }

    if (selectedTab === "macro" && macroData) {
      saveScenarioMutation.mutate({
        name: saveScenarioName.trim(),
        subType: "macro_stress",
        assumptionsPayload: {
          scenarioId: selectedScenarioId,
          description: saveScenarioDesc.trim() || undefined,
        },
        resultPayload: macroData as unknown as Record<string, unknown>,
        confidence: "medium",
      });
    } else if (selectedTab === "monte_carlo" && mcData) {
      saveScenarioMutation.mutate({
        name: saveScenarioName.trim(),
        subType: "monte_carlo",
        assumptionsPayload: {
          horizonYears: mcHorizonYears,
          iterations: mcIterations,
          seed: mcSeed,
          description: saveScenarioDesc.trim() || undefined,
        },
        resultPayload: mcData as unknown as Record<string, unknown>,
        confidence: "medium",
      });
    } else if (selectedTab === "liquidity" && liquidityData) {
      saveScenarioMutation.mutate({
        name: saveScenarioName.trim(),
        subType: "liquidity_runway",
        assumptionsPayload: {
          revenueHaircutPercent: revenueHaircutPct,
          description: saveScenarioDesc.trim() || undefined,
        },
        resultPayload: liquidityData as unknown as Record<string, unknown>,
        confidence: "medium",
      });
    } else {
      toast.error("قم بتشغيل السيناريو أولاً قبل الحفظ");
    }
  };

  const formatPercentDisplay = (val: string | number | null | undefined, decimals = 2) => {
    if (val === null || val === undefined) return "—";
    const num = typeof val === "number" ? val * 100 : parseFloat(val) * 100;
    if (isNaN(num)) return "—";
    const sign = num > 0 ? "+" : "";
    return `${sign}${num.toFixed(decimals)}%`;
  };

  const formatLossPercentDisplay = (val: string | null | undefined) => {
    if (!val) return "—";
    const num = parseFloat(val) * 100;
    if (isNaN(num)) return "—";
    return `-${Math.abs(num).toFixed(2)}%`;
  };

  const getConfidenceBadge = (confidence: string | undefined) => {
    switch (confidence) {
      case "HIGH":
      case "high":
        return (
          <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
            ثقة بيانات عالية (HIGH)
          </Badge>
        );
      case "MEDIUM":
      case "medium":
        return (
          <Badge className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20">
            ثقة بيانات متوسطة (MEDIUM)
          </Badge>
        );
      case "LOW":
      case "low":
        return (
          <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20">
            ثقة بيانات منخفضة (LOW)
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-muted-foreground">
            بيانات غير مكتملة (UNAVAILABLE)
          </Badge>
        );
    }
  };

  // Compute total monthly obligations from profile
  const totalMonthlyCommitments = profile?.obligations
    ? (
        parseFloat(profile.obligations.monthlyEssentialLivingExpenseBase) +
        parseFloat(profile.obligations.monthlyDebtServiceBase) +
        parseFloat(profile.obligations.monthlyInsurancePremiumsBase)
      ).toFixed(4)
    : "0.0000";

  // Cash allocation
  const cashAllocation = profile?.portfolio.allocations.find((a) => a.assetClass === "cash");
  const marketableAllocation = profile?.portfolio.allocations.find((a) => a.assetClass === "equity");

  return (
    <DashboardLayout>
      <div className="space-y-6 pb-12" dir="rtl">
        {/* Header Section */}
        <PageHeader
          title="محرك اختبارات الضغط والصلابة المالية ومحاكاة الأزمات"
          description="محاكاة احتمالية متعددة الأصول واختبارات ضغط ماكرو بارامترية (GBM / Cholesky / Mulberry32)"
          icon={ShieldAlert}
          breadcrumbs={[
            { label: "الحوكمة والتحليل", href: "/wealth-health" },
            { label: "اختبارات الضغط والمخاطر" },
          ]}
          badge="modelVersion: mc-v1.0.0"
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="font-mono text-[11px] gap-1 bg-background/50">
                <Lock className="size-3 text-emerald-600" />
                <span>Accounting Read-Only</span>
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  void utils.stressTesting.getPortfolioStressProfile.invalidate();
                  void utils.stressTesting.runMacroSimulation.invalidate();
                  void utils.stressTesting.runMonteCarlo.invalidate();
                  void utils.stressTesting.getLiquidityRunway.invalidate();
                  toast.info("تم تحديث بيانات المحفظة واختبارات الضغط");
                }}
                disabled={profileQuery.isFetching}
                className="gap-2"
              >
                <RefreshCw className={`size-3.5 ${profileQuery.isFetching ? "animate-spin" : ""}`} />
                <span>تحديث البيانات</span>
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={() => setIsSaveModalOpen(true)}
                className="gap-2"
              >
                <Save className="size-3.5" />
                <span>حفظ السيناريو</span>
              </Button>
            </div>
          }
        />

        {/* Global Epistemic Warning Banner & Disclosure Badge */}
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="p-3.5 flex items-start gap-3">
            <Info className="size-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="text-xs text-muted-foreground leading-relaxed space-y-1.5">
              <div className="font-semibold text-foreground flex items-center gap-2 flex-wrap">
                <span>الفصل المعرفي والمنهجي الصارم (Epistemic Governance):</span>
                {getConfidenceBadge("medium")}
                <Badge variant="outline" className="bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30 text-[11px]">
                  نماذج اختبارات الإجهاد هي نماذج قياسية افتراضية (Hypothetical Parametric Simulations) ولا تشكل تعديلاً على دفاتر الأستاذ.
                </Badge>
              </div>
              <p>
                البيانات المحاسبية وقيم الأصول هي <span className="font-medium text-foreground">حقائق واقعية (Facts)</span>. أما صدمات الأزمات فهي <span className="font-medium text-foreground">سيناريوهات ماكرو بارامترية (Parametric Assumptions)</span> وليست إعادة تشغيل تاريخية للمحفظة. محاكاة مونت كارلو محددة رياضياً بنواة حتمية (Deterministic Seed) لضمان تكرار النتائج بدقة مطلقة دون تغيير أي قيد محاسبي.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Portfolio Quick Overview Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="border-border/60">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs font-semibold">إجمالي ثروة المحفظة الخاضعة للاختبار</CardDescription>
            </CardHeader>
            <CardContent>
              {profileQuery.isLoading ? (
                <Skeleton className="h-8 w-28" />
              ) : (
                <div className="text-2xl font-bold font-mono tracking-tight text-foreground">
                  <SensitiveValue>
                    {formatMoney(profile?.portfolio.totalWealthBase || "0", baseCurrency)}
                  </SensitiveValue>
                </div>
              )}
              <p className="text-[11px] text-muted-foreground mt-1">
                موزعة عبر {profile?.portfolio.allocations.length || 0} فئات أصول رئيسية
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/60">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs font-semibold">السيولة النقدية (Cash Allocation)</CardDescription>
            </CardHeader>
            <CardContent>
              {profileQuery.isLoading ? (
                <Skeleton className="h-8 w-28" />
              ) : (
                <div className="text-2xl font-bold font-mono tracking-tight text-emerald-600 dark:text-emerald-400">
                  <SensitiveValue>
                    {formatMoney(cashAllocation?.valueBase || "0", baseCurrency)}
                  </SensitiveValue>
                </div>
              )}
              <p className="text-[11px] text-muted-foreground mt-1">
                نقد وودائع بنكية بدون خصم تسييل
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/60">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs font-semibold">الأصول المدرجة (Equities)</CardDescription>
            </CardHeader>
            <CardContent>
              {profileQuery.isLoading ? (
                <Skeleton className="h-8 w-28" />
              ) : (
                <div className="text-2xl font-bold font-mono tracking-tight text-blue-600 dark:text-blue-400">
                  <SensitiveValue>
                    {formatMoney(marketableAllocation?.valueBase || "0", baseCurrency)}
                  </SensitiveValue>
                </div>
              )}
              <p className="text-[11px] text-muted-foreground mt-1">
                أسهم مدرجة قابلة للتسييل بخصم قياسي (10-15%)
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/60">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs font-semibold">الالتزامات الشهرية التعاقدية</CardDescription>
            </CardHeader>
            <CardContent>
              {profileQuery.isLoading ? (
                <Skeleton className="h-8 w-28" />
              ) : (
                <div className="text-2xl font-bold font-mono tracking-tight text-rose-600 dark:text-rose-400">
                  <SensitiveValue>
                    {formatMoney(totalMonthlyCommitments, baseCurrency)}
                  </SensitiveValue>
                </div>
              )}
              <p className="text-[11px] text-muted-foreground mt-1">
                ديون تعاقدية + تأمينات + مصاريف تشغيل أساسية
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Main Navigation Tabs */}
        <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-4">
          <TabsList className="grid grid-cols-2 md:grid-cols-5 h-auto p-1 bg-muted/60">
            <TabsTrigger value="macro" className="gap-2 py-2 text-xs md:text-sm">
              <Flame className="size-4 text-rose-500" />
              <span>اختبارات الضغط الكلي</span>
            </TabsTrigger>
            <TabsTrigger value="monte_carlo" className="gap-2 py-2 text-xs md:text-sm">
              <Activity className="size-4 text-indigo-500" />
              <span>محاكاة مونت كارلو</span>
            </TabsTrigger>
            <TabsTrigger value="var" className="gap-2 py-2 text-xs md:text-sm">
              <BarChart4 className="size-4 text-amber-500" />
              <span>القيمة المعرضة للمخاطر (VaR)</span>
            </TabsTrigger>
            <TabsTrigger value="liquidity" className="gap-2 py-2 text-xs md:text-sm">
              <Coins className="size-4 text-emerald-500" />
              <span>مدرج وضغط السيولة</span>
            </TabsTrigger>
            <TabsTrigger value="saved" className="gap-2 py-2 text-xs md:text-sm">
              <Database className="size-4 text-slate-500" />
              <span>السيناريوهات المحفوظة</span>
            </TabsTrigger>
          </TabsList>

          {/* =========================================================================
              TAB 1: PARAMETRIC MACRO STRESS SCENARIOS
             ========================================================================= */}
          <TabsContent value="macro" className="space-y-4">
            {/* Scenario Selector Cards */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {PREDEFINED_SCENARIOS_META.map((sc) => {
                const isSelected = selectedScenarioId === sc.id;
                return (
                  <Card
                    key={sc.id}
                    onClick={() => setSelectedScenarioId(sc.id)}
                    className={`cursor-pointer transition-all border text-right ${
                      isSelected
                        ? "border-rose-500/80 bg-rose-500/5 ring-1 ring-rose-500/50 shadow-xs"
                        : "border-border/60 hover:border-border hover:bg-muted/30"
                    }`}
                  >
                    <CardHeader className="p-3.5 pb-2">
                      <div className="flex items-center justify-between">
                        <Badge variant={isSelected ? "default" : "outline"} className="text-[10px]">
                          نموذج افتراضي
                        </Badge>
                        <Flame className={`size-4 ${isSelected ? "text-rose-500" : "text-muted-foreground"}`} />
                      </div>
                      <CardTitle className="text-xs font-bold mt-1 line-clamp-1">
                        {sc.nameAr}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-3.5 pt-0">
                      <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                        {sc.descriptionAr}
                      </p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Scenario Simulation Results */}
            {macroSimQuery.isLoading ? (
              <Card className="border-border/60">
                <CardContent className="p-6">
                  <div className="flex flex-col items-center justify-center py-10 space-y-3">
                    <RefreshCw className="size-8 animate-spin text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">جارٍ احتساب صدمات الأزمة على أصول المحفظة...</p>
                  </div>
                </CardContent>
              </Card>
            ) : macroData ? (
              <div className="space-y-4">
                {/* Result KPI Summary */}
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <Card className="border-rose-500/30 bg-rose-500/5">
                    <CardHeader className="pb-1">
                      <CardDescription className="text-xs font-medium text-rose-600/80 dark:text-rose-400/80">
                        الخسارة المطلقة المتوقعة
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold font-mono tracking-tight text-rose-600 dark:text-rose-400">
                        <SensitiveValue>
                          -{formatMoney(macroData.totalLossBase, baseCurrency)}
                        </SensitiveValue>
                      </div>
                      <div className="flex items-center gap-1 text-xs font-semibold text-rose-600 mt-1">
                        <ArrowDownRight className="size-3.5" />
                        <span>انخفاض {formatLossPercentDisplay(macroData.totalLossPct)} من الثروة</span>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-border/60">
                    <CardHeader className="pb-1">
                      <CardDescription className="text-xs font-medium">الثروة قبل الصدمة</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="text-xl font-bold font-mono tracking-tight text-foreground">
                        <SensitiveValue>
                          {formatMoney(macroData.preShockTotalWealthBase, baseCurrency)}
                        </SensitiveValue>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-1">قيمة دفترية وسوقية فعلية</p>
                    </CardContent>
                  </Card>

                  <Card className="border-border/60">
                    <CardHeader className="pb-1">
                      <CardDescription className="text-xs font-medium">الثروة بعد صدمة الأزمة</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="text-xl font-bold font-mono tracking-tight text-foreground">
                        <SensitiveValue>
                          {formatMoney(macroData.postShockTotalWealthBase, baseCurrency)}
                        </SensitiveValue>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-1">القيمة المحاكية المتبقية</p>
                    </CardContent>
                  </Card>

                  <Card className="border-border/60">
                    <CardHeader className="pb-1">
                      <CardDescription className="text-xs font-medium">الحوكمة والتصنيف المعرفي</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px] font-mono">
                          {macroData.governanceClass}
                        </Badge>
                        {getConfidenceBadge("medium")}
                      </div>
                      <p className="text-[10px] text-muted-foreground line-clamp-1">
                        {macroData.provenanceBasis}
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Asset Breakdown Table */}
                <Card className="border-border/60">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                      <Layers className="size-4 text-primary" />
                      <span>توزيع تأثير الصدمة عبر فئات الأصول</span>
                    </CardTitle>
                    <CardDescription className="text-xs">
                      تفصيل الصدمات البارامترية وقيمة الخسارة الناتجة لكل فئة أصول بالمحفظة
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-right">
                        <thead>
                          <tr className="border-b bg-muted/40 text-muted-foreground font-medium">
                            <th className="p-3">فئة الأصول</th>
                            <th className="p-3">القيمة الابتدائية</th>
                            <th className="p-3">نسبة الصدمة المطبقة</th>
                            <th className="p-3">القيمة تحت الضغط</th>
                            <th className="p-3">الخسارة المقدرة</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {macroData.assetBreakdown.map((item) => (
                            <tr key={item.assetClass} className="hover:bg-muted/20 transition-colors">
                              <td className="p-3 font-semibold text-foreground flex items-center gap-2">
                                <span>{item.nameAr}</span>
                                <span className="text-[10px] font-mono text-muted-foreground">({item.assetClass})</span>
                              </td>
                              <td className="p-3 font-mono">
                                <SensitiveValue>
                                  {formatMoney(item.preShockValueBase, baseCurrency)}
                                </SensitiveValue>
                              </td>
                              <td className="p-3 font-mono">
                                <Badge
                                  variant="outline"
                                  className={`text-[11px] ${
                                    parseFloat(item.appliedShockPct) < 0
                                      ? "text-rose-600 dark:text-rose-400 border-rose-500/30"
                                      : parseFloat(item.appliedShockPct) > 0
                                      ? "text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                                      : "text-muted-foreground"
                                  }`}
                                >
                                  {formatPercentDisplay(item.appliedShockPct)}
                                </Badge>
                              </td>
                              <td className="p-3 font-mono font-medium">
                                <SensitiveValue>
                                  {formatMoney(item.postShockValueBase, baseCurrency)}
                                </SensitiveValue>
                              </td>
                              <td className="p-3 font-mono font-medium text-rose-600 dark:text-rose-400">
                                <SensitiveValue>
                                  {parseFloat(item.lossBase) > 0
                                    ? `-${formatMoney(item.lossBase, baseCurrency)}`
                                    : "—"}
                                </SensitiveValue>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>

                {/* Epistemic Disclaimer Banner */}
                <Card className="border-border/60 bg-muted/20">
                  <CardHeader className="p-4 pb-2">
                    <CardTitle className="text-xs font-semibold text-muted-foreground flex items-center gap-2">
                      <Info className="size-3.5" />
                      <span>إخلاء المسؤولية والتصنيف المعرفي (Epistemic Disclaimer):</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-1">
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {macroData.epistemicDisclaimer}
                    </p>
                  </CardContent>
                </Card>
              </div>
            ) : null}
          </TabsContent>

          {/* =========================================================================
              TAB 2: MULTI-ASSET MONTE CARLO SIMULATION
             ========================================================================= */}
          <TabsContent value="monte_carlo" className="space-y-4">
            {/* Simulation Parameter Control Bar */}
            <Card className="border-border/60">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Sliders className="size-4 text-indigo-500" />
                  <span>معايير محاكاة مونت كارلو الاحتمالية (GBM Multi-Asset Stochastic Engine)</span>
                </CardTitle>
                <CardDescription className="text-xs">
                  محاكاة مسارات مستقبلية بفاصل زمني شهري وحساب مصفوفة الارتباط Cholesky ونواة Mulberry32 الحتمية
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-4">
                  {/* Horizon Slider */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <Label className="font-semibold">الأفق الزمني للمحاكاة:</Label>
                      <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                        {mcHorizonYears} سنة ({mcHorizonYears * 12} شهر)
                      </span>
                    </div>
                    <Slider
                      value={[mcHorizonYears]}
                      onValueChange={(val) => setMcHorizonYears(val[0])}
                      min={1}
                      max={50}
                      step={1}
                      className="cursor-pointer"
                    />
                  </div>

                  {/* Iterations Selector */}
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold">عدد المسارات الاحتمالية (Paths):</Label>
                    <select
                      value={mcIterations}
                      onChange={(e) => setMcIterations(parseInt(e.target.value, 10))}
                      className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs text-foreground focus:outline-hidden focus:ring-1 focus:ring-ring"
                    >
                      <option value={1000}>1,000 مسار احتمالي (سريع)</option>
                      <option value={2000}>2,000 مسار احتمالي (موصى به)</option>
                      <option value={3000}>3,000 مسار احتمالي (عالي الدقة)</option>
                      <option value={5000}>5,000 مسار احتمالي (مؤسسي أقصى)</option>
                    </select>
                  </div>

                  {/* Integer Seed */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <Label className="font-semibold">بذرة المحاكاة الحتمية (PRNG Seed):</Label>
                      <button
                        type="button"
                        onClick={handleRandomizeSeed}
                        className="text-[10px] text-primary hover:underline flex items-center gap-1"
                      >
                        <Sparkles className="size-2.5" />
                        <span>بذرة عشوائية</span>
                      </button>
                    </div>
                    <Input
                      type="number"
                      value={mcSeed}
                      onChange={(e) => setMcSeed(parseInt(e.target.value, 10) || 1)}
                      className="h-9 text-xs font-mono"
                    />
                  </div>

                  {/* Monthly Outflow */}
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold">السحب الشهري الصافي (اختياري):</Label>
                    <Input
                      type="text"
                      placeholder="0.00"
                      value={mcMonthlyOutflow}
                      onChange={(e) => setMcMonthlyOutflow(e.target.value)}
                      className="h-9 text-xs font-mono"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t">
                  <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                    <Info className="size-3.5" />
                    <span>
                      نفس المدخلات + نفس البذرة ({mcSeed}) = تطابق تام في النتائج بنسبة 100% بدون أي تباين عشوائي
                    </span>
                  </div>

                  <Button
                    onClick={() => void utils.stressTesting.runMonteCarlo.invalidate()}
                    disabled={isMcLoading}
                    className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white"
                  >
                    <Play className={`size-3.5 ${isMcLoading ? "animate-spin" : ""}`} />
                    <span>{isMcLoading ? "جارٍ محاكاة المسارات..." : "إعادة تشغيل المحاكاة"}</span>
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Simulation Results Display */}
            {mcData ? (
              <div className="space-y-4">
                {/* Key Metrics Cones */}
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <Card className="border-border/60">
                    <CardHeader className="pb-1">
                      <CardDescription className="text-xs font-medium">القيمة الوسيطة للثروة (P50 Median)</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold font-mono tracking-tight text-indigo-600 dark:text-indigo-400">
                        <SensitiveValue>
                          {formatMoney(mcData.medianTerminalWealthBase, baseCurrency)}
                        </SensitiveValue>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-1">
                        بعد {mcData.horizonYears} سنة بمعدل مسارات وسيط
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="border-border/60">
                    <CardHeader className="pb-1">
                      <CardDescription className="text-xs font-medium">احتمال نفاد الثروة (Ruin Probability)</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div
                        className={`text-2xl font-bold font-mono tracking-tight ${
                          parseFloat(mcData.ruinProbability) > 0.1
                            ? "text-rose-600 dark:text-rose-400"
                            : parseFloat(mcData.ruinProbability) > 0
                            ? "text-amber-600 dark:text-amber-400"
                            : "text-emerald-600 dark:text-emerald-400"
                        }`}
                      >
                        {formatPercentDisplay(mcData.ruinProbability)}
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-1">
                        نسبة المسارات التي هبطت قيمتها للصفر
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="border-border/60">
                    <CardHeader className="pb-1">
                      <CardDescription className="text-xs font-medium">احتمال حفظ رأس المال</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold font-mono tracking-tight text-emerald-600 dark:text-emerald-400">
                        {formatPercentDisplay(mcData.capitalPreservationProbability)}
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-1">
                        احتمال بقاء الثروة أعلى من رأس المال الابتدائي
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Percentile Trajectory Cones Table */}
                <Card className="border-border/60">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                      <Activity className="size-4 text-primary" />
                      <span>مخاريط مسارات الثروة الاحتمالية (Percentile Cones)</span>
                    </CardTitle>
                    <CardDescription className="text-xs">
                      توزيع قيم الثروة المتوقعة عبر السنوات من أسوأ السيناريوهات (P10) إلى أفضلها (P90)
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-right">
                        <thead>
                          <tr className="border-b bg-muted/40 text-muted-foreground font-medium">
                            <th className="p-3">السنة</th>
                            <th className="p-3 text-rose-600 dark:text-rose-400">P10 (أسوأ 10%)</th>
                            <th className="p-3 text-amber-600 dark:text-amber-400">P25 (متحفظ)</th>
                            <th className="p-3 text-indigo-600 dark:text-indigo-400 font-bold">P50 (الوسيط)</th>
                            <th className="p-3 text-blue-600 dark:text-blue-400">P75 (متفائل)</th>
                            <th className="p-3 text-emerald-600 dark:text-emerald-400">P90 (أفضل 10%)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y font-mono">
                          {mcData.percentileCone
                            .filter((pt) => pt.year > 0 && (pt.year <= 5 || pt.year % 5 === 0 || pt.year === mcData.horizonYears))
                            .map((pt) => (
                              <tr key={pt.year} className="hover:bg-muted/20 transition-colors">
                                <td className="p-3 font-semibold text-foreground font-sans">السنة {pt.year}</td>
                                <td className="p-3 text-rose-600 dark:text-rose-400">
                                  <SensitiveValue>
                                    {formatMoney(pt.p10, baseCurrency)}
                                  </SensitiveValue>
                                </td>
                                <td className="p-3 text-amber-600 dark:text-amber-400">
                                  <SensitiveValue>
                                    {formatMoney(pt.p25, baseCurrency)}
                                  </SensitiveValue>
                                </td>
                                <td className="p-3 text-indigo-600 dark:text-indigo-400 font-bold">
                                  <SensitiveValue>
                                    {formatMoney(pt.p50, baseCurrency)}
                                  </SensitiveValue>
                                </td>
                                <td className="p-3 text-blue-600 dark:text-blue-400">
                                  <SensitiveValue>
                                    {formatMoney(pt.p75, baseCurrency)}
                                  </SensitiveValue>
                                </td>
                                <td className="p-3 text-emerald-600 dark:text-emerald-400">
                                  <SensitiveValue>
                                    {formatMoney(pt.p90, baseCurrency)}
                                  </SensitiveValue>
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <Card className="border-dashed border-border/80">
                <CardContent className="p-12 text-center space-y-3">
                  <Activity className="size-10 text-muted-foreground mx-auto" />
                  <h3 className="text-sm font-semibold text-foreground">جاهز لتشغيل محاكاة مونت كارلو</h3>
                  <p className="text-xs text-muted-foreground max-w-md mx-auto">
                    حدد الأفق الزمني وعدد المسارات وانقر على "إعادة تشغيل المحاكاة" لاحتساب مخاريط الثروة واحتمالات البقاء.
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* =========================================================================
              TAB 3: VALUE AT RISK (VaR & CVaR)
             ========================================================================= */}
          <TabsContent value="var" className="space-y-4">
            {/* Epistemic VaR Banner */}
            <Card className="border-border/60 bg-muted/20">
              <CardContent className="p-4 flex items-start gap-3">
                <ShieldCheck className="size-5 text-primary shrink-0 mt-0.5" />
                <div className="text-xs text-muted-foreground leading-relaxed space-y-1">
                  <div className="font-semibold text-foreground">
                    منهجية احتساب المخاطر الذيلية (Value at Risk & Conditional VaR Methodology):
                  </div>
                  <p>
                    يتم احتساب <span className="font-medium text-foreground">Monte Carlo VaR</span> كمنهجية أولية رئيسية قائمة على التوزيعات المحاكاة، مدعومة بـ <span className="font-medium text-foreground">Parametric VaR</span> كفحص معياري متقاطع. أما <span className="font-medium text-foreground">Historical VaR</span> فهو غير متاح (UNAVAILABLE) بدقة نظراً لعدم توفر سلاسل عوائد يومية تاريخية كاملة لكافة أصول المحفظة.
                  </p>
                </div>
              </CardContent>
            </Card>

            {mcData ? (
              <div className="grid gap-4 md:grid-cols-2">
                {/* 1-Month Horizon VaR/CVaR Card */}
                <Card className="border-border/60">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-bold flex items-center gap-2">
                        <BarChart4 className="size-4 text-amber-500" />
                        <span>مخاطر الشهر الواحد (1-Month Horizon VaR)</span>
                      </CardTitle>
                      <Badge variant="outline" className="text-[10px] font-mono">Monthly VaR</Badge>
                    </div>
                    <CardDescription className="text-xs">
                      أقصى خسارة شهرية متوقعة عند مستويات ثقة 95% و 99%
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* 95% 1-Month */}
                    <div className="p-3 rounded-lg border bg-background/60 space-y-1">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-semibold text-foreground">VaR 95% (أقصى خسارة اعتيادية):</span>
                        <span className="font-mono font-bold text-amber-600 dark:text-amber-400">
                          {formatLossPercentDisplay(mcData.varReport.oneMonthVaR95.varPct)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-xs text-muted-foreground">
                        <span>الخسارة بالقيمة النقدية:</span>
                        <span className="font-mono">
                          <SensitiveValue>
                            -{formatMoney(mcData.varReport.oneMonthVaR95.varBase, baseCurrency)}
                          </SensitiveValue>
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-[11px] text-muted-foreground pt-1 border-t">
                        <span>CVaR 95% (متوسط الخسارة في الذيل المتطرف):</span>
                        <span className="font-mono text-rose-600 dark:text-rose-400">
                          <SensitiveValue>
                            -{formatMoney(mcData.varReport.oneMonthVaR95.cvarBase, baseCurrency)} ({formatLossPercentDisplay(mcData.varReport.oneMonthVaR95.cvarPct)})
                          </SensitiveValue>
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-[11px] text-muted-foreground pt-1 border-t">
                        <span>Parametric VaR 95% (معياري):</span>
                        <span className="font-mono text-muted-foreground">
                          <SensitiveValue>
                            -{formatMoney(mcData.varReport.parametricCrossCheck.oneMonthVaR95Base, baseCurrency)} ({formatLossPercentDisplay(mcData.varReport.parametricCrossCheck.oneMonthVaR95Pct)})
                          </SensitiveValue>
                        </span>
                      </div>
                    </div>

                    {/* 99% 1-Month */}
                    <div className="p-3 rounded-lg border bg-background/60 space-y-1">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-semibold text-foreground">VaR 99% (أقصى خسارة قصوى):</span>
                        <span className="font-mono font-bold text-rose-600 dark:text-rose-400">
                          {formatLossPercentDisplay(mcData.varReport.oneMonthVaR99.varPct)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-xs text-muted-foreground">
                        <span>الخسارة بالقيمة النقدية:</span>
                        <span className="font-mono">
                          <SensitiveValue>
                            -{formatMoney(mcData.varReport.oneMonthVaR99.varBase, baseCurrency)}
                          </SensitiveValue>
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-[11px] text-muted-foreground pt-1 border-t">
                        <span>CVaR 99% (متوسط الخسارة في أسوأ 1%):</span>
                        <span className="font-mono text-rose-600 dark:text-rose-400">
                          <SensitiveValue>
                            -{formatMoney(mcData.varReport.oneMonthVaR99.cvarBase, baseCurrency)} ({formatLossPercentDisplay(mcData.varReport.oneMonthVaR99.cvarPct)})
                          </SensitiveValue>
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-[11px] text-muted-foreground pt-1 border-t">
                        <span>Parametric VaR 99% (معياري):</span>
                        <span className="font-mono text-muted-foreground">
                          <SensitiveValue>
                            -{formatMoney(mcData.varReport.parametricCrossCheck.oneMonthVaR99Base, baseCurrency)} ({formatLossPercentDisplay(mcData.varReport.parametricCrossCheck.oneMonthVaR99Pct)})
                          </SensitiveValue>
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* 1-Year Horizon VaR/CVaR Card */}
                <Card className="border-border/60">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-bold flex items-center gap-2">
                        <BarChart4 className="size-4 text-rose-500" />
                        <span>مخاطر السنة الواحدة (1-Year Annual VaR)</span>
                      </CardTitle>
                      <Badge variant="outline" className="text-[10px] font-mono">Annual VaR</Badge>
                    </div>
                    <CardDescription className="text-xs">
                      مقارنة Monte Carlo VaR الأساسي مع Parametric VaR المعياري
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* 95% 1-Year */}
                    <div className="p-3 rounded-lg border bg-background/60 space-y-1">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-semibold text-foreground">Monte Carlo VaR 95%:</span>
                        <span className="font-mono font-bold text-amber-600 dark:text-amber-400">
                          {formatLossPercentDisplay(mcData.varReport.oneYearVaR95.varPct)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-xs text-muted-foreground">
                        <span>الخسارة بالقيمة النقدية:</span>
                        <span className="font-mono">
                          <SensitiveValue>
                            -{formatMoney(mcData.varReport.oneYearVaR95.varBase, baseCurrency)}
                          </SensitiveValue>
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-[11px] text-muted-foreground pt-1 border-t">
                        <span>Parametric VaR 95% (معياري):</span>
                        <span className="font-mono text-muted-foreground">
                          <SensitiveValue>
                            -{formatMoney(mcData.varReport.parametricCrossCheck.oneYearVaR95Base, baseCurrency)} ({formatLossPercentDisplay(mcData.varReport.parametricCrossCheck.oneYearVaR95Pct)})
                          </SensitiveValue>
                        </span>
                      </div>
                    </div>

                    {/* 99% 1-Year */}
                    <div className="p-3 rounded-lg border bg-background/60 space-y-1">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-semibold text-foreground">Monte Carlo VaR 99%:</span>
                        <span className="font-mono font-bold text-rose-600 dark:text-rose-400">
                          {formatLossPercentDisplay(mcData.varReport.oneYearVaR99.varPct)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-xs text-muted-foreground">
                        <span>الخسارة بالقيمة النقدية:</span>
                        <span className="font-mono">
                          <SensitiveValue>
                            -{formatMoney(mcData.varReport.oneYearVaR99.varBase, baseCurrency)}
                          </SensitiveValue>
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-[11px] text-muted-foreground pt-1 border-t">
                        <span>CVaR 99% (متوسط الخسارة في أسوأ 1%):</span>
                        <span className="font-mono text-rose-600 dark:text-rose-400">
                          <SensitiveValue>
                            -{formatMoney(mcData.varReport.oneYearVaR99.cvarBase, baseCurrency)} ({formatLossPercentDisplay(mcData.varReport.oneYearVaR99.cvarPct)})
                          </SensitiveValue>
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-[11px] text-muted-foreground pt-1 border-t">
                        <span>Parametric VaR 99% (معياري):</span>
                        <span className="font-mono text-muted-foreground">
                          <SensitiveValue>
                            -{formatMoney(mcData.varReport.parametricCrossCheck.oneYearVaR99Base, baseCurrency)} ({formatLossPercentDisplay(mcData.varReport.parametricCrossCheck.oneYearVaR99Pct)})
                          </SensitiveValue>
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <Card className="border-dashed border-border/80">
                <CardContent className="p-12 text-center space-y-3">
                  <BarChart4 className="size-10 text-muted-foreground mx-auto" />
                  <h3 className="text-sm font-semibold text-foreground">لم يتم تشغيل محاكاة VaR بعد</h3>
                  <p className="text-xs text-muted-foreground max-w-md mx-auto">
                    يرجى الانتقال لتبويب "محاكاة مونت كارلو" وتشغيل المحاكاة لاحتساب مقاييس القيمة المعرضة للمخاطر (VaR / CVaR).
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* =========================================================================
              TAB 4: LIQUIDITY STRESS LADDER
             ========================================================================= */}
          <TabsContent value="liquidity" className="space-y-4">
            {/* Haircut & Shock Control */}
            <Card className="border-border/60">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Coins className="size-4 text-emerald-500" />
                  <span>مدرج السيولة واختبار انقطاع الإيرادات والتدفقات النقدية</span>
                </CardTitle>
                <CardDescription className="text-xs">
                  اختبار قدرة العائلة على الوفاء بالتزامات الديون وأقساط التأمين والمصاريف عند تعطل التدفقات الداخلة
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="max-w-xl space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <Label className="font-semibold">نسبة انقطاع الدخل/الإيرادات (Revenue Haircut %):</Label>
                    <span className="font-mono font-bold text-rose-600 dark:text-rose-400">
                      {revenueHaircutPct}% انخفاض
                    </span>
                  </div>
                  <Slider
                    value={[revenueHaircutPct]}
                    onValueChange={(val) => setRevenueHaircutPct(val[0])}
                    min={0}
                    max={100}
                    step={5}
                    className="cursor-pointer"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    محاكاة سيناريو أزمة ينخفض فيه الدخل التشغيلي للعائلة بنسبة {revenueHaircutPct}%
                  </p>
                </div>
              </CardContent>
            </Card>

            {liquidityData ? (
              <div className="space-y-4">
                {/* Deficit Warning Banner if critical */}
                {liquidityData.isDeficit ? (
                  <Card className="border-rose-500/50 bg-rose-500/10">
                    <CardContent className="p-4 flex items-center gap-3">
                      <AlertTriangle className="size-5 text-rose-600 dark:text-rose-400 shrink-0" />
                      <div className="text-xs font-semibold text-rose-600 dark:text-rose-400">
                        تحذير سيولة حرج: معدل حرق السيولة الصافي يتجاوز السيولة النقدية الفورية المتاحة لأقل من 12 شهراً.
                      </div>
                    </CardContent>
                  </Card>
                ) : null}

                {/* Governance Model Assumption Banner */}
                <div className="p-3 rounded-xl border border-amber-500/20 bg-amber-500/5 text-xs text-amber-700 dark:text-amber-400 space-y-1">
                  <div className="flex items-center gap-2 font-bold">
                    <Info className="size-4 shrink-0" />
                    <span>Indicative Stress Liquidity Horizon — Model Assumption (افتراضات نموذجية استرشادية لآفاق التسييل)</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    آفاق التسييل ونسب الخصم الموضحة أدناه هي افتراضات نموذجية استرشادية (Tier C: Model Assumptions): ليست رصداً سوقياً واقعياً، ولا تمثل وقتاً مضموناً للتسييل، ولا اتفاقية مستوى خدمة (SLA)، ولا وعداً بالتنفيذ السعري، وتُستخدم فقط كافتراض لنمذجة ضغط السيولة.
                  </p>
                </div>

                {/* Three-Tier Liquidity Stack */}
                <div className="grid gap-4 sm:grid-cols-3">
                  {/* Tier 1 */}
                  <Card className="border-emerald-500/30 bg-emerald-500/5">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                          المستوى 1: سيولة نقدية فورية
                        </CardTitle>
                        <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-600">
                          بدون خصم (0%)
                        </Badge>
                      </div>
                      <CardDescription className="text-[11px]">نقد وحسابات جارية وودائع تحت الطلب</CardDescription>
                      <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono">
                        الأفق الاسترشادي: فوري (0 أيام)
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="text-xl font-bold font-mono tracking-tight text-foreground">
                        <SensitiveValue>
                          {formatMoney(liquidityData.tier1ImmediateCashBase, baseCurrency)}
                        </SensitiveValue>
                      </div>
                      <div className="p-2 rounded bg-background/80 border text-[11px] flex justify-between items-center">
                        <span className="text-muted-foreground">مدرج الصمود الفوري:</span>
                        <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          {liquidityData.monthsOfRunwayTier1 !== null ? `${liquidityData.monthsOfRunwayTier1} شهر` : "غير محدود"}
                        </span>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Tier 2 */}
                  <Card className="border-blue-500/30 bg-blue-500/5">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-xs font-bold text-blue-700 dark:text-blue-400">
                          المستوى 2: أصول قابلة للتسويق السريع
                        </CardTitle>
                        <Badge variant="outline" className="text-[10px] border-blue-500/30 text-blue-600">
                          افتراض 10% (نطاق 5%–15%)
                        </Badge>
                      </div>
                      <CardDescription className="text-[11px]">أسهم وصكوك مدرجة وصناديق قابلة للتسييل</CardDescription>
                      <div className="text-[10px] text-blue-600 dark:text-blue-400 font-mono">
                        الأفق الاسترشادي: 1–5 أيام عمل (افتراض نموذجي)
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="text-xl font-bold font-mono tracking-tight text-foreground">
                        <SensitiveValue>
                          {formatMoney(liquidityData.tier2MarketableAssetsStressedBase, baseCurrency)}
                        </SensitiveValue>
                      </div>
                      <div className="p-2 rounded bg-background/80 border text-[11px] flex justify-between items-center">
                        <span className="text-muted-foreground">مدرج الصمود (Tier 1 + 2):</span>
                        <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                          {liquidityData.monthsOfRunwayTier2 !== null ? `${liquidityData.monthsOfRunwayTier2} شهر` : "غير محدود"}
                        </span>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Tier 3 */}
                  <Card className="border-amber-500/30 bg-amber-500/5">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-xs font-bold text-amber-700 dark:text-amber-400">
                          المستوى 3: أصول غير سائلة / خاصة
                        </CardTitle>
                        <Badge variant="outline" className="text-[10px] border-amber-500/30 text-amber-600">
                          افتراض 30% (نطاق 25%–40%)
                        </Badge>
                      </div>
                      <CardDescription className="text-[11px]">عقارات وشركات خاصة ومقتنيات استراتيجية</CardDescription>
                      <div className="text-[10px] text-amber-600 dark:text-amber-400 font-mono">
                        الأفق الاسترشادي: 90–365 يوماً (افتراض نموذجي)
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="text-xl font-bold font-mono tracking-tight text-foreground">
                        <SensitiveValue>
                          {formatMoney(liquidityData.tier3IlliquidAssetsStressedBase, baseCurrency)}
                        </SensitiveValue>
                      </div>
                      <div className="p-2 rounded bg-background/80 border text-[11px] flex justify-between items-center">
                        <span className="text-muted-foreground">إجمالي مدرج الصمود الشامل:</span>
                        <span className="font-mono font-bold text-amber-600 dark:text-amber-400">
                          {liquidityData.monthsOfRunwayTotal !== null ? `${liquidityData.monthsOfRunwayTotal} شهر` : "غير محدود"}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Monthly Burn Breakdown Table */}
                <Card className="border-border/60">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                      <Flame className="size-4 text-rose-500" />
                      <span>تفصيل الالتزامات الشهرية ومعدل حرق السيولة الصافي</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-right">
                        <thead>
                          <tr className="border-b bg-muted/40 text-muted-foreground font-medium">
                            <th className="p-3">بند الالتزام / المصروف</th>
                            <th className="p-3">القيمة الشهرية</th>
                            <th className="p-3">طبيعة الالتزام</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y font-mono">
                          <tr className="hover:bg-muted/20">
                            <td className="p-3 font-sans font-semibold">مصاريف معيشية وتشغيلية أساسية</td>
                            <td className="p-3">
                              <SensitiveValue>
                                {formatMoney(liquidityData.obligations.monthlyEssentialLivingExpenseBase, baseCurrency)}
                              </SensitiveValue>
                            </td>
                            <td className="p-3 font-sans text-muted-foreground">أساسية غير قابلة للتأجيل</td>
                          </tr>
                          <tr className="hover:bg-muted/20">
                            <td className="p-3 font-sans font-semibold">خدمة الديون وأقساط التمويل التعاقدية</td>
                            <td className="p-3 text-rose-600 dark:text-rose-400">
                              <SensitiveValue>
                                {formatMoney(liquidityData.obligations.monthlyDebtServiceBase, baseCurrency)}
                              </SensitiveValue>
                            </td>
                            <td className="p-3 font-sans text-muted-foreground">التزام قانوني تعاقدي</td>
                          </tr>
                          <tr className="hover:bg-muted/20">
                            <td className="p-3 font-sans font-semibold">أقساط التأمين الإلزامية</td>
                            <td className="p-3 text-amber-600 dark:text-amber-400">
                              <SensitiveValue>
                                {formatMoney(liquidityData.obligations.monthlyInsurancePremiumsBase, baseCurrency)}
                              </SensitiveValue>
                            </td>
                            <td className="p-3 font-sans text-muted-foreground">حماية الأصول والمخاطر</td>
                          </tr>
                          <tr className="bg-muted/30 font-bold font-sans">
                            <td className="p-3">إجمالي حرق السيولة الشهري الصافي تحت الضغط</td>
                            <td className="p-3 font-mono text-rose-600 dark:text-rose-400">
                              <SensitiveValue>
                                {formatMoney(liquidityData.netMonthlyBurnBase, baseCurrency)}
                              </SensitiveValue>
                            </td>
                            <td className="p-3 text-[11px] text-muted-foreground">
                              صافي التدفق بعد تطبيق نسبة انقطاع الإيرادات ({revenueHaircutPct}%)
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : null}
          </TabsContent>

          {/* =========================================================================
              TAB 5: SAVED SCENARIOS ARCHIVE
             ========================================================================= */}
          <TabsContent value="saved" className="space-y-4">
            <Card className="border-border/60">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Database className="size-4 text-slate-500" />
                  <span>أرشيف السيناريوهات التحليلية المحفوظة (Analytical Scenarios Archive)</span>
                </CardTitle>
                <CardDescription className="text-xs">
                  سجل السيناريوهات المحفوظة في قاعدة البيانات (planning_scenarios) لأغراض المقارنة والتوثيق المؤسسي
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {savedScenariosQuery.isLoading ? (
                  <div className="p-8 text-center">
                    <RefreshCw className="size-6 animate-spin mx-auto text-muted-foreground" />
                  </div>
                ) : savedScenariosQuery.data && savedScenariosQuery.data.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-right">
                      <thead>
                        <tr className="border-b bg-muted/40 text-muted-foreground font-medium">
                          <th className="p-3">اسم السيناريو</th>
                          <th className="p-3">النوع التحليلي</th>
                          <th className="p-3">مستوى الثقة</th>
                          <th className="p-3">تاريخ الإنشاء</th>
                          <th className="p-3">الملاحظات</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {savedScenariosQuery.data.map((sc) => {
                          const meta = sc.assumptions as {
                            subType?: string;
                            governanceClass?: string;
                            description?: string;
                          } | null;

                          return (
                            <tr key={sc.id} className="hover:bg-muted/20 transition-colors">
                              <td className="p-3 font-semibold text-foreground">{sc.name}</td>
                              <td className="p-3">
                                <Badge variant="outline" className="text-[10px] font-mono">
                                  {meta?.subType ?? sc.scenarioType}
                                </Badge>
                              </td>
                              <td className="p-3">
                                {getConfidenceBadge(sc.confidence)}
                              </td>
                              <td className="p-3 text-muted-foreground font-mono">
                                {new Date(sc.createdAt).toLocaleDateString("ar-EG", {
                                  year: "numeric",
                                  month: "short",
                                  day: "numeric",
                                })}
                              </td>
                              <td className="p-3 text-muted-foreground max-w-xs truncate">
                                {meta?.description || "—"}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-12 text-center space-y-2">
                    <Database className="size-8 text-muted-foreground mx-auto" />
                    <p className="text-xs text-muted-foreground">لا توجد سيناريوهات محفوظة حالياً.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Save Scenario Modal Dialog */}
        <Dialog open={isSaveModalOpen} onOpenChange={setIsSaveModalOpen}>
          <DialogContent className="sm:max-w-md" dir="rtl">
            <DialogHeader>
              <DialogTitle className="text-base font-bold">حفظ السيناريو التحليلي</DialogTitle>
              <DialogDescription className="text-xs">
                حفظ لقطة من نتائج السيناريو الحالي في سجل النماذج التحليلية للمحفظة
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label className="text-xs font-semibold">اسم السيناريو:</Label>
                <Input
                  value={saveScenarioName}
                  onChange={(e) => setSaveScenarioName(e.target.value)}
                  placeholder="مثال: اختبار ضغط أزمة 2008 مع سحب شهري 50,000"
                  className="text-xs"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold">الوصف والملاحظات:</Label>
                <Input
                  value={saveScenarioDesc}
                  onChange={(e) => setSaveScenarioDesc(e.target.value)}
                  placeholder="ملاحظات توثيقية حول الفرضيات المستخدمة..."
                  className="text-xs"
                />
              </div>
              <div className="p-2.5 rounded-lg bg-muted/40 text-[11px] text-muted-foreground flex items-start gap-2">
                <Lock className="size-3.5 text-emerald-600 shrink-0 mt-0.5" />
                <span>
                  الحفظ يتم كلقطة تحليلية في جدول النماذج التخطيطية (planning_scenarios) دون أي تعديل على الدفاتر المحاسبية السيادية.
                </span>
              </div>
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsSaveModalOpen(false)}
              >
                إلغاء
              </Button>
              <Button
                size="sm"
                onClick={handleSaveCurrentScenario}
                disabled={saveScenarioMutation.isPending}
                className="gap-2"
              >
                <Save className="size-3.5" />
                <span>{saveScenarioMutation.isPending ? "جارٍ الحفظ..." : "تأكيد الحفظ"}</span>
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
