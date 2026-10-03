import { describe, it, expect, vi } from "vitest";
import {
  formatCurrency,
  formatHijriDate,
  formatGregorianDate,
  renderExecutiveReportHtml,
  generateExecutiveReportPdf,
  type ExecutiveReportData,
} from "../executivePdfService";

describe("Executive PDF Wealth Report Service", () => {
  const mockReportData: ExecutiveReportData = {
    reportId: "FWI-EXEC-2026-TEST01",
    generatedAt: 1791000000000,
    dateGregorian: "3 أكتوبر 2026",
    dateHijri: "22 ربيع الآخر 1448 هـ",
    periodLabel: "الفترة المالية: 2026-08",
    workspaceName: "عائلة آل شعبان لإدارة الثروات",
    baseCurrency: "EGP",
    ownerName: "عبد الله شعبان",
    isAudited: true,

    netWorth: 18500000,
    bookEquity: 16200000,
    totalAssets: 19500000,
    totalLiabilities: 3300000,
    netOperatingIncome: 450000,
    netCashFlow: 320000,
    isBalanced: true,
    imbalanceAmount: 0,

    cashAndEquivalents: {
      total: 4200000,
      accounts: [
        { name: "حساب بنك مصر جاري", currency: "EGP", balanceBase: 2500000 },
        { name: "حساب بنك CIB استثماري", currency: "USD", balanceBase: 1700000 },
      ],
    },
    investmentClearingTotal: 3800000,
    specialAssetsTotal: 11500000,
    debtAccounts: [
      { name: "تمويل عقاري بنكي", currency: "EGP", principalBase: 3300000 },
    ],

    goldAndFx: {
      karat24: 7012.21,
      karat21: 6135.68,
      karat18: 5259.16,
      sovereign: 49085.44,
      nisab85g24k: 596037.85,
      usdEgp: 52.02,
      eurEgp: 59.03,
      asOf: "2026-10-03T14:00:00.000Z",
      source: "Yahoo Finance Live Feed",
      isFallback: false,
    },

    zakat: {
      zakatBaseEgp: 6500000,
      nisabEgp: 596037.85,
      isDue: true,
      zakatDueEgp: 162500,
      lunarRatePct: 2.5,
      statusText: "بلغ النصاب الشرعي - الزكاة واجبة",
    },

    allocation: {
      cashAmount: 4200000,
      cashPct: 21.5,
      equitiesAmount: 3800000,
      equitiesPct: 19.5,
      goldAmount: 3500000,
      goldPct: 17.9,
      specialAssetsAmount: 8000000,
      specialAssetsPct: 41.1,
      totalAmount: 19500000,
    },

    inflationShield: {
      shieldIndexPct: 78,
      hardAssetsTotal: 15300000,
      paperAssetsTotal: 4200000,
      shieldRating: "درع متين فائق الحصانة",
      recommendation: "محفظة عالية التحوط ضد انخفاض القوة الشرائية وتدهور العملة المحلية.",
    },
  };

  it("correctly formats currency, Gregorian and Hijri dates", () => {
    const formatted = formatCurrency(1234567.89, "EGP");
    expect(formatted).toBe("1,234,567.89 EGP");

    const hijri = formatHijriDate(new Date("2026-10-03T00:00:00.000Z"));
    expect(hijri).toContain("1448");

    const gregorian = formatGregorianDate(new Date("2026-10-03T00:00:00.000Z"));
    expect(gregorian).toContain("2026");
  });

  it("renders luxury print-ready HTML with all mandatory executive sections", () => {
    const html = renderExecutiveReportHtml(mockReportData);

    // 1. Language & Direction
    expect(html).toContain('dir="rtl"');
    expect(html).toContain('lang="ar"');

    // 2. Cover Page & Platform Crest
    expect(html).toContain("Family Wealth Intelligence");
    expect(html).toContain("التقرير المالي والتنفيذي الشامل");
    expect(html).toContain("عائلة آل شعبان لإدارة الثروات");
    expect(html).toContain("FWI-EXEC-2026-TEST01");
    expect(html).toContain("22 ربيع الآخر 1448 هـ");

    // 3. Balance sheet & Net worth numbers
    expect(html).toContain("18,500,000.00 EGP");
    expect(html).toContain("19,500,000.00 EGP");
    expect(html).toContain("3,300,000.00 EGP");
    expect(html).toContain("معادلة التوازن المحاسبي");

    // 4. Gold and FX Live Feed
    expect(html).toContain("7,012.21 EGP");
    expect(html).toContain("6,135.68 EGP");
    expect(html).toContain("52.02 EGP");
    expect(html).toContain("59.03 EGP");

    // 5. Sharia Zakat & Nisab
    expect(html).toContain("596,037.85 EGP");
    expect(html).toContain("162,500.00 EGP");
    expect(html).toContain("بلغ النصاب الشرعي");

    // 6. Vector SVG Chart and Inflation Shield
    expect(html).toContain("<svg");
    expect(html).toContain("درع متين فائق الحصانة");
    expect(html).toContain("78%");

    // 7. Page structure
    const pageMatches = html.match(/class="page"/g);
    expect(pageMatches?.length).toBe(4);
  });

  it("compiles a valid binary PDF buffer via headless Chromium", async () => {
    const pdfBuffer = await generateExecutiveReportPdf(mockReportData);
    expect(pdfBuffer).toBeInstanceOf(Buffer);
    expect(pdfBuffer.length).toBeGreaterThan(15000);

    // Verify PDF header magic bytes "%PDF-"
    const magic = pdfBuffer.subarray(0, 5).toString("ascii");
    expect(magic).toBe("%PDF-");
  }, 45000);
});
