import { Button } from "@/components/ui/button";
import SensitiveValue from "@/components/SensitiveValue";
import { formatMoney } from "@/lib/financialDisplay";
import { Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowLeftRight, BarChart3, Plus } from "lucide-react";

type AllocationItem = { name: string; value: number; color: string };
type CashFlowItem = { month: string; income: number; expense: number };

function ChartTooltip({ active, payload, label, currency }: { active?: boolean; payload?: Array<{ value: number; name: string; color: string }>; label?: string; currency: string }) { if (!active || !payload?.length) return null; return <div className="fintech-chart-tooltip"><p>{label || "تفاصيل"}</p>{payload.map(item => <div key={item.name}><span style={{ background: item.color }} /><b>{item.name}</b><strong><SensitiveValue>{formatMoney(item.value, currency, 0)}</SensitiveValue></strong></div>)}</div>; }

export default function FintechCharts({ allocation, cashFlow, currency, usingDemo, onShowLedger }: { allocation: AllocationItem[]; cashFlow: CashFlowItem[]; currency: string; usingDemo: boolean; onShowLedger: () => void }) {
  const pieTotal = allocation.reduce((sum, item) => sum + item.value, 0);
  return (
    <section className="fintech-content-grid">
      <article className="fintech-panel fintech-allocation-panel">
        <div className="fintech-panel-heading">
          <div>
            <p className="fintech-overline">توزيع الثروة</p>
            <h2>مواقع القيمة المقيمة</h2>
          </div>
          <span className="fintech-count-pill">{allocation.length} مكوّنات</span>
        </div>
        <div className="fintech-pie-wrap">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={allocation} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={68} outerRadius={96} paddingAngle={4} stroke="transparent">
                {allocation.map(item => <Cell key={item.name} fill={item.color} />)}
              </Pie>
              <Tooltip content={<ChartTooltip currency={currency} />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="fintech-pie-centre">
            <small>إجمالي مقيم</small>
            <strong><SensitiveValue>{formatMoney(pieTotal, currency, 0)}</SensitiveValue></strong>
          </div>
        </div>
        <div className="fintech-legend">
          {allocation.slice(0, 4).map(item => (
            <div key={item.name}>
              <span style={{ background: item.color }} />
              <p>{item.name}</p>
              <strong>{pieTotal ? Math.round((item.value / pieTotal) * 100) : 0}%</strong>
            </div>
          ))}
        </div>
      </article>

      <article className="fintech-panel fintech-flow-panel">
        <div className="fintech-panel-heading">
          <div>
            <p className="fintech-overline">الاتجاه النقدي</p>
            <h2>الدخل مقابل المصروفات</h2>
          </div>
          {usingDemo ? (
            <span className="fintech-live-chip"><span />عرض 6 أشهر</span>
          ) : (
            <span className="fintech-count-pill">بانتظار بيانات التدفق</span>
          )}
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
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 11 }} tickFormatter={value => `${Math.round(value / 1000)}K`} />
                <Tooltip content={<ChartTooltip currency={currency} />} />
                <Area type="monotone" dataKey="income" name="الدخل" stroke="#11a889" strokeWidth={3} fill="url(#incomeGradient)" />
                <Area type="monotone" dataKey="expense" name="المصروفات" stroke="#e46b7a" strokeWidth={3} fill="url(#expenseGradient)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full min-h-[220px] flex-col items-center justify-center rounded-2xl border border-dashed border-border/70 bg-muted/20 p-6 text-center">
              <div className="w-12 h-12 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700 text-slate-400 flex items-center justify-center mx-auto mb-3">
                <BarChart3 className="size-5" />
              </div>
              <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                لا توجد تدفقات دخل أو مصروفات مسجلة لهذه الفترة
              </p>
              <p className="mt-1 max-w-xs text-[11px] leading-relaxed text-slate-600 dark:text-slate-400 font-medium">
                تظهر اتجاهات التدفق ومقارنة الدخل والمصروفات تلقائيًا بمجرد تسجيل العمليات النقدية.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={onShowLedger}
                className="mt-3.5 h-8 gap-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 dark:text-slate-200 border-border/80"
              >
                <Plus className="size-3.5" />
                تسجيل تدفق
              </Button>
            </div>
          )}
        </div>
      </article>
    </section>
  );
}

