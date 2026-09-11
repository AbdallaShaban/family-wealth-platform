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

  // If all 4 steps are complete and user collapsed it, hide cleanly
  if (completedCount === 4 && collapsed) {
    return null;
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
              <CardTitle className="text-base font-bold">
                خارطة الجاهزية المالية والمؤسسية
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                {completedCount === 4
                  ? "اكتملت جميع الخطوات التأسيسية لمساحتك المالية بنجاح."
                  : `أنجزت ${completedCount} من ${steps.length} خطوات تأسيسية (${progressPercent}%).`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={completedCount === 4 ? "secondary" : "outline"} className="text-xs">
              مكتمل {completedCount} من {steps.length} خطوات
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleCollapse}
              className="h-8 w-8 p-0"
              aria-label={collapsed ? "توسيع خارطة البدء" : "طي خارطة البدء"}
            >
              {collapsed ? <ChevronDown className="size-4" /> : <ChevronUp className="size-4" />}
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
                        <Icon className="size-4 text-muted-foreground" />
                        <strong className="text-xs font-semibold">{step.title}</strong>
                      </div>
                      {step.isComplete ? (
                        <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      ) : (
                        <Circle className="size-4 text-muted-foreground/40 shrink-0" />
                      )}
                    </div>
                    <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                      {step.description}
                    </p>
                  </div>
                  <div className="mt-3 pt-2 border-t border-border/40">
                    {step.isComplete ? (
                      <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="size-3" /> مكتمل
                      </span>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full text-xs h-7"
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
