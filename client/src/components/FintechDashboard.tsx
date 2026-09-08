import { useAuth } from "@/_core/hooks/useAuth";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowDownRight, ArrowUpRight, BadgeDollarSign, BarChart3, CircleDollarSign, Eye, Landmark, Plus, ShieldCheck, Sparkles, WalletCards } from "lucide-react";
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

const eventLabels: Record<string, string> = { opening_balance: "رصيد افتتاحي", deposit: "إيداع", withdrawal: "سحب", transfer: "تحويل", buy: "شراء", sell: "بيع", dividend: "توزيع نقدي", income: "دخل", expense: "مصروف", fee: "رسوم", tax: "ضريبة", adjustment: "تسوية", reversal: "عكس عملية" };

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

  return <span className="tabular-nums" dir="ltr"><SensitiveValue>{formatMoney(display, currency, 0)}</SensitiveValue></span>;
}

function MetricCard({ icon: Icon, label, value, currency, detail, accent = "emerald", delay = 0 }: { icon: typeof Landmark; label: string; value: number | string; currency: string; detail: React.ReactNode; accent?: "emerald" | "violet" | "amber" | "rose"; delay?: number }) {
  return <motion.article className={`fintech-metric fintech-metric-${accent}`} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.38, delay, ease: [0.23, 1, 0.32, 1] }}><div className="fintech-metric-icon"><Icon className="size-5" /></div><p>{label}</p><strong><AnimatedMoney value={value} currency={currency} /></strong><small>{detail}</small></motion.article>;
}

function DashboardSkeleton() {
  return <DashboardLayout><div className="fintech-page space-y-6" dir="rtl"><Skeleton className="h-36 w-full rounded-[2rem]" /><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }).map((_, index) => <Skeleton className="h-44 rounded-[1.5rem]" key={index} />)}</div><Skeleton className="h-[26rem] w-full rounded-[1.5rem]" /></div></DashboardLayout>;
}

