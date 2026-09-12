import React, { useState, useEffect } from "react";
import { CheckCircle2, ChevronDown, ChevronUp, Circle, Landmark, ReceiptText, Sparkles, Target, TrendingUp, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useLocation } from "wouter";

export interface OnboardingChecklistProps {
  hasAccounts: boolean;
  hasTransactions: boolean;
  hasInvestments: boolean;
  hasGoals: boolean;
}

const STORAGE_KEY = "family_onboarding_collapsed";

export function OnboardingChecklist({
  hasAccounts,
  hasTransactions,
  hasInvestments,
  hasGoals,
}: OnboardingChecklistProps) {
  const [, setLocation] = useLocation();
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === "true";
    } catch {
      return false;
    }
  });

  const steps = [
    {
      id: "accounts",
      title: "تهيئة الحسابات النقدية والمصرفية",
      description: "سجل حسابًا بنكيًا أو محفظة نقدية مع رصيدها الافتتاحي المقيد متوازنًا.",
      isComplete: hasAccounts,
      actionPath: "/accounts",
      actionLabel: "إضافة حساب",
      icon: Landmark,
    },
    {
      id: "transactions",
      title: "تسجيل التدفق المالي أو استيراد كشف الحساب",
      description: "أدخل أول عملية تدفق نقدي أو ارفع كشف حساب بصيغة CSV للمراجعة والترحيل.",
      isComplete: hasTransactions,
      actionPath: "/cash-flow",
      actionLabel: "تسجيل حركة",
      icon: ReceiptText,
    },
    {
      id: "investments",
      title: "توثيق الحيازات الاستثمارية والأصول",
      description: "سجل صفقات الأسهم أو حيازات الذهب مع أسعار السوق الموثقة لحساب صافي الثروة.",
      isComplete: hasInvestments,
      actionPath: "/investments",
      actionLabel: "تسجيل صفقة",
      icon: TrendingUp,
    },
    {
      id: "goals",
      title: "تحديد الأهداف واستراتيجية التخصيص",
      description: "حدد مستهدف صندوق الطوارئ والتقاعد ومعايير توزيع الأصول لمراقبة الانحراف.",
      isComplete: hasGoals,
      actionPath: "/goals",
      actionLabel: "ضبط الأهداف",
      icon: Target,
    },
  ];

  const completedCount = steps.filter((step) => step.isComplete).length;
  const progressPercent = Math.round((completedCount / steps.length) * 100);

  const toggleCollapse = () => {
    const next = !collapsed;
    setCollapsed(next);
    try {
      localStorage.setItem(STORAGE_KEY, String(next));
    } catch {
      // safe fallback
    }
  };

  if (collapsed) {
    return (
      <div
        className="flex items-center justify-between rounded-xl border border-emerald-500/30 bg-gradient-to-l from-emerald-50/50 via-background to-background dark:from-emerald-950/20 px-4 py-2.5 shadow-xs transition-all"
        dir="rtl"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex size-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
            <Sparkles className="size-3.5" />
          </div>
          <div className="flex items-center gap-2.5 flex-wrap min-w-0">
            <strong className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
              خارطة الجاهزية المالية والمؤسسية
            </strong>
            <span className="text-slate-300 dark:text-slate-600 text-xs hidden sm:inline">•</span>
            <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
              {completedCount === 4
                ? "اكتملت جميع الخطوات التأسيسية (100%)"
                : `مكتمل ${completedCount} من ${steps.length} خطوات (${progressPercent}%)`}
            </span>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleCollapse}
          className="text-xs font-semibold gap-1.5 h-7 px-2.5 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 shrink-0"
        >
          <span>عرض الخارطة</span>
          <ChevronDown className="size-3.5" />
        </Button>
      </div>
    );
  }

  return (
    <Card className="border-emerald-500/30 bg-gradient-to-l from-emerald-50/50 via-background to-background dark:from-emerald-950/20 shadow-sm" dir="rtl">
      <CardHeader className="p-5 pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Sparkles className="size-4" />
            </div>
            <div>
              <CardTitle className="text-base font-bold text-slate-900 dark:text-slate-100">
                خارطة الجاهزية المالية والمؤسسية
              </CardTitle>
              <p className="text-xs text-slate-600 dark:text-slate-300 font-medium mt-0.5">
                {completedCount === 4
                  ? "اكتملت جميع الخطوات التأسيسية لمساحتك المالية بنجاح."
                  : `أنجزت ${completedCount} من ${steps.length} خطوات تأسيسية (${progressPercent}%).`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={completedCount === 4 ? "secondary" : "outline"} className="text-xs font-medium text-slate-700 dark:text-slate-200">
              مكتمل {completedCount} من {steps.length} خطوات
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleCollapse}
              className="text-xs font-semibold gap-1.5 h-8 px-2.5 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
              aria-label="طي الخارطة"
            >
              <span>طي الخارطة</span>
              <ChevronUp className="size-3.5" />
            </Button>
          </div>
        </div>
        <div className="mt-3">
          <Progress value={progressPercent} className="h-1.5" />
        </div>
      </CardHeader>

      {!collapsed && (
        <CardContent className="p-5 pt-2">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((step) => {
              const Icon = step.icon;
              return (
                <div
                  key={step.id}
                  className={`flex flex-col justify-between rounded-xl border p-3.5 transition ${
                    step.isComplete
                      ? "border-emerald-500/30 bg-emerald-50/30 dark:bg-emerald-950/10"
                      : "border-border bg-card hover:border-border/80"
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Icon className="size-4 text-slate-600 dark:text-slate-400" />
                        <strong className="text-xs font-bold text-slate-900 dark:text-slate-100">{step.title}</strong>
                      </div>
                      {step.isComplete ? (
                        <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      ) : (
                        <Circle className="size-4 text-slate-400/50 dark:text-slate-500 shrink-0" />
                      )}
                    </div>
                    <p className="mt-2 text-[11.5px] leading-relaxed text-slate-600 dark:text-slate-300 font-medium">
                      {step.description}
                    </p>
                  </div>
                  <div className="mt-3 pt-2 border-t border-border/40">
                    {step.isComplete ? (
                      <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="size-3" /> مكتمل
                      </span>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full text-xs h-7 font-semibold text-slate-800 hover:text-slate-900 dark:text-slate-200"
                        onClick={() => setLocation(step.actionPath)}
                      >
                        {step.actionLabel}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

export default OnboardingChecklist;
