import { useAuth } from "@/_core/hooks/useAuth";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useDemoMode } from "@/contexts/DemoModeContext";
import { useTheme } from "@/contexts/ThemeContext";
import { usePrivacyMode } from "@/contexts/PrivacyModeContext";
import { trpc } from "@/lib/trpc";
import { ArrowDownLeft, ArrowLeftRight, BookOpenCheck, BriefcaseBusiness, Building2, CalendarClock, CheckCircle2, ChevronLeft, ClipboardCheck, CreditCard, Download, EyeOff, FileChartColumn, FileLock2, FileSpreadsheet, GitCompareArrows, Globe2, HandCoins, Landmark, LayoutDashboard, LogOut, Menu, Moon, PanelRightClose, PanelRightOpen, PlusCircle, ReceiptText, ShieldCheck, Sparkles, Sun, Target, TrendingUp, Umbrella, UsersRound, WalletCards, type LucideIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { startLogin } from "@/const";
import { Button } from "./ui/button";

type MinimumRole = "viewer" | "editor" | "advisor" | "owner";
type MenuItem = { icon: LucideIcon; label: string; path: string; minimumRole: MinimumRole };
type NavigationGroup = { id: string; label: string; icon: LucideIcon; items: MenuItem[] };

const roleRank: Record<MinimumRole, number> = { viewer: 1, editor: 2, advisor: 3, owner: 4 };
const homeItem: MenuItem = { icon: LayoutDashboard, label: "النظرة المالية", path: "/", minimumRole: "viewer" };
const navigationGroups: NavigationGroup[] = [
  {
    id: "overview",
    label: "النظرة المالية والتقييم",
    icon: LayoutDashboard,
    items: [
      { icon: Globe2, label: "صافي الثروة والتقييم", path: "/valuation", minimumRole: "advisor" },
      { icon: Sparkles, label: "الصحة المالية واستدامة الثروة", path: "/wealth-health", minimumRole: "viewer" },
    ],
  },
  {
    id: "wealth_assets",
    label: "الثروة والأصول",
    icon: Landmark,
    items: [
      { icon: Landmark, label: "الحسابات والأرصدة", path: "/accounts", minimumRole: "viewer" },
      { icon: TrendingUp, label: "الاستثمارات والحيازات", path: "/investments", minimumRole: "viewer" },
      { icon: BriefcaseBusiness, label: "الأصول العينية والتأمين", path: "/assets-insurance", minimumRole: "viewer" },
    ],
  },
  {
    id: "cash_liabilities",
    label: "النقد والالتزامات",
    icon: WalletCards,
    items: [
      { icon: WalletCards, label: "التدفق المالي والميزانية", path: "/cash-flow", minimumRole: "editor" },
      { icon: CreditCard, label: "الديون والالتزامات", path: "/debts", minimumRole: "editor" },
      { icon: ClipboardCheck, label: "تسوية ومطابقة العمليات", path: "/reconciliation", minimumRole: "editor" },
      { icon: FileSpreadsheet, label: "Inbox الاستيراد والملفات", path: "/imports", minimumRole: "editor" },
    ],
  },
  {
    id: "analysis_strategy",
    label: "التحليل والاستراتيجية",
    icon: TrendingUp,
    items: [
      { icon: TrendingUp, label: "أداء المحفظة وعزو العوائد", path: "/performance", minimumRole: "viewer" },
      { icon: ArrowLeftRight, label: "المخاطر والتخصيص", path: "/risk", minimumRole: "viewer" },
      { icon: ShieldCheck, label: "اختبارات الضغط والتحمل", path: "/stress-testing", minimumRole: "viewer" },
      { icon: Target, label: "الأهداف المالية", path: "/goals", minimumRole: "viewer" },
      { icon: ReceiptText, label: "الزكاة والالتزامات الدورية", path: "/operations", minimumRole: "editor" },
    ],
  },
  {
    id: "governance_admin",
    label: "الحوكمة والإدارة",
    icon: ShieldCheck,
    items: [
      { icon: FileChartColumn, label: "التقرير المالي والقوائم", path: "/reports", minimumRole: "viewer" },
      { icon: Building2, label: "توحيد الكيانات والدمج", path: "/consolidation", minimumRole: "viewer" },
      { icon: CheckCircle2, label: "الموافقات والضوابط", path: "/approvals", minimumRole: "editor" },
      { icon: FileLock2, label: "خزنة المستندات", path: "/vault", minimumRole: "editor" },
      { icon: Download, label: "النسخ الاحتياطي وتصدير البيانات", path: "/export", minimumRole: "advisor" },
      { icon: UsersRound, label: "الأعضاء والمساحات", path: "/members", minimumRole: "advisor" },
      { icon: BookOpenCheck, label: "سجل التدقيق", path: "/audit", minimumRole: "advisor" },
      { icon: UsersRound, label: "إدارة المنصة", path: "/admin/users", minimumRole: "advisor" },
      { icon: BookOpenCheck, label: "بوابة المدقق المالي", path: "/auditor-portal", minimumRole: "advisor" },
    ],
  },
];

function FintechBrand({ collapsed }: { collapsed: boolean }) {
  return <div className="fintech-v2-brand"><div className="fintech-brand-mark"><ShieldCheck className="size-5" /></div>{!collapsed && <div><strong>FAMILY</strong><span>WEALTH INTELLIGENCE</span></div>}</div>;
}

function FintechNav({ collapsed, role, location, onNavigate, savedScrollTop, onScrollPositionChange }: { collapsed: boolean; role: MinimumRole; location: string; onNavigate: (path: string) => void; savedScrollTop: number; onScrollPositionChange: (scrollTop: number) => void }) {
  const navRef = useRef<HTMLElement>(null);
  const visibleGroups = navigationGroups.map(group => ({ ...group, items: group.items.filter(item => roleRank[role] >= roleRank[item.minimumRole]) })).filter(group => group.items.length > 0);
  const allItems = [homeItem, ...visibleGroups.flatMap(group => group.items)];
  useEffect(() => {
    const navigation = navRef.current;
    if (navigation) navigation.scrollTop = savedScrollTop;
  }, [collapsed, savedScrollTop]);
  const rememberScroll = () => onScrollPositionChange(navRef.current?.scrollTop ?? 0);
  if (collapsed) return <nav ref={navRef} onScroll={rememberScroll} className="fintech-v2-icon-nav" aria-label="التنقل الرئيسي">{allItems.map(item => { const Icon = item.icon; return <button key={item.path} className={location === item.path ? "is-active" : ""} title={item.label} aria-label={item.label} onClick={() => onNavigate(item.path)}><Icon className="size-[18px]" /></button>; })}</nav>;
  return <nav ref={navRef} onScroll={rememberScroll} className="fintech-v2-nav" aria-label="التنقل الرئيسي"><button className={`fintech-v2-home ${location === "/" ? "is-active" : ""}`} onClick={() => onNavigate("/")}><LayoutDashboard className="size-4" /><span>{homeItem.label}</span><ChevronLeft className="size-4" /></button><Accordion type="multiple" defaultValue={visibleGroups.map(group => group.id)}>{visibleGroups.map(group => { const GroupIcon = group.icon; return <AccordionItem value={group.id} key={group.id}><AccordionTrigger className="fintech-v2-group-trigger"><span><GroupIcon className="size-4" />{group.label}</span></AccordionTrigger><AccordionContent className="fintech-v2-group-content">{group.items.map(item => { const Icon = item.icon; return <button key={item.path} className={location === item.path ? "is-active" : ""} onClick={() => onNavigate(item.path)}><Icon className="size-4" /><span>{item.label}</span></button>; })}</AccordionContent></AccordionItem>; })}</Accordion></nav>;
}

function UserControls({ collapsed, onLogout }: { collapsed: boolean; onLogout: () => void }) {
  const { theme, toggleTheme } = useTheme();
  const { isDemoMode, toggleDemoMode } = useDemoMode();
  const { user } = useAuth();
  const initial = user?.name?.trim().charAt(0).toUpperCase() || "F";
  return <div className="fintech-v2-user-zone">{!collapsed && <div className="fintech-v2-utility-row"><button className={isDemoMode ? "is-active" : ""} onClick={toggleDemoMode}><Sparkles className="size-3.5" />{isDemoMode ? "العرض التجريبي مفعل" : "معاينة تجريبية"}</button><button aria-label="تبديل الوضع اللوني" onClick={toggleTheme}>{theme === "dark" ? <Sun className="size-3.5" /> : <Moon className="size-3.5" />}</button></div>}<div className="fintech-v2-user-card"><span className="fintech-v2-avatar">{initial}</span>{!collapsed && <div><strong>{user?.name || "مستخدم FAMILY"}</strong><span>{user?.email || "جلسة آمنة"}</span></div>}<button onClick={onLogout} title="تسجيل الخروج" aria-label="تسجيل الخروج"><LogOut className="size-4" /></button></div></div>;
}

function MobileBottomNav({ role, location, onNavigate, onOpenMore, onQuickCapture }: { role: MinimumRole; location: string; onNavigate: (path: string) => void; onOpenMore: () => void; onQuickCapture: () => void }) {
  const canQuickCapture = roleRank[role] >= roleRank.editor;
  const items = [{ path: "/", label: "الرئيسية", icon: LayoutDashboard }, { path: "/accounts", label: "الحسابات", icon: Landmark }, { path: "/goals", label: "الخطة", icon: Target }];
  return <nav className="fintech-bottom-nav" aria-label="التنقل السفلي"><div>{items.slice(0, 2).map(item => { const Icon = item.icon; return <button key={item.path} className={location === item.path ? "is-active" : ""} onClick={() => onNavigate(item.path)}><Icon className="size-5" /><span>{item.label}</span></button>; })}<button className="fintech-bottom-quick" disabled={!canQuickCapture} title={canQuickCapture ? "تسجيل تدفق جديد" : "يتطلب صلاحية محرر"} onClick={() => canQuickCapture && onQuickCapture()}><PlusCircle className="size-6" /><span>إدخال</span></button>{items.slice(2).map(item => { const Icon = item.icon; return <button key={item.path} className={location === item.path ? "is-active" : ""} onClick={() => onNavigate(item.path)}><Icon className="size-5" /><span>{item.label}</span></button>; })}<button onClick={onOpenMore}><Menu className="size-5" /><span>المزيد</span></button></div></nav>;
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { loading, user, logout } = useAuth();
  const workspace = trpc.family.bootstrap.useQuery(undefined, { enabled: Boolean(user) });
  const [location, setLocation] = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [quickConfirmOpen, setQuickConfirmOpen] = useState(false);
  const [sidebarScrollTop, setSidebarScrollTop] = useState(() => Number(sessionStorage.getItem("family-sidebar-scroll-top")) || 0);
  const { isPrivate } = usePrivacyMode();
  const role = (workspace.data?.membership.role ?? "viewer") as MinimumRole;
  const allItems = [homeItem, ...navigationGroups.flatMap(group => group.items)];
  const normalizedLocation = location.startsWith("/family/") ? location.replace("/family", "") : location;
  const routeItem = allItems.find(item => item.path === location || item.path === normalizedLocation);
  const currentGroup = navigationGroups.find(group => group.items.some(item => item.path === location || item.path === normalizedLocation));
  const canAccessCurrentRoute = !routeItem || roleRank[role] >= roleRank[routeItem.minimumRole];
  const currentLabel = canAccessCurrentRoute ? (routeItem?.label ?? (location === "/" ? homeItem.label : "نظرة تفصيلية")) : "وصول محدود";
  const navigate = (path: string) => { setLocation(path); setMobileOpen(false); };
  const rememberSidebarScroll = (scrollTop: number) => {
    setSidebarScrollTop(scrollTop);
    sessionStorage.setItem("family-sidebar-scroll-top", String(scrollTop));
  };

  if (loading) return <div className="fintech-loading-shell"><div className="fintech-loading-rail" /><div className="fintech-loading-content"><i /><div>{Array.from({ length: 4 }).map((_, index) => <b key={index} />)}</div><i /></div></div>;
  if (!user) return <main className="fintech-login-gate" dir="rtl"><section><div className="fintech-brand-mark"><ShieldCheck className="size-6" /></div><p>FAMILY / PRIVATE WEALTH</p><h1>مساحتك المالية تستحق طبقة حماية واضحة.</h1><span>سجّل الدخول للوصول إلى بياناتك وإجراءاتك داخل نطاق FAMILY الخاص بك.</span><Button onClick={() => startLogin()} className="fintech-login-button">متابعة آمنة</Button></section></main>;

  return <div className={`fintech-app-shell ${isPrivate ? "privacy-mode" : ""}`} dir="rtl"><aside className={`fintech-v2-sidebar ${collapsed ? "is-collapsed" : ""}`}><header><FintechBrand collapsed={collapsed} /><button className="fintech-v2-collapse" onClick={() => setCollapsed(value => !value)} aria-label={collapsed ? "توسيع القائمة" : "طي القائمة"}>{collapsed ? <PanelRightOpen className="size-4" /> : <PanelRightClose className="size-4" />}</button></header><FintechNav collapsed={collapsed} role={role} location={location} onNavigate={navigate} savedScrollTop={sidebarScrollTop} onScrollPositionChange={rememberSidebarScroll} /><UserControls collapsed={collapsed} onLogout={logout} /></aside>
    <Sheet open={mobileOpen} onOpenChange={setMobileOpen}><SheetContent side="right" className="fintech-v2-mobile-sheet" dir="rtl"><div className="fintech-v2-mobile-body"><FintechBrand collapsed={false} /><FintechNav collapsed={false} role={role} location={location} onNavigate={navigate} savedScrollTop={sidebarScrollTop} onScrollPositionChange={rememberSidebarScroll} /><UserControls collapsed={false} onLogout={logout} /></div></SheetContent></Sheet>
    <main className="fintech-v2-main"><header className="fintech-topbar"><div className="flex min-w-0 items-center gap-3"><button onClick={() => setMobileOpen(true)} className="fintech-mobile-menu" aria-label="فتح التنقل"><Menu className="size-5" /></button><div className="min-w-0"><p>FAMILY / {workspace.data?.workspace.name || "WEALTH"} · {workspace.data?.workspace.baseCurrency || "EGP"}{currentGroup ? ` · ${currentGroup.label}` : ""}</p><strong>{currentLabel}</strong></div></div><div className="flex items-center gap-2"><TopbarControls /></div></header><div className="fintech-content-shell" data-route={location}>{canAccessCurrentRoute ? <section className="fintech-route-frame">{children}</section> : <section className="fintech-access-card"><ShieldCheck className="size-9" /><h1>الوصول للقراءة فقط</h1><p>هذه الشاشة تتطلب صلاحية أعلى. يمكنك مراجعة الحسابات والتقرير المالي ضمن الصلاحيات الممنوحة لك.</p></section>}</div></main><MobileBottomNav role={role} location={location} onNavigate={navigate} onOpenMore={() => setMobileOpen(true)} onQuickCapture={() => setQuickConfirmOpen(true)} /><Dialog open={quickConfirmOpen} onOpenChange={setQuickConfirmOpen}><DialogContent dir="rtl" className="sm:max-w-md"><DialogHeader><DialogTitle>بدء إدخال مالي سريع</DialogTitle><DialogDescription>ستنتقل إلى نموذج مراجعة العملية. لن يُنشر أي قيد قبل إدخال الحساب والمبلغ وتأكيد النموذج.</DialogDescription></DialogHeader><DialogFooter className="gap-2 sm:justify-start"><Button variant="outline" onClick={() => setQuickConfirmOpen(false)}>إلغاء</Button><Button onClick={() => { setQuickConfirmOpen(false); navigate("/cash-flow/record"); }}>متابعة إلى النموذج</Button></DialogFooter></DialogContent></Dialog></div>;
}

function TopbarControls() {
  const { theme, toggleTheme } = useTheme();
  const { isDemoMode, toggleDemoMode } = useDemoMode();
  const { isPrivate, togglePrivacy } = usePrivacyMode();
  return <><button onClick={toggleDemoMode} className={`fintech-topbar-button ${isDemoMode ? "is-active" : ""}`}><Sparkles className="size-4" /><span className="hidden sm:inline">تجريبي</span></button><button onClick={togglePrivacy} className={`fintech-topbar-button ${isPrivate ? "is-active" : ""}`} aria-pressed={isPrivate} aria-label={isPrivate ? "إظهار القيم" : "إخفاء القيم"}><EyeOff className="size-4" /><span className="hidden sm:inline">{isPrivate ? "إظهار" : "خصوصية"}</span></button><button onClick={toggleTheme} className="fintech-topbar-button" aria-label="تبديل الوضع اللوني">{theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}</button></>;
}
