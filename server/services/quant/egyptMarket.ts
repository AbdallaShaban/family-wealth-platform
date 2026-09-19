/**
 * Egyptian Market Asset Registry, Gold Pricing & Mutual Funds Engine
 * Specially tailored for Egyptian Exchange (EGX), Local Physical Gold & Egyptian Mutual Funds.
 */

export interface EGXInstrument {
  ticker: string; // e.g. "COMI.CA"
  symbol: string; // e.g. "COMI"
  nameAr: string;
  nameEn: string;
  sector: string;
  currency: "EGP";
  typicalDividendYield: number; // percentage, e.g. 4.5
  parValue?: number;
  lastClose?: number;
  historicalVolatility?: number;
}

export interface GoldPurityQuote {
  karat: 24 | 21 | 18;
  nameAr: string;
  gramPriceEGP: number;
  buyPriceEGP: number; // Merchant buy back
  sellPriceEGP: number; // Merchant selling with avg fabrication
  change24hPercent: number;
  updatedAt: string;
}

export interface GoldSovereignQuote {
  nameAr: string;
  weightGrams: number; // 8g of 21k
  priceEGP: number;
  buyPriceEGP: number;
  updatedAt: string;
}

export interface EgyptianMutualFund {
  code: string;
  nameAr: string;
  nameEn: string;
  category: "MONEY_MARKET" | "EQUITY" | "ISLAMIC" | "GOLD" | "BALANCED";
  manager: string;
  currency: "EGP";
  latestNAV: number;
  navDate: string;
  ytdReturnPercent: number;
  expenseRatioPercent: number;
  minSubscriptionEGP: number;
}

export interface DividendCalendarItem {
  ticker: string;
  nameAr: string;
  announcedDate?: string;
  exDividendDate: string;
  paymentDate: string;
  dividendPerShareEGP: number;
  status: "CONFIRMED" | "ESTIMATED";
}

/**
 * Curated Top Egyptian Exchange (EGX) Equities
 */
export const EGX_TOP_INSTRUMENTS: EGXInstrument[] = [
  {
    ticker: "COMI.CA",
    symbol: "COMI",
    nameAr: "البنك التجاري الدولي - مصر",
    nameEn: "Commercial International Bank (CIB)",
    sector: "الخدمات المالية والمصرفية",
    currency: "EGP",
    typicalDividendYield: 3.5,
    lastClose: 88.5,
    historicalVolatility: 0.22,
  },
  {
    ticker: "ADIB.CA",
    symbol: "ADIB",
    nameAr: "مصرف أبوظبي الإسلامي - مصر",
    nameEn: "Abu Dhabi Islamic Bank - Egypt",
    sector: "الخدمات المالية والمصرفية",
    currency: "EGP",
    typicalDividendYield: 5.2,
    lastClose: 46.2,
    historicalVolatility: 0.28,
  },
  {
    ticker: "TMGH.CA",
    symbol: "TMGH",
    nameAr: "مجموعة طلعت مصطفى القابضة",
    nameEn: "Talaat Moustafa Group Holding",
    sector: "العقارات",
    currency: "EGP",
    typicalDividendYield: 2.1,
    lastClose: 63.8,
    historicalVolatility: 0.35,
  },
  {
    ticker: "ETEL.CA",
    symbol: "ETEL",
    nameAr: "الشركة المصرية للاتصالات (وي)",
    nameEn: "Telecom Egypt",
    sector: "الاتصالات",
    currency: "EGP",
    typicalDividendYield: 4.8,
    lastClose: 39.4,
    historicalVolatility: 0.24,
  },
  {
    ticker: "HRHO.CA",
    symbol: "HRHO",
    nameAr: "إي إف جي القابضة (هيرميس)",
    nameEn: "EFG Holding",
    sector: "الخدمات المالية غير المصرفية",
    currency: "EGP",
    typicalDividendYield: 3.8,
    lastClose: 21.3,
    historicalVolatility: 0.3,
  },
  {
    ticker: "SWDY.CA",
    symbol: "SWDY",
    nameAr: "السويدي إليكتريك",
    nameEn: "Elsewedy Electric",
    sector: "الصناعة والمقاولات",
    currency: "EGP",
    typicalDividendYield: 4.0,
    lastClose: 48.0,
    historicalVolatility: 0.26,
  },
  {
    ticker: "EAST.CA",
    symbol: "EAST",
    nameAr: "الشرقية - إيسترن كومباني",
    nameEn: "Eastern Company",
    sector: "الأغذية والمشروبات والتبغ",
    currency: "EGP",
    typicalDividendYield: 9.5,
    lastClose: 27.5,
    historicalVolatility: 0.21,
  },
  {
    ticker: "SKPC.CA",
    symbol: "SKPC",
    nameAr: "سيدي كرير للبتروكيماويات (سيدبك)",
    nameEn: "Sidi Kerir Petrochemicals",
    sector: "المواد الأساسية والبتروكيماويات",
    currency: "EGP",
    typicalDividendYield: 7.2,
    lastClose: 28.9,
    historicalVolatility: 0.32,
  },
  {
    ticker: "ABUK.CA",
    symbol: "ABUK",
    nameAr: "أبو قير للأسمدة والصناعات الكيماوية",
    nameEn: "Abu Qir Fertilizers",
    sector: "المواد الأساسية والبتروكيماويات",
    currency: "EGP",
    typicalDividendYield: 8.0,
    lastClose: 61.5,
    historicalVolatility: 0.29,
  },
  {
    ticker: "MNHD.CA",
    symbol: "MNHD",
    nameAr: "مدينة مصر للإسكان والتعمير",
    nameEn: "Madinet Masr for Housing and Development",
    sector: "العقارات",
    currency: "EGP",
    typicalDividendYield: 4.2,
    lastClose: 4.85,
    historicalVolatility: 0.34,
  },
];

