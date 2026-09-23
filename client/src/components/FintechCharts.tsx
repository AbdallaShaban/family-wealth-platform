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
      <article className="bg-white dark:bg-[#0B1222] border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.06)] dark:shadow-none flex flex-col justify-between h-full text-slate-900 dark:text-slate-100">
        <div>
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-slate-900 dark:text-white font-bold text-base">
                  توزيع السيولة النقدية والمصرفية
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60">
                  الحسابات الحرة والمحافظ
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
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
                    className="font-mono font-bold text-xl tabular-nums tracking-tight text-slate-900 dark:text-white"
                    dir="ltr"
                  >
                    {pieTotal > 0 ? ((hoveredItem.value / pieTotal) * 100).toFixed(1) : 0}%
                  </span>
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate max-w-[120px] mt-0.5">
                    {hoveredItem.name}
                  </span>
                  <span className="text-[10.5px] font-mono text-slate-500 dark:text-slate-400 mt-0.5" dir="ltr">
                    <SensitiveValue>{formatMoney(hoveredItem.value, currency, 0)}</SensitiveValue>
                  </span>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">إجمالي السيولة</span>
                  <strong className="font-mono font-bold text-xl text-slate-900 dark:text-white tabular-nums tracking-tight mt-0.5" dir="ltr">
                    <SensitiveValue>{formatMoney(pieTotal, currency, 0)}</SensitiveValue>
                  </strong>
                  <span className="text-[10px] text-slate-400 mt-0.5">{currency}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Interactive Breakdown Legend */}
        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
          {allocation.map((item, index) => {
            const pct = pieTotal > 0 ? ((item.value / pieTotal) * 100).toFixed(1) : "0.0";
            const isHovered = hoveredIndex === index;
            return (
              <div
                key={item.name}
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
                className={`flex items-center justify-between py-1.5 px-2 rounded-lg transition-colors cursor-pointer ${
                  isHovered ? "bg-slate-100/80 dark:bg-slate-800/60" : "hover:bg-slate-50 dark:hover:bg-slate-800/30"
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="size-2.5 rounded-full shrink-0 ring-1 ring-black/10 dark:ring-white/20"
                    style={{ background: item.color }}
                  />
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate">
                    {item.name}
                  </span>
                </div>
                <div className="flex items-center gap-3 shrink-0" dir="ltr">
                  <span className="text-xs font-mono font-bold text-slate-500 dark:text-slate-400">
                    {pct}%
                  </span>
                  <span className="text-xs font-bold font-mono text-slate-900 dark:text-white tabular-nums tracking-tight">
                    <SensitiveValue>{formatMoney(item.value, currency, 0)}</SensitiveValue>
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </article>

      {/* 2. Flow Chart: الدخل مقابل المصروفات */}
      <article className="bg-white dark:bg-[#0B1222] border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.06)] dark:shadow-none flex flex-col justify-between h-full text-slate-900 dark:text-slate-100">
        <div>
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
            <div>
              <h2 className="text-slate-900 dark:text-white font-bold text-base">
                الدخل مقابل المصروفات
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                مقارنة الإيرادات والنفقات النقدية الدورية
              </p>
            </div>
            {hasCashFlowData && (
              <button
                type="button"
                onClick={onShowLedger}
                className="text-xs font-semibold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors cursor-pointer"
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
              <div className="h-full flex flex-col items-center justify-center p-6 text-center rounded-xl bg-slate-50/70 dark:bg-[#0E1420]/70 border border-dashed border-slate-200 dark:border-slate-800">
                <div className="size-11 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/60 flex items-center justify-center mb-3">
                  <Plus className="size-5" />
                </div>
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  بانتظار تسجيل حركات الدخل والمصروفات
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mt-1 leading-relaxed font-medium">
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
