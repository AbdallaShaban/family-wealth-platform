import { useState } from "react";
import { Button } from "@/components/ui/button";
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
import { BarChart3, Plus } from "lucide-react";

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

  return (
    <section className="fintech-content-grid">
      <article className="fintech-panel fintech-allocation-panel flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-border/60 mb-2">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
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
                    className="text-xs font-medium text-slate-600 dark:text-slate-300 block truncate max-w-[124px]"
                    title={hoveredItem.name}
                  >
                    {hoveredItem.name}
                  </span>
                  <strong className="font-bold font-mono text-lg text-emerald-800 dark:text-emerald-300 mt-0.5 block tabular-nums">
                    <SensitiveValue>{formatMoney(hoveredItem.value, currency, 0)}</SensitiveValue>
                  </strong>
                  <span className="text-xs font-bold font-mono text-emerald-700 dark:text-emerald-400 mt-0.5">
                    {hoveredPercent}%
                  </span>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center px-2 max-w-[130px] animate-in fade-in duration-150">
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-medium block">
                    إجمالي الأصول
                  </span>
                  <strong className="font-bold font-mono text-xl text-slate-900 dark:text-white mt-0.5 block tabular-nums">
                    <SensitiveValue>{formatMoney(pieTotal, currency, 0)}</SensitiveValue>
                  </strong>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Clean Account Breakdown Legend List */}
        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-border/60 space-y-1.5">
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
                    ? "bg-slate-100/90 dark:bg-muted/70 shadow-2xs"
                    : "hover:bg-slate-50/80 dark:hover:bg-muted/40"
                }`}
              >
                {/* Right side (RTL): Color Dot + Account Name */}
                <div className="flex items-center gap-2.5 min-w-0 flex-1 ml-3">
                  <span
                    className="size-2.5 rounded-full shrink-0 ring-1 ring-slate-200/60 dark:ring-border/60"
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
                <div className="hidden sm:block flex-1 mx-3 border-b border-dashed border-slate-200/60 dark:border-border/40 group-hover:border-slate-300 transition-colors" />

                {/* Left side (RTL): Percentage + Formatted Amount */}
                <div className="flex items-center gap-3 shrink-0 text-left" dir="ltr">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 font-mono">
                    {pct}%
                  </span>
                  <span className="text-xs font-bold font-mono text-slate-900 dark:text-slate-100 tabular-nums min-w-[76px] text-right">
                    <SensitiveValue>{formatMoney(item.value, currency, 0)}</SensitiveValue>
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </article>

      <article className="fintech-panel fintech-flow-panel">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-border/60 mb-2">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              الدخل مقابل المصروفات
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
              مقارنة الإيرادات والنفقات النقدية الدورية
            </p>
          </div>
        </div>
        <div className="fintech-flow-chart">
          {cashFlow.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={cashFlow} margin={{ top: 12, right: 4, left: -24, bottom: 0 }}>
                <defs>
                  <linearGradient id="incomeGradient" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#11a889" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#11a889" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="expenseGradient" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#e46b7a" stopOpacity={0.24} />
                    <stop offset="100%" stopColor="#e46b7a" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#dce3ee" strokeDasharray="3 4" vertical={false} />
                <XAxis
                  dataKey="month"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#64748b", fontSize: 12 }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#64748b", fontSize: 11 }}
                  tickFormatter={(value) => `${Math.round(value / 1000)}K`}
                />
                <Tooltip content={<ChartTooltip currency={currency} />} />
                <Area
                  type="monotone"
                  dataKey="income"
                  name="الدخل"
                  stroke="#11a889"
                  strokeWidth={3}
                  fill="url(#incomeGradient)"
                />
                <Area
                  type="monotone"
                  dataKey="expense"
                  name="المصروفات"
                  stroke="#e46b7a"
                  strokeWidth={3}
                  fill="url(#expenseGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="relative overflow-hidden flex h-full min-h-[235px] flex-col items-center justify-center rounded-2xl border border-dashed border-border/80 bg-slate-50/40 dark:bg-muted/10 p-6 text-center">
              {/* Subtle Ghost Bar Chart Background Visual */}
              <div
                className="absolute inset-0 flex items-end justify-around px-8 pb-4 opacity-15 pointer-events-none select-none"
                aria-hidden="true"
              >
                <div className="w-6 h-14 rounded-t-md bg-slate-400 dark:bg-slate-500 border border-slate-500/30" />
                <div className="w-6 h-28 rounded-t-md bg-slate-400 dark:bg-slate-500 border border-slate-500/30" />
                <div className="w-6 h-18 rounded-t-md bg-slate-400 dark:bg-slate-500 border border-slate-500/30" />
                <div className="w-6 h-36 rounded-t-md bg-slate-400 dark:bg-slate-500 border border-slate-500/30" />
                <div className="w-6 h-22 rounded-t-md bg-slate-400 dark:bg-slate-500 border border-slate-500/30" />
                <div className="w-6 h-30 rounded-t-md bg-slate-400 dark:bg-slate-500 border border-slate-500/30" />
              </div>

              {/* Foreground Content */}
              <div className="relative z-10 flex flex-col items-center">
                <div className="w-12 h-12 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 text-slate-500 dark:text-slate-400 flex items-center justify-center shadow-xs mb-3">
                  <BarChart3 className="size-5" />
                </div>
                <p className="text-xs font-bold text-slate-900 dark:text-slate-100">
                  لا توجد تدفقات دخل أو مصروفات مسجلة لهذه الفترة
                </p>
                <p className="mt-1 max-w-xs text-[11.5px] leading-relaxed text-slate-600 dark:text-slate-400 font-medium">
                  تظهر اتجاهات التدفق ومقارنة الدخل والمصروفات تلقائيًا بمجرد تسجيل العمليات النقدية.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onShowLedger}
                  className="mt-3.5 h-8 gap-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 dark:text-slate-200 bg-white/90 dark:bg-card/90 border-border shadow-2xs hover:bg-white"
                >
                  <Plus className="size-3.5" />
                  تسجيل تدفق
                </Button>
              </div>
            </div>
          )}
        </div>
      </article>
    </section>
  );
}
