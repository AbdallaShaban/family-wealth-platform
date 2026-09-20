import { useAuth } from "@/_core/hooks/useAuth";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useDemoMode } from "@/contexts/DemoModeContext";
import { useTheme } from "@/contexts/ThemeContext";
import { usePrivacyMode } from "@/contexts/PrivacyModeContext";
import { trpc } from "@/lib/trpc";
import {
  ArrowLeftRight,
  BarChart3,
  BookOpenCheck,
  BriefcaseBusiness,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  CreditCard,
  Download,
  EyeOff,
  FileChartColumn,
  FileLock2,
  FileSpreadsheet,
  Globe2,
  Landmark,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  PanelRightClose,
  PanelRightOpen,
  PlusCircle,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  Sun,
  Target,
  TrendingUp,
  UsersRound,
  WalletCards,
  type LucideIcon,
} from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { startLogin } from "@/const";
import { Button } from "./ui/button";
import NotificationCenter from "./NotificationCenter";

type MinimumRole = "viewer" | "editor" | "advisor" | "owner";
type MenuItem = { icon: LucideIcon; label: string; path: string; minimumRole: MinimumRole };
type NavigationGroup = { id: string; label: string; icon: LucideIcon; items: MenuItem[] };

const roleRank: Record<MinimumRole, number> = { viewer: 1, editor: 2, advisor: 3, owner: 4 };

const roleArabicLabels: Record<MinimumRole, string> = {
  owner: "مالك المساحة",
  advisor: "مستشار مالي",
  editor: "محرر محاسبي",
  viewer: "مشاهد معتمد",
};

const navigationGroups: NavigationGroup[] = [
  {
    id: "overview",
    label: "النظرة المالية العامة",
    icon: LayoutDashboard,
    items: [
      { icon: LayoutDashboard, label: "النظرة المالية العامة", path: "/", minimumRole: "viewer" },
      { icon: Globe2, label: "النظرة المالية والتقييم", path: "/valuation", minimumRole: "advisor" },
      { icon: Sparkles, label: "الصحة المالية", path: "/wealth-health", minimumRole: "viewer" },
    ],
  },
  {
    id: "wealth_assets",
    label: "الثروة والأصول",
    icon: Landmark,
    items: [
      { icon: Landmark, label: "الحسابات والأرصدة", path: "/accounts", minimumRole: "viewer" },
      { icon: TrendingUp, label: "الاستثمارات والمحافظ", path: "/investments", minimumRole: "viewer" },
      { icon: BriefcaseBusiness, label: "الأصول الخاصة والتأمين", path: "/assets-insurance", minimumRole: "viewer" },
    ],
  },
  {
    id: "cash_liabilities",
    label: "النقد والالتزامات",
    icon: WalletCards,
    items: [
      { icon: ArrowLeftRight, label: "المعاملات المالية", path: "/transactions", minimumRole: "editor" },
      { icon: WalletCards, label: "التدفق النقدي والسيولة", path: "/cash-flow", minimumRole: "editor" },
      { icon: CreditCard, label: "الديون والالتزامات", path: "/debts", minimumRole: "editor" },
      { icon: ClipboardCheck, label: "المطابقة والتسوية البنكية", path: "/reconciliation", minimumRole: "editor" },
      { icon: FileSpreadsheet, label: "كشوف الحساب والملفات", path: "/imports", minimumRole: "editor" },
    ],
  },
  {
    id: "analysis_strategy",
    label: "التحليل والاستراتيجية",
    icon: TrendingUp,
    items: [
      { icon: Sparkles, label: "الاستخبارات الكمية والذهب", path: "/quant", minimumRole: "viewer" },
      { icon: TrendingUp, label: "الأداء الاستثماري", path: "/performance", minimumRole: "viewer" },
      { icon: BarChart3, label: "تداول السوينج والمستشار", path: "/trading/swing", minimumRole: "viewer" },
      { icon: ArrowLeftRight, label: "المخاطر والتخصيص", path: "/risk", minimumRole: "viewer" },
      { icon: ShieldCheck, label: "اختبارات الإجهاد", path: "/stress-testing", minimumRole: "viewer" },
      { icon: Target, label: "الأهداف والتقاعد", path: "/goals", minimumRole: "viewer" },
      { icon: ReceiptText, label: "العمليات", path: "/operations", minimumRole: "editor" },
    ],
  },
  {
    id: "governance_admin",
    label: "الحوكمة والإدارة",
    icon: ShieldCheck,
    items: [
      { icon: FileChartColumn, label: "كشوف الحساب والتقارير", path: "/reports", minimumRole: "viewer" },
      { icon: Building2, label: "التوحيد المالي", path: "/consolidation", minimumRole: "viewer" },
      { icon: CheckCircle2, label: "الموافقات", path: "/approvals", minimumRole: "editor" },
      { icon: FileLock2, label: "الخزنة", path: "/vault", minimumRole: "editor" },
      { icon: Download, label: "النسخ الاحتياطي والتعافي", path: "/export", minimumRole: "advisor" },
      { icon: UsersRound, label: "الأعضاء", path: "/members", minimumRole: "advisor" },
      { icon: BookOpenCheck, label: "سجل التدقيق", path: "/audit", minimumRole: "advisor" },
      { icon: UsersRound, label: "إدارة المستخدمين", path: "/admin/users", minimumRole: "advisor" },
      { icon: ShieldCheck, label: "بوابة المدقق الخارجي", path: "/auditor-portal", minimumRole: "advisor" },
    ],
  },
];

