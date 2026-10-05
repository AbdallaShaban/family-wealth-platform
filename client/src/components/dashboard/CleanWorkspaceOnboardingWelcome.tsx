import React, { useState } from "react";
import {
  Sparkles,
  Wallet,
  ScanText,
  Building2,
  PlusCircle,
  ShieldCheck,
  ArrowLeft,
  X,
  CreditCard,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SmartReceiptPasteModal } from "@/components/transactions/SmartReceiptPasteModal";
import { QuickOfflineTransactionModal } from "@/components/pwa/QuickOfflineTransactionModal";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";

interface CleanWorkspaceOnboardingWelcomeProps {
  workspaceId: number;
  workspaceName: string;
  userName?: string;
  accountCount?: number;
  transactionCount?: number;
}

export function CleanWorkspaceOnboardingWelcome({
  workspaceId,
  workspaceName,
  userName = "عزيزي المستخدم",
  accountCount = 0,
  transactionCount = 0,
}: CleanWorkspaceOnboardingWelcomeProps) {
  const [, setLocation] = useLocation();
  const storageKey = `family_clean_onboarding_dismissed_${workspaceId}`;
  const [dismissed, setDismissed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(storageKey) === "true";
  });

  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [quickTransactionOpen, setQuickTransactionOpen] = useState(false);

  const utils = trpc.useUtils();

  if (dismissed && transactionCount > 0) {
    return null;
  }

  const handleDismiss = () => {
    setDismissed(true);
    if (typeof window !== "undefined") {
      localStorage.setItem(storageKey, "true");
    }
  };

  return (
    <>
      <section
        aria-label="لوحة الترحيب وتهيئة مساحة العمل النظيفة"
        className="relative overflow-hidden rounded-2xl border border-emerald-500/30 bg-card p-5 sm:p-7 shadow-xs mb-6 text-right"
        dir="rtl"
      >
        {/* Top bar */}
        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-xs">
              <Sparkles className="size-6 text-emerald-100" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg sm:text-xl font-bold text-foreground tracking-tight">
                  أهلاً بك يا {userName}، مساحتك المالية جاهزة ومستقلة 100%
                </h2>
                <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-xs">
                  مساحة معزولة ومحمية
                </Badge>
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                تم تهيئة حساباتك الأولية وتصنيفات المصروفات تلقائياً. ابدأ الآن بتسجيل أول رصيد أو إيصال:
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDismiss}
              className="text-muted-foreground hover:text-foreground text-xs min-h-[36px] h-9 px-3 cursor-pointer"
            >
              <X className="size-4 ml-1" />
              إخفاء الإرشاد
            </Button>
          </div>
        </div>

        {/* Pre-initialized accounts pill preview */}
        <div className="relative mt-4 flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">الحسابات المهيأة لك:</span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-muted border border-border text-foreground font-medium">
            <Wallet className="size-3.5 text-emerald-600 dark:text-emerald-400" />
            محفظة الكاش والنقدية
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-muted border border-border text-foreground font-medium">
            <Building2 className="size-3.5 text-blue-600 dark:text-blue-400" />
            الحساب البنكي الرئيسي
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-muted border border-border text-foreground font-medium">
            <CreditCard className="size-3.5 text-purple-600 dark:text-purple-400" />
            محفظة إلكترونية (إنستاباي / كاش)
          </span>
        </div>

        {/* 3 Step Action Cards */}
        <div className="relative mt-5 grid grid-cols-1 md:grid-cols-3 gap-3.5">
          {/* Action 1: Smart OCR / Instapay Receipt */}
          <div className="group rounded-xl border border-border bg-muted/30 hover:bg-muted/60 p-4 transition-all hover:border-emerald-500/50 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="size-9 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
                  <ScanText className="size-5" />
                </div>
                <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-[10px] border-emerald-500/30">
                  ذكاء اصطناعي OCR
                </Badge>
              </div>
              <h3 className="font-bold text-foreground text-sm">
                مسح أو لصق إيصال إنستاباي
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                الصق نص رسالة التحويل أو ارفع لقطة شاشة لإيصال إنستاباي ليتم قراءتها واستخراج المبلغ والطرف الآخر آلياً.
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => setReceiptModalOpen(true)}
              className="mt-4 w-full min-h-[44px] h-11 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
            >
              <ScanText className="size-4" />
              <span>لصق أو رفع إيصال الآن</span>
            </Button>
          </div>

          {/* Action 2: Quick Expense Capture */}
          <div className="group rounded-xl border border-border bg-muted/30 hover:bg-muted/60 p-4 transition-all hover:border-blue-500/50 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="size-9 rounded-lg bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
                  <Zap className="size-5" />
                </div>
                <Badge className="bg-blue-500/15 text-blue-700 dark:text-blue-300 text-[10px] border-blue-500/30">
                  تسجيل في 3 ثوانٍ
                </Badge>
              </div>
              <h3 className="font-bold text-foreground text-sm">
                تسجيل أول مصروف سريع
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                سجل مشتريات السوبرماركت أو البنزين أو فنجان القهوة بضغطة زر وتصنيف فوري دون مغادرة الشاشة.
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => setQuickTransactionOpen(true)}
              className="mt-4 w-full min-h-[44px] h-11 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Zap className="size-4" />
              <span>تسجيل مصروف سريع</span>
            </Button>
          </div>

          {/* Action 3: Set Starting Balance / Accounts */}
          <div className="group rounded-xl border border-border bg-muted/30 hover:bg-muted/60 p-4 transition-all hover:border-purple-500/50 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="size-9 rounded-lg bg-purple-500/15 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold">
                  <Wallet className="size-5" />
                </div>
                <Badge className="bg-purple-500/15 text-purple-700 dark:text-purple-300 text-[10px] border-purple-500/30">
                  تسوية الأرصدة
                </Badge>
              </div>
              <h3 className="font-bold text-foreground text-sm">
                إدخال رصيدك الحالي في البنك أو الكاش
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                اضبط رصيدك الافتتاحي في حساباتك ليعكس صافي ثروتك الحقيقي بدقة مزدوجة فورية في دفتر الأستاذ.
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setLocation("/banking")}
              className="mt-4 w-full min-h-[44px] h-11 border-border bg-card hover:bg-muted text-foreground text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
            >
              <PlusCircle className="size-4" />
              <span>إدارة الأرصدة والحسابات</span>
              <ArrowLeft className="size-3.5 mr-auto" />
            </Button>
          </div>
        </div>

        {/* Security & Privacy assurance footer */}
        <div className="relative mt-4 flex items-center gap-2 text-[11px] text-muted-foreground pt-3 border-t border-border">
          <ShieldCheck className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>
            بياناتك المالية معزولة بالكامل ضمن نطاق مساحتك الخاصة ولا يمكن لأي مستخدم آخر في المنظومة الاطلاع عليها.
          </span>
        </div>
      </section>

      {/* Modals triggered directly from welcome screen */}
      <SmartReceiptPasteModal
        open={receiptModalOpen}
        onOpenChange={setReceiptModalOpen}
        onSuccess={() => {
          void utils.family.dashboard.invalidate();
          void utils.family.accounts.list.invalidate();
          void utils.family.ledger.recent.invalidate();
        }}
      />

      <QuickOfflineTransactionModal
        open={quickTransactionOpen}
        onOpenChange={setQuickTransactionOpen}
      />
    </>
  );
}
export default CleanWorkspaceOnboardingWelcome;
