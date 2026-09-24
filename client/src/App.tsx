import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import { lazy, Suspense } from "react";
import ErrorBoundary from "./components/ErrorBoundary";
import { DemoModeProvider } from "./contexts/DemoModeContext";
import { PrivacyModeProvider } from "./contexts/PrivacyModeContext";
import { ThemeProvider } from "./contexts/ThemeContext";

const FamilyHomeGate = lazy(() => import("./pages/FamilyHomeGate"));
const LoginPage = lazy(() => import("./pages/LoginPage"));
const AccountsPage = lazy(() => import("./pages/family/AccountsPage"));
const LedgerPage = lazy(() => import("./pages/family/LedgerPage"));
const CashFlowPage = lazy(() => import("./pages/family/CashFlowPage"));
const CashFlowRegisterPage = lazy(() => import("./pages/family/CashFlowRegisterPage"));
const RecurringRulesPage = lazy(() => import("./pages/family/RecurringRulesPage"));
const DebtsPage = lazy(() => import("./pages/family/DebtsPage"));
const CertificatesPage = lazy(() => import("./pages/family/CertificatesPage"));
const EmergencyFundPage = lazy(() => import("./pages/family/EmergencyFundPage"));
const TransfersPage = lazy(() => import("./pages/family/TransfersPage"));
const InvestmentsPage = lazy(() => import("./pages/InvestmentsPageRedesign"));
const TradingPage = lazy(() => import("./pages/TradingPageRedesign"));
const ValuationPage = lazy(() => import("./pages/ValuationPageRedesign"));
const GoalsPlanningPage = lazy(() => import("./pages/family/GoalsPlanningPage"));
const RiskAllocationPage = lazy(() => import("./pages/family/RiskAllocationPage"));
const FeeTaxRulesPage = lazy(() => import("./pages/family/FeeTaxRulesPage"));
const AssetsInsurancePage = lazy(() => import("./pages/family/AssetsInsurancePage"));
const RebalanceReviewPage = lazy(() => import("./pages/family/RebalanceReviewPage"));
const MembersPage = lazy(() => import("./pages/MembersPageRedesign"));
const ReportsPage = lazy(() => import("./pages/ReportsPage"));
const AuditPage = lazy(() => import("./pages/family/AuditPage"));
const BankImportInbox = lazy(() => import("./pages/BankImportInbox"));
const GovernanceApprovals = lazy(() => import("./pages/ApprovalsPage"));
const ScenarioPlanning = lazy(() => import("./pages/ScenariosPage"));
const OperationsCenter = lazy(() => import("./pages/OperationsCenter"));
const VaultPage = lazy(() => import("./pages/VaultPage"));
const FamilyExportPage = lazy(() => import("./pages/FamilyExportPage"));
const SettlementPage = lazy(() => import("./pages/SettlementPage"));
const PlatformAdministrationPage = lazy(() => import("./pages/PlatformAdministrationPage"));
const MarketDataQualityPage = lazy(() => import("./pages/MarketDataQualityPage"));
const ReconciliationPage = lazy(() => import("./pages/ReconciliationPage"));
const LotAccountingPage = lazy(() => import("./pages/LotAccountingPage"));
const WealthHealthPage = lazy(() => import("./pages/WealthHealthPage"));
const PerformancePage = lazy(() => import("./pages/PerformancePage"));
const StressTestingPage = lazy(() => import("./pages/StressTestingPage"));
const ConsolidationPage = lazy(() => import("./pages/ConsolidationPage"));
const AuditorPortalPage = lazy(() => import("./pages/AuditorPortalPage"));
const TransactionsHubPage = lazy(() => import("./pages/TransactionsHubPage"));
const FxManagementPage = lazy(() => import("./pages/FxManagementPage"));
const SwingTradingPage = lazy(() => import("./pages/SwingTradingPage"));
const QuantitativeHubPage = lazy(() => import("./pages/QuantitativeHubPage"));

function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <Suspense fallback={<div className="fintech-route-loading" role="status" aria-label="جارٍ تحميل الشاشة"><i /><i /><i /></div>}><Switch>
      <Route path={"/"} component={FamilyHomeGate} />
      <Route path={"/overview"} component={FamilyHomeGate} />
      <Route path={"/login"} component={LoginPage} />
      <Route path={"/auth"} component={LoginPage} />
      <Route path={"/quant"} component={QuantitativeHubPage} />
      <Route path={"/gold"} component={QuantitativeHubPage} />
      <Route path={"/intelligence"} component={QuantitativeHubPage} />
      <Route path={"/advisory"} component={QuantitativeHubPage} />
      <Route path={"/advisor"} component={QuantitativeHubPage} />
      <Route path={"/family/quant"} component={QuantitativeHubPage} />
      <Route path={"/trading/swing"} component={SwingTradingPage} />
      <Route path={"/family/trading/swing"} component={SwingTradingPage} />
      <Route path={"/swing"} component={SwingTradingPage} />
      <Route path={"/transactions"} component={TransactionsHubPage} />
      <Route path={"/family/transactions"} component={TransactionsHubPage} />
      <Route path={"/accounts"} component={AccountsPage} />
      <Route path={"/ledger"} component={LedgerPage} />
      <Route path={"/cash-flow"} component={CashFlowPage} />
      <Route path={"/cashflow"} component={CashFlowPage} />
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
      <Route path={"/liabilities"} component={DebtsPage} />
      <Route path={"/certificates"} component={CertificatesPage} />
      <Route path={"/banking"} component={CertificatesPage} />
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
      <Route path={"/fee-tax"} component={FeeTaxRulesPage} />
      <Route path={"/assets-insurance"} component={AssetsInsurancePage} />
      <Route path={"/risk/rebalance"} component={RebalanceReviewPage} />
      <Route path={"/members"} component={MembersPage} />
      <Route path={"/reports"} component={ReportsPage} />
      <Route path={"/family/reports"} component={ReportsPage} />
      <Route path={"/wealth-health"} component={WealthHealthPage} />
      <Route path={"/family/wealth-health"} component={WealthHealthPage} />
      <Route path={"/performance"} component={PerformancePage} />
      <Route path={"/family/performance"} component={PerformancePage} />
      <Route path={"/stress-testing"} component={StressTestingPage} />
      <Route path={"/family/stress-testing"} component={StressTestingPage} />
      <Route path={"/consolidation"} component={ConsolidationPage} />
      <Route path={"/family/consolidation"} component={ConsolidationPage} />
      <Route path={"/auditor"} component={AuditorPortalPage} />
      <Route path={"/auditor-portal"} component={AuditorPortalPage} />
      <Route path={"/audit"} component={AuditPage} />
      <Route path={"/settings/fx"} component={FxManagementPage} />
      <Route path={"/exchange-rates"} component={FxManagementPage} />
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
            <Router />
          </TooltipProvider>
        </DemoModeProvider></PrivacyModeProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
