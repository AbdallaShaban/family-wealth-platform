import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";
import { rebuildLotsFromEvents } from "./lotRebuild";

describe("lot reconstruction", () => {
  it("rebuilds FIFO sale matches with fees and taxes from posted events", () => {
    const result = rebuildLotsFromEvents([
      { id: 1, eventType: "buy", occurredAt: 1, primaryAccountId: 10, counterAccountId: null, instrumentId: 20, quantity: "5", unitPrice: "10", feeAmount: "1", taxAmount: "0", currency: "USD" },
      { id: 2, eventType: "buy", occurredAt: 2, primaryAccountId: 10, counterAccountId: null, instrumentId: 20, quantity: "5", unitPrice: "12", feeAmount: "0", taxAmount: "2", currency: "USD" },
      { id: 3, eventType: "sell", occurredAt: 3, primaryAccountId: 10, counterAccountId: null, instrumentId: 20, quantity: "6", unitPrice: "20", feeAmount: "6", taxAmount: "0", currency: "USD" },
    ]);
    expect(result.issues).toHaveLength(0);
    expect(result.matches.map(match => match.lotKey)).toEqual(["event:1", "event:2"]);
    expect(result.matches.map(match => match.quantity.toFixed(2))).toEqual(["5.00", "1.00"]);
    expect(result.matches.reduce((sum, match) => sum.plus(match.realizedPnl), new Decimal(0)).toFixed(2)).toBe("50.60");
    expect(result.lots.find(lot => lot.key === "event:1")?.status).toBe("closed");
    expect(result.lots.find(lot => lot.key === "event:2")?.remainingQuantity.toFixed(2)).toBe("4.00");
  });

  it("moves cost basis through a position transfer without creating P&L", () => {
    const result = rebuildLotsFromEvents([
      { id: 1, eventType: "buy", occurredAt: 1, primaryAccountId: 10, counterAccountId: null, instrumentId: 20, quantity: "10", unitPrice: "100", feeAmount: "0", taxAmount: "0", currency: "USD" },
      { id: 2, eventType: "position_transfer", occurredAt: 2, primaryAccountId: 10, counterAccountId: 11, instrumentId: 20, quantity: "4", unitPrice: null, feeAmount: "0", taxAmount: "0", currency: "USD" },
    ]);
    const moved = result.lots.find(lot => lot.key === "event:2:source:event:1");
    expect(moved?.accountId).toBe(11);
    expect(moved?.remainingQuantity.toFixed(2)).toBe("4.00");
    expect(moved?.unitCost.toFixed(2)).toBe("100.00");
    expect(result.lots.find(lot => lot.key === "event:1")?.remainingQuantity.toFixed(2)).toBe("6.00");
    expect(result.matches).toHaveLength(0);
    expect(result.issues).toHaveLength(0);
  });

  it("applies a stock split by preserving total cost and dividing unit cost", () => {
    const result = rebuildLotsFromEvents([
      { id: 1, eventType: "buy", occurredAt: 1, primaryAccountId: 10, counterAccountId: null, instrumentId: 20, quantity: "10", unitPrice: "50", feeAmount: "0", taxAmount: "0", currency: "USD" },
      { id: 2, eventType: "corporate_action", occurredAt: 2, primaryAccountId: null, counterAccountId: null, instrumentId: 20, quantity: null, unitPrice: null, feeAmount: "0", taxAmount: "0", currency: "USD", ratio: "2" },
    ]);
    const lot = result.lots[0];
    expect(lot.originalQuantity.toFixed(2)).toBe("20.00");
    expect(lot.remainingQuantity.toFixed(2)).toBe("20.00");
    expect(lot.unitCost.toFixed(2)).toBe("25.00");
    expect(lot.totalCost.toFixed(2)).toBe("500.00");
    expect(result.issues).toHaveLength(0);
  });

  it("reports an insufficient lot issue without mutating inventory", () => {
    const result = rebuildLotsFromEvents([
      { id: 1, eventType: "buy", occurredAt: 1, primaryAccountId: 10, counterAccountId: null, instrumentId: 20, quantity: "2", unitPrice: "10", feeAmount: "0", taxAmount: "0", currency: "USD" },
      { id: 2, eventType: "sell", occurredAt: 2, primaryAccountId: 10, counterAccountId: null, instrumentId: 20, quantity: "3", unitPrice: "20", feeAmount: "0", taxAmount: "0", currency: "USD" },
    ]);
    expect(result.issues[0]?.code).toBe("insufficient_lots");
    expect(result.lots[0]?.remainingQuantity.toFixed(2)).toBe("2.00");
    expect(result.matches).toHaveLength(0);
  });
});
