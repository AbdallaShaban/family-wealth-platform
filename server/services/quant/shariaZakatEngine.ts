/**
 * Module P3: Automated Sharia Zakat & Gold Hawl Engine
 * Implements AAOIFI Shariah Standard No. 9:
 * - Nisab threshold based on 85 grams of 24-karat gold (نصاب الذهب 85 جرام عيار 24)
 * - Hawl tracking: 354 Hijri lunar days (or solar equivalent)
 * - Asset categories:
 *   * Cash & Bank Balances: 100% subject to 2.5% Zakat
 *   * Monetary Gold & Bullion: 100% subject to 2.5% Zakat
 *   * Trading Equities (مضاربة / عروض تجارة): 100% market value @ 2.5%
 *   * Long-Term Investment Equities (استثمار استراتيجي): 10% working capital proxy @ 2.5%
 *   * Deductible Immediate Debts: short-term dues deducted before Nisab test
 */

export interface ShariaZakatAssetBreakdown {
  categoryKey: "CASH" | "MONETARY_GOLD" | "TRADING_STOCKS" | "LONG_TERM_STOCKS";
  labelAr: string;
  grossAmountEgp: number;
  zakatablePercentage: number; // e.g. 100 or 10 (%)
  zakatableAmountEgp: number;
  zakatRate: number; // 0.025 (2.5%)
  zakatDueEgp: number;
  shariaRuleAr: string;
}

export interface ShariaZakatInput {
  goldGramPrice24k?: number;
  cashAndBankBalancesEgp: number;
  monetaryGoldValueEgp?: number;
  tradingStocksMarketValueEgp?: number;
  longTermStocksMarketValueEgp?: number;
  immediateDebtsDueEgp?: number;
  hawlElapsedDays?: number; // defaults to 354 if due or custom elapsed
  customHawlStartDate?: string;
}

export interface HawlCountdown {
  elapsedDays: number;
  remainingDays: number;
  totalLunarDays: number; // 354
  isDue: boolean;
  status: "DUE_NOW" | "ACCUMULATING" | "BELOW_NISAB";
  statusAr: string;
  dueDateFormattedAr: string;
}

export interface ShariaZakatDashboard {
  gold24kPricePerGram: number;
  goldNisabGrams: number; // 85g
  nisabValueEgp: number; // 85 * gold24kPricePerGram
  isAboveNisab: boolean;
  totalGrossWealthEgp: number;
  deductibleDebtsEgp: number;
  netZakatableWealthEgp: number;
  totalZakatDueEgp: number;
  totalZakatDue?: number;
  hawlCountdown: HawlCountdown;
  assetBreakdown: ShariaZakatAssetBreakdown[];
  rulingNotesAr: string[];
}

export const GOLD_NISAB_GRAMS = 85;
export const DEFAULT_GOLD_24K_PRICE_EGP = 4650;
export const HIJRI_YEAR_DAYS = 354;
export const SHARIA_ZAKAT_RATE = 0.025; // 2.5% per lunar year

export function calculateNisabThreshold(goldGramPrice24k?: number): {
  goldNisabGrams: number;
  nisabValueEgp: number;
} {
  const price = goldGramPrice24k && goldGramPrice24k > 0 ? goldGramPrice24k : DEFAULT_GOLD_24K_PRICE_EGP;
  return {
    goldNisabGrams: GOLD_NISAB_GRAMS,
    nisabValueEgp: Math.round(GOLD_NISAB_GRAMS * price),
  };
}

