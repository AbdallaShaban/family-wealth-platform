import React, { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  DashboardLayout,
  PageHeader,
  InlineError,
  money,
  dateTime,
  textError,
  eventLabel,
  useFamilyPermissions,
} from "./familyShared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CalendarClock, Loader2 } from "lucide-react";

export const recurringCadenceLabel: Record<string, string> = {
  weekly: "أسبوعي",
  monthly: "شهري",
  quarterly: "ربع سنوي",
  yearly: "سنوي",
};

export function RecurringRulesCard() {
  const utils = trpc.useUtils();
  const access = useFamilyPermissions();
  const accounts = trpc.family.accounts.list.useQuery();
  const categories = trpc.family.cashFlow.categories.useQuery();
  const rules = trpc.family.cashFlow.recurring.list.useQuery();
  const [eventType, setEventType] = useState<"income" | "expense">("expense");
  const [accountId, setAccountId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [amount, setAmount] = useState("");
  const [cadence, setCadence] = useState<"weekly" | "monthly" | "quarterly" | "yearly">("monthly");
  const [nextRunAt, setNextRunAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [memo, setMemo] = useState("");

  const create = trpc.family.cashFlow.recurring.create.useMutation({
    onSuccess: () => {
      toast.success("تمت جدولة القاعدة وتفعيلها. ستُنشر العملية عند موعدها بقيد متوازن ومصدر نظامي قابل للتدقيق.");
      setAmount("");
      setMemo("");
      setEndsAt("");
      void utils.family.cashFlow.recurring.list.invalidate();
    },
    onError: error => toast.error(textError(error)),
  });

  const pause = trpc.family.cashFlow.recurring.pause.useMutation({
    onSuccess: () => {
      toast.success("تم إيقاف القاعدة المتكررة.");
      void utils.family.cashFlow.recurring.list.invalidate();
    },
    onError: error => toast.error(textError(error)),
  });

  const resume = trpc.family.cashFlow.recurring.resume.useMutation({
    onSuccess: () => {
      toast.success("تم استئناف القاعدة المتكررة.");
      void utils.family.cashFlow.recurring.list.invalidate();
    },
    onError: error => toast.error(textError(error)),
  });

  const selectedAccount = accounts.data?.find(account => String(account.id) === accountId);
  const requiresCategory = true;
  const eligibleCategories = (categories.data ?? []).filter(category => category.direction === eventType);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedAccount || !nextRunAt) return toast.error("اختر الحساب وموعد أول تشغيل.");
    if (!categoryId) return toast.error("اختر فئة تدفق متوافقة مع نوع العملية.");
    create.mutate({
      accountId: selectedAccount.id,
      categoryId: Number(categoryId),
      eventType,
      amount,
      currency: selectedAccount.currency,
      cadence,
      nextRunAt: new Date(nextRunAt).getTime(),
      endsAt: endsAt ? new Date(endsAt).getTime() : null,
      memo: memo || null,
    });
  };

  const inputClass =
    "bg-white dark:bg-[#0E1420] border border-slate-300 dark:border-slate-700/80 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-xl font-medium text-xs py-2.5 px-3 focus:outline-hidden focus:border-slate-800 dark:focus:border-slate-400 focus:ring-1 focus:ring-slate-800 dark:focus:ring-slate-400 transition-all h-auto";

  return (
    <section className="grid gap-6 lg:grid-cols-[.85fr_1.15fr]">
      {/* Form Container (قاعدة جديدة) */}
      <div className="bg-white dark:bg-[#0B0F17] border border-slate-200/90 dark:border-slate-800/80 rounded-2xl p-6 shadow-xs">
        <div className="mb-6">
          <h3 className="text-slate-900 dark:text-white font-bold text-base mb-1">قاعدة جديدة</h3>
          <p className="text-slate-500 dark:text-slate-400 text-xs">
            حدد أول موعد وتيرة التنفيذ. يبقى تاريخ العملية هو الموعد المجدول حتى لو أُعيدت المحاولة لاحقًا.
          </p>
        </div>

        {accounts.isLoading || categories.isLoading ? (
          <Skeleton className="h-[36rem] rounded-xl" />
        ) : (
          <form onSubmit={submit} className="grid gap-4">
            <div>
              <Label className="text-slate-700 dark:text-slate-300 font-semibold text-xs mb-1.5 block">نوع العملية</Label>
              <Select
                value={eventType}
                onValueChange={value => {
                  setEventType(value as typeof eventType);
                  setCategoryId("");
                }}
                disabled={!access.canEdit}
              >
                <SelectTrigger className={inputClass}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="income">دخل</SelectItem>
                  <SelectItem value="expense">مصروف</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-slate-700 dark:text-slate-300 font-semibold text-xs mb-1.5 block">الحساب</Label>
              <Select value={accountId} onValueChange={setAccountId} disabled={!access.canEdit}>
                <SelectTrigger className={inputClass}>
                  <SelectValue placeholder="اختر حسابًا نقديًا أو مصرفيًا" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.data
                    ?.filter(account => ["cash", "bank", "brokerage", "wallet"].includes(account.accountType))
                    .map(account => (
                      <SelectItem key={account.id} value={String(account.id)}>
                        {account.name} — {account.currency}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            {requiresCategory && (
              <div>
                <Label className="text-slate-700 dark:text-slate-300 font-semibold text-xs mb-1.5 block">الفئة</Label>
                <Select value={categoryId || undefined} onValueChange={setCategoryId} disabled={!access.canEdit}>
                  <SelectTrigger className={inputClass}>
                    <SelectValue placeholder="اختر فئة متوافقة" />
                  </SelectTrigger>
                  <SelectContent>
                    {eligibleCategories.map(category => (
                      <SelectItem key={category.id} value={String(category.id)}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <Label htmlFor="recurring-amount" className="text-slate-700 dark:text-slate-300 font-semibold text-xs mb-1.5 block">
                المبلغ {selectedAccount ? `(${selectedAccount.currency})` : ""}
              </Label>
              <Input
                id="recurring-amount"
                value={amount}
                onChange={event => setAmount(event.target.value)}
                disabled={!access.canEdit}
                inputMode="decimal"
                required
                className={inputClass}
              />
            </div>

            <div>
              <Label className="text-slate-700 dark:text-slate-300 font-semibold text-xs mb-1.5 block">الوتيرة</Label>
              <Select value={cadence} onValueChange={value => setCadence(value as typeof cadence)} disabled={!access.canEdit}>
                <SelectTrigger className={inputClass}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(recurringCadenceLabel).map(([value, label]) => (
                    <SelectItem value={value} key={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="recurring-next-run" className="text-slate-700 dark:text-slate-300 font-semibold text-xs mb-1.5 block">
                أول موعد تشغيل
              </Label>
              <Input
                id="recurring-next-run"
                type="datetime-local"
                value={nextRunAt}
                onChange={event => setNextRunAt(event.target.value)}
                disabled={!access.canEdit}
                required
                className={inputClass}
              />
            </div>

            <div>
              <Label htmlFor="recurring-ends" className="text-slate-700 dark:text-slate-300 font-semibold text-xs mb-1.5 block">
                ينتهي في
              </Label>
              <Input
                id="recurring-ends"
                type="datetime-local"
                value={endsAt}
                onChange={event => setEndsAt(event.target.value)}
                disabled={!access.canEdit}
                className={inputClass}
              />
            </div>

            <div>
              <Label htmlFor="recurring-memo" className="text-slate-700 dark:text-slate-300 font-semibold text-xs mb-1.5 block">
                مذكرة
              </Label>
              <Textarea
                id="recurring-memo"
                value={memo}
                onChange={event => setMemo(event.target.value)}
                disabled={!access.canEdit}
                maxLength={2000}
                placeholder="اختياري"
                className={`${inputClass} resize-none`}
              />
            </div>

            <Button
              type="submit"
              disabled={create.isPending || !access.canEdit}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm py-2.5 px-6 rounded-xl shadow-sm transition-all dark:bg-white dark:hover:bg-slate-100 dark:text-slate-950 border border-slate-900 dark:border-transparent mt-4 h-auto"
            >
              {create.isPending && <Loader2 className="ml-2 size-4 animate-spin" />}
              {access.canEdit ? "إنشاء وتفعيل القاعدة" : "تتطلب صلاحية محرر"}
            </Button>
          </form>
        )}
      </div>

      {/* Rules List Container */}
      <div>
        {rules.isLoading ? (
          <div className="bg-white dark:bg-[#0B0F17] border border-slate-200/90 dark:border-slate-800/80 rounded-2xl p-6 shadow-xs">
            <Skeleton className="h-80 rounded-xl" />
          </div>
        ) : rules.error ? (
          <div className="bg-white dark:bg-[#0B0F17] border border-slate-200/90 dark:border-slate-800/80 rounded-2xl p-6 shadow-xs">
            <InlineError message={textError(rules.error)} />
          </div>
        ) : rules.data?.length ? (
          <div className="bg-white dark:bg-[#0B0F17] border border-slate-200/90 dark:border-slate-800/80 rounded-2xl p-6 shadow-xs">
            <div className="mb-4">
              <h3 className="text-slate-900 dark:text-white font-bold text-base mb-1">القواعد ضمن مساحة FAMILY الحالية</h3>
              <p className="text-slate-500 dark:text-slate-400 text-xs">
                الإيقاف والاستئناف يحدّثان المهمة المنشورة والحالة المحلية معًا، ولا يحذفا أثر القواعد السابقة.
              </p>
            </div>
            <div className="space-y-3">
              {rules.data.map(rule => (
                <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#0E1420] p-4 shadow-2xs" key={rule.id}>
                  <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-bold text-slate-900 dark:text-white">
                          {eventLabel[rule.eventType]} · {money(rule.amount, rule.currency)}
                        </p>
                        <Badge
                          variant="outline"
                          className={
                            rule.status === "active"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800"
                              : rule.status === "paused"
                                ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800"
                                : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                          }
                        >
                          {rule.status === "active" ? "نشطة" : rule.status === "paused" ? "موقوفة" : "مكتملة"}
                        </Badge>
                      </div>
                      <p className="mt-2 text-xs font-medium text-slate-600 dark:text-slate-400">
                        {rule.accountName}{rule.categoryName ? ` · ${rule.categoryName}` : ""} · {recurringCadenceLabel[rule.cadence]}
                      </p>
                      <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                        التشغيل التالي: {dateTime(rule.nextRunAt)}{rule.endsAt ? ` · ينتهي: ${dateTime(rule.endsAt)}` : ""}
                      </p>
                      {rule.memo && (
                        <p className="mt-3 rounded-lg bg-slate-50 dark:bg-slate-900/50 p-2.5 text-xs text-slate-600 dark:text-slate-400 border border-slate-100 dark:border-slate-800">
                          {rule.memo}
                        </p>
                      )}
                    </div>
                    {access.canEdit && (
                      <div className="flex shrink-0 gap-2">
                        {rule.status === "active" && (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => pause.mutate({ ruleId: rule.id })}
                            disabled={pause.isPending}
                            className="rounded-lg text-xs font-medium border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                          >
                            إيقاف
                          </Button>
                        )}
                        {rule.status === "paused" && (
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => resume.mutate({ ruleId: rule.id })}
                            disabled={resume.isPending}
                            className="rounded-lg text-xs font-medium bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:hover:bg-slate-100 dark:text-slate-950"
                          >
                            استئناف
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="bg-white dark:bg-[#0B0F17] border border-slate-200/90 dark:border-slate-800/80 rounded-2xl p-8 text-center shadow-xs flex flex-col items-center justify-center">
            <div className="size-12 rounded-2xl bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 flex items-center justify-center mb-3 border border-slate-200/60 dark:border-slate-700/60">
              <CalendarClock className="size-6" />
            </div>
            <h4 className="text-slate-900 dark:text-white font-bold text-sm mb-1">لا توجد قواعد متكررة</h4>
            <p className="text-slate-500 dark:text-slate-400 text-xs max-w-sm">
              أنشئ قاعدة لإيجار أو دخل منتظم أو إيداع دوري. لا تُنشأ أي عملية حتى يحين الموعد المحدد.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

export function RecurringRulesPage() {
  return (
    <DashboardLayout>
      <div dir="rtl" className="mx-auto max-w-7xl space-y-6">
        <PageHeader
          title="المعاملات المتكررة"
          description="كل قاعدة تنشئ مهمة دورية موثقة. عند الاستحقاق تستخدم المنصة مفتاح منع تكرار ثابتًا وتنشر العملية عبر دفتر القيود نفسه؛ لا توجد أرصدة معدّلة مباشرة."
          breadcrumbs={[
            { label: "الرئيسية", href: "/" },
            { label: "العمليات والسيولة", href: "/cash-flow" },
            { label: "المعاملات المتكررة" },
          ]}
          badge={{ text: "الجدولة بتوقيت UTC", variant: "outline" }}
          icon={CalendarClock}
        />
        <RecurringRulesCard />
      </div>
    </DashboardLayout>
  );
}

export default RecurringRulesPage;
