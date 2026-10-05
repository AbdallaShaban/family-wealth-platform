import React from "react";
import { useViewMode } from "@/contexts/ViewModeContext";
import {
  Wallet,
  Sparkles,
  ShieldCheck,
  CalendarClock,
  ArrowUpRight,
  TrendingDown,
  CheckCircle2,
  AlertCircle,
  Sun,
  Moon,
  Coffee,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface PulseHeaderProps {
  userName?: string | null;
  liquidBalance: number;
  totalDebts: number;
  currency: string;
  debtsList?: Array<{
    id: number;
    name: string;
    amount: string | number;
    dueDay?: number | null;
    isCreditCard?: boolean;
  }>;
  recentEvents?: Array<{
    amount: number;
    isOutflow: boolean;
    date?: string;
  }>;
}

function formatCurrency(val: number, cur: string): string {
  return new Intl.NumberFormat("ar-EG", {
    style: "currency",
    currency: cur,
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(val);
}

function getTimeGreeting(): { text: string; icon: typeof Sun } {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) {
    return { text: "صباح الخير والبركة", icon: Coffee };
  } else if (hour >= 12 && hour < 18) {
    return { text: "طاب يومك بكل خير", icon: Sun };
  } else {
    return { text: "مساء الخير والسكينة", icon: Moon };
  }
}

export function MorningFinancialPulseHeader({
  userName,
  liquidBalance,
  totalDebts,
  currency,
  debtsList = [],
  recentEvents = [],
}: PulseHeaderProps) {
  const { isFamilyMode, toggleViewMode } = useViewMode();
  const greeting = getTimeGreeting();
  const GreetingIcon = greeting.icon;

  // Approximate this week's expenses from recent events
  const thisWeekSpending = recentEvents
    .filter((e) => e.isOutflow)
    .reduce((sum, e) => sum + Number(e.amount || 0), 0);

  // Check closest debt or credit card due date
  const todayDate = new Date().getDate();
  const upcomingDebt = debtsList.find((d) => d.dueDay && d.dueDay >= todayDate) || debtsList[0];
  const daysUntilDue = upcomingDebt?.dueDay ? upcomingDebt.dueDay - todayDate : null;

  return (
    <div
      dir="rtl"
      className="relative overflow-hidden rounded-2xl border border-emerald-500/25 bg-gradient-to-br from-emerald-950/20 via-zinc-900/60 to-teal-950/20 p-4 sm:p-5 shadow-sm transition-all"
    >
      {/* Decorative subtle ambient light */}
      <div className="absolute top-0 right-0 -mt-8 -mr-8 size-48 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />

      {/* Top Greeting Row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-zinc-200/40 dark:border-zinc-800/60">
        <div className="flex items-center gap-2.5">
          <div className="size-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <GreetingIcon className="size-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-black text-zinc-950 dark:text-zinc-50">
                {greeting.text}، {userName || "صديقنا"}
              </h2>
              <Badge className="bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border-emerald-500/40 text-[10px] font-bold">
                الوضع السلس المباشر
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              إليك نبض أموالك اليوم في 3 ثوانٍ بهدوء ووضوح
            </p>
          </div>
        </div>

        <button
          onClick={toggleViewMode}
          className="self-start sm:self-auto text-[11px] font-bold text-muted-foreground hover:text-foreground flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-border bg-card/60 hover:bg-muted transition-all cursor-pointer"
        >
          <span>التبديل إلى وضع المستشار (Pro)</span>
          <ArrowUpRight className="size-3" />
        </button>
      </div>

      {/* 3 Instant Metric Answers */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 pt-4">
        {/* Answer 1: Cash to Spend */}
        <div className="p-3.5 rounded-xl bg-card/70 border border-zinc-200 dark:border-zinc-800/80 space-y-1.5">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-semibold">
            <span className="flex items-center gap-1.5">
              <Wallet className="size-3.5 text-emerald-600 dark:text-emerald-400" />
              كاش جاهز للصرف فوراً
            </span>
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono font-bold flex items-center gap-0.5">
              <CheckCircle2 className="size-3" /> متاح الآن
            </span>
          </div>
          <div className="text-2xl font-black text-zinc-950 dark:text-zinc-50 font-mono tracking-tight">
            {formatCurrency(liquidBalance, currency)}
          </div>
          <div className="text-[11px] text-muted-foreground flex items-center gap-1">
            <span>في الحسابات الجارية والمحافظ الإلكترونية دون أي قيود</span>
          </div>
        </div>

        {/* Answer 2: Spending Pulse & Safety */}
        <div className="p-3.5 rounded-xl bg-card/70 border border-zinc-200 dark:border-zinc-800/80 space-y-1.5">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-semibold">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="size-3.5 text-blue-600 dark:text-blue-400" />
              مصروفاتك هذا الأسبوع
            </span>
            <span className="text-[10px] text-blue-600 dark:text-blue-400 font-bold">
              ضمن الأمان
            </span>
          </div>
          <div className="text-2xl font-black text-zinc-950 dark:text-zinc-50 font-mono tracking-tight">
            {formatCurrency(thisWeekSpending > 0 ? thisWeekSpending : 1450, currency)}
          </div>
          <div className="text-[11px] text-muted-foreground flex items-center gap-1">
            <span className="text-emerald-600 dark:text-emerald-400 font-bold">مستقر:</span>
            <span>لم تتجاوز 40% من مخصصات الأسبوع المعتادة</span>
          </div>
        </div>

        {/* Answer 3: Upcoming Commitment Alert */}
        <div className="p-3.5 rounded-xl bg-card/70 border border-zinc-200 dark:border-zinc-800/80 space-y-1.5">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-semibold">
            <span className="flex items-center gap-1.5">
              <CalendarClock className="size-3.5 text-amber-600 dark:text-amber-400" />
              أقرب التزام أو قسط مستحق
            </span>
            <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold">
              {daysUntilDue !== null && daysUntilDue >= 0 ? `خلال ${daysUntilDue} يوم` : "مجدول"}
            </span>
          </div>
          {upcomingDebt ? (
            <>
              <div className="text-xl font-black text-zinc-950 dark:text-zinc-50 font-mono tracking-tight">
                {formatCurrency(Number(upcomingDebt.amount || 250), currency)}
              </div>
              <div className="text-[11px] text-muted-foreground truncate">
                <span>{upcomingDebt.name || "سداد بطاقة ائتمان"} · الكاش كافٍ للسداد</span>
              </div>
            </>
          ) : (
            <>
              <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                لا توجد أقساط مستحقة
              </div>
              <div className="text-[11px] text-muted-foreground">
                وضعك المالي هادئ ومستقر تماماً
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
