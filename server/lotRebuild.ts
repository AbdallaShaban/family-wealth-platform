import Decimal from "decimal.js";
import { allocateFifo, consumeFifo, LotAllocationError, type FifoLot } from "./lots";

export type RebuildEvent = {
  id: number;
  eventType: "buy" | "sell" | "position_transfer" | "corporate_action";
  occurredAt: number;
  primaryAccountId: number | null;
  counterAccountId: number | null;
  instrumentId: number | null;
  quantity: string | null;
  unitPrice: string | null;
  feeAmount: string;
  taxAmount: string;
  currency: string;
  ratio?: string | null;
};

export type RebuiltLot = {
  key: string;
  sourceLotKey: string | null;
  acquisitionEventId: number;
  accountId: number;
  instrumentId: number;
  acquiredAt: number;
  originalQuantity: Decimal;
  remainingQuantity: Decimal;
  unitCost: Decimal;
  totalCost: Decimal;
  currency: string;
  feeAmount: Decimal;
  taxAmount: Decimal;
  status: "open" | "closed";
};

export type RebuiltMatch = {
  key: string;
  sellEventId: number;
  lotKey: string;
  quantity: Decimal;
  costBasis: Decimal;
  grossProceeds: Decimal;
  allocatedFee: Decimal;
  allocatedTax: Decimal;
  realizedPnl: Decimal;
  currency: string;
};

export type RebuildIssue = {
  eventId: number;
  code: "missing_trade_data" | "insufficient_lots" | "invalid_ratio" | "invalid_currency";
  message: string;
};

function decimal(value: string | null | undefined) {
  return new Decimal(value ?? "0");
}

function toFifoLot(lot: RebuiltLot, sequence: number): FifoLot {
  return { id: sequence, acquiredAt: lot.acquiredAt, remainingQuantity: lot.remainingQuantity, unitCost: lot.unitCost, currency: lot.currency };
}

function finaliseLot(lot: RebuiltLot) {
  lot.status = lot.remainingQuantity.isZero() ? "closed" : "open";
}

