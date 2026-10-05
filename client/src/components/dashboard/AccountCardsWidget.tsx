"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CreditCard, Landmark, Wallet, Plus, ChevronLeft, ShieldCheck, ArrowUpRight } from "lucide-react";
import { formatMoney } from "@/lib/financialDisplay";
import { useLocation } from "wouter";

export interface AccountItem {
  readonly id: string;
  readonly name: string;
  readonly value: number;
  readonly currency: string;
  readonly kind?: string;
}

export interface DebtItem {
  readonly id: string;
  readonly name: string;
  readonly outstanding: number | string;
  readonly currency: string;
  readonly payment?: number | string;
  readonly rate?: string;
}

interface AccountCardsWidgetProps {
  accounts: readonly AccountItem[];
  debts: readonly DebtItem[];
  currency: string;
  onOpenReconcile?: (account: any) => void;
  onOpenDebtPayment?: (debtId?: number) => void;
}

export function AccountCardsWidget({
  accounts,
  debts,
  currency,
  onOpenReconcile,
  onOpenDebtPayment,
}: AccountCardsWidgetProps) {
  const [, setLocation] = useLocation();

  // Pick top 2 bank accounts and 1 card/debt to showcase with visual card styling
  const primaryAccounts = accounts.slice(0, 3);
  const primaryDebts = debts.slice(0, 2);

  const cardThemes = [
    {
      bg: "from-zinc-900 via-zinc-900 to-black text-white border-zinc-700/80 shadow-md",
      chip: "bg-amber-400/80 border-amber-300",
      accent: "text-emerald-400",
    },
    {
      bg: "from-emerald-950 via-teal-950 to-zinc-950 text-white border-emerald-700/40 shadow-md",
      chip: "bg-amber-300/80 border-amber-200",
      accent: "text-teal-300",
    },
    {
      bg: "from-zinc-900 via-slate-900 to-black text-white border-zinc-700/60 shadow-md",
      chip: "bg-amber-400/80 border-amber-300",
      accent: "text-sky-300",
    },
  ];

  return (
    <Card className="border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#18181b] shadow-xs rounded-xl">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 border-b border-border">
        <div>
          <CardTitle className="text-base font-bold text-foreground">
            الحسابات والبطاقات النشطة
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground mt-1">
            {accounts.length} حسابات مصرفية ونقدية متصلة
          </CardDescription>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setLocation("/banking")}
          className="h-8 gap-1 text-xs text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 hover:bg-muted font-bold cursor-pointer"
        >
          <span>إدارة</span>
          <ChevronLeft className="size-3.5" />
        </Button>
      </CardHeader>

      <CardContent className="pt-4 space-y-3">
        {/* Render Primary Bank Card in Modern High-End Visual Card Style */}
        {primaryAccounts[0] && (
          <div
            className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${cardThemes[0].bg} p-4 border transition-all duration-300 hover:scale-[1.01]`}
            dir="ltr"
          >
            {/* Background watermark */}
            <div className="absolute -right-6 -bottom-6 opacity-10 pointer-events-none">
              <Landmark className="size-32 text-zinc-400" />
            </div>

            {/* Top row: Chip and Bank Name */}
            <div className="flex items-center justify-between relative z-10 mb-4">
              <div className="flex items-center gap-2">
                {/* Chip */}
                <div className={`w-8 h-6 rounded-md ${cardThemes[0].chip} border shadow-xs relative overflow-hidden flex items-center justify-center`}>
                  <div className="w-full h-px bg-slate-900/30" />
                </div>
                {/* Contactless waves icon */}
                <div className="flex gap-0.5 items-center opacity-70">
                  <span className="size-1 rounded-full bg-white" />
                  <span className="w-1.5 h-2.5 border-r border-white rounded-r-full" />
                  <span className="w-1.5 h-3.5 border-r border-white rounded-r-full" />
                </div>
              </div>
              <span className="text-xs font-bold tracking-wider uppercase text-zinc-300 font-sans">
                {primaryAccounts[0].kind === "wallet" ? "E-WALLET" : "PREMIER DEBIT"}
              </span>
            </div>

            {/* Account Number Masked */}
            <p className="font-mono text-sm tracking-widest text-zinc-300 mb-2 relative z-10">
              •••• •••• •••• {String(primaryAccounts[0].id).slice(-4).padStart(4, "0")}
            </p>

            {/* Bottom Row: Name & Balance */}
            <div className="flex items-end justify-between relative z-10">
              <div>
                <span className="block text-[10px] text-zinc-400 font-medium">اسم الحساب</span>
                <span className="text-xs font-bold text-white truncate max-w-[140px] block" dir="rtl">
                  {primaryAccounts[0].name}
                </span>
              </div>
              <div className="text-right">
                <span className="block text-[10px] text-zinc-400 font-medium">الرصيد الدفتري</span>
                <span className="text-base font-extrabold text-emerald-400 tabular-nums font-mono">
                  {formatMoney(primaryAccounts[0].value, primaryAccounts[0].currency || currency)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Secondary Account Quick Rows */}
        <div className="space-y-1.5 pt-1">
          {primaryAccounts.slice(1, 3).map((acc) => (
            <div
              key={acc.id}
              onClick={() => onOpenReconcile?.(acc)}
              className="flex items-center justify-between p-2.5 rounded-xl border border-border bg-muted/40 hover:bg-muted transition-all cursor-pointer group"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="size-8 rounded-lg bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-200 dark:border-emerald-500/30">
                  {acc.kind === "wallet" ? <Wallet className="size-4" /> : <Landmark className="size-4" />}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-foreground truncate group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                    {acc.name}
                  </p>
                  <p className="text-[10px] text-muted-foreground font-mono">
                    {acc.kind === "wallet" ? "محفظة رقمية" : "حساب بنكي"} · {acc.currency || currency}
                  </p>
                </div>
              </div>
              <div className="text-start">
                <p className="text-xs font-bold tabular-nums text-foreground">
                  {formatMoney(acc.value, acc.currency || currency)}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Liabilities / Credit Card Summary Mini-Banner */}
        {primaryDebts.length > 0 && (
          <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800">
            <div className="flex items-center justify-between p-2.5 rounded-xl border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-950/20">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="size-8 rounded-lg bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0 border border-rose-200 dark:border-rose-500/30">
                  <CreditCard className="size-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-zinc-950 dark:text-zinc-50 truncate">
                    {primaryDebts[0].name}
                  </p>
                  <p className="text-[10px] text-rose-600 dark:text-rose-400 font-semibold">
                    مديونية مستحقة
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-extrabold tabular-nums text-rose-600 dark:text-rose-400">
                  {formatMoney(Number(primaryDebts[0].outstanding), primaryDebts[0].currency || currency)}
                </span>
                {onOpenDebtPayment && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-[11px] px-2.5 border-rose-200 dark:border-rose-500/40 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-500/20 bg-white dark:bg-rose-950/40 font-bold"
                    onClick={() => onOpenDebtPayment(Number(primaryDebts[0].id))}
                  >
                    سداد
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
