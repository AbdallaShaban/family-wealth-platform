import { describe, expect, it } from "vitest";
import Decimal from "decimal.js";
import { allocateFifo, LotAllocationError, sumCostBasis, sumRealizedPnl, type FifoLot } from "./lots";

const lot = (id: number, acquiredAt: number, quantity: string, unitCost: string): FifoLot => ({
  id,
  acquiredAt,
  remainingQuantity: new Decimal(quantity),
  unitCost: new Decimal(unitCost),
  currency: "USD",
});

describe("FIFO lot allocation", () => {
  it("uses the oldest lots first and splits across lots", () => {
    const matches = allocateFifo({
      lots: [lot(2, 2, "5", "12"), lot(1, 1, "3", "10")],
      quantity: new Decimal("6"),
      unitPrice: new Decimal("20"),
      currency: "USD",
    });
    expect(matches.map(match => match.lotId)).toEqual([1, 2]);
    expect(matches.map(match => match.quantity.toFixed(2))).toEqual(["3.00", "3.00"]);
    expect(sumCostBasis(matches).toFixed(2)).toBe("66.00");
    expect(sumRealizedPnl(matches).toFixed(2)).toBe("54.00");
  });

  it("allocates sell fees and taxes proportionally and keeps total P&L traceable", () => {
    const matches = allocateFifo({
      lots: [lot(1, 1, "10", "100")],
      quantity: new Decimal("4"),
      unitPrice: new Decimal("130"),
      fee: new Decimal("8"),
      tax: new Decimal("12"),
      currency: "USD",
    });
    expect(matches).toHaveLength(1);
    expect(matches[0].costBasis.toFixed(2)).toBe("400.00");
    expect(matches[0].grossProceeds.toFixed(2)).toBe("520.00");
    expect(matches[0].allocatedFee.toFixed(2)).toBe("8.00");
    expect(matches[0].allocatedTax.toFixed(2)).toBe("12.00");
    expect(matches[0].realizedPnl.toFixed(2)).toBe("100.00");
  });

  it("does not mutate the input lots", () => {
    const lots = [lot(1, 1, "5", "10")];
    const before = lots[0].remainingQuantity.toString();
    allocateFifo({ lots, quantity: new Decimal("2"), unitPrice: new Decimal("15"), currency: "USD" });
    expect(lots[0].remainingQuantity.toString()).toBe(before);
  });

  it("rejects a sale larger than available inventory", () => {
    expect(() => allocateFifo({ lots: [lot(1, 1, "2", "10")], quantity: new Decimal("3"), unitPrice: new Decimal("15"), currency: "USD" }))
      .toThrow(LotAllocationError);
  });

  it("rejects invalid currency and charges", () => {
    expect(() => allocateFifo({ lots: [lot(1, 1, "2", "10")], quantity: new Decimal("1"), unitPrice: new Decimal("15"), fee: new Decimal("-1"), currency: "USD" }))
      .toThrow(LotAllocationError);
    expect(() => allocateFifo({ lots: [lot(1, 1, "2", "10")], quantity: new Decimal("1"), unitPrice: new Decimal("15"), currency: "US" }))
      .toThrow(LotAllocationError);
  });
});