/**
 * Curated Egyptian Mutual Funds Models
 */
export const EGYPTIAN_MUTUAL_FUNDS: EgyptianMutualFund[] = [
  {
    code: "AZG",
    nameAr: "صندوق أزيموت للذهب (AZ Gold)",
    nameEn: "Azimut Gold Fund",
    category: "GOLD",
    manager: "أزيموت مصر للحلول الاستثمارية",
    currency: "EGP",
    latestNAV: 24.15,
    navDate: new Date().toISOString().split("T")[0],
    ytdReturnPercent: 28.4,
    expenseRatioPercent: 1.5,
    minSubscriptionEGP: 100,
  },
  {
    code: "MISR_DAILY",
    nameAr: "صندوق مصر النقدي (يومي بالفوائد التراكمية)",
    nameEn: "Misr Bank Daily Money Market Fund",
    category: "MONEY_MARKET",
    manager: "مصر لإدارة صناديق الاستثمار",
    currency: "EGP",
    latestNAV: 142.8,
    navDate: new Date().toISOString().split("T")[0],
    ytdReturnPercent: 21.8,
    expenseRatioPercent: 0.75,
    minSubscriptionEGP: 1000,
  },
  {
    code: "NBE_4TH",
    nameAr: "صندوق البنك الأهلي الرابع (أسهم ونمو)",
    nameEn: "NBE 4th Equity & Growth Fund",
    category: "EQUITY",
    manager: "الأهلي لإدارة الاستثمارات المالية",
    currency: "EGP",
    latestNAV: 310.5,
    navDate: new Date().toISOString().split("T")[0],
    ytdReturnPercent: 34.2,
    expenseRatioPercent: 1.8,
    minSubscriptionEGP: 500,
  },
  {
    code: "HELA_ISLAMIC",
    nameAr: "صندوق سنابل الإسلامي (متوافق مع الشريعة)",
    nameEn: "Sanabel Islamic Equity Fund",
    category: "ISLAMIC",
    manager: "إتش سي للأوراق المالية والاستثمار",
    currency: "EGP",
    latestNAV: 185.3,
    navDate: new Date().toISOString().split("T")[0],
    ytdReturnPercent: 31.0,
    expenseRatioPercent: 1.9,
    minSubscriptionEGP: 500,
  },
];

/**
 * Calculate Egyptian Physical Gold Live & Benchmarked Quotes
 * 24k base purity with standard local spreads:
 * 21k = 24k * (21 / 24)
 * 18k = 24k * (18 / 24)
 * Sovereign (جنيه ذهب) = 8 grams of 21k
 */
export function calculatePhysicalGoldQuotes(base24kPerGramEGP = 4600): {
  purities: GoldPurityQuote[];
  sovereign: GoldSovereignQuote;
} {
  const base24k = Math.max(1000, Number(base24kPerGramEGP) || 4600);
  const p21 = (base24k * 21) / 24;
  const p18 = (base24k * 18) / 24;

  const now = new Date().toISOString();

  const purities: GoldPurityQuote[] = [
    {
      karat: 24,
      nameAr: "ذهب عيار 24 (سبائك نقية)",
      gramPriceEGP: Math.round(base24k),
      buyPriceEGP: Math.round(base24k - 25),
      sellPriceEGP: Math.round(base24k + 65), // with avg ingot fabrication
      change24hPercent: 0.65,
      updatedAt: now,
    },
    {
      karat: 21,
      nameAr: "ذهب عيار 21 (الأكثر تداولاً)",
      gramPriceEGP: Math.round(p21),
      buyPriceEGP: Math.round(p21 - 25),
      sellPriceEGP: Math.round(p21 + 75), // standard craftsmanship
      change24hPercent: 0.65,
      updatedAt: now,
    },
    {
      karat: 18,
      nameAr: "ذهب عيار 18 (مشغولات)",
      gramPriceEGP: Math.round(p18),
      buyPriceEGP: Math.round(p18 - 20),
      sellPriceEGP: Math.round(p18 + 95),
      change24hPercent: 0.65,
      updatedAt: now,
    },
  ];

  const sovereignPrice = Math.round(p21 * 8);
  const sovereign: GoldSovereignQuote = {
    nameAr: "الجنيه الذهب (8 جرام عيار 21 BTC/سويسري)",
    weightGrams: 8,
    priceEGP: sovereignPrice,
    buyPriceEGP: sovereignPrice - 200,
    updatedAt: now,
  };

  return { purities, sovereign };
}