export function calculateShariaZakatDashboard(input: ShariaZakatInput): ShariaZakatDashboard {
  const goldPrice = input.goldGramPrice24k && input.goldGramPrice24k > 0
    ? input.goldGramPrice24k
    : DEFAULT_GOLD_24K_PRICE_EGP;

  const nisabThreshold = calculateNisabThreshold(goldPrice);

  const cash = Math.max(0, input.cashAndBankBalancesEgp || 0);
  const gold = Math.max(0, input.monetaryGoldValueEgp || 0);
  const trading = Math.max(0, input.tradingStocksMarketValueEgp || 0);
  const longTerm = Math.max(0, input.longTermStocksMarketValueEgp || 0);
  const debts = Math.max(0, input.immediateDebtsDueEgp || 0);

  // Asset breakdowns according to AAOIFI rulings
  // 1. Cash: 100% @ 2.5%
  const cashZakatable = cash;
  const cashZakatDue = cashZakatable * SHARIA_ZAKAT_RATE;

  // 2. Monetary Gold: 100% @ 2.5%
  const goldZakatable = gold;
  const goldZakatDue = goldZakatable * SHARIA_ZAKAT_RATE;

  // 3. Trading Stocks (عروض التجارة): 100% market value @ 2.5%
  const tradingZakatable = trading;
  const tradingZakatDue = tradingZakatable * SHARIA_ZAKAT_RATE;

  // 4. Long-Term Investment Equities: 10% working capital proxy @ 2.5%
  const ltZakatable = longTerm * 0.1;
  const ltZakatDue = ltZakatable * SHARIA_ZAKAT_RATE;

  const totalGrossWealth = cash + gold + trading + longTerm;
  const grossZakatableWealth = cashZakatable + goldZakatable + tradingZakatable + ltZakatable;
  const netZakatableWealth = Math.max(0, grossZakatableWealth - debts);

  const isAboveNisab = netZakatableWealth >= nisabThreshold.nisabValueEgp;

  // Hawl Countdown
  const elapsed = input.hawlElapsedDays ?? 354;
  const remaining = Math.max(0, HIJRI_YEAR_DAYS - elapsed);
  const isDue = isAboveNisab && remaining === 0;

  let hawlStatus: "DUE_NOW" | "ACCUMULATING" | "BELOW_NISAB" = "ACCUMULATING";
  let hawlStatusAr = `اكتمال الحول قيد الانتظار — متبقي ${remaining} يوم قمري`;

  if (!isAboveNisab) {
    hawlStatus = "BELOW_NISAB";
    hawlStatusAr = "دون النصاب الشرعي — لا تجب الزكاة لعدم بلوغ النصاب";
  } else if (isDue) {
    hawlStatus = "DUE_NOW";
    hawlStatusAr = "حالت الزكاة ووجب إخراجها فوراً — اكتمل الحول القمري (354 يوماً)";
  }

  const dueDate = new Date(Date.now() + remaining * 24 * 3600 * 1000);
  const dueDateFormattedAr = dueDate.toLocaleDateString("ar-EG", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const totalZakatDue = isAboveNisab ? Math.round(netZakatableWealth * SHARIA_ZAKAT_RATE * 100) / 100 : 0;

  const assetBreakdown: ShariaZakatAssetBreakdown[] = [
    {
      categoryKey: "CASH",
      labelAr: "السيولة والحسابات البنكية والمحافظ",
      grossAmountEgp: Math.round(cash * 100) / 100,
      zakatablePercentage: 100,
      zakatableAmountEgp: Math.round(cashZakatable * 100) / 100,
      zakatRate: SHARIA_ZAKAT_RATE,
      zakatDueEgp: Math.round(cashZakatDue * 100) / 100,
      shariaRuleAr: "تجب الزكاة بنسبة 2.5% على كامل السيولة النقدية وما في حكمها عند بلوغ النصاب ومرور الحول.",
    },
    {
      categoryKey: "MONETARY_GOLD",
      labelAr: "الذهب النقدي والسبائك الاستثمارية",
      grossAmountEgp: Math.round(gold * 100) / 100,
      zakatablePercentage: 100,
      zakatableAmountEgp: Math.round(goldZakatable * 100) / 100,
      zakatRate: SHARIA_ZAKAT_RATE,
      zakatDueEgp: Math.round(goldZakatDue * 100) / 100,
      shariaRuleAr: "السبائك والجنيهات الذهبية المدخرة تعامل كأصل نقدي زكوي بنسبة 2.5% من القيمة السوقية الفورية.",
    },
    {
      categoryKey: "TRADING_STOCKS",
      labelAr: "أسهم المضاربة والتداول قصير الأجل",
      grossAmountEgp: Math.round(trading * 100) / 100,
      zakatablePercentage: 100,
      zakatableAmountEgp: Math.round(tradingZakatable * 100) / 100,
      zakatRate: SHARIA_ZAKAT_RATE,
      zakatDueEgp: Math.round(tradingZakatDue * 100) / 100,
      shariaRuleAr: "عروض تجارة: يُقوَّم السهم بقيمته السوقية الكاملة يوم وجوب الزكاة بنسبة 2.5%.",
    },
    {
      categoryKey: "LONG_TERM_STOCKS",
      labelAr: "أسهم الاستثمار طويل الأجل والمدرة للتوزيعات",
      grossAmountEgp: Math.round(longTerm * 100) / 100,
      zakatablePercentage: 10,
      zakatableAmountEgp: Math.round(ltZakatable * 100) / 100,
      zakatRate: SHARIA_ZAKAT_RATE,
      zakatDueEgp: Math.round(ltZakatDue * 100) / 100,
      shariaRuleAr: "معيار الأيوفي (AAOIFI): تُزكى الأصول المتداولة ورأس المال العامل للشركة فقط (تقديرياً 10%) ولا تُزكى الأصول الثابتة والآلات.",
    },
  ];

  const rulingNotesAr: string[] = [
    "النصاب الشرعي محسوب على أساس 85 جراماً من الذهب عيار 24 بسعر اليوم (" + goldPrice.toLocaleString("en-US") + " ج.م/جرام).",
    "تُخصم الديون العاجلة وواجبة السداد فوراً (" + debts.toLocaleString("en-US") + " ج.م) من الوعاء الزكوي قبل احتساب الفريضة.",
    "الحول القمري المعتمد شرعاً هو 354 يوماً (السنة الهجرية).",
  ];

  return {
    gold24kPricePerGram: goldPrice,
    goldNisabGrams: nisabThreshold.goldNisabGrams,
    nisabValueEgp: nisabThreshold.nisabValueEgp,
    isAboveNisab,
    totalGrossWealthEgp: Math.round(totalGrossWealth * 100) / 100,
    deductibleDebtsEgp: Math.round(debts * 100) / 100,
    netZakatableWealthEgp: Math.round(netZakatableWealth * 100) / 100,
    totalZakatDue,
    totalZakatDueEgp: totalZakatDue,
    hawlCountdown: {
      elapsedDays: elapsed,
      remainingDays: remaining,
      totalLunarDays: HIJRI_YEAR_DAYS,
      isDue,
      status: hawlStatus,
      statusAr: hawlStatusAr,
      dueDateFormattedAr,
    },
    assetBreakdown,
    rulingNotesAr,
  };
}
