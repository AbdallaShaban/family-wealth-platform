import Decimal from "decimal.js";

export type ChargeRuleInput = {
  name: string;
  chargeType: "fee" | "tax";
  appliesTo: "buy" | "sell" | "both";
  calculationMethod: "flat" | "percentage";
  value: string;
  currency: string | null;
};

export function suggestTradeCharges(args: { side: "buy" | "sell"; grossAmount: string; currency: string; rules: ChargeRuleInput[] }) {
  const gross = new Decimal(args.grossAmount);
  if (!gross.isFinite() || gross.lte(0)) throw new Error("قيمة الصفقة يجب أن تكون موجبة لاقتراح الرسوم والضرائب.");
  const currency = args.currency.toUpperCase();
  const applicable = args.rules.filter(rule => (rule.appliesTo === "both" || rule.appliesTo === args.side) && (rule.calculationMethod === "percentage" || rule.currency === currency));
  const rows = applicable.map(rule => {
    const value = new Decimal(rule.value);
    const amount = rule.calculationMethod === "percentage" ? gross.mul(value).div(100) : value;
    return { name: rule.name, chargeType: rule.chargeType, amount: amount.toFixed(8), calculationMethod: rule.calculationMethod, basis: rule.calculationMethod === "percentage" ? `${value.toFixed(4)}%` : "مبلغ ثابت" };
  });
  const totalFee = rows.filter(row => row.chargeType === "fee").reduce((sum, row) => sum.plus(row.amount), new Decimal(0));
  const totalTax = rows.filter(row => row.chargeType === "tax").reduce((sum, row) => sum.plus(row.amount), new Decimal(0));
  return { currency, grossAmount: gross.toFixed(8), suggestedFeeAmount: totalFee.toFixed(8), suggestedTaxAmount: totalTax.toFixed(8), rows };
}
