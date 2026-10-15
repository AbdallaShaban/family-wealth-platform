import Decimal from "decimal.js";
import { describe, expect, it, vi } from "vitest";
import {
  resolvePeriodDates,
  resolvePointInTimePortfolioValuation,
  resolveExternalCashFlows,
} from "./performanceRouter";
import {
  calculateTwr,
  calculateMwr,
  buildCapitalBridge,
} from "./performanceMath";

/**
 * Creates a lightweight query chain mock that immediately resolves with data
 */
function createMockQueryChain(data: any) {
  const chain: any = {
    innerJoin: () => chain,
    where: () => chain,
    groupBy: () => chain,
    orderBy: () => chain,
    limit: () => chain,
    then: (resolve: any) => Promise.resolve(data).then(resolve),
    catch: (reject: any) => Promise.resolve(data).catch(reject),
  };
  return chain;
}

describe("Performance Router & Valuation Engine — Phase 1 Audited Invariants", () => {
  const baseWorkspaceId = 101;
  const baseCurrency = "EGP";

  // ==========================================================================
  // Test 1: Capital Gain without Official Starting Snapshot
  // ==========================================================================
  it("accurately calculates capital gains without zeroing returns when starting snapshot is absent", async () => {
    const startDate = 1_704_067_200_000; // 2024-01-01
    const endDate = 1_735_689_600_000;   // 2024-12-31

    const startDb: any = {
      select: vi.fn(() => ({
        from: (table: any) => {
          // cashLines query returns 1,000,000 EGP starting cash
          return createMockQueryChain([
            { accountId: 1, direction: "debit", sumBase: "1000000.00" },
          ]);
        },
      })),
    };

    const startValuation = await resolvePointInTimePortfolioValuation(
      startDb,
      baseWorkspaceId,
      baseCurrency,
      startDate,
      { eligibleCashAccountIds: new Set([1]), instMap: new Map() }
    );

    const endDb: any = {
      select: vi.fn(() => ({
        from: (table: any) => {
          // cashLines query returns 1,300,000 EGP ending cash
          return createMockQueryChain([
            { accountId: 1, direction: "debit", sumBase: "1300000.00" },
          ]);
        },
      })),
    };

    const endValuation = await resolvePointInTimePortfolioValuation(
      endDb,
      baseWorkspaceId,
      baseCurrency,
      endDate,
      { eligibleCashAccountIds: new Set([1]), instMap: new Map() }
    );

    expect(startValuation.totalValuationBase.toFixed(2)).toBe("1000000.00");
    expect(endValuation.totalValuationBase.toFixed(2)).toBe("1300000.00");

    // TWR calculation with true start and end: +30.00% (NOT 0.00%)
    const twr = calculateTwr({
      startDate,
      endDate,
      startValuation: startValuation.totalValuationBase,
      endValuation: endValuation.totalValuationBase,
      cashFlows: [],
    });
    expect(new Decimal(twr.cumulativeTwr).mul(100).toFixed(2)).toBe("30.00");

    // Capital bridge: gain is exactly +300,000 EGP (NOT 0.00)
    const bridge = buildCapitalBridge({
      startingCapital: startValuation.totalValuationBase,
      endingCapital: endValuation.totalValuationBase,
      cashFlows: [],
    });
    expect(bridge.investmentGainLoss).toBe("300000.00");
    expect(bridge.netContributions).toBe("0.00");
    expect(bridge.reconciles).toBe(true);
  });

  // ==========================================================================
  // Test 2: Capital Loss without Official Starting Snapshot
  // ==========================================================================
  it("accurately calculates capital losses without hiding negative returns when starting snapshot is absent", async () => {
    const startDate = 1_704_067_200_000;
    const endDate = 1_735_689_600_000;

    const startVal = new Decimal("1000000.00");
    const endVal = new Decimal("600000.00"); // -40% market loss

    const twr = calculateTwr({
      startDate,
      endDate,
      startValuation: startVal,
      endValuation: endVal,
      cashFlows: [],
    });
    expect(new Decimal(twr.cumulativeTwr).mul(100).toFixed(2)).toBe("-40.00");

    const bridge = buildCapitalBridge({
      startingCapital: startVal,
      endingCapital: endVal,
      cashFlows: [],
    });
    expect(bridge.investmentGainLoss).toBe("-400000.00");
    expect(bridge.reconciles).toBe(true);
  });

  // ==========================================================================
  // Test 3: Multi-Currency Valuation (USD Asset in EGP Workspace)
  // ==========================================================================
  it("converts foreign currency instrument (USD) into base currency (EGP) using exact historical FX rate", async () => {
    const asOfDate = 1_710_000_000_000;
    const instId = 55;

    // Holding 100 shares of Apple (AAPL) priced at 150 USD, FX rate USD -> EGP is 50.00
    // Expected value in EGP = 100 * 150 * 50 = 750,000 EGP (NOT 15,000 EGP!)
    let callIdx = 0;
    const mockDb: any = {
      select: vi.fn((fields?: any) => ({
        from: (table: any) => {
          callIdx++;
          // Call 1: cash balance -> 0
          if (callIdx === 1) return createMockQueryChain([]);
          // Call 2: financialEvents -> bought 100 shares of Apple
          if (callIdx === 2) {
            return createMockQueryChain([
              {
                id: 1,
                eventType: "buy",
                occurredAt: asOfDate - 10000,
                primaryAccountId: 10,
                counterAccountId: null,
                instrumentId: instId,
                quantity: "100.00",
                unitPrice: "150.00",
                feeAmount: "0",
                taxAmount: "0",
                currency: "USD",
              },
            ]);
          }
          // Call 3: corporateActions -> none
          if (callIdx === 3) return createMockQueryChain([]);
          // Call 4: priceQuotes for instrument 55 -> 150.00 USD
          if (callIdx === 4) {
            return createMockQueryChain([
              { price: "150.00", asOf: asOfDate - 1000, quoteStatus: "live" },
            ]);
          }
          // Call 5: fxRates USD -> EGP -> 50.00
          if (callIdx === 5) {
            return createMockQueryChain([
              { rate: "50.0000000000", asOf: asOfDate - 1000 },
            ]);
          }
          // Subsequent calls: official snapshot -> none
          return createMockQueryChain([]);
        },
      })),
    };

    const instMap = new Map([
      [
        instId,
        {
          id: instId,
          symbol: "AAPL",
          name: "Apple Inc.",
          currency: "USD",
          assetType: "equity",
        },
      ],
    ]);

    const valuation = await resolvePointInTimePortfolioValuation(
      mockDb,
      baseWorkspaceId,
      "EGP",
      asOfDate,
      { eligibleCashAccountIds: new Set([10]), instMap }
    );

    expect(valuation.holdings).toHaveLength(1);
    const h = valuation.holdings[0];
    expect(h.symbol).toBe("AAPL");
    expect(h.currency).toBe("USD");
    expect(h.quantity.toFixed(2)).toBe("100.00");
    expect(h.price.toFixed(2)).toBe("150.00");
    expect(h.fxRateToBase.toFixed(2)).toBe("50.00");
    expect(h.valBase.toFixed(2)).toBe("750000.00"); // 100 * 150 * 50 = 750,000 EGP
    expect(valuation.investmentsTotalBase.toFixed(2)).toBe("750000.00");
    expect(valuation.totalValuationBase.toFixed(2)).toBe("750000.00");
    expect(valuation.isDataComplete).toBe(true);
  });

  // ==========================================================================
  // Test 4: Historical AsOf Isolation (Zero Future Data Leakage)
  // ==========================================================================
  it("strictly ignores future prices and future exchange rates when evaluating historical dates", async () => {
    const historicalDate = 1_705_000_000_000; // Jan 12, 2024
    const instId = 77;

    let callIdx = 0;
    const mockDb: any = {
      select: vi.fn(() => ({
        from: () => {
          callIdx++;
          if (callIdx === 1) return createMockQueryChain([]); // cash
          if (callIdx === 2) {
            // events: bought 50 shares
            return createMockQueryChain([
              {
                id: 10,
                eventType: "buy",
                occurredAt: historicalDate - 20000,
                primaryAccountId: 10,
                counterAccountId: null,
                instrumentId: instId,
                quantity: "50.00",
                unitPrice: "80.00",
                feeAmount: "0",
                taxAmount: "0",
                currency: "USD",
              },
            ]);
          }
          if (callIdx === 3) return createMockQueryChain([]); // actions
          if (callIdx === 4) {
            // priceQuotes query filtered by asOf <= historicalDate returns past price: 80.00
            return createMockQueryChain([
              { price: "80.00", asOf: historicalDate - 5000, quoteStatus: "live" },
            ]);
          }
          if (callIdx === 5) {
            // fxRates query filtered by asOf <= historicalDate returns past FX: 45.00
            return createMockQueryChain([
              { rate: "45.0000000000", asOf: historicalDate - 5000 },
            ]);
          }
          return createMockQueryChain([]);
        },
      })),
    };

    const instMap = new Map([
      [instId, { id: instId, symbol: "TEST", name: "Test Asset", currency: "USD", assetType: "equity" }],
    ]);

    const valuation = await resolvePointInTimePortfolioValuation(
      mockDb,
      baseWorkspaceId,
      "EGP",
      historicalDate,
      { eligibleCashAccountIds: new Set([10]), instMap }
    );

    const h = valuation.holdings[0];
    expect(h.price.toFixed(2)).toBe("80.00");
    expect(h.fxRateToBase.toFixed(2)).toBe("45.00");
    expect(h.valBase.toFixed(2)).toBe("180000.00"); // 50 * 80 * 45 = 180,000 EGP
  });

  // ==========================================================================
  // Test 5: Point-in-Time Holdings (Retrospective Report after Later Sale)
  // ==========================================================================
  it("preserves historical holdings in past reports even after positions are completely liquidated in a later period", async () => {
    const buyDate = 1_704_500_000_000;   // Jan 6
    const reportDate = 1_706_000_000_000; // Jan 23 (Held 200 shares)
    const instId = 99;

    let callIdx = 0;
    const mockDb: any = {
      select: vi.fn(() => ({
        from: () => {
          callIdx++;
          if (callIdx === 1) return createMockQueryChain([]); // cash
          if (callIdx === 2) {
            // Only buy event occurred on or before reportDate
            return createMockQueryChain([
              {
                id: 1,
                eventType: "buy",
                occurredAt: buyDate,
                primaryAccountId: 10,
                counterAccountId: null,
                instrumentId: instId,
                quantity: "200.00",
                unitPrice: "50.00",
                feeAmount: "0",
                taxAmount: "0",
                currency: "EGP",
              },
            ]);
          }
          if (callIdx === 3) return createMockQueryChain([]); // actions
          if (callIdx === 4) {
            return createMockQueryChain([
              { price: "50.00", asOf: reportDate - 1000, quoteStatus: "live" },
            ]);
          }
          return createMockQueryChain([]);
        },
      })),
    };

    const instMap = new Map([
      [instId, { id: instId, symbol: "EGP_STOCK", name: "Egypt Stock", currency: "EGP", assetType: "equity" }],
    ]);

    const valuation = await resolvePointInTimePortfolioValuation(
      mockDb,
      baseWorkspaceId,
      "EGP",
      reportDate,
      { eligibleCashAccountIds: new Set([10]), instMap }
    );

    // In retrospective report, 200 shares were held!
    expect(valuation.holdings).toHaveLength(1);
    expect(valuation.holdings[0].quantity.toFixed(2)).toBe("200.00");
    expect(valuation.holdings[0].valBase.toFixed(2)).toBe("10000.00"); // 200 * 50 = 10,000 EGP
  });

  // ==========================================================================
  // Test 6: Missing FX Rate / Stale Quotes Handling
  // ==========================================================================
  it("flags insufficient data and missing FX rate explicitly without fabricating rates", async () => {
    const asOfDate = 1_710_000_000_000;
    const instId = 44;

    let callIdx = 0;
    const mockDb: any = {
      select: vi.fn(() => ({
        from: () => {
          callIdx++;
          if (callIdx === 1) return createMockQueryChain([]); // cash
          if (callIdx === 2) {
            return createMockQueryChain([
              {
                id: 1,
                eventType: "buy",
                occurredAt: asOfDate - 5000,
                primaryAccountId: 10,
                counterAccountId: null,
                instrumentId: instId,
                quantity: "50.00",
                unitPrice: "100.00",
                feeAmount: "0",
                taxAmount: "0",
                currency: "GBP",
              },
            ]);
          }
          if (callIdx === 3) return createMockQueryChain([]); // actions
          if (callIdx === 4) {
            // Price quote is stale (> 90 days)
            return createMockQueryChain([
              { price: "100.00", asOf: asOfDate - 100 * 86400 * 1000, quoteStatus: "last_known" },
            ]);
          }
          if (callIdx === 5 || callIdx === 6) {
            // Direct and inverse FX rate queries return empty!
            return createMockQueryChain([]);
          }
          return createMockQueryChain([]);
        },
      })),
    };

    const instMap = new Map([
      [instId, { id: instId, symbol: "UK_ASSET", name: "UK Stock", currency: "GBP", assetType: "equity" }],
    ]);

    const valuation = await resolvePointInTimePortfolioValuation(
      mockDb,
      baseWorkspaceId,
      "EGP",
      asOfDate,
      { eligibleCashAccountIds: new Set([10]), instMap }
    );

    expect(valuation.hasMissingFx).toBe(true);
    expect(valuation.hasStaleQuotes).toBe(true);
    expect(valuation.isDataComplete).toBe(false);
    expect(valuation.holdings[0].hasMissingFx).toBe(true);
    expect(valuation.holdings[0].fxRateToBase.isZero()).toBe(true); // Does NOT guess 1.00!
  });

  // ==========================================================================
  // Test 7: Internal Cash Transfers vs External Cash Flows
  // ==========================================================================
  it("distinguishes internal transfers between cash accounts from external owner contributions", async () => {
    const startDate = 1_704_067_200_000;
    const endDate = 1_706_745_600_000;
    const eligibleCash = new Set([10, 20]); // Account 10: Bank, Account 20: Brokerage

    const accountMap = new Map([
      [10, { id: 10, accountType: "bank", name: "CIB Bank" }],
      [20, { id: 20, accountType: "brokerage", name: "Hermes Brokerage" }],
      [90, { id: 90, accountType: "equity", name: "Owner Capital Contribution" }],
    ]);

    // Simulated journal lines:
    // Entry 1: Internal transfer Bank -> Brokerage 50,000 EGP (Touches ONLY accounts 10 and 20)
    // Entry 2: External Owner Deposit 100,000 EGP (Touches 10 and 90)
    const mockDb: any = {
      select: vi.fn(() => ({
        from: () => ({
          innerJoin: () => ({
            where: () => ({
              orderBy: () =>
                Promise.resolve([
                  // Entry 1: Internal transfer
                  { entryId: 1, postedAt: startDate + 1000, lineId: 1, accountId: 20, direction: "debit", baseAmount: "50000.00", currency: "EGP" },
                  { entryId: 1, postedAt: startDate + 1000, lineId: 2, accountId: 10, direction: "credit", baseAmount: "50000.00", currency: "EGP" },
                  // Entry 2: External contribution
                  { entryId: 2, postedAt: startDate + 5000, lineId: 3, accountId: 10, direction: "debit", baseAmount: "100000.00", currency: "EGP" },
                  { entryId: 2, postedAt: startDate + 5000, lineId: 4, accountId: 90, direction: "credit", baseAmount: "100000.00", currency: "EGP" },
                ]),
            }),
          }),
        }),
      })),
    };

    const flows = await resolveExternalCashFlows(
      mockDb,
      baseWorkspaceId,
      startDate,
      endDate,
      eligibleCash,
      accountMap
    );

    // Only the external contribution should be captured as an external cash flow!
    expect(flows).toHaveLength(1);
    expect(flows[0].amount).toBe("100000.0000");
    expect(flows[0].direction).toBe("inflow");
    expect(flows[0].description).toBe("مساهمة رأسمالية إضافية من المالك");
  });

  // ==========================================================================
  // Test 8: Zero-Mutation Ledger Invariant
  // ==========================================================================
  it("guarantees zero ledger mutations when resolving portfolio performance", async () => {
    const insertSpy = vi.fn();
    const updateSpy = vi.fn();
    const deleteSpy = vi.fn();

    const mockDb: any = {
      select: vi.fn(() => ({
        from: () => createMockQueryChain([]),
      })),
      insert: insertSpy,
      update: updateSpy,
      delete: deleteSpy,
    };

    await resolvePointInTimePortfolioValuation(
      mockDb,
      baseWorkspaceId,
      baseCurrency,
      Date.now(),
      { eligibleCashAccountIds: new Set([1]), instMap: new Map() }
    );

    // Strictly read-only: ZERO mutations to the database!
    expect(insertSpy).not.toHaveBeenCalled();
    expect(updateSpy).not.toHaveBeenCalled();
    expect(deleteSpy).not.toHaveBeenCalled();
  });

  // ==========================================================================
  // Test 9: Period Resolving Correctness
  // ==========================================================================
  it("resolves date boundaries accurately across standard periods without timezone drift", () => {
    const refNow = Date.UTC(2025, 5, 15, 12, 0, 0); // 2025-06-15

    const ytd = resolvePeriodDates("ytd", undefined, undefined, refNow);
    expect(new Date(ytd.startDate).toISOString()).toContain("2025-01-01");
    expect(ytd.endDate).toBe(refNow);

    const qtd = resolvePeriodDates("qtd", undefined, undefined, refNow);
    expect(new Date(qtd.startDate).toISOString()).toContain("2025-04-01"); // Q2 starts April 1

    const mtd = resolvePeriodDates("mtd", undefined, undefined, refNow);
    expect(new Date(mtd.startDate).toISOString()).toContain("2025-06-01"); // MTD starts June 1
  });
});