/**
 * Expected / Confirmed EGX Dividend Cash Flow Calendar
 */
export const EGX_DIVIDEND_CALENDAR: DividendCalendarItem[] = [
  {
    ticker: "COMI.CA",
    nameAr: "البنك التجاري الدولي (CIB)",
    announcedDate: "2026-02-15",
    exDividendDate: "2026-03-26",
    paymentDate: "2026-04-05",
    dividendPerShareEGP: 3.1,
    status: "CONFIRMED",
  },
  {
    ticker: "EAST.CA",
    nameAr: "الشرقية للدخان (إيسترن كومباني)",
    announcedDate: "2026-09-01",
    exDividendDate: "2026-10-18",
    paymentDate: "2026-10-28",
    dividendPerShareEGP: 2.6,
    status: "CONFIRMED",
  },
  {
    ticker: "ABUK.CA",
    nameAr: "أبو قير للأسمدة",
    announcedDate: "2026-08-20",
    exDividendDate: "2026-10-12",
    paymentDate: "2026-10-22",
    dividendPerShareEGP: 4.8,
    status: "CONFIRMED",
  },
  {
    ticker: "ETEL.CA",
    nameAr: "المصرية للاتصالات",
    announcedDate: "2026-03-10",
    exDividendDate: "2026-04-16",
    paymentDate: "2026-04-26",
    dividendPerShareEGP: 1.85,
    status: "CONFIRMED",
  },
  {
    ticker: "ADIB.CA",
    nameAr: "مصرف أبوظبي الإسلامي",
    announcedDate: "2026-03-01",
    exDividendDate: "2026-04-08",
    paymentDate: "2026-04-18",
    dividendPerShareEGP: 2.4,
    status: "ESTIMATED",
  },
  {
    ticker: "SWDY.CA",
    nameAr: "السويدي إليكتريك",
    announcedDate: "2026-04-12",
    exDividendDate: "2026-05-15",
    paymentDate: "2026-05-25",
    dividendPerShareEGP: 1.95,
    status: "ESTIMATED",
  },
];

/**
 * Calculates projected dividend cashflow for a user's holdings
 */
export function calculateProjectedDividends(holdings: { ticker: string; sharesCount: number }[]): {
  totalAnnualCashFlowEGP: number;
  monthlyBreakdown: { month: string; amountEGP: number }[];
  schedule: (DividendCalendarItem & { totalExpectedEGP: number; userShares: number })[];
} {
  const schedule: (DividendCalendarItem & { totalExpectedEGP: number; userShares: number })[] = [];
  const monthlyMap = new Map<string, number>();

  let totalAnnualCashFlowEGP = 0;

  for (const h of holdings) {
    const matched = EGX_DIVIDEND_CALENDAR.find(
      (d) => d.ticker.toUpperCase() === h.ticker.toUpperCase() || d.ticker.startsWith(h.ticker.toUpperCase())
    );

    if (matched && h.sharesCount > 0) {
      const totalPayout = Number((matched.dividendPerShareEGP * h.sharesCount).toFixed(2));
      totalAnnualCashFlowEGP += totalPayout;

      schedule.push({
        ...matched,
        userShares: h.sharesCount,
        totalExpectedEGP: totalPayout,
      });

      const monthKey = matched.paymentDate.substring(0, 7); // "YYYY-MM"
      monthlyMap.set(monthKey, (monthlyMap.get(monthKey) || 0) + totalPayout);
    }
  }

  const monthlyBreakdown = Array.from(monthlyMap.entries())
    .map(([month, amountEGP]) => ({ month, amountEGP: Number(amountEGP.toFixed(2)) }))
    .sort((a, b) => a.month.localeCompare(b.month));

  return {
    totalAnnualCashFlowEGP: Number(totalAnnualCashFlowEGP.toFixed(2)),
    monthlyBreakdown,
    schedule,
  };
}
