import Decimal from "decimal.js";

export function calculateZakat(args: {
  eligibleBase: string;
  goldPricePerGramBase: string;
  goldNisabGrams?: string;
  annualRatePercent?: string;
  calendarType?: "hijri" | "gregorian";
  haulCompleted: boolean;
}) {
  const eligibleBase = new Decimal(args.eligibleBase);
  const goldPricePerGramBase = new Decimal(args.goldPricePerGramBase);
  const goldNisabGrams = new Decimal(args.goldNisabGrams ?? "85");
  // AAOIFI Shariah Standard No. 9: 2.5% for Lunar (Hijri) year, 2.577% for Solar (Gregorian) year (365.25 / 354 * 2.5% = 2.5775% or 2.577%)
  const defaultRate = args.calendarType === "gregorian" ? "2.577" : "2.5";
  const annualRatePercent = new Decimal(args.annualRatePercent ?? defaultRate);
  if (eligibleBase.isNegative() || goldPricePerGramBase.lte(0) || goldNisabGrams.lte(0) || annualRatePercent.lt(0)) {
    throw new Error("مدخلات حساب الزكاة غير صالحة.");
  }
  const nisabBase = goldPricePerGramBase.mul(goldNisabGrams);
  const meetsNisab = eligibleBase.gte(nisabBase);
  const zakatDueBase = args.haulCompleted && meetsNisab ? eligibleBase.mul(annualRatePercent).div(100) : new Decimal(0);
  return {
    eligibleBase: eligibleBase.toFixed(6),
    goldNisabGrams: goldNisabGrams.toFixed(4),
    goldPricePerGramBase: goldPricePerGramBase.toFixed(6),
    nisabBase: nisabBase.toFixed(6),
    annualRatePercent: annualRatePercent.toFixed(4),
    calendarType: args.calendarType ?? "hijri",
    meetsNisab,
    haulCompleted: args.haulCompleted,
    zakatDueBase: zakatDueBase.toFixed(6),
    disclosure: "هذه نتيجة حسابية وفق معايير أيوفي (AAOIFI) الشرعية ومدخلات قابلة للتعديل وليست فتوى أو توصية دينية أو مالية.",
  };
}
