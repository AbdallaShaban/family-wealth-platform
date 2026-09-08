import Decimal from "decimal.js";
import { TRPCError } from "@trpc/server";

Decimal.set({ precision: 40, rounding: Decimal.ROUND_HALF_UP });

export type JournalDirection = "debit" | "credit";
export type JournalDraftLine = {
  accountId: number;
  direction: JournalDirection;
  amount: Decimal;
  currency?: string;
  fxRateToBase?: Decimal;
  baseAmount?: Decimal;
};

export type PositionSnapshot = { quantity: Decimal; averageCost: Decimal };

export function parsePositiveAmount(value: string, label = "المبلغ") {
  let amount: Decimal;
  try {
    amount = new Decimal(value);
  } catch {
    throw new TRPCError({ code: "BAD_REQUEST", message: `${label} يجب أن يكون رقمًا موجبًا.` });
  }
  if (!amount.isFinite() || amount.lte(0)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: `${label} يجب أن يكون رقمًا موجبًا.` });
  }
  return amount;
}

export function parseNonNegativeAmount(value: string, label = "المبلغ") {
  let amount: Decimal;
  try {
    amount = new Decimal(value);
  } catch {
    throw new TRPCError({ code: "BAD_REQUEST", message: `${label} يجب أن يكون رقمًا غير سالب.` });
  }
  if (!amount.isFinite() || amount.lt(0)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: `${label} يجب أن يكون رقمًا غير سالب.` });
  }
  return amount;
}

export function assertBalanced(lines: JournalDraftLine[]) {
  const value = (line: JournalDraftLine) => line.baseAmount ?? line.amount;
  const debit = lines.filter(line => line.direction === "debit").reduce((sum, line) => sum.plus(value(line)), new Decimal(0));
  const credit = lines.filter(line => line.direction === "credit").reduce((sum, line) => sum.plus(value(line)), new Decimal(0));
  if (!debit.equals(credit)) {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "القيد المالي غير متوازن." });
  }
}

export function convertThroughBase(amount: Decimal, fromFxRateToBase: Decimal, toFxRateToBase: Decimal) {
  if (fromFxRateToBase.lte(0) || toFxRateToBase.lte(0)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "سعر الصرف يجب أن يكون موجبًا." });
  }
  return amount.mul(fromFxRateToBase).div(toFxRateToBase);
}

export function nextBuyPosition(current: PositionSnapshot | undefined, quantity: Decimal, capitalizedCost: Decimal): PositionSnapshot {
  const existing = current ?? { quantity: new Decimal(0), averageCost: new Decimal(0) };
  const nextQuantity = existing.quantity.plus(quantity);
  const nextCost = existing.quantity.mul(existing.averageCost).plus(capitalizedCost);
  return { quantity: nextQuantity, averageCost: nextCost.div(nextQuantity) };
}

export function nextSellPosition(current: PositionSnapshot | undefined, quantity: Decimal): PositionSnapshot {
  if (!current || current.quantity.lt(quantity)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "الكمية المراد بيعها تتجاوز الحيازة المسجلة." });
  }
  const nextQuantity = current.quantity.minus(quantity);
  return { quantity: nextQuantity, averageCost: nextQuantity.isZero() ? new Decimal(0) : current.averageCost };
}
