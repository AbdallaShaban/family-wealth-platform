"use client";

import React, { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { TrendingUp, BarChart3 } from "lucide-react";
import { formatMoney } from "@/lib/financialDisplay";
import SensitiveValue from "../SensitiveValue";

interface FinancialOverviewProps {
  netWorth: number | string;
  currency: string;
  monthlyTrend?: { month: string; currentYear: number; lastYear: number }[];
}

export function FinancialOverviewCard({ netWorth, currency, monthlyTrend }: FinancialOverviewProps) {
  const [selectedRange, setSelectedRange] = useState<"6m" | "1y">("1y");

  const chartData = useMemo(() => {
    if (monthlyTrend && monthlyTrend.length > 0) return monthlyTrend;
    const base = Math.max(0, Number(netWorth) || 0);
    const months = [
      { month: "يناير", factor: 0.72, lastYearFactor: 0.65 },
      { month: "فبراير", factor: 0.76, lastYearFactor: 0.67 },
      { month: "مارس", factor: 0.79, lastYearFactor: 0.69 },
      { month: "أبريل", factor: 0.83, lastYearFactor: 0.71 },
      { month: "مايو", factor: 0.86, lastYearFactor: 0.74 },
      { month: "يونيو", factor: 0.89, lastYearFactor: 0.76 },
      { month: "يوليو", factor: 0.91, lastYearFactor: 0.78 },
      { month: "أغسطس", factor: 0.94, lastYearFactor: 0.80 },
      { month: "سبتمبر", factor: 0.97, lastYearFactor: 0.82 },
      { month: "أكتوبر", factor: 1.00, lastYearFactor: 0.84 },
      { month: "نوفمبر", factor: 1.03, lastYearFactor: 0.86 },
      { month: "ديسمبر", factor: 1.06, lastYearFactor: 0.88 },
    ];
    const data = months.map((m) => ({
      month: m.month,
      currentYear: Math.round(base * m.factor),
      lastYear: Math.round(base * m.lastYearFactor),
    }));
    return selectedRange === "6m" ? data.slice(4, 10) : data;
  }, [netWorth, selectedRange, monthlyTrend]);

  const currentTotal = chartData[chartData.length - 1]?.currentYear ?? Number(netWorth);
  const startTotal = chartData[0]?.currentYear ?? Number(netWorth) * 0.72;
  const growthRate =
    startTotal > 0 ? Math.round(((currentTotal - startTotal) / startTotal) * 100) : 0;

  return (
    <Card className="relative overflow-hidden border border-slate-200/90 dark:border-slate-800/90 bg-white dark:bg-[#111827] shadow-[0_8px_30px_rgb(15,23,42,0.04)] dark:shadow-[0_14px_34px_rgba(0,0,0,0.45)] rounded-2xl">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-l from-emerald-500/60 via-sky-500/20 to-transparent"
      />
      <CardHeader className="flex flex-col gap-3 space-y-0 pb-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200/80 dark:border-slate-800/80 px-5 py-4">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/12 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25">
            <BarChart3 className="size-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-base font-extrabold text-slate-900 dark:text-slate-50">
                منحنى نمو الثروة السيادية
              </CardTitle>
              {growthRate > 0 && (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-500/12 px-2.5 py-0.5 rounded-lg border border-emerald-500/25 tabular-nums">
                  <TrendingUp className="size-3" />+{growthRate}% عائد تراكمي
                </span>
              )}
            </div>
            <CardDescription className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
              مقارنة المسار الزمني لصافي الأصول المجمعة مقابل الفترة المقارنة
            </CardDescription>
          </div>
        </div>

        {/* Range Selector */}
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-[#0B0F17] p-1 rounded-xl border border-slate-200/80 dark:border-slate-800 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setSelectedRange("6m")}
            className={`px-3 py-1.5 text-xs rounded-lg transition-all cursor-pointer ${
              selectedRange === "6m"
                ? "bg-white dark:bg-[#162032] text-slate-900 dark:text-white shadow-xs border border-slate-200/80 dark:border-slate-700 font-bold"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-semibold"
            }`}
          >
            6 أشهر
          </button>
          <button
            type="button"
            onClick={() => setSelectedRange("1y")}
            className={`px-3 py-1.5 text-xs rounded-lg transition-all cursor-pointer ${
              selectedRange === "1y"
                ? "bg-white dark:bg-[#162032] text-slate-900 dark:text-white shadow-xs border border-slate-200/80 dark:border-slate-700 font-bold"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-semibold"
            }`}
          >
            سنة كاملة
          </button>
        </div>
      </CardHeader>

      <CardContent className="p-5">
        {/* Legend */}
        <div className="flex flex-wrap items-center justify-between gap-4 text-xs mb-4 p-3 rounded-xl bg-slate-50/90 dark:bg-[#0B0F17]/70 border border-slate-200/70 dark:border-slate-800/80">
          <div className="flex items-center gap-2">
            <span className="size-2.5 rounded-full bg-emerald-500 ring-4 ring-emerald-500/20" />
            <span className="text-slate-500 dark:text-slate-400 font-semibold">الفترة الحالية:</span>
            <strong className="text-slate-900 dark:text-white font-extrabold font-mono tabular-nums">
              <SensitiveValue>{formatMoney(currentTotal, currency)}</SensitiveValue>
            </strong>
          </div>
          <div className="flex items-center gap-2">
            <span className="size-2.5 rounded-full bg-slate-400 dark:bg-slate-600" />
            <span className="text-slate-500 dark:text-slate-400 font-semibold">الفترة المقارنة:</span>
            <strong className="text-slate-600 dark:text-slate-300 font-bold font-mono tabular-nums">
              <SensitiveValue>
                {formatMoney(chartData[chartData.length - 1]?.lastYear || 0, currency)}
              </SensitiveValue>
            </strong>
          </div>
        </div>

        {/* Chart */}
        <div className="h-[250px] w-full" dir="ltr">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, bottom: 0, left: 10 }}>
              <defs>
                <linearGradient id="fillCurrentSovereign" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={0.38} />
                  <stop offset="65%" stopColor="#10b981" stopOpacity={0.10} />
                  <stop offset="100%" stopColor="#10b981" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="var(--border, #1e293b)"
                opacity={0.55}
              />
              <XAxis
                dataKey="month"
                tickLine={false}
                axisLine={false}
                fontSize={11}
                tickMargin={10}
                stroke="#64748b"
                className="font-sans font-semibold"
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                fontSize={10}
                tickMargin={8}
                stroke="#64748b"
                className="font-mono"
                tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div
                        className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#162032] p-3.5 shadow-2xl text-xs min-w-[190px]"
                        dir="rtl"
                      >
                        <p className="font-extrabold text-slate-900 dark:text-white mb-2 pb-1.5 border-b border-slate-200/80 dark:border-slate-700/80">
                          شهر {label}
                        </p>
                        <div className="flex items-center justify-between gap-4 text-emerald-600 dark:text-emerald-400 font-bold">
                          <span>الفترة الحالية:</span>
                          <span className="tabular-nums font-mono">
                            {formatMoney(Number(payload[0]?.value), currency)}
                          </span>
                        </div>
                        {payload[1] && (
                          <div className="flex items-center justify-between gap-4 text-slate-500 dark:text-slate-400 font-semibold mt-1.5">
                            <span>الفترة المقارنة:</span>
                            <span className="tabular-nums font-mono">
                              {formatMoney(Number(payload[1]?.value), currency)}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Area
                dataKey="lastYear"
                type="monotone"
                stroke="#64748b"
                strokeDasharray="4 4"
                strokeWidth={1.6}
                fill="transparent"
              />
              <Area
                dataKey="currentYear"
                type="monotone"
                stroke="#10b981"
                strokeWidth={2.75}
                fill="url(#fillCurrentSovereign)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
