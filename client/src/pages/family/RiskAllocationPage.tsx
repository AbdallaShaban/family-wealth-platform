import DashboardLayout from "@/components/DashboardLayout";
import PageHeader from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { calculateAllocationSum } from "@/lib/allocationSum";
import { Loader2, Target, TrendingUp } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { EmptyState, InlineError, money, PageLoading, textError, useFamilyPermissions } from "./familyShared";

export const assetClassLabel: Record<string, string> = {
  cash: "سيولة",
  equity: "أسهم وصناديق",
  fixed_income: "دخل ثابت",
  alternatives: "بدائل",
  other: "أخرى",
};

export const riskLevelLabel: Record<string, string> = {
  conservative: "محافظ",
  moderate: "متوازن",
  growth: "نمو",
  aggressive: "مرتفع المخاطر",
};

export type AllocationDraft = {
  assetClass: "cash" | "equity" | "fixed_income" | "alternatives" | "other";
  targetPercent: string;
  driftThresholdPercent: string;
};

export const allocationClasses: AllocationDraft["assetClass"][] = ["cash", "equity", "fixed_income", "alternatives", "other"];
export const emptyAllocationDraft = (): AllocationDraft[] =>
  allocationClasses.map(assetClass => ({ assetClass, targetPercent: "", driftThresholdPercent: "" }));

