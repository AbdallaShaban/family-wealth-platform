import { describe, expect, it } from "vitest";
import Decimal from "decimal.js";
import {
  calculateBookBalanceSheet,
  calculateIncomeStatement,
  calculateStatementOfChangesInEquity,
  calculateStatementOfCashFlows,
  calculateEconomicNetWorthBridge,
  verifyAccountingInvariants,
  validateAndResolveDateContract,
  resolvePeriodKey,
  exportFinancialStatementsJson,
  exportFinancialStatementsCsv,
  toDec,
  type AccountRow,
  type JournalLineRow,
  type InvestmentLotRow,
  type LotMatchRow,
  type SpecialAssetRow,
  type PriceQuoteMap,
  type FxRateMap,
} from "../financialStatementsMath";

describe("Phase 9A — Financial Statements & Analytical Reconciliation Engine", () => {
  // Base accounts setup
  const baseCurrency = "USD";
  const accounts: AccountRow[] = [
    { id: 1, workspaceId: 1, name: "Checking Bank Account", accountType: "bank", currency: "USD", isSystemAccount: "no" },
    { id: 2, workspaceId: 1, name: "Brokerage Cash Wallet", accountType: "brokerage", currency: "USD", isSystemAccount: "no" },
    { id: 3, workspaceId: 1, name: "Savings Bank Account (EUR)", accountType: "bank", currency: "EUR", isSystemAccount: "no" },
    { id: 4, workspaceId: 1, name: "INVESTMENT_CLEARING:USD", accountType: "clearing", currency: "USD", isSystemAccount: "yes" },
    { id: 5, workspaceId: 1, name: "Real Estate Villa Account", accountType: "asset", currency: "USD", isSystemAccount: "no" },
    { id: 6, workspaceId: 1, name: "Commercial Bank Loan", accountType: "loan", currency: "USD", isSystemAccount: "no" },
    { id: 7, workspaceId: 1, name: "Family Contributed Capital", accountType: "equity", currency: "USD", isSystemAccount: "no" },
    { id: 8, workspaceId: 1, name: "Operating Rental Income", accountType: "income", currency: "USD", isSystemAccount: "no" },
    { id: 9, workspaceId: 1, name: "DIVIDEND_INCOME:USD", accountType: "income", currency: "USD", isSystemAccount: "yes" },
    { id: 10, workspaceId: 1, name: "Administrative Office Expense", accountType: "expense", currency: "USD", isSystemAccount: "no" },
    { id: 11, workspaceId: 1, name: "TRADING_FEES:USD", accountType: "expense", currency: "USD", isSystemAccount: "yes" },
    { id: 12, workspaceId: 1, name: "TRADING_TAX:USD", accountType: "expense", currency: "USD", isSystemAccount: "yes" },
    { id: 13, workspaceId: 1, name: "INTEREST_EXPENSE:USD", accountType: "expense", currency: "USD", isSystemAccount: "yes" },
  ];

  // Helper to create journal lines
  let nextLineId = 1;
  const line = (
    entryId: number,
    accountId: number,
    direction: "debit" | "credit",
    amount: string,
    postedAt: number,
    currency = "USD",
    fxRateToBase = "1",
    baseAmount = amount
  ): JournalLineRow => ({
    id: nextLineId++,
    entryId,
    accountId,
    direction,
    amount,
    currency,
    fxRateToBase,
    baseAmount,
    postedAt,
  });

  // ==========================================================================
  // 1. ACCOUNTING & BALANCE SHEET TESTS (Invariant A & B)
  // ==========================================================================
  describe("Invariant A & B: Double-Entry Balance Sheet Equation", () => {
    it("preserves Invariant A (Assets = Liabilities + Equity) under initial capital contribution", () => {
      // Entry 1: Owner contributes 100,000 USD to Checking
      const t1 = 1000;
      const lines: JournalLineRow[] = [
        line(1, 1, "debit", "100000.0000", t1),
        line(1, 7, "credit", "100000.0000", t1),
      ];

      const bs = calculateBookBalanceSheet({
        asOfTimestamp: t1,
        baseCurrency,
        accounts,
        journalLines: lines,
      });

      expect(bs.equationCheck.assetsEqualsLiabilitiesPlusEquity).toBe(true);
      expect(bs.assets.totalBookAssets).toBe("100000.0000");
      expect(bs.liabilities.totalBookLiabilities).toBe("0.0000");
      expect(bs.equity.totalBookEquity).toBe("100000.0000");
      expect(toDec(bs.equationCheck.imbalanceBase).isZero()).toBe(true);
    });

    it("preserves Invariant A across operating income, expense, and borrowing", () => {
      const t1 = 1000;
      const t2 = 2000;
      const t3 = 3000;
      const t4 = 4000;

      const lines: JournalLineRow[] = [
        // 1. Initial capital: 50,000
        line(1, 1, "debit", "50000.0000", t1),
        line(1, 7, "credit", "50000.0000", t1),
        // 2. Bank loan borrowing: 20,000
        line(2, 1, "debit", "20000.0000", t2),
        line(2, 6, "credit", "20000.0000", t2),
        // 3. Rental income received in cash: 10,000
        line(3, 1, "debit", "10000.0000", t3),
        line(3, 8, "credit", "10000.0000", t3),
        // 4. Operating office expense paid in cash: 3,000
        line(4, 10, "debit", "3000.0000", t4),
        line(4, 1, "credit", "3000.0000", t4),
      ];

      const bs = calculateBookBalanceSheet({
        asOfTimestamp: t4,
        baseCurrency,
        accounts,
        journalLines: lines,
      });

      // Cash = 50000 + 20000 + 10000 - 3000 = 77000
      expect(bs.assets.cashAndEquivalents.totalBase).toBe("77000.0000");
      expect(bs.assets.totalBookAssets).toBe("77000.0000");
      expect(bs.liabilities.totalBookLiabilities).toBe("20000.0000");
      // Equity = 50000 (capital) + 7000 (retained net income) = 57000
      expect(bs.equity.contributedCapital).toBe("50000.0000");
      expect(bs.equity.cumulativeRetainedOperatingIncome).toBe("7000.0000");
      expect(bs.equity.totalBookEquity).toBe("57000.0000");

      expect(bs.equationCheck.assetsEqualsLiabilitiesPlusEquity).toBe(true);
      // Assets (77000) = Liabilities (20000) + Equity (57000)
      expect(toDec(bs.equationCheck.imbalanceBase).isZero()).toBe(true);
    });
  });

  // ==========================================================================
  // 2. SECURITIES TRADING (TYPE B) & CLEARING RESIDUAL TESTS
  // ==========================================================================
  describe("Type B Securities Posting Semantics & Clearing Residual", () => {
    it("scenario 1: BUY only preserves Book Balance Sheet equation", () => {
      const t1 = 1000;
      const t2 = 2000;
      const lines: JournalLineRow[] = [
        // Capital 10,000
        line(1, 2, "debit", "10000.0000", t1),
        line(1, 7, "credit", "10000.0000", t1),
        // BUY 100 shares @ 50 USD = 5,000 USD
        line(2, 4, "debit", "5000.0000", t2),
        line(2, 2, "credit", "5000.0000", t2),
      ];

      const bs = calculateBookBalanceSheet({
        asOfTimestamp: t2,
        baseCurrency,
        accounts,
        journalLines: lines,
      });

      expect(bs.assets.cashAndEquivalents.totalBase).toBe("5000.0000");
      expect(bs.assets.investmentClearing.totalBase).toBe("5000.0000");
      expect(bs.assets.totalBookAssets).toBe("10000.0000");
      expect(bs.equity.totalBookEquity).toBe("10000.0000");
      expect(bs.equationCheck.assetsEqualsLiabilitiesPlusEquity).toBe(true);
    });

    it("scenario 2: BUY then Profitable COMPLETE SELL preserves Book BS without synthetic equity", () => {
      // Owner contribution: 100
      // BUY: 100 (10 units @ 10)
      // SELL: 120 (10 units @ 12), fee 2, tax 1 -> cash proceeds = 117
      const t1 = 1000;
      const t2 = 2000;
      const t3 = 3000;

      const lines: JournalLineRow[] = [
        line(1, 2, "debit", "100.0000", t1),
        line(1, 7, "credit", "100.0000", t1),
        // BUY: 100
        line(2, 4, "debit", "100.0000", t2),
        line(2, 2, "credit", "100.0000", t2),
        // Type B SELL: Debit Cash 117, Debit Fee 2, Debit Tax 1, Credit Clearing 120
        line(3, 2, "debit", "117.0000", t3),
        line(3, 11, "debit", "2.0000", t3),
        line(3, 12, "debit", "1.0000", t3),
        line(3, 4, "credit", "120.0000", t3),
      ];

      const bs = calculateBookBalanceSheet({
        asOfTimestamp: t3,
        baseCurrency,
        accounts,
        journalLines: lines,
      });

      // Cash = 0 + 117 = 117
      expect(bs.assets.cashAndEquivalents.totalBase).toBe("117.0000");
      // Clearing Residual = 100 - 120 = -20
      expect(bs.assets.investmentClearing.totalBase).toBe("-20.0000");
      // Total Book Assets = 117 + (-20) = 97
      expect(bs.assets.totalBookAssets).toBe("97.0000");
      expect(bs.liabilities.totalBookLiabilities).toBe("0.0000");
      // Book Equity = 100 (Capital) - 3 (Fees/Taxes) = 97
      expect(bs.equity.totalBookEquity).toBe("97.0000");
      expect(bs.equationCheck.assetsEqualsLiabilitiesPlusEquity).toBe(true);

      // FIFO lot matches: realized P&L = 120 - 100 = 20 (gross) or 17 (net)
      const matches: LotMatchRow[] = [
        {
          id: 1,
          sellEventId: 3,
          lotId: 1,
          quantity: "10.0000",
          costBasis: "100.0000",
          grossProceeds: "120.0000",
          allocatedFee: "2.0000",
          allocatedTax: "1.0000",
          realizedPnl: "20.0000",
          currency: "USD",
          matchedAt: t3,
        },
      ];

      // CRITICAL VERIFICATION: lot_matches.realizedPnl is NOT added to Book Equity!
      expect(bs.equity.totalBookEquity).toBe("97.0000");

      // Control H Check: Clearing Balance (-20) = Active Cost (0) - Cumulative Realized P&L (20)
      const bridge = calculateEconomicNetWorthBridge({
        asOfTimestamp: t3,
        baseCurrency,
        bookBalanceSheet: bs,
        activeLots: [],
        lotMatches: matches,
        specialAssets: [],
        quotes: {},
        fxRates: { USD: "1" },
      });

      // Economic Net Worth = Cash (117)
      expect(bridge.economicNetWorth).toBe("117.0000");
      expect(bridge.securitiesAdjustments.clearingSettlementResidual).toBe("-20.0000");
      expect(bridge.securitiesAdjustments.cumulativeRealizedPnl).toBe("20.0000");
      expect(bridge.securitiesAdjustments.activeLotsUnrealizedPnl).toBe("0.0000");
      expect(bridge.bridgeCheck.reconciled).toBe(true);
    });

    it("scenario 3: BUY then Loss-making Complete SELL preserves equation", () => {
      // Contribution: 100
      // BUY: 100
      // SELL: 80 (proceeds 80, clearing credited 80)
      const t1 = 1000;
      const t2 = 2000;
      const t3 = 3000;

      const lines: JournalLineRow[] = [
        line(1, 2, "debit", "100.0000", t1),
        line(1, 7, "credit", "100.0000", t1),
        line(2, 4, "debit", "100.0000", t2),
        line(2, 2, "credit", "100.0000", t2),
        line(3, 2, "debit", "80.0000", t3),
        line(3, 4, "credit", "80.0000", t3),
      ];

      const bs = calculateBookBalanceSheet({
        asOfTimestamp: t3,
        baseCurrency,
        accounts,
        journalLines: lines,
      });

      // Cash = 80, Clearing = +20, Total Assets = 100, Equity = 100
      expect(bs.assets.cashAndEquivalents.totalBase).toBe("80.0000");
      expect(bs.assets.investmentClearing.totalBase).toBe("20.0000");
      expect(bs.assets.totalBookAssets).toBe("100.0000");
      expect(bs.equity.totalBookEquity).toBe("100.0000");
      expect(bs.equationCheck.assetsEqualsLiabilitiesPlusEquity).toBe(true);

      const matches: LotMatchRow[] = [
        {
          id: 1,
          sellEventId: 3,
          lotId: 1,
          quantity: "10.0000",
          costBasis: "100.0000",
          grossProceeds: "80.0000",
          allocatedFee: "0.0000",
          allocatedTax: "0.0000",
          realizedPnl: "-20.0000",
          currency: "USD",
          matchedAt: t3,
        },
      ];

      const bridge = calculateEconomicNetWorthBridge({
        asOfTimestamp: t3,
        baseCurrency,
        bookBalanceSheet: bs,
        activeLots: [],
        lotMatches: matches,
        specialAssets: [],
        quotes: {},
        fxRates: { USD: "1" },
      });

      // Economic Net Worth = 80 (actual wealth)
      // Bridge: Book Equity (100) + Realized (-20) = 80
      expect(bridge.economicNetWorth).toBe("80.0000");
      expect(bridge.bridgeCheck.reconciled).toBe(true);
    });

    it("scenario 4: Partial SELL with remaining active lots explicitly separates realized and unrealized P&L", () => {
      // Contribution: 100
      // BUY: 10 units @ 10 = 100
      // SELL: 4 units @ 15 = 60 gross proceeds
      // Active remaining: 6 units @ 10 = 60 cost. Current market price = 18 -> Fair value = 108.
      const t1 = 1000;
      const t2 = 2000;
      const t3 = 3000;

      const lines: JournalLineRow[] = [
        line(1, 2, "debit", "100.0000", t1),
        line(1, 7, "credit", "100.0000", t1),
        line(2, 4, "debit", "100.0000", t2),
        line(2, 2, "credit", "100.0000", t2),
        line(3, 2, "debit", "60.0000", t3),
        line(3, 4, "credit", "60.0000", t3),
      ];

      const bs = calculateBookBalanceSheet({
        asOfTimestamp: t3,
        baseCurrency,
        accounts,
        journalLines: lines,
      });

      // Cash = 60, Clearing = 100 - 60 = 40. Total Book Assets = 100. Book Equity = 100.
      expect(bs.assets.cashAndEquivalents.totalBase).toBe("60.0000");
      expect(bs.assets.investmentClearing.totalBase).toBe("40.0000");
      expect(bs.assets.totalBookAssets).toBe("100.0000");
      expect(bs.equity.totalBookEquity).toBe("100.0000");
      expect(bs.equationCheck.assetsEqualsLiabilitiesPlusEquity).toBe(true);

      const activeLots: InvestmentLotRow[] = [
        {
          id: 1,
          accountId: 2,
          instrumentId: 101,
          acquiredAt: t2,
          originalQuantity: "10.0000",
          remainingQuantity: "6.0000",
          unitCost: "10.0000",
          totalCost: "100.0000",
          costCurrency: "USD",
          status: "open",
        },
      ];

      const matches: LotMatchRow[] = [
        {
          id: 1,
          sellEventId: 3,
          lotId: 1,
          quantity: "4.0000",
          costBasis: "40.0000",
          grossProceeds: "60.0000",
          allocatedFee: "0.0000",
          allocatedTax: "0.0000",
          realizedPnl: "20.0000",
          currency: "USD",
          matchedAt: t3,
        },
      ];

      const quotes: PriceQuoteMap = {
        101: { price: "18.0000", currency: "USD" },
      };

      const bridge = calculateEconomicNetWorthBridge({
        asOfTimestamp: t3,
        baseCurrency,
        bookBalanceSheet: bs,
        activeLots,
        lotMatches: matches,
        specialAssets: [],
        quotes,
        fxRates: { USD: "1" },
      });

      // Active Cost = 60. Active Fair Value = 6 * 18 = 108.
      // Active Unrealized P&L = 108 - 60 = 48.
      // Cumulative Realized P&L = 20.
      // Clearing Residual = 40.
      // Notice: Fair Value (108) - Clearing (40) = 68 = Unrealized (48) + Realized (20).
      expect(bridge.securitiesAdjustments.activeLotsCostBasis).toBe("60.0000");
      expect(bridge.securitiesAdjustments.activeLotsFairValue).toBe("108.0000");
      expect(bridge.securitiesAdjustments.activeLotsUnrealizedPnl).toBe("48.0000");
      expect(bridge.securitiesAdjustments.cumulativeRealizedPnl).toBe("20.0000");
      expect(bridge.securitiesAdjustments.clearingSettlementResidual).toBe("40.0000");

      // Total Economic Net Worth = Cash (60) + Securities Fair Value (108) = 168.
      // Bridge: Book Equity (100) + Realized (20) + Unrealized (48) = 168.
      expect(bridge.economicNetWorth).toBe("168.0000");
      expect(bridge.bridgeCheck.reconciled).toBe(true);
    });
  });

  // ==========================================================================
  // 3. COMPREHENSIVE ECONOMIC NET WORTH BRIDGE TESTS
  // ==========================================================================
  describe("Comprehensive Economic Net Worth Bridge", () => {
    it("reconciles Real Estate appraisal, Gold spot, and multi-currency FX deltas", () => {
      const t1 = 1000;
      const lines: JournalLineRow[] = [
        // Capital: 200,000 USD
        line(1, 1, "debit", "200000.0000", t1),
        line(1, 7, "credit", "200000.0000", t1),
        // Real Estate purchase at cost 150,000 USD
        line(2, 5, "debit", "150000.0000", t1),
        line(2, 1, "credit", "150000.0000", t1),
        // EUR Cash purchase: 20,000 EUR @ 1.10 = 22,000 USD
        line(3, 3, "debit", "20000.0000", t1, "EUR", "1.10", "22000.0000"),
        line(3, 1, "credit", "22000.0000", t1),
      ];

      const bs = calculateBookBalanceSheet({
        asOfTimestamp: t1,
        baseCurrency,
        accounts,
        journalLines: lines,
      });

      expect(bs.equationCheck.assetsEqualsLiabilitiesPlusEquity).toBe(true);

      const specialAssets: SpecialAssetRow[] = [
        {
          id: 1,
          assetAccountId: 5,
          assetType: "real_estate",
          name: "Villa",
          acquisitionCost: "150000.0000",
          latestAppraisalValue: "185000.0000", // +35,000 surplus
          valuationMethod: "appraisal",
        },
      ];

      // Period-end FX: EUR has appreciated from 1.10 to 1.15
      // Cash FX delta = 20,000 * (1.15 - 1.10) = +1,000 USD
      const fxRates: FxRateMap = {
        USD: "1",
        EUR: "1.15",
      };

      const bridge = calculateEconomicNetWorthBridge({
        asOfTimestamp: t1,
        baseCurrency,
        bookBalanceSheet: bs,
        activeLots: [],
        lotMatches: [],
        specialAssets,
        quotes: {},
        fxRates,
      });

      expect(bridge.nonSecuritiesAssetAdjustments.realEstateAppraisalSurplus).toBe("35000.0000");
      expect(bridge.nonSecuritiesAssetAdjustments.cashFxTranslationDelta).toBe("1000.0000");
      // Economic Net Worth = Book Equity (200,000) + RE Surplus (35,000) + Cash FX (1,000) = 236,000
      expect(bridge.economicNetWorth).toBe("236000.0000");
      expect(bridge.bridgeCheck.reconciled).toBe(true);
    });
  });

  // ==========================================================================
  // 4. CASH FLOW STATEMENT & INVARIANT C & D TESTS
  // ==========================================================================
  describe("Statement of Cash Flows & Invariants C & D", () => {
    it("Invariant D: internal cash transfers produce strictly 0.00 net cash impact", () => {
      const t1 = 1000;
      const t2 = 2000;
      const lines: JournalLineRow[] = [
        // Capital 50,000 into Checking (Account 1)
        line(1, 1, "debit", "50000.0000", t1),
        line(1, 7, "credit", "50000.0000", t1),
        // Transfer 15,000 from Checking (Account 1) to Brokerage (Account 2)
        line(2, 2, "debit", "15000.0000", t2),
        line(2, 1, "credit", "15000.0000", t2),
      ];

      const cf = calculateStatementOfCashFlows({
        startTimestamp: 0,
        endTimestamp: 3000,
        baseCurrency,
        accounts,
        journalLines: lines,
      });

      expect(cf.internalTransfers.netCashImpact).toBe("0.0000");
      expect(cf.internalTransfers.totalTransfersBase).toBe("30000.0000");
      expect(cf.reconciliationCheck.reconciled).toBe(true);
      expect(cf.endingCash).toBe("50000.0000");
    });

    it("Invariant C: multi-currency cash reconciliation with FX translation effect", () => {
      const t0 = 0;
      const t1 = 1000;
      const t2 = 2000;

      // Starting cash: 10,000 USD in Checking + 10,000 EUR in Savings (rate 1.05 = 10,500 USD)
      // Beginning Cash = 20,500 USD
      const lines: JournalLineRow[] = [
        line(1, 1, "debit", "10000.0000", t0, "USD", "1", "10000.0000"),
        line(1, 7, "credit", "10000.0000", t0, "USD", "1", "10000.0000"),
        line(2, 3, "debit", "10000.0000", t0, "EUR", "1.05", "10500.0000"),
        line(2, 7, "credit", "10500.0000", t0, "USD", "1", "10500.0000"),
        // Operating income: 5,000 USD received during period
        line(3, 1, "debit", "5000.0000", t1, "USD", "1", "5000.0000"),
        line(3, 8, "credit", "5000.0000", t1, "USD", "1", "5000.0000"),
      ];

      const cf = calculateStatementOfCashFlows({
        startTimestamp: 500,
        endTimestamp: 2500,
        baseCurrency,
        accounts,
        journalLines: lines,
      });

      expect(cf.beginningCash).toBe("20500.0000");
      expect(cf.operatingActivities.operatingReceipts).toBe("5000.0000");
      expect(cf.operatingActivities.netCFO).toBe("5000.0000");
      expect(cf.endingCash).toBe("25500.0000");
      expect(cf.reconciliationCheck.reconciled).toBe(true);
    });

    it("excludes non-cash accruals from Statement of Cash Flows", () => {
      const t1 = 1000;
      const lines: JournalLineRow[] = [
        // Accrued income into receivable (Asset) - neither is a cash equivalent account
        line(1, 5, "debit", "4000.0000", t1),
        line(1, 8, "credit", "4000.0000", t1),
      ];

      const cf = calculateStatementOfCashFlows({
        startTimestamp: 0,
        endTimestamp: 2000,
        baseCurrency,
        accounts,
        journalLines: lines,
      });

      // No cash accounts touched -> All cash flows are 0
      expect(cf.operatingActivities.netCFO).toBe("0.0000");
      expect(cf.beginningCash).toBe("0.0000");
      expect(cf.endingCash).toBe("0.0000");
    });
  });

  // ==========================================================================
  // 5. STATEMENT OF CHANGES IN EQUITY TESTS
  // ==========================================================================
  describe("Statement of Changes in Equity", () => {
    it("reconciles Opening Equity + Contributions - Withdrawals + Net Income = Closing Equity", () => {
      const t1 = 1000;
      const t2 = 2000;
      const t3 = 3000;

      const lines: JournalLineRow[] = [
        // Opening capital: 50,000
        line(1, 1, "debit", "50000.0000", t1),
        line(1, 7, "credit", "50000.0000", t1),
        // Additional capital contribution during period: 20,000
        line(2, 1, "debit", "20000.0000", t2),
        line(2, 7, "credit", "20000.0000", t2),
        // Net operating income during period: 8,000
        line(3, 1, "debit", "8000.0000", t3),
        line(3, 8, "credit", "8000.0000", t3),
      ];

      const openBS = calculateBookBalanceSheet({
        asOfTimestamp: 1500,
        baseCurrency,
        accounts,
        journalLines: lines,
      });

      const closeBS = calculateBookBalanceSheet({
        asOfTimestamp: 3500,
        baseCurrency,
        accounts,
        journalLines: lines,
      });

      const income = calculateIncomeStatement({
        startTimestamp: 1500,
        endTimestamp: 3500,
        baseCurrency,
        accounts,
        journalLines: lines,
      });

      const equityChanges = calculateStatementOfChangesInEquity({
        startTimestamp: 1500,
        endTimestamp: 3500,
        baseCurrency,
        openingBookEquity: toDec(openBS.equity.totalBookEquity),
        closingBookEquity: toDec(closeBS.equity.totalBookEquity),
        netOperatingIncome: toDec(income.netOperatingIncome),
        accounts,
        journalLines: lines,
      });

      expect(equityChanges.openingBookEquity).toBe("50000.0000");
      expect(equityChanges.capitalContributions).toBe("20000.0000");
      expect(equityChanges.netOperatingIncome).toBe("8000.0000");
      expect(equityChanges.closingBookEquity).toBe("78000.0000");
      expect(equityChanges.reconciliationCheck.reconciled).toBe(true);
    });
  });

  // ==========================================================================
  // 6. STRICT API DATE CONTRACT TESTS
  // ==========================================================================
  describe("API Date Contract Validation", () => {
    it("accepts valid Point-in-Time mode (asOf)", () => {
      const res = validateAndResolveDateContract({ asOf: "2026-08-31T23:59:59.000Z" });
      expect(res.mode).toBe("point_in_time");
      expect(res.asOfDate.toISOString()).toBe("2026-08-31T23:59:59.000Z");
      expect(res.startDate.getUTCFullYear()).toBe(2026);
    });

    it("accepts valid Period mode (startDate + endDate)", () => {
      const res = validateAndResolveDateContract({
        startDate: "2026-01-01T00:00:00.000Z",
        endDate: "2026-06-30T23:59:59.000Z",
      });
      expect(res.mode).toBe("period");
      expect(res.startDate.toISOString()).toBe("2026-01-01T00:00:00.000Z");
      expect(res.endDate.toISOString()).toBe("2026-06-30T23:59:59.000Z");
      expect(res.asOfDate.toISOString()).toBe("2026-06-30T23:59:59.000Z");
    });

    it("accepts valid PeriodKey modes (monthly, quarterly, annual)", () => {
      const m = validateAndResolveDateContract({ periodKey: "2026-08" });
      expect(m.mode).toBe("period_key");
      expect(m.startDate.toISOString()).toBe("2026-08-01T00:00:00.000Z");

      const q = validateAndResolveDateContract({ periodKey: "2026-Q3" });
      expect(q.mode).toBe("period_key");
      expect(q.startDate.toISOString()).toBe("2026-07-01T00:00:00.000Z");

      const y = validateAndResolveDateContract({ periodKey: "2026-FY" });
      expect(y.mode).toBe("period_key");
      expect(y.startDate.toISOString()).toBe("2026-01-01T00:00:00.000Z");
      expect(y.endDate.toISOString()).toBe("2026-12-31T23:59:59.999Z");
    });

    it("rejects mutually exclusive combination: periodKey + startDate", () => {
      expect(() =>
        validateAndResolveDateContract({
          periodKey: "2026-08",
          startDate: "2026-08-01T00:00:00.000Z",
        })
      ).toThrow("INCOMPATIBLE_DATE_PARAMETERS");
    });

    it("rejects incomplete date range: startDate without endDate", () => {
      expect(() =>
        validateAndResolveDateContract({
          startDate: "2026-01-01T00:00:00.000Z",
        })
      ).toThrow("INCOMPLETE_DATE_RANGE");
    });

    it("rejects incomplete date range: endDate without startDate", () => {
      expect(() =>
        validateAndResolveDateContract({
          endDate: "2026-12-31T23:59:59.000Z",
        })
      ).toThrow("INCOMPLETE_DATE_RANGE");
    });

    it("rejects invalid chronology: startDate > endDate", () => {
      expect(() =>
        validateAndResolveDateContract({
          startDate: "2026-12-31T00:00:00.000Z",
          endDate: "2026-01-01T00:00:00.000Z",
        })
      ).toThrow("INVALID_DATE_SEQUENCE");
    });

    it("falls back gracefully to current month when no arguments are provided", () => {
      const res = validateAndResolveDateContract({});
      expect(res.mode).toBe("period_key");
      expect(res.periodKey).toBeDefined();
    });
  });

  // ==========================================================================
  // 7. PRECISION & NON-MUTATION TESTS (Invariant F & G)
  // ==========================================================================
  describe("Invariant F & G: Precision & Non-Mutation", () => {
    it("Invariant G: preserves Decimal.js 40-digit precision without IEEE-754 drift", () => {
      expect(Decimal.precision).toBe(40);
      const a = new Decimal("0.1");
      const b = new Decimal("0.2");
      expect(a.plus(b).toString()).toBe("0.3"); // Not 0.30000000000000004!

      const oneThird = new Decimal(1).div(3);
      const timesThree = oneThird.mul(3);
      expect(timesThree.toFixed(4)).toBe("1.0000");
    });

    it("Invariant F: calculation engines do not mutate input rows", () => {
      const t1 = 1000;
      const lines: JournalLineRow[] = [
        line(1, 1, "debit", "100.0000", t1),
        line(1, 7, "credit", "100.0000", t1),
      ];
      const frozenLine = JSON.stringify(lines);

      calculateBookBalanceSheet({
        asOfTimestamp: t1,
        baseCurrency,
        accounts,
        journalLines: lines,
      });

      expect(JSON.stringify(lines)).toBe(frozenLine);
    });
  });

  // ==========================================================================
  // 8. CSV & JSON EXPORT TESTS
  // ==========================================================================
  describe("Export Formatting (JSON & CSV)", () => {
    it("produces valid JSON and CSV export strings with expected sections", () => {
      const t1 = 1000;
      const lines: JournalLineRow[] = [
        line(1, 1, "debit", "5000.0000", t1),
        line(1, 7, "credit", "5000.0000", t1),
      ];

      const bs = calculateBookBalanceSheet({
        asOfTimestamp: t1,
        baseCurrency,
        accounts,
        journalLines: lines,
      });

      const income = calculateIncomeStatement({
        startTimestamp: 0,
        endTimestamp: 2000,
        baseCurrency,
        accounts,
        journalLines: lines,
      });

      const equity = calculateStatementOfChangesInEquity({
        startTimestamp: 0,
        endTimestamp: 2000,
        baseCurrency,
        openingBookEquity: new Decimal(0),
        closingBookEquity: new Decimal(5000),
        netOperatingIncome: new Decimal(0),
        accounts,
        journalLines: lines,
      });

      const cf = calculateStatementOfCashFlows({
        startTimestamp: 0,
        endTimestamp: 2000,
        baseCurrency,
        accounts,
        journalLines: lines,
      });

      const bridge = calculateEconomicNetWorthBridge({
        asOfTimestamp: t1,
        baseCurrency,
        bookBalanceSheet: bs,
        activeLots: [],
        lotMatches: [],
        specialAssets: [],
        quotes: {},
        fxRates: { USD: "1" },
      });

      const audit = verifyAccountingInvariants({
        bookBalanceSheet: bs,
        incomeStatement: income,
        cashFlowStatement: cf,
        bridge,
        journalLines: lines,
        lotMatches: [],
        currencies: ["USD"],
      });

      const pkg = {
        metadata: {
          workspaceId: 1,
          baseCurrency: "USD",
          generatedAt: Date.now(),
          mode: "point_in_time" as const,
          asOf: "2026-08-31T23:59:59.000Z",
          startDate: "2026-01-01T00:00:00.000Z",
          endDate: "2026-08-31T23:59:59.000Z",
        },
        bookBalanceSheet: bs,
        incomeStatement: income,
        equityChangesStatement: equity,
        cashFlowStatement: cf,
        economicNetWorthBridge: bridge,
        reconciliationAudit: audit,
      };

      const json = exportFinancialStatementsJson(pkg);
      expect(() => JSON.parse(json)).not.toThrow();

      const csv = exportFinancialStatementsCsv(pkg);
      expect(csv).toContain("Book_Balance_Sheet");
      expect(csv).toContain("Income_Statement");
      expect(csv).toContain("Equity_Changes");
      expect(csv).toContain("Cash_Flows");
    });
  });

  describe("Module 2: Double-Entry Accounting & FIFO Capital Gains Engine", () => {
    it("correctly credits account 4000 with realized capital gains and decrements book value by FIFO cost basis", () => {
      const egpAccounts: AccountRow[] = [
        { id: 101, workspaceId: 1, name: "Liquid Bank Account", accountType: "bank", currency: "EGP", isSystemAccount: "no" },
        { id: 102, workspaceId: 1, name: "INVESTMENT_CLEARING:EGP", accountType: "clearing", currency: "EGP", isSystemAccount: "yes" },
        { id: 103, workspaceId: 1, name: "Operating Revenue", accountType: "income", currency: "EGP", isSystemAccount: "no" },
        { id: 104, workspaceId: 1, name: "4000: Realized Capital Gains", accountType: "income", currency: "EGP", isSystemAccount: "yes" },
        { id: 105, workspaceId: 1, name: "Capital Contributed", accountType: "equity", currency: "EGP", isSystemAccount: "no" },
      ];

      const t1 = 1000;
      const t2 = 2000;
      const t3 = 3000;

      // 1. Initial capital contribution: 151,250 EGP
      // 2. Operating Revenue: 20,000 EGP
      // 3. Purchase 100 shares at 200 EGP = 20,000 EGP
      // 4. Sell 50 shares at 250 EGP = 12,500 EGP (FIFO cost = 10,000 EGP, Realized gain = 2,500 EGP)
      const lines: JournalLineRow[] = [
        // Capital contribution
        line(1, 101, "debit", "151250.0000", t1, "EGP"),
        line(1, 105, "credit", "151250.0000", t1, "EGP"),
        // Operating revenue
        line(2, 101, "debit", "20000.0000", t1 + 500, "EGP"),
        line(2, 103, "credit", "20000.0000", t1 + 500, "EGP"),
        // BUY: 100 shares @ 200 = 20,000
        line(3, 102, "debit", "20000.0000", t2, "EGP"),
        line(3, 101, "credit", "20000.0000", t2, "EGP"),
        // SELL: 50 shares @ 250 = 12,500 (Cost basis = 10,000, Realized gain = 2,500)
        line(4, 101, "debit", "12500.0000", t3, "EGP"),
        line(4, 102, "credit", "10000.0000", t3, "EGP"),
        line(4, 104, "credit", "2500.0000", t3, "EGP"),
      ];

      // Verify Balance Sheet
      const bs = calculateBookBalanceSheet({
        asOfTimestamp: t3,
        baseCurrency: "EGP",
        accounts: egpAccounts,
        journalLines: lines,
      });

      // Liquid Cash = 151,250 + 20,000 - 20,000 + 12,500 = 163,750 EGP
      expect(bs.assets.cashAndEquivalents.totalBase).toBe("163750.0000");
      // Securities Book Value in Clearing = 20,000 - 10,000 = 10,000 EGP (Exactly 50 remaining shares * 200 EGP)
      expect(bs.assets.investmentClearing.totalBase).toBe("10000.0000");
      // Total Book Assets = 163,750 + 10,000 = 173,750 EGP
      expect(bs.assets.totalBookAssets).toBe("173750.0000");
      // Book Equity = Contributed Capital (151,250) + Retained Earnings (20,000 Operating + 2,500 Realized Gain) = 173,750 EGP
      expect(bs.equity.totalBookEquity).toBe("173750.0000");
      expect(bs.equationCheck.assetsEqualsLiabilitiesPlusEquity).toBe(true);

      // Verify Income Statement:
      // Net Profit = Operating Revenue (20,000) - Operating Expenses (0) + Realized Investment Gains (2,500) = 22,500 EGP
      const income = calculateIncomeStatement({
        startTimestamp: t1,
        endTimestamp: t3,
        baseCurrency: "EGP",
        accounts: egpAccounts,
        journalLines: lines,
      });

      expect(income.revenues.operatingIncome).toBe("20000.0000");
      expect(income.revenues.realizedInvestmentGains).toBe("2500.0000");
      expect(income.revenues.totalRevenues).toBe("22500.0000");
      expect(income.netOperatingIncome).toBe("22500.0000");
      expect(income.netProfit).toBe("22500.0000");

      // Verify Valuation Reconciliation Bridge
      const activeLots: InvestmentLotRow[] = [
        {
          id: 1,
          accountId: 101,
          instrumentId: 501,
          acquiredAt: t2,
          originalQuantity: "100.0000",
          remainingQuantity: "50.0000",
          unitCost: "200.0000",
          totalCost: "20000.0000",
          costCurrency: "EGP",
          status: "open",
        },
      ];

      const lotMatches: LotMatchRow[] = [
        {
          id: 1,
          sellEventId: 4,
          lotId: 1,
          quantity: "50.0000",
          costBasis: "10000.0000",
          grossProceeds: "12500.0000",
          allocatedFee: "0.0000",
          allocatedTax: "0.0000",
          realizedPnl: "2500.0000",
          currency: "EGP",
          matchedAt: t3,
        },
      ];

      // Current fair market price is 250 EGP per share
      const quotes: PriceQuoteMap = {
        501: { price: "250.0000", currency: "EGP" },
      };

      const bridge = calculateEconomicNetWorthBridge({
        asOfTimestamp: t3,
        baseCurrency: "EGP",
        bookBalanceSheet: bs,
        activeLots,
        lotMatches,
        specialAssets: [],
        quotes,
        fxRates: { EGP: "1" },
      });

      // Remaining FIFO Cost = 50 * 200 = 10,000 EGP
      expect(bridge.securitiesAdjustments.activeLotsCostBasis).toBe("10000.0000");
      // Current Fair Value = 50 * 250 = 12,500 EGP
      expect(bridge.securitiesAdjustments.activeLotsFairValue).toBe("12500.0000");
      // Unrealized Gain = Current Fair Value (12,500) - Remaining FIFO Cost (10,000) = 2,500 EGP
      expect(bridge.securitiesAdjustments.activeLotsUnrealizedPnl).toBe("2500.0000");
      // Clearing Settlement Residual = 10,000 EGP (Exactly equals active lots cost basis)
      expect(bridge.securitiesAdjustments.clearingSettlementResidual).toBe("10000.0000");
      // Economic Net Worth = Liquid Cash (163,750) + Securities Fair Value (12,500) = 176,250 EGP
      expect(bridge.economicNetWorth).toBe("176250.0000");
      // Bridge check is fully reconciled with 0 discrepancy (phantom 5,000 eliminated!)
      expect(bridge.bridgeCheck.reconciled).toBe(true);
      expect(bridge.bridgeCheck.discrepancy).toBe("0.0000");
    });
  });
});
