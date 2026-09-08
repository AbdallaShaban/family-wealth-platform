import Decimal from "decimal.js";

const TROY_OUNCE_GRAMS = new Decimal("31.1034768");

export function suggestGoldRevaluation(args: { quantity: string; unit: string; quotePerTroyOunce: string }) {
  const quantity = new Decimal(args.quantity);
  const quote = new Decimal(args.quotePerTroyOunce);
  if (!quantity.isFinite() || quantity.lte(0) || !quote.isFinite() || quote.lte(0)) throw new Error("تتطلب إعادة تقييم الذهب كمية وسعر Yahoo صالحين.");
  const normalizedUnit = args.unit.trim().toLowerCase();
  const ounces = ["gram", "grams", "g", "جرام", "غرام"].includes(normalizedUnit) ? quantity.div(TROY_OUNCE_GRAMS) : ["troy_ounce", "troy ounce", "oz", "ounce", "أونصة"].includes(normalizedUnit) ? quantity : null;
  if (!ounces) throw new Error("وحدة الذهب يجب أن تكون جرامًا أو أونصة تروي لاقتراح سعر Yahoo.");
  return { quotePerTroyOunce: quote.toFixed(8), suggestedTargetValue: ounces.mul(quote).toFixed(6), normalizedUnit: ounces.eq(quantity) ? "troy_ounce" : "gram" };
}
