import { describe, expect, it } from "vitest";
import { buildReconciliationReport } from "./reconciliation";

const base = {
  entries: [{ id: 1, eventId: 11, status: "posted" }],
  lines: [
    { id: 1, entryId: 1, accountId: 101, direction: "debit" as const, amount: "100", baseAmount: "100", currency: "EGP" },
    { id: 2, entryId: 1, accountId: 201, direction: "credit" as const, amount: "100", baseAmount: "100", currency: "EGP" },
  ],
  events: [{ id: 11, status: "posted", eventType: "income", journalEntryId: 1, primaryAccountId: 101, grossAmount: "100", idempotencyKey: "deposit-001-unique" }],
  positions: [],
};

describe("financial reconciliation", () => {
  it("reports a healthy balanced ledger and linked cash flow", () => {
    const report = buildReconciliationReport(base);
    expect(report.status).toBe("healthy");
    expect(report.trialBalance.differenceBase).toBe("0.000000");
    expect(report.counts.unbalancedEntries).toBe(0);
    expect(report.cashFlowCoverage).toMatchObject({ cashFlowEvents: 1, linkedPostedEvents: 1, unlinkedCashFlowEvents: [], ledgerAmountMismatches: [] });
    expect(report.cashFlowCoverage.ledgerTotalsByType).toEqual([{ eventType: "income", eventCount: 1, ledgerBase: "100.000000" }]);
  });

  it("detects an unbalanced posted entry without changing input data", () => {
    const input = { ...base, lines: [base.lines[0], { ...base.lines[1], amount: "90", baseAmount: "90" }] };
    const report = buildReconciliationReport(input);
    expect(report.status).toBe("attention");
    expect(report.counts.unbalancedEntries).toBe(1);
    expect(report.trialBalance.differenceBase).toBe("10.000000");
    expect(input.lines[1].baseAmount).toBe("90");
  });

  it("rebuilds buy/sell positions and exposes realized P&L without persisting anything", () => {
    const report = buildReconciliationReport({
      entries: [
        { id: 1, eventId: 11, status: "posted" },
        { id: 2, eventId: 12, status: "posted" },
      ],
      lines: [
        { id: 1, entryId: 1, accountId: 101, direction: "debit", amount: "100", baseAmount: "100", currency: "EGP" },
        { id: 2, entryId: 1, accountId: 201, direction: "credit", amount: "100", baseAmount: "100", currency: "EGP" },
        { id: 3, entryId: 2, accountId: 101, direction: "debit", amount: "60", baseAmount: "60", currency: "EGP" },
        { id: 4, entryId: 2, accountId: 201, direction: "credit", amount: "60", baseAmount: "60", currency: "EGP" },
      ],
      events: [
        { id: 11, status: "posted", eventType: "buy", journalEntryId: 1, primaryAccountId: 101, instrumentId: 501, quantity: "10", unitPrice: "10", grossAmount: "100", idempotencyKey: "trade-buy-001-unique" },
        { id: 12, status: "posted", eventType: "sell", journalEntryId: 2, primaryAccountId: 101, instrumentId: 501, quantity: "5", unitPrice: "12", grossAmount: "60", idempotencyKey: "trade-sell-001-unique" },
      ],
      positions: [{ accountId: 101, instrumentId: 501, quantity: "5", averageCost: "10" }],
    });
    expect(report.status).toBe("healthy");
    expect(report.positions).toEqual([{ accountId: 101, instrumentId: 501, rebuiltQuantity: "5.000000", persistedQuantity: "5", rebuiltCost: "10.000000", persistedAverageCost: "10", realizedPnlBase: "10.000000", status: "matched" }]);
  });

  it("flags duplicate idempotency keys and events without a posted entry", () => {
    const report = buildReconciliationReport({ ...base, events: [
      { ...base.events[0], idempotencyKey: "same-key-unique" },
      { ...base.events[0], id: 12, journalEntryId: 999, idempotencyKey: "same-key-unique" },
    ] });
    expect(report.counts.duplicateIdempotencyKeys).toBe(1);
    expect(report.eventsWithoutEntry).toEqual([12]);
    expect(report.status).toBe("attention");
    });
  it("detects currency anomalies when a foreign line lacks a base amount", () => {
    const report = buildReconciliationReport({ ...base, baseCurrency: "EGP", lines: [{ ...base.lines[0], currency: "USD", baseAmount: null }, base.lines[1]] });
    expect(report.counts.currencyAnomalies).toBe(1);
    expect(report.currencyAnomalies).toEqual(["line:1:missing_base_amount"]);
    expect(report.status).toBe("attention");
  });

  it("detects material double-counting links beyond idempotency", () => {
    const report = buildReconciliationReport({ ...base, entries: [base.entries[0], { id: 2, eventId: 11, status: "posted" }], lines: base.lines.concat([
      { id: 3, entryId: 2, accountId: 101, direction: "debit", amount: "100", baseAmount: "100", currency: "EGP" },
      { id: 4, entryId: 2, accountId: 201, direction: "credit", amount: "100", baseAmount: "100", currency: "EGP" },
    ]) });
    expect(report.counts.doubleCountingLinks).toBe(1);
    expect(report.doubleCountingLinks).toEqual(["event:11:multiple_entries"]);
    expect(report.status).toBe("attention");
  });
});
