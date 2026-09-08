import Decimal from "decimal.js";

export type FifoLot = {
  id: number;
  acquiredAt: number;
  remainingQuantity: Decimal;
  unitCost: Decimal;
  currency: string;
};

export type FifoMatch = {
  lotId: number;
  quantity: Decimal;
  costBasis: Decimal;
  grossProceeds: Decimal;
  allocatedFee: Decimal;
  allocatedTax: Decimal;
  realizedPnl: Decimal;
  currency: string;
};

export class LotAllocationError extends Error {}

function positive(value: Decimal, label: string) {
  if (!value.isFinite() || value.lte(0)) throw new LotAllocationError(`${label} يجب أن يكون موجبًا.`);
}

function nonNegative(value: Decimal, label: string) {
  if (!value.isFinite() || value.lt(0)) throw new LotAllocationError(`${label} لا يمكن أن يكون سالبًا.`);
}

/** Allocates a sell to lots in acquisition order. The input is never mutated. */
export function allocateFifo(args: {
  lots: FifoLot[];
  quantity: Decimal;
  unitPrice: Decimal;
  fee?: Decimal;
  tax?: Decimal;
  currency: string;
}): FifoMatch[] {
  positive(args.quantity, "كمية البيع");
  positive(args.unitPrice, "سعر البيع");
  const fee = args.fee ?? new Decimal(0);
  const tax = args.tax ?? new Decimal(0);
  nonNegative(fee, "رسوم البيع");
  nonNegative(tax, "ضريبة البيع");
  if (!args.currency || !/^[A-Z]{3}$/.test(args.currency)) throw new LotAllocationError("عملة المطابقة غير صالحة.");

  const ordered = [...args.lots]
    .map(lot => ({ ...lot, remainingQuantity: new Decimal(lot.remainingQuantity), unitCost: new Decimal(lot.unitCost) }))
    .sort((a, b) => a.acquiredAt - b.acquiredAt || a.id - b.id);
  const available = ordered.reduce((sum, lot) => sum.plus(lot.remainingQuantity), new Decimal(0));
  if (available.lt(args.quantity)) throw new LotAllocationError("كمية البيع تتجاوز الكمية المتاحة في Lots.");

  const matches: FifoMatch[] = [];
  let remaining = new Decimal(args.quantity);
  for (const lot of ordered) {
    if (remaining.isZero()) break;
    if (lot.remainingQuantity.lte(0)) continue;
    const quantity = Decimal.min(remaining, lot.remainingQuantity);
    const costBasis = quantity.mul(lot.unitCost);
    const grossProceeds = quantity.mul(args.unitPrice);
    const allocationRatio = quantity.div(args.quantity);
    const allocatedFee = fee.mul(allocationRatio);
    const allocatedTax = tax.mul(allocationRatio);
    matches.push({
      lotId: lot.id,
      quantity,
      costBasis,
      grossProceeds,
      allocatedFee,
      allocatedTax,
      realizedPnl: grossProceeds.minus(costBasis).minus(allocatedFee).minus(allocatedTax),
      currency: args.currency,
    });
    remaining = remaining.minus(quantity);
  }
  if (!remaining.isZero()) throw new LotAllocationError("تعذر إكمال مطابقة FIFO للكمية المطلوبة.");
  return matches;
}

export type FifoConsumption = {
  lotId: number;
  quantity: Decimal;
  costBasis: Decimal;
  currency: string;
};

export function consumeFifo(lots: FifoLot[], quantity: Decimal): FifoConsumption[] {
  positive(quantity, "كمية الاستهلاك");
  const ordered = [...lots]
    .map(lot => ({ ...lot, remainingQuantity: new Decimal(lot.remainingQuantity), unitCost: new Decimal(lot.unitCost) }))
    .sort((a, b) => a.acquiredAt - b.acquiredAt || a.id - b.id);
  const available = ordered.reduce((sum, lot) => sum.plus(lot.remainingQuantity), new Decimal(0));
  if (available.lt(quantity)) throw new LotAllocationError("الكمية المتاحة في Lots لا تكفي للاستهلاك.");
  const result: FifoConsumption[] = [];
  let remaining = new Decimal(quantity);
  for (const lot of ordered) {
    if (remaining.isZero()) break;
    if (lot.remainingQuantity.lte(0)) continue;
    const consumed = Decimal.min(remaining, lot.remainingQuantity);
    result.push({ lotId: lot.id, quantity: consumed, costBasis: consumed.mul(lot.unitCost), currency: lot.currency });
    remaining = remaining.minus(consumed);
  }
  if (!remaining.isZero()) throw new LotAllocationError("تعذر استهلاك كمية FIFO كاملة.");
  return result;
}

export function sumRealizedPnl(matches: FifoMatch[]) {
  return matches.reduce((sum, match) => sum.plus(match.realizedPnl), new Decimal(0));
}

export function sumCostBasis(matches: FifoMatch[]) {
  return matches.reduce((sum, match) => sum.plus(match.costBasis), new Decimal(0));
}
