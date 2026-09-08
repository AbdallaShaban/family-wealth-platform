import Decimal from "decimal.js";

export function assertAssetRevaluationAccount(args: {
  accountType: string;
  isSystemAccount: string;
  accountCurrency: string;
  requestCurrency: string;
}) {
  if (args.accountType !== "asset" || args.isSystemAccount !== "no") {
    throw new Error("Asset revaluation requires a non-system asset account.");
  }
  if (args.accountCurrency !== args.requestCurrency) {
    throw new Error("Asset revaluation currency must match the asset account currency.");
  }
}

export function deriveAssetRevaluation(currentValue: Decimal.Value, targetValue: Decimal.Value) {
  const current = new Decimal(currentValue);
  const target = new Decimal(targetValue);
  if (current.lt(0) || target.lt(0)) {
    throw new Error("Asset revaluation values cannot be negative.");
  }
  const difference = target.minus(current);
  const direction = difference.gt(0) ? "increase" : difference.lt(0) ? "decrease" : "none";
  return {
    direction,
    adjustmentAmount: difference.abs(),
    currentValue: current,
    targetValue: target,
  } as const;
}
