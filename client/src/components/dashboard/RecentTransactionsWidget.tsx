"use client";

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  Search,
  ChevronLeft,
  TrendingUp,
  Receipt,
} from "lucide-react";
import { formatMoney } from "@/lib/financialDisplay";
import { useLocation } from "wouter";

interface TransactionEvent {
  id: string;
  title: string;
  badge: string;
  amount: number | string;
  currency: string;
  date: string;
  isOutflow: boolean;
  isTransfer?: boolean;
}

interface RecentTransactionsWidgetProps {
  events: TransactionEvent[];
  currency: string;
}

export function RecentTransactionsWidget({ events, currency }: RecentTransactionsWidgetProps) {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");

  const filtered = events.filter((ev) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return ev.title.toLowerCase().includes(q) || ev.badge.toLowerCase().includes(q);
  });

  return (
    <Card className="border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#18181b] shadow-xs rounded-xl">
      <CardHeader className="flex flex-col gap-3 space-y-0 pb-3 sm:flex-row sm:items-center sm:justify-between border-b border-zinc-200 dark:border-zinc-800">
        <div>
          <CardTitle className="text-base font-bold text-zinc-950 dark:text-zinc-50">
            آخر العمليات والقيود المسجلة
          </CardTitle>
          <CardDescription className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            سجل العمليات المصرفية والاستثمارية الحديثة
          </CardDescription>
        </div>

        <div className="flex items-center gap-2">
          {/* Quick Search */}
          <div className="relative w-full sm:w-48">
            <Search className="absolute right-2.5 top-2.5 size-3.5 text-zinc-400 pointer-events-none" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="تصفية العمليات..."
              className="h-8 pr-8 text-xs bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-950 dark:text-zinc-50 placeholder:text-zinc-400 focus:border-zinc-400 dark:focus:border-zinc-700"
            />
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setLocation("/transactions")}
            className="h-8 gap-1 text-xs shrink-0 font-bold border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#18181b] hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-200 hover:text-zinc-950 dark:hover:text-white"
          >
            <span>عرض الكل</span>
            <ChevronLeft className="size-3.5" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="pt-2">
        {filtered.length === 0 ? (
          <div className="py-8 text-center text-xs text-zinc-500 dark:text-zinc-400">
            لا توجد عمليات تطابق البحث
          </div>
        ) : (
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
            {filtered.slice(0, 7).map((tx) => {
              const amountNum = Math.abs(Number(tx.amount));
              return (
                <div
                  key={tx.id}
                  className="flex items-center justify-between py-3 px-1 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/40 rounded-lg group"
                >
                  {/* Entity / Details */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`size-9 rounded-xl flex items-center justify-center shrink-0 border ${
                        tx.isTransfer
                          ? "bg-sky-50 dark:bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-200 dark:border-sky-500/30"
                          : tx.isOutflow
                            ? "bg-rose-50 dark:bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-500/30"
                            : "bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30"
                      }`}
                    >
                      {tx.isTransfer ? (
                        <ArrowLeftRight className="size-4" />
                      ) : tx.isOutflow ? (
                        <ArrowUpRight className="size-4" />
                      ) : (
                        <ArrowDownLeft className="size-4" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-zinc-950 dark:text-zinc-50 truncate group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                        {tx.title}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge
                          variant="secondary"
                          className="h-4 px-1.5 text-[9px] font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700"
                        >
                          {tx.badge}
                        </Badge>
                        <span className="text-[10px] text-zinc-500 dark:text-zinc-400">
                          {tx.date}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Amount with colored prefix */}
                  <div className="text-start shrink-0">
                    <span
                      className={`text-xs font-extrabold tabular-nums font-mono ${
                        tx.isOutflow
                          ? "text-rose-600 dark:text-rose-400"
                          : "text-emerald-600 dark:text-emerald-400"
                      }`}
                    >
                      {tx.isOutflow ? "- " : "+ "}
                      {formatMoney(amountNum, tx.currency || currency)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
