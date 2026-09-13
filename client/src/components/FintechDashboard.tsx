import { useAuth } from "@/_core/hooks/useAuth";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, BadgeDollarSign, BarChart3, CircleDollarSign, Eye, Landmark, Plus, ShieldCheck, Sparkles, WalletCards } from "lucide-react";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { demoDashboard, getDashboardPreviewMode } from "@/lib/demoDashboard";
import { useDemoMode } from "@/contexts/DemoModeContext";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import SensitiveValue from "@/components/SensitiveValue";
import { formatMoney } from "@/lib/financialDisplay";

const FintechCharts = lazy(() => import("./FintechCharts"));
import OnboardingChecklist from "./OnboardingChecklist";
import { OnboardingWizard } from "./OnboardingWizard";

const eventLabels: Record<string, string> = {
  opening_balance: "رصيد افتتاحي",
  deposit: "إيداع",
  withdrawal: "سحب",
  transfer: "تحويل",
  buy: "شراء",
  sell: "بيع",
  dividend: "توزيع نقدي",
  income: "دخل",
  expense: "مصروف",
  fee: "رسوم",
  tax: "ضريبة",
  adjustment: "تسوية",
  reversal: "عكس عملية",
};

function AnimatedMoney({ value, currency }: { value: number | string; currency: string }) {
  const target = Number(value) || 0;
  const [display, setDisplay] = useState(0);
  const previousTarget = useRef(0);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (reduceMotion) {
      setDisplay(target);
      previousTarget.current = target;
      return;
    }
    let frame = 0;
    const startedAt = performance.now();
    const initial = previousTarget.current;
    const duration = 760;
    const tick = (now: number) => {
      const progress = Math.min((now - startedAt) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 4);
      setDisplay(initial + (target - initial) * eased);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    previousTarget.current = target;
    return () => cancelAnimationFrame(frame);
  }, [target, reduceMotion]);

  return (
    <span className="tabular-nums" dir="ltr">
      <SensitiveValue>{formatMoney(display, currency, 0)}</SensitiveValue>
    </span>
  );
}

function ExecutiveMetricCell({
  icon: Icon,
  label,
  value,
  currency,
  detail,
  accent = "emerald",
  className = "",
}: {
  icon: any;
  label: string;
  value: any;
  currency: string;
  detail: any;
  accent?: "emerald" | "sky" | "amber" | "rose";
  className?: string;
}) {
  const accentStyles = {
    emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 dark:border-emerald-500/30",
    sky: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20 dark:border-sky-500/30",
    amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 dark:border-amber-500/30",
    rose: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20 dark:border-rose-500/30",
  }[accent || "emerald"];

  return (
    <div className={`p-5 sm:p-6 flex flex-col justify-between hover:bg-slate-50/40 dark:hover:bg-muted/20 transition-colors ${className}`}>
      <div className="flex items-center justify-between">
        <span className="text-slate-600 dark:text-slate-400 font-semibold text-xs uppercase tracking-wider">
          {label}
        </span>
        <div className={`flex size-8 items-center justify-center rounded-lg border ${accentStyles}`}>
          <Icon className="size-4" />
        </div>
      </div>
      <div className="mt-3.5 mb-1.5">
        <strong className="text-slate-900 dark:text-white font-bold font-mono text-2xl sm:text-3xl tabular-nums block overflow-hidden text-ellipsis whitespace-nowrap">
          <AnimatedMoney value={value} currency={currency} />
        </strong>
      </div>
      <span className="text-slate-500 dark:text-slate-400 text-xs font-medium block leading-relaxed">
        {detail}
      </span>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <DashboardLayout>
      <div className="fintech-page space-y-6" dir="rtl">
        <Skeleton className="h-36 w-full rounded-[2rem]" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton className="h-44 rounded-[1.5rem]" key={index} />
          ))}
        </div>
        <Skeleton className="h-[26rem] w-full rounded-[1.5rem]" />
      </div>
    </DashboardLayout>
  );
}