export default function RiskAllocationPage({ embedded = false }: { embedded?: boolean }) {
  const utils = trpc.useUtils();
  const access = useFamilyPermissions();
  const summary = trpc.family.risk.summary.useQuery();

  const [riskLevel, setRiskLevel] = useState<"conservative" | "moderate" | "growth" | "aggressive">("moderate");
  const [score, setScore] = useState("");
  const [rationale, setRationale] = useState("");
  const [targets, setTargets] = useState<AllocationDraft[]>(emptyAllocationDraft);

  useEffect(() => {
    const profile = summary.data?.riskProfile;
    if (profile) {
      setRiskLevel(profile.riskLevel);
      setScore(profile.questionnaireScore === null ? "" : String(profile.questionnaireScore));
      setRationale(profile.rationale || "");
    }
    const rows = summary.data?.allocation.classes;
    if (rows) {
      setTargets(
        rows.map(row => ({
          assetClass: row.assetClass as AllocationDraft["assetClass"],
          targetPercent: row.targetPercent ?? "",
          driftThresholdPercent: row.driftThresholdPercent ?? "",
        }))
      );
    }
  }, [summary.data?.riskProfile?.id, summary.data?.allocation.totalValuedBase]);

  const saveProfile = trpc.family.risk.upsertProfile.useMutation({
    onSuccess: () => {
      toast.success("تم حفظ ملف المخاطر داخل مساحة FAMILY الحالية.");
      void utils.family.risk.summary.invalidate();
    },
    onError: error => toast.error(textError(error)),
  });

  const saveTargets = trpc.family.risk.upsertAllocationTargets.useMutation({
    onSuccess: () => {
      toast.success("تم حفظ التخصيص المستهدف. سيعاد حساب الانحراف من القيم المقيمة.");
      void utils.family.risk.summary.invalidate();
    },
    onError: error => toast.error(textError(error)),
  });

  const updateTarget = (assetClass: AllocationDraft["assetClass"], field: "targetPercent" | "driftThresholdPercent", value: string) =>
    setTargets(current => current.map(target => (target.assetClass === assetClass ? { ...target, [field]: value } : target)));

  const allocationSum = useMemo(() => calculateAllocationSum(targets.map(t => t.targetPercent)), [targets]);

  const saveRisk = (event: React.FormEvent) => {
    event.preventDefault();
    saveProfile.mutate({ riskLevel, questionnaireScore: score ? Number(score) : null, rationale: rationale || null });
  };

  const saveAllocation = (event: React.FormEvent) => {
    event.preventDefault();
    if (!allocationSum.isValid) {
      toast.error(`يجب أن يكون مجموع نسب التخصيص 100% بالضبط (المجموع الحالي: ${allocationSum.total}%, المتبقي: ${allocationSum.remaining}%).`);
      return;
    }
    saveTargets.mutate({ targets });
  };

  const content = (
    <div dir="rtl" className="mx-auto max-w-7xl space-y-6">
        <PageHeader
          title="ملف المخاطر والتخصيص"
          description="التوزيع الفعلي يجمع السيولة والحيازات ذات الأسعار وسعر الصرف الموثقين فقط. «راجع الانحراف» تنبيه تحليلي لمراجعة الهدف، ولا ينفذ صفقة أو يقدم توصية شراء وبيع."
          icon={Target}
          breadcrumbs={[
            { label: "الاستثمار والتداول", href: "/investments" },
            { label: "ملف المخاطر والتخصيص" },
          ]}
          badge="تخصيص الأصول"
        />
        {summary.isLoading ? (
          <PageLoading />
        ) : summary.error ? (
          <InlineError message={textError(summary.error)} />
        ) : (
          <>
            <section className="grid gap-6 xl:grid-cols-[.8fr_1.2fr]">
              <Card>
                <CardHeader>
                  <CardTitle>ملف المخاطر</CardTitle>
                  <CardDescription>هذا ملف معلن من المستخدم؛ لا تستنتج المنصة تحمل المخاطر من سجل المعاملات وحده.</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={saveRisk} className="grid gap-4">
                    <div className="grid gap-2">
                      <Label>المستوى المعلن</Label>
                      <Select value={riskLevel} onValueChange={value => setRiskLevel(value as typeof riskLevel)} disabled={!access.canEdit}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(riskLevelLabel).map(([value, label]) => (
                            <SelectItem key={value} value={value}>{label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="risk-score">درجة استبيان موثقة (اختيارية، 0–100)</Label>
                      <Input id="risk-score" type="number" min="0" max="100" value={score} onChange={event => setScore(event.target.value)} disabled={!access.canEdit} />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="risk-rationale">سياق أو مبرر</Label>
                      <Textarea id="risk-rationale" maxLength={2000} value={rationale} onChange={event => setRationale(event.target.value)} disabled={!access.canEdit} placeholder="مثال: مدة الاستثمار والسيولة المطلوبة..." />
                    </div>
                    <Button type="submit" disabled={saveProfile.isPending || !access.canEdit}>
                      {saveProfile.isPending && <Loader2 className="ml-2 size-4 animate-spin" />}
                      {access.canEdit ? "حفظ ملف المخاطر" : "تتطلب صلاحية محرر"}
                    </Button>
                  </form>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>التخصيص الفعلي</CardTitle>
                  <CardDescription>إجمالي مقيم: {money(summary.data?.allocation.totalValuedBase, summary.data?.baseCurrency || "EGP")}</CardDescription>
                </CardHeader>
                <CardContent>
                  {summary.data?.allocation.classes.some(row => row.actualAmount !== "0.000000") ? (
                    <div className="space-y-3">
                      {summary.data.allocation.classes.map(row => (
                        <div key={row.assetClass} className="rounded-xl border border-slate-200/90 dark:border-slate-800/80 bg-white dark:bg-[#0E1420] p-4">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="font-semibold text-slate-900 dark:text-white">{assetClassLabel[row.assetClass]}</p>
                            <Badge variant={row.status === "review" ? "destructive" : row.status === "within_band" ? "secondary" : "outline"}>
                              {row.status === "review" ? "راجع الانحراف" : row.status === "within_band" ? "ضمن الحد" : "لا يوجد هدف"}
                            </Badge>
                          </div>
                          <div className="mt-3 grid gap-2 text-sm sm:grid-cols-4 text-slate-600 dark:text-slate-300">
                            <span>القيمة: {money(row.actualAmount, summary.data.baseCurrency)}</span>
                            <span>الفعلي: {row.actualPercent}%</span>
                            <span>المستهدف: {row.targetPercent === null ? "—" : `${row.targetPercent}%`}</span>
                            <span>الانحراف: {row.driftPercent === null ? "—" : `${row.driftPercent}%`}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <EmptyState icon={TrendingUp} title="لا توجد قيم مقيمة للتخصيص" description="سجل حسابًا أو حيازة وسعرًا وFX موثقًا، ثم سيُحسب التوزيع الفعلي من البيانات المتاحة فقط." />
                  )}
                  {summary.data?.unvaluedCurrencies.length || summary.data?.unvaluedInstruments.length ? (
                    <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-900/60 dark:bg-amber-950/20 p-4 text-sm text-amber-900 dark:text-amber-200">
                      مستبعد من التوزيع إلى حين التقييم: {[...summary.data.unvaluedCurrencies, ...summary.data.unvaluedInstruments].join("، ")}.
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            </section>
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <CardTitle>التخصيص المستهدف وحدود الانحراف</CardTitle>
                    <CardDescription>يجب أن يبلغ مجموع النسب 100% بالضبط. لا تُنشئ هذه الإعدادات أوامر إعادة توازن؛ هي معيار مراجعة شفاف للتوزيع الفعلي.</CardDescription>
                  </div>
                  <Badge variant={allocationSum.isValid ? "default" : "destructive"} className="px-3 py-1.5 text-xs font-semibold">
                    {allocationSum.isValid ? `✓ المجموع: ${allocationSum.total}% (مكتمل)` : `⚠ المجموع: ${allocationSum.total}% | المتبقي: ${allocationSum.remaining}%`}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <form onSubmit={saveAllocation} className="space-y-4">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[620px] text-right text-sm">
                      <thead className="bg-slate-50 text-xs text-slate-500">
                        <tr>
                          <th className="p-3">فئة الأصول</th>
                          <th className="p-3">هدف %</th>
                          <th className="p-3">حد الانحراف %</th>
                        </tr>
                      </thead>
                      <tbody>
                        {targets.map(target => (
                          <tr key={target.assetClass} className="border-t">
                            <td className="p-3 font-medium">{assetClassLabel[target.assetClass]}</td>
                            <td className="p-3">
                              <Input value={target.targetPercent} onChange={event => updateTarget(target.assetClass, "targetPercent", event.target.value)} disabled={!access.canEdit} inputMode="decimal" required />
                            </td>
                            <td className="p-3">
                              <Input value={target.driftThresholdPercent} onChange={event => updateTarget(target.assetClass, "driftThresholdPercent", event.target.value)} disabled={!access.canEdit} inputMode="decimal" required />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <Button type="submit" disabled={saveTargets.isPending || !access.canEdit || !allocationSum.isValid}>
                    {saveTargets.isPending && <Loader2 className="ml-2 size-4 animate-spin" />}
                    {access.canEdit ? (allocationSum.isValid ? "حفظ معايير التخصيص" : `المجموع ${allocationSum.total}% (يجب أن يكون 100%)`) : "تتطلب صلاحية محرر"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </>
        )}
      </div>
  );

  if (embedded) return content;
  return <DashboardLayout>{content}</DashboardLayout>;
}
export { RiskAllocationPage };