/** Reconstructs lot state from posted trade-like events without persisting anything. */
export function rebuildLotsFromEvents(events: RebuildEvent[]) {
  const lots: RebuiltLot[] = [];
  const matches: RebuiltMatch[] = [];
  const issues: RebuildIssue[] = [];
  const ordered = [...events].sort((a, b) => a.occurredAt - b.occurredAt || a.id - b.id);

  for (const event of ordered) {
    if (!event.instrumentId || !event.currency || !/^[A-Z]{3}$/.test(event.currency)) {
      issues.push({ eventId: event.id, code: "invalid_currency", message: "الحدث لا يحمل أداة أو عملة ISO صالحة لإعادة بناء Lot." });
      continue;
    }
    if (event.eventType === "buy") {
      const quantity = decimal(event.quantity);
      const unitPrice = decimal(event.unitPrice);
      if (quantity.lte(0) || unitPrice.lte(0)) {
        issues.push({ eventId: event.id, code: "missing_trade_data", message: "صفقة الشراء تفتقد كمية أو سعرًا موجبًا." });
        continue;
      }
      const fee = decimal(event.feeAmount);
      const tax = decimal(event.taxAmount);
      const totalCost = quantity.mul(unitPrice).plus(fee).plus(tax);
      const lot: RebuiltLot = {
        key: `event:${event.id}`,
        sourceLotKey: null,
        acquisitionEventId: event.id,
        accountId: event.primaryAccountId ?? 0,
        instrumentId: event.instrumentId,
        acquiredAt: event.occurredAt,
        originalQuantity: quantity,
        remainingQuantity: quantity,
        unitCost: totalCost.div(quantity),
        totalCost,
        currency: event.currency,
        feeAmount: fee,
        taxAmount: tax,
        status: "open",
      };
      lots.push(lot);
      continue;
    }

    if (event.eventType === "sell") {
      const quantity = decimal(event.quantity);
      const unitPrice = decimal(event.unitPrice);
      const sourceLots = lots.filter(lot => lot.accountId === (event.primaryAccountId ?? 0) && lot.instrumentId === event.instrumentId && lot.remainingQuantity.gt(0));
      if (quantity.lte(0) || unitPrice.lte(0)) {
        issues.push({ eventId: event.id, code: "missing_trade_data", message: "صفقة البيع تفتقد كمية أو سعرًا موجبًا." });
        continue;
      }
      try {
        const fifoMatches = allocateFifo({
          lots: sourceLots.map((lot, index) => toFifoLot(lot, index + 1)),
          quantity,
          unitPrice,
          fee: decimal(event.feeAmount),
          tax: decimal(event.taxAmount),
          currency: event.currency,
        });
        for (const fifoMatch of fifoMatches) {
          const source = sourceLots[fifoMatch.lotId - 1];
          source.remainingQuantity = source.remainingQuantity.minus(fifoMatch.quantity);
          finaliseLot(source);
          matches.push({ key: `${event.id}:${source.key}`, sellEventId: event.id, lotKey: source.key, quantity: fifoMatch.quantity, costBasis: fifoMatch.costBasis, grossProceeds: fifoMatch.grossProceeds, allocatedFee: fifoMatch.allocatedFee, allocatedTax: fifoMatch.allocatedTax, realizedPnl: fifoMatch.realizedPnl, currency: fifoMatch.currency });
        }
      } catch (error) {
        issues.push({ eventId: event.id, code: "insufficient_lots", message: error instanceof LotAllocationError ? error.message : "تعذر مطابقة صفقة البيع مع Lots." });
      }
      continue;
    }

    if (event.eventType === "position_transfer") {
      const quantity = decimal(event.quantity);
      const sourceAccountId = event.primaryAccountId ?? 0;
      const destinationAccountId = event.counterAccountId ?? 0;
      const sourceLots = lots.filter(lot => lot.accountId === sourceAccountId && lot.instrumentId === event.instrumentId && lot.remainingQuantity.gt(0));
      if (quantity.lte(0) || !destinationAccountId) {
        issues.push({ eventId: event.id, code: "missing_trade_data", message: "تحويل الحيازة يفتقد كمية أو حساب وجهة." });
        continue;
      }
      try {
        const consumed = consumeFifo(sourceLots.map((lot, index) => toFifoLot(lot, index + 1)), quantity);
        consumed.forEach((part, index) => {
          const source = sourceLots[part.lotId - 1];
          source.remainingQuantity = source.remainingQuantity.minus(part.quantity);
          finaliseLot(source);
          const destination: RebuiltLot = {
            key: `event:${event.id}:source:${source.key}`,
            sourceLotKey: source.key,
            acquisitionEventId: event.id,
            accountId: destinationAccountId,
            instrumentId: event.instrumentId!,
            acquiredAt: event.occurredAt,
            originalQuantity: part.quantity,
            remainingQuantity: part.quantity,
            unitCost: part.costBasis.div(part.quantity),
            totalCost: part.costBasis,
            currency: part.currency,
            feeAmount: new Decimal(0),
            taxAmount: new Decimal(0),
            status: "open",
          };
          lots.push(destination);
        });
      } catch (error) {
        issues.push({ eventId: event.id, code: "insufficient_lots", message: error instanceof LotAllocationError ? error.message : "تعذر نقل Lots." });
      }
      continue;
    }

    if (event.eventType === "corporate_action") {
      const ratio = decimal(event.ratio);
      if (ratio.lte(0)) {
        issues.push({ eventId: event.id, code: "invalid_ratio", message: "نسبة Corporate Action يجب أن تكون أكبر من صفر." });
        continue;
      }
      for (const lot of lots.filter(item => item.instrumentId === event.instrumentId && item.acquiredAt <= event.occurredAt)) {
        lot.originalQuantity = lot.originalQuantity.mul(ratio);
        lot.remainingQuantity = lot.remainingQuantity.mul(ratio);
        lot.unitCost = lot.unitCost.div(ratio);
        finaliseLot(lot);
      }
    }
  }

  return { lots, matches, issues };
}