export default function FintechDashboard() {
  const { user } = useAuth();
  const { isDemoMode, toggleDemoMode } = useDemoMode();
  const [_, setLocation] = useLocation();
  const [wizardOpen, setWizardOpen] = useState(false);
  const summary = trpc.family.dashboard.useQuery();
  const debts = trpc.family.debts.list.useQuery();
  const decisions = trpc.family.planning.decisionCenter.useQuery(undefined, { enabled: !isDemoMode });
  const marketOverview = trpc.family.marketOverview.useQuery(undefined, { enabled: !isDemoMode });
  const goals = trpc.family.goals.list.useQuery(undefined, { enabled: !isDemoMode });
  const reduceMotion = useReducedMotion();

  if (summary.isLoading && !isDemoMode) return <DashboardSkeleton />;
  if (summary.error && !isDemoMode) {
    return (
      <DashboardLayout>
        <div className="fintech-page py-12" dir="rtl">
          <Card className="border-rose-200 bg-rose-50/70">
            <CardContent className="p-8 text-rose-900">
              تعذر تحميل لوحة التحكم الآن. حاول تحديث الصفحة، أو فعّل وضع العرض التجريبي لمعاينة الواجهة دون أي تغيير في بياناتك.
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  const live = summary.data;
  const hasLiveData = Boolean((live?.accounts.length ?? 0) + (live?.portfolio.length ?? 0) + (live?.recentEvents.length ?? 0));
  const previewMode = getDashboardPreviewMode(isDemoMode, hasLiveData);
  const usingDemo = previewMode === "demo";
  const currency = usingDemo ? demoDashboard.baseCurrency : (live?.workspace.baseCurrency ?? "EGP");
  const accounts = usingDemo
    ? demoDashboard.accounts
    : (live?.accounts ?? []).map(account => ({
        id: String(account.id),
        name: account.name,
        value: Number(account.baseValue ?? account.balance ?? 0),
        currency: account.currency,
        kind: account.accountType,
      }));
  const allocation = usingDemo
    ? [...demoDashboard.allocation]
    : [
        ...(live?.accounts ?? [])
          .filter(account => account.baseValue !== null && Number(account.baseValue) > 0)
          .map((account, index) => ({
            name: account.name,
            value: Number(account.baseValue),
            color: ["#10B981", "#38BDF8", "#F59E0B"][index % 3],
          })),
        ...(live?.portfolio ?? [])
          .filter(position => position.baseMarketValue !== null && Number(position.baseMarketValue) > 0)
          .map((position, index) => ({
            name: position.instrumentName,
            value: Number(position.baseMarketValue),
            color: ["#F43F5E", "#34D399"][index % 2],
          })),
      ];
  const cashFlow = usingDemo ? [...demoDashboard.cashFlow] : [];
  const events = usingDemo
    ? demoDashboard.events.map(event => {
        const isExpense = event.tone === "expense";
        const isTransfer = event.type.includes("تحويل");
        return {
          id: event.id,
          title: event.type,
          badge: isExpense ? "سحب / مصروف" : isTransfer ? "تحويل" : event.tone === "growth" ? "تقييم أصل" : "إيداع سيولة",
          amount: event.amount,
          currency: event.currency,
          date: event.date,
          tone: event.tone,
          isOutflow: isExpense,
          isTransfer,
        };
      })
    : (live?.recentEvents ?? []).map(event => {
        const isTransfer = event.eventType === "transfer";
        const isOutflow = !isTransfer && ["expense", "withdrawal", "fee", "tax", "debt_payment", "buy"].includes(event.eventType);
        const label = eventLabels[event.eventType] ?? event.eventType;
        const defaultTitle =
          event.eventType === "deposit"
            ? "إيداع سيولة نقدية"
            : event.eventType === "opening_balance"
            ? "رصيد افتتاحي للحساب"
            : event.eventType === "withdrawal"
            ? "سحب سيولة نقدية"
            : event.eventType === "expense"
            ? "مصروف مصنف"
            : event.eventType === "transfer"
            ? "تحويل داخلي"
            : label;
        return {
          id: String(event.id),
          title: event.memo ? event.memo : defaultTitle,
          badge: label,
          amount: event.grossAmount,
          currency: event.currency,
          date: new Intl.DateTimeFormat("ar-EG", { dateStyle: "medium", timeStyle: "short" }).format(
            new Date(event.occurredAt)
          ),
          tone: isTransfer ? ("transfer" as const) : isOutflow ? ("expense" as const) : ("income" as const),
          isOutflow,
          isTransfer,
        };
      });
  const debtItems = usingDemo
    ? demoDashboard.debts
    : (debts.data ?? []).filter(debt => debt.status === "active").map(debt => ({
        id: String(debt.id),
        name: debt.name,
        outstanding: debt.outstanding,
        currency: debt.currency,
        payment: debt.minimumPayment,
        rate: debt.annualInterestRate,
      }));
  const netWorth = usingDemo ? demoDashboard.netWorth : (live?.netWorthBase ?? "0");
  const liquidBalance = usingDemo ? demoDashboard.liquidBalance : (live?.liquidBalanceBase ?? "0");
  const liabilities = usingDemo ? demoDashboard.liabilities : (live?.liabilityBalanceBase ?? "0");
  const investments = usingDemo ? demoDashboard.investments : (live?.investmentValueBase ?? "0");
  const pnl = usingDemo ? demoDashboard.unrealizedPnl : (live?.unrealizedPnlBase ?? "0");
  const hasAccounts = usingDemo ? true : Boolean(live?.accounts && live.accounts.length > 0);
  const hasTransactions = usingDemo ? true : Boolean(live?.recentEvents && live.recentEvents.length > 0);
  const hasInvestments = usingDemo ? true : Boolean((live?.portfolio && live.portfolio.length > 0) || Number(live?.investmentValueBase ?? 0) > 0);
  const hasGoals = usingDemo ? true : Boolean(goals.data && goals.data.length > 0);

  return (
    <DashboardLayout>
      <div className="fintech-page pb-10 space-y-6" dir="rtl">
        <motion.section
          className="fintech-hero !min-h-0 !p-4 sm:!p-5 lg:!py-5 lg:!px-8 !gap-4 flex flex-col md:flex-row md:items-center md:justify-between !shadow-lg rounded-2xl md:rounded-[1.75rem]"
          initial={reduceMotion ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.42, ease: [0.23, 1, 0.32, 1] }}
        >
          <div className="fintech-hero-orb fintech-hero-orb-one" />
          <div className="fintech-hero-orb fintech-hero-orb-two" />
          <div className="relative z-10 flex flex-col justify-center">
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-300">
              <span className="fintech-status-dot" />
              <span>النظرة المالية العامة</span>
              <span className="opacity-40">•</span>
              <span className="text-slate-200">{usingDemo ? "وضع العرض التجريبي" : "بياناتك المسجلة"}</span>
            </div>
            <h1 className="!m-0 !mt-1.5 !text-lg sm:!text-xl lg:!text-2xl !font-bold !leading-snug text-white">
              {user?.name?.trim() ? `مرحباً ${user.name.trim().split(/\s+/)[0]}، ` : "مرحباً بك، "}
              <span className="text-emerald-400">هذا هو وضعك المالي اليوم.</span>
            </h1>
            <p className="!m-0 !mt-1 !text-xs md:!text-[12.5px] !leading-relaxed text-slate-300/90 max-w-xl">
              ملخص تشغيلي متوازن للأرصدة النقدية والاستثمارات والأصول والالتزامات المالية في مساحتك.
            </p>
          </div>
          <div className="relative z-10 flex flex-wrap items-center gap-2.5 sm:self-center shrink-0">
            <div className="fintech-decision-stamp !static !m-0 !p-1.5 !px-3 !min-w-0 flex items-center gap-2 rounded-xl bg-slate-900/60 border border-emerald-500/25">
              <ShieldCheck className="size-4 text-emerald-400 shrink-0" />
              <div className="leading-tight text-right">
                <span className="text-[10px] text-slate-300 block">حالة البيانات</span>
                <strong className="text-xs text-white">{usingDemo ? "عرض توضيحي آمن" : "قيودك المالية"}</strong>
              </div>
            </div>
            <Button
              onClick={() => setLocation("/accounts")}
              size="sm"
              className="fintech-primary-action h-9 text-xs font-semibold px-3.5 gap-1.5"
            >
              <Plus className="size-3.5" />
              إضافة حساب
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={toggleDemoMode}
              className="fintech-ghost-action h-9 text-xs font-semibold px-3.5 gap-1.5"
            >
              <Eye className="size-3.5" />
              {usingDemo ? "العودة لبياناتي" : "معاينة ببيانات تجريبية"}
            </Button>
          </div>
        </motion.section>

        <OnboardingChecklist
          hasAccounts={hasAccounts}
          hasTransactions={hasTransactions}
          hasInvestments={hasInvestments}
          hasGoals={hasGoals}
        />

        {!usingDemo && decisions.data?.length ? (
          <section className="fintech-decision-center" aria-label="مركز القرارات">
            <div className="fintech-panel-heading">
              <div>
                <p className="fintech-overline">مركز القرار</p>
                <h2>أهم ثلاث إشارات فقط</h2>
              </div>
              <Button variant="ghost" onClick={() => setLocation("/approvals")} className="fintech-text-button">
                إدارة القرارات
              </Button>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              {decisions.data.slice(0, 3).map(item => (
                <button onClick={() => setLocation(item.actionPath)} className="fintech-decision-item" key={item.id}>
                  <span>{item.priority}</span>
                  <div>
                    <strong>{item.title}</strong>
                    <p className="text-slate-600 dark:text-slate-300 font-medium text-xs mt-1">{item.detail}</p>
                  </div>
                  {item.amount && (
                    <b>
                      <SensitiveValue>{formatMoney(item.amount, item.currency || currency, 0)}</SensitiveValue>
                    </b>
                  )}
                </button>
              ))}
            </div>
          </section>
        ) : null}

        <motion.section
          className="bg-white dark:bg-card rounded-2xl border border-slate-200/70 dark:border-border shadow-[0_1px_3px_rgba(0,0,0,0.04)] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 overflow-hidden mb-6"
          initial={reduceMotion ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.42, delay: 0.05 }}
        >
          <ExecutiveMetricCell
            icon={CircleDollarSign}
            label="صافي الثروة"
            value={netWorth}
            currency={currency}
            detail={usingDemo ? "لقطة توضيحية قابلة للاستبدال" : "مُقوّم بعملة الأساس"}
            accent="emerald"
            className="border-b sm:border-b-0 lg:border-b-0 lg:border-l border-slate-200/80 dark:border-slate-800/80"
          />
          <ExecutiveMetricCell
            icon={WalletCards}
            label="السيولة المتاحة"
            value={liquidBalance}
            currency={currency}
            detail="الحسابات النقدية والمصرفية"
            accent="sky"
            className="border-b sm:border-b-0 lg:border-b-0 lg:border-l border-slate-200/80 dark:border-slate-800/80"
          />
          <ExecutiveMetricCell
            icon={BarChart3}
            label="قيمة الاستثمارات"
            value={investments}
            currency={currency}
            detail={
              <>
                <span>ربح غير محقق </span>
                <SensitiveValue>{formatMoney(pnl, currency, 0)}</SensitiveValue>
              </>
            }
            accent="amber"
            className="border-b sm:border-b-0 lg:border-b-0 lg:border-l border-slate-200/80 dark:border-slate-800/80"
          />
          <ExecutiveMetricCell
            icon={BadgeDollarSign}
            label="الالتزامات"
            value={liabilities}
            currency={currency}
            detail="قروض وبطاقات نشطة"
            accent="rose"
            className="border-b-0 lg:border-l-0"
          />
        </motion.section>

        {!usingDemo && marketOverview.data?.entries.length ? (
          <section className="fintech-panel" aria-label="مراقبة السوق">
            <div className="fintech-panel-heading">
              <div>
                <p className="fintech-overline">مراقبة السوق</p>
                <h2>أسعار الأصول وعناصر المتابعة</h2>
                <p className="mt-1 text-sm font-normal text-slate-600 dark:text-slate-300">
                  الأسعار مسجلة من المصدر مع وقتها وحالتها؛ وهي للمتابعة والمراجعة فقط.
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => setLocation("/investments")} className="fintech-text-button">
                  الأصول والأسعار
                </Button>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {marketOverview.data.entries.slice(0, 9).map(item => (
                <button
                  key={item.instrumentId}
                  onClick={() => setLocation("/investments")}
                  className="rounded-2xl border bg-muted/20 p-4 text-right transition hover:border-emerald-400 hover:bg-emerald-50/40 dark:hover:bg-emerald-950/20"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <strong>{item.symbol || item.name}</strong>
                      <p className="mt-1 text-xs text-slate-600 dark:text-slate-300 font-medium">
                        {item.symbol ? item.name : item.assetType}
                      </p>
                    </div>
                    <span className="rounded-full bg-background px-2 py-1 text-[11px] text-slate-700 dark:text-slate-200 font-medium border border-border/60">
                      {item.ownership === "owned_and_watching"
                        ? "مملوك ومراقَب"
                        : item.ownership === "owned"
                        ? "مملوك"
                        : "مراقَب"}
                    </span>
                  </div>
                  <div className="mt-4 flex items-end justify-between gap-3">
                    <b className="text-lg tabular-nums" dir="ltr">
                      {item.price === null ? "—" : formatMoney(item.price, item.currency, 2)}
                    </b>
                    <span
                      className={
                        item.quoteStatus === "unavailable" || item.quoteStatus === "stale"
                          ? "text-xs text-amber-700 dark:text-amber-400 font-semibold"
                          : "text-xs text-emerald-700 dark:text-emerald-400 font-semibold"
                      }
                    >
                      {item.quoteStatus === "stale"
                        ? "متأخر"
                        : item.quoteStatus === "unavailable"
                        ? "غير متاح"
                        : item.quoteStatus}
                    </span>
                  </div>
                  <p className="mt-3 text-xs text-slate-600 dark:text-slate-400 font-medium">
                    {item.source || "لا يوجد مصدر مسجل"}
                    {item.asOf
                      ? ` · ${new Intl.DateTimeFormat("ar-EG", {
                          dateStyle: "short",
                          timeStyle: "short",
                        }).format(new Date(item.asOf))}`
                      : ""}
                  </p>
                </button>
              ))}
            </div>
          </section>
        ) : null}

        {previewMode === "empty" ? (
          <section className="fintech-empty-stage">
            <div className="fintech-empty-icon">
              <Sparkles className="size-7" />
            </div>
            <div>
              <p className="fintech-overline">ابدأ من نقطة واضحة</p>
              <h2>لوحتك جاهزة لبناء الصورة المالية.</h2>
              <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-sm">
                أضف حسابك الأول لإنشاء الرصيد الافتتاحي بقيد متوازن عبر معالج الإعداد المالي، أو فعّل العرض التجريبي لمعاينة الرسوم والبطاقات دون إضافة أي بيانات إلى نطاقك.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button onClick={() => setWizardOpen(true)} className="fintech-primary-action">
                  <Sparkles className="size-4" />بدء مساعد الإعداد المالي
                </Button>
                <Button variant="outline" onClick={toggleDemoMode} className="fintech-outline-action">
                  تشغيل العرض التجريبي
                </Button>
              </div>
            </div>
          </section>
        ) : (
          <>
            <Suspense
              fallback={
                <section className="fintech-content-grid">
                  <Skeleton className="h-[360px] rounded-[1.5rem]" />
                  <Skeleton className="h-[360px] rounded-[1.5rem]" />
                </section>
              }
            >
              <FintechCharts
                allocation={allocation}
                cashFlow={cashFlow}
                currency={currency}
                usingDemo={usingDemo}
                onShowLedger={() => setLocation("/cash-flow")}
              />
            </Suspense>
            <section className="fintech-content-grid fintech-lower-grid">
              <motion.article
                className="bg-white dark:bg-card border border-slate-200/60 dark:border-border shadow-xs rounded-2xl p-4 sm:p-5 flex flex-col justify-between h-full"
                initial={reduceMotion ? false : { opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.42, delay: 0.26 }}
              >
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-border/60 mb-2">
                  <div>
                    <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                      آخر ما تحرك في المساحة
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                      أحدث العمليات النقدية والتحويلات المسجلة
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setLocation("/transactions")}
                    className="text-xs font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 h-8 gap-1"
                  >
                    <span>عرض كافة المعاملات</span>
                    <span aria-hidden="true">←</span>
                  </Button>
                </div>
                {events.length ? (
                  <div className="flex-1 flex flex-col justify-between">
                    <div>
                      {events.slice(0, 5).map((event) => {
                        const isTransfer = event.isTransfer;
                        const isOutflow = event.isOutflow;
                        return (
                          <div
                            key={event.id}
                            className="group border-b border-slate-100 dark:border-border/60 py-2.5 px-3 flex items-center justify-between hover:bg-slate-50/80 dark:hover:bg-muted/40 transition-colors rounded-lg last:border-b-0"
                          >
                            {/* Right Side (Transaction Details in RTL) */}
                            <div className="flex items-center gap-3 min-w-0">
                              {isTransfer ? (
                                <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 text-slate-900 dark:text-slate-100 flex items-center justify-center shrink-0">
                                  <ArrowLeftRight className="size-4" />
                                </div>
                              ) : isOutflow ? (
                                <div className="w-8 h-8 rounded-full bg-rose-50 dark:bg-rose-950/40 border border-rose-200/80 dark:border-rose-800/60 text-rose-950 dark:text-rose-300 flex items-center justify-center shrink-0">
                                  <ArrowUpRight className="size-4" />
                                </div>
                              ) : (
                                <div className="w-8 h-8 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800/60 text-emerald-950 dark:text-emerald-300 flex items-center justify-center shrink-0">
                                  <ArrowDownLeft className="size-4" />
                                </div>
                              )}
                              <div className="min-w-0">
                                <strong className="text-slate-900 dark:text-slate-100 font-semibold text-sm truncate block">
                                  {event.title}
                                </strong>
                                <span className="text-slate-500 dark:text-slate-400 text-xs mt-0.5 block font-normal">
                                  {event.date}
                                </span>
                              </div>
                            </div>

                            {/* Subtle track line connecting details and amount on desktop for comfortable visual tracking */}
                            <div className="hidden sm:block flex-1 mx-4 border-b border-dashed border-slate-200/60 dark:border-border/40 group-hover:border-slate-300/80 transition-colors" />

                            {/* Left Side (Amount in RTL) */}
                            <div className="shrink-0 text-left" dir="ltr">
                              <span
                                className={
                                  isTransfer
                                    ? "text-slate-900 dark:text-slate-100 font-bold font-mono text-base tabular-nums"
                                    : isOutflow
                                    ? "text-rose-950 dark:text-rose-300 font-bold font-mono text-base tabular-nums"
                                    : "text-emerald-950 dark:text-emerald-300 font-bold font-mono text-base tabular-nums"
                                }
                              >
                                {isTransfer ? "↔ " : isOutflow ? "- " : "+ "}
                                <SensitiveValue>
                                  {formatMoney(Math.abs(Number(event.amount)), event.currency, 0)}
                                </SensitiveValue>
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="flex h-full min-h-[170px] flex-col items-center justify-center rounded-2xl border border-dashed border-border/70 bg-muted/20 p-6 text-center my-2">
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      لا توجد حركات مسجلة حديثاً
                    </p>
                    <p className="mt-1 max-w-xs text-[11px] leading-relaxed text-slate-600 dark:text-slate-400 font-medium">
                      ستظهر هنا أحدث عمليات الإيداع والصرف المسجلة في حساباتك.
                    </p>
                  </div>
                )}
              </motion.article>
              <motion.article
                className="bg-white dark:bg-card border border-slate-200/60 dark:border-border shadow-xs rounded-2xl p-4 sm:p-5 flex flex-col justify-between h-full"
                initial={reduceMotion ? false : { opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.42, delay: 0.31 }}
              >
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-border/60 mb-2">
                  <div>
                    <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                      نظرة على السداد
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                      موقف الالتزامات والأقساط وخدمة الدين
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setLocation("/debts")}
                    className="text-xs font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 h-8"
                  >
                    إدارة الديون
                  </Button>
                </div>
                {debtItems.length ? (
                  <div className="flex-1 flex flex-col justify-between">
                    <div>
                      {debtItems.slice(0, 5).map((debt) => (
                        <div
                          className="border-b border-slate-100 dark:border-border/60 py-2.5 px-3 flex items-center justify-between hover:bg-slate-50/60 dark:hover:bg-muted/30 transition-colors rounded-lg last:border-b-0"
                          key={debt.id}
                        >
                          <div>
                            <strong className="text-xs font-bold text-slate-900 dark:text-slate-100 block">
                              {debt.name}
                            </strong>
                            <small className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block mt-0.5">
                              دفعة دنيا <SensitiveValue>{formatMoney(debt.payment, debt.currency, 0)}</SensitiveValue> شهرياً
                            </small>
                          </div>
                          <div className="text-left" dir="ltr">
                            <b className="font-mono font-bold text-slate-900 dark:text-slate-100 text-sm">
                              <SensitiveValue>{formatMoney(debt.outstanding, debt.currency, 0)}</SensitiveValue>
                            </b>
                            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block mt-0.5" dir="rtl">
                              {debt.rate}% سنوياً
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col justify-between flex-1 py-1 space-y-3">
                    {/* Sleek Status Badge */}
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/70 dark:border-emerald-800/50">
                      <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shrink-0">
                        <ShieldCheck className="size-4" />
                      </div>
                      <div className="min-w-0">
                        <strong className="text-slate-800 dark:text-slate-100 font-semibold text-sm block truncate">
                          سجل التزامات آمن وخالٍ من الديون
                        </strong>
                        <span className="text-slate-500 dark:text-slate-400 text-xs block mt-0.5">
                          لا توجد قروض، بطاقات أو التزامات تمويلية مستحقة السداد.
                        </span>
                      </div>
                    </div>

                    {/* Subtle 3-Pillar Compact Metric Grid */}
                    <div className="grid grid-cols-3 gap-2.5 text-center">
                      <div className="p-3 rounded-xl bg-white dark:bg-card border border-slate-200/80 dark:border-border shadow-xs">
                        <span className="text-slate-700 dark:text-slate-300 font-semibold text-xs block">
                          إجمالي الالتزامات
                        </span>
                        <strong className="text-slate-900 dark:text-white font-bold font-mono text-base mt-1 block">
                          0 {currency}
                        </strong>
                      </div>
                      <div className="p-3 rounded-xl bg-white dark:bg-card border border-slate-200/80 dark:border-border shadow-xs">
                        <span className="text-slate-700 dark:text-slate-300 font-semibold text-xs block">
                          عبء خدمة الدين
                        </span>
                        <strong className="text-slate-900 dark:text-white font-bold font-mono text-base mt-1 block">
                          0.0%
                        </strong>
                      </div>
                      <div className="p-3 rounded-xl bg-white dark:bg-card border border-slate-200/80 dark:border-border shadow-xs">
                        <span className="text-slate-700 dark:text-slate-300 font-semibold text-xs block">
                          التصنيف الائتماني
                        </span>
                        <strong className="text-slate-900 dark:text-white font-bold font-mono text-base mt-1 block truncate">
                          ممتاز AAA
                        </strong>
                      </div>
                    </div>

                    {/* Operational Solvency Bottom Indicator */}
                    <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50/50 dark:bg-muted/30 border border-slate-100 dark:border-border/60 text-xs text-slate-700 dark:text-slate-300">
                      <span className="font-semibold">الملاءة المالية التشغيلية:</span>
                      <span className="font-bold text-emerald-800 dark:text-emerald-400 flex items-center gap-1.5">
                        <span className="inline-block size-2 rounded-full bg-emerald-500" />
                        تغطية سيولة تامة 100%
                      </span>
                    </div>
                  </div>
                )}
              </motion.article>
            </section>
            <motion.section
              className="mt-6"
              initial={reduceMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.35, delay: 0.36 }}
            >
              <div className="flex items-center justify-between mb-3.5">
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    ملخص مواقفك المالية
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                    توزيع الأرصدة والسيولة عبر الحسابات المسجلة
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setLocation("/accounts")}
                  className="text-xs font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 h-8 gap-1"
                >
                  <span>عرض الحسابات</span>
                  <span aria-hidden="true">←</span>
                </Button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 w-full">
                {accounts.map((account) => (
                  <button
                    onClick={() => setLocation("/accounts")}
                    key={account.id}
                    className="bg-white dark:bg-card border border-slate-200/70 dark:border-border/80 rounded-2xl p-4 shadow-xs hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-sm transition-all text-right group flex flex-col justify-between min-h-[120px] w-full"
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 dark:bg-muted text-slate-700 dark:text-slate-300">
                        {account.kind}
                      </span>
                      <ArrowUpRight className="size-3.5 text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200 transition-colors shrink-0" />
                    </div>

                    <strong
                      className="text-slate-900 dark:text-slate-100 font-semibold text-sm leading-snug line-clamp-2 block mt-2.5 w-full break-words"
                      title={account.name}
                    >
                      {account.name}
                    </strong>

                    <div className="text-left w-full mt-3" dir="ltr">
                      <span className="font-mono font-bold text-slate-900 dark:text-white text-sm sm:text-base tabular-nums">
                        <SensitiveValue>{formatMoney(account.value, account.currency, 0)}</SensitiveValue>
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </motion.section>
          </>
        )}
        <OnboardingWizard
          open={wizardOpen}
          onOpenChange={setWizardOpen}
          workspaceName={live?.workspace.name || "مساحة FAMILY"}
          baseCurrency={live?.workspace.baseCurrency || "EGP"}
        />
      </div>
    </DashboardLayout>
  );
}

