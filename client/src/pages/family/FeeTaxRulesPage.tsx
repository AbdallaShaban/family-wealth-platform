import DashboardLayout from "@/components/DashboardLayout";
import PageHeader from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { Loader2, ReceiptText } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { EmptyState, InlineError, money, textError, useFamilyPermissions } from "./familyShared";

export default function FeeTaxRulesPage() {
  const utils = trpc.useUtils();
  const access = useFamilyPermissions();
  const rules = trpc.family.feeTax.list.useQuery();
  const [name, setName] = useState("");
  const [chargeType, setChargeType] = useState<"fee" | "tax">("fee");
  const [appliesTo, setAppliesTo] = useState<"buy" | "sell" | "both">("both");
  const [calculationMethod, setCalculationMethod] = useState<"flat" | "percentage">("percentage");
  const [value, setValue] = useState("");
  const [currency, setCurrency] = useState("EGP");
  const [note, setNote] = useState("");

  const create = trpc.family.feeTax.create.useMutation({
    onSuccess: () => {
      toast.success("تم حفظ القاعدة. لا تؤثر في العمليات السابقة.");
      setName("");
      setValue("");
      setNote("");
      void utils.family.feeTax.list.invalidate();
    },
    onError: error => toast.error(textError(error)),
  });

  const archive = trpc.family.feeTax.archive.useMutation({
    onSuccess: () => {
      toast.success("تمت أرشفة القاعدة؛ لا تُحذف من سجل التدقيق.");
      void utils.family.feeTax.list.invalidate();
    },
    onError: error => toast.error(textError(error)),
  });

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    create.mutate({
      name,
      chargeType,
      appliesTo,
      calculationMethod,
      value,
      currency: calculationMethod === "flat" ? currency : null,
      jurisdictionNote: note || null,
    });
  };

  return (
    <DashboardLayout>
      <div dir="rtl" className="mx-auto max-w-7xl space-y-6">
        <PageHeader
          title="قواعد الرسوم والضرائب"
          description="احفظ رسوم وسيط أو ضريبة معلنة كمبلغ ثابت أو نسبة للصفقات. القاعدة لا تحدد التزامًا قانونيًا ولا تحل محل مستشار ضريبي؛ يجب توثيق مصدرها أو ولايتها في الملاحظة."
          breadcrumbs={[
            { label: "الرئيسية", href: "/" },
            { label: "الحوكمة والتحليل", href: "/operations" },
            { label: "قواعد الرسوم والضرائب" },
          ]}
          badge={{ text: "تكاليف صريحة", variant: "institutional" }}
          icon={ReceiptText}
        />
        <section className="grid gap-6 lg:grid-cols-[.8fr_1.2fr]">
          <Card>
            <CardHeader>
              <CardTitle>قاعدة جديدة</CardTitle>
              <CardDescription>
                تنطبق القواعد النشطة المختارة فقط على صفقة جديدة؛ لا تعيد المنصة حساب تاريخ العمليات السابقة.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={submit} className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="charge-name">الاسم</Label>
                  <Input id="charge-name" value={name} onChange={event => setName(event.target.value)} disabled={!access.canEdit} required minLength={2} />
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label>النوع</Label>
                    <Select value={chargeType} onValueChange={value => setChargeType(value as typeof chargeType)} disabled={!access.canEdit}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="fee">رسم</SelectItem>
                        <SelectItem value="tax">ضريبة</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>ينطبق على</Label>
                    <Select value={appliesTo} onValueChange={value => setAppliesTo(value as typeof appliesTo)} disabled={!access.canEdit}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="buy">شراء</SelectItem>
                        <SelectItem value="sell">بيع</SelectItem>
                        <SelectItem value="both">شراء وبيع</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label>الاحتساب</Label>
                    <Select value={calculationMethod} onValueChange={value => setCalculationMethod(value as typeof calculationMethod)} disabled={!access.canEdit}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="percentage">نسبة من قيمة الصفقة</SelectItem>
                        <SelectItem value="flat">مبلغ ثابت</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="charge-value">القيمة {calculationMethod === "percentage" ? "%" : ""}</Label>
                    <Input id="charge-value" value={value} onChange={event => setValue(event.target.value)} disabled={!access.canEdit} inputMode="decimal" required />
                  </div>
                </div>
                {calculationMethod === "flat" && (
                  <div className="grid gap-2">
                    <Label htmlFor="charge-currency">عملة المبلغ الثابت</Label>
                    <Input id="charge-currency" value={currency} onChange={event => setCurrency(event.target.value.toUpperCase())} disabled={!access.canEdit} minLength={3} maxLength={3} required />
                  </div>
                )}
                <div className="grid gap-2">
                  <Label htmlFor="charge-note">ولاية أو مصدر القاعدة</Label>
                  <Textarea id="charge-note" value={note} onChange={event => setNote(event.target.value)} disabled={!access.canEdit} maxLength={4000} placeholder="مثال: جدول رسوم الجهة أو مرجع ضريبي موثق" />
                </div>
                <Button type="submit" disabled={!access.canEdit || create.isPending}>
                  {create.isPending && <Loader2 className="ml-2 size-4 animate-spin" />}
                  {access.canEdit ? "حفظ القاعدة" : "تتطلب صلاحية محرر"}
                </Button>
              </form>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>القواعد المسجلة</CardTitle>
              <CardDescription>
                يُظهر كل سجل طريقة الاحتساب ونطاقه؛ القواعد المؤرشفة لا يمكن اختيارها للصفقات الجديدة.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {rules.isLoading ? (
                <Skeleton className="h-64" />
              ) : rules.error ? (
                <InlineError message={textError(rules.error)} />
              ) : rules.data?.length ? (
                <div className="space-y-3">
                  {rules.data.map(rule => (
                    <div key={rule.id} className="rounded-xl border border-slate-200/90 dark:border-slate-800/80 bg-white dark:bg-[#0E1420] p-4">
                      <div className="flex flex-col justify-between gap-3 sm:flex-row">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold text-slate-900 dark:text-white">{rule.name}</p>
                            <Badge variant={rule.status === "active" ? "secondary" : "outline"}>
                              {rule.status === "active" ? "نشطة" : "مؤرشفة"}
                            </Badge>
                            <Badge variant="outline">{rule.chargeType === "fee" ? "رسم" : "ضريبة"}</Badge>
                          </div>
                          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                            {rule.calculationMethod === "percentage"
                              ? `${rule.value}% من قيمة الصفقة`
                              : `${money(rule.value, rule.currency || "EGP")} ثابت`}{" "}
                            · {rule.appliesTo === "both" ? "شراء وبيع" : rule.appliesTo === "buy" ? "شراء" : "بيع"}
                          </p>
                          {rule.jurisdictionNote ? <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{rule.jurisdictionNote}</p> : null}
                        </div>
                        {rule.status === "active" && access.canEdit ? (
                          <Button type="button" variant="outline" size="sm" onClick={() => archive.mutate({ ruleId: rule.id })} disabled={archive.isPending}>
                            أرشفة
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={ReceiptText}
                  title="لا توجد قواعد رسوم أو ضرائب"
                  description="يمكنك إدخال الرسم أو الضريبة يدويًا في الصفقة حاليًا، أو حفظ قاعدة معلنة قابلة للاختيار للصفقات القادمة."
                />
              )}
            </CardContent>
          </Card>
        </section>
      </div>
    </DashboardLayout>
  );
}
export { FeeTaxRulesPage };
export { FeeTaxRulesPage as TaxRulesPage };
