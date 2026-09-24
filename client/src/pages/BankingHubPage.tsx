import React, { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import PageHeader from "@/components/PageHeader";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Landmark, Coins, WalletCards, CreditCard, Umbrella, ArrowDownLeft, ShieldCheck } from "lucide-react";
import AccountsPage from "./family/AccountsPage";
import BankCertificatesHub from "@/components/banking/BankCertificatesHub";
import CashFlowPage from "./family/CashFlowPage";
import EmergencyFundPage from "./family/EmergencyFundPage";
import DebtsPage from "./family/DebtsPage";

export type BankingTabKey = "accounts" | "certificates" | "liquidity" | "debts";

export default function BankingHubPage() {
  const [activeTab, setActiveTab] = useState<BankingTabKey>(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get("tab") as BankingTabKey;
      if (["accounts", "certificates", "liquidity", "debts"].includes(tab)) {
        return tab;
      }
    }
    return "accounts";
  });

  const [liquiditySubTab, setLiquiditySubTab] = useState<"cashflow" | "emergency">("cashflow");

  // Sync tab with URL search parameter
  const handleTabChange = (val: string) => {
    const tabKey = val as BankingTabKey;
    setActiveTab(tabKey);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", tabKey);
      window.history.pushState({}, "", url.pathname + url.search);
      window.dispatchEvent(new Event("popstate"));
    }
  };

  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get("tab") as BankingTabKey;
      if (tab && ["accounts", "certificates", "liquidity", "debts"].includes(tab)) {
        setActiveTab(tab);
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  return (
    <DashboardLayout>
      <main className="mx-auto max-w-7xl space-y-6" dir="rtl">
        <PageHeader
          title="البنوك والسيولة والتخطيط المالي"
          description="بوابة السيولة والائتمان الموحدة: إدارة الحسابات المصرفية والمحافظ، الشهادات الاستثمارية، التدفقات النقدية وصندوق الطوارئ، والالتزامات والديون."
          breadcrumbs={[
            { label: "الرئيسية", href: "/" },
            { label: "البنوك والسيولة والتخطيط" },
          ]}
          badge={{ text: "بوابة السيولة المؤسسية", variant: "institutional" }}
          icon={Landmark}
        />

        {/* 4 Primary Sub-Hub Tabs */}
        <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
          <TabsList className="bg-slate-100/90 dark:bg-[#0E1420] p-1.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 flex flex-wrap gap-1 mb-6 h-auto w-full justify-start">
            <TabsTrigger
              value="accounts"
              className="data-[state=active]:bg-white data-[state=active]:dark:bg-[#1A2234] data-[state=active]:text-slate-900 data-[state=active]:dark:text-white data-[state=active]:font-bold data-[state=active]:shadow-xs data-[state=active]:border-slate-200/60 data-[state=active]:dark:border-slate-700/60 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-medium text-xs px-4 py-2.5 rounded-xl transition-all border border-transparent flex items-center gap-2"
            >
              <Landmark className="size-4" />
              <span>الحسابات البنكية والمحافظ</span>
            </TabsTrigger>

            <TabsTrigger
              value="certificates"
              className="data-[state=active]:bg-white data-[state=active]:dark:bg-[#1A2234] data-[state=active]:text-slate-900 data-[state=active]:dark:text-white data-[state=active]:font-bold data-[state=active]:shadow-xs data-[state=active]:border-slate-200/60 data-[state=active]:dark:border-slate-700/60 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-medium text-xs px-4 py-2.5 rounded-xl transition-all border border-transparent flex items-center gap-2"
            >
              <Coins className="size-4" />
              <span>الشهادات والودائع</span>
            </TabsTrigger>

            <TabsTrigger
              value="liquidity"
              className="data-[state=active]:bg-white data-[state=active]:dark:bg-[#1A2234] data-[state=active]:text-slate-900 data-[state=active]:dark:text-white data-[state=active]:font-bold data-[state=active]:shadow-xs data-[state=active]:border-slate-200/60 data-[state=active]:dark:border-slate-700/60 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-medium text-xs px-4 py-2.5 rounded-xl transition-all border border-transparent flex items-center gap-2"
            >
              <WalletCards className="size-4" />
              <span>السيولة والتخطيط المالي</span>
            </TabsTrigger>

            <TabsTrigger
              value="debts"
              className="data-[state=active]:bg-white data-[state=active]:dark:bg-[#1A2234] data-[state=active]:text-slate-900 data-[state=active]:dark:text-white data-[state=active]:font-bold data-[state=active]:shadow-xs data-[state=active]:border-slate-200/60 data-[state=active]:dark:border-slate-700/60 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-medium text-xs px-4 py-2.5 rounded-xl transition-all border border-transparent flex items-center gap-2"
            >
              <CreditCard className="size-4" />
              <span>الالتزامات والديون</span>
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: الحسابات البنكية والمحافظ */}
          <TabsContent value="accounts" className="space-y-6">
            <AccountsPage embedded />
          </TabsContent>

          {/* TAB 2: الشهادات والودائع */}
          <TabsContent value="certificates" className="space-y-6">
            <BankCertificatesHub />
          </TabsContent>

          {/* TAB 3: السيولة والتخطيط المالي (Merged: Cashflow + Emergency Reserve + Budget) */}
          <TabsContent value="liquidity" className="space-y-6">
            {/* Secondary Segmented Toggle for Cashflow & Budget vs Emergency Fund */}
            <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-900/40 p-2 rounded-2xl border border-slate-200/80 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setLiquiditySubTab("cashflow")}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    liquiditySubTab === "cashflow"
                      ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs border border-slate-200/80 dark:border-slate-700"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  <ArrowDownLeft className="size-3.5" />
                  <span>التدفق النقدي والميزانية</span>
                </button>
                <button
                  type="button"
                  onClick={() => setLiquiditySubTab("emergency")}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    liquiditySubTab === "emergency"
                      ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs border border-slate-200/80 dark:border-slate-700"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  <Umbrella className="size-3.5" />
                  <span>صندوق واحتياطي الطوارئ</span>
                </button>
              </div>
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 hidden sm:inline">
                {liquiditySubTab === "cashflow" ? "متابعة الإيرادات والمصروفات والخطط" : "مقياس المرونة وحماية الثروة"}
              </span>
            </div>

            {liquiditySubTab === "cashflow" ? (
              <CashFlowPage embedded />
            ) : (
              <EmergencyFundPage embedded />
            )}
          </TabsContent>

          {/* TAB 4: الالتزامات والديون */}
          <TabsContent value="debts" className="space-y-6">
            <DebtsPage embedded />
          </TabsContent>
        </Tabs>
      </main>
    </DashboardLayout>
  );
}
