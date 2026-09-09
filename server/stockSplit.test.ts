import { describe, expect, it } from "vitest";
import { buildReconciliationReport } from "./reconciliation";

describe("Stock Split & Corporate Actions Reconciliation", () => {
  it("rebuilds positions with 2:1 stock split doubling quantity and halving unit cost", () => {
    // Timeline: Buy 100 shares at $20 (cost $2000), then 2:1 stock split
    const report = buildReconciliationReport({
      baseCurrency: "USD",
      entries: [
        { id: 1, eventId: 101, status: "posted" },
      ],
      lines: [
        { id: 1, entryId: 1, accountId: 10, direction: "debit", amount: "2000", baseAmount: "2000", currency: "USD" },
        { id: 2, entryId: 1, accountId: 20, direction: "credit", amount: "2000", baseAmount: "2000", currency: "USD" },
      ],
      events: [
        {
          id: 101,
          status: "posted",
          eventType: "buy",
          journalEntryId: 1,
          primaryAccountId: 10,
          instrumentId: 501,
          quantity: "100",
          unitPrice: "20",
          grossAmount: "2000",
          idempotencyKey: "trade-buy-aapl-01",
          occurredAt: 1000,
        },
      ],
      corporateActions: [
        {
          instrumentId: 501,
          actionType: "stock_split",
          ratio: "2.000000",
          effectiveAt: 2000,
        },
      ],
      positions: [
        // Expected persisted position after 2:1 split: 200 shares, average cost $10
        { accountId: 10, instrumentId: 501, quantity: "200", averageCost: "10" },
      ],
    });

    expect(report.status).toBe("healthy");
    expect(report.positions).toHaveLength(1);
    expect(report.positions[0]).toMatchObject({
      accountId: 10,
      instrumentId: 501,
      rebuiltQuantity: "200.000000",
      persistedQuantity: "200",
      rebuiltCost: "10.000000",
      persistedAverageCost: "10",
      status: "matched",
    });
  });

  it("handles chronological buy -> split -> sell lifecycle correctly", () => {
    // Buy 100 @ $50 ($5000) at t=1000
    // Split 2:1 at t=2000 (quantity becomes 200, unit cost becomes $25)
    // Sell 50 @ $30 ($1500 proceeds) at t=3000
    // Realized P&L = 50 * (30 - 25) = $250
    // Remaining quantity = 150, unit cost = $25
    const report = buildReconciliationReport({
      baseCurrency: "USD",
      entries: [
        { id: 1, eventId: 101, status: "posted" },
        { id: 2, eventId: 102, status: "posted" },
      ],
      lines: [
        { id: 1, entryId: 1, accountId: 10, direction: "debit", amount: "5000", baseAmount: "5000", currency: "USD" },
        { id: 2, entryId: 1, accountId: 20, direction: "credit", amount: "5000", baseAmount: "5000", currency: "USD" },
        { id: 3, entryId: 2, accountId: 10, direction: "credit", amount: "1500", baseAmount: "1500", currency: "USD" },
        { id: 4, entryId: 2, accountId: 20, direction: "debit", amount: "1500", baseAmount: "1500", currency: "USD" },
      ],
      events: [
        {
          id: 101,
          status: "posted",
          eventType: "buy",
          journalEntryId: 1,
          primaryAccountId: 10,
          instrumentId: 502,
          quantity: "100",
          unitPrice: "50",
          grossAmount: "5000",
          idempotencyKey: "trade-buy-502",
          occurredAt: 1000,
        },
        {
          id: 102,
          status: "posted",
          eventType: "sell",
          journalEntryId: 2,
          primaryAccountId: 10,
          instrumentId: 502,
          quantity: "50",
          unitPrice: "30",
          grossAmount: "1500",
          idempotencyKey: "trade-sell-502",
          occurredAt: 3000,
        },
      ],
      corporateActions: [
        {
          instrumentId: 502,
          actionType: "stock_split",
          ratio: "2.000000",
          effectiveAt: 2000,
        },
      ],
      positions: [
        { accountId: 10, instrumentId: 502, quantity: "150", averageCost: "25" },
      ],
    });

    expect(report.status).toBe("healthy");
    expect(report.positions[0]).toMatchObject({
      accountId: 10,
      instrumentId: 502,
      rebuiltQuantity: "150.000000",
      persistedQuantity: "150",
      rebuiltCost: "25.000000",
      persistedAverageCost: "25",
      realizedPnlBase: "250.000000",
      status: "matched",
    });
  });

  it("detects mismatch if persisted position was not adjusted for stock split", () => {
    // If persisted position is still 100 shares instead of 200 after split
    const report = buildReconciliationReport({
      baseCurrency: "USD",
      entries: [{ id: 1, eventId: 101, status: "posted" }],
      lines: [
        { id: 1, entryId: 1, accountId: 10, direction: "debit", amount: "1000", baseAmount: "1000", currency: "USD" },
        { id: 2, entryId: 1, accountId: 20, direction: "credit", amount: "1000", baseAmount: "1000", currency: "USD" },
      ],
      events: [
        {
          id: 101,
          status: "posted",
          eventType: "buy",
          journalEntryId: 1,
          primaryAccountId: 10,
          instrumentId: 503,
          quantity: "100",
          unitPrice: "10",
          grossAmount: "1000",
          idempotencyKey: "trade-buy-503",
          occurredAt: 1000,
        },
      ],
      corporateActions: [
        {
          instrumentId: 503,
          actionType: "stock_split",
          ratio: "2.000000",
          effectiveAt: 2000,
        },
      ],
      positions: [
        // Out of sync: old quantity 100, old averageCost 10
        { accountId: 10, instrumentId: 503, quantity: "100", averageCost: "10" },
      ],
    });

    expect(report.status).toBe("attention");
    expect(report.positions[0].status).toBe("mismatch");
    expect(report.counts.positionMismatches).toBe(1);
  });
});
