import Decimal from "decimal.js";

export function calculateZakat(args: { eligibleBase: string; goldPricePerGramBase: string; goldNisabGrams?: string; annualRatePercent?: string; haulCompleted: boolean }) {
  const eligibleBase = new Decimal(args.eligibleBase);
  const goldPricePerGramBase = new Decimal(args.goldPricePerGramBase);
  const goldNisabGrams = new Decimal(args.goldNisabGrams ?? "85");
  const annualRatePercent = new Decimal(args.annualRatePercent ?? "2.5");
  if (eligibleBase.isNegative() || goldPricePerGramBase.lte(0) || goldNisabGrams.lte(0) || annualRatePercent.lt(0)) throw new Error("مدخلات حساب الزكاة غير صالحة.");
  const nisabBase = goldPricePerGramBase.mul(goldNisabGrams);
  const meetsNisab = eligibleBase.gte(nisabBase);
  const zakatDueBase = args.haulCompleted && meetsNisab ? eligibleBase.mul(annualRatePercent).div(100) : new Decimal(0);
  return { eligibleBase: eligibleBase.toFixed(6), goldNisabGrams: goldNisabGrams.toFixed(4), goldPricePerGramBase: goldPricePerGramBase.toFixed(6), nisabBase: nisabBase.toFixed(6), annualRatePercent: annualRatePercent.toFixed(4), meetsNisab, haulCompleted: args.haulCompleted, zakatDueBase: zakatDueBase.toFixed(6), disclosure: "هذه نتيجة حسابية وفق مدخلات منهجية قابلة للتعديل وليست فتوى أو توصية دينية أو مالية." };
}