export default function FintechDashboard() {
  const { user } = useAuth();
  const { isDemoMode, toggleDemoMode } = useDemoMode();
  const [_, setLocation] = useLocation();
  const summary = trpc.family.dashboard.useQuery();
  const debts = trpc.family.debts.list.useQuery();
  const decisions = trpc.family.planning.decisionCenter.useQuery(undefined, { enabled: !isDemoMode });
  const marketOverview = trpc.family.marketOverview.useQuery(undefined, { enabled: !isDemoMode });
  const reduceMotion = useReducedMotion();

  if (summary.isLoading && !isDemoMode) return <DashboardSkeleton />;
  if (summary.error && !isDemoMode) return <DashboardLayout><div className="fintech-page py-12" dir="rtl"><Card className="border-rose-200 bg-rose-50/70"><CardContent className="p-8 text-rose-900">تعذر تحميل لوحة التحكم الآن. حاول تحديث الصفحة، أو فعّل وضع العرض التجريبي لمعاينة الواجهة دون أي تغيير في بياناتك.</CardContent></Card></div></DashboardLayout>;

  const live = summary.data;
  const hasLiveData = Boolean((live?.accounts.length ?? 0) + (live?.portfolio.length ?? 0) + (live?.recentEvents.length ?? 0));
  const previewMode = getDashboardPreviewMode(isDemoMode, hasLiveData);
  const usingDemo = previewMode === "demo";
  const currency = usingDemo ? demoDashboard.baseCurrency : (live?.workspace.baseCurrency ?? "EGP");
  const accounts = usingDemo ? demoDashboard.accounts : (live?.accounts ?? []).map(account => ({ id: String(account.id), name: account.name, value: Number(account.baseValue ?? account.balance ?? 0), currency: account.currency, kind: account.accountType }));
  const allocation = usingDemo ? [...demoDashboard.allocation] : [
    ...(live?.accounts ?? []).filter(account => account.baseValue !== null && Number(account.baseValue) > 0).map((account, index) => ({ name: account.name, value: Number(account.baseValue), color: ["#11a889", "#6a7df5", "#e7a84e"][index % 3] })),
    ...(live?.portfolio ?? []).filter(position => position.baseMarketValue !== null && Number(position.baseMarketValue) > 0).map((position, index) => ({ name: position.instrumentName, value: Number(position.baseMarketValue), color: ["#e46b7a", "#5bb5e7"][index % 2] })),
  ];
  const cashFlow = usingDemo ? [...demoDashboard.cashFlow] : [];
  const events = usingDemo ? demoDashboard.events : (live?.recentEvents ?? []).map(event => ({ id: String(event.id), type: eventLabels[event.eventType] ?? event.eventType, amount: event.grossAmount, currency: event.currency, date: new Intl.DateTimeFormat("ar-EG", { dateStyle: "medium", timeStyle: "short" }).format(new Date(event.occurredAt)), tone: ["expense", "withdrawal", "fee", "tax"].includes(event.eventType) ? "expense" : "income" }));
  const debtItems = usingDemo ? demoDashboard.debts : (debts.data ?? []).filter(debt => debt.status === "active").map(debt => ({ id: String(debt.id), name: debt.name, outstanding: debt.outstanding, currency: debt.currency, payment: debt.minimumPayment, rate: debt.annualInterestRate }));
  const netWorth = usingDemo ? demoDashboard.netWorth : (live?.netWorthBase ?? "0");
  const liquidBalance = usingDemo ? demoDashboard.liquidBalance : (live?.liquidBalanceBase ?? "0");
  const liabilities = usingDemo ? demoDashboard.liabilities : (live?.liabilityBalanceBase ?? "0");
  const investments = usingDemo ? demoDashboard.investments : (live?.investmentValueBase ?? "0");
  const pnl = usingDemo ? demoDashboard.unrealizedPnl : (live?.unrealizedPnlBase ?? "0");
  return <DashboardLayout><div className="fintech-page pb-10" dir="rtl">
    <motion.section className="fintech-hero" initial={reduceMotion ? false : { opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.42, ease: [0.23, 1, 0.32, 1] }}>
      <div className="fintech-hero-orb fintech-hero-orb-one" /><div className="fintech-hero-orb fintech-hero-orb-two" />
      <div className="relative z-10"><div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-emerald-100"><span className="fintech-status-dot" />نظرة مالية موحدة <span className="opacity-70">•</span><span>{usingDemo ? "وضع العرض التجريبي" : "بياناتك المسجلة"}</span></div><h1>أهلاً {user?.name?.split(" ")[0] || "بك"}،<br /><span>هذا هو وضعك المالي اليوم.</span></h1><p>تعرض اللوحة ملخصاً تشغيلياً للأرصدة والحيازات والالتزامات، مع تمييز واضح بين البيانات المسجلة وعرض الواجهة التوضيحي.</p></div>
      <div className="fintech-hero-actions relative z-10"><Button onClick={() => setLocation("/accounts")} className="fintech-primary-action"><Plus className="size-4" />إضافة حساب</Button><Button variant="outline" onClick={toggleDemoMode} className="fintech-ghost-action"><Eye className="size-4" />{usingDemo ? "العودة لبياناتي" : "معاينة ببيانات تجريبية"}</Button></div>
      <div className="fintech-decision-stamp relative z-10"><ShieldCheck className="size-5" /><div><span>حالة البيانات</span><strong>{usingDemo ? "عرض توضيحي آمن" : "قيودك المالية"}</strong></div></div>
    </motion.section>
    {!usingDemo && decisions.data?.length ? <section className="fintech-decision-center" aria-label="مركز القرارات"><div className="fintech-panel-heading"><div><p className="fintech-overline">مركز القرار</p><h2>أهم ثلاث إشارات فقط</h2></div><Button variant="ghost" onClick={() => setLocation("/approvals")} className="fintech-text-button">إدارة القرارات</Button></div><div className="grid gap-3 md:grid-cols-3">{decisions.data.slice(0, 3).map(item => <button onClick={() => setLocation(item.actionPath)} className="fintech-decision-item" key={item.id}><span>{item.priority}</span><div><strong>{item.title}</strong><p>{item.detail}</p></div>{item.amount && <b><SensitiveValue>{formatMoney(item.amount, item.currency || currency, 0)}</SensitiveValue></b>}</button>)}</div></section> : null}

    <section className="fintech-metrics-grid"><MetricCard icon={CircleDollarSign} label="صافي الثروة" value={netWorth} currency={currency} detail={usingDemo ? "لقطة توضيحية قابلة للاستبدال" : "مُقوّم بعملة الأساس"} delay={0.04} /><MetricCard icon={WalletCards} label="السيولة المتاحة" value={liquidBalance} currency={currency} detail="الحسابات النقدية والمصرفية" accent="violet" delay={0.09} /><MetricCard icon={BarChart3} label="قيمة الاستثمارات" value={investments} currency={currency} detail={<><span>ربح غير محقق </span><SensitiveValue>{formatMoney(pnl, currency, 0)}</SensitiveValue></>} accent="amber" delay={0.14} /><MetricCard icon={BadgeDollarSign} label="الالتزامات" value={liabilities} currency={currency} detail="قروض وبطاقات نشطة" accent="rose" delay={0.19} /></section>

    {!usingDemo && marketOverview.data?.entries.length ? <section className="fintech-panel" aria-label="مراقبة السوق"><div className="fintech-panel-heading"><div><p className="fintech-overline">مراقبة السوق</p><h2>أسعار الحيازات وعناصر المتابعة</h2><p className="mt-1 text-sm font-normal text-muted-foreground">الأسعار مسجلة من المصدر مع وقتها وحالتها؛ وهي للمتابعة والمراجعة فقط.</p></div><div className="flex gap-2"><Button variant="ghost" onClick={() => setLocation("/research/prices")} className="fintech-text-button">الأسعار والإشارات</Button><Button variant="ghost" onClick={() => setLocation("/data-quality")} className="fintech-text-button">جودة البيانات</Button></div></div><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{marketOverview.data.entries.slice(0, 9).map(item => <button key={item.instrumentId} onClick={() => setLocation("/research/prices")} className="rounded-2xl border bg-muted/20 p-4 text-right transition hover:border-emerald-400 hover:bg-emerald-50/40 dark:hover:bg-emerald-950/20"><div className="flex items-start justify-between gap-3"><div><strong>{item.symbol || item.name}</strong><p className="mt-1 text-xs text-muted-foreground">{item.symbol ? item.name : item.assetType}</p></div><span className="rounded-full bg-background px-2 py-1 text-[11px] text-muted-foreground">{item.ownership === "owned_and_watching" ? "مملوك ومراقَب" : item.ownership === "owned" ? "مملوك" : "مراقَب"}</span></div><div className="mt-4 flex items-end justify-between gap-3"><b className="text-lg tabular-nums" dir="ltr">{item.price === null ? "—" : formatMoney(item.price, item.currency, 2)}</b><span className={item.quoteStatus === "unavailable" || item.quoteStatus === "stale" ? "text-xs text-amber-700" : "text-xs text-emerald-700"}>{item.quoteStatus === "stale" ? "متأخر" : item.quoteStatus === "unavailable" ? "غير متاح" : item.quoteStatus}</span></div><p className="mt-3 text-xs text-muted-foreground">{item.source || "لا يوجد مصدر مسجل"}{item.asOf ? ` · ${new Intl.DateTimeFormat("ar-EG", { dateStyle: "short", timeStyle: "short" }).format(new Date(item.asOf))}` : ""}</p></button>)}</div></section> : null}

    {previewMode === "empty" ? <section className="fintech-empty-stage"><div className="fintech-empty-icon"><Sparkles className="size-7" /></div><div><p className="fintech-overline">ابدأ من نقطة واضحة</p><h2>لوحتك جاهزة لبناء الصورة المالية.</h2><p>أضف حسابك الأول لإنشاء الرصيد الافتتاحي بقيد متوازن، أو فعّل العرض التجريبي لمعاينة الرسم والبطاقات دون إضافة أي بيانات إلى نطاقك.</p><div className="flex flex-wrap gap-3"><Button onClick={() => setLocation("/accounts")} className="fintech-primary-action"><Landmark className="size-4" />إضافة حساب</Button><Button variant="outline" onClick={toggleDemoMode} className="fintech-outline-action">تشغيل العرض التجريبي</Button></div></div></section> : <>
      <Suspense fallback={<section className="fintech-content-grid"><Skeleton className="h-[360px] rounded-[1.5rem]" /><Skeleton className="h-[360px] rounded-[1.5rem]" /></section>}><FintechCharts allocation={allocation} cashFlow={cashFlow} currency={currency} usingDemo={usingDemo} onShowLedger={() => setLocation("/cash-flow/record")} /></Suspense>
      <section className="fintech-content-grid fintech-lower-grid"><motion.article className="fintech-panel" initial={reduceMotion ? false : { opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.42, delay: 0.26 }}><div className="fintech-panel-heading"><div><p className="fintech-overline">النشاط الأخير</p><h2>آخر ما تحرك في المساحة</h2></div><Button variant="ghost" onClick={() => setLocation("/ledger")} className="fintech-text-button">عرض الدفتر</Button></div><div className="fintech-event-list">{events.map((event, index) => <div className="fintech-event" key={event.id}><div className={`fintech-event-icon fintech-event-${event.tone}`}>{event.tone === "expense" ? <ArrowDownRight className="size-4" /> : <ArrowUpRight className="size-4" />}</div><div><strong>{event.type}</strong><small>{event.date}</small></div><b><SensitiveValue>{formatMoney(event.amount, event.currency, 0)}</SensitiveValue></b><i style={{ animationDelay: `${index * 80}ms` }} /></div>)}</div></motion.article>
        <motion.article className="fintech-panel" initial={reduceMotion ? false : { opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.42, delay: 0.31 }}><div className="fintech-panel-heading"><div><p className="fintech-overline">الالتزامات</p><h2>نظرة على السداد</h2></div><Button variant="ghost" onClick={() => setLocation("/debts")} className="fintech-text-button">إدارة الديون</Button></div>{debtItems.length ? <div className="fintech-debt-list">{debtItems.map(debt => <div className="fintech-debt" key={debt.id}><div><strong>{debt.name}</strong><small>دفعة دنيا <SensitiveValue>{formatMoney(debt.payment, debt.currency, 0)}</SensitiveValue> شهرياً</small></div><div><b><SensitiveValue>{formatMoney(debt.outstanding, debt.currency, 0)}</SensitiveValue></b><span>{debt.rate}% سنوياً</span></div></div>)}</div> : <div className="fintech-chart-empty"><BadgeDollarSign className="size-7" /><p>لا توجد التزامات نشطة داخل مساحة FAMILY الحالية.</p></div>}</motion.article></section>
      <motion.section className="fintech-accounts-strip" initial={reduceMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.35, delay: 0.36 }}><div><p className="fintech-overline">الحسابات والأصول</p><h2>ملخص مواقعك المالية</h2></div><div className="fintech-account-scroller">{accounts.map(account => <button onClick={() => setLocation("/accounts")} key={account.id}><span>{account.kind}</span><strong>{account.name}</strong><b><SensitiveValue>{formatMoney(account.value, account.currency, 0)}</SensitiveValue></b><ArrowUpRight className="size-4" /></button>)}</div></motion.section>
    </>}
  </div></DashboardLayout>;
}
