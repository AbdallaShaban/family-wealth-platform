import React, { useMemo } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Coins,
  CreditCard,
  Flame,
  Info,
  Lightbulb,
  PieChart,
  ShieldAlert,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { formatMoney } from "@/lib/financialDisplay";

export type AdvisorTransactionType = "buy" | "sell" | "deposit" | "expense" | "credit_card";

export interface TransactionAdvisorProps {
  type: AdvisorTransactionType;
  amount: number | string;
  symbol?: string;
  sector?: string;
  currentPositionValue?: number;
  averageBuyCost?: number;
  sellPrice?: number;
  sellQuantity?: number;
  creditCardId?: number;
  currency?: string;
  className?: string;
}

export function useTransactionAdvisor({
  type,
  amount,
  symbol,
  sector,
  currentPositionValue = 0,
  averageBuyCost = 0,
  sellPrice = 0,
  sellQuantity = 0,
  creditCardId,
  currency = "EGP",
}: Omit<TransactionAdvisorProps, "className">) {
  const numAmount = Math.max(0, Number(amount) || 0);

  const { data: summary } = trpc.family.dashboard.useQuery(undefined, {
    staleTime: 10_000,
  });
  const { data: debts } = trpc.family.debts.list.useQuery(undefined, {
    staleTime: 15_000,
  });
  const { data: creditCards } = trpc.family.creditCards.list.useQuery(undefined, {
    staleTime: 15_000,
  });

  return useMemo(() => {
    const freeLiquidity = Number(summary?.freeLiquidityBase || summary?.liquidBalanceBase || 0);
    const totalInvestments = Number(summary?.investmentValueBase || 0);
    const totalNetWorth = Number(summary?.netWorthBase || 0);

    // Baseline emergency buffer: 3 months essential expenses, or ~20% of net worth, or min 15,000 EGP
    const emergencyBufferThreshold = Math.max(15_000, Math.round(totalNetWorth * 0.15));

    // High interest active debts
    const activeDebts = (debts || []).filter((d) => d.status === "active");
    const totalDebtOutstanding = activeDebts.reduce((sum, d) => sum + Number(d.outstanding || 0), 0);

    // Selected credit card
    const targetCard = creditCardId
      ? (creditCards || []).find((c) => c.id === creditCardId)
      : (creditCards || [])[0];

    const alerts: Array<{
      id: string;
      level: "danger" | "warning" | "info" | "success";
      title: string;
      message: string;
      metric?: string;
      icon: any;
    }> = [];

    // --- 1. BUY / INVESTMENT ORDERS ---
    if (type === "buy") {
      const remainingLiquidity = freeLiquidity - numAmount;
      const isDangerousLiquidity = remainingLiquidity < emergencyBufferThreshold;
      const isLiquidityExhausted = remainingLiquidity < 0;

      if (isLiquidityExhausted) {
        alerts.push({
          id: "buy-liquidity-deficit",
          level: "danger",
          title: "عجز في السيولة الحرة المتاحة",
          message: `قيمة العملية (${formatMoney(numAmount, currency, 0)}) تتجاوز كامل السيولة الحرة المتاحة (${formatMoney(freeLiquidity, currency, 0)}).`,
          metric: `العجز: ${formatMoney(Math.abs(remainingLiquidity), currency, 0)}`,
          icon: ShieldAlert,
        });
      } else if (isDangerousLiquidity) {
        alerts.push({
          id: "buy-emergency-breach",
          level: "warning",
          title: "تحذير: المساس باحتياطي الطوارئ",
          message: `تنفيذ هذا الشراء سيخفض السيولة الحرة إلى ${formatMoney(remainingLiquidity, currency, 0)} وهو أدنى من صمام الأمان المطلوب (${formatMoney(emergencyBufferThreshold, currency, 0)}).`,
          metric: `متبقي: ${formatMoney(remainingLiquidity, currency, 0)}`,
          icon: AlertTriangle,
        });
      } else if (numAmount > 0) {
        alerts.push({
          id: "buy-liquidity-ok",
          level: "success",
          title: "رصيد الأمان والسيولة في النطاق السليم",
          message: `ستبقى لديك سيولة حرة كافية بقيمة ${formatMoney(remainingLiquidity, currency, 0)} تغطي احتياطيات الطوارئ.`,
          icon: CheckCircle2,
        });
      }

      // Portfolio Concentration Risk (>30% of total portfolio value)
      const postTradePositionValue = currentPositionValue + numAmount;
      const postTradeTotalPortfolio = totalInvestments + numAmount;
      if (postTradeTotalPortfolio > 0) {
        const concentrationPct = (postTradePositionValue / postTradeTotalPortfolio) * 100;
        if (concentrationPct > 30) {
          alerts.push({
            id: "buy-concentration-risk",
            level: "warning",
            title: "تحذير تركّز المحفظة (تجاوز سقف 30%)",
            message: `سيشكل هذا الأصل (${symbol || "الأصل"}) قرابة ${concentrationPct.toFixed(1)}% من إجمالي المحفظة الاستثمارية، مما يزيد من المخاطر القطاعية. يُنصح بعدم تجاوز 30% لأي أصل أو قطاع.`,
            metric: `${concentrationPct.toFixed(1)}% من المحفظة`,
            icon: PieChart,
          });
        }
      }
    }

    // --- 2. SELL EXECUTIONS ---
    if (type === "sell") {
      // FIFO / Instant realized P&L
      const costBasis = averageBuyCost > 0 ? averageBuyCost * (sellQuantity || 1) : 0;
      const sellTotal = sellPrice > 0 && sellQuantity > 0 ? sellPrice * sellQuantity : numAmount;

      if (costBasis > 0 && sellTotal > 0) {
        const pnl = sellTotal - costBasis;
        const pnlPct = (pnl / costBasis) * 100;
        const isProfit = pnl >= 0;

        alerts.push({
          id: "sell-realized-pnl",
          level: isProfit ? "success" : "warning",
          title: isProfit ? "ربح رأسمالي محقق تقديري" : "خسارة رأسمالية محققة",
          message: isProfit
            ? `ستحقق أرباحاً رأسمالية قدرها ${formatMoney(pnl, currency, 0)} (+${pnlPct.toFixed(1)}%) فوق سعر الشراء.`
            : `سيترتب على هذا البيع خسارة قدرها ${formatMoney(Math.abs(pnl), currency, 0)} (${pnlPct.toFixed(1)}%).`,
          metric: `${isProfit ? "+" : ""}${formatMoney(pnl, currency, 0)} (${pnlPct.toFixed(1)}%)`,
          icon: isProfit ? TrendingUp : TrendingDown,
        });
      }

      // T+2 Settlement Lock Notification
      alerts.push({
        id: "sell-t2-lock",
        level: "info",
        title: "تنبيه قيد التسوية T+2 البنكية",
        message: "ستخضع حصيلة البيع لفترة قيد التسوية (48 ساعة عمل) كذمم مدينة قبل تحولها إلى سيولة حرة متاحة للسحب الخارجي.",
        metric: "تسوية بعد 48 ساعة",
        icon: Clock,
      });

      // Proceeds Allocation Advice: Debt Paydown vs Reinvestment
      if (totalDebtOutstanding > 0 && sellTotal > 0) {
        const debtCoveragePct = Math.min(100, Math.round((sellTotal / totalDebtOutstanding) * 100));
        alerts.push({
          id: "sell-debt-allocation",
          level: "info",
          title: "توصية المستشار: تسريع سداد الدين",
          message: `لديك التزامات ديون نشطة بقيمة ${formatMoney(totalDebtOutstanding, currency, 0)}. تخصيص حصيلة البيع لسداد الديون يوفر فوائد بنكية مركبة ويعزز صافي الثروة مباشرة.`,
          metric: `تغطي ${debtCoveragePct}% من الديون`,
          icon: Lightbulb,
        });
      }
    }

    // --- 3. DEPOSITS & CASH INFLOWS ---
    if (type === "deposit") {
      if (numAmount > 0) {
        const livingExpenseSplit = numAmount * 0.5;
        const debtSplit = numAmount * 0.3;
        const investSplit = numAmount * 0.2;

        alerts.push({
          id: "deposit-smart-split",
          level: "info",
          title: "قاعدة التوزيع المالي الذكي (50 / 30 / 20)",
          message: `يُوصى بتوجيه: ${formatMoney(livingExpenseSplit, currency, 0)} للمصروفات، و ${formatMoney(debtSplit, currency, 0)} لخدمة الديون، و ${formatMoney(investSplit, currency, 0)} للادخار والاستثمار.`,
          icon: Sparkles,
        });

        // Idle Cash sitting at 0%
        alerts.push({
          id: "deposit-idle-cash",
          level: "warning",
          title: "تنبيه السيولة الراكدة (0% عائد)",
          message: "تجنب ترك السيولة النقدية في الحساب الجاري بدون عائد. قم بترحيل الفائض إلى صندوق يومي (مثل تيلدا ~18-20%) أو شهادات بنكية لتعظيم العائد.",
          metric: "عائد بديل: 18% - 27%",
          icon: Coins,
        });
      }
    }

    // --- 4. CREDIT CARD TRANSACTIONS ---
    if (type === "credit_card" && targetCard) {
      const cardLimit = Number(targetCard.creditLimit || 50_000);
      const curBalance = Number(targetCard.currentBalance || 0);
      const postBalance = curBalance + numAmount;
      const postUtilPct = cardLimit > 0 ? (postBalance / cardLimit) * 100 : 0;

      if (postUtilPct > 30) {
        alerts.push({
          id: "cc-utilization-warning",
          level: "warning",
          title: "تحذير: تجاوز سقف الاستخدام الائتماني (30%)",
          message: `هذه العملية سترفع نسبة استخدام حد الكارت إلى ${postUtilPct.toFixed(1)}%. تجاوز 30% يضغط سلباً على تقييم الجدارة الائتمانية (I-Score).`,
          metric: `${postUtilPct.toFixed(1)}% استخدام`,
          icon: CreditCard,
        });
      } else if (numAmount > 0) {
        alerts.push({
          id: "cc-utilization-ok",
          level: "success",
          title: "استخدام ائتماني مثالي (<30%)",
          message: `نسبة الاستخدام المتوقعة (${postUtilPct.toFixed(1)}%) تحافظ على تصنيف ائتماني ممتاز.`,
          icon: CheckCircle2,
        });
      }

      alerts.push({
        id: "cc-grace-period",
        level: "info",
        title: "مهلة السداد بدون فوائد",
        message: `متبقي ${targetCard.graceDaysRemaining ?? 25} يوماً على موعد استحقاق السداد الكامل لتجنب احتساب أية فوائد أو غرامات.`,
        metric: `يوم السداد: ${targetCard.dueDay}`,
        icon: Clock,
      });
    }

    return {
      freeLiquidity,
      totalInvestments,
      totalNetWorth,
      totalDebtOutstanding,
      alerts,
    };
  }, [
    type,
    numAmount,
    symbol,
    sector,
    currentPositionValue,
    averageBuyCost,
    sellPrice,
    sellQuantity,
    creditCardId,
    currency,
    summary,
    debts,
    creditCards,
  ]);
}

