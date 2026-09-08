import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import { lazy, Suspense } from "react";
import ErrorBoundary from "./components/ErrorBoundary";
import { DemoModeProvider } from "./contexts/DemoModeContext";
import { PrivacyModeProvider } from "./contexts/PrivacyModeContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import PriorityAlerts from "./components/PriorityAlerts";

const familyPage = <T extends keyof typeof import("./pages/FamilyPages")>(name: T) => lazy(() => import("./pages/FamilyPages").then(module => ({ default: module[name] as React.ComponentType })));
const FamilyHomeGate = lazy(() => import("./pages/FamilyHomeGate"));
const AccountsPage = familyPage("AccountsPage"); const LedgerPage = familyPage("LedgerPage"); const CashFlowPage = familyPage("CashFlowPage"); const CashFlowRegisterPage = familyPage("CashFlowRegisterPage"); const RecurringRulesPage = familyPage("RecurringRulesPage"); const DebtsPage = familyPage("DebtsPage"); const EmergencyFundPage = familyPage("EmergencyFundPage"); const TransfersPage = familyPage("TransfersPage"); const InvestmentsPage = lazy(() => import("./pages/InvestmentsPageRedesign")); const TradingPage = lazy(() => import("./pages/TradingPageRedesign")); const ValuationPage = lazy(() => import("./pages/ValuationPageRedesign")); const GoalsPlanningPage = familyPage("GoalsPlanningPage"); const RiskAllocationPage = familyPage("RiskAllocationPage"); const ResearchPage = familyPage("ResearchPage"); const WatchlistPricingPage = familyPage("WatchlistPricingPage"); const FeeTaxRulesPage = familyPage("FeeTaxRulesPage"); const AssetsInsurancePage = familyPage("AssetsInsurancePage"); const RebalanceReviewPage = familyPage("RebalanceReviewPage"); const MembersPage = lazy(() => import("./pages/MembersPageRedesign")); const ReportsPage = familyPage("ReportsPage"); const AuditPage = familyPage("AuditPage");
const BankImportInbox = lazy(() => import("./pages/BankImportInbox"));
const GovernanceApprovals = lazy(() => import("./pages/ApprovalsPage"));
const ScenarioPlanning = lazy(() => import("./pages/ScenariosPage"));
const OperationsCenter = lazy(() => import("./pages/OperationsCenter"));
const VaultPage = lazy(() => import("./pages/VaultPage"));
const FamilyExportPage = lazy(() => import("./pages/FamilyExportPage"));
const SettlementPage = lazy(() => import("./pages/SettlementPage"));
const AssessmentReport = lazy(() => import("./pages/Home"));
const PlatformAdministrationPage = lazy(() => import("./pages/PlatformAdministrationPage"));
const MarketDataQualityPage = lazy(() => import("./pages/MarketDataQualityPage"));
const ReconciliationPage = lazy(() => import("./pages/ReconciliationPage"));
const LotAccountingPage = lazy(() => import("./pages/LotAccountingPage"));

function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <Suspense fallback={<div className="fintech-route-loading" role="status" aria-label="جارٍ تحميل الشاشة"><i /><i /><i /></div>}><Switch>
      <Route path={"/"} component={FamilyHomeGate} />
      <Route path={"/accounts"} component={AccountsPage} />
      <Route path={"/ledger"} component={LedgerPage} />
      <Route path={"/cash-flow"} component={CashFlowPage} />
      <Route path={"/cash-flow/record"} component={CashFlowRegisterPage} />
      <Route path={"/cash-flow/recurring"} component={RecurringRulesPage} />
      <Route path={"/imports"} component={BankImportInbox} />
      <Route path={"/approvals"} component={GovernanceApprovals} />
      <Route path={"/scenarios"} component={ScenarioPlanning} />
      <Route path={"/operations"} component={OperationsCenter} />
      <Route path={"/vault"} component={VaultPage} />
      <Route path={"/export"} component={FamilyExportPage} />
      <Route path={"/settlements"} component={SettlementPage} />
      <Route path={"/debts"} component={DebtsPage} />
      <Route path={"/emergency-fund"} component={EmergencyFundPage} />
      <Route path={"/transfers"} component={TransfersPage} />
      <Route path={"/investments"} component={InvestmentsPage} />
      <Route path={"/trades"} component={TradingPage} />
      <Route path={"/valuation"} component={ValuationPage} />
      <Route path={"/data-quality"} component={MarketDataQualityPage} />
      <Route path={"/reconciliation"} component={ReconciliationPage} />
      <Route path={"/lot-accounting"} component={LotAccountingPage} />
      <Route path={"/goals"} component={GoalsPlanningPage} />
      <Route path={"/risk"} component={RiskAllocationPage} />
      <Route path={"/research"} component={ResearchPage} />
      <Route path={"/research/prices"} component={WatchlistPricingPage} />
      <Route path={"/fee-tax"} component={FeeTaxRulesPage} />
      <Route path={"/assets-insurance"} component={AssetsInsurancePage} />
      <Route path={"/risk/rebalance"} component={RebalanceReviewPage} />
      <Route path={"/members"} component={MembersPage} />
      <Route path={"/reports"} component={ReportsPage} />
      <Route path={"/family/reports"} component={ReportsPage} />
      <Route path={"/audit"} component={AuditPage} />
      <Route path={"/assessment"} component={AssessmentReport} />
      <Route path={"/admin/users"} component={PlatformAdministrationPage} />
      <Route path={"/404"} component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch></Suspense>
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="light"
        switchable
      >
        <PrivacyModeProvider><DemoModeProvider>
          <TooltipProvider>
            <Toaster />
            <PriorityAlerts />
            <Router />
          </TooltipProvider>
        </DemoModeProvider></PrivacyModeProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