const allItems = navigationGroups.flatMap(group => group.items);

function getActiveGatewayId(path: string): string {
  const normalized = path.startsWith("/family/") ? path.replace("/family", "") : path;
  if (normalized === "/") return "overview";
  for (const group of navigationGroups) {
    if (
      group.items.some(
        item =>
          item.path === path ||
          item.path === normalized ||
          (item.path !== "/" && (path.startsWith(item.path + "/") || normalized.startsWith(item.path + "/")))
      )
    ) {
      return group.id;
    }
  }
  return "overview";
}

function FintechBrand({ collapsed }: { collapsed: boolean }) {
  return (
    <div className="fintech-v2-brand flex items-center gap-3 min-w-0">
      <div className="relative flex items-center justify-center size-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.25)] shrink-0">
        <ShieldCheck className="size-5 text-emerald-400" />
      </div>
      {!collapsed && (
        <div className="min-w-0 flex flex-col justify-center">
          <strong className="text-white font-extrabold text-[15px] tracking-wider leading-tight">
            FAMILY
          </strong>
          <span className="text-emerald-400 font-mono text-[10px] tracking-widest leading-tight mt-0.5 font-bold">
            WEALTH INTELLIGENCE
          </span>
        </div>
      )}
    </div>
  );
}

function FintechNav({
  collapsed,
  role,
  location,
  onNavigate,
}: {
  collapsed: boolean;
  role: MinimumRole;
  location: string;
  onNavigate: (path: string) => void;
}) {
  const navRef = useRef<HTMLElement>(null);
  const visibleGroups = navigationGroups
    .map(group => ({
      ...group,
      items: group.items.filter(item => roleRank[role] >= roleRank[item.minimumRole]),
    }))
    .filter(group => group.items.length > 0);

  const currentActiveGateway = getActiveGatewayId(location);

  const [openGateways, setOpenGateways] = useState<string[]>(() => {
    try {
      const saved = sessionStorage.getItem("family-sidebar-open-gateways");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          if (!parsed.includes(currentActiveGateway)) {
            return [...parsed, currentActiveGateway];
          }
          return parsed;
        }
      }
    } catch {
      // fallback
    }
    return [currentActiveGateway];
  });

  useEffect(() => {
    const activeG = getActiveGatewayId(location);
    setOpenGateways(prev => {
      if (!prev.includes(activeG)) {
        const next = [...prev, activeG];
        try {
          sessionStorage.setItem("family-sidebar-open-gateways", JSON.stringify(next));
        } catch {}
        return next;
      }
      return prev;
    });
  }, [location]);

  useEffect(() => {
    const navigation = navRef.current;
    if (!navigation) return;
    try {
      const saved = Number(sessionStorage.getItem("family-sidebar-scroll-top")) || 0;
      if (saved > 0) {
        navigation.scrollTop = saved;
      }
    } catch {}
  }, [collapsed]);

  const handleScroll = (e: React.UIEvent<HTMLElement>) => {
    try {
      sessionStorage.setItem("family-sidebar-scroll-top", String(e.currentTarget.scrollTop));
    } catch {}
  };

  const handleAccordionChange = (values: string[]) => {
    setOpenGateways(values);
    try {
      sessionStorage.setItem("family-sidebar-open-gateways", JSON.stringify(values));
    } catch {}
  };

  if (collapsed) {
    return (
      <TooltipProvider delayDuration={60}>
        <nav
          ref={navRef}
          onScroll={handleScroll}
          className="fintech-v2-icon-nav flex-1 min-h-0 overflow-y-auto scrollbar-none py-3 px-1.5 space-y-2"
          aria-label="التنقل المصغر"
        >
          {visibleGroups.map((group, gIdx) => (
            <div key={group.id} className="fintech-v2-icon-group flex flex-col items-center gap-1.5 w-full">
              {gIdx > 0 && <div className="w-7 h-px bg-white/10 my-1 shrink-0" />}
              {group.items.map(item => {
                const Icon = item.icon;
                const isCurrent =
                  location === item.path ||
                  (item.path !== "/" && (location === item.path || location.startsWith(item.path + "/")));
                return (
                  <Tooltip key={item.path}>
                    <TooltipTrigger asChild>
                      <button
                        className={`size-10 rounded-xl flex items-center justify-center transition-all ${
                          isCurrent
                            ? "bg-[rgba(16,185,129,0.12)] text-emerald-400 border border-emerald-500/30 shadow-sm"
                            : "text-slate-400 hover:text-white hover:bg-white/5"
                        }`}
                        onClick={() => onNavigate(item.path)}
                        aria-label={item.label}
                        aria-current={isCurrent ? "page" : undefined}
                      >
                        <Icon className="size-[18px]" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent
                      side="left"
                      sideOffset={12}
                      className="bg-[#0B0F17] border border-white/10 text-[#F8FAFC] shadow-2xl rounded-lg px-3 py-1.5 z-50 pointer-events-none"
                    >
                      <p className="font-semibold text-xs text-[#F8FAFC]">{item.label}</p>
                      <p className="text-[10px] text-[#34D399] font-medium mt-0.5">{group.label}</p>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          ))}
        </nav>
      </TooltipProvider>
    );
  }

  return (
    <nav
      ref={navRef}
      onScroll={handleScroll}
      className="fintech-v2-nav flex-1 min-h-0 overflow-y-auto scrollbar-none px-3 py-3 space-y-2"
      aria-label="التنقل الرئيسي"
    >
      <Accordion
        type="multiple"
        value={openGateways}
        onValueChange={handleAccordionChange}
        className="fintech-v2-accordion space-y-2"
      >
        {visibleGroups.map(group => {
          const GroupIcon = group.icon;
          const hasActiveItem = group.items.some(
            item =>
              location === item.path ||
              (item.path !== "/" && (location === item.path || location.startsWith(item.path + "/")))
          );
          return (
            <AccordionItem value={group.id} key={group.id} className="border-0">
              <AccordionTrigger
                className={`fintech-v2-group-trigger flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-bold transition-all duration-150 ${
                  hasActiveItem
                    ? "bg-[rgba(16,185,129,0.12)] text-emerald-400 border border-emerald-500/20"
                    : "text-slate-300 hover:text-white hover:bg-white/5"
                }`}
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  <span
                    className={`p-1.5 rounded-lg shrink-0 border transition-colors ${
                      hasActiveItem
                        ? "bg-emerald-500/20 border-emerald-500/30 text-emerald-300"
                        : "bg-white/5 border-white/10 text-slate-400"
                    }`}
                  >
                    <GroupIcon className="size-4" />
                  </span>
                  <span className="truncate text-xs font-bold">{group.label}</span>
                </span>
              </AccordionTrigger>
              <AccordionContent className="fintech-v2-group-content pt-1 pb-1.5 pr-2 mr-3 border-r border-dashed border-white/10 space-y-1">
                {group.items.map(item => {
                  const Icon = item.icon;
                  const isCurrent =
                    location === item.path ||
                    (item.path !== "/" && (location === item.path || location.startsWith(item.path + "/")));
                  return (
                    <button
                      key={item.path}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs transition-all duration-150 text-right ${
                        isCurrent
                          ? "bg-[rgba(16,185,129,0.12)] text-emerald-400 font-semibold border-r-2 border-emerald-500 shadow-sm"
                          : "text-slate-400 hover:text-slate-100 hover:bg-white/5 font-medium"
                      }`}
                      onClick={() => onNavigate(item.path)}
                      aria-current={isCurrent ? "page" : undefined}
                    >
                      <Icon className={`size-4 shrink-0 ${isCurrent ? "text-emerald-400" : "text-slate-400"}`} />
                      <span className="truncate flex-1">{item.label}</span>
                      {isCurrent && (
                        <span className="size-1.5 rounded-full bg-emerald-400 shrink-0 shadow-[0_0_6px_#34d399]" />
                      )}
                    </button>
                  );
                })}
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </nav>
  );
}

function UserControls({
  collapsed,
  role,
  onLogout,
}: {
  collapsed: boolean;
  role: MinimumRole;
  onLogout: () => void;
}) {
  const { theme, toggleTheme } = useTheme();
  const { isDemoMode, toggleDemoMode } = useDemoMode();
  const { user } = useAuth();
  const initial = user?.name?.trim().charAt(0).toUpperCase() || "F";
  const roleLabel = roleArabicLabels[role] || "مشاهد معتمد";

  if (collapsed) {
    return (
      <div className="fintech-v2-user-zone border-t border-white/5 flex flex-col items-center gap-2 py-3 px-2">
        <TooltipProvider delayDuration={60}>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="fintech-v2-avatar size-8.5 rounded-full flex items-center justify-center font-bold text-xs bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 cursor-default">
                {initial}
              </div>
            </TooltipTrigger>
            <TooltipContent side="left" className="bg-[#0B0F17] border border-white/10 text-[#F8FAFC] text-xs px-3 py-1.5 shadow-xl">
              <p className="font-bold">{user?.name || "مستخدم FAMILY"}</p>
              <p className="text-[10px] text-[#34D399]">{roleLabel}</p>
              <p className="text-[10px] text-[#94A3B8]">{user?.email || "جلسة آمنة"}</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                className="size-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/5 transition-all"
                onClick={toggleTheme}
                aria-label="تبديل الوضع اللوني"
              >
                {theme === "dark" ? <Sun className="size-4 text-amber-300" /> : <Moon className="size-4" />}
              </button>
            </TooltipTrigger>
            <TooltipContent side="left" className="bg-[#0B0F17] border border-white/10 text-[#F8FAFC] text-xs px-2.5 py-1">
              تبديل الوضع اللوني
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onLogout}
                className="size-8 rounded-lg flex items-center justify-center text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 transition-all"
                aria-label="تسجيل الخروج"
              >
                <LogOut className="size-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="left" className="bg-[#0B0F17] border border-white/10 text-[#F8FAFC] text-xs px-2.5 py-1">
              تسجيل الخروج
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    );
  }

  return (
    <div className="fintech-v2-user-zone border-t border-white/5 pt-4 px-3 pb-3 space-y-2.5">
      <div className="fintech-v2-utility-row flex gap-2">
        <button
          className={`flex-1 flex items-center justify-center gap-1.5 h-8 px-2.5 rounded-xl border text-[11px] font-medium transition-all ${
            isDemoMode
              ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-300 shadow-sm"
              : "border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.08] hover:text-white"
          }`}
          onClick={toggleDemoMode}
        >
          <Sparkles className="size-3.5 text-emerald-400" />
          <span>{isDemoMode ? "العرض التجريبي مفعل" : "معاينة تجريبية"}</span>
        </button>
        <button
          className="flex items-center justify-center size-8 rounded-xl border border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.08] hover:text-white transition-all shrink-0"
          onClick={toggleTheme}
          aria-label="تبديل الوضع اللوني"
          title="تبديل الوضع اللوني"
        >
          {theme === "dark" ? <Sun className="size-3.5 text-amber-300" /> : <Moon className="size-3.5" />}
        </button>
      </div>

      <div className="fintech-v2-user-card flex items-center gap-2.5 p-2.5 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.05] transition-all">
        <span className="fintech-v2-avatar size-8.5 rounded-full flex items-center justify-center font-bold text-xs bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 shrink-0">
          {initial}
        </span>
        <div className="min-w-0 flex-1">
          <strong className="block truncate text-xs text-slate-100 font-semibold">
            {user?.name || "مستخدم FAMILY"}
          </strong>
          <span className="block truncate text-[10px] text-slate-400 font-mono">
            {roleLabel}
          </span>
        </div>
        <button
          onClick={onLogout}
          className="size-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 transition-colors shrink-0"
          title="تسجيل الخروج"
          aria-label="تسجيل الخروج"
        >
          <LogOut className="size-4" />
        </button>
      </div>
    </div>
  );
}

function MobileBottomNav({
  role,
  location,
  onNavigate,
  onOpenMore,
  onQuickCapture,
}: {
  role: MinimumRole;
  location: string;
  onNavigate: (path: string) => void;
  onOpenMore: () => void;
  onQuickCapture: () => void;
}) {
  const canQuickCapture = roleRank[role] >= roleRank.editor;
  const items = [
    { path: "/", label: "الرئيسية", icon: LayoutDashboard },
    { path: "/accounts", label: "الحسابات", icon: Landmark },
    { path: "/goals", label: "الخطة", icon: Target },
  ];
  return (
    <nav className="fintech-bottom-nav" aria-label="التنقل السفلي">
      <div>
        {items.slice(0, 2).map(item => {
          const Icon = item.icon;
          return (
            <button
              key={item.path}
              className={location === item.path ? "is-active" : ""}
              onClick={() => onNavigate(item.path)}
            >
              <Icon className="size-5" />
              <span>{item.label}</span>
            </button>
          );
        })}
        <button
          className="fintech-bottom-quick"
          disabled={!canQuickCapture}
          title={canQuickCapture ? "تسجيل تدفق جديد" : "يتطلب صلاحية محرر"}
          onClick={() => canQuickCapture && onQuickCapture()}
        >
          <PlusCircle className="size-6" />
          <span>إدخال</span>
        </button>
        {items.slice(2).map(item => {
          const Icon = item.icon;
          return (
            <button
              key={item.path}
              className={location === item.path ? "is-active" : ""}
              onClick={() => onNavigate(item.path)}
            >
              <Icon className="size-5" />
              <span>{item.label}</span>
            </button>
          );
        })}
        <button onClick={onOpenMore}>
          <Menu className="size-5" />
          <span>المزيد</span>
        </button>
      </div>
    </nav>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { loading, user, logout } = useAuth();
  const workspace = trpc.family.bootstrap.useQuery(undefined, { enabled: Boolean(user) });
  const [location, setLocation] = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [quickConfirmOpen, setQuickConfirmOpen] = useState(false);
  const { isPrivate } = usePrivacyMode();
  const role = (workspace.data?.membership.role ?? "viewer") as MinimumRole;
  const normalizedLocation = location.startsWith("/family/") ? location.replace("/family", "") : location;
  const routeItem = allItems.find(item => item.path === location || item.path === normalizedLocation);
  const currentGroup = navigationGroups.find(group =>
    group.items.some(
      item =>
        item.path === location ||
        item.path === normalizedLocation ||
        (item.path !== "/" && (location.startsWith(item.path + "/") || normalizedLocation.startsWith(item.path + "/")))
    )
  );
  const canAccessCurrentRoute = !routeItem || roleRank[role] >= roleRank[routeItem.minimumRole];
  const currentLabel = canAccessCurrentRoute
    ? routeItem?.label ?? (location === "/" ? "النظرة المالية العامة" : "نظرة تفصيلية")
    : "وصول محدود";
  const navigate = (path: string) => {
    setLocation(path);
    setMobileOpen(false);
  };

  if (loading) {
    return (
      <div className="fintech-loading-shell">
        <div className="fintech-loading-rail" />
        <div className="fintech-loading-content">
          <i />
          <div>
            {Array.from({ length: 4 }).map((_, index) => (
              <b key={index} />
            ))}
          </div>
          <i />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <main className="fintech-login-gate" dir="rtl">
        <section>
          <div className="fintech-brand-mark">
            <ShieldCheck className="size-6" />
          </div>
          <p>FAMILY / PRIVATE WEALTH</p>
          <h1>مساحتك المالية تستحق طبقة حماية واضحة.</h1>
          <span>سجّل الدخول للوصول إلى بياناتك وإجراءاتك داخل نطاق FAMILY الخاص بك.</span>
          <Button onClick={() => startLogin()} className="fintech-login-button">
            متابعة آمنة
          </Button>
        </section>
      </main>
    );
  }

  return (
    <div className={`fintech-app-shell ${isPrivate ? "privacy-mode" : ""}`} dir="rtl">
      {/* Scoped Sidebar Styling: Deep Charcoal Slate (#0B0F17) */}
      <style>{`
        aside.fintech-v2-sidebar,
        .fintech-v2-mobile-sheet {
          background-color: #0B0F17 !important;
          background: #0B0F17 !important;
          background-image: none !important;
          border-left: 1px solid rgba(255, 255, 255, 0.08) !important;
        }
        aside.fintech-v2-sidebar::before,
        aside.fintech-v2-sidebar::after {
          display: none !important;
          content: none !important;
        }
      `}</style>
      <aside
        data-sidebar="true"
        className={`fintech-v2-sidebar ${collapsed ? "is-collapsed" : ""}`}
        style={{
          backgroundColor: "#0B0F17",
          background: "#0B0F17",
          backgroundImage: "none",
          borderLeft: "1px solid rgba(255, 255, 255, 0.08)",
        }}
      >
        <header className="fintech-v2-sidebar-header flex items-center justify-between gap-2 px-4 py-3.5 border-b border-white/[0.08] shrink-0 min-h-[68px]">
          <FintechBrand collapsed={collapsed} />
          <button
            className="fintech-v2-collapse size-8 rounded-lg flex items-center justify-center border border-white/10 bg-white/5 text-slate-300 hover:text-white hover:bg-white/15 transition-colors shrink-0"
            onClick={() => setCollapsed(value => !value)}
            aria-label={collapsed ? "توسيع القائمة الجانبية" : "طي القائمة الجانبية"}
            title={collapsed ? "توسيع القائمة" : "طي القائمة"}
          >
            {collapsed ? <PanelRightOpen className="size-4" /> : <PanelRightClose className="size-4" />}
          </button>
        </header>
        <FintechNav
          collapsed={collapsed}
          role={role}
          location={location}
          onNavigate={navigate}
        />
        <UserControls collapsed={collapsed} role={role} onLogout={logout} />
      </aside>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent
          side="right"
          className="fintech-v2-mobile-sheet"
          style={{
            backgroundColor: "#0B0F17",
            background: "#0B0F17",
            backgroundImage: "none",
            borderLeft: "1px solid rgba(255, 255, 255, 0.08)",
          }}
          dir="rtl"
        >
          <div className="fintech-v2-mobile-body">
            <div className="p-4 border-b border-white/[0.08]">
              <FintechBrand collapsed={false} />
            </div>
            <FintechNav
              collapsed={false}
              role={role}
              location={location}
              onNavigate={navigate}
            />
            <UserControls collapsed={false} role={role} onLogout={logout} />
          </div>
        </SheetContent>
      </Sheet>

      <main className="fintech-v2-main">
        <header className="fintech-topbar">
          <div className="flex min-w-0 items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="fintech-mobile-menu"
              aria-label="فتح التنقل"
            >
              <Menu className="size-5" />
            </button>
            <div className="min-w-0">
              <p>
                FAMILY / {workspace.data?.workspace.name || "WEALTH"} ·{" "}
                {workspace.data?.workspace.baseCurrency || "EGP"}
                {currentGroup ? ` · ${currentGroup.label}` : ""}
              </p>
              <strong>{currentLabel}</strong>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <TopbarControls />
          </div>
        </header>
        <div className="fintech-content-shell" data-route={location}>
          {canAccessCurrentRoute ? (
            <section className="fintech-route-frame">{children}</section>
          ) : (
            <section className="fintech-access-card">
              <ShieldCheck className="size-9" />
              <h1>الوصول للقراءة فقط</h1>
              <p>هذه الشاشة تتطلب صلاحية أعلى. يمكنك مراجعة الحسابات والتقرير المالي ضمن الصلاحيات الممنوحة لك.</p>
            </section>
          )}
        </div>
      </main>

      <MobileBottomNav
        role={role}
        location={location}
        onNavigate={navigate}
        onOpenMore={() => setMobileOpen(true)}
        onQuickCapture={() => setQuickConfirmOpen(true)}
      />

      <Dialog open={quickConfirmOpen} onOpenChange={setQuickConfirmOpen}>
        <DialogContent dir="rtl" className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>بدء إدخال مالي سريع</DialogTitle>
            <DialogDescription>
              ستنتقل إلى نموذج مراجعة العملية. لن يُنشر أي قيد قبل إدخال الحساب والمبلغ وتأكيد النموذج.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:justify-start">
            <Button variant="outline" onClick={() => setQuickConfirmOpen(false)}>
              إلغاء
            </Button>
            <Button
              onClick={() => {
                setQuickConfirmOpen(false);
                navigate("/cash-flow/record");
              }}
            >
              متابعة إلى النموذج
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TopbarControls() {
  const { theme, toggleTheme } = useTheme();
  const { isDemoMode, toggleDemoMode } = useDemoMode();
  const { isPrivate, togglePrivacy } = usePrivacyMode();
  return (
    <>
      <NotificationCenter />
      <button
        onClick={toggleDemoMode}
        className={`fintech-topbar-button ${isDemoMode ? "is-active" : ""}`}
      >
        <Sparkles className="size-4" />
        <span className="hidden sm:inline">تجريبي</span>
      </button>
      <button
        onClick={togglePrivacy}
        className={`fintech-topbar-button ${isPrivate ? "is-active" : ""}`}
        aria-pressed={isPrivate}
        aria-label={isPrivate ? "إظهار القيم" : "إخفاء القيم"}
      >
        <EyeOff className="size-4" />
        <span className="hidden sm:inline">{isPrivate ? "إظهار" : "خصوصية"}</span>
      </button>
      <button
        onClick={toggleTheme}
        className="fintech-topbar-button"
        aria-label="تبديل الوضع اللوني"
      >
        {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
      </button>
    </>
  );
}

