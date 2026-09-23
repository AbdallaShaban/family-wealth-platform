import { useState } from "react";
import SensitiveValue from "@/components/SensitiveValue";
import { formatMoney } from "@/lib/financialDisplay";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Plus } from "lucide-react";

type AllocationItem = { name: string; value: number; color: string };
type CashFlowItem = { month: string; income: number; expense: number };

function ChartTooltip({
  active,
  payload,
  label,
  currency,
}: {
  active?: boolean;
  payload?: Array<{ value: number; name: string; color: string }>;
  label?: string;
  currency: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white/95 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-800 shadow-xl rounded-xl p-3 min-w-[170px] backdrop-blur-md">
      <p className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 border-b border-slate-100 dark:border-slate-800 pb-1.5">
        {label || "تفاصيل"}
      </p>
      {payload.map((item) => (
        <div key={item.name} className="flex items-center justify-between gap-3 text-xs mt-1.5">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className="size-2 rounded-full shrink-0 ring-1 ring-slate-200/60 dark:ring-slate-700"
              style={{ background: item.color }}
            />
            <span className="font-medium text-slate-600 dark:text-slate-300 truncate">
              {item.name}
            </span>
          </div>
          <strong className="font-mono font-bold text-slate-900 dark:text-slate-100 tabular-nums shrink-0" dir="ltr">
            <SensitiveValue>{formatMoney(item.value, currency, 0)}</SensitiveValue>
          </strong>
        </div>
      ))}
    </div>
  );
}

