import DashboardLayout from "@/components/DashboardLayout";
import PageHeader from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { TrendingUp } from "lucide-react";
import { EmptyState, InlineError, money, PageLoading, textError } from "./familyShared";
import { assetClassLabel } from "./RiskAllocationPage";

export default function RebalanceReviewPage() {
  const summary = trpc.family.risk.summary.useQuery();
  if (summary.isLoading) return <DashboardLayout><PageLoading /></DashboardLayout>;
  if (summary.error) return <DashboardLayout><InlineError message={textError(summary.error)} /></DashboardLayout>;
  const data = summary.data;
  if (!data) return <DashboardLayout><PageLoading /></DashboardLayout>;

  return (
    <DashboardLayout>
      <div dir="rtl" className="mx-auto max-w-6xl space-y-6">
        <PageHeader
          title="مراجعة إعادة التوازن"
          description="تقارن هذه الشاشة التوزيع الفعلي المقيم بالهدف المحفوظ. لا تنشئ صفقة أو تحدد أداة أو توقيتًا للتداول؛ تعرض فقط مبلغ التقارب الحسابي المطلوب داخل كل فئة."
          breadcrumbs={[
            { label: "الرئيسية", href: "/" },
            { label: "الاستثمار والتداول", href: "/investments" },
            { label: "مراجعة إعادة التوازن" },
          ]}
          badge={{ text: "توازن الحافظة", variant: "institutional" }}
          icon={TrendingUp}
        />
        {data.allocation.totalValuedBase === "0.000000" ? (
          <EmptyState
            icon={TrendingUp}
            title="لا توجد قيم مقيمة للمراجعة"
            description="أدخل حسابات أو حيازات مع أسعار وسعر صرف موثقين قبل حساب فجوة إعادة التوازن."
          />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>الانحراف ومبلغ التقارب</CardTitle>
              <CardDescription>
                إجمالي الأصول المقيمة: {money(data.allocation.totalValuedBase, data.baseCurrency)}. كل مبلغ أدناه هو الفرق بين القيمة الفعلية وقيمة الهدف للحافظة ذاتها.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {data.allocation.classes.map(row => (
                  <div
                    key={row.assetClass}
                    className={`rounded-xl border p-4 transition-colors ${
                      row.status === "review"
                        ? "border-amber-200 bg-amber-50 dark:border-amber-900/60 dark:bg-amber-950/20"
                        : "border-slate-200/90 dark:border-slate-800/80 bg-white dark:bg-[#0E1420]"
                    }`}
                  >
                    <div className="flex flex-col justify-between gap-3 sm:flex-row">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-slate-900 dark:text-white">{assetClassLabel[row.assetClass]}</p>
                          <Badge variant={row.status === "review" ? "destructive" : row.status === "within_band" ? "secondary" : "outline"}>
                            {row.status === "review" ? "تتطلب مراجعة" : row.status === "within_band" ? "ضمن الحد" : "لا يوجد هدف"}
                          </Badge>
                        </div>
                        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                          فعلي {row.actualPercent}% مقابل مستهدف {row.targetPercent === null ? "—" : `${row.targetPercent}%`} · الانحراف {row.driftPercent === null ? "—" : `${row.driftPercent}%`}
                        </p>
                      </div>
                      {row.adjustmentToTarget === null ? (
                        <span className="text-sm text-slate-500 dark:text-slate-400">احفظ هدفًا لهذه الفئة.</span>
                      ) : (
                        <div className="text-right">
                          <p className="text-xs text-slate-500 dark:text-slate-400">مبلغ التقارب إلى الهدف</p>
                          <p className="mt-1 font-semibold text-slate-900 dark:text-white font-mono tabular-nums">
                            {Number(row.adjustmentToTarget) === 0
                              ? "لا فرق"
                              : `${Number(row.adjustmentToTarget) > 0 ? "زيادة" : "خفض"} ${money(Math.abs(Number(row.adjustmentToTarget)).toFixed(6), data.baseCurrency)}`}
                          </p>
                        </div>
                      )}
                    </div>
                    <p className="mt-3 text-xs leading-5 text-slate-500 dark:text-slate-400">
                      هذا مقياس توزيع حتمي، وليس توصية شخصية أو أمر تداول. راجع السيولة والضرائب والرسوم والقيود قبل أي قرار خارجي.
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
export { RebalanceReviewPage };
