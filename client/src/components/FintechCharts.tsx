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

  // Generate real recent 6 months for clean baseline canvas when cashFlow is empty
  const defaultRecentMonths = ["Apr", "May", "Jun", "Jul", "Aug", "Sep"];
  const displayCashFlow = cashFlow.length
    ? cashFlow
    : defaultRecentMonths.map((month) => ({ month, income: 0, expense: 0 }));

  return (
    <section className="fintech-content-grid">
      {/* 1. Donut Chart: مواقع القيمة المقيمة */}
      <article className="bg-white dark:bg-[#0B0F17] border border-slate-200/90 dark:border-slate-800/80 rounded-2xl p-6 shadow-xs flex flex-col justify-between h-full">
        <div>
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800/80 mb-4">
            <div>
              <h2 className="text-slate-900 dark:text-white font-bold text-base">
                مواقع القيمة المقيمة
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                توزيع الأصول والمراكز الاستثمارية القائمة
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
                    className="text-slate-500 dark:text-slate-400 text-xs block mb-0.5 truncate max-w-[124px]"
                    title={hoveredItem.name}
                  >
                    {hoveredItem.name}
                  </span>
                  <strong className="font-bold font-mono text-xl text-slate-900 dark:text-white mt-0.5 block tabular-nums">
                    <SensitiveValue>{formatMoney(hoveredItem.value, currency, 0)}</SensitiveValue>
                  </strong>
                  <span className="text-xs font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-0.5">
                    {hoveredPercent}%
                  </span>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center px-2 max-w-[130px] animate-in fade-in duration-150">
                  <span className="text-slate-500 dark:text-slate-400 text-xs block mb-0.5">
                    إجمالي الأصول
                  </span>
                  <strong className="text-slate-900 dark:text-white font-bold font-mono text-xl tabular-nums mt-0.5 block">
                    <SensitiveValue>{formatMoney(pieTotal, currency, 0)}</SensitiveValue>
                  </strong>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Clean Account Breakdown Legend List */}
        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 space-y-1.5">
          {allocation.slice(0, 5).map((item, index) => {
            const pct = pieTotal ? Math.round((item.value / pieTotal) * 100) : 0;
            const isHovered = hoveredIndex === index;
            return (
              <div
                key={item.name}
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
                className={`group flex items-center justify-between py-1.5 px-2.5 rounded-lg transition-all duration-150 cursor-pointer ${
                  isHovered
                    ? "bg-slate-100/90 dark:bg-[#0E1420] shadow-2xs"
                    : "hover:bg-slate-50/80 dark:hover:bg-[#0E1420]/50"
                }`}
              >
                {/* Right side (RTL): Color Dot + Account Name */}
                <div className="flex items-center gap-2.5 min-w-0 flex-1 ml-3">
                  <span
                    className="size-2.5 rounded-full shrink-0 ring-1 ring-slate-200/60 dark:ring-slate-700"
                    style={{ backgroundColor: item.color }}
                  />
                  <span
                    className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate"
                    title={item.name}
                  >
                    {item.name}
                  </span>
                </div>

                {/* Subtle dotted connector line on larger viewports */}
                <div className="hidden sm:block flex-1 mx-3 border-b border-dashed border-slate-200/60 dark:border-slate-800/60 group-hover:border-slate-300 dark:group-hover:border-slate-700 transition-colors" />

                {/* Left side (RTL): Percentage + Formatted Amount */}
                <div className="flex items-center gap-3 shrink-0 text-left" dir="ltr">
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400 font-mono">
                    {pct}%
                  </span>
                  <span className="text-xs font-bold font-mono text-slate-900 dark:text-white tabular-nums min-w-[76px] text-right">
                    <SensitiveValue>{formatMoney(item.value, currency, 0)}</SensitiveValue>
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </article>

      {/* 2. Flow Chart: الدخل مقابل المصروفات */}
      <article className="bg-white dark:bg-[#0B0F17] border border-slate-200/90 dark:border-slate-800/80 rounded-2xl p-6 shadow-xs flex flex-col justify-between h-full">
        <div>
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800/80 mb-4">
            <div>
              <h2 className="text-slate-900 dark:text-white font-bold text-base">
                الدخل مقابل المصروفات
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                مقارنة الإيرادات والنفقات النقدية الدورية
              </p>
            </div>
          </div>

          <div className="relative min-h-[280px] h-[280px] mt-2 w-full flex-1 flex flex-col justify-center">
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart
                data={displayCashFlow}
                margin={{ top: 12, right: 4, left: -24, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="incomeGradient" x1="0" x2="0" y1="0" y2="1">
                    <stop
                      offset="0%"
                      stopColor="#11a889"
                      stopOpacity={cashFlow.length ? 0.35 : 0.05}
                    />
                    <stop offset="100%" stopColor="#11a889" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="expenseGradient" x1="0" x2="0" y1="0" y2="1">
                    <stop
                      offset="0%"
                      stopColor="#e46b7a"
                      stopOpacity={cashFlow.length ? 0.24 : 0.05}
                    />
                    <stop offset="100%" stopColor="#e46b7a" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  stroke="#E2E8F0"
                  strokeDasharray="3 3"
                  vertical={false}
                  className="dark:opacity-20"
                />
                <XAxis
                  dataKey="month"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#94a3b8", fontSize: 11 }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#94a3b8", fontSize: 11 }}
                  tickFormatter={(value) =>
                    value >= 1000 ? `${Math.round(value / 1000)}K` : String(value)
                  }
                  domain={cashFlow.length ? [0, "auto"] : [0, 10000]}
                />
                {cashFlow.length ? (
                  <Tooltip content={<ChartTooltip currency={currency} />} />
                ) : null}
                <Area
                  type="monotone"
                  dataKey="income"
                  name="الدخل"
                  stroke="#11a889"
                  strokeWidth={cashFlow.length ? 3 : 1.5}
                  strokeDasharray={cashFlow.length ? undefined : "4 4"}
                  strokeOpacity={cashFlow.length ? 1 : 0.4}
                  fill="url(#incomeGradient)"
                />
                <Area
                  type="monotone"
                  dataKey="expense"
                  name="المصروفات"
                  stroke="#e46b7a"
                  strokeWidth={cashFlow.length ? 3 : 1.5}
                  strokeDasharray={cashFlow.length ? undefined : "4 4"}
                  strokeOpacity={cashFlow.length ? 1 : 0.4}
                  fill="url(#expenseGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>

            {/* Minimal Institutional Empty State */}
            {!cashFlow.length && (
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none p-4 text-center">
                <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm font-medium">
                  لا توجد تدفقات نقدية مسجلة لهذه الفترة
                </p>
                <button
                  type="button"
                  onClick={onShowLedger}
                  className="pointer-events-auto inline-flex items-center gap-1.5 bg-white dark:bg-[#0E1420] border border-slate-200/90 dark:border-slate-800/80 text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-xs font-semibold px-4 py-2 rounded-xl shadow-xs mt-2 transition-all cursor-pointer"
                >
                  <Plus className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>تسجيل أول حركة</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </article>
    </section>
  );
}
