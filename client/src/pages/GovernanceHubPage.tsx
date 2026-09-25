import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileChartColumn, ShieldCheck, FileLock2, Scale, UsersRound, CheckCircle2, HardDriveDownload } from "lucide-react";
import { ReportsPage } from "./ReportsPage";
import { AuditPage } from "./family/AuditPage";
import VaultPage from "./VaultPage";
import MembersPageRedesign from "./MembersPageRedesign";
import ApprovalsPage from "./ApprovalsPage";
import FamilyExportPage from "./FamilyExportPage";
import { ShariaZakatHawlHub } from "@/components/governance/ShariaZakatHawlHub";
import { Coins } from "lucide-react";

const TAB_TRIGGER_CLS =
  "gap-1.5 py-2 px-4 rounded-xl text-xs font-medium transition-colors border border-transparent " +
  "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white " +
  "data-[state=active]:bg-white dark:data-[state=active]:bg-[#1A2234] " +
  "data-[state=active]:text-slate-900 dark:data-[state=active]:text-white " +
  "data-[state=active]:font-bold data-[state=active]:shadow-xs " +
  "data-[state=active]:border-slate-200/60 dark:data-[state=active]:border-slate-700/60";

const normalizeGovTab = (tab: string | null): string => {
  if (!tab) return "reports";
  if (tab === "statements" || tab === "reports") return "reports";
  if (tab === "audit" || tab === "vault" || tab === "members" || tab === "approvals" || tab === "backup" || tab === "export" || tab === "zakat") {
    if (tab === "export") return "backup";
    return tab;
  }
  return "reports";
};

export default function GovernanceHubPage() {
  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      return normalizeGovTab(params.get("tab"));
    }
    return "reports";
  });

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", tab);
      window.history.pushState({}, "", url.pathname + url.search);
    }
  };

  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      setActiveTab(normalizeGovTab(params.get("tab")));
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  return (
    <DashboardLayout>
      <div dir="rtl" className="mx-auto max-w-7xl space-y-6 pb-16 px-1">
        {/* Hub Header */}
        <div className="flex flex-col gap-1 border-b border-slate-200/80 dark:border-slate-800 pb-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-violet-500/10 border border-violet-500/20 text-violet-600 dark:text-violet-400">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                التقارير والحوكمة
              </h1>
              <p className="text-slate-500 dark:text-slate-400 text-xs font-medium mt-0.5">
                القوائم المالية المدققة · سجل التدقيق · الخزنة والمستندات · أفراد العائلة والصلاحيات · مركز الاعتمادات
              </p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
          <TabsList className="bg-slate-100/90 dark:bg-[#0E1420] p-1.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 flex flex-wrap gap-1 h-auto w-full justify-start">
            <TabsTrigger value="reports" className={TAB_TRIGGER_CLS}>
              <FileChartColumn className="w-3.5 h-3.5" />
              القوائم المالية والميزانية
            </TabsTrigger>
            <TabsTrigger value="audit" className={TAB_TRIGGER_CLS}>
              <ShieldCheck className="w-3.5 h-3.5" />
              سجل التدقيق المحاسبي
            </TabsTrigger>
            <TabsTrigger value="vault" className={TAB_TRIGGER_CLS}>
              <FileLock2 className="w-3.5 h-3.5" />
              الخزنة والمستندات
            </TabsTrigger>
            <TabsTrigger value="zakat" className={TAB_TRIGGER_CLS}>
              <Coins className="w-3.5 h-3.5 text-amber-500" />
              الزكاة الشرعية وحول الذهب
            </TabsTrigger>
            <TabsTrigger value="members" className={TAB_TRIGGER_CLS}>
              <UsersRound className="w-3.5 h-3.5" />
              أفراد العائلة والصلاحيات
            </TabsTrigger>
            <TabsTrigger value="approvals" className={TAB_TRIGGER_CLS}>
              <CheckCircle2 className="w-3.5 h-3.5" />
              مركز الموافقات والاعتمادات
            </TabsTrigger>
            <TabsTrigger value="backup" className={TAB_TRIGGER_CLS}>
              <HardDriveDownload className="w-3.5 h-3.5" />
              النسخ الاحتياطي والتصدير
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: Financial Statements & Balance Sheet */}
          <TabsContent value="reports">
            <ReportsPage embedded />
          </TabsContent>
          <TabsContent value="statements">
            <ReportsPage embedded />
          </TabsContent>

          {/* TAB 2: Audit Trail & Ledger */}
          <TabsContent value="audit">
            <AuditPage embedded />
          </TabsContent>

          {/* TAB 3: Vault & Administration */}
          <TabsContent value="vault">
            <VaultPage embedded />
          </TabsContent>

          {/* TAB: Sharia Zakat & Gold Hawl Engine */}
          <TabsContent value="zakat" className="space-y-6">
            <ShariaZakatHawlHub />
          </TabsContent>

          {/* TAB 4: Family Members & Workspaces */}
          <TabsContent value="members">
            <MembersPageRedesign embedded />
          </TabsContent>

          {/* TAB 5: Approvals Workflow */}
          <TabsContent value="approvals">
            <ApprovalsPage embedded />
          </TabsContent>

          {/* TAB 6: Backup & Data Export */}
          <TabsContent value="backup">
            <FamilyExportPage embedded />
          </TabsContent>
          <TabsContent value="export">
            <FamilyExportPage embedded />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
