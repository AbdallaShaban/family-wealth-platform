import React, { useEffect, useState, useMemo, useCallback } from "react";
import { useLocation } from "wouter";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { formatMoney } from "@/lib/financialDisplay";
import {
  LayoutDashboard,
  ShieldCheck,
  FileChartColumn,
  Landmark,
  ArrowLeftRight,
  WalletCards,
  CreditCard,
  TrendingUp,
  Coins,
  Sparkles,
  BarChart3,
  PieChart,
  ShieldAlert,
  FileLock2,
  BookOpenCheck,
  UsersRound,
  FileSpreadsheet,
  Receipt,
  Scale,
  UploadCloud,
  FileText,
  PlusCircle,
  Banknote,
  CheckCircle2,
  Loader2,
  Search,
  ArrowUpRight,
  ArrowDownLeft,
  Wallet,
  BellRing,
} from "lucide-react";

// ==========================================
// 20 Platform Pages & Sections Registry
// ==========================================
interface NavigationRoute {
  id: string;
  label: string;
  category: string;
  path: string;
  icon: React.ElementType;
  keywords: string[];
}

const ALL_20_PLATFORM_ROUTES: NavigationRoute[] = [
  // 1. Overview & Net Worth (3 sections)
  {
    id: "nav-overview",
    label: "النظرة التنفيذية وصافي الثروة",
    category: "المركز المالي وصافي الثروة",
    path: "/",
    icon: LayoutDashboard,
    keywords: ["رئيسية", "نظرة عامة", "ثروة", "داشبورد", "dashboard", "overview", "net worth", "صافي الثروة"],
  },
  {
    id: "nav-wealth-health",
    label: "صحة الثروة ومؤشر درع التضخم",
    category: "المركز المالي وصافي الثروة",
    path: "/wealth-health",
    icon: ShieldCheck,
    keywords: ["تضخم", "درع", "صحة", "مؤشر", "inflation", "shield", "health", "مخاطر"],
  },
  {
    id: "nav-reports",
    label: "القوائم المالية والميزانية المجمعة",
    category: "المركز المالي وصافي الثروة",
    path: "/reports",
    icon: FileChartColumn,
    keywords: ["تقارير", "ميزانية", "ارباح وخسائر", "تدفقات", "قوائم", "reports", "budget", "financial statements"],
  },

  // 2. Banking & Liquidity (7 sections)
  {
    id: "nav-banking",
    label: "الحسابات المصرفية والمحافظ النقدية",
    category: "البنوك والسيولة والتدفقات",
    path: "/banking",
    icon: Landmark,
    keywords: ["بنوك", "حسابات", "محافظ", "كاش", "بنك", "banks", "accounts", "cib", "nbe", "تيلدا", "instapay"],
  },
  {
    id: "nav-transactions",
    label: "سجل المعاملات والعمليات المالية",
    category: "البنوك والسيولة والتدفقات",
    path: "/transactions",
    icon: ArrowLeftRight,
    keywords: ["عمليات", "حركات", "معاملات", "قيود", "تحويلات", "transactions", "ledger", "دفتر الأستاذ"],
  },
  {
    id: "nav-certificates",
    label: "الشهادات والودائع البنكية الادخارية",
    category: "البنوك والسيولة والتدفقات",
    path: "/banking?tab=certificates",
    icon: FileSpreadsheet,
    keywords: ["شهادات", "ودائع", "عائد", "فوائد", "certificates", "deposits", "شهادة ادخار"],
  },
  {
    id: "nav-liquidity",
    label: "السيولة والتخطيط المالي والاحتياطي",
    category: "البنوك والسيولة والتدفقات",
    path: "/banking?tab=liquidity",
    icon: WalletCards,
    keywords: ["سيولة", "طوارئ", "احتياطي", "تخطيط", "liquidity", "cashflow", "صندوق طوارئ"],
  },
  {
    id: "nav-debts",
    label: "الالتزامات والديون والبطاقات الائتمانية",
    category: "البنوك والسيولة والتدفقات",
    path: "/banking?tab=debts",
    icon: CreditCard,
    keywords: ["ديون", "قروض", "فيزا", "كروت", "اقساط", "debts", "loans", "cards", "مديونية"],
  },
  {
    id: "nav-reconciliation",
    label: "تسوية الحسابات البنكية والمطابقة",
    category: "البنوك والسيولة والتدفقات",
    path: "/reconciliation",
    icon: Scale,
    keywords: ["تسوية", "تطابق", "مطابقة", "تدقيق ارصدة", "reconciliation", "فروقات"],
  },
  {
    id: "nav-imports",
    label: "استيراد كشوف الحسابات ورسائل SMS",
    category: "البنوك والسيولة والتدفقات",
    path: "/imports",
    icon: UploadCloud,
    keywords: ["استيراد", "رسائل", "sms", "كشف حساب", "csv", "import", "بنك مصر", "اهلي"],
  },

  // 3. Investments, Gold & Markets (5 sections)
  {
    id: "nav-investments",
    label: "الأصول والمحفظة الاستثمارية",
    category: "المحافظ وأسواق المال والذهب",
    path: "/investments",
    icon: TrendingUp,
    keywords: ["محفظة", "اسهم", "استثمار", "اصول", "portfolio", "investments", "سوق المال"],
  },
  {
    id: "nav-gold",
    label: "أسعار الذهب والسبائك بالعيارات (لحظي)",
    category: "المحافظ وأسواق المال والذهب",
    path: "/investments?tab=instruments",
    icon: Coins,
    keywords: ["ذهب", "سبائك", "عيار 24", "عيار 21", "عيار 18", "جنيه ذهب", "gold", "bullion", "btc", "سبيكة"],
  },
  {
    id: "nav-quant",
    label: "تداول الأسهم والإشارات الكمية (EGX)",
    category: "المحافظ وأسواق المال والذهب",
    path: "/quant",
    icon: Sparkles,
    keywords: ["تداول", "بورصة", "ايجي اكس", "egx", "مؤشرات", "quant", "signals", "توصيات"],
  },
  {
    id: "nav-realized",
    label: "الأداء والأرباح المحققة (FIFO)",
    category: "المحافظ وأسواق المال والذهب",
    path: "/investments?tab=realized",
    icon: BarChart3,
    keywords: ["ارباح", "خسائر", "أداء", "فيفو", "fifo", "realized", "pnl", "صفقات مغلقة"],
  },
  {
    id: "nav-allocation",
    label: "التوزيع الجغرافي وتنويع المخاطر",
    category: "المحافظ وأسواق المال والذهب",
    path: "/investments?tab=allocation",
    icon: PieChart,
    keywords: ["توزيع", "تنويع", "مخاطر", "قطاعات", "allocation", "risk", "أصول"],
  },

  // 4. Governance, Zakat & Vault (5 sections)
  {
    id: "nav-zakat",
    label: "حاسبة الزكاة الشرعية وحول الذهب",
    category: "الحوكمة وإدارة المخاطر والزكاة",
    path: "/governance?tab=zakat",
    icon: Receipt,
    keywords: ["زكاة", "شرعية", "حول", "نصاب", "حاسبة الزكاة", "zakat", "85 جرام عيار 24"],
  },
  {
    id: "nav-stress-testing",
    label: "اختبارات الهبوط والضغط (Stress Testing)",
    category: "الحوكمة وإدارة المخاطر والزكاة",
    path: "/stress-testing",
    icon: ShieldAlert,
    keywords: ["هبوط", "صدمات", "ضغط", "سيناريوهات", "stress", "testing", "ازمات"],
  },
  {
    id: "nav-vault",
    label: "الخزنة المشفرة والمستندات السرية",
    category: "الحوكمة وإدارة المخاطر والزكاة",
    path: "/governance?tab=vault",
    icon: FileLock2,
    keywords: ["خزنة", "تشفير", "عقود", "مستندات", "ملفات", "vault", "docs", "أمان"],
  },
  {
    id: "nav-audit",
    label: "سجل التدقيق المحاسبي والاعتمادات",
    category: "الحوكمة وإدارة المخاطر والزكاة",
    path: "/governance?tab=audit",
    icon: BookOpenCheck,
    keywords: ["تدقيق", "مراجعة", "اعتمادات", "سجل", "audit", "compliance", "مدقق"],
  },
  {
    id: "nav-members",
    label: "أفراد العائلة والصلاحيات والنسخ الاحتياطي",
    category: "الحوكمة وإدارة المخاطر والزكاة",
    path: "/governance?tab=members",
    icon: UsersRound,
    keywords: ["عائلة", "مستخدمين", "صلاحيات", "نسخ احتياطي", "members", "backup", "ادمن"],
  },
  {
    id: "nav-telegram-alerts",
    label: "تنبيهات تيليجرام اللحظية والإشعارات الذكية",
    category: "الحوكمة وإدارة المخاطر والزكاة",
    path: "/governance?tab=alerts",
    icon: BellRing,
    keywords: ["تيليجرام", "تنبيهات", "اشعارات", "بوت", "رسائل", "telegram", "alerts", "bot"],
  },
];

