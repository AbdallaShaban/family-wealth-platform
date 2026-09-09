import React, { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Landmark, ArrowRight, ArrowLeft, CheckCircle2, ShieldCheck, Sparkles, Loader2 } from "lucide-react";
import { useLocation } from "wouter";

export interface OnboardingWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceName: string;
  baseCurrency: string;
}

export function OnboardingWizard({ open, onOpenChange, workspaceName, baseCurrency }: OnboardingWizardProps) {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Step 2 Form
  const [accountName, setAccountName] = useState("الحساب الجاري الرئيسي");
  const [accountType, setAccountType] = useState<"bank" | "cash" | "brokerage" | "wallet">("bank");
  const [currency, setCurrency] = useState(baseCurrency || "EGP");
  const [institution, setInstitution] = useState("");
  const [openingBalance, setOpeningBalance] = useState("");

  const createAccount = trpc.family.accounts.create.useMutation({
    onSuccess: () => {
      toast.success("تم إنشاء الحساب الأول بنجاح ورُحل الرصيد الافتتاحي في دفتر الأستاذ.");
      void utils.family.dashboard.invalidate();
      void utils.family.accounts.list.invalidate();
      void utils.family.ledger.recent.invalidate();
      setStep(3);
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "فشل إنشاء الحساب.");
    },
  });

  const handleCreateFirstAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountName.trim()) {
      return toast.error("أدخل اسم الحساب.");
    }
    createAccount.mutate({
      name: accountName.trim(),
      accountType,
      currency: currency.toUpperCase(),
      institution: institution.trim() || null,
      openingBalance: openingBalance ? openingBalance : null,
      occurredAt: Date.now(),
      idempotencyKey: crypto.randomUUID(),
    });
  };

  const finishAndNavigate = (path: string) => {
    onOpenChange(false);
    setLocation(path);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="sm:max-w-lg p-6">
        <DialogHeader className="text-right">
          <div className="flex items-center gap-2 mb-1 text-emerald-600">
            <Sparkles className="size-5" />
            <span className="text-xs font-semibold uppercase tracking-wider">مساعد الإعداد المالي الأولي</span>
          </div>
          <DialogTitle className="text-xl">
            {step === 1 && "مرحبًا بك في مساحة FAMILY"}
            {step === 2 && "إضافة أول حساب مالي"}
            {step === 3 && "اكتمل الإعداد الأولي بنجاح!"}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {step === 1 && "نظام FAMILY مبني على دفتر أستاذ مزدوج القيد يضمن موثوقية كل رقم ورصيد."}
            {step === 2 && "أنشئ حسابك المصرفي أو النقدي الأول لتفعيل مؤشرات الثروة والميزانية."}
            {step === 3 && "مساحتك جاهزة الآن؛ يمكنك البدء في تسجيل العمليات أو استكشاف المنظومة."}
          </DialogDescription>
        </DialogHeader>

        {/* Steps Progress Indicators */}
        <div className="flex items-center justify-between gap-2 py-2">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                s <= step ? "bg-emerald-600" : "bg-muted"
              }`}
            />
          ))}
        </div>

        {/* STEP 1: Welcome & Confirmation */}
        {step === 1 && (
          <div className="space-y-4 py-3">
            <div className="rounded-xl border bg-muted/30 p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">اسم المساحة المالية:</span>
                <span className="font-semibold text-foreground">{workspaceName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">العملة الأساسية الموحدة:</span>
                <span className="font-semibold font-mono text-emerald-700 dark:text-emerald-400">{baseCurrency}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">نموذج الدفتر:</span>
                <span className="font-semibold text-foreground">قيد مزدوج (Double-Entry)</span>
              </div>
            </div>

            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3.5 text-xs text-muted-foreground flex items-start gap-2.5">
              <ShieldCheck className="size-4 text-emerald-600 shrink-0 mt-0.5" />
              <p>
                لا يتم تعديل الأرصدة يدويًا؛ كل زيادة أو نقصان ينشأ من قيد محاسبي منشور قابل للتدقيق.
              </p>
            </div>

            <div className="flex justify-between pt-3">
              <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
                تخطي المساعد
              </Button>
              <Button size="sm" onClick={() => setStep(2)} className="gap-2">
                <span>المتابعة إلى الحساب الأول</span>
                <ArrowLeft className="size-4" />
              </Button>
            </div>
          </div>
        )}

        {/* STEP 2: First Account Creation */}
        {step === 2 && (
          <form onSubmit={handleCreateFirstAccount} className="space-y-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="wiz-acc-name">اسم الحساب</Label>
              <Input
                id="wiz-acc-name"
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                placeholder="مثال: الحساب الجاري في البنك الأهلي"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>نوع الحساب</Label>
                <Select value={accountType} onValueChange={(val) => setAccountType(val as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bank">حساب بنكي</SelectItem>
                    <SelectItem value="cash">خزينة / نقدية</SelectItem>
                    <SelectItem value="brokerage">محفظة استثمارية</SelectItem>
                    <SelectItem value="wallet">محفظة رقمية</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="wiz-acc-cur">العملة</Label>
                <Input
                  id="wiz-acc-cur"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                  maxLength={3}
                  minLength={3}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="wiz-acc-inst">الجهة المالية (اختياري)</Label>
                <Input
                  id="wiz-acc-inst"
                  value={institution}
                  onChange={(e) => setInstitution(e.target.value)}
                  placeholder="مثال: البنك الأهلي"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="wiz-acc-balance">الرصيد الافتتاحي (اختياري)</Label>
                <Input
                  id="wiz-acc-balance"
                  inputMode="decimal"
                  value={openingBalance}
                  onChange={(e) => setOpeningBalance(e.target.value)}
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="flex justify-between pt-3 border-t">
              <Button type="button" variant="outline" size="sm" onClick={() => setStep(1)}>
                <ArrowRight className="size-4 ml-1" />
                رجوع
              </Button>
              <Button type="submit" size="sm" disabled={createAccount.isPending} className="gap-2">
                {createAccount.isPending && <Loader2 className="size-4 animate-spin" />}
                إنشاء الحساب وتفعيله
              </Button>
            </div>
          </form>
        )}

        {/* STEP 3: Complete & Redirection */}
        {step === 3 && (
          <div className="space-y-4 py-4 text-center">
            <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
              <CheckCircle2 className="size-8" />
            </div>

            <div className="space-y-1">
              <h3 className="text-base font-bold">تم تأسيس نقطة البداية بنجاح</h3>
              <p className="text-xs text-muted-foreground">
                يمكنك الآن التوجه لمتابعة الحسابات، أو البدء في تسجيل العمليات، أو استكشاف لوحة التحكم.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-3">
              <Button variant="outline" onClick={() => finishAndNavigate("/cash-flow")}>
                تسجيل تدفق مالي
              </Button>
              <Button onClick={() => finishAndNavigate("/accounts")}>
                عرض الحسابات
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
