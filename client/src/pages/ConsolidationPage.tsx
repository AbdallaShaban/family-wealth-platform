import DashboardLayout from "@/components/DashboardLayout";
import PageHeader from "@/components/PageHeader";
import SensitiveValue from "@/components/SensitiveValue";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatMoney } from "@/lib/financialDisplay";
import { trpc } from "@/lib/trpc";
import { AlertCircle, Building2, Globe, Layers, PieChart, RefreshCw, ShieldAlert, Wallet } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

const CURRENCIES = ["SAR", "USD", "EGP", "AED", "EUR", "GBP", "KWD", "QAR"];

export default function ConsolidationPage() {
  const [selectedCurrency, setSelectedCurrency] = useState("SAR");
  const [selectedWorkspaceIds, setSelectedWorkspaceIds] = useState<number[]>([]);

  const accessibleWorkspaces = trpc.consolidation.listAccessible.useQuery();

  // Initialize selected workspaces once loaded
  useEffect(() => {
    if (accessibleWorkspaces.data?.length && selectedWorkspaceIds.length === 0) {
      setSelectedWorkspaceIds(accessibleWorkspaces.data.map(w => w.id));
    }
  }, [accessibleWorkspaces.data, selectedWorkspaceIds.length]);

  const consolidationQuery = trpc.consolidation.summary.useQuery(
    {
      workspaceIds: selectedWorkspaceIds,
      presentationCurrency: selectedCurrency,
    },
    {
      enabled: selectedWorkspaceIds.length > 0,
      staleTime: 30_000,
    }
  );

  const toggleWorkspace = (id: number) => {
    setSelectedWorkspaceIds(prev => {
      if (prev.includes(id)) {
        if (prev.length === 1) {
          toast.warning("يجب الإبقاء على مساحة عمل واحدة على الأقل للدمج.");
          return prev;
        }
        return prev.filter(wId => wId !== id);
      }
      return [...prev, id];
    });
  };

  const selectAll = () => {
    if (accessibleWorkspaces.data) {
      setSelectedWorkspaceIds(accessibleWorkspaces.data.map(w => w.id));
    }
  };

  const data = consolidationQuery.data;

  return (
    <DashboardLayout>
      <main className="mx-auto max-w-7xl space-y-6" dir="rtl">
        <PageHeader
          title="توحيد الكيانات والدمج المالي (Consolidation)"
          description="طبقة تحليلية تنفيذية تجمع وتدمج القوائم المالية والمحافظ عبر كافة الكيانات والشركات العائلية المصرح بالوصول إليها، مع فصل صارم للمعاملات البينية."
          icon={Building2}
          breadcrumbs={[
            { label: "الحوكمة والتحليل", href: "/governance" },
            { label: "توحيد الكيانات المالية" },
          ]}
          badge="طبقة تحليلية غير دفترية (Read-Only)"
          actions={
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => void consolidationQuery.refetch()}
                disabled={consolidationQuery.isFetching}
              >
                <RefreshCw className={`size-4 ${consolidationQuery.isFetching ? "animate-spin" : ""}`} />
                تحديث البيانات
              </Button>
            </div>
          }
        />

        {/* Entity Selector and Presentation Currency Controls */}
        <Card className="fintech-surface-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Globe className="size-4 text-primary" />
              نطاق التوحيد وعملة العرض الموحدة
            </CardTitle>
            <CardDescription>
              حدد الكيانات المستقلة المطلوب دمجها وعملة العرض المرجعية. يتم التحويل بناءً على أسعار الصرف التاريخية أو اللحظية الموثقة.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-4">
                <span className="text-xs font-semibold text-muted-foreground">الكيانات المتاحة ({accessibleWorkspaces.data?.length ?? 0}):</span>
                {accessibleWorkspaces.data?.map(w => {
                  const isChecked = selectedWorkspaceIds.includes(w.id);
                  return (
                    <div key={w.id} className="flex items-center gap-2 rounded-lg border bg-background/50 px-3 py-1.5 shadow-sm">
                      <Checkbox
                        id={`ws-${w.id}`}
                        checked={isChecked}
                        onCheckedChange={() => toggleWorkspace(w.id)}
                      />
                      <Label htmlFor={`ws-${w.id}`} className="text-xs font-medium cursor-pointer">
                        {w.name} <span className="text-[10px] text-muted-foreground">({w.baseCurrency})</span>
                      </Label>
                    </div>
                  );
                })}
                {accessibleWorkspaces.data && selectedWorkspaceIds.length < accessibleWorkspaces.data.length && (
                  <Button variant="ghost" size="sm" onClick={selectAll} className="text-xs h-7">
                    تحديد الكل
                  </Button>
                )}
              </div>

              <div className="flex items-center gap-2 min-w-[180px]">
                <Label htmlFor="currency-select" className="text-xs font-semibold whitespace-nowrap">
                  عملة العرض:
                </Label>
                <Select value={selectedCurrency} onValueChange={setSelectedCurrency}>
                  <SelectTrigger id="currency-select" className="h-8 text-xs font-mono">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map(curr => (
                      <SelectItem key={curr} value={curr} className="font-mono text-xs">
                        {curr}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Executive KPI Cards */}
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="fintech-surface-card">
            <CardHeader className="pb-2">
              <CardDescription>صافي الثروة الدفتري الموحد (Gross Book)</CardDescription>
              <CardTitle className="text-2xl font-bold tracking-tight text-emerald-600">
                <SensitiveValue>
                  {formatMoney(data?.grossConsolidatedBookNetWorth ?? "0", selectedCurrency, 2)}
                </SensitiveValue>
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">
              مجموع صافي حقوق الملكية لكافة الكيانات المختارة دون شطب افتراضي.
            </CardContent>
          </Card>

          <Card className="fintech-surface-card">
            <CardHeader className="pb-2">
              <CardDescription>القيمة الاقتصادية الموحدة (Economic Value)</CardDescription>
              <CardTitle className="text-2xl font-bold tracking-tight text-primary">
                <SensitiveValue>
                  {formatMoney(data?.grossConsolidatedEconomicNetWorth ?? "0", selectedCurrency, 2)}
                </SensitiveValue>
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">
              تشمل تقييم المحافظ الاستثمارية والأصول بسعر السوق اللحظي.
            </CardContent>
          </Card>

          <Card className="fintech-surface-card">
            <CardHeader className="pb-2">
              <CardDescription>إجمالي الأصول الموحدة</CardDescription>
              <CardTitle className="text-2xl font-bold">
                <SensitiveValue>
                  {formatMoney(data?.totalConsolidatedAssets ?? "0", selectedCurrency, 2)}
                </SensitiveValue>
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">
              النقد السائل + الاستثمارات + الأصول العينية عبر كافة الكيانات.
            </CardContent>
          </Card>

          <Card className="fintech-surface-card">
            <CardHeader className="pb-2">
              <CardDescription>الالتزامات والمطالبات البينية المفصح عنها</CardDescription>
              <CardTitle className="text-2xl font-bold text-amber-600">
                <SensitiveValue>
                  {formatMoney(data?.totalDisclosedInterEntityClaims ?? "0", selectedCurrency, 2)}
                </SensitiveValue>
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">
              {data?.interEntityDisclosures.length ?? 0} مطالبة مفصح عنها تخضع للإفصاح دون إلغاء وهمي.
            </CardContent>
          </Card>
        </section>

        {/* Detailed Tabs: Breakdown, Allocation, Inter-Entity Disclosures */}
        <Tabs defaultValue="entities" className="space-y-4">
          <TabsList className="investment-tabs-list">
            <TabsTrigger value="entities" className="gap-1.5">
              <Layers className="size-4" />
              تفكيك الكيانات ومساحات العمل ({data?.workspaces.length ?? 0})
            </TabsTrigger>
            <TabsTrigger value="allocation" className="gap-1.5">
              <PieChart className="size-4" />
              التوزيع المالي والأصول الموحدة
            </TabsTrigger>
            <TabsTrigger value="disclosures" className="gap-1.5">
              <ShieldAlert className="size-4" />
              إفصاح المعاملات البينية ({data?.interEntityDisclosures.length ?? 0})
            </TabsTrigger>
          </TabsList>

          {/* Tab 1: Entities Breakdown */}
          <TabsContent value="entities">
            <Card className="fintech-surface-card">
              <CardHeader>
                <CardTitle>جدول تفكيك الكيانات المجمعة</CardTitle>
                <CardDescription>
                  عرض تفصيلي لكل مساحة عمل مع سعر الصرف المعتمد للتحويل، وقيم الثروة بعملة الأصل وبالعملة الموحدة.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {consolidationQuery.isLoading ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">جارٍ تجميع وتوحيد بيانات الكيانات…</p>
                ) : data?.workspaces.length ? (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[950px] text-right text-sm">
                      <thead className="bg-slate-50 text-xs text-slate-600">
                        <tr>
                          <th className="p-3">الكيان / المساحة</th>
                          <th className="p-3">الدور</th>
                          <th className="p-3">عملة الكيان</th>
                          <th className="p-3">سعر التحويل ({selectedCurrency})</th>
                          <th className="p-3">الصافي الدفتري (الأصل)</th>
                          <th className="p-3">الصافي الدفتري ({selectedCurrency})</th>
                          <th className="p-3">القيمة الاقتصادية ({selectedCurrency})</th>
                          <th className="p-3">السيولة النقدية</th>
                          <th className="p-3">الالتزامات</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {data.workspaces.map(ws => (
                          <tr key={ws.workspaceId} className="hover:bg-slate-50/50">
                            <td className="p-3 font-semibold">
                              {ws.workspaceName}
                              <span className="block text-[11px] font-normal text-muted-foreground">معرّف: #{ws.workspaceId}</span>
                            </td>
                            <td className="p-3">
                              <Badge variant="outline">{ws.role}</Badge>
                            </td>
                            <td className="p-3 font-mono text-xs">{ws.baseCurrency}</td>
                            <td className="p-3">
                              <span className="font-mono text-xs font-semibold">{ws.fxRateToPresentation}</span>
                              <Badge
                                variant={ws.fxRateStatus === "authoritative" || ws.fxRateStatus === "identity" ? "secondary" : "destructive"}
                                className="mr-2 text-[10px]"
                              >
                                {ws.fxRateStatus === "identity"
                                  ? "مطابقة"
                                  : ws.fxRateStatus === "authoritative"
                                  ? "موثق"
                                  : ws.fxRateStatus === "stale"
                                  ? "قديم >48h"
                                  : "غير متوفر"}
                              </Badge>
                            </td>
                            <td className="p-3 font-mono text-xs">
                              <SensitiveValue>{formatMoney(ws.grossBookNetWorthLocal, ws.baseCurrency, 2)}</SensitiveValue>
                            </td>
                            <td className="p-3 font-mono text-xs font-bold text-emerald-600">
                              <SensitiveValue>{formatMoney(ws.grossBookNetWorthConverted, selectedCurrency, 2)}</SensitiveValue>
                            </td>
                            <td className="p-3 font-mono text-xs font-bold text-primary">
                              <SensitiveValue>{formatMoney(ws.economicNetWorthConverted, selectedCurrency, 2)}</SensitiveValue>
                            </td>
                            <td className="p-3 font-mono text-xs">
                              <SensitiveValue>{formatMoney(ws.liquidCashConverted, selectedCurrency, 2)}</SensitiveValue>
                            </td>
                            <td className="p-3 font-mono text-xs text-rose-600">
                              <SensitiveValue>{formatMoney(ws.liabilitiesConverted, selectedCurrency, 2)}</SensitiveValue>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="py-8 text-center text-sm text-muted-foreground">لا توجد بيانات متاحة للكيانات المحددة.</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab 2: Consolidated Asset Allocation */}
          <TabsContent value="allocation">
            <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
              <Card className="fintech-surface-card">
                <CardHeader>
                  <CardTitle>التوزيع المالي الموحد حسب فئة الأصل</CardTitle>
                  <CardDescription>
                    تجميع أوزان الأصول لكافة الكيانات المحددة بعد التحويل لعملة العرض ({selectedCurrency}).
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {data?.assetAllocation.map(item => (
                    <div key={item.assetClass} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold">{item.labelAr}</span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-muted-foreground">
                            <SensitiveValue>{formatMoney(item.amountConverted, selectedCurrency, 2)}</SensitiveValue>
                          </span>
                          <Badge variant="outline" className="font-mono text-[11px]">
                            {item.weightPercentage}%
                          </Badge>
                        </div>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full bg-primary transition-all"
                          style={{ width: `${Math.min(100, Math.max(0, parseFloat(item.weightPercentage)))}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className="fintech-surface-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Wallet className="size-5 text-emerald-600" />
                    المعادلة التحفظية بعد الإفصاح البيني
                  </CardTitle>
                  <CardDescription>
                    المقارنة بين صافي الثروة المجمع الإجمالي (Gross) والنطاق التحفظي بافتراض شطب الالتزامات والمستحقات المتبادلة.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">صافي الثروة المجمع الإجمالي (Gross):</span>
                      <span className="font-mono text-sm font-bold text-emerald-700">
                        <SensitiveValue>
                          {formatMoney(data?.netWorthPostDisclosureRange.gross ?? "0", selectedCurrency, 2)}
                        </SensitiveValue>
                      </span>
                    </div>
                    <div className="flex items-center justify-between border-t pt-2">
                      <span className="text-xs text-muted-foreground">إجمالي المطالبات البينية المفصح عنها:</span>
                      <span className="font-mono text-sm font-semibold text-amber-700">
                        <SensitiveValue>
                          {formatMoney(data?.totalDisclosedInterEntityClaims ?? "0", selectedCurrency, 2)}
                        </SensitiveValue>
                      </span>
                    </div>
                    <div className="flex items-center justify-between border-t pt-2">
                      <span className="text-xs font-semibold">النطاق الأدنى التحفظي (Conservative Minimum):</span>
                      <span className="font-mono text-sm font-bold text-primary">
                        <SensitiveValue>
                          {formatMoney(
                            data?.netWorthPostDisclosureRange.minAssumingAllInterEntityEliminated ?? "0",
                            selectedCurrency,
                            2
                          )}
                        </SensitiveValue>
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {data?.netWorthPostDisclosureRange.disclosureNote}
                  </p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Tab 3: Inter-Entity Disclosures */}
          <TabsContent value="disclosures">
            <Card className="fintech-surface-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertCircle className="size-5 text-amber-600" />
                  سجل إفصاح المعاملات والمطالبات البينية
                </CardTitle>
                <CardDescription>
                  التزامًا بمعايير الحوكمة المالية الدقيقة لـ FAMILY، يتم توثيق وإفصاح المعاملات البينية دون إجراء شطب أو تسوية وهمية غير مستندة لعقد إداري رسمي.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {data?.interEntityDisclosures.length ? (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[850px] text-right text-sm">
                      <thead className="bg-slate-50 text-xs text-slate-600">
                        <tr>
                          <th className="p-3">الكيان المصدر</th>
                          <th className="p-3">الطرف المقابل المسمى</th>
                          <th className="p-3">نوع المطالبة / الالتزام</th>
                          <th className="p-3">المبلغ الأصلي</th>
                          <th className="p-3">المعادل بـ ({selectedCurrency})</th>
                          <th className="p-3">حالة الإلغاء المحاسبي</th>
                          <th className="p-3">ملاحظة الحوكمة</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {data.interEntityDisclosures.map((d, index) => (
                          <tr key={index} className="hover:bg-slate-50/50">
                            <td className="p-3 font-semibold">{d.sourceWorkspaceName}</td>
                            <td className="p-3 font-medium">{d.counterpartyName}</td>
                            <td className="p-3">
                              <Badge variant="outline" className="text-[11px]">
                                {d.claimType === "personal_iou_receivable"
                                  ? "مستحق له (Receivable)"
                                  : d.claimType === "personal_iou_payable"
                                  ? "مستحق عليه (Payable)"
                                  : "التزام دين (Debt)"}
                              </Badge>
                            </td>
                            <td className="p-3 font-mono text-xs">
                              <SensitiveValue>{formatMoney(d.amountOriginal, d.currency, 2)}</SensitiveValue>
                            </td>
                            <td className="p-3 font-mono text-xs font-semibold">
                              <SensitiveValue>{formatMoney(d.amountConverted, selectedCurrency, 2)}</SensitiveValue>
                            </td>
                            <td className="p-3">
                              <Badge variant="secondary" className="text-[11px] bg-amber-50 text-amber-900 border-amber-200">
                                إفصاح دون شطب وهمي
                              </Badge>
                            </td>
                            <td className="p-3 text-xs text-muted-foreground">{d.disclosureNote}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    لا توجد مطالبات أو ديون بينية مسجلة في الكيانات المحددة.
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </DashboardLayout>
  );
}
