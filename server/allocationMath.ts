import Decimal from "decimal.js";

export type AllocationClass = "cash" | "equity" | "fixed_income" | "alternatives" | "other";
const classes: AllocationClass[] = ["cash", "equity", "fixed_income", "alternatives", "other"];

export function assetClassForInstrument(assetType: "equity" | "fund" | "bond" | "gold" | "real_estate" | "cash_equivalent" | "other"): AllocationClass {
  if (["equity", "fund"].includes(assetType)) return "equity";
  if (assetType === "bond") return "fixed_income";
  if (["gold", "real_estate"].includes(assetType)) return "alternatives";
  if (assetType === "cash_equivalent") return "cash";
  return "other";
}

export function calculateAllocation({ actualAmounts, targets }: { actualAmounts: Partial<Record<AllocationClass, string | Decimal>>; targets: Array<{ assetClass: AllocationClass; targetPercent: string | Decimal; driftThresholdPercent: string | Decimal }> }) {
  const targetMap = new Map(targets.map(target => [target.assetClass, target]));
  const total = classes.reduce((sum, assetClass) => sum.plus(actualAmounts[assetClass] ?? 0), new Decimal(0));
  return {
    totalValuedBase: total.toFixed(6),
    classes: classes.map(assetClass => {
      const actualAmount = new Decimal(actualAmounts[assetClass] ?? 0);
      const target = targetMap.get(assetClass);
      const actualPercent = total.gt(0) ? actualAmount.div(total).mul(100) : new Decimal(0);
      const targetPercent = target ? new Decimal(target.targetPercent) : null;
      const threshold = target ? new Decimal(target.driftThresholdPercent) : null;
      const driftPercent = targetPercent ? actualPercent.minus(targetPercent) : null;
      const targetAmount = targetPercent ? total.mul(targetPercent).div(100) : null;
      const adjustmentToTarget = targetAmount ? targetAmount.minus(actualAmount) : null;
      return {
        assetClass,
        actualAmount: actualAmount.toFixed(6),
        actualPercent: actualPercent.toFixed(2),
        targetPercent: targetPercent?.toFixed(2) ?? null,
        driftPercent: driftPercent?.toFixed(2) ?? null,
        driftThresholdPercent: threshold?.toFixed(2) ?? null,
        targetAmount: targetAmount?.toFixed(6) ?? null,
        adjustmentToTarget: adjustmentToTarget?.toFixed(6) ?? null,
        status: !target ? "target_missing" as const : driftPercent!.abs().gt(threshold!) ? "review" as const : "within_band" as const,
      };
    }),
  };
}

export function validateAllocationTargets(targets: Array<{ assetClass: AllocationClass; targetPercent: string | Decimal; driftThresholdPercent: string | Decimal }>) {
  if (targets.length !== classes.length || new Set(targets.map(target => target.assetClass)).size !== classes.length) throw new Error("يجب إدخال هدف واحد لكل فئة أصول.");
  const total = targets.reduce((sum, target) => {
    const targetPercent = new Decimal(target.targetPercent);
    const threshold = new Decimal(target.driftThresholdPercent);
    if (!targetPercent.isFinite() || targetPercent.lt(0) || targetPercent.gt(100)) throw new Error("نسبة التخصيص يجب أن تكون بين 0 و100.");
    if (!threshold.isFinite() || threshold.lt(0) || threshold.gt(100)) throw new Error("حد الانحراف يجب أن يكون بين 0 و100.");
    return sum.plus(targetPercent);
  }, new Decimal(0));
  if (!total.eq(100)) throw new Error("يجب أن يساوي مجموع نسب التخصيص المستهدفة 100% بالضبط.");
}
