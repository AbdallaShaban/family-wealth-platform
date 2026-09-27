"use client";

import React, { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowDownLeft, ArrowUpRight, TrendingUp } from "lucide-react";
import { formatMoney } from "@/lib/financialDisplay";

interface MoneyMovementProps {
  currency: string;
  totalIncome?: number;
  totalExpense?: number;
}

export function MoneyMovementCard({ currency, totalIncome = 13248, totalExpense = 10130 }: MoneyMovementProps) {
  const [period, setPeriod] = useState<"7d" | "30d" | "90d">("30d");

  const data = useMemo(() => {
    if (period === "7d") {
      return [
        { label: "السبت", moneyIn: 2500, moneyOut: 800 },
        { label: "الأحد", moneyIn: 1200, moneyOut: 1900 },
        { label: "الاثنين", moneyIn: 3400, moneyOut: 1100 },
        { label: "الثلاثاء", moneyIn: 800, moneyOut: 1500 },
        { label: "الأربعاء", moneyIn: 5010, moneyOut: 2868 },
        { label: "الخميس", moneyIn: 8238, moneyOut: 3262 },
        { label: "الجمعة", moneyIn: 0, moneyOut: 400 },
      ];
    }
    if (period === "30d") {
      return [
        { label: "الأسبوع 1", moneyIn: 8500, moneyOut: 4200 },
        { label: "الأسبوع 2", moneyIn: 12000, moneyOut: 7800 },
        { label: "الأسبوع 3", moneyIn: 15400, moneyOut: 9100 },
        { label: "الأسبوع 4", moneyIn: 13248, moneyOut: 10130 },
      ];
    }
    return [
      { label: "الشهر 1", moneyIn: 38000, moneyOut: 24000 },
      { label: "الشهر 2", moneyIn: 45000, moneyOut: 29000 },
      { label: "الشهر 3", moneyIn: 49148, moneyOut: 31230 },
    ];
  }, [period]);

  const totals = useMemo(() => {
    const inTotal = data.reduce((s, d) => s + d.moneyIn, 0);
    const outTotal = data.reduce((s, d) => s + d.moneyOut, 0);
    return { in: inTotal, out: outTotal, net: inTotal - outTotal };
  }, [data]);

  return (
    <Card className="border border-border/60 bg-card/60 backdrop-blur-md shadow-xs">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 border-b border-border/40">
        <div>
          <CardTitle className="text-base font-bold text-foreground">
            حركة السيولة والتدفقات
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground mt-0.5">
            مقارنة التدفقات النقدية الداخلة والخارجة
          </CardDescription>
        </div>

        {/* Period Selector */}
        <div className="flex items-center gap-1 bg-muted/60 p-0.5 rounded-lg border border-border/40">
          <button
            onClick={() => setPeriod("7d")}
            className={`px-2 py-0.5 text-xs font-medium rounded-md transition-all ${
              period === "7d"
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            7 أيام
          </button>
          <button
            onClick={() => setPeriod("30d")}
            className={`px-2 py-0.5 text-xs font-medium rounded-md transition-all ${
              period === "30d"
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            30 يوم
          </button>
          <button
            onClick={() => setPeriod("90d")}
            className={`px-2 py-0.5 text-xs font-medium rounded-md transition-all ${
              period === "90d"
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            90 يوم
          </button>
        </div>
      </CardHeader>

      <CardContent className="pt-4 space-y-4">
        {/* KPI Mini-Cards */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-2.5">
            <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 shrink-0">
              <ArrowDownLeft className="size-4" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-medium text-emerald-700/80 dark:text-emerald-400/80">الوارد (Money In)</p>
              <p className="text-sm font-bold tabular-nums text-emerald-700 dark:text-emerald-300 truncate">
                {formatMoney(totals.in, currency)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-xl bg-rose-500/10 border border-rose-500/20 p-2.5">
            <div className="flex size-8 items-center justify-center rounded-lg bg-rose-500/20 text-rose-600 dark:text-rose-400 shrink-0">
              <ArrowUpRight className="size-4" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-medium text-rose-700/80 dark:text-rose-400/80">المنصرف (Money Out)</p>
              <p className="text-sm font-bold tabular-nums text-rose-700 dark:text-rose-300 truncate">
                {formatMoney(totals.out, currency)}
              </p>
            </div>
          </div>
        </div>

        {/* Net Flow Pill */}
        <div className="flex items-center justify-between rounded-lg border border-border/50 bg-muted/30 px-3 py-1.5 text-xs">
          <span className="text-muted-foreground font-medium">صافي التدفق المالي (Net Flow):</span>
          <span className={`font-bold tabular-nums ${totals.net >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
            {totals.net >= 0 ? "+" : ""}{formatMoney(totals.net, currency)}
          </span>
        </div>

        {/* Bar Chart */}
        <div className="h-[140px] w-full" dir="ltr">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }} barGap={3}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-border/40" />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                fontSize={10}
                tickMargin={4}
                stroke="currentColor"
                className="text-muted-foreground font-sans"
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                fontSize={9}
                tickMargin={4}
                stroke="currentColor"
                className="text-muted-foreground font-sans"
                tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="rounded-lg border border-border bg-popover/95 p-2 shadow-xl text-xs backdrop-blur-md" dir="rtl">
                        <p className="font-bold text-foreground mb-1">{label}</p>
                        <p className="text-emerald-600 dark:text-emerald-400 font-semibold">
                          الوارد: {formatMoney(Number(payload[0]?.value), currency)}
                        </p>
                        <p className="text-rose-600 dark:text-rose-400 font-semibold">
                          المنصرف: {formatMoney(Number(payload[1]?.value), currency)}
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar dataKey="moneyIn" fill="#10B981" radius={[4, 4, 0, 0]} maxBarSize={18} />
              <Bar dataKey="moneyOut" fill="#F43F5E" radius={[4, 4, 0, 0]} maxBarSize={18} opacity={0.8} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
