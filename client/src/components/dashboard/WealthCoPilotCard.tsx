import React, { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { formatMoney } from "@/lib/financialDisplay";
import SensitiveValue from "@/components/SensitiveValue";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles,
  ShieldCheck,
  CreditCard,
  Coins,
  ArrowRight,
  HelpCircle,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface WealthCoPilotCardProps {
  baseCurrency?: string;
  isDemo?: boolean;
}

export default function WealthCoPilotCard({
  baseCurrency = "EGP",
  isDemo = false,
}: WealthCoPilotCardProps) {
  const [_, setLocation] = useLocation();
  const [infoModalOpen, setInfoModalOpen] = useState(false);
  const reduceMotion = useReducedMotion();

  // Fetch financial data for recommendation logic
  const date = new Date();
  const currentPeriodKey = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;

  const { data: cashFlow } = trpc.family.cashFlow.summary.useQuery(
    { periodKey: currentPeriodKey },
    { enabled: !isDemo }
  );
  const { data: emergencyFund } = trpc.family.emergencyFund.summary.useQuery(
    undefined,
    { enabled: !isDemo }
  );
  const { data: debts } = trpc.family.debts.list.useQuery(
    undefined,
    { enabled: !isDemo }
  );
  const { data: dashboardSummary } = trpc.family.dashboard.useQuery(
    undefined,
    { enabled: !isDemo }
  );

  // Derive dynamic metrics with safe fallback for demo mode
  const monthlyIncome = isDemo ? 45000 : Number(cashFlow?.incomeActualBase ?? 0);
  const monthlyExpenses = isDemo ? 28000 : Number(cashFlow?.expenseActualBase ?? 0);
  
  // Calculate active monthly debt commitments
  const activeDebts = isDemo
    ? [{ id: 1, name: "قرض سيارة", monthlyPayment: 4000, interestRate: 18, outstandingBalance: 65000 }]
    : (debts ?? [])
        .filter((d) => d.status === "active")
        .map((d) => ({
          id: d.id,
          name: d.name,
          monthlyPayment: Number(d.baseMinimumPayment || d.minimumPayment || 0),
          interestRate: Number(d.annualInterestRate || 0),
          outstandingBalance: Number(d.baseOutstanding || d.outstanding || 0),
        }));

  const totalMonthlyDebtPayments = activeDebts.reduce((sum, d) => sum + d.monthlyPayment, 0);
  
  // Net Monthly Surplus = Income - Expenses - Debt payments
  const rawSurplus = monthlyIncome - monthlyExpenses - totalMonthlyDebtPayments;
  const surplusCash = Math.max(0, rawSurplus);

  // Emergency Fund months coverage
  const monthlyBurn = monthlyExpenses > 0 ? monthlyExpenses : 20000;
  const liquidReserve = isDemo
    ? 65000
    : Number(dashboardSummary?.liquidBalanceBase ?? emergencyFund?.liquidReserveBase ?? 0);
  const emergencyCoverageMonths = monthlyBurn > 0 ? liquidReserve / monthlyBurn : 0;

  // Priority debt for payoff: interest-bearing first, then personal debts
  const hasActiveDebt = activeDebts.length > 0;
  const highestPriorityDebt = [...activeDebts].sort((a, b) => b.interestRate - a.interestRate)[0];

  // Formulate Rule-Based Multi-Tier Action Plan:
  // Tier 1: Emergency Fund (< 3 months)
  const needsEmergencyBuffer = emergencyCoverageMonths < 3;
  const emergencyAllocation = needsEmergencyBuffer ? Math.round(surplusCash * 0.45) : 0;

  // Tier 2: Active Debt payoff (incorporates both bank loans and 0% personal obligations)
  const debtAllocation = hasActiveDebt
    ? needsEmergencyBuffer
      ? Math.round(surplusCash * 0.35)
      : Math.round(surplusCash * 0.55)
    : 0;

  // Tier 3: Inflation Hedge & Wealth Accumulation (Gold + Dividend Stocks)
  const investmentAllocation = Math.max(0, surplusCash - emergencyAllocation - debtAllocation);

  return (
    <>
      <motion.section
        className="relative overflow-hidden rounded-3xl border border-emerald-500/20 bg-gradient-to-br from-emerald-950/40 via-slate-900 to-slate-900/95 dark:from-emerald-950/60 dark:via-[#0D1527] dark:to-[#070A11] p-6 sm:p-7 shadow-lg shadow-emerald-950/10 text-slate-100"
        dir="rtl"
        initial={reduceMotion ? false : { opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.38, ease: "easeOut" }}
        aria-label="المستشار المالي الذكي"
      >
        {/* Ambient background decoration */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-teal-500/5 rounded-full blur-3xl pointer-events-none -ml-20 -mb-20" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          {/* Header & Main Surplus Indicator */}
          <div className="space-y-2 max-w-xl">
            <div className="flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400">
                <Sparkles className="size-4 animate-pulse" />
              </span>
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                المستشار المالي الذكي (Auto Wealth Co-Pilot)
              </span>
              <Badge
                variant="outline"
                className="bg-emerald-500/10 text-emerald-300 border-emerald-500/30 text-[10px] px-2 py-0.5 rounded-md"
              >
                تحديث هذا الشهر
              </Badge>
            </div>

            <h2 className="text-lg sm:text-xl md:text-2xl font-black text-white leading-tight">
              {surplusCash > 0 ? (
                <>
                  لديك فائض مالي يقدر بـ{" "}
                  <span className="text-emerald-400 inline-flex items-baseline">
                    <SensitiveValue>{formatMoney(surplusCash, baseCurrency)}</SensitiveValue>
                  </span>{" "}
                  يمكن استثماره بذكاء.
                </>
              ) : (
                <>
                  ميزانيتك متقاربة هذا الشهر، إليك أفضل مسار لتعزيز السيولة والأمان.
                </>
              )}
            </h2>

            <p className="text-xs sm:text-sm text-slate-300/90 leading-relaxed">
              يقوم المحرك الرياضي بتحليل إيراداتك ومصروفاتك والتزاماتك تلقائياً لتقديم خطة
              توزيع ثلاثية تمنع تآكل أموالك بالتضخم وتسرع سداد الديون.
            </p>
          </div>

          {/* Action Button & Info Trigger */}
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <Button
              onClick={() => setInfoModalOpen(true)}
              variant="outline"
              size="sm"
              className="bg-white/10 hover:bg-white/15 text-slate-200 border-white/15 backdrop-blur-sm rounded-xl text-xs py-2 px-3 h-auto cursor-pointer"
            >
              <HelpCircle className="size-3.5 ml-1.5 text-slate-300" />
              كيف حسبنا ذلك؟
            </Button>
            <Button
              onClick={() => {
                if (needsEmergencyBuffer) setLocation("/emergency-fund");
                else if (hasActiveDebt) setLocation("/debts");
                else setLocation("/trading/swing");
              }}
              size="sm"
              className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs py-2.5 px-4 rounded-xl shadow-md transition-all cursor-pointer h-auto flex items-center gap-2"
            >
              <span>تنفيذ الخطة المقترحة</span>
              <ArrowRight className="size-3.5 rotate-180" />
            </Button>
          </div>
        </div>

        {/* Actionable 3-Pillar Breakdown Cards */}
        <div className="relative z-10 mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          {/* Pillar 1: Emergency Buffer */}
          <div className="rounded-2xl border border-white/10 bg-white/5 dark:bg-slate-900/60 p-4 backdrop-blur-sm flex flex-col justify-between hover:border-emerald-500/40 transition-colors">
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <ShieldCheck className="size-4 text-emerald-400" />
                1. درع الطوارئ (الأمان)
              </span>
              <Badge
                className={
                  emergencyCoverageMonths >= 3
                    ? "bg-emerald-500/20 text-emerald-300 border-0 text-[10px]"
                    : "bg-amber-500/20 text-amber-300 border-0 text-[10px]"
                }
              >
                {emergencyCoverageMonths >= 3 ? "مكتمل (آمن)" : "يحتاج تعزيز"}
              </Badge>
            </div>
            <div>
              <strong className="text-base font-bold text-white block mb-1">
                {needsEmergencyBuffer ? (
                  <SensitiveValue>{formatMoney(emergencyAllocation, baseCurrency)}</SensitiveValue>
                ) : (
                  "مستقر (3+ أشهر)"
                )}
              </strong>
              <p className="text-[11px] text-slate-300/80 leading-normal">
                {needsEmergencyBuffer
                  ? `غطاء الطوارئ الحالي ${emergencyCoverageMonths.toFixed(1)} شهر فقط. وجّه هذا المبلغ لحساب سيولة يومية.`
                  : "لديك احتياطي آمن يغطي نفقات أسرتك. لا تحتاج لضخ سيولة راكدة إضافية."}
              </p>
            </div>
          </div>

          {/* Pillar 2: Active Debt Payoff */}
          <div className="rounded-2xl border border-white/10 bg-white/5 dark:bg-slate-900/60 p-4 backdrop-blur-sm flex flex-col justify-between hover:border-amber-500/40 transition-colors">
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <CreditCard className="size-4 text-amber-400" />
                2. السداد المعجل للديون
              </span>
              <Badge
                className={
                  hasActiveDebt
                    ? highestPriorityDebt.interestRate > 0
                      ? "bg-amber-500/20 text-amber-300 border-0 text-[10px]"
                      : "bg-orange-500/20 text-orange-300 border-0 text-[10px]"
                    : "bg-slate-500/20 text-slate-300 border-0 text-[10px]"
                }
              >
                {hasActiveDebt
                  ? highestPriorityDebt.interestRate > 0
                    ? "يوفر فوائد"
                    : "التزام شخصي قائم"
                  : "خالٍ من الديون"}
              </Badge>
            </div>
            <div>
              <strong className="text-base font-bold text-white block mb-1">
                {hasActiveDebt ? (
                  <SensitiveValue>{formatMoney(debtAllocation, baseCurrency)}</SensitiveValue>
                ) : (
                  "صفر التزامات"
                )}
              </strong>
              <p className="text-[11px] text-slate-300/80 leading-normal">
                {hasActiveDebt && highestPriorityDebt
                  ? highestPriorityDebt.interestRate > 0
                    ? `سداد مبكر لقرض "${highestPriorityDebt.name}" بفائدة ${highestPriorityDebt.interestRate}% لتوفير الأعباء التمويلية.`
                    : `سداد تدريجي لالتزام "${highestPriorityDebt.name}" (الرصيد: ${formatMoney(highestPriorityDebt.outstandingBalance, baseCurrency)}) لتصفية الذمم المالية.`
                  : "لا توجد أي التزامات مالية أو ديون ترهق ميزانيتك. ممتاز!"}
              </p>
            </div>
          </div>

          {/* Pillar 3: Growth & Gold Inflation Hedge */}
          <div className="rounded-2xl border border-white/10 bg-white/5 dark:bg-slate-900/60 p-4 backdrop-blur-sm flex flex-col justify-between hover:border-sky-500/40 transition-colors">
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <Coins className="size-4 text-sky-400" />
                3. مضاعفة الثروة والتحوط
              </span>
              <Badge className="bg-sky-500/20 text-sky-300 border-0 text-[10px]">
                ذهب + أسهم نمو
              </Badge>
            </div>
            <div>
              <strong className="text-base font-bold text-white block mb-1">
                <SensitiveValue>
                  {formatMoney(
                    surplusCash > 0 ? investmentAllocation : 0,
                    baseCurrency
                  )}
                </SensitiveValue>
              </strong>
              <p className="text-[11px] text-slate-300/80 leading-normal">
                {investmentAllocation > 0
                  ? "وجّه الفائض إلى صندوق الذهب (AZG) أو سهم قيادي ذي توزيعات لنمو رأس المال وحمايته من التضخم."
                  : "حافظ على توازن المصروفات الشهرية وراقب فرص التجميع القادمة."}
              </p>
            </div>
          </div>
        </div>
      </motion.section>

      {/* Methodology Explanation Dialog */}
      <Dialog open={infoModalOpen} onOpenChange={setInfoModalOpen}>
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Sparkles className="size-5 text-emerald-500" />
              كيف يحسب المستشار المالي الذكي خطتك؟
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 dark:text-slate-400">
              منهجية مؤسسية تجمع بين أمان الأسرة ومضاعفة رأس المال التراكمي
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2 text-xs leading-relaxed text-slate-700 dark:text-slate-300">
            <div className="flex gap-2.5 items-start">
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-bold text-[10px]">
                1
              </span>
              <p>
                <strong>حساب الفائض الحقيقي:</strong> نقوم بخصم كافة المصروفات الفعلية وأقساط
                الديون المستحقة من إجمالي دخلك الشهري بدقة.
              </p>
            </div>
            <div className="flex gap-2.5 items-start">
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-bold text-[10px]">
                2
              </span>
              <p>
                <strong>الأمان أولاً (درع 3 أشهر):</strong> إذا كان احتياطي الطوارئ أقل من
                مصاريف 3 أشهر، تُمنح الأولوية لبناء هذا الدرع لحماية أسرتك من أي مفاجأة.
              </p>
            </div>
            <div className="flex gap-2.5 items-start">
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-bold text-[10px]">
                3
              </span>
              <p>
                <strong>طريقة الانهيار الجليدي للديون (Avalanche):</strong> يتم توجيه السيولة
                للدين ذي الفائدة الأعلى أولاً لتوفير أكبر قدر ممكن من أعباء التمويل.
              </p>
            </div>
            <div className="flex gap-2.5 items-start">
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-bold text-[10px]">
                4
              </span>
              <p>
                <strong>التحوط بالذهب والأسهم الرابحة:</strong> يوجه باقي الفائض نحو الذهب
                والأصول ذات العائد لحماية القوة الشرائية وتنمية الثروة على المدى الطويل.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => setInfoModalOpen(false)}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl"
            >
              فهمت ذلك، استمرار
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