export default function FintechCharts({
  allocation,
  cashFlow,
  currency,
  usingDemo,
  onShowLedger,
}: {
  allocation: AllocationItem[];
  cashFlow: CashFlowItem[];
  currency: string;
  usingDemo: boolean;
  onShowLedger: () => void;
}) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const pieTotal = allocation.reduce((sum, item) => sum + item.value, 0);

  const hoveredItem =
    hoveredIndex !== null && allocation[hoveredIndex] ? allocation[hoveredIndex] : null;
  const hoveredPercent =
    hoveredItem && pieTotal ? Math.round((hoveredItem.value / pieTotal) * 100) : 0;

  const hasCashFlowData = cashFlow.length > 0 && cashFlow.some(c => c.income > 0 || c.expense > 0);
  const defaultRecentMonths = ["أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر"];
  const displayCashFlow = hasCashFlowData
    ? cashFlow
    : defaultRecentMonths.map((month) => ({ month, income: 0, expense: 0 }));

  return (
    <section className="fintech-content-grid">
      {/* 1. Donut Chart: توزيع السيولة النقدية والمصرفية */}
      <article className="bg-[#0B1222] border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between h-full text-slate-100">
        <div>
          <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-white font-extrabold text-base">
                  توزيع السيولة النقدية والمصرفية
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  الحسابات الحرة والمحافظ
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium mt-0.5">
                توزيع الأرصدة المصرفية السائلة والمحافظ الإلكترونية (بدون احتساب الأسهم لمنع الازدواج)
              </p>
            </div>
          </div>

          {/* Donut Chart with Dynamic Reactive Center */}
          <div className="relative h-[240px] mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={allocation}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={98}
                  paddingAngle={3}
                  stroke="transparent"
                  onMouseEnter={(_, index) => setHoveredIndex(index)}
                  onMouseLeave={() => setHoveredIndex(null)}
                >
                  {allocation.map((item, index) => (
                    <Cell
                      key={item.name}
                      fill={item.color}
                      opacity={hoveredIndex === null || hoveredIndex === index ? 1 : 0.35}
                      style={{ transition: "opacity 0.2s ease" }}
                      className="cursor-pointer"
                    />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>

            {/* Reactive Center Readout (NO floating tooltip collision) */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center select-none">
              {hoveredItem ? (
                <div className="flex flex-col items-center justify-center px-2 max-w-[130px] animate-in fade-in zoom-in-95 duration-150">
                  <span
                    className="text-slate-400 text-xs block mb-0.5 truncate max-w-[124px]"
                    title={hoveredItem.name}
                  >
                    {hoveredItem.name}
                  </span>
                  <strong className="font-bold font-mono text-xl text-white mt-0.5 block tabular-nums">
                    <SensitiveValue>{formatMoney(hoveredItem.value, currency, 0)}</SensitiveValue>
                  </strong>
                  <span className="text-xs font-bold font-mono text-emerald-400 mt-0.5">
                    {hoveredPercent}%
                  </span>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center px-2 max-w-[130px] animate-in fade-in duration-150">
                  <span className="text-slate-400 text-xs block mb-0.5 font-medium">
                    إجمالي السيولة النقدية
                  </span>
                  <strong className="text-white font-extrabold font-mono text-xl tabular-nums mt-0.5 block">
                    <SensitiveValue>{formatMoney(pieTotal, currency, 0)}</SensitiveValue>
                  </strong>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Organized 2-Column Grid Legend */}
        <div className="mt-4 pt-4 border-t border-slate-800/80 grid grid-cols-1 sm:grid-cols-2 gap-2">
          {allocation.slice(0, 8).map((item, index) => {
            const pct = pieTotal ? Math.round((item.value / pieTotal) * 100) : 0;
            const isHovered = hoveredIndex === index;
            return (
              <div
                key={item.name}
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
                className={`group flex items-center justify-between py-2 px-2.5 rounded-xl transition-all duration-150 cursor-pointer border ${
                  isHovered
                    ? "bg-slate-800/90 border-slate-700 shadow-xs"
                    : "bg-slate-900/60 hover:bg-slate-800/60 border-slate-800"
                }`}
              >
                {/* Right side (RTL): Color Dot + Account Name */}
                <div className="flex items-center gap-2 min-w-0 flex-1 ml-2">
                  <span
                    className="size-2.5 rounded-full shrink-0 ring-1 ring-slate-700"
                    style={{ backgroundColor: item.color }}
                  />
                  <span
                    className="text-xs font-semibold text-slate-200 truncate"
                    title={item.name}
                  >
                    {item.name}
                  </span>
                </div>

                {/* Left side (RTL): Percentage + Formatted Amount */}
                <div className="flex items-center gap-2 shrink-0 text-left" dir="ltr">
                  <span className="text-[11px] font-bold font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                    {pct}%
                  </span>
                  <span className="text-xs font-bold font-mono text-white tabular-nums tracking-tight">
                    <SensitiveValue>{formatMoney(item.value, currency, 0)}</SensitiveValue>
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </article>

      {/* 2. Flow Chart: الدخل مقابل المصروفات */}
      <article className="bg-[#0B1222] border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between h-full text-slate-100">
        <div>
          <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
            <div>
              <h2 className="text-white font-extrabold text-base">
                الدخل مقابل المصروفات
              </h2>
              <p className="text-xs text-slate-400 font-medium mt-0.5">
                مقارنة الإيرادات والنفقات النقدية الدورية
              </p>
            </div>
            {hasCashFlowData && (
              <button
                type="button"
                onClick={onShowLedger}
                className="text-xs font-semibold text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                دفتر الأستاذ ←
              </button>
            )}
          </div>

          <div className="relative min-h-[280px] h-[280px] mt-2 w-full flex-1 flex flex-col justify-center">
            {hasCashFlowData ? (
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart
                  data={displayCashFlow}
                  margin={{ top: 12, right: 4, left: -24, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="incomeGradient" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="#10B981" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#10B981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="expenseGradient" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="#F43F5E" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#F43F5E" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    stroke="#1E293B"
                    strokeDasharray="3 3"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="month"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#64748B", fontSize: 11 }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#64748B", fontSize: 11 }}
                    tickFormatter={(value) =>
                      value >= 1000 ? `${Math.round(value / 1000)}K` : String(value)
                    }
                    domain={[0, "auto"]}
                  />
                  <Tooltip content={<ChartTooltip currency={currency} />} />
                  <Area
                    type="monotone"
                    dataKey="income"
                    name="الدخل"
                    stroke="#10B981"
                    strokeWidth={2.5}
                    fill="url(#incomeGradient)"
                  />
                  <Area
                    type="monotone"
                    dataKey="expense"
                    name="المصروفات"
                    stroke="#F43F5E"
                    strokeWidth={2.5}
                    fill="url(#expenseGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              /* Sleek Polish Zero-State Prompt */
              <div className="h-full flex flex-col items-center justify-center p-6 text-center rounded-xl bg-[#0F172A]/70 border border-dashed border-slate-800">
                <div className="size-11 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mb-3">
                  <Plus className="size-5" />
                </div>
                <h3 className="text-sm font-bold text-slate-200">
                  بانتظار تسجيل حركات الدخل والمصروفات
                </h3>
                <p className="text-xs text-slate-400 max-w-sm mt-1 leading-relaxed font-medium">
                  سجل عمليات الإيداع والصرف أو استورد كشف الحساب البنكي لرسم مقارنة التدفقات النقدية تلقائياً.
                </p>
                <button
                  type="button"
                  onClick={onShowLedger}
                  className="mt-4 inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-xs transition-all cursor-pointer"
                >
                  <Plus className="size-3.5" />
                  <span>تسجيل حركة نقدية الآن</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </article>
    </section>
  );
}