type IntentType = "trade" | "deposit" | "expense" | "transfer";

interface ParsedIntent {
  type: IntentType;
  rawText: string;
  side?: "buy" | "sell";
  quantity?: number;
  symbol?: string;
  unitPrice?: number;
  grossAmount?: number;
  amount?: number;
  accountHint?: string;
  memo?: string;
}

export function OmniCommandBar({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isExecutingCommand, setIsExecutingCommand] = useState(false);
  const [confirmExecution, setConfirmExecution] = useState(false);

  // Debounce search input for server queries (200ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 200);
    return () => clearTimeout(timer);
  }, [search]);

  // Reset internal states on open/close
  useEffect(() => {
    if (!open) {
      setSearch("");
      setDebouncedSearch("");
      setConfirmExecution(false);
      setIsExecutingCommand(false);
    }
  }, [open]);

  // Data Queries
  const accountsQuery = trpc.family.accounts.list.useQuery(undefined, { enabled: open });
  const instrumentsQuery = trpc.family.instruments.list.useQuery(undefined, { enabled: open });
  const recentLedgerQuery = trpc.family.ledger.recent.useQuery(undefined, { enabled: open });
  const serverSearchQuery = trpc.family.search.omni.useQuery(
    { query: debouncedSearch },
    { enabled: open && debouncedSearch.length >= 2, staleTime: 10_000 }
  );

  // Mutations
  const exportPdfMutation = trpc.family.reports.exportExecutivePdf.useMutation();
  const postCashMutation = trpc.family.ledger.postCash.useMutation();
  const postTradeMutation = trpc.family.ledger.recordTrade.useMutation();

  const accounts = accountsQuery.data || [];
  const instruments = instrumentsQuery.data || [];
  const recentEvents = recentLedgerQuery.data || [];
  const serverResults = serverSearchQuery.data;

  // Natural Language Command Parser
  const parsedIntent = useMemo<ParsedIntent | null>(() => {
    const raw = search.trim();
    if (!raw) return null;

    // 1. Trade Match: e.g. "شراء 100 COMI @ 88.5" or "بيع 500 ISPH"
    const tradeRegex = /^(شراء|بيع|buy|sell)\s+(\d+(?:\.\d+)?)\s+([A-Za-z0-9_.\u0600-\u06FF]+)(?:\s*@\s*(\d+(?:\.\d+)?))?(?:\s+(?:حساب\s+)?([^\n@]+))?/i;
    const tradeMatch = raw.match(tradeRegex);
    if (tradeMatch) {
      const isBuy = tradeMatch[1] === "شراء" || tradeMatch[1].toLowerCase() === "buy";
      const quantity = parseFloat(tradeMatch[2]);
      const symbol = tradeMatch[3].trim().toUpperCase();
      const unitPrice = tradeMatch[4] ? parseFloat(tradeMatch[4]) : undefined;
      const accountHint = tradeMatch[5]?.trim();
      const grossAmount = unitPrice ? quantity * unitPrice : undefined;

      return {
        type: "trade",
        rawText: raw,
        side: isBuy ? "buy" : "sell",
        quantity,
        symbol,
        unitPrice,
        grossAmount,
        accountHint,
      };
    }

    // 2. Deposit Match: e.g. "ايداع 5000 تيلدا" or "دخل 15000 راتب"
    const depositRegex = /^(ايداع|إيداع|دخل|deposit|income)\s+(\d+(?:\.\d+)?)(?:\s+(?:في\s+|حساب\s+)?([^\n]+))?/i;
    const depositMatch = raw.match(depositRegex);
    if (depositMatch) {
      const amount = parseFloat(depositMatch[2]);
      const accountHint = depositMatch[3]?.trim();
      return {
        type: "deposit",
        rawText: raw,
        amount,
        accountHint,
        memo: `إيداع سريع: ${accountHint || "نقدي"}`,
      };
    }

    // 3. Expense Match: e.g. "صرف 450 بنزين" or "مصروف 1200 بقالة"
    const expenseRegex = /^(صرف|مصروف|سحب|شراء\s+مشتريات|expense|spend|withdraw)\s+(\d+(?:\.\d+)?)(?:\s+(?:من\s+|حساب\s+)?([^\n]+))?/i;
    const expenseMatch = raw.match(expenseRegex);
    if (expenseMatch) {
      const amount = parseFloat(expenseMatch[2]);
      const memo = expenseMatch[3]?.trim() || "مصروف سريع";
      return {
        type: "expense",
        rawText: raw,
        amount,
        memo,
      };
    }

    return null;
  }, [search]);

  // Matched target account and instrument for command execution
  const matchedAccount = useMemo(() => {
    if (!parsedIntent) return accounts[0] || null;
    const hint = parsedIntent.accountHint?.toLowerCase();
    if (!hint) return accounts[0] || null;

    const exact = accounts.find(
      (a) =>
        a.name.toLowerCase().includes(hint) ||
        (a.institution && a.institution.toLowerCase().includes(hint))
    );
    return exact || accounts[0] || null;
  }, [parsedIntent, accounts]);

  const matchedInstrument = useMemo(() => {
    if (!parsedIntent || parsedIntent.type !== "trade") return null;
    const sym = parsedIntent.symbol?.toLowerCase();
    if (!sym) return null;

    return (
      instruments.find(
        (i) =>
          (i.symbol && i.symbol.toLowerCase() === sym) ||
          i.name.toLowerCase().includes(sym) ||
          (i.symbol && i.symbol.toLowerCase().replace(/\.ca$/i, "") === sym)
      ) || null
    );
  }, [parsedIntent, instruments]);

  // Execute Parsed Financial Command
  const handleExecuteCommand = async () => {
    if (!parsedIntent) return;

    if (parsedIntent.type === "deposit" || parsedIntent.type === "expense") {
      if (!matchedAccount) {
        toast.error("لم يتم العثور على حساب نقدي مناسب لتنفيذ العملية.");
        return;
      }
      if (!parsedIntent.amount || parsedIntent.amount <= 0) {
        toast.error("يرجى إدخال مبلغ مالي صالح أكبر من صفر.");
        return;
      }

      setIsExecutingCommand(true);
      try {
        await postCashMutation.mutateAsync({
          accountId: matchedAccount.id,
          eventType: parsedIntent.type === "deposit" ? "deposit" : "expense",
          amount: String(parsedIntent.amount),
          currency: matchedAccount.currency || "EGP",
          occurredAt: Date.now(),
          memo: parsedIntent.memo || (parsedIntent.type === "deposit" ? "إيداع سريع" : "مصروف سريع"),
          idempotencyKey: `omni-cash-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        });

        await utils.family.invalidate();
        toast.success(
          `تم بنجاح ${parsedIntent.type === "deposit" ? "إيداع" : "صرف"} ${formatMoney(parsedIntent.amount, matchedAccount.currency || "EGP")} في حساب ${matchedAccount.name}.`
        );
        onOpenChange(false);
      } catch (err: any) {
        toast.error(err?.message || "تعذر تنفيذ العملية المالية.");
      } finally {
        setIsExecutingCommand(false);
      }
      return;
    }

    if (parsedIntent.type === "trade") {
      if (!matchedAccount) {
        toast.error("يرجى تحديد حساب تداول أو حساب نقدي متاح.");
        return;
      }
      if (!matchedInstrument) {
        toast.error(`السهم "${parsedIntent.symbol}" غير مسجل في أدواتك الاستثمارية.`);
        return;
      }
      if (!parsedIntent.quantity || parsedIntent.quantity <= 0) {
        toast.error("يرجى إدخال كمية أسهم صالحة.");
        return;
      }
      if (!parsedIntent.unitPrice || parsedIntent.unitPrice <= 0) {
        toast.error("يرجى إدخال سعر تنفيذ السهم باستخدام علامة @ (مثال: @ 88.5).");
        return;
      }

      setIsExecutingCommand(true);
      try {
        await postTradeMutation.mutateAsync({
          side: parsedIntent.side || "buy",
          accountId: matchedAccount.id,
          instrumentId: matchedInstrument.id,
          quantity: String(parsedIntent.quantity),
          unitPrice: String(parsedIntent.unitPrice),
          occurredAt: Date.now(),
          memo: `أمر فوري عبر شريط الأوامر: ${parsedIntent.side === "buy" ? "شراء" : "بيع"} ${parsedIntent.quantity} ${matchedInstrument.symbol}`,
          idempotencyKey: `omni-trade-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        });

        await utils.family.invalidate();
        toast.success(
          `تم بنجاح ترحيل صفقة ${parsedIntent.side === "buy" ? "شراء" : "بيع"} ${parsedIntent.quantity} سهم من ${matchedInstrument.name} إلى دفتر الأستاذ.`
        );
        onOpenChange(false);
      } catch (err: any) {
        toast.error(err?.message || "تعذر تنفيذ صفقة التداول.");
      } finally {
        setIsExecutingCommand(false);
      }
    }
  };

  // Quick Action 1: Instant Executive PDF Export
  const handleExportPdf = async () => {
    try {
      setIsExportingPdf(true);
      toast.info("جارٍ إنشاء التقرير التنفيذي المالي الفاخر بصيغة PDF...", { duration: 3000 });

      const result = await exportPdfMutation.mutateAsync({ periodKey: "2026-08" });

      // Decode base64 and initiate browser download
      const byteCharacters = atob(result.base64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: "application/pdf" });

      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = result.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(downloadUrl);

      toast.success("تم تصدير التقرير التنفيذي المالي بنجاح بصيغة PDF", {
        description: `الملف: ${result.filename} (${(result.sizeBytes / 1024).toFixed(1)} KB)`,
      });
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.message || "تعذر تصدير تقرير الثروة التنفيذي بصيغة PDF.");
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleNavigate = useCallback(
    (path: string) => {
      setLocation(path);
      onOpenChange(false);
    },
    [setLocation, onOpenChange]
  );

  // Grouped and filtered navigation routes
  const filteredRoutes = useMemo(() => {
    if (!search.trim()) return ALL_20_PLATFORM_ROUTES;
    const q = search.trim().toLowerCase();
    return ALL_20_PLATFORM_ROUTES.filter(
      (r) =>
        r.label.toLowerCase().includes(q) ||
        r.category.toLowerCase().includes(q) ||
        r.keywords.some((k) => k.toLowerCase().includes(q))
    );
  }, [search]);

  // Combined accounts search (client-cached + server results)
  const displayAccounts = useMemo(() => {
    if (serverResults?.accounts && serverResults.accounts.length > 0) {
      return serverResults.accounts;
    }
    if (!search.trim()) return accounts.slice(0, 6);
    const q = search.trim().toLowerCase();
    return accounts.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        (a.institution && a.institution.toLowerCase().includes(q)) ||
        (a.currency && a.currency.toLowerCase().includes(q))
    );
  }, [accounts, serverResults, search]);

  // Combined gold instruments
  const displayGoldInstruments = useMemo(() => {
    const goldList = instruments.filter(
      (i) => i.assetType === "gold" || /ذهب|gold|عيار|سبيكة/i.test(i.name)
    );
    if (!search.trim()) return goldList.slice(0, 5);
    const q = search.trim().toLowerCase();
    return goldList.filter(
      (i) =>
        i.name.toLowerCase().includes(q) ||
        (i.symbol && i.symbol.toLowerCase().includes(q)) ||
        /ذهب|gold|عيار/i.test(q)
    );
  }, [instruments, search]);

  // Combined transactions search (server deep search OR recent ledger client cache)
  const displayTransactions = useMemo(() => {
    if (serverResults?.transactions && serverResults.transactions.length > 0) {
      return serverResults.transactions;
    }
    if (!search.trim()) return recentEvents.slice(0, 6);
    const q = search.trim().toLowerCase();
    return recentEvents
      .filter((e) => {
        const memoMatch = e.memo?.toLowerCase().includes(q);
        const amountMatch = String(e.grossAmount || "").includes(q);
        const typeMatch = e.eventType.toLowerCase().includes(q);
        return memoMatch || amountMatch || typeMatch;
      })
      .slice(0, 8);
  }, [recentEvents, serverResults, search]);

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="شريط الأوامر والبحث الشامل الفوري"
      description="ابحث في كافة الأقسام، الحسابات، الذهب، والعمليات أو نفّذ إجراءات سريعة فوراً"
      className="sm:max-w-2xl bg-[#090D14] border border-white/10 text-slate-100 p-0 overflow-hidden shadow-2xl rounded-2xl"
    >
      <div className="flex flex-col h-full" dir="rtl">
        {/* Top Header Bar with Badge */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-slate-900/60">
          <div className="flex items-center gap-2.5">
            <div className="size-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
              <Sparkles className="size-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white tracking-wide">
                  شريط الأوامر والبحث الشامل
                </span>
                <Badge
                  variant="outline"
                  className="text-[10px] font-mono border-emerald-500/30 text-emerald-400 bg-emerald-950/40 px-1.5 py-0"
                >
                  Ctrl + K
                </Badge>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                تنقل فوري بين كافة الأقسام العشرين، ابحث بالمعاملات ومحافظ الذهب ونفّذ أوامرك مباشرة
              </p>
            </div>
          </div>
          {serverSearchQuery.isFetching && (
            <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-mono">
              <Loader2 className="size-3 animate-spin" />
              <span>بحث عميق...</span>
            </div>
          )}
        </div>

        {/* Command Input */}
        <CommandInput
          value={search}
          onValueChange={setSearch}
          placeholder="ابحث بالاسم، المبلغ، الحساب، الذهب، أو اكتب أمراً سريعاً (مثال: شراء 100 COMI @ 88.5)..."
          className="py-4 text-sm text-slate-100 placeholder:text-slate-500 border-none focus:ring-0"
        />

        {/* Interactive Natural Language Command Preview */}
        {parsedIntent && (
          <div className="m-3 p-3.5 rounded-xl border border-emerald-500/40 bg-emerald-950/25 space-y-3 animate-in fade-in-50 duration-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge
                  className={
                    parsedIntent.type === "trade"
                      ? parsedIntent.side === "buy"
                        ? "bg-emerald-600 text-white"
                        : "bg-rose-600 text-white"
                      : parsedIntent.type === "deposit"
                      ? "bg-emerald-600 text-white"
                      : "bg-amber-600 text-white"
                  }
                >
                  {parsedIntent.type === "trade"
                    ? parsedIntent.side === "buy"
                      ? "صفقة شراء أسهم"
                      : "صفقة بيع أسهم"
                    : parsedIntent.type === "deposit"
                    ? "إيداع نقدي فوري"
                    : "تسجيل مصروف فوري"}
                </Badge>
                <span className="text-xs text-slate-200 font-medium">
                  تم فهم الأمر المالي بالذكاء الحسابي
                </span>
              </div>
              <span className="text-[11px] text-slate-400">اضغط Enter للتأكيد والترحيل</span>
            </div>

            {/* Parsed Details Breakdown */}
            {parsedIntent.type === "trade" && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div className="p-2 rounded-lg bg-black/40 border border-white/5">
                  <span className="text-slate-400 block text-[10px]">الرمز</span>
                  <strong className="text-emerald-400 font-mono text-sm">
                    {matchedInstrument?.symbol || parsedIntent.symbol}
                  </strong>
                </div>
                <div className="p-2 rounded-lg bg-black/40 border border-white/5">
                  <span className="text-slate-400 block text-[10px]">الكمية</span>
                  <strong className="text-white font-mono text-sm">
                    {parsedIntent.quantity?.toLocaleString() || 0}
                  </strong>
                </div>
                <div className="p-2 rounded-lg bg-black/40 border border-white/5">
                  <span className="text-slate-400 block text-[10px]">السعر</span>
                  <strong className="text-white font-mono text-sm">
                    {parsedIntent.unitPrice ? `${parsedIntent.unitPrice.toFixed(2)} ج.م` : "سعر السوق"}
                  </strong>
                </div>
                <div className="p-2 rounded-lg bg-black/40 border border-white/5">
                  <span className="text-slate-400 block text-[10px]">الحساب</span>
                  <strong className="text-white text-xs truncate block">
                    {matchedAccount?.name || "حساب افتراضي"}
                  </strong>
                </div>
              </div>
            )}

            {(parsedIntent.type === "deposit" || parsedIntent.type === "expense") && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                <div className="p-2 rounded-lg bg-black/40 border border-white/5">
                  <span className="text-slate-400 block text-[10px]">المبلغ</span>
                  <strong className="text-emerald-400 font-mono text-sm">
                    {parsedIntent.amount ? formatMoney(parsedIntent.amount, "EGP") : "—"}
                  </strong>
                </div>
                <div className="p-2 rounded-lg bg-black/40 border border-white/5">
                  <span className="text-slate-400 block text-[10px]">الحساب المستهدف</span>
                  <strong className="text-white text-xs truncate block">
                    {matchedAccount?.name || "الحساب الرئيسي"}
                  </strong>
                </div>
                <div className="p-2 rounded-lg bg-black/40 border border-white/5 col-span-2 sm:col-span-1">
                  <span className="text-slate-400 block text-[10px]">البيان</span>
                  <strong className="text-slate-200 text-xs truncate block">
                    {parsedIntent.memo || "—"}
                  </strong>
                </div>
              </div>
            )}

            {/* Execution Buttons */}
            <div className="flex items-center justify-between pt-1 border-t border-white/10">
              <span className="text-xs text-slate-300">
                {confirmExecution
                  ? "هل تؤكد ترحيل هذا القيد فوراً إلى الدفتر المالي؟"
                  : "جاهز للترحيل الفوري المباشر"}
              </span>
              <div className="flex items-center gap-2">
                {confirmExecution && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setConfirmExecution(false)}
                    className="text-xs text-slate-400 hover:text-white h-7 px-2.5"
                  >
                    إلغاء
                  </Button>
                )}
                <Button
                  size="sm"
                  disabled={isExecutingCommand}
                  onClick={() => {
                    if (confirmExecution) {
                      handleExecuteCommand();
                    } else {
                      setConfirmExecution(true);
                    }
                  }}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs h-7 px-3.5 shadow-sm"
                >
                  {isExecutingCommand ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin ml-1.5" />
                      جارٍ الترحيل...
                    </>
                  ) : confirmExecution ? (
                    "تأكيد نهائي وترحيل ✓"
                  ) : (
                    "ترحيل إلى الدفتر ↵"
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Command List */}
        <CommandList className="max-h-[460px] overflow-y-auto px-2 py-2 space-y-2">
          <CommandEmpty className="py-8 text-center text-sm text-slate-400">
            <Search className="size-8 mx-auto mb-2 text-slate-600 opacity-60" />
            <p className="font-medium text-slate-300">لم يتم العثور على نتائج مطابقة لـ "{search}"</p>
            <p className="text-xs text-slate-500 mt-1">
              جرب البحث باسم صفحة (مثلاً: زكاة، تقارير، ذهب، شهادات) أو بمبلغ مالي أو حساب مصرفي
            </p>
          </CommandEmpty>

          {/* Group 1: Quick Actions (Always Available) */}
          <CommandGroup
            heading="الإجراءات المالية السريعة (Quick Actions)"
            className="text-slate-400"
          >
            {/* Quick Action: PDF Export */}
            <CommandItem
              onSelect={handleExportPdf}
              className="flex items-center justify-between p-2.5 rounded-xl cursor-pointer hover:bg-white/[0.08] aria-selected:bg-emerald-500/15 transition-colors group"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="size-8 rounded-lg bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400 shrink-0 group-hover:scale-105 transition-transform">
                  {isExportingPdf ? (
                    <Loader2 className="size-4 animate-spin text-sky-400" />
                  ) : (
                    <FileText className="size-4 text-sky-400" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-slate-100 group-hover:text-sky-300">
                      تصدير التقرير التنفيذي المالي الشامل (PDF)
                    </span>
                    <Badge className="bg-sky-500/20 text-sky-300 text-[10px] px-1.5 py-0 border border-sky-500/30">
                      طباعة فاخرة
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-400 truncate mt-0.5">
                    توليد وتنزيل تقرير الثروة المعتمد من 4 صفحات بختم الإغلاق والزكاة ودرع التضخم
                  </p>
                </div>
              </div>
              <CommandShortcut className="font-mono text-[11px] text-sky-400 bg-sky-950/40 px-1.5 py-0.5 rounded border border-sky-500/30">
                PDF
              </CommandShortcut>
            </CommandItem>

            {/* Quick Action: Record New Transaction */}
            <CommandItem
              onSelect={() => handleNavigate("/transactions")}
              className="flex items-center justify-between p-2.5 rounded-xl cursor-pointer hover:bg-white/[0.08] aria-selected:bg-emerald-500/15 transition-colors group"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="size-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0 group-hover:scale-105 transition-transform">
                  <PlusCircle className="size-4 text-emerald-400" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-slate-100 group-hover:text-emerald-300">
                      تسجيل معاملة أو قيد مالي جديد
                    </span>
                    <Badge className="bg-emerald-500/20 text-emerald-300 text-[10px] px-1.5 py-0 border border-emerald-500/30">
                      قيد دفتر الأستاذ
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-400 truncate mt-0.5">
                    إيداع، سحب، تحويل بين الحسابات، أو صفقة تداول أسهم وذهب
                  </p>
                </div>
              </div>
              <CommandShortcut className="font-mono text-[11px] text-emerald-400 bg-emerald-950/40 px-1.5 py-0.5 rounded border border-emerald-500/30">
                N
              </CommandShortcut>
            </CommandItem>

            {/* Quick Action: Pay Debt */}
            <CommandItem
              onSelect={() => handleNavigate("/banking?tab=debts")}
              className="flex items-center justify-between p-2.5 rounded-xl cursor-pointer hover:bg-white/[0.08] aria-selected:bg-emerald-500/15 transition-colors group"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="size-8 rounded-lg bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0 group-hover:scale-105 transition-transform">
                  <Banknote className="size-4 text-rose-400" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-slate-100 group-hover:text-rose-300">
                      سداد مديونية أو قسط ائتماني
                    </span>
                    <Badge className="bg-rose-500/20 text-rose-300 text-[10px] px-1.5 py-0 border border-rose-500/30">
                      التزامات
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-400 truncate mt-0.5">
                    تسجيل سداد قسط قرض أو بطاقة ائتمان من حساب السيولة
                  </p>
                </div>
              </div>
              <CommandShortcut className="font-mono text-[11px] text-rose-400 bg-rose-950/40 px-1.5 py-0.5 rounded border border-rose-500/30">
                D
              </CommandShortcut>
            </CommandItem>

            {/* Quick Action: Balance Settlement */}
            <CommandItem
              onSelect={() => handleNavigate("/reconciliation")}
              className="flex items-center justify-between p-2.5 rounded-xl cursor-pointer hover:bg-white/[0.08] aria-selected:bg-emerald-500/15 transition-colors group"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="size-8 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0 group-hover:scale-105 transition-transform">
                  <Scale className="size-4 text-amber-400" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-slate-100 group-hover:text-amber-300">
                      تسوية رصيد حساب وتدقيق الفروقات
                    </span>
                    <Badge className="bg-amber-500/20 text-amber-300 text-[10px] px-1.5 py-0 border border-amber-500/30">
                      مطابقة
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-400 truncate mt-0.5">
                    توليد قيد تسوية محاسبي لتطابق الرصيد الدفتري مع الكشف البنكي
                  </p>
                </div>
              </div>
              <CommandShortcut className="font-mono text-[11px] text-amber-400 bg-amber-950/40 px-1.5 py-0.5 rounded border border-amber-500/30">
                R
              </CommandShortcut>
            </CommandItem>
          </CommandGroup>

          <CommandSeparator className="bg-white/10" />

          {/* Group 2: Bank Accounts & Gold Portfolios */}
          {(displayAccounts.length > 0 || displayGoldInstruments.length > 0) && (
            <CommandGroup
              heading="الحسابات المصرفية ومحافظ الذهب والسبائك"
              className="text-slate-400"
            >
              {/* Accounts */}
              {displayAccounts.map((account) => (
                <CommandItem
                  key={`acc-${account.id}`}
                  onSelect={() => handleNavigate("/banking")}
                  className="flex items-center justify-between p-2.5 rounded-xl cursor-pointer hover:bg-white/[0.08] aria-selected:bg-emerald-500/15 transition-colors group"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="size-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                      <Landmark className="size-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-slate-100 group-hover:text-emerald-300">
                          {account.name}
                        </span>
                        {account.institution && (
                          <span className="text-[11px] text-slate-400 font-normal">
                            · {account.institution}
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-slate-500 block truncate">
                        نوع الحساب: {account.accountType} · العملة: {account.currency}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {"balance" in account && account.balance !== undefined && (
                      <Badge className="bg-emerald-950/60 border border-emerald-500/30 text-emerald-400 font-mono text-xs px-2 py-0.5">
                        {formatMoney(account.balance, account.currency)}
                      </Badge>
                    )}
                  </div>
                </CommandItem>
              ))}

              {/* Gold & Bullion Instruments */}
              {displayGoldInstruments.map((gold) => (
                <CommandItem
                  key={`gold-${gold.id}`}
                  onSelect={() => handleNavigate("/investments?tab=instruments")}
                  className="flex items-center justify-between p-2.5 rounded-xl cursor-pointer hover:bg-white/[0.08] aria-selected:bg-amber-500/15 transition-colors group"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="size-8 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                      <Coins className="size-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-slate-100 group-hover:text-amber-300">
                          {gold.name}
                        </span>
                        <Badge className="bg-amber-500/20 text-amber-300 text-[10px] px-1.5 py-0 border border-amber-500/30">
                          ذهب وسبيكة
                        </Badge>
                      </div>
                      <span className="text-[11px] text-slate-400 block truncate font-mono">
                        رمز الأداة: {gold.symbol || "XAU"} · تسعير لحظي بالسوق المصري
                      </span>
                    </div>
                  </div>
                  <CommandShortcut className="font-mono text-[10px] text-amber-400">
                    عرض الأسعار
                  </CommandShortcut>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          <CommandSeparator className="bg-white/10" />

          {/* Group 3: Financial Transactions Search */}
          {displayTransactions.length > 0 && (
            <CommandGroup
              heading="سجل العمليات والمعاملات المالية"
              className="text-slate-400"
            >
              {displayTransactions.map((tx) => (
                <CommandItem
                  key={`tx-${tx.id}`}
                  onSelect={() => handleNavigate("/transactions")}
                  className="flex items-center justify-between p-2.5 rounded-xl cursor-pointer hover:bg-white/[0.08] aria-selected:bg-emerald-500/15 transition-colors group"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`size-8 rounded-lg flex items-center justify-center shrink-0 border ${
                        tx.eventType === "income" || tx.eventType === "deposit"
                          ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
                          : tx.eventType === "buy"
                          ? "bg-sky-500/15 border-sky-500/30 text-sky-400"
                          : tx.eventType === "sell"
                          ? "bg-purple-500/15 border-purple-500/30 text-purple-400"
                          : "bg-amber-500/15 border-amber-500/30 text-amber-400"
                      }`}
                    >
                      {tx.eventType === "income" || tx.eventType === "deposit" ? (
                        <ArrowDownLeft className="size-4" />
                      ) : tx.eventType === "buy" ? (
                        <ArrowUpRight className="size-4" />
                      ) : (
                        <Receipt className="size-4" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-slate-100 group-hover:text-emerald-300 truncate">
                          {tx.memo || `معاملة #${tx.id} (${tx.eventType})`}
                        </span>
                        <Badge
                          variant="outline"
                          className="text-[10px] text-slate-400 border-white/10 px-1 py-0"
                        >
                          {tx.eventType}
                        </Badge>
                      </div>
                      <span className="text-[11px] text-slate-400 block truncate">
                        {"primaryAccountName" in tx && tx.primaryAccountName
                          ? `الحساب: ${tx.primaryAccountName}`
                          : "معاملة نقدية"}
                        {tx.occurredAt && (
                          <span className="text-slate-500 mr-2 font-mono">
                            · {new Date(tx.occurredAt).toLocaleDateString("ar-EG")}
                          </span>
                        )}
                      </span>
                    </div>
                  </div>
                  <div className="shrink-0 font-mono text-sm font-bold text-slate-200">
                    {formatMoney(tx.grossAmount || 0, tx.currency || "EGP")}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          <CommandSeparator className="bg-white/10" />

          {/* Group 4: All 20 Navigation Sections */}
          <CommandGroup
            heading="التنقل السريع في أقسام المنصة (20 قسماً وصفحة)"
            className="text-slate-400"
          >
            {filteredRoutes.map((route) => {
              const Icon = route.icon;
              return (
                <CommandItem
                  key={route.id}
                  onSelect={() => handleNavigate(route.path)}
                  className="flex items-center justify-between p-2.5 rounded-xl cursor-pointer hover:bg-white/[0.08] aria-selected:bg-emerald-500/15 transition-colors group"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="size-8 rounded-lg bg-white/[0.05] border border-white/10 flex items-center justify-center text-slate-300 shrink-0 group-hover:text-emerald-400 group-hover:border-emerald-500/30 transition-all">
                      <Icon className="size-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-slate-200 group-hover:text-white">
                          {route.label}
                        </span>
                        <span className="text-[10px] text-slate-500 bg-white/[0.03] px-1.5 py-0.5 rounded border border-white/5">
                          {route.category}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-400 font-mono block truncate">
                        {route.path}
                      </span>
                    </div>
                  </div>
                  <CommandShortcut className="font-mono text-[10px] text-slate-500 group-hover:text-slate-300">
                    انتقال ↵
                  </CommandShortcut>
                </CommandItem>
              );
            })}
          </CommandGroup>
        </CommandList>

        {/* Footer shortcuts hint */}
        <div className="px-4 py-2 border-t border-white/10 bg-slate-950/70 flex items-center justify-between text-[11px] text-slate-400">
          <div className="flex items-center gap-3">
            <span>
              استخدم <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-white font-mono text-[10px]">↑</kbd>{" "}
              <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-white font-mono text-[10px]">↓</kbd> للتنقل
            </span>
            <span>
              اضغط <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-white font-mono text-[10px]">↵ Enter</kbd> للاختيار
            </span>
          </div>
          <div>
            <span>
              اضغط <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-white font-mono text-[10px]">Esc</kbd> للإغلاق
            </span>
          </div>
        </div>
      </div>
    </CommandDialog>
  );
}

export default OmniCommandBar;