export function TransactionAdvisorWidget(props: TransactionAdvisorProps) {
  const { alerts } = useTransactionAdvisor(props);

  if (!alerts.length) return null;

  return (
    <div className={`space-y-2.5 my-3 ${props.className || ""}`} dir="rtl">
      <div className="flex items-center gap-1.5 px-1 text-xs font-bold text-slate-700 dark:text-slate-300">
        <Sparkles className="size-3.5 text-amber-500 animate-pulse" />
        <span>المستشار التحليلي اللحظي (AI Financial Advisor)</span>
      </div>

      <div className="grid grid-cols-1 gap-2">
        {alerts.map((alert) => {
          const Icon = alert.icon;
          const bgClass =
            alert.level === "danger"
              ? "bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900/50 text-rose-900 dark:text-rose-200"
              : alert.level === "warning"
                ? "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900/50 text-amber-900 dark:text-amber-200"
                : alert.level === "success"
                  ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/50 text-emerald-900 dark:text-emerald-200"
                  : "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900/50 text-blue-900 dark:text-blue-200";

          const iconColor =
            alert.level === "danger"
              ? "text-rose-600 dark:text-rose-400"
              : alert.level === "warning"
                ? "text-amber-600 dark:text-amber-400"
                : alert.level === "success"
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-blue-600 dark:text-blue-400";

          return (
            <div
              key={alert.id}
              className={`flex items-start justify-between gap-3 p-3 rounded-xl border text-xs leading-relaxed transition-all shadow-2xs ${bgClass}`}
            >
              <div className="flex items-start gap-2.5">
                <Icon className={`size-4.5 mt-0.5 shrink-0 ${iconColor}`} />
                <div>
                  <h4 className="font-bold text-xs">{alert.title}</h4>
                  <p className="mt-0.5 text-[11px] opacity-90 font-medium">{alert.message}</p>
                </div>
              </div>

              {alert.metric && (
                <span
                  className="shrink-0 font-mono font-bold text-[11px] px-2 py-0.5 rounded-md bg-white/70 dark:bg-black/40 border border-black/5 dark:border-white/10"
                  dir="ltr"
                >
                  {alert.metric}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default TransactionAdvisorWidget;
